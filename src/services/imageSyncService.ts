import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { dbService } from '../database/db';
import { imageService } from './imageService';
import { FirebaseStorageService } from './firebaseStorageService';

/**
 * ImageSyncService
 * Network-aware image upload orchestrator for offline-first disaster response
 * 
 * SYNC STRATEGY:
 * - Local-first: Always save images locally first
 * - Slow network (2G/3G): Upload low-quality compressed version (~50KB)
 * - Good network (4G/WiFi): Upload high-quality version (~500KB-1MB)
 * - Automatic upgrade: When network improves, replace low with high quality
 * - Retry on failure: Exponential backoff for failed uploads
 * - Background monitoring: Listen for network changes and auto-sync
 * 
 * UPLOAD STATES:
 * - local_only: Image saved locally, not uploaded yet
 * - low_uploaded: Low-quality version uploaded to cloud
 * - high_uploaded: High-quality version uploaded to cloud
 */

export type NetworkQuality = 'offline' | 'poor' | 'good' | 'excellent';

export interface SyncResult {
  incidentId: string;
  success: boolean;
  action: 'uploaded_low' | 'uploaded_high' | 'upgraded_to_high' | 'skipped' | 'failed';
  error?: string;
}

export class ImageSyncService {
  private static instance: ImageSyncService;
  private networkListener: (() => void) | null = null;
  private syncInProgress = false;
  private autoSyncEnabled = false;

  private constructor() {}

  static getInstance(): ImageSyncService {
    if (!ImageSyncService.instance) {
      ImageSyncService.instance = new ImageSyncService();
    }
    return ImageSyncService.instance;
  }

  /**
   * Determine network quality based on connection type and bandwidth
   */
  private async getNetworkQuality(): Promise<NetworkQuality> {
    const state = await NetInfo.fetch();

    if (!state.isConnected || !state.isInternetReachable) {
      return 'offline';
    }

    const type = state.type;

    // Check connection type
    if (type === 'wifi') {
      return 'excellent';
    } else if (type === 'cellular') {
      const details = (state as any).details;
      const cellularGeneration = details?.cellularGeneration;

      if (cellularGeneration === '4g' || cellularGeneration === '5g') {
        return 'good';
      } else if (cellularGeneration === '3g') {
        return 'poor';
      } else {
        // 2G or unknown
        return 'poor';
      }
    } else if (type === 'ethernet') {
      return 'excellent';
    }

    // Unknown or other types - assume good
    return 'good';
  }

  /**
   * Process image for an incident - compress and save locally
   * Call this immediately after capturing/selecting an image
   * 
   * @param imageUri - Original image URI from camera/gallery
   * @param incidentId - Incident ID
   * @returns Local URI of saved original image
   */
  async processImageForIncident(imageUri: string, incidentId: string): Promise<string> {
    try {
      console.log('🖼️ Processing image for incident...');

      // Save original image locally
      const localUri = await imageService.saveImageLocally(
        imageUri,
        incidentId,
        'original'
      );

      // Update incident in database with local URI (as array)
      await dbService.updateIncidentImage(incidentId, {
        localImageUris: [localUri],
        cloudImageUrls: [''],
        imageUploadStatuses: ['local_only'],
        imageQualities: ['none'],
      });

      console.log('✅ Image processed and saved locally');
      return localUri;
    } catch (error) {
      console.error('❌ Failed to process image:', error);
      throw error;
    }
  }

  /**
   * Sync a single incident's image based on network quality
   * 
   * @param incidentId - Incident ID with pending image
   * @returns Sync result
   */
  async syncIncidentImage(incidentId: string): Promise<SyncResult> {
    try {
      // Check Firebase Storage configuration
      if (!FirebaseStorageService.isConfigured()) {
        console.warn('⚠️ Firebase Storage not configured. Skipping image upload.');
        return {
          incidentId,
          success: false,
          action: 'skipped',
          error: 'Firebase Storage not configured',
        };
      }

      // Get incident from database
      const incidents = await dbService.getAllIncidents();
      const incident = incidents.find((i) => i.id === incidentId);

      if (!incident || !incident.localImageUris || incident.localImageUris.length === 0) {
        return {
          incidentId,
          success: false,
          action: 'skipped',
          error: 'No image to sync',
        };
      }

      const networkQuality = await this.getNetworkQuality();

      if (networkQuality === 'offline') {
        console.log('📵 Offline - skipping image upload');
        return {
          incidentId,
          success: false,
          action: 'skipped',
          error: 'Offline',
        };
      }

      // Work with first image for now (TODO: handle multiple images)
      const currentStatus = incident.imageUploadStatuses?.[0] || 'local_only';

      // Decision tree based on network quality and current state
      if (currentStatus === 'local_only') {
        // First upload - choose quality based on network
        if (networkQuality === 'poor') {
          return await this.uploadLowQuality(incident);
        } else {
          // Good or excellent network - upload high quality directly
          return await this.uploadHighQuality(incident);
        }
      } else if (currentStatus === 'low_uploaded') {
        // Low quality already uploaded - upgrade if network is better
        if (networkQuality === 'good' || networkQuality === 'excellent') {
          return await this.upgradeToHighQuality(incident);
        } else {
          console.log('⏭️ Network still poor - keeping low quality');
          return {
            incidentId,
            success: true,
            action: 'skipped',
          };
        }
      } else {
        // High quality already uploaded - nothing to do
        return {
          incidentId,
          success: true,
          action: 'skipped',
        };
      }
    } catch (error: any) {
      console.error(`❌ Failed to sync image for ${incidentId}:`, error);
      return {
        incidentId,
        success: false,
        action: 'failed',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Upload low-quality compressed image
   */
  private async uploadLowQuality(incident: any): Promise<SyncResult> {
    try {
      console.log('📤 Uploading low-quality image (slow network)...');

      // Get first image URI
      const localImageUri = incident.localImageUris?.[0];
      if (!localImageUri) {
        throw new Error('No local image URI found');
      }

      // Compress to low quality
      const compressed = await imageService.compressToLowQuality(
        localImageUri
      );

      // Save low-quality version locally
      const lowQualityUri = await imageService.saveImageLocally(
        compressed.uri,
        incident.id,
        'low'
      );

      // Upload to Firebase Storage
      const downloadUrl = await FirebaseStorageService.uploadWithRetry(
        lowQualityUri,
        incident.id,
        'low'
      );

      // Update database (update first image in arrays)
      await dbService.updateIncidentImage(incident.id, {
        cloudImageUrls: [downloadUrl],
        imageUploadStatuses: ['low_uploaded'],
        imageQualities: ['low'],
      });

      console.log('✅ Low-quality image uploaded successfully');
      return {
        incidentId: incident.id,
        success: true,
        action: 'uploaded_low',
      };
    } catch (error: any) {
      return {
        incidentId: incident.id,
        success: false,
        action: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Upload high-quality image directly
   */
  private async uploadHighQuality(incident: any): Promise<SyncResult> {
    try {
      console.log('📤 Uploading high-quality image (good network)...');

      // Get first image URI
      const localImageUri = incident.localImageUris?.[0];
      if (!localImageUri) {
        throw new Error('No local image URI found');
      }

      // Compress to high quality
      const compressed = await imageService.compressToHighQuality(
        localImageUri
      );

      // Save high-quality version locally
      const highQualityUri = await imageService.saveImageLocally(
        compressed.uri,
        incident.id,
        'high'
      );

      // Upload to Firebase Storage
      const downloadUrl = await FirebaseStorageService.uploadWithRetry(
        highQualityUri,
        incident.id,
        'high'
      );

      // Update database (update first image in arrays)
      await dbService.updateIncidentImage(incident.id, {
        cloudImageUrls: [downloadUrl],
        imageUploadStatuses: ['high_uploaded'],
        imageQualities: ['high'],
      });

      console.log('✅ High-quality image uploaded successfully');
      return {
        incidentId: incident.id,
        success: true,
        action: 'uploaded_high',
      };
    } catch (error: any) {
      return {
        incidentId: incident.id,
        success: false,
        action: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Upgrade from low-quality to high-quality image
   */
  private async upgradeToHighQuality(incident: any): Promise<SyncResult> {
    try {
      console.log('🔄 Upgrading to high-quality image...');

      // Get first image URI
      const localImageUri = incident.localImageUris?.[0];
      if (!localImageUri) {
        throw new Error('No local image URI found');
      }

      // Compress original to high quality
      const compressed = await imageService.compressToHighQuality(
        localImageUri
      );

      // Save high-quality version locally
      const highQualityUri = await imageService.saveImageLocally(
        compressed.uri,
        incident.id,
        'high'
      );

      // Replace with high quality on Firebase Storage
      const downloadUrl = await FirebaseStorageService.replaceWithHighQuality(
        highQualityUri,
        incident.id
      );

      // Update database (update first image in arrays)
      await dbService.updateIncidentImage(incident.id, {
        cloudImageUrls: [downloadUrl],
        imageUploadStatuses: ['high_uploaded'],
        imageQualities: ['high'],
      });

      console.log('✅ Successfully upgraded to high-quality image');
      return {
        incidentId: incident.id,
        success: true,
        action: 'upgraded_to_high',
      };
    } catch (error: any) {
      return {
        incidentId: incident.id,
        success: false,
        action: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Sync all pending images
   * Call this manually or on network state change
   * 
   * @returns Array of sync results
   */
  async syncAllPendingImages(): Promise<SyncResult[]> {
    if (this.syncInProgress) {
      console.log('⏳ Image sync already in progress, skipping...');
      return [];
    }

    try {
      this.syncInProgress = true;
      console.log('🔄 Starting image sync...');

      const incidents = await dbService.getIncidentsWithPendingImages();

      if (incidents.length === 0) {
        console.log('✅ No images to sync');
        return [];
      }

      console.log(`📸 Found ${incidents.length} incident(s) with pending images`);

      const results: SyncResult[] = [];

      for (const incident of incidents) {
        const result = await this.syncIncidentImage(incident.id);
        results.push(result);
      }

      const successful = results.filter((r) => r.success).length;
      console.log(`✅ Image sync complete: ${successful}/${incidents.length} successful`);

      return results;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Start automatic image sync when network improves
   * Listens for network state changes and triggers sync
   */
  startAutoSync(): void {
    if (this.autoSyncEnabled) {
      console.log('⚠️ Auto-sync already enabled');
      return;
    }

    console.log('🚀 Starting automatic image sync');

    this.networkListener = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        // Wait a bit to ensure stable connection
        setTimeout(() => {
          this.syncAllPendingImages();
        }, 2000);
      }
    });

    this.autoSyncEnabled = true;
  }

  /**
   * Stop automatic image sync
   */
  stopAutoSync(): void {
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
    this.autoSyncEnabled = false;
    console.log('🛑 Automatic image sync stopped');
  }

  /**
   * Get current sync status
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }
}

// Singleton export
export const imageSyncService = ImageSyncService.getInstance();
