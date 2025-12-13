import { dbService } from '../database/db';

/**
 * Initialize the database on app startup
 * This must be called before any database operations
 */
export async function initializeApp(): Promise<void> {
  try {
    if (!dbService.isInitialized()) {
      console.log('Initializing database...');
      await dbService.init();
      console.log('✓ App initialized successfully');
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
}
