/**
 * Spaced Repetition System (SRS) Implementation
 *
 * Based on SM-2 algorithm with modifications for visual learning.
 *
 * Key concepts:
 * - Interval: Hours until next review
 * - EaseFactor: Multiplier for interval growth (2.5 default, 1.3 minimum)
 * - Repetitions: Consecutive correct answers
 * - Quality: How well the user answered (0-5 scale)
 */

// Quality ratings for review responses
export type ReviewQuality =
  | 0  // Complete blackout, no recognition
  | 1  // Wrong answer, but recognized after seeing correct
  | 2  // Wrong answer, but "I knew it!"
  | 3  // Correct with significant difficulty
  | 4  // Correct with some hesitation
  | 5; // Perfect, instant recall

// SRS data for a word
export interface SRSData {
  interval: number;        // Hours until next review
  easeFactor: number;      // Multiplier (1.3 - 2.5+)
  repetitions: number;     // Consecutive correct answers
  lastReviewed: string;    // ISO timestamp
  nextReview: string;      // ISO timestamp
}

// Default values for new words
export const DEFAULT_SRS: SRSData = {
  interval: 4,             // First review in 4 hours
  easeFactor: 2.5,
  repetitions: 0,
  lastReviewed: new Date().toISOString(),
  nextReview: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
};

// Interval schedule for first few reviews (in hours)
const INITIAL_INTERVALS = [
  4,      // Review 1: 4 hours
  24,     // Review 2: 1 day
  72,     // Review 3: 3 days
  168,    // Review 4: 7 days
  336,    // Review 5: 14 days
  720,    // Review 6: 30 days
];

/**
 * Calculate new SRS values after a review
 */
export function processReview(
  current: SRSData,
  quality: ReviewQuality
): SRSData {
  const now = new Date();

  // Quality < 3 means incorrect - reset repetitions
  if (quality < 3) {
    const newInterval = Math.max(1, current.interval * 0.5); // Cut interval in half
    return {
      interval: newInterval,
      easeFactor: Math.max(1.3, current.easeFactor - 0.2),
      repetitions: 0,
      lastReviewed: now.toISOString(),
      nextReview: new Date(now.getTime() + newInterval * 60 * 60 * 1000).toISOString(),
    };
  }

  // Correct answer - advance the schedule
  const newRepetitions = current.repetitions + 1;

  // Calculate new ease factor using SM-2 formula
  const newEaseFactor = Math.max(
    1.3,
    current.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate new interval
  let newInterval: number;

  if (newRepetitions <= INITIAL_INTERVALS.length) {
    // Use predefined schedule for first few reviews
    newInterval = INITIAL_INTERVALS[newRepetitions - 1];

    // Adjust based on ease factor and quality
    if (quality === 5) {
      newInterval *= 1.1; // Bonus for perfect recall
    } else if (quality === 3) {
      newInterval *= 0.9; // Slight penalty for difficulty
    }
  } else {
    // Beyond initial schedule - use ease factor
    newInterval = current.interval * newEaseFactor;

    // Quality adjustments
    if (quality === 5) {
      newInterval *= 1.1;
    } else if (quality === 3) {
      newInterval *= 0.85;
    }
  }

  // Cap at 180 days (4320 hours)
  newInterval = Math.min(newInterval, 4320);

  return {
    interval: Math.round(newInterval),
    easeFactor: Math.round(newEaseFactor * 100) / 100,
    repetitions: newRepetitions,
    lastReviewed: now.toISOString(),
    nextReview: new Date(now.getTime() + newInterval * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Convert flashcard answer to quality score
 * - correct + fast = 5
 * - correct + normal = 4
 * - correct + slow/hesitant = 3
 * - incorrect but close = 2
 * - incorrect = 1
 * - skipped/no idea = 0
 */
export function getQualityFromAnswer(
  isCorrect: boolean,
  responseTimeMs?: number,
  wasSkipped?: boolean
): ReviewQuality {
  if (wasSkipped) return 0;

  if (!isCorrect) {
    // Could add "was close" logic here
    return 1;
  }

  // Correct answer - evaluate speed
  if (!responseTimeMs) return 4;

  if (responseTimeMs < 2000) return 5;      // Under 2s = instant recall
  if (responseTimeMs < 5000) return 4;      // Under 5s = good
  return 3;                                  // Slow but correct
}

/**
 * Calculate memory strength as a percentage (0-100)
 * Based on time remaining until next review
 *
 * 100% = just reviewed
 * 50% = halfway to next review
 * 0% = due for review
 * Negative values = overdue (clamped to 0)
 */
export function getMemoryStrength(srs: SRSData): number {
  const now = Date.now();
  const lastReview = new Date(srs.lastReviewed).getTime();
  const nextReview = new Date(srs.nextReview).getTime();

  const totalInterval = nextReview - lastReview;
  const elapsed = now - lastReview;

  if (totalInterval <= 0) return 0;

  const remaining = Math.max(0, totalInterval - elapsed);
  const strength = (remaining / totalInterval) * 100;

  return Math.round(Math.max(0, Math.min(100, strength)));
}

/**
 * Get memory status label based on strength
 */
export type MemoryStatusSRS = 'fresh' | 'strong' | 'fading' | 'weak' | 'due';

export function getMemoryStatusFromSRS(srs: SRSData): MemoryStatusSRS {
  const strength = getMemoryStrength(srs);
  const now = Date.now();
  const nextReview = new Date(srs.nextReview).getTime();

  // Check if overdue
  if (now >= nextReview) return 'due';

  if (strength >= 80) return 'fresh';
  if (strength >= 50) return 'strong';
  if (strength >= 25) return 'fading';
  return 'weak';
}

/**
 * Get hours until next review (negative if overdue)
 */
export function getHoursUntilReview(srs: SRSData): number {
  const now = Date.now();
  const nextReview = new Date(srs.nextReview).getTime();
  return Math.round((nextReview - now) / (1000 * 60 * 60));
}

/**
 * Check if a word is due for review
 */
export function isDueForReview(srs: SRSData): boolean {
  return new Date(srs.nextReview).getTime() <= Date.now();
}

/**
 * Get a human-readable description of next review
 */
export function getNextReviewText(srs: SRSData): string {
  const hours = getHoursUntilReview(srs);

  if (hours <= 0) return 'Due now';
  if (hours < 1) return 'Due soon';
  if (hours < 24) return `In ${hours}h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;

  const weeks = Math.round(days / 7);
  if (weeks === 1) return 'In 1 week';
  if (weeks < 4) return `In ${weeks} weeks`;

  const months = Math.round(days / 30);
  if (months === 1) return 'In 1 month';
  return `In ${months} months`;
}

/**
 * Calculate aggregate memory strength for a lesson (average of all words)
 */
export function getLessonMemoryStrength(words: { srs?: SRSData }[]): number {
  if (words.length === 0) return 100;

  const validWords = words.filter(w => w.srs);
  if (validWords.length === 0) return 100; // No SRS data yet = fresh

  const totalStrength = validWords.reduce(
    (sum, w) => sum + getMemoryStrength(w.srs!),
    0
  );

  return Math.round(totalStrength / validWords.length);
}

/**
 * Get words that are due or nearly due for review
 */
export function getWordsNeedingReview<T extends { srs?: SRSData }>(
  words: T[],
  includeUpcoming: boolean = true
): T[] {
  const now = Date.now();
  const upcomingWindow = 4 * 60 * 60 * 1000; // 4 hours

  return words.filter(w => {
    if (!w.srs) return true; // New word, needs initial review

    const nextReview = new Date(w.srs.nextReview).getTime();

    if (nextReview <= now) return true; // Due
    if (includeUpcoming && nextReview <= now + upcomingWindow) return true; // Nearly due

    return false;
  });
}

/**
 * Sort words by review priority
 * Most overdue first, then by strength
 */
export function sortByReviewPriority<T extends { srs?: SRSData }>(words: T[]): T[] {
  return [...words].sort((a, b) => {
    // Words without SRS data come first (need initial learning)
    if (!a.srs && !b.srs) return 0;
    if (!a.srs) return -1;
    if (!b.srs) return 1;

    // Then sort by next review time (overdue first)
    const aNext = new Date(a.srs.nextReview).getTime();
    const bNext = new Date(b.srs.nextReview).getTime();
    return aNext - bNext;
  });
}

/**
 * Create initial SRS data for a new word
 */
export function createInitialSRS(): SRSData {
  const now = new Date();
  return {
    interval: 4, // 4 hours
    easeFactor: 2.5,
    repetitions: 0,
    lastReviewed: now.toISOString(),
    nextReview: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Migrate old word data to SRS format
 * Estimates SRS values from existing mastery data
 */
export function migrateToSRS(word: {
  masteryScore?: number;
  timesCorrect?: number;
  lastReviewed?: string;
  interval?: number;
}): SRSData {
  const now = new Date();
  const masteryScore = word.masteryScore ?? 0;
  const timesCorrect = word.timesCorrect ?? 0;

  // Estimate ease factor from mastery
  const easeFactor = 2.0 + (masteryScore / 100) * 0.5; // 2.0 - 2.5

  // Estimate repetitions from times correct
  const repetitions = Math.min(timesCorrect, INITIAL_INTERVALS.length);

  // Estimate interval from mastery and repetitions
  let interval = word.interval ?? 4;
  if (interval < 1) {
    interval = repetitions > 0
      ? INITIAL_INTERVALS[Math.min(repetitions - 1, INITIAL_INTERVALS.length - 1)]
      : 4;
  }

  // Calculate next review based on last review
  const lastReviewed = word.lastReviewed
    ? new Date(word.lastReviewed)
    : new Date(now.getTime() - interval * 60 * 60 * 1000);

  const nextReview = new Date(lastReviewed.getTime() + interval * 60 * 60 * 1000);

  return {
    interval: Math.round(interval),
    easeFactor: Math.round(easeFactor * 100) / 100,
    repetitions,
    lastReviewed: lastReviewed.toISOString(),
    nextReview: nextReview.toISOString(),
  };
}
