import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sentence, ReadingLevel } from '../types';
import { FuriganaText, ReadingModeToggle } from './FuriganaText';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/design';
import { speakText, stopSpeaking } from '../utils/speech';
import { useAppStore } from '../store';
import { getSentenceTranslation } from '../utils/nativeTranslation';
import { useTranslations } from '../hooks/useTranslations';

interface SentenceCardProps {
  sentence: Sentence;
  readingLevel?: ReadingLevel;
  showTranslation?: boolean;
  showControls?: boolean;
  onWordPress?: (wordId: string) => void;
  variant?: 'compact' | 'full' | 'practice';
}

/**
 * SentenceCard - Displays a Japanese sentence with full reading support
 *
 * Features:
 * - Full furigana support for all kanji
 * - Word-by-word audio playback
 * - Translation toggle
 * - Reading mode switching
 * - Tap words to see details
 */
export function SentenceCard({
  sentence,
  readingLevel = 'romaji',
  showTranslation = true,
  showControls = true,
  onWordPress,
  variant = 'full',
}: SentenceCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [translationVisible, setTranslationVisible] = useState(showTranslation);
  const [readingMode, setReadingMode] = useState<'furigana' | 'plain' | 'romaji'>(
    readingLevel === 'romaji' ? 'romaji' : 'furigana'
  );
  const { targetLanguage, nativeLanguage } = useAppStore();
  const t = useTranslations();

  // Get native translation (NOT English unless native IS English)
  const nativeTranslation = getSentenceTranslation(sentence, nativeLanguage);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handlePlaySentence = async () => {
    setIsPlaying(true);
    // Use reading for accurate pronunciation
    speakText(sentence.reading || sentence.japanese, {
      languageCode: targetLanguage.speechCode,
      onDone: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const handlePlaySlow = async () => {
    setIsPlaying(true);
    // Use reading for accurate pronunciation
    speakText(sentence.reading || sentence.japanese, {
      languageCode: targetLanguage.speechCode,
      rate: 0.7,
      onDone: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  const getFuriganaMode = (): 'always' | 'never' => {
    if (readingMode === 'plain') return 'never';
    if (readingMode === 'romaji') return 'never';
    return 'always';
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <View style={styles.compactCard}>
        <FuriganaText
          segments={sentence.furigana}
          size="sm"
          showFurigana={getFuriganaMode()}
          showRomaji={readingMode === 'romaji'}
          romaji={sentence.romaji}
        />
        {translationVisible && (
          <Text style={styles.compactTranslation}>{nativeTranslation}</Text>
        )}
      </View>
    );
  }

  // Practice variant (focused, minimal chrome)
  if (variant === 'practice') {
    return (
      <View style={styles.practiceCard}>
        {/* Reading mode toggle */}
        {showControls && (
          <View style={styles.modeToggleRow}>
            <ReadingModeToggle mode={readingMode} onChange={setReadingMode} />
          </View>
        )}

        {/* Main sentence */}
        <View style={styles.sentenceMain}>
          {readingMode === 'romaji' ? (
            <Text style={styles.romajiSentence}>{sentence.romaji}</Text>
          ) : (
            <FuriganaText
              segments={sentence.furigana}
              size="lg"
              showFurigana={getFuriganaMode()}
              centered
            />
          )}
        </View>

        {/* Audio controls */}
        <View style={styles.audioRow}>
          <TouchableOpacity
            style={[styles.audioButton, isPlaying && styles.audioButtonActive]}
            onPress={handlePlaySentence}
            disabled={isPlaying}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={colors.white}
            />
            <Text style={styles.audioLabel}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioButtonSecondary}
            onPress={handlePlaySlow}
            disabled={isPlaying}
          >
            <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
            <Text style={styles.audioLabelSecondary}>Slow</Text>
          </TouchableOpacity>
        </View>

        {/* Translation (tappable to reveal) */}
        <TouchableOpacity
          style={styles.translationToggle}
          onPress={() => setTranslationVisible(!translationVisible)}
        >
          {translationVisible ? (
            <Text style={styles.translationText}>{nativeTranslation}</Text>
          ) : (
            <View style={styles.translationHidden}>
              <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
              <Text style={styles.translationHint}>{t.study.tapToSeeTranslation}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Full variant
  return (
    <View style={styles.fullCard}>
      {/* Header with context */}
      {sentence.sceneContext && (
        <View style={styles.contextBadge}>
          <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
          <Text style={styles.contextText}>{sentence.sceneContext}</Text>
        </View>
      )}

      {/* Reading mode controls */}
      {showControls && (
        <View style={styles.controlsRow}>
          <ReadingModeToggle mode={readingMode} onChange={setReadingMode} />
        </View>
      )}

      {/* Main sentence display */}
      <View style={styles.sentenceContainer}>
        {readingMode === 'romaji' ? (
          <>
            <Text style={styles.romajiPrimary}>{sentence.romaji}</Text>
            <Text style={styles.japaneseSecondary}>{sentence.japanese}</Text>
          </>
        ) : (
          <FuriganaText
            segments={sentence.furigana}
            size="lg"
            showFurigana={getFuriganaMode()}
            onSegmentPress={(segment, index) => {
              // Could link to word details
              const wordId = sentence.wordIds[index];
              if (wordId && onWordPress) {
                onWordPress(wordId);
              }
            }}
          />
        )}
      </View>

      {/* Hiragana reading (for non-romaji modes) */}
      {readingMode !== 'romaji' && readingLevel !== 'fluent' && (
        <Text style={styles.fullReading}>{sentence.reading}</Text>
      )}

      {/* Audio controls */}
      <View style={styles.audioControls}>
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={handlePlaySentence}
          disabled={isPlaying}
        >
          <Ionicons
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={48}
            color={isPlaying ? colors.mint : colors.primary}
          />
        </TouchableOpacity>

        <View style={styles.playOptions}>
          <TouchableOpacity
            style={styles.optionButton}
            onPress={handlePlaySlow}
            disabled={isPlaying}
          >
            <Ionicons name="speedometer-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.optionLabel}>0.5x</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Translation section */}
      <View style={styles.translationSection}>
        <TouchableOpacity
          style={styles.translationHeader}
          onPress={() => setTranslationVisible(!translationVisible)}
        >
          <Text style={styles.translationLabel}>Translation</Text>
          <Ionicons
            name={translationVisible ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {translationVisible && (
          <Text style={styles.translationFull}>{nativeTranslation}</Text>
        )}
      </View>

      {/* Mastery indicator */}
      <View style={styles.masteryRow}>
        <View style={styles.masteryItem}>
          <Text style={styles.masteryLabel}>Reading</Text>
          <View style={styles.masteryBar}>
            <View
              style={[
                styles.masteryFill,
                { width: `${sentence.readingMastery}%` },
              ]}
            />
          </View>
          <Text style={styles.masteryPercent}>{sentence.readingMastery}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact variant
  compactCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  compactTranslation: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Practice variant
  practiceCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  modeToggleRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sentenceMain: {
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  romajiSentence: {
    fontSize: typography.xl,
    color: colors.navy,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  audioButtonActive: {
    backgroundColor: colors.mint,
  },
  audioLabel: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.bold,
  },
  audioButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  audioLabelSecondary: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  translationToggle: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  translationText: {
    fontSize: typography.base,
    color: colors.navy,
    textAlign: 'center',
  },
  translationHidden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  translationHint: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },

  // Full variant
  fullCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  contextText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  controlsRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sentenceContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  romajiPrimary: {
    fontSize: typography.xl,
    color: colors.navy,
    fontWeight: typography.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  japaneseSecondary: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: 'center',
  },
  fullReading: {
    fontSize: typography.sm,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playButton: {
    padding: spacing.xs,
  },
  playButtonActive: {
    opacity: 0.7,
  },
  playOptions: {
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  optionLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  translationSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  translationLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  translationFull: {
    fontSize: typography.base,
    color: colors.navy,
    marginTop: spacing.sm,
    lineHeight: 24,
  },
  masteryRow: {
    marginTop: spacing.lg,
  },
  masteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  masteryLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    width: 50,
  },
  masteryBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: borderRadius.full,
  },
  masteryPercent: {
    fontSize: typography.xs,
    color: colors.textMuted,
    width: 32,
    textAlign: 'right',
  },
});

export default SentenceCard;
