import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { dbService, Incident } from '../database/db';
import { firebaseService } from './firebaseService';
import { imageSyncService } from './imageSyncService';
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
            console.log('✓ Network connection restored. Initiating bi-directional sync...');
            // Wrap sync in try-catch to prevent crashes
            this.fullSync().then(() => {
              // Also sync images after data sync
              console.log('📸 Syncing images after network restore...');
              imageSyncService.syncAllPendingImages();
            }).catch((error) => {
              console.error('Auto-sync failed after network restore:', error);
              // Don't crash - just log the error
            });
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
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected && netInfo.isInternetReachable) {
          await this.fullSync();
        }
      } catch (error) {
        console.error('Auto-sync interval error:', error);
        // Don't crash - just log and continue
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

      // Get pending aid requests from SQLite
      const pendingAidRequests = await dbService.getPendingAidRequests();

      // Get pending detention camps from SQLite
      const pendingCamps = await dbService.getPendingDetentionCamps();

      if (pendingIncidents.length === 0 && pendingAidRequests.length === 0 && pendingCamps.length === 0) {
        console.log('No incidents, aid requests, or camps to sync.');
        this.notifyListeners('idle');
        return { success: true, synced: 0 };
      }

      console.log(`Found ${pendingIncidents.length} pending incidents, ${pendingAidRequests.length} pending aid requests, and ${pendingCamps.length} pending camps. Syncing to Firebase...`);

      let totalSynced = 0;

      // Sync incidents to Firestore with error handling
      if (pendingIncidents.length > 0) {
        try {
          const syncResult = await firebaseService.syncIncidents(pendingIncidents, user.id.toString());

          if (syncResult.success > 0) {
            // Update synced incidents in local database
            const syncedIds = pendingIncidents
              .slice(0, syncResult.success)
              .map(i => i.id);

            await dbService.updateIncidentsStatus(syncedIds, 'synced');
            console.log(`✓ Successfully synced ${syncResult.success} incidents to Firebase`);
            totalSynced += syncResult.success;
            
            // Trigger image sync for synced incidents
            console.log('📸 Starting image sync for synced incidents...');
            await imageSyncService.syncAllPendingImages();
          }

          if (syncResult.failed > 0) {
            console.warn(`⚠ ${syncResult.failed} incidents failed to sync`);
          }
        } catch (incidentSyncError: any) {
          console.error('Incident sync failed:', incidentSyncError);
          // Don't throw - continue to sync aid requests
        }
      }

      // Sync aid requests to Firestore with error handling
      if (pendingAidRequests.length > 0) {
        try {
          const syncResult = await firebaseService.syncAidRequests(pendingAidRequests, user.id.toString());

          if (syncResult.success > 0) {
            // Update synced aid requests in local database
            const syncedIds = pendingAidRequests
              .slice(0, syncResult.success)
              .map(a => a.id);

            await dbService.updateAidRequestsStatus(syncedIds, 'synced');
            console.log(`✓ Successfully synced ${syncResult.success} aid requests to Firebase`);
            totalSynced += syncResult.success;
          }

          if (syncResult.failed > 0) {
            console.warn(`⚠ ${syncResult.failed} aid requests failed to sync`);
          }
        } catch (aidSyncError: any) {
          console.error('Aid request sync failed:', aidSyncError);
          // Don't throw - partial sync is acceptable
        }
      }

      // Sync detention camps to Firestore with error handling
      if (pendingCamps.length > 0) {
        try {
          const syncResult = await firebaseService.syncDetentionCamps(pendingCamps, user.id.toString());

          if (syncResult.success > 0) {
            // Update synced camps in local database
            const syncedIds = pendingCamps
              .slice(0, syncResult.success)
              .map(c => c.id);

            // Update status to synced for all successfully synced camps
            for (const id of syncedIds) {
              await dbService.updateDetentionCampStatus(id, 'synced');
            }
            console.log(`✓ Successfully synced ${syncResult.success} detention camps to Firebase`);
            totalSynced += syncResult.success;
          }

          if (syncResult.failed > 0) {
            console.warn(`⚠ ${syncResult.failed} detention camps failed to sync`);
          }
        } catch (campSyncError: any) {
          console.error('Detention camp sync failed:', campSyncError);
          // Don't throw - partial sync is acceptable
        }
      }

      this.notifyListeners('success');
      return { success: true, synced: totalSynced };
    } catch (error: any) {
      console.error('Cloud sync error:', error);
      this.notifyListeners('error');
      // Return success=false but don't crash the app
      return { success: false, synced: 0, error: error.message || 'Unknown sync error' };
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

      console.log('Pulling data from Firebase...');
      this.notifyListeners('downloading');

      let totalDownloaded = 0;
      let totalUpdated = 0;

      // ===== Sync Incidents =====
      const cloudIncidents = await firebaseService.getIncidentsByUser(user.id.toString());

      console.log(`Downloading ${cloudIncidents.length} incidents from Firebase...`);

      // Save/update incidents in local database
      let downloaded = 0;
      let updated = 0;
      for (const incident of cloudIncidents) {
        try {
          // Check if incident exists locally
          const existing = await dbService.getIncident(incident.id);
          if (!existing) {
            // Insert new incident with actionStatus
            await dbService.createIncident({
              id: incident.id,
              type: incident.type,
              severity: incident.severity,
              latitude: incident.latitude,
              longitude: incident.longitude,
              timestamp: incident.timestamp,
              status: 'synced',
              actionStatus: incident.actionStatus || 'pending',
            });
            downloaded++;
          } else {
            // Check if actionStatus changed in cloud (handle null/undefined cases)
            const cloudStatus = incident.actionStatus || 'pending';
            const localStatus = existing.actionStatus || 'pending';
            
            if (cloudStatus !== localStatus) {
              // Update actionStatus if it changed in cloud
              await dbService.updateIncidentActionStatus(incident.id, cloudStatus);
              console.log(`✓ Updated incident ${incident.id} actionStatus: ${localStatus} → ${cloudStatus}`);
              updated++;
            }
          }
        } catch (error) {
          console.error(`Failed to download incident ${incident.id}:`, error);
        }
      }

      totalDownloaded += downloaded;
      totalUpdated += updated;

      if (updated > 0) {
        console.log(`✓ Updated ${updated} incident action statuses from Firebase`);
      }
      console.log(`✓ Downloaded ${downloaded} new incidents from Firebase`);

      // ===== Sync Aid Requests =====
      const cloudAidRequests = await firebaseService.getAidRequestsByUser(user.id.toString());
      
      console.log(`Downloading ${cloudAidRequests.length} aid requests from Firebase...`);

      let aidDownloaded = 0;
      let aidUpdated = 0;
      for (const aidRequest of cloudAidRequests) {
        try {
          // Check if aid request exists locally
          const existing = await dbService.getAidRequestById(aidRequest.id);
          if (!existing) {
            // Insert new aid request with aidStatus
            await dbService.createAidRequest({
              id: aidRequest.id,
              aid_types: aidRequest.aid_types,
              priority_level: aidRequest.priority_level,
              description: aidRequest.description || '',
              latitude: aidRequest.latitude,
              longitude: aidRequest.longitude,
              status: 'synced',
              aidStatus: aidRequest.aidStatus || 'pending',
              requester_name: aidRequest.requester_name || '',
              contact_number: aidRequest.contact_number || '',
              number_of_people: aidRequest.number_of_people || 0,
            });
            aidDownloaded++;
          } else {
            // Check if aidStatus changed in cloud
            const cloudStatus = aidRequest.aidStatus || 'pending';
            const localStatus = existing.aidStatus || 'pending';
            
            if (cloudStatus !== localStatus) {
              // Update aidStatus if it changed in cloud (don't mark for sync since it came from cloud)
              await dbService.updateAidRequestAidStatus(aidRequest.id, cloudStatus, false);
              console.log(`✓ Updated aid request ${aidRequest.id} aidStatus: ${localStatus} → ${cloudStatus}`);
              aidUpdated++;
            }
          }
        } catch (error) {
          console.error(`Failed to download aid request ${aidRequest.id}:`, error);
        }
      }

      totalDownloaded += aidDownloaded;
      totalUpdated += aidUpdated;

      if (aidUpdated > 0) {
        console.log(`✓ Updated ${aidUpdated} aid request statuses from Firebase`);
      }
      console.log(`✓ Downloaded ${aidDownloaded} new aid requests from Firebase`);

      // ===== Sync Detention Camps =====
      const cloudCamps = await firebaseService.getDetentionCamps();
      
      console.log(`Downloading ${cloudCamps.length} detention camps from Firebase...`);

      let campsDownloaded = 0;
      let campsUpdated = 0;
      for (const camp of cloudCamps) {
        try {
          // Check if camp exists locally
          const existing = await dbService.getDetentionCampById(camp.id);
          if (!existing) {
            // Insert new camp - show all camps in the app (even unapproved ones can be visible)
            // Use insertDetentionCampFromFirebase to preserve the Firebase ID
            await dbService.insertDetentionCampFromFirebase(camp);
            campsDownloaded++;
          } else {
            // Check if camp details changed in cloud
            const needsUpdate = 
              camp.campStatus !== existing.campStatus ||
              camp.current_occupancy !== existing.current_occupancy ||
              camp.capacity !== existing.capacity ||
              camp.name !== existing.name ||
              camp.facilities !== existing.facilities ||
              (camp.adminApproved !== undefined && camp.adminApproved !== existing.adminApproved);
            
            if (needsUpdate) {
              // Update camp details
              await dbService.updateDetentionCamp(camp.id, {
                name: camp.name,
                campStatus: camp.campStatus,
                current_occupancy: camp.current_occupancy,
                capacity: camp.capacity,
                facilities: camp.facilities,
                contact_person: camp.contact_person,
                contact_phone: camp.contact_phone,
                description: camp.description,
              });
              if (camp.adminApproved !== undefined) {
                await dbService.updateDetentionCampApproval(camp.id, camp.adminApproved);
              }
              console.log(`✓ Updated camp ${camp.id} from Firebase`);
              campsUpdated++;
            }
          }
        } catch (error) {
          console.error(`Failed to download camp ${camp.id}:`, error);
        }
      }

      totalDownloaded += campsDownloaded;
      totalUpdated += campsUpdated;

      if (campsUpdated > 0) {
        console.log(`✓ Updated ${campsUpdated} detention camps from Firebase`);
      }
      console.log(`✓ Downloaded ${campsDownloaded} new detention camps from Firebase`);

      this.notifyListeners('success');
      return { success: true, downloaded: totalDownloaded + totalUpdated };
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

      this.notifyListeners('success');
      
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
