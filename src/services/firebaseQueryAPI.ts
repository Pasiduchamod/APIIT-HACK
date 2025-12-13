import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { FirebaseIncident } from './firebaseService';

/**
 * Firebase Query API for complex incident queries
 */
export class FirebaseQueryAPI {
  private static instance: FirebaseQueryAPI;
  private incidentsCollection = 'incidents';

  private constructor() {}

  static getInstance(): FirebaseQueryAPI {
    if (!FirebaseQueryAPI.instance) {
      FirebaseQueryAPI.instance = new FirebaseQueryAPI();
    }
    return FirebaseQueryAPI.instance;
  }

  /**
   * Get incidents within a geographic bounding box
   * Note: For production, use Firestore geohashing library
   */
  async getIncidentsNearby(
    centerLat: number,
    centerLon: number,
    radiusKm: number = 50
  ): Promise<FirebaseIncident[]> {
    try {
      const allIncidents = await getDocs(collection(db, this.incidentsCollection));
      const nearby: FirebaseIncident[] = [];

      allIncidents.forEach((doc) => {
        const incident = doc.data() as FirebaseIncident;
        const distance = this.calculateDistance(
          centerLat,
          centerLon,
          incident.latitude,
          incident.longitude
        );

        if (distance <= radiusKm) {
          nearby.push({
            ...incident,
            id: doc.id,
          });
        }
      });

      return nearby.sort(
        (a, b) =>
          this.calculateDistance(centerLat, centerLon, a.latitude, a.longitude) -
          this.calculateDistance(centerLat, centerLon, b.latitude, b.longitude)
      );
    } catch (error) {
      console.error('Error getting nearby incidents:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get high severity incidents (severity >= threshold)
   */
  async getHighSeverityIncidents(threshold: number = 4): Promise<FirebaseIncident[]> {
    try {
      const incidents = await getDocs(collection(db, this.incidentsCollection));
      const highSeverity: FirebaseIncident[] = [];

      incidents.forEach((doc) => {
        const incident = doc.data() as FirebaseIncident;
        if (incident.severity >= threshold) {
          highSeverity.push({
            ...incident,
            id: doc.id,
          });
        }
      });

      return highSeverity.sort((a, b) => b.severity - a.severity);
    } catch (error) {
      console.error('Error getting high severity incidents:', error);
      throw error;
    }
  }

  /**
   * Get incidents reported in time range
   */
  async getIncidentsInTimeRange(
    startTime: number,
    endTime: number
  ): Promise<FirebaseIncident[]> {
    try {
      const allIncidents = await getDocs(collection(db, this.incidentsCollection));
      const inRange: FirebaseIncident[] = [];

      allIncidents.forEach((doc) => {
        const incident = doc.data() as FirebaseIncident;
        if (incident.timestamp >= startTime && incident.timestamp <= endTime) {
          inRange.push({
            ...incident,
            id: doc.id,
          });
        }
      });

      return inRange.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting incidents in time range:', error);
      throw error;
    }
  }

  /**
   * Get incident statistics
   */
  async getIncidentStats(): Promise<{
    total: number;
    bySeverity: Record<number, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    try {
      const allIncidents = await getDocs(collection(db, this.incidentsCollection));
      const stats = {
        total: allIncidents.size,
        bySeverity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        byType: {} as Record<string, number>,
        byStatus: { pending: 0, synced: 0, failed: 0 },
      };

      allIncidents.forEach((doc) => {
        const incident = doc.data() as FirebaseIncident;

        // Count by severity
        if (stats.bySeverity[incident.severity] !== undefined) {
          stats.bySeverity[incident.severity]++;
        }

        // Count by type
        stats.byType[incident.type] = (stats.byType[incident.type] || 0) + 1;

        // Count by status
        if (stats.byStatus[incident.status] !== undefined) {
          stats.byStatus[incident.status]++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting incident stats:', error);
      throw error;
    }
  }

  /**
   * Search incidents by multiple criteria
   */
  async searchIncidents(filters: {
    type?: string;
    severity?: number;
    userId?: string;
    status?: string;
    minSeverity?: number;
  }): Promise<FirebaseIncident[]> {
    try {
      let allIncidents = await getDocs(collection(db, this.incidentsCollection));
      let results: FirebaseIncident[] = [];

      allIncidents.forEach((doc) => {
        const incident = doc.data() as FirebaseIncident;
        let matches = true;

        if (filters.type && incident.type !== filters.type) matches = false;
        if (filters.severity && incident.severity !== filters.severity) matches = false;
        if (filters.userId && incident.userId !== filters.userId) matches = false;
        if (filters.status && incident.status !== filters.status) matches = false;
        if (filters.minSeverity && incident.severity < filters.minSeverity) matches = false;

        if (matches) {
          results.push({
            ...incident,
            id: doc.id,
          });
        }
      });

      return results;
    } catch (error) {
      console.error('Error searching incidents:', error);
      throw error;
    }
  }

  /**
   * Get incidents ordered by timestamp (newest first)
   */
  async getRecentIncidents(limit: number = 20): Promise<FirebaseIncident[]> {
    try {
      const allIncidents = await getDocs(collection(db, this.incidentsCollection));
      const incidents: FirebaseIncident[] = [];

      allIncidents.forEach((doc) => {
        incidents.push({
          ...doc.data() as FirebaseIncident,
          id: doc.id,
        });
      });

      return incidents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent incidents:', error);
      throw error;
    }
  }

  /**
   * Get incident hotspots (clusters by location)
   */
  async getIncidentHotspots(gridSize: number = 10): Promise<Array<{
    center: { lat: number; lon: number };
    count: number;
    incidents: FirebaseIncident[];
  }>> {
    try {
      const allIncidents = await getDocs(collection(db, this.incidentsCollection));
      const grid: Map<string, FirebaseIncident[]> = new Map();

      allIncidents.forEach((doc) => {
        const incident = doc.data() as FirebaseIncident;
        const gridKey = `${Math.floor(incident.latitude / gridSize)}_${Math.floor(incident.longitude / gridSize)}`;

        if (!grid.has(gridKey)) {
          grid.set(gridKey, []);
        }
        grid.get(gridKey)!.push({
          ...incident,
          id: doc.id,
        });
      });

      const hotspots = Array.from(grid.entries())
        .map(([key, incidents]) => {
          const avgLat = incidents.reduce((sum, i) => sum + i.latitude, 0) / incidents.length;
          const avgLon = incidents.reduce((sum, i) => sum + i.longitude, 0) / incidents.length;

          return {
            center: { lat: avgLat, lon: avgLon },
            count: incidents.length,
            incidents,
          };
        })
        .sort((a, b) => b.count - a.count);

      return hotspots;
    } catch (error) {
      console.error('Error getting incident hotspots:', error);
      throw error;
    }
  }
}

export const firebaseQueryAPI = FirebaseQueryAPI.getInstance();
