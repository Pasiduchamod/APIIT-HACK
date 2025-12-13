import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { database } from '../database';
import Incident from '../database/models/Incident';
import { API_BASE_URL } from '../constants/config';
import { AuthService } from './authService';
import { Q } from '@nozbe/watermelondb';

export class SyncService {
  private static instance: SyncService;
  private isSyncing = false;
  private syncListeners: Array<(status: string) => void> = [];

  private constructor() {
    this.initNetworkListener();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private initNetworkListener() {
    // Listen to network state changes
    NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('✓ Network connection restored. Initiating sync...');
        this.syncIncidents();
      } else {
        console.log('⚠ Network connection lost. Operating in offline mode.');
      }
    });
  }

  addSyncListener(listener: (status: string) => void) {
    this.syncListeners.push(listener);
  }

  removeSyncListener(listener: (status: string) => void) {
    this.syncListeners = this.syncListeners.filter(l => l !== listener);
  }

  private notifyListeners(status: string) {
    this.syncListeners.forEach(listener => listener(status));
  }

  async syncIncidents(): Promise<{ success: boolean; synced: number; error?: string }> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return { success: false, synced: 0, error: 'Sync already in progress' };
    }

    try {
      this.isSyncing = true;
      this.notifyListeners('syncing');

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        console.log('No internet connection. Sync aborted.');
        this.notifyListeners('offline');
        return { success: false, synced: 0, error: 'No internet connection' };
      }

      // Get unsynced incidents from WatermelonDB
      const unsyncedIncidents = await database
        .get<Incident>('incidents')
        .query(Q.where('is_synced', false))
        .fetch();

      if (unsyncedIncidents.length === 0) {
        console.log('No incidents to sync.');
        this.notifyListeners('idle');
        return { success: true, synced: 0 };
      }

      console.log(`Found ${unsyncedIncidents.length} unsynced incidents. Syncing...`);

      // Prepare incident data for API
      const incidentData = unsyncedIncidents.map(incident => ({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        latitude: incident.latitude,
        longitude: incident.longitude,
        timestamp: incident.timestamp.toISOString(),
      }));

      // Get auth header
      const authHeader = await AuthService.getAuthHeader();

      // Send to backend
      const response = await fetch(`${API_BASE_URL}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ incidents: incidentData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      const result = await response.json();

      // Mark incidents as synced in local database
      await database.write(async () => {
        for (const incident of unsyncedIncidents) {
          await incident.update(record => {
            record.isSynced = true;
          });
        }
      });

      console.log(`✓ Successfully synced ${result.synced} incidents`);
      this.notifyListeners('success');
      
      return { success: true, synced: result.synced };
    } catch (error: any) {
      console.error('Sync error:', error);
      this.notifyListeners('error');
      return { success: false, synced: 0, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async getUnsyncedCount(): Promise<number> {
    const count = await database
      .get<Incident>('incidents')
      .query(Q.where('is_synced', false))
      .fetchCount();
    return count;
  }

  async getAllIncidents(): Promise<Incident[]> {
    return await database
      .get<Incident>('incidents')
      .query(Q.sortBy('timestamp', Q.desc))
      .fetch();
  }
}

export const syncService = SyncService.getInstance();
