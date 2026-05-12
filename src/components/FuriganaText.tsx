import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FuriganaSegment, ReadingLevel } from '../types';
import { colors, typography, spacing } from '../constants/design';

interface FuriganaTextProps {
  segments: FuriganaSegment[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  readingLevel?: ReadingLevel;
  showFurigana?: 'always' | 'kanji-only' | 'on-tap' | 'never';
  showRomaji?: boolean;
  romaji?: string;
  onSegmentPress?: (segment: FuriganaSegment, index: number) => void;
  color?: string;
  centered?: boolean;
}

const SIZE_MAP = {
  sm: { base: 14, ruby: 8 },
  md: { base: 18, ruby: 10 },
  lg: { base: 24, ruby: 12 },
  xl: { base: 32, ruby: 14 },
};

/**
 * FuriganaText - Renders Japanese text with optional furigana (reading hints)
 *
 * Furigana are small hiragana characters displayed above kanji to show pronunciation.
 * This component handles:
 * - Displaying furigana above kanji
 * - Tap-to-reveal furigana for learning
 * - Different display modes based on user's reading level
 * - Fallback to romaji for beginners
 */
export function FuriganaText({
  segments,
  size = 'md',
  readingLevel = 'romaji',
  showFurigana = 'always',
  showRomaji = false,
  romaji,
  onSegmentPress,
  color = colors.navy,
  centered = false,
}: FuriganaTextProps) {
  const [revealedSegments, setRevealedSegments] = useState<Set<number>>(new Set());
  const sizes = SIZE_MAP[size];

  // Determine if furigana should be shown for a segment
  const shouldShowFurigana = (segment: FuriganaSegment, index: number): boolean => {
    if (!segment.isKanji) return false; // Only show furigana for kanji
    if (showFurigana === 'never') return false;
    if (showFurigana === 'always') return true;
    if (showFurigana === 'kanji-only') return segment.isKanji;
    if (showFurigana === 'on-tap') return revealedSegments.has(index);
    return false;
  };

  const handleSegmentPress = (segment: FuriganaSegment, index: number) => {
    if (showFurigana === 'on-tap') {
      setRevealedSegments(prev => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    }
    onSegmentPress?.(segment, index);
  };

  // For romaji-level users, show romaji primarily
  if (readingLevel === 'romaji' && showRomaji && romaji) {
    return (
      <View style={[styles.container, centered && styles.centered]}>
        <Text style={[styles.romajiPrimary, { fontSize: sizes.base, color }]}>
          {romaji}
        </Text>
        <Text style={[styles.japaneseSecondary, { fontSize: sizes.ruby }]}>
          {segments.map(s => s.text).join('')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, centered && styles.centered]}>
      <View style={styles.rubyContainer}>
        {segments.map((segment, index) => {
          const showReading = shouldShowFurigana(segment, index);
          const isInteractive = showFurigana === 'on-tap' && segment.isKanji;

          const content = (
            <View key={index} style={styles.rubyPair}>
              {/* Furigana (ruby text) */}
              <Text
                style={[
                  styles.rubyText,
                  {
                    fontSize: sizes.ruby,
                    opacity: showReading ? 1 : 0,
                    color: colors.primary,
                  },
                ]}
              >
                {segment.reading}
              </Text>

              {/* Base text */}
              <Text
                style={[
                  styles.baseText,
                  {
                    fontSize: sizes.base,
                    color,
                  },
                  segment.isKanji && styles.kanjiText,
                  isInteractive && !showReading && styles.tappableText,
                ]}
              >
                {segment.text}
              </Text>
            </View>
          );

          if (isInteractive) {
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleSegmentPress(segment, index)}
                activeOpacity={0.7}
              >
                {content}
              </TouchableOpacity>
            );
          }

          return content;
        })}
      </View>

      {/* Optional romaji below */}
      {showRomaji && romaji && readingLevel !== 'romaji' && (
        <Text style={[styles.romajiBelow, { fontSize: sizes.ruby }]}>
          {romaji}
        </Text>
      )}
    </View>
  );
}

/**
 * ScriptBadge - Shows the type of Japanese script used
 */
interface ScriptBadgeProps {
  scriptType: 'hiragana' | 'katakana' | 'kanji' | 'mixed';
  size?: 'sm' | 'md';
}

export function ScriptBadge({ scriptType, size = 'sm' }: ScriptBadgeProps) {
  const badges = {
    hiragana: { label: 'ひ', color: colors.mint, name: 'Hiragana' },
    katakana: { label: 'カ', color: colors.primary, name: 'Katakana' },
    kanji: { label: '漢', color: colors.xp, name: 'Kanji' },
    mixed: { label: '混', color: colors.level, name: 'Mixed' },
  };

  const badge = badges[scriptType];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.scriptBadge,
        { backgroundColor: badge.color },
        isSmall && styles.scriptBadgeSm,
      ]}
    >
      <Text style={[styles.scriptBadgeText, isSmall && styles.scriptBadgeTextSm]}>
        {badge.label}
      </Text>
    </View>
  );
}

/**
 * ReadingModeToggle - Allows user to switch between display modes
 */
interface ReadingModeToggleProps {
  mode: 'furigana' | 'plain' | 'romaji';
  onChange: (mode: 'furigana' | 'plain' | 'romaji') => void;
}

export function ReadingModeToggle({ mode, onChange }: ReadingModeToggleProps) {
  return (
    <View style={styles.toggleContainer}>
      <TouchableOpacity
        style={[styles.toggleButton, mode === 'furigana' && styles.toggleActive]}
        onPress={() => onChange('furigana')}
      >
        <Text style={[styles.toggleText, mode === 'furigana' && styles.toggleTextActive]}>
          振り仮名
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleButton, mode === 'plain' && styles.toggleActive]}
        onPress={() => onChange('plain')}
      >
        <Text style={[styles.toggleText, mode === 'plain' && styles.toggleTextActive]}>
          漢字
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleButton, mode === 'romaji' && styles.toggleActive]}
        onPress={() => onChange('romaji')}
      >
        <Text style={[styles.toggleText, mode === 'romaji' && styles.toggleTextActive]}>
          Romaji
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  centered: {
    alignItems: 'center',
  },
  rubyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  rubyPair: {
    alignItems: 'center',
  },
  rubyText: {
    textAlign: 'center',
    minHeight: 14,
    fontWeight: typography.medium,
  },
  baseText: {
    fontWeight: typography.bold,
  },
  kanjiText: {
    // Kanji can have slightly different styling
  },
  tappableText: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: colors.primary,
  },
  romajiPrimary: {
    fontWeight: typography.bold,
    marginBottom: spacing.xs,
  },
  japaneseSecondary: {
    color: colors.textMuted,
  },
  romajiBelow: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Script Badge
  scriptBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  scriptBadgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scriptBadgeText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  scriptBadgeTextSm: {
    fontSize: 10,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.navyLight,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: colors.white,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  toggleTextActive: {
    color: colors.navy,
  },
});

export default FuriganaText;
