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

class FirebaseService {
  private static instance: FirebaseService;
  private incidentsCollection = 'incidents';

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

      await setDoc(incidentRef, firebaseIncident);
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

          await setDoc(incidentRef, {
            ...incident,
            userId,
            updated_at: now,
          }, { merge: true });

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
      throw error;
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
}

export const firebaseService = FirebaseService.getInstance();
