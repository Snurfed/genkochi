// Memory Decay System
// Words lose strength over time if not reviewed

import { Word } from '../types';

export interface DecayingWord {
  word: Word;
  lessonId: string;
  photoUri: string;
  decayLevel: 'critical' | 'fading' | 'stable';
  hoursUntilForgotten: number;
  currentStrength: number; // 0-100
}

// Ebbinghaus forgetting curve approximation
export function calculateMemoryStrength(word: Word): number {
  if (!word.lastReviewed) {
    // Never reviewed - use creation time estimate
    const hoursSinceCreated = 24; // assume 1 day old
    return Math.max(0, 100 - hoursSinceCreated * 2);
  }

  const lastReview = new Date(word.lastReviewed);
  const now = new Date();
  const hoursSinceReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60);

  // Base decay rate modified by mastery
  const masteryMultiplier = word.masteryScore / 100;
  const decayRate = 2 - masteryMultiplier; // Higher mastery = slower decay

  // Strength decreases over time
  const strength = Math.max(0, 100 - hoursSinceReview * decayRate);

  return Math.round(strength);
}

export function getDecayLevel(strength: number): 'critical' | 'fading' | 'stable' {
  if (strength <= 30) return 'critical';
  if (strength <= 60) return 'fading';
  return 'stable';
}

export function getHoursUntilForgotten(strength: number, masteryScore: number): number {
  if (strength <= 0) return 0;

  const masteryMultiplier = masteryScore / 100;
  const decayRate = 2 - masteryMultiplier;

  return Math.round(strength / decayRate);
}

export function getDecayingWords(
  lessons: Array<{ id: string; imageUri: string; words: Word[] }>,
  limit: number = 5
): DecayingWord[] {
  const decayingWords: DecayingWord[] = [];

  for (const lesson of lessons) {
    for (const word of lesson.words) {
      const strength = calculateMemoryStrength(word);
      const level = getDecayLevel(strength);

      // Only include words that aren't mastered and are decaying
      if (word.masteryScore < 90 && level !== 'stable') {
        decayingWords.push({
          word,
          lessonId: lesson.id,
          photoUri: lesson.imageUri,
          decayLevel: level,
          hoursUntilForgotten: getHoursUntilForgotten(strength, word.masteryScore),
          currentStrength: strength,
        });
      }
    }
  }

  // Sort by urgency (critical first, then by hours until forgotten)
  return decayingWords
    .sort((a, b) => {
      if (a.decayLevel === 'critical' && b.decayLevel !== 'critical') return -1;
      if (b.decayLevel === 'critical' && a.decayLevel !== 'critical') return 1;
      return a.hoursUntilForgotten - b.hoursUntilForgotten;
    })
    .slice(0, limit);
}

export function getUrgencyMessage(decayingWords: DecayingWord[]): {
  headline: string;
  subtext: string;
  urgency: 'critical' | 'warning' | 'none';
} {
  const criticalCount = decayingWords.filter(w => w.decayLevel === 'critical').length;
  const fadingCount = decayingWords.filter(w => w.decayLevel === 'fading').length;

  if (criticalCount > 0) {
    return {
      headline: `${criticalCount} word${criticalCount > 1 ? 's' : ''} about to fade`,
      subtext: `${Math.min(30, criticalCount * 10)} seconds to lock them in`,
      urgency: 'critical',
    };
  }

  if (fadingCount > 0) {
    return {
      headline: `${fadingCount} word${fadingCount > 1 ? 's' : ''} losing strength`,
      subtext: 'Quick review will save them',
      urgency: 'warning',
    };
  }

  return {
    headline: 'Your memory is strong',
    subtext: 'Capture something new to learn',
    urgency: 'none',
  };
}
