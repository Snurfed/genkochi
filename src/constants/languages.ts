/**
 * Supported languages for PhotoLingo
 * Each language has properties needed for word generation, speech, and display
 */

export interface Language {
  code: string;           // ISO 639-1 code
  name: string;           // Display name
  nativeName: string;     // Name in native script
  flag: string;           // Flag emoji
  speechCode: string;     // BCP-47 code for TTS
  hasReading: boolean;    // Whether to show reading/pronunciation (e.g., hiragana, pinyin)
  readingLabel: string;   // Label for reading field (e.g., "Reading", "Pinyin", "Romanization")
  script: 'latin' | 'cjk' | 'cyrillic' | 'arabic' | 'hebrew' | 'thai' | 'devanagari' | 'korean' | 'greek';
  direction: 'ltr' | 'rtl';
  exampleWord: string;    // Example word in the language
  // Standardization properties (optional - derived from script/code if not specified)
  writeMode?: 'draw' | 'keyboard' | 'hybrid';  // Default write input mode
  ttsField?: 'native' | 'reading';             // Which field to use for TTS (native script or reading)
  grammarOrder?: 'SVO' | 'SOV' | 'VSO' | 'flexible';  // Sentence structure
  hasParticles?: boolean;                      // Whether language uses particles (Japanese, Korean)
  hasClassifiers?: boolean;                    // Whether language uses classifiers (Chinese)
}

// Helper function to get write mode for a language
export function getWriteMode(lang: Language): 'draw' | 'keyboard' | 'hybrid' {
  if (lang.writeMode) return lang.writeMode;
  // Derive from script type
  switch (lang.script) {
    case 'cjk': return 'draw';  // Japanese, Chinese
    case 'korean': return 'hybrid';  // Korean - keyboard with jamo, optional draw
    case 'arabic': return 'hybrid';
    case 'hebrew': return 'hybrid';
    case 'thai': return 'hybrid';
    case 'devanagari': return 'hybrid';
    default: return 'keyboard';  // Latin, Cyrillic, Greek
  }
}

// Helper function to get TTS text field preference
export function getTTSField(lang: Language): 'native' | 'reading' {
  if (lang.ttsField) return lang.ttsField;
  // Japanese uses hiragana reading for TTS, others use native script
  return lang.code === 'ja' ? 'reading' : 'native';
}

// Helper function to get grammar order
export function getGrammarOrder(lang: Language): 'SVO' | 'SOV' | 'VSO' | 'flexible' {
  if (lang.grammarOrder) return lang.grammarOrder;
  // Derive from language code
  switch (lang.code) {
    case 'ja': case 'ko': case 'hi': return 'SOV';
    case 'ar': case 'he': return 'VSO';
    default: return 'SVO';
  }
}

// Helper function to check if language uses particles
export function hasParticles(lang: Language): boolean {
  if (lang.hasParticles !== undefined) return lang.hasParticles;
  return lang.code === 'ja' || lang.code === 'ko';
}

// Helper function to check if language uses classifiers
export function hasClassifiers(lang: Language): boolean {
  if (lang.hasClassifiers !== undefined) return lang.hasClassifiers;
  return lang.code === 'zh' || lang.code === 'th' || lang.code === 'vi';
}

// Get text to use for TTS based on language settings
export function getTextForTTS(lang: Language, nativeText: string, readingText?: string): string {
  const field = getTTSField(lang);
  if (field === 'reading' && readingText) {
    return readingText;
  }
  return nativeText;
}

// Check if language uses non-Latin script (needs romanization for pronunciation)
export function usesNonLatinScript(lang: Language): boolean {
  return lang.script !== 'latin';
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    speechCode: 'en-US',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Hello',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    speechCode: 'ja-JP',
    hasReading: true,
    readingLabel: 'Reading',
    script: 'cjk',
    direction: 'ltr',
    exampleWord: 'こんにちは',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    speechCode: 'es-ES',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Hola',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    speechCode: 'fr-FR',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Bonjour',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Guten Tag',
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    speechCode: 'it-IT',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Ciao',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    speechCode: 'pt-BR',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Olá',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    speechCode: 'zh-CN',
    hasReading: true,
    readingLabel: 'Pinyin',
    script: 'cjk',
    direction: 'ltr',
    exampleWord: '你好',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    speechCode: 'ko-KR',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'korean',
    direction: 'ltr',
    exampleWord: '안녕하세요',
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    speechCode: 'ru-RU',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'cyrillic',
    direction: 'ltr',
    exampleWord: 'Привет',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    speechCode: 'ar-SA',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'arabic',
    direction: 'rtl',
    exampleWord: 'مرحبا',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    speechCode: 'hi-IN',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'devanagari',
    direction: 'ltr',
    exampleWord: 'नमस्ते',
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    speechCode: 'nl-NL',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Hallo',
  },
  {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    flag: '🇸🇪',
    speechCode: 'sv-SE',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Hej',
  },
  {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    speechCode: 'tr-TR',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Merhaba',
  },
  {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    flag: '🇵🇱',
    speechCode: 'pl-PL',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Cześć',
  },
  {
    code: 'el',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    flag: '🇬🇷',
    speechCode: 'el-GR',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'greek',
    direction: 'ltr',
    exampleWord: 'Γειά σου',
  },
  {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    flag: '🇮🇱',
    speechCode: 'he-IL',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'hebrew',
    direction: 'rtl',
    exampleWord: 'שלום',
  },
  {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    speechCode: 'vi-VN',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Xin chào',
  },
  {
    code: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    flag: '🇹🇭',
    speechCode: 'th-TH',
    hasReading: true,
    readingLabel: 'Romanization',
    script: 'thai',
    direction: 'ltr',
    exampleWord: 'สวัสดี',
  },
  {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    speechCode: 'id-ID',
    hasReading: false,
    readingLabel: '',
    script: 'latin',
    direction: 'ltr',
    exampleWord: 'Halo',
  },
];

// Helper to get language by code
export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(l => l.code === code);
}

// Default languages
export const DEFAULT_NATIVE_LANGUAGE = SUPPORTED_LANGUAGES[0]; // English
export const DEFAULT_TARGET_LANGUAGE = SUPPORTED_LANGUAGES[1]; // Japanese
export const DEFAULT_LANGUAGE = DEFAULT_TARGET_LANGUAGE; // Alias for backward compatibility
