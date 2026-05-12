/**
 * MemoryPathMap.tsx
 *
 * Gamified map showing Memory Path system with:
 * - Unlocked spots (earned through quizzes)
 * - Animated footstep paths connecting spots
 * - Step count tracking and rewards
 * - Clean Apple Maps-style UI
 */

import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../store';
import { MemorySpot, MemoryPath, PhotoLesson } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { getTranslations } from '../../constants/translations';
import * as Location from 'expo-location';
import { getRegionForCoordinates, getCurrentLocation } from '../../utils/location';
import { speakJapanese } from '../../utils/speech';
import { resolveImageUri } from '../../utils/photoStorage';
import { FlashcardReview } from '../FlashcardReview';
import { getHoursUntilReview, getMemoryStatusFromSRS } from '../../utils/srs';

const STEPS_PER_MILE = 2000;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MemoryPathMapProps {
  onStudyWord: (lesson: PhotoLesson) => void;
  newlyUnlockedSpot?: MemorySpot | null;
  newPath?: MemoryPath | null;
  stepsEarned?: number;
  onAnimationComplete?: () => void;
}

// Cluster spots that are very close together (within ~50 meters)
interface SpotCluster {
  id: string;
  spots: MemorySpot[];
  latitude: number;
  longitude: number;
}

function clusterSpots(spots: MemorySpot[], thresholdMeters: number = 50): SpotCluster[] {
  const clusters: SpotCluster[] = [];
  const used = new Set<string>();

  for (const spot of spots) {
    if (used.has(spot.id)) continue;

    const cluster: SpotCluster = {
      id: spot.id,
      spots: [spot],
      latitude: spot.coordinates.latitude,
      longitude: spot.coordinates.longitude,
    };
    used.add(spot.id);

    // Find nearby spots
    for (const other of spots) {
      if (used.has(other.id)) continue;

      const distance = getDistanceMeters(
        spot.coordinates.latitude,
        spot.coordinates.longitude,
        other.coordinates.latitude,
        other.coordinates.longitude
      );

      if (distance < thresholdMeters) {
        cluster.spots.push(other);
        used.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get the worst memory status among all words in a lesson (for thumbnail color)
function getWorstMemoryStatus(lesson: PhotoLesson | undefined): 'fresh' | 'strong' | 'fading' | 'weak' {
  if (!lesson?.words) return 'fresh';

  const STATUS_PRIORITY: Record<string, number> = { weak: 0, due: 0, fading: 1, strong: 2, fresh: 3 };
  let worstPriority = 3; // Start with fresh (best)

  for (const word of lesson.words) {
    if (word.srs) {
      const status = getMemoryStatusFromSRS(word.srs);
      const priority = STATUS_PRIORITY[status] ?? 3;
      if (priority < worstPriority) {
        worstPriority = priority;
      }
    }
  }

  // Map priority back to status
  if (worstPriority === 0) return 'weak';
  if (worstPriority === 1) return 'fading';
  if (worstPriority === 2) return 'strong';
  return 'fresh';
}

export function MemoryPathMap({
  onStudyWord,
  newlyUnlockedSpot,
  newPath,
  stepsEarned = 0,
  onAnimationComplete,
}: MemoryPathMapProps) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [selectedSpot, setSelectedSpot] = useState<MemorySpot | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<SpotCluster | null>(null);
  const [showStepsPopup, setShowStepsPopup] = useState(false);
  const [animatingPathId, setAnimatingPathId] = useState<string | null>(null);
  const [markerKey, setMarkerKey] = useState(0); // Force marker remount when needed
  const [showFlashcardReview, setShowFlashcardReview] = useState(false);
  const [flashcardLesson, setFlashcardLesson] = useState<PhotoLesson | null>(null);
  const [showFadingToast, setShowFadingToast] = useState(false);

  // DEV ONLY: Debug state override for testing visual states
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugOverride, setDebugOverride] = useState<{
    memoryStatus: 'fresh' | 'strong' | 'fading' | 'weak' | 'forgotten' | null;
    hoursUntilReview: number | null;
  }>({ memoryStatus: null, hoursUntilReview: null });
  const hasShownFadingToast = useRef(false);
  const footstepProgress = useRef(new Animated.Value(0)).current;
  const clusterPickerAnim = useRef(new Animated.Value(0)).current;
  const fadingToastAnim = useRef(new Animated.Value(0)).current;

  // Animations
  const spotScaleAnim = useRef(new Animated.Value(0)).current;
  const pathOpacityAnim = useRef(new Animated.Value(0)).current;
  const stepsPopupAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  const {
    memorySpots,
    memoryPaths,
    totalSteps,
    stats,
    lessons,
    deleteSpot,
    nativeLanguage,
    getFadingMemories,
    reviewMemory,
    reviewWordSRS,
    resetRescueCombo,
  } = useAppStore();

  // Get translations for user's native language
  const t = getTranslations(nativeLanguage.code);

  // Location state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Filter to only valid spots (have coordinates and imageUri)
  const validSpots = useMemo(() => {
    return memorySpots.filter(s => {
      const hasCoords = s.coordinates?.latitude != null && s.coordinates?.longitude != null;
      const hasImage = !!s.imageUri;
      return hasCoords && hasImage;
    });
  }, [memorySpots]);

  // Cluster nearby spots together
  const spotClusters = useMemo(() => clusterSpots(validSpots), [validSpots]);

  // Get fading memories for review prompt
  const fadingMemories = useMemo(() => getFadingMemories(), [lessons]);
  const hasFadingMemories = fadingMemories.length > 0;

  // Create a signature of lesson review states to detect when reviews happen
  const lessonsReviewSignature = useMemo(() => {
    return lessons.map(l => `${l.id}:${l.memoryStatus}:${l.lastReviewedAt || ''}`).join(',');
  }, [lessons]);

  // Force marker refresh when lesson review states change
  useEffect(() => {
    setMarkerKey(prev => prev + 1);
  }, [lessonsReviewSignature]);

  // Show toast when fading memories are first detected
  useEffect(() => {
    if (hasFadingMemories && !hasShownFadingToast.current) {
      hasShownFadingToast.current = true;
      setShowFadingToast(true);
      fadingToastAnim.setValue(0);
      Animated.sequence([
        Animated.timing(fadingToastAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(4000),
        Animated.timing(fadingToastAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setShowFadingToast(false));
    }
  }, [hasFadingMemories]);

  // Handle flashcard review completion
  const handleFlashcardComplete = useCallback((reviewedCount: number) => {
    setShowFlashcardReview(false);
    setFlashcardLesson(null);
    resetRescueCombo(); // Reset combo when session ends
    // Force markers to re-render with updated memory status
    setMarkerKey(prev => prev + 1);
    if (reviewedCount > 0) {
      Alert.alert(
        'Great work!',
        `You reviewed ${reviewedCount} ${reviewedCount === 1 ? 'word' : 'words'}. Your memories are getting stronger!`,
        [{ text: 'OK' }]
      );
    }
  }, [resetRescueCombo]);

  // Handle individual word review in flashcard (SRS-based)
  const handleWordReview = useCallback((lessonId: string, wordId: string, isCorrect: boolean, responseTimeMs?: number) => {
    // Use SRS-based word review for proper spaced repetition
    reviewWordSRS(lessonId, wordId, isCorrect, responseTimeMs);
  }, [reviewWordSRS]);

  // Debug logging
  if (__DEV__) console.log(`MemoryPathMap: ${validSpots.length} spots in ${spotClusters.length} clusters, ${fadingMemories.length} fading`);

  // Calculate initial region - prefer user location, fallback to spots
  const initialRegion = useMemo(() => {
    // Use user's current location if available
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    // Fallback to stored spots if no user location yet
    if (validSpots.length > 0) {
      const coords = validSpots.map(s => ({
        latitude: s.coordinates.latitude,
        longitude: s.coordinates.longitude,
      }));
      return getRegionForCoordinates(coords);
    }

    // Default fallback
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }, [userLocation, validSpots]);

  // Center map on user location when first obtained
  const hasInitializedLocation = useRef(false);
  useEffect(() => {
    if (userLocation && mapRef.current && !hasInitializedLocation.current) {
      hasInitializedLocation.current = true;
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  }, [userLocation]);

  // Animate new spot unlock and zoom to show path
  useEffect(() => {
    if (newlyUnlockedSpot && newPath) {
      // Find the "from" spot to show the path between both spots
      const fromSpot = memorySpots.find(s => s.id === newPath.fromSpotId);

      if (fromSpot) {
        // Calculate region to show both spots
        const coords = [
          { latitude: fromSpot.coordinates.latitude, longitude: fromSpot.coordinates.longitude },
          { latitude: newlyUnlockedSpot.coordinates.latitude, longitude: newlyUnlockedSpot.coordinates.longitude },
        ];
        const pathRegion = getRegionForCoordinates(coords);

        // Zoom to show path between both spots
        mapRef.current?.animateToRegion(pathRegion, 800);
      } else {
        // No previous spot, just center on new one
        mapRef.current?.animateToRegion({
          latitude: newlyUnlockedSpot.coordinates.latitude,
          longitude: newlyUnlockedSpot.coordinates.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 500);
      }

      // Animate spot appearing
      spotScaleAnim.setValue(0);
      Animated.spring(spotScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else if (newlyUnlockedSpot) {
      // First spot, no path - just center on it
      mapRef.current?.animateToRegion({
        latitude: newlyUnlockedSpot.coordinates.latitude,
        longitude: newlyUnlockedSpot.coordinates.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);

      spotScaleAnim.setValue(0);
      Animated.spring(spotScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [newlyUnlockedSpot, newPath, memorySpots]);

  // Animate new path with footsteps
  useEffect(() => {
    if (newPath && stepsEarned > 0) {
      setAnimatingPathId(newPath.id);
      footstepProgress.setValue(0);

      // Animate footsteps walking along the path
      Animated.timing(footstepProgress, {
        toValue: 1,
        duration: 2000, // 2 seconds for footstep animation
        useNativeDriver: false,
      }).start(() => {
        // After footsteps complete, show steps earned popup
        setShowStepsPopup(true);
        stepsPopupAnim.setValue(0);
        Animated.sequence([
          Animated.spring(stepsPopupAnim, {
            toValue: 1,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
          }),
          Animated.delay(2500),
          Animated.timing(stepsPopupAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowStepsPopup(false);
          setAnimatingPathId(null);
          // Force markers to remount by changing their key prefix
          setMarkerKey(k => k + 1);
          // Notify parent that animation is complete
          onAnimationComplete?.();
        });
      });
    }
  }, [newPath, stepsEarned, onAnimationComplete]);

  // Get user location on mount
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 100,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setUserLocation({ latitude, longitude });
        }
      );
    };

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Handle spot tap
  const handleSpotPress = (spot: MemorySpot) => {
    setSelectedSpot(spot);
    cardAnim.setValue(0);
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  // Close floating card
  const closeCard = () => {
    Animated.timing(cardAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setSelectedSpot(null));
  };

  // Get lesson for study
  const getLesson = (lessonId: string) => {
    return lessons.find(l => l.id === lessonId);
  };

  // Delete a spot with confirmation
  const handleDeleteSpot = (spot: MemorySpot) => {
    Alert.alert(
      'Delete Photo',
      `Delete "${spot.mainWord.japanese}" and its associated data? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            closeCard();
            deleteSpot(spot.id);
          },
        },
      ]
    );
  };

  // Format step count nicely
  const formatSteps = (steps: number): string => {
    if (steps >= 1000) {
      return `${(steps / 1000).toFixed(1)}k`;
    }
    return steps.toLocaleString();
  };

  // Empty state - show if no valid spots
  if (validSpots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <Ionicons name="footsteps-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Start Your Memory Path</Text>
          <Text style={styles.emptyText}>
            Take a photo, learn the words, and pass the quiz to unlock your first spot on the map
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
        onPress={() => selectedSpot && closeCard()}
      >
        {/* Animated footsteps - only show during animation */}
        {animatingPathId && (() => {
          const path = memoryPaths.find(p => p.id === animatingPathId);
          if (!path) return null;

          const fromSpot = memorySpots.find(s => s.id === path.fromSpotId);
          const toSpot = memorySpots.find(s => s.id === path.toSpotId);
          if (!fromSpot || !toSpot) return null;

          // Generate footstep points along the path
          const numFootsteps = Math.max(4, Math.min(10, Math.floor((path.distanceSteps || path.distanceMiles * STEPS_PER_MILE) / 400)));
          const footsteps = [];
          for (let i = 0; i <= numFootsteps; i++) {
            const t = i / numFootsteps;
            footsteps.push({
              latitude: fromSpot.coordinates.latitude + t * (toSpot.coordinates.latitude - fromSpot.coordinates.latitude),
              longitude: fromSpot.coordinates.longitude + t * (toSpot.coordinates.longitude - fromSpot.coordinates.longitude),
              rotation: Math.atan2(
                toSpot.coordinates.latitude - fromSpot.coordinates.latitude,
                toSpot.coordinates.longitude - fromSpot.coordinates.longitude
              ) * (180 / Math.PI) + 90,
            });
          }

          return footsteps.map((pos, i) => (
            <Marker
              key={`footstep-${i}`}
              coordinate={{ latitude: pos.latitude, longitude: pos.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
            >
              <View style={[
                styles.footstepMarker,
                { transform: [{ rotate: `${pos.rotation}deg` }] },
              ]}>
                <Text style={[
                  styles.footstepEmoji,
                  i % 2 === 0 ? { transform: [{ scaleX: -1 }] } : null,
                ]}>
                  👣
                </Text>
              </View>
            </Marker>
          ));
        })()}

        {/* Memory Spot Clusters */}
        {spotClusters.map((cluster) => {
          const primarySpot = cluster.spots[0];
          const isNew = cluster.spots.some(s => newlyUnlockedSpot?.id === s.id);
          const isSelected = cluster.spots.some(s => selectedSpot?.id === s.id);
          const count = cluster.spots.length;

          // Get WORST memory status across ALL photos in the cluster (matches Memory Strength bar)
          const lesson = lessons.find(l => l.id === primarySpot.lessonId);
          let actualMemoryStatus = getWorstMemoryStatus(lesson);

          // For clusters with multiple photos, find the worst status among all
          if (count > 1) {
            const STATUS_PRIORITY: Record<string, number> = { weak: 0, fading: 1, strong: 2, fresh: 3 };
            for (const spot of cluster.spots) {
              const spotLesson = lessons.find(l => l.id === spot.lessonId);
              const spotStatus = getWorstMemoryStatus(spotLesson);
              if ((STATUS_PRIORITY[spotStatus] ?? 3) < (STATUS_PRIORITY[actualMemoryStatus] ?? 3)) {
                actualMemoryStatus = spotStatus;
              }
            }
          }

          // Calculate hours until the earliest word review in this lesson
          let actualHoursUntilReview: number | null = null;
          if (lesson && lesson.words) {
            lesson.words.forEach((word) => {
              if (word.srs) {
                const hours = getHoursUntilReview(word.srs);
                if (actualHoursUntilReview === null || hours < actualHoursUntilReview) {
                  actualHoursUntilReview = hours;
                }
              }
            });
          }

          // DEV: Apply debug override if set
          const memoryStatus = __DEV__ && debugOverride.memoryStatus ? debugOverride.memoryStatus : actualMemoryStatus;
          const hoursUntilReview = __DEV__ && debugOverride.hoursUntilReview !== null ? debugOverride.hoursUntilReview : actualHoursUntilReview;

          return (
            <Marker
              key={`${markerKey}-${cluster.id}`}
              coordinate={{
                latitude: cluster.latitude,
                longitude: cluster.longitude,
              }}
              tracksViewChanges={true}
              onPress={() => {
                if (count > 1) {
                  setSelectedCluster(cluster);
                  clusterPickerAnim.setValue(0);
                  Animated.spring(clusterPickerAnim, {
                    toValue: 1,
                    tension: 80,
                    friction: 10,
                    useNativeDriver: true,
                  }).start();
                } else if (lesson) {
                  setFlashcardLesson(lesson);
                  setShowFlashcardReview(true);
                }
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <SpotIcon
                spot={primarySpot}
                isNew={isNew}
                isSelected={isSelected}
                count={count}
                memoryStatus={memoryStatus}
              />
            </Marker>
          );
        })}

      </MapView>

      {/* Scoreboard Header */}
      <View style={[styles.scoreboard, { top: insets.top + spacing.sm }]}>
        <View style={styles.stepsBadge}>
          <Ionicons name="footsteps" size={16} color={colors.primary} />
          <Text style={styles.stepsText}>{formatSteps(totalSteps || 0)}</Text>
        </View>

        <View style={styles.statsBadges}>
          <View style={styles.xpBadge}>
            <Ionicons name="star" size={14} color={colors.xp} />
            <Text style={styles.xpText}>{stats.xp}</Text>
          </View>
          {stats.streak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={14} color="#FF6B35" />
              <Text style={styles.streakText}>{stats.streak}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Spots count */}
      <View style={[styles.spotsCounter, { top: insets.top + 60 }]}>
        <Ionicons name="location" size={14} color={colors.primary} />
        <Text style={styles.spotsCountText}>
          {validSpots.length} {validSpots.length === 1 ? t.quest.spot : t.quest.spots}
        </Text>
      </View>



      {/* Steps Earned Popup */}
      {showStepsPopup && stepsEarned > 0 && (
        <Animated.View
          style={[
            styles.stepsPopup,
            {
              opacity: stepsPopupAnim,
              transform: [
                { scale: stepsPopupAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                })},
                { translateY: stepsPopupAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                })},
              ],
            },
          ]}
        >
          <Ionicons name="footsteps" size={24} color={colors.white} />
          <Text style={styles.stepsPopupText}>+{formatSteps(stepsEarned)} steps</Text>
        </Animated.View>
      )}

      {/* Fading Memory Toast */}
      {showFadingToast && (
        <Animated.View
          style={[
            styles.fadingToast,
            { top: insets.top + 100, opacity: fadingToastAnim },
          ]}
        >
          <View style={styles.fadingToastIcon}>
            <Ionicons name="alert-circle" size={18} color={colors.white} />
          </View>
          <View style={styles.fadingToastContent}>
            <Text style={styles.fadingToastTitle}>Photos disappearing!</Text>
            <Text style={styles.fadingToastText}>
              Tap "Review" to save them before they're lost
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Cluster Picker - shows when tapping a marker with multiple photos */}
      {selectedCluster && selectedCluster.spots.length > 1 && (
        <>
          {/* Backdrop to dismiss */}
          <TouchableOpacity
            style={styles.clusterBackdrop}
            activeOpacity={1}
            onPress={() => {
              Animated.timing(clusterPickerAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start(() => setSelectedCluster(null));
            }}
          />
          <Animated.View
            style={[
              styles.clusterPicker,
              {
                bottom: insets.bottom + 220,
                opacity: clusterPickerAnim,
                transform: [
                  { translateY: clusterPickerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  })},
                ],
              },
            ]}
          >
            <View style={styles.clusterPickerHeader}>
              <Text style={styles.clusterPickerTitle}>
                {selectedCluster.spots.length} Photos at this location
              </Text>
              <TouchableOpacity
                style={styles.clusterCloseButton}
                onPress={() => {
                  Animated.timing(clusterPickerAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }).start(() => setSelectedCluster(null));
                }}
              >
                <Ionicons name="close" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.clusterPickerScroll}
          >
            {selectedCluster.spots.map((spot) => {
              const spotLesson = lessons.find(l => l.id === spot.lessonId);
              const spotStatus = getWorstMemoryStatus(spotLesson);
              const needsReview = spotStatus === 'fading' || spotStatus === 'weak';
              return (
                <TouchableOpacity
                  key={spot.id}
                  style={styles.clusterPickerItem}
                  onPress={() => {
                    setSelectedCluster(null);
                    // Open flashcards for this specific photo
                    if (spotLesson) {
                      setFlashcardLesson(spotLesson);
                      setShowFlashcardReview(true);
                    }
                  }}
                >
                  <View>
                    <Image
                      source={{ uri: resolveImageUri(spot.imageUri) }}
                      style={styles.clusterPickerImage}
                      resizeMode="cover"
                    />
                    {needsReview && (
                      <View style={styles.pickerReviewBadge}>
                        <Ionicons name="flash" size={8} color={colors.white} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.clusterPickerWord} numberOfLines={1}>
                    {spot.mainWord.japanese}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
        </>
      )}

      {/* Selected Spot Card */}
      {selectedSpot && (
        <>
          {/* Backdrop to dismiss */}
          <TouchableOpacity
            style={styles.spotBackdrop}
            activeOpacity={1}
            onPress={closeCard}
          />
          <Animated.View
            style={[
              styles.spotCard,
              {
                bottom: insets.bottom + 220,
                opacity: cardAnim,
                transform: [
                  { scale: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  })},
                  { translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  })},
                ],
              },
            ]}
          >
            <TouchableOpacity style={styles.cardClose} onPress={closeCard}>
              <Ionicons name="close" size={18} color={colors.white} />
            </TouchableOpacity>

          <Image
            source={{ uri: resolveImageUri(selectedSpot.imageUri) }}
            style={styles.cardImage}
            resizeMode="cover"
          />

          <View style={styles.cardContent}>
            <TouchableOpacity
              style={styles.cardWordRow}
              onPress={() => speakJapanese(selectedSpot.mainWord.japanese)}
            >
              <Text style={styles.cardJapanese}>{selectedSpot.mainWord.japanese}</Text>
              <Ionicons name="volume-high" size={18} color={colors.primary} />
            </TouchableOpacity>

            {selectedSpot.mainWord.reading && (
              <Text style={styles.cardReading}>{selectedSpot.mainWord.reading}</Text>
            )}
            <Text style={styles.cardEnglish}>{selectedSpot.mainWord.english}</Text>

            {/* Check if this photo is fading */}
            {(() => {
              const lesson = getLesson(selectedSpot.lessonId);
              const isFadingLesson = lesson && (lesson.memoryStatus === 'fading' || lesson.memoryStatus === 'weak' || lesson.memoryStatus === 'forgotten');

              if (isFadingLesson) {
                // Fading: Show Review as primary action
                return (
                  <>
                    <View style={styles.fadingWarning}>
                      <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                      <Text style={styles.fadingWarningText}>Memory fading - review to save!</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => {
                          closeCard();
                          if (lesson) setFlashcardLesson(lesson);
                          setShowFlashcardReview(true);
                        }}
                      >
                        <Ionicons name="refresh" size={18} color={colors.white} />
                        <Text style={styles.studyButtonText}>Review Now</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.studyButtonSecondary}
                        onPress={() => {
                          if (lesson) {
                            closeCard();
                            onStudyWord(lesson);
                          }
                        }}
                      >
                        <Ionicons name="book-outline" size={16} color={colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteSpot(selectedSpot)}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </>
                );
              }

              // Not fading: Show Study as primary
              return (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.studyButton}
                    onPress={() => {
                      if (lesson) {
                        closeCard();
                        onStudyWord(lesson);
                      }
                    }}
                  >
                    <Ionicons name="book-outline" size={18} color={colors.white} />
                    <Text style={styles.studyButtonText}>Study</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSpot(selectedSpot)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </Animated.View>
        </>
      )}

      {/* Locate button */}
      <View style={[styles.controls, { bottom: insets.bottom + 180 }]}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => mapRef.current?.animateToRegion(initialRegion, 500)}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Flashcard Review Overlay */}
      <FlashcardReview
        visible={showFlashcardReview}
        lessons={flashcardLesson ? [flashcardLesson] : fadingMemories}
        onClose={() => {
          setShowFlashcardReview(false);
          setFlashcardLesson(null);
        }}
        onComplete={handleFlashcardComplete}
        onReviewWord={handleWordReview}
      />

      {/* DEV ONLY: Debug Panel for testing thumbnail states */}
      {__DEV__ && (
        <>
          {/* Debug Toggle Button */}
          <TouchableOpacity
            style={[styles.debugToggle, { bottom: insets.bottom + 250 }]}
            onPress={() => setShowDebugPanel(!showDebugPanel)}
          >
            <Ionicons name="bug" size={20} color={colors.white} />
          </TouchableOpacity>

          {/* Debug Panel */}
          {showDebugPanel && (
            <View style={[styles.debugPanel, { bottom: insets.bottom + 300 }]}>
              <Text style={styles.debugTitle}>Test Review Badge</Text>

              <Text style={styles.debugLabel}>Show badge on all thumbnails:</Text>
              <View style={styles.debugRow}>
                {([
                  { status: 'fresh', label: '✓ No Badge' },
                  { status: 'fading', label: '⚡ Review Badge' },
                ] as const).map(({ status, label }) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.debugBtn,
                      debugOverride.memoryStatus === status && styles.debugBtnActive,
                    ]}
                    onPress={() => {
                      setDebugOverride(prev => ({
                        ...prev,
                        memoryStatus: prev.memoryStatus === status ? null : status,
                      }));
                      setMarkerKey(k => k + 1);
                    }}
                  >
                    <Text style={[
                      styles.debugBtnText,
                      debugOverride.memoryStatus === status && styles.debugBtnTextActive,
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.debugInfo}>
                {debugOverride.memoryStatus
                  ? `Override: ${debugOverride.memoryStatus}`
                  : 'Using real values'}
              </Text>

              <TouchableOpacity
                style={styles.debugResetBtn}
                onPress={() => {
                  setDebugOverride({ memoryStatus: null, hoursUntilReview: null });
                  setMarkerKey(k => k + 1);
                }}
              >
                <Text style={styles.debugResetText}>Reset to Real Values</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

    </View>
  );
}

// Format hours into readable time badge
function formatTimeBadge(hours: number): string {
  if (hours <= 0) return 'now';
  if (hours < 1) return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

// Memory status colors matching the Progress page Memory Strength bar
const MEMORY_STATUS_COLORS = {
  fresh: '#10B981',    // Green
  strong: '#3B82F6',   // Blue
  fading: '#F59E0B',   // Yellow/Orange
  weak: '#EF4444',     // Red
  forgotten: '#EF4444', // Red
};

// Spot marker component - Platform-specific rendering
function SpotIcon({
  spot,
  isNew,
  isSelected,
  count = 1,
  memoryStatus = 'fresh',
}: {
  spot: MemorySpot;
  isNew: boolean;
  isSelected: boolean;
  count?: number;
  memoryStatus?: 'fresh' | 'strong' | 'fading' | 'weak' | 'forgotten';
}) {
  const needsReview = memoryStatus === 'fading' || memoryStatus === 'weak' || memoryStatus === 'forgotten';
  const imageSize = SPOT_SIZE - 6;

  // Android: Clean pin marker (Images don't render properly in Android map markers)
  // TODO: Implement pre-rendered circular thumbnails for photo display
  if (Platform.OS === 'android') {
    const pinColor = needsReview ? '#F59E0B' : colors.primary;

    return (
      <View collapsable={false} style={{ alignItems: 'center' }}>
        <View
          collapsable={false}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            collapsable={false}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: pinColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={needsReview ? 'flash' : 'image'}
              size={18}
              color={colors.white}
            />
          </View>
          {count > 1 && (
            <View style={{
              position: 'absolute',
              top: -2,
              right: -2,
              backgroundColor: pinColor,
              borderRadius: 10,
              minWidth: 20,
              height: 20,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 2,
              borderColor: colors.white,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.white }}>{count}</Text>
            </View>
          )}
        </View>
        <View style={{
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderTopWidth: 10,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: colors.white,
          marginTop: -2,
        }} />
      </View>
    );
  }

  // iOS: Full thumbnail with circular clipping (works properly)
  return (
    <View
      collapsable={false}
      style={[
        styles.spotContainer,
        isSelected && styles.spotSelected,
        { width: SPOT_SIZE + 4, minHeight: SPOT_SIZE + 12 },
      ]}
    >
      <View
        collapsable={false}
        style={{
          width: SPOT_SIZE,
          height: SPOT_SIZE,
          borderRadius: SPOT_SIZE / 2,
          backgroundColor: colors.white,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        }}
      >
        <Image
          source={{ uri: resolveImageUri(spot.imageUri) }}
          style={{
            width: imageSize,
            height: imageSize,
            borderRadius: imageSize / 2,
          }}
          resizeMode="cover"
        />
      </View>
      {count > 1 && (
        <View style={[styles.countBadge, needsReview && styles.countBadgeNeedsReview]}>
          {needsReview && <Ionicons name="flash" size={9} color={colors.white} style={{ marginRight: 1 }} />}
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
      {needsReview && count <= 1 && (
        <View style={styles.reviewBadge}>
          <Ionicons name="flash" size={10} color={colors.white} />
        </View>
      )}
      <View style={styles.spotPointer} />
    </View>
  );
}

const SPOT_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // Scoreboard
  scoreboard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  stepsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  stepsText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  statsBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  xpText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streakText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '700',
  },

  // Spots counter
  spotsCounter: {
    position: 'absolute',
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  spotsCountText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Spot marker
  spotContainer: {
    alignItems: 'center',
  },
  spotBubble: {
    width: SPOT_SIZE,
    height: SPOT_SIZE,
    borderRadius: SPOT_SIZE / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotNew: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  spotSelected: {
    transform: [{ scale: 1.1 }],
  },
  spotImageContainer: {
    width: SPOT_SIZE - 6,
    height: SPOT_SIZE - 6,
    borderRadius: (SPOT_SIZE - 6) / 2,
    overflow: 'hidden',
  },
  spotImage: {
    width: SPOT_SIZE - 6,
    height: SPOT_SIZE - 6,
    borderRadius: (SPOT_SIZE - 6) / 2,
  },
  spotImageFallback: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.white,
    marginTop: -2,
  },
  reviewBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 10,
  },
  // Footstep markers (only visible during animation)
  footstepMarker: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 8,
    padding: 2,
  },
  footstepEmoji: {
    fontSize: 18,
  },

  // Steps popup
  stepsPopup: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stepsPopupText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
  },

  // Spot card
  spotBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  spotCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  cardClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardContent: {
    padding: spacing.md,
  },
  cardWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardJapanese: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  cardReading: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardEnglish: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  studyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  studyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${colors.error}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Review button (for fading memories)
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  studyButtonSecondary: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fadingWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
  },
  fadingWarningText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '500',
  },

  // Controls
  controls: {
    position: 'absolute',
    right: spacing.md,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // Count badge for clustered spots
  countBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 10,
  },
  countBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  countBadgeNeedsReview: {
    backgroundColor: '#F59E0B',
  },

  // Cluster picker
  clusterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  clusterPicker: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  clusterPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  clusterCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clusterPickerScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  clusterPickerItem: {
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  clusterPickerImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  pickerReviewBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  clusterPickerWord: {
    fontSize: 12,
    color: '#666',
    maxWidth: 70,
    textAlign: 'center',
  },

  // Compact Review Pill
  reviewPill: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    gap: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  reviewPillText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: '700',
  },

  // Fading Memory Toast
  fadingToast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fadingToastIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fadingToastContent: {
    flex: 1,
  },
  fadingToastTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  fadingToastText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },

  // DEV ONLY: Debug Panel Styles
  debugToggle: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  debugPanel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: 16,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  debugTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  debugLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  debugRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  debugBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  debugBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  debugBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  debugBtnTextActive: {
    color: colors.white,
  },
  debugInfo: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  debugResetBtn: {
    marginTop: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    alignItems: 'center',
  },
  debugResetText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },

});

export default MemoryPathMap;
