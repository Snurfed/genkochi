import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography, shadows } from '../src/constants/design';
import { useAppStore } from '../src/store';
import { useTranslations } from '../src/hooks/useTranslations';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  AchievementCategory,
  getUnlockedAchievements,
} from '../src/types';

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats, lessons } = useAppStore();
  const t = useTranslations();

  const unlockedIds = useMemo(() => {
    const unlocked = getUnlockedAchievements(stats, lessons);
    return new Set(unlocked.map(a => a.id));
  }, [stats, lessons]);

  const achievementsByCategory = useMemo(() => {
    const grouped: Record<AchievementCategory, typeof ACHIEVEMENTS> = {
      vocabulary: [],
      memory: [],
      streak: [],
      exploration: [],
      mastery: [],
    };
    ACHIEVEMENTS.forEach(a => {
      grouped[a.category].push(a);
    });
    return grouped;
  }, []);

  const totalUnlocked = unlockedIds.size;
  const totalAchievements = ACHIEVEMENTS.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t.progress.achievements}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countText}>{totalUnlocked}/{totalAchievements}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(totalUnlocked / totalAchievements) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {t.achievementsPage.percentComplete.replace('{percent}', String(Math.round((totalUnlocked / totalAchievements) * 100)))}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {Object.entries(achievementsByCategory).map(([category, achievements]) => {
          const catMeta = ACHIEVEMENT_CATEGORIES[category as AchievementCategory];
          const unlockedInCat = achievements.filter(a => unlockedIds.has(a.id)).length;

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIcon, { backgroundColor: catMeta.color + '20' }]}>
                  <Ionicons name={catMeta.icon as any} size={18} color={catMeta.color} />
                </View>
                <Text style={styles.categoryTitle}>{(t.achievementCategories as Record<string, string>)[category] || catMeta.label}</Text>
                <Text style={styles.categoryCount}>{unlockedInCat}/{achievements.length}</Text>
              </View>

              <View style={styles.achievementsGrid}>
                {achievements.map((achievement) => {
                  const isUnlocked = unlockedIds.has(achievement.id);
                  const progress = achievement.progress?.(stats, lessons);

                  return (
                    <View
                      key={achievement.id}
                      style={[
                        styles.achievementCard,
                        isUnlocked && { borderColor: catMeta.color, borderWidth: 2 },
                      ]}
                    >
                      <View style={[
                        styles.achievementIcon,
                        { backgroundColor: isUnlocked ? catMeta.color + '20' : colors.background },
                      ]}>
                        <Ionicons
                          name={achievement.icon as any}
                          size={24}
                          color={isUnlocked ? catMeta.color : colors.textMuted}
                        />
                      </View>
                      <Text style={[
                        styles.achievementTitle,
                        !isUnlocked && styles.lockedText,
                      ]}>
                        {(t.achievements as Record<string, string>)[achievement.id] || achievement.title}
                      </Text>
                      <Text style={[
                        styles.achievementDesc,
                        !isUnlocked && styles.lockedText,
                      ]} numberOfLines={2}>
                        {(t.achievementDescriptions as Record<string, string>)[achievement.id] || achievement.description}
                      </Text>

                      {/* Progress bar for locked achievements */}
                      {!isUnlocked && progress && (
                        <View style={styles.achievementProgress}>
                          <View style={styles.miniProgressBar}>
                            <View
                              style={[
                                styles.miniProgressFill,
                                {
                                  width: `${(progress.current / progress.target) * 100}%`,
                                  backgroundColor: catMeta.color,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.miniProgressText}>
                            {progress.current}/{progress.target}
                          </Text>
                        </View>
                      )}

                      {/* XP reward badge */}
                      <View style={[
                        styles.xpBadge,
                        isUnlocked && { backgroundColor: catMeta.color },
                      ]}>
                        <Ionicons
                          name="star"
                          size={10}
                          color={isUnlocked ? colors.white : colors.textMuted}
                        />
                        <Text style={[
                          styles.xpText,
                          isUnlocked && { color: colors.white },
                        ]}>
                          +{achievement.xpReward}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  headerRight: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  progressSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.white,
    borderRadius: 4,
    overflow: 'hidden',
    ...shadows.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  categorySection: {
    marginBottom: spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryCount: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  achievementCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  achievementTitle: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  lockedText: {
    color: colors.textMuted,
  },
  achievementProgress: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  miniProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.background,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  miniProgressText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  xpBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  xpText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
