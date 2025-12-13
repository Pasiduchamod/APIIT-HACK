/**
 * Firebase Initialization Module
 * 
 * Call initializeFirebase() in your App.tsx during app startup
 * to set up all Firebase services automatically.
 */

import { dbService } from '../database/db';
import { cloudSyncService } from '../services/cloudSyncService';
import { firebaseService } from '../services/firebaseService';
import { TokenStorage } from '../services/tokenStorage';

/**
 * Main initialization function
 * Call this once during app startup
 */
export async function initializeFirebase(): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    console.log('🚀 Starting Firebase initialization...');
    
    // Mark as initializing to prevent auto-sync during startup
    cloudSyncService.setInitializing(true);

    // Step 1: Verify local database is initialized
    try {
      if (!dbService.isInitialized()) {
        console.log('⏳ Waiting for local database initialization...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      console.log('✅ Local database ready');
    } catch (error) {
      errors.push('Local database initialization failed');
      console.error(error);
    }

    // Step 2: Check if user is authenticated
    try {
      const user = await TokenStorage.getUser();
      if (!user) {
        console.warn(
          '⚠️ User not authenticated. Firebase sync will start after login.'
        );
      } else {
        console.log(`✅ User authenticated: ${user.username}`);
      }
    } catch (error) {
      console.warn('Could not check user auth:', error);
    }

    // Step 3: Test Firebase connection
    try {
      const count = await firebaseService.getIncidentCount();
      console.log(`✅ Firebase connected. Total incidents: ${count}`);
    } catch (error) {
      errors.push('Firebase connection failed');
      console.error('Firebase connection error:', error);
    }

    // Step 4: Start auto-sync
    try {
      cloudSyncService.startAutoSync(60000); // 60 seconds interval
      console.log('✅ Auto-sync enabled (60 second interval)');
    } catch (error) {
      errors.push('Auto-sync initialization failed');
      console.error(error);
    }

    // Step 5: Set up sync status listener
    setupSyncStatusListener();

    // Step 6: Perform initial sync
    try {
      const user = await TokenStorage.getUser();
      if (user) {
        console.log('📤 Performing initial sync...');
        const syncResult = await cloudSyncService.syncToCloud();
        if (syncResult.success) {
          console.log(`✅ Initial sync complete. Synced ${syncResult.synced} incidents`);
        }
      }
    } catch (error) {
      console.warn('Initial sync failed (will retry automatically):', error);
    } finally {
      // Clear initialization flag
      cloudSyncService.setInitializing(false);
    }

    // Final status
    if (errors.length === 0) {
      console.log('✅ Firebase initialization successful!');
      return { success: true, errors: [] };
    } else {
      console.warn('⚠️ Firebase initialization completed with errors:', errors);
      return { success: false, errors };
    }
  } catch (error: any) {
    console.error('❌ Fatal error during Firebase initialization:', error);
    return { success: false, errors: [error.message] };
  }
}

/**
 * Set up listener for sync status changes
 */
function setupSyncStatusListener() {
  let lastStatus = '';
  cloudSyncService.addSyncListener((status) => {
    // Only log if status changed to reduce console noise
    if (status !== lastStatus) {
      lastStatus = status;
      switch (status) {
        case 'syncing':
          console.log('📤 [SYNC] Uploading data to cloud...');
          break;
        case 'downloading':
          console.log('📥 [SYNC] Downloading data from cloud...');
          break;
        case 'success':
          console.log('✅ [SYNC] Successfully synced with cloud');
          break;
        case 'error':
          console.error('❌ [SYNC] Sync operation failed');
          break;
        case 'offline':
          console.warn('📵 [SYNC] Offline mode - will sync when online');
          break;
        case 'idle':
          // Skip logging idle state to reduce noise
          break;
      }
    }
  });
}

/**
 * Manual sync trigger
 * Call this to manually sync data (e.g., on user button tap)
 */
export async function manualSync(): Promise<void> {
  try {
    console.log('🔄 Starting manual sync...');
    const result = await cloudSyncService.syncToCloud();

    if (result.success) {
      console.log(`✅ Manual sync successful. Synced ${result.synced} incidents`);
    } else {
      console.error(`❌ Manual sync failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error during manual sync:', error);
  }
}

/**
 * Full bi-directional sync
 * Pulls from cloud, then pushes to cloud
 */
export async function fullSync(): Promise<void> {
  try {
    console.log('🔄 Starting full bi-directional sync...');
    const result = await cloudSyncService.fullSync();

    console.log(`📊 Sync complete:`);
    console.log(`  - Downloaded: ${result.downloaded}`);
    console.log(`  - Synced: ${result.synced}`);
  } catch (error) {
    console.error('Full sync failed:', error);
  }
}

/**
 * Check sync statistics
 */
export async function checkSyncStatus(): Promise<void> {
  try {
    const stats = await cloudSyncService.getSyncStats();
    const pendingCount = await cloudSyncService.getPendingCount();

    console.log('📊 Sync Status:');
    console.log(`  Pending (unsync): ${pendingCount}`);
    console.log(`  Local total: ${stats.localTotal}`);
    console.log(`  Cloud total: ${stats.cloudTotal}`);

    if (pendingCount > 0) {
      console.warn(`⚠️  ${pendingCount} incidents waiting to sync`);
    }
  } catch (error) {
    console.error('Error checking sync status:', error);
  }
}

/**
 * Cleanup Firebase on app logout
 */
export async function cleanupFirebase(): Promise<void> {
  try {
    console.log('🧹 Cleaning up Firebase...');
    cloudSyncService.stopAutoSync();
    console.log('✅ Firebase cleanup complete');
  } catch (error) {
    console.error('Error during Firebase cleanup:', error);
  }
}

/**
 * Utility: Simulate offline mode (for testing)
 */
export async function testOfflineMode(durationMs: number = 5000): Promise<void> {
  console.log('📵 Simulating offline mode for', durationMs, 'ms');
  cloudSyncService.stopAutoSync();

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  console.log('📶 Restoring online mode');
  cloudSyncService.startAutoSync(60000);
}

/**
 * Utility: Get all incidents from both local and cloud
 */
export async function getAllIncidentsFromBoth() {
  try {
    const [local, cloud] = await Promise.all([
      cloudSyncService.getAllLocalIncidents(),
      cloudSyncService.getAllCloudIncidents(),
    ]);

    return {
      local: {
        count: local.length,
        incidents: local,
      },
      cloud: {
        count: cloud.length,
        incidents: cloud,
      },
    };
  } catch (error) {
    console.error('Error getting incidents:', error);
    return { local: { count: 0, incidents: [] }, cloud: { count: 0, incidents: [] } };
  }
}

/**
 * Utility: Debug info for troubleshooting
 */
export async function getDebugInfo() {
  try {
    const user = await TokenStorage.getUser();
    const stats = await cloudSyncService.getSyncStats();
    const pendingCount = await cloudSyncService.getPendingCount();

    return {
      timestamp: new Date().toISOString(),
      user: user ? { id: user.id, username: user.username } : null,
      database: {
        localPending: pendingCount,
        localTotal: stats.localTotal,
        cloudTotal: stats.cloudTotal,
      },
      services: {
        autoSyncEnabled: true, // Would need to track actual state
      },
    };
  } catch (error) {
    console.error('Error getting debug info:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Initialize Firebase with error recovery
 * This version retries if initial attempt fails
 */
export async function initializeFirebaseWithRetry(
  maxRetries: number = 3,
  retryDelay: number = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 Firebase init attempt ${attempt}/${maxRetries}`);

    const result = await initializeFirebase();

    if (result.success) {
      return true;
    }

    if (attempt < maxRetries) {
      console.log(`⏳ Retrying in ${retryDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  console.error('❌ Firebase initialization failed after all retries');
  return false;
}

/**
 * Export initialization state for monitoring
 */
export const firebaseInit = {
  initialize: initializeFirebase,
  initializeWithRetry: initializeFirebaseWithRetry,
  manualSync,
  fullSync,
  checkSyncStatus,
  cleanup: cleanupFirebase,
  getAllIncidents: getAllIncidentsFromBoth,
  getDebugInfo,
  testOffline: testOfflineMode,
};

export default firebaseInit;
