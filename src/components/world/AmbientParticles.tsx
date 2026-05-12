import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { WorldType } from '../../types';
import { getAmbientParticleConfig } from '../../utils/placementEngine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ParticleData {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

interface AmbientParticlesProps {
  worldType: WorldType;
}

export function AmbientParticles({ worldType }: AmbientParticlesProps) {
  const config = useMemo(() => getAmbientParticleConfig(worldType), [worldType]);

  // Generate particle data
  const particles = useMemo<ParticleData[]>(() => {
    return Array.from({ length: config.count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      opacity: 0.3 + Math.random() * 0.5,
      duration: 4000 + Math.random() * 4000,
      delay: Math.random() * 2000,
    }));
  }, [config.count]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          particle={particle}
          color={config.color}
          type={config.type}
          speed={config.speed}
        />
      ))}
    </View>
  );
}

interface ParticleProps {
  particle: ParticleData;
  color: string;
  type: string;
  speed: number;
}

function Particle({ particle, color, type, speed }: ParticleProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Vertical movement
    const yRange = type === 'petals' ? 50 : type === 'fireflies' ? 30 : 20;

    Animated.loop(
      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.parallel([
          // Fade in
          Animated.timing(opacity, {
            toValue: particle.opacity,
            duration: 500,
            useNativeDriver: true,
          }),
          // Scale up
          Animated.timing(scale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        // Float up
        Animated.timing(translateY, {
          toValue: -yRange,
          duration: particle.duration / speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        // Float down
        Animated.timing(translateY, {
          toValue: yRange / 2,
          duration: particle.duration / speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        // Reset
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Horizontal drift for petals and fireflies
    if (type === 'petals' || type === 'fireflies') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 15 * (Math.random() > 0.5 ? 1 : -1),
            duration: particle.duration * 0.8,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -10 * (Math.random() > 0.5 ? 1 : -1),
            duration: particle.duration * 0.8,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, []);

  // Firefly glow effect
  const glowSize = type === 'fireflies' ? particle.size * 3 : 0;

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: `${particle.x}%`,
          top: `${particle.y}%`,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: color,
          opacity,
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
        },
      ]}
    >
      {/* Glow for fireflies */}
      {type === 'fireflies' && (
        <View
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: color,
              left: -glowSize / 2 + particle.size / 2,
              top: -glowSize / 2 + particle.size / 2,
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    opacity: 0.3,
  },
});

export default AmbientParticles;
