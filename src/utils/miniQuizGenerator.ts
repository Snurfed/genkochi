import { Word } from '../types';

type QuizVariant = 'meaning' | 'reverse' | 'reading' | 'audio';

interface MiniQuizQuestion {
  variant: QuizVariant;
  options: string[];
  correctIndex: number;
}

/**
 * Generate a mini quiz question for a word
 * Returns options and correct index for immediate use in overlay
 * Only uses real words as distractors - no generic fallbacks
 */
export function generateMiniQuiz(
  targetWord: Word,
  allWords: Word[],
  variant?: QuizVariant
): MiniQuizQuestion | null {
  // Pick a random variant if not specified
  const quizVariant = variant || pickRandomVariant(targetWord);

  const correctAnswer = getCorrectAnswer(targetWord, quizVariant);
  const distractors = getDistractors(targetWord, allWords, quizVariant, 3);

  // Only generate quiz if we have enough real distractors
  if (distractors.length < 2) {
    return null;
  }

  // Combine and shuffle
  const allOptions = [correctAnswer, ...distractors];
  const shuffled = shuffleArray(allOptions);
  const correctIndex = shuffled.indexOf(correctAnswer);

  return {
    variant: quizVariant,
    options: shuffled,
    correctIndex,
  };
}

function pickRandomVariant(word: Word): QuizVariant {
  const variants: QuizVariant[] = ['meaning', 'reverse', 'audio'];

  // Add reading variant if word has kanji
  if (word.containsKanji || word.scriptType === 'kanji') {
    variants.push('reading');
  }

  return variants[Math.floor(Math.random() * variants.length)];
}

function getCorrectAnswer(word: Word, variant: QuizVariant): string {
  switch (variant) {
    case 'meaning':
    case 'audio':
      return word.english;
    case 'reverse':
      return word.japanese;
    case 'reading':
      return word.reading || word.japanese;
  }
}

function getDistractors(
  targetWord: Word,
  allWords: Word[],
  variant: QuizVariant,
  count: number
): string[] {
  const distractors: string[] = [];
  const targetAnswer = getCorrectAnswer(targetWord, variant);

  // Get distractors only from real words in the word pool
  const otherWords = allWords.filter(w =>
    w.id !== targetWord.id &&
    w.japanese &&
    w.english
  );

  for (const word of shuffleArray(otherWords)) {
    if (distractors.length >= count) break;

    const option = getCorrectAnswer(word, variant);
    if (option && option !== targetAnswer && !distractors.includes(option) && option.trim() !== '') {
      distractors.push(option);
    }
  }

  return distractors.slice(0, count);
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Determine quiz variant based on word state and user progress
 * Balances between meaning and reading practice
 */
export function suggestQuizVariant(word: Word): QuizVariant {
  // If word has kanji and reading mastery is low, focus on reading
  if (word.containsKanji && (word.readingScore || 0) < (word.masteryScore || 0)) {
    return Math.random() > 0.4 ? 'reading' : 'meaning';
  }

  // If meaning mastery is low, focus on meaning
  if (word.masteryScore < 50) {
    return Math.random() > 0.3 ? 'meaning' : 'reverse';
  }

  // Otherwise, mix it up
  return Math.random() > 0.5 ? 'meaning' : 'reverse';
}
