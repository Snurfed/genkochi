import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../src/constants/design';
import { useAppStore } from '../../src/store';
import { getUnderstandingPercent, getDecayingWords } from '../../src/utils/addictionEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Real-world milestones - things you can DO
const MILESTONES = [
  { id: 'greet', name: 'Greet someone', words: 5, emoji: '👋', unlocked: false },
  { id: 'order', name: 'Order at a restaurant', words: 30, emoji: '🍜', unlocked: false },
  { id: 'directions', name: 'Ask for directions', words: 50, emoji: '🗺️', unlocked: false },
  { id: 'shop', name: 'Go shopping', words: 100, emoji: '🛍️', unlocked: false },
  { id: 'convo', name: 'Have a conversation', words: 200, emoji: '💬', unlocked: false },
  { id: 'travel', name: 'Travel Japan solo', words: 500, emoji: '✈️', unlocked: false },
  { id: 'fluent', name: 'Speak fluently', words: 1000, emoji: '🎌', unlocked: false },
];

export default function BrainScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { stats, lessons, savedTranslations, startReviewQuiz } = useAppStore();

  const allWords = useMemo(() => lessons.flatMap(l => l.words), [lessons]);
  const masteredWords = useMemo(() => allWords.filter(w => w.masteryScore >= 70), [allWords]);
  const learningWords = useMemo(() => allWords.filter(w => w.masteryScore >= 30 && w.masteryScore < 70), [allWords]);
  const weakWords = useMemo(() => allWords.filter(w => w.masteryScore < 30), [allWords]);

  const allWordsWithLesson = useMemo(() => {
    return lessons.flatMap(l => l.words.map(w => ({ word: w, lessonId: l.id })));
  }, [lessons]);

  const decayingWords = useMemo(() => getDecayingWords(allWordsWithLesson, 10), [allWordsWithLesson]);

  const understandingPercent = getUnderstandingPercent(masteredWords.length);

  // Calculate unlocked milestones
  const milestonesWithStatus = useMemo(() => {
    return MILESTONES.map(m => ({
      ...m,
      unlocked: masteredWords.length >= m.words,
      progress: Math.min(100, (masteredWords.length / m.words) * 100),
    }));
  }, [masteredWords]);

  const nextMilestone = milestonesWithStatus.find(m => !m.unlocked) || milestonesWithStatus[milestonesWithStatus.length - 1];
  const unlockedCount = milestonesWithStatus.filter(m => m.unlocked).length;

  const handlePracticeWeak = () => {
    startReviewQuiz();
    router.push('/quiz');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Brain</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* IDENTITY CARD - The Big Number */}
        <View style={styles.identityCard}>
          <Text style={styles.identityLabel}>YOU UNDERSTAND</Text>
          <Text style={styles.identityPercent}>{understandingPercent}%</Text>
          <Text style={styles.identityOf}>of everyday Japanese</Text>

          <View style={styles.identityBar}>
            <View style={[styles.identityFill, { width: `${Math.max(2, understandingPercent)}%` }]} />
          </View>

          <View style={styles.identityBreakdown}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.mint }]} />
              <Text style={styles.breakdownNum}>{masteredWords.length}</Text>
              <Text style={styles.breakdownLabel}>mastered</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.xp }]} />
              <Text style={styles.breakdownNum}>{learningWords.length}</Text>
              <Text style={styles.breakdownLabel}>learning</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: colors.textMuted }]} />
              <Text style={styles.breakdownNum}>{weakWords.length}</Text>
              <Text style={styles.breakdownLabel}>weak</Text>
            </View>
          </View>
        </View>

        {/* MILESTONES - What You Can DO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT YOU CAN DO</Text>
          <View style={styles.milestoneList}>
            {milestonesWithStatus.slice(0, 5).map((m) => (
              <View
                key={m.id}
                style={[
                  styles.milestoneItem,
                  m.unlocked && styles.milestoneUnlocked,
                  !m.unlocked && m.id === nextMilestone.id && styles.milestoneNext,
                ]}
              >
                <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                <View style={styles.milestoneInfo}>
                  <Text style={[styles.milestoneName, m.unlocked && styles.milestoneNameUnlocked]}>
                    {m.name}
                  </Text>
                  {!m.unlocked && (
                    <View style={styles.milestoneProgress}>
                      <View style={styles.milestoneBar}>
                        <View style={[styles.milestoneFill, { width: `${m.progress}%` }]} />
                      </View>
                      <Text style={styles.milestoneCount}>
                        {masteredWords.length}/{m.words}
                      </Text>
                    </View>
                  )}
                </View>
                {m.unlocked && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.mint} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* MEMORY STATUS - Words at Risk */}
        {decayingWords.length > 0 && (
          <View style={styles.riskSection}>
            <View style={styles.riskHeader}>
              <Ionicons name="warning" size={16} color={colors.error} />
              <Text style={styles.riskTitle}>Memory fading</Text>
              <Text style={styles.riskCount}>{decayingWords.length} words</Text>
            </View>

            <View style={styles.riskWords}>
              {decayingWords.slice(0, 4).map((w) => (
                <View key={w.id} style={styles.riskWord}>
                  <Text style={styles.riskJapanese}>{w.japanese}</Text>
                  <View style={styles.riskBar}>
                    <View
                      style={[
                        styles.riskFill,
                        {
                          width: `${w.strength}%`,
                          backgroundColor: w.strength < 30 ? colors.error : '#FF9632',
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.riskButton} onPress={handlePracticeWeak}>
              <Text style={styles.riskButtonText}>Save them</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* QUICK STATS */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="sparkles" size={20} color={colors.xp} />
            <Text style={styles.statValue}>{stats.xp}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="camera" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{stats.totalPhotos}</Text>
            <Text style={styles.statLabel}>photos</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bookmark" size={20} color={colors.mint} />
            <Text style={styles.statValue}>{savedTranslations.length}</Text>
            <Text style={styles.statLabel}>saved</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: typography.xxl,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },

  // Identity Card
  identityCard: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.2)',
  },
  identityLabel: {
    color: colors.mint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  identityPercent: {
    color: colors.white,
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  identityOf: {
    color: colors.textMuted,
    fontSize: typography.base,
    marginBottom: spacing.lg,
  },
  identityBar: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  identityFill: {
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: 5,
  },
  identityBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  breakdownNum: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  breakdownLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },

  // Milestones
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  milestoneList: {
    gap: spacing.sm,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  milestoneUnlocked: {
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  milestoneNext: {
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  milestoneEmoji: {
    fontSize: 24,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  milestoneNameUnlocked: {
    color: colors.white,
  },
  milestoneProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  milestoneBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  milestoneFill: {
    height: '100%',
    backgroundColor: colors.xp,
    borderRadius: 2,
  },
  milestoneCount: {
    color: colors.textMuted,
    fontSize: 10,
  },

  // Risk Section
  riskSection: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  riskTitle: {
    color: colors.error,
    fontSize: typography.sm,
    fontWeight: '700',
    flex: 1,
  },
  riskCount: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },
  riskWords: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  riskWord: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  riskJapanese: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '600',
    width: 60,
  },
  riskBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  riskFill: {
    height: '100%',
    borderRadius: 3,
  },
  riskButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  riskButtonText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: '700',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 20,
  },
  statValue: {
    color: colors.white,
    fontSize: typography.xl,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.xs,
  },
});
