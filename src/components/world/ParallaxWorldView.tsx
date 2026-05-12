/**
 * ParallaxWorldView.tsx
 *
 * A beautiful side-scrolling parallax landscape that grows as users learn words.
 * Single cohesive scene with depth created through parallax scrolling.
 */

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Ellipse, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { MemoryWorld, WorldObject as WorldObjectType, ObjectCategory } from '../../types';
import { colors } from '../../constants/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// CONFIGURATION
// ============================================
const WORLD_HEIGHT = SCREEN_HEIGHT * 0.75;

const CONFIG = {
  WORLD_WIDTH: SCREEN_WIDTH * 2.5,
  GROUND_HEIGHT: WORLD_HEIGHT * 0.18,
  HORIZON_Y: WORLD_HEIGHT * 0.55, // Where ground meets sky
};

// Time-based theming
const getTimeOfDay = (): 'dawn' | 'day' | 'dusk' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
};

const THEMES = {
  dawn: {
    sky: ['#FF9A8B', '#FF6A88', '#FF99AC', '#FCB69F'] as const,
    celestial: '🌅',
    ground: ['#4A7C59', '#3D6B4F', '#2D5A3F'] as const,
    ambient: 'rgba(255, 150, 100, 0.15)',
  },
  day: {
    sky: ['#74B9FF', '#81ECEC', '#A8E6CF', '#DCEDC1'] as const,
    celestial: '☀️',
    ground: ['#7CB342', '#689F38', '#558B2F'] as const,
    ambient: 'rgba(255, 255, 200, 0.1)',
  },
  dusk: {
    sky: ['#E17055', '#FDCB6E', '#F8B739', '#FF7675'] as const,
    celestial: '🌇',
    ground: ['#5D4E37', '#4A3F2F', '#3D3427'] as const,
    ambient: 'rgba(255, 100, 50, 0.15)',
  },
  night: {
    sky: ['#2C3E50', '#34495E', '#1A1A2E', '#16213E'] as const,
    celestial: '🌙',
    ground: ['#2D4A3E', '#1E3A2F', '#152A22'] as const,
    ambient: 'rgba(100, 100, 255, 0.1)',
  },
};

// Category determines vertical position
const getCategoryYPosition = (category: ObjectCategory): number => {
  switch (category) {
    case 'sky': return 0.15 + Math.random() * 0.2;
    case 'building': return 0.5 + Math.random() * 0.1;
    case 'nature': return 0.55 + Math.random() * 0.15;
    case 'animal': return 0.6 + Math.random() * 0.15;
    case 'vehicle': return 0.7 + Math.random() * 0.05;
    case 'furniture': return 0.72 + Math.random() * 0.08;
    case 'food': return 0.7 + Math.random() * 0.1;
    case 'electronic': return 0.68 + Math.random() * 0.1;
    case 'clothing': return 0.65 + Math.random() * 0.1;
    default: return 0.65 + Math.random() * 0.15;
  }
};

interface ParallaxWorldViewProps {
  world: MemoryWorld;
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
  onObjectLongPress?: (object: WorldObjectType) => void;
}

export function ParallaxWorldView({
  world,
  selectedObjectId,
  onObjectPress,
  onObjectLongPress,
}: ParallaxWorldViewProps) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Ambient animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const cloudAnim = useRef(new Animated.Value(0)).current;

  const timeOfDay = getTimeOfDay();
  const theme = THEMES[timeOfDay];

  // Floating animation for sky objects
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Cloud drift animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(cloudAnim, {
        toValue: 1,
        duration: 45000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Calculate progression
  const progression = useMemo(() => {
    const count = world.objects.length;
    if (count === 0) return 0;
    if (count <= 5) return 1;
    if (count <= 15) return 2;
    if (count <= 30) return 3;
    return 4;
  }, [world.objects.length]);

  // Position objects with stable positions based on their ID
  const positionedObjects = useMemo(() => {
    return world.objects.map((obj, index) => {
      // Use object ID to create consistent position
      const hash = obj.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const xOffset = (hash % 100) / 100;

      // Spread objects across the world width
      const segmentWidth = CONFIG.WORLD_WIDTH / Math.max(world.objects.length, 1);
      const baseX = segmentWidth * index + segmentWidth * 0.2;
      const x = baseX + xOffset * segmentWidth * 0.6;

      const y = getCategoryYPosition(obj.category);

      return {
        ...obj,
        x: Math.max(60, Math.min(x, CONFIG.WORLD_WIDTH - 60)),
        y,
      };
    });
  }, [world.objects]);

  // Create parallax transform
  const createParallaxStyle = (speed: number) => ({
    transform: [
      {
        translateX: scrollX.interpolate({
          inputRange: [0, CONFIG.WORLD_WIDTH - SCREEN_WIDTH],
          outputRange: [0, -(CONFIG.WORLD_WIDTH - SCREEN_WIDTH) * (1 - speed)],
          extrapolate: 'clamp',
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      {/* Sky gradient - full background */}
      <LinearGradient
        colors={theme.sky}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Scrollable content */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        contentContainerStyle={{ width: CONFIG.WORLD_WIDTH, height: WORLD_HEIGHT }}
        decelerationRate="normal"
        bounces={true}
      >
        {/* ===== BACK LAYER: Distant mountains (slowest) ===== */}
        <Animated.View
          style={[styles.absoluteLayer, createParallaxStyle(0.2)]}
          pointerEvents="none"
        >
          <View style={styles.mountainsContainer}>
            {/* Mountain silhouettes */}
            <Text style={[styles.mountain, { left: 50, fontSize: 100, opacity: 0.3 }]}>🏔️</Text>
            <Text style={[styles.mountain, { left: 250, fontSize: 80, opacity: 0.25 }]}>⛰️</Text>
            <Text style={[styles.mountain, { left: 450, fontSize: 110, opacity: 0.3 }]}>🏔️</Text>
            <Text style={[styles.mountain, { left: 700, fontSize: 90, opacity: 0.25 }]}>⛰️</Text>
            {progression >= 2 && (
              <>
                <Text style={[styles.mountain, { left: 900, fontSize: 100, opacity: 0.3 }]}>🏔️</Text>
                <Text style={[styles.mountain, { left: 1100, fontSize: 85, opacity: 0.25 }]}>⛰️</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* ===== SKY LAYER: Celestial body & clouds ===== */}
        <Animated.View
          style={[styles.absoluteLayer, createParallaxStyle(0.1)]}
          pointerEvents="none"
        >
          {/* Sun/Moon */}
          <View style={styles.celestialBody}>
            <Text style={styles.celestialEmoji}>{theme.celestial}</Text>
          </View>

          {/* Clouds */}
          <Animated.View
            style={[
              styles.cloud,
              { left: 100, top: WORLD_HEIGHT * 0.12 },
              {
                transform: [
                  {
                    translateX: cloudAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 150],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: 50, opacity: 0.9 }}>☁️</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.cloud,
              { left: 400, top: WORLD_HEIGHT * 0.08 },
              {
                transform: [
                  {
                    translateX: cloudAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 100],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: 40, opacity: 0.85 }}>☁️</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.cloud,
              { left: 750, top: WORLD_HEIGHT * 0.15 },
              {
                transform: [
                  {
                    translateX: cloudAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 120],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: 45, opacity: 0.9 }}>☁️</Text>
          </Animated.View>

          {progression >= 2 && (
            <Animated.View
              style={[
                styles.cloud,
                { left: 1000, top: WORLD_HEIGHT * 0.1 },
                {
                  transform: [
                    {
                      translateX: cloudAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 80],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={{ fontSize: 55, opacity: 0.85 }}>☁️</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* ===== MID LAYER: Hills & distant trees ===== */}
        <Animated.View
          style={[styles.absoluteLayer, createParallaxStyle(0.5)]}
          pointerEvents="none"
        >
          {/* Rolling hills - SVG curve */}
          <View style={[styles.hills, { top: CONFIG.HORIZON_Y - 60 }]}>
            <Svg width={CONFIG.WORLD_WIDTH} height={120} style={{ position: 'absolute' }}>
              <Defs>
                <SvgGradient id="hillGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.ground[0]} stopOpacity="0.7" />
                  <Stop offset="1" stopColor={theme.ground[1]} stopOpacity="0.9" />
                </SvgGradient>
              </Defs>
              <Path
                d={`M0,80 Q150,20 300,60 T600,40 T900,70 T1200,30 T1500,60 T1800,40 L${CONFIG.WORLD_WIDTH},120 L0,120 Z`}
                fill="url(#hillGradient)"
              />
            </Svg>
          </View>

          {/* Distant trees on hills */}
          <View style={[styles.distantTrees, { top: CONFIG.HORIZON_Y - 50 }]}>
            <Text style={[styles.distantTree, { left: 80 }]}>🌲</Text>
            <Text style={[styles.distantTree, { left: 200 }]}>🌳</Text>
            <Text style={[styles.distantTree, { left: 380 }]}>🌲</Text>
            <Text style={[styles.distantTree, { left: 520 }]}>🌲</Text>
            {progression >= 1 && (
              <>
                <Text style={[styles.distantTree, { left: 680 }]}>🌳</Text>
                <Text style={[styles.distantTree, { left: 850 }]}>🌲</Text>
              </>
            )}
            {progression >= 2 && (
              <>
                <Text style={[styles.distantTree, { left: 1000 }]}>🌲</Text>
                <Text style={[styles.distantTree, { left: 1150 }]}>🌳</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* ===== GROUND LAYER ===== */}
        <View style={[styles.ground, { top: CONFIG.HORIZON_Y }]} pointerEvents="none">
          <LinearGradient
            colors={theme.ground}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        </View>

        {/* ===== MAIN LAYER: Objects & scenery (1:1 scroll) ===== */}
        <View style={styles.absoluteLayer}>
          {/* Decorative scenery */}
          <View style={[styles.sceneryItem, { left: 60, top: CONFIG.HORIZON_Y - 40 }]}>
            <Text style={{ fontSize: 50 }}>🌳</Text>
          </View>

          {progression >= 1 && (
            <>
              <View style={[styles.sceneryItem, { left: 300, top: CONFIG.HORIZON_Y - 30 }]}>
                <Text style={{ fontSize: 36 }}>🌸</Text>
              </View>
              <View style={[styles.sceneryItem, { left: 500, top: CONFIG.HORIZON_Y - 45 }]}>
                <Text style={{ fontSize: 44 }}>🌲</Text>
              </View>
            </>
          )}

          {progression >= 2 && (
            <>
              <View style={[styles.sceneryItem, { left: 220, top: CONFIG.HORIZON_Y - 55 }]}>
                <Text style={{ fontSize: 48 }}>🏠</Text>
              </View>
              <View style={[styles.sceneryItem, { left: 700, top: CONFIG.HORIZON_Y - 38 }]}>
                <Text style={{ fontSize: 40 }}>🌻</Text>
              </View>
            </>
          )}

          {progression >= 3 && (
            <>
              <View style={[styles.sceneryItem, { left: 900, top: CONFIG.HORIZON_Y - 60 }]}>
                <Text style={{ fontSize: 52 }}>🏪</Text>
              </View>
              <View style={[styles.sceneryItem, { left: 1100, top: CONFIG.HORIZON_Y - 45 }]}>
                <Text style={{ fontSize: 46 }}>🌳</Text>
              </View>
            </>
          )}

          {progression >= 4 && (
            <>
              <View style={[styles.sceneryItem, { left: 450, top: CONFIG.HORIZON_Y + 20 }]}>
                <Text style={{ fontSize: 24 }}>🦋</Text>
              </View>
              <View style={[styles.sceneryItem, { left: 800, top: CONFIG.HORIZON_Y + 30 }]}>
                <Text style={{ fontSize: 26 }}>🐿️</Text>
              </View>
            </>
          )}

          {/* User's vocabulary objects */}
          {positionedObjects.map((obj) => {
            const isSelected = selectedObjectId === obj.id;
            const size = obj.category === 'building' ? 56 : 48;
            const topPosition = obj.y * WORLD_HEIGHT - size / 2;

            return (
              <TouchableOpacity
                key={obj.id}
                style={[
                  styles.objectContainer,
                  {
                    left: obj.x - size / 2,
                    top: topPosition,
                  },
                ]}
                onPress={() => onObjectPress(obj)}
                onLongPress={() => onObjectLongPress?.(obj)}
                activeOpacity={0.85}
              >
                {/* Shadow */}
                <View style={[styles.objectShadow, { width: size * 0.6 }]} />

                {/* Glow for review */}
                {obj.needsReview && (
                  <View style={[styles.reviewGlow, { width: size + 12, height: size + 12 }]} />
                )}

                {/* Emoji bubble */}
                <View
                  style={[
                    styles.emojiBubble,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      borderWidth: isSelected ? 3 : 1.5,
                      borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.6)',
                    },
                  ]}
                >
                  <Text style={{ fontSize: size * 0.55 }}>{obj.emoji}</Text>
                </View>

                {/* Label */}
                <View style={styles.label}>
                  <Text style={styles.labelText} numberOfLines={1}>
                    {obj.displayName}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== FOREGROUND: Grass & path ===== */}
        <View style={[styles.foreground, { top: WORLD_HEIGHT - 50 }]} pointerEvents="none">
          {/* Path */}
          <View style={styles.path} />

          {/* Grass tufts */}
          <Text style={[styles.grass, { left: 30 }]}>🌿</Text>
          <Text style={[styles.grass, { left: 150 }]}>🌱</Text>
          <Text style={[styles.grass, { left: 320 }]}>🌿</Text>
          <Text style={[styles.grass, { left: 480 }]}>🌱</Text>
          <Text style={[styles.grass, { left: 650 }]}>🌿</Text>
          <Text style={[styles.grass, { left: 800 }]}>🌱</Text>
          {progression >= 2 && (
            <>
              <Text style={[styles.grass, { left: 950 }]}>🌿</Text>
              <Text style={[styles.grass, { left: 1100 }]}>🌱</Text>
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* Empty state overlay */}
      {world.objects.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyText}>Take photos to populate your world</Text>
          <Text style={styles.emptySubtext}>Your vocabulary will come to life here</Text>
        </View>
      )}

      {/* Scroll hint */}
      {world.objects.length >= 3 && (
        <View style={styles.scrollHint}>
          <Text style={styles.scrollHintText}>← Swipe to explore →</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  absoluteLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: CONFIG.WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },

  // Celestial
  celestialBody: {
    position: 'absolute',
    right: SCREEN_WIDTH * 0.15,
    top: WORLD_HEIGHT * 0.08,
  },
  celestialEmoji: {
    fontSize: 60,
  },

  // Clouds
  cloud: {
    position: 'absolute',
  },

  // Mountains
  mountainsContainer: {
    position: 'absolute',
    top: CONFIG.HORIZON_Y - 120,
    width: CONFIG.WORLD_WIDTH,
    height: 150,
  },
  mountain: {
    position: 'absolute',
    bottom: 0,
  },

  // Hills
  hills: {
    position: 'absolute',
    left: 0,
    width: CONFIG.WORLD_WIDTH,
    height: 120,
  },
  distantTrees: {
    position: 'absolute',
    width: CONFIG.WORLD_WIDTH,
    height: 50,
  },
  distantTree: {
    position: 'absolute',
    fontSize: 28,
    opacity: 0.7,
  },

  // Ground
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: CONFIG.WORLD_WIDTH,
    height: WORLD_HEIGHT * 0.45,
  },

  // Scenery
  sceneryItem: {
    position: 'absolute',
  },

  // Objects
  objectContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  objectShadow: {
    position: 'absolute',
    bottom: -4,
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 50,
  },
  reviewGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: 'rgba(251, 191, 36, 0.4)',
    borderRadius: 100,
  },
  emojiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  label: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 80,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Foreground
  foreground: {
    position: 'absolute',
    left: 0,
    width: CONFIG.WORLD_WIDTH,
    height: 50,
  },
  path: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 15,
    backgroundColor: 'rgba(139, 119, 101, 0.5)',
  },
  grass: {
    position: 'absolute',
    bottom: 12,
    fontSize: 18,
  },

  // Empty state
  emptyOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  // Scroll hint
  scrollHint: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollHintText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ParallaxWorldView;
