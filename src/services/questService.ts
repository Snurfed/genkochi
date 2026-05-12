/**
 * Quest Service - Generates landmark quests based on user location
 * Uses Apple MapKit search via expo-location for nearby POI discovery
 */

import * as Location from 'expo-location';
import { LandmarkQuest, QuestCategory, QUEST_CATEGORIES } from '../types';
import { calculateDistance } from '../utils/location';

// Quest completion radius in meters
export const QUEST_RADIUS_METERS = 50;

// Maximum quests to show at once
const MAX_ACTIVE_QUESTS = 3;

// Search radius for POIs in meters
const SEARCH_RADIUS_METERS = 2000;

// XP bonus ranges by distance
const XP_BONUS_RANGES = [
  { maxDistance: 200, xp: 25 },
  { maxDistance: 500, xp: 50 },
  { maxDistance: 1000, xp: 75 },
  { maxDistance: 2000, xp: 100 },
];

// Map Apple/Google place types to our categories
const PLACE_TYPE_MAP: Record<string, QuestCategory> = {
  // Cafes
  'cafe': 'cafe',
  'coffee': 'cafe',
  'bakery': 'cafe',

  // Restaurants
  'restaurant': 'restaurant',
  'food': 'restaurant',
  'bar': 'restaurant',

  // Parks
  'park': 'park',
  'garden': 'park',
  'playground': 'park',
  'beach': 'park',

  // Museums
  'museum': 'museum',
  'gallery': 'museum',
  'art': 'museum',

  // Shops
  'store': 'shop',
  'shop': 'shop',
  'mall': 'shop',
  'market': 'shop',

  // Libraries
  'library': 'library',
  'bookstore': 'library',

  // Gyms
  'gym': 'gym',
  'fitness': 'gym',
  'sports': 'gym',

  // Stations
  'station': 'station',
  'transit': 'station',
  'subway': 'station',
  'bus': 'station',

  // Landmarks (catch-all for notable places)
  'landmark': 'landmark',
  'monument': 'landmark',
  'church': 'landmark',
  'temple': 'landmark',
  'hotel': 'landmark',
  'hospital': 'landmark',
  'school': 'landmark',
  'university': 'landmark',
};

/**
 * Generate vocabulary preview based on category
 */
function getVocabPreview(category: QuestCategory): string[] {
  const themes = QUEST_CATEGORIES[category].vocabThemes;
  return themes.slice(0, 3);
}

/**
 * Calculate XP bonus based on distance
 */
function calculateXPBonus(distanceMeters: number): number {
  for (const range of XP_BONUS_RANGES) {
    if (distanceMeters <= range.maxDistance) {
      return range.xp;
    }
  }
  return XP_BONUS_RANGES[XP_BONUS_RANGES.length - 1].xp;
}

/**
 * Detect category from place name
 */
function detectCategory(name: string, placeType?: string): QuestCategory {
  const nameLower = name.toLowerCase();

  // Check place type first if available
  if (placeType) {
    const typeLower = placeType.toLowerCase();
    for (const [key, category] of Object.entries(PLACE_TYPE_MAP)) {
      if (typeLower.includes(key)) {
        return category;
      }
    }
  }

  // Check name for keywords
  for (const [key, category] of Object.entries(PLACE_TYPE_MAP)) {
    if (nameLower.includes(key)) {
      return category;
    }
  }

  // Default to landmark
  return 'landmark';
}

/**
 * Forward geocode a place name to get its canonical/accessible coordinates
 * This ensures geographic features like bays return shoreline coordinates
 */
async function forwardGeocode(
  placeName: string,
  nearLatitude: number,
  nearLongitude: number
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const results = await Location.geocodeAsync(placeName);

    if (results.length > 0) {
      // Find the result closest to the user's area
      let bestResult = results[0];
      let bestDistance = calculateDistance(
        nearLatitude, nearLongitude,
        results[0].latitude, results[0].longitude
      );

      for (const result of results) {
        const dist = calculateDistance(
          nearLatitude, nearLongitude,
          result.latitude, result.longitude
        );
        if (dist < bestDistance) {
          bestDistance = dist;
          bestResult = result;
        }
      }

      // Only use if within reasonable distance (10km) to avoid wrong matches
      if (bestDistance <= 10) {
        return {
          latitude: bestResult.latitude,
          longitude: bestResult.longitude,
        };
      }
    }
  } catch (error) {
    if (__DEV__) console.log('[QuestService] Forward geocode failed for:', placeName, error);
  }
  return null;
}

/**
 * Search for nearby places using expo-location geocoding
 * This uses Apple MapKit on iOS which provides POI data
 * After finding place names, forward geocodes to get accessible coordinates
 */
async function searchNearbyPlaces(
  latitude: number,
  longitude: number
): Promise<Array<{
  name: string;
  latitude: number;
  longitude: number;
  category: QuestCategory;
  distance: number;
}>> {
  const places: Array<{
    name: string;
    latitude: number;
    longitude: number;
    category: QuestCategory;
    distance: number;
  }> = [];

  // Search in different directions around the user
  const searchOffsets = [
    { lat: 0.005, lng: 0 },      // North
    { lat: -0.005, lng: 0 },     // South
    { lat: 0, lng: 0.005 },      // East
    { lat: 0, lng: -0.005 },     // West
    { lat: 0.003, lng: 0.003 },  // NE
    { lat: -0.003, lng: 0.003 }, // SE
    { lat: 0.003, lng: -0.003 }, // NW
    { lat: -0.003, lng: -0.003 },// SW
  ];

  // Collect discovered place names first
  const discoveredPlaces: Array<{
    name: string;
    fallbackLat: number;
    fallbackLng: number;
    category: QuestCategory;
  }> = [];

  try {
    for (const offset of searchOffsets) {
      const searchLat = latitude + offset.lat;
      const searchLng = longitude + offset.lng;

      // Reverse geocode to get place info
      const results = await Location.reverseGeocodeAsync({
        latitude: searchLat,
        longitude: searchLng,
      });

      if (results.length > 0) {
        const place = results[0];
        const name = place.name || place.street || place.district;

        if (name && name.length > 2) {
          const category = detectCategory(name, place.streetNumber ?? undefined);

          // Avoid duplicates by name
          const exists = discoveredPlaces.some(p => p.name === name);

          if (!exists) {
            discoveredPlaces.push({
              name,
              fallbackLat: searchLat,
              fallbackLng: searchLng,
              category,
            });
          }
        }
      }
    }

    // Now forward geocode each place to get accessible coordinates
    for (const discovered of discoveredPlaces) {
      // Forward geocode to get canonical coordinates (e.g., shoreline for bays)
      const canonical = await forwardGeocode(discovered.name, latitude, longitude);

      // Use canonical coordinates if found, otherwise use fallback
      const placeLat = canonical?.latitude ?? discovered.fallbackLat;
      const placeLng = canonical?.longitude ?? discovered.fallbackLng;

      const distance = calculateDistance(
        latitude, longitude,
        placeLat, placeLng
      ) * 1000; // Convert km to meters

      // Only include places within search radius
      if (distance <= SEARCH_RADIUS_METERS) {
        // Avoid coordinate duplicates
        const coordExists = places.some(p =>
          Math.abs(p.latitude - placeLat) < 0.0001 &&
          Math.abs(p.longitude - placeLng) < 0.0001
        );

        if (!coordExists) {
          places.push({
            name: discovered.name,
            latitude: placeLat,
            longitude: placeLng,
            category: discovered.category,
            distance,
          });
        }
      }
    }
  } catch (error) {
    if (__DEV__) console.log('[QuestService] Error searching places:', error);
  }

  // Sort by distance and take closest ones
  return places.sort((a, b) => a.distance - b.distance).slice(0, 10);
}

/**
 * Generate inspiring quest names based on category and location
 */
function generateQuestName(placeName: string, category: QuestCategory): string {
  const categoryInfo = QUEST_CATEGORIES[category];

  // Check if it's just a street address (numbers + street type)
  const isStreetAddress = /^\d+\s+\w+(\s+(St|Street|Ave|Avenue|Blvd|Rd|Road|Dr|Drive|Way|Ln|Lane|Pl|Place))?\.?$/i.test(placeName);

  // Check if it's too short or just numbers
  const isGeneric = placeName.length < 5 || /^[0-9\s]+$/.test(placeName);

  if (isStreetAddress || isGeneric) {
    // Generate a more inspiring name based on category
    const categoryNames: Record<QuestCategory, string[]> = {
      cafe: ['Coffee Corner', 'Café Discovery', 'Local Brew Spot'],
      restaurant: ['Foodie Find', 'Culinary Quest', 'Dining Discovery'],
      park: ['Green Oasis', 'Nature Spot', 'Outdoor Explorer'],
      museum: ['Culture Quest', 'Art Discovery', 'Museum Mile'],
      shop: ['Shopping District', 'Retail Row', 'Market Find'],
      landmark: ['Local Landmark', 'Hidden Gem', 'Discovery Point'],
      library: ['Knowledge Quest', 'Book Haven', 'Library Lane'],
      gym: ['Fitness Find', 'Active Zone', 'Wellness Walk'],
      station: ['Transit Hub', 'Station Stop', 'Commuter Quest'],
    };

    const names = categoryNames[category];
    return names[Math.floor(Math.random() * names.length)];
  }

  // If it's a real place name, make it more quest-like
  // Remove "The " prefix if present
  let cleanName = placeName.replace(/^The\s+/i, '');

  // Truncate long names
  if (cleanName.length > 25) {
    cleanName = cleanName.substring(0, 22) + '...';
  }

  return cleanName;
}

/**
 * Generate quests based on current location
 */
export async function generateNearbyQuests(
  latitude: number,
  longitude: number,
  completedQuestIds: string[] = []
): Promise<LandmarkQuest[]> {
  if (__DEV__) console.log('[QuestService] Generating quests near:', latitude, longitude);

  const nearbyPlaces = await searchNearbyPlaces(latitude, longitude);
  if (__DEV__) console.log('[QuestService] Found', nearbyPlaces.length, 'nearby places');

  const quests: LandmarkQuest[] = [];
  const usedCategories = new Set<QuestCategory>();

  for (const place of nearbyPlaces) {
    // Skip if already at max quests
    if (quests.length >= MAX_ACTIVE_QUESTS) break;

    // Skip if already completed this location
    const questId = `quest-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
    if (completedQuestIds.includes(questId)) continue;

    // Try to get variety in categories
    if (usedCategories.has(place.category) && quests.length > 0) {
      // Skip if we already have this category (unless it's the only option)
      const remainingPlaces = nearbyPlaces.length - nearbyPlaces.indexOf(place);
      if (remainingPlaces > MAX_ACTIVE_QUESTS - quests.length) {
        continue;
      }
    }

    const categoryInfo = QUEST_CATEGORIES[place.category];
    const xpBonus = calculateXPBonus(place.distance);

    quests.push({
      id: questId,
      name: generateQuestName(place.name, place.category),
      category: place.category,
      coordinates: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
      distanceMeters: Math.round(place.distance),
      vocabularyTheme: categoryInfo.vocabThemes[0],
      vocabularyPreview: getVocabPreview(place.category),
      xpBonus,
      isCompleted: false,
    });

    usedCategories.add(place.category);
  }

  // If we couldn't find enough real places, generate generic nearby quests
  if (quests.length < MAX_ACTIVE_QUESTS) {
    const categories: QuestCategory[] = ['cafe', 'park', 'shop', 'restaurant', 'landmark'];

    for (const category of categories) {
      if (quests.length >= MAX_ACTIVE_QUESTS) break;
      if (usedCategories.has(category)) continue;

      // Generate a point in a random direction
      const angle = Math.random() * 2 * Math.PI;
      const distance = 300 + Math.random() * 700; // 300-1000m
      const offsetLat = (distance / 111000) * Math.cos(angle);
      const offsetLng = (distance / (111000 * Math.cos(latitude * Math.PI / 180))) * Math.sin(angle);

      const categoryInfo = QUEST_CATEGORIES[category];

      quests.push({
        id: `quest-explore-${category}-${Date.now()}`,
        name: `Find a ${categoryInfo.label}`,
        category,
        coordinates: {
          latitude: latitude + offsetLat,
          longitude: longitude + offsetLng,
        },
        distanceMeters: Math.round(distance),
        vocabularyTheme: categoryInfo.vocabThemes[0],
        vocabularyPreview: getVocabPreview(category),
        xpBonus: calculateXPBonus(distance),
        isCompleted: false,
      });

      usedCategories.add(category);
    }
  }

  if (__DEV__) console.log('[QuestService] Generated', quests.length, 'quests');
  return quests;
}

/**
 * Check if user is within completion radius of a quest
 */
export function isNearQuest(
  userLat: number,
  userLng: number,
  quest: LandmarkQuest
): boolean {
  const distance = calculateDistance(
    userLat, userLng,
    quest.coordinates.latitude, quest.coordinates.longitude
  ) * 1000; // km to meters

  return distance <= QUEST_RADIUS_METERS;
}

/**
 * Find quest that user is currently near
 */
export function findNearbyQuest(
  userLat: number,
  userLng: number,
  quests: LandmarkQuest[]
): LandmarkQuest | null {
  for (const quest of quests) {
    if (!quest.isCompleted && isNearQuest(userLat, userLng, quest)) {
      return quest;
    }
  }
  return null;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
