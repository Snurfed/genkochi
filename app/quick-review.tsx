import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, shadows } from '../src/constants/design';
import { useAppStore } from '../src/store';
import { QuickReviewCard } from '../src/components/QuickReviewCard';
import { PhotoLesson } from '../src/types';

export default function QuickReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getFadingMemories, reviewMemory, stats } = useAppStore();

  const fadingMemories = useMemo(() => getFadingMemories(), []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentLesson = fadingMemories[currentIndex];
  const remainingCount = fadingMemories.length - currentIndex;

  const handleSwipeRight = useCallback(() => {
    if (!currentLesson) return;
    reviewMemory(currentLesson.id);
    setReviewedCount((c) => c + 1);
    if (currentIndex >= fadingMemories.length - 1) {
      setIsComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentLesson, currentIndex, fadingMemories.length, reviewMemory]);

  const handleSwipeLeft = useCallback(() => {
    setSkippedCount((c) => c + 1);
    if (currentIndex >= fadingMemories.length - 1) {
      setIsComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, fadingMemories.length]);

  const handleTap = useCallback(() => {
    // Could navigate to full lesson view
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleDone = useCallback(() => {
    router.back();
  }, [router]);

  // Empty state - no fading memories
  if (fadingMemories.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="sparkles" size={80} color="#10B981" />
          <Text style={styles.emptyTitle}>All Fresh!</Text>
          <Text style={styles.emptyText}>
            Your memories are strong. Come back later when they start to fade.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Complete state
  if (isComplete) {
    const totalXP = reviewedCount * 15 * (1 + stats.reviewStreak * 0.1);
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.completeState}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          <Text style={styles.completeTitle}>Review Complete!</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="flame" size={24} color="#F59E0B" />
              <Text style={styles.statNumber}>{reviewedCount}</Text>
              <Text style={styles.statLabel}>Reviewed</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="star" size={24} color={colors.xp} />
              <Text style={styles.statNumber}>+{Math.round(totalXP)}</Text>
              <Text style={styles.statLabel}>XP Earned</Text>
            </View>
            {stats.reviewStreak > 1 && (
              <View style={styles.statBox}>
                <Ionicons name="trending-up" size={24} color="#10B981" />
                <Text style={styles.statNumber}>{stats.reviewStreak}x</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            )}
          </View>
          {skippedCount > 0 && (
            <Text style={styles.skippedText}>
              {skippedCount} skipped - they'll be waiting for you!
            </Text>
          )}
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {fadingMemories.length}
          </Text>
          {stats.reviewStreak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={14} color="#F59E0B" />
              <Text style={styles.streakText}>{stats.reviewStreak}x</Text>
            </View>
          )}
        </View>
      </View>

      {/* Card stack */}
      <View style={styles.cardContainer}>
        <QuickReviewCard
          key={currentLesson.id}
          lesson={currentLesson}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onTap={handleTap}
        />
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <Text style={styles.remainingText}>
          {remainingCount} {remainingCount === 1 ? 'memory' : 'memories'} fading
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  streakText: {
    fontSize: typography.sm,
    color: '#F59E0B',
    fontWeight: '700',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bottomInfo: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  remainingText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  completeState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  completeTitle: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    minWidth: 80,
    ...shadows.sm,
  },
  statNumber: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  skippedText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.xl,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '700',
  },
});
