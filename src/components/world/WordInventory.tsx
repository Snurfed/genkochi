import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorldObject } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 60;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.45;

interface WordInventoryProps {
  objects: WorldObject[];
  selectedObjectId: string | null;
  onObjectSelect: (object: WorldObject) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function WordInventory({
  objects,
  selectedObjectId,
  onObjectSelect,
  isExpanded,
  onToggleExpand,
}: WordInventoryProps) {
  const heightAnim = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
      tension: 100,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  // Sort objects: needs review first, then by mastery
  const sortedObjects = useMemo(() => {
    return [...objects].sort((a, b) => {
      if (a.needsReview && !b.needsReview) return -1;
      if (!a.needsReview && b.needsReview) return 1;
      return a.masteryScore - b.masteryScore;
    });
  }, [objects]);

  // Count objects needing review
  const reviewCount = objects.filter(obj => obj.needsReview).length;

  return (
    <Animated.View style={[styles.container, { height: heightAnim }]}>
      {/* Header - always visible */}
      <TouchableOpacity style={styles.header} onPress={onToggleExpand}>
        <View style={styles.headerLeft}>
          <Ionicons name="cube-outline" size={20} color={colors.textPrimary} />
          <Text style={styles.headerTitle}>
            Word Inventory
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{objects.length}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {reviewCount > 0 && (
            <View style={styles.reviewBadge}>
              <Text style={styles.reviewBadgeText}>{reviewCount} to review</Text>
            </View>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Expandable content */}
      {isExpanded && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedObjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No objects yet</Text>
              <Text style={styles.emptySubtext}>
                Take a photo to add objects to your world
              </Text>
            </View>
          ) : (
            <>
              {/* Needs review section */}
              {reviewCount > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Needs Review</Text>
                  {sortedObjects
                    .filter(obj => obj.needsReview)
                    .map(obj => (
                      <WordRow
                        key={obj.id}
                        object={obj}
                        isSelected={selectedObjectId === obj.id}
                        onPress={() => onObjectSelect(obj)}
                      />
                    ))}
                </View>
              )}

              {/* All words section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>All Words</Text>
                {sortedObjects
                  .filter(obj => !obj.needsReview)
                  .map(obj => (
                    <WordRow
                      key={obj.id}
                      object={obj}
                      isSelected={selectedObjectId === obj.id}
                      onPress={() => onObjectSelect(obj)}
                    />
                  ))}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Collapsed preview */}
      {!isExpanded && objects.length > 0 && (
        <ScrollView
          horizontal
          style={styles.previewScroll}
          contentContainerStyle={styles.previewContent}
          showsHorizontalScrollIndicator={false}
        >
          {sortedObjects.slice(0, 8).map(obj => (
            <TouchableOpacity
              key={obj.id}
              style={[
                styles.previewItem,
                selectedObjectId === obj.id && styles.previewItemSelected,
                obj.needsReview && styles.previewItemReview,
              ]}
              onPress={() => onObjectSelect(obj)}
            >
              <Text style={styles.previewEmoji}>{obj.emoji}</Text>
            </TouchableOpacity>
          ))}
          {objects.length > 8 && (
            <View style={styles.previewMore}>
              <Text style={styles.previewMoreText}>+{objects.length - 8}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
}

interface WordRowProps {
  object: WorldObject;
  isSelected: boolean;
  onPress: () => void;
}

function WordRow({ object, isSelected, onPress }: WordRowProps) {
  const masteryColor = object.masteryScore >= 90 ? colors.mint :
                       object.masteryScore >= 60 ? colors.xp :
                       object.masteryScore >= 30 ? '#FBBF24' : colors.textMuted;

  return (
    <TouchableOpacity
      style={[styles.wordRow, isSelected && styles.wordRowSelected]}
      onPress={onPress}
    >
      <View style={styles.wordLeft}>
        <Text style={styles.wordEmoji}>{object.emoji}</Text>
        <View style={styles.wordText}>
          <Text style={styles.wordJapanese}>{object.displayName}</Text>
          <Text style={styles.wordEnglish}>{object.english}</Text>
        </View>
      </View>

      <View style={styles.wordRight}>
        {/* Mastery bar */}
        <View style={styles.wordMasteryBar}>
          <View
            style={[
              styles.wordMasteryFill,
              {
                width: `${object.masteryScore}%`,
                backgroundColor: masteryColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.wordMasteryText, { color: masteryColor }]}>
          {object.masteryScore}%
        </Text>

        {/* Review indicator */}
        {object.needsReview && (
          <View style={styles.reviewDot} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  countText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  reviewBadgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  wordRowSelected: {
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  wordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  wordEmoji: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  wordText: {
    flex: 1,
  },
  wordJapanese: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  wordEnglish: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  wordRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordMasteryBar: {
    width: 60,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  wordMasteryFill: {
    height: '100%',
    borderRadius: 3,
  },
  wordMasteryText: {
    fontSize: typography.xs,
    fontWeight: '700',
    width: 32,
    textAlign: 'right',
  },
  reviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewItemSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  previewItemReview: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  previewEmoji: {
    fontSize: 20,
  },
  previewMore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMoreText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: 'white',
  },
});

export default WordInventory;
