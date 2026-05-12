// Types for PhotoLingo - Japanese Literacy Learning App

// ============================================
// LANDMARK QUEST SYSTEM
// ============================================

export type QuestCategory =
  | 'cafe'
  | 'restaurant'
  | 'park'
  | 'museum'
  | 'shop'
  | 'landmark'
  | 'library'
  | 'gym'
  | 'station';

export interface LandmarkQuest {
  id: string;
  name: string;
  category: QuestCategory;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  distanceMeters: number;
  vocabularyTheme: string;
  vocabularyPreview: string[];
  xpBonus: number;
  isCompleted: boolean;
  completedAt?: number;
  photoLessonId?: string;
}

export interface QuestProgress {
  totalCompleted: number;
  currentQuests: LandmarkQuest[];
  completedQuests: LandmarkQuest[];
  lastRefreshed: number;
}

// Quest category metadata for UI and vocabulary
export const QUEST_CATEGORIES: Record<QuestCategory, {
  emoji: string;
  label: string;
  vocabThemes: string[];
}> = {
  cafe: {
    emoji: '☕',
    label: 'Café',
    vocabThemes: ['coffee', 'drinks', 'pastries', 'ordering'],
  },
  restaurant: {
    emoji: '🍽️',
    label: 'Restaurant',
    vocabThemes: ['food', 'dining', 'menu items', 'flavors'],
  },
  park: {
    emoji: '🌳',
    label: 'Park',
    vocabThemes: ['nature', 'plants', 'outdoor activities', 'weather'],
  },
  museum: {
    emoji: '🏛️',
    label: 'Museum',
    vocabThemes: ['art', 'history', 'culture', 'exhibits'],
  },
  shop: {
    emoji: '🛍️',
    label: 'Shop',
    vocabThemes: ['shopping', 'clothing', 'prices', 'colors'],
  },
  landmark: {
    emoji: '📍',
    label: 'Landmark',
    vocabThemes: ['architecture', 'tourism', 'directions', 'city'],
  },
  library: {
    emoji: '📚',
    label: 'Library',
    vocabThemes: ['books', 'reading', 'studying', 'knowledge'],
  },
  gym: {
    emoji: '💪',
    label: 'Gym',
    vocabThemes: ['exercise', 'sports', 'body parts', 'health'],
  },
  station: {
    emoji: '🚉',
    label: 'Station',
    vocabThemes: ['transportation', 'travel', 'tickets', 'directions'],
  },
};

// ============================================
// MEMORY PATH SYSTEM (Gamified Map)
// ============================================

export interface MemorySpot {
  id: string;
  lessonId: string;
  imageUri: string;
  mainWord: {
    japanese: string;
    english: string;  // Legacy - kept for backward compatibility
    reading?: string;
    nativeTranslation?: string;  // Translation in user's native language
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  unlockedAt: number; // timestamp when quiz was passed
  quizScore: number; // percentage score on quiz
}

export interface MemoryPath {
  id: string;
  fromSpotId: string;
  toSpotId: string;
  distanceMiles: number;
  distanceSteps: number; // ~2000 steps per mile
  createdAt: number;
}

export interface MemoryPathStats {
  totalMileage: number;
  totalSteps: number;
  spotsUnlocked: number;
  longestPath: number; // longest single connection
  citiesVisited: string[]; // unique place names
}

// Lost memory - when a memory fully fades without review
export interface LostMemory {
  id: string;
  lessonId: string;
  wordId: string;
  japanese: string;
  english: string;
  reading?: string;
  imageUri: string;
  lostAt: string; // ISO timestamp
  previousMasteryScore: number;
}

// ============================================
// MEMORY WORLDS SYSTEM
// ============================================

export type WorldType = 'terra' | 'luna' | 'nova' | 'celestia' | 'aurora' | 'solaris';

export type PlacementLayer = 'sky' | 'back' | 'middle' | 'front' | 'ground';

export type ObjectCategory =
  | 'furniture'   // chairs, tables, beds
  | 'nature'      // trees, flowers, plants
  | 'food'        // dishes, drinks, snacks
  | 'animal'      // pets, wildlife
  | 'vehicle'     // cars, bikes, trains
  | 'electronic'  // phones, computers, TVs
  | 'clothing'    // clothes, accessories
  | 'building'    // houses, shops, structures
  | 'sky'         // clouds, birds, kites
  | 'other';

export interface WorldTheme {
  id: WorldType;
  name: string;
  emoji: string;
  groundTexture: string;      // 'wood' | 'grass' | 'tiles' | 'concrete'
  ambientColor: string;       // Primary ambient light color
  accentColor: string;        // Glow/highlight color
  backgroundColor: string;    // Sky/background color
}

// Planet names for worlds - each planet can hold up to 20 photos
export const PLANET_NAMES = [
  'Terra', 'Luna', 'Nova', 'Celestia', 'Aurora', 'Solaris',
  'Nebula', 'Astra', 'Cosmos', 'Orion', 'Vega', 'Lyra',
  'Andromeda', 'Phoenix', 'Atlas', 'Titan', 'Europa', 'Io',
];

export const WORLD_THEMES: WorldTheme[] = [
  {
    id: 'terra',
    name: 'Terra',
    emoji: '🌍',
    groundTexture: 'grass',
    ambientColor: '#DBEAFE',   // Earth blue
    accentColor: '#3B82F6',
    backgroundColor: '#0B1628'  // Deep space blue
  },
  {
    id: 'luna',
    name: 'Luna',
    emoji: '🌙',
    groundTexture: 'stone',
    ambientColor: '#E0E7FF',   // Cool silver
    accentColor: '#8B5CF6',
    backgroundColor: '#0B1628'
  },
  {
    id: 'nova',
    name: 'Nova',
    emoji: '✨',
    groundTexture: 'crystal',
    ambientColor: '#FEF3C7',   // Warm gold
    accentColor: '#F59E0B',
    backgroundColor: '#0B1628'
  },
  {
    id: 'celestia',
    name: 'Celestia',
    emoji: '🪐',
    groundTexture: 'tiles',
    ambientColor: '#FCE7F3',   // Pink nebula
    accentColor: '#EC4899',
    backgroundColor: '#0B1628'
  },
  {
    id: 'aurora',
    name: 'Aurora',
    emoji: '🌌',
    groundTexture: 'grass',
    ambientColor: '#D1FAE5',   // Northern lights green
    accentColor: '#10B981',
    backgroundColor: '#0B1628'
  },
  {
    id: 'solaris',
    name: 'Solaris',
    emoji: '☀️',
    groundTexture: 'sand',
    ambientColor: '#FEE2E2',   // Warm solar
    accentColor: '#EF4444',
    backgroundColor: '#0B1628'
  },
];

export const MAX_OBJECTS_PER_WORLD = 20;

export interface PlacementPosition {
  x: number;              // 0-100 percentage from left
  y: number;              // 0-100 percentage from top
  scale: number;          // Size multiplier (0.5-1.5)
  layer: PlacementLayer;
  zIndex: number;
}

export interface WorldObject {
  id: string;
  wordId: string;         // Links to Word type

  // Visual representation
  emoji: string;          // Display emoji for the object
  displayName: string;    // Target language word
  english: string;        // Legacy - kept for backward compatibility
  reading?: string;       // Reading/pronunciation
  nativeTranslation?: string;  // Translation in user's native language

  // Descriptors (adjectives/context)
  descriptors?: WorldObjectDescriptor[];

  // Placement (for globe view - legacy)
  position: PlacementPosition;
  category: ObjectCategory;

  // GPS Location (for map view)
  coordinates?: {
    latitude: number;
    longitude: number;
  };

  // Source
  photoUri?: string;      // Original photo this came from
  lessonId?: string;      // Original lesson ID

  // Mastery (synced from Word)
  masteryScore: number;
  lastReviewed?: string;
  needsReview: boolean;

  // Animation state
  isNew: boolean;         // Just added (for entry animation)
  addedAt: string;
}

// Descriptor for WorldObject (same structure as WordDescriptor)
export interface WorldObjectDescriptor {
  english: string;  // Legacy - kept for backward compatibility
  japanese: string; // Target language
  reading: string;  // Reading/pronunciation
  nativeTranslation?: string;  // Translation in user's native language
}

export interface MemoryWorld {
  id: string;
  type: WorldType;
  name: string;

  // Objects in this world
  objects: WorldObject[];

  // Progression
  stage: 'empty' | 'growing' | 'rich' | 'flourishing';
  objectCount: number;
  masteredCount: number;

  // Stats
  totalXPEarned: number;
  lastVisited?: string;
  createdAt: string;

  // Customization (future)
  unlocked: boolean;
}

// Placement rules for each category
export const PLACEMENT_RULES: Record<ObjectCategory, {
  preferredLayers: PlacementLayer[];
  grounded: boolean;
  canFloat: boolean;
  animated: boolean;
  scaleRange: [number, number];
}> = {
  furniture: { preferredLayers: ['middle', 'front'], grounded: true, canFloat: false, animated: false, scaleRange: [0.8, 1.2] },
  nature: { preferredLayers: ['back', 'middle'], grounded: true, canFloat: false, animated: true, scaleRange: [0.6, 1.4] },
  food: { preferredLayers: ['front'], grounded: true, canFloat: false, animated: false, scaleRange: [0.6, 1.0] },
  animal: { preferredLayers: ['middle', 'front'], grounded: true, canFloat: false, animated: true, scaleRange: [0.5, 1.2] },
  vehicle: { preferredLayers: ['middle', 'back'], grounded: true, canFloat: false, animated: true, scaleRange: [0.7, 1.3] },
  electronic: { preferredLayers: ['front', 'middle'], grounded: true, canFloat: false, animated: false, scaleRange: [0.5, 0.9] },
  clothing: { preferredLayers: ['front'], grounded: false, canFloat: true, animated: false, scaleRange: [0.4, 0.8] },
  building: { preferredLayers: ['back'], grounded: true, canFloat: false, animated: false, scaleRange: [1.0, 1.5] },
  sky: { preferredLayers: ['sky'], grounded: false, canFloat: true, animated: true, scaleRange: [0.3, 0.8] },
  other: { preferredLayers: ['middle'], grounded: true, canFloat: false, animated: false, scaleRange: [0.6, 1.0] },
};

// Object emoji mappings for common words
export const OBJECT_EMOJI_MAP: Record<string, { emoji: string; category: ObjectCategory }> = {
  // Furniture & Home
  'chair': { emoji: '🪑', category: 'furniture' },
  'table': { emoji: '🪵', category: 'furniture' },
  'desk': { emoji: '🪑', category: 'furniture' },
  'bed': { emoji: '🛏️', category: 'furniture' },
  'sofa': { emoji: '🛋️', category: 'furniture' },
  'couch': { emoji: '🛋️', category: 'furniture' },
  'lamp': { emoji: '💡', category: 'furniture' },
  'light': { emoji: '💡', category: 'furniture' },
  'mirror': { emoji: '🪞', category: 'furniture' },
  'shelf': { emoji: '📚', category: 'furniture' },
  'pillow': { emoji: '🛏️', category: 'furniture' },
  'blanket': { emoji: '🛏️', category: 'furniture' },
  'curtain': { emoji: '🪟', category: 'furniture' },
  'rug': { emoji: '🟫', category: 'furniture' },
  'carpet': { emoji: '🟫', category: 'furniture' },

  // Nature & Outdoors
  'tree': { emoji: '🌳', category: 'nature' },
  'flower': { emoji: '🌸', category: 'nature' },
  'plant': { emoji: '🪴', category: 'nature' },
  'grass': { emoji: '🌿', category: 'nature' },
  'leaf': { emoji: '🍃', category: 'nature' },
  'mountain': { emoji: '⛰️', category: 'nature' },
  'river': { emoji: '🏞️', category: 'nature' },
  'lake': { emoji: '🏞️', category: 'nature' },
  'ocean': { emoji: '🌊', category: 'nature' },
  'sea': { emoji: '🌊', category: 'nature' },
  'beach': { emoji: '🏖️', category: 'nature' },
  'forest': { emoji: '🌲', category: 'nature' },
  'rock': { emoji: '🪨', category: 'nature' },
  'stone': { emoji: '🪨', category: 'nature' },
  'sand': { emoji: '🏖️', category: 'nature' },
  'snow': { emoji: '❄️', category: 'nature' },
  'rain': { emoji: '🌧️', category: 'sky' },
  'sun': { emoji: '☀️', category: 'sky' },
  'moon': { emoji: '🌙', category: 'sky' },
  'cloud': { emoji: '☁️', category: 'sky' },
  'star': { emoji: '⭐', category: 'sky' },
  'sky': { emoji: '🌤️', category: 'sky' },
  'rainbow': { emoji: '🌈', category: 'sky' },
  'sunset': { emoji: '🌅', category: 'sky' },
  'sunrise': { emoji: '🌄', category: 'sky' },

  // Food & Drinks
  'coffee': { emoji: '☕', category: 'food' },
  'tea': { emoji: '🍵', category: 'food' },
  'rice': { emoji: '🍚', category: 'food' },
  'sushi': { emoji: '🍣', category: 'food' },
  'ramen': { emoji: '🍜', category: 'food' },
  'noodles': { emoji: '🍜', category: 'food' },
  'bread': { emoji: '🍞', category: 'food' },
  'apple': { emoji: '🍎', category: 'food' },
  'banana': { emoji: '🍌', category: 'food' },
  'orange': { emoji: '🍊', category: 'food' },
  'water': { emoji: '💧', category: 'food' },
  'cake': { emoji: '🍰', category: 'food' },
  'pizza': { emoji: '🍕', category: 'food' },
  'hamburger': { emoji: '🍔', category: 'food' },
  'burger': { emoji: '🍔', category: 'food' },
  'egg': { emoji: '🥚', category: 'food' },
  'meat': { emoji: '🥩', category: 'food' },
  'chicken': { emoji: '🍗', category: 'food' },
  'salad': { emoji: '🥗', category: 'food' },
  'soup': { emoji: '🍲', category: 'food' },
  'ice cream': { emoji: '🍦', category: 'food' },
  'beer': { emoji: '🍺', category: 'food' },
  'wine': { emoji: '🍷', category: 'food' },
  'juice': { emoji: '🧃', category: 'food' },
  'milk': { emoji: '🥛', category: 'food' },
  'fruit': { emoji: '🍇', category: 'food' },
  'vegetable': { emoji: '🥬', category: 'food' },
  'sandwich': { emoji: '🥪', category: 'food' },
  'cookie': { emoji: '🍪', category: 'food' },
  'chocolate': { emoji: '🍫', category: 'food' },
  'candy': { emoji: '🍬', category: 'food' },

  // Animals
  'cat': { emoji: '🐱', category: 'animal' },
  'dog': { emoji: '🐕', category: 'animal' },
  'bird': { emoji: '🐦', category: 'animal' },
  'fish': { emoji: '🐟', category: 'animal' },
  'rabbit': { emoji: '🐰', category: 'animal' },
  'butterfly': { emoji: '🦋', category: 'sky' },
  'horse': { emoji: '🐴', category: 'animal' },
  'cow': { emoji: '🐄', category: 'animal' },
  'pig': { emoji: '🐷', category: 'animal' },
  'sheep': { emoji: '🐑', category: 'animal' },
  'monkey': { emoji: '🐵', category: 'animal' },
  'elephant': { emoji: '🐘', category: 'animal' },
  'lion': { emoji: '🦁', category: 'animal' },
  'tiger': { emoji: '🐯', category: 'animal' },
  'bear': { emoji: '🐻', category: 'animal' },
  'duck': { emoji: '🦆', category: 'animal' },
  'frog': { emoji: '🐸', category: 'animal' },
  'turtle': { emoji: '🐢', category: 'animal' },
  'snake': { emoji: '🐍', category: 'animal' },
  'mouse': { emoji: '🐭', category: 'animal' },
  'insect': { emoji: '🐛', category: 'animal' },
  'bee': { emoji: '🐝', category: 'animal' },
  'spider': { emoji: '🕷️', category: 'animal' },

  // People & Body
  'person': { emoji: '🧑', category: 'other' },
  'man': { emoji: '👨', category: 'other' },
  'woman': { emoji: '👩', category: 'other' },
  'child': { emoji: '🧒', category: 'other' },
  'baby': { emoji: '👶', category: 'other' },
  'family': { emoji: '👨‍👩‍👧', category: 'other' },
  'couple': { emoji: '👫', category: 'other' },
  'hand': { emoji: '✋', category: 'other' },
  'face': { emoji: '😊', category: 'other' },
  'eye': { emoji: '👁️', category: 'other' },

  // Electronics
  'phone': { emoji: '📱', category: 'electronic' },
  'smartphone': { emoji: '📱', category: 'electronic' },
  'computer': { emoji: '💻', category: 'electronic' },
  'laptop': { emoji: '💻', category: 'electronic' },
  'television': { emoji: '📺', category: 'electronic' },
  'tv': { emoji: '📺', category: 'electronic' },
  'camera': { emoji: '📷', category: 'electronic' },
  'clock': { emoji: '🕐', category: 'electronic' },
  'watch': { emoji: '⌚', category: 'electronic' },
  'headphones': { emoji: '🎧', category: 'electronic' },
  'keyboard': { emoji: '⌨️', category: 'electronic' },
  'printer': { emoji: '🖨️', category: 'electronic' },
  'speaker': { emoji: '🔊', category: 'electronic' },
  'microphone': { emoji: '🎤', category: 'electronic' },
  'radio': { emoji: '📻', category: 'electronic' },
  'battery': { emoji: '🔋', category: 'electronic' },

  // Vehicles & Transport
  'car': { emoji: '🚗', category: 'vehicle' },
  'bicycle': { emoji: '🚲', category: 'vehicle' },
  'bike': { emoji: '🚲', category: 'vehicle' },
  'train': { emoji: '🚃', category: 'vehicle' },
  'bus': { emoji: '🚌', category: 'vehicle' },
  'airplane': { emoji: '✈️', category: 'sky' },
  'plane': { emoji: '✈️', category: 'sky' },
  'boat': { emoji: '⛵', category: 'vehicle' },
  'ship': { emoji: '🚢', category: 'vehicle' },
  'motorcycle': { emoji: '🏍️', category: 'vehicle' },
  'taxi': { emoji: '🚕', category: 'vehicle' },
  'truck': { emoji: '🚚', category: 'vehicle' },
  'helicopter': { emoji: '🚁', category: 'sky' },
  'rocket': { emoji: '🚀', category: 'sky' },

  // Buildings & Places
  'house': { emoji: '🏠', category: 'building' },
  'home': { emoji: '🏠', category: 'building' },
  'building': { emoji: '🏢', category: 'building' },
  'office': { emoji: '🏢', category: 'building' },
  'school': { emoji: '🏫', category: 'building' },
  'hospital': { emoji: '🏥', category: 'building' },
  'store': { emoji: '🏪', category: 'building' },
  'shop': { emoji: '🏪', category: 'building' },
  'restaurant': { emoji: '🍽️', category: 'building' },
  'hotel': { emoji: '🏨', category: 'building' },
  'church': { emoji: '⛪', category: 'building' },
  'temple': { emoji: '🛕', category: 'building' },
  'shrine': { emoji: '⛩️', category: 'building' },
  'castle': { emoji: '🏯', category: 'building' },
  'tower': { emoji: '🗼', category: 'building' },
  'bridge': { emoji: '🌉', category: 'building' },
  'door': { emoji: '🚪', category: 'building' },
  'window': { emoji: '🪟', category: 'building' },
  'stairs': { emoji: '🪜', category: 'building' },
  'room': { emoji: '🚪', category: 'building' },
  'kitchen': { emoji: '🍳', category: 'building' },
  'bathroom': { emoji: '🚿', category: 'building' },
  'garden': { emoji: '🌷', category: 'nature' },
  'park': { emoji: '🌳', category: 'nature' },
  'pool': { emoji: '🏊', category: 'nature' },
  'street': { emoji: '🛣️', category: 'other' },
  'road': { emoji: '🛣️', category: 'other' },

  // Clothing & Accessories
  'shirt': { emoji: '👕', category: 'clothing' },
  'pants': { emoji: '👖', category: 'clothing' },
  'dress': { emoji: '👗', category: 'clothing' },
  'shoes': { emoji: '👟', category: 'clothing' },
  'hat': { emoji: '🎩', category: 'clothing' },
  'cap': { emoji: '🧢', category: 'clothing' },
  'glasses': { emoji: '👓', category: 'clothing' },
  'sunglasses': { emoji: '🕶️', category: 'clothing' },
  'bag': { emoji: '👜', category: 'clothing' },
  'backpack': { emoji: '🎒', category: 'clothing' },
  'umbrella': { emoji: '☂️', category: 'other' },
  'ring': { emoji: '💍', category: 'clothing' },
  'necklace': { emoji: '📿', category: 'clothing' },
  'sock': { emoji: '🧦', category: 'clothing' },
  'glove': { emoji: '🧤', category: 'clothing' },
  'scarf': { emoji: '🧣', category: 'clothing' },
  'coat': { emoji: '🧥', category: 'clothing' },
  'jacket': { emoji: '🧥', category: 'clothing' },

  // Objects & Tools
  'book': { emoji: '📚', category: 'other' },
  'pen': { emoji: '🖊️', category: 'other' },
  'pencil': { emoji: '✏️', category: 'other' },
  'paper': { emoji: '📄', category: 'other' },
  'key': { emoji: '🔑', category: 'other' },
  'money': { emoji: '💴', category: 'other' },
  'card': { emoji: '💳', category: 'other' },
  'box': { emoji: '📦', category: 'other' },
  'bottle': { emoji: '🍶', category: 'other' },
  'cup': { emoji: '🥤', category: 'other' },
  'glass': { emoji: '🥛', category: 'other' },
  'plate': { emoji: '🍽️', category: 'other' },
  'bowl': { emoji: '🥣', category: 'other' },
  'knife': { emoji: '🔪', category: 'other' },
  'fork': { emoji: '🍴', category: 'other' },
  'spoon': { emoji: '🥄', category: 'other' },
  'chopsticks': { emoji: '🥢', category: 'other' },
  'scissors': { emoji: '✂️', category: 'other' },
  'hammer': { emoji: '🔨', category: 'other' },
  'tool': { emoji: '🔧', category: 'other' },
  'ball': { emoji: '⚽', category: 'other' },
  'toy': { emoji: '🧸', category: 'other' },
  'gift': { emoji: '🎁', category: 'other' },
  'present': { emoji: '🎁', category: 'other' },
  'flag': { emoji: '🚩', category: 'other' },
  'map': { emoji: '🗺️', category: 'other' },
  'ticket': { emoji: '🎫', category: 'other' },
  'photo': { emoji: '🖼️', category: 'other' },
  'picture': { emoji: '🖼️', category: 'other' },
  'letter': { emoji: '✉️', category: 'other' },
  'mail': { emoji: '📬', category: 'other' },
  'newspaper': { emoji: '📰', category: 'other' },
  'magazine': { emoji: '📰', category: 'other' },
  'calendar': { emoji: '📅', category: 'other' },
  'sign': { emoji: '🪧', category: 'other' },
  'candle': { emoji: '🕯️', category: 'other' },
  'fire': { emoji: '🔥', category: 'other' },
  'snowman': { emoji: '⛄', category: 'nature' },
  'surfboard': { emoji: '🏄', category: 'other' },
};

// Helper to get emoji and category for a word
export const getObjectVisual = (english: string): { emoji: string; category: ObjectCategory } => {
  const normalized = english.toLowerCase().trim();

  // Exact match
  if (OBJECT_EMOJI_MAP[normalized]) {
    return OBJECT_EMOJI_MAP[normalized];
  }

  // Try partial match (word contains key or key contains word)
  for (const [key, value] of Object.entries(OBJECT_EMOJI_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Try matching last word (e.g., "green apple" -> "apple")
  const words = normalized.split(' ');
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (OBJECT_EMOJI_MAP[lastWord]) {
      return OBJECT_EMOJI_MAP[lastWord];
    }
  }

  // Default fallback
  return { emoji: '📦', category: 'other' };
};

// Helper to create a default world
export const createDefaultWorld = (type: WorldType): MemoryWorld => {
  const theme = WORLD_THEMES.find(t => t.id === type) || WORLD_THEMES[0];
  return {
    id: `world-${type}-${Date.now()}`,
    type,
    name: theme.name,
    objects: [],
    stage: 'empty',
    objectCount: 0,
    masteredCount: 0,
    totalXPEarned: 0,
    createdAt: new Date().toISOString(),
    unlocked: type === 'terra', // Only Terra unlocked by default
  };
};

// ============================================
// USER GOAL & PERSONALIZATION
// ============================================

export type LearningGoal = 'travel' | 'culture' | 'connect' | 'work' | 'curiosity';

export interface LearningGoalInfo {
  id: LearningGoal;
  emoji: string;
  title: string;
  subtitle: string;
  phrases: string[]; // Quick phrases relevant to this goal
}

export const LEARNING_GOALS: LearningGoalInfo[] = [
  {
    id: 'travel',
    emoji: '✈️',
    title: 'Travel',
    subtitle: 'Explore new places with confidence',
    phrases: ['Where is the station?', 'How much?', 'One please', 'Check please']
  },
  {
    id: 'culture',
    emoji: '🎭',
    title: 'Culture & Media',
    subtitle: 'Movies, music, books, and more',
    phrases: ['I understand', 'Really?', 'Amazing!', 'No way!']
  },
  {
    id: 'connect',
    emoji: '💬',
    title: 'Connect with People',
    subtitle: 'Friends, family, or new relationships',
    phrases: ['Nice to meet you', 'How are you?', 'Thank you', 'See you later']
  },
  {
    id: 'work',
    emoji: '💼',
    title: 'Career & Business',
    subtitle: 'Professional growth opportunities',
    phrases: ['Excuse me', 'I\'m sorry', 'Please help', 'I don\'t understand']
  },
  {
    id: 'curiosity',
    emoji: '🧠',
    title: 'Just Curious',
    subtitle: 'Learning for the joy of it',
    phrases: ['Hello', 'Thank you', 'Yes', 'No']
  },
];

// ============================================
// SCRIPT & READING TYPES
// ============================================

export type ScriptType = 'hiragana' | 'katakana' | 'kanji' | 'mixed';

export type ReadingLevel =
  | 'romaji'      // Level 0: Shows romaji, learning kana visually
  | 'kana'        // Level 1-2: Reading hiragana/katakana
  | 'kanji-basic' // Level 3: Basic kanji with furigana always shown
  | 'kanji-read'  // Level 4: Furigana on demand
  | 'fluent';     // Level 5: Minimal furigana assistance

// Furigana segment: maps a kanji/word portion to its reading
export interface FuriganaSegment {
  text: string;      // The base text (e.g., "猫", "食べ")
  reading: string;   // Hiragana reading (e.g., "ねこ", "たべ")
  isKanji: boolean;  // Whether this segment contains kanji
  // Extended fields for word-level segmentation
  meaning?: string;  // Translation/meaning of the word
  role?: string;     // Grammatical role (subject, verb, particle, etc.)
}

// ============================================
// MASTERY TRACKING
// ============================================

export type MasteryLevel = 'new' | 'learning' | 'familiar' | 'mastered';

// Separate mastery for meaning vs reading
export interface WordMastery {
  // Meaning mastery (existing)
  meaningScore: number;      // 0-100
  meaningLevel: MasteryLevel;
  timesCorrectMeaning: number;
  timesWrongMeaning: number;

  // Reading mastery (NEW)
  readingScore: number;      // 0-100
  readingLevel: MasteryLevel;
  timesCorrectReading: number;
  timesWrongReading: number;

  // Speaking mastery
  speakingScore: number;
  timesSpoken: number;

  // Kanji-specific (if applicable)
  kanjiRecognition: number;  // Can recognize kanji → meaning
  kanjiReading: number;      // Can read kanji → pronunciation
}

// ============================================
// WORD TYPE (Enhanced)
// ============================================

export interface Word {
  id: string;

  // Core text representations
  japanese: string;         // Full written form: "猫", "コーヒー", "食べる"
  reading: string;          // Hiragana reading: "ねこ", "こーひー", "たべる"
  romaji: string;           // Romanization: "neko", "koohii", "taberu"
  english: string;          // Legacy field - kept for backward compatibility

  // Native language translation (user's native language)
  nativeTranslation?: string;     // Translation in user's native language
  nativeLanguageCode?: string;    // Language code of nativeTranslation (e.g., 'ja', 'es')

  // Script analysis (optional for backward compat)
  scriptType?: ScriptType;   // Primary script used
  containsKanji?: boolean;   // Quick check for kanji presence
  furigana?: FuriganaSegment[]; // Structured furigana data

  // Optional linguistic info
  partOfSpeech?: string;    // "noun", "verb", "adjective", etc.
  jlptLevel?: number;       // 5 (easiest) to 1 (hardest)

  // Position in image (from AI object detection)
  position?: { x: number; y: number }; // Percentage position (0-100)

  // Bounding box for cropped flashcards (percentage of image dimensions)
  boundingBox?: {
    x: number;      // Left edge (0-100%)
    y: number;      // Top edge (0-100%)
    width: number;  // Width (0-100%)
    height: number; // Height (0-100%)
  };

  // Main subject marker (for focused learning)
  isMainSubject?: boolean;  // true if this is the main focus of the photo

  // Mastery tracking - keep flat for backward compatibility
  mastery: MasteryLevel;    // 'new' | 'learning' | 'familiar' | 'mastered'
  masteryScore: number;     // 0-100

  // Detailed mastery (optional, for enhanced tracking)
  masteryDetails?: WordMastery;

  // Practice counts
  timesCorrect: number;
  timesWrong: number;
  timesSpoken: number;

  // Spaced repetition (legacy fields for backward compat)
  lastReviewed?: string;
  nextReview?: string;
  interval: number;

  // Enhanced SRS data
  srs?: {
    interval: number;        // Hours until next review
    easeFactor: number;      // Multiplier (1.3 - 2.5+)
    repetitions: number;     // Consecutive correct answers
    lastReviewed: string;    // ISO timestamp
    nextReview: string;      // ISO timestamp
  };

  // Reading-specific (optional)
  readingScore?: number;
  readingMastery?: MasteryLevel;
  lastReadingReview?: string;
  nextReadingReview?: string;
  readingInterval?: number;

  // Descriptors (adjectives/context about this specific object in the photo)
  descriptors?: WordDescriptor[];
}

// Descriptor for adjectives/details about an object
export interface WordDescriptor {
  english: string;      // Legacy - kept for backward compatibility
  japanese: string;     // Target language: "赤い", "大きい", "テーブルの上"
  reading: string;      // Reading/pronunciation: "あかい", "おおきい", "てーぶるのうえ"
  nativeTranslation?: string;  // Translation in user's native language
}

// Helper to create default word mastery
export const createDefaultMastery = (): WordMastery => ({
  meaningScore: 0,
  meaningLevel: 'new',
  timesCorrectMeaning: 0,
  timesWrongMeaning: 0,
  readingScore: 0,
  readingLevel: 'new',
  timesCorrectReading: 0,
  timesWrongReading: 0,
  speakingScore: 0,
  timesSpoken: 0,
  kanjiRecognition: 0,
  kanjiReading: 0,
});

// ============================================
// SENTENCE TYPE (NEW)
// ============================================

export interface Sentence {
  id: string;

  // Core representations
  japanese: string;         // Full sentence in target language
  reading: string;          // Reading/pronunciation
  romaji: string;           // Romanization
  translation: string;      // Legacy field - kept for backward compatibility

  // Native language translation
  nativeTranslation?: string;     // Translation in user's native language
  nativeLanguageCode?: string;    // Language code of nativeTranslation

  // Structured data
  furigana: FuriganaSegment[]; // Word-by-word furigana (Japanese)
  wordIds: string[];        // Links to Word objects used

  // Word breakdown for non-Japanese languages (Chinese, Korean, etc.)
  words?: {
    word: string;           // Word in target language
    reading: string;        // Pronunciation (pinyin, romanization)
    meaning: string;        // Translation in native language
    role?: string;          // Grammatical role (subject, verb, object, etc.)
  }[];

  // Context
  photoId?: string;         // Source photo
  sceneContext?: string;    // "describing location", "action", etc.

  // Mastery
  readingMastery: number;   // 0-100 for sentence reading
  comprehensionMastery: number; // 0-100 for understanding
  lastPracticed?: string;
  nextReview?: string;
}

// ============================================
// PHOTO LESSON (Enhanced)
// ============================================

// GPS coordinates for map placement
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  placeName?: string;  // Reverse geocoded name
}

export interface PhotoLesson {
  id: string;
  imageUri: string;
  words: Word[];
  sentences: Sentence[];    // NEW: Generated sentences
  createdAt: string;
  location?: string;        // Text description
  coordinates?: GeoLocation; // GPS coordinates for map (always current device location)

  // Original photo metadata (stored but not used for mapping/rewards)
  originalPhotoLocation?: {
    latitude: number;
    longitude: number;
    source: 'exif' | 'media_library';
  };

  // Review tracking
  lastPracticed?: string;
  practiceCount: number;

  // Quiz progress tracking (persisted to survive navigation)
  quizzedWordIds?: string[];  // Word IDs that have completed their quiz
  exploredWordIds?: string[]; // Word IDs that have been explored (viewed)

  // Memory Palace system
  memoryStrength: number;       // 0-100, decays over time without review
  lastReviewedAt?: string;      // ISO date of last review
  reviewCount: number;          // Total times reviewed
  memoryStatus: MemoryStatus;   // Current status for display

  // Photo category (auto-detected from content)
  category?: PhotoCategory;

  // Computed stats
  wordsToReview: number;
  averageMastery: number;
  averageReadingMastery: number; // NEW
}

// Photo categories for organizing the Memory Palace
export type PhotoCategory =
  | 'food'       // Restaurants, cafes, cooking
  | 'nature'     // Parks, gardens, outdoors
  | 'home'       // Kitchen, bedroom, living space
  | 'shopping'   // Stores, markets
  | 'transport'  // Stations, vehicles
  | 'work'       // Office, study
  | 'culture'    // Museums, landmarks
  | 'social'     // People, gatherings
  | 'other';     // Default

export const PHOTO_CATEGORIES: Record<PhotoCategory, {
  label: string;
  emoji: string;
  color: string;
  keywords: string[];
}> = {
  food: {
    label: 'Food & Dining',
    emoji: '🍽️',
    color: '#F59E0B',
    keywords: ['food', 'restaurant', 'cafe', 'coffee', 'kitchen', 'cooking', 'meal', 'drink', 'tea', 'breakfast', 'lunch', 'dinner'],
  },
  nature: {
    label: 'Nature',
    emoji: '🌳',
    color: '#10B981',
    keywords: ['park', 'garden', 'tree', 'flower', 'plant', 'forest', 'beach', 'mountain', 'sky', 'outdoor', 'nature'],
  },
  home: {
    label: 'Home',
    emoji: '🏠',
    color: '#6366F1',
    keywords: ['home', 'house', 'room', 'bedroom', 'bathroom', 'living', 'furniture', 'bed', 'sofa', 'desk'],
  },
  shopping: {
    label: 'Shopping',
    emoji: '🛍️',
    color: '#EC4899',
    keywords: ['shop', 'store', 'market', 'mall', 'clothes', 'buy', 'price', 'sale'],
  },
  transport: {
    label: 'Transport',
    emoji: '🚃',
    color: '#3B82F6',
    keywords: ['station', 'train', 'bus', 'car', 'bike', 'airport', 'subway', 'taxi', 'road', 'street'],
  },
  work: {
    label: 'Work & Study',
    emoji: '💼',
    color: '#8B5CF6',
    keywords: ['office', 'work', 'computer', 'book', 'study', 'school', 'library', 'meeting', 'desk'],
  },
  culture: {
    label: 'Culture',
    emoji: '🏛️',
    color: '#14B8A6',
    keywords: ['museum', 'art', 'temple', 'shrine', 'monument', 'landmark', 'history', 'culture', 'exhibit'],
  },
  social: {
    label: 'Social',
    emoji: '👥',
    color: '#F472B6',
    keywords: ['people', 'friend', 'family', 'party', 'gathering', 'event', 'celebration'],
  },
  other: {
    label: 'Other',
    emoji: '📷',
    color: '#6B7280',
    keywords: [],
  },
};

// Auto-detect category from words and location
export function detectPhotoCategory(words: Word[], location?: string): PhotoCategory {
  const allText = [
    location || '',
    ...words.map(w => w.english.toLowerCase()),
  ].join(' ').toLowerCase();

  let bestMatch: PhotoCategory = 'other';
  let bestScore = 0;

  for (const [category, meta] of Object.entries(PHOTO_CATEGORIES)) {
    if (category === 'other') continue;
    const score = meta.keywords.filter(kw => allText.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category as PhotoCategory;
    }
  }

  return bestMatch;
}

// Memory strength status for visual display
export type MemoryStatus = 'fresh' | 'strong' | 'fading' | 'weak' | 'forgotten';

// Helper to calculate memory status from strength
export function getMemoryStatus(strength: number): MemoryStatus {
  if (strength >= 90) return 'fresh';
  if (strength >= 70) return 'strong';
  if (strength >= 40) return 'fading';
  if (strength >= 10) return 'weak';
  return 'forgotten';
}

// Memory decay constants
export const MEMORY_DECAY = {
  DAILY_DECAY: 8,           // Points lost per day without review
  REVIEW_BOOST: 25,         // Points gained per review
  MAX_STRENGTH: 100,
  MIN_STRENGTH: 0,
  NOTIFICATION_THRESHOLD: 50, // Notify when below this
};

// ============================================
// USER STATS & SETTINGS
// ============================================

export interface ReadingProgress {
  // Kana progress
  hiraganaKnown: string[];  // Characters user knows
  katakanaKnown: string[];
  hiraganaAccuracy: number;
  katakanaAccuracy: number;

  // Kanji progress
  kanjiKnown: string[];     // Kanji user can recognize
  kanjiReadable: string[];  // Kanji user can read (pronunciation)
  kanjiCount: number;

  // Overall reading level
  currentLevel: ReadingLevel;
  readingXP: number;
}

export interface UserStats {
  // XP System
  xp: number;
  level: number;
  xpToNextLevel: number;

  // Streaks
  streak: number;
  longestStreak: number;
  lastActiveDate: string;

  // Review streaks (Memory Palace)
  reviewStreak: number;
  longestReviewStreak: number;
  lastReviewDate: string;
  todayReviewCount: number;

  // Progress
  totalWords: number;
  masteredWords: number;
  totalPhotos: number;

  // Reading progress (NEW)
  reading: ReadingProgress;

  // Daily
  todayXP: number;
  todayWords: number;
  todayReviews: number;
  dailyGoal: number;
  dailyGoalMet: boolean;
}

// Review streak bonus multipliers
export const REVIEW_STREAK_BONUSES = {
  BASE_XP: 15,
  STREAK_MULTIPLIER: 0.1, // +10% per streak day
  MAX_MULTIPLIER: 2.0,    // Cap at 2x
  MEMORY_BOOST_BASE: 25,
  STREAK_MEMORY_BONUS: 5, // Extra memory per streak day
};

// ============================================
// USER PREFERENCES
// ============================================

export interface ReadingPreferences {
  // Display preferences
  showFurigana: 'always' | 'kanji-only' | 'on-tap' | 'never';
  showRomaji: 'always' | 'on-tap' | 'never';
  primaryDisplay: 'japanese' | 'romaji'; // What to show first

  // Learning preferences
  autoProgressReading: boolean; // Auto-advance reading level
  includeReadingQuizzes: boolean;
  readingQuizRatio: number; // 0-1, portion of quizzes focused on reading

  // Difficulty
  kanjiDifficulty: 'easy' | 'medium' | 'hard';
  sentenceLength: 'short' | 'medium' | 'long';
}

// ============================================
// QUIZ TYPES (Enhanced)
// ============================================

export type QuizType =
  // Meaning quizzes (existing)
  | 'meaning'           // What does 猫 mean? → pick English
  | 'reverse'           // How do you say "cat"? → pick Japanese

  // Reading quizzes (NEW)
  | 'kanji-to-reading'  // 猫 → pick ねこ (hiragana reading)
  | 'reading-to-kanji'  // ねこ → pick 猫
  | 'audio-to-script'   // [hear "neko"] → pick 猫
  | 'script-to-audio'   // 猫 → pick correct audio
  | 'furigana-fill'     // 猫(___) → type ねこ
  | 'kana-recognition'  // ね → pick "ne"
  | 'kana-assembly'     // "ne" + "ko" → build ねこ

  // Script identification
  | 'script-type'       // Is コーヒー hiragana or katakana?

  // Sentence quizzes
  | 'sentence-reading'  // Read sentence, answer comprehension
  | 'sentence-order'    // Arrange words into correct sentence
  | 'sentence-audio'    // Hear sentence, pick correct written form

  // Speaking (existing)
  | 'speak'

  // Visual (existing)
  | 'photo'
  | 'type';

export interface QuizQuestion {
  id: string;
  type: QuizType;
  word: Word;
  sentence?: Sentence;      // For sentence-based questions
  photoUri?: string;
  options: string[];
  correctIndex: number;

  // For reading quizzes
  targetScript?: ScriptType;
  showFurigana?: boolean;
}

// ============================================
// XP & REWARDS
// ============================================

export interface XPEvent {
  type: 'photo' | 'word' | 'quiz' | 'speak' | 'streak' | 'daily' | 'speed' | 'reading' | 'kanji' | 'bonus' | 'achievement' | 'penalty' | 'rescue';
  amount: number;
  description: string;
}

// Level definitions
export const LEVELS = [
  { level: 1, name: 'Curious', minXP: 0 },
  { level: 2, name: 'Explorer', minXP: 100 },
  { level: 3, name: 'Collector', minXP: 300 },
  { level: 4, name: 'Speaker', minXP: 600 },
  { level: 5, name: 'Reader', minXP: 1000 },      // Reading milestone
  { level: 6, name: 'Storyteller', minXP: 1500 },
  { level: 7, name: 'Kanji Learner', minXP: 2200 }, // Kanji milestone
  { level: 8, name: 'Scholar', minXP: 3000 },
  { level: 9, name: 'Expert', minXP: 4000 },
  { level: 10, name: 'Word Master', minXP: 5000 },
];

// Reading level thresholds
export const READING_LEVELS: { level: ReadingLevel; minKana: number; minKanji: number }[] = [
  { level: 'romaji', minKana: 0, minKanji: 0 },
  { level: 'kana', minKana: 46, minKanji: 0 },      // Know all hiragana
  { level: 'kanji-basic', minKana: 92, minKanji: 0 }, // Know all kana
  { level: 'kanji-read', minKana: 92, minKanji: 50 },
  { level: 'fluent', minKana: 92, minKanji: 200 },
];

// XP rewards
export const XP_REWARDS = {
  takePhoto: 20,
  learnWord: 10,
  quizCorrect: 10,
  quizSpeedBonus: 5,
  speakWord: 15,
  dailyGoalComplete: 50,
  streakDay: 20,
  // Reading rewards (NEW)
  readingCorrect: 15,      // Higher reward for reading
  kanjiRecognized: 20,     // Kanji is harder
  sentenceRead: 25,        // Sentence reading
  kanaLearned: 5,          // Per kana character
  // Memory rescue rewards
  rescueBonus: 15,         // Bonus for reviewing fading memory
  rescueCombo: 5,          // Additional per combo (2x, 3x, etc.)
  // Memory loss penalties
  memoryLostPenalty: -20,  // XP lost when memory fully fades
};

// Milestone definitions
export const MILESTONES = [
  { id: 'first-photo', trigger: 'photos', count: 1, title: 'Your journey begins!', emoji: '🌱' },
  { id: '10-words', trigger: 'words', count: 10, title: 'Double digits!', emoji: '🔟' },
  { id: '50-words', trigger: 'words', count: 50, title: 'You could order food in Japan!', emoji: '🍜' },
  { id: '100-words', trigger: 'words', count: 100, title: 'Hundred word hero!', emoji: '💯' },
  { id: '7-streak', trigger: 'streak', count: 7, title: 'One week warrior!', emoji: '🔥' },
  { id: '30-streak', trigger: 'streak', count: 30, title: 'Monthly master!', emoji: '🏆' },
  { id: 'first-mastery', trigger: 'mastered', count: 1, title: 'First word mastered!', emoji: '⭐' },
  { id: '10-mastery', trigger: 'mastered', count: 10, title: 'Memory champion!', emoji: '🧠' },
  // Reading milestones (NEW)
  { id: 'hiragana-complete', trigger: 'hiragana', count: 46, title: 'Hiragana Master!', emoji: 'あ' },
  { id: 'katakana-complete', trigger: 'katakana', count: 46, title: 'Katakana Master!', emoji: 'ア' },
  { id: 'first-kanji', trigger: 'kanji', count: 1, title: 'First Kanji!', emoji: '漢' },
  { id: '50-kanji', trigger: 'kanji', count: 50, title: 'Kanji Explorer!', emoji: '📚' },
  { id: '100-kanji', trigger: 'kanji', count: 100, title: 'Kanji Scholar!', emoji: '🎓' },
];

// ============================================
// KANA REFERENCE DATA
// ============================================

export const HIRAGANA_CHART = [
  { kana: 'あ', romaji: 'a' }, { kana: 'い', romaji: 'i' }, { kana: 'う', romaji: 'u' },
  { kana: 'え', romaji: 'e' }, { kana: 'お', romaji: 'o' },
  { kana: 'か', romaji: 'ka' }, { kana: 'き', romaji: 'ki' }, { kana: 'く', romaji: 'ku' },
  { kana: 'け', romaji: 'ke' }, { kana: 'こ', romaji: 'ko' },
  { kana: 'さ', romaji: 'sa' }, { kana: 'し', romaji: 'shi' }, { kana: 'す', romaji: 'su' },
  { kana: 'せ', romaji: 'se' }, { kana: 'そ', romaji: 'so' },
  { kana: 'た', romaji: 'ta' }, { kana: 'ち', romaji: 'chi' }, { kana: 'つ', romaji: 'tsu' },
  { kana: 'て', romaji: 'te' }, { kana: 'と', romaji: 'to' },
  { kana: 'な', romaji: 'na' }, { kana: 'に', romaji: 'ni' }, { kana: 'ぬ', romaji: 'nu' },
  { kana: 'ね', romaji: 'ne' }, { kana: 'の', romaji: 'no' },
  { kana: 'は', romaji: 'ha' }, { kana: 'ひ', romaji: 'hi' }, { kana: 'ふ', romaji: 'fu' },
  { kana: 'へ', romaji: 'he' }, { kana: 'ほ', romaji: 'ho' },
  { kana: 'ま', romaji: 'ma' }, { kana: 'み', romaji: 'mi' }, { kana: 'む', romaji: 'mu' },
  { kana: 'め', romaji: 'me' }, { kana: 'も', romaji: 'mo' },
  { kana: 'や', romaji: 'ya' }, { kana: 'ゆ', romaji: 'yu' }, { kana: 'よ', romaji: 'yo' },
  { kana: 'ら', romaji: 'ra' }, { kana: 'り', romaji: 'ri' }, { kana: 'る', romaji: 'ru' },
  { kana: 'れ', romaji: 're' }, { kana: 'ろ', romaji: 'ro' },
  { kana: 'わ', romaji: 'wa' }, { kana: 'を', romaji: 'wo' }, { kana: 'ん', romaji: 'n' },
];

export const KATAKANA_CHART = [
  { kana: 'ア', romaji: 'a' }, { kana: 'イ', romaji: 'i' }, { kana: 'ウ', romaji: 'u' },
  { kana: 'エ', romaji: 'e' }, { kana: 'オ', romaji: 'o' },
  { kana: 'カ', romaji: 'ka' }, { kana: 'キ', romaji: 'ki' }, { kana: 'ク', romaji: 'ku' },
  { kana: 'ケ', romaji: 'ke' }, { kana: 'コ', romaji: 'ko' },
  { kana: 'サ', romaji: 'sa' }, { kana: 'シ', romaji: 'shi' }, { kana: 'ス', romaji: 'su' },
  { kana: 'セ', romaji: 'se' }, { kana: 'ソ', romaji: 'so' },
  { kana: 'タ', romaji: 'ta' }, { kana: 'チ', romaji: 'chi' }, { kana: 'ツ', romaji: 'tsu' },
  { kana: 'テ', romaji: 'te' }, { kana: 'ト', romaji: 'to' },
  { kana: 'ナ', romaji: 'na' }, { kana: 'ニ', romaji: 'ni' }, { kana: 'ヌ', romaji: 'nu' },
  { kana: 'ネ', romaji: 'ne' }, { kana: 'ノ', romaji: 'no' },
  { kana: 'ハ', romaji: 'ha' }, { kana: 'ヒ', romaji: 'hi' }, { kana: 'フ', romaji: 'fu' },
  { kana: 'ヘ', romaji: 'he' }, { kana: 'ホ', romaji: 'ho' },
  { kana: 'マ', romaji: 'ma' }, { kana: 'ミ', romaji: 'mi' }, { kana: 'ム', romaji: 'mu' },
  { kana: 'メ', romaji: 'me' }, { kana: 'モ', romaji: 'mo' },
  { kana: 'ヤ', romaji: 'ya' }, { kana: 'ユ', romaji: 'yu' }, { kana: 'ヨ', romaji: 'yo' },
  { kana: 'ラ', romaji: 'ra' }, { kana: 'リ', romaji: 'ri' }, { kana: 'ル', romaji: 'ru' },
  { kana: 'レ', romaji: 're' }, { kana: 'ロ', romaji: 'ro' },
  { kana: 'ワ', romaji: 'wa' }, { kana: 'ヲ', romaji: 'wo' }, { kana: 'ン', romaji: 'n' },
];

// ============================================
// ACTIVE LEARNING SYSTEM TYPES
// ============================================

// Sentence-level progress tracking
export interface SentenceMastery {
  pronunciationScore: number;   // 0-100
  readingScore: number;         // 0-100
  comprehensionScore: number;   // 0-100
  timesRead: number;
  timesSpoken: number;
  timesCorrect: number;
  timesWrong: number;
  mistakeTypes: string[];       // Track what kinds of mistakes
  lastPracticed?: string;
  nextReview?: string;
  interval: number;
}

// Grammar element for sentence breakdown
export type GrammarRole =
  | 'subject'
  | 'object'
  | 'verb'
  | 'particle'
  | 'adjective'
  | 'adverb'
  | 'topic'
  | 'location'
  | 'time'
  | 'other';

export interface GrammarElement {
  word: string;                 // The Japanese word/particle
  reading: string;              // Hiragana reading
  role: GrammarRole;
  explanation: string;          // Brief explanation like "marks the subject"
  particleType?: string;        // For particles: ga, wo, ni, de, etc.
}

// Sentence structure breakdown
export interface SentenceBreakdown {
  elements: GrammarElement[];
  structure: string;            // e.g., "Subject + ha + Location + ni + imasu"
  patternName?: string;         // e.g., "existence pattern", "action pattern"
  notes?: string;
}

// Sentence difficulty level
export type SentenceDifficulty = 'beginner' | 'intermediate' | 'advanced';

// Practice session tracking
export interface PracticeSession {
  id: string;
  type: 'word' | 'sentence' | 'mixed' | 'speaking' | 'reading';
  items: string[];              // Word or sentence IDs
  startedAt: string;
  completedAt?: string;
  score: number;
  skillsImproved: { skill: string; delta: number }[];
}

// Skill tracking for user
export interface SkillProgress {
  level: number;
  accuracy: number;
  streak: number;
}

export interface UserSkills {
  reading: SkillProgress;
  speaking: SkillProgress;
  listening: SkillProgress;
  grammar: SkillProgress;
}

// Daily challenge system
export type ChallengeType = 'words' | 'sentences' | 'speaking' | 'reading' | 'mixed';

export interface DailyChallenge {
  id: string;
  date: string;
  type: ChallengeType;
  targetCount: number;
  completedCount: number;
  xpReward: number;
  completed: boolean;
}

// Extended quiz types for active learning
export type ActiveLearningQuizType =
  | 'sentence-speak'            // Speak the sentence
  | 'sentence-translate'        // Translate to English
  | 'sentence-construct'        // Arrange words into sentence
  | 'fill-blank'                // Fill in missing word
  | 'grammar-identify'          // Identify particle role
  | 'typing';                   // Type the answer

// Combined quiz type including existing and new types
export type ExtendedQuizType = QuizType | ActiveLearningQuizType;

// Helper to create default sentence mastery
export const createDefaultSentenceMastery = (): SentenceMastery => ({
  pronunciationScore: 0,
  readingScore: 0,
  comprehensionScore: 0,
  timesRead: 0,
  timesSpoken: 0,
  timesCorrect: 0,
  timesWrong: 0,
  mistakeTypes: [],
  interval: 1,
});

// Helper to create default user skills
export const createDefaultUserSkills = (): UserSkills => ({
  reading: { level: 1, accuracy: 0, streak: 0 },
  speaking: { level: 1, accuracy: 0, streak: 0 },
  listening: { level: 1, accuracy: 0, streak: 0 },
  grammar: { level: 1, accuracy: 0, streak: 0 },
});

// ============================================
// ENHANCED SENTENCE INTERFACE
// ============================================

// Extended sentence with active learning features
export interface EnhancedSentence extends Sentence {
  mastery: SentenceMastery;
  grammarBreakdown?: SentenceBreakdown;
  difficulty: SentenceDifficulty;
  audioUrl?: string;
}

// ============================================
// TRANSLATION TYPES
// ============================================

export interface SavedTranslation {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Translation content
  sourceText: string;
  sourceLanguage: 'en' | 'ja';
  targetText: string;
  targetLanguage: 'en' | 'ja';

  // Japanese specific (when target is Japanese)
  reading?: string;      // Hiragana reading
  romaji?: string;       // Romaji

  // Organization
  folderId?: string;     // Optional folder
  tags: string[];
  isFavorite: boolean;

  // Learning tracking
  timesReviewed: number;
  lastReviewed?: string;
  masteryScore: number;  // 0-100
}

export interface TranslationFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
  order: number;
}

// Default folders - Cosmic theme colors
export const DEFAULT_TRANSLATION_FOLDERS: TranslationFolder[] = [
  { id: 'travel', name: 'Travel', color: '#22C55E', icon: 'airplane', createdAt: '', order: 0 },
  { id: 'food', name: 'Food & Dining', color: '#EF4444', icon: 'restaurant', createdAt: '', order: 1 },
  { id: 'daily', name: 'Daily Life', color: '#FBBF24', icon: 'sunny', createdAt: '', order: 2 },
  { id: 'work', name: 'Work', color: '#8B5CF6', icon: 'briefcase', createdAt: '', order: 3 },
  { id: 'social', name: 'Social', color: '#3B82F6', icon: 'people', createdAt: '', order: 4 },
];

// Re-export subscription types
export * from './subscription';

// Re-export achievements
export * from './achievements';
