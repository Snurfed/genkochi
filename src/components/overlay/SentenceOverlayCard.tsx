import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sentence, Word, ReadingLevel, FuriganaSegment } from '../../types';
import { colors, borderRadius, spacing, typography, shadows } from '../../constants/design';
import { usesNonLatinScript } from '../../constants/languages';
import { speakText, SPEECH_RATES } from '../../utils/speech';
import { useAppStore } from '../../store';
import FloatingCard from './FloatingCard';

interface SentenceOverlayCardProps {
  sentence: Sentence;
  words?: Word[];
  highlightWord?: Word;
  readingLevel?: ReadingLevel;
  onClose: () => void;
  onWordTap?: (word: Word) => void;
}

interface TappableWord {
  text: string;
  reading: string;
  romaji?: string;
  word?: Word;
  isParticle: boolean;
}

/**
 * SentenceOverlayCard - Shows sentence with tappable word-by-word breakdown
 * Each word can be tapped to reveal a mini word card
 */
export function SentenceOverlayCard({
  sentence,
  words = [],
  highlightWord,
  readingLevel = 'romaji',
  onClose,
  onWordTap,
}: SentenceOverlayCardProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const { targetLanguage } = useAppStore();
  const showRomanization = usesNonLatinScript(targetLanguage);

  // Helper function to speak in target language
  const speak = (text: string, options: { slow?: boolean; onDone?: () => void; onError?: () => void } = {}) => {
    speakText(text, {
      rate: options.slow ? SPEECH_RATES.SLOW : SPEECH_RATES.NORMAL,
      languageCode: targetLanguage.speechCode,
      onDone: options.onDone,
      onError: options.onError,
    });
  };

  const handleSpeak = async (slow = false) => {
    setIsPlaying(true);
    // Use reading for accurate pronunciation
    speak(sentence.reading || sentence.japanese, {
      slow,
      onDone: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  // Parse sentence into tappable words
  const tappableWords: TappableWord[] = React.useMemo(() => {
    // Try to match words from the lesson to sentence segments
    const result: TappableWord[] = [];

    if (sentence.furigana && sentence.furigana.length > 0) {
      // Use furigana segments if available
      sentence.furigana.forEach(segment => {
        const matchedWord = words.find(w =>
          w.japanese === segment.text ||
          segment.text.includes(w.japanese)
        );
        result.push({
          text: segment.text,
          reading: segment.reading,
          romaji: matchedWord?.romaji,
          word: matchedWord,
          isParticle: ['は', 'が', 'を', 'に', 'で', 'の', 'と', 'も', 'へ', 'から', 'まで', 'より'].includes(segment.text),
        });
      });
    } else {
      // Fallback: split by common particles and try to match
      const particles = ['は', 'が', 'を', 'に', 'で', 'の', 'と', 'も', 'へ', 'から', 'まで', 'より', '。', '、'];
      let remaining = sentence.japanese;
      let readingRemaining = sentence.reading || '';

      // Simple word extraction - find known words in the sentence
      words.forEach(w => {
        if (remaining.includes(w.japanese)) {
          const idx = remaining.indexOf(w.japanese);
          if (idx > 0) {
            const before = remaining.slice(0, idx);
            result.push({ text: before, reading: before, romaji: undefined, word: undefined, isParticle: particles.some(p => before.includes(p)) });
          }
          result.push({ text: w.japanese, reading: w.reading, romaji: w.romaji, word: w, isParticle: false });
          remaining = remaining.slice(idx + w.japanese.length);
        }
      });

      if (remaining) {
        result.push({ text: remaining, reading: remaining, romaji: undefined, word: undefined, isParticle: true });
      }

      // If no words matched, show whole sentence as one unit
      if (result.length === 0) {
        result.push({ text: sentence.japanese, reading: sentence.reading, romaji: sentence.romaji, word: undefined, isParticle: false });
      }
    }

    return result;
  }, [sentence, words]);

  const handleWordTap = (index: number, tappable: TappableWord) => {
    if (tappable.isParticle && !tappable.word) {
      // Just speak the particle
      speak(tappable.text);
      return;
    }
    setActiveWordIndex(activeWordIndex === index ? null : index);
  };

  const handleWordAction = (action: 'listen' | 'speak' | 'write' | 'sentence', word: Word) => {
    switch (action) {
      case 'listen':
        // Use hiragana reading for accurate pronunciation
        speak(word.reading || word.japanese);
        break;
      case 'speak':
        // Would trigger speech recognition - for now just speak
        speak(word.reading || word.japanese, { slow: true });
        break;
      case 'sentence':
        // Already in sentence view
        setActiveWordIndex(null);
        break;
      case 'write':
        // Future: open writing practice
        break;
    }
  };

  const activeWord = activeWordIndex !== null ? tappableWords[activeWordIndex] : null;

  return (
    <FloatingCard onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Sentence header */}
        <Text style={styles.headerLabel}>Tap each word to learn</Text>

        {/* Interactive sentence */}
        <View style={styles.sentenceContainer}>
          <View style={styles.wordsRow}>
            {tappableWords.map((tappable, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wordUnit,
                  tappable.word && styles.wordUnitTappable,
                  activeWordIndex === index && styles.wordUnitActive,
                  tappable.isParticle && !tappable.word && styles.wordUnitParticle,
                ]}
                onPress={() => handleWordTap(index, tappable)}
                activeOpacity={0.7}
              >
                {/* Reading on top - only show if different from main text (e.g., hiragana for kanji) */}
                {tappable.reading && tappable.reading !== tappable.text && (
                  <Text style={[
                    styles.wordReading,
                    activeWordIndex === index && styles.wordReadingActive,
                  ]}>
                    {tappable.reading}
                  </Text>
                )}
                {/* Main text */}
                <Text style={[
                  styles.wordText,
                  tappable.word && styles.wordTextTappable,
                  activeWordIndex === index && styles.wordTextActive,
                  tappable.isParticle && !tappable.word && styles.wordTextParticle,
                ]}>
                  {tappable.text}
                </Text>
                {/* Romanization for non-Latin scripts (only if no separate reading is shown) */}
                {showRomanization && tappable.romaji && (tappable.reading === tappable.text || !tappable.reading) && (
                  <Text style={[
                    styles.wordRomaji,
                    activeWordIndex === index && styles.wordRomajiActive,
                  ]}>
                    {tappable.romaji}
                  </Text>
                )}
                {/* Meaning hint for tappable words */}
                {tappable.word && (
                  <Text style={styles.wordHint} numberOfLines={1}>
                    {tappable.word.nativeTranslation || tappable.word.english}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Active word popup card */}
        {activeWord && activeWord.word && (
          <View style={styles.wordPopup}>
            <View style={styles.wordPopupHeader}>
              <Text style={styles.wordPopupJapanese}>{activeWord.word.japanese}</Text>
              <TouchableOpacity
                style={styles.wordPopupClose}
                onPress={() => setActiveWordIndex(null)}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.wordPopupReading}>{activeWord.word.reading}</Text>
            <Text style={styles.wordPopupRomaji}>{activeWord.word.romaji}</Text>
            <Text style={styles.wordPopupMeaning}>{activeWord.word.english}</Text>

            {activeWord.word.partOfSpeech && (
              <Text style={styles.wordPopupPos}>{activeWord.word.partOfSpeech}</Text>
            )}

            {/* Action buttons */}
            <View style={styles.wordActions}>
              <TouchableOpacity
                style={styles.wordActionBtn}
                onPress={() => handleWordAction('listen', activeWord.word!)}
              >
                <Ionicons name="volume-high" size={20} color={colors.primary} />
                <Text style={styles.wordActionLabel}>Listen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.wordActionBtn}
                onPress={() => handleWordAction('speak', activeWord.word!)}
              >
                <Ionicons name="mic" size={20} color={colors.primary} />
                <Text style={styles.wordActionLabel}>Speak</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.wordActionBtn}
                onPress={() => handleWordAction('write', activeWord.word!)}
              >
                <Ionicons name="pencil" size={20} color={colors.primary} />
                <Text style={styles.wordActionLabel}>Write</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.wordActionBtn, styles.wordActionBtnActive]}
                onPress={() => handleWordAction('sentence', activeWord.word!)}
              >
                <Ionicons name="chatbubble" size={20} color={colors.white} />
                <Text style={[styles.wordActionLabel, styles.wordActionLabelActive]}>In use</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Audio controls */}
        <View style={styles.audioRow}>
          <TouchableOpacity
            style={[styles.audioButton, isPlaying && styles.audioButtonPlaying]}
            onPress={() => handleSpeak(false)}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'volume-high'}
              size={18}
              color={isPlaying ? colors.white : colors.primary}
            />
            <Text style={[styles.audioLabel, isPlaying && styles.audioLabelPlaying]}>
              Play sentence
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => handleSpeak(true)}
          >
            <Ionicons name="play-skip-back" size={18} color={colors.primary} />
            <Text style={styles.audioLabel}>Slow</Text>
          </TouchableOpacity>
        </View>

        {/* Translation toggle */}
        <TouchableOpacity
          style={styles.translationToggle}
          onPress={() => setShowTranslation(!showTranslation)}
        >
          <Ionicons
            name={showTranslation ? 'eye' : 'eye-off'}
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.translationToggleText}>
            {showTranslation ? 'Hide' : 'Show'} English
          </Text>
        </TouchableOpacity>

        {/* Translation */}
        {showTranslation && (
          <View style={styles.translationSection}>
            <Text style={styles.translation}>{sentence.translation}</Text>
          </View>
        )}
      </ScrollView>
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  headerLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sentenceContainer: {
    marginBottom: spacing.lg,
  },
  wordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  wordUnit: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minWidth: 40,
  },
  wordUnitTappable: {
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  wordUnitActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  wordUnitParticle: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.xs,
    minWidth: 20,
  },
  wordReading: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
    minHeight: 12,
  },
  wordReadingActive: {
    color: colors.white,
  },
  wordText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  wordTextTappable: {
    color: colors.primary,
  },
  wordTextActive: {
    color: colors.white,
  },
  wordTextParticle: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    fontWeight: typography.normal,
  },
  wordRomaji: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  wordRomajiActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  wordHint: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: 60,
    textAlign: 'center',
  },

  // Word popup card
  wordPopup: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  wordPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordPopupJapanese: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  wordPopupClose: {
    padding: spacing.xs,
  },
  wordPopupReading: {
    fontSize: typography.lg,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  wordPopupRomaji: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  wordPopupMeaning: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.navy,
    marginTop: spacing.md,
  },
  wordPopupPos: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  wordActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wordActionBtn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    flex: 1,
    marginHorizontal: 2,
  },
  wordActionBtnActive: {
    backgroundColor: colors.mint,
  },
  wordActionLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  wordActionLabelActive: {
    color: colors.white,
  },

  // Audio row
  audioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
  },
  audioButtonPlaying: {
    backgroundColor: colors.primary,
  },
  audioLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.primary,
  },
  audioLabelPlaying: {
    color: colors.white,
  },

  // Translation
  translationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  translationToggleText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  translationSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  translation: {
    fontSize: typography.base,
    color: colors.navy,
    textAlign: 'center',
  },
});

export default SentenceOverlayCard;
