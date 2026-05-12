import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/design';

interface PronunciationFeedbackProps {
  score: number;
  targetText: string;
  spokenText?: string;
  onRetry: () => void;
  onContinue: () => void;
  requiredScore?: number;
  attempts: number;
}

/**
 * PronunciationFeedback - Shows detailed pronunciation feedback after a speaking attempt
 *
 * Features:
 * - Animated circular score display with color gradient
 * - Score counter animation from 0 to final score
 * - Feedback messages in English and Japanese
 * - Text comparison between target and spoken text
 * - Retry/Continue buttons based on passing threshold
 * - Attempt counter
 * - Success sparkles or failure shake animation
 */
export function PronunciationFeedback({
  score,
  targetText,
  spokenText,
  onRetry,
  onContinue,
  requiredScore = 80,
  attempts,
}: PronunciationFeedbackProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const ringAnimation = useRef(new Animated.Value(0)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const sparkleScale = useRef(new Animated.Value(0.5)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;

  const passed = score >= requiredScore;

  // Get score color based on score value
  const getScoreColor = (s: number): string => {
    if (s >= 90) return colors.xp; // Gold
    if (s >= 75) return colors.mint; // Green
    if (s >= 60) return colors.warning; // Orange
    return colors.error; // Coral/Red
  };

  // Get feedback message based on score
  const getFeedbackMessage = (s: number): { primary: string; secondary: string } => {
    if (s >= 90) return { primary: 'Perfect!', secondary: '完璧!' };
    if (s >= 80) return { primary: 'Great job!', secondary: 'すごい!' };
    if (s >= 70) return { primary: 'Good!', secondary: 'Keep practicing' };
    if (s >= 60) return { primary: 'Almost there!', secondary: 'もう少し!' };
    return { primary: 'Try again', secondary: 'Listen carefully' };
  };

  const scoreColor = getScoreColor(score);
  const feedback = getFeedbackMessage(score);

  // Animate score counter and ring on mount
  useEffect(() => {
    // Card entrance animation
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Animate the ring filling up
    Animated.timing(ringAnimation, {
      toValue: score / 100,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Animate score counter
    const duration = 1200;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
      setDisplayScore(Math.round(easedProgress * score));
      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 16);

    // Success or failure animation
    if (passed) {
      // Sparkle animation for success
      Animated.sequence([
        Animated.delay(800),
        Animated.parallel([
          Animated.timing(sparkleOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(sparkleScale, {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Shake animation for failure
      Animated.sequence([
        Animated.delay(1000),
        Animated.sequence([
          Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
      ]).start();
    }

    return () => clearInterval(interval);
  }, [score, passed]);

  // Calculate ring stroke dashoffset
  const ringSize = 160;
  const strokeWidth = 12;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const strokeDashoffset = ringAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Simple text comparison - highlight differences
  const renderTextComparison = () => {
    if (!spokenText) return null;

    return (
      <View style={styles.comparisonContainer}>
        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonLabel}>Target:</Text>
          <Text style={styles.targetText}>{targetText}</Text>
        </View>
        <View style={styles.comparisonRow}>
          <Text style={styles.comparisonLabel}>Heard:</Text>
          <Text style={[
            styles.spokenText,
            spokenText === targetText ? styles.matchedText : styles.mismatchedText,
          ]}>
            {spokenText || '(nothing recognized)'}
          </Text>
        </View>
        {spokenText !== targetText && (
          <View style={styles.comparisonHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.hintText}>Try to match the target pronunciation</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[
      styles.container,
      { transform: [{ scale: cardScale }, { translateX: shakeAnimation }] },
    ]}>
      {/* Attempt counter */}
      <View style={styles.attemptBadge}>
        <Text style={styles.attemptText}>Attempt {attempts}</Text>
      </View>

      {/* Score ring */}
      <View style={styles.scoreContainer}>
        {/* Background ring */}
        <View style={styles.ringBackground}>
          <View style={[styles.ringTrack, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]} />
        </View>

        {/* Animated ring */}
        <Animated.View style={styles.ringContainer}>
          <View style={{ width: ringSize, height: ringSize }}>
            <Animated.View
              style={[
                styles.ringProgress,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: strokeWidth,
                  borderColor: scoreColor,
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                  transform: [
                    {
                      rotate: ringAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </Animated.View>

        {/* Score display */}
        <View style={styles.scoreInner}>
          <Text style={[styles.scoreNumber, { color: scoreColor }]}>{displayScore}</Text>
          <Text style={styles.scoreLabel}>/ 100</Text>
        </View>

        {/* Sparkles for success */}
        {passed && (
          <Animated.View
            style={[
              styles.sparklesContainer,
              {
                opacity: sparkleOpacity,
                transform: [{ scale: sparkleScale }],
              },
            ]}
          >
            <Ionicons name="sparkles" size={24} color={colors.xp} style={styles.sparkle1} />
            <Ionicons name="sparkles" size={16} color={colors.mint} style={styles.sparkle2} />
            <Ionicons name="sparkles" size={20} color={colors.xp} style={styles.sparkle3} />
          </Animated.View>
        )}
      </View>

      {/* Feedback message */}
      <View style={styles.feedbackContainer}>
        <Text style={[styles.feedbackPrimary, { color: scoreColor }]}>{feedback.primary}</Text>
        <Text style={styles.feedbackSecondary}>{feedback.secondary}</Text>
      </View>

      {/* Target text display (always shown) */}
      {!spokenText && (
        <View style={styles.targetContainer}>
          <Text style={styles.targetLabel}>Target:</Text>
          <Text style={styles.targetTextLarge}>{targetText}</Text>
        </View>
      )}

      {/* Text comparison (if spokenText provided) */}
      {renderTextComparison()}

      {/* Action buttons - always allow continue */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
          <Ionicons name="arrow-forward" size={22} color={colors.white} />
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>

        {/* Optional retry button if score was low */}
        {!passed && (
          <TouchableOpacity style={styles.retryButtonSecondary} onPress={onRetry}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.retryButtonSecondaryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  attemptBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  attemptText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  scoreContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ringBackground: {
    position: 'absolute',
  },
  ringTrack: {
    borderWidth: 12,
    borderColor: colors.border,
  },
  ringContainer: {
    position: 'absolute',
  },
  ringProgress: {
    position: 'absolute',
  },
  scoreInner: {
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: typography.bold,
  },
  scoreLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: -4,
  },
  sparklesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  sparkle1: {
    position: 'absolute',
    top: -10,
    right: 10,
  },
  sparkle2: {
    position: 'absolute',
    top: 20,
    left: -5,
  },
  sparkle3: {
    position: 'absolute',
    bottom: 10,
    right: -5,
  },
  feedbackContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  feedbackPrimary: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
  },
  feedbackSecondary: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  targetContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  targetLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  targetTextLarge: {
    fontSize: typography.xl,
    color: colors.navy,
    fontWeight: typography.semibold,
  },
  comparisonContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  comparisonLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    width: 60,
  },
  targetText: {
    fontSize: typography.base,
    color: colors.navy,
    fontWeight: typography.medium,
    flex: 1,
  },
  spokenText: {
    fontSize: typography.base,
    flex: 1,
  },
  matchedText: {
    color: colors.mint,
    fontWeight: typography.medium,
  },
  mismatchedText: {
    color: colors.error,
    fontWeight: typography.medium,
  },
  comparisonHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hintText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  requiredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  requiredText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.mint,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  continueButtonText: {
    fontSize: typography.lg,
    color: colors.white,
    fontWeight: typography.bold,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    fontSize: typography.lg,
    color: colors.white,
    fontWeight: typography.bold,
  },
  retryButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryButtonSecondaryText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
});

export default PronunciationFeedback;
