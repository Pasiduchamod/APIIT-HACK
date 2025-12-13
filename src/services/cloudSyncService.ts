import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { dbService, Incident } from '../database/db';
import { firebaseService } from './firebaseService';
import { TokenStorage } from './tokenStorage';

/**
 * CloudSyncService handles bi-directional synchronization between
 * local SQLite database and Firebase Firestore
 */
export class CloudSyncService {
  private static instance: CloudSyncService;
  private isSyncing = false;
  private syncListeners: Array<(status: string) => void> = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private isInitializing = false;
  private networkSyncTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.initNetworkListener();
  }

  static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  /**
   * Initialize network state listener for automatic sync
   */
  private initNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      if (dbService.isInitialized() && !this.isInitializing) {
        if (state.isConnected && state.isInternetReachable) {
          // Debounce: Wait 3 seconds before syncing on network change
          if (this.networkSyncTimeout) {
            clearTimeout(this.networkSyncTimeout);
          }
          this.networkSyncTimeout = setTimeout(() => {
            console.log('✓ Network connection restored. Initiating cloud sync...');
            this.syncToCloud();
          }, 3000);
        } else {
          console.log('⚠ Network connection lost. Operating in offline mode.');
        }
      }
    });
  }

  /**
   * Mark initialization state to prevent duplicate syncs
   */
  setInitializing(initializing: boolean) {
    this.isInitializing = initializing;
  }

  /**
   * Start automatic sync at intervals
   */
  startAutoSync(intervalMs: number = 60000) {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    this.autoSyncInterval = setInterval(async () => {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected && netInfo.isInternetReachable) {
        await this.syncToCloud();
      }
    }, intervalMs);

    console.log(`✓ Auto-sync started with ${intervalMs}ms interval`);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      console.log('✓ Auto-sync stopped');
    }
  }

  /**
   * Add sync status listener
   */
  addSyncListener(listener: (status: string) => void) {
    this.syncListeners.push(listener);
  }

  /**
   * Remove sync status listener
   */
  removeSyncListener(listener: (status: string) => void) {
    this.syncListeners = this.syncListeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of sync status
   */
  private notifyListeners(status: string) {
    this.syncListeners.forEach(listener => listener(status));
  }

  /**
   * Main sync function: Push pending incidents to Firebase
   */
  async syncToCloud(): Promise<{ success: boolean; synced: number; error?: string }> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return { success: false, synced: 0, error: 'Sync already in progress' };
    }

    try {
      if (!dbService.isInitialized()) {
        console.log('Database not yet initialized, skipping sync...');
        return { success: false, synced: 0, error: 'Database not initialized' };
      }

      this.isSyncing = true;
      this.notifyListeners('syncing');

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        console.log('No internet connection. Cloud sync aborted.');
        this.notifyListeners('offline');
        return { success: false, synced: 0, error: 'No internet connection' };
      }

      // Get user ID from auth
      const user = await TokenStorage.getUser();
      if (!user) {
        console.log('No authenticated user. Skipping sync.');
        return { success: false, synced: 0, error: 'User not authenticated' };
      }

      // Get pending incidents from SQLite
      const pendingIncidents = await dbService.getPendingIncidents();

      if (pendingIncidents.length === 0) {
        console.log('No incidents to sync.');
        this.notifyListeners('idle');
        return { success: true, synced: 0 };
      }

      console.log(`Found ${pendingIncidents.length} pending incidents. Syncing to Firebase...`);

      // Sync incidents to Firestore
      const syncResult = await firebaseService.syncIncidents(pendingIncidents, user.id.toString());

      if (syncResult.success > 0) {
        // Update synced incidents in local database
        const syncedIds = pendingIncidents
          .slice(0, syncResult.success)
          .map(i => i.id);

        await dbService.updateIncidentsStatus(syncedIds, 'synced');
        console.log(`✓ Successfully synced ${syncResult.success} incidents to Firebase`);
      }

      if (syncResult.failed > 0) {
        console.warn(`⚠ ${syncResult.failed} incidents failed to sync`);
      }

      this.notifyListeners('success');
      return { success: true, synced: syncResult.success };
    } catch (error: any) {
      console.error('Cloud sync error:', error);
      this.notifyListeners('error');
      return { success: false, synced: 0, error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull incidents from Firebase to local database
   */
  async syncFromCloud(): Promise<{ success: boolean; downloaded: number; error?: string }> {
    try {
      if (!dbService.isInitialized()) {
        return { success: false, downloaded: 0, error: 'Database not initialized' };
      }

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        return { success: false, downloaded: 0, error: 'No internet connection' };
      }

      const user = await TokenStorage.getUser();
      if (!user) {
        return { success: false, downloaded: 0, error: 'User not authenticated' };
      }

      console.log('Pulling incidents from Firebase...');
      this.notifyListeners('downloading');

      // Get incidents from Firebase for this user
      const cloudIncidents = await firebaseService.getIncidentsByUser(user.id.toString());

      if (cloudIncidents.length === 0) {
        console.log('No incidents to download from Firebase.');
        return { success: true, downloaded: 0 };
      }

      console.log(`Downloading ${cloudIncidents.length} incidents from Firebase...`);

      // Save/update incidents in local database
      let downloaded = 0;
      for (const incident of cloudIncidents) {
        try {
          // Check if incident exists locally
          const existing = await dbService.getIncident(incident.id);
          if (!existing) {
            // Insert new incident
            await dbService.createIncident({
              id: incident.id,
              type: incident.type,
              severity: incident.severity,
              latitude: incident.latitude,
              longitude: incident.longitude,
              timestamp: incident.timestamp,
              status: 'synced',
            });
            downloaded++;
          }
        } catch (error) {
          console.error(`Failed to download incident ${incident.id}:`, error);
        }
      }

      console.log(`✓ Downloaded ${downloaded} new incidents from Firebase`);
      this.notifyListeners('success');
      return { success: true, downloaded };
    } catch (error: any) {
      console.error('Cloud download error:', error);
      this.notifyListeners('error');
      return { success: false, downloaded: 0, error: error.message };
    }
  }

  /**
   * Bi-directional sync: Pull then Push
   */
  async fullSync(): Promise<{ success: boolean; downloaded: number; synced: number }> {
    try {
      this.notifyListeners('syncing');

      // First pull from cloud
      const pullResult = await this.syncFromCloud();

      // Then push to cloud
      const pushResult = await this.syncToCloud();

      return {
        success: pullResult.success && pushResult.success,
        downloaded: pullResult.downloaded,
        synced: pushResult.synced,
      };
    } catch (error) {
      console.error('Full sync error:', error);
      this.notifyListeners('error');
      return { success: false, downloaded: 0, synced: 0 };
    }
  }

  /**
   * Get pending count from local database
   */
  async getPendingCount(): Promise<number> {
    return await dbService.getPendingCount();
  }

  /**
   * Get all incidents from local database
   */
  async getAllLocalIncidents(): Promise<Incident[]> {
    return await dbService.getAllIncidents();
  }

  /**
   * Get all incidents from Firebase
   */
  async getAllCloudIncidents() {
    return await firebaseService.getAllIncidents();
  }

  /**
   * Get sync stats
   */
  async getSyncStats(): Promise<{
    localPending: number;
    localTotal: number;
    cloudTotal: number;
  }> {
    try {
      const localPending = await dbService.getPendingCount();
      const localTotal = await dbService.getIncidentCount();
      const cloudTotal = await firebaseService.getIncidentCount();

      return { localPending, localTotal, cloudTotal };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return { localPending: 0, localTotal: 0, cloudTotal: 0 };
    }
  }
}

export const cloudSyncService = CloudSyncService.getInstance();
