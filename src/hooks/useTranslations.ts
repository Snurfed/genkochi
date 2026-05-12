import { useAppStore } from '../store';
import { getTranslations, Translations } from '../constants/translations';

/**
 * Hook to get translated strings based on the user's native language.
 * Falls back to English if translations are not available.
 */
export function useTranslations(): Translations {
  const nativeLanguage = useAppStore((state) => state.nativeLanguage);
  return getTranslations(nativeLanguage?.code || 'en');
}

/**
 * Get translations for a specific language code (for use outside of React components)
 */
export function getTranslationsForLanguage(languageCode: string): Translations {
  return getTranslations(languageCode);
}
