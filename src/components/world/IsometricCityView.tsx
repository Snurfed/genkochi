/**
 * IsometricCityView.tsx
 *
 * An isometric city that grows as the user learns words.
 * Each vocabulary word places a building in the city.
 * Uses Kenney's Suburban City Kit assets.
 */

import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MemoryWorld, WorldObject as WorldObjectType } from '../../types';
import { colors } from '../../constants/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// BUILDING ASSETS
// ============================================
const BUILDINGS: { [key: string]: ImageSourcePropType } = {
  'a': require('../../../assets/world/suburban/building-type-a.png'),
  'b': require('../../../assets/world/suburban/building-type-b.png'),
  'c': require('../../../assets/world/suburban/building-type-c.png'),
  'd': require('../../../assets/world/suburban/building-type-d.png'),
  'e': require('../../../assets/world/suburban/building-type-e.png'),
  'f': require('../../../assets/world/suburban/building-type-f.png'),
  'g': require('../../../assets/world/suburban/building-type-g.png'),
  'h': require('../../../assets/world/suburban/building-type-h.png'),
  'i': require('../../../assets/world/suburban/building-type-i.png'),
  'j': require('../../../assets/world/suburban/building-type-j.png'),
  'k': require('../../../assets/world/suburban/building-type-k.png'),
  'l': require('../../../assets/world/suburban/building-type-l.png'),
  'm': require('../../../assets/world/suburban/building-type-m.png'),
  'n': require('../../../assets/world/suburban/building-type-n.png'),
  'o': require('../../../assets/world/suburban/building-type-o.png'),
  'p': require('../../../assets/world/suburban/building-type-p.png'),
  'q': require('../../../assets/world/suburban/building-type-q.png'),
  'r': require('../../../assets/world/suburban/building-type-r.png'),
  's': require('../../../assets/world/suburban/building-type-s.png'),
  't': require('../../../assets/world/suburban/building-type-t.png'),
};

const DECORATIONS: { [key: string]: ImageSourcePropType } = {
  'tree-large': require('../../../assets/world/suburban/tree-large.png'),
  'tree-small': require('../../../assets/world/suburban/tree-small.png'),
  'planter': require('../../../assets/world/suburban/planter.png'),
};

const BUILDING_KEYS = Object.keys(BUILDINGS);

// Isometric grid settings
const TILE_WIDTH = 120;
const TILE_HEIGHT = 60;
const GRID_COLS = 6;
const GRID_ROWS = 8;

// Convert grid position to screen position (isometric projection)
const gridToScreen = (col: number, row: number) => {
  const x = (col - row) * (TILE_WIDTH / 2);
  const y = (col + row) * (TILE_HEIGHT / 2);
  return { x, y };
};

interface IsometricCityViewProps {
  world: MemoryWorld;
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
  onObjectLongPress?: (object: WorldObjectType) => void;
}

export function IsometricCityView({
  world,
  selectedObjectId,
  onObjectPress,
  onObjectLongPress,
}: IsometricCityViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Assign buildings to grid positions based on objects
  const cityLayout = useMemo(() => {
    const layout: Array<{
      col: number;
      row: number;
      object?: WorldObjectType;
      buildingKey: string;
      isDecoration: boolean;
    }> = [];

    // Place user's vocabulary objects as buildings
    world.objects.forEach((obj, index) => {
      // Spiral out from center for placement
      const col = 2 + (index % 4);
      const row = 2 + Math.floor(index / 4);

      if (col < GRID_COLS && row < GRID_ROWS) {
        // Assign building based on hash of object ID for consistency
        const hash = obj.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const buildingKey = BUILDING_KEYS[hash % BUILDING_KEYS.length];

        layout.push({
          col,
          row,
          object: obj,
          buildingKey,
          isDecoration: false,
        });
      }
    });

    // Add decorative trees around the edges
    const decorationPositions = [
      { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 },
      { col: 5, row: 0 }, { col: 0, row: 5 }, { col: 1, row: 6 },
      { col: 5, row: 5 }, { col: 4, row: 6 }, { col: 0, row: 3 },
    ];

    decorationPositions.forEach((pos, i) => {
      // Only show decorations based on progression
      if (world.objects.length > i * 2) {
        layout.push({
          ...pos,
          buildingKey: i % 2 === 0 ? 'tree-large' : 'tree-small',
          isDecoration: true,
        });
      }
    });

    return layout;
  }, [world.objects]);

  // Calculate content dimensions
  const contentWidth = (GRID_COLS + GRID_ROWS) * (TILE_WIDTH / 2) + 100;
  const contentHeight = (GRID_COLS + GRID_ROWS) * (TILE_HEIGHT / 2) + 200;

  // Sort by row then col for proper z-ordering (back to front)
  const sortedLayout = [...cityLayout].sort((a, b) => {
    const aDepth = a.row + a.col;
    const bDepth = b.row + b.col;
    return aDepth - bDepth;
  });

  return (
    <View style={styles.container}>
      {/* Sky gradient background */}
      <LinearGradient
        colors={['#87CEEB', '#B4E7F8', '#E0F4FF', '#C8E6C9']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Scrollable city view */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { width: contentWidth, height: contentHeight },
        ]}
        centerContent
        maximumZoomScale={2}
        minimumZoomScale={0.5}
      >
        {/* Ground plane */}
        <View style={styles.groundContainer}>
          {/* Isometric grass tiles */}
          {Array.from({ length: GRID_ROWS }).map((_, row) =>
            Array.from({ length: GRID_COLS }).map((_, col) => {
              const { x, y } = gridToScreen(col, row);
              return (
                <View
                  key={`tile-${col}-${row}`}
                  style={[
                    styles.groundTile,
                    {
                      left: x + contentWidth / 2 - TILE_WIDTH / 2,
                      top: y + 50,
                      width: TILE_WIDTH,
                      height: TILE_HEIGHT,
                    },
                  ]}
                >
                  <View style={styles.grassTile} />
                </View>
              );
            })
          )}
        </View>

        {/* Buildings layer */}
        <View style={styles.buildingsContainer}>
          {sortedLayout.map((item, index) => {
            const { x, y } = gridToScreen(item.col, item.row);
            const screenX = x + contentWidth / 2 - TILE_WIDTH / 2;
            const screenY = y + 50;

            const isSelected = item.object && selectedObjectId === item.object.id;
            const asset = item.isDecoration
              ? DECORATIONS[item.buildingKey]
              : BUILDINGS[item.buildingKey];

            if (!asset) return null;

            return (
              <TouchableOpacity
                key={item.object?.id || `deco-${index}`}
                style={[
                  styles.buildingContainer,
                  {
                    left: screenX,
                    top: screenY - 60, // Offset to sit on tile
                    zIndex: item.row + item.col,
                  },
                ]}
                onPress={() => item.object && onObjectPress(item.object)}
                onLongPress={() => item.object && onObjectLongPress?.(item.object)}
                activeOpacity={item.object ? 0.8 : 1}
                disabled={!item.object}
              >
                {/* Selection glow */}
                {isSelected && (
                  <View style={styles.selectionGlow} />
                )}

                {/* Review indicator */}
                {item.object?.needsReview && (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>!</Text>
                  </View>
                )}

                {/* Building image */}
                <Image
                  source={asset}
                  style={[
                    styles.buildingImage,
                    item.isDecoration && styles.decorationImage,
                  ]}
                  resizeMode="contain"
                />

                {/* Word label for buildings (not decorations) */}
                {item.object && (
                  <View style={styles.labelContainer}>
                    <View style={[
                      styles.label,
                      isSelected && styles.labelSelected,
                    ]}>
                      <Text style={styles.labelJapanese}>
                        {item.object.displayName}
                      </Text>
                      <Text style={styles.labelEnglish}>
                        {item.object.english}
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* City stats */}
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
      </View>

      {/* Empty state */}
      {world.objects.length === 0 && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Build Your City</Text>
            <Text style={styles.emptyText}>
              Take photos to learn words and add buildings to your city
            </Text>
          </View>
        </View>
      )}

      {/* Hint */}
      {world.objects.length > 0 && world.objects.length < 3 && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Tap a building to review the word</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  groundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  groundTile: {
    position: 'absolute',
  },
  grassTile: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7CB342',
    transform: [{ rotateX: '60deg' }, { rotateZ: '45deg' }],
    borderWidth: 1,
    borderColor: '#689F38',
  },
  buildingsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  buildingContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  selectionGlow: {
    position: 'absolute',
    top: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
  reviewBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD93D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  reviewBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  buildingImage: {
    width: TILE_WIDTH,
    height: TILE_WIDTH,
  },
  decorationImage: {
    width: TILE_WIDTH * 0.6,
    height: TILE_WIDTH * 0.6,
  },
  labelContainer: {
    position: 'absolute',
    bottom: -30,
    alignItems: 'center',
  },
  label: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
  },
  labelSelected: {
    backgroundColor: colors.primary,
  },
  labelJapanese: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  labelEnglish: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },

  // Stats bar
  statsBar: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },

  // Empty state
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 280,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Hint
  hintContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default IsometricCityView;
