/**
 * EarthGlobe.tsx
 *
 * A stylized but believable animated 2D Earth globe.
 * Uses proper spherical projection for continent placement.
 *
 * Visual layers (bottom to top):
 * 1. Drop shadow
 * 2. Ocean base with gradient
 * 3. Continents with spherical projection
 * 4. Cloud layer (optional, slower rotation)
 * 5. Sphere shading / curvature vignette
 * 6. Atmosphere rim glow
 * 7. Specular highlight (subtle)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Circle,
  Path,
  G,
  ClipPath,
  Ellipse,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// TUNABLE CONSTANTS
// ============================================
const CONFIG = {
  // Globe sizing
  GLOBE_SIZE_RATIO: 0.75, // Ratio of screen width

  // Rotation
  ROTATION_SPEED: 0.15, // Degrees per frame (60fps = ~9 degrees/sec)
  CLOUD_SPEED_RATIO: 0.3, // Clouds rotate slower than land

  // Colors - Rich Earth-like palette matching reference
  OCEAN_LIGHT: '#3498DB',    // Bright blue for shallow/lit areas
  OCEAN_MID: '#2171B5',      // Rich mid-blue
  OCEAN_DARK: '#0D4A7C',     // Deep ocean blue
  OCEAN_DEEP: '#062A4D',     // Deepest shadow areas

  // Land colors - varied terrain
  FOREST_GREEN: '#3D8B40',   // Temperate forests
  JUNGLE_GREEN: '#2E7D32',   // Tropical forests
  GRASSLAND: '#6B8E23',      // Savanna/grassland
  DESERT_TAN: '#C4A35A',     // Sandy deserts
  DESERT_ORANGE: '#B87333',  // Arid regions (Australia, Sahara edges)
  ARID_BROWN: '#8B6914',     // Dry mountain regions

  CLOUD_COLOR: '#FFFFFF',
  ATMOSPHERE_COLOR: '#4DA6FF', // Brighter blue for atmosphere glow

  // Opacity
  CLOUD_OPACITY: 0.5,
  ATMOSPHERE_OPACITY: 0.6,    // Stronger atmosphere glow
  SHADOW_OPACITY: 0.35,
  HIGHLIGHT_OPACITY: 0.35,    // Stronger specular

  // Lighting
  LIGHT_ANGLE: -30, // Degrees from top-left
};

interface EarthGlobeProps {
  size?: number;
  isRotating?: boolean;
}

// ============================================
// CONTINENT DATA
// Simplified but recognizable continent outlines
// Coordinates are [longitude, latitude] pairs
// Longitude: -180 to 180, Latitude: -90 to 90
// ============================================

// North America outline (simplified)
const NORTH_AMERICA: [number, number][] = [
  [-130, 50], [-125, 55], [-120, 60], [-140, 65], [-160, 70], [-165, 65],
  [-168, 55], [-155, 58], [-130, 55], [-125, 50], [-125, 45], [-120, 35],
  [-115, 30], [-105, 25], [-100, 28], [-95, 30], [-90, 30], [-85, 25],
  [-80, 25], [-75, 35], [-70, 45], [-65, 45], [-60, 50], [-65, 55],
  [-75, 60], [-85, 65], [-95, 70], [-110, 70], [-125, 65], [-130, 55],
];

// South America outline (simplified)
const SOUTH_AMERICA: [number, number][] = [
  [-80, 10], [-75, 5], [-70, 5], [-60, 0], [-50, 0], [-45, -5],
  [-40, -10], [-38, -15], [-40, -22], [-45, -25], [-50, -30],
  [-55, -35], [-60, -40], [-65, -50], [-70, -55], [-75, -50],
  [-75, -45], [-72, -35], [-70, -25], [-75, -15], [-80, -5], [-80, 5],
];

// Europe outline (simplified)
const EUROPE: [number, number][] = [
  [-10, 35], [-5, 40], [0, 43], [5, 43], [10, 45], [15, 45],
  [20, 42], [25, 40], [30, 45], [35, 45], [40, 42],
  [35, 50], [30, 55], [25, 55], [20, 58], [15, 60],
  [10, 60], [5, 62], [10, 65], [20, 70], [30, 70],
  [25, 65], [20, 60], [10, 55], [5, 50], [0, 48], [-5, 45],
];

// Africa outline (simplified)
const AFRICA: [number, number][] = [
  [-15, 35], [-5, 35], [10, 35], [15, 30], [30, 30], [35, 25],
  [40, 15], [50, 12], [45, 5], [42, 0], [40, -5], [35, -15],
  [30, -25], [25, -30], [20, -35], [15, -30], [12, -20],
  [15, -10], [10, 0], [5, 5], [-5, 5], [-15, 10], [-18, 15],
  [-15, 25], [-10, 30],
];

// Asia outline (simplified - main mass)
const ASIA: [number, number][] = [
  [40, 42], [50, 45], [60, 50], [70, 55], [80, 55], [90, 50],
  [100, 55], [110, 55], [120, 55], [130, 50], [140, 45], [145, 45],
  [140, 40], [130, 35], [125, 30], [120, 25], [110, 20], [105, 15],
  [100, 10], [95, 5], [90, 10], [85, 15], [80, 20], [75, 25],
  [70, 25], [65, 25], [60, 30], [55, 30], [50, 35], [45, 40],
];

// India subcontinent
const INDIA: [number, number][] = [
  [70, 30], [75, 28], [78, 25], [80, 20], [82, 15], [80, 10],
  [78, 8], [75, 10], [72, 15], [70, 20], [68, 25], [70, 28],
];

// Australia outline (simplified)
const AUSTRALIA: [number, number][] = [
  [115, -20], [120, -18], [130, -15], [140, -15], [145, -18],
  [150, -22], [153, -28], [150, -35], [145, -38], [140, -38],
  [135, -35], [130, -32], [125, -30], [120, -30], [115, -28],
  [113, -25], [115, -22],
];

// Japan (simplified)
const JAPAN: [number, number][] = [
  [130, 32], [132, 34], [135, 35], [138, 36], [140, 38],
  [142, 42], [145, 44], [144, 42], [140, 38], [138, 35],
  [135, 33], [132, 32],
];

// UK (simplified)
const UK: [number, number][] = [
  [-6, 50], [-5, 52], [-3, 54], [-5, 56], [-3, 58], [-5, 58],
  [-7, 56], [-6, 54], [-8, 52], [-6, 50],
];

// Greenland (simplified)
const GREENLAND: [number, number][] = [
  [-45, 60], [-35, 65], [-25, 70], [-20, 75], [-30, 80],
  [-45, 82], [-55, 78], [-60, 72], [-55, 65], [-50, 62],
];

export function EarthGlobe({ size, isRotating = true }: EarthGlobeProps) {
  const globeSize = size || SCREEN_WIDTH * CONFIG.GLOBE_SIZE_RATIO;
  const radius = globeSize / 2;
  const center = radius + 20; // Account for shadow/glow

  // Rotation state
  const rotation = useRef(0);
  const animationRef = useRef<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Animation loop
  const animate = useCallback(() => {
    rotation.current = (rotation.current + CONFIG.ROTATION_SPEED) % 360;
    forceUpdate(n => n + 1);
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isRotating) {
      animationRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRotating, animate]);

  /**
   * Project a longitude/latitude point onto the visible sphere
   * Returns null if the point is on the back side of the globe
   */
  const projectPoint = (lon: number, lat: number, rotOffset: number = 0): { x: number; y: number; visible: boolean; depth: number } | null => {
    // Apply rotation
    const adjustedLon = lon + rotation.current + rotOffset;
    const lonRad = (adjustedLon * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;

    // 3D coordinates on unit sphere
    const x3d = Math.cos(latRad) * Math.sin(lonRad);
    const y3d = -Math.sin(latRad); // Flip Y for screen coordinates
    const z3d = Math.cos(latRad) * Math.cos(lonRad);

    // Only render front-facing points
    const visible = z3d > -0.1;

    // Project to 2D with slight perspective
    const scale = 0.9 + z3d * 0.1;
    const x = center + x3d * radius * scale;
    const y = center + y3d * radius * scale;

    return { x, y, visible, depth: z3d };
  };

  /**
   * Create SVG path from continent outline
   * Handles wrapping when continent crosses the visible boundary
   */
  const createContinentPath = (points: [number, number][], rotOffset: number = 0): string => {
    const projected = points.map(([lon, lat]) => projectPoint(lon, lat, rotOffset));

    // Filter to visible points and create path
    let path = '';
    let lastVisible = false;

    projected.forEach((point, i) => {
      if (!point) return;

      if (point.visible) {
        if (!lastVisible || i === 0) {
          path += `M ${point.x} ${point.y} `;
        } else {
          path += `L ${point.x} ${point.y} `;
        }
        lastVisible = true;
      } else {
        lastVisible = false;
      }
    });

    // Close the path if we have visible points
    if (path) {
      path += 'Z';
    }

    return path;
  };

  /**
   * Calculate opacity based on depth (fade at edges)
   */
  const getDepthOpacity = (points: [number, number][], rotOffset: number = 0): number => {
    const projected = points.map(([lon, lat]) => projectPoint(lon, lat, rotOffset));
    const visiblePoints = projected.filter(p => p && p.visible);
    if (visiblePoints.length === 0) return 0;

    const avgDepth = visiblePoints.reduce((sum, p) => sum + (p?.depth || 0), 0) / visiblePoints.length;
    return Math.max(0.3, Math.min(1, avgDepth + 0.7));
  };

  // Render a continent
  const renderContinent = (points: [number, number][], color: string, key: string) => {
    const path = createContinentPath(points);
    const opacity = getDepthOpacity(points);

    if (!path || opacity < 0.1) return null;

    return (
      <Path
        key={key}
        d={path}
        fill={color}
        opacity={opacity}
      />
    );
  };

  // Render cloud ellipse at position
  const renderCloud = (lon: number, lat: number, width: number, height: number, key: string) => {
    const point = projectPoint(lon, lat, rotation.current * CONFIG.CLOUD_SPEED_RATIO - rotation.current);
    if (!point || !point.visible || point.depth < 0) return null;

    const scale = 0.5 + point.depth * 0.5;
    return (
      <Ellipse
        key={key}
        cx={point.x}
        cy={point.y}
        rx={width * scale}
        ry={height * scale}
        fill={CONFIG.CLOUD_COLOR}
        opacity={CONFIG.CLOUD_OPACITY * Math.max(0.3, point.depth + 0.5)}
      />
    );
  };

  return (
    <View style={[styles.container, { width: globeSize + 40, height: globeSize + 40 }]}>
      <Svg width={globeSize + 40} height={globeSize + 40}>
        <Defs>
          {/* Ocean gradient - richer blues with more depth */}
          <RadialGradient id="oceanGradient" cx="60%" cy="35%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor={CONFIG.OCEAN_LIGHT} />
            <Stop offset="35%" stopColor={CONFIG.OCEAN_MID} />
            <Stop offset="70%" stopColor={CONFIG.OCEAN_DARK} />
            <Stop offset="100%" stopColor={CONFIG.OCEAN_DEEP} />
          </RadialGradient>

          {/* Atmosphere glow - bright blue rim like reference */}
          <RadialGradient id="atmosphereGlow" cx="50%" cy="50%" rx="54%" ry="54%">
            <Stop offset="85%" stopColor={CONFIG.ATMOSPHERE_COLOR} stopOpacity="0" />
            <Stop offset="92%" stopColor={CONFIG.ATMOSPHERE_COLOR} stopOpacity="0.3" />
            <Stop offset="97%" stopColor={CONFIG.ATMOSPHERE_COLOR} stopOpacity={String(CONFIG.ATMOSPHERE_OPACITY)} />
            <Stop offset="100%" stopColor="#87CEEB" stopOpacity="0.2" />
          </RadialGradient>

          {/* Sphere shading (curvature) - darker on left for sun from right */}
          <RadialGradient id="sphereShading" cx="70%" cy="40%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="50%" stopColor="#000000" stopOpacity="0" />
            <Stop offset="85%" stopColor="#000000" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
          </RadialGradient>

          {/* Specular highlight - positioned on RIGHT side like reference */}
          <RadialGradient id="specularHighlight" cx="72%" cy="30%" rx="30%" ry="35%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={String(CONFIG.HIGHLIGHT_OPACITY)} />
            <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>

          {/* Secondary highlight for rim lighting on right edge */}
          <LinearGradient id="rimLight" x1="70%" y1="0%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="50%" stopColor="#87CEEB" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#4DA6FF" stopOpacity="0.25" />
          </LinearGradient>

          {/* Drop shadow gradient */}
          <RadialGradient id="dropShadow" cx="55%" cy="60%" rx="50%" ry="50%">
            <Stop offset="80%" stopColor="#000000" stopOpacity={String(CONFIG.SHADOW_OPACITY)} />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>

          {/* Clip path for globe */}
          <ClipPath id="globeClip">
            <Circle cx={center} cy={center} r={radius - 1} />
          </ClipPath>
        </Defs>

        {/* Layer 1: Drop shadow */}
        <Ellipse
          cx={center + 5}
          cy={center + 8}
          rx={radius * 0.95}
          ry={radius * 0.3}
          fill="url(#dropShadow)"
        />

        {/* Layer 2: Atmosphere glow */}
        <Circle cx={center} cy={center} r={radius + 12} fill="url(#atmosphereGlow)" />

        {/* Layer 3: Ocean base */}
        <Circle cx={center} cy={center} r={radius} fill="url(#oceanGradient)" />

        {/* Layer 4: Continents with realistic terrain colors */}
        <G clipPath="url(#globeClip)">
          {/* Americas - mix of forests and varied terrain */}
          {renderContinent(NORTH_AMERICA, CONFIG.FOREST_GREEN, 'northAmerica')}
          {renderContinent(SOUTH_AMERICA, CONFIG.JUNGLE_GREEN, 'southAmerica')}
          {renderContinent(GREENLAND, '#E8E8E8', 'greenland')} {/* Ice/snow */}

          {/* Europe - temperate forests */}
          {renderContinent(EUROPE, CONFIG.FOREST_GREEN, 'europe')}
          {renderContinent(UK, CONFIG.GRASSLAND, 'uk')}

          {/* Africa - desert tan/orange for Sahara effect */}
          {renderContinent(AFRICA, CONFIG.DESERT_TAN, 'africa')}

          {/* Asia - varied terrain from forests to arid */}
          {renderContinent(ASIA, CONFIG.ARID_BROWN, 'asia')}
          {renderContinent(INDIA, CONFIG.GRASSLAND, 'india')}
          {renderContinent(JAPAN, CONFIG.FOREST_GREEN, 'japan')}

          {/* Australia - outback orange/red-brown */}
          {renderContinent(AUSTRALIA, CONFIG.DESERT_ORANGE, 'australia')}

          {/* Layer 5: Clouds */}
          {renderCloud(-60, 40, radius * 0.15, radius * 0.04, 'cloud1')}
          {renderCloud(20, -20, radius * 0.12, radius * 0.035, 'cloud2')}
          {renderCloud(100, 30, radius * 0.18, radius * 0.045, 'cloud3')}
          {renderCloud(-120, -10, radius * 0.14, radius * 0.04, 'cloud4')}
          {renderCloud(60, 55, radius * 0.1, radius * 0.03, 'cloud5')}
          {renderCloud(-30, -45, radius * 0.13, radius * 0.035, 'cloud6')}
          {renderCloud(150, -30, radius * 0.11, radius * 0.03, 'cloud7')}

          {/* Polar ice hints */}
          <Ellipse
            cx={center}
            cy={center - radius * 0.85}
            rx={radius * 0.4}
            ry={radius * 0.1}
            fill="#FFFFFF"
            opacity={0.6}
          />
          <Ellipse
            cx={center}
            cy={center + radius * 0.88}
            rx={radius * 0.5}
            ry={radius * 0.12}
            fill="#FFFFFF"
            opacity={0.5}
          />
        </G>

        {/* Layer 6: Sphere curvature shading */}
        <Circle cx={center} cy={center} r={radius} fill="url(#sphereShading)" />

        {/* Layer 7: Specular highlight on right side */}
        <Circle cx={center} cy={center} r={radius} fill="url(#specularHighlight)" />

        {/* Layer 8: Rim light on right edge */}
        <Circle cx={center} cy={center} r={radius} fill="url(#rimLight)" />

        {/* Layer 9: Subtle edge definition */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={CONFIG.ATMOSPHERE_COLOR}
          strokeWidth={1.5}
          strokeOpacity={0.25}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EarthGlobe;
