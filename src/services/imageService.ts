import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Paths, Directory, File } from 'expo-file-system';

/**
 * ImageService
 * Handles image capture, compression, and local storage
 * 
 * KEY FEATURES:
 * - Request camera/gallery permissions
 * - Capture photos with camera or select from gallery
 * - Compress images to low/high quality
 * - Save images locally in app's document directory
 * - Calculate file sizes for network decisions
 */

export interface ImageCompressionResult {
  uri: string;
  width: number;
  height: number;
  size: number; // bytes
  quality: 'low' | 'high';
}

export class ImageService {
  private static instance: ImageService;

  private constructor() {}

  static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  /**
   * Request camera permissions
   * Call this before using the camera
   */
  async requestCameraPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  }

  /**
   * Request media library permissions
   * Call this before accessing gallery
   */
  async requestMediaLibraryPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting media library permissions:', error);
      return false;
    }
  }

  /**
   * Launch camera to capture a photo
   * @returns URI of captured image or null if cancelled
   */
  async capturePhoto(): Promise<string | null> {
    try {
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        console.warn('Camera permission not granted');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1, // Maximum quality for original
        exif: true, // Include GPS data
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      return result.assets[0].uri;
    } catch (error) {
      console.error('Error capturing photo:', error);
      return null;
    }
  }

  /**
   * Pick image from gallery
   * @returns URI of selected image or null if cancelled
   */
  async pickImage(): Promise<string | null> {
    try {
      const hasPermission = await this.requestMediaLibraryPermissions();
      if (!hasPermission) {
        console.warn('Media library permission not granted');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        exif: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      return result.assets[0].uri;
    } catch (error) {
      console.error('Error picking image:', error);
      return null;
    }
  }

  /**
   * Compress image to very low quality for slow networks
   * Target: ~50KB or less
   * 
   * @param uri - Original image URI
   * @returns Compressed image details
   */
  async compressToLowQuality(uri: string): Promise<ImageCompressionResult> {
    try {
      console.log('🖼️ Compressing image to low quality...');

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 480 } }, // Small width for preview
        ],
        {
          compress: 0.3, // Very low quality
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const file = new File(manipulatedImage.uri);
      const size = (await file.size) || 0;

      console.log(`✓ Low quality image: ${(size / 1024).toFixed(2)} KB`);

      return {
        uri: manipulatedImage.uri,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        size,
        quality: 'low',
      };
    } catch (error) {
      console.error('Error compressing to low quality:', error);
      throw error;
    }
  }

  /**
   * Compress image to high quality for good networks
   * Target: ~500KB-1MB, good visual quality
   * 
   * @param uri - Original image URI
   * @returns Compressed image details
   */
  async compressToHighQuality(uri: string): Promise<ImageCompressionResult> {
    try {
      console.log('🖼️ Compressing image to high quality...');

      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1920 } }, // HD width
        ],
        {
          compress: 0.8, // High quality
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const file = new File(manipulatedImage.uri);
      const size = (await file.size) || 0;

      console.log(`✓ High quality image: ${(size / 1024).toFixed(2)} KB`);

      return {
        uri: manipulatedImage.uri,
        width: manipulatedImage.width,
        height: manipulatedImage.height,
        size,
        quality: 'high',
      };
    } catch (error) {
      console.error('Error compressing to high quality:', error);
      throw error;
    }
  }

  /**
   * Save image to permanent local storage
   * Moves image from temp location to app's document directory
   * 
   * @param sourceUri - Temporary image URI
   * @param incidentId - Unique incident ID to name the file
   * @param quality - Image quality level
   * @returns Permanent local file URI
   */
  async saveImageLocally(
    sourceUri: string,
    incidentId: string,
    quality: 'original' | 'low' | 'high'
  ): Promise<string> {
    try {
      const directory = new Directory(Paths.document, 'incident-images');
      
      // Create directory if it doesn't exist
      if (!directory.exists) {
        await directory.create();
      }

      const filename = `${incidentId}_${quality}.jpg`;
      const destinationFile = new File(directory, filename);

      // Read source and write to destination
      const sourceFile = new File(sourceUri);
      const content = await sourceFile.base64();
      await destinationFile.write(content, { encoding: 'base64' });

      console.log(`✓ Image saved locally: ${quality} - ${filename}`);
      return destinationFile.uri;
    } catch (error) {
      console.error('Error saving image locally:', error);
      throw error;
    }
  }

  /**
   * Delete local image file
   * @param uri - Local file URI to delete
   */
  async deleteLocalImage(uri: string): Promise<void> {
    try {
      const file = new File(uri);
      if (file.exists) {
        await file.delete();
        console.log('✓ Local image deleted');
      }
    } catch (error) {
      console.error('Error deleting local image:', error);
      // Don't throw - image deletion failure shouldn't break the app
    }
  }

  /**
   * Get file size of an image
   * @param uri - Image URI
   * @returns Size in bytes
   */
  async getImageSize(uri: string): Promise<number> {
    try {
      const file = new File(uri);
      return (await file.size) || 0;
    } catch (error) {
      console.error('Error getting image size:', error);
      return 0;
    }
  }

  /**
   * Check if image exists locally
   * @param uri - Local file URI
   * @returns true if file exists
   */
  async imageExists(uri: string): Promise<boolean> {
    try {
      const file = new File(uri);
      return file.exists;
    } catch (error) {
      return false;
    }
  }
}

// Singleton export
export const imageService = ImageService.getInstance();
