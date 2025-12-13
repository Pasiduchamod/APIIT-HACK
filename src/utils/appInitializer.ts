import { dbService } from '../database/db';
import { initializeFirebase } from '../services/firebaseInit';

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

    console.log('✓ App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
}
