import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { PhotoLesson, MemorySpot, MemoryPath } from '../../src/types';
import { MemoryPathMap } from '../../src/components/world';
import { useTranslations } from '../../src/hooks/useTranslations';

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTranslations();

  // Track animation state
  const [animationSpot, setAnimationSpot] = useState<MemorySpot | null>(null);
  const [animationPath, setAnimationPath] = useState<MemoryPath | null>(null);
  const [animationSteps, setAnimationSteps] = useState(0);

  const {
    lessons,
    memorySpots,
    selectLessonForReview,
    pendingMapAnimation,
    clearPendingMapAnimation,
  } = useAppStore();

  // Dummy hooks to maintain hook count (for React rules)
  const lessonsCount = useMemo(() => lessons.length, [lessons]);
  const spotsCount = useMemo(() => memorySpots.length, [memorySpots]);

  // Debug: Log spots count on every render
  if (__DEV__) console.log('=== ReviewScreen render ===');
  if (__DEV__) console.log('memorySpots.length:', memorySpots.length);
  if (__DEV__) console.log('spotsCount:', spotsCount);

  // Check for pending animation when screen focuses
  useFocusEffect(
    useCallback(() => {
      const currentAnimatingSpotId = animationSpot?.id;
      if (__DEV__) console.log('=== Map useFocusEffect ===');
      if (__DEV__) console.log('pendingMapAnimation:', pendingMapAnimation);
      if (__DEV__) console.log('currentAnimatingSpotId:', currentAnimatingSpotId);

      // Check for fresh pending animation (compare spot IDs to handle multiple navigations)
      if (pendingMapAnimation) {
        const pendingSpotId = pendingMapAnimation.spot?.id;

        // Only trigger if this is a NEW spot animation
        if (pendingSpotId && pendingSpotId !== currentAnimatingSpotId) {
          if (__DEV__) console.log('=== Triggering NEW animation for spot:', pendingSpotId);

          // Set animation state
          setAnimationSpot(pendingMapAnimation.spot);
          setAnimationPath(pendingMapAnimation.path);
          setAnimationSteps(pendingMapAnimation.stepsEarned);

          // Clear the pending animation from store after a short delay
          setTimeout(() => {
            clearPendingMapAnimation();
          }, 500);
        }
      }

      // No cleanup needed - we track by spot ID now
      return () => {};
    }, [pendingMapAnimation, clearPendingMapAnimation, animationSpot])
  );

  // Clear animation state after animation completes
  const handleAnimationComplete = useCallback(() => {
    setAnimationSpot(null);
    setAnimationPath(null);
    setAnimationSteps(0);
  }, []);

  // Handle study word - navigate to lesson review
  const handleStudyWord = useCallback((lesson: PhotoLesson) => {
    selectLessonForReview(lesson);
    router.push('/');
  }, [selectLessonForReview, router]);

  // Empty state - no spots unlocked yet
  if (spotsCount === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Ionicons name="footsteps-outline" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>{t.map.memoryPath}</Text>
          <Text style={styles.emptyText}>
            {t.map.memoryPathDesc}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/')}
          >
            <Ionicons name="camera" size={20} color={colors.white} />
            <Text style={styles.emptyButtonText}>{t.map.startLearning}</Text>
          </TouchableOpacity>

          {lessonsCount > 0 && (
            <Text style={styles.pendingText}>
              {lessonsCount === 1
                ? t.progressScreen.photoPendingQuiz.replace('{count}', lessonsCount.toString())
                : t.progressScreen.photosPendingQuiz.replace('{count}', lessonsCount.toString())}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MemoryPathMap
        onStudyWord={handleStudyWord}
        newlyUnlockedSpot={animationSpot}
        newPath={animationPath}
        stepsEarned={animationSteps}
        onAnimationComplete={handleAnimationComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.xxl,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '700',
  },
  pendingText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: spacing.lg,
  },
});
