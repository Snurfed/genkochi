/**
 * LivingWorldView.tsx
 *
 * A "living memory world" sphere where emojis are attached to the globe surface
 * and rotate with it. Objects scale larger as they approach the center.
 *
 * Key features:
 * - Unified rotation for globe + objects (no desync)
 * - Multi-axis rotation (X and Y)
 * - Objects scale based on proximity to center
 * - Smooth momentum and gesture handling
 * - Objects fade at edges, hidden on back
 */

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Circle,
  Ellipse,
  G,
  ClipPath,
  Path,
} from 'react-native-svg';
import { MemoryWorld, WorldObject as WorldObjectType } from '../../types';
import { colors } from '../../constants/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // Globe
  GLOBE_SIZE_RATIO: 0.82,

  // Rotation
  ROTATION_SENSITIVITY: 0.4,
  MOMENTUM_FRICTION: 0.94,
  MIN_VELOCITY: 0.05,

  // Objects
  MAX_VISIBLE_OBJECTS: 12,
  OBJECT_BASE_SIZE: 48,
  CENTER_SCALE_BOOST: 1.6,  // Objects at center are this much larger
  EDGE_SCALE: 0.5,          // Objects at edge are this size
  EDGE_OPACITY: 0.3,

  // Colors
  OCEAN_LIGHT: '#3498DB',
  OCEAN_MID: '#2171B5',
  OCEAN_DARK: '#0D4A7C',
  OCEAN_DEEP: '#062A4D',
  ATMOSPHERE_COLOR: '#4DA6FF',

  // Land colors
  FOREST_GREEN: '#3D8B40',
  JUNGLE_GREEN: '#2E7D32',
  DESERT_TAN: '#C4A35A',
  DESERT_ORANGE: '#B87333',
  ARID_BROWN: '#8B6914',
  GRASSLAND: '#6B8E23',
};

// ============================================
// CONTINENT DATA (simplified outlines)
// ============================================
const CONTINENTS = {
  NORTH_AMERICA: [
    [-130, 50], [-125, 55], [-120, 60], [-140, 65], [-160, 70],
    [-168, 55], [-130, 55], [-125, 45], [-115, 30], [-100, 28],
    [-85, 25], [-75, 35], [-65, 45], [-65, 55], [-85, 65],
    [-110, 70], [-130, 55],
  ] as [number, number][],

  SOUTH_AMERICA: [
    [-80, 10], [-70, 5], [-50, 0], [-40, -10], [-40, -22],
    [-55, -35], [-70, -55], [-75, -45], [-70, -25], [-80, -5],
  ] as [number, number][],

  EUROPE: [
    [-10, 35], [0, 43], [15, 45], [25, 40], [35, 45],
    [30, 55], [20, 58], [10, 65], [20, 70], [10, 55], [-5, 45],
  ] as [number, number][],

  AFRICA: [
    [-15, 35], [15, 30], [35, 25], [50, 12], [40, -5],
    [25, -30], [15, -30], [10, 0], [-15, 10], [-15, 25],
  ] as [number, number][],

  ASIA: [
    [40, 42], [60, 50], [80, 55], [100, 55], [130, 50],
    [140, 40], [120, 25], [100, 10], [80, 20], [60, 30], [45, 40],
  ] as [number, number][],

  AUSTRALIA: [
    [115, -20], [130, -15], [150, -22], [150, -35], [135, -35],
    [120, -30], [115, -25],
  ] as [number, number][],
};

interface LivingWorldViewProps {
  world: MemoryWorld;
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
  onObjectLongPress?: (object: WorldObjectType) => void;
}

export function LivingWorldView({
  world,
  selectedObjectId,
  onObjectPress,
  onObjectLongPress,
}: LivingWorldViewProps) {
  // Shared rotation state (degrees)
  const rotationX = useRef(15); // Slight tilt for better view
  const rotationY = useRef(0);
  const velocityX = useRef(0);
  const velocityY = useRef(0);
  const lastTouchX = useRef(0);
  const lastTouchY = useRef(0);
  const isInteracting = useRef(false);
  const animationRef = useRef<number | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Globe dimensions
  const globeSize = Math.min(SCREEN_WIDTH * CONFIG.GLOBE_SIZE_RATIO, SCREEN_HEIGHT * 0.55);
  const radius = globeSize / 2;
  const center = radius + 20;

  // Force re-render
  const forceUpdate = useCallback(() => {
    setRenderKey(k => k + 1);
  }, []);

  // Momentum animation
  const startMomentum = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      velocityX.current *= CONFIG.MOMENTUM_FRICTION;
      velocityY.current *= CONFIG.MOMENTUM_FRICTION;

      if (Math.abs(velocityX.current) > CONFIG.MIN_VELOCITY ||
          Math.abs(velocityY.current) > CONFIG.MIN_VELOCITY) {
        rotationX.current += velocityX.current;
        rotationY.current += velocityY.current;

        // Clamp X rotation to prevent flip
        rotationX.current = Math.max(-60, Math.min(60, rotationX.current));

        forceUpdate();
        animationRef.current = requestAnimationFrame(animate);
      } else {
        isInteracting.current = false;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [forceUpdate]);

  // Pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,

      onPanResponderGrant: (evt) => {
        isInteracting.current = true;
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        lastTouchX.current = evt.nativeEvent.pageX;
        lastTouchY.current = evt.nativeEvent.pageY;
        velocityX.current = 0;
        velocityY.current = 0;
      },

      onPanResponderMove: (evt, gs) => {
        const dx = evt.nativeEvent.pageX - lastTouchX.current;
        const dy = evt.nativeEvent.pageY - lastTouchY.current;
        lastTouchX.current = evt.nativeEvent.pageX;
        lastTouchY.current = evt.nativeEvent.pageY;

        // Update rotation
        rotationY.current -= dx * CONFIG.ROTATION_SENSITIVITY;
        rotationX.current += dy * CONFIG.ROTATION_SENSITIVITY;

        // Clamp X rotation
        rotationX.current = Math.max(-60, Math.min(60, rotationX.current));

        // Track velocity for momentum
        velocityX.current = dy * CONFIG.ROTATION_SENSITIVITY * 0.3;
        velocityY.current = -dx * CONFIG.ROTATION_SENSITIVITY * 0.3;

        forceUpdate();
      },

      onPanResponderRelease: () => {
        startMomentum();
      },

      onPanResponderTerminate: () => {
        isInteracting.current = false;
      },
    })
  ).current;

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Project a 3D point to 2D screen coordinates
  const project3DPoint = useCallback((
    theta: number, // longitude in radians
    phi: number,   // latitude in radians (0 = north pole, PI = south pole)
  ) => {
    // Convert spherical to cartesian
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);

    // Apply rotation
    const rotXRad = (rotationX.current * Math.PI) / 180;
    const rotYRad = (rotationY.current * Math.PI) / 180;

    // Rotate around Y axis
    let x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
    let z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
    let y1 = y;

    // Rotate around X axis
    let y2 = y1 * Math.cos(rotXRad) - z1 * Math.sin(rotXRad);
    let z2 = y1 * Math.sin(rotXRad) + z1 * Math.cos(rotXRad);
    let x2 = x1;

    // Perspective projection
    const perspective = 2.5;
    const scale = perspective / (perspective - z2 * 0.5);

    const screenX = center + x2 * radius * 0.85 * scale;
    const screenY = center + y2 * radius * 0.85 * scale;

    // Visibility and depth
    const isVisible = z2 > -0.15;
    const depth = z2; // -1 (back) to 1 (front)

    // Scale based on how close to center (front and center = largest)
    const centerProximity = Math.max(0, z2); // 0 at edge, 1 at front center
    const objectScale = CONFIG.EDGE_SCALE + centerProximity * (CONFIG.CENTER_SCALE_BOOST - CONFIG.EDGE_SCALE);

    // Opacity fades at edges
    const opacity = isVisible
      ? CONFIG.EDGE_OPACITY + (depth + 0.15) * (1 - CONFIG.EDGE_OPACITY) / 1.15
      : 0;

    return {
      screenX,
      screenY,
      scale: objectScale,
      opacity,
      depth,
      isVisible,
      zIndex: Math.round((depth + 1) * 100),
    };
  }, [rotationX.current, rotationY.current, center, radius]);

  // Project continent point
  const projectContinentPoint = useCallback((lon: number, lat: number) => {
    const theta = ((lon + rotationY.current) * Math.PI) / 180;
    const phi = ((90 - lat) * Math.PI) / 180;

    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);

    const rotXRad = (rotationX.current * Math.PI) / 180;

    let y2 = y * Math.cos(rotXRad) - z * Math.sin(rotXRad);
    let z2 = y * Math.sin(rotXRad) + z * Math.cos(rotXRad);

    const scale = 0.9 + z2 * 0.1;

    return {
      x: center + x * radius * scale,
      y: center + y2 * radius * scale,
      visible: z2 > -0.1,
      depth: z2,
    };
  }, [rotationX.current, rotationY.current, center, radius]);

  // Create SVG path for continent
  const createContinentPath = useCallback((points: [number, number][]) => {
    let path = '';
    let lastVisible = false;

    points.forEach((point, i) => {
      const projected = projectContinentPoint(point[0], point[1]);

      if (projected.visible) {
        if (!lastVisible) {
          path += `M ${projected.x} ${projected.y} `;
        } else {
          path += `L ${projected.x} ${projected.y} `;
        }
        lastVisible = true;
      } else {
        lastVisible = false;
      }
    });

    if (path) path += 'Z';
    return path;
  }, [projectContinentPoint]);

  // Calculate continent opacity based on average depth
  const getContinentOpacity = useCallback((points: [number, number][]) => {
    const projected = points.map(p => projectContinentPoint(p[0], p[1]));
    const visible = projected.filter(p => p.visible);
    if (visible.length === 0) return 0;

    const avgDepth = visible.reduce((sum, p) => sum + p.depth, 0) / visible.length;
    return Math.max(0.3, Math.min(1, avgDepth + 0.7));
  }, [projectContinentPoint]);

  // Calculate object positions
  const positionedObjects = useMemo(() => {
    const objects = [...world.objects];
    const count = objects.length;
    if (count === 0) return [];

    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    const projected = objects.map((obj, index) => {
      // Fibonacci sphere distribution
      const theta = 2 * Math.PI * index / goldenRatio;
      const phi = Math.acos(1 - 2 * (index + 0.5) / Math.max(count, 1));

      const pos = project3DPoint(theta, phi);

      return {
        ...obj,
        calculated: pos,
      };
    });

    return projected
      .filter(obj => obj.calculated.isVisible)
      .sort((a, b) => b.calculated.depth - a.calculated.depth) // Back to front
      .slice(0, CONFIG.MAX_VISIBLE_OBJECTS)
      .sort((a, b) => a.calculated.zIndex - b.calculated.zIndex);
  }, [world.objects, project3DPoint]);

  // Glow animation for review items
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <View style={styles.background} />

      {/* Globe + Objects container */}
      <View
        {...panResponder.panHandlers}
        style={[styles.globeContainer, { width: globeSize + 40, height: globeSize + 40 }]}
      >
        {/* SVG Globe */}
        <Svg width={globeSize + 40} height={globeSize + 40}>
          <Defs>
            <RadialGradient id="oceanGradient" cx="60%" cy="35%" rx="70%" ry="70%">
              <Stop offset="0%" stopColor={CONFIG.OCEAN_LIGHT} />
              <Stop offset="35%" stopColor={CONFIG.OCEAN_MID} />
              <Stop offset="70%" stopColor={CONFIG.OCEAN_DARK} />
              <Stop offset="100%" stopColor={CONFIG.OCEAN_DEEP} />
            </RadialGradient>

            <RadialGradient id="atmosphereGlow" cx="50%" cy="50%" rx="54%" ry="54%">
              <Stop offset="85%" stopColor={CONFIG.ATMOSPHERE_COLOR} stopOpacity="0" />
              <Stop offset="92%" stopColor={CONFIG.ATMOSPHERE_COLOR} stopOpacity="0.3" />
              <Stop offset="97%" stopColor={CONFIG.ATMOSPHERE_COLOR} stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#87CEEB" stopOpacity="0.2" />
            </RadialGradient>

            <RadialGradient id="sphereShading" cx="70%" cy="40%" rx="70%" ry="70%">
              <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <Stop offset="60%" stopColor="#000000" stopOpacity="0" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
            </RadialGradient>

            <RadialGradient id="specularHighlight" cx="72%" cy="30%" rx="30%" ry="35%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
              <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>

            <ClipPath id="globeClip">
              <Circle cx={center} cy={center} r={radius - 1} />
            </ClipPath>
          </Defs>

          {/* Drop shadow */}
          <Ellipse
            cx={center + 5}
            cy={center + radius + 15}
            rx={radius * 0.7}
            ry={radius * 0.15}
            fill="rgba(0,0,0,0.25)"
          />

          {/* Atmosphere glow */}
          <Circle cx={center} cy={center} r={radius + 10} fill="url(#atmosphereGlow)" />

          {/* Ocean base */}
          <Circle cx={center} cy={center} r={radius} fill="url(#oceanGradient)" />

          {/* Continents */}
          <G clipPath="url(#globeClip)">
            <Path d={createContinentPath(CONTINENTS.NORTH_AMERICA)} fill={CONFIG.FOREST_GREEN} opacity={getContinentOpacity(CONTINENTS.NORTH_AMERICA)} />
            <Path d={createContinentPath(CONTINENTS.SOUTH_AMERICA)} fill={CONFIG.JUNGLE_GREEN} opacity={getContinentOpacity(CONTINENTS.SOUTH_AMERICA)} />
            <Path d={createContinentPath(CONTINENTS.EUROPE)} fill={CONFIG.FOREST_GREEN} opacity={getContinentOpacity(CONTINENTS.EUROPE)} />
            <Path d={createContinentPath(CONTINENTS.AFRICA)} fill={CONFIG.DESERT_TAN} opacity={getContinentOpacity(CONTINENTS.AFRICA)} />
            <Path d={createContinentPath(CONTINENTS.ASIA)} fill={CONFIG.ARID_BROWN} opacity={getContinentOpacity(CONTINENTS.ASIA)} />
            <Path d={createContinentPath(CONTINENTS.AUSTRALIA)} fill={CONFIG.DESERT_ORANGE} opacity={getContinentOpacity(CONTINENTS.AUSTRALIA)} />
          </G>

          {/* Sphere shading */}
          <Circle cx={center} cy={center} r={radius} fill="url(#sphereShading)" />

          {/* Specular highlight */}
          <Circle cx={center} cy={center} r={radius} fill="url(#specularHighlight)" />

          {/* Edge definition */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={CONFIG.ATMOSPHERE_COLOR}
            strokeWidth={1.5}
            strokeOpacity={0.2}
          />
        </Svg>

        {/* Objects overlay */}
        <View style={[styles.objectsOverlay, { width: globeSize + 40, height: globeSize + 40 }]}>
          {positionedObjects.map((obj) => {
            const size = CONFIG.OBJECT_BASE_SIZE * obj.calculated.scale;
            const emojiSize = size * 0.6;
            const isSelected = selectedObjectId === obj.id;

            return (
              <TouchableOpacity
                key={obj.id}
                style={[
                  styles.objectContainer,
                  {
                    left: obj.calculated.screenX - size / 2,
                    top: obj.calculated.screenY - size / 2,
                    width: size,
                    height: size,
                    opacity: obj.calculated.opacity,
                    zIndex: obj.calculated.zIndex,
                  },
                ]}
                onPress={() => onObjectPress(obj)}
                onLongPress={() => onObjectLongPress?.(obj)}
                activeOpacity={0.85}
              >
                {/* Shadow */}
                <View
                  style={[
                    styles.objectShadow,
                    {
                      width: size * 0.7,
                      height: size * 0.15,
                      bottom: -size * 0.08,
                      borderRadius: size * 0.35,
                      opacity: 0.15 + obj.calculated.depth * 0.15,
                    },
                  ]}
                />

                {/* Glow for review items */}
                {obj.needsReview && (
                  <Animated.View
                    style={[
                      styles.glowRing,
                      {
                        width: size + 10,
                        height: size + 10,
                        borderRadius: (size + 10) / 2,
                        opacity: glowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.7],
                        }),
                      },
                    ]}
                  />
                )}

                {/* Emoji bubble */}
                <View
                  style={[
                    styles.emojiBubble,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.4)',
                      borderWidth: isSelected ? 3 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: emojiSize, textAlign: 'center' }}>
                    {obj.emoji}
                  </Text>
                </View>

                {/* Label */}
                {obj.calculated.scale > 0.8 && (
                  <View style={[styles.label, { top: size + 4 }]}>
                    <Text style={styles.labelText} numberOfLines={1}>
                      {obj.displayName}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{world.objects.length}</Text>
          <Text style={styles.statLabel}>Words</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a1a',
  },
  globeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  objectContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  objectShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  glowRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
  },
  emojiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default LivingWorldView;
