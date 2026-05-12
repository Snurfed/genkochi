import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { calculateDecay } from '../../src/utils/addictionEngine';
import { resolveImageUri } from '../../src/utils/photoStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

export default function MyWordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { lessons, stats, startReviewQuiz } = useAppStore();

  // Calculate stats for each lesson
  const lessonsWithStats = useMemo(() => {
    return lessons.map(lesson => {
      const wordCount = lesson.words.length;
      const avgMastery = wordCount > 0
        ? lesson.words.reduce((sum, w) => sum + w.masteryScore, 0) / wordCount
        : 0;

      // Count words needing review
      const fadingWords = lesson.words.filter(w => {
        const strength = calculateDecay(w.lastReviewed, w.masteryScore);
        return strength < 70;
      });

      return {
        ...lesson,
        wordCount,
        avgMastery,
        fadingCount: fadingWords.length,
        needsAttention: fadingWords.length > 0,
      };
    }).sort((a, b) => {
      // Sort: needs attention first, then by date
      if (a.needsAttention && !b.needsAttention) return -1;
      if (!a.needsAttention && b.needsAttention) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [lessons]);

  const handleLessonPress = (lessonId: string) => {
    // TODO: Navigate to lesson detail view
    // For now, start a review quiz with that lesson's words
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) {
      startReviewQuiz();
      router.push('/quiz');
    }
  };

  const handleCapture = () => {
    router.push('/');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Words</Text>
        <Text style={styles.subtitle}>
          {stats.totalWords} words from {lessons.length} photo{lessons.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {lessons.length === 0 ? (
        // Empty state
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No words yet</Text>
          <Text style={styles.emptySubtext}>
            Take a photo to start building your vocabulary
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleCapture}>
            <Ionicons name="camera" size={20} color={colors.white} />
            <Text style={styles.emptyButtonText}>Capture words</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Add new card */}
          <TouchableOpacity style={styles.addCard} onPress={handleCapture}>
            <Ionicons name="add" size={32} color={colors.textMuted} />
            <Text style={styles.addText}>Add</Text>
          </TouchableOpacity>

          {/* Lesson cards */}
          {lessonsWithStats.map((lesson) => (
            <TouchableOpacity
              key={lesson.id}
              style={[
                styles.lessonCard,
                lesson.needsAttention && styles.lessonCardAttention,
              ]}
              onPress={() => handleLessonPress(lesson.id)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: resolveImageUri(lesson.imageUri) }}
                style={styles.lessonImage}
              />

              {/* Overlay with info */}
              <View style={styles.lessonOverlay}>
                {lesson.needsAttention && (
                  <View style={styles.attentionBadge}>
                    <Text style={styles.attentionText}>{lesson.fadingCount}</Text>
                  </View>
                )}

                <View style={styles.lessonInfo}>
                  <Text style={styles.lessonLocation} numberOfLines={1}>
                    {lesson.location || 'Photo'}
                  </Text>
                  <Text style={styles.lessonWordCount}>
                    {lesson.wordCount} word{lesson.wordCount !== 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Mastery bar */}
                <View style={styles.masteryBar}>
                  <View
                    style={[
                      styles.masteryFill,
                      {
                        width: `${lesson.avgMastery}%`,
                        backgroundColor: lesson.avgMastery >= 70 ? colors.mint :
                          lesson.avgMastery >= 40 ? '#FF9632' : colors.error,
                      },
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: typography.xxl,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  // Add card
  addCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },

  // Lesson card
  lessonCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.2,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  lessonCardAttention: {
    borderWidth: 2,
    borderColor: '#FF9632',
  },
  lessonImage: {
    width: '100%',
    height: '100%',
  },
  lessonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  attentionBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: '#FF9632',
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attentionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  lessonInfo: {
    padding: spacing.sm,
  },
  lessonLocation: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  lessonWordCount: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
  masteryBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  masteryFill: {
    height: '100%',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: typography.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: typography.base,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '700',
  },
});
