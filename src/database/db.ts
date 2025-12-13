import * as SQLite from 'expo-sqlite';

// Define Incident interface for type safety
export interface Incident {
  id: string;
  type: string;
  severity: number;
  latitude: number;
  longitude: number;
  timestamp: number; // Unix timestamp in milliseconds
  status: 'pending' | 'synced' | 'failed'; // Changed from is_synced boolean
  created_at: number;
  updated_at: number;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  async init(): Promise<void> {
    try {
      if (this.initialized) {
        console.log('✓ Database already initialized');
        return;
      }

      // Open database
      this.db = await SQLite.openDatabaseAsync('ProjectAegis.db');
      await this.createTables();
      this.initialized = true;
      console.log('✓ Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Create incidents table with all necessary fields
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          severity INTEGER NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create index on status for efficient querying of unsynced records
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      `);

      console.log('✓ Tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Create a new incident
  async createIncident(
    incident: Omit<Incident, 'created_at' | 'updated_at'>
  ): Promise<Incident> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const fullIncident: Incident = {
      ...incident,
      created_at: now,
      updated_at: now,
    };

    try {
      await this.db.runAsync(
        `INSERT INTO incidents (id, type, severity, latitude, longitude, timestamp, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullIncident.id,
          fullIncident.type,
          fullIncident.severity,
          fullIncident.latitude,
          fullIncident.longitude,
          fullIncident.timestamp,
          fullIncident.status,
          fullIncident.created_at,
          fullIncident.updated_at,
        ]
      );

      return fullIncident;
    } catch (error) {
      console.error('Error creating incident:', error);
      throw error;
    }
  }

  // Get all incidents sorted by timestamp descending
  async getAllIncidents(): Promise<Incident[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<Incident>(
        'SELECT * FROM incidents ORDER BY timestamp DESC'
      );
      return result || [];
    } catch (error) {
      console.error('Error getting all incidents:', error);
      throw error;
    }
  }

  // Get incidents with pending status (not yet synced)
  async getPendingIncidents(): Promise<Incident[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<Incident>(
        "SELECT * FROM incidents WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC"
      );
      return result || [];
    } catch (error) {
      console.error('Error getting pending incidents:', error);
      throw error;
    }
  }

  // Get count of pending incidents
  async getPendingCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM incidents WHERE status = 'pending' OR status = 'failed'"
      );
      return result?.count ?? 0;
    } catch (error) {
      console.error('Error getting pending count:', error);
      throw error;
    }
  }

  // Update incident status
  async updateIncidentStatus(
    id: string,
    status: 'pending' | 'synced' | 'failed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?',
        [status, Date.now(), id]
      );
    } catch (error) {
      console.error('Error updating incident status:', error);
      throw error;
    }
  }

  // Update multiple incidents status
  async updateIncidentsStatus(
    ids: string[],
    status: 'pending' | 'synced' | 'failed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const placeholders = ids.map(() => '?').join(',');
      await this.db.runAsync(
        `UPDATE incidents SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
        [status, Date.now(), ...ids]
      );
    } catch (error) {
      console.error('Error updating multiple incident statuses:', error);
      throw error;
    }
  }

  // Get single incident by id
  async getIncidentById(id: string): Promise<Incident | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<Incident>(
        'SELECT * FROM incidents WHERE id = ?',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Error getting incident by id:', error);
      throw error;
    }
  }

  // Delete incident
  async deleteIncident(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM incidents WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting incident:', error);
      throw error;
    }
  }

  // Clear all incidents
  async clearAllIncidents(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM incidents');
      console.log('✓ All incidents cleared');
    } catch (error) {
      console.error('Error clearing incidents:', error);
      throw error;
    }
  }

  // Check if database is initialized
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const dbService = new DatabaseService();
