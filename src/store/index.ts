import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PhotoLesson,
  Word,
  UserStats,
  QuizQuestion,
  QuizType,
  XPEvent,
  LEVELS,
  XP_REWARDS,
  MasteryLevel,
  ReadingLevel,
  Sentence,
  SentenceMastery,
  UserSkills,
  DailyChallenge,
  PracticeSession,
  createDefaultUserSkills,
  createDefaultSentenceMastery,
  SavedTranslation,
  TranslationFolder,
  DEFAULT_TRANSLATION_FOLDERS,
  LearningGoal,
  // Memory Worlds
  MemoryWorld,
  WorldObject,
  WorldType,
  ObjectCategory,
  PlacementPosition,
  createDefaultWorld,
  getObjectVisual,
  PLACEMENT_RULES,
  WORLD_THEMES,
  MAX_OBJECTS_PER_WORLD,
  PLANET_NAMES,
  // Memory Path
  MemorySpot,
  MemoryPath,
  MemoryPathStats,
  LostMemory,
  // Landmark Quests
  LandmarkQuest,
  // Memory Palace
  MemoryStatus,
  getMemoryStatus,
  MEMORY_DECAY,
  REVIEW_STREAK_BONUSES,
  // Achievements
  ACHIEVEMENTS,
  getUnlockedAchievements,
} from '../types';
import { Language, DEFAULT_LANGUAGE, DEFAULT_NATIVE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, getLanguageByCode } from '../constants/languages';
import { generateReadingQuiz } from '../utils/readingQuiz';
import {
  SRSData,
  processReview,
  getQualityFromAnswer,
  getMemoryStrength as getSRSMemoryStrength,
  getMemoryStatusFromSRS,
  createInitialSRS,
  migrateToSRS,
  isDueForReview,
  getHoursUntilReview,
  ReviewQuality,
} from '../utils/srs';

interface AppState {
  // Onboarding & Personalization
  hasCompletedOnboarding: boolean;
  learningGoal: LearningGoal | null;
  nativeLanguage: Language;  // User's native language (for translations/UI)
  targetLanguage: Language;  // Language being learned

  // Settings
  notificationsEnabled: boolean;
  soundEnabled: boolean;

  // Current session
  currentLesson: PhotoLesson | null;
  lessonSelectedForReview: boolean; // Flag to prevent clearing lesson when navigating from Worlds
  currentQuiz: QuizQuestion[];
  quizIndex: number;
  quizResults: boolean[];
  pendingXP: XPEvent[];

  // Persisted data
  lessons: PhotoLesson[];
  stats: UserStats;
  unlockedMilestones: string[];

  // New: Skills and tracking
  userSkills: UserSkills;
  dailyChallenges: DailyChallenge[];
  currentPracticeSession: PracticeSession | null;
  sentenceMasteryMap: Record<string, SentenceMastery>;

  // Translation
  savedTranslations: SavedTranslation[];
  translationFolders: TranslationFolder[];
  translationCache: Record<string, { result: string; reading?: string; romaji?: string }>;

  // Memory Worlds
  worlds: MemoryWorld[];
  activeWorldId: string | null;
  selectedObjectId: string | null;

  // Memory Path (Gamified Map)
  memorySpots: MemorySpot[];
  memoryPaths: MemoryPath[];
  totalMileage: number;
  totalSteps: number;
  lastSpotId: string | null; // For drawing path to new spot
  // Pending animation data for map (set when spot is unlocked, cleared after animation)
  pendingMapAnimation: {
    spot: MemorySpot;
    path: MemoryPath | null;
    stepsEarned: number;
  } | null;

  // Lost Memories (graveyard for forgotten words)
  lostMemories: LostMemory[];
  rescueCombo: number; // Current streak of rescued memories in a session

  // Landmark Quests
  activeQuests: LandmarkQuest[];
  completedQuestIds: string[];
  questsLastRefreshed: number;
  activeQuestBonus: { questId: string; xpBonus: number } | null;

  // Achievement tracking
  unlockedAchievementIds: string[];
  pendingAchievementUnlock: { id: string; title: string; xpReward: number } | null;

  // Loading states
  isAnalyzing: boolean;

  // Onboarding actions
  setLearningGoal: (goal: LearningGoal) => void;
  completeOnboarding: () => void;
  setNativeLanguage: (language: Language) => void;
  setTargetLanguage: (language: Language) => void;

  // Settings actions
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;

  // Actions
  setCurrentLesson: (lesson: PhotoLesson | null) => void;
  selectLessonForReview: (lesson: PhotoLesson) => void; // Set lesson + flag for navigation from Worlds
  clearLessonSelection: () => void; // Clear lesson and flag
  consumeLessonSelection: () => void; // Clear flag only (lesson was consumed)
  addLesson: (lesson: PhotoLesson) => void;
  updateLesson: (id: string, updates: Partial<PhotoLesson>) => void;
  deleteLesson: (id: string) => void;
  updateWord: (lessonId: string, wordId: string, updates: Partial<Word>) => void;

  // Quiz actions
  startQuiz: (words: Word[], photoUri?: string) => void;
  startReviewQuiz: () => void;
  answerQuestion: (correct: boolean, fast?: boolean) => void;
  resetQuiz: () => void;

  // XP actions
  addXP: (event: XPEvent) => void;
  clearPendingXP: () => void;

  // Stats actions
  updateStreak: () => void;
  checkDailyGoal: () => void;

  setIsAnalyzing: (value: boolean) => void;

  // Review
  getWordsToReview: () => { word: Word; photoUri: string; lessonId: string }[];
  getReviewCount: () => number;
  markWordReviewed: (lessonId: string, wordId: string, correct: boolean) => void;
  getLessonsNeedingReview: () => PhotoLesson[];
  markLessonReviewed: (id: string) => void;

  // Memory Palace
  calculateMemoryDecay: () => void;  // Call on app open to decay memories
  reviewMemory: (lessonId: string) => void;  // Boost memory strength after review
  reviewWordSRS: (lessonId: string, wordId: string, isCorrect: boolean, responseTimeMs?: number) => void;  // SRS-based word review
  getFadingMemories: () => PhotoLesson[];  // Get lessons needing attention
  getMemoryStats: () => { fresh: number; strong: number; fading: number; weak: number; due: number };

  // Lost memories & rescue
  checkForForgottenMemories: () => void;  // Check and penalize fully forgotten memories
  getLostMemories: () => LostMemory[];  // Get the graveyard
  recoverMemory: (lostMemoryId: string) => boolean;  // Recover a lost memory (costs XP)
  resetRescueCombo: () => void;  // Reset combo when session ends
  getTimeUntilForgotten: (lessonId: string) => number | null;  // Hours until memory is lost

  // Debug (dev only)
  debugSimulateFading: () => void;  // Make all words due for review (for testing)

  // Achievements
  checkAchievements: () => void;  // Check for new achievement unlocks
  clearPendingAchievement: () => void;  // Clear the pending achievement notification

  // Reading Review
  getReadingWordsToReview: () => { word: Word; photoUri: string; lessonId: string }[];
  getReadingReviewCount: () => number;
  startReadingReviewQuiz: (readingLevel?: ReadingLevel) => void;
  markReadingReviewed: (lessonId: string, wordId: string, correct: boolean) => void;
  updateKanaProgress: (kana: string, correct: boolean, isHiragana: boolean) => void;

  // Sentence tracking actions
  updateSentenceMastery: (sentenceId: string, updates: Partial<SentenceMastery>) => void;
  recordSpeakingAttempt: (itemId: string, itemType: 'word' | 'sentence', score: number, passed: boolean) => void;
  updateSkill: (skill: 'reading' | 'speaking' | 'listening' | 'grammar', correct: boolean, xpEarned: number) => void;
  getSentencesToReview: () => Sentence[];
  getSentenceReviewCount: () => number;
  startSentencePractice: (sentences: Sentence[]) => void;
  completePracticeSession: (score: number, skillsImproved: { skill: string; delta: number }[]) => void;
  getDailyChallenge: () => DailyChallenge | null;
  initDailyChallenge: () => DailyChallenge;
  updateDailyChallenge: (progress: number) => void;
  getWeakItems: () => { words: Word[]; sentences: Sentence[] };

  // Translation actions
  saveTranslation: (translation: Omit<SavedTranslation, 'id' | 'createdAt' | 'updatedAt' | 'timesReviewed' | 'masteryScore'>) => void;
  deleteTranslation: (id: string) => void;
  updateTranslation: (id: string, updates: Partial<SavedTranslation>) => void;
  toggleFavorite: (id: string) => void;
  addTranslationFolder: (name: string, color: string, icon: string) => void;
  deleteTranslationFolder: (id: string) => void;
  moveTranslationToFolder: (translationId: string, folderId: string | undefined) => void;
  getTranslationsByFolder: (folderId?: string) => SavedTranslation[];
  getFavoriteTranslations: () => SavedTranslation[];
  cacheTranslation: (sourceText: string, result: string, reading?: string, romaji?: string) => void;
  getCachedTranslation: (sourceText: string) => { result: string; reading?: string; romaji?: string } | null;

  // Memory Worlds actions
  getActiveWorld: () => MemoryWorld | null;
  setActiveWorld: (worldId: string) => void;
  addObjectToWorld: (worldId: string, word: Word, photoUri?: string, lessonId?: string, coordinates?: { latitude: number; longitude: number }) => WorldObject | null;
  removeObjectFromWorld: (worldId: string, objectId: string) => void;
  selectObject: (objectId: string | null) => void;
  updateObjectMastery: (worldId: string, objectId: string, masteryScore: number) => void;
  markObjectReviewed: (worldId: string, objectId: string, correct: boolean) => void;
  getWorldObjects: (worldId: string) => WorldObject[];
  getObjectsNeedingReview: (worldId: string) => WorldObject[];
  unlockWorld: (worldType: WorldType) => void;
  getUnlockedWorlds: () => MemoryWorld[];
  getAllWorldObjects: () => WorldObject[];
  isWordInAnyWorld: (wordId: string) => boolean;
  suggestWorldForObject: (category: ObjectCategory) => WorldType;

  // Memory Path actions
  unlockSpot: (lesson: PhotoLesson, quizScore: number) => { spot: MemorySpot; path: MemoryPath | null; milesEarned: number; stepsEarned: number } | null;
  deleteSpot: (spotId: string) => void;
  clearPendingMapAnimation: () => void;
  getMemorySpots: () => MemorySpot[];
  getMemoryPaths: () => MemoryPath[];
  getMemoryPathStats: () => MemoryPathStats;

  // Landmark Quest actions
  setActiveQuests: (quests: LandmarkQuest[]) => void;
  completeQuest: (questId: string, lessonId: string) => void;
  setActiveQuestBonus: (questId: string, xpBonus: number) => void;
  clearActiveQuestBonus: () => void;
  getActiveQuests: () => LandmarkQuest[];
}

const getTodayDate = () => new Date().toISOString().split('T')[0];

const calculateLevel = (xp: number): { level: number; name: string; xpToNext: number } => {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    xpToNext: nextLevel.minXP - xp,
  };
};

const getMasteryLevel = (score: number): MasteryLevel => {
  if (score >= 90) return 'mastered';
  if (score >= 60) return 'familiar';
  if (score >= 30) return 'learning';
  return 'new';
};

const calculateNextReview = (word: Word, correct: boolean): { nextReview: string; interval: number } => {
  const now = new Date();
  let interval = word.interval;

  if (correct) {
    // Increase interval: 1 -> 3 -> 7 -> 14 -> 30
    if (interval === 0) interval = 1;
    else if (interval === 1) interval = 3;
    else if (interval < 7) interval = 7;
    else if (interval < 14) interval = 14;
    else interval = 30;
  } else {
    // Reset to 1 day on wrong answer
    interval = 1;
  }

  const next = new Date(now);
  next.setDate(next.getDate() + interval);

  return {
    nextReview: next.toISOString().split('T')[0],
    interval,
  };
};

const initialStats: UserStats = {
  xp: 0,
  level: 1,
  xpToNextLevel: 100,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  reviewStreak: 0,
  longestReviewStreak: 0,
  lastReviewDate: '',
  todayReviewCount: 0,
  totalWords: 0,
  masteredWords: 0,
  totalPhotos: 0,
  todayXP: 0,
  todayWords: 0,
  todayReviews: 0,
  dailyGoal: 5,
  dailyGoalMet: false,
  reading: {
    hiraganaKnown: [],
    katakanaKnown: [],
    hiraganaAccuracy: 0,
    katakanaAccuracy: 0,
    kanjiKnown: [],
    kanjiReadable: [],
    kanjiCount: 0,
    currentLevel: 'romaji',
    readingXP: 0,
  },
};

const initialSkills: UserSkills = createDefaultUserSkills();

// Helper to calculate sentence next review date
const calculateSentenceNextReview = (mastery: SentenceMastery, correct: boolean): { nextReview: string; interval: number } => {
  const now = new Date();
  let interval = mastery.interval;

  if (correct) {
    // Increase interval: 1 -> 3 -> 7 -> 14 -> 30
    if (interval === 0) interval = 1;
    else if (interval === 1) interval = 3;
    else if (interval < 7) interval = 7;
    else if (interval < 14) interval = 14;
    else interval = 30;
  } else {
    // Reset to 1 day on wrong answer
    interval = 1;
  }

  const next = new Date(now);
  next.setDate(next.getDate() + interval);

  return {
    nextReview: next.toISOString().split('T')[0],
    interval,
  };
};

// Helper to generate a daily challenge
const generateDailyChallenge = (): DailyChallenge => {
  const types: Array<'words' | 'sentences' | 'speaking' | 'reading' | 'mixed'> = ['words', 'sentences', 'speaking', 'reading', 'mixed'];
  const type = types[Math.floor(Math.random() * types.length)];
  const targetCounts: Record<string, number> = {
    words: 10,
    sentences: 5,
    speaking: 5,
    reading: 8,
    mixed: 10,
  };
  const xpRewards: Record<string, number> = {
    words: 50,
    sentences: 75,
    speaking: 100,
    reading: 60,
    mixed: 80,
  };

  return {
    id: `challenge-${Date.now()}`,
    date: getTodayDate(),
    type,
    targetCount: targetCounts[type],
    completedCount: 0,
    xpReward: xpRewards[type],
    completed: false,
  };
};

// Fallback options when we don't have enough words
const FALLBACK_ENGLISH = ['apple', 'water', 'book', 'house', 'tree', 'car', 'bird', 'flower'];
const FALLBACK_JAPANESE = ['りんご', '水', '本', '家', '木', '車', '鳥', '花'];

// Generate quiz questions with variety
const generateQuiz = (
  words: Word[],
  photoUri?: string,
  allWords?: Word[]
): QuizQuestion[] => {
  const pool = allWords && allWords.length > 0 ? allWords : words;

  // Get all unique options from pool
  const allEnglish = [...new Set(pool.map((w) => w.english))];
  const allJapanese = [...new Set(pool.map((w) => w.japanese))];

  // For small word sets, only use 'meaning' type (simpler)
  const useSimpleQuiz = words.length <= 4;

  return words.map((word, idx) => {
    // Use 'meaning' type for most questions, occasionally 'reverse'
    const type: QuizType = useSimpleQuiz ? 'meaning' : (idx % 3 === 2 ? 'reverse' : 'meaning');

    let options: string[];
    let correctIndex: number;
    const correctAnswer = type === 'reverse' ? word.japanese : word.english;

    if (type === 'meaning') {
      // Get wrong English options
      let wrongOptions = allEnglish.filter((e) => e !== word.english);

      // If not enough wrong options, add fallbacks
      if (wrongOptions.length < 3) {
        const fallbacks = FALLBACK_ENGLISH.filter(
          (f) => f !== word.english && !wrongOptions.includes(f)
        );
        wrongOptions = [...wrongOptions, ...fallbacks];
      }

      // Shuffle and take 3
      wrongOptions = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 3);

      // Combine with correct answer and shuffle
      options = [...wrongOptions, word.english];
      options = options.sort(() => Math.random() - 0.5);
      correctIndex = options.indexOf(word.english);

    } else if (type === 'reverse') {
      // Get wrong Japanese options
      let wrongOptions = allJapanese.filter((j) => j !== word.japanese);

      // If not enough wrong options, add fallbacks
      if (wrongOptions.length < 3) {
        const fallbacks = FALLBACK_JAPANESE.filter(
          (f) => f !== word.japanese && !wrongOptions.includes(f)
        );
        wrongOptions = [...wrongOptions, ...fallbacks];
      }

      // Shuffle and take 3
      wrongOptions = wrongOptions.sort(() => Math.random() - 0.5).slice(0, 3);

      // Combine with correct answer and shuffle
      options = [...wrongOptions, word.japanese];
      options = options.sort(() => Math.random() - 0.5);
      correctIndex = options.indexOf(word.japanese);

    } else {
      // Speak type - no options needed
      options = [];
      correctIndex = 0;
    }

    // Safety check - ensure correctIndex is valid
    if (correctIndex === -1) {
      if (__DEV__) console.error('Correct answer not found in options!', { correctAnswer, options });
      correctIndex = 0;
      options[0] = correctAnswer;
    }

    return {
      id: `q-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      word,
      photoUri,
      options,
      correctIndex,
    };
  });
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      hasCompletedOnboarding: false, // New users see onboarding; existing users have persisted true
      learningGoal: null,
      nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      notificationsEnabled: true,
      soundEnabled: true,
      currentLesson: null,
      lessonSelectedForReview: false,
      currentQuiz: [],
      quizIndex: 0,
      quizResults: [],
      pendingXP: [],
      lessons: [],
      stats: initialStats,
      unlockedMilestones: [],
      userSkills: initialSkills,
      dailyChallenges: [],
      currentPracticeSession: null,
      sentenceMasteryMap: {},
      savedTranslations: [],
      translationFolders: DEFAULT_TRANSLATION_FOLDERS.map(f => ({ ...f, createdAt: new Date().toISOString() })),
      translationCache: {},
      // Memory Worlds initial state
      worlds: [createDefaultWorld('terra')], // Start with Terra planet
      activeWorldId: null,
      selectedObjectId: null,
      // Memory Path initial state
      memorySpots: [],
      memoryPaths: [],
      totalMileage: 0,
      totalSteps: 0,
      lastSpotId: null,
      pendingMapAnimation: null,
      // Lost memories initial state
      lostMemories: [],
      rescueCombo: 0,
      // Landmark Quests initial state
      activeQuests: [],
      completedQuestIds: [],
      questsLastRefreshed: 0,
      activeQuestBonus: null,
      unlockedAchievementIds: [],
      pendingAchievementUnlock: null,
      isAnalyzing: false,

      // Onboarding actions
      setLearningGoal: (goal) => set({ learningGoal: goal }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setNativeLanguage: (language) => set({ nativeLanguage: language }),
      setTargetLanguage: (language) => set({ targetLanguage: language }),

      // Settings actions
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      // Actions
      setCurrentLesson: (lesson) => set({ currentLesson: lesson }),

      selectLessonForReview: (lesson) => set({
        currentLesson: lesson,
        lessonSelectedForReview: true
      }),

      clearLessonSelection: () => set({
        currentLesson: null,
        lessonSelectedForReview: false
      }),

      consumeLessonSelection: () => set({ lessonSelectedForReview: false }),

      addLesson: (lesson) => {
        const state = get();
        // Add XP for photo
        state.addXP({ type: 'photo', amount: XP_REWARDS.takePhoto, description: 'Photo captured!' });

        // Add XP for each word
        lesson.words.forEach(() => {
          state.addXP({ type: 'word', amount: XP_REWARDS.learnWord, description: 'New word!' });
        });

        // Initialize memory palace fields
        const lessonWithMemory: PhotoLesson = {
          ...lesson,
          memoryStrength: 100,
          memoryStatus: 'fresh',
          lastReviewedAt: new Date().toISOString(),
          reviewCount: 0,
        };

        set((s) => ({
          lessons: [lessonWithMemory, ...s.lessons],
          stats: {
            ...s.stats,
            totalPhotos: s.stats.totalPhotos + 1,
            totalWords: s.stats.totalWords + lesson.words.length,
            todayWords: s.stats.todayWords + lesson.words.length,
          },
        }));

        get().checkDailyGoal();
        get().checkAchievements();
      },

      updateLesson: (id, updates) =>
        set((state) => ({
          lessons: state.lessons.map((l) => (l.id === id ? { ...l, ...updates } : l)),
          currentLesson:
            state.currentLesson?.id === id ? { ...state.currentLesson, ...updates } : state.currentLesson,
        })),

      deleteLesson: (id) =>
        set((state) => {
          const lesson = state.lessons.find((l) => l.id === id);
          const wordCount = lesson?.words.length || 0;
          return {
            lessons: state.lessons.filter((l) => l.id !== id),
            currentLesson: state.currentLesson?.id === id ? null : state.currentLesson,
            stats: {
              ...state.stats,
              totalPhotos: Math.max(0, state.stats.totalPhotos - 1),
              totalWords: Math.max(0, state.stats.totalWords - wordCount),
            },
          };
        }),

      updateWord: (lessonId, wordId, updates) =>
        set((state) => ({
          lessons: state.lessons.map((l) =>
            l.id === lessonId
              ? {
                  ...l,
                  words: l.words.map((w) => (w.id === wordId ? { ...w, ...updates } : w)),
                }
              : l
          ),
        })),

      // Quiz
      startQuiz: (words, photoUri) => {
        const quiz = generateQuiz(words, photoUri);
        set({
          currentQuiz: quiz,
          quizIndex: 0,
          quizResults: [],
        });
      },

      startReviewQuiz: () => {
        const wordsToReview = get().getWordsToReview();
        if (wordsToReview.length === 0) return;

        // Take up to 5 words for review
        const reviewWords = wordsToReview.slice(0, 5);
        const allWords = get().lessons.flatMap((l) => l.words);
        const quiz = generateQuiz(
          reviewWords.map((w) => w.word),
          reviewWords[0]?.photoUri,
          allWords
        );

        set({
          currentQuiz: quiz,
          quizIndex: 0,
          quizResults: [],
        });
      },

      answerQuestion: (correct, fast = false) => {
        const state = get();
        const question = state.currentQuiz[state.quizIndex];

        if (!question) return;

        // Add XP
        if (correct) {
          state.addXP({ type: 'quiz', amount: XP_REWARDS.quizCorrect, description: 'Correct!' });
          if (fast) {
            state.addXP({ type: 'speed', amount: XP_REWARDS.quizSpeedBonus, description: 'Speed bonus!' });
          }
        }

        // Update word mastery
        const lesson = state.lessons.find((l) => l.words.some((w) => w.id === question.word.id));
        if (lesson) {
          const word = lesson.words.find((w) => w.id === question.word.id);
          if (word) {
            const newScore = correct
              ? Math.min(100, word.masteryScore + 15)
              : Math.max(0, word.masteryScore - 10);
            const { nextReview, interval } = calculateNextReview(word, correct);

            state.updateWord(lesson.id, word.id, {
              timesCorrect: correct ? word.timesCorrect + 1 : word.timesCorrect,
              timesWrong: correct ? word.timesWrong : word.timesWrong + 1,
              masteryScore: newScore,
              mastery: getMasteryLevel(newScore),
              lastReviewed: getTodayDate(),
              nextReview,
              interval,
            });

            // Sync mastery to any WorldObject linked to this word
            const worlds = state.worlds;
            for (const world of worlds) {
              const objIndex = world.objects.findIndex(obj => obj.wordId === word.id);
              if (objIndex !== -1) {
                set((s) => ({
                  worlds: s.worlds.map(w =>
                    w.id === world.id
                      ? {
                          ...w,
                          objects: w.objects.map(obj =>
                            obj.wordId === word.id
                              ? {
                                  ...obj,
                                  masteryScore: newScore,
                                  needsReview: newScore < 70,
                                  lastReviewed: getTodayDate(),
                                }
                              : obj
                          ),
                        }
                      : w
                  ),
                }));
                break;
              }
            }
          }
        }

        set((s) => ({
          quizResults: [...s.quizResults, correct],
          quizIndex: s.quizIndex + 1,
          stats: {
            ...s.stats,
            todayReviews: s.stats.todayReviews + 1,
          },
        }));
      },

      resetQuiz: () =>
        set({
          currentQuiz: [],
          quizIndex: 0,
          quizResults: [],
        }),

      // XP
      addXP: (event) => {
        set((state) => {
          const newXP = state.stats.xp + event.amount;
          const levelInfo = calculateLevel(newXP);

          return {
            pendingXP: [...state.pendingXP, event],
            stats: {
              ...state.stats,
              xp: newXP,
              level: levelInfo.level,
              xpToNextLevel: levelInfo.xpToNext,
              todayXP: state.stats.todayXP + event.amount,
            },
          };
        });
      },

      clearPendingXP: () => set({ pendingXP: [] }),

      // Stats
      updateStreak: () =>
        set((state) => {
          const today = getTodayDate();
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          let newStreak = state.stats.streak;
          let todayWords = state.stats.todayWords;
          let todayXP = state.stats.todayXP;
          let todayReviews = state.stats.todayReviews;
          let dailyGoalMet = state.stats.dailyGoalMet;

          if (state.stats.lastActiveDate === today) {
            // Already active today
          } else if (state.stats.lastActiveDate === yesterdayStr) {
            // Consecutive day
            newStreak += 1;
            todayWords = 0;
            todayXP = 0;
            todayReviews = 0;
            dailyGoalMet = false;
          } else if (state.stats.lastActiveDate === '') {
            // First time
            newStreak = 1;
            todayWords = 0;
            todayXP = 0;
            todayReviews = 0;
            dailyGoalMet = false;
          } else {
            // Streak broken
            newStreak = 1;
            todayWords = 0;
            todayXP = 0;
            todayReviews = 0;
            dailyGoalMet = false;
          }

          return {
            stats: {
              ...state.stats,
              streak: newStreak,
              longestStreak: Math.max(state.stats.longestStreak, newStreak),
              lastActiveDate: today,
              todayWords,
              todayXP,
              todayReviews,
              dailyGoalMet,
            },
          };
        }),

      checkDailyGoal: () => {
        const state = get();
        if (!state.stats.dailyGoalMet && state.stats.todayWords >= state.stats.dailyGoal) {
          state.addXP({ type: 'daily', amount: XP_REWARDS.dailyGoalComplete, description: 'Daily goal!' });
          set((s) => ({
            stats: { ...s.stats, dailyGoalMet: true },
          }));
        }
      },

      setIsAnalyzing: (value) => set({ isAnalyzing: value }),

      // Review - get words due for review
      getWordsToReview: () => {
        const state = get();
        const today = getTodayDate();
        const words: { word: Word; photoUri: string; lessonId: string }[] = [];

        state.lessons.forEach((lesson) => {
          lesson.words.forEach((word) => {
            // Word needs review if:
            // 1. Never reviewed and been learned
            // 2. Next review date is today or earlier
            const needsReview =
              !word.nextReview ||
              word.nextReview <= today ||
              (word.lastReviewed && word.mastery !== 'mastered');

            if (needsReview && word.masteryScore < 90) {
              words.push({
                word,
                photoUri: lesson.imageUri,
                lessonId: lesson.id,
              });
            }
          });
        });

        // Sort by mastery (lowest first) and next review date
        return words.sort((a, b) => {
          if (a.word.masteryScore !== b.word.masteryScore) {
            return a.word.masteryScore - b.word.masteryScore;
          }
          return (a.word.nextReview || '').localeCompare(b.word.nextReview || '');
        });
      },

      getReviewCount: () => get().getWordsToReview().length,

      markWordReviewed: (lessonId, wordId, correct) => {
        const state = get();
        const lesson = state.lessons.find((l) => l.id === lessonId);
        const word = lesson?.words.find((w) => w.id === wordId);

        if (word) {
          const { nextReview, interval } = calculateNextReview(word, correct);
          const newScore = correct
            ? Math.min(100, word.masteryScore + 15)
            : Math.max(0, word.masteryScore - 10);

          state.updateWord(lessonId, wordId, {
            lastReviewed: getTodayDate(),
            nextReview,
            interval,
            masteryScore: newScore,
            mastery: getMasteryLevel(newScore),
            timesCorrect: correct ? word.timesCorrect + 1 : word.timesCorrect,
            timesWrong: correct ? word.timesWrong : word.timesWrong + 1,
          });
        }
      },

      getLessonsNeedingReview: () => {
        const state = get();
        const today = getTodayDate();

        return state.lessons.filter((lesson) => {
          return lesson.words.some((word) => !word.nextReview || word.nextReview <= today);
        });
      },

      markLessonReviewed: (id) =>
        set((state) => ({
          lessons: state.lessons.map((l) =>
            l.id === id
              ? {
                  ...l,
                  lastPracticed: new Date().toISOString(),
                  practiceCount: l.practiceCount + 1,
                }
              : l
          ),
        })),

      // Memory Palace - calculate decay for all memories
      calculateMemoryDecay: () => {
        const now = new Date();
        set((state) => ({
          lessons: state.lessons.map((lesson) => {
            // Skip if no lastReviewedAt (legacy lessons)
            if (!lesson.lastReviewedAt) {
              return {
                ...lesson,
                memoryStrength: lesson.memoryStrength ?? 50,
                memoryStatus: getMemoryStatus(lesson.memoryStrength ?? 50),
                lastReviewedAt: lesson.createdAt,
                reviewCount: lesson.reviewCount ?? 0,
              };
            }

            const lastReview = new Date(lesson.lastReviewedAt);
            const daysSinceReview = Math.floor(
              (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Calculate decayed strength
            const currentStrength = lesson.memoryStrength ?? 100;
            const decay = daysSinceReview * MEMORY_DECAY.DAILY_DECAY;
            const newStrength = Math.max(
              MEMORY_DECAY.MIN_STRENGTH,
              currentStrength - decay
            );

            return {
              ...lesson,
              memoryStrength: newStrength,
              memoryStatus: getMemoryStatus(newStrength),
            };
          }),
        }));
      },

      // Memory Palace - boost memory after review with streak bonuses
      reviewMemory: (lessonId) => {
        const state = get();
        const today = new Date().toISOString().split('T')[0];
        const lastReviewDate = state.stats.lastReviewDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Calculate review streak
        let newReviewStreak = state.stats.reviewStreak;
        let todayReviewCount = state.stats.todayReviewCount;

        if (lastReviewDate === today) {
          todayReviewCount++;
        } else if (lastReviewDate === yesterdayStr) {
          newReviewStreak++;
          todayReviewCount = 1;
        } else if (lastReviewDate !== today) {
          newReviewStreak = 1;
          todayReviewCount = 1;
        }

        const longestReviewStreak = Math.max(newReviewStreak, state.stats.longestReviewStreak);

        // Calculate streak bonus for memory boost
        const streakBonus = Math.min(
          newReviewStreak * REVIEW_STREAK_BONUSES.STREAK_MEMORY_BONUS,
          REVIEW_STREAK_BONUSES.MEMORY_BOOST_BASE
        );
        const totalMemoryBoost = REVIEW_STREAK_BONUSES.MEMORY_BOOST_BASE + streakBonus;

        // Calculate XP with streak multiplier
        const xpMultiplier = Math.min(
          1 + (newReviewStreak * REVIEW_STREAK_BONUSES.STREAK_MULTIPLIER),
          REVIEW_STREAK_BONUSES.MAX_MULTIPLIER
        );
        const xpAmount = Math.round(REVIEW_STREAK_BONUSES.BASE_XP * xpMultiplier);

        set((s) => ({
          lessons: s.lessons.map((l) =>
            l.id === lessonId
              ? {
                  ...l,
                  memoryStrength: Math.min(
                    MEMORY_DECAY.MAX_STRENGTH,
                    (l.memoryStrength ?? 50) + totalMemoryBoost
                  ),
                  memoryStatus: getMemoryStatus(
                    Math.min(
                      MEMORY_DECAY.MAX_STRENGTH,
                      (l.memoryStrength ?? 50) + totalMemoryBoost
                    )
                  ),
                  lastReviewedAt: new Date().toISOString(),
                  reviewCount: (l.reviewCount ?? 0) + 1,
                  lastPracticed: new Date().toISOString(),
                  practiceCount: l.practiceCount + 1,
                }
              : l
          ),
          stats: {
            ...s.stats,
            reviewStreak: newReviewStreak,
            longestReviewStreak,
            lastReviewDate: today,
            todayReviewCount,
          },
        }));

        // Award XP with streak bonus
        const streakText = newReviewStreak > 1 ? ` (${newReviewStreak}x streak!)` : '';
        get().addXP({
          type: 'quiz',
          amount: xpAmount,
          description: `Memory strengthened!${streakText}`,
        });

        // Check for new achievements
        get().checkAchievements();
      },

      // SRS-based word review - updates individual word memory with spaced repetition
      reviewWordSRS: (lessonId, wordId, isCorrect, responseTimeMs) => {
        const quality = getQualityFromAnswer(isCorrect, responseTimeMs, false);
        const state = get();

        // Check if this word was fading (for rescue bonus)
        const lesson = state.lessons.find(l => l.id === lessonId);
        const word = lesson?.words.find(w => w.id === wordId);
        const wasFading = word?.srs ? getSRSMemoryStrength(word.srs) < 50 : false;

        set((s) => ({
          lessons: s.lessons.map((lesson) => {
            if (lesson.id !== lessonId) return lesson;

            const updatedWords = lesson.words.map((word) => {
              if (word.id !== wordId) return word;

              // Get or create SRS data
              const currentSRS = word.srs ?? migrateToSRS(word);
              const newSRS = processReview(currentSRS, quality as ReviewQuality);

              // Update mastery score based on SRS strength
              const memoryStrength = getSRSMemoryStrength(newSRS);
              const newMasteryScore = Math.round(
                (word.masteryScore * 0.7) + (memoryStrength * 0.3)
              );

              return {
                ...word,
                srs: newSRS,
                lastReviewed: newSRS.lastReviewed,
                nextReview: newSRS.nextReview,
                interval: newSRS.interval,
                masteryScore: Math.min(100, newMasteryScore),
                timesCorrect: isCorrect ? word.timesCorrect + 1 : word.timesCorrect,
                timesWrong: isCorrect ? word.timesWrong : word.timesWrong + 1,
              };
            });

            // Recalculate lesson memory strength as average of word SRS strengths
            const avgStrength = updatedWords.reduce((sum, w) => {
              if (w.srs) {
                return sum + getSRSMemoryStrength(w.srs);
              }
              return sum + (w.masteryScore ?? 50);
            }, 0) / updatedWords.length;

            return {
              ...lesson,
              words: updatedWords,
              memoryStrength: Math.round(avgStrength),
              memoryStatus: getMemoryStatus(Math.round(avgStrength)),
              lastReviewedAt: new Date().toISOString(),
            };
          }),
          // Increment rescue combo if this was a fading memory
          rescueCombo: isCorrect && wasFading ? s.rescueCombo + 1 : (isCorrect ? s.rescueCombo : 0),
        }));

        // Award XP for correct answers
        if (isCorrect) {
          const currentCombo = get().rescueCombo;
          let totalXP = XP_REWARDS.quizCorrect;
          let description = 'Word reviewed!';

          // Add rescue bonus for fading memories
          if (wasFading) {
            const rescueBonus = XP_REWARDS.rescueBonus;
            const comboBonus = currentCombo > 1 ? (currentCombo - 1) * XP_REWARDS.rescueCombo : 0;
            totalXP += rescueBonus + comboBonus;
            description = currentCombo > 1
              ? `Memory rescued! ${currentCombo}x combo +${rescueBonus + comboBonus}`
              : `Memory rescued! +${rescueBonus}`;
          }

          get().addXP({
            type: 'quiz',
            amount: totalXP,
            description,
          });
        }
      },

      // Memory Palace - get lessons that need attention (SRS-based)
      getFadingMemories: () => {
        const state = get();

        // Find lessons with words that are due or nearly due for review
        return state.lessons
          .filter((lesson) => {
            // Check if any word in the lesson needs review
            const hasDueWords = lesson.words.some((word) => {
              if (word.srs) {
                return isDueForReview(word.srs) || getSRSMemoryStrength(word.srs) < 50;
              }
              // Fall back to legacy check for words without SRS data
              return (word.masteryScore ?? 0) < 50;
            });
            return hasDueWords;
          })
          .sort((a, b) => {
            // Sort by lowest word memory strength
            const aMin = Math.min(...a.words.map(w =>
              w.srs ? getSRSMemoryStrength(w.srs) : (w.masteryScore ?? 50)
            ));
            const bMin = Math.min(...b.words.map(w =>
              w.srs ? getSRSMemoryStrength(w.srs) : (w.masteryScore ?? 50)
            ));
            return aMin - bMin;
          });
      },

      // Memory Palace - get stats by memory status (SRS-based, counts words not lessons)
      getMemoryStats: () => {
        const state = get();
        const stats = { fresh: 0, strong: 0, fading: 0, weak: 0, due: 0 };

        state.lessons.forEach((lesson) => {
          lesson.words.forEach((word) => {
            if (word.srs) {
              // Use SRS-based status
              const status = getMemoryStatusFromSRS(word.srs);
              if (status === 'due') stats.due++;
              else if (status === 'fresh') stats.fresh++;
              else if (status === 'strong') stats.strong++;
              else if (status === 'fading') stats.fading++;
              else stats.weak++;
            } else {
              // Legacy: estimate from mastery score
              const score = word.masteryScore ?? 50;
              if (score >= 80) stats.fresh++;
              else if (score >= 60) stats.strong++;
              else if (score >= 30) stats.fading++;
              else stats.weak++;
            }
          });
        });

        return stats;
      },

      // Check for and penalize fully forgotten memories (overdue by 7+ days)
      checkForForgottenMemories: () => {
        const state = get();
        const FORGOTTEN_THRESHOLD_HOURS = 7 * 24; // 7 days overdue = forgotten
        const now = Date.now();
        const newLostMemories: LostMemory[] = [];
        let xpPenalty = 0;

        const updatedLessons = state.lessons.map((lesson) => {
          const updatedWords = lesson.words.map((word) => {
            if (!word.srs) return word;

            const nextReview = new Date(word.srs.nextReview).getTime();
            const hoursOverdue = (now - nextReview) / (1000 * 60 * 60);

            // If overdue by more than threshold, mark as forgotten
            if (hoursOverdue >= FORGOTTEN_THRESHOLD_HOURS) {
              newLostMemories.push({
                id: `lost-${word.id}-${Date.now()}`,
                lessonId: lesson.id,
                wordId: word.id,
                japanese: word.japanese,
                english: word.english,
                reading: word.reading,
                imageUri: lesson.imageUri || '',
                lostAt: new Date().toISOString(),
                previousMasteryScore: word.masteryScore,
              });
              xpPenalty += Math.abs(XP_REWARDS.memoryLostPenalty);

              // Reset the word's SRS data
              return {
                ...word,
                srs: createInitialSRS(),
                masteryScore: 0,
              };
            }
            return word;
          });

          return { ...lesson, words: updatedWords };
        });

        if (newLostMemories.length > 0) {
          set((s) => ({
            lessons: updatedLessons,
            lostMemories: [...s.lostMemories, ...newLostMemories],
          }));

          // Apply XP penalty
          get().addXP({
            type: 'penalty',
            amount: -xpPenalty,
            description: `${newLostMemories.length} ${newLostMemories.length === 1 ? 'memory' : 'memories'} forgotten! -${xpPenalty} XP`,
          });
        }
      },

      // Get all lost memories
      getLostMemories: () => get().lostMemories,

      // Recover a lost memory (requires re-learning)
      recoverMemory: (lostMemoryId: string) => {
        const state = get();
        const lostMemory = state.lostMemories.find(m => m.id === lostMemoryId);
        if (!lostMemory) return false;

        // Remove from lost memories - the word is already reset in the lesson
        set((s) => ({
          lostMemories: s.lostMemories.filter(m => m.id !== lostMemoryId),
        }));

        return true;
      },

      // Reset rescue combo (call when review session ends)
      resetRescueCombo: () => set({ rescueCombo: 0 }),

      // Get hours until a lesson's weakest word is forgotten
      getTimeUntilForgotten: (lessonId: string) => {
        const state = get();
        const lesson = state.lessons.find(l => l.id === lessonId);
        if (!lesson) return null;

        // Find the word with the earliest next review
        let minHours: number | null = null;
        lesson.words.forEach((word) => {
          if (word.srs) {
            const hours = getHoursUntilReview(word.srs);
            if (minHours === null || hours < minHours) {
              minHours = hours;
            }
          }
        });

        return minHours;
      },

      // Debug: Simulate fading by setting all words to be due for review
      debugSimulateFading: () => {
        if (!__DEV__) return; // Only in development

        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

        set((s) => ({
          lessons: s.lessons.map((lesson) => ({
            ...lesson,
            memoryStrength: 30, // Fading
            memoryStatus: 'fading' as const,
            words: lesson.words.map((word) => ({
              ...word,
              masteryScore: 40,
              srs: {
                interval: 4,
                easeFactor: 2.5,
                repetitions: 1,
                lastReviewed: pastDate,
                nextReview: pastDate, // Due now
              },
            })),
          })),
        }));

        console.log('[Debug] Simulated fading - all words now due for review');
      },

      // Achievements - check for new unlocks
      checkAchievements: () => {
        const state = get();
        const unlocked = getUnlockedAchievements(state.stats, state.lessons);
        const unlockedIds = unlocked.map(a => a.id);

        // Find newly unlocked achievements
        const newlyUnlocked = unlocked.find(a => !state.unlockedAchievementIds.includes(a.id));

        if (newlyUnlocked) {
          // Award XP for achievement
          get().addXP({
            type: 'bonus',
            amount: newlyUnlocked.xpReward,
            description: `Achievement: ${newlyUnlocked.title}`,
          });

          set({
            unlockedAchievementIds: unlockedIds,
            pendingAchievementUnlock: {
              id: newlyUnlocked.id,
              title: newlyUnlocked.title,
              xpReward: newlyUnlocked.xpReward,
            },
          });
        } else {
          // Just update the list without notification
          set({ unlockedAchievementIds: unlockedIds });
        }
      },

      // Achievements - clear pending notification
      clearPendingAchievement: () => set({ pendingAchievementUnlock: null }),

      // Reading Review - get words due for reading-specific review
      getReadingWordsToReview: () => {
        const state = get();
        const today = getTodayDate();
        const words: { word: Word; photoUri: string; lessonId: string }[] = [];

        state.lessons.forEach((lesson) => {
          lesson.words.forEach((word) => {
            // Word needs reading review if:
            // 1. It contains kanji (needs reading practice)
            // 2. Reading score is below mastery threshold
            // 3. Next review date is today or earlier
            const needsReadingReview =
              word.containsKanji &&
              (word.readingScore === undefined || word.readingScore < 90) &&
              (!word.nextReview || word.nextReview <= today);

            if (needsReadingReview) {
              words.push({
                word,
                photoUri: lesson.imageUri,
                lessonId: lesson.id,
              });
            }
          });
        });

        // Sort by reading score (lowest first) and next review date
        return words.sort((a, b) => {
          const scoreA = a.word.readingScore ?? 0;
          const scoreB = b.word.readingScore ?? 0;
          if (scoreA !== scoreB) {
            return scoreA - scoreB;
          }
          return (a.word.nextReview || '').localeCompare(b.word.nextReview || '');
        });
      },

      getReadingReviewCount: () => get().getReadingWordsToReview().length,

      startReadingReviewQuiz: (readingLevel: ReadingLevel = 'romaji') => {
        const wordsToReview = get().getReadingWordsToReview();
        if (wordsToReview.length === 0) return;

        // Take up to 10 words for reading review
        const reviewWords = wordsToReview.slice(0, 10).map((w) => w.word);

        // Collect sentences from lessons (if any)
        const sentences: Sentence[] = get().lessons
          .flatMap((l) => l.sentences || [])
          .slice(0, 5);

        // Generate reading-focused quiz
        const quiz = generateReadingQuiz(reviewWords, sentences, 10, {
          readingLevel,
          includeKana: true,
          includeKanji: true,
          includeSentences: sentences.length > 0,
          prioritizeWeakAreas: true,
        });

        set({
          currentQuiz: quiz,
          quizIndex: 0,
          quizResults: [],
        });
      },

      markReadingReviewed: (lessonId, wordId, correct) => {
        const state = get();
        const lesson = state.lessons.find((l) => l.id === lessonId);
        const word = lesson?.words.find((w) => w.id === wordId);

        if (word) {
          const { nextReview, interval } = calculateNextReview(word, correct);
          const currentReadingScore = word.readingScore ?? 0;
          const newReadingScore = correct
            ? Math.min(100, currentReadingScore + 15)
            : Math.max(0, currentReadingScore - 10);

          state.updateWord(lessonId, wordId, {
            lastReviewed: getTodayDate(),
            nextReview,
            interval,
            readingScore: newReadingScore,
            readingMastery: getMasteryLevel(newReadingScore),
          });

          // Award reading XP
          if (correct) {
            set((s) => ({
              stats: {
                ...s.stats,
                reading: {
                  ...s.stats.reading,
                  readingXP: s.stats.reading.readingXP + 5,
                },
              },
            }));
          }
        }
      },

      updateKanaProgress: (kana, correct, isHiragana) => {
        set((state) => {
          const reading = { ...state.stats.reading };
          const knownArray = isHiragana ? [...reading.hiraganaKnown] : [...reading.katakanaKnown];

          if (correct && !knownArray.includes(kana)) {
            knownArray.push(kana);
          }

          // Update accuracy
          const accuracyKey = isHiragana ? 'hiraganaAccuracy' : 'katakanaAccuracy';
          const currentAccuracy = reading[accuracyKey] || 0;
          const newAccuracy = currentAccuracy * 0.9 + (correct ? 10 : 0);

          return {
            stats: {
              ...state.stats,
              reading: {
                ...reading,
                [isHiragana ? 'hiraganaKnown' : 'katakanaKnown']: knownArray,
                [accuracyKey]: newAccuracy,
                readingXP: reading.readingXP + (correct ? 2 : 0),
              },
            },
          };
        });
      },

      // Sentence tracking actions
      updateSentenceMastery: (sentenceId, updates) => {
        set((state) => {
          const currentMastery = state.sentenceMasteryMap[sentenceId] || createDefaultSentenceMastery();
          return {
            sentenceMasteryMap: {
              ...state.sentenceMasteryMap,
              [sentenceId]: { ...currentMastery, ...updates },
            },
          };
        });
      },

      recordSpeakingAttempt: (itemId, itemType, score, passed) => {
        const state = get();

        if (itemType === 'word') {
          // Find and update the word
          const lesson = state.lessons.find((l) => l.words.some((w) => w.id === itemId));
          if (lesson) {
            const word = lesson.words.find((w) => w.id === itemId);
            if (word) {
              state.updateWord(lesson.id, itemId, {
                timesSpoken: word.timesSpoken + 1,
              });
            }
          }
        } else {
          // Update sentence mastery
          const currentMastery = state.sentenceMasteryMap[itemId] || createDefaultSentenceMastery();
          const newPronunciationScore = passed
            ? Math.min(100, currentMastery.pronunciationScore + 15)
            : Math.max(0, currentMastery.pronunciationScore - 5);

          state.updateSentenceMastery(itemId, {
            pronunciationScore: newPronunciationScore,
            timesSpoken: currentMastery.timesSpoken + 1,
            timesCorrect: passed ? currentMastery.timesCorrect + 1 : currentMastery.timesCorrect,
            timesWrong: passed ? currentMastery.timesWrong : currentMastery.timesWrong + 1,
            lastPracticed: getTodayDate(),
          });
        }

        // Update speaking skill
        state.updateSkill('speaking', passed, passed ? XP_REWARDS.speakWord : 0);

        // Award XP based on pronunciation score
        if (score >= 90) {
          state.addXP({ type: 'speak', amount: 25, description: 'Excellent pronunciation!' });
        } else if (score >= 80) {
          state.addXP({ type: 'speak', amount: 15, description: 'Good pronunciation!' });
        } else if (passed) {
          state.addXP({ type: 'speak', amount: 5, description: 'Speaking practice!' });
        }
      },

      updateSkill: (skill, correct, xpEarned) => {
        set((state) => {
          const currentSkill = state.userSkills[skill];

          // Rolling average for accuracy (weight recent attempts more)
          const newAccuracy = currentSkill.accuracy * 0.9 + (correct ? 10 : 0);

          // Update streak
          const newStreak = correct ? currentSkill.streak + 1 : 0;

          // Check for level up (every 100 accuracy points accumulated)
          const accuracyThreshold = currentSkill.level * 70;
          const newLevel = newAccuracy >= accuracyThreshold ? currentSkill.level + 1 : currentSkill.level;

          return {
            userSkills: {
              ...state.userSkills,
              [skill]: {
                level: newLevel,
                accuracy: newAccuracy,
                streak: newStreak,
              },
            },
          };
        });
      },

      getSentencesToReview: () => {
        const state = get();
        const today = getTodayDate();
        const sentencesToReview: Sentence[] = [];

        state.lessons.forEach((lesson) => {
          if (lesson.sentences) {
            lesson.sentences.forEach((sentence) => {
              const mastery = state.sentenceMasteryMap[sentence.id];
              const avgScore = mastery
                ? (mastery.pronunciationScore + mastery.readingScore + mastery.comprehensionScore) / 3
                : 0;

              // Sentence needs review if:
              // 1. Never reviewed
              // 2. Next review date is today or earlier
              // 3. Average score is below 80
              const needsReview =
                !mastery ||
                !mastery.nextReview ||
                mastery.nextReview <= today ||
                avgScore < 80;

              if (needsReview) {
                sentencesToReview.push(sentence);
              }
            });
          }
        });

        // Sort by score (lowest first)
        return sentencesToReview.sort((a, b) => {
          const masteryA = state.sentenceMasteryMap[a.id];
          const masteryB = state.sentenceMasteryMap[b.id];
          const scoreA = masteryA ? (masteryA.pronunciationScore + masteryA.readingScore) / 2 : 0;
          const scoreB = masteryB ? (masteryB.pronunciationScore + masteryB.readingScore) / 2 : 0;
          return scoreA - scoreB;
        });
      },

      getSentenceReviewCount: () => get().getSentencesToReview().length,

      startSentencePractice: (sentences) => {
        const session: PracticeSession = {
          id: `practice-${Date.now()}`,
          type: 'sentence',
          items: sentences.map((s) => s.id),
          startedAt: new Date().toISOString(),
          score: 0,
          skillsImproved: [],
        };

        set({ currentPracticeSession: session });
      },

      completePracticeSession: (score, skillsImproved) => {
        const state = get();
        if (!state.currentPracticeSession) return;

        const completedSession: PracticeSession = {
          ...state.currentPracticeSession,
          completedAt: new Date().toISOString(),
          score,
          skillsImproved,
        };

        // Award XP based on score
        const xpAmount = Math.floor(score / 10) * 5 + 10; // Base 10 XP + 5 per 10%
        state.addXP({ type: 'quiz', amount: xpAmount, description: 'Practice session complete!' });

        // Update sentence mastery for reviewed items
        completedSession.items.forEach((sentenceId) => {
          const mastery = state.sentenceMasteryMap[sentenceId] || createDefaultSentenceMastery();
          const passed = score >= 70;
          const { nextReview, interval } = calculateSentenceNextReview(mastery, passed);

          state.updateSentenceMastery(sentenceId, {
            nextReview,
            interval,
            lastPracticed: getTodayDate(),
          });
        });

        set({ currentPracticeSession: null });
      },

      getDailyChallenge: () => {
        const state = get();
        const today = getTodayDate();

        // Find today's challenge (read-only, no state updates)
        const todayChallenge = state.dailyChallenges.find((c) => c.date === today);
        return todayChallenge || null;
      },

      initDailyChallenge: () => {
        const state = get();
        const today = getTodayDate();

        // Check if today's challenge already exists
        const todayChallenge = state.dailyChallenges.find((c) => c.date === today);
        if (todayChallenge) return todayChallenge;

        // Create a new challenge for today (safe to call in useEffect)
        const newChallenge = generateDailyChallenge();
        set((s) => ({
          dailyChallenges: [...s.dailyChallenges.slice(-6), newChallenge], // Keep last 7 days
        }));

        return newChallenge;
      },

      updateDailyChallenge: (progress) => {
        const state = get();
        const today = getTodayDate();
        const challengeIndex = state.dailyChallenges.findIndex((c) => c.date === today);

        if (challengeIndex === -1) return;

        const challenge = state.dailyChallenges[challengeIndex];
        const newCompletedCount = challenge.completedCount + progress;
        const isNowComplete = !challenge.completed && newCompletedCount >= challenge.targetCount;

        const updatedChallenge: DailyChallenge = {
          ...challenge,
          completedCount: newCompletedCount,
          completed: newCompletedCount >= challenge.targetCount,
        };

        set((s) => ({
          dailyChallenges: s.dailyChallenges.map((c, i) =>
            i === challengeIndex ? updatedChallenge : c
          ),
        }));

        // Award XP if just completed
        if (isNowComplete) {
          state.addXP({ type: 'daily', amount: challenge.xpReward, description: 'Daily challenge complete!' });
        }
      },

      getWeakItems: () => {
        const state = get();
        const weakWords: Word[] = [];
        const weakSentences: Sentence[] = [];

        // Find words with score < 60
        state.lessons.forEach((lesson) => {
          lesson.words.forEach((word) => {
            if (word.masteryScore < 60) {
              weakWords.push(word);
            }
          });

          // Find sentences with score < 60
          if (lesson.sentences) {
            lesson.sentences.forEach((sentence) => {
              const mastery = state.sentenceMasteryMap[sentence.id];
              const avgScore = mastery
                ? (mastery.pronunciationScore + mastery.readingScore + mastery.comprehensionScore) / 3
                : 0;

              if (avgScore < 60) {
                weakSentences.push(sentence);
              }
            });
          }
        });

        // Sort by score (lowest first)
        weakWords.sort((a, b) => a.masteryScore - b.masteryScore);
        weakSentences.sort((a, b) => {
          const masteryA = state.sentenceMasteryMap[a.id];
          const masteryB = state.sentenceMasteryMap[b.id];
          const scoreA = masteryA ? (masteryA.pronunciationScore + masteryA.readingScore) / 2 : 0;
          const scoreB = masteryB ? (masteryB.pronunciationScore + masteryB.readingScore) / 2 : 0;
          return scoreA - scoreB;
        });

        return { words: weakWords, sentences: weakSentences };
      },

      // Translation actions
      saveTranslation: (translation) => {
        const newTranslation: SavedTranslation = {
          ...translation,
          id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          timesReviewed: 0,
          masteryScore: 0,
        };
        set((state) => ({
          savedTranslations: [newTranslation, ...state.savedTranslations],
        }));
      },

      deleteTranslation: (id) => {
        set((state) => ({
          savedTranslations: state.savedTranslations.filter((t) => t.id !== id),
        }));
      },

      updateTranslation: (id, updates) => {
        set((state) => ({
          savedTranslations: state.savedTranslations.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      toggleFavorite: (id) => {
        set((state) => ({
          savedTranslations: state.savedTranslations.map((t) =>
            t.id === id ? { ...t, isFavorite: !t.isFavorite, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      addTranslationFolder: (name, color, icon) => {
        const state = get();
        const newFolder: TranslationFolder = {
          id: `folder-${Date.now()}`,
          name,
          color,
          icon,
          createdAt: new Date().toISOString(),
          order: state.translationFolders.length,
        };
        set((state) => ({
          translationFolders: [...state.translationFolders, newFolder],
        }));
      },

      deleteTranslationFolder: (id) => {
        set((state) => ({
          translationFolders: state.translationFolders.filter((f) => f.id !== id),
          // Move translations in this folder to uncategorized
          savedTranslations: state.savedTranslations.map((t) =>
            t.folderId === id ? { ...t, folderId: undefined } : t
          ),
        }));
      },

      moveTranslationToFolder: (translationId, folderId) => {
        set((state) => ({
          savedTranslations: state.savedTranslations.map((t) =>
            t.id === translationId ? { ...t, folderId, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      getTranslationsByFolder: (folderId) => {
        const state = get();
        if (folderId === undefined) {
          return state.savedTranslations.filter((t) => !t.folderId);
        }
        return state.savedTranslations.filter((t) => t.folderId === folderId);
      },

      getFavoriteTranslations: () => {
        return get().savedTranslations.filter((t) => t.isFavorite);
      },

      cacheTranslation: (sourceText, result, reading, romaji) => {
        const key = sourceText.toLowerCase().trim();
        set((state) => ({
          translationCache: {
            ...state.translationCache,
            [key]: { result, reading, romaji },
          },
        }));
      },

      getCachedTranslation: (sourceText) => {
        const key = sourceText.toLowerCase().trim();
        return get().translationCache[key] || null;
      },

      // Memory Worlds actions
      getActiveWorld: () => {
        const state = get();
        if (!state.activeWorldId) return state.worlds[0] || null;
        return state.worlds.find(w => w.id === state.activeWorldId) || null;
      },

      setActiveWorld: (worldId) => set({ activeWorldId: worldId }),

      addObjectToWorld: (worldId, word, photoUri, lessonId, coordinates) => {
        const state = get();
        let world = state.worlds.find(w => w.id === worldId);
        let targetWorldId = worldId;

        // Check if word already exists in any world
        const existsInWorld = state.worlds.some(w =>
          w.objects.some(obj => obj.wordId === word.id)
        );
        if (existsInWorld) return null;

        // If current world is full, create or find a world with space
        if (world && world.objectCount >= MAX_OBJECTS_PER_WORLD) {
          // Find existing world with space
          const worldWithSpace = state.worlds.find(w => w.objectCount < MAX_OBJECTS_PER_WORLD);

          if (worldWithSpace) {
            world = worldWithSpace;
            targetWorldId = worldWithSpace.id;
          } else {
            // Create new planet - find next available theme
            const usedTypes = state.worlds.map(w => w.type);
            const availableTheme = WORLD_THEMES.find(t => !usedTypes.includes(t.id as WorldType));

            if (availableTheme) {
              const newWorld = createDefaultWorld(availableTheme.id as WorldType);
              set((s) => ({
                worlds: [...s.worlds, newWorld],
                activeWorldId: newWorld.id,
              }));
              world = newWorld;
              targetWorldId = newWorld.id;
            } else {
              // All themes used, just add to current world anyway
            }
          }
        }

        if (!world) return null;

        // Get visual representation
        const visual = getObjectVisual(word.english);
        const rules = PLACEMENT_RULES[visual.category];

        // Calculate position based on layer and existing objects
        const layerObjects = world.objects.filter(
          obj => obj.position.layer === rules.preferredLayers[0]
        );
        const xOffset = (layerObjects.length * 15) % 70 + 15; // Spread across 15-85%
        const yBase = rules.preferredLayers[0] === 'back' ? 30 :
                      rules.preferredLayers[0] === 'middle' ? 50 :
                      rules.preferredLayers[0] === 'front' ? 70 :
                      rules.preferredLayers[0] === 'sky' ? 15 : 85;
        const yOffset = (Math.random() - 0.5) * 15;

        const position: PlacementPosition = {
          x: xOffset + (Math.random() - 0.5) * 10,
          y: yBase + yOffset,
          scale: rules.scaleRange[0] + Math.random() * (rules.scaleRange[1] - rules.scaleRange[0]),
          layer: rules.preferredLayers[0],
          zIndex: rules.preferredLayers[0] === 'sky' ? 10 :
                  rules.preferredLayers[0] === 'back' ? 20 :
                  rules.preferredLayers[0] === 'middle' ? 30 : 40,
        };

        const newObject: WorldObject = {
          id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          wordId: word.id,
          emoji: visual.emoji,
          displayName: word.japanese,
          english: word.english,
          reading: word.reading,
          descriptors: word.descriptors?.map(d => ({
            english: d.english,
            japanese: d.japanese,
            reading: d.reading,
          })),
          position,
          category: visual.category,
          coordinates,  // GPS location for map view
          photoUri,
          lessonId,
          masteryScore: word.masteryScore || 0,
          lastReviewed: word.lastReviewed,
          needsReview: word.masteryScore < 70,
          isNew: true,
          addedAt: new Date().toISOString(),
        };

        // Update world stage
        const newCount = world.objectCount + 1;
        const newStage = newCount >= MAX_OBJECTS_PER_WORLD ? 'flourishing' :
                         newCount >= 11 ? 'rich' :
                         newCount >= 4 ? 'growing' : 'empty';

        set((s) => ({
          worlds: s.worlds.map(w =>
            w.id === targetWorldId
              ? {
                  ...w,
                  objects: [...w.objects, newObject],
                  objectCount: newCount,
                  stage: newStage,
                }
              : w
          ),
        }));

        // Mark as not new after animation delay
        setTimeout(() => {
          set((s) => ({
            worlds: s.worlds.map(w =>
              w.id === worldId
                ? {
                    ...w,
                    objects: w.objects.map(obj =>
                      obj.id === newObject.id ? { ...obj, isNew: false } : obj
                    ),
                  }
                : w
            ),
          }));
        }, 2000);

        return newObject;
      },

      removeObjectFromWorld: (worldId, objectId) => {
        set((s) => ({
          worlds: s.worlds.map(w =>
            w.id === worldId
              ? {
                  ...w,
                  objects: w.objects.filter(obj => obj.id !== objectId),
                  objectCount: Math.max(0, w.objectCount - 1),
                }
              : w
          ),
        }));
      },

      selectObject: (objectId) => set({ selectedObjectId: objectId }),

      updateObjectMastery: (worldId, objectId, masteryScore) => {
        set((s) => ({
          worlds: s.worlds.map(w =>
            w.id === worldId
              ? {
                  ...w,
                  objects: w.objects.map(obj =>
                    obj.id === objectId
                      ? {
                          ...obj,
                          masteryScore,
                          needsReview: masteryScore < 70,
                        }
                      : obj
                  ),
                  masteredCount: w.objects.filter(obj =>
                    obj.id === objectId ? masteryScore >= 90 : obj.masteryScore >= 90
                  ).length,
                }
              : w
          ),
        }));
      },

      markObjectReviewed: (worldId, objectId, correct) => {
        const now = new Date().toISOString();
        set((s) => ({
          worlds: s.worlds.map(w =>
            w.id === worldId
              ? {
                  ...w,
                  objects: w.objects.map(obj =>
                    obj.id === objectId
                      ? {
                          ...obj,
                          lastReviewed: now,
                          masteryScore: correct
                            ? Math.min(100, obj.masteryScore + 15)
                            : Math.max(0, obj.masteryScore - 10),
                          needsReview: false,
                        }
                      : obj
                  ),
                }
              : w
          ),
        }));
      },

      getWorldObjects: (worldId) => {
        const world = get().worlds.find(w => w.id === worldId);
        return world?.objects || [];
      },

      getObjectsNeedingReview: (worldId) => {
        const world = get().worlds.find(w => w.id === worldId);
        if (!world) return [];
        return world.objects.filter(obj => obj.needsReview || obj.masteryScore < 70);
      },

      unlockWorld: (worldType) => {
        const state = get();
        const exists = state.worlds.some(w => w.type === worldType);
        if (exists) {
          // Just unlock it
          set((s) => ({
            worlds: s.worlds.map(w =>
              w.type === worldType ? { ...w, unlocked: true } : w
            ),
          }));
        } else {
          // Create new world
          const newWorld = createDefaultWorld(worldType);
          newWorld.unlocked = true;
          set((s) => ({
            worlds: [...s.worlds, newWorld],
          }));
        }
      },

      getUnlockedWorlds: () => {
        return get().worlds.filter(w => w.unlocked);
      },

      getAllWorldObjects: () => {
        return get().worlds.flatMap(w => w.objects);
      },

      isWordInAnyWorld: (wordId) => {
        return get().worlds.some(w => w.objects.some(obj => obj.wordId === wordId));
      },

      suggestWorldForObject: (_category) => {
        // With planet-based worlds, just use the active world or first available
        const state = get();
        const activeWorld = state.worlds.find(w => w.id === state.activeWorldId);
        if (activeWorld && activeWorld.objectCount < MAX_OBJECTS_PER_WORLD) {
          return activeWorld.type;
        }
        // Find first world with space
        const worldWithSpace = state.worlds.find(w => w.objectCount < MAX_OBJECTS_PER_WORLD);
        return worldWithSpace?.type || 'terra';
      },

      // ============ MEMORY PATH ACTIONS ============

      unlockSpot: (lesson, quizScore) => {
        const state = get();

        // Must have valid coordinates
        if (!lesson.coordinates?.latitude || !lesson.coordinates?.longitude) {
          if (__DEV__) console.log('Cannot unlock spot: no coordinates');
          return null;
        }

        // Check if spot already exists for this lesson
        if (state.memorySpots.some(s => s.lessonId === lesson.id)) {
          if (__DEV__) console.log('Spot already exists for this lesson');
          return null;
        }

        // Get main word (first word or one marked as main)
        const mainWord = lesson.words.find(w => w.isMainSubject) || lesson.words[0];
        if (!mainWord) return null;

        // Create new spot
        const spot: MemorySpot = {
          id: `spot-${Date.now()}`,
          lessonId: lesson.id,
          imageUri: lesson.imageUri,
          mainWord: {
            japanese: mainWord.japanese,
            english: mainWord.english,
            reading: mainWord.reading,
          },
          coordinates: {
            latitude: lesson.coordinates.latitude,
            longitude: lesson.coordinates.longitude,
          },
          unlockedAt: Date.now(),
          quizScore,
        };

        // Calculate distance from last spot (if exists)
        let path: MemoryPath | null = null;
        let milesEarned = 0;
        let stepsEarned = 0;
        const STEPS_PER_MILE = 2000;

        if (state.lastSpotId) {
          const lastSpot = state.memorySpots.find(s => s.id === state.lastSpotId);
          if (lastSpot) {
            // Calculate distance in miles using Haversine formula
            const R = 3959; // Earth's radius in miles
            const dLat = (spot.coordinates.latitude - lastSpot.coordinates.latitude) * Math.PI / 180;
            const dLon = (spot.coordinates.longitude - lastSpot.coordinates.longitude) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lastSpot.coordinates.latitude * Math.PI / 180) *
              Math.cos(spot.coordinates.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            milesEarned = Math.round(R * c * 10) / 10; // Round to 1 decimal
            stepsEarned = Math.round(milesEarned * STEPS_PER_MILE);

            // Create path connection
            path = {
              id: `path-${Date.now()}`,
              fromSpotId: lastSpot.id,
              toSpotId: spot.id,
              distanceMiles: milesEarned,
              distanceSteps: stepsEarned,
              createdAt: Date.now(),
            };
          }
        }

        // Update state including pending animation
        set((s) => ({
          memorySpots: [...s.memorySpots, spot],
          memoryPaths: path ? [...s.memoryPaths, path] : s.memoryPaths,
          totalMileage: s.totalMileage + milesEarned,
          totalSteps: s.totalSteps + stepsEarned,
          lastSpotId: spot.id,
          pendingMapAnimation: { spot, path, stepsEarned },
        }));

        return { spot, path, milesEarned, stepsEarned };
      },

      clearPendingMapAnimation: () => set({ pendingMapAnimation: null }),

      deleteSpot: (spotId) => {
        set((state) => {
          const spot = state.memorySpots.find(s => s.id === spotId);
          if (!spot) return state;

          // Find paths that connect to this spot
          const pathsToRemove = state.memoryPaths.filter(
            p => p.fromSpotId === spotId || p.toSpotId === spotId
          );

          // Calculate steps/miles to subtract
          const stepsToRemove = pathsToRemove.reduce((sum, p) => sum + (p.distanceSteps || 0), 0);
          const milesToRemove = pathsToRemove.reduce((sum, p) => sum + p.distanceMiles, 0);

          // Also delete the associated lesson
          const updatedLessons = state.lessons.filter(l => l.id !== spot.lessonId);

          return {
            memorySpots: state.memorySpots.filter(s => s.id !== spotId),
            memoryPaths: state.memoryPaths.filter(
              p => p.fromSpotId !== spotId && p.toSpotId !== spotId
            ),
            totalSteps: Math.max(0, state.totalSteps - stepsToRemove),
            totalMileage: Math.max(0, state.totalMileage - milesToRemove),
            lastSpotId: state.lastSpotId === spotId ? null : state.lastSpotId,
            lessons: updatedLessons,
          };
        });
      },

      getMemorySpots: () => get().memorySpots,

      getMemoryPaths: () => get().memoryPaths,

      getMemoryPathStats: () => {
        const state = get();
        const uniquePlaces = new Set<string>();

        state.memorySpots.forEach(spot => {
          // Could reverse geocode for actual place names, for now just count spots
        });

        const longestPath = state.memoryPaths.reduce(
          (max, p) => Math.max(max, p.distanceMiles),
          0
        );

        return {
          totalMileage: state.totalMileage,
          totalSteps: state.totalSteps,
          spotsUnlocked: state.memorySpots.length,
          longestPath,
          citiesVisited: Array.from(uniquePlaces),
        };
      },

      // Landmark Quest actions
      setActiveQuests: (quests) => set({
        activeQuests: quests,
        questsLastRefreshed: Date.now(),
      }),

      completeQuest: (questId, lessonId) => set((state) => {
        const quest = state.activeQuests.find(q => q.id === questId);
        if (!quest) return state;

        const completedQuest: LandmarkQuest = {
          ...quest,
          isCompleted: true,
          completedAt: Date.now(),
          photoLessonId: lessonId,
        };

        return {
          activeQuests: state.activeQuests.map(q =>
            q.id === questId ? completedQuest : q
          ),
          completedQuestIds: [...state.completedQuestIds, questId],
        };
      }),

      setActiveQuestBonus: (questId, xpBonus) => set({
        activeQuestBonus: { questId, xpBonus },
      }),

      clearActiveQuestBonus: () => set({
        activeQuestBonus: null,
      }),

      getActiveQuests: () => get().activeQuests.filter(q => !q.isCompleted),
    }),
    {
      name: 'photolingo-storage',
      version: 3, // Increment when schema changes
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Migrate old world types to new planet names
          const oldToNew: Record<string, WorldType> = {
            'home': 'terra',
            'restaurant': 'luna',
            'park': 'nova',
            'city': 'celestia',
            'school': 'aurora',
            'nature': 'solaris',
          };

          if (persistedState.worlds) {
            persistedState.worlds = persistedState.worlds.map((world: any) => ({
              ...world,
              type: oldToNew[world.type] || 'terra',
              name: WORLD_THEMES.find(t => t.id === (oldToNew[world.type] || 'terra'))?.name || 'Terra',
            }));
          }
        }

        // v3: Migrate absolute image paths to relative paths
        // iOS changes documentDirectory on app updates, so we need relative paths
        if (version < 3) {
          const toRelativePath = (uri: string): string => {
            if (!uri) return uri;
            // Extract filename from absolute path
            const match = uri.match(/(photo_[^/]+\.jpg)$/);
            if (match) {
              return `photos/${match[1]}`;
            }
            return uri;
          };

          // Migrate lesson imageUris
          if (persistedState.lessons) {
            persistedState.lessons = persistedState.lessons.map((lesson: any) => ({
              ...lesson,
              imageUri: toRelativePath(lesson.imageUri),
            }));
            if (__DEV__) console.log('[Migration] Converted lesson image paths to relative');
          }

          // Migrate world object photoUris
          if (persistedState.worlds) {
            persistedState.worlds = persistedState.worlds.map((world: any) => ({
              ...world,
              objects: (world.objects || []).map((obj: any) => ({
                ...obj,
                photoUri: toRelativePath(obj.photoUri),
              })),
            }));
            if (__DEV__) console.log('[Migration] Converted world object paths to relative');
          }

          // Migrate memory spot imageUris
          if (persistedState.memorySpots) {
            persistedState.memorySpots = persistedState.memorySpots.map((spot: any) => ({
              ...spot,
              imageUri: toRelativePath(spot.imageUri),
            }));
            if (__DEV__) console.log('[Migration] Converted memory spot paths to relative');
          }
        }

        return persistedState;
      },
      partialize: (state) => ({
        // Persist these fields
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        learningGoal: state.learningGoal,
        nativeLanguage: state.nativeLanguage,
        targetLanguage: state.targetLanguage,
        lessons: state.lessons,
        stats: state.stats,
        unlockedMilestones: state.unlockedMilestones,
        userSkills: state.userSkills,
        sentenceMasteryMap: state.sentenceMasteryMap,
        savedTranslations: state.savedTranslations,
        translationFolders: state.translationFolders,
        translationCache: state.translationCache,
        // Memory Worlds
        worlds: state.worlds,
        activeWorldId: state.activeWorldId,
        // Memory Path
        memorySpots: state.memorySpots,
        memoryPaths: state.memoryPaths,
        totalMileage: state.totalMileage,
        totalSteps: state.totalSteps,
        lastSpotId: state.lastSpotId,
        // Quests
        completedQuestIds: state.completedQuestIds,
        // Achievements
        unlockedAchievementIds: state.unlockedAchievementIds,
        // Don't persist: currentLesson, currentQuiz, quizIndex, quizResults,
        // pendingXP, dailyChallenges, currentPracticeSession, isAnalyzing, selectedObjectId, activeQuests
      }),
    }
  )
);
