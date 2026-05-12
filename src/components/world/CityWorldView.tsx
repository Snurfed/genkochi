/**
 * CityWorldView.tsx
 *
 * A city that grows as the user learns words.
 * Buildings displayed prominently along a street.
 * Uses Kenney's City Kit assets.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MemoryWorld, WorldObject as WorldObjectType } from '../../types';
import { colors } from '../../constants/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// BUILDING ASSETS - Mixed from all kits
// ============================================

// Suburban houses
const SUBURBAN = [
  require('../../../assets/world/suburban/building-type-a.png'),
  require('../../../assets/world/suburban/building-type-b.png'),
  require('../../../assets/world/suburban/building-type-c.png'),
  require('../../../assets/world/suburban/building-type-d.png'),
  require('../../../assets/world/suburban/building-type-e.png'),
  require('../../../assets/world/suburban/building-type-f.png'),
  require('../../../assets/world/suburban/building-type-g.png'),
  require('../../../assets/world/suburban/building-type-h.png'),
  require('../../../assets/world/suburban/building-type-i.png'),
  require('../../../assets/world/suburban/building-type-j.png'),
];

// Commercial buildings
const COMMERCIAL = [
  require('../../../assets/world/commercial/building-a.png'),
  require('../../../assets/world/commercial/building-b.png'),
  require('../../../assets/world/commercial/building-c.png'),
  require('../../../assets/world/commercial/building-d.png'),
  require('../../../assets/world/commercial/building-e.png'),
  require('../../../assets/world/commercial/building-f.png'),
  require('../../../assets/world/commercial/building-skyscraper-a.png'),
  require('../../../assets/world/commercial/building-skyscraper-b.png'),
];

// Industrial buildings
const INDUSTRIAL = [
  require('../../../assets/world/industrial/building-a.png'),
  require('../../../assets/world/industrial/building-b.png'),
  require('../../../assets/world/industrial/building-c.png'),
  require('../../../assets/world/industrial/building-d.png'),
  require('../../../assets/world/industrial/building-e.png'),
  require('../../../assets/world/industrial/building-f.png'),
];

// Vehicles
const VEHICLES = [
  require('../../../assets/world/vehicles/sedan.png'),
  require('../../../assets/world/vehicles/suv.png'),
  require('../../../assets/world/vehicles/truck.png'),
  require('../../../assets/world/vehicles/taxi.png'),
  require('../../../assets/world/vehicles/police.png'),
];

// Trees
const TREES = [
  require('../../../assets/world/suburban/tree-large.png'),
  require('../../../assets/world/suburban/tree-small.png'),
];

// All buildings combined
const ALL_BUILDINGS = [...SUBURBAN, ...COMMERCIAL, ...INDUSTRIAL];

// Layout settings
const BUILDING_WIDTH = 140;
const BUILDING_HEIGHT = 160;
const BUILDING_SPACING = 20;
const ROAD_HEIGHT = 80;

interface CityWorldViewProps {
  world: MemoryWorld;
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
  onObjectLongPress?: (object: WorldObjectType) => void;
}

export function CityWorldView({
  world,
  selectedObjectId,
  onObjectPress,
  onObjectLongPress,
}: CityWorldViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const carAnim = useRef(new Animated.Value(0)).current;

  // Animate cars
  useEffect(() => {
    Animated.loop(
      Animated.timing(carAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Assign buildings to objects
  const buildingAssignments = useMemo(() => {
    return world.objects.map((obj, index) => {
      // Use hash for consistent building assignment
      const hash = obj.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const buildingIndex = hash % ALL_BUILDINGS.length;

      return {
        object: obj,
        building: ALL_BUILDINGS[buildingIndex],
        position: index,
      };
    });
  }, [world.objects]);

  // Calculate content width
  const contentWidth = Math.max(
    SCREEN_WIDTH,
    (buildingAssignments.length + 2) * (BUILDING_WIDTH + BUILDING_SPACING) + 100
  );

  // Progression level determines decorations
  const progression = useMemo(() => {
    const count = world.objects.length;
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  }, [world.objects.length]);

  return (
    <View style={styles.container}>
      {/* Sky */}
      <LinearGradient
        colors={['#74b9ff', '#a8d8ff', '#dfe6e9']}
        style={styles.sky}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Scrollable city */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
        decelerationRate="normal"
      >
        {/* Background layer - distant buildings silhouette */}
        <View style={styles.distantBuildings}>
          {progression >= 2 && (
            <>
              <View style={[styles.distantBuilding, { left: 100, height: 60 }]} />
              <View style={[styles.distantBuilding, { left: 180, height: 90 }]} />
              <View style={[styles.distantBuilding, { left: 250, height: 70 }]} />
              <View style={[styles.distantBuilding, { left: 400, height: 100 }]} />
              <View style={[styles.distantBuilding, { left: 480, height: 75 }]} />
              <View style={[styles.distantBuilding, { left: 600, height: 85 }]} />
              <View style={[styles.distantBuilding, { left: 750, height: 95 }]} />
            </>
          )}
        </View>

        {/* Trees between buildings */}
        <View style={styles.treesLayer}>
          {progression >= 1 && (
            <>
              <Image source={TREES[0]} style={[styles.tree, { left: 50 }]} resizeMode="contain" />
              <Image source={TREES[1]} style={[styles.tree, { left: 280, width: 40, height: 50 }]} resizeMode="contain" />
              {progression >= 2 && (
                <>
                  <Image source={TREES[0]} style={[styles.tree, { left: 450 }]} resizeMode="contain" />
                  <Image source={TREES[1]} style={[styles.tree, { left: 650, width: 40, height: 50 }]} resizeMode="contain" />
                </>
              )}
              {progression >= 3 && (
                <>
                  <Image source={TREES[0]} style={[styles.tree, { left: 850 }]} resizeMode="contain" />
                  <Image source={TREES[1]} style={[styles.tree, { left: 1050, width: 40, height: 50 }]} resizeMode="contain" />
                </>
              )}
            </>
          )}
        </View>

        {/* Main buildings row */}
        <View style={styles.buildingsRow}>
          {buildingAssignments.map((item, index) => {
            const isSelected = selectedObjectId === item.object.id;
            const xPosition = 80 + index * (BUILDING_WIDTH + BUILDING_SPACING);

            return (
              <TouchableOpacity
                key={item.object.id}
                style={[
                  styles.buildingContainer,
                  { left: xPosition },
                ]}
                onPress={() => onObjectPress(item.object)}
                onLongPress={() => onObjectLongPress?.(item.object)}
                activeOpacity={0.9}
              >
                {/* Selection highlight */}
                {isSelected && <View style={styles.selectionGlow} />}

                {/* Review badge */}
                {item.object.needsReview && (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>!</Text>
                  </View>
                )}

                {/* Building image */}
                <Image
                  source={item.building}
                  style={styles.buildingImage}
                  resizeMode="contain"
                />

                {/* Word label */}
                <View style={[styles.label, isSelected && styles.labelSelected]}>
                  <Text style={[styles.labelJapanese, isSelected && styles.labelTextSelected]}>
                    {item.object.displayName}
                  </Text>
                  <Text style={[styles.labelEnglish, isSelected && styles.labelTextSelected]}>
                    {item.object.english}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Empty plot indicator */}
          {buildingAssignments.length < 5 && (
            <View style={[styles.emptyPlot, { left: 80 + buildingAssignments.length * (BUILDING_WIDTH + BUILDING_SPACING) }]}>
              <View style={styles.emptyPlotDashed}>
                <Text style={styles.emptyPlotText}>+</Text>
              </View>
              <Text style={styles.emptyPlotLabel}>Next word</Text>
            </View>
          )}
        </View>

        {/* Road */}
        <View style={styles.road}>
          <View style={styles.roadSurface} />
          <View style={styles.roadLine} />

          {/* Animated car */}
          {progression >= 2 && (
            <Animated.View
              style={[
                styles.carContainer,
                {
                  transform: [
                    {
                      translateX: carAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-100, contentWidth + 100],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={VEHICLES[0]}
                style={styles.carImage}
                resizeMode="contain"
              />
            </Animated.View>
          )}
        </View>

        {/* Sidewalk */}
        <View style={styles.sidewalk} />
      </ScrollView>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{world.objects.length}</Text>
          <Text style={styles.statLabel}>Buildings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{world.masteredCount}</Text>
          <Text style={styles.statLabel}>Mastered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{world.totalXPEarned}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>
      </View>

      {/* Empty state */}
      {world.objects.length === 0 && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏗️</Text>
            <Text style={styles.emptyTitle}>Build Your City</Text>
            <Text style={styles.emptyText}>
              Each word you learn adds a new building to your city
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.5,
  },
  scrollContent: {
    height: SCREEN_HEIGHT * 0.78,
  },

  // Distant buildings (skyline)
  distantBuildings: {
    position: 'absolute',
    bottom: ROAD_HEIGHT + 180,
    left: 0,
    right: 0,
    height: 120,
  },
  distantBuilding: {
    position: 'absolute',
    bottom: 0,
    width: 50,
    backgroundColor: 'rgba(100, 120, 140, 0.3)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },

  // Trees
  treesLayer: {
    position: 'absolute',
    bottom: ROAD_HEIGHT + 60,
    left: 0,
    right: 0,
    height: 80,
  },
  tree: {
    position: 'absolute',
    bottom: 0,
    width: 50,
    height: 70,
  },

  // Buildings
  buildingsRow: {
    position: 'absolute',
    bottom: ROAD_HEIGHT + 50,
    left: 0,
    right: 0,
    height: BUILDING_HEIGHT + 60,
  },
  buildingContainer: {
    position: 'absolute',
    bottom: 0,
    width: BUILDING_WIDTH,
    alignItems: 'center',
  },
  selectionGlow: {
    position: 'absolute',
    top: 10,
    width: BUILDING_WIDTH - 20,
    height: BUILDING_HEIGHT - 20,
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 16,
  },
  reviewBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD93D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  reviewBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
  },
  buildingImage: {
    width: BUILDING_WIDTH,
    height: BUILDING_HEIGHT,
  },
  label: {
    marginTop: 8,
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  labelSelected: {
    backgroundColor: colors.primary,
  },
  labelJapanese: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  labelEnglish: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  labelTextSelected: {
    color: 'white',
  },

  // Empty plot
  emptyPlot: {
    position: 'absolute',
    bottom: 50,
    width: BUILDING_WIDTH,
    alignItems: 'center',
  },
  emptyPlotDashed: {
    width: BUILDING_WIDTH - 30,
    height: BUILDING_HEIGHT - 30,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.15)',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlotText: {
    fontSize: 48,
    color: 'rgba(0,0,0,0.15)',
    fontWeight: '300',
  },
  emptyPlotLabel: {
    marginTop: 12,
    fontSize: 13,
    color: 'rgba(0,0,0,0.3)',
    fontWeight: '500',
  },

  // Road
  road: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    height: ROAD_HEIGHT,
  },
  roadSurface: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ROAD_HEIGHT,
    backgroundColor: '#4a4a4a',
  },
  roadLine: {
    position: 'absolute',
    bottom: ROAD_HEIGHT / 2 - 2,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#FFD93D',
  },
  carContainer: {
    position: 'absolute',
    bottom: 15,
  },
  carImage: {
    width: 70,
    height: 50,
    transform: [{ scaleX: -1 }], // Face the car right
  },

  // Sidewalk
  sidewalk: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: '#b8b8b8',
  },

  // Stats bar
  statsBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E8E8E8',
  },

  // Empty state
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  emptyCard: {
    backgroundColor: 'white',
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    maxWidth: 300,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default CityWorldView;
