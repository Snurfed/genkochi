/**
 * Speech Recognition utility using expo-speech-recognition
 * Provides native speech-to-text on iOS and Android
 * Falls back gracefully when native module isn't available (e.g., Expo Go)
 */

import { resetAudioSession } from './speech';

// Try to import the native module, but handle failure gracefully
let ExpoSpeechRecognitionModule: any = null;
let isNativeModuleAvailable = false;

try {
  const speechModule = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
  isNativeModuleAvailable = !!ExpoSpeechRecognitionModule;
} catch (e) {
  if (__DEV__) console.log('Speech recognition not available - requires development build');
  isNativeModuleAvailable = false;
}

type SpeechRecognitionCallback = {
  onResult: (transcript: string) => void;
  onPartialResult?: (transcript: string) => void; // For interim results
  onError: (error: string) => void;
  onEnd: () => void;
};

// Check if speech recognition is available
export const isSpeechRecognitionAvailable = (): boolean => {
  return isNativeModuleAvailable;
};

// Request microphone permissions
export const requestSpeechPermissions = async (): Promise<boolean> => {
  if (!isNativeModuleAvailable) {
    if (__DEV__) console.warn('Speech recognition not available in Expo Go. Use a development build.');
    return false;
  }

  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  } catch (e) {
    if (__DEV__) console.error('Permission request failed:', e);
    return false;
  }
};

// Start listening for speech
export const startListening = (
  language: string,
  callbacks: SpeechRecognitionCallback
): (() => void) => {
  if (!isNativeModuleAvailable) {
    // Show helpful error for Expo Go users
    setTimeout(() => {
      callbacks.onError('Speech recognition requires a development build. It is not available in Expo Go.');
      callbacks.onEnd();
    }, 100);
    return () => {};
  }

  let isActive = true;
  let hasResult = false;
  let hasSpeechStarted = false;
  let lastInterimTranscript = '';
  let noSpeechTimeout: NodeJS.Timeout | null = null;

  const startRecognition = async () => {
    try {
      // Check/request permissions first
      const permResult = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!permResult.granted) {
        const reqResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!reqResult.granted) {
          callbacks.onError('Microphone permission denied');
          callbacks.onEnd();
          return;
        }
      }

      // Start recognition with Japanese language
      await ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true, // Get results as user speaks
        maxAlternatives: 5, // More alternatives for better accuracy
        continuous: true, // Keep listening longer
        requiresOnDeviceRecognition: false, // Allow cloud recognition for better accuracy
        addsPunctuation: false,
        contextualStrings: [], // Could add expected words here for better accuracy
      });

      // Set a timeout for no speech detection (10 seconds - give user more time)
      noSpeechTimeout = setTimeout(() => {
        if (isActive && !hasSpeechStarted && !hasResult) {
          if (__DEV__) console.log('No speech timeout triggered');
          callbacks.onError('No speech detected. Tap mic and speak clearly.');
          cleanup();
        }
      }, 10000);

    } catch (e: any) {
      if (__DEV__) console.error('Failed to start recognition:', e);
      if (isActive) {
        callbacks.onError(e.message || 'Failed to start listening');
        callbacks.onEnd();
      }
    }
  };

  const cleanup = async () => {
    isActive = false;
    if (noSpeechTimeout) {
      clearTimeout(noSpeechTimeout);
      noSpeechTimeout = null;
    }
    try {
      await ExpoSpeechRecognitionModule.stop();
      // Reset audio session back to playback mode (this takes ~350ms)
      await resetAudioSession();
    } catch (e) {
      // Ignore stop errors
    }
  };

  // Set up event listeners
  const resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
    if (!isActive) return;

    // Get the best transcript
    const transcript = event.results[0]?.transcript;

    if (transcript) {
      hasSpeechStarted = true;

      // Clear no-speech timeout once we detect speech
      if (noSpeechTimeout) {
        clearTimeout(noSpeechTimeout);
        noSpeechTimeout = null;
      }

      if (event.isFinal) {
        hasResult = true;
        if (__DEV__) console.log('Final transcript:', transcript);
        callbacks.onResult(transcript);
      } else {
        // Interim result - let the UI know we're hearing something
        lastInterimTranscript = transcript;
        if (__DEV__) console.log('Interim transcript:', transcript);
        if (callbacks.onPartialResult) {
          callbacks.onPartialResult(transcript);
        }
      }
    }
  });

  // Listen for speech start event
  const startSubscription = ExpoSpeechRecognitionModule.addListener('start', () => {
    if (__DEV__) console.log('Speech recognition started');
  });

  // Listen for audio start (microphone is active)
  const audioStartSubscription = ExpoSpeechRecognitionModule.addListener('audiostart', () => {
    if (__DEV__) console.log('Audio capture started');
  });

  const errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
    if (!isActive) return;

    if (__DEV__) console.log('Speech recognition error:', event.error, event);

    let errorMessage: string;
    switch (event.error) {
      case 'no-speech':
        // If we had interim results, use the last one
        if (lastInterimTranscript && !hasResult) {
          if (__DEV__) console.log('Using last interim transcript:', lastInterimTranscript);
          hasResult = true;
          callbacks.onResult(lastInterimTranscript);
          return;
        }
        errorMessage = 'No speech detected. Speak closer to the mic.';
        break;
      case 'audio-capture':
        errorMessage = 'Could not capture audio. Check microphone.';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone access denied.';
        break;
      case 'network':
        errorMessage = 'Network error. Check connection.';
        break;
      case 'aborted':
        // User cancelled, don't show error
        errorMessage = '';
        break;
      case 'speech-timeout':
        // If we had interim results, use them
        if (lastInterimTranscript && !hasResult) {
          if (__DEV__) console.log('Using last interim transcript on timeout:', lastInterimTranscript);
          hasResult = true;
          callbacks.onResult(lastInterimTranscript);
          return;
        }
        errorMessage = 'Speech timed out. Try speaking sooner.';
        break;
      default:
        errorMessage = 'Could not recognize speech. Try again.';
    }

    if (errorMessage) {
      callbacks.onError(errorMessage);
    }

    // Reset audio session on error to restore volume
    resetAudioSession();
  });

  const endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
    if (!isActive) return;

    if (__DEV__) console.log('Speech recognition ended, hasResult:', hasResult, 'lastInterim:', lastInterimTranscript);

    // Reset audio session back to playback mode
    resetAudioSession();

    // If no final result but we have interim, use it
    if (!hasResult && lastInterimTranscript) {
      if (__DEV__) console.log('Using interim transcript on end:', lastInterimTranscript);
      hasResult = true;
      callbacks.onResult(lastInterimTranscript);
      return;
    }

    // If no result was received at all
    if (!hasResult) {
      callbacks.onEnd();
    }
  });

  // Start the recognition
  startRecognition();

  // Return cleanup function
  return () => {
    isActive = false;
    if (noSpeechTimeout) {
      clearTimeout(noSpeechTimeout);
      noSpeechTimeout = null;
    }
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      // Ignore stop errors
    }
    // Reset audio session back to playback mode
    resetAudioSession();
    resultSubscription.remove();
    startSubscription.remove();
    audioStartSubscription.remove();
    errorSubscription.remove();
    endSubscription.remove();
  };
};

/**
 * Calculate similarity between two strings
 * Uses Levenshtein distance for more accurate comparison
 */
export const calculateSimilarity = (spoken: string, expected: string): number => {
  const spokenNorm = normalizeJapanese(spoken);
  const expectedNorm = normalizeJapanese(expected);

  // Exact match
  if (spokenNorm === expectedNorm) {
    return 100;
  }

  // Check containment (user said the word within a longer phrase)
  // If the expected is fully contained, give full score
  if (spokenNorm.includes(expectedNorm)) {
    return 100;
  }
  // If spoken is contained in expected (user said part of it), give partial
  if (expectedNorm.includes(spokenNorm)) {
    return 95;
  }

  // Levenshtein distance
  const distance = levenshteinDistance(spokenNorm, expectedNorm);
  const maxLength = Math.max(spokenNorm.length, expectedNorm.length);

  if (maxLength === 0) return 100;

  const similarity = Math.round(((maxLength - distance) / maxLength) * 100);
  return Math.max(0, similarity);
};

/**
 * Normalize Japanese text for comparison
 * Handles hiragana/katakana conversion and removes common variations
 */
const normalizeJapanese = (text: string): string => {
  let normalized = text.toLowerCase().trim();

  // Convert katakana to hiragana for comparison
  normalized = katakanaToHiragana(normalized);

  // Remove common filler sounds
  normalized = normalized.replace(/[ーっ]/g, '');

  // Normalize long vowels
  normalized = normalized
    .replace(/おう/g, 'お')
    .replace(/えい/g, 'え')
    .replace(/uu/g, 'u')
    .replace(/ou/g, 'o')
    .replace(/ei/g, 'e');

  return normalized;
};

/**
 * Convert katakana to hiragana
 */
const katakanaToHiragana = (text: string): string => {
  return text.replace(/[\u30A1-\u30F6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
};

/**
 * Convert hiragana to romaji for fallback comparison
 */
const hiraganaToRomaji = (text: string): string => {
  const map: Record<string, string> = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  };

  let result = text;
  // Process digraphs first (longer matches)
  const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const kana of sortedKeys) {
    result = result.split(kana).join(map[kana]);
  }
  return result;
};

/**
 * Levenshtein distance for fuzzy string matching
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;

  // Create matrix
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first column
  for (let i = 0; i <= m; i++) dp[i][0] = i;

  // Initialize first row
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the rest
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
};

/**
 * Check Japanese pronunciation with multiple comparison strategies
 */
export const checkJapanesePronunciation = (
  spoken: string,
  expectedJapanese: string,
  expectedRomaji: string
): { score: number; feedback: string } => {
  // Speech recognition for Japanese typically returns Japanese characters
  // but may also return romaji depending on the recognition engine

  // Remove punctuation for comparison
  const removePunctuation = (s: string) => s.replace(/[。、！？!?,.\s]/g, '');

  const spokenNorm = removePunctuation(spoken.trim());
  const japaneseNorm = removePunctuation(expectedJapanese.trim());
  const romajiNorm = expectedRomaji.toLowerCase().trim().replace(/[.,!?\s]/g, '');

  if (__DEV__) console.log('Comparing:', { spoken: spokenNorm, expected: japaneseNorm, romaji: romajiNorm });

  // Try multiple comparison strategies and take the best score
  const scores: number[] = [];

  // 0. Check for exact match first (after removing punctuation)
  const spokenHiragana = normalizeJapanese(spokenNorm);
  const expectedHiragana = normalizeJapanese(japaneseNorm);
  if (spokenHiragana === expectedHiragana || spokenNorm === japaneseNorm) {
    if (__DEV__) console.log('Exact match - score 100');
    return { score: 100, feedback: 'Perfect!' };
  }

  // 1. Direct comparison with Japanese
  const directScore = calculateSimilarity(spokenNorm, japaneseNorm);
  scores.push(directScore);
  if (__DEV__) console.log('Direct Japanese score:', directScore);

  // 2. Compare with romaji (if speech recognition returned English-ish)
  const romajiScore = calculateSimilarity(spokenNorm.toLowerCase(), romajiNorm);
  scores.push(romajiScore);
  if (__DEV__) console.log('Romaji score:', romajiScore);

  // 3. Convert spoken Japanese to romaji and compare
  const spokenAsRomaji = hiraganaToRomaji(normalizeJapanese(spokenNorm)).replace(/\s/g, '');
  const convertedScore = calculateSimilarity(spokenAsRomaji, romajiNorm);
  scores.push(convertedScore);
  if (__DEV__) console.log('Converted to romaji score:', convertedScore, 'spoken as romaji:', spokenAsRomaji);

  // 4. Hiragana normalized comparison
  const hiraganaScore = calculateSimilarity(spokenHiragana, expectedHiragana);
  scores.push(hiraganaScore);
  if (__DEV__) console.log('Hiragana normalized score:', hiraganaScore);

  // 5. Check if the spoken text contains the expected word (for longer utterances)
  // Give full score if it's essentially correct
  if (spokenNorm.includes(japaneseNorm) || spokenHiragana.includes(expectedHiragana)) {
    scores.push(100); // Full score if the expected is contained exactly
    if (__DEV__) console.log('Word contained in speech - score 100');
  }

  // 6. Check if romaji version matches closely
  if (spokenAsRomaji === romajiNorm) {
    scores.push(100);
    if (__DEV__) console.log('Romaji exact match - score 100');
  } else if (spokenAsRomaji.includes(romajiNorm) || romajiNorm.includes(spokenAsRomaji)) {
    scores.push(95);
    if (__DEV__) console.log('Romaji contained - score 95');
  }

  const score = Math.max(...scores);
  if (__DEV__) console.log('Final score:', score);

  let feedback: string;
  if (score >= 90) {
    feedback = 'Perfect!';
  } else if (score >= 75) {
    feedback = 'Great!';
  } else if (score >= 60) {
    feedback = 'Good! Keep practicing.';
  } else if (score >= 45) {
    feedback = 'Close! Try again.';
  } else {
    feedback = `Say: "${romajiNorm}"`;
  }

  return { score, feedback };
};

/**
 * General pronunciation checker for any language
 * Uses simple string comparison with normalization
 */
export const checkPronunciation = (
  spoken: string,
  expectedWord: string
): { score: number; feedback: string } => {
  const spokenNorm = spoken.trim().toLowerCase();
  const expectedNorm = expectedWord.trim().toLowerCase();

  if (__DEV__) console.log('Comparing pronunciation:', { spoken: spokenNorm, expected: expectedNorm });

  // Calculate similarity using Levenshtein distance
  const maxLen = Math.max(spokenNorm.length, expectedNorm.length);
  if (maxLen === 0) return { score: 100, feedback: 'Perfect!' };

  const distance = levenshteinDistance(spokenNorm, expectedNorm);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  // Also check if spoken contains expected or vice versa
  let score = Math.round(similarity);
  if (spokenNorm.includes(expectedNorm) || expectedNorm.includes(spokenNorm)) {
    score = Math.max(score, 85);
  }
  if (spokenNorm === expectedNorm) {
    score = 100;
  }

  if (__DEV__) console.log('Pronunciation score:', score);

  let feedback: string;
  if (score >= 90) {
    feedback = 'Perfect!';
  } else if (score >= 75) {
    feedback = 'Great!';
  } else if (score >= 60) {
    feedback = 'Good! Keep practicing.';
  } else if (score >= 45) {
    feedback = 'Close! Try again.';
  } else {
    feedback = `Say: "${expectedWord}"`;
  }

  return { score, feedback };
};

/**
 * Mock hook for when native module isn't available
 */
let _useSpeechRecognitionEvent: any = () => {};

if (isNativeModuleAvailable) {
  try {
    _useSpeechRecognitionEvent = require('expo-speech-recognition').useSpeechRecognitionEvent;
  } catch (e) {
    // Module not available
  }
}

export const useSpeechRecognitionEvent = _useSpeechRecognitionEvent;
