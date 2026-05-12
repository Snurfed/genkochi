import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sentence, Word } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { speakJapanese } from '../../utils/speech';
import { useTranslations } from '../../hooks/useTranslations';
import FloatingCard from './FloatingCard';

type SentenceQuizVariant =
  | 'translate'      // What does this sentence mean?
  | 'fillBlank'      // Fill in the missing word
  | 'listening'      // Listen and pick the translation
  | 'wordRole';      // What role does this word play?

interface SentenceQuizCardProps {
  sentence: Sentence;
  targetWord: Word;
  allWords: Word[];
  variant: SentenceQuizVariant;
  onComplete: (correct: boolean) => void;
  onClose: () => void;
}

// Generate wrong translation options
function generateWrongTranslations(correct: string, allWords: Word[]): string[] {
  const wrongOptions: string[] = [];
  const templates = [
    'The {word} is on the table.',
    'I can see the {word} over there.',
    'This is a beautiful {word}.',
    'Where is the {word}?',
  ];

  // Use other words to create plausible wrong answers
  const otherWords = allWords.filter(w => !correct.toLowerCase().includes(w.english.toLowerCase()));

  for (let i = 0; i < 3 && i < otherWords.length; i++) {
    const template = templates[i % templates.length];
    wrongOptions.push(template.replace('{word}', otherWords[i].english));
  }

  // Fill remaining with generic wrong answers
  while (wrongOptions.length < 3) {
    wrongOptions.push(`I don't understand this sentence.`);
  }

  return wrongOptions.slice(0, 3);
}

// Generate fill-in-blank quiz data
function generateFillBlankData(sentence: Sentence, targetWord: Word) {
  const blank = '______';
  const sentenceWithBlank = sentence.japanese.replace(targetWord.japanese, blank);

  return {
    sentenceWithBlank,
    correctAnswer: targetWord.japanese,
  };
}

/**
 * SentenceQuizCard - More challenging sentence-level quizzes
 */
export function SentenceQuizCard({
  sentence,
  targetWord,
  allWords,
  variant,
  onComplete,
  onClose,
}: SentenceQuizCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const startTime = useRef(Date.now());
  const feedbackScale = useRef(new Animated.Value(0)).current;
  const t = useTranslations();

  // Generate quiz data based on variant
  const quizData = React.useMemo(() => {
    switch (variant) {
      case 'translate':
      case 'listening': {
        const correctAnswer = sentence.translation;
        const wrongAnswers = generateWrongTranslations(correctAnswer, allWords);
        const allOptions = [correctAnswer, ...wrongAnswers];
        // Shuffle
        const shuffled = allOptions.sort(() => Math.random() - 0.5);
        return {
          options: shuffled,
          correctIndex: shuffled.indexOf(correctAnswer),
        };
      }
      case 'fillBlank': {
        const { sentenceWithBlank, correctAnswer } = generateFillBlankData(sentence, targetWord);
        // Get wrong word options from other words
        const wrongWords = allWords
          .filter(w => w.id !== targetWord.id)
          .slice(0, 3)
          .map(w => w.japanese);
        const allOptions = [correctAnswer, ...wrongWords];
        const shuffled = allOptions.sort(() => Math.random() - 0.5);
        return {
          sentenceWithBlank,
          options: shuffled,
          correctIndex: shuffled.indexOf(correctAnswer),
        };
      }
      case 'wordRole': {
        const roles = ['Subject', 'Object', 'Verb', 'Adjective', 'Location', 'Time'];
        // Simple heuristic based on part of speech
        let correctRole = 'Subject';
        if (targetWord.partOfSpeech?.includes('verb')) correctRole = 'Verb';
        else if (targetWord.partOfSpeech?.includes('adjective')) correctRole = 'Adjective';
        else if (targetWord.partOfSpeech?.includes('noun')) correctRole = 'Subject';

        const otherRoles = roles.filter(r => r !== correctRole).slice(0, 3);
        const allOptions = [correctRole, ...otherRoles];
        const shuffled = allOptions.sort(() => Math.random() - 0.5);
        return {
          options: shuffled,
          correctIndex: shuffled.indexOf(correctRole),
        };
      }
      default:
        return { options: [], correctIndex: 0 };
    }
  }, [sentence, targetWord, allWords, variant]);

  // Play audio for listening variant
  useEffect(() => {
    if (variant === 'listening') {
      setTimeout(() => speakJapanese(sentence.reading || sentence.japanese), 500);
    }
  }, [variant, sentence.japanese]);

  const handleSelect = (index: number) => {
    if (selectedIndex !== null) return;

    const isCorrect = index === quizData.correctIndex;

    setSelectedIndex(index);
    setShowResult(true);

    Animated.spring(feedbackScale, {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      onComplete(isCorrect);
    }, isCorrect ? 1000 : 1800);
  };

  const getQuestionContent = () => {
    switch (variant) {
      case 'translate':
        return (
          <>
            <Text style={styles.questionLabel}>What does this sentence mean?</Text>
            <View style={styles.sentenceBox}>
              <Text style={styles.sentenceJapanese}>{sentence.japanese}</Text>
              <Text style={styles.sentenceReading}>{sentence.reading}</Text>
            </View>
            <TouchableOpacity
              style={styles.listenBtn}
              onPress={() => speakJapanese(sentence.reading || sentence.japanese)}
            >
              <Ionicons name="volume-high" size={18} color={colors.primary} />
              <Text style={styles.listenBtnText}>Listen</Text>
            </TouchableOpacity>
          </>
        );

      case 'listening':
        return (
          <>
            <Text style={styles.questionLabel}>Listen and choose the correct translation</Text>
            <TouchableOpacity
              style={styles.bigListenBtn}
              onPress={() => speakJapanese(sentence.reading || sentence.japanese)}
            >
              <Ionicons name="volume-high" size={32} color={colors.primary} />
              <Text style={styles.bigListenText}>Tap to listen again</Text>
            </TouchableOpacity>
          </>
        );

      case 'fillBlank':
        return (
          <>
            <Text style={styles.questionLabel}>Fill in the blank</Text>
            <View style={styles.sentenceBox}>
              <Text style={styles.sentenceJapanese}>{quizData.sentenceWithBlank}</Text>
            </View>
            <Text style={styles.hintText}>Choose the word that completes the sentence</Text>
          </>
        );

      case 'wordRole':
        return (
          <>
            <Text style={styles.questionLabel}>What role does this word play?</Text>
            <View style={styles.sentenceBox}>
              <Text style={styles.sentenceJapanese}>
                {sentence.japanese.split(targetWord.japanese).map((part, i, arr) => (
                  <Text key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <Text style={styles.highlightWord}>{targetWord.japanese}</Text>
                    )}
                  </Text>
                ))}
              </Text>
            </View>
            <View style={styles.targetWordBox}>
              <Text style={styles.targetWordJapanese}>{targetWord.japanese}</Text>
              <Text style={styles.targetWordEnglish}>{targetWord.english}</Text>
            </View>
          </>
        );

      default:
        return null;
    }
  };

  const getOptionStyle = (index: number) => {
    if (selectedIndex === null) return styles.option;
    if (index === quizData.correctIndex) return [styles.option, styles.optionCorrect];
    if (index === selectedIndex) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDimmed];
  };

  const isCorrect = selectedIndex === quizData.correctIndex;

  return (
    <FloatingCard onClose={onClose} showCloseButton={!showResult}>
      {/* Question */}
      <View style={styles.questionSection}>
        {getQuestionContent()}
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {quizData.options.map((option, index) => (
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
                variant === 'fillBlank' && styles.optionTextJapanese,
                selectedIndex !== null && index === quizData.correctIndex && styles.optionTextCorrect,
                selectedIndex !== null && index === selectedIndex && index !== quizData.correctIndex && styles.optionTextWrong,
              ]}
              numberOfLines={variant === 'fillBlank' ? 1 : 3}
            >
              {option}
            </Text>

            {selectedIndex !== null && index === quizData.correctIndex && (
              <Ionicons name="checkmark-circle" size={22} color={colors.mint} />
            )}
            {selectedIndex !== null && index === selectedIndex && index !== quizData.correctIndex && (
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
          <View style={[styles.feedbackBadge, isCorrect ? styles.feedbackCorrect : styles.feedbackWrong]}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={colors.white}
            />
            <Text style={styles.feedbackText}>
              {isCorrect ? t.study.correct : t.study.notQuite}
            </Text>
          </View>

          {!isCorrect && (
            <Text style={styles.correctAnswerText}>
              {t.study.theAnswerIs} {quizData.options[quizData.correctIndex]}
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
    marginBottom: spacing.lg,
  },
  questionLabel: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sentenceBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  sentenceJapanese: {
    fontSize: typography.xl,
    fontWeight: typography.bold as any,
    color: colors.navy,
    textAlign: 'center',
  },
  sentenceReading: {
    fontSize: typography.sm,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  highlightWord: {
    color: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
  },
  listenBtnText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium as any,
  },
  bigListenBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    marginVertical: spacing.md,
  },
  bigListenText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  hintText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  targetWordBox: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  targetWordJapanese: {
    fontSize: typography.xxl,
    fontWeight: typography.bold as any,
    color: colors.primary,
  },
  targetWordEnglish: {
    fontSize: typography.sm,
    color: colors.textSecondary,
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
    minHeight: 56,
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
    opacity: 0.5,
  },
  optionText: {
    fontSize: typography.base,
    color: colors.navy,
    fontWeight: typography.medium as any,
    flex: 1,
    paddingRight: spacing.sm,
  },
  optionTextJapanese: {
    fontSize: typography.xl,
  },
  optionTextCorrect: {
    color: colors.mint,
    fontWeight: typography.bold as any,
  },
  optionTextWrong: {
    color: colors.error,
  },
  feedbackContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  feedbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
  },
  feedbackCorrect: {
    backgroundColor: colors.mint,
  },
  feedbackWrong: {
    backgroundColor: colors.error,
  },
  feedbackText: {
    fontSize: typography.lg,
    fontWeight: typography.bold as any,
    color: colors.white,
  },
  correctAnswerText: {
    marginTop: spacing.sm,
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});

export default SentenceQuizCard;
