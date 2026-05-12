// AI-Driven Language Memory Engine Types

export interface KnowledgeItem {
  id: string;
  japanese: string;
  english: string;
  reading?: string;
  romaji?: string;
  type: 'word' | 'phrase' | 'sentence';

  // Mastery tracking
  masteryLevel: number; // 0-100
  confidence: number; // AI confidence in user's knowledge

  // Performance metrics
  timesEncountered: number;
  timesCorrect: number;
  timesWrong: number;
  averageResponseTime: number; // ms

  // Pronunciation
  pronunciationScore: number; // 0-100
  pronunciationAttempts: number;

  // Spaced repetition
  lastSeen: string;
  nextReview: string;
  interval: number; // days
  easeFactor: number; // SM-2 algorithm

  // Context
  source: 'photo' | 'translate' | 'manual' | 'ai-suggested';
  photoUri?: string;
  tags: string[];

  createdAt: string;
  updatedAt: string;
}

export interface UserBrain {
  // Overall stats
  totalItems: number;
  knownItems: number; // masteryLevel > 70
  learningItems: number; // 30 < masteryLevel <= 70
  newItems: number; // masteryLevel <= 30

  // Category breakdowns
  vocabulary: {
    nouns: number;
    verbs: number;
    adjectives: number;
    other: number;
  };

  // Skill levels (0-100)
  skills: {
    reading: number;
    listening: number;
    speaking: number;
    writing: number;
    grammar: number;
  };

  // Weaknesses (for AI to target)
  weakAreas: string[];
  strongAreas: string[];

  // Learning patterns
  preferredLearningTime: string; // "morning" | "afternoon" | "evening" | "night"
  averageSessionLength: number; // minutes
  consistencyScore: number; // 0-100

  // JLPT level estimate
  estimatedLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'Beginner';
}

export interface DailyGoal {
  id: string;
  date: string;
  type: 'xp' | 'words' | 'practice' | 'streak';
  target: number;
  current: number;
  completed: boolean;
  xpReward: number;

  // AI-generated based on user patterns
  isPersonalized: boolean;
  reason?: string; // Why AI chose this goal
}

export interface PracticeSession {
  id: string;
  type: 'quick' | 'focused' | 'review' | 'challenge';

  // AI-selected items
  items: string[]; // KnowledgeItem IDs
  targetSkill: 'reading' | 'listening' | 'speaking' | 'mixed';

  // Difficulty
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  estimatedMinutes: number;

  // Results
  startedAt?: string;
  completedAt?: string;
  score?: number;
  xpEarned?: number;
}

export interface AIRecommendation {
  id: string;
  type: 'practice' | 'review' | 'learn' | 'challenge';
  title: string;
  reason: string; // AI explanation
  priority: 'high' | 'medium' | 'low';
  items?: string[]; // Related item IDs
  xpReward: number;
  estimatedMinutes: number;
}

// Helper functions
export function calculateMasteryLevel(item: Partial<KnowledgeItem>): number {
  const correctRate = item.timesEncountered
    ? (item.timesCorrect || 0) / item.timesEncountered
    : 0;
  const pronunciationBonus = ((item.pronunciationScore || 0) / 100) * 20;
  const recencyBonus = item.lastSeen
    ? Math.max(0, 10 - daysSince(item.lastSeen))
    : 0;

  return Math.min(100, Math.round(correctRate * 70 + pronunciationBonus + recencyBonus));
}

export function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function getNextReviewDate(item: KnowledgeItem, correct: boolean): string {
  // SM-2 inspired algorithm
  let newInterval = item.interval;
  let newEase = item.easeFactor;

  if (correct) {
    if (item.interval === 0) newInterval = 1;
    else if (item.interval === 1) newInterval = 3;
    else newInterval = Math.round(item.interval * newEase);

    newEase = Math.max(1.3, newEase + 0.1);
  } else {
    newInterval = 1;
    newEase = Math.max(1.3, newEase - 0.2);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + newInterval);
  return nextDate.toISOString().split('T')[0];
}

export const JLPT_THRESHOLDS = {
  Beginner: { vocab: 0, grammar: 0 },
  N5: { vocab: 100, grammar: 20 },
  N4: { vocab: 300, grammar: 40 },
  N3: { vocab: 600, grammar: 60 },
  N2: { vocab: 1000, grammar: 80 },
  N1: { vocab: 2000, grammar: 95 },
};

export function estimateJLPTLevel(brain: UserBrain): UserBrain['estimatedLevel'] {
  const vocab = brain.knownItems;
  const grammar = brain.skills.grammar;

  if (vocab >= 2000 && grammar >= 95) return 'N1';
  if (vocab >= 1000 && grammar >= 80) return 'N2';
  if (vocab >= 600 && grammar >= 60) return 'N3';
  if (vocab >= 300 && grammar >= 40) return 'N4';
  if (vocab >= 100 && grammar >= 20) return 'N5';
  return 'Beginner';
}
