import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../constants/design';

interface SuccessFeedbackProps {
  visible: boolean;
  type?: 'success' | 'streak' | 'levelup';
  title: string;
  subtitle?: string;
  onHide: () => void;
}

export function SuccessFeedback({ visible, type = 'success', title, subtitle, onHide }: SuccessFeedbackProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const iconMap = {
    success: { name: 'checkmark-circle', color: colors.mint },
    streak: { name: 'flame', color: '#FF9632' },
    levelup: { name: 'trophy', color: colors.xp },
  };

  useEffect(() => {
    if (visible) {
      scale.setValue(0);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const icon = iconMap[type];

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity },
      ]}
    >
      <Animated.View style={[styles.content, { transform: [{ scale }] }]}>
        <View style={[styles.iconCircle, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name as any} size={48} color={icon.color} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.white,
    fontSize: typography.xxl,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.base,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
