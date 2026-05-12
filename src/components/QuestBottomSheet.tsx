/**
 * QuestBottomSheet - Compact mission panel for landmark quests
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LandmarkQuest, QUEST_CATEGORIES } from '../types';
import { colors, borderRadius, spacing, typography } from '../constants/design';
import { formatDistance } from '../services/questService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuestBottomSheetProps {
  quests: LandmarkQuest[];
  onQuestPress: (quest: LandmarkQuest) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function QuestBottomSheet({
  quests,
  onQuestPress,
  onRefresh,
  isLoading = false,
}: QuestBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const activeQuests = quests.filter(q => !q.isCompleted);

  if (activeQuests.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Minimal visual separator */}
      <View style={styles.handleBar} />

      {/* Mission Header */}
      <View style={styles.missionHeader}>
        <View style={styles.missionTitleRow}>
          <Text style={styles.missionIcon}>🎯</Text>
          <Text style={styles.missionTitle}>Photo Missions</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={isLoading}
          >
            <Ionicons
              name="refresh"
              size={16}
              color={isLoading ? colors.textMuted : colors.primary}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.missionSubtitle}>
          Walk there & snap a photo for bonus XP
        </Text>
      </View>

      {/* Quest Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.questScroll}
      >
        {isLoading ? (
          <View style={styles.loadingCard}>
            <Ionicons name="locate" size={20} color={colors.textMuted} />
            <Text style={styles.loadingText}>Finding missions...</Text>
          </View>
        ) : (
          activeQuests.map((quest, index) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onPress={() => onQuestPress(quest)}
              isFirst={index === 0}
            />
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

interface QuestCardProps {
  quest: LandmarkQuest;
  onPress: () => void;
  isFirst?: boolean;
}

function QuestCard({ quest, onPress, isFirst = false }: QuestCardProps) {
  const category = QUEST_CATEGORIES[quest.category];
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.questCard, isFirst && styles.questCardFirst]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Nearest badge for first card */}
        {isFirst && (
          <View style={styles.nearestBadge}>
            <Text style={styles.nearestText}>Nearest</Text>
          </View>
        )}

        {/* Left: Large Emoji */}
        <View style={[styles.emojiContainer, isFirst && styles.emojiContainerFirst]}>
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
        </View>

        {/* Right: Content */}
        <View style={styles.questContent}>
          {/* Name - allow 2 lines */}
          <Text style={styles.questName} numberOfLines={2}>
            {quest.name}
          </Text>

          {/* Distance + Unlock row */}
          <View style={styles.metaRow}>
            <View style={styles.distancePill}>
              <Ionicons name="walk" size={10} color={colors.primary} />
              <Text style={styles.distanceText}>
                {formatDistance(quest.distanceMeters)}
              </Text>
            </View>
            <Text style={styles.unlockText}>
              {quest.vocabularyTheme}
            </Text>
          </View>

          {/* Bottom row: XP + Go button */}
          <View style={styles.bottomRow}>
            <View style={styles.xpBadge}>
              <Ionicons name="star" size={11} color={colors.xp} />
              <Text style={styles.xpText}>+{quest.xpBonus}</Text>
            </View>
            <View style={styles.goButton}>
              <Ionicons name="navigate" size={11} color={colors.white} />
              <Text style={styles.goText}>Go</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handleBar: {
    width: 32,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 1.5,
    alignSelf: 'center',
    marginBottom: 4,
    opacity: 0.5,
  },
  missionHeader: {
    paddingHorizontal: spacing.md,
    marginBottom: 4,
  },
  missionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  missionTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  missionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    marginLeft: 26,
  },
  refreshButton: {
    padding: spacing.xs,
  },
  questScroll: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  loadingCard: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: 70,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
  questCard: {
    width: 180,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginRight: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  questCardFirst: {
    borderColor: '#FF6B35',
    borderWidth: 1.5,
    backgroundColor: '#FFF8F5',
    paddingTop: 20,
  },
  nearestBadge: {
    position: 'absolute',
    top: -1,
    left: -1,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopLeftRadius: borderRadius.lg - 2,
    borderBottomRightRadius: 8,
  },
  nearestText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  emojiContainerFirst: {
    backgroundColor: '#FFF0EB',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  questContent: {
    flex: 1,
    minWidth: 0,
  },
  questName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 16,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}12`,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  unlockText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  xpText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.xp,
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  goText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
});

export default QuestBottomSheet;
