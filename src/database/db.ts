import * as SQLite from 'expo-sqlite';
import { AidRequest } from './models/AidRequest';

// Define Incident interface for type safety
export interface Incident {
  id: string;
  type: string;
  severity: number;
  latitude: number;
  longitude: number;
  timestamp: number; // Unix timestamp in milliseconds
  status: 'pending' | 'synced' | 'failed'; // Changed from is_synced boolean
  actionStatus?: 'pending' | 'taking action' | 'completed'; // Admin action status
  created_at: number;
  updated_at: number;
  description?: string; // Additional details for incidents (e.g., trapped civilians info)
  // Image fields - Support up to 3 images per incident
  localImageUris?: string[]; // Array of local file paths
  cloudImageUrls?: string[]; // Array of Firebase Storage URLs
  imageUploadStatuses?: ('local_only' | 'low_uploaded' | 'high_uploaded')[]; // Upload states
  imageQualities?: ('none' | 'low' | 'high')[]; // Current qualities in cloud
}

// Define DetentionCamp interface for type safety
export interface DetentionCamp {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number;
  current_occupancy: number;
  facilities: string; // JSON string array
  campStatus: 'operational' | 'full' | 'closed';
  contact_person?: string;
  contact_phone?: string;
  description?: string;
  status: 'pending' | 'synced' | 'failed'; // Sync status
  adminApproved: boolean; // Admin approval status
  created_at: number;
  updated_at: number;
}

// Define Volunteer interface for type safety
export interface Volunteer {
  id: string;
  user_email: string;
  full_name: string;
  phone_number: string;
  district: string; // Sri Lankan district
  skills: string; // JSON string array
  availability: string; // e.g., "Weekdays", "Weekends", "Anytime"
  preferred_tasks: string; // JSON string array
  emergency_contact?: string;
  emergency_phone?: string;
  status: 'pending' | 'synced' | 'failed'; // Sync status
  approved: boolean; // Admin approval status
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
      this.initialized = true; // Set immediately after opening DB
      console.log('✓ Database opened successfully');
      
      await this.createTables();
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
          actionStatus TEXT DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          description TEXT,
          localImageUri TEXT,
          cloudImageUrl TEXT,
          imageUploadStatus TEXT DEFAULT 'local_only',
          imageQuality TEXT DEFAULT 'none'
        );
      `);

      // Create aid_requests table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS aid_requests (
          id TEXT PRIMARY KEY,
          aid_types TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          description TEXT,
          priority_level INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          aidStatus TEXT NOT NULL DEFAULT 'pending',
          requester_name TEXT,
          contact_number TEXT,
          number_of_people INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create detention_camps table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS detention_camps (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          capacity INTEGER NOT NULL,
          current_occupancy INTEGER NOT NULL DEFAULT 0,
          facilities TEXT NOT NULL,
          campStatus TEXT NOT NULL DEFAULT 'operational',
          contact_person TEXT,
          contact_phone TEXT,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          adminApproved INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Create volunteers table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS volunteers (
          id TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          full_name TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          district TEXT NOT NULL,
          skills TEXT NOT NULL,
          availability TEXT NOT NULL,
          preferred_tasks TEXT NOT NULL,
          emergency_contact TEXT,
          emergency_phone TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          approved INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Migration: Add image columns to existing databases
      await this.migrateImageColumns();

      // Migration: Add actionStatus column
      await this.migrateActionStatus();

      // Migration: Add aid request contact fields
      await this.migrateAidRequestContactFields();

      // Migration: Add aid request aidStatus field
      await this.migrateAidRequestAidStatus();

      // Migration: Add description to incidents
      await this.migrateIncidentDescription();

      // Create index on status for efficient querying of unsynced records
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      `);

      // Create index on imageUploadStatus for efficient image sync queries
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_incidents_image_status ON incidents(imageUploadStatus);
      `);

      // Create index on aid_requests status for efficient querying
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_aid_requests_status ON aid_requests(status);
      `);

      // Create index on detention_camps status and approval for efficient querying
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_camps_status ON detention_camps(status);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_camps_approved ON detention_camps(adminApproved);
      `);

      // Create index on volunteers status for efficient querying
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status);
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_volunteers_email ON volunteers(user_email);
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

  /**
   * Migrate existing databases to add actionStatus column
   */
  private async migrateActionStatus(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if actionStatus column exists
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(incidents);`
      );

      const columnNames = tableInfo.map((col) => col.name);

      if (!columnNames.includes('actionStatus')) {
        await this.db.execAsync(`ALTER TABLE incidents ADD COLUMN actionStatus TEXT DEFAULT 'pending';`);
        console.log('✓ Added actionStatus column');
      }
    } catch (error) {
      console.error('Error migrating actionStatus column:', error);
      // Don't throw - if migration fails, it might be because column already exists
    }
  }

  /**
   * Migration: Add contact fields to aid_requests table
   */
  private async migrateAidRequestContactFields(): Promise<void> {
    if (!this.db) return;

    try {
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(aid_requests);'
      );

      const columnNames = tableInfo.map((col) => col.name);

      if (!columnNames.includes('requester_name')) {
        await this.db.execAsync(`ALTER TABLE aid_requests ADD COLUMN requester_name TEXT;`);
        console.log('✓ Added requester_name column');
      }

      if (!columnNames.includes('contact_number')) {
        await this.db.execAsync(`ALTER TABLE aid_requests ADD COLUMN contact_number TEXT;`);
        console.log('✓ Added contact_number column');
      }

      if (!columnNames.includes('number_of_people')) {
        await this.db.execAsync(`ALTER TABLE aid_requests ADD COLUMN number_of_people INTEGER;`);
        console.log('✓ Added number_of_people column');
      }
    } catch (error) {
      console.error('Error migrating aid request contact fields:', error);
      // Don't throw - if migration fails, it might be because columns already exist
    }
  }

  /**
   * Migration: Add aidStatus to aid_requests table
   */
  private async migrateAidRequestAidStatus(): Promise<void> {
    if (!this.db) return;

    try {
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(aid_requests);'
      );

      const columnNames = tableInfo.map((col) => col.name);

      if (!columnNames.includes('aidStatus')) {
        await this.db.execAsync(`ALTER TABLE aid_requests ADD COLUMN aidStatus TEXT DEFAULT 'pending';`);
        console.log('✓ Added aidStatus column to aid_requests');
      }
    } catch (error) {
      console.error('Error migrating aidStatus column:', error);
      // Don't throw - if migration fails, it might be because column already exists
    }
  }

  /**
   * Migration: Add description to incidents table
   */
  private async migrateIncidentDescription(): Promise<void> {
    if (!this.db) return;

    try {
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(incidents);'
      );

      const columnNames = tableInfo.map((col) => col.name);

      if (!columnNames.includes('description')) {
        await this.db.execAsync(`ALTER TABLE incidents ADD COLUMN description TEXT;`);
        console.log('✓ Added description column to incidents');
      }
    } catch (error) {
      console.error('Error migrating description column:', error);
      // Don't throw - if migration fails, it might be because column already exists
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
          id, type, severity, latitude, longitude, timestamp, status, actionStatus,
          created_at, updated_at, description, localImageUri, cloudImageUrl, 
          imageUploadStatus, imageQuality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullIncident.id,
          fullIncident.type,
          fullIncident.severity,
          fullIncident.latitude,
          fullIncident.longitude,
          fullIncident.timestamp,
          fullIncident.status,
          fullIncident.actionStatus || 'pending',
          fullIncident.created_at,
          fullIncident.updated_at,
          fullIncident.description || null,
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
    console.log(`[DB] Parsing incident ${row.id?.substring(0, 8)}: actionStatus=${row.actionStatus}`);
    
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

  // Update incident action status
  async updateIncidentActionStatus(
    id: string,
    actionStatus: 'pending' | 'taking action' | 'completed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE incidents SET actionStatus = ?, updated_at = ? WHERE id = ?',
        [actionStatus, Date.now(), id]
      );
      console.log(`✓ Updated incident ${id} actionStatus to ${actionStatus}`);
    } catch (error) {
      console.error('Error updating incident action status:', error);
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
         AND localImageUri != ''
         AND localImageUri != '[]'
         ORDER BY timestamp DESC`
      );
      
      // Filter for incidents that have pending images (local_only or low_uploaded)
      const incidents = (results || []).map(this.parseIncidentRow);
      return incidents.filter(incident => {
        if (!incident.imageUploadStatuses || incident.imageUploadStatuses.length === 0) {
          return false;
        }
        // Check if any image is still pending upload
        return incident.imageUploadStatuses.some(
          status => status === 'local_only' || status === 'low_uploaded'
        );
      });
    } catch (error) {
      console.error('Error getting incidents with pending images:', error);
      throw error;
    }
  }

  // Check if database is initialized
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========== AID REQUEST OPERATIONS ==========

  // Create a new aid request
  async createAidRequest(
    aidRequest: Omit<AidRequest, 'created_at' | 'updated_at'>
  ): Promise<AidRequest> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const fullAidRequest: AidRequest = {
      ...aidRequest,
      created_at: now,
      updated_at: now,
    };

    try {
      await this.db.runAsync(
        `INSERT INTO aid_requests (
          id, aid_types, latitude, longitude, description, priority_level, 
          status, aidStatus, requester_name, contact_number, number_of_people, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullAidRequest.id,
          fullAidRequest.aid_types,
          fullAidRequest.latitude,
          fullAidRequest.longitude,
          fullAidRequest.description,
          fullAidRequest.priority_level,
          fullAidRequest.status,
          fullAidRequest.aidStatus || 'pending',
          fullAidRequest.requester_name,
          fullAidRequest.contact_number,
          fullAidRequest.number_of_people,
          fullAidRequest.created_at,
          fullAidRequest.updated_at,
        ]
      );

      return fullAidRequest;
    } catch (error) {
      console.error('Error creating aid request:', error);
      throw error;
    }
  }

  // Get all aid requests sorted by created_at descending
  async getAllAidRequests(): Promise<AidRequest[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<AidRequest>(
        'SELECT * FROM aid_requests ORDER BY created_at DESC'
      );
      return result || [];
    } catch (error) {
      console.error('Error getting all aid requests:', error);
      throw error;
    }
  }

  // Get aid requests with pending status (not yet synced)
  async getPendingAidRequests(): Promise<AidRequest[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<AidRequest>(
        "SELECT * FROM aid_requests WHERE status = 'pending' OR status = 'failed' OR status = 'unsynced' ORDER BY created_at ASC"
      );
      return result || [];
    } catch (error) {
      console.error('Error getting pending aid requests:', error);
      throw error;
    }
  }

  // Get count of pending aid requests
  async getPendingAidRequestsCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM aid_requests WHERE status = 'pending' OR status = 'failed' OR status = 'unsynced'"
      );
      return result?.count ?? 0;
    } catch (error) {
      console.error('Error getting pending aid requests count:', error);
      throw error;
    }
  }

  // Update aid request status
  async updateAidRequestStatus(
    id: string,
    status: 'pending' | 'synced' | 'failed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE aid_requests SET status = ?, updated_at = ? WHERE id = ?',
        [status, Date.now(), id]
      );
    } catch (error) {
      console.error('Error updating aid request status:', error);
      throw error;
    }
  }

  // Update multiple aid requests status
  async updateAidRequestsStatus(
    ids: string[],
    status: 'pending' | 'synced' | 'failed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const placeholders = ids.map(() => '?').join(',');
      await this.db.runAsync(
        `UPDATE aid_requests SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
        [status, Date.now(), ...ids]
      );
    } catch (error) {
      console.error('Error updating multiple aid request statuses:', error);
      throw error;
    }
  }

  // Update aid request aidStatus
  async updateAidRequestAidStatus(
    id: string,
    aidStatus: 'pending' | 'taking action' | 'completed',
    markForSync: boolean = true
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const newStatus = markForSync ? 'unsynced' : 'synced';
      await this.db.runAsync(
        'UPDATE aid_requests SET aidStatus = ?, status = ?, updated_at = ? WHERE id = ?',
        [aidStatus, newStatus, Date.now(), id]
      );
      console.log(`✓ Updated aid request ${id} aidStatus to ${aidStatus}${markForSync ? ' and marked for sync' : ''}`);
    } catch (error) {
      console.error('Error updating aid request aidStatus:', error);
      throw error;
    }
  }

  // Get single aid request by id
  async getAidRequestById(id: string): Promise<AidRequest | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<AidRequest>(
        'SELECT * FROM aid_requests WHERE id = ?',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Error getting aid request by id:', error);
      throw error;
    }
  }

  // Delete aid request
  async deleteAidRequest(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM aid_requests WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting aid request:', error);
      throw error;
    }
  }

  // ===== DETENTION CAMP METHODS =====

  // Add new detention camp
  async addDetentionCamp(camp: Omit<DetentionCamp, 'id' | 'created_at' | 'updated_at' | 'status' | 'adminApproved'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = `camp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      await this.db.runAsync(
        `INSERT INTO detention_camps (
          id, name, latitude, longitude, capacity, current_occupancy, 
          facilities, campStatus, contact_person, contact_phone, description,
          status, adminApproved, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          camp.name,
          camp.latitude,
          camp.longitude,
          camp.capacity,
          camp.current_occupancy,
          camp.facilities,
          camp.campStatus,
          camp.contact_person || null,
          camp.contact_phone || null,
          camp.description || null,
          'pending', // New camps start as pending
          0, // Not admin approved by default
          now,
          now,
        ]
      );

      console.log(`✓ Camp added with ID: ${id}`);
      return id;
    } catch (error) {
      console.error('Error adding detention camp:', error);
      throw error;
    }
  }

  // Insert detention camp from Firebase (preserving Firebase ID)
  async insertDetentionCampFromFirebase(camp: DetentionCamp): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO detention_camps (
          id, name, latitude, longitude, capacity, current_occupancy, 
          facilities, campStatus, contact_person, contact_phone, description,
          status, adminApproved, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          camp.id,
          camp.name,
          camp.latitude,
          camp.longitude,
          camp.capacity,
          camp.current_occupancy,
          camp.facilities,
          camp.campStatus,
          camp.contact_person || null,
          camp.contact_phone || null,
          camp.description || null,
          'synced', // Firebase camps are synced
          camp.adminApproved ? 1 : 0,
          camp.created_at,
          camp.updated_at,
        ]
      );

      console.log(`✓ Camp ${camp.id} inserted from Firebase`);
    } catch (error) {
      console.error('Error inserting camp from Firebase:', error);
      throw error;
    }
  }

  // Get all detention camps (approved only for regular users)
  async getAllDetentionCamps(includeUnapproved: boolean = false): Promise<DetentionCamp[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      let query = 'SELECT * FROM detention_camps';
      if (!includeUnapproved) {
        query += ' WHERE adminApproved = 1';
      }
      query += ' ORDER BY created_at DESC';

      const result = await this.db.getAllAsync<any>(query);
      
      // Convert adminApproved from number to boolean
      return (result || []).map(camp => ({
        ...camp,
        adminApproved: camp.adminApproved === 1
      }));
    } catch (error) {
      console.error('Error getting all detention camps:', error);
      throw error;
    }
  }

  // Get pending detention camps (for sync)
  async getPendingDetentionCamps(): Promise<DetentionCamp[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<any>(
        "SELECT * FROM detention_camps WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC"
      );
      
      return (result || []).map(camp => ({
        ...camp,
        adminApproved: camp.adminApproved === 1
      }));
    } catch (error) {
      console.error('Error getting pending detention camps:', error);
      throw error;
    }
  }

  // Get count of pending detention camps
  async getPendingDetentionCampsCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM detention_camps WHERE status = 'pending' OR status = 'failed'"
      );
      return result?.count ?? 0;
    } catch (error) {
      console.error('Error getting pending detention camps count:', error);
      throw error;
    }
  }

  // Update detention camp status
  async updateDetentionCampStatus(
    id: string,
    status: 'pending' | 'synced' | 'failed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE detention_camps SET status = ?, updated_at = ? WHERE id = ?',
        [status, Date.now(), id]
      );
    } catch (error) {
      console.error('Error updating detention camp status:', error);
      throw error;
    }
  }

  // Update detention camp admin approval status
  async updateDetentionCampApproval(
    id: string,
    adminApproved: boolean
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE detention_camps SET adminApproved = ?, updated_at = ? WHERE id = ?',
        [adminApproved ? 1 : 0, Date.now(), id]
      );
      console.log(`✓ Updated camp ${id} approval to ${adminApproved}`);
    } catch (error) {
      console.error('Error updating detention camp approval:', error);
      throw error;
    }
  }

  // Get single detention camp by id
  async getDetentionCampById(id: string): Promise<DetentionCamp | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM detention_camps WHERE id = ?',
        [id]
      );
      
      if (!result) return null;
      
      return {
        ...result,
        adminApproved: result.adminApproved === 1
      };
    } catch (error) {
      console.error('Error getting detention camp by id:', error);
      throw error;
    }
  }

  // Update detention camp details
  async updateDetentionCamp(id: string, updates: Partial<DetentionCamp>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.capacity !== undefined) {
        fields.push('capacity = ?');
        values.push(updates.capacity);
      }
      if (updates.current_occupancy !== undefined) {
        fields.push('current_occupancy = ?');
        values.push(updates.current_occupancy);
      }
      if (updates.facilities !== undefined) {
        fields.push('facilities = ?');
        values.push(updates.facilities);
      }
      if (updates.campStatus !== undefined) {
        fields.push('campStatus = ?');
        values.push(updates.campStatus);
      }
      if (updates.contact_person !== undefined) {
        fields.push('contact_person = ?');
        values.push(updates.contact_person);
      }
      if (updates.contact_phone !== undefined) {
        fields.push('contact_phone = ?');
        values.push(updates.contact_phone);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }

      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      await this.db.runAsync(
        `UPDATE detention_camps SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      console.error('Error updating detention camp:', error);
      throw error;
    }
  }

  // Delete detention camp
  async deleteDetentionCamp(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM detention_camps WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting detention camp:', error);
      throw error;
    }
  }

  // ============= VOLUNTEER METHODS =============

  // Create a new volunteer registration
  async createVolunteer(volunteer: Omit<Volunteer, 'created_at' | 'updated_at'>): Promise<Volunteer> {
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const fullVolunteer: Volunteer = {
      ...volunteer,
      created_at: now,
      updated_at: now,
    };

    try {
      await this.db.runAsync(
        `INSERT INTO volunteers (
          id, user_email, full_name, phone_number, district, skills, availability, 
          preferred_tasks, emergency_contact, emergency_phone, status, approved, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullVolunteer.id,
          fullVolunteer.user_email,
          fullVolunteer.full_name,
          fullVolunteer.phone_number,
          fullVolunteer.district,
          fullVolunteer.skills,
          fullVolunteer.availability,
          fullVolunteer.preferred_tasks,
          fullVolunteer.emergency_contact || null,
          fullVolunteer.emergency_phone || null,
          fullVolunteer.status,
          fullVolunteer.approved ? 1 : 0,
          fullVolunteer.created_at,
          fullVolunteer.updated_at,
        ]
      );

      console.log('✓ Volunteer registered:', fullVolunteer.user_email);
      return fullVolunteer;
    } catch (error) {
      console.error('Error creating volunteer:', error);
      throw error;
    }
  }

  // Get all volunteers sorted by created_at descending
  async getAllVolunteers(): Promise<Volunteer[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<any>(
        'SELECT * FROM volunteers ORDER BY created_at DESC'
      );
      return (result || []).map(row => ({
        ...row,
        approved: row.approved === 1
      }));
    } catch (error) {
      console.error('Error getting all volunteers:', error);
      throw error;
    }
  }

  // Get volunteer by email
  async getVolunteerByEmail(email: string): Promise<Volunteer | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM volunteers WHERE user_email = ?',
        [email]
      );
      
      if (!result) return null;
      
      return {
        ...result,
        approved: result.approved === 1
      };
    } catch (error) {
      console.error('Error getting volunteer by email:', error);
      throw error;
    }
  }

  // Get volunteer by ID
  async getVolunteerById(id: string): Promise<Volunteer | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<any>(
        'SELECT * FROM volunteers WHERE id = ?',
        [id]
      );
      
      if (!result) return null;
      
      return {
        ...result,
        approved: result.approved === 1
      };
    } catch (error) {
      console.error('Error getting volunteer by id:', error);
      throw error;
    }
  }

  // Get volunteers with pending status (not yet synced)
  async getPendingVolunteers(): Promise<Volunteer[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<any>(
        "SELECT * FROM volunteers WHERE status = 'pending' OR status = 'failed' ORDER BY created_at ASC"
      );
      return (result || []).map(row => ({
        ...row,
        approved: row.approved === 1
      }));
    } catch (error) {
      console.error('Error getting pending volunteers:', error);
      throw error;
    }
  }

  // Get count of pending volunteers
  async getPendingVolunteersCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM volunteers WHERE status = 'pending' OR status = 'failed'"
      );
      return result?.count ?? 0;
    } catch (error) {
      console.error('Error getting pending volunteers count:', error);
      throw error;
    }
  }

  // Get unapproved volunteers
  async getUnapprovedVolunteers(): Promise<Volunteer[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getAllAsync<any>(
        'SELECT * FROM volunteers WHERE approved = 0 ORDER BY created_at ASC'
      );
      return (result || []).map(row => ({
        ...row,
        approved: row.approved === 1
      }));
    } catch (error) {
      console.error('Error getting unapproved volunteers:', error);
      throw error;
    }
  }

  // Update volunteer status
  async updateVolunteerStatus(
    id: string,
    status: 'pending' | 'synced' | 'failed'
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE volunteers SET status = ?, updated_at = ? WHERE id = ?',
        [status, Date.now(), id]
      );
    } catch (error) {
      console.error('Error updating volunteer status:', error);
      throw error;
    }
  }

  // Update volunteer approval status
  async updateVolunteerApproval(
    id: string,
    approved: boolean
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync(
        'UPDATE volunteers SET approved = ?, updated_at = ? WHERE id = ?',
        [approved ? 1 : 0, Date.now(), id]
      );
      console.log(`✓ Updated volunteer ${id} approval to ${approved}`);
    } catch (error) {
      console.error('Error updating volunteer approval:', error);
      throw error;
    }
  }

  // Update volunteer details
  async updateVolunteer(id: string, updates: Partial<Volunteer>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.full_name !== undefined) {
        fields.push('full_name = ?');
        values.push(updates.full_name);
      }
      if (updates.phone_number !== undefined) {
        fields.push('phone_number = ?');
        values.push(updates.phone_number);
      }
      if (updates.skills !== undefined) {
        fields.push('skills = ?');
        values.push(updates.skills);
      }
      if (updates.availability !== undefined) {
        fields.push('availability = ?');
        values.push(updates.availability);
      }
      if (updates.preferred_tasks !== undefined) {
        fields.push('preferred_tasks = ?');
        values.push(updates.preferred_tasks);
      }
      if (updates.emergency_contact !== undefined) {
        fields.push('emergency_contact = ?');
        values.push(updates.emergency_contact);
      }
      if (updates.emergency_phone !== undefined) {
        fields.push('emergency_phone = ?');
        values.push(updates.emergency_phone);
      }

      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      await this.db.runAsync(
        `UPDATE volunteers SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      console.error('Error updating volunteer:', error);
      throw error;
    }
  }

  // Delete volunteer
  async deleteVolunteer(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM volunteers WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error deleting volunteer:', error);
      throw error;
    }
  }
}

// Singleton instance
export const dbService = new DatabaseService();
