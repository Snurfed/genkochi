import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../src/store';
import { colors, spacing, borderRadius, typography, shadows } from '../src/constants/design';
import { HIRAGANA_CHART, KATAKANA_CHART, XP_REWARDS } from '../src/types';
import { generateKanaDrill } from '../src/utils/readingQuiz';
import { speakJapanese, loadJapaneseVoice } from '../src/utils/speech';

type KanaMode = 'hiragana' | 'katakana' | 'both';
type PracticeMode = 'learn' | 'quiz' | 'results';

export default function KanaPracticeScreen() {
  const router = useRouter();
  const { stats, addXP } = useAppStore();

  const [kanaMode, setKanaMode] = useState<KanaMode>('hiragana');
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('learn');
  const [selectedKana, setSelectedKana] = useState<string | null>(null);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizResults, setQuizResults] = useState<boolean[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const currentChart = kanaMode === 'hiragana' ? HIRAGANA_CHART :
                       kanaMode === 'katakana' ? KATAKANA_CHART :
                       [...HIRAGANA_CHART, ...KATAKANA_CHART];

  const knownKana = kanaMode === 'hiragana' ? (stats.reading?.hiraganaKnown || []) :
                    kanaMode === 'katakana' ? (stats.reading?.katakanaKnown || []) :
                    [...(stats.reading?.hiraganaKnown || []), ...(stats.reading?.katakanaKnown || [])];

  // Load voice on mount
  useEffect(() => {
    loadJapaneseVoice();
  }, []);

  const handleKanaPress = async (kana: string, romaji: string) => {
    setSelectedKana(kana);
    await speakJapanese(romaji);
  };

  const startQuiz = () => {
    const questions = generateKanaDrill(kanaMode, knownKana, 10);
    setQuizQuestions(questions);
    setQuizIndex(0);
    setQuizResults([]);
    setSelectedAnswer(null);
    setShowResult(false);
    setPracticeMode('quiz');
  };

  const handleQuizAnswer = useCallback((index: number) => {
    if (showResult || selectedAnswer !== null) return;

    const currentQuestion = quizQuestions[quizIndex];
    const isCorrect = index === currentQuestion.correctIndex;

    setSelectedAnswer(index);
    setShowResult(true);

    if (isCorrect) {
      addXP({ type: 'reading', amount: XP_REWARDS.kanaLearned, description: 'Kana correct!' });
    }

    // Animate
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.02, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    // Auto-advance
    setTimeout(() => {
      setQuizResults(prev => [...prev, isCorrect]);
      if (quizIndex + 1 < quizQuestions.length) {
        setQuizIndex(quizIndex + 1);
        setSelectedAnswer(null);
        setShowResult(false);
      } else {
        setPracticeMode('results');
      }
    }, 1000);
  }, [showResult, selectedAnswer, quizQuestions, quizIndex, scaleAnim, addXP]);

  // Render quiz mode
  if (practiceMode === 'quiz' && quizQuestions.length > 0) {
    const currentQuestion = quizQuestions[quizIndex];

    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setPracticeMode('learn')} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${(quizIndex / quizQuestions.length) * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{quizIndex + 1} / {quizQuestions.length}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.quizContent}>
          {/* Question */}
          <Text style={styles.quizLabel}>What sound does this make?</Text>

          <Animated.View style={[styles.kanaCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.kanaLarge}>{currentQuestion.word.japanese}</Text>
          </Animated.View>

          {/* Options */}
          <View style={styles.optionsGrid}>
            {currentQuestion.options.map((option: string, idx: number) => {
              const isSelected = selectedAnswer === idx;
              const isCorrect = idx === currentQuestion.correctIndex;
              const showCorrectStyle = showResult && isCorrect;
              const showWrongStyle = showResult && isSelected && !isCorrect;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.optionButton,
                    showCorrectStyle && styles.optionButtonCorrect,
                    showWrongStyle && styles.optionButtonWrong,
                  ]}
                  onPress={() => handleQuizAnswer(idx)}
                  disabled={showResult}
                >
                  <Text style={[
                    styles.optionText,
                    showCorrectStyle && styles.optionTextCorrect,
                    showWrongStyle && styles.optionTextWrong,
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render results mode
  if (practiceMode === 'results') {
    const correctCount = quizResults.filter(Boolean).length;
    const percentage = Math.round((correctCount / quizResults.length) * 100);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsEmoji}>
            {percentage >= 80 ? '🎉' : percentage >= 60 ? '👏' : '💪'}
          </Text>
          <Text style={styles.resultsTitle}>
            {percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good job!' : 'Keep practicing!'}
          </Text>
          <Text style={styles.resultsScore}>{correctCount} / {quizResults.length}</Text>
          <Text style={styles.resultsSubtitle}>{percentage}% correct</Text>

          <View style={styles.resultsButtons}>
            <TouchableOpacity style={styles.primaryButton} onPress={startQuiz}>
              <Ionicons name="refresh" size={20} color={colors.white} />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setPracticeMode('learn')}
            >
              <Text style={styles.secondaryButtonText}>Back to Chart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Render learn mode (kana chart)
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.learnHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.learnTitle}>Kana Practice</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, kanaMode === 'hiragana' && styles.modeButtonActive]}
          onPress={() => setKanaMode('hiragana')}
        >
          <Text style={[styles.modeButtonText, kanaMode === 'hiragana' && styles.modeButtonTextActive]}>
            あ Hiragana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, kanaMode === 'katakana' && styles.modeButtonActive]}
          onPress={() => setKanaMode('katakana')}
        >
          <Text style={[styles.modeButtonText, kanaMode === 'katakana' && styles.modeButtonTextActive]}>
            ア Katakana
          </Text>
        </TouchableOpacity>
      </View>

      {/* Kana chart */}
      <ScrollView contentContainerStyle={styles.chartContainer}>
        <View style={styles.chart}>
          {currentChart.map((item, idx) => {
            const isKnown = knownKana.includes(item.kana);
            const isSelected = selectedKana === item.kana;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.kanaCell,
                  isKnown && styles.kanaCellKnown,
                  isSelected && styles.kanaCellSelected,
                ]}
                onPress={() => handleKanaPress(item.kana, item.romaji)}
              >
                <Text style={[styles.kanaCellText, isSelected && styles.kanaCellTextSelected]}>
                  {item.kana}
                </Text>
                <Text style={[styles.kanaCellRomaji, isSelected && styles.kanaCellRomajiSelected]}>
                  {item.romaji}
                </Text>
                {isKnown && (
                  <View style={styles.knownBadge}>
                    <Ionicons name="checkmark" size={10} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            {knownKana.length} / {currentChart.length} learned
          </Text>
          <View style={styles.progressBarLarge}>
            <View
              style={[
                styles.progressFillLarge,
                { width: `${(knownKana.length / currentChart.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Quiz button */}
        <TouchableOpacity style={styles.quizButton} onPress={startQuiz}>
          <Ionicons name="school" size={24} color={colors.white} />
          <Text style={styles.quizButtonText}>Start Quiz</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },

  // Learn mode
  learnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  learnTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  backButton: {
    padding: spacing.sm,
  },
  modeSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.navyLight,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    color: colors.textMuted,
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  chartContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  chart: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  kanaCell: {
    width: 60,
    height: 70,
    backgroundColor: colors.navyLight,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  kanaCellKnown: {
    borderWidth: 2,
    borderColor: colors.mint,
  },
  kanaCellSelected: {
    backgroundColor: colors.primary,
  },
  kanaCellText: {
    fontSize: typography.xxl,
    color: colors.white,
    fontWeight: typography.bold,
  },
  kanaCellTextSelected: {
    color: colors.white,
  },
  kanaCellRomaji: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  kanaCellRomajiSelected: {
    color: colors.white,
  },
  knownBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  progressBarLarge: {
    height: 12,
    backgroundColor: colors.navyLight,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFillLarge: {
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: borderRadius.full,
  },
  quizButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
    ...shadows.lg,
  },
  quizButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },

  // Quiz mode
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.navyLight,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  quizContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizLabel: {
    fontSize: typography.lg,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  kanaCard: {
    width: 150,
    height: 150,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadows.lg,
  },
  kanaLarge: {
    fontSize: 80,
    color: colors.navy,
    fontWeight: typography.bold,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
  },
  optionButton: {
    width: '45%',
    backgroundColor: colors.navyLight,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonCorrect: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderColor: colors.mint,
  },
  optionButtonWrong: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: colors.error,
  },
  optionText: {
    fontSize: typography.xl,
    color: colors.white,
    fontWeight: typography.bold,
  },
  optionTextCorrect: {
    color: colors.mint,
  },
  optionTextWrong: {
    color: colors.primary,
  },

  // Results mode
  resultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  resultsEmoji: {
    fontSize: 60,
    marginBottom: spacing.md,
  },
  resultsTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.white,
  },
  resultsScore: {
    fontSize: 48,
    fontWeight: typography.bold,
    color: colors.mint,
    marginTop: spacing.md,
  },
  resultsSubtitle: {
    fontSize: typography.base,
    color: colors.textMuted,
  },
  resultsButtons: {
    marginTop: spacing.xl,
    gap: spacing.md,
    width: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: typography.base,
  },
});
