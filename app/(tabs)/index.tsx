import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';

// ImageManipulator is optional - needs native rebuild
let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  if (__DEV__) console.log('ImageManipulator not available - HEIC conversion disabled');
}

// MediaLibrary is optional - needs native rebuild
let MediaLibrary: any = null;
try {
  MediaLibrary = require('expo-media-library');
} catch (e) {
  if (__DEV__) console.log('MediaLibrary not available - photo location from EXIF disabled');
}
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { analyzePhoto } from '../../src/services/aiService';
import { getLocationWithPlace, calculateDistance } from '../../src/utils/location';
import { generateThumbnail } from '../../src/utils/photoStorage';
import { findNearbyQuest, QUEST_RADIUS_METERS } from '../../src/services/questService';
import { usePhotoExploration } from '../../src/hooks/usePhotoExploration';
import { useTranslations } from '../../src/hooks/useTranslations';
import { preloadAudio } from '../../src/utils/speech';
import {
  WordBubble,
  WordDetailCard,
  MiniQuizCard,
  SentenceQuizCard,
  SentenceOverlayCard,
  SuccessOverlayCard,
  MinimalTopBar,
  MainSubjectOverlay,
} from '../../src/components/overlay';
import { useScanGate } from '../../src/hooks/useSubscription';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Directory for permanently saved photos - use relative path for storage
const PHOTOS_SUBDIR = 'photos/';
const getPhotosDir = () => `${FileSystem.documentDirectory}${PHOTOS_SUBDIR}`;

/**
 * Resolve a stored image URI to an absolute path
 * Handles both old absolute paths and new relative paths
 */
export function resolveImageUri(storedUri: string): string {
  if (!storedUri) return '';

  // Already a full path (data: URI, http:, or starts with /)
  if (storedUri.startsWith('data:') || storedUri.startsWith('http') || storedUri.startsWith('file://')) {
    // Check if it's an old absolute path that needs fixing
    if (storedUri.includes('/Documents/photos/photo_')) {
      // Extract just the filename and rebuild with current documentDirectory
      const match = storedUri.match(/photo_[^/]+\.jpg$/);
      if (match) {
        const resolved = `${getPhotosDir()}${match[0]}`;
        if (__DEV__) console.log('[Photo] Resolved old absolute path to:', resolved);
        return resolved;
      }
    }
    return storedUri;
  }

  // Relative path (just filename like "photo_123.jpg" or "photos/photo_123.jpg")
  const filename = storedUri.replace(/^photos\//, '');
  return `${getPhotosDir()}${filename}`;
}

/**
 * Convert absolute path to relative for storage
 */
function toRelativePath(absoluteUri: string): string {
  // Extract just the filename for storage
  const match = absoluteUri.match(/(photo_[^/]+\.jpg)$/);
  if (match) {
    return `photos/${match[1]}`;
  }
  // If we can't extract, return as-is (might be data: URI or external)
  return absoluteUri;
}

/**
 * Save image to permanent storage
 * Returns a RELATIVE path for storage (survives app updates)
 */
async function saveImagePermanently(tempUri: string): Promise<string> {
  const photosDir = getPhotosDir();

  // If already a relative path or in our photos directory, extract relative path
  if (tempUri.includes('/photos/photo_') || tempUri.startsWith('photos/')) {
    const relativePath = toRelativePath(tempUri);
    if (__DEV__) console.log('Photo already saved, using relative path:', relativePath);
    return relativePath;
  }

  // Generate unique filename
  const filename = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
  const permanentUri = `${photosDir}${filename}`;
  const relativePath = `photos/${filename}`;

  try {
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(photosDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
      if (__DEV__) console.log('Created photos directory:', photosDir);
    }
  } catch (dirError) {
    try {
      await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
    } catch {
      // Directory probably exists
    }
  }

  // Try copy first
  try {
    await FileSystem.copyAsync({
      from: tempUri,
      to: permanentUri,
    });
    if (__DEV__) console.log('Saved photo, returning relative path:', relativePath);
    // Generate thumbnail for Android map markers (non-blocking)
    generateThumbnail(relativePath).catch(() => {});
    return relativePath;
  } catch (copyError) {
    if (__DEV__) console.log('Copy failed, trying base64 method:', copyError);
  }

  // Fallback: read as base64 and write
  try {
    const base64 = await FileSystem.readAsStringAsync(tempUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(permanentUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (__DEV__) console.log('Saved photo (base64), returning relative path:', relativePath);
    // Generate thumbnail for Android map markers (non-blocking)
    generateThumbnail(relativePath).catch(() => {});
    return relativePath;
  } catch (base64Error) {
    console.error('CRITICAL: Could not save photo:', base64Error);
    return tempUri;
  }
}

/**
 * Verify a photo URI still exists on disk
 * Returns true if accessible, false if missing
 */
async function verifyPhotoExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Debug: Check all photos in storage directory
 */
async function debugPhotoStorage(): Promise<void> {
  const photosDir = getPhotosDir();
  try {
    if (__DEV__) console.log('[PhotoStorage] Checking directory:', photosDir);
    const dirInfo = await FileSystem.getInfoAsync(photosDir);
    if (!dirInfo.exists) {
      if (__DEV__) console.log('[PhotoStorage] Directory does not exist, creating...');
      await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
      return;
    }
    const files = await FileSystem.readDirectoryAsync(photosDir);
    if (__DEV__) console.log(`[PhotoStorage] Found ${files.length} photos in permanent storage`);
    if (files.length > 0) {
      if (__DEV__) console.log('[PhotoStorage] Sample files:', files.slice(0, 3));
    }
  } catch (e) {
    if (__DEV__) console.log('[PhotoStorage] Error checking storage:', e);
  }
}

type Mode = 'camera' | 'exploring';

// Toast state type
interface ToastState {
  visible: boolean;
  word: string;
  english: string;
}

// Loading tips for engaging wait state
const LOADING_TIPS = [
  { emoji: '📸', text: 'Analyzing your photo...' },
  { emoji: '🔍', text: 'Finding objects in image...' },
  { emoji: '✨', text: 'Generating vocabulary...' },
  { emoji: '📝', text: 'Creating example sentences...' },
  { emoji: '🎯', text: 'Preparing your lesson...' },
];

const LEARNING_FACTS = [
  'Photos help create stronger memory connections',
  'Learning words in context improves retention by 40%',
  'Visual learners remember images 65% better than text',
  'Spaced repetition is the key to long-term memory',
  'Speaking words aloud strengthens neural pathways',
  'Learning 3 words daily = 1000+ words per year',
];

// Max image dimension for upload optimization
const MAX_IMAGE_DIMENSION = 1024;

/**
 * Resize image to max dimension while maintaining aspect ratio
 * This significantly reduces upload time without affecting AI analysis quality
 */
async function resizeImageForUpload(uri: string): Promise<string> {
  if (!ImageManipulator) {
    if (__DEV__) console.log('[Resize] ImageManipulator not available, using original');
    return uri;
  }

  try {
    // First get image info to check if resize is needed
    const originalInfo = await FileSystem.getInfoAsync(uri);
    const originalSize = (originalInfo as any).size || 0;
    if (__DEV__) console.log(`[Resize] Original size: ${(originalSize / 1024).toFixed(0)}KB`);

    // Resize to max dimension (maintains aspect ratio when only width is specified)
    // This significantly reduces upload time for AI analysis
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const newInfo = await FileSystem.getInfoAsync(result.uri);
    const newSize = (newInfo as any).size || 0;
    const savings = originalSize > 0 ? ((1 - newSize / originalSize) * 100).toFixed(0) : 0;
    if (__DEV__) console.log(`[Resize] Optimized: ${(newSize / 1024).toFixed(0)}KB (${savings}% smaller)`);

    return result.uri;
  } catch (error) {
    if (__DEV__) console.log('[Resize] Failed, using original:', error);
    return uri;
  }
}

export default function CameraExplorationScreen() {
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [mode, setMode] = useState<Mode>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');

  // Store
  const {
    stats,
    setIsAnalyzing,
    isAnalyzing,
    setCurrentLesson,
    addLesson,
    updateLesson,
    deleteLesson,
    currentLesson,
    lessons,
    memorySpots,
    nativeLanguage,
    targetLanguage,
    // Memory Worlds
    getActiveWorld,
    addObjectToWorld,
    worlds,
    activeWorldId,
    setActiveWorld,
    // Quests
    activeQuests,
    completeQuest,
    setActiveQuestBonus,
    clearActiveQuestBonus,
    activeQuestBonus,
  } = useAppStore();

  // Calculate pending lessons (lessons without a completed quiz/memory spot)
  const pendingLessons = useMemo(() => {
    const completedLessonIds = new Set(memorySpots.map(s => s.lessonId));
    return lessons.filter(l => !completedLessonIds.has(l.id));
  }, [lessons, memorySpots]);

  // Get all existing words the user has already learned (for AI deduplication)
  const existingWords = useMemo(() => {
    const wordSet = new Set<string>();
    lessons.forEach(lesson => {
      lesson.words.forEach(word => {
        wordSet.add(word.english.toLowerCase());
        wordSet.add(word.japanese);
      });
    });
    return Array.from(wordSet);
  }, [lessons]);

  // Subscription scan gate - attemptScan triggers paywall through store when limit reached
  const { attemptScan, scansRemaining, isPremium } = useScanGate();

  // Toast state for showing "Added to world" confirmation
  const [toast, setToast] = useState<ToastState>({ visible: false, word: '', english: '' });

  // Loading animation state
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const [loadingFact, setLoadingFact] = useState('');
  const loadingPulseAnim = useRef(new Animated.Value(1)).current;
  const loadingProgressAnim = useRef(new Animated.Value(0)).current;

  // Exploration hook
  const {
    lesson,
    words,
    sentences,
    wordPositions,
    activeCard,
    progress,
    sessionXP,
    getWordState,
    openWord,
    closeCard,
    completeMiniQuiz,
    startSentenceQuiz,
    completeSentenceQuiz,
    openSentence,
    resetExploration,
    resetExplorationState,
  } = usePhotoExploration();

  // Debug: Check photo storage on mount
  useEffect(() => {
    debugPhotoStorage();
  }, []);

  // Loading animation - rotate tips and show facts
  useEffect(() => {
    if (isAnalyzing) {
      // Reset and start animations
      setLoadingTipIndex(0);
      setLoadingFact(LEARNING_FACTS[Math.floor(Math.random() * LEARNING_FACTS.length)]);
      loadingProgressAnim.setValue(0);

      // Rotate through tips every 1.2 seconds
      const tipInterval = setInterval(() => {
        setLoadingTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
      }, 1200);

      // Pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingPulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(loadingPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Progress animation (simulated)
      Animated.timing(loadingProgressAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      }).start();

      return () => {
        clearInterval(tipInterval);
        pulse.stop();
      };
    }
  }, [isAnalyzing]);

  // Preload audio for all words and sentences when they become available (for instant playback)
  useEffect(() => {
    if (words.length > 0) {
      if (__DEV__) console.log('[Preload] Preloading audio for', words.length, 'words');
      words.forEach(word => {
        const text = word.reading || word.japanese;
        preloadAudio(text, false); // Normal speed
        preloadAudio(text, true);  // Slow speed
      });
    }
    if (sentences.length > 0) {
      if (__DEV__) console.log('[Preload] Preloading audio for', sentences.length, 'sentences');
      sentences.forEach(sentence => {
        const text = sentence.reading || sentence.japanese;
        preloadAudio(text, false);
        preloadAudio(text, true);
      });
    }
  }, [words, sentences]);

  // Track which lesson we're currently showing to detect new selections
  const displayedLessonIdRef = useRef<string | null>(null);
  // Track if we left the screen (to know if we should reset on return)
  const hasLeftScreenRef = useRef(false);

  // Handle when a lesson is selected (from Worlds - navigating to existing lesson)
  useEffect(() => {
    if (currentLesson && currentLesson.imageUri) {
      // Only process if this is a different lesson than what we're showing
      if (displayedLessonIdRef.current !== currentLesson.id) {
        displayedLessonIdRef.current = currentLesson.id;
        setPhotoUri(resolveImageUri(currentLesson.imageUri));
        setMode('exploring');
        resetExplorationState();
      }
    }
  }, [currentLesson, resetExplorationState]);

  // Handle tab focus/blur
  useFocusEffect(
    useCallback(() => {
      // Read fresh state from store to avoid stale closures
      const state = useAppStore.getState();
      const isFromWorlds = state.lessonSelectedForReview;

      if (isFromWorlds) {
        // Coming from Worlds with a selected lesson - consume the flag
        state.consumeLessonSelection();
      } else if (hasLeftScreenRef.current && displayedLessonIdRef.current !== null) {
        // Returned to tab without a fresh selection - reset to camera
        setMode('camera');
        setPhotoUri(null);
        state.setCurrentLesson(null);
        displayedLessonIdRef.current = null;
      }

      hasLeftScreenRef.current = false;

      // On blur: mark that we left
      return () => {
        hasLeftScreenRef.current = true;
      };
    }, [])
  );

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    // Check scan limit before capturing (attemptScan shows paywall if limit reached)
    if (!attemptScan()) {
      return;
    }

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      if (photo?.uri) {
        setPhotoUri(photo.uri);
        await processPhoto(photo.uri);
      }
    } catch (e) {
      console.error('Capture error:', e);
      Alert.alert('Error', 'Could not capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePickImage = async () => {
    // Check scan limit before picking image (attemptScan shows paywall if limit reached)
    if (!attemptScan()) {
      return;
    }

    try {
      // Request media library permissions if MediaLibrary is available
      if (MediaLibrary) {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            if (__DEV__) console.log('MediaLibrary permission not granted, continuing without location');
          }
        } catch (e) {
          if (__DEV__) console.log('MediaLibrary permission request failed:', e);
        }
      }

      // Always pick WITHOUT editing to preserve EXIF GPS data
      // allowsEditing creates a copy that loses both assetId AND EXIF
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false, // MUST be false to get EXIF location
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const pickedAsset = result.assets[0];

        // Get original photo's location - try multiple sources
        let photoLocation: { latitude: number; longitude: number } | undefined;

        // 1. First try EXIF data directly from ImagePicker result
        const exifData = pickedAsset.exif as any;
        if (__DEV__) console.log('EXIF data:', JSON.stringify(exifData, null, 2));

        // EXIF GPS can be in different formats depending on the source
        if (exifData) {
          let lat: number | undefined;
          let lng: number | undefined;

          // Format 1: GPSLatitude/GPSLongitude (standard EXIF)
          if (exifData.GPSLatitude !== undefined && exifData.GPSLongitude !== undefined) {
            lat = exifData.GPSLatitude as number;
            lng = exifData.GPSLongitude as number;
            // Apply reference direction (S/W are negative)
            if (exifData.GPSLatitudeRef === 'S') lat = -Math.abs(lat!);
            if (exifData.GPSLongitudeRef === 'W') lng = -Math.abs(lng!);
          }

          // Format 2: {Latitude}/{Longitude} (some iOS formats)
          if (lat === undefined && exifData['{GPS}']) {
            const gps = exifData['{GPS}'];
            if (gps.Latitude !== undefined && gps.Longitude !== undefined) {
              lat = gps.Latitude as number;
              lng = gps.Longitude as number;
              if (gps.LatitudeRef === 'S') lat = -Math.abs(lat!);
              if (gps.LongitudeRef === 'W') lng = -Math.abs(lng!);
            }
          }

          if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
            photoLocation = { latitude: lat, longitude: lng };
            if (__DEV__) console.log('Got photo location from EXIF:', photoLocation);
          }
        }

        // 2. Fallback to MediaLibrary using assetId (only works without allowsEditing)
        if (!photoLocation && MediaLibrary && pickedAsset.assetId) {
          try {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(pickedAsset.assetId);
            if (assetInfo?.location) {
              photoLocation = {
                latitude: assetInfo.location.latitude,
                longitude: assetInfo.location.longitude,
              };
              if (__DEV__) console.log('Got photo location from MediaLibrary:', photoLocation);
            }
          } catch (err) {
            if (__DEV__) console.log('Could not get asset location:', err);
          }
        }

        if (photoLocation) {
          if (__DEV__) console.log('Original photo EXIF location (stored but not used for mapping):', photoLocation);
        } else {
          if (__DEV__) console.log('No GPS location found in photo EXIF data');
        }

        // Convert image to JPEG if ImageManipulator is available (handles HEIC)
        let processUri = pickedAsset.uri;
        if (ImageManipulator) {
          try {
            const manipResult = await ImageManipulator.manipulateAsync(
              pickedAsset.uri,
              [], // no transforms
              { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );
            processUri = manipResult.uri;
            if (__DEV__) console.log('Converted image to JPEG:', processUri);
          } catch (convertErr) {
            if (__DEV__) console.log('Image conversion failed, using original:', convertErr);
          }
        }

        setPhotoUri(processUri);
        // Pass original EXIF location for storage only (not used for mapping)
        // Map placement always uses current device location
        await processPhoto(processUri, processUri, photoLocation, true);
      }
    } catch (e) {
      console.error('Gallery error:', e);
      Alert.alert('Error', 'Could not access photo library');
    }
  };

  const toggleCameraFacing = () => {
    setCameraFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const processPhoto = async (
    imageData: string,
    displayUri?: string,
    originalExifLocation?: { latitude: number; longitude: number },
    isFromGallery: boolean = false
  ) => {
    setIsAnalyzing(true);
    try {
      // Resize image for faster upload (biggest optimization)
      const resizedUri = await resizeImageForUpload(imageData);

      // Always get current device location for map placement
      // This ensures consistent behavior for both camera and gallery photos
      const [lessonResult, deviceLocation] = await Promise.all([
        analyzePhoto(resizedUri, existingWords, targetLanguage, nativeLanguage),
        getLocationWithPlace(), // Always get current location
      ]);

      // Use displayUri if provided (for gallery images), otherwise use imageData
      const finalUri = displayUri || imageData;
      if (displayUri) {
        lessonResult.imageUri = displayUri;
      }

      // ALWAYS use current device location for map placement and step tracking
      // This ensures consistent behavior whether photo is from camera or gallery
      if (__DEV__) console.log('[DEBUG] deviceLocation result:', deviceLocation);
      if (deviceLocation) {
        lessonResult.coordinates = {
          latitude: deviceLocation.latitude,
          longitude: deviceLocation.longitude,
          accuracy: deviceLocation.accuracy,
          placeName: deviceLocation.placeName,
        };
        if (deviceLocation.placeName) {
          lessonResult.location = deviceLocation.placeName;
        }
        if (__DEV__) console.log('[DEBUG] Assigned coordinates to lesson:', lessonResult.coordinates);
      } else {
        if (__DEV__) console.log('[DEBUG] WARNING: No deviceLocation - spot cannot be created!');
      }

      // Optionally store original photo EXIF location in background (not used for mapping/rewards)
      if (originalExifLocation) {
        (lessonResult as any).originalPhotoLocation = {
          latitude: originalExifLocation.latitude,
          longitude: originalExifLocation.longitude,
          source: 'exif',
        };
        if (__DEV__) console.log('Stored original EXIF location (not used for mapping):', originalExifLocation);
      }
      // Note: If no device location available, map spot won't be created

      if (!lessonResult.words?.length) {
        Alert.alert('No words found', 'Try a different photo with more objects');
        setPhotoUri(null);
        return;
      }

      // Save image to permanent storage (temp URIs get deleted on app restart)
      const permanentUri = await saveImagePermanently(lessonResult.imageUri);
      lessonResult.imageUri = permanentUri;

      // Store the lesson
      addLesson(lessonResult);
      setCurrentLesson(lessonResult);

      // PRELOAD AUDIO IMMEDIATELY for instant playback when user taps words
      // This runs in background - don't await
      const speechCode = targetLanguage.speechCode;
      lessonResult.words.forEach((word: any) => {
        const textToSpeak = word.reading || word.japanese;
        preloadAudio(textToSpeak, false, speechCode);
        preloadAudio(textToSpeak, true, speechCode); // Slow version
      });
      // Also preload sentences
      lessonResult.sentences?.forEach((sentence: any) => {
        const sentenceText = sentence.reading || sentence.japanese;
        preloadAudio(sentenceText, false, speechCode);
      });

      // Find the main subject (first word marked as main, or just first word)
      const mainWord = lessonResult.words.find((w: any) => w.isMainSubject) || lessonResult.words[0];

      // Auto-add main subject to world
      let worldId = activeWorldId;
      if (!worldId && worlds.length > 0) {
        worldId = worlds[0].id;
        setActiveWorld(worldId);
      }

      if (worldId && mainWord) {
        // Always use current device location for world objects (map pins)
        // This ensures consistent step tracking and map placement
        const coords = deviceLocation ? { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude } : undefined;
        const addedObject = addObjectToWorld(
          worldId,
          mainWord,
          permanentUri, // Use permanent URI
          lessonResult.id,
          coords
        );
        if (__DEV__) console.log('Auto-added to world:', addedObject, 'at', coords ? 'current device location' : 'no location');

        // Show toast confirmation
        setToast({
          visible: true,
          word: mainWord.japanese,
          english: mainWord.english,
        });

        // Hide toast after 2.5 seconds
        setTimeout(() => {
          setToast({ visible: false, word: '', english: '' });
        }, 2500);
      }

      // Check if user completed a quest (photo taken near a quest location)
      if (deviceLocation && activeQuests.length > 0) {
        const nearbyQuest = findNearbyQuest(
          deviceLocation.latitude,
          deviceLocation.longitude,
          activeQuests
        );

        if (nearbyQuest) {
          // Complete the quest and award bonus XP
          completeQuest(nearbyQuest.id, lessonResult.id);
          setActiveQuestBonus(nearbyQuest.id, nearbyQuest.xpBonus);

          // Show quest completion alert
          setTimeout(() => {
            Alert.alert(
              '🎯 Quest Complete!',
              `You completed the "${nearbyQuest.name}" quest!\n\n+${nearbyQuest.xpBonus} bonus XP earned!`,
              [{ text: 'Awesome!', onPress: () => clearActiveQuestBonus() }]
            );
          }, 500);

          if (__DEV__) console.log('[Quest] Completed quest:', nearbyQuest.name, 'Bonus XP:', nearbyQuest.xpBonus);
        }
      }

      // Go directly to exploring mode with permanent URI
      // Reset exploration state BEFORE setting the new lesson ref to clear quizzed/explored counts
      resetExplorationState();
      setPhotoUri(resolveImageUri(permanentUri));
      displayedLessonIdRef.current = lessonResult.id;
      setMode('exploring');
    } catch (e: any) {
      console.error('Analysis error:', e);
      const errorMsg = e?.message || String(e);
      if (errorMsg.includes('HEIC') || errorMsg.includes('unsupported')) {
        Alert.alert(
          'Unsupported Format',
          'This image format is not supported. Please use the camera to take a new photo, or select a JPEG/PNG image.'
        );
      } else {
        Alert.alert('Error', 'Could not analyze photo');
      }
      setPhotoUri(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBackToCamera = useCallback(() => {
    setMode('camera');
    setPhotoUri(null);
    setCurrentLesson(null);
    displayedLessonIdRef.current = null;
    resetExploration();
  }, [resetExploration, setCurrentLesson]);

  const handleCaptureMore = useCallback(() => {
    handleBackToCamera();
  }, [handleBackToCamera]);

  const handleKeepExploring = useCallback(() => {
    closeCard();
  }, [closeCard]);

  // Continue a pending lesson (one that hasn't been quiz-completed)
  const handleContinueLesson = useCallback((lessonToResume: typeof lessons[0]) => {
    setCurrentLesson(lessonToResume);
    setPhotoUri(resolveImageUri(lessonToResume.imageUri));
    displayedLessonIdRef.current = lessonToResume.id;
    resetExplorationState();
    setMode('exploring');
  }, [setCurrentLesson, resetExplorationState]);

  // Delete a pending lesson
  const handleDeleteLesson = useCallback((lessonToDelete: typeof lessons[0]) => {
    const mainWord = lessonToDelete.words.find(w => w.isMainSubject) || lessonToDelete.words[0];
    Alert.alert(
      'Delete Photo',
      `Delete "${mainWord?.japanese || 'this photo'}" and its words? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLesson(lessonToDelete.id),
        },
      ]
    );
  }, [deleteLesson]);

  // Handle word bubble position change (drag-to-move)
  const handleWordPositionChange = useCallback((wordId: string, newPosition: { x: number; y: number }) => {
    if (!lesson) return;

    const updatedWords = lesson.words.map(w =>
      w.id === wordId
        ? { ...w, userPosition: newPosition }
        : w
    );

    updateLesson(lesson.id, { words: updatedWords });
  }, [lesson, updateLesson]);

  // Permission not determined yet
  if (!permission) {
    return <View style={styles.container} />;
  }

  // No permission granted
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>{t.camera.cameraAccess}</Text>
          <Text style={styles.permissionText}>
            {t.camera.cameraAccessDesc}
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>{t.camera.enableCamera}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Exploration mode - photo with overlays
  if (mode === 'exploring' && lesson && photoUri) {
    return (
      <View style={styles.container}>
        {/* Photo background */}
        <Image source={{ uri: photoUri }} style={styles.photoBackground} resizeMode="cover" />

        {/* Dim overlay when card is open */}
        {activeCard.type && <View style={styles.dimOverlay} />}

        {/* Top bar */}
        <MinimalTopBar
          mode="exploring"
          onBack={handleBackToCamera}
          xpEarned={sessionXP}
          streak={stats.streak}
        />

        {/* Toast: New word discovered */}
        {toast.visible && (
          <View style={[styles.toast, { top: insets.top + 60 }]}>
            <Ionicons name="sparkles" size={20} color={colors.xp} />
            <Text style={styles.toastText}>
              {t.study.newWord} <Text style={styles.toastWord}>{toast.word}</Text> ({toast.english})
            </Text>
          </View>
        )}

        {/* Word display - Main subject with radial descriptors */}
        {(() => {
          const mainWord = words.find(w => w.isMainSubject);
          const descriptorWords = words.filter(w => !w.isMainSubject);

          // Use new radial layout when we have a main subject
          if (mainWord) {
            return (
              <MainSubjectOverlay
                mainWord={mainWord}
                descriptors={descriptorWords}
                onMainWordPress={() => openWord(mainWord)}
                onDescriptorPress={openWord}
                activeWordId={activeCard.word?.id}
                getWordState={getWordState}
              />
            );
          }

          // Fallback to traditional bubbles if no main subject identified
          return words.map((word, index) => {
            // Use user-adjusted position if available, otherwise use AI position
            const aiPosition = wordPositions.get(word.id);
            const position = word.userPosition || aiPosition;
            if (!position) return null;

            return (
              <WordBubble
                key={word.id}
                word={word}
                position={position}
                state={getWordState(word)}
                isActive={activeCard.word?.id === word.id}
                onPress={() => openWord(word)}
                onPositionChange={handleWordPositionChange}
                isDragEnabled={true}
                delay={index * 100}
              />
            );
          });
        })()}

        {/* Contextual hints for user guidance */}
        {!activeCard.type && (
          <View style={[styles.hintContainer, { bottom: insets.bottom + 100 }]}>
            {progress.explored === 0 ? (
              <Text style={styles.hintText}>{t.study.tapAnyWord}</Text>
            ) : progress.quizzed === 0 ? (
              <Text style={styles.hintText}>{t.study.completeQuiz}</Text>
            ) : progress.quizzed < progress.total ? (
              <Text style={styles.hintText}>
                {progress.total - progress.quizzed} {t.study.moreQuizzesToMap}
              </Text>
            ) : null}
          </View>
        )}

        {/* Floating cards */}
        {activeCard.type === 'word-detail' && activeCard.word && (
          <WordDetailCard
            word={activeCard.word}
            sentences={sentences}
            allWords={words}
            onClose={closeCard}
            onSentenceQuiz={(sentence) => startSentenceQuiz(sentence, activeCard.word!)}
            onQuizComplete={completeMiniQuiz}
          />
        )}

        {activeCard.type === 'mini-quiz' && activeCard.word && activeCard.quizData && (
          <MiniQuizCard
            word={activeCard.word}
            variant={activeCard.quizData.variant}
            options={activeCard.quizData.options}
            correctIndex={activeCard.quizData.correctIndex}
            onComplete={(correct, fast) => completeMiniQuiz(activeCard.word!.id, correct, fast)}
            onClose={closeCard}
          />
        )}

        {activeCard.type === 'sentence-quiz' && activeCard.sentence && activeCard.word && activeCard.sentenceQuizData && (
          <SentenceQuizCard
            sentence={activeCard.sentence}
            targetWord={activeCard.word}
            allWords={words}
            variant={activeCard.sentenceQuizData.variant}
            onComplete={completeSentenceQuiz}
            onClose={closeCard}
          />
        )}

        {activeCard.type === 'sentence' && activeCard.sentence && (
          <SentenceOverlayCard
            sentence={activeCard.sentence}
            words={words}
            highlightWord={activeCard.word}
            onClose={closeCard}
            onWordTap={openWord}
          />
        )}

        {activeCard.type === 'success' && (
          <SuccessOverlayCard
            wordsExplored={progress.explored}
            wordsQuizzed={progress.quizzed}
            totalXP={sessionXP}
            streak={stats.streak}
            onCaptureMore={handleCaptureMore}
            onKeepExploring={handleKeepExploring}
            onClose={closeCard}
          />
        )}
      </View>
    );
  }

  // Camera mode
  return (
    <View style={styles.container}>
      {/* Camera - no children allowed */}
      <CameraView ref={cameraRef} style={styles.camera} facing={cameraFacing} mode="picture" />

      {/* All overlays as siblings with absolute positioning */}

      {/* Loading Overlay - Engaging animation with tips */}
      {isAnalyzing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            {/* Animated emoji */}
            <Animated.Text
              style={[
                styles.loadingEmoji,
                { transform: [{ scale: loadingPulseAnim }] },
              ]}
            >
              {LOADING_TIPS[loadingTipIndex].emoji}
            </Animated.Text>

            {/* Progress bar */}
            <View style={styles.loadingProgressBar}>
              <Animated.View
                style={[
                  styles.loadingProgressFill,
                  {
                    width: loadingProgressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '90%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Rotating tip text */}
            <Text style={styles.loadingText}>
              {LOADING_TIPS[loadingTipIndex].text}
            </Text>

            {/* Learning fact */}
            <View style={styles.loadingFactContainer}>
              <Text style={styles.loadingFactLabel}>💡 Did you know?</Text>
              <Text style={styles.loadingFact}>{loadingFact}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Top gradient for status bar */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Streak badge - top right */}
      {stats.streak > 0 && (
        <View style={[styles.streakBadge, { top: insets.top + 10 }]}>
          <Ionicons name="flame" size={16} color={colors.xp} />
          <Text style={styles.streakText}>{stats.streak}</Text>
        </View>
      )}

      {/* Center prompt */}
      {!isAnalyzing && (
        <View style={styles.centerPrompt} pointerEvents="none">
          <Text style={styles.promptTitle}>{t.camera.exploreSnapLearn}</Text>
          <Text style={styles.promptSubtitle}>
            {t.camera.snapPhotosEarnSteps}
          </Text>
        </View>
      )}

      {/* Bottom gradient and controls */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 90 }]}
      >
        {/* Control buttons */}
        <View style={styles.controlsRow}>
          {/* Gallery picker */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={handlePickImage}
            disabled={isCapturing || isAnalyzing}
            accessibilityLabel="Choose photo from gallery"
            accessibilityRole="button"
          >
            <Ionicons name="images" size={26} color={colors.white} />
            <Text style={styles.sideButtonText}>{t.camera.gallery}</Text>
          </TouchableOpacity>

          {/* Capture button */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              (isCapturing || isAnalyzing) && styles.captureButtonDisabled,
            ]}
            onPress={handleCapture}
            disabled={isCapturing || isAnalyzing}
            activeOpacity={0.8}
            accessibilityLabel="Take photo"
            accessibilityRole="button"
            accessibilityState={{ disabled: isCapturing || isAnalyzing }}
          >
            <View style={styles.captureInner}>
              <Ionicons name="camera" size={28} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {/* Flip camera button */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={toggleCameraFacing}
            disabled={isCapturing || isAnalyzing}
            accessibilityLabel="Flip camera"
            accessibilityRole="button"
          >
            <Ionicons name="camera-reverse" size={26} color={colors.white} />
            <Text style={styles.sideButtonText}>{t.camera.flip}</Text>
          </TouchableOpacity>
        </View>

        {/* Pending lessons carousel */}
        {pendingLessons.length > 0 && (
          <View style={styles.pendingSection}>
            <Text style={styles.pendingLabel}>
              {nativeLanguage.code === 'ja'
                ? `${pendingLessons.length > 1 ? t.camera.pendingQuizzes : t.camera.pendingQuiz} : ${pendingLessons.length}`
                : `${pendingLessons.length} ${pendingLessons.length > 1 ? t.camera.pendingQuizzes : t.camera.pendingQuiz}`}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pendingScroll}
            >
              {pendingLessons.map((lesson) => {
                const mainWord = lesson.words.find(w => w.isMainSubject) || lesson.words[0];
                return (
                  <View key={lesson.id} style={styles.pendingCardContainer}>
                    <TouchableOpacity
                      style={styles.pendingCard}
                      onPress={() => handleContinueLesson(lesson)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: resolveImageUri(lesson.imageUri) }}
                        style={styles.pendingImage}
                      />
                      <View style={styles.pendingOverlay}>
                        <Text style={styles.pendingWord} numberOfLines={1}>
                          {mainWord?.japanese || ''}
                        </Text>
                      </View>
                      <View style={styles.pendingBadge}>
                        <Ionicons name="school" size={10} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pendingDelete}
                      onPress={() => handleDeleteLesson(lesson)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons name="close" size={12} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

      </LinearGradient>

      {/* Paywall is rendered at root level in _layout.tsx */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  photoBackground: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 50,
  },

  // Permission Screen
  permissionContainer: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    color: colors.textPrimary,
    fontSize: typography.xxl,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  permissionText: {
    color: colors.textSecondary,
    fontSize: typography.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },

  // Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 320,
  },
  loadingEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  loadingProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  loadingProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  loadingText: {
    color: colors.textPrimary,
    fontSize: typography.base,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingFactContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
    alignItems: 'center',
  },
  loadingFactLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginBottom: spacing.xs,
  },
  loadingFact: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  loadingSubtext: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },

  // Top gradient
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 5,
  },

  // Streak badge
  streakBadge: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
    zIndex: 10,
  },
  streakText: {
    color: colors.xp,
    fontSize: typography.sm,
    fontWeight: '700',
  },

  // Center prompt
  centerPrompt: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  promptTitle: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  promptSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.base,
    textAlign: 'center',
    marginTop: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom gradient
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.xxl,
  },

  // Controls row
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  sideButton: {
    alignItems: 'center',
    width: 60,
    gap: spacing.xs,
  },
  sideButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: '500',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom hint
  bottomHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: typography.sm,
    textAlign: 'center',
  },

  // Pending lessons section
  pendingSection: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  pendingLabel: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  pendingScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pendingCard: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pendingImage: {
    width: '100%',
    height: '100%',
  },
  pendingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  pendingWord: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  pendingBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    padding: 2,
  },
  pendingCardContainer: {
    position: 'relative',
  },
  pendingDelete: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },

  // Hint (for exploration mode)
  hintContainer: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },

  // Toast styles
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    zIndex: 200,
  },
  toastText: {
    color: colors.white,
    fontSize: typography.sm,
    flex: 1,
  },
  toastWord: {
    fontWeight: '700',
    color: colors.mint,
  },
});
