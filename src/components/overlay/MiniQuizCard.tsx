import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Word } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { speakText } from '../../utils/speech';
import { useTranslations } from '../../hooks/useTranslations';
import { useAppStore } from '../../store';
import FloatingCard from './FloatingCard';

type QuizVariant = 'meaning' | 'reverse' | 'reading' | 'audio';

interface MiniQuizCardProps {
  word: Word;
  variant: QuizVariant;
  options: string[];
  correctIndex: number;
  onComplete: (correct: boolean, fast: boolean) => void;
  onClose: () => void;
}

/**
 * MiniQuizCard - Compact quiz overlay on the photo
 * Single question, animated feedback, auto-advance
 */
export function MiniQuizCard({
  word,
  variant,
  options,
  correctIndex,
  onComplete,
  onClose,
}: MiniQuizCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showRomaji, setShowRomaji] = useState(false);
  const startTime = useRef(Date.now());
  const feedbackScale = useRef(new Animated.Value(0)).current;
  const checkmarkBounce = useRef(new Animated.Value(0)).current;
  const xpFloat = useRef(new Animated.Value(0)).current;
  const t = useTranslations();
  const { targetLanguage } = useAppStore();

  // Helper function to speak in target language
  const speak = (text: string) => {
    speakText(text, { languageCode: targetLanguage.speechCode });
  };

  // Play audio for audio variant
  useEffect(() => {
    if (variant === 'audio') {
      speak(word.reading || word.japanese);
    }
  }, [variant, word.japanese]);

  const handleSelect = (index: number) => {
    if (selectedIndex !== null) return; // Already answered

    const timeTaken = Date.now() - startTime.current;
    const isFast = timeTaken < 2500; // Under 2.5 seconds
    const isCorrect = index === correctIndex;

    setSelectedIndex(index);
    setShowResult(true);

    // Animate feedback
    Animated.spring(feedbackScale, {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();

    if (isCorrect) {
      // Checkmark bounce animation
      checkmarkBounce.setValue(0);
      Animated.spring(checkmarkBounce, {
        toValue: 1,
        tension: 200,
        friction: 6,
        useNativeDriver: true,
      }).start();

      // XP float up animation
      xpFloat.setValue(0);
      Animated.timing(xpFloat, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }

    // Speak the correct pronunciation
    setTimeout(() => speak(word.reading || word.japanese), 200);

    // Auto-advance after showing result
    setTimeout(() => {
      onComplete(isCorrect, isFast);
    }, isCorrect ? 1200 : 2000);
  };

  const getQuestionText = () => {
    const targetWord = word.japanese || word.romaji || '';
    const wordMeaning = word.nativeTranslation || word.english || '';
    switch (variant) {
      case 'meaning':
        return t.study.whatDoesThisMean.replace('{word}', targetWord);
      case 'reverse':
        return t.study.howDoYouSay.replace('{word}', wordMeaning).replace('{language}', '');
      case 'reading':
        return t.study.howDoYouRead.replace('{word}', targetWord);
      case 'audio':
        return t.study.whatWordDidYouHear;
      default:
        return '';
    }
  };

  const getOptionStyle = (index: number) => {
    if (selectedIndex === null) return styles.option;
    if (index === correctIndex) return [styles.option, styles.optionCorrect];
    if (index === selectedIndex) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDimmed];
  };

  const isCorrect = selectedIndex === correctIndex;

  return (
    <FloatingCard onClose={onClose} showCloseButton={!showResult}>
      {/* Question */}
      <View style={styles.questionSection}>
        {/* Audio replay button for audio variant */}
        {variant === 'audio' && (
          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => speak(word.reading || word.japanese)}
          >
            <Ionicons name="volume-high" size={32} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Show word for meaning/reading variants */}
        {(variant === 'meaning' || variant === 'reading') && (
          <View style={styles.wordContainer}>
            <Text style={styles.questionWord}>{word.japanese}</Text>
            {/* Romaji - hidden by default */}
            {word.romaji && (
              <TouchableOpacity onPress={() => setShowRomaji(!showRomaji)}>
                <Text style={[styles.romaji, !showRomaji && styles.romajiHidden]}>
                  {showRomaji ? word.romaji : 'Tap for hint'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.questionText}>{getQuestionText()}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={getOptionStyle(index)}
            onPress={() => handleSelect(index)}
            disabled={selectedIndex !== null}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionText,
                (variant === 'reverse' || variant === 'reading') && styles.optionTextLarge,
                selectedIndex !== null && index === correctIndex && styles.optionTextCorrect,
                selectedIndex !== null && index === selectedIndex && index !== correctIndex && styles.optionTextWrong,
              ]}
            >
              {option}
            </Text>

            {/* Animated checkmark for correct answer */}
            {selectedIndex !== null && index === correctIndex && (
              <Animated.View style={{ transform: [{ scale: checkmarkBounce }] }}>
                <Ionicons name="checkmark-circle" size={22} color={colors.mint} />
              </Animated.View>
            )}
            {selectedIndex !== null && index === selectedIndex && index !== correctIndex && (
              <Ionicons name="close-circle" size={22} color={colors.error} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Result feedback */}
      {showResult && (
        <Animated.View
          style={[
            styles.feedbackContainer,
            { transform: [{ scale: feedbackScale }] },
          ]}
        >
          {/* XP float animation for correct answers */}
          {isCorrect && (
            <Animated.Text
              style={[
                styles.xpFloat,
                {
                  opacity: xpFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, 0] }),
                  transform: [{ translateY: xpFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) }],
                },
              ]}
            >
              +10 XP
            </Animated.Text>
          )}

          {/* Correct answer with pronunciation */}
          <View style={styles.answerBox}>
            <TouchableOpacity
              style={styles.answerPlayBtn}
              onPress={() => speak(word.reading || word.japanese)}
            >
              <Ionicons name="volume-medium" size={18} color={colors.primary} />
            </TouchableOpacity>
            <View>
              <Text style={styles.answerWord}>{word.japanese}</Text>
              <Text style={styles.answerMeaning}>{word.english}</Text>
              {word.reading && word.reading !== word.japanese && (
                <Text style={styles.answerReading}>{word.reading}</Text>
              )}
            </View>
          </View>

          {/* Wrong answer explanation */}
          {!isCorrect && (
            <Text style={styles.wrongHint}>
              Listen to the pronunciation above
            </Text>
          )}
        </Animated.View>
      )}
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  questionSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  questionText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  wordContainer: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  questionWord: {
    fontSize: 36,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  romaji: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  romajiHidden: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  audioButton: {
    width: 60,
    height: 60,
    backgroundColor: colors.background,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCorrect: {
    borderColor: colors.mint,
    backgroundColor: `${colors.mint}15`,
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}15`,
  },
  optionDimmed: {
    opacity: 0.4,
  },
  optionText: {
    fontSize: typography.base,
    color: colors.navy,
    fontWeight: typography.medium,
    flex: 1,
  },
  optionTextLarge: {
    fontSize: typography.xl,
  },
  optionTextCorrect: {
    color: colors.mint,
    fontWeight: typography.bold,
  },
  optionTextWrong: {
    color: colors.error,
  },
  feedbackContainer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  xpFloat: {
    position: 'absolute',
    top: -15,
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.xp,
  },
  answerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  answerPlayBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.white,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerWord: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  answerMeaning: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  answerReading: {
    fontSize: typography.sm,
    color: colors.primary,
  },
  wrongHint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});

export default MiniQuizCard;
