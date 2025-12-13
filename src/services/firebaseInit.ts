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
    // Mark as initializing to prevent auto-sync during startup
    cloudSyncService.setInitializing(true);

    // Step 1: Verify local database is initialized
    try {
      if (!dbService.isInitialized()) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      errors.push('Local database initialization failed');
    }

    // Step 2: Check if user is authenticated
    try {
      const user = await TokenStorage.getUser();
    } catch (error) {
      // Silent error
    }

    // Step 3: Test Firebase connection
    try {
      const count = await firebaseService.getIncidentCount();
    } catch (error) {
      errors.push('Firebase connection failed');
    }

    // Step 4: Start auto-sync
    try {
      cloudSyncService.startAutoSync(60000); // 60 seconds interval
    } catch (error) {
      errors.push('Auto-sync initialization failed');
    }

    // Step 5: Set up sync status listener
    setupSyncStatusListener();

    // Step 6: Perform initial sync
    try {
      const user = await TokenStorage.getUser();
      if (user) {
        const syncResult = await cloudSyncService.syncToCloud();
      }
    } catch (error) {
      // Silent error
    } finally{
      // Clear initialization flag
      cloudSyncService.setInitializing(false);
    }

    // Final status
    if (errors.length === 0) {
      return { success: true, errors: [] };
    } else {
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
        case 'downloading':
        case 'success':
        case 'error':
        case 'offline':
        case 'idle':
          // Silent - no logs
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
    const result = await cloudSyncService.syncToCloud();
  } catch (error) {
    // Silent error
  }
}

/**
 * Full bi-directional sync
 * Pulls from cloud, then pushes to cloud
 */
export async function fullSync(): Promise<void> {
  try {
    const result = await cloudSyncService.fullSync();
  } catch (error) {
    // Silent error
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
