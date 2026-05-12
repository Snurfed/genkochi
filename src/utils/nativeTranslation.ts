/**
 * Native Translation Utility
 *
 * Centralized logic for getting translations in the user's native language.
 * RULE: Never show a third language. Only target language + native language.
 *
 * - Target language = language being learned (e.g., Portuguese)
 * - Native language = user's selected language (e.g., Japanese)
 * - English should NEVER appear unless it is the native language
 */

import { Word, Sentence, WordDescriptor, WorldObject } from '../types';
import { Language } from '../constants/languages';

/**
 * Get the translation/meaning of a word in the user's native language.
 * Falls back to target language word if no native translation exists.
 * NEVER falls back to English (unless English is the native language).
 */
export function getNativeTranslation(
  word: Word | null | undefined,
  nativeLanguage: Language
): string {
  if (!word) return '';

  // If we have a native translation in the correct language, use it
  if (word.nativeTranslation && word.nativeLanguageCode === nativeLanguage.code) {
    return word.nativeTranslation;
  }

  // If native language is English, use the english field
  if (nativeLanguage.code === 'en' && word.english) {
    return word.english;
  }

  // If we have a native translation (even if language code doesn't match), use it
  // This handles cases where translation was generated but code wasn't stored
  if (word.nativeTranslation) {
    return word.nativeTranslation;
  }

  // Fallback: use target language word (NOT English)
  return word.japanese || word.romaji || '';
}

/**
 * Get sentence translation in the user's native language.
 * Falls back to target language sentence if no native translation exists.
 */
export function getSentenceTranslation(
  sentence: Sentence | null | undefined,
  nativeLanguage: Language
): string {
  if (!sentence) return '';

  // If we have a native translation in the correct language, use it
  if (sentence.nativeTranslation && sentence.nativeLanguageCode === nativeLanguage.code) {
    return sentence.nativeTranslation;
  }

  // If native language is English, use the translation field
  if (nativeLanguage.code === 'en' && sentence.translation) {
    return sentence.translation;
  }

  // If we have a native translation, use it
  if (sentence.nativeTranslation) {
    return sentence.nativeTranslation;
  }

  // Fallback: use target language sentence (NOT English)
  return sentence.japanese || sentence.romaji || '';
}

/**
 * Get descriptor translation in the user's native language.
 * Falls back to target language if no native translation exists.
 */
export function getDescriptorTranslation(
  descriptor: WordDescriptor | null | undefined,
  nativeLanguage: Language
): string {
  if (!descriptor) return '';

  // If we have a native translation, use it
  if (descriptor.nativeTranslation) {
    return descriptor.nativeTranslation;
  }

  // If native language is English, use the english field
  if (nativeLanguage.code === 'en' && descriptor.english) {
    return descriptor.english;
  }

  // Fallback: use target language (NOT English)
  return descriptor.japanese || '';
}

/**
 * Get WorldObject translation in the user's native language.
 */
export function getWorldObjectTranslation(
  obj: WorldObject | null | undefined,
  nativeLanguage: Language
): string {
  if (!obj) return '';

  if (obj.nativeTranslation) {
    return obj.nativeTranslation;
  }

  if (nativeLanguage.code === 'en' && obj.english) {
    return obj.english;
  }

  return obj.displayName || '';
}

/**
 * Check if we should show the native translation or if we're missing it.
 * Useful for showing "tap to reveal" vs already revealed state.
 */
export function hasNativeTranslation(
  word: Word | null | undefined,
  nativeLanguage: Language
): boolean {
  if (!word) return false;

  if (nativeLanguage.code === 'en') {
    return Boolean(word.english);
  }

  return Boolean(word.nativeTranslation);
}

/**
 * Get translation with fallback indicator.
 * Returns { text, isFallback } so UI can style fallbacks differently.
 */
export function getTranslationWithFallback(
  word: Word | null | undefined,
  nativeLanguage: Language
): { text: string; isFallback: boolean } {
  if (!word) return { text: '', isFallback: true };

  // Check for proper native translation
  if (word.nativeTranslation && word.nativeLanguageCode === nativeLanguage.code) {
    return { text: word.nativeTranslation, isFallback: false };
  }

  if (nativeLanguage.code === 'en' && word.english) {
    return { text: word.english, isFallback: false };
  }

  if (word.nativeTranslation) {
    return { text: word.nativeTranslation, isFallback: false };
  }

  // Fallback to target language
  return { text: word.japanese || word.romaji || '', isFallback: true };
}
