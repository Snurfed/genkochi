import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { getObjectVisual, ObjectCategory } from '../../types';
import { useAppStore } from '../../store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DetectedObject {
  id: string;
  english: string;
  japanese: string;
  hiragana?: string;
  category: string;
  confidence: number;
}

interface ObjectSelectorProps {
  detectedObjects: DetectedObject[];
  onSelectObject: (object: DetectedObject) => void;
  onCancel: () => void;
}

export function ObjectSelector({
  detectedObjects,
  onSelectObject,
  onCancel,
}: ObjectSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { isWordInAnyWorld, suggestWorldForObject } = useAppStore();

  // Entry animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Sort objects: new words first, then by confidence
  const sortedObjects = [...detectedObjects].sort((a, b) => {
    const aIsNew = !isWordInAnyWorld(a.english);
    const bIsNew = !isWordInAnyWorld(b.english);

    if (aIsNew && !bIsNew) return -1;
    if (!aIsNew && bIsNew) return 1;
    return b.confidence - a.confidence;
  });

  // Find recommended object (first new word with high confidence)
  const recommendedObject = sortedObjects.find(
    obj => !isWordInAnyWorld(obj.english) && obj.confidence >= 0.7
  );

  const handleSelect = () => {
    if (selectedId) {
      const selected = detectedObjects.find(obj => obj.id === selectedId);
      if (selected) {
        onSelectObject(selected);
      }
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onCancel());
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} />

      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Choose One Object</Text>
            <Text style={styles.subtitle}>
              Select the word you want to learn
            </Text>
          </View>
        </View>

        {/* Recommendation banner */}
        {recommendedObject && !selectedId && (
          <View style={styles.recommendBanner}>
            <Ionicons name="sparkles" size={16} color={colors.xp} />
            <Text style={styles.recommendText}>
              New word recommended for you!
            </Text>
          </View>
        )}

        {/* Object list */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedObjects.map((obj, index) => {
            const visual = getObjectVisual(obj.english);
            const isNew = !isWordInAnyWorld(obj.english);
            const isRecommended = recommendedObject?.id === obj.id;
            const suggestedWorld = suggestWorldForObject(visual.category);

            return (
              <ObjectCard
                key={obj.id}
                object={obj}
                visual={visual}
                isNew={isNew}
                isRecommended={isRecommended}
                isSelected={selectedId === obj.id}
                suggestedWorld={suggestedWorld}
                onSelect={() => setSelectedId(obj.id)}
                delay={index * 50}
              />
            );
          })}
        </ScrollView>

        {/* Action button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.addButton,
              !selectedId && styles.addButtonDisabled,
            ]}
            onPress={handleSelect}
            disabled={!selectedId}
          >
            <Ionicons name="add-circle" size={24} color="white" />
            <Text style={styles.addButtonText}>
              Add to World
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

interface ObjectCardProps {
  object: DetectedObject;
  visual: { emoji: string; category: ObjectCategory };
  isNew: boolean;
  isRecommended: boolean;
  isSelected: boolean;
  suggestedWorld: string | null;
  onSelect: () => void;
  delay: number;
}

function ObjectCard({
  object,
  visual,
  isNew,
  isRecommended,
  isSelected,
  suggestedWorld,
  onSelect,
  delay,
}: ObjectCardProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          isRecommended && !isSelected && styles.cardRecommended,
        ]}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        {/* Emoji */}
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{visual.emoji}</Text>
        </View>

        {/* Word info */}
        <View style={styles.wordInfo}>
          <Text style={styles.japanese}>{object.japanese}</Text>
          <Text style={styles.english}>{object.english}</Text>

          {/* Tags */}
          <View style={styles.tags}>
            {isNew && (
              <View style={styles.newTag}>
                <Text style={styles.newTagText}>NEW</Text>
              </View>
            )}
            {suggestedWorld && (
              <View style={styles.worldTag}>
                <Text style={styles.worldTagText}>{suggestedWorld}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Selection indicator */}
        <View style={styles.selectIndicator}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
          ) : (
            <View style={styles.emptyCircle} />
          )}
        </View>

        {/* Confidence bar */}
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${object.confidence * 100}%` },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  recommendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.xp}20`,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  recommendText: {
    fontSize: typography.sm,
    color: colors.xp,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardWrapper: {
    marginBottom: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  cardRecommended: {
    borderColor: colors.xp,
    borderStyle: 'dashed',
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emoji: {
    fontSize: 28,
  },
  wordInfo: {
    flex: 1,
  },
  japanese: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  english: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  newTag: {
    backgroundColor: colors.mint,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  newTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  worldTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  worldTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  selectIndicator: {
    marginLeft: spacing.sm,
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  confidenceBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.border,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: colors.mint,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.xxl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  addButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  addButtonText: {
    color: 'white',
    fontSize: typography.base,
    fontWeight: '700',
  },
});

export default ObjectSelector;
