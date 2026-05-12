import { UserStats, PhotoLesson } from './index';

export type AchievementCategory =
  | 'vocabulary'
  | 'memory'
  | 'streak'
  | 'exploration'
  | 'mastery';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xpReward: number;
  requirement: (stats: UserStats, lessons: PhotoLesson[], extra?: any) => boolean;
  progress?: (stats: UserStats, lessons: PhotoLesson[], extra?: any) => { current: number; target: number };
}

// Helper to count words by mastery
const countMasteredWords = (lessons: PhotoLesson[]) =>
  lessons.reduce((sum, l) => sum + l.words.filter(w => w.mastery === 'mastered').length, 0);

// Helper to check if all memories are fresh
const allMemoriesFresh = (lessons: PhotoLesson[]) =>
  lessons.length > 0 && lessons.every(l => (l.memoryStrength ?? 100) >= 90);

// Helper to count consecutive days with all fresh memories
const getFreshMemoryStreak = (lessons: PhotoLesson[]) => {
  if (lessons.length === 0) return 0;
  const now = new Date();
  let streak = 0;

  // Check if currently all fresh
  if (allMemoriesFresh(lessons)) {
    streak = 1;
    // This is simplified - in production you'd track historical data
  }
  return streak;
};

// Helper to get unique photo categories from lessons
const getUniqueCategories = (lessons: PhotoLesson[]) => {
  const categories = new Set<string>();
  lessons.forEach(l => {
    if (l.category) {
      categories.add(l.category);
    }
  });
  return categories;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ============================================
  // VOCABULARY ACHIEVEMENTS
  // ============================================
  {
    id: 'first-word',
    title: 'First Word',
    description: 'Learn your first vocabulary word',
    icon: 'book-outline',
    category: 'vocabulary',
    xpReward: 10,
    requirement: (s) => s.totalWords >= 1,
    progress: (s) => ({ current: Math.min(s.totalWords, 1), target: 1 }),
  },
  {
    id: 'word-collector-10',
    title: 'Word Collector',
    description: 'Learn 10 vocabulary words',
    icon: 'book',
    category: 'vocabulary',
    xpReward: 25,
    requirement: (s) => s.totalWords >= 10,
    progress: (s) => ({ current: Math.min(s.totalWords, 10), target: 10 }),
  },
  {
    id: 'vocab-builder-25',
    title: 'Vocab Builder',
    description: 'Learn 25 vocabulary words',
    icon: 'library-outline',
    category: 'vocabulary',
    xpReward: 50,
    requirement: (s) => s.totalWords >= 25,
    progress: (s) => ({ current: Math.min(s.totalWords, 25), target: 25 }),
  },
  {
    id: 'word-scholar-50',
    title: 'Word Scholar',
    description: 'Learn 50 vocabulary words',
    icon: 'library',
    category: 'vocabulary',
    xpReward: 100,
    requirement: (s) => s.totalWords >= 50,
    progress: (s) => ({ current: Math.min(s.totalWords, 50), target: 50 }),
  },
  {
    id: 'vocabulary-master-100',
    title: 'Vocabulary Master',
    description: 'Learn 100 vocabulary words',
    icon: 'school',
    category: 'vocabulary',
    xpReward: 200,
    requirement: (s) => s.totalWords >= 100,
    progress: (s) => ({ current: Math.min(s.totalWords, 100), target: 100 }),
  },
  {
    id: 'polyglot-250',
    title: 'Polyglot',
    description: 'Learn 250 vocabulary words',
    icon: 'trophy',
    category: 'vocabulary',
    xpReward: 500,
    requirement: (s) => s.totalWords >= 250,
    progress: (s) => ({ current: Math.min(s.totalWords, 250), target: 250 }),
  },

  // ============================================
  // MASTERY ACHIEVEMENTS
  // ============================================
  {
    id: 'first-mastery',
    title: 'First Mastery',
    description: 'Master your first word',
    icon: 'star-outline',
    category: 'mastery',
    xpReward: 25,
    requirement: (s) => s.masteredWords >= 1,
    progress: (s) => ({ current: Math.min(s.masteredWords, 1), target: 1 }),
  },
  {
    id: 'mastery-5',
    title: 'Getting Good',
    description: 'Master 5 words',
    icon: 'star-half',
    category: 'mastery',
    xpReward: 50,
    requirement: (s) => s.masteredWords >= 5,
    progress: (s) => ({ current: Math.min(s.masteredWords, 5), target: 5 }),
  },
  {
    id: 'mastery-25',
    title: 'Word Expert',
    description: 'Master 25 words',
    icon: 'star',
    category: 'mastery',
    xpReward: 150,
    requirement: (s) => s.masteredWords >= 25,
    progress: (s) => ({ current: Math.min(s.masteredWords, 25), target: 25 }),
  },
  {
    id: 'mastery-100',
    title: 'Language Pro',
    description: 'Master 100 words',
    icon: 'medal',
    category: 'mastery',
    xpReward: 400,
    requirement: (s) => s.masteredWords >= 100,
    progress: (s) => ({ current: Math.min(s.masteredWords, 100), target: 100 }),
  },

  // ============================================
  // MEMORY PALACE ACHIEVEMENTS
  // ============================================
  {
    id: 'first-photo',
    title: 'First Snapshot',
    description: 'Take your first photo',
    icon: 'camera-outline',
    category: 'memory',
    xpReward: 10,
    requirement: (s) => s.totalPhotos >= 1,
    progress: (s) => ({ current: Math.min(s.totalPhotos, 1), target: 1 }),
  },
  {
    id: 'photo-collector-5',
    title: 'Photo Collector',
    description: 'Build a collection of 5 photos',
    icon: 'camera',
    category: 'memory',
    xpReward: 30,
    requirement: (s) => s.totalPhotos >= 5,
    progress: (s) => ({ current: Math.min(s.totalPhotos, 5), target: 5 }),
  },
  {
    id: 'memory-keeper-10',
    title: 'Memory Keeper',
    description: 'Build a collection of 10 photos',
    icon: 'images',
    category: 'memory',
    xpReward: 75,
    requirement: (s) => s.totalPhotos >= 10,
    progress: (s) => ({ current: Math.min(s.totalPhotos, 10), target: 10 }),
  },
  {
    id: 'palace-builder-25',
    title: 'Palace Builder',
    description: 'Build a collection of 25 photos',
    icon: 'albums',
    category: 'memory',
    xpReward: 200,
    requirement: (s) => s.totalPhotos >= 25,
    progress: (s) => ({ current: Math.min(s.totalPhotos, 25), target: 25 }),
  },
  {
    id: 'memory-fresh',
    title: 'Fresh Mind',
    description: 'Keep all memories fresh (90%+ strength)',
    icon: 'sparkles',
    category: 'memory',
    xpReward: 50,
    requirement: (s, lessons) => allMemoriesFresh(lessons),
  },
  {
    id: 'review-streak-3',
    title: 'Consistent Reviewer',
    description: 'Review memories 3 days in a row',
    icon: 'repeat',
    category: 'memory',
    xpReward: 40,
    requirement: (s) => s.reviewStreak >= 3 || s.longestReviewStreak >= 3,
    progress: (s) => ({ current: Math.min(Math.max(s.reviewStreak, s.longestReviewStreak), 3), target: 3 }),
  },
  {
    id: 'review-streak-7',
    title: 'Memory Champion',
    description: 'Review memories 7 days in a row',
    icon: 'ribbon',
    category: 'memory',
    xpReward: 100,
    requirement: (s) => s.reviewStreak >= 7 || s.longestReviewStreak >= 7,
    progress: (s) => ({ current: Math.min(Math.max(s.reviewStreak, s.longestReviewStreak), 7), target: 7 }),
  },
  {
    id: 'review-streak-30',
    title: 'Memory Master',
    description: 'Review memories 30 days in a row',
    icon: 'diamond',
    category: 'memory',
    xpReward: 500,
    requirement: (s) => s.reviewStreak >= 30 || s.longestReviewStreak >= 30,
    progress: (s) => ({ current: Math.min(Math.max(s.reviewStreak, s.longestReviewStreak), 30), target: 30 }),
  },

  // ============================================
  // STREAK ACHIEVEMENTS
  // ============================================
  {
    id: 'streak-3',
    title: 'On Fire',
    description: '3-day learning streak',
    icon: 'flame-outline',
    category: 'streak',
    xpReward: 30,
    requirement: (s) => s.streak >= 3 || s.longestStreak >= 3,
    progress: (s) => ({ current: Math.min(Math.max(s.streak, s.longestStreak), 3), target: 3 }),
  },
  {
    id: 'streak-7',
    title: 'Week Warrior',
    description: '7-day learning streak',
    icon: 'flame',
    category: 'streak',
    xpReward: 75,
    requirement: (s) => s.streak >= 7 || s.longestStreak >= 7,
    progress: (s) => ({ current: Math.min(Math.max(s.streak, s.longestStreak), 7), target: 7 }),
  },
  {
    id: 'streak-14',
    title: 'Fortnight Fighter',
    description: '14-day learning streak',
    icon: 'rocket-outline',
    category: 'streak',
    xpReward: 150,
    requirement: (s) => s.streak >= 14 || s.longestStreak >= 14,
    progress: (s) => ({ current: Math.min(Math.max(s.streak, s.longestStreak), 14), target: 14 }),
  },
  {
    id: 'streak-30',
    title: 'Monthly Master',
    description: '30-day learning streak',
    icon: 'rocket',
    category: 'streak',
    xpReward: 300,
    requirement: (s) => s.streak >= 30 || s.longestStreak >= 30,
    progress: (s) => ({ current: Math.min(Math.max(s.streak, s.longestStreak), 30), target: 30 }),
  },

  // ============================================
  // EXPLORATION ACHIEVEMENTS (Photo Categories)
  // ============================================
  {
    id: 'first-category',
    title: 'First Collection',
    description: 'Start a photo collection category',
    icon: 'folder-outline',
    category: 'exploration',
    xpReward: 25,
    requirement: (s, lessons) => getUniqueCategories(lessons).size >= 1,
    progress: (s, lessons) => ({ current: Math.min(getUniqueCategories(lessons).size, 1), target: 1 }),
  },
  {
    id: 'diverse-collector-3',
    title: 'Diverse Collector',
    description: 'Take photos in 3 different categories',
    icon: 'grid-outline',
    category: 'exploration',
    xpReward: 75,
    requirement: (s, lessons) => getUniqueCategories(lessons).size >= 3,
    progress: (s, lessons) => ({ current: Math.min(getUniqueCategories(lessons).size, 3), target: 3 }),
  },
  {
    id: 'theme-explorer-5',
    title: 'Theme Explorer',
    description: 'Take photos in 5 different categories',
    icon: 'grid',
    category: 'exploration',
    xpReward: 150,
    requirement: (s, lessons) => getUniqueCategories(lessons).size >= 5,
    progress: (s, lessons) => ({ current: Math.min(getUniqueCategories(lessons).size, 5), target: 5 }),
  },
  {
    id: 'world-curator-7',
    title: 'World Curator',
    description: 'Take photos in 7 different categories',
    icon: 'globe-outline',
    category: 'exploration',
    xpReward: 300,
    requirement: (s, lessons) => getUniqueCategories(lessons).size >= 7,
    progress: (s, lessons) => ({ current: Math.min(getUniqueCategories(lessons).size, 7), target: 7 }),
  },
  {
    id: 'complete-collector-9',
    title: 'Complete Collector',
    description: 'Collect photos in all 9 categories',
    icon: 'globe',
    category: 'exploration',
    xpReward: 500,
    requirement: (s, lessons) => getUniqueCategories(lessons).size >= 9,
    progress: (s, lessons) => ({ current: Math.min(getUniqueCategories(lessons).size, 9), target: 9 }),
  },
];

// Category metadata for UI
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, {
  label: string;
  icon: string;
  color: string;
}> = {
  vocabulary: { label: 'Vocabulary', icon: 'book', color: '#3B82F6' },
  memory: { label: 'Memory Palace', icon: 'images', color: '#10B981' },
  streak: { label: 'Streaks', icon: 'flame', color: '#F59E0B' },
  exploration: { label: 'Exploration', icon: 'compass', color: '#8B5CF6' },
  mastery: { label: 'Mastery', icon: 'star', color: '#EC4899' },
};

// Get achievements by category
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

// Check which achievements are unlocked
export function getUnlockedAchievements(
  stats: UserStats,
  lessons: PhotoLesson[]
): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.requirement(stats, lessons));
}

// Get next achievements to unlock (closest to completion)
export function getNextAchievements(
  stats: UserStats,
  lessons: PhotoLesson[],
  limit = 3
): Array<Achievement & { progressValue: { current: number; target: number } }> {
  const locked = ACHIEVEMENTS.filter(a => !a.requirement(stats, lessons));

  return locked
    .filter(a => a.progress)
    .map(a => ({
      ...a,
      progressValue: a.progress!(stats, lessons),
    }))
    .sort((a, b) => {
      const aPercent = a.progressValue.current / a.progressValue.target;
      const bPercent = b.progressValue.current / b.progressValue.target;
      return bPercent - aPercent; // Higher percentage first
    })
    .slice(0, limit);
}
