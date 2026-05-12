/**
 * FlashcardReview.tsx
 *
 * Quick flashcard review showing photos with multiple choice answers.
 * Language-aware: adapts to user's native and target languages.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/design';
import { PhotoLesson, Word } from '../types';
import { resolveImageUri } from '../utils/photoStorage';
import { speakText, preloadAudio } from '../utils/speech';
import { useAppStore } from '../store';
import { getTranslations, Translations } from '../constants/translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to format "From your photo X days ago" text using translations
function getPhotoContextText(dateString: string, t: Translations): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t.flashcard.fromPhotoToday;
  if (diffDays === 1) return t.flashcard.fromPhotoYesterday;
  if (diffDays < 7) return t.flashcard.fromPhotoDaysAgo.replace('{days}', String(diffDays));
  if (diffDays < 14) return t.flashcard.fromPhotoLastWeek;
  if (diffDays < 30) return t.flashcard.fromPhotoWeeksAgo.replace('{weeks}', String(Math.floor(diffDays / 7)));
  return t.flashcard.fromPhotoMonthsAgo.replace('{months}', String(Math.floor(diffDays / 30)));
}

interface OptionData {
  japanese: string;
  reading: string;
  romaji: string;
}

interface FlashcardItem {
  lesson: PhotoLesson;
  word: Word;
  options: OptionData[]; // 4 options with readings
  correctIndex: number;
}

interface FlashcardReviewProps {
  visible: boolean;
  lessons: PhotoLesson[];
  onClose: () => void;
  onComplete: (reviewedCount: number) => void;
  onReviewWord: (lessonId: string, wordId: string, isCorrect: boolean, responseTimeMs?: number) => void;
}

// Generate distractor words from all lessons - prefer similar words
function generateOptions(
  correctWord: Word,
  allWords: Word[],
  count: number = 4
): { options: OptionData[]; correctIndex: number } {
  const correctOption: OptionData = {
    japanese: correctWord.japanese,
    reading: correctWord.reading || correctWord.japanese,
    romaji: correctWord.romaji || '',
  };

  // Get other words as distractors - prefer same part of speech
  const sameType = allWords.filter(w =>
    w.japanese !== correctWord.japanese &&
    w.japanese &&
    w.partOfSpeech === correctWord.partOfSpeech
  );

  const otherWords = allWords.filter(w =>
    w.japanese !== correctWord.japanese &&
    w.japanese &&
    w.partOfSpeech !== correctWord.partOfSpeech
  );

  // Prioritize same type, then fill with others (no hardcoded fallbacks)
  const candidates = [...sameType, ...otherWords]
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
    .map(w => ({
      japanese: w.japanese,
      reading: w.reading || w.japanese,
      romaji: w.romaji || '',
    }));

  // Use available candidates - show fewer options if not enough words
  const availableDistractors = Math.min(candidates.length, count - 1);
  const allOptions = [correctOption, ...candidates.slice(0, availableDistractors)];

  // Shuffle and find correct index
  const shuffled = allOptions.sort(() => Math.random() - 0.5);
  const correctIndex = shuffled.findIndex(o => o.japanese === correctWord.japanese);

  return { options: shuffled, correctIndex };
}

export function FlashcardReview({
  visible,
  lessons,
  onClose,
  onComplete,
  onReviewWord,
}: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [flashcardItems, setFlashcardItems] = useState<FlashcardItem[]>([]);
  const [cardShownAt, setCardShownAt] = useState<number>(Date.now());

  // Get user's language settings and translations
  const { nativeLanguage, targetLanguage } = useAppStore();
  const t = getTranslations(nativeLanguage.code);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const optionAnims = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  // Generate flashcard items ONCE when modal opens (not on every render)
  useEffect(() => {
    if (visible && lessons.length > 0) {
      const allWords: Word[] = [];
      lessons.forEach(lesson => {
        lesson.words.forEach(word => {
          if (word.japanese) allWords.push(word);
        });
      });

      const items: FlashcardItem[] = [];
      lessons.forEach(lesson => {
        lesson.words.forEach(word => {
          if (!word.japanese) return;
          const { options, correctIndex } = generateOptions(word, allWords);
          items.push({ lesson, word, options, correctIndex });
        });
      });

      // Shuffle and limit
      const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 10);
      setFlashcardItems(shuffled);

      // Immediately preload first card's audio so it's ready when user sees it
      if (shuffled.length > 0) {
        shuffled[0].options.forEach(option => {
          preloadAudio(option.japanese);
        });
      }
    }
  }, [visible]); // Only regenerate when visibility changes, NOT when lessons change

  const currentItem = flashcardItems[currentIndex];
  const totalCards = flashcardItems.length;
  const progress = totalCards > 0 ? ((currentIndex + 1) / totalCards) * 100 : 0;

  // Reset UI state when visibility changes
  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setReviewedCount(0);
      setSelectedOption(null);
      setShowResult(false);
      setCardShownAt(Date.now()); // Start timing first card
      slideAnim.setValue(0);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
      setFlashcardItems([]); // Clear items when closing
    }
  }, [visible]);

  // Preload audio for current and next card's options to eliminate delay
  useEffect(() => {
    if (!currentItem) return;

    // Preload all option audio for current card in parallel
    currentItem.options.forEach(option => {
      preloadAudio(option.japanese);
    });

    // Also preload the reading/hiragana if different
    if (currentItem.word.reading && currentItem.word.reading !== currentItem.word.japanese) {
      preloadAudio(currentItem.word.reading);
    }

    // Preload next card's options ahead of time
    const nextItem = flashcardItems[currentIndex + 1];
    if (nextItem) {
      nextItem.options.forEach(option => {
        preloadAudio(option.japanese);
      });
    }
  }, [currentItem, currentIndex, flashcardItems]);

  // Handle option selection
  const handleSelectOption = useCallback((index: number) => {
    if (showResult || !currentItem) return;

    const responseTimeMs = Date.now() - cardShownAt;
    setSelectedOption(index);
    setShowResult(true);

    const isCorrect = index === currentItem.correctIndex;

    // Always call onReviewWord with correct/incorrect and timing
    onReviewWord(currentItem.lesson.id, currentItem.word.id, isCorrect, responseTimeMs);

    if (isCorrect) {
      setReviewedCount(prev => prev + 1);
      // Play the word
      speakText(currentItem.word.japanese, { languageCode: targetLanguage.code });
    }

    // Animate the options
    optionAnims.forEach((anim, i) => {
      if (i === currentItem.correctIndex) {
        // Correct answer pulses
        Animated.sequence([
          Animated.timing(anim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
      } else if (i === index && !isCorrect) {
        // Wrong selection shakes
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
      }
    });

    // Auto-advance after delay
    setTimeout(() => nextCard(), isCorrect ? 1000 : 1500);
  }, [showResult, currentItem, onReviewWord, optionAnims]);

  // Move to next card
  const nextCard = useCallback(() => {
    if (currentIndex >= totalCards - 1) {
      onComplete(reviewedCount + (selectedOption === currentItem?.correctIndex ? 1 : 0));
      return;
    }

    // Slide out
    Animated.timing(slideAnim, {
      toValue: -SCREEN_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
      setCardShownAt(Date.now()); // Reset timer for next card
      slideAnim.setValue(SCREEN_WIDTH);
      optionAnims.forEach(anim => anim.setValue(1));

      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }).start();
    });
  }, [currentIndex, totalCards, reviewedCount, selectedOption, currentItem, onComplete, optionAnims]);

  // Skip to show answer
  const handleSkip = useCallback(() => {
    if (!currentItem || showResult) return;
    setSelectedOption(-1); // Mark as skipped

    // Report as incorrect with no response time (skipped)
    onReviewWord(currentItem.lesson.id, currentItem.word.id, false, undefined);

    setShowResult(true);
    speakText(currentItem.word.japanese, { languageCode: targetLanguage.code });
    setTimeout(() => nextCard(), 1500);
  }, [currentItem, showResult, nextCard]);

  if (!visible || !currentItem) return null;

  const isCorrect = selectedOption === currentItem.correctIndex;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{currentIndex + 1} / {totalCards}</Text>
          </View>
        </View>

        {/* Flashcard */}
        <Animated.View style={[styles.card, { transform: [{ translateX: slideAnim }] }]}>
          {/* Image Section */}
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: resolveImageUri(currentItem.lesson.imageUri) }}
              style={styles.fullImage}
              resizeMode="cover"
            />
          </View>

          {/* Question Section */}
          <View style={styles.questionSection}>
            {/* Context - when learned */}
            {currentItem.lesson.createdAt && (
              <Text style={styles.contextText}>
                {getPhotoContextText(currentItem.lesson.createdAt, t)}
              </Text>
            )}

            {/* Clear prompt with the word in user's native language */}
            <Text style={styles.promptLabel}>{t.flashcard.howDoYouSay}</Text>
            <Text style={styles.englishWord}>
              "{currentItem.word.nativeTranslation || currentItem.word.english}"
            </Text>
            <Text style={styles.promptLabel}>{t.flashcard.inLanguage.replace('{language}', targetLanguage.name)}</Text>

            {/* Multiple Choice Options - 2x2 Grid */}
            <View style={styles.optionsGrid}>
              {currentItem.options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrectOption = index === currentItem.correctIndex;
                const showCorrect = showResult && isCorrectOption;
                const showWrong = showResult && isSelected && !isCorrectOption;

                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.optionWrapper,
                      { transform: [{ scale: optionAnims[index] }] },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        showCorrect && styles.optionCorrect,
                        showWrong && styles.optionWrong,
                        isSelected && !showResult && styles.optionSelected,
                      ]}
                      onPress={() => handleSelectOption(index)}
                      disabled={showResult}
                      activeOpacity={0.7}
                    >
                      {/* Audio button */}
                      <TouchableOpacity
                        style={styles.optionAudio}
                        onPress={(e) => {
                          e.stopPropagation();
                          speakText(option.japanese, { languageCode: targetLanguage.code });
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name="volume-medium"
                          size={16}
                          color={showCorrect || showWrong ? 'rgba(255,255,255,0.8)' : colors.primary}
                        />
                      </TouchableOpacity>

                      {/* Japanese text */}
                      <Text
                        style={[
                          styles.optionJapanese,
                          (showCorrect || showWrong) && styles.optionTextResult,
                        ]}
                        numberOfLines={1}
                      >
                        {option.japanese}
                      </Text>

                      {/* Reading/Romaji - hide for English target to avoid giving away loanword answers */}
                      {targetLanguage.code !== 'en' && (
                        <Text
                          style={[
                            styles.optionReading,
                            (showCorrect || showWrong) && styles.optionReadingResult,
                          ]}
                          numberOfLines={1}
                        >
                          {option.romaji || option.reading}
                        </Text>
                      )}

                      {/* Result icon */}
                      {showCorrect && (
                        <View style={styles.resultIcon}>
                          <Ionicons name="checkmark-circle" size={22} color={colors.white} />
                        </View>
                      )}
                      {showWrong && (
                        <View style={styles.resultIcon}>
                          <Ionicons name="close-circle" size={22} color={colors.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

            {/* Reading hint after answer */}
            {showResult && currentItem.word.reading && currentItem.word.reading !== currentItem.word.japanese && (
              <View style={styles.readingHint}>
                <Ionicons name="volume-high" size={16} color={colors.primary} />
                <Text style={styles.readingText}>{currentItem.word.reading}</Text>
              </View>
            )}

            {/* Skip button */}
            {!showResult && (
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>{t.flashcard.iDontKnow}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Session Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.statText}>{t.flashcard.correct.replace('{count}', String(reviewedCount))}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="layers" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={styles.statText}>{t.flashcard.remaining.replace('{count}', String(totalCards - currentIndex - 1))}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  closeButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    color: colors.white,
    fontSize: typography.sm,
    marginTop: spacing.xs,
    opacity: 0.8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  imageContainer: {
    height: 160,
    backgroundColor: colors.background,
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  questionSection: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  contextText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  promptLabel: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  englishWord: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  optionWrapper: {
    width: '48%',
  },
  optionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 85,
    position: 'relative',
  },
  optionAudio: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    padding: 4,
    zIndex: 10,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  optionCorrect: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  optionWrong: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  optionJapanese: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  optionReading: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  optionTextResult: {
    color: colors.white,
  },
  optionReadingResult: {
    color: 'rgba(255,255,255,0.85)',
  },
  resultIcon: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
  },
  readingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.full,
  },
  readingText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  skipButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    color: colors.white,
    fontSize: typography.sm,
    opacity: 0.8,
  },
});
