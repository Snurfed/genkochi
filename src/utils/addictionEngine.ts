// Addiction Engine - Core Loop Logic
// Trigger → Action → Reward → Risk → Return

import { Word, LearningGoal, LEARNING_GOALS } from '../types';

export interface UserState {
  urgencyLevel: 'critical' | 'warning' | 'calm';
  primaryAction: PrimaryAction;
  secondaryHook: string;
  returnReason: string;
  contextLesson?: ContextLesson; // The lesson with fading words (for photo thumbnail)
}

export interface PrimaryAction {
  type: 'save' | 'capture' | 'streak' | 'unlock';
  headline: string;
  subtext: string;
  buttonText: string;
  xpReward: number;
  timeEstimate: number; // seconds
  wordsAtRisk?: DecayingWordSimple[];
}

export interface DecayingWordSimple {
  id: string;
  japanese: string;
  english: string;
  strength: number;
  hoursLeft: number;
  lessonId: string;
}

export interface ContextLesson {
  id: string;
  location: string;
  imageUri: string;
  wordCount: number;
}

// Core decay calculation - aggressive for engagement
export function calculateDecay(lastReviewed: string | undefined, masteryScore: number): number {
  if (!lastReviewed) return 40; // New words start at 40%

  const hours = (Date.now() - new Date(lastReviewed).getTime()) / (1000 * 60 * 60);

  // Aggressive decay:
  // - Low mastery words decay in ~12 hours
  // - High mastery words decay in ~48 hours
  const decayRate = 100 / (12 + (masteryScore / 100) * 36);

  return Math.max(0, Math.min(100, 100 - hours * decayRate));
}

export function getDecayingWords(
  words: Array<{ word: Word; lessonId: string }>,
  limit: number = 5
): DecayingWordSimple[] {
  return words
    .map(({ word, lessonId }) => ({
      id: word.id,
      japanese: word.japanese,
      english: word.english,
      strength: calculateDecay(word.lastReviewed, word.masteryScore),
      hoursLeft: getHoursUntilGone(word.lastReviewed, word.masteryScore),
      lessonId,
    }))
    .filter(w => w.strength < 70) // Only show words that need attention
    .sort((a, b) => a.strength - b.strength)
    .slice(0, limit);
}

function getHoursUntilGone(lastReviewed: string | undefined, masteryScore: number): number {
  const currentStrength = calculateDecay(lastReviewed, masteryScore);
  const decayRate = 100 / (12 + (masteryScore / 100) * 36);
  return Math.max(0, Math.round(currentStrength / decayRate));
}

export interface LessonContext {
  id: string;
  location?: string;
  imageUri: string;
}

// Determine what the user should do RIGHT NOW
export function getUserState(
  words: Array<{ word: Word; lessonId: string }>,
  streak: number,
  totalWords: number,
  lastActive: string,
  learningGoal?: LearningGoal | null,
  lessons?: LessonContext[]
): UserState {
  const decaying = getDecayingWords(words, 5);
  const criticalCount = decaying.filter(w => w.strength < 30).length;
  const fadingCount = decaying.filter(w => w.strength < 50).length;

  // Get the lesson with the most fading words for context
  const lessonWordCounts: Record<string, { count: number; lesson?: LessonContext }> = {};
  decaying.forEach(w => {
    if (!lessonWordCounts[w.lessonId]) {
      lessonWordCounts[w.lessonId] = { count: 0, lesson: lessons?.find(l => l.id === w.lessonId) };
    }
    lessonWordCounts[w.lessonId].count++;
  });

  const topLessonEntry = Object.entries(lessonWordCounts)
    .sort((a, b) => b[1].count - a[1].count)[0];

  const contextLesson = topLessonEntry?.[1].lesson ? {
    id: topLessonEntry[1].lesson.id,
    location: topLessonEntry[1].lesson.location || 'your photo',
    imageUri: topLessonEntry[1].lesson.imageUri,
    wordCount: topLessonEntry[1].count,
  } : undefined;

  // Check streak at risk
  const hoursSinceActive = lastActive
    ? (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60)
    : 24;
  const streakAtRisk = streak > 0 && hoursSinceActive > 20;

  // Get goal info for personalization
  const goalInfo = learningGoal ? LEARNING_GOALS.find(g => g.id === learningGoal) : null;

  // CRITICAL: Words about to be lost
  if (criticalCount > 0) {
    const contextName = contextLesson?.location || 'your';
    return {
      urgencyLevel: 'critical',
      primaryAction: {
        type: 'save',
        headline: contextLesson
          ? `Your ${contextName} words need you`
          : `${criticalCount} word${criticalCount > 1 ? 's are' : ' is'} fading`,
        subtext: '',
        buttonText: 'Save them',
        xpReward: criticalCount * 20,
        timeEstimate: Math.max(15, criticalCount * 5),
        wordsAtRisk: decaying.filter(w => w.strength < 30),
      },
      secondaryHook: '',
      returnReason: 'Review now before they disappear',
      contextLesson,
    };
  }

  // WARNING: Streak at risk
  if (streakAtRisk) {
    return {
      urgencyLevel: 'warning',
      primaryAction: {
        type: 'streak',
        headline: `${streak}-day streak at risk`,
        subtext: '',
        buttonText: 'Keep streak',
        xpReward: 30 + streak * 5,
        timeEstimate: 20,
        wordsAtRisk: decaying.slice(0, 3),
      },
      secondaryHook: '',
      returnReason: 'Practice once to save it',
      contextLesson,
    };
  }

  // WARNING: Words fading
  if (fadingCount > 0) {
    const contextName = contextLesson?.location || 'your';
    return {
      urgencyLevel: 'warning',
      primaryAction: {
        type: 'save',
        headline: contextLesson
          ? `Your ${contextName} words are fading`
          : `${fadingCount} word${fadingCount > 1 ? 's are' : ' is'} fading`,
        subtext: '',
        buttonText: 'Save them',
        xpReward: fadingCount * 15,
        timeEstimate: Math.max(15, fadingCount * 5),
        wordsAtRisk: decaying,
      },
      secondaryHook: '',
      returnReason: 'They get harder to remember over time',
      contextLesson,
    };
  }

  // CALM: New user - first time
  if (totalWords === 0) {
    const goalHeadline = goalInfo
      ? `${goalInfo.emoji} Your ${goalInfo.title.toLowerCase().replace('ing to japan', ' to Japan').replace('ing in japan', ' in Japan')} starts here`
      : 'Learn your first 5 Japanese words';

    return {
      urgencyLevel: 'calm',
      primaryAction: {
        type: 'capture',
        headline: goalHeadline,
        subtext: 'Point at anything around you',
        buttonText: 'Start capturing',
        xpReward: 50,
        timeEstimate: 15,
      },
      secondaryHook: 'Your first words come from YOUR world',
      returnReason: "0 of 100 words to order food",
    };
  }

  // CALM: Exploration state
  if (totalWords < 30) {
    const nextMilestone = getNextMilestone(totalWords);
    return {
      urgencyLevel: 'calm',
      primaryAction: {
        type: 'capture',
        headline: 'Discover new words around you',
        subtext: '',
        buttonText: 'Capture',
        xpReward: 50,
        timeEstimate: 15,
      },
      secondaryHook: '',
      returnReason: `${nextMilestone.wordsNeeded} more to "${nextMilestone.name}"`,
    };
  }

  // CALM: Encourage unlock
  const nextMilestone = getNextMilestone(totalWords);
  return {
    urgencyLevel: 'calm',
    primaryAction: {
      type: 'unlock',
      headline: `${nextMilestone.wordsNeeded} words to unlock`,
      subtext: nextMilestone.name,
      buttonText: 'Capture more',
      xpReward: 50,
      timeEstimate: 30,
    },
    secondaryHook: '',
    returnReason: 'Your words will start fading in a few hours',
  };
}

function getNextMilestone(knownWords: number): { name: string; wordsNeeded: number } {
  const milestones = [
    { name: 'Say Hello', words: 5 },
    { name: 'Order Food', words: 30 },
    { name: 'Ask Directions', words: 50 },
    { name: 'Go Shopping', words: 100 },
    { name: 'Basic Conversation', words: 200 },
    { name: 'Travel Japan Solo', words: 500 },
  ];

  for (const m of milestones) {
    if (knownWords < m.words) {
      return { name: m.name, wordsNeeded: m.words - knownWords };
    }
  }
  return { name: 'Fluency', wordsNeeded: 1000 - knownWords };
}

// MICROCOPY BANK - Urgency-focused language
export const MICROCOPY = {
  // Critical urgency
  critical: {
    headlines: [
      'About to forget',
      'Memory fading fast',
      'Last chance to save',
      'Slipping away',
    ],
    buttons: [
      'Save now',
      'Quick save',
      'Rescue them',
      'Lock in',
    ],
  },
  // Warning
  warning: {
    headlines: [
      'Getting weaker',
      'Needs attention',
      'Losing strength',
      'Time to review',
    ],
    buttons: [
      'Strengthen',
      'Review',
      'Practice',
      'Lock in',
    ],
  },
  // Reward
  reward: {
    success: [
      'Locked in!',
      'Saved!',
      'Memory strengthened!',
      'Got it!',
    ],
    streak: [
      'Streak alive!',
      'On fire!',
      'Unstoppable!',
    ],
  },
  // Return hooks
  returnHooks: [
    'Come back in 2 hours to keep them strong',
    'More words will need attention soon',
    'Don\'t let today\'s progress fade',
    'Your streak depends on tomorrow',
  ],
};

// Calculate "understanding percentage"
export function getUnderstandingPercent(masteredWords: number): number {
  // Based on frequency lists:
  // 100 words = ~50% of daily conversation
  // 500 words = ~75% of daily conversation
  // 1000 words = ~85% of daily conversation
  if (masteredWords === 0) return 0;
  if (masteredWords < 100) return Math.round((masteredWords / 100) * 50);
  if (masteredWords < 500) return 50 + Math.round(((masteredWords - 100) / 400) * 25);
  if (masteredWords < 1000) return 75 + Math.round(((masteredWords - 500) / 500) * 10);
  return Math.min(95, 85 + Math.round((masteredWords - 1000) / 200));
}
