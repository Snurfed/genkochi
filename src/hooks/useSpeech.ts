import { useCallback } from 'react';
import { useAppStore } from '../store';
import { speakText, stopSpeaking, isSpeaking, SPEECH_RATES } from '../utils/speech';

interface SpeakOptions {
  slow?: boolean;
  rate?: number;
  onDone?: () => void;
  onError?: (error: string) => void;
}

/**
 * Hook for language-aware text-to-speech
 * Automatically uses the user's target language setting
 */
export function useSpeech() {
  const { targetLanguage } = useAppStore();
  const speechCode = targetLanguage.speechCode;

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      speakText(text, { ...options, languageCode: speechCode });
    },
    [speechCode]
  );

  const speakSlow = useCallback(
    (text: string, options: Omit<SpeakOptions, 'slow'> = {}) => {
      speak(text, { ...options, slow: true });
    },
    [speak]
  );

  return {
    speak,
    speakSlow,
    stop: stopSpeaking,
    isSpeaking,
    speechCode,
    SPEECH_RATES,
  };
}
