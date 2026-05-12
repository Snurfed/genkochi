import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, borderRadius, spacing, typography } from '../../constants/design';

interface MinimalTopBarProps {
  onBack: () => void;
  progressText?: string;
  xpEarned?: number;
  streak?: number;
  mode: 'camera' | 'exploring';
}

/**
 * MinimalTopBar - Subtle top controls for exploration mode
 * Shows back button, progress, XP counter, and streak
 */
export function MinimalTopBar({
  onBack,
  progressText,
  xpEarned = 0,
  streak = 0,
  mode,
}: MinimalTopBarProps) {
  const insets = useSafeAreaInsets();
  const xpAnim = useRef(new Animated.Value(1)).current;
  const prevXP = useRef(xpEarned);

  // Animate XP counter when it changes
  useEffect(() => {
    if (xpEarned > prevXP.current) {
      Animated.sequence([
        Animated.spring(xpAnim, {
          toValue: 1.3,
          tension: 200,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(xpAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevXP.current = xpEarned;
  }, [xpEarned]);

  if (mode === 'camera') {
    // Minimal bar for camera mode - just streak
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.spacer} />

        {streak > 0 ? (
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        ) : (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>Start your streak!</Text>
          </View>
        )}
      </View>
    );
  }

  // Full bar for exploration mode
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={24} color={colors.white} />
      </TouchableOpacity>

      {/* Progress (center) */}
      {progressText && (
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{progressText}</Text>
        </View>
      )}

      {/* XP & Streak (right) */}
      <View style={styles.rightSection}>
        {xpEarned > 0 && (
          <Animated.View
            style={[styles.xpBadge, { transform: [{ scale: xpAnim }] }]}
          >
            <Text style={styles.xpText}>+{xpEarned} XP</Text>
          </Animated.View>
        )}

        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 50,
  },
  spacer: {
    width: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  progressText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  xpBadge: {
    backgroundColor: colors.xp,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  xpText: {
    color: colors.navy,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});

export default MinimalTopBar;
