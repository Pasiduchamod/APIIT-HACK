import { File } from 'expo-file-system';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Firebase Storage configuration for incident images
 */
const STORAGE_CONFIG = {
  FOLDER: 'incident-images',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'] as string[],
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
};

/**
 * Firebase Storage Service for uploading, replacing, and deleting incident images
 */
export class FirebaseStorageService {
  /**
   * Upload an image to Firebase Storage
   * @param localUri - Local file path to the image
   * @param incidentId - Unique incident identifier
   * @param quality - Image quality type ('low' or 'high')
   * @returns Firebase Storage download URL
   */
  static async uploadImage(
    localUri: string,
    incidentId: string,
    quality: 'low' | 'high'
  ): Promise<string> {
    try {
      // Validate file exists
      const file = new File(localUri);
      const exists = file.exists;
      if (!exists) {
        throw new Error(`File not found: ${localUri}`);
      }

      // Check file size
      const fileSize = file.size;
      if (fileSize > STORAGE_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File size (${fileSize} bytes) exceeds maximum (${STORAGE_CONFIG.MAX_FILE_SIZE} bytes)`);
      }

      // Determine file extension
      const extension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      // Validate MIME type
      if (!STORAGE_CONFIG.ALLOWED_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${STORAGE_CONFIG.ALLOWED_TYPES.join(', ')}`);
      }

      // Create storage path: incident-images/{incidentId}_{quality}.{ext}
      const fileName = `${incidentId}_${quality}.${extension}`;
      const storagePath = `${STORAGE_CONFIG.FOLDER}/${fileName}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Upload file - Use fetch to get blob from local URI (React Native compatible)
      console.log(`Uploading ${quality} quality image to Firebase Storage: ${storagePath}`);
      
      let blob: Blob;
      try {
        const response = await fetch(localUri);
        
        if (!response.ok) {
          throw new Error(`Failed to read image file: ${response.statusText}`);
        }
        
        blob = await response.blob();
      } catch (fetchError: any) {
        console.error('Fetch error:', fetchError);
        throw new Error(`Failed to read local image: ${fetchError.message}`);
      }
      
      try {
        const snapshot = await uploadBytes(storageRef, blob, {
          contentType: mimeType,
        });

        // Get download URL
        const downloadUrl = await getDownloadURL(snapshot.ref);
        console.log(`✓ Upload successful: ${downloadUrl}`);

        return downloadUrl;
      } catch (uploadError: any) {
        console.error('Upload bytes error:', uploadError);
        throw uploadError;
      }
    } catch (error: any) {
      console.error('Firebase Storage upload error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Upload failed';
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied. Please check your connection and try again.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Upload was canceled';
      } else if (error.code === 'storage/unknown' || error.message?.includes('network')) {
        errorMessage = 'Network error. Image saved locally and will upload when connection improves.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Replace low-quality image with high-quality version
   * @param localUri - Local file path to high-quality image
   * @param incidentId - Unique incident identifier
   * @returns Firebase Storage download URL
   */
  static async replaceWithHighQuality(
    localUri: string,
    incidentId: string
  ): Promise<string> {
    try {
      console.log(`Replacing low-quality image with high-quality for incident: ${incidentId}`);

      // Delete low-quality version if it exists
      try {
        await this.deleteImage(incidentId, 'low');
      } catch (error) {
        // Ignore if low-quality image doesn't exist
        console.log('Low-quality image not found, skipping deletion');
      }

      // Upload high-quality version
      return await this.uploadImage(localUri, incidentId, 'high');
    } catch (error: any) {
      console.error('Failed to replace with high-quality image:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Firebase Storage
   * @param incidentId - Unique incident identifier
   * @param quality - Image quality type ('low' or 'high')
   */
  static async deleteImage(incidentId: string, quality: 'low' | 'high'): Promise<void> {
    try {
      // Assume .jpg extension (since we compress to JPEG)
      const fileName = `${incidentId}_${quality}.jpg`;
      const storagePath = `${STORAGE_CONFIG.FOLDER}/${fileName}`;

      // Create storage reference
      const storageRef = ref(storage, storagePath);

      // Delete file
      console.log(`Deleting image from Firebase Storage: ${storagePath}`);
      await deleteObject(storageRef);
      console.log(`✓ Image deleted successfully`);
    } catch (error: any) {
      // Firebase throws error if file doesn't exist
      if (error.code === 'storage/object-not-found') {
        console.log(`Image not found in storage: ${incidentId}_${quality}`);
      } else {
        console.error('Firebase Storage delete error:', error);
        throw error;
      }
    }
  }

  /**
   * Upload with automatic retry on failure
   * @param localUri - Local file path to the image
   * @param incidentId - Unique incident identifier
   * @param quality - Image quality type ('low' or 'high')
   * @returns Firebase Storage download URL
   */
  static async uploadWithRetry(
    localUri: string,
    incidentId: string,
    quality: 'low' | 'high'
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= STORAGE_CONFIG.MAX_RETRIES; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/${STORAGE_CONFIG.MAX_RETRIES}`);
        return await this.uploadImage(localUri, incidentId, quality);
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt < STORAGE_CONFIG.MAX_RETRIES) {
          const delay = STORAGE_CONFIG.RETRY_DELAY * attempt; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Upload failed after ${STORAGE_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  /**
   * Check if Firebase Storage is properly configured
   */
  static isConfigured(): boolean {
    try {
      return !!storage;
    } catch {
      return false;
    }
  }
}
