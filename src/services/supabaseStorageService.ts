import { supabase, STORAGE_CONFIG, getPublicUrl } from '../config/supabase';
import { File } from 'expo-file-system';

/**
 * SupabaseStorageService
 * Handles all image uploads and deletions to Supabase Storage
 * 
 * KEY FEATURES:
 * - Upload images to Supabase Storage bucket
 * - Generate unique filenames with incident ID
 * - Get public URLs for uploaded images
 * - Delete images from cloud storage
 * - Replace low-quality with high-quality images
 * - Retry logic for failed uploads
 */

export interface UploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
  cloudPath?: string;
}

export class SupabaseStorageService {
  private static instance: SupabaseStorageService;

  private constructor() {}

  static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  /**
   * Upload image to Supabase Storage
   * 
   * @param localUri - Local file URI
   * @param incidentId - Incident ID for filename
   * @param quality - Image quality ('low' or 'high')
   * @returns Upload result with public URL
   */
  async uploadImage(
    localUri: string,
    incidentId: string,
    quality: 'low' | 'high'
  ): Promise<UploadResult> {
    try {
      console.log(`📤 Uploading ${quality} quality image to Supabase...`);

      // Read file and convert to blob
      const file = new File(localUri);
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });

      // Generate filename: incidentId_quality_timestamp.jpg
      const timestamp = Date.now();
      const filename = `${incidentId}_${quality}_${timestamp}.jpg`;
      const cloudPath = `incidents/${filename}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .upload(cloudPath, blob, {
          contentType: 'image/jpeg',
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        console.error('❌ Supabase upload error:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      // Get public URL
      const publicUrl = getPublicUrl(cloudPath);

      console.log(`✅ Image uploaded: ${quality} - ${filename}`);
      console.log(`🔗 Public URL: ${publicUrl}`);

      return {
        success: true,
        publicUrl,
        cloudPath,
      };
    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown upload error',
      };
    }
  }

  /**
   * Replace low-quality image with high-quality version
   * Deletes the old low-quality image and uploads the new high-quality one
   * 
   * @param oldCloudPath - Path to old low-quality image
   * @param localHighQualityUri - Local URI of high-quality image
   * @param incidentId - Incident ID
   * @returns Upload result
   */
  async replaceWithHighQuality(
    oldCloudPath: string,
    localHighQualityUri: string,
    incidentId: string
  ): Promise<UploadResult> {
    try {
      console.log('🔄 Replacing low-quality image with high-quality...');

      // Upload high-quality image first
      const uploadResult = await this.uploadImage(
        localHighQualityUri,
        incidentId,
        'high'
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Delete old low-quality image
      await this.deleteImage(oldCloudPath);

      console.log('✅ Successfully replaced with high-quality image');
      return uploadResult;
    } catch (error: any) {
      console.error('❌ Failed to replace image:', error);
      return {
        success: false,
        error: error.message || 'Failed to replace image',
      };
    }
  }

  /**
   * Delete image from Supabase Storage
   * 
   * @param cloudPath - Path to file in storage bucket
   */
  async deleteImage(cloudPath: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting image from Supabase: ${cloudPath}`);

      const { error } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .remove([cloudPath]);

      if (error) {
        console.error('❌ Failed to delete image:', error);
      } else {
        console.log('✅ Image deleted from cloud');
      }
    } catch (error) {
      console.error('❌ Error deleting image:', error);
      // Don't throw - deletion failure shouldn't break the app
    }
  }

  /**
   * Delete multiple images from Supabase Storage
   * 
   * @param cloudPaths - Array of paths to delete
   */
  async deleteImages(cloudPaths: string[]): Promise<void> {
    try {
      if (cloudPaths.length === 0) return;

      console.log(`🗑️ Deleting ${cloudPaths.length} images from Supabase...`);

      const { error } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .remove(cloudPaths);

      if (error) {
        console.error('❌ Failed to delete images:', error);
      } else {
        console.log(`✅ ${cloudPaths.length} images deleted from cloud`);
      }
    } catch (error) {
      console.error('❌ Error deleting images:', error);
    }
  }

  /**
   * Check if image exists in Supabase Storage
   * 
   * @param cloudPath - Path to file in storage bucket
   * @returns true if image exists
   */
  async imageExists(cloudPath: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_CONFIG.BUCKET_NAME)
        .list('incidents', {
          search: cloudPath.split('/').pop(), // Get filename
        });

      if (error) {
        console.error('Error checking image existence:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking image existence:', error);
      return false;
    }
  }

  /**
   * Upload with retry logic for unreliable networks
   * 
   * @param localUri - Local file URI
   * @param incidentId - Incident ID
   * @param quality - Image quality
   * @param maxRetries - Maximum retry attempts
   * @returns Upload result
   */
  async uploadWithRetry(
    localUri: string,
    incidentId: string,
    quality: 'low' | 'high',
    maxRetries: number = 3
  ): Promise<UploadResult> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`📤 Upload attempt ${attempt}/${maxRetries}...`);

      const result = await this.uploadImage(localUri, incidentId, quality);

      if (result.success) {
        return result;
      }

      lastError = result.error || 'Unknown error';

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error(`❌ Upload failed after ${maxRetries} attempts`);
    return {
      success: false,
      error: lastError,
    };
  }
}

// Singleton export
export const supabaseStorageService = SupabaseStorageService.getInstance();
