/**
 * Reading Quiz Generator
 *
 * Generates quiz questions focused on Japanese reading skills:
 * - Kanji to reading (recognize kanji, choose hiragana reading)
 * - Reading to kanji (see reading, choose correct kanji)
 * - Audio to script (hear pronunciation, choose written form)
 * - Script type identification
 * - Kana recognition
 * - Sentence reading
 */

import {
  Word,
  Sentence,
  QuizQuestion,
  QuizType,
  ReadingLevel,
  HIRAGANA_CHART,
  KATAKANA_CHART,
} from '../types';
import { toKatakana } from './japaneseText';

interface QuizGeneratorOptions {
  readingLevel: ReadingLevel;
  includeKana: boolean;
  includeKanji: boolean;
  includeSentences: boolean;
  prioritizeWeakAreas: boolean;
}

const DEFAULT_OPTIONS: QuizGeneratorOptions = {
  readingLevel: 'romaji',
  includeKana: true,
  includeKanji: true,
  includeSentences: true,
  prioritizeWeakAreas: true,
};

/**
 * Generate a mixed reading quiz from vocabulary and sentences
 */
export function generateReadingQuiz(
  words: Word[],
  sentences: Sentence[],
  count: number = 10,
  options: Partial<QuizGeneratorOptions> = {}
): QuizQuestion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const questions: QuizQuestion[] = [];

  // Filter words based on options
  const kanjiWords = words.filter(w => w.containsKanji);
  const kanaWords = words.filter(w => !w.containsKanji);

  // Determine question distribution based on reading level
  const distribution = getQuestionDistribution(opts.readingLevel);

  // Generate questions based on distribution
  let remaining = count;

  // Kanji-related questions
  if (opts.includeKanji && kanjiWords.length > 0) {
    const kanjiCount = Math.floor(remaining * distribution.kanji);

    // Kanji to reading questions
    const k2rCount = Math.ceil(kanjiCount / 2);
    for (let i = 0; i < k2rCount && questions.length < count; i++) {
      const word = kanjiWords[i % kanjiWords.length];
      const q = generateKanjiToReadingQuestion(word, words);
      if (q) questions.push(q);
    }

    // Reading to kanji questions
    const r2kCount = kanjiCount - k2rCount;
    for (let i = 0; i < r2kCount && questions.length < count; i++) {
      const word = kanjiWords[(i + k2rCount) % kanjiWords.length];
      const q = generateReadingToKanjiQuestion(word, kanjiWords);
      if (q) questions.push(q);
    }

    remaining -= kanjiCount;
  }

  // Kana recognition questions
  if (opts.includeKana) {
    const kanaCount = Math.floor(remaining * distribution.kana);

    for (let i = 0; i < kanaCount && questions.length < count; i++) {
      const word = kanaWords.length > 0
        ? kanaWords[i % kanaWords.length]
        : words[i % words.length];
      const q = generateKanaRecognitionQuestion(word);
      if (q) questions.push(q);
    }

    remaining -= kanaCount;
  }

  // Audio to script questions
  for (let i = 0; i < Math.floor(remaining * distribution.audio) && questions.length < count; i++) {
    const word = words[i % words.length];
    const q = generateAudioToScriptQuestion(word, words);
    if (q) questions.push(q);
  }

  // Script type identification
  for (let i = 0; i < Math.floor(remaining * distribution.scriptType) && questions.length < count; i++) {
    const word = words[i % words.length];
    const q = generateScriptTypeQuestion(word);
    if (q) questions.push(q);
  }

  // Sentence reading (if available)
  if (opts.includeSentences && sentences.length > 0) {
    const sentenceCount = Math.min(2, sentences.length);
    for (let i = 0; i < sentenceCount && questions.length < count; i++) {
      const sentence = sentences[i % sentences.length];
      const q = generateSentenceReadingQuestion(sentence, sentences);
      if (q) questions.push(q);
    }
  }

  // Fill remaining with mixed questions
  while (questions.length < count) {
    const word = words[questions.length % words.length];
    const q = Math.random() > 0.5
      ? generateKanjiToReadingQuestion(word, words)
      : generateAudioToScriptQuestion(word, words);
    if (q) questions.push(q);
  }

  // Shuffle questions
  return shuffleArray(questions);
}

/**
 * Get question type distribution based on reading level
 */
function getQuestionDistribution(level: ReadingLevel): {
  kanji: number;
  kana: number;
  audio: number;
  scriptType: number;
} {
  switch (level) {
    case 'romaji':
      // Focus on kana recognition and audio
      return { kanji: 0.1, kana: 0.5, audio: 0.3, scriptType: 0.1 };
    case 'kana':
      // More kanji introduction
      return { kanji: 0.3, kana: 0.3, audio: 0.3, scriptType: 0.1 };
    case 'kanji-basic':
      // Heavier kanji focus
      return { kanji: 0.5, kana: 0.2, audio: 0.2, scriptType: 0.1 };
    case 'kanji-read':
      // Advanced kanji
      return { kanji: 0.6, kana: 0.1, audio: 0.2, scriptType: 0.1 };
    case 'fluent':
      // Mostly kanji and sentences
      return { kanji: 0.7, kana: 0.05, audio: 0.2, scriptType: 0.05 };
    default:
      return { kanji: 0.4, kana: 0.3, audio: 0.2, scriptType: 0.1 };
  }
}

/**
 * Generate a "kanji to reading" question
 * Shows kanji, asks for hiragana reading
 */
export function generateKanjiToReadingQuestion(
  word: Word,
  allWords: Word[]
): QuizQuestion | null {
  if (!word.containsKanji) return null;

  // Get wrong options (other readings)
  const wrongReadings = allWords
    .filter(w => w.id !== word.id && w.reading !== word.reading)
    .map(w => w.reading)
    .slice(0, 3);

  // If not enough wrong options, generate similar-looking readings
  while (wrongReadings.length < 3) {
    const fakeReading = generateSimilarReading(word.reading);
    if (fakeReading && !wrongReadings.includes(fakeReading)) {
      wrongReadings.push(fakeReading);
    }
  }

  const options = shuffleArray([word.reading, ...wrongReadings.slice(0, 3)]);
  const correctIndex = options.indexOf(word.reading);

  return {
    id: `q-k2r-${word.id}-${Date.now()}`,
    type: 'kanji-to-reading',
    word,
    options,
    correctIndex,
    showFurigana: false,
    targetScript: 'kanji',
  };
}

/**
 * Generate a "reading to kanji" question
 * Shows hiragana reading, asks for correct kanji
 */
export function generateReadingToKanjiQuestion(
  word: Word,
  kanjiWords: Word[]
): QuizQuestion | null {
  if (!word.containsKanji) return null;

  // Get wrong options (other kanji words)
  const wrongKanji = kanjiWords
    .filter(w => w.id !== word.id && w.japanese !== word.japanese)
    .map(w => w.japanese)
    .slice(0, 3);

  if (wrongKanji.length < 3) return null;

  const options = shuffleArray([word.japanese, ...wrongKanji.slice(0, 3)]);
  const correctIndex = options.indexOf(word.japanese);

  return {
    id: `q-r2k-${word.id}-${Date.now()}`,
    type: 'reading-to-kanji',
    word,
    options,
    correctIndex,
    showFurigana: false,
    targetScript: 'hiragana',
  };
}

/**
 * Generate an "audio to script" question
 * Plays audio, asks for written form
 */
export function generateAudioToScriptQuestion(
  word: Word,
  allWords: Word[]
): QuizQuestion | null {
  // Get wrong options
  const wrongWords = allWords
    .filter(w => w.id !== word.id)
    .map(w => w.japanese)
    .slice(0, 3);

  if (wrongWords.length < 3) return null;

  const options = shuffleArray([word.japanese, ...wrongWords.slice(0, 3)]);
  const correctIndex = options.indexOf(word.japanese);

  return {
    id: `q-a2s-${word.id}-${Date.now()}`,
    type: 'audio-to-script',
    word,
    options,
    correctIndex,
    showFurigana: false,
  };
}

/**
 * Generate a script type identification question
 */
export function generateScriptTypeQuestion(word: Word): QuizQuestion | null {
  const options = ['Hiragana', 'Katakana', 'Kanji', 'Mixed'];
  const scriptType = word.scriptType || 'hiragana';
  const correctAnswer = {
    hiragana: 'Hiragana',
    katakana: 'Katakana',
    kanji: 'Kanji',
    mixed: 'Mixed',
  }[scriptType];

  const correctIndex = options.indexOf(correctAnswer);

  return {
    id: `q-st-${word.id}-${Date.now()}`,
    type: 'script-type',
    word,
    options,
    correctIndex,
    showFurigana: false,
    targetScript: scriptType,
  };
}

/**
 * Generate a kana recognition question
 * Shows a kana character, asks for romaji or meaning
 */
export function generateKanaRecognitionQuestion(word: Word): QuizQuestion | null {
  // Pick a random kana from the word
  const kanaChars = word.reading.split('');
  if (kanaChars.length === 0) return null;

  const targetKana = kanaChars[Math.floor(Math.random() * kanaChars.length)];

  // Find the romaji for this kana
  const hiraganaMatch = HIRAGANA_CHART.find(h => h.kana === targetKana);
  const katakanaMatch = KATAKANA_CHART.find(k => k.kana === targetKana);
  const match = hiraganaMatch || katakanaMatch;

  if (!match) return null;

  // Generate wrong options
  const allRomaji = HIRAGANA_CHART.map(h => h.romaji);
  const wrongRomaji = allRomaji
    .filter(r => r !== match.romaji)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = shuffleArray([match.romaji, ...wrongRomaji]);
  const correctIndex = options.indexOf(match.romaji);

  // Create a pseudo-word for this question
  const pseudoWord: Word = {
    ...word,
    japanese: targetKana,
    reading: targetKana,
    romaji: match.romaji,
    english: match.romaji,
  };

  return {
    id: `q-kana-${targetKana}-${Date.now()}`,
    type: 'kana-recognition',
    word: pseudoWord,
    options,
    correctIndex,
    showFurigana: false,
    targetScript: hiraganaMatch ? 'hiragana' : 'katakana',
  };
}

/**
 * Generate a sentence reading question
 */
export function generateSentenceReadingQuestion(
  sentence: Sentence,
  allSentences: Sentence[]
): QuizQuestion | null {
  // Option 1: Match audio to written sentence
  const wrongSentences = allSentences
    .filter(s => s.id !== sentence.id)
    .map(s => s.japanese)
    .slice(0, 3);

  if (wrongSentences.length < 3) {
    // Not enough sentences, skip
    return null;
  }

  const options = shuffleArray([sentence.japanese, ...wrongSentences]);
  const correctIndex = options.indexOf(sentence.japanese);

  // Create a pseudo-word containing sentence data
  const pseudoWord: Word = {
    id: sentence.id,
    japanese: sentence.japanese,
    reading: sentence.reading,
    romaji: sentence.romaji,
    english: sentence.translation,
    scriptType: 'mixed',
    containsKanji: true,
    furigana: sentence.furigana,
    mastery: 'new',
    masteryScore: 0,
    readingScore: sentence.readingMastery,
    readingMastery: 'new',
    timesCorrect: 0,
    timesWrong: 0,
    timesSpoken: 0,
    interval: 0,
  };

  return {
    id: `q-sr-${sentence.id}-${Date.now()}`,
    type: 'sentence-reading',
    word: pseudoWord,
    sentence,
    options,
    correctIndex,
    showFurigana: false,
  };
}

/**
 * Generate kana drill questions (for dedicated kana practice)
 */
export function generateKanaDrill(
  targetKana: 'hiragana' | 'katakana' | 'both',
  knownKana: string[],
  count: number = 10
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const chart = targetKana === 'katakana'
    ? KATAKANA_CHART
    : targetKana === 'hiragana'
    ? HIRAGANA_CHART
    : [...HIRAGANA_CHART, ...KATAKANA_CHART];

  // Prioritize unknown kana
  const unknownKana = chart.filter(k => !knownKana.includes(k.kana));
  const reviewKana = chart.filter(k => knownKana.includes(k.kana));

  // Mix: 70% unknown, 30% review
  const unknownCount = Math.floor(count * 0.7);
  const reviewCount = count - unknownCount;

  // Generate questions for unknown kana
  for (let i = 0; i < unknownCount && unknownKana.length > 0; i++) {
    const target = unknownKana[i % unknownKana.length];
    const wrongOptions = chart
      .filter(k => k.romaji !== target.romaji)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(k => k.romaji);

    const options = shuffleArray([target.romaji, ...wrongOptions]);

    questions.push({
      id: `q-kd-${target.kana}-${Date.now()}-${i}`,
      type: 'kana-recognition',
      word: {
        id: `kana-${target.kana}`,
        japanese: target.kana,
        reading: target.kana,
        romaji: target.romaji,
        english: target.romaji,
        scriptType: isHiraganaChar(target.kana) ? 'hiragana' : 'katakana',
        containsKanji: false,
        furigana: [{ text: target.kana, reading: target.kana, isKanji: false }],
        mastery: 'new',
        masteryScore: 0,
        timesCorrect: 0,
        timesWrong: 0,
        timesSpoken: 0,
        interval: 0,
      },
      options,
      correctIndex: options.indexOf(target.romaji),
      targetScript: isHiraganaChar(target.kana) ? 'hiragana' : 'katakana',
    });
  }

  // Generate review questions
  for (let i = 0; i < reviewCount && reviewKana.length > 0; i++) {
    const target = reviewKana[i % reviewKana.length];
    const wrongOptions = chart
      .filter(k => k.romaji !== target.romaji)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(k => k.romaji);

    const options = shuffleArray([target.romaji, ...wrongOptions]);

    questions.push({
      id: `q-kd-review-${target.kana}-${Date.now()}-${i}`,
      type: 'kana-recognition',
      word: {
        id: `kana-${target.kana}`,
        japanese: target.kana,
        reading: target.kana,
        romaji: target.romaji,
        english: target.romaji,
        scriptType: isHiraganaChar(target.kana) ? 'hiragana' : 'katakana',
        containsKanji: false,
        furigana: [{ text: target.kana, reading: target.kana, isKanji: false }],
        mastery: 'learning',
        masteryScore: 50,
        timesCorrect: 0,
        timesWrong: 0,
        timesSpoken: 0,
        interval: 0,
      },
      options,
      correctIndex: options.indexOf(target.romaji),
      targetScript: isHiraganaChar(target.kana) ? 'hiragana' : 'katakana',
    });
  }

  return shuffleArray(questions);
}

// Helper functions

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateSimilarReading(reading: string): string {
  // Generate a plausible-looking but wrong reading
  const chars = reading.split('');
  if (chars.length === 0) return 'あい';

  // Swap two characters or change one
  if (chars.length > 1 && Math.random() > 0.5) {
    const i = Math.floor(Math.random() * (chars.length - 1));
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
  } else {
    const i = Math.floor(Math.random() * chars.length);
    const replacements = HIRAGANA_CHART.map(h => h.kana);
    chars[i] = replacements[Math.floor(Math.random() * replacements.length)];
  }

  return chars.join('');
}

function isHiraganaChar(char: string): boolean {
  return /[\u3040-\u309F]/.test(char);
}
