/**
 * Location utilities for capturing GPS coordinates with photos
 */

import * as Location from 'expo-location';
import { GeoLocation } from '../types';

// Cache permission status
let permissionStatus: Location.PermissionStatus | null = null;

/**
 * Request location permissions
 * Returns true if granted
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    permissionStatus = status;
    return status === 'granted';
  } catch (error) {
    if (__DEV__) console.warn('Location permission error:', error);
    return false;
  }
}

/**
 * Check if we have location permission
 */
export async function hasLocationPermission(): Promise<boolean> {
  if (permissionStatus === 'granted') return true;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    permissionStatus = status;
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Get current location
 * Returns null if permission denied or error
 * In DEV mode on emulator, falls back to a simulated location
 */
export async function getCurrentLocation(): Promise<GeoLocation | null> {
  try {
    // Check permission first
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        // DEV fallback: use simulated location if permission denied (common on emulator)
        if (__DEV__) {
          console.log('Location permission denied, using simulated location for dev');
          return {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 100,
          };
        }
        return null;
      }
    }

    // Get location with balanced accuracy and timeout
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (location) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
      };
    }

    // DEV fallback: use simulated location if getCurrentPosition timed out or failed
    if (__DEV__) {
      console.log('Location timed out, using simulated location for dev');
      return {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 100,
      };
    }
    return null;
  } catch (error) {
    if (__DEV__) {
      console.warn('Error getting location:', error);
      console.log('Using simulated location for dev');
      return {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 100,
      };
    }
    return null;
  }
}

/**
 * Get place name from coordinates (reverse geocoding)
 */
export async function getPlaceName(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (!place) return null;

    // Build readable place name
    const parts: string[] = [];

    if (place.name && place.name !== place.street) {
      parts.push(place.name);
    }
    if (place.street) {
      parts.push(place.street);
    }
    if (place.city || place.subregion) {
      parts.push(place.city || place.subregion || '');
    }

    return parts.slice(0, 2).join(', ') || place.region || null;
  } catch (error) {
    if (__DEV__) console.warn('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Get location with place name
 */
export async function getLocationWithPlace(): Promise<GeoLocation | null> {
  const location = await getCurrentLocation();
  if (!location) return null;

  const placeName = await getPlaceName(location.latitude, location.longitude);

  return {
    ...location,
    placeName: placeName ?? undefined,
  };
}

/**
 * Calculate distance between two points in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get initial map region from an array of coordinates
 */
export function getRegionForCoordinates(
  coordinates: { latitude: number; longitude: number }[]
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  // Default region (centered on user's general area or Tokyo)
  const DEFAULT_REGION = {
    latitude: 35.6762,
    longitude: 139.6503,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  // Filter out invalid coordinates
  const validCoords = coordinates.filter(coord =>
    coord &&
    typeof coord.latitude === 'number' &&
    typeof coord.longitude === 'number' &&
    !isNaN(coord.latitude) &&
    !isNaN(coord.longitude) &&
    Math.abs(coord.latitude) <= 90 &&
    Math.abs(coord.longitude) <= 180
  );

  if (validCoords.length === 0) {
    return DEFAULT_REGION;
  }

  if (validCoords.length === 1) {
    return {
      latitude: validCoords[0].latitude,
      longitude: validCoords[0].longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  // Find bounds
  let minLat = validCoords[0].latitude;
  let maxLat = validCoords[0].latitude;
  let minLng = validCoords[0].longitude;
  let maxLng = validCoords[0].longitude;

  validCoords.forEach(coord => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  // Calculate deltas with padding, but clamp to valid range
  let latDelta = (maxLat - minLat) * 1.5 || 0.02;
  let lngDelta = (maxLng - minLng) * 1.5 || 0.02;

  // Clamp deltas to valid ranges (max 180 for lat, 360 for lng, but use smaller practical values)
  latDelta = Math.min(Math.max(latDelta, 0.01), 90);
  lngDelta = Math.min(Math.max(lngDelta, 0.01), 180);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}
