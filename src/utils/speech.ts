import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import OpenAI from 'openai';

interface SpeakOptions {
  slow?: boolean;
  rate?: number;
  onDone?: () => void;
  onError?: (error: string) => void;
  onLoading?: (loading: boolean) => void;
  languageCode?: string;
}

// Current audio player instance (for OpenAI TTS)
let currentPlayer: AudioPlayer | null = null;

// Track if native speech is active
let nativeSpeechActive = false;

// Generation counter to prevent race conditions
let speakGeneration = 0;

// Cache directory for TTS audio files
const TTS_CACHE_DIR = `${FileSystem.cacheDirectory}tts/`;

// OpenAI client
let openaiClient: OpenAI | null = null;

// Backend proxy URL for TTS
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Cache directory initialization state
let cacheDirReady = false;

// Audio mode initialization state
let audioModeConfigured = false;

// Languages that use native device TTS (Latin scripts with good native voices)
// These have excellent native voices on iOS/Android
const NATIVE_TTS_LANGUAGES = new Set([
  'en-US', 'en-GB',           // English
  'es-ES', 'es-MX',           // Spanish
  'fr-FR', 'fr-CA',           // French
  'de-DE',                    // German
  'it-IT',                    // Italian
  'pt-BR', 'pt-PT',           // Portuguese
  'nl-NL',                    // Dutch
  'sv-SE',                    // Swedish
  'pl-PL',                    // Polish
  'tr-TR',                    // Turkish
  'vi-VN',                    // Vietnamese
  'id-ID',                    // Indonesian
  'ru-RU',                    // Russian (Cyrillic but has good native voices)
]);

// Languages that use OpenAI TTS (CJK and scripts with poor native support)
// OpenAI handles these well with auto-detection
const OPENAI_TTS_LANGUAGES = new Set([
  'ja-JP',                    // Japanese
  'zh-CN', 'zh-TW',           // Chinese
  'ko-KR',                    // Korean
  'ar-SA',                    // Arabic
  'hi-IN',                    // Hindi
  'el-GR',                    // Greek
  'he-IL',                    // Hebrew
  'th-TH',                    // Thai
]);

function shouldUseNativeTTS(languageCode?: string): boolean {
  if (!languageCode) return false;
  if (NATIVE_TTS_LANGUAGES.has(languageCode)) return true;
  if (OPENAI_TTS_LANGUAGES.has(languageCode)) return false;
  // Default: use native for unknown Latin-script languages
  return true;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Use backend proxy if configured (production)
    if (API_BASE_URL) {
      openaiClient = new OpenAI({
        apiKey: 'proxy', // Not used - backend has the real key
        baseURL: `${API_BASE_URL}/api`,
        dangerouslyAllowBrowser: true,
      });
    } else {
      // Development fallback
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured. Set EXPO_PUBLIC_API_BASE_URL for production.');
      }
      openaiClient = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
  }
  return openaiClient;
}

async function ensureCacheDir(): Promise<void> {
  if (cacheDirReady) return;
  const dirInfo = await FileSystem.getInfoAsync(TTS_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(TTS_CACHE_DIR, { intermediates: true });
  }
  cacheDirReady = true;
}

// Cache version - increment to invalidate old cached audio
// v8: Hybrid TTS - native for Latin scripts, OpenAI for CJK
const CACHE_VERSION = 8;

function getCacheKey(text: string, slow: boolean): string {
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `tts_v${CACHE_VERSION}_${Math.abs(hash)}_${slow ? 'slow' : 'normal'}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Configure audio mode for loud playback
 */
async function configureAudioMode(force = false): Promise<void> {
  if (audioModeConfigured && !force) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'doNotMix',
    });
    audioModeConfigured = true;
    if (__DEV__) console.log('[Speech] Audio mode configured' + (force ? ' (forced)' : ''));
  } catch (e) {
    if (__DEV__) console.log('[Speech] Failed to configure audio mode:', e);
  }
}

configureAudioMode();

/**
 * Speak using native device TTS (expo-speech)
 * Better for Latin-script languages with native voice support
 */
async function speakWithNativeTTS(
  text: string,
  options: SpeakOptions
): Promise<void> {
  const { slow = false, rate, onDone, onError, languageCode } = options;

  // Native TTS rate: 0.5 for slow (very noticeable), 1.0 for normal
  // Also check if rate was explicitly set to a slow value
  const isSlowMode = slow || (rate !== undefined && rate < 0.8);
  const speechRate = isSlowMode ? 0.5 : 1.0;

  return new Promise((resolve) => {
    nativeSpeechActive = true;

    Speech.speak(text, {
      language: languageCode,
      rate: speechRate,
      pitch: 1.0,
      onDone: () => {
        nativeSpeechActive = false;
        onDone?.();
        resolve();
      },
      onError: (error) => {
        nativeSpeechActive = false;
        if (__DEV__) console.log('[Speech] Native TTS error:', error);
        onError?.(String(error));
        resolve();
      },
      onStopped: () => {
        nativeSpeechActive = false;
        resolve();
      },
    });

    if (__DEV__) console.log('[Speech] Playing native TTS:', text.substring(0, 30), `(${languageCode})`);
  });
}

/**
 * Get cached audio path or generate new audio using OpenAI
 */
async function getAudioPath(text: string, slow: boolean, languageCode?: string): Promise<string> {
  await ensureCacheDir();

  const cacheKey = getCacheKey(text + (languageCode || ''), slow);
  const audioPath = `${TTS_CACHE_DIR}${cacheKey}.mp3`;

  const fileInfo = await FileSystem.getInfoAsync(audioPath);
  if (fileInfo.exists) {
    return audioPath;
  }

  const client = getOpenAIClient();
  const speed = slow ? 0.75 : 1.0;

  if (__DEV__) console.log('[Speech] Generating OpenAI TTS:', text.substring(0, 50));

  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    speed,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  await FileSystem.writeAsStringAsync(audioPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return audioPath;
}

/**
 * Speak using OpenAI TTS
 * Better for CJK and non-Latin scripts
 */
async function speakWithOpenAI(
  text: string,
  options: SpeakOptions
): Promise<void> {
  const { slow = false, rate, onDone, onError, onLoading, languageCode } = options;
  const isSlow = slow || (rate !== undefined && rate < 0.7);

  const thisGeneration = ++speakGeneration;

  try {
    // Stop any playing audio (quick check, no await if nothing playing)
    if (currentPlayer) {
      await stopOpenAIAudio();
    }

    if (thisGeneration !== speakGeneration) return;

    onLoading?.(true);

    const audioPath = await getAudioPath(text, isSlow, languageCode);

    if (thisGeneration !== speakGeneration) {
      onLoading?.(false);
      return;
    }

    onLoading?.(false);

    await configureAudioMode();

    const player = createAudioPlayer({ uri: audioPath });
    currentPlayer = player;
    player.volume = 1.0;

    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        player.remove();
        if (currentPlayer === player) {
          currentPlayer = null;
        }
        onDone?.();
      }
    });

    player.play();
    if (__DEV__) console.log('[Speech] Playing OpenAI audio:', text.substring(0, 30));

  } catch (error) {
    if (__DEV__) console.log('[Speech] OpenAI TTS error:', error);
    onLoading?.(false);
    onError?.(String(error));
  }
}

/**
 * Stop OpenAI audio playback
 */
async function stopOpenAIAudio(): Promise<void> {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch (e) {
      // Ignore
    }
    currentPlayer = null;
  }
}

/**
 * Speak text using hybrid TTS
 * - Native device TTS for Latin-script languages (Spanish, French, etc.)
 * - OpenAI TTS for CJK and other scripts (Japanese, Chinese, etc.)
 */
export async function speakText(
  text: string,
  options: SpeakOptions = {}
): Promise<void> {
  const { languageCode } = options;

  if (!text || text.trim().length === 0) {
    if (__DEV__) console.log('[Speech] Empty text, skipping');
    return;
  }

  if (__DEV__) console.log('[Speech] ========== TTS DEBUG ==========');
  if (__DEV__) console.log('[Speech] Text:', text.substring(0, 50));
  if (__DEV__) console.log('[Speech] Language:', languageCode || 'auto');
  if (__DEV__) console.log('[Speech] Engine:', shouldUseNativeTTS(languageCode) ? 'NATIVE' : 'OPENAI');
  if (__DEV__) console.log('[Speech] ================================');

  // Stop any current audio - don't await if nothing is playing
  if (nativeSpeechActive || currentPlayer) {
    await stopSpeaking();
  }

  if (shouldUseNativeTTS(languageCode)) {
    await speakWithNativeTTS(text, options);
  } else {
    await speakWithOpenAI(text, options);
  }
}

/**
 * Stop all audio (both native and OpenAI)
 */
export async function stopSpeaking(): Promise<void> {
  // Stop native speech
  if (nativeSpeechActive) {
    try {
      await Speech.stop();
      nativeSpeechActive = false;
    } catch (e) {
      // Ignore
    }
  }

  // Stop OpenAI audio
  await stopOpenAIAudio();
}

/**
 * Check if audio is playing
 */
export async function isSpeaking(): Promise<boolean> {
  if (nativeSpeechActive) return true;
  if (currentPlayer) {
    try {
      return currentPlayer.playing;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Reset audio session after speech recognition
 */
export async function resetAudioSession(): Promise<void> {
  try {
    if (__DEV__) console.log('[Speech] Resetting audio session...');

    await new Promise(resolve => setTimeout(resolve, 150));

    await setIsAudioActiveAsync(false);
    await new Promise(resolve => setTimeout(resolve, 100));
    await setIsAudioActiveAsync(true);

    await configureAudioMode(true);

    if (__DEV__) console.log('[Speech] Audio session reset complete');
  } catch (e) {
    if (__DEV__) console.log('[Speech] Reset error:', e);
  }
}

/**
 * Preload audio for a word (only for OpenAI TTS languages)
 */
export async function preloadAudio(text: string, slow = false, languageCode?: string): Promise<void> {
  // Skip preloading for native TTS languages (they don't need it)
  if (shouldUseNativeTTS(languageCode)) return;

  try {
    await getAudioPath(text, slow, languageCode);
  } catch (e) {
    // Ignore preload errors
  }
}

// Legacy exports for compatibility
export const SPEECH_RATES = { SLOW: 0.5, NORMAL: 1.0 };
export async function speakJapanese(text: string, options: SpeakOptions = {}) {
  return speakText(text, options);
}
export async function loadJapaneseVoice() {}
export function clearVoiceCache() {}
export async function checkVoiceQuality() {
  return { hasEnhancedVoice: true, hasPremiumVoice: true, usingCompactVoice: false, selectedVoiceName: 'Hybrid TTS' };
}
