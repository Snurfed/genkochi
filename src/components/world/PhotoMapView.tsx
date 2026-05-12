/**
 * PhotoMapView.tsx
 *
 * Apple Photos-style map view showing photos at their GPS locations.
 * Clusters nearby photos and shows expandable photo stacks.
 */

import React, { useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoLesson } from '../../types';
import { colors, borderRadius, spacing } from '../../constants/design';
import { getRegionForCoordinates } from '../../utils/location';
import { speakJapanese } from '../../utils/speech';
import { resolveImageUri } from '../../utils/photoStorage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoMapViewProps {
  lessons: PhotoLesson[];
  onLessonPress: (lesson: PhotoLesson) => void;
  onLessonDelete?: (lesson: PhotoLesson) => void;
}

// Photo cluster for grouping nearby lessons
interface PhotoCluster {
  id: string;
  latitude: number;
  longitude: number;
  lessons: PhotoLesson[];
}

const CLUSTER_RADIUS_KM = 0.3; // Cluster within 300m

export function PhotoMapView({ lessons, onLessonPress, onLessonDelete }: PhotoMapViewProps) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<PhotoCluster | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<PhotoLesson | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;

  // Filter lessons with valid coordinates
  const lessonsWithLocation = useMemo(() => {
    return lessons.filter(l => {
      const lat = l.coordinates?.latitude;
      const lng = l.coordinates?.longitude;

      // Basic type checks
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (isNaN(lat) || isNaN(lng)) return false;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;

      // Reject 0,0 (null island) - almost always invalid
      if (lat === 0 && lng === 0) return false;

      // Reject coordinates that are suspiciously round (likely defaults)
      // e.g., exactly 35.6762, 139.6503 (Tokyo default) with no decimal precision
      if (lat === 35.6762 && lng === 139.6503) return false;

      return true;
    });
  }, [lessons]);

  // Calculate initial region with safety checks
  const initialRegion = useMemo(() => {
    const DEFAULT_REGION = {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };

    if (lessonsWithLocation.length === 0) {
      return DEFAULT_REGION;
    }

    const coords = lessonsWithLocation.map(l => ({
      latitude: l.coordinates!.latitude,
      longitude: l.coordinates!.longitude,
    }));

    const region = getRegionForCoordinates(coords);

    // Final safety check - ensure valid region
    if (
      isNaN(region.latitude) ||
      isNaN(region.longitude) ||
      isNaN(region.latitudeDelta) ||
      isNaN(region.longitudeDelta) ||
      region.latitudeDelta > 180 ||
      region.longitudeDelta > 360
    ) {
      return DEFAULT_REGION;
    }

    return region;
  }, [lessonsWithLocation]);

  // Cluster lessons based on proximity
  const clusters = useMemo((): PhotoCluster[] => {
    if (lessonsWithLocation.length === 0) return [];

    // Determine cluster radius based on zoom level (with safety checks)
    const lngDelta = region?.longitudeDelta && region.longitudeDelta > 0 ? region.longitudeDelta : 0.5;
    const zoomLevel = Math.max(0, Math.min(20, Math.log2(360 / lngDelta)));
    const shouldCluster = zoomLevel < 13;

    if (!shouldCluster) {
      // Return individual markers
      return lessonsWithLocation.map(lesson => ({
        id: lesson.id,
        latitude: lesson.coordinates!.latitude,
        longitude: lesson.coordinates!.longitude,
        lessons: [lesson],
      }));
    }

    // Clustering algorithm
    const clustered: PhotoCluster[] = [];
    const used = new Set<string>();

    for (const lesson of lessonsWithLocation) {
      if (used.has(lesson.id)) continue;

      const cluster: PhotoCluster = {
        id: `cluster-${lesson.id}`,
        latitude: lesson.coordinates!.latitude,
        longitude: lesson.coordinates!.longitude,
        lessons: [lesson],
      };
      used.add(lesson.id);

      // Find nearby lessons
      for (const other of lessonsWithLocation) {
        if (used.has(other.id)) continue;

        const distance = getDistance(
          lesson.coordinates!.latitude,
          lesson.coordinates!.longitude,
          other.coordinates!.latitude,
          other.coordinates!.longitude
        );

        const clusterRadius = CLUSTER_RADIUS_KM * Math.pow(2, 13 - zoomLevel);

        if (distance < clusterRadius) {
          cluster.lessons.push(other);
          used.add(other.id);
        }
      }

      // Recalculate cluster center
      if (cluster.lessons.length > 1) {
        cluster.latitude = cluster.lessons.reduce((sum, l) => sum + l.coordinates!.latitude, 0) / cluster.lessons.length;
        cluster.longitude = cluster.lessons.reduce((sum, l) => sum + l.coordinates!.longitude, 0) / cluster.lessons.length;
      }

      clustered.push(cluster);
    }

    return clustered;
  }, [lessonsWithLocation, region]);

  // Handle cluster press - show photo detail or expand cluster
  const handleClusterPress = useCallback((cluster: PhotoCluster) => {
    if (cluster.lessons.length === 1) {
      // Show single photo detail
      setSelectedLesson(cluster.lessons[0]);
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      setExpandedCluster(cluster);
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  }, [expandAnim]);

  // Close any modal
  const closeModal = useCallback(() => {
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setExpandedCluster(null);
      setSelectedLesson(null);
    });
  }, [expandAnim]);

  // Handle delete with confirmation
  const handleDelete = useCallback((lesson: PhotoLesson) => {
    Alert.alert(
      'Delete Photo',
      `Delete this photo and its ${lesson.words.length} word${lesson.words.length === 1 ? '' : 's'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onLessonDelete?.(lesson);
            // Close modal and remove from expanded cluster if present
            if (expandedCluster) {
              const remaining = expandedCluster.lessons.filter(l => l.id !== lesson.id);
              if (remaining.length === 0) {
                closeModal();
              } else {
                setExpandedCluster({ ...expandedCluster, lessons: remaining });
              }
            } else {
              closeModal();
            }
          },
        },
      ]
    );
  }, [onLessonDelete, expandedCluster, closeModal]);

  // Empty state
  if (lessonsWithLocation.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <Ionicons name="map-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Photos on Map</Text>
          <Text style={styles.emptyText}>
            Photos you take will appear on the map at their location
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
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
      >
        {clusters.map(cluster => (
          <Marker
            key={cluster.id}
            coordinate={{
              latitude: cluster.latitude,
              longitude: cluster.longitude,
            }}
            onPress={() => handleClusterPress(cluster)}
            tracksViewChanges={false}
          >
            <PhotoMarker cluster={cluster} />
          </Marker>
        ))}
      </MapView>

      {/* Map controls */}
      <View style={[styles.controls, { top: insets.top + 60 }]}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => mapRef.current?.animateToRegion(initialRegion, 500)}
        >
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Single photo detail modal */}
      <Modal
        visible={selectedLesson !== null}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            { opacity: expandAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
          />

          {selectedLesson && (
            <Animated.View
              style={[
                styles.photoDetailContainer,
                {
                  transform: [
                    { scale: expandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    })},
                  ],
                  opacity: expandAnim,
                },
              ]}
            >
              {/* Photo with overlay showing main word */}
              <View style={styles.photoWrapper}>
                <Image
                  source={{ uri: resolveImageUri(selectedLesson.imageUri) }}
                  style={styles.photoDetailImage}
                  resizeMode="cover"
                />

                {/* Main word overlay on photo */}
                {selectedLesson.words[0] && (
                  <View style={styles.mainWordOverlay}>
                    <Text style={styles.mainWordJapanese}>
                      {selectedLesson.words[0].japanese}
                    </Text>
                    {selectedLesson.words[0].reading && (
                      <Text style={styles.mainWordReading}>
                        {selectedLesson.words[0].reading}
                      </Text>
                    )}
                  </View>
                )}

                {/* Audio button on photo */}
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => {
                    const allWords = selectedLesson.words.map(w => w.japanese).join('、');
                    speakJapanese(allWords);
                  }}
                >
                  <Ionicons name="volume-high" size={24} color={colors.white} />
                </TouchableOpacity>

                {/* Close button */}
                <TouchableOpacity
                  style={styles.photoDetailClose}
                  onPress={closeModal}
                >
                  <Ionicons name="close" size={28} color={colors.white} />
                </TouchableOpacity>
              </View>

              {/* Info section */}
              <View style={styles.photoDetailInfo}>
                {/* Location and date */}
                <View style={styles.metaRow}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.photoDetailLocation} numberOfLines={1}>
                      {selectedLesson.coordinates?.placeName || selectedLesson.location || 'Unknown'}
                    </Text>
                  </View>
                  <Text style={styles.photoDate}>
                    {new Date(selectedLesson.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>

                {/* Word chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.wordChipsScroll}
                  contentContainerStyle={styles.wordChipsContainer}
                >
                  {selectedLesson.words.map((word, index) => (
                    <TouchableOpacity
                      key={word.id}
                      style={styles.wordChip}
                      onPress={() => speakJapanese(word.japanese)}
                    >
                      <Text style={styles.wordChipJapanese}>{word.japanese}</Text>
                      <Text style={styles.wordChipEnglish}>{word.english}</Text>
                      {word.masteryScore >= 80 && (
                        <View style={styles.masteredBadge}>
                          <Ionicons name="checkmark" size={10} color={colors.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Mastery progress */}
                <View style={styles.masteryRow}>
                  <Text style={styles.masteryLabel}>Mastery</Text>
                  <View style={styles.masteryBarBg}>
                    <View
                      style={[
                        styles.masteryBarFill,
                        { width: `${selectedLesson.averageMastery}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.masteryPercent}>{Math.round(selectedLesson.averageMastery)}%</Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.photoDetailActions}>
                <TouchableOpacity
                  style={styles.photoDetailButton}
                  onPress={() => {
                    const lesson = selectedLesson;
                    closeModal();
                    setTimeout(() => onLessonPress(lesson), 200);
                  }}
                >
                  <Ionicons name="book-outline" size={22} color={colors.white} />
                  <Text style={styles.photoDetailButtonText}>Study These Words</Text>
                </TouchableOpacity>
              </View>

              {onLessonDelete && (
                <TouchableOpacity
                  style={styles.deleteLink}
                  onPress={() => handleDelete(selectedLesson)}
                >
                  <Text style={styles.deleteLinkText}>Delete Photo</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </Modal>

      {/* Expanded cluster modal */}
      <Modal
        visible={expandedCluster !== null}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            { opacity: expandAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
          />

          {expandedCluster && (
            <Animated.View
              style={[
                styles.expandedContainer,
                {
                  transform: [
                    { scale: expandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    })},
                  ],
                  opacity: expandAnim,
                },
              ]}
            >
              <BlurView intensity={90} tint="dark" style={styles.expandedBlur}>
                <View style={styles.expandedHeader}>
                  <Text style={styles.expandedTitle}>
                    {expandedCluster.lessons[0].coordinates?.placeName || 'Location'}
                  </Text>
                  <Text style={styles.expandedCount}>
                    {expandedCluster.lessons.length} photos
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeModal}
                  >
                    <Ionicons name="close" size={24} color={colors.white} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.expandedScroll}
                >
                  {expandedCluster.lessons.map((lesson) => (
                    <View key={lesson.id} style={styles.expandedPhotoWrapper}>
                      <TouchableOpacity
                        style={styles.expandedPhoto}
                        onPress={() => {
                          closeModal();
                          setTimeout(() => onLessonPress(lesson), 200);
                        }}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: resolveImageUri(lesson.imageUri) }}
                          style={styles.expandedImage}
                          resizeMode="cover"
                        />
                        <View style={styles.expandedOverlay}>
                          <Text style={styles.expandedWordCount}>
                            {lesson.words.length} words
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {onLessonDelete && (
                        <TouchableOpacity
                          style={styles.expandedDeleteButton}
                          onPress={() => handleDelete(lesson)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </BlurView>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

// Photo marker component - Apple Photos style with gradient overlay
function PhotoMarker({ cluster }: { cluster: PhotoCluster }) {
  const firstLesson = cluster.lessons[0];
  const totalWords = cluster.lessons.reduce((sum, l) => sum + l.words.length, 0);
  const isCluster = cluster.lessons.length > 1;
  const mainWord = firstLesson.words[0];

  return (
    <View style={styles.markerContainer}>
      {/* Photo thumbnail with speech bubble shape */}
      <View style={styles.markerBubble}>
        <Image
          source={{ uri: resolveImageUri(firstLesson.imageUri) }}
          style={styles.markerImage}
          resizeMode="cover"
        />

        {/* Stack indicator for clusters */}
        {isCluster && (
          <>
            <View style={[styles.stackCard, styles.stackCard2]} />
            <View style={[styles.stackCard, styles.stackCard1]} />
          </>
        )}

        {/* Gradient overlay for text readability */}
        <View style={styles.markerGradient} />

        {/* Main word at bottom with better styling */}
        {mainWord && (
          <View style={styles.markerWordContainer}>
            <Text style={styles.markerWordText} numberOfLines={1}>
              {mainWord.japanese}
            </Text>
            {isCluster && (
              <View style={styles.clusterCountBadge}>
                <Text style={styles.clusterCountText}>{cluster.lessons.length}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Pointer */}
      <View style={styles.markerPointer} />
    </View>
  );
}

// Calculate distance between coordinates in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const MARKER_SIZE = 90;
const MARKER_RADIUS = 12;

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
    maxWidth: 260,
  },

  // Map controls
  controls: {
    position: 'absolute',
    right: spacing.md,
    gap: spacing.sm,
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

  // Marker styles - Apple Photos style bubbles
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_RADIUS,
    backgroundColor: colors.white,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  markerImage: {
    width: MARKER_SIZE - 8,
    height: MARKER_SIZE - 8,
    borderRadius: MARKER_RADIUS - 2,
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.white,
    marginTop: -1,
  },

  // Stack cards for clusters
  stackCard: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: MARKER_SIZE - 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: MARKER_RADIUS - 2,
  },
  stackCard1: {
    bottom: 0,
    transform: [{ translateY: 4 }, { scale: 0.96 }],
    zIndex: -1,
  },
  stackCard2: {
    bottom: 0,
    transform: [{ translateY: 8 }, { scale: 0.92 }],
    zIndex: -2,
  },

  // Gradient overlay for text readability
  markerGradient: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    height: 40,
    borderBottomLeftRadius: MARKER_RADIUS - 2,
    borderBottomRightRadius: MARKER_RADIUS - 2,
    backgroundColor: 'transparent',
    // Simulated gradient with shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },

  // Main word container at bottom
  markerWordContainer: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  markerWordText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    flex: 1,
  },
  clusterCountBadge: {
    backgroundColor: colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  clusterCountText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Expanded cluster modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContainer: {
    width: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  expandedBlur: {
    padding: spacing.lg,
  },
  expandedHeader: {
    marginBottom: spacing.md,
  },
  expandedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  expandedCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedScroll: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  expandedPhotoWrapper: {
    marginRight: spacing.md,
  },
  expandedPhoto: {
    width: 140,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
  },
  expandedImage: {
    width: '100%',
    height: '100%',
  },
  expandedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  expandedWordCount: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  expandedDeleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Single photo detail modal
  photoDetailContainer: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    overflow: 'hidden',
  },
  photoWrapper: {
    position: 'relative',
  },
  photoDetailImage: {
    width: '100%',
    height: 260,
  },
  mainWordOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  mainWordJapanese: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  mainWordReading: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  audioButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  photoDetailInfo: {
    padding: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  photoDetailLocation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  photoDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  wordChipsScroll: {
    marginHorizontal: -spacing.md,
    marginBottom: spacing.md,
  },
  wordChipsContainer: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  wordChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  wordChipJapanese: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  wordChipEnglish: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  masteredBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  masteryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  masteryBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  masteryPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    width: 36,
    textAlign: 'right',
  },
  photoDetailActions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  photoDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  photoDetailButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  deleteLinkText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  photoDetailClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PhotoMapView;
