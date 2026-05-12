import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorldObject } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { speakJapanese } from '../../utils/speech';

type ReviewMode = 'view' | 'recognize' | 'speak' | 'recall';

interface QuickReviewCardProps {
  object: WorldObject;
  onClose: () => void;
  onReviewComplete: (correct: boolean) => void;
}

export function QuickReviewCard({
  object,
  onClose,
  onReviewComplete,
}: QuickReviewCardProps) {
  const [mode, setMode] = useState<ReviewMode>('view');
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);

  // Animations
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleSpeak = () => {
    speakJapanese(object.displayName);
  };

  const handleAnswer = (correct: boolean) => {
    setResult(correct ? 'correct' : 'wrong');

    // Animate result
    Animated.sequence([
      Animated.spring(resultAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.delay(800),
    ]).start(() => {
      onReviewComplete(correct);
      handleClose();
    });
  };

  const startQuiz = (quizMode: ReviewMode) => {
    setMode(quizMode);
    setShowAnswer(false);
    setResult(null);
  };

  // Mastery progress bar
  const masteryPercent = Math.min(100, Math.max(0, object.masteryScore));
  const masteryColor = masteryPercent >= 90 ? colors.mint :
                       masteryPercent >= 60 ? colors.xp :
                       masteryPercent >= 30 ? '#FBBF24' : colors.textMuted;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} />

      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Object emoji */}
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{object.emoji}</Text>
        </View>

        {/* Word display - hidden in quiz modes until revealed */}
        {(mode === 'view' || showAnswer || result) && (
          <View style={styles.wordSection}>
            <Text style={styles.japanese}>{object.displayName}</Text>
            <Text style={styles.english}>{object.english}</Text>
          </View>
        )}

        {/* Quiz question */}
        {mode === 'recognize' && !showAnswer && !result && (
          <View style={styles.quizSection}>
            <Text style={styles.quizQuestion}>What is this in English?</Text>
            <Text style={styles.quizHint}>{object.displayName}</Text>
          </View>
        )}

        {mode === 'recall' && !showAnswer && !result && (
          <View style={styles.quizSection}>
            <Text style={styles.quizQuestion}>What is this in Japanese?</Text>
            <Text style={styles.quizHint}>{object.english}</Text>
          </View>
        )}

        {/* Result indicator */}
        {result && (
          <Animated.View
            style={[
              styles.resultBadge,
              {
                backgroundColor: result === 'correct' ? colors.mint : colors.error,
                transform: [{ scale: resultAnim }],
              },
            ]}
          >
            <Ionicons
              name={result === 'correct' ? 'checkmark' : 'close'}
              size={32}
              color="white"
            />
          </Animated.View>
        )}

        {/* Mastery progress */}
        <View style={styles.masterySection}>
          <View style={styles.masteryHeader}>
            <Text style={styles.masteryLabel}>Mastery</Text>
            <Text style={[styles.masteryPercent, { color: masteryColor }]}>
              {masteryPercent}%
            </Text>
          </View>
          <View style={styles.masteryBar}>
            <View
              style={[
                styles.masteryFill,
                {
                  width: `${masteryPercent}%`,
                  backgroundColor: masteryColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Action buttons */}
        {mode === 'view' && !result && (
          <View style={styles.actions}>
            {/* Speak button */}
            <TouchableOpacity style={styles.actionButton} onPress={handleSpeak}>
              <Ionicons name="volume-high" size={24} color={colors.primary} />
              <Text style={styles.actionText}>Listen</Text>
            </TouchableOpacity>

            {/* Quiz buttons */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => startQuiz('recognize')}
            >
              <Ionicons name="help-circle" size={24} color={colors.xp} />
              <Text style={styles.actionText}>Quiz</Text>
            </TouchableOpacity>

            {/* Mark as reviewed */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleAnswer(true)}
            >
              <Ionicons name="checkmark-circle" size={24} color={colors.mint} />
              <Text style={styles.actionText}>Got it</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quiz answer buttons */}
        {(mode === 'recognize' || mode === 'recall') && !showAnswer && !result && (
          <View style={styles.quizActions}>
            <TouchableOpacity
              style={styles.revealButton}
              onPress={() => setShowAnswer(true)}
            >
              <Text style={styles.revealText}>Show Answer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Post-reveal answer buttons */}
        {showAnswer && !result && (
          <View style={styles.answerActions}>
            <TouchableOpacity
              style={[styles.answerButton, styles.wrongButton]}
              onPress={() => handleAnswer(false)}
            >
              <Ionicons name="close" size={24} color="white" />
              <Text style={styles.answerButtonText}>Wrong</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.answerButton, styles.correctButton]}
              onPress={() => handleAnswer(true)}
            >
              <Ionicons name="checkmark" size={24} color="white" />
              <Text style={styles.answerButtonText}>Correct</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* XP indicator */}
        {result === 'correct' && (
          <Animated.View
            style={[
              styles.xpBadge,
              {
                opacity: resultAnim,
                transform: [
                  {
                    translateY: resultAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.xpText}>+5 XP</Text>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  card: {
    backgroundColor: 'white',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl + 20,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 40,
  },
  wordSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  japanese: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  english: {
    fontSize: typography.lg,
    color: colors.textSecondary,
  },
  quizSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  quizQuestion: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  quizHint: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultBadge: {
    position: 'absolute',
    top: 80,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterySection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  masteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  masteryLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  masteryPercent: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  masteryBar: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quizActions: {
    width: '100%',
  },
  revealButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  revealText: {
    color: 'white',
    fontSize: typography.base,
    fontWeight: '700',
  },
  answerActions: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.md,
  },
  answerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  wrongButton: {
    backgroundColor: colors.error,
  },
  correctButton: {
    backgroundColor: colors.mint,
  },
  answerButtonText: {
    color: 'white',
    fontSize: typography.base,
    fontWeight: '700',
  },
  xpBadge: {
    position: 'absolute',
    top: 20,
    right: 60,
    backgroundColor: colors.xp,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  xpText: {
    color: colors.navy,
    fontSize: typography.sm,
    fontWeight: '700',
  },
});

export default QuickReviewCard;
