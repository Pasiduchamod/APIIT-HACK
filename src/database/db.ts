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
  // Image fields - Support up to 3 images per incident
  localImageUris?: string[]; // Array of local file paths
  cloudImageUrls?: string[]; // Array of Firebase Storage URLs
  imageUploadStatuses?: ('local_only' | 'low_uploaded' | 'high_uploaded')[]; // Upload states
  imageQualities?: ('none' | 'low' | 'high')[]; // Current qualities in cloud
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
      // Create incidents table with all necessary fields including image support
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
          updated_at INTEGER NOT NULL,
          localImageUri TEXT,
          cloudImageUrl TEXT,
          imageUploadStatus TEXT DEFAULT 'local_only',
          imageQuality TEXT DEFAULT 'none'
        );
      `);

      // Migration: Add image columns to existing databases
      await this.migrateImageColumns();

      // Create index on status for efficient querying of unsynced records
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      `);

      // Create index on imageUploadStatus for efficient image sync queries
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_incidents_image_status ON incidents(imageUploadStatus);
      `);

      console.log('✓ Tables created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Migrate existing databases to add image columns
   */
  private async migrateImageColumns(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if image columns exist by querying table info
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(incidents);`
      );

      const columnNames = tableInfo.map((col) => col.name);

      // Add missing image columns
      if (!columnNames.includes('localImageUri')) {
        await this.db.execAsync(`ALTER TABLE incidents ADD COLUMN localImageUri TEXT;`);
        console.log('✓ Added localImageUri column');
      }

      if (!columnNames.includes('cloudImageUrl')) {
        await this.db.execAsync(`ALTER TABLE incidents ADD COLUMN cloudImageUrl TEXT;`);
        console.log('✓ Added cloudImageUrl column');
      }

      if (!columnNames.includes('imageUploadStatus')) {
        await this.db.execAsync(`ALTER TABLE incidents ADD COLUMN imageUploadStatus TEXT DEFAULT 'local_only';`);
        console.log('✓ Added imageUploadStatus column');
      }

      if (!columnNames.includes('imageQuality')) {
        await this.db.execAsync(`ALTER TABLE incidents ADD COLUMN imageQuality TEXT DEFAULT 'none';`);
        console.log('✓ Added imageQuality column');
      }
    } catch (error) {
      console.error('Error migrating image columns:', error);
      // Don't throw - if migration fails, it might be because columns already exist
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
        `INSERT INTO incidents (
          id, type, severity, latitude, longitude, timestamp, status, 
          created_at, updated_at, localImageUri, cloudImageUrl, 
          imageUploadStatus, imageQuality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          fullIncident.localImageUris ? JSON.stringify(fullIncident.localImageUris) : null,
          fullIncident.cloudImageUrls ? JSON.stringify(fullIncident.cloudImageUrls) : null,
          fullIncident.imageUploadStatuses ? JSON.stringify(fullIncident.imageUploadStatuses) : JSON.stringify([]),
          fullIncident.imageQualities ? JSON.stringify(fullIncident.imageQualities) : JSON.stringify([]),
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
      const result = await this.db.getAllAsync<any>(
        'SELECT * FROM incidents ORDER BY timestamp DESC'
      );
      return (result || []).map(this.parseIncidentRow);
    } catch (error) {
      console.error('Error getting all incidents:', error);
      throw error;
    }
  }

  // Helper to parse incident row with JSON arrays (handles both old string format and new array format)
  private parseIncidentRow(row: any): Incident {
    const parseImageField = (field: any): any[] => {
      if (!field) return [];
      if (typeof field === 'string') {
        // Check if it's JSON array format
        if (field.startsWith('[')) {
          try {
            return JSON.parse(field);
          } catch {
            // If parse fails, treat as single value
            return [field];
          }
        }
        // Old format: single string value
        return [field];
      }
      return [];
    };

    return {
      ...row,
      localImageUris: parseImageField(row.localImageUri),
      cloudImageUrls: parseImageField(row.cloudImageUrl),
      imageUploadStatuses: parseImageField(row.imageUploadStatus),
      imageQualities: parseImageField(row.imageQuality),
    };
  }

  // Get single incident by ID
  async getIncident(id: string): Promise<Incident | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM incidents WHERE id = ?',
        [id]
      );
      return result ? this.parseIncidentRow(result) : null;
    } catch (error) {
      console.error('Error getting incident:', error);
      throw error;
    }
  }

  // Get total count of all incidents
  async getIncidentCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM incidents'
      );
      return result?.count ?? 0;
    } catch (error) {
      console.error('Error getting incident count:', error);
      throw error;
    }
  }

  // Get incidents with pending status (not yet synced)
  async getPendingIncidents(): Promise<Incident[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<any>(
        "SELECT * FROM incidents WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC"
      );
      return (result || []).map(this.parseIncidentRow);
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
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM incidents WHERE id = ?',
        [id]
      );
      return result ? this.parseIncidentRow(result) : null;
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

  // Update image fields for an incident (supports multiple images)
  async updateIncidentImage(
    id: string,
    imageData: {
      localImageUris?: string[];
      cloudImageUrls?: string[];
      imageUploadStatuses?: ('local_only' | 'low_uploaded' | 'high_uploaded')[];
      imageQualities?: ('none' | 'low' | 'high')[];
    }
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (imageData.localImageUris !== undefined) {
        fields.push('localImageUri = ?');
        values.push(JSON.stringify(imageData.localImageUris));
      }
      if (imageData.cloudImageUrls !== undefined) {
        fields.push('cloudImageUrl = ?');
        values.push(JSON.stringify(imageData.cloudImageUrls));
      }
      if (imageData.imageUploadStatuses !== undefined) {
        fields.push('imageUploadStatus = ?');
        values.push(JSON.stringify(imageData.imageUploadStatuses));
      }
      if (imageData.imageQualities !== undefined) {
        fields.push('imageQuality = ?');
        values.push(JSON.stringify(imageData.imageQualities));
      }

      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      await this.db.runAsync(
        `UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      console.error('Error updating incident image:', error);
      throw error;
    }
  }

  // Get incidents with images that need uploading
  async getIncidentsWithPendingImages(): Promise<Incident[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const results = await this.db.getAllAsync<any>(
        `SELECT * FROM incidents 
         WHERE localImageUri IS NOT NULL 
         AND (imageUploadStatus = 'local_only' OR imageUploadStatus = 'low_uploaded')
         ORDER BY timestamp DESC`
      );
      return (results || []).map(this.parseIncidentRow);
    } catch (error) {
      console.error('Error getting incidents with pending images:', error);
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
