/**
 * IllustratedWorldView.tsx
 *
 * Professional SVG-illustrated parallax landscape.
 * No emojis - all custom vector artwork.
 * Inspired by Alto's Adventure / Monument Valley aesthetic.
 */

import React, { useRef, useMemo, useEffect } from 'react';
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
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Ellipse,
  G,
} from 'react-native-svg';
import { MemoryWorld, WorldObject as WorldObjectType, ObjectCategory } from '../../types';
import { colors } from '../../constants/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// CONFIGURATION
// ============================================
const WORLD_HEIGHT = SCREEN_HEIGHT * 0.78;
const WORLD_WIDTH = SCREEN_WIDTH * 2.5;
const HORIZON_Y = WORLD_HEIGHT * 0.58;

// Color palettes by time of day
interface Palette {
  sky: readonly [string, string, string, string];
  mountains: { far: string; mid: string; near: string };
  ground: readonly [string, string, string];
  accent: string;
  celestial: string;
  stars?: string;
}

const PALETTES: Record<'day' | 'sunset' | 'night', Palette> = {
  day: {
    sky: ['#87CEEB', '#B4E7F8', '#E0F4FF', '#F0F9FF'],
    mountains: {
      far: '#C5D5E4',
      mid: '#9BB5C9',
      near: '#7A9BB5',
    },
    ground: ['#8FBC8F', '#7CAD7C', '#6B9B6B'],
    accent: '#FFD93D',
    celestial: '#FFE066',
  },
  sunset: {
    sky: ['#FF6B6B', '#FFA07A', '#FFD93D', '#FFE4B5'],
    mountains: {
      far: '#D4A5A5',
      mid: '#C08080',
      near: '#8B6B6B',
    },
    ground: ['#6B8E6B', '#5A7A5A', '#4A6A4A'],
    accent: '#FF8C42',
    celestial: '#FF6B35',
  },
  night: {
    sky: ['#1A1A2E', '#16213E', '#0F3460', '#1A1A40'],
    mountains: {
      far: '#2D3A4A',
      mid: '#1E2A38',
      near: '#151E28',
    },
    ground: ['#2D4A3E', '#243D33', '#1B3028'],
    accent: '#E8E8E8',
    celestial: '#F5F5DC',
    stars: '#FFFFFF',
  },
};

const getTimeOfDay = (): 'day' | 'sunset' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
};

// ============================================
// SVG COMPONENTS
// ============================================

// Stylized tree component
const Tree = ({ x, y, scale = 1, variant = 0 }: { x: number; y: number; scale?: number; variant?: number }) => {
  const height = 60 * scale;
  const width = 30 * scale;

  if (variant === 0) {
    // Pine tree
    return (
      <G transform={`translate(${x - width/2}, ${y - height})`}>
        {/* Trunk */}
        <Rect x={width * 0.4} y={height * 0.75} width={width * 0.2} height={height * 0.25} fill="#5D4037" />
        {/* Foliage layers */}
        <Path
          d={`M${width/2},0 L${width},${height * 0.4} L${width * 0.7},${height * 0.4} L${width * 0.9},${height * 0.65} L${width * 0.65},${height * 0.65} L${width * 0.8},${height * 0.85} L${width * 0.2},${height * 0.85} L${width * 0.35},${height * 0.65} L${width * 0.1},${height * 0.65} L${width * 0.3},${height * 0.4} L0,${height * 0.4} Z`}
          fill="#2E7D32"
        />
        <Path
          d={`M${width/2},0 L${width * 0.85},${height * 0.35} L${width * 0.15},${height * 0.35} Z`}
          fill="#43A047"
        />
      </G>
    );
  } else {
    // Round tree
    return (
      <G transform={`translate(${x - width/2}, ${y - height})`}>
        {/* Trunk */}
        <Rect x={width * 0.35} y={height * 0.6} width={width * 0.3} height={height * 0.4} fill="#6D4C41" rx={2} />
        {/* Foliage */}
        <Circle cx={width/2} cy={height * 0.35} r={width * 0.5} fill="#388E3C" />
        <Circle cx={width * 0.35} cy={height * 0.4} r={width * 0.35} fill="#43A047" />
        <Circle cx={width * 0.65} cy={height * 0.3} r={width * 0.3} fill="#4CAF50" />
      </G>
    );
  }
};

// Simple house
const House = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => {
  const width = 50 * scale;
  const height = 45 * scale;

  return (
    <G transform={`translate(${x - width/2}, ${y - height})`}>
      {/* Main body */}
      <Rect x={width * 0.1} y={height * 0.4} width={width * 0.8} height={height * 0.6} fill="#E8D4B8" />
      {/* Roof */}
      <Path
        d={`M0,${height * 0.45} L${width/2},${height * 0.05} L${width},${height * 0.45} Z`}
        fill="#8B4513"
      />
      {/* Door */}
      <Rect x={width * 0.4} y={height * 0.6} width={width * 0.2} height={height * 0.4} fill="#5D4037" rx={2} />
      {/* Window */}
      <Rect x={width * 0.2} y={height * 0.5} width={width * 0.15} height={height * 0.15} fill="#87CEEB" stroke="#5D4037" strokeWidth={1} />
      <Rect x={width * 0.65} y={height * 0.5} width={width * 0.15} height={height * 0.15} fill="#87CEEB" stroke="#5D4037" strokeWidth={1} />
    </G>
  );
};

// Flower
const Flower = ({ x, y, color = '#FF69B4', scale = 1 }: { x: number; y: number; color?: string; scale?: number }) => {
  const size = 12 * scale;

  return (
    <G transform={`translate(${x}, ${y})`}>
      {/* Stem */}
      <Path d={`M0,0 Q${size * 0.2},${size} 0,${size * 2}`} stroke="#228B22" strokeWidth={2} fill="none" />
      {/* Petals */}
      <Circle cx={0} cy={-size * 0.3} r={size * 0.4} fill={color} />
      <Circle cx={size * 0.35} cy={0} r={size * 0.4} fill={color} />
      <Circle cx={size * 0.2} cy={size * 0.35} r={size * 0.4} fill={color} />
      <Circle cx={-size * 0.2} cy={size * 0.35} r={size * 0.4} fill={color} />
      <Circle cx={-size * 0.35} cy={0} r={size * 0.4} fill={color} />
      {/* Center */}
      <Circle cx={0} cy={0} r={size * 0.25} fill="#FFD700" />
    </G>
  );
};

// Cloud
const Cloud = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => {
  const width = 80 * scale;

  return (
    <G transform={`translate(${x}, ${y})`} opacity={0.9}>
      <Ellipse cx={width * 0.3} cy={0} rx={width * 0.25} ry={width * 0.15} fill="white" />
      <Ellipse cx={width * 0.5} cy={-width * 0.05} rx={width * 0.3} ry={width * 0.18} fill="white" />
      <Ellipse cx={width * 0.7} cy={0} rx={width * 0.22} ry={width * 0.13} fill="white" />
      <Ellipse cx={width * 0.4} cy={width * 0.08} rx={width * 0.35} ry={width * 0.12} fill="white" />
    </G>
  );
};

// Bird silhouette
const Bird = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => {
  const size = 15 * scale;
  return (
    <Path
      d={`M${x},${y} Q${x - size},${y - size * 0.5} ${x - size * 1.5},${y} M${x},${y} Q${x + size},${y - size * 0.5} ${x + size * 1.5},${y}`}
      stroke="#333"
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
    />
  );
};

// Category to icon mapping with SVG rendering
const getCategoryIcon = (category: ObjectCategory): { color: string; icon: string } => {
  switch (category) {
    case 'food': return { color: '#FF6B6B', icon: 'food' };
    case 'animal': return { color: '#4ECDC4', icon: 'animal' };
    case 'nature': return { color: '#95E1A3', icon: 'nature' };
    case 'building': return { color: '#DDA15E', icon: 'building' };
    case 'furniture': return { color: '#BC6C25', icon: 'furniture' };
    case 'vehicle': return { color: '#457B9D', icon: 'vehicle' };
    case 'electronic': return { color: '#6C63FF', icon: 'electronic' };
    case 'clothing': return { color: '#E07BE0', icon: 'clothing' };
    case 'sky': return { color: '#74B9FF', icon: 'sky' };
    default: return { color: '#95A5A6', icon: 'default' };
  }
};

interface IllustratedWorldViewProps {
  world: MemoryWorld;
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
  onObjectLongPress?: (object: WorldObjectType) => void;
}

export function IllustratedWorldView({
  world,
  selectedObjectId,
  onObjectPress,
  onObjectLongPress,
}: IllustratedWorldViewProps) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const cloudAnim = useRef(new Animated.Value(0)).current;
  const birdAnim = useRef(new Animated.Value(0)).current;

  const timeOfDay = getTimeOfDay();
  const palette = PALETTES[timeOfDay];

  // Animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(cloudAnim, {
        toValue: 1,
        duration: 60000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(birdAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(birdAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Progression
  const progression = useMemo(() => {
    const count = world.objects.length;
    if (count === 0) return 0;
    if (count <= 5) return 1;
    if (count <= 15) return 2;
    if (count <= 30) return 3;
    return 4;
  }, [world.objects.length]);

  // Position objects
  const positionedObjects = useMemo(() => {
    return world.objects.map((obj, index) => {
      const hash = obj.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const segmentWidth = (WORLD_WIDTH - 200) / Math.max(world.objects.length, 1);
      const x = 100 + segmentWidth * index + (hash % 50);
      const y = HORIZON_Y + 20 + (hash % 60);

      return { ...obj, x, y };
    });
  }, [world.objects]);

  // Parallax transform helper
  const createParallaxStyle = (speed: number) => ({
    transform: [
      {
        translateX: scrollX.interpolate({
          inputRange: [0, WORLD_WIDTH - SCREEN_WIDTH],
          outputRange: [0, -(WORLD_WIDTH - SCREEN_WIDTH) * (1 - speed)],
          extrapolate: 'clamp',
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      {/* Static SVG Background */}
      <Svg width={SCREEN_WIDTH} height={WORLD_HEIGHT} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Sky gradient */}
          <LinearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.sky[0]} />
            <Stop offset="0.3" stopColor={palette.sky[1]} />
            <Stop offset="0.6" stopColor={palette.sky[2]} />
            <Stop offset="1" stopColor={palette.sky[3]} />
          </LinearGradient>

          {/* Ground gradient */}
          <LinearGradient id="groundGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.ground[0]} />
            <Stop offset="0.5" stopColor={palette.ground[1]} />
            <Stop offset="1" stopColor={palette.ground[2]} />
          </LinearGradient>

          {/* Sun/Moon glow */}
          <RadialGradient id="celestialGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={palette.celestial} stopOpacity="1" />
            <Stop offset="0.5" stopColor={palette.celestial} stopOpacity="0.3" />
            <Stop offset="1" stopColor={palette.celestial} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Sky */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={WORLD_HEIGHT} fill="url(#skyGradient)" />

        {/* Stars (night only) */}
        {timeOfDay === 'night' && (
          <G>
            {[...Array(30)].map((_, i) => (
              <Circle
                key={i}
                cx={Math.random() * SCREEN_WIDTH}
                cy={Math.random() * HORIZON_Y * 0.7}
                r={Math.random() * 1.5 + 0.5}
                fill={palette.stars || '#FFFFFF'}
                opacity={Math.random() * 0.5 + 0.5}
              />
            ))}
          </G>
        )}

        {/* Sun or Moon */}
        <Circle
          cx={SCREEN_WIDTH * 0.8}
          cy={WORLD_HEIGHT * 0.15}
          r={40}
          fill="url(#celestialGlow)"
        />
        <Circle
          cx={SCREEN_WIDTH * 0.8}
          cy={WORLD_HEIGHT * 0.15}
          r={25}
          fill={palette.celestial}
        />
      </Svg>

      {/* Scrollable world content */}
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        contentContainerStyle={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}
        decelerationRate="normal"
      >
        {/* Far mountains layer */}
        <Animated.View style={[styles.absoluteLayer, createParallaxStyle(0.15)]}>
          <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            <Path
              d={`M0,${HORIZON_Y}
                  L100,${HORIZON_Y - 80}
                  L200,${HORIZON_Y - 40}
                  L350,${HORIZON_Y - 120}
                  L500,${HORIZON_Y - 60}
                  L650,${HORIZON_Y - 140}
                  L800,${HORIZON_Y - 50}
                  L950,${HORIZON_Y - 100}
                  L1100,${HORIZON_Y - 70}
                  L1250,${HORIZON_Y - 130}
                  L1400,${HORIZON_Y - 40}
                  L1550,${HORIZON_Y - 90}
                  L${WORLD_WIDTH},${HORIZON_Y - 60}
                  L${WORLD_WIDTH},${WORLD_HEIGHT}
                  L0,${WORLD_HEIGHT} Z`}
              fill={palette.mountains.far}
              opacity={0.6}
            />
          </Svg>
        </Animated.View>

        {/* Mid mountains layer */}
        <Animated.View style={[styles.absoluteLayer, createParallaxStyle(0.3)]}>
          <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            <Path
              d={`M0,${HORIZON_Y + 20}
                  L150,${HORIZON_Y - 60}
                  L300,${HORIZON_Y - 20}
                  L450,${HORIZON_Y - 90}
                  L600,${HORIZON_Y - 30}
                  L750,${HORIZON_Y - 100}
                  L900,${HORIZON_Y - 40}
                  L1050,${HORIZON_Y - 80}
                  L1200,${HORIZON_Y - 30}
                  L1350,${HORIZON_Y - 70}
                  L${WORLD_WIDTH},${HORIZON_Y}
                  L${WORLD_WIDTH},${WORLD_HEIGHT}
                  L0,${WORLD_HEIGHT} Z`}
              fill={palette.mountains.mid}
              opacity={0.8}
            />
          </Svg>
        </Animated.View>

        {/* Clouds layer */}
        <Animated.View
          style={[
            styles.absoluteLayer,
            createParallaxStyle(0.1),
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
          <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            <Cloud x={100} y={WORLD_HEIGHT * 0.12} scale={1} />
            <Cloud x={400} y={WORLD_HEIGHT * 0.08} scale={0.8} />
            <Cloud x={700} y={WORLD_HEIGHT * 0.15} scale={1.2} />
            <Cloud x={1000} y={WORLD_HEIGHT * 0.1} scale={0.9} />
            {progression >= 2 && <Cloud x={1300} y={WORLD_HEIGHT * 0.12} scale={1.1} />}
          </Svg>
        </Animated.View>

        {/* Near mountains / hills */}
        <Animated.View style={[styles.absoluteLayer, createParallaxStyle(0.5)]}>
          <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            <Path
              d={`M0,${HORIZON_Y + 10}
                  Q100,${HORIZON_Y - 30} 200,${HORIZON_Y + 5}
                  Q350,${HORIZON_Y - 40} 500,${HORIZON_Y}
                  Q650,${HORIZON_Y - 35} 800,${HORIZON_Y + 10}
                  Q950,${HORIZON_Y - 25} 1100,${HORIZON_Y + 5}
                  Q1250,${HORIZON_Y - 30} 1400,${HORIZON_Y}
                  L${WORLD_WIDTH},${HORIZON_Y + 10}
                  L${WORLD_WIDTH},${WORLD_HEIGHT}
                  L0,${WORLD_HEIGHT} Z`}
              fill={palette.mountains.near}
            />
          </Svg>
        </Animated.View>

        {/* Ground layer */}
        <View style={styles.absoluteLayer}>
          <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            <Rect
              x="0"
              y={HORIZON_Y}
              width={WORLD_WIDTH}
              height={WORLD_HEIGHT - HORIZON_Y}
              fill="url(#groundGradient)"
            />
            {/* Ground texture lines */}
            <Path
              d={`M0,${HORIZON_Y + 3} Q${WORLD_WIDTH / 4},${HORIZON_Y + 8} ${WORLD_WIDTH / 2},${HORIZON_Y + 3} Q${WORLD_WIDTH * 0.75},${HORIZON_Y - 2} ${WORLD_WIDTH},${HORIZON_Y + 5}`}
              stroke={palette.ground[1]}
              strokeWidth={2}
              fill="none"
              opacity={0.5}
            />
          </Svg>
        </View>

        {/* Main scenery layer (trees, houses, etc.) */}
        <View style={styles.absoluteLayer}>
          <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT}>
            {/* Base scenery - always visible */}
            <Tree x={80} y={HORIZON_Y + 5} scale={1.2} variant={0} />
            <Tree x={200} y={HORIZON_Y + 10} scale={0.9} variant={1} />

            {progression >= 1 && (
              <>
                <Flower x={150} y={HORIZON_Y + 25} color="#FF69B4" scale={1} />
                <Tree x={400} y={HORIZON_Y + 8} scale={1.1} variant={0} />
                <Flower x={350} y={HORIZON_Y + 30} color="#FFD93D" scale={0.9} />
              </>
            )}

            {progression >= 2 && (
              <>
                <House x={280} y={HORIZON_Y + 5} scale={1} />
                <Tree x={550} y={HORIZON_Y + 12} scale={1} variant={1} />
                <Flower x={500} y={HORIZON_Y + 28} color="#FF6B6B" scale={1.1} />
                <Tree x={700} y={HORIZON_Y + 6} scale={1.3} variant={0} />
              </>
            )}

            {progression >= 3 && (
              <>
                <House x={850} y={HORIZON_Y + 8} scale={1.1} />
                <Tree x={950} y={HORIZON_Y + 10} scale={1} variant={1} />
                <Tree x={1100} y={HORIZON_Y + 5} scale={1.2} variant={0} />
                <Flower x={1000} y={HORIZON_Y + 32} color="#E07BE0" scale={1} />
              </>
            )}

            {progression >= 4 && (
              <>
                <Bird x={300} y={WORLD_HEIGHT * 0.25} scale={1} />
                <Bird x={750} y={WORLD_HEIGHT * 0.2} scale={0.8} />
                <House x={1250} y={HORIZON_Y + 6} scale={0.9} />
                <Tree x={1400} y={HORIZON_Y + 8} scale={1.1} variant={0} />
              </>
            )}
          </Svg>
        </View>

        {/* User's vocabulary objects */}
        <View style={styles.absoluteLayer}>
          {positionedObjects.map((obj) => {
            const isSelected = selectedObjectId === obj.id;
            const { color } = getCategoryIcon(obj.category);
            const size = 52;

            return (
              <TouchableOpacity
                key={obj.id}
                style={[
                  styles.objectContainer,
                  {
                    left: obj.x - size / 2,
                    top: obj.y - size / 2,
                  },
                ]}
                onPress={() => onObjectPress(obj)}
                onLongPress={() => onObjectLongPress?.(obj)}
                activeOpacity={0.9}
              >
                {/* Shadow */}
                <View style={styles.objectShadow} />

                {/* Glow ring for items needing review */}
                {obj.needsReview && (
                  <View style={[styles.reviewGlow, { borderColor: '#FFD93D' }]} />
                )}

                {/* Main circle with category color */}
                <View
                  style={[
                    styles.objectCircle,
                    {
                      backgroundColor: 'white',
                      borderColor: isSelected ? colors.primary : color,
                      borderWidth: isSelected ? 3 : 2,
                    },
                  ]}
                >
                  {/* Category color indicator */}
                  <View style={[styles.categoryDot, { backgroundColor: color }]} />

                  {/* Word display */}
                  <Text style={styles.objectText} numberOfLines={1}>
                    {obj.displayName}
                  </Text>
                </View>

                {/* English label below */}
                <View style={styles.objectLabel}>
                  <Text style={styles.objectLabelText} numberOfLines={1}>
                    {obj.english}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Path/road in foreground */}
        <View style={[styles.absoluteLayer, { top: WORLD_HEIGHT - 30 }]}>
          <Svg width={WORLD_WIDTH} height={30}>
            <Path
              d={`M0,15 Q${WORLD_WIDTH * 0.25},5 ${WORLD_WIDTH * 0.5},15 Q${WORLD_WIDTH * 0.75},25 ${WORLD_WIDTH},12`}
              stroke="rgba(139, 119, 85, 0.4)"
              strokeWidth={20}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={`M0,15 Q${WORLD_WIDTH * 0.25},5 ${WORLD_WIDTH * 0.5},15 Q${WORLD_WIDTH * 0.75},25 ${WORLD_WIDTH},12`}
              stroke="rgba(210, 180, 140, 0.3)"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="10,15"
            />
          </Svg>
        </View>
      </Animated.ScrollView>

      {/* Empty state */}
      {world.objects.length === 0 && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your World Awaits</Text>
            <Text style={styles.emptyText}>
              Take photos to discover words and watch your world come to life
            </Text>
          </View>
        </View>
      )}

      {/* Scroll indicator */}
      {world.objects.length >= 2 && (
        <View style={styles.scrollHint}>
          <View style={styles.scrollPill}>
            <Text style={styles.scrollText}>Swipe to explore</Text>
          </View>
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
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  },

  // Objects
  objectContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: 70,
  },
  objectShadow: {
    position: 'absolute',
    bottom: 18,
    width: 40,
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
  },
  reviewGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    backgroundColor: 'rgba(255, 217, 61, 0.2)',
  },
  objectCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  categoryDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  objectText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  objectLabel: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 70,
  },
  objectLabelText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Empty state
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    fontSize: 20,
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

  // Scroll hint
  scrollHint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scrollPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scrollText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default IllustratedWorldView;
