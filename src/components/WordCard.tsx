import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Word, ReadingLevel } from '../types';
import { FuriganaText, ScriptBadge } from './FuriganaText';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/design';
import { useSpeech } from '../hooks/useSpeech';

interface WordCardProps {
  word: Word;
  readingLevel?: ReadingLevel;
  variant?: 'compact' | 'full' | 'quiz';
  showMeaning?: boolean;
  showReading?: boolean;
  showScriptType?: boolean;
  showMastery?: boolean;
  onPress?: () => void;
  onSpeakPress?: () => void;
  onMicPress?: () => void;
  isActive?: boolean;
  isSpoken?: boolean;
}

/**
 * WordCard - Enhanced word display with reading support
 *
 * Displays Japanese vocabulary with:
 * - Furigana (reading hints above kanji)
 * - Script type badge (hiragana/katakana/kanji)
 * - Mastery indicators for both meaning and reading
 * - Speak and mic buttons
 * - Progressive disclosure based on reading level
 */
export function WordCard({
  word,
  readingLevel = 'romaji',
  variant = 'full',
  showMeaning = true,
  showReading = true,
  showScriptType = true,
  showMastery = true,
  onPress,
  onSpeakPress,
  onMicPress,
  isActive = false,
  isSpoken = false,
}: WordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { speak } = useSpeech();

  const handleSpeak = async () => {
    if (onSpeakPress) {
      onSpeakPress();
    } else {
      // Use reading for accurate pronunciation
      speak(word.reading || word.japanese);
    }
  };

  // Determine furigana display mode based on reading level
  const getFuriganaMode = (): 'always' | 'kanji-only' | 'on-tap' | 'never' => {
    switch (readingLevel) {
      case 'romaji':
        return 'always'; // Always show for beginners
      case 'kana':
        return 'always';
      case 'kanji-basic':
        return 'always';
      case 'kanji-read':
        return 'on-tap'; // Tap to reveal
      case 'fluent':
        return 'never';
      default:
        return 'always';
    }
  };

  // Determine if romaji should be shown
  const shouldShowRomaji = readingLevel === 'romaji';

  // Create default furigana if not provided
  const furiganaSegments = word.furigana || [{
    text: word.japanese,
    reading: word.reading || word.japanese,
    isKanji: false,
  }];

  const scriptType = word.scriptType || 'hiragana';
  const containsKanji = word.containsKanji || false;

  // Compact variant (for bubbles, lists)
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[
          styles.compactCard,
          isActive && styles.compactCardActive,
          isSpoken && styles.compactCardSpoken,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={`${word.japanese}, ${word.nativeTranslation || word.english}`}
        accessibilityRole="button"
        accessibilityHint="Tap to learn this word"
      >
        {showScriptType && containsKanji && (
          <View style={styles.compactBadge}>
            <ScriptBadge scriptType={scriptType} size="sm" />
          </View>
        )}

        <FuriganaText
          segments={furiganaSegments}
          size="md"
          readingLevel={readingLevel}
          showFurigana={getFuriganaMode()}
          showRomaji={shouldShowRomaji}
          romaji={word.romaji}
          centered
        />

        {showMeaning && (
          <Text style={styles.compactMeaning}>{word.english}</Text>
        )}

        {/* Mini mastery indicator */}
        {showMastery && (
          <View style={styles.compactMasteryRow}>
            <View style={[styles.masteryDot, { backgroundColor: getMasteryColor(word.mastery) }]} />
            <View style={[styles.masteryDot, { backgroundColor: getMasteryColor(word.readingMastery || word.mastery) }]} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Quiz variant (minimal, focused)
  if (variant === 'quiz') {
    return (
      <View style={styles.quizCard}>
        <FuriganaText
          segments={furiganaSegments}
          size="xl"
          readingLevel={readingLevel}
          showFurigana={getFuriganaMode()}
          showRomaji={false}
          centered
        />

        <TouchableOpacity
          onPress={handleSpeak}
          style={styles.speakButtonQuiz}
          accessibilityLabel="Listen to pronunciation"
          accessibilityRole="button"
        >
          <Ionicons name="volume-medium" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  // Full variant (detailed card)
  return (
    <TouchableOpacity
      style={[styles.fullCard, isActive && styles.fullCardActive]}
      onPress={() => setIsExpanded(!isExpanded)}
      activeOpacity={0.9}
      accessibilityLabel={`${word.japanese}, ${word.nativeTranslation || word.english}`}
      accessibilityRole="button"
      accessibilityHint="Tap to expand word details"
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        {showScriptType && (
          <ScriptBadge scriptType={scriptType} size="md" />
        )}
        <View style={styles.headerSpacer} />
        {showMastery && (
          <View style={styles.masteryIndicators}>
            <MasteryPill label="Meaning" level={word.mastery} score={word.masteryScore} />
            <MasteryPill label="Reading" level={word.readingMastery || word.mastery} score={word.readingScore || word.masteryScore} />
          </View>
        )}
      </View>

      {/* Main content */}
      <View style={styles.mainContent}>
        <FuriganaText
          segments={furiganaSegments}
          size="xl"
          readingLevel={readingLevel}
          showFurigana={getFuriganaMode()}
          showRomaji={shouldShowRomaji}
          romaji={word.romaji}
          centered
        />

        {/* Reading (hiragana) - shown when not in romaji mode */}
        {showReading && !shouldShowRomaji && readingLevel !== 'fluent' && (
          <Text style={styles.readingText}>{word.reading}</Text>
        )}

        {/* Romaji - shown for kana learners as secondary */}
        {readingLevel === 'kana' && (
          <Text style={styles.romajiSecondary}>{word.romaji}</Text>
        )}
      </View>

      {/* Meaning */}
      {showMeaning && (
        <View style={styles.meaningSection}>
          <Text style={styles.meaningText}>{word.english}</Text>
          {word.partOfSpeech && (
            <Text style={styles.posText}>{word.partOfSpeech}</Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleSpeak}>
          <Ionicons name="volume-high" size={22} color={colors.primary} />
          <Text style={styles.actionLabel}>Listen</Text>
        </TouchableOpacity>

        {onMicPress && (
          <TouchableOpacity
            style={[styles.actionButton, styles.micButton]}
            onPress={onMicPress}
          >
            <Ionicons name="mic" size={22} color={colors.white} />
            <Text style={[styles.actionLabel, styles.micLabel]}>Speak</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded details */}
      {isExpanded && (
        <View style={styles.expandedSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Script:</Text>
            <Text style={styles.detailValue}>
              {word.scriptType === 'kanji' ? 'Contains Kanji' :
               word.scriptType === 'katakana' ? 'Katakana (foreign word)' :
               word.scriptType === 'hiragana' ? 'Hiragana' : 'Mixed scripts'}
            </Text>
          </View>
          {word.jlptLevel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>JLPT Level:</Text>
              <Text style={styles.detailValue}>N{word.jlptLevel}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Times practiced:</Text>
            <Text style={styles.detailValue}>
              {word.timesCorrect + word.timesWrong} times
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * MasteryPill - Shows mastery level for a specific skill
 */
function MasteryPill({
  label,
  level,
  score,
}: {
  label: string;
  level: string;
  score: number;
}) {
  return (
    <View style={[styles.masteryPill, { backgroundColor: getMasteryColor(level) + '20' }]}>
      <View style={[styles.masteryPillDot, { backgroundColor: getMasteryColor(level) }]} />
      <Text style={styles.masteryPillLabel}>{label}</Text>
      <Text style={[styles.masteryPillScore, { color: getMasteryColor(level) }]}>
        {score}%
      </Text>
    </View>
  );
}

function getMasteryColor(level: string): string {
  switch (level) {
    case 'mastered':
      return colors.xp;
    case 'familiar':
      return colors.mint;
    case 'learning':
      return colors.primary;
    default:
      return colors.textMuted;
  }
}

const styles = StyleSheet.create({
  // Compact variant
  compactCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    minWidth: 100,
    ...shadows.md,
  },
  compactCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  compactCardSpoken: {
    borderWidth: 2,
    borderColor: colors.mint,
  },
  compactBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
  },
  compactMeaning: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  compactMasteryRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.xs,
  },
  masteryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Quiz variant
  quizCard: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  speakButtonQuiz: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },

  // Full variant
  fullCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  fullCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerSpacer: {
    flex: 1,
  },
  masteryIndicators: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  masteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  masteryPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  masteryPillLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  masteryPillScore: {
    fontSize: 10,
    fontWeight: typography.bold,
  },
  mainContent: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  readingText: {
    fontSize: typography.lg,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  romajiSecondary: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  meaningSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  meaningText: {
    fontSize: typography.xl,
    color: colors.navy,
    fontWeight: typography.semibold,
  },
  posText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  micButton: {
    backgroundColor: colors.primary,
  },
  actionLabel: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  micLabel: {
    color: colors.white,
  },
  expandedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: typography.sm,
    color: colors.navy,
    fontWeight: typography.medium,
  },
});

export default WordCard;
