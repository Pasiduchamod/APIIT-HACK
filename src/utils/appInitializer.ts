import { dbService } from '../database/db';
import { initializeFirebase } from '../services/firebaseInit';
import { imageSyncService } from '../services/imageSyncService';
import { cloudSyncService } from '../services/cloudSyncService';

/**
 * Initialize the database and Firebase on app startup
 * This must be called before any database operations
 */
export async function initializeApp(): Promise<void> {
  try {
    // Initialize local database first
    if (!dbService.isInitialized()) {
      console.log('Initializing database...');
      await dbService.init();
      console.log('✓ Database initialized successfully');
    }

    // Initialize Firebase cloud sync
    console.log('Initializing Firebase...');
    const firebaseResult = await initializeFirebase();
    if (firebaseResult.success) {
      console.log('✓ Firebase initialized successfully');
    } else {
      console.warn('⚠ Firebase initialization completed with warnings:', firebaseResult.errors);
    }

    // Start automatic image sync service
    console.log('Starting image sync service...');
    imageSyncService.startAutoSync();
    console.log('✓ Image sync service started');

    // Start auto-sync for data (every 60 seconds)
    cloudSyncService.startAutoSync(60000);
    console.log('✓ Cloud sync service started');

    console.log('✓ App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
}
