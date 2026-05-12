import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadows } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { useTranslations } from '../../src/hooks/useTranslations';
import { resolveImageUri } from '../../src/utils/photoStorage';
import { FlashcardReview } from '../../src/components/FlashcardReview';
import { getMemoryStatusFromSRS } from '../../src/utils/srs';
import { PhotoLesson } from '../../src/types';

// Step milestones for progress
const STEP_MILESTONES = [
  { steps: 1000, title: 'First Steps', icon: 'footsteps' },
  { steps: 5000, title: 'Explorer', icon: 'compass' },
  { steps: 10000, title: 'Adventurer', icon: 'map' },
  { steps: 25000, title: 'Pathfinder', icon: 'trail-sign' },
  { steps: 50000, title: 'Globetrotter', icon: 'globe' },
  { steps: 100000, title: 'World Traveler', icon: 'airplane' },
];

// XP Levels for user rank
const XP_LEVELS = [
  { xp: 0, title: 'Beginner', icon: 'leaf', color: '#10B981' },
  { xp: 100, title: 'Learner', icon: 'school', color: '#3B82F6' },
  { xp: 300, title: 'Explorer', icon: 'compass', color: '#8B5CF6' },
  { xp: 600, title: 'Adventurer', icon: 'map', color: '#F59E0B' },
  { xp: 1000, title: 'Scholar', icon: 'library', color: '#EC4899' },
  { xp: 2000, title: 'Master', icon: 'trophy', color: '#EF4444' },
  { xp: 5000, title: 'Legend', icon: 'diamond', color: '#6366F1' },
];

// Get the worst memory status among all words in a lesson (for thumbnail color)
function getWorstMemoryStatus(lesson: PhotoLesson | undefined): 'fresh' | 'strong' | 'fading' | 'weak' {
  if (!lesson?.words) return 'fresh';

  const STATUS_PRIORITY: Record<string, number> = { weak: 0, due: 0, fading: 1, strong: 2, fresh: 3 };
  let worstPriority = 3; // Start with fresh (best)

  for (const word of lesson.words) {
    if (word.srs) {
      const status = getMemoryStatusFromSRS(word.srs);
      const priority = STATUS_PRIORITY[status] ?? 3;
      if (priority < worstPriority) {
        worstPriority = priority;
      }
    }
  }

  // Map priority back to status
  if (worstPriority === 0) return 'weak';
  if (worstPriority === 1) return 'fading';
  if (worstPriority === 2) return 'strong';
  return 'fresh';
}

function getUserLevel(xp: number): { level: typeof XP_LEVELS[0]; nextLevel: typeof XP_LEVELS[0] | null; progress: number } {
  let currentLevel = XP_LEVELS[0];
  let nextLevel: typeof XP_LEVELS[0] | null = null;

  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i].xp) {
      currentLevel = XP_LEVELS[i];
      nextLevel = XP_LEVELS[i + 1] || null;
    }
  }

  const progress = nextLevel
    ? ((xp - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100
    : 100;

  return { level: currentLevel, nextLevel, progress };
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stats, memorySpots, totalSteps, lessons, getMemoryStats, getFadingMemories, reviewWordSRS, selectLessonForReview } = useAppStore();
  const t = useTranslations();

  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcardMode, setFlashcardMode] = useState<'all' | 'fading'>('all');

  const isNewUser = stats.totalPhotos === 0;

  // Calculate user level from XP
  const userLevel = useMemo(() => getUserLevel(stats.xp), [stats.xp]);

  // Get all spots sorted by date (most recent first)
  const allSpots = useMemo(() => {
    return [...memorySpots]
      .sort((a, b) => b.unlockedAt - a.unlockedAt);
  }, [memorySpots]);

  // Calculate next milestone
  const nextMilestone = useMemo(() => {
    const current = totalSteps || 0;
    for (const milestone of STEP_MILESTONES) {
      if (current < milestone.steps) {
        return {
          ...milestone,
          current,
          remaining: milestone.steps - current,
          progress: (current / milestone.steps) * 100,
        };
      }
    }
    // All milestones achieved
    return null;
  }, [totalSteps]);

  // Memory Palace stats
  const memoryStats = useMemo(() => getMemoryStats(), [lessons]);
  const fadingMemories = useMemo(() => getFadingMemories(), [lessons]);
  const hasMemoriesToReview = fadingMemories.length > 0;

    // Format steps nicely
  const formatSteps = (steps: number): string => {
    if (steps >= 1000) {
      return `${(steps / 1000).toFixed(1)}k`;
    }
    return steps.toLocaleString();
  };

  // Flashcard handlers
  const handleStartFlashcards = useCallback((mode: 'all' | 'fading') => {
    const lessonsToReview = mode === 'fading' ? fadingMemories : lessons;
    if (lessonsToReview.length === 0) {
      Alert.alert(
        mode === 'fading' ? 'No Fading Memories' : 'No Vocabulary Yet',
        mode === 'fading'
          ? 'All your memories are fresh! Come back later when they start to fade.'
          : 'Take some photos to start building your vocabulary.',
        [{ text: 'OK' }]
      );
      return;
    }
    setFlashcardMode(mode);
    setShowFlashcards(true);
  }, [fadingMemories, lessons]);

  const handleFlashcardComplete = useCallback((reviewedCount: number) => {
    setShowFlashcards(false);
    if (reviewedCount > 0) {
      const wordText = reviewedCount === 1 ? t.progressScreen.word : t.progressScreen.words;
      Alert.alert(
        t.progressScreen.greatPractice,
        `${t.progressScreen.youReviewed.replace('{count}', String(reviewedCount))} ${wordText}. ${t.progressScreen.keepItUp}`,
        [{ text: t.common.done }]
      );
    }
  }, [t]);

  const handleWordReview = useCallback((lessonId: string, wordId: string, isCorrect: boolean, responseTimeMs?: number) => {
    // Use SRS-based word review
    reviewWordSRS(lessonId, wordId, isCorrect, responseTimeMs);
  }, [reviewWordSRS]);

  // Get lessons for current flashcard mode
  const flashcardLessons = flashcardMode === 'fading' ? fadingMemories : lessons;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t.progress.yourJourney}</Text>
        <View style={[styles.levelBadge, { backgroundColor: userLevel.level.color + '20' }]}>
          <Ionicons name={userLevel.level.icon as any} size={14} color={userLevel.level.color} />
          <Text style={[styles.levelText, { color: userLevel.level.color }]}>{userLevel.level.title}</Text>
          <View style={styles.xpPill}>
            <Ionicons name="star" size={10} color={colors.xp} />
            <Text style={styles.xpPillText}>{stats.xp}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isNewUser ? (
          /* Empty State */
          <View style={styles.emptyState}>
            <LinearGradient
              colors={[colors.primaryLight + '20', colors.mint + '20']}
              style={styles.emptyGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.emptyIconWrap}>
                <Ionicons name="footsteps" size={48} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t.progress.startYourJourney}</Text>
              <Text style={styles.emptyText}>
                {t.progress.takePhotosToLearn}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/')}
              >
                <Ionicons name="camera" size={20} color={colors.white} />
                <Text style={styles.emptyButtonText}>{t.onboarding.takeFirstPhoto}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <>
            {/* HERO: Practice Flashcards - Primary CTA when there are words */}
            {lessons.length > 0 && (
              <TouchableOpacity
                style={styles.heroCard}
                onPress={() => handleStartFlashcards(hasMemoriesToReview ? 'fading' : 'all')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={hasMemoriesToReview ? ['#F59E0B', '#D97706'] : [colors.primary, '#7C3AED']}
                  style={styles.heroGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.heroContent}>
                    <View style={styles.heroLeft}>
                      <View style={styles.heroIconWrap}>
                        <Ionicons name={hasMemoriesToReview ? 'flash' : 'layers'} size={28} color="rgba(255,255,255,0.95)" />
                      </View>
                      <View>
                        <Text style={styles.heroTitle}>
                          {hasMemoriesToReview ? t.progressScreen.reviewPhotoFlashcards : t.progressScreen.practiceFlashcards}
                        </Text>
                        <Text style={styles.heroSubtitle}>
                          {hasMemoriesToReview
                            ? ((memoryStats.fading + memoryStats.weak + memoryStats.due) === 1
                                ? t.progressScreen.wordNeedsReview.replace('{count}', String(memoryStats.fading + memoryStats.weak + memoryStats.due))
                                : t.progressScreen.wordsNeedReview.replace('{count}', String(memoryStats.fading + memoryStats.weak + memoryStats.due)))
                            : t.progressScreen.wordsToPractice.replace('{count}', String(stats.totalWords))}
                        </Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Stats Row - Compact */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={styles.statNumber}>{stats.totalPhotos}</Text>
                <Text style={styles.statLabel}>{t.progress.photos}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="book" size={18} color={colors.mint} />
                <Text style={styles.statNumber}>{stats.totalWords}</Text>
                <Text style={styles.statLabel}>{t.onboarding.words}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="flame" size={18} color={stats.streak > 0 ? '#FF6B35' : colors.textMuted} />
                <Text style={styles.statNumber}>{stats.streak}</Text>
                <Text style={styles.statLabel}>{t.progressScreen.dayStreak}</Text>
              </View>

              {(totalSteps || 0) > 0 && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="footsteps" size={18} color="#8B5CF6" />
                    <Text style={styles.statNumber}>{formatSteps(totalSteps || 0)}</Text>
                    <Text style={styles.statLabel}>{t.progressScreen.steps}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Memory Strength Overview - SRS-based */}
            {lessons.length > 0 && (
              <View style={styles.memorySection}>
                <View style={styles.memorySectionHeader}>
                  <Text style={styles.sectionTitle}>{t.progressScreen.memoryStrength}</Text>
                  {memoryStats.due > 0 && (
                    <View style={styles.dueCountBadge}>
                      <Ionicons name="time" size={12} color="#EF4444" />
                      <Text style={styles.dueCountText}>{t.progressScreen.due.replace('{count}', String(memoryStats.due))}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.memoryStatsRow}>
                  <View style={[styles.memoryStatBox, { borderLeftColor: '#10B981' }]}>
                    <Text style={[styles.memoryStatNumber, { color: '#10B981' }]}>{memoryStats.fresh}</Text>
                    <Text style={styles.memoryStatLabel}>{t.progressScreen.fresh}</Text>
                  </View>
                  <View style={[styles.memoryStatBox, { borderLeftColor: '#3B82F6' }]}>
                    <Text style={[styles.memoryStatNumber, { color: '#3B82F6' }]}>{memoryStats.strong}</Text>
                    <Text style={styles.memoryStatLabel}>{t.progressScreen.strong}</Text>
                  </View>
                  <View style={[styles.memoryStatBox, { borderLeftColor: '#F59E0B' }]}>
                    <Text style={[styles.memoryStatNumber, { color: '#F59E0B' }]}>{memoryStats.fading}</Text>
                    <Text style={styles.memoryStatLabel}>{t.progressScreen.fading}</Text>
                  </View>
                  <View style={[styles.memoryStatBox, { borderLeftColor: '#EF4444' }]}>
                    <Text style={[styles.memoryStatNumber, { color: '#EF4444' }]}>{memoryStats.weak}</Text>
                    <Text style={styles.memoryStatLabel}>{t.progressScreen.weak}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick Actions Row */}
            {lessons.length > 0 && (
              <View style={styles.quickActionsRow}>
                <TouchableOpacity
                  style={styles.quickActionButton}
                  onPress={() => handleStartFlashcards('all')}
                >
                  <Ionicons name="layers" size={20} color={colors.primary} />
                  <Text style={styles.quickActionText}>{t.progressScreen.allWords}</Text>
                </TouchableOpacity>

                {hasMemoriesToReview ? (
                  <TouchableOpacity
                    style={[styles.quickActionButton, styles.quickActionHighlight]}
                    onPress={() => handleStartFlashcards('fading')}
                  >
                    <Ionicons name="flash" size={20} color="#F59E0B" />
                    <Text style={[styles.quickActionText, { color: '#F59E0B' }]}>
                      {memoryStats.fading + memoryStats.weak + memoryStats.due} {t.progressScreen.fading}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.quickActionButton, styles.quickActionSuccess]}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <Text style={[styles.quickActionText, { color: '#10B981' }]}>{t.progressScreen.allFresh}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Your Photos */}
            {allSpots.length > 0 && (
              <View style={styles.photosSection}>
                <Text style={styles.sectionTitle}>{t.progress.recentDiscoveries}</Text>
                <View style={styles.photosGrid}>
                  {allSpots.map((spot) => {
                    const lesson = lessons.find(l => l.id === spot.lessonId);
                    const memoryStatus = getWorstMemoryStatus(lesson);
                    const needsReview = memoryStatus === 'fading' || memoryStatus === 'weak';

                    return (
                      <TouchableOpacity
                        key={spot.id}
                        style={styles.photoCard}
                        onPress={() => {
                          if (lesson) {
                            selectLessonForReview(lesson);
                            router.push('/(tabs)');
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: resolveImageUri(spot.imageUri) }}
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                        {needsReview && (
                          <View style={styles.reviewBadge}>
                            <Ionicons name="flash" size={10} color="#fff" />
                          </View>
                        )}
                        <View style={styles.photoOverlay}>
                          <Text style={styles.photoWord} numberOfLines={1}>
                            {spot.mainWord.japanese}
                          </Text>
                          <Text style={styles.photoWordCount}>
                            {lesson?.words.length || 1} {(lesson?.words.length || 1) === 1 ? t.progressScreen.word : t.progressScreen.words}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            
            {/* Encouragement */}
            {stats.streak === 0 && stats.totalPhotos > 0 && (
              <View style={styles.encouragement}>
                <Ionicons name="sunny" size={20} color={colors.primary} />
                <Text style={styles.encouragementText}>
                  {t.progressScreen.learnSomethingNew}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Flashcard Review Overlay */}
      <FlashcardReview
        visible={showFlashcards}
        lessons={flashcardLessons}
        onClose={() => setShowFlashcards(false)}
        onComplete={handleFlashcardComplete}
        onReviewWord={handleWordReview}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.xxl,
    fontWeight: '800',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.xp + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  xpBadgeText: {
    color: colors.xp,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Empty State
  emptyState: {
    flex: 1,
  },
  emptyGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.base,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '700',
  },

  // Steps Hero
  stepsHero: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  stepsNumber: {
    color: colors.white,
    fontSize: 56,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  stepsLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: typography.lg,
    fontWeight: '600',
  },
  milestoneProgress: {
    width: '100%',
    marginTop: spacing.lg,
  },
  milestoneBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  milestoneFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 4,
  },
  milestoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  milestoneText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: typography.sm,
    fontWeight: '500',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  statNumber: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: '500',
  },
  statEmoji: {
    fontSize: 20,
  },

  // Memory Palace Section
  memorySection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  memorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dueCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  dueCountText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: '#EF4444',
  },
  memoryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memoryStatBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  memoryStatNumber: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  memoryStatLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memoryWarning: {
    marginTop: spacing.md,
    color: '#F59E0B',
    fontSize: typography.sm,
    textAlign: 'center',
    fontWeight: '500',
  },
  reviewStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: '#FEF3C7',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  reviewStreakText: {
    fontSize: typography.sm,
    color: '#92400E',
    fontWeight: '600',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  reviewButtonText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: '600',
  },

  // Section Header
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  // Photos Grid Section
  photosSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCard: {
    width: (Dimensions.get('window').width - spacing.lg * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  photoWord: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  photoWordCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.xs,
  },
  reviewBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 10,
  },

  // Achievements
  achievementsSection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  achievementCount: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  achievementHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  achievementsScroll: {
    gap: spacing.sm,
  },
  achievementBadge: {
    width: 80,
    height: 78,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  achievementUnlocked: {
    backgroundColor: colors.primary + '15',
  },
  achievementTitle: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 13,
  },
  achievementLocked: {
    color: colors.textMuted,
  },
  achievementIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextAchievements: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextAchievementsTitle: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  nextAchievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  nextAchievementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  nextAchievementTitle: {
    fontSize: typography.sm,
    color: colors.textPrimary,
  },
  nextAchievementProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBarBg: {
    width: 60,
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    width: 35,
    textAlign: 'right',
  },

  // Encouragement
  encouragement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  encouragementText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.sm,
  },

  // Practice Flashcards Section
  practiceSection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  practiceSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  practiceButtonsRow: {
    gap: spacing.sm,
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  practiceButtonHighlight: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B40',
  },
  practiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  practiceButtonText: {
    flex: 1,
  },
  practiceButtonTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  practiceButtonCount: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  urgentBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  urgentBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Level Badge
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  levelText: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.xp + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  xpPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.xp,
  },

  // Hero Card
  heroCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  heroGradient: {
    padding: spacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.white,
  },
  heroSubtitle: {
    fontSize: typography.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  heroArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quick Actions Row
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  quickActionHighlight: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B40',
  },
  quickActionSuccess: {
    backgroundColor: '#D1FAE5',
  },
  quickActionText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
