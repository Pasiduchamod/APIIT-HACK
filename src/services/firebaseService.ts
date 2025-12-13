import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  DocumentReference,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Incident } from '../database/db';
import { AidRequest } from '../database/models/AidRequest';

/**
 * FIRESTORE COLLECTIONS SCHEMA
 * 
 * Collection: incidents
 * - id (string): Document ID (same as incident.id)
 * - type (string): Incident type (e.g., 'fire', 'flood', 'earthquake')
 * - severity (number): 1-5 severity level
 * - latitude (number): GPS latitude
 * - longitude (number): GPS longitude
 * - timestamp (Timestamp): When incident occurred
 * - status (string): 'pending' | 'synced' | 'failed'
 * - userId (string): User who reported (from auth)
 * - created_at (Timestamp): When document was created
 * - updated_at (Timestamp): When document was last updated
 * - description (string): Optional incident description
 * - imageUrl (string): Optional image URL in storage
 */

export interface FirebaseIncident extends Incident {
  userId?: string;
  description?: string;
  imageUrl?: string;
}

export interface FirebaseAidRequest extends AidRequest {
  userId?: string;
}

/**
 * Timeout wrapper for Firebase operations
 * Prevents app crashes from hanging Firebase calls
 */
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 8000,
  operationName: string = 'Firebase operation'
): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
};

class FirebaseService {
  private static instance: FirebaseService;
  private incidentsCollection = 'incidents';
  private aidRequestsCollection = 'aid_requests';

  private constructor() {}

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * CREATE: Add new incident to Firestore
   */
  async createIncident(incident: Omit<FirebaseIncident, 'created_at' | 'updated_at'>, userId: string): Promise<string> {
    try {
      const now = Timestamp.now();
      const incidentRef = doc(db, this.incidentsCollection, incident.id);

      const firebaseIncident: FirebaseIncident = {
        ...incident,
        userId,
        created_at: now.toMillis(),
        updated_at: now.toMillis(),
        timestamp: incident.timestamp,
      };

      await withTimeout(
        setDoc(incidentRef, firebaseIncident),
        8000,
        'Create incident'
      );
      console.log('✓ Incident created in Firestore:', incident.id);
      return incident.id;
    } catch (error) {
      console.error('Error creating incident in Firestore:', error);
      throw error;
    }
  }

  /**
   * READ: Get single incident by ID
   */
  async getIncident(incidentId: string): Promise<FirebaseIncident | null> {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      const docSnap = await getDoc(incidentRef);

      if (docSnap.exists()) {
        return docSnap.data() as FirebaseIncident;
      }
      return null;
    } catch (error) {
      console.error('Error getting incident:', error);
      throw error;
    }
  }

  /**
   * READ: Get all incidents
   */
  async getAllIncidents(): Promise<FirebaseIncident[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.incidentsCollection));
      const incidents: FirebaseIncident[] = [];

      querySnapshot.forEach((doc) => {
        incidents.push({
          ...doc.data(),
          id: doc.id,
        } as FirebaseIncident);
      });

      return incidents;
    } catch (error) {
      console.error('Error getting all incidents:', error);
      throw error;
    }
  }

  /**
   * READ: Get incidents by user
   */
  async getIncidentsByUser(userId: string): Promise<FirebaseIncident[]> {
    try {
      const q = query(
        collection(db, this.incidentsCollection),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const incidents: FirebaseIncident[] = [];

      querySnapshot.forEach((doc) => {
        incidents.push({
          ...doc.data(),
          id: doc.id,
        } as FirebaseIncident);
      });

      return incidents;
    } catch (error) {
      console.error('Error getting user incidents:', error);
      throw error;
    }
  }

  /**
   * READ: Get pending incidents (not yet synced)
   */
  async getPendingIncidents(): Promise<FirebaseIncident[]> {
    try {
      const q = query(
        collection(db, this.incidentsCollection),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      const incidents: FirebaseIncident[] = [];

      querySnapshot.forEach((doc) => {
        incidents.push({
          ...doc.data(),
          id: doc.id,
        } as FirebaseIncident);
      });

      return incidents;
    } catch (error) {
      console.error('Error getting pending incidents:', error);
      throw error;
    }
  }

  /**
   * READ: Get incidents by severity
   */
  async getIncidentsBySeverity(severity: number): Promise<FirebaseIncident[]> {
    try {
      const q = query(
        collection(db, this.incidentsCollection),
        where('severity', '==', severity)
      );
      const querySnapshot = await getDocs(q);
      const incidents: FirebaseIncident[] = [];

      querySnapshot.forEach((doc) => {
        incidents.push({
          ...doc.data(),
          id: doc.id,
        } as FirebaseIncident);
      });

      return incidents;
    } catch (error) {
      console.error('Error getting incidents by severity:', error);
      throw error;
    }
  }

  /**
   * READ: Get incidents by type
   */
  async getIncidentsByType(type: string): Promise<FirebaseIncident[]> {
    try {
      const q = query(
        collection(db, this.incidentsCollection),
        where('type', '==', type)
      );
      const querySnapshot = await getDocs(q);
      const incidents: FirebaseIncident[] = [];

      querySnapshot.forEach((doc) => {
        incidents.push({
          ...doc.data(),
          id: doc.id,
        } as FirebaseIncident);
      });

      return incidents;
    } catch (error) {
      console.error('Error getting incidents by type:', error);
      throw error;
    }
  }

  /**
   * UPDATE: Update incident status
   */
  async updateIncidentStatus(incidentId: string, status: 'pending' | 'synced' | 'failed'): Promise<void> {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      await updateDoc(incidentRef, {
        status,
        updated_at: Timestamp.now().toMillis(),
      });
      console.log('✓ Incident status updated:', incidentId, status);
    } catch (error) {
      console.error('Error updating incident status:', error);
      throw error;
    }
  }

  /**
   * UPDATE: Update incident
   */
  async updateIncident(incidentId: string, updates: Partial<FirebaseIncident>): Promise<void> {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      await updateDoc(incidentRef, {
        ...updates,
        updated_at: Timestamp.now().toMillis(),
      });
      console.log('✓ Incident updated:', incidentId);
    } catch (error) {
      console.error('Error updating incident:', error);
      throw error;
    }
  }

  /**
   * UPDATE: Update incident image URLs
   * Call this after uploading images to Firebase Storage
   */
  async updateIncidentImages(
    incidentId: string,
    cloudImageUrls: string[],
    imageQualities: string[]
  ): Promise<void> {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      await withTimeout(
        updateDoc(incidentRef, {
          cloudImageUrls,
          imageQualities,
          updated_at: Timestamp.now().toMillis(),
        }),
        8000,
        `Update incident images ${incidentId}`
      );
      console.log('✓ Incident images updated in Firestore:', incidentId);
    } catch (error) {
      console.error('Error updating incident images:', error);
      throw error;
    }
  }

  /**
   * DELETE: Remove incident (soft delete - mark as deleted)
   */
  async deleteIncident(incidentId: string): Promise<void> {
    try {
      const incidentRef = doc(db, this.incidentsCollection, incidentId);
      await updateDoc(incidentRef, {
        status: 'deleted',
        updated_at: Timestamp.now().toMillis(),
      });
      console.log('✓ Incident deleted:', incidentId);
    } catch (error) {
      console.error('Error deleting incident:', error);
      throw error;
    }
  }

  /**
   * BULK: Sync multiple incidents to Firestore
   */
  async syncIncidents(incidents: FirebaseIncident[], userId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      for (const incident of incidents) {
        try {
          const incidentRef = doc(db, this.incidentsCollection, incident.id);
          const now = Timestamp.now().toMillis();

          await withTimeout(
            setDoc(incidentRef, {
              ...incident,
              userId,
              updated_at: now,
            }, { merge: true }),
            8000,
            `Sync incident ${incident.id}`
          );

          success++;
        } catch (error) {
          console.error(`Failed to sync incident ${incident.id}:`, error);
          failed++;
        }
      }

      console.log(`✓ Sync complete: ${success} successful, ${failed} failed`);
      return { success, failed };
    } catch (error) {
      console.error('Error during bulk sync:', error);
      return { success, failed };
    }
  }

  /**
   * STATS: Get total incident count
   */
  async getIncidentCount(): Promise<number> {
    try {
      const querySnapshot = await getDocs(collection(db, this.incidentsCollection));
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting incident count:', error);
      throw error;
    }
  }

  /**
   * STATS: Get count by severity
   */
  async getCountBySeverity(): Promise<Record<number, number>> {
    try {
      const incidents = await this.getAllIncidents();
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      incidents.forEach((incident) => {
        if (counts[incident.severity] !== undefined) {
          counts[incident.severity]++;
        }
      });

      return counts;
    } catch (error) {
      console.error('Error getting count by severity:', error);
      throw error;
    }
  }

  /**
   * STATS: Get count by type
   */
  async getCountByType(): Promise<Record<string, number>> {
    try {
      const incidents = await this.getAllIncidents();
      const counts: Record<string, number> = {};

      incidents.forEach((incident) => {
        counts[incident.type] = (counts[incident.type] || 0) + 1;
      });

      return counts;
    } catch (error) {
      console.error('Error getting count by type:', error);
      throw error;
    }
  }

  // ========== AID REQUEST OPERATIONS ==========

  /**
   * CREATE: Add new aid request to Firestore
   */
  async createAidRequest(aidRequest: Omit<FirebaseAidRequest, 'created_at' | 'updated_at'>, userId: string): Promise<string> {
    try {
      const now = Timestamp.now();
      const aidRequestRef = doc(db, this.aidRequestsCollection, aidRequest.id);

      const firebaseAidRequest: FirebaseAidRequest = {
        ...aidRequest,
        userId,
        created_at: now.toMillis(),
        updated_at: now.toMillis(),
      };

      await setDoc(aidRequestRef, firebaseAidRequest);
      console.log('✓ Aid request created in Firestore:', aidRequest.id);
      return aidRequest.id;
    } catch (error) {
      console.error('Error creating aid request in Firestore:', error);
      throw error;
    }
  }

  /**
   * SYNC: Batch sync aid requests to Firestore
   */
  async syncAidRequests(aidRequests: FirebaseAidRequest[], userId: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      for (const aidRequest of aidRequests) {
        try {
          const aidRequestRef = doc(db, this.aidRequestsCollection, aidRequest.id);
          const now = Timestamp.now().toMillis();

          await withTimeout(
            setDoc(aidRequestRef, {
              ...aidRequest,
              userId,
              updated_at: now,
            }, { merge: true }),
            8000,
            `Sync aid request ${aidRequest.id}`
          );

          success++;
        } catch (error) {
          console.error(`Failed to sync aid request ${aidRequest.id}:`, error);
          failed++;
        }
      }

      console.log(`✓ Aid request sync complete: ${success} successful, ${failed} failed`);
      return { success, failed };
    } catch (error) {
      console.error('Error during aid request bulk sync:', error);
      return { success, failed };
    }
  }

  /**
   * READ: Get all aid requests
   */
  async getAllAidRequests(): Promise<FirebaseAidRequest[]> {
    try {
      const querySnapshot = await getDocs(collection(db, this.aidRequestsCollection));
      return querySnapshot.docs.map((doc) => doc.data() as FirebaseAidRequest);
    } catch (error) {
      console.error('Error getting aid requests:', error);
      throw error;
    }
  }

  /**
   * READ: Get aid requests by user
   */
  async getAidRequestsByUser(userId: string): Promise<FirebaseAidRequest[]> {
    try {
      const q = query(collection(db, this.aidRequestsCollection), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => doc.data() as FirebaseAidRequest);
    } catch (error) {
      console.error('Error getting user aid requests:', error);
      throw error;
    }
  }
}

export const firebaseService = FirebaseService.getInstance();
