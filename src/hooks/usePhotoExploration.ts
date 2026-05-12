import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { PhotoLesson, Word, Sentence, XP_REWARDS } from '../types';
import { useAppStore } from '../store';
import { generateMiniQuiz, suggestQuizVariant } from '../utils/miniQuizGenerator';
import { calculateWordPositions, suggestNextWord } from '../utils/wordPositioning';
import { speakJapanese } from '../utils/speech';

// Debug flag - set to true to see alert popups for debugging (keep false for production)
const DEBUG_QUIZ = false;

type FloatingCardType = 'word-detail' | 'mini-quiz' | 'sentence-quiz' | 'sentence' | 'success' | null;

type SentenceQuizVariant = 'translate' | 'fillBlank' | 'listening';

interface ActiveCard {
  type: FloatingCardType;
  word?: Word;
  sentence?: Sentence;
  quizData?: {
    variant: 'meaning' | 'reverse' | 'reading' | 'audio';
    options: string[];
    correctIndex: number;
  };
  sentenceQuizData?: {
    variant: SentenceQuizVariant;
  };
}

interface ExplorationProgress {
  explored: number;
  quizzed: number;
  total: number;
}

export function usePhotoExploration() {
  const router = useRouter();

  // Local state
  const [activeCard, setActiveCard] = useState<ActiveCard>({ type: null });
  const [exploredWordIds, setExploredWordIds] = useState<Set<string>>(new Set());
  const [quizzedWordIds, setQuizzedWordIds] = useState<Set<string>>(new Set());
  const [correctAnswers, setCorrectAnswers] = useState(0); // Track correct for quiz score
  const [sessionXP, setSessionXP] = useState(0);

  // Refs to access latest state inside setTimeout closures
  const quizzedWordIdsRef = useRef<Set<string>>(new Set());
  const correctAnswersRef = useRef(0);
  const currentLessonRef = useRef<PhotoLesson | null>(null);
  const wordsRef = useRef<Word[]>([]);
  const lastLessonIdRef = useRef<string | null>(null);

  // Store
  const {
    currentLesson,
    setCurrentLesson,
    updateLesson,
    stats,
    addXP,
    updateWord,
    updateStreak,
    unlockSpot,
    memorySpots,
  } = useAppStore();

  // Computed values
  const words = currentLesson?.words || [];
  const sentences = currentLesson?.sentences || [];

  // Initialize state from persisted lesson data when lesson changes
  useEffect(() => {
    if (currentLesson && currentLesson.id !== lastLessonIdRef.current) {
      lastLessonIdRef.current = currentLesson.id;

      // Restore explored words from lesson
      const persistedExplored = currentLesson.exploredWordIds || [];
      setExploredWordIds(new Set(persistedExplored));

      // Restore quizzed words from lesson
      const persistedQuizzed = currentLesson.quizzedWordIds || [];
      setQuizzedWordIds(new Set(persistedQuizzed));
      quizzedWordIdsRef.current = new Set(persistedQuizzed);

      // Reset correct answers for this session (not persisted)
      setCorrectAnswers(0);
      correctAnswersRef.current = 0;
    }
  }, [currentLesson?.id]);

  // Persist explored words when they change
  useEffect(() => {
    if (currentLesson && exploredWordIds.size > 0) {
      const exploredArray = Array.from(exploredWordIds);
      // Only update if different from what's stored
      const currentExplored = currentLesson.exploredWordIds || [];
      if (exploredArray.length !== currentExplored.length ||
          !exploredArray.every(id => currentExplored.includes(id))) {
        updateLesson(currentLesson.id, { exploredWordIds: exploredArray });
      }
    }
  }, [exploredWordIds, currentLesson?.id]);

  // Persist quizzed words when they change
  useEffect(() => {
    if (currentLesson && quizzedWordIds.size > 0) {
      const quizzedArray = Array.from(quizzedWordIds);
      // Only update if different from what's stored
      const currentQuizzed = currentLesson.quizzedWordIds || [];
      if (quizzedArray.length !== currentQuizzed.length ||
          !quizzedArray.every(id => currentQuizzed.includes(id))) {
        updateLesson(currentLesson.id, { quizzedWordIds: quizzedArray });
      }
    }
  }, [quizzedWordIds, currentLesson?.id]);

  // Keep refs in sync with state (for setTimeout access)
  useEffect(() => {
    quizzedWordIdsRef.current = quizzedWordIds;
  }, [quizzedWordIds]);

  useEffect(() => {
    correctAnswersRef.current = correctAnswers;
  }, [correctAnswers]);

  useEffect(() => {
    currentLessonRef.current = currentLesson;
  }, [currentLesson]);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  const wordPositions = useMemo(
    () => calculateWordPositions(words),
    [words]
  );

  const progress: ExplorationProgress = useMemo(() => {
    // Only count words that belong to the current lesson
    const currentWordIds = new Set(words.map(w => w.id));
    const exploredInLesson = Array.from(exploredWordIds).filter(id => currentWordIds.has(id)).length;
    const quizzedInLesson = Array.from(quizzedWordIds).filter(id => currentWordIds.has(id)).length;
    return {
      explored: exploredInLesson,
      quizzed: quizzedInLesson,
      total: words.length,
    };
  }, [exploredWordIds, quizzedWordIds, words]);

  // Get word state for bubble display
  const getWordState = useCallback((word: Word): 'new' | 'explored' | 'quizzed' | 'mastered' => {
    if (word.mastery === 'mastered') return 'mastered';
    if (quizzedWordIds.has(word.id)) return 'quizzed';
    if (exploredWordIds.has(word.id)) return 'explored';
    return 'new';
  }, [exploredWordIds, quizzedWordIds]);

  // Open word detail card
  const openWord = useCallback((word: Word) => {
    setActiveCard({ type: 'word-detail', word });

    // Mark as explored if new
    if (!exploredWordIds.has(word.id) && currentLesson) {
      setExploredWordIds(prev => new Set(prev).add(word.id));

      // Persist immediately (don't rely on effect which may not run before navigation)
      const currentExplored = currentLesson.exploredWordIds || [];
      if (!currentExplored.includes(word.id)) {
        updateLesson(currentLesson.id, { exploredWordIds: [...currentExplored, word.id] });
      }

      // Award XP for exploring
      const xpAmount = XP_REWARDS.learnWord;
      setSessionXP(prev => prev + xpAmount);
      addXP({
        type: 'word',
        amount: xpAmount,
        description: `Explored ${word.japanese}`,
      });
    }
  }, [exploredWordIds, currentLesson, addXP, updateLesson]);

  // Start quiz for a word
  const startMiniQuiz = useCallback((word: Word) => {
    const variant = suggestQuizVariant(word);
    const quizData = generateMiniQuiz(word, words, variant);

    setActiveCard({
      type: 'mini-quiz',
      word,
      quizData: quizData ?? undefined,
    });
  }, [words]);

  // Complete a quiz
  const completeMiniQuiz = useCallback((wordId: string, correct: boolean, fast: boolean) => {
    if (__DEV__) console.log('=== completeMiniQuiz called ===');
    if (__DEV__) console.log('wordId:', wordId, 'correct:', correct, 'fast:', fast);
    if (__DEV__) console.log('wordsRef.current:', wordsRef.current.map(w => w.id));
    if (__DEV__) console.log('quizzedWordIdsRef.current (before):', Array.from(quizzedWordIdsRef.current));

    const lesson = currentLessonRef.current;
    if (!lesson) {
      if (__DEV__) console.log('ERROR: currentLesson is null, returning early');
      return;
    }

    // Mark as quizzed and track correct answers
    setQuizzedWordIds(prev => {
      const updated = new Set(prev).add(wordId);
      quizzedWordIdsRef.current = updated; // Sync ref immediately
      return updated;
    });

    // Persist immediately (don't rely on effect which may not run before navigation)
    const currentQuizzed = lesson.quizzedWordIds || [];
    if (!currentQuizzed.includes(wordId)) {
      updateLesson(lesson.id, { quizzedWordIds: [...currentQuizzed, wordId] });
    }

    if (correct) {
      setCorrectAnswers(prev => {
        const updated = prev + 1;
        correctAnswersRef.current = updated; // Sync ref immediately
        return updated;
      });
    }

    // Calculate XP
    let xpAmount = correct ? XP_REWARDS.quizCorrect : 0;
    if (correct && fast) {
      xpAmount += XP_REWARDS.quizSpeedBonus;
    }

    if (xpAmount > 0) {
      setSessionXP(prev => prev + xpAmount);
      addXP({
        type: 'quiz',
        amount: xpAmount,
        description: correct ? (fast ? 'Quick answer!' : 'Correct!') : '',
      });
    }

    // Update word mastery
    const currentWords = wordsRef.current;
    const word = currentWords.find(w => w.id === wordId);
    if (word) {
      const newScore = Math.min(100, word.masteryScore + (correct ? 15 : -5));
      updateWord(lesson.id, wordId, {
        masteryScore: newScore,
        mastery: getMasteryLevel(newScore),
        timesCorrect: correct ? word.timesCorrect + 1 : word.timesCorrect,
        timesWrong: correct ? word.timesWrong : word.timesWrong + 1,
        lastReviewed: new Date().toISOString().split('T')[0],
      });
    }

    // Close card after delay - access store directly for most current state
    setTimeout(() => {
      // Get FRESH state directly from store and refs
      const storeState = useAppStore.getState();
      const latestLesson = storeState.currentLesson;
      const latestQuizzedIds = quizzedWordIdsRef.current;
      const latestCorrectAnswers = correctAnswersRef.current;

      if (!latestLesson) {
        if (__DEV__) console.log('ERROR: Lesson is null in timeout');
        setActiveCard({ type: null });
        return;
      }

      const latestWords = latestLesson.words || [];

      // Count only quizzed words that are in the current lesson
      const currentWordIds = new Set(latestWords.map(w => w.id));
      const quizzedInThisLesson = Array.from(latestQuizzedIds).filter(id => currentWordIds.has(id));
      const totalQuizzed = quizzedInThisLesson.length;

      if (__DEV__) console.log('=== Quiz setTimeout fired ===');
      if (__DEV__) console.log('latestQuizzedIds:', Array.from(latestQuizzedIds));
      if (__DEV__) console.log('quizzedInThisLesson:', quizzedInThisLesson);
      if (__DEV__) console.log(`Quiz progress: ${totalQuizzed}/${latestWords.length} words quizzed`);

      if (DEBUG_QUIZ) {
        Alert.alert('Quiz Progress', `${totalQuizzed}/${latestWords.length} quizzed\nWord IDs: ${quizzedInThisLesson.join(', ')}`);
      }

      if (totalQuizzed >= latestWords.length && latestWords.length > 0) {
        // Calculate quiz score as percentage
        const quizScore = Math.round((latestCorrectAnswers / latestWords.length) * 100);
        if (__DEV__) console.log(`Quiz complete! Score: ${quizScore}%`);

        // Unlock spot on Memory Path map (if lesson has coordinates)
        if (__DEV__) console.log('Lesson coordinates:', latestLesson.coordinates);

        let spotUnlocked = false;
        const hasCoords = !!(latestLesson.coordinates?.latitude && latestLesson.coordinates?.longitude);

        if (DEBUG_QUIZ) {
          Alert.alert('Unlock Check',
            `Has coords: ${hasCoords}\n` +
            `Lat: ${latestLesson.coordinates?.latitude}\n` +
            `Lng: ${latestLesson.coordinates?.longitude}\n` +
            `Lesson ID: ${latestLesson.id}`
          );
        }

        if (hasCoords) {
          // Check if spot doesn't already exist for this lesson
          const spots = useAppStore.getState().memorySpots;
          const existingSpot = spots.find(s => s.lessonId === latestLesson.id);
          if (__DEV__) console.log('Existing spot:', existingSpot);

          if (!existingSpot) {
            if (__DEV__) console.log('Attempting to unlock spot...');
            const result = useAppStore.getState().unlockSpot(latestLesson, quizScore);
            if (__DEV__) console.log('Unlock result:', result);
            spotUnlocked = !!result;
          } else {
            if (__DEV__) console.log('Spot already exists for this lesson');
            if (DEBUG_QUIZ) {
              Alert.alert('Spot Exists', `Spot already exists for lesson ${latestLesson.id}`);
            }
          }
        } else {
          if (__DEV__) console.log('WARNING: No coordinates on lesson - spot cannot be unlocked');
        }

        // Navigate to Map tab to show animation (if spot was unlocked)
        if (spotUnlocked) {
          if (__DEV__) console.log('Navigating to map tab for animation...');
          if (DEBUG_QUIZ) {
            Alert.alert('Success', 'Spot unlocked! Navigating to map...');
          }
          setActiveCard({ type: null });
          router.push('/review');
        } else {
          // Show success overlay (spot couldn't be unlocked but quiz is complete)
          if (__DEV__) console.log('Spot NOT unlocked - showing success overlay');
          if (DEBUG_QUIZ) {
            Alert.alert('Quiz Complete', `Spot NOT unlocked.\nCoords: ${latestLesson.coordinates?.latitude}, ${latestLesson.coordinates?.longitude}`);
          }
          setActiveCard({ type: 'success' });
        }
      } else {
        // Not all words quizzed yet - just close the card
        setActiveCard({ type: null });
      }
    }, correct ? 800 : 1500);
  }, [addXP, updateWord, router]);

  // Open sentence card
  const openSentence = useCallback((sentence: Sentence, highlightWord?: Word) => {
    setActiveCard({
      type: 'sentence',
      sentence,
      word: highlightWord,
    });
  }, []);

  // Start sentence quiz
  const startSentenceQuiz = useCallback((sentence: Sentence, word: Word) => {
    // Randomly pick a quiz variant
    const variants: SentenceQuizVariant[] = ['translate', 'fillBlank', 'listening'];
    const variant = variants[Math.floor(Math.random() * variants.length)];

    setActiveCard({
      type: 'sentence-quiz',
      sentence,
      word,
      sentenceQuizData: { variant },
    });
  }, []);

  // Complete sentence quiz
  const completeSentenceQuiz = useCallback((correct: boolean) => {
    // Award XP for sentence quiz
    const xpAmount = correct ? XP_REWARDS.quizCorrect : 0;

    if (xpAmount > 0) {
      setSessionXP(prev => prev + xpAmount);
      addXP({
        type: 'quiz',
        amount: xpAmount,
        description: 'Sentence quiz!',
      });
    }

    // Close card after delay
    setTimeout(() => {
      setActiveCard({ type: null });
    }, correct ? 1000 : 1800);
  }, [addXP]);

  // Close any card
  const closeCard = useCallback(() => {
    setActiveCard({ type: null });
  }, []);

  // Speak a word (use hiragana reading for accurate pronunciation)
  const speakWord = useCallback(async (word: Word) => {
    await speakJapanese(word.reading || word.japanese);
  }, []);

  // Reset exploration state for a new lesson (keeps currentLesson)
  const resetExplorationState = useCallback(() => {
    setActiveCard({ type: null });
    setExploredWordIds(new Set());
    setQuizzedWordIds(new Set());
    setCorrectAnswers(0);
    setSessionXP(0);
    // Also reset refs
    quizzedWordIdsRef.current = new Set();
    correctAnswersRef.current = 0;
  }, []);

  // Return to camera (full reset including clearing lesson)
  const resetExploration = useCallback(() => {
    setCurrentLesson(null);
    resetExplorationState();
    updateStreak();
  }, [setCurrentLesson, updateStreak, resetExplorationState]);

  // Suggest next word to explore
  const getNextSuggestion = useCallback((): Word | null => {
    return suggestNextWord(words, exploredWordIds, quizzedWordIds);
  }, [words, exploredWordIds, quizzedWordIds]);

  // Check if should show celebration (only count words in current lesson)
  const shouldShowCelebration = useCallback((): boolean => {
    if (words.length === 0) return false;
    const currentWordIds = new Set(words.map(w => w.id));
    const quizzedInLesson = Array.from(quizzedWordIds).filter(id => currentWordIds.has(id)).length;
    return quizzedInLesson >= words.length;
  }, [words, quizzedWordIds]);

  // Trigger celebration manually
  const showCelebration = useCallback(() => {
    setActiveCard({ type: 'success' });
  }, []);

  return {
    // State
    lesson: currentLesson,
    words,
    sentences,
    wordPositions,
    activeCard,
    progress,
    sessionXP,
    streak: stats.streak,

    // Word state
    getWordState,

    // Actions
    openWord,
    closeCard,
    startMiniQuiz,
    completeMiniQuiz,
    startSentenceQuiz,
    completeSentenceQuiz,
    openSentence,
    speakWord,
    resetExploration,
    resetExplorationState,

    // Suggestions
    getNextSuggestion,
    shouldShowCelebration,
    showCelebration,
  };
}

function getMasteryLevel(score: number): 'new' | 'learning' | 'familiar' | 'mastered' {
  if (score >= 90) return 'mastered';
  if (score >= 60) return 'familiar';
  if (score >= 30) return 'learning';
  return 'new';
}
