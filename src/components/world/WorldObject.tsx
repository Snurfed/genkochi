import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { WorldObject as WorldObjectType } from '../../types';
import { colors } from '../../constants/design';

interface WorldObjectProps {
  object: WorldObjectType;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  entryDelay?: number;
  customOpacity?: number;
  depth?: number;      // Z depth for 3D effect (-1 to 1)
  screenX?: number;    // X position on screen (0-100%)
}

export function WorldObject({
  object,
  isSelected,
  onPress,
  onLongPress,
  entryDelay = 0,
  customOpacity,
  depth = 1,
  screenX = 50,
}: WorldObjectProps) {
  // Animation values
  const entryAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Entry animation for new objects
  useEffect(() => {
    if (object.isNew) {
      entryAnim.setValue(0);
      Animated.sequence([
        Animated.delay(entryDelay),
        Animated.spring(entryAnim, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      entryAnim.setValue(1);
    }
  }, [object.isNew, entryDelay]);

  // Subtle floating animation for sky/animal objects
  useEffect(() => {
    const shouldFloat = object.category === 'sky' || object.category === 'animal';
    if (shouldFloat) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [object.category]);

  // Glow animation for objects needing review
  useEffect(() => {
    if (object.needsReview) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [object.needsReview]);

  // Animated transforms
  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const entryScale = entryAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 1.2, 1],
  });

  // Sphere integration calculations
  const normalizedX = (screenX - 50) / 50; // -1 to 1
  const normalizedDepth = Math.max(-1, Math.min(1, depth));

  // Scale reduction toward edges (0.7 - 1.0)
  const edgeScale = 0.75 + (1 - Math.abs(normalizedX)) * 0.25;

  // Depth-based scale (smaller when further back)
  const depthScale = 0.8 + (normalizedDepth + 1) * 0.1;

  // Combined scale
  const finalScale = edgeScale * depthScale;

  // Rotation for sphere curvature
  const rotateYDeg = normalizedX * 40;

  // Vertical squash near edges
  const verticalSquash = 1 - Math.abs(normalizedX) * 0.1;

  // Shadow properties based on depth
  const shadowOpacity = 0.15 + normalizedDepth * 0.15;
  const shadowRadius = 4 + normalizedDepth * 4;

  // Glow color interpolation
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(99, 102, 241, 0)', 'rgba(99, 102, 241, 0.5)'],
  });

  // Base size
  const baseSize = 52;
  const size = baseSize * object.position.scale * finalScale;
  const emojiSize = size * 0.65;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: `${object.position.x}%`,
          top: `${object.position.y}%`,
          zIndex: object.position.zIndex,
          opacity: customOpacity ?? 1,
          transform: [
            { translateX: -size / 2 },
            { translateY: -size / 2 },
            { translateY: floatTranslateY },
            { scale: entryScale },
            { perspective: 400 },
            { rotateY: `${rotateYDeg}deg` },
            { scaleY: verticalSquash },
          ],
        },
      ]}
    >
      {/* Shadow underneath emoji */}
      <View
        style={[
          styles.shadow,
          {
            width: size * 0.8,
            height: size * 0.2,
            borderRadius: size * 0.4,
            opacity: shadowOpacity,
            bottom: -size * 0.08,
            shadowRadius: shadowRadius,
          },
        ]}
      />

      {/* Glow ring for review items */}
      {object.needsReview && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: size + 12,
              height: size + 12,
              borderRadius: (size + 12) / 2,
              backgroundColor: glowColor,
            },
          ]}
        />
      )}

      {/* Emoji container */}
      <TouchableOpacity
        style={[
          styles.emojiContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.3)',
            borderWidth: isSelected ? 3 : 1,
          },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.85}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={[styles.emoji, { fontSize: emojiSize }]}>
          {object.emoji}
        </Text>
      </TouchableOpacity>

      {/* Word label below emoji */}
      <View style={[styles.label, { top: size + 4, minWidth: size * 1.2 }]}>
        <Text style={styles.labelText} numberOfLines={1}>
          {object.displayName}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
  },
  shadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    elevation: 3,
  },
  glowRing: {
    position: 'absolute',
    top: -6,
    left: -6,
  },
  emojiContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  emoji: {
    textAlign: 'center',
  },
  label: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default WorldObject;
