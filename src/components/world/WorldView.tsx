/**
 * WorldView.tsx
 *
 * Main world view component that displays an Earth globe with
 * user's vocabulary objects placed on the surface.
 */

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  PanResponder,
} from 'react-native';
import { MemoryWorld, WORLD_THEMES, WorldObject as WorldObjectType } from '../../types';
import { WorldObject } from './WorldObject';
import { EarthGlobe } from './EarthGlobe';
import { AmbientParticles } from './AmbientParticles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WorldViewProps {
  world: MemoryWorld;
  selectedObjectId: string | null;
  onObjectPress: (object: WorldObjectType) => void;
  showAmbient?: boolean;
}

export function WorldView({
  world,
  selectedObjectId,
  onObjectPress,
  showAmbient = true,
}: WorldViewProps) {
  const theme = useMemo(
    () => WORLD_THEMES.find(t => t.id === world.type) || WORLD_THEMES[0],
    [world.type]
  );

  // Globe rotation state (shared with objects)
  const rotationY = useRef(0);
  const lastTouchX = useRef(0);
  const velocityRef = useRef(0);
  const isInteracting = useRef(false);
  const animationRef = useRef<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Globe size
  const globeSize = Math.min(SCREEN_WIDTH * 0.85, SCREEN_HEIGHT * 0.5);
  const globeRadius = globeSize / 2;

  // Update rotation
  const updateRotation = useCallback((newValue: number) => {
    rotationY.current = newValue;
    forceUpdate(n => n + 1);
  }, []);

  // Momentum animation
  const startMomentum = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      velocityRef.current *= 0.94;

      if (Math.abs(velocityRef.current) > 0.05) {
        updateRotation(rotationY.current + velocityRef.current);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        isInteracting.current = false;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [updateRotation]);

  // Pan responder for touch rotation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: (evt) => {
        isInteracting.current = true;
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        lastTouchX.current = evt.nativeEvent.pageX;
        velocityRef.current = 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        const dx = evt.nativeEvent.pageX - lastTouchX.current;
        lastTouchX.current = evt.nativeEvent.pageX;

        // Swipe right = rotate right
        const rotationDelta = -dx * 0.5;
        updateRotation(rotationY.current + rotationDelta);
        velocityRef.current = -gestureState.vx * 8;
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

  // Maximum visible objects at once
  const MAX_VISIBLE_OBJECTS = 10;

  // Calculate 3D positions for objects on sphere surface
  const positionedObjects = useMemo(() => {
    const objects = [...world.objects];
    const count = objects.length;
    if (count === 0) return [];

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const currentRotation = rotationY.current;

    const projected = objects.map((obj, index) => {
      // Fibonacci sphere distribution for even spacing
      const theta = 2 * Math.PI * index / goldenRatio;
      const phi = Math.acos(1 - 2 * (index + 0.5) / Math.max(count, 1));

      // Base 3D position on unit sphere
      const baseX = Math.sin(phi) * Math.cos(theta);
      const baseY = Math.sin(phi) * Math.sin(theta);
      const baseZ = Math.cos(phi);

      // Apply Y-axis rotation
      const rotRad = (currentRotation * Math.PI) / 180;
      const rotatedX = baseX * Math.cos(rotRad) - baseZ * Math.sin(rotRad);
      const rotatedZ = baseX * Math.sin(rotRad) + baseZ * Math.cos(rotRad);

      // Project to 2D with perspective
      const perspective = 2;
      const scale = perspective / (perspective - rotatedZ * 0.5);
      const screenX = 50 + rotatedX * 40 * scale;
      const screenY = 50 + baseY * 40 * scale;

      // Visibility - only front hemisphere
      const isVisible = rotatedZ > -0.1;

      // Opacity falloff toward edges
      const edgeFalloff = Math.max(0, rotatedZ + 0.1) / 1.1;
      const opacity = isVisible ? 0.5 + edgeFalloff * 0.5 : 0;

      // Visibility score for culling (higher = more visible)
      const visibilityScore = rotatedZ;

      return {
        ...obj,
        calculatedPosition: {
          x: screenX,
          y: screenY,
          scale: scale * obj.position.scale * 0.9,
          zIndex: Math.round((rotatedZ + 1) * 50),
          opacity,
          isVisible,
          depth: rotatedZ,
          visibilityScore,
        },
      };
    });

    // Filter to visible, sort by visibility, take top N
    return projected
      .filter(obj => obj.calculatedPosition.isVisible)
      .sort((a, b) => b.calculatedPosition.visibilityScore - a.calculatedPosition.visibilityScore)
      .slice(0, MAX_VISIBLE_OBJECTS)
      .sort((a, b) => a.calculatedPosition.zIndex - b.calculatedPosition.zIndex);
  }, [world.objects, rotationY.current]);

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={[styles.background, { backgroundColor: theme.backgroundColor }]} />

      {/* Ambient particles */}
      {showAmbient && world.objects.length > 0 && (
        <AmbientParticles worldType={world.type} />
      )}

      {/* Globe container */}
      <View style={styles.globeContainer}>
        {/* Earth Globe - always rotates unless user is interacting */}
        <EarthGlobe size={globeSize} isRotating={!isInteracting.current} />

        {/* Objects overlay */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.objectsContainer,
            {
              width: globeSize,
              height: globeSize,
              marginTop: 20, // Offset for globe's internal padding
              marginLeft: 20,
            },
          ]}
        >
          {positionedObjects.map((obj, index) => (
            <WorldObject
              key={obj.id}
              object={{
                ...obj,
                position: {
                  ...obj.position,
                  x: obj.calculatedPosition.x,
                  y: obj.calculatedPosition.y,
                  scale: obj.calculatedPosition.scale,
                  zIndex: obj.calculatedPosition.zIndex,
                },
              }}
              isSelected={selectedObjectId === obj.id}
              onPress={() => onObjectPress(obj)}
              entryDelay={index * 100}
              customOpacity={obj.calculatedPosition.opacity}
              depth={obj.calculatedPosition.depth}
              screenX={obj.calculatedPosition.x}
            />
          ))}
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
  },
  globeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectsContainer: {
    position: 'absolute',
  },
});

export default WorldView;
