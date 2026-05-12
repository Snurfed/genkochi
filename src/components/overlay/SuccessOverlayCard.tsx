import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Word } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import FloatingCard from './FloatingCard';

interface SuccessOverlayCardProps {
  wordsExplored: number;
  wordsQuizzed: number;
  totalXP: number;
  streak: number;
  onCaptureMore: () => void;
  onKeepExploring: () => void;
  onClose: () => void;
}

/**
 * SuccessOverlayCard - Celebration when exploration milestone reached
 * Shows stats and encourages continued engagement
 */
export function SuccessOverlayCard({
  wordsExplored,
  wordsQuizzed,
  totalXP,
  streak,
  onCaptureMore,
  onKeepExploring,
  onClose,
}: SuccessOverlayCardProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    [...Array(6)].map(() => ({
      y: new Animated.Value(0),
      x: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    // Trophy animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        tension: 150,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Rotate animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Confetti animation
    confettiAnims.forEach((anim, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const distance = 80 + Math.random() * 40;

      Animated.parallel([
        Animated.timing(anim.y, {
          toValue: Math.sin(angle) * distance,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim.x, {
          toValue: Math.cos(angle) * distance,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  const confettiColors = ['🎉', '⭐', '✨', '🌟', '💫', '🎊'];

  return (
    <FloatingCard onClose={onClose}>
      {/* Confetti */}
      <View style={styles.confettiContainer}>
        {confettiAnims.map((anim, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.confetti,
              {
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                ],
                opacity: anim.opacity,
              },
            ]}
          >
            {confettiColors[i]}
          </Animated.Text>
        ))}
      </View>

      {/* Trophy */}
      <View style={styles.trophySection}>
        <Animated.View
          style={[
            styles.trophyContainer,
            { transform: [{ scale: scaleAnim }, { rotate }] },
          ]}
        >
          <Text style={styles.trophy}>🏆</Text>
        </Animated.View>
        <Text style={styles.title}>Great exploring!</Text>
        <Text style={styles.subtitle}>You're learning from your world</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="eye" size={24} color={colors.primary} />
          <Text style={styles.statValue}>{wordsExplored}</Text>
          <Text style={styles.statLabel}>Explored</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle" size={24} color={colors.mint} />
          <Text style={styles.statValue}>{wordsQuizzed}</Text>
          <Text style={styles.statLabel}>Quizzed</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.xpIcon}>⚡</Text>
          <Text style={[styles.statValue, styles.xpValue]}>+{totalXP}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>
      </View>

      {/* Streak */}
      {streak > 0 && (
        <View style={styles.streakSection}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>{streak} day streak!</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onCaptureMore}
        >
          <Ionicons name="camera" size={22} color={colors.white} />
          <Text style={styles.primaryButtonText}>Capture More</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onKeepExploring}
        >
          <Text style={styles.secondaryButtonText}>Keep Exploring</Text>
        </TouchableOpacity>
      </View>
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  confettiContainer: {
    position: 'absolute',
    top: 60,
    left: '50%',
    width: 0,
    height: 0,
    zIndex: 10,
  },
  confetti: {
    position: 'absolute',
    fontSize: 24,
  },
  trophySection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trophyContainer: {
    marginBottom: spacing.md,
  },
  trophy: {
    fontSize: 64,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  xpIcon: {
    fontSize: 24,
  },
  xpValue: {
    color: colors.xp,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.xp}20`,
    borderRadius: borderRadius.full,
  },
  streakEmoji: {
    fontSize: 20,
  },
  streakText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  actionsSection: {
    gap: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  primaryButtonText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
});

export default SuccessOverlayCard;
