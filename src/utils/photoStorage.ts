import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const PHOTOS_SUBDIR = 'photos/';
const THUMBNAIL_SIZE = 80; // Size for map marker thumbnails

/**
 * Get the current photos directory path
 */
export function getPhotosDir(): string {
  return `${FileSystem.documentDirectory}${PHOTOS_SUBDIR}`;
}

/**
 * Resolve a stored image URI to an absolute path
 * Handles both old absolute paths and new relative paths
 *
 * iOS changes documentDirectory path on app updates, so we store
 * relative paths and resolve them at display time.
 */
export function resolveImageUri(storedUri: string): string {
  if (!storedUri) return '';

  // Data URIs and http URLs don't need resolution
  if (storedUri.startsWith('data:') || storedUri.startsWith('http')) {
    return storedUri;
  }

  // Check if it's an old absolute path that needs fixing
  // Old format: file:///var/mobile/.../Documents/photos/photo_123.jpg
  if (storedUri.includes('/Documents/photos/photo_') || storedUri.includes('/documents/photos/photo_')) {
    const match = storedUri.match(/photo_[^/]+\.jpg$/);
    if (match) {
      const resolved = `${getPhotosDir()}${match[0]}`;
      return resolved;
    }
  }

  // If starts with file:// but not our photos dir, return as-is
  if (storedUri.startsWith('file://')) {
    return storedUri;
  }

  // Relative path (e.g., "photos/photo_123.jpg" or just "photo_123.jpg")
  const filename = storedUri.replace(/^photos\//, '');
  return `${getPhotosDir()}${filename}`;
}

/**
 * Convert absolute path to relative for storage
 */
export function toRelativePath(absoluteUri: string): string {
  const match = absoluteUri.match(/(photo_[^/]+\.jpg)$/);
  if (match) {
    return `photos/${match[1]}`;
  }
  return absoluteUri;
}

/**
 * Check if a photo file exists
 */
export async function photoExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    const resolved = resolveImageUri(uri);
    const info = await FileSystem.getInfoAsync(resolved);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Get the thumbnail path for a photo
 */
export function getThumbnailPath(photoUri: string): string {
  if (!photoUri) return '';
  // Convert photo_123.jpg to photo_123_thumb.png
  const resolved = resolveImageUri(photoUri);
  return resolved.replace(/\.jpg$/, '_thumb.png');
}

/**
 * Get relative thumbnail path for storage
 */
export function getThumbnailRelativePath(photoUri: string): string {
  const match = photoUri.match(/(photo_[^/]+)\.jpg$/);
  if (match) {
    return `photos/${match[1]}_thumb.png`;
  }
  return '';
}

/**
 * Generate a small square thumbnail for map markers (Android)
 * Returns the thumbnail URI or null if failed
 */
export async function generateThumbnail(photoUri: string): Promise<string | null> {
  // Only needed on Android - iOS handles circular clipping natively
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    const resolved = resolveImageUri(photoUri);

    // Check if source exists
    const sourceInfo = await FileSystem.getInfoAsync(resolved);
    if (!sourceInfo.exists) {
      if (__DEV__) console.log('Thumbnail source not found:', resolved);
      return null;
    }

    // Resize to small square
    const result = await ImageManipulator.manipulateAsync(
      resolved,
      [
        { resize: { width: THUMBNAIL_SIZE * 2, height: THUMBNAIL_SIZE * 2 } },
      ],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.PNG,
      }
    );

    // Save to photos directory with _thumb suffix
    const thumbPath = getThumbnailPath(photoUri);

    // Ensure photos directory exists
    const dirInfo = await FileSystem.getInfoAsync(getPhotosDir());
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(getPhotosDir(), { intermediates: true });
    }

    // Move temp file to final location
    await FileSystem.moveAsync({
      from: result.uri,
      to: thumbPath,
    });

    if (__DEV__) console.log('Generated thumbnail:', thumbPath);
    return thumbPath;
  } catch (error) {
    if (__DEV__) console.warn('Failed to generate thumbnail:', error);
    return null;
  }
}

/**
 * Check if thumbnail exists for a photo
 */
export async function thumbnailExists(photoUri: string): Promise<boolean> {
  if (!photoUri || Platform.OS !== 'android') return false;
  try {
    const thumbPath = getThumbnailPath(photoUri);
    const info = await FileSystem.getInfoAsync(thumbPath);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Generate thumbnails for photos that don't have them (migration)
 */
export async function generateMissingThumbnails(photoUris: string[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  for (const uri of photoUris) {
    const hasThumb = await thumbnailExists(uri);
    if (!hasThumb) {
      await generateThumbnail(uri);
    }
  }
}
