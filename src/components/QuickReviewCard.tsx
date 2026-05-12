import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PhotoLesson, getMemoryStatus, MemoryStatus } from '../types';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/design';
import { resolveImageUri } from '../utils/photoStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const MEMORY_COLORS: Record<MemoryStatus, string> = {
  fresh: '#10B981',
  strong: '#3B82F6',
  fading: '#F59E0B',
  weak: '#EF4444',
  forgotten: '#6B7280',
};

interface QuickReviewCardProps {
  lesson: PhotoLesson;
  onSwipeLeft: () => void;  // Skip/later
  onSwipeRight: () => void; // Reviewed/remembered
  onTap: () => void;        // View details
}

export function QuickReviewCard({
  lesson,
  onSwipeLeft,
  onSwipeRight,
  onTap,
}: QuickReviewCardProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const rotation = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
  });
  const leftOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const rightOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const memoryStatus = lesson.memoryStatus ?? getMemoryStatus(lesson.memoryStrength ?? 50);
  const memoryStrength = lesson.memoryStrength ?? 50;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy * 0.3 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.spring(position, {
            toValue: { x: SCREEN_WIDTH + 100, y: gesture.dy },
            useNativeDriver: false,
          }).start(() => {
            onSwipeRight();
            position.setValue({ x: 0, y: 0 });
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.spring(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: gesture.dy },
            useNativeDriver: false,
          }).start(() => {
            onSwipeLeft();
            position.setValue({ x: 0, y: 0 });
          });
        } else if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
          setShowAnswer(!showAnswer);
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const cardStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { rotate: rotation },
    ],
  };

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      {...panResponder.panHandlers}
    >
      {/* Swipe indicators */}
      <Animated.View style={[styles.swipeIndicator, styles.swipeLeft, { opacity: leftOpacity }]}>
        <Ionicons name="close" size={48} color="#EF4444" />
        <Text style={styles.swipeText}>Later</Text>
      </Animated.View>
      <Animated.View style={[styles.swipeIndicator, styles.swipeRight, { opacity: rightOpacity }]}>
        <Ionicons name="checkmark" size={48} color="#10B981" />
        <Text style={styles.swipeText}>Got it!</Text>
      </Animated.View>

      {/* Photo */}
      <Image
        source={{ uri: resolveImageUri(lesson.imageUri) }}
        style={[styles.image, { opacity: 0.3 + (memoryStrength / 100) * 0.7 }]}
      />

      {/* Memory status indicator */}
      <View style={[styles.memoryBadge, { backgroundColor: MEMORY_COLORS[memoryStatus] }]}>
        <Ionicons
          name={memoryStatus === 'fresh' ? 'sparkles' : memoryStatus === 'forgotten' ? 'help' : 'flame'}
          size={14}
          color="#fff"
        />
        <Text style={styles.memoryText}>{memoryStrength}%</Text>
      </View>

      {/* Content overlay */}
      <View style={styles.overlay}>
        <Text style={styles.location}>{lesson.location || 'Your Photo'}</Text>
        <Text style={styles.wordCount}>{lesson.words.length} words</Text>

        {/* Words preview or answer */}
        {showAnswer ? (
          <View style={styles.wordsContainer}>
            {lesson.words.slice(0, 4).map((word, i) => (
              <View key={word.id} style={styles.wordRow}>
                <Text style={styles.wordJapanese}>{word.japanese}</Text>
                <Text style={styles.wordEnglish}>{word.english}</Text>
              </View>
            ))}
            {lesson.words.length > 4 && (
              <Text style={styles.moreWords}>+{lesson.words.length - 4} more</Text>
            )}
          </View>
        ) : (
          <View style={styles.promptContainer}>
            <Ionicons name="eye-outline" size={24} color="rgba(255,255,255,0.8)" />
            <Text style={styles.promptText}>Tap to reveal words</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <View style={styles.instruction}>
          <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
          <Text style={styles.instructionText}>Later</Text>
        </View>
        <View style={styles.instruction}>
          <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
          <Text style={styles.instructionText}>Got it!</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    height: 400,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...shadows.lg,
  },
  image: {
    width: '100%',
    height: '60%',
  },
  memoryBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  memoryText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  location: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  wordCount: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  wordsContainer: {
    gap: spacing.xs,
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wordJapanese: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  wordEnglish: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  moreWords: {
    fontSize: typography.sm,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  promptContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  promptText: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  swipeIndicator: {
    position: 'absolute',
    top: '30%',
    zIndex: 10,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...shadows.md,
  },
  swipeLeft: {
    left: spacing.lg,
  },
  swipeRight: {
    right: spacing.lg,
  },
  swipeText: {
    fontSize: typography.sm,
    fontWeight: '600',
    marginTop: 4,
  },
  instructions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instructionText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
});

export default QuickReviewCard;
