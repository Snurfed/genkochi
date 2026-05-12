/**
 * Japanese Text Analysis Utilities
 *
 * Functions for analyzing and processing Japanese text:
 * - Script type detection (hiragana, katakana, kanji)
 * - Furigana segment generation
 * - Reading analysis
 */

import { FuriganaSegment, ScriptType } from '../types';

// Unicode ranges for Japanese scripts
const HIRAGANA_RANGE = /[\u3040-\u309F]/;
const KATAKANA_RANGE = /[\u30A0-\u30FF]/;
const KANJI_RANGE = /[\u4E00-\u9FAF\u3400-\u4DBF]/;
const PUNCTUATION = /[。、！？「」『』（）・ー〜]/;

/**
 * Check if a character is hiragana
 */
export function isHiragana(char: string): boolean {
  return HIRAGANA_RANGE.test(char);
}

/**
 * Check if a character is katakana
 */
export function isKatakana(char: string): boolean {
  return KATAKANA_RANGE.test(char);
}

/**
 * Check if a character is kanji
 */
export function isKanji(char: string): boolean {
  return KANJI_RANGE.test(char);
}

/**
 * Check if a character is Japanese punctuation
 */
export function isPunctuation(char: string): boolean {
  return PUNCTUATION.test(char);
}

/**
 * Detect the primary script type of a word
 */
export function detectScriptType(text: string): ScriptType {
  let hasHiragana = false;
  let hasKatakana = false;
  let hasKanji = false;

  for (const char of text) {
    if (isHiragana(char)) hasHiragana = true;
    if (isKatakana(char)) hasKatakana = true;
    if (isKanji(char)) hasKanji = true;
  }

  // Determine primary type
  if (hasKanji) return 'kanji';
  if (hasKatakana && !hasHiragana) return 'katakana';
  if (hasHiragana && !hasKatakana) return 'hiragana';
  if (hasHiragana && hasKatakana) return 'mixed';

  return 'hiragana'; // Default fallback
}

/**
 * Check if text contains any kanji
 */
export function containsKanji(text: string): boolean {
  return KANJI_RANGE.test(text);
}

/**
 * Count kanji characters in text
 */
export function countKanji(text: string): number {
  let count = 0;
  for (const char of text) {
    if (isKanji(char)) count++;
  }
  return count;
}

/**
 * Parse Japanese text into furigana segments
 *
 * This is a simplified parser. For production, you would use a proper
 * morphological analyzer like kuromoji or MeCab via an API.
 *
 * @param japanese - The Japanese text (with kanji)
 * @param reading - The full hiragana reading
 * @returns Array of furigana segments
 */
export function parseFurigana(japanese: string, reading: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];

  // Simple case: no kanji, return as single segment
  if (!containsKanji(japanese)) {
    return [{
      text: japanese,
      reading: reading,
      isKanji: false,
    }];
  }

  // Segment the text by script type
  let currentSegment = '';
  let currentReading = '';
  let currentIsKanji = false;
  let readingIndex = 0;

  for (let i = 0; i < japanese.length; i++) {
    const char = japanese[i];
    const charIsKanji = isKanji(char);

    if (i === 0) {
      currentSegment = char;
      currentIsKanji = charIsKanji;
      continue;
    }

    // If script type changes, push current segment
    if (charIsKanji !== currentIsKanji) {
      // Calculate reading for this segment
      if (currentIsKanji) {
        // For kanji, we need to figure out how much of the reading belongs to it
        // This is a heuristic - proper solution needs morphological analysis
        const remainingJapanese = japanese.slice(i);
        const segmentReading = extractKanjiReading(
          currentSegment,
          reading.slice(readingIndex),
          remainingJapanese
        );
        currentReading = segmentReading;
        readingIndex += segmentReading.length;
      } else {
        // For hiragana/katakana, the reading matches the text
        currentReading = toHiragana(currentSegment);
        readingIndex += currentReading.length;
      }

      segments.push({
        text: currentSegment,
        reading: currentReading,
        isKanji: currentIsKanji,
      });

      currentSegment = char;
      currentIsKanji = charIsKanji;
    } else {
      currentSegment += char;
    }
  }

  // Push final segment
  if (currentSegment) {
    if (currentIsKanji) {
      currentReading = reading.slice(readingIndex);
    } else {
      currentReading = toHiragana(currentSegment);
    }

    segments.push({
      text: currentSegment,
      reading: currentReading,
      isKanji: currentIsKanji,
    });
  }

  return segments;
}

/**
 * Extract the reading for a kanji segment
 *
 * Uses heuristics to determine how much of the reading belongs to the kanji.
 * For accurate results, use a morphological analyzer.
 */
function extractKanjiReading(
  kanji: string,
  remainingReading: string,
  remainingText: string
): string {
  // If there's no remaining text, all remaining reading belongs to this kanji
  if (!remainingText) {
    return remainingReading;
  }

  // Find where the next hiragana/katakana in the text matches the reading
  // This helps us know where the kanji reading ends
  const nextChar = remainingText[0];

  if (isHiragana(nextChar) || isKatakana(nextChar)) {
    const nextCharHiragana = toHiragana(nextChar);
    const matchIndex = remainingReading.indexOf(nextCharHiragana);

    if (matchIndex > 0) {
      return remainingReading.slice(0, matchIndex);
    }
  }

  // Heuristic: assume 1-2 hiragana per kanji
  const estimatedLength = Math.min(kanji.length * 2, remainingReading.length);
  return remainingReading.slice(0, estimatedLength);
}

/**
 * Convert katakana to hiragana
 */
export function toHiragana(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Katakana range: 0x30A0-0x30FF
    // Hiragana range: 0x3040-0x309F
    // Offset: 0x60
    if (code >= 0x30A1 && code <= 0x30F6) {
      result += String.fromCharCode(code - 0x60);
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Convert hiragana to katakana
 */
export function toKatakana(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x3041 && code <= 0x3096) {
      result += String.fromCharCode(code + 0x60);
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Convert romaji to hiragana (basic conversion)
 */
export function romajiToHiragana(romaji: string): string {
  const conversions: Record<string, string> = {
    // Basic vowels
    'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
    // K-row
    'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
    // S-row
    'sa': 'さ', 'shi': 'し', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
    // T-row
    'ta': 'た', 'chi': 'ち', 'ti': 'ち', 'tsu': 'つ', 'tu': 'つ', 'te': 'て', 'to': 'と',
    // N-row
    'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
    // H-row
    'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'hu': 'ふ', 'he': 'へ', 'ho': 'ほ',
    // M-row
    'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
    // Y-row
    'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
    // R-row
    'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
    // W-row
    'wa': 'わ', 'wo': 'を', 'n': 'ん', "n'": 'ん',
    // Voiced consonants (G, Z, D, B)
    'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
    'za': 'ざ', 'ji': 'じ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
    'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
    'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
    // P-row
    'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
    // Combination sounds
    'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
    'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
    'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
    'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
    'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
    'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
    'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
    'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
    'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
    'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
    'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
    // Double consonants (small tsu)
    'kk': 'っk', 'ss': 'っs', 'tt': 'っt', 'pp': 'っp',
    // Long vowels
    'aa': 'ああ', 'ii': 'いい', 'uu': 'うう', 'ee': 'ええ', 'oo': 'おお', 'ou': 'おう',
  };

  let result = '';
  let i = 0;
  const lower = romaji.toLowerCase();

  while (i < lower.length) {
    let matched = false;

    // Try matching 3, 2, then 1 character sequences
    for (const len of [3, 2, 1]) {
      const substr = lower.slice(i, i + len);
      if (conversions[substr]) {
        result += conversions[substr];
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += lower[i];
      i++;
    }
  }

  return result;
}

/**
 * Generate simple furigana for a word when we have both forms
 */
export function createSimpleFurigana(japanese: string, reading: string): FuriganaSegment[] {
  // If the text is the same as the reading (pure hiragana), no furigana needed
  if (japanese === reading || !containsKanji(japanese)) {
    return [{
      text: japanese,
      reading: reading,
      isKanji: false,
    }];
  }

  // Use the parser for more complex cases
  return parseFurigana(japanese, reading);
}

/**
 * Calculate similarity between two Japanese strings
 * Useful for speech recognition validation
 */
export function japaneseSimilarity(a: string, b: string): number {
  const aNorm = toHiragana(a.toLowerCase().replace(/\s/g, ''));
  const bNorm = toHiragana(b.toLowerCase().replace(/\s/g, ''));

  if (aNorm === bNorm) return 100;

  // Character-by-character comparison
  let matches = 0;
  const longer = aNorm.length > bNorm.length ? aNorm : bNorm;
  const shorter = aNorm.length > bNorm.length ? bNorm : aNorm;

  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }

  return Math.round((matches / longer.length) * 100);
}

/**
 * Extract all unique kana from text (for learning progress tracking)
 */
export function extractKana(text: string): { hiragana: string[]; katakana: string[] } {
  const hiragana = new Set<string>();
  const katakana = new Set<string>();

  for (const char of text) {
    if (isHiragana(char)) hiragana.add(char);
    if (isKatakana(char)) katakana.add(char);
  }

  return {
    hiragana: Array.from(hiragana),
    katakana: Array.from(katakana),
  };
}

/**
 * Extract all unique kanji from text
 */
export function extractKanjiCharacters(text: string): string[] {
  const kanji = new Set<string>();
  for (const char of text) {
    if (isKanji(char)) kanji.add(char);
  }
  return Array.from(kanji);
}
