import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { Word, ReadingLevel, Sentence } from '../../types';
import { FuriganaText, ScriptBadge } from '../FuriganaText';
import { colors, borderRadius, spacing, typography, shadows } from '../../constants/design';
import { speakText, SPEECH_RATES, preloadAudio } from '../../utils/speech';
import { useAppStore } from '../../store';
import { useTranslations } from '../../hooks/useTranslations';
import {
  startListening,
  checkJapanesePronunciation,
  checkPronunciation,
  isSpeechRecognitionAvailable,
  requestSpeechPermissions,
} from '../../utils/speechRecognition';
import {
  getNativeTranslation,
  getSentenceTranslation,
} from '../../utils/nativeTranslation';
import {
  getTTSField,
  getTextForTTS,
} from '../../constants/languages';
import FloatingCard from './FloatingCard';
import { detectScriptType } from '../../utils/japaneseText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'pronunciation' | 'write' | 'sentence' | 'quiz';

interface WordDetailCardProps {
  word: Word;
  sentences?: Sentence[];
  allWords?: Word[];
  readingLevel?: ReadingLevel;
  onClose: () => void;
  onSentenceQuiz?: (sentence: Sentence) => void;
  onQuizComplete?: (wordId: string, correct: boolean, fast: boolean) => void;
}

/**
 * WordDetailCard - Comprehensive word learning overlay
 * Tabs: Say it, Write, Sentence, Quiz
 */
export function WordDetailCard({
  word,
  sentences = [],
  allWords = [],
  readingLevel = 'romaji',
  onClose,
  onSentenceQuiz,
  onQuizComplete,
}: WordDetailCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('pronunciation');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);
  const [strokePaths, setStrokePaths] = useState<string[]>([]);
  const [meaningRevealed, setMeaningRevealed] = useState(false);

  // Get target and native language for speech and translations
  const { targetLanguage, nativeLanguage } = useAppStore();
  const speechCode = targetLanguage.speechCode;
  const t = useTranslations();

  // Get native translation for this word (NOT English unless native is English)
  const wordMeaning = getNativeTranslation(word, nativeLanguage);

  // Determine if we're using spelling mode (needs scrolling) vs character tracing (no scrolling)
  const useSpellingMode = targetLanguage.script === 'latin' && targetLanguage.code !== 'en';
  // Only disable scrolling for character tracing (CJK write mode), not for spelling mode
  const shouldDisableScroll = activeTab === 'write' && !useSpellingMode;

  // Helper function to get the correct text to speak based on target language
  // Uses centralized TTS field logic from languages.ts
  const getTextToSpeak = () => {
    return getTextForTTS(targetLanguage, word.japanese, word.reading);
  };

  // Helper function to speak in target language
  const speak = (text: string, options: { slow?: boolean; onDone?: () => void; onError?: () => void } = {}) => {
    speakText(text, { ...options, languageCode: speechCode });
  };

  useEffect(() => {
    // Preload audio immediately for instant playback
    const text = getTextToSpeak();
    preloadAudio(text, false, speechCode);
    preloadAudio(text, true, speechCode); // Also preload slow version

    // Auto-play on open (after brief UI settle)
    setTimeout(() => handleSpeak(false), 300);
  }, [word.id]);

  const handleSpeak = (slow = false) => {
    if (isLoading || isPlaying) return; // Prevent double-tap

    const text = getTextToSpeak();

    speakText(text, {
      rate: slow ? SPEECH_RATES.SLOW : SPEECH_RATES.NORMAL,
      languageCode: speechCode,
      onLoading: setIsLoading,
      onDone: () => {
        setIsPlaying(false);
        setIsLoading(false);
      },
      onError: () => {
        setIsPlaying(false);
        setIsLoading(false);
      },
    });

    setIsPlaying(true);
  };

  // Find sentences containing this word (multiple matching strategies)
  const relatedSentences = sentences.filter(s => {
    // 1. Check if word ID is in sentence's wordIds array
    if (s.wordIds?.includes(word.id)) return true;
    // 2. Check if sentence contains the word's Japanese text
    if (word.japanese && s.japanese.includes(word.japanese)) return true;
    // 3. Check if sentence contains the word's reading
    if (word.reading && s.japanese.includes(word.reading)) return true;
    // 4. Check if the word contains part of the sentence (for phrases)
    if (word.japanese && s.japanese && word.japanese.includes(s.japanese.slice(0, 3))) return true;
    return false;
  }).slice(0, 2);

  // If no related sentences found, use any available sentence for practice
  const displaySentences = relatedSentences.length > 0 ? relatedSentences : sentences.slice(0, 1);

  const furiganaSegments = word.furigana || [{
    text: word.japanese,
    reading: word.reading || word.japanese,
    isKanji: word.containsKanji || false,
  }];

  const tabs: { key: TabType; icon: string; label: string }[] = [
    { key: 'pronunciation', icon: 'mic', label: t.study.sayIt },
    { key: 'write', icon: 'pencil', label: t.study.write },
    { key: 'sentence', icon: 'chatbubble', label: t.study.sentence },
    { key: 'quiz', icon: 'school', label: t.study.quiz },
  ];

  // Get current step number for progress indicator
  const currentStepIndex = tabs.findIndex(tab => tab.key === activeTab);
  const totalSteps = tabs.length;

  return (
    <FloatingCard onClose={onClose} scrollEnabled={!shouldDisableScroll}>
      {/* Step progress indicator - always show */}
      <View style={styles.stepProgressContainer}>
          <View style={styles.stepProgressRow}>
            {tabs.map((tab, index) => (
              <React.Fragment key={tab.key}>
                <TouchableOpacity
                  style={[
                    styles.stepCircle,
                    index === currentStepIndex && styles.stepCircleActive,
                    index < currentStepIndex && styles.stepCircleCompleted,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={14}
                    color={index <= currentStepIndex ? colors.white : colors.textMuted}
                  />
                </TouchableOpacity>
                {index < tabs.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      index < currentStepIndex && styles.stepConnectorCompleted,
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.stepLabel}>
            {t.study.step} {currentStepIndex + 1}/{totalSteps}: {tabs[currentStepIndex].label}
          </Text>
        </View>

      {/* Word header - compact on Write tab */}
      <View style={[styles.header, activeTab === 'write' && styles.headerCompact]}>
        <View style={styles.headerMain}>
          <Text style={[styles.japanese, activeTab === 'write' && styles.japaneseCompact]}>
            {word.japanese || word.romaji || word.reading}
          </Text>
          <TouchableOpacity
            style={[styles.playButton, (isPlaying || isLoading) && styles.playButtonActive]}
            onPress={() => handleSpeak(false)}
            disabled={isLoading}
          >
            <Ionicons
              name={isLoading ? 'hourglass' : isPlaying ? 'pause' : 'volume-high'}
              size={18}
              color={(isPlaying || isLoading) ? colors.white : colors.primary}
            />
          </TouchableOpacity>
        </View>
        {activeTab !== 'write' && targetLanguage.code === 'ja' && (
          <>
            <Text style={styles.reading}>{word.reading}</Text>
            <Text style={styles.romaji}>{word.romaji}</Text>
          </>
        )}
        {/* Tap to reveal meaning - hide on SpellingTab (meaning shown in SpellingTab) */}
        {!(useSpellingMode && activeTab === 'write') && (
          <TouchableOpacity
            style={styles.meaningTapArea}
            onPress={() => setMeaningRevealed(true)}
            disabled={meaningRevealed}
          >
            {meaningRevealed ? (
              <Text style={[styles.meaning, activeTab === 'write' && styles.meaningCompact]}>{wordMeaning}</Text>
            ) : (
              <View style={styles.meaningHidden}>
                <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
                <Text style={styles.meaningHiddenText}>{t.study.tapToSeeMeaning}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {word.partOfSpeech && activeTab !== 'write' && meaningRevealed && (
          <Text style={styles.pos}>{word.partOfSpeech}</Text>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? colors.white : colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'pronunciation' && (
          <PronunciationTab word={word} onSpeak={handleSpeak} isPlaying={isPlaying} onScore={setSpeakingScore} />
        )}
        {activeTab === 'write' && (
          <WriteTab word={word} />
        )}
        {activeTab === 'sentence' && (
          <SentenceTab
            word={word}
            sentences={displaySentences}
            allWords={allWords}
            onPractice={onSentenceQuiz}
          />
        )}
        {activeTab === 'quiz' && (
          <QuizTab
            word={word}
            allWords={allWords}
            sentence={displaySentences[0]}
            onQuizComplete={onQuizComplete}
          />
        )}
      </View>
    </FloatingCard>
  );
}

// ============ PRONUNCIATION TAB (merged Listen + Speak) ============
function PronunciationTab({
  word,
  onSpeak,
  isPlaying,
  onScore
}: {
  word: Word;
  onSpeak: (slow: boolean) => void;
  isPlaying: boolean;
  onScore: (score: number) => void;
}) {
  const [slowMode, setSlowMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');
  const partialTextRef = useRef(''); // Ref for immediate access
  const [result, setResult] = useState<{
    status: 'idle' | 'listening' | 'processing' | 'success' | 'retry' | 'error';
    score?: number;
    feedback?: string;
    spoken?: string;
  }>({ status: 'idle' });
  const stopListeningRef = useRef<(() => void) | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations();
  const { targetLanguage } = useAppStore();

  const isAvailable = isSpeechRecognitionAvailable();

  const handleListen = () => {
    onSpeak(slowMode);
  };

  const processResult = (transcript: string) => {
    if (__DEV__) console.log('Processing result:', transcript);
    // Use Japanese-specific checker for Japanese, general checker for other languages
    const isJapanese = targetLanguage.code === 'ja';
    const { score, feedback } = isJapanese
      ? checkJapanesePronunciation(transcript, word.japanese, word.romaji)
      : checkPronunciation(transcript, word.japanese);
    if (__DEV__) console.log('Score:', score, 'Feedback:', feedback);

    // Set result immediately - no delay
    const newResult = score >= 60
      ? { status: 'success' as const, score, feedback, spoken: transcript }
      : { status: 'retry' as const, score, feedback, spoken: transcript };

    if (__DEV__) console.log('Setting result:', newResult);
    setResult(newResult);
    onScore(score);
  };

  const handleRecord = () => {
    if (isRecording) {
      // Stop recording
      if (__DEV__) console.log('Stopping recording, partialTextRef:', partialTextRef.current);
      // Clear auto-stop timeout
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      if (stopListeningRef.current) {
        stopListeningRef.current();
        stopListeningRef.current = null;
      }
      setIsRecording(false);

      // Use ref value (always current) for grading
      const textToGrade = partialTextRef.current;
      if (textToGrade) {
        if (__DEV__) console.log('Grading text:', textToGrade);
        processResult(textToGrade);
      } else {
        if (__DEV__) console.log('No text to grade');
        setResult({ status: 'idle' });
      }
      return;
    }

    // Start recording
    setIsRecording(true);
    setPartialText('');
    partialTextRef.current = '';
    setResult({ status: 'listening' });

    stopListeningRef.current = startListening(targetLanguage.speechCode, {
      onResult: (transcript) => {
        // Final result from speech recognition - auto-grade
        if (__DEV__) console.log('Final result:', transcript);
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
        setIsRecording(false);
        processResult(transcript);
      },
      onPartialResult: (transcript) => {
        setPartialText(transcript);
        partialTextRef.current = transcript;

        // Auto-stop after 1.5s of silence - reset timeout on each new partial
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
        }
        autoStopTimeoutRef.current = setTimeout(() => {
          if (__DEV__) console.log('Auto-stop after silence, text:', partialTextRef.current);
          if (stopListeningRef.current) {
            stopListeningRef.current();
            stopListeningRef.current = null;
          }
          setIsRecording(false);
          if (partialTextRef.current) {
            processResult(partialTextRef.current);
          }
        }, 1500);
      },
      onError: (error) => {
        setIsRecording(false);
        setResult({ status: 'error', feedback: error });
      },
      onEnd: () => {
        // Speech ended - clear auto-stop timeout and grade if we have text
        if (__DEV__) console.log('Speech ended, partial:', partialTextRef.current);
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
        setIsRecording(false);
        if (partialTextRef.current) {
          processResult(partialTextRef.current);
        }
      },
    });
  };

  const handleTryAgain = () => {
    setResult({ status: 'idle' });
    setPartialText('');
    partialTextRef.current = '';
  };

  useEffect(() => {
    return () => {
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.pronunciationTab}>
      {/* Main pronunciation area - centered */}
      {!isAvailable ? (
        <View style={styles.unavailableBox}>
          <Ionicons name="information-circle" size={20} color={colors.textMuted} />
          <Text style={styles.unavailableText}>Speech requires dev build</Text>
        </View>
      ) : (
        <View style={styles.speakAreaCentered}>
          {/* Listen first section */}
          <View style={styles.listenSection}>
            <Text style={styles.sectionLabel}>Listen</Text>
            <View style={styles.listenButtons}>
              <TouchableOpacity
                style={[styles.listenBtnLarge, isPlaying && styles.listenBtnActive]}
                onPress={() => onSpeak(false)}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'volume-high'}
                  size={24}
                  color={isPlaying ? colors.white : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.listenBtnSmall}
                onPress={() => onSpeak(true)}
              >
                <Ionicons name="speedometer-outline" size={18} color={colors.textMuted} />
                <Text style={styles.slowLabel}>Slow</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Speak section */}
          <View style={styles.speakSection}>
            <Text style={styles.sectionLabel}>Speak</Text>
            <Text style={styles.sayTarget}>
              {targetLanguage.code === 'en' ? word.japanese : (word.romaji || word.reading || word.japanese)}
            </Text>

            {/* Record button */}
            <TouchableOpacity
              style={[styles.recordBtnLarge, isRecording && styles.recordBtnRecording]}
              onPress={handleRecord}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={40}
                color={colors.white}
              />
            </TouchableOpacity>

            {/* Status / Result area */}
            <View style={styles.resultAreaCompact}>
              {/* Show what was heard */}
              {(isRecording || result.spoken) && partialText && !result.feedback && (
                <Text style={styles.hearingText}>"{partialText}"</Text>
              )}

              {/* Success result */}
              {result.status === 'success' && (
                <View style={styles.resultInline}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.mint} />
                  <Text style={styles.resultInlineText}>{result.score}%</Text>
                  <TouchableOpacity onPress={handleTryAgain}>
                    <Text style={styles.tryAgainLink}>{t.study.again}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Retry result */}
              {result.status === 'retry' && (
                <View style={styles.resultInline}>
                  <Ionicons name="refresh-circle" size={28} color={colors.warning} />
                  <Text style={styles.resultInlineText}>{result.score}%</Text>
                  <TouchableOpacity onPress={handleTryAgain}>
                    <Text style={styles.tryAgainLink}>{t.study.tryAgain}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Error */}
              {result.status === 'error' && (
                <View style={styles.resultInline}>
                  <Ionicons name="alert-circle" size={24} color={colors.error} />
                  <TouchableOpacity onPress={handleTryAgain}>
                    <Text style={styles.tryAgainLink}>{t.study.tryAgain}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Listening state */}
              {isRecording && !partialText && (
                <Text style={styles.statusHint}>{t.study.listening}</Text>
              )}

              {/* Idle state */}
              {result.status === 'idle' && !isRecording && (
                <Text style={styles.statusHint}>Tap to record</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ============ WRITE TAB ============
// Canvas size - sized to fit with side arrows and toolbar
const { width: SCREEN_WIDTH_WRITE, height: SCREEN_HEIGHT_WRITE } = Dimensions.get('window');
const CARD_PADDING = 16;
const SIDE_ARROW_WIDTH = 44; // Space for side navigation arrows
// Max width: screen minus padding and side arrows
const MAX_CANVAS_WIDTH = SCREEN_WIDTH_WRITE - CARD_PADDING * 2 - SIDE_ARROW_WIDTH * 2;
// Height budget: screen - safe areas (~100) - header (~200) - char selector (~60) - toolbar (~60)
const OVERHEAD = 480;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT_WRITE - OVERHEAD;
// Use the smaller of width or available height, with reasonable bounds
const CANVAS_SIZE = Math.min(MAX_CANVAS_WIDTH, AVAILABLE_HEIGHT, 320);

// Convert hiragana to katakana
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)
  );
}

type ScriptMode = 'original' | 'hiragana' | 'katakana';

// Character tracing tab - drawing practice for all languages
interface CharacterWriteTabProps {
  word: Word;
}

function CharacterWriteTab({ word }: CharacterWriteTabProps) {
  // Detect if word contains kanji
  const detectedScript = detectScriptType(word.japanese);
  const hasKanji = detectedScript === 'kanji' || detectedScript === 'mixed';
  // User-selectable script mode for Japanese
  const [selectedScript, setSelectedScript] = useState<ScriptMode>(
    hasKanji ? 'original' : (detectedScript === 'katakana' ? 'katakana' : 'hiragana')
  );
  const scriptMode: ScriptMode = selectedScript;

  // Draw mode state
  const [charIndex, setCharIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [completedChars, setCompletedChars] = useState<Set<number>>(new Set());
  const currentPathRef = useRef<string>('');

  const { targetLanguage } = useAppStore();
  const t = useTranslations();

  // Language checks (needed early for keyboard logic)
  const isJapanese = targetLanguage.code === 'ja';
  const isKorean = targetLanguage.code === 'ko';
  const isChinese = targetLanguage.code === 'zh' || targetLanguage.code === 'zh-CN' || targetLanguage.code === 'zh-TW';

  // All languages support character tracing/drawing

  // Get characters for DRAWING - always use actual characters, not romanization
  const getDrawCharacters = () => {
    // For Japanese, use the appropriate script
    if (isJapanese) {
      switch (scriptMode) {
        case 'hiragana':
          return (word.reading || word.japanese).split('');
        case 'katakana':
          return hiraganaToKatakana(word.reading || word.japanese).split('');
        default:
          return word.japanese.split('');
      }
    }
    // For Chinese, Korean, and other languages - use actual characters
    return word.japanese.split('');
  };

  // Use draw characters for tracing display
  const drawCharacters = getDrawCharacters();
  const char = drawCharacters[charIndex] || '';

  // Reset when script mode changes
  useEffect(() => {
    setCharIndex(0);
    setStrokes([]);
    setCurrentPath('');
    currentPathRef.current = '';
    setCompletedChars(new Set());
  }, [scriptMode]);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  // Draw mode handlers
  const getCoordinates = (e: GestureResponderEvent) => {
    const nativeEvent = e.nativeEvent as any;
    if (Platform.OS === 'web' && nativeEvent.offsetX !== undefined) {
      return {
        x: Math.max(0, Math.min(CANVAS_SIZE, nativeEvent.offsetX)),
        y: Math.max(0, Math.min(CANVAS_SIZE, nativeEvent.offsetY)),
      };
    }
    return {
      x: Math.max(0, Math.min(CANVAS_SIZE, nativeEvent.locationX || 0)),
      y: Math.max(0, Math.min(CANVAS_SIZE, nativeEvent.locationY || 0)),
    };
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const { x, y } = getCoordinates(e);
    const path = `M ${x} ${y}`;
    currentPathRef.current = path;
    setCurrentPath(path);
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    if (!currentPathRef.current) return;
    const { x, y } = getCoordinates(e);
    const newPath = `${currentPathRef.current} L ${x} ${y}`;
    currentPathRef.current = newPath;
    setCurrentPath(newPath);
  };

  const handleTouchEnd = () => {
    const pathToSave = currentPathRef.current;
    if (!pathToSave) return;
    currentPathRef.current = '';
    setCurrentPath('');
    if (pathToSave.length > 10) {
      setStrokes(prev => [...prev, pathToSave]);
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentPath('');
    currentPathRef.current = '';
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const goToChar = (index: number) => {
    if (strokes.length > 0) {
      setCompletedChars(prev => new Set([...prev, charIndex]));
    }
    setCharIndex(index);
    setStrokes([]);
    setCurrentPath('');
    currentPathRef.current = '';
  };

  return (
    <View style={styles.writeTabContainer}>
      {/* Character tracing header */}
      <View style={styles.writeModeRow}>
        <View style={styles.writeModeToggle}>
          <View style={[styles.writeModeBtn, styles.writeModeBtnActive]}>
            <Ionicons name="pencil" size={14} color={colors.white} />
            <Text style={[styles.writeModeBtnLabel, styles.writeModeBtnLabelActive]}>
              {t.study.draw}
            </Text>
          </View>
        </View>

        {/* Japanese script selector - only show for Japanese with kanji */}
        {isJapanese && hasKanji && (
          <View style={styles.scriptSelector}>
            <TouchableOpacity
              style={[styles.scriptBtn, selectedScript === 'original' && styles.scriptBtnActive]}
              onPress={() => setSelectedScript('original')}
            >
              <Text style={[styles.scriptBtnText, selectedScript === 'original' && styles.scriptBtnTextActive]}>
                漢字
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scriptBtn, selectedScript === 'hiragana' && styles.scriptBtnActive]}
              onPress={() => setSelectedScript('hiragana')}
            >
              <Text style={[styles.scriptBtnText, selectedScript === 'hiragana' && styles.scriptBtnTextActive]}>
                ひらがな
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scriptBtn, selectedScript === 'katakana' && styles.scriptBtnActive]}
              onPress={() => setSelectedScript('katakana')}
            >
              <Text style={[styles.scriptBtnText, selectedScript === 'katakana' && styles.scriptBtnTextActive]}>
                カタカナ
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Character tracing */}
      <View style={styles.drawModeContainer}>
          {/* Character selector row - compact, centered */}
          <View style={styles.charSelectorRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.charSelectorContent}
            >
              {drawCharacters.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => goToChar(i)}
                  style={[
                    styles.drawCharBox,
                    i === charIndex && styles.drawCharBoxActive,
                    completedChars.has(i) && styles.drawCharBoxComplete,
                  ]}
                >
                  <Text style={[
                    styles.drawCharText,
                    i === charIndex && styles.drawCharTextActive,
                    completedChars.has(i) && styles.drawCharTextComplete,
                  ]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.charProgressTextSmall}>
              {completedChars.size}/{drawCharacters.length}
            </Text>
          </View>

          {/* Canvas row with side arrows */}
          <View style={styles.canvasWithArrows}>
            {/* Left arrow */}
            <TouchableOpacity
              style={[styles.sideArrow, charIndex === 0 && styles.sideArrowDisabled]}
              onPress={() => charIndex > 0 && goToChar(charIndex - 1)}
              disabled={charIndex === 0}
            >
              <Ionicons name="chevron-back" size={28} color={charIndex > 0 ? colors.primary : colors.border} />
            </TouchableOpacity>

            {/* Drawing canvas */}
            <View
              style={styles.writeCanvas}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onStartShouldSetResponderCapture={() => true}
              onMoveShouldSetResponderCapture={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={handleTouchStart}
              onResponderMove={handleTouchMove}
              onResponderRelease={handleTouchEnd}
            >
              {showGuide && <Text style={styles.writeGuideChar}>{char}</Text>}
              <View style={styles.writeGridV} />
              <View style={styles.writeGridH} />
              <Svg style={StyleSheet.absoluteFill} width={CANVAS_SIZE} height={CANVAS_SIZE}>
                {strokes.map((path, i) => (
                  <Path key={`stroke-${i}`} d={path} stroke={colors.navy} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {currentPath && (
                  <Path d={currentPath} stroke={colors.primary} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </Svg>
            </View>

            {/* Right arrow */}
            <TouchableOpacity
              style={[styles.sideArrow, charIndex === drawCharacters.length - 1 && styles.sideArrowDisabled]}
              onPress={() => charIndex < drawCharacters.length - 1 && goToChar(charIndex + 1)}
              disabled={charIndex === drawCharacters.length - 1}
            >
              <Ionicons name="chevron-forward" size={28} color={charIndex < drawCharacters.length - 1 ? colors.primary : colors.border} />
            </TouchableOpacity>
          </View>

          {/* Toolbar with Next button integrated */}
          <View style={styles.canvasToolbarCompact}>
            <TouchableOpacity
              style={[styles.toolbarBtnSmall, strokes.length === 0 && styles.toolbarBtnDisabled]}
              onPress={handleUndo}
              disabled={strokes.length === 0}
            >
              <Ionicons name="arrow-undo" size={18} color={strokes.length > 0 ? colors.textSecondary : colors.border} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarBtnSmall, strokes.length === 0 && styles.toolbarBtnDisabled]}
              onPress={handleClear}
              disabled={strokes.length === 0}
            >
              <Ionicons name="refresh" size={18} color={strokes.length > 0 ? colors.textSecondary : colors.border} />
            </TouchableOpacity>

            {/* Next/Done button - always visible but changes state */}
            <TouchableOpacity
              style={[
                styles.nextBtnInline,
                strokes.length === 0 && styles.nextBtnInlineDisabled,
              ]}
              onPress={() => {
                if (strokes.length > 0) {
                  if (charIndex < drawCharacters.length - 1) {
                    goToChar(charIndex + 1);
                  } else {
                    setCompletedChars(prev => new Set([...prev, charIndex]));
                  }
                }
              }}
              disabled={strokes.length === 0}
            >
              <Text style={[
                styles.nextBtnInlineText,
                strokes.length === 0 && styles.nextBtnInlineTextDisabled,
              ]}>
                {charIndex < drawCharacters.length - 1 ? 'Next' : 'Done'}
              </Text>
              <Ionicons
                name={charIndex < drawCharacters.length - 1 ? 'arrow-forward' : 'checkmark'}
                size={16}
                color={strokes.length > 0 ? colors.white : colors.border}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarBtnSmall}
              onPress={() => setShowGuide(!showGuide)}
            >
              <Ionicons name={showGuide ? 'eye' : 'eye-off-outline'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

    </View>
  );
}

// ============ WRITE TAB (Wrapper) ============
// Character tracing for all languages

function WriteTab({ word }: { word: Word }) {
  // Always use character tracing (draw mode) for all languages
  return <CharacterWriteTab word={word} />;
}

// ============ SENTENCE TAB ============
function SentenceTab({
  word,
  sentences,
  allWords,
  onPractice,
}: {
  word: Word;
  sentences: Sentence[];
  allWords: Word[];
  onPractice?: (sentence: Sentence) => void;
}) {
  const [selectedWord, setSelectedWord] = useState<{ japanese: string; reading: string; romaji: string; english: string; nativeTranslation?: string; isPhrase?: boolean; grammaticalRole?: GrammaticalRole; components?: { japanese: string; reading: string; romaji: string; english: string }[] } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const [pronunciationFeedback, setPronunciationFeedback] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [partialText, setPartialText] = useState('');
  const partialTextRef = useRef('');
  const stopListeningRef = useRef<(() => void) | null>(null);
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { targetLanguage, nativeLanguage } = useAppStore();
  const speechCode = targetLanguage.speechCode;
  const t = useTranslations();
  const isAvailable = isSpeechRecognitionAvailable();
  const speak = (text: string, options: { slow?: boolean; onDone?: () => void; onError?: () => void } = {}) => {
    speakText(text, { ...options, languageCode: speechCode });
  };

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
      }
    };
  }, []);

  // Preload audio for all phrase segments when sentence tab opens
  useEffect(() => {
    if (sentences.length > 0) {
      const sentence = sentences[0];
      // Preload full sentence
      const sentenceText = sentence.reading || sentence.japanese;
      preloadAudio(sentenceText, false, speechCode);
      preloadAudio(sentenceText, true, speechCode);

      // Preload each phrase/word segment
      const sentenceWords = parseSentenceWords(sentence, word, allWords);
      if (__DEV__) console.log('[Preload] Preloading audio for', sentenceWords.length, 'phrase segments');
      sentenceWords.forEach(sw => {
        const text = sw.reading || sw.japanese;
        preloadAudio(text, false, speechCode);
        // Also preload components if it's a phrase
        if (sw.components) {
          sw.components.forEach(comp => {
            preloadAudio(comp.reading || comp.japanese, false, speechCode);
          });
        }
      });
    }
  }, [sentences, word, allWords, speechCode]);

  // Process pronunciation result
  const processResult = (transcript: string, sentence: Sentence) => {
    if (__DEV__) console.log('Processing sentence result:', transcript);
    const result = targetLanguage.code === 'ja'
      ? checkJapanesePronunciation(transcript, sentence.japanese, sentence.romaji || '')
      : checkPronunciation(transcript, sentence.japanese || sentence.reading || '');
    if (__DEV__) console.log('Sentence score:', result.score, 'Feedback:', result.feedback);
    setPronunciationScore(result.score);
    setPronunciationFeedback(result.feedback);
  };

  // Handle sentence speaking practice
  const handleStartSpeakingPractice = async (sentence: Sentence) => {
    if (isRecording) {
      // Stop recording and grade
      if (__DEV__) console.log('Stopping recording, partialTextRef:', partialTextRef.current);
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
      if (stopListeningRef.current) {
        stopListeningRef.current();
        stopListeningRef.current = null;
      }
      setIsRecording(false);
      if (partialTextRef.current) {
        processResult(partialTextRef.current, sentence);
      }
      return;
    }

    // Start recording
    setRecordingError(null);
    setPronunciationScore(null);
    setPronunciationFeedback(null);
    setPartialText('');
    partialTextRef.current = '';

    if (!isAvailable) {
      setRecordingError('Speech requires development build');
      return;
    }

    const hasPermission = await requestSpeechPermissions();
    if (!hasPermission) {
      setRecordingError('Microphone permission required');
      return;
    }

    setIsRecording(true);

    stopListeningRef.current = startListening(speechCode, {
      onResult: (transcript) => {
        if (__DEV__) console.log('Final sentence result:', transcript);
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
        setIsRecording(false);
        processResult(transcript, sentence);
      },
      onPartialResult: (partial) => {
        setPartialText(partial);
        partialTextRef.current = partial;

        // Auto-stop after 2s of silence for sentences (longer than words)
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
        }
        autoStopTimeoutRef.current = setTimeout(() => {
          if (__DEV__) console.log('Auto-stop after silence, text:', partialTextRef.current);
          if (stopListeningRef.current) {
            stopListeningRef.current();
            stopListeningRef.current = null;
          }
          setIsRecording(false);
          if (partialTextRef.current) {
            processResult(partialTextRef.current, sentence);
          }
        }, 2000);
      },
      onError: (error) => {
        setIsRecording(false);
        setRecordingError(error);
      },
      onEnd: () => {
        if (__DEV__) console.log('Speech ended, partial:', partialTextRef.current);
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
        }
        setIsRecording(false);
        if (partialTextRef.current && pronunciationScore === null) {
          processResult(partialTextRef.current, sentence);
        }
      },
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return colors.mint;
    if (score >= 70) return colors.primary;
    if (score >= 50) return colors.warning;
    return colors.error;
  };

  const handleWordTap = (wordData: { japanese: string; reading: string; romaji: string; english: string; nativeTranslation?: string; grammaticalRole?: GrammaticalRole; isPhrase?: boolean; components?: { japanese: string; reading: string; romaji: string; english: string }[] }) => {
    setSelectedWord(selectedWord?.japanese === wordData.japanese ? null : wordData);
    // Use centralized TTS logic from languages.ts
    const textToSpeak = getTextForTTS(targetLanguage, wordData.japanese, wordData.reading);
    speak(textToSpeak);
  };

  const handlePlaySentence = (sentence: Sentence, slow = false) => {
    setIsPlaying(true);
    // Use centralized TTS logic from languages.ts
    const text = getTextForTTS(targetLanguage, sentence.japanese, sentence.reading);
    const safetyTimeout = setTimeout(() => setIsPlaying(false), text.length * (slow ? 400 : 200) + 2000);

    speak(text, {
      slow,
      onDone: () => {
        clearTimeout(safetyTimeout);
        setIsPlaying(false);
      },
      onError: () => {
        clearTimeout(safetyTimeout);
        setIsPlaying(false);
      },
    });
  };

  if (sentences.length === 0) {
    return (
      <View style={styles.sentenceTab}>
        <View style={styles.noSentenceBox}>
          <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textMuted} />
          <Text style={styles.noSentence}>{t.study.noSentenceYet}</Text>
          <Text style={styles.noSentenceHint}>{t.study.generateSentenceHint}</Text>
        </View>
      </View>
    );
  }

  // Get the first sentence (should be one per word now)
  const sentence = sentences[0];
  const sentenceWords = parseSentenceWords(sentence, word, allWords);

  return (
    <View style={styles.sentenceTab}>
      {/* Full sentence display */}
      <View style={styles.fullSentenceBox}>
        <Text style={styles.fullSentenceJapanese}>{sentence.japanese}</Text>
        {/* Only show reading if different from main sentence (e.g., furigana for Japanese) */}
        {sentence.reading && sentence.reading !== sentence.japanese && (
          <Text style={styles.fullSentenceReading}>{sentence.reading}</Text>
        )}
        {/* For English target, show native translation below the sentence */}
        {targetLanguage.code === 'en' && (
          <Text style={styles.fullSentenceReading}>{getSentenceTranslation(sentence, nativeLanguage)}</Text>
        )}
      </View>

      {/* Audio controls */}
      <View style={styles.sentenceAudioRow}>
        <TouchableOpacity
          style={[styles.sentencePlayBtn, isPlaying && styles.sentencePlayBtnActive]}
          onPress={() => handlePlaySentence(sentence, false)}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={isPlaying ? colors.white : colors.primary} />
          <Text style={[styles.sentencePlayText, isPlaying && styles.sentencePlayTextActive]}>{t.study.play}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sentencePlayBtn}
          onPress={() => handlePlaySentence(sentence, true)}
        >
          <Ionicons name="play-back" size={18} color={colors.primary} />
          <Text style={styles.sentencePlayText}>{t.study.slow}</Text>
        </TouchableOpacity>
      </View>

      {/* Speaking Practice Section */}
      <View style={styles.speakingPracticeSection}>
        <Text style={styles.speakingPracticeLabel}>Practice speaking the sentence</Text>

        {!isAvailable ? (
          <View style={styles.unavailableBox}>
            <Ionicons name="information-circle" size={20} color={colors.textMuted} />
            <Text style={styles.unavailableText}>Speech requires dev build</Text>
          </View>
        ) : (
          <>
            {/* Recording button */}
            <TouchableOpacity
              style={[
                styles.sentenceMicButton,
                isRecording && styles.sentenceMicButtonRecording,
              ]}
              onPress={() => handleStartSpeakingPractice(sentence)}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={32}
                  color={colors.white}
                />
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.micHintText}>
              {isRecording ? 'Tap to stop' : 'Tap to speak'}
            </Text>

            {/* Show what's being heard */}
            {isRecording && partialText && (
              <Text style={styles.hearingTextSentence}>"{partialText}"</Text>
            )}

            {/* Recording error */}
            {recordingError && (
              <View style={styles.recordingErrorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.recordingErrorText}>{recordingError}</Text>
              </View>
            )}

            {/* Pronunciation feedback */}
            {pronunciationScore !== null && (
              <View style={styles.pronunciationFeedbackBox}>
                <View style={[styles.scoreCircle, { borderColor: getScoreColor(pronunciationScore) }]}>
                  <Text style={[styles.scoreText, { color: getScoreColor(pronunciationScore) }]}>
                    {pronunciationScore}
                  </Text>
                </View>
                <Text style={[styles.feedbackText, { color: getScoreColor(pronunciationScore) }]}>
                  {pronunciationFeedback}
                </Text>
                <TouchableOpacity
                  style={styles.sentenceTryAgainButton}
                  onPress={() => {
                    setPronunciationScore(null);
                    setPronunciationFeedback(null);
                    setPartialText('');
                    partialTextRef.current = '';
                  }}
                >
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <Text style={styles.sentenceTryAgainText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Phrase breakdown - tap to learn */}
      <Text style={styles.wordBreakdownLabel}>Tap each phrase:</Text>
      <View style={styles.sentenceWords}>
        {sentenceWords.map((sw, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.sentenceWordUnit,
              sw.isPhrase && styles.sentencePhraseUnit,
              sw.isTargetWord && styles.sentenceWordTarget,
              selectedWord?.japanese === sw.japanese && styles.sentenceWordSelected,
            ]}
            onPress={() => handleWordTap(sw)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.swJapanese,
              sw.isTargetWord && styles.swJapaneseTarget,
              selectedWord?.japanese === sw.japanese && styles.swJapaneseSelected,
            ]}>
              {sw.japanese}
            </Text>
            {sw.isPhrase && (
              <View style={styles.phraseIndicator}>
                <Ionicons name="layers-outline" size={10} color={colors.textMuted} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Selected phrase/word detail */}
      {selectedWord && (
        <View style={styles.selectedWordBox}>
          {/* Grammatical role badge */}
          {selectedWord.grammaticalRole && selectedWord.grammaticalRole !== 'other' && (
            <View style={[styles.grammaticalRoleBadge, { backgroundColor:
              selectedWord.grammaticalRole === 'topic' ? colors.primary :
              selectedWord.grammaticalRole === 'subject' ? colors.success :
              selectedWord.grammaticalRole === 'object' ? colors.warning :
              selectedWord.grammaticalRole === 'verb' ? colors.error :
              colors.textMuted
            }]}>
              <Text style={styles.grammaticalRoleText}>
                {selectedWord.grammaticalRole.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.selectedWordHeader}>
            <Text style={styles.selectedWordJapanese}>{selectedWord.japanese}</Text>
            <TouchableOpacity onPress={() => speak(getTextForTTS(targetLanguage, selectedWord.japanese, selectedWord.reading))}>
              <Ionicons name="volume-high" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {/* Only show reading/romaji if different from the main word (skip for English target) */}
          {targetLanguage.code !== 'en' && selectedWord.reading && selectedWord.reading !== selectedWord.japanese && (
            <Text style={styles.selectedWordReading}>{selectedWord.reading}</Text>
          )}
          {targetLanguage.code !== 'en' && selectedWord.romaji && selectedWord.romaji !== selectedWord.japanese && selectedWord.romaji !== selectedWord.reading && (
            <Text style={styles.selectedWordRomaji}>{selectedWord.romaji}</Text>
          )}
          {/* Show native translation (Japanese when learning English) */}
          {/* For English target: show english field which contains native translation */}
          {/* For other targets: show nativeTranslation or english as fallback */}
          {(selectedWord.nativeTranslation || selectedWord.english) && (
            <Text style={styles.selectedWordEnglish}>
              {selectedWord.nativeTranslation || selectedWord.english}
            </Text>
          )}

          {/* Phrase breakdown - show components for deeper learning */}
          {selectedWord.components && selectedWord.components.length > 1 && (
            <View style={styles.phraseBreakdown}>
              <Text style={styles.phraseBreakdownLabel}>Breakdown:</Text>
              <View style={styles.phraseComponents}>
                {selectedWord.components.map((comp, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.phraseComponent}
                    onPress={() => speak(getTextForTTS(targetLanguage, comp.japanese, comp.reading))}
                  >
                    <Text style={styles.phraseComponentJapanese}>{comp.japanese}</Text>
                    <Text style={styles.phraseComponentReading}>{comp.reading}</Text>
                    {comp.english && (
                      <Text style={styles.phraseComponentEnglish}>{comp.english}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Translation - use native language translation */}
      <View style={styles.sentenceTranslation}>
        <Text style={styles.translationLabel}>{t.study.translation}</Text>
        <Text style={styles.translationText}>{getSentenceTranslation(sentence, nativeLanguage)}</Text>
      </View>
    </View>
  );
}

// ============ QUIZ TAB ============
type QuizQuestionType = 'meaning' | 'reverse' | 'reading' | 'audio' | 'fillBlank' | 'buildWord' | 'buildReading';

type QuizQuestion = {
  type: QuizQuestionType;
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string; // For build questions
  scrambledChars?: string[]; // Shuffled characters for build questions
  showJapanese?: boolean;
  showAudio?: boolean;
  showMeaning?: boolean;
};

function QuizTab({
  word,
  allWords,
  sentence,
  onQuizComplete,
}: {
  word: Word;
  allWords: Word[];
  sentence?: Sentence;
  onQuizComplete?: (wordId: string, correct: boolean, fast: boolean) => void;
}) {
  const startTimeRef = useRef(Date.now());
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showRomaji, setShowRomaji] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [mistakeQueue, setMistakeQueue] = useState<number[]>([]); // Track questions to repeat
  const { targetLanguage, nativeLanguage } = useAppStore();
  const speechCode = targetLanguage.speechCode;
  const t = useTranslations();

  // Get correct text to speak based on target language
  // Uses centralized TTS field logic from languages.ts
  const getTextToSpeak = () => {
    return getTextForTTS(targetLanguage, word.japanese, word.reading);
  };

  const speak = (text: string) => {
    speakText(text, { languageCode: speechCode });
  };
  const [quizComplete, setQuizComplete] = useState(false);
  const feedbackScale = useRef(new Animated.Value(0)).current;
  const checkmarkBounce = useRef(new Animated.Value(0)).current;
  const progressPulse = useRef(new Animated.Value(1)).current;
  const streakShake = useRef(new Animated.Value(0)).current;
  const xpFloat = useRef(new Animated.Value(0)).current;

  // Get native translation for this word
  const wordMeaning = getNativeTranslation(word, nativeLanguage);

  // Generate quiz questions with variety
  const questions: QuizQuestion[] = useMemo(() => {
    const qs: QuizQuestion[] = [];

    // Filter words to only those matching current target language
    // Check if word.japanese contains appropriate script for the target language
    const isTargetLanguageWord = (w: Word): boolean => {
      if (!w.japanese) return false;
      const hasJapanese = /[぀-ゟ゠-ヿ一-龯]/.test(w.japanese);
      const hasKorean = /[가-힯ᄀ-ᇿ]/.test(w.japanese);
      const hasChinese = /[一-鿿]/.test(w.japanese) && !hasJapanese;
      const hasLatin = /^[a-zA-ZÀ-ÿ\s\-']+$/.test(w.japanese);

      if (targetLanguage.code === 'ja') return hasJapanese;
      if (targetLanguage.code === 'ko') return hasKorean;
      if (targetLanguage.code === 'zh') return hasChinese || hasJapanese; // Chinese uses similar characters
      if (targetLanguage.code === 'en' || targetLanguage.code === 'es' || targetLanguage.code === 'pt') return hasLatin;
      return true; // Default: include word
    };

    const otherWords = allWords.filter(w => w.id !== word.id && w.japanese && w.english && isTargetLanguageWord(w));
    const isJapanese = targetLanguage.code === 'ja';
    const targetWord = word.japanese || word.romaji || word.reading || '';

    // Shuffle helper
    const shuffle = <T,>(arr: T[]): T[] => {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };

    // Fallback distractors for when we don't have enough words
    // Use native language fallbacks for meaning questions
    const nativeFallbacks: Record<string, string[]> = {
      'ja': ['なにか', 'それ', 'あれ', 'これ'],
      'zh': ['什么', '那个', '这个', '东西'],
      'ko': ['무엇', '그것', '이것', '저것'],
      'es': ['algo', 'nada', 'todo', 'cosa'],
      'pt': ['algo', 'nada', 'tudo', 'coisa'],
      'en': ['something', 'nothing', 'everything', 'anything'],
    };
    const targetFallbacks: Record<string, string[]> = {
      'ja': ['なにか', 'それ', 'あれ', 'これ'],
      'zh': ['什么', '那个', '这个', '东西'],
      'ko': ['무엇', '그것', '이것', '저것'],
      'es': ['algo', 'nada', 'todo', 'cosa'],
      'pt': ['algo', 'nada', 'tudo', 'coisa'],
      'en': ['something', 'nothing', 'everything', 'anything'],
    };
    const fallbackDistractors: Record<string, string[]> = {
      meaning: nativeFallbacks[nativeLanguage.code] || nativeFallbacks['en'],
      japanese: targetFallbacks[targetLanguage.code] || targetFallbacks['en'],
      reading: targetFallbacks[targetLanguage.code] || targetFallbacks['en'],
      english: nativeFallbacks[nativeLanguage.code] || nativeFallbacks['en'],
    };

    // Get distractors from real words, with fallbacks if needed
    const getDistractors = (correct: string, field: 'japanese' | 'reading' | 'english' | 'meaning'): string[] => {
      let candidates: string[];
      if (field === 'meaning') {
        candidates = otherWords
          .map(w => getNativeTranslation(w, nativeLanguage))
          .filter(v => v && v !== correct && v.trim() !== '');
      } else {
        candidates = otherWords
          .map(w => field === 'english' ? w.english : w[field])
          .filter((v): v is string => !!v && v !== correct && v.trim() !== '');
      }

      // Add fallbacks if not enough real distractors
      if (candidates.length < 3) {
        const fallbacks = fallbackDistractors[field] || fallbackDistractors.meaning;
        const needed = 3 - candidates.length;
        candidates = [...candidates, ...fallbacks.filter(f => f !== correct).slice(0, needed)];
      }

      return shuffle(candidates).slice(0, 3);
    };

    const shuffleWithCorrect = (correct: string, distractors: string[]) => {
      // Allow with at least 1 distractor (minimum 2 options)
      if (distractors.length < 1) return null;
      const all = [correct, ...distractors.slice(0, 3)];
      const shuffled = shuffle(all);
      return { options: shuffled, correctIndex: shuffled.indexOf(correct) };
    };

    // 1. Word → Meaning (multiple choice)
    const meaningDistractors = getDistractors(wordMeaning, 'meaning');
    const meaningData = shuffleWithCorrect(wordMeaning, meaningDistractors);
    if (meaningData) {
      qs.push({
        type: 'meaning',
        question: t.study.whatDoesThisMean.replace('{word}', targetWord),
        options: meaningData.options,
        correctIndex: meaningData.correctIndex,
        showJapanese: true,
      });
    }

    // 2. Meaning → Word (multiple choice)
    const reverseDistractors = getDistractors(targetWord, 'japanese');
    const reverseData = shuffleWithCorrect(targetWord, reverseDistractors);
    if (reverseData) {
      qs.push({
        type: 'reverse',
        question: t.study.howDoYouSay.replace('{word}', wordMeaning).replace('{language}', targetLanguage.name),
        options: reverseData.options,
        correctIndex: reverseData.correctIndex,
        showMeaning: true,
      });
    }

    // 3. Audio → Meaning (multiple choice)
    if (meaningData) {
      const audioData = shuffleWithCorrect(wordMeaning, shuffle(meaningDistractors));
      if (audioData) {
        qs.push({
          type: 'audio',
          question: t.study.whatWordDidYouHear,
          options: audioData.options,
          correctIndex: audioData.correctIndex,
          showAudio: true,
        });
      }
    }

    // 4. Word → Reading (for kanji words)
    if (isJapanese && word.containsKanji && word.reading && word.reading !== word.japanese) {
      const readingDistractors = getDistractors(word.reading, 'reading');
      const readingData = shuffleWithCorrect(word.reading, readingDistractors);
      if (readingData) {
        qs.push({
          type: 'reading',
          question: t.study.howDoYouRead.replace('{word}', targetWord),
          options: readingData.options,
          correctIndex: readingData.correctIndex,
          showJapanese: true,
        });
      }
    }

    // 5. Build the word (tap characters in order) - only if word is short enough
    if (targetWord.length >= 2 && targetWord.length <= 8) {
      const chars = targetWord.split('');
      const scrambled = shuffle([...chars]);
      // Make sure it's actually scrambled (not in correct order)
      if (scrambled.join('') === targetWord && chars.length > 1) {
        // Swap first two if accidentally in order
        [scrambled[0], scrambled[1]] = [scrambled[1], scrambled[0]];
      }
      qs.push({
        type: 'buildWord',
        question: `Build "${wordMeaning}"`,
        correctAnswer: targetWord,
        scrambledChars: scrambled,
        showMeaning: true,
      });
    }

    // 6. Build the reading (tap hiragana in order) - for kanji words
    if (isJapanese && word.containsKanji && word.reading && word.reading.length >= 2 && word.reading.length <= 10) {
      const chars = word.reading.split('');
      const scrambled = shuffle([...chars]);
      if (scrambled.join('') === word.reading && chars.length > 1) {
        [scrambled[0], scrambled[1]] = [scrambled[1], scrambled[0]];
      }
      qs.push({
        type: 'buildReading',
        question: 'Build the reading',
        correctAnswer: word.reading,
        scrambledChars: scrambled,
        showJapanese: true,
      });
    }

    // 7. Fill in blank (if sentence available)
    if (sentence?.japanese && sentence.japanese.includes(targetWord)) {
      const blankSentence = sentence.japanese.replace(targetWord, '______');
      const fillDistractors = getDistractors(targetWord, 'japanese');
      const fillData = shuffleWithCorrect(targetWord, fillDistractors);
      if (fillData) {
        qs.push({
          type: 'fillBlank',
          question: blankSentence,
          options: fillData.options,
          correctIndex: fillData.correctIndex,
        });
      }
    }

    // Shuffle questions but keep at least 3-5
    return shuffle(qs).slice(0, Math.min(5, qs.length));
  }, [word, allWords, sentence, targetLanguage, nativeLanguage, wordMeaning, t]);

  const currentQ = questions[currentQuestion];
  const isBuildQuestion = currentQ?.type === 'buildWord' || currentQ?.type === 'buildReading';

  // State for build questions - track which chars are selected and in what order
  const [selectedCharIndices, setSelectedCharIndices] = useState<number[]>([]);

  // Play audio for audio questions
  useEffect(() => {
    if (currentQ?.type === 'audio' && !showResult) {
      setTimeout(() => speak(getTextToSpeak()), 300);
    }
  }, [currentQuestion, currentQ?.type, showResult]);

  // Animate correct answer
  const animateCorrect = () => {
    // Checkmark bounce
    checkmarkBounce.setValue(0);
    Animated.spring(checkmarkBounce, {
      toValue: 1,
      tension: 200,
      friction: 6,
      useNativeDriver: true,
    }).start();

    // Progress bar pulse
    Animated.sequence([
      Animated.timing(progressPulse, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(progressPulse, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    // Streak shake
    Animated.sequence([
      Animated.timing(streakShake, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(streakShake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(streakShake, { toValue: -3, duration: 50, useNativeDriver: true }),
      Animated.timing(streakShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    // XP float up
    xpFloat.setValue(0);
    Animated.timing(xpFloat, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  };

  const handleSelect = (index: number) => {
    if (selectedAnswer !== null) return;

    const isCorrect = index === currentQ.correctIndex;
    setSelectedAnswer(index);
    setShowResult(true);

    if (isCorrect) {
      setScore(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      // XP: base 10 + streak bonus
      const xp = 10 + Math.min(newStreak * 2, 10);
      setXpEarned(prev => prev + xp);
      animateCorrect();
    } else {
      setStreak(0);
      // Add to mistake queue for repeat
      if (!mistakeQueue.includes(currentQuestion)) {
        setMistakeQueue(prev => [...prev, currentQuestion]);
      }
    }

    // Play pronunciation only for incorrect answers (to reinforce learning)
    if (!isCorrect) {
      setTimeout(() => speak(getTextToSpeak()), 300);
    }

    Animated.spring(feedbackScale, {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  // Build question handlers
  const handleCharSelect = (index: number) => {
    if (selectedCharIndices.includes(index)) return; // Already selected
    setSelectedCharIndices(prev => [...prev, index]);
  };

  const handleCharRemove = (positionIndex: number) => {
    // Remove character at this position and all after it
    setSelectedCharIndices(prev => prev.slice(0, positionIndex));
  };

  const handleBuildSubmit = () => {
    if (!currentQ.scrambledChars || selectedCharIndices.length === 0) return;

    const builtAnswer = selectedCharIndices.map(i => currentQ.scrambledChars![i]).join('');
    const correct = currentQ.correctAnswer || '';
    const isCorrect = builtAnswer === correct;

    setShowResult(true);

    if (isCorrect) {
      setScore(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      const xp = 15 + Math.min(newStreak * 3, 15); // More XP for build questions
      setXpEarned(prev => prev + xp);
      animateCorrect();
    } else {
      setStreak(0);
      if (!mistakeQueue.includes(currentQuestion)) {
        setMistakeQueue(prev => [...prev, currentQuestion]);
      }
    }

    // Play pronunciation only for incorrect answers (to reinforce learning)
    if (!isCorrect) {
      setTimeout(() => speak(getTextToSpeak()), 300);
    }

    Animated.spring(feedbackScale, {
      toValue: 1,
      tension: 150,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  // Get built answer string for display
  const getBuiltAnswer = () => {
    if (!currentQ?.scrambledChars) return '';
    return selectedCharIndices.map(i => currentQ.scrambledChars![i]).join('');
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setSelectedCharIndices([]);
      setShowResult(false);
      setShowRomaji(false);
      feedbackScale.setValue(0);
    } else {
      setQuizComplete(true);
      let finalCorrect = false;
      if (selectedAnswer !== null) {
        finalCorrect = selectedAnswer === currentQ.correctIndex;
      } else if (isBuildQuestion && currentQ.scrambledChars) {
        const builtAnswer = selectedCharIndices.map(i => currentQ.scrambledChars![i]).join('');
        finalCorrect = builtAnswer === currentQ.correctAnswer;
      }
      const finalScore = score + (finalCorrect ? 1 : 0);
      const passed = finalScore >= Math.ceil(questions.length / 2);
      const timeTaken = Date.now() - startTimeRef.current;
      const wasFast = timeTaken < questions.length * 4000;
      onQuizComplete?.(word.id, passed, wasFast);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setSelectedCharIndices([]);
    setShowResult(false);
    setShowRomaji(false);
    setScore(0);
    setStreak(0);
    setXpEarned(0);
    setMistakeQueue([]);
    setQuizComplete(false);
    feedbackScale.setValue(0);
  };

  const getOptionStyle = (index: number) => {
    if (selectedAnswer === null) return styles.quizOption;
    if (index === currentQ.correctIndex) return [styles.quizOption, styles.quizOptionCorrect];
    if (index === selectedAnswer) return [styles.quizOption, styles.quizOptionWrong];
    return [styles.quizOption, styles.quizOptionDimmed];
  };

  // Calculate if current answer is correct (for build or multiple choice)
  const isCorrectAnswer = (() => {
    if (selectedAnswer !== null) {
      return selectedAnswer === currentQ.correctIndex;
    }
    if (isBuildQuestion && currentQ.scrambledChars) {
      const builtAnswer = selectedCharIndices.map(i => currentQ.scrambledChars![i]).join('');
      return builtAnswer === currentQ.correctAnswer;
    }
    return false;
  })();

  // Quiz complete screen
  if (quizComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const isPerfect = score === questions.length;
    const isGood = percentage >= 70;

    return (
      <View style={styles.quizTab}>
        <View style={styles.quizCompleteBox}>
          <Ionicons
            name={isPerfect ? 'trophy' : isGood ? 'checkmark-circle' : 'refresh-circle'}
            size={64}
            color={isPerfect ? colors.xp : isGood ? colors.mint : colors.warning}
          />
          <Text style={styles.quizCompleteTitle}>
            {isPerfect ? t.study.perfect : isGood ? t.study.greatJob : t.study.keepPracticing}
          </Text>
          <Text style={styles.quizCompleteScore}>
            {score} / {questions.length} correct ({percentage}%)
          </Text>

          {/* Stats row */}
          <View style={styles.quizStatsRow}>
            <View style={styles.quizStatItem}>
              <Text style={styles.quizStatValue}>+{xpEarned}</Text>
              <Text style={styles.quizStatLabel}>XP</Text>
            </View>
            <View style={styles.quizStatDivider} />
            <View style={styles.quizStatItem}>
              <Text style={styles.quizStatValue}>{maxStreak}</Text>
              <Text style={styles.quizStatLabel}>Best Streak</Text>
            </View>
          </View>

          <View style={styles.quizCompleteActions}>
            <TouchableOpacity style={styles.quizRestartBtn} onPress={handleRestart}>
              <Ionicons name="refresh" size={18} color={colors.primary} />
              <Text style={styles.quizRestartText}>{t.study.tryAgain}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.quizTab}>
      {/* Top bar: progress + streak */}
      <View style={styles.quizTopBar}>
        <Animated.View style={[styles.quizProgressContainer, { transform: [{ scale: progressPulse }] }]}>
          <View style={styles.quizProgressBar}>
            <View
              style={[
                styles.quizProgressFill,
                { width: `${((currentQuestion + 1) / questions.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.quizProgressText}>
            {currentQuestion + 1}/{questions.length}
          </Text>
        </Animated.View>

        {streak > 0 && (
          <Animated.View style={[styles.quizStreakBadge, { transform: [{ translateX: streakShake }] }]}>
            <Text style={styles.quizStreakText}>{streak}</Text>
          </Animated.View>
        )}
      </View>

      {/* Question */}
      <View style={styles.quizQuestionBox}>
        {currentQ.showAudio && (
          <TouchableOpacity
            style={styles.quizAudioBtn}
            onPress={() => speak(getTextToSpeak())}
          >
            <Ionicons name="volume-high" size={32} color={colors.primary} />
          </TouchableOpacity>
        )}
        {currentQ.showJapanese && (
          <View style={styles.quizWordContainer}>
            <Text style={styles.quizJapanese}>{word.japanese}</Text>
            {/* Romaji - hidden by default, tap to reveal */}
            {word.romaji && (
              <TouchableOpacity onPress={() => setShowRomaji(!showRomaji)}>
                <Text style={[styles.quizRomaji, !showRomaji && styles.quizRomajiHidden]}>
                  {showRomaji ? word.romaji : 'Tap for romaji'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {currentQ.showMeaning && (
          <Text style={styles.quizMeaning}>{wordMeaning}</Text>
        )}
        <Text style={styles.quizQuestion}>{currentQ.question}</Text>
      </View>

      {/* Options or build word */}
      {isBuildQuestion && currentQ.scrambledChars ? (
        <View style={styles.quizBuildContainer}>
          {/* Answer area - shows selected characters */}
          <View style={[
            styles.quizBuildAnswer,
            showResult && (isCorrectAnswer ? styles.quizBuildAnswerCorrect : styles.quizBuildAnswerWrong),
          ]}>
            {selectedCharIndices.length > 0 ? (
              <View style={styles.quizBuildAnswerChars}>
                {selectedCharIndices.map((charIndex, posIndex) => (
                  <TouchableOpacity
                    key={posIndex}
                    style={styles.quizBuildSelectedChar}
                    onPress={() => !showResult && handleCharRemove(posIndex)}
                    disabled={showResult}
                  >
                    <Text style={[
                      styles.quizBuildCharText,
                      showResult && (isCorrectAnswer ? styles.quizBuildCharCorrect : styles.quizBuildCharWrong),
                    ]}>
                      {currentQ.scrambledChars?.[charIndex]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.quizBuildPlaceholder}>Tap characters below</Text>
            )}
            {showResult && (
              <Ionicons
                name={isCorrectAnswer ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={isCorrectAnswer ? colors.mint : colors.error}
                style={styles.quizBuildResultIcon}
              />
            )}
          </View>

          {/* Character bank - scrambled characters to tap */}
          {!showResult && (
            <View style={styles.quizBuildBank}>
              {currentQ.scrambledChars.map((char, index) => {
                const isSelected = selectedCharIndices.includes(index);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.quizBuildBankChar,
                      isSelected && styles.quizBuildBankCharUsed,
                    ]}
                    onPress={() => handleCharSelect(index)}
                    disabled={isSelected}
                  >
                    <Text style={[
                      styles.quizBuildCharText,
                      isSelected && styles.quizBuildCharUsed,
                    ]}>
                      {char}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Submit button */}
          {!showResult && selectedCharIndices.length > 0 && (
            <TouchableOpacity style={styles.quizSubmitBtn} onPress={handleBuildSubmit}>
              <Text style={styles.quizSubmitText}>Check Answer</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.quizOptions}>
          {currentQ.options?.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={getOptionStyle(index)}
              onPress={() => handleSelect(index)}
              disabled={selectedAnswer !== null}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.quizOptionText,
                  (currentQ.type === 'reverse' || currentQ.type === 'fillBlank' || currentQ.type === 'reading')
                    && styles.quizOptionTextJapanese,
                  selectedAnswer !== null && index === currentQ.correctIndex && styles.quizOptionTextCorrect,
                  selectedAnswer !== null && index === selectedAnswer && index !== currentQ.correctIndex && styles.quizOptionTextWrong,
                ]}
              >
                {option}
              </Text>
              {selectedAnswer !== null && index === currentQ.correctIndex && (
                <Animated.View style={{ transform: [{ scale: checkmarkBounce }] }}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.mint} />
                </Animated.View>
              )}
              {selectedAnswer !== null && index === selectedAnswer && index !== currentQ.correctIndex && (
                <Ionicons name="close-circle" size={22} color={colors.error} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Feedback after answer */}
      {showResult && (
        <Animated.View
          style={[styles.quizFeedbackBox, { transform: [{ scale: feedbackScale }] }]}
        >
          {/* XP earned animation */}
          {isCorrectAnswer && (
            <Animated.Text
              style={[
                styles.quizXpFloat,
                {
                  opacity: xpFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, 0] }),
                  transform: [{ translateY: xpFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }],
                },
              ]}
            >
              +{10 + Math.min(streak * 2, 10)} XP
            </Animated.Text>
          )}

          {/* Correct answer display - only shown for incorrect answers */}
          {!isCorrectAnswer && (
            <View style={styles.quizCorrectAnswerBox}>
              <TouchableOpacity
                style={styles.quizCorrectAnswerPlay}
                onPress={() => speak(getTextToSpeak())}
              >
                <Ionicons name="volume-medium" size={20} color={colors.primary} />
              </TouchableOpacity>
              <View>
                <Text style={styles.quizCorrectAnswerWord}>{word.japanese}</Text>
                <Text style={styles.quizCorrectAnswerMeaning}>{wordMeaning}</Text>
                {word.reading && word.reading !== word.japanese && (
                  <Text style={styles.quizCorrectAnswerReading}>{word.reading}</Text>
                )}
              </View>
            </View>
          )}

          {/* Explanation for wrong answer */}
          {!isCorrectAnswer && (
            <Text style={styles.quizWrongExplanation}>
              The correct answer is shown above. This word will appear again for review.
            </Text>
          )}
        </Animated.View>
      )}

      {/* Next button */}
      {showResult && (
        <Animated.View style={{ transform: [{ scale: feedbackScale }] }}>
          <TouchableOpacity style={styles.quizNextBtn} onPress={handleNext}>
            <Text style={styles.quizNextText}>
              {currentQuestion < questions.length - 1 ? 'Continue' : 'See Results'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// Common particles and grammar with translations
const COMMON_GRAMMAR: Record<string, { romaji: string; english: string }> = {
  'は': { romaji: 'wa', english: 'topic marker' },
  'が': { romaji: 'ga', english: 'subject marker' },
  'を': { romaji: 'wo', english: 'object marker' },
  'に': { romaji: 'ni', english: 'to/at/in' },
  'で': { romaji: 'de', english: 'at/by/with' },
  'の': { romaji: 'no', english: 'possessive' },
  'と': { romaji: 'to', english: 'and/with' },
  'も': { romaji: 'mo', english: 'also/too' },
  'へ': { romaji: 'e', english: 'toward' },
  'から': { romaji: 'kara', english: 'from' },
  'まで': { romaji: 'made', english: 'until' },
  'より': { romaji: 'yori', english: 'than' },
  'です': { romaji: 'desu', english: 'is/am/are' },
  'ですね': { romaji: 'desu ne', english: 'isn\'t it' },
  'ですよ': { romaji: 'desu yo', english: 'I tell you' },
  'ですか': { romaji: 'desu ka', english: 'is it?' },
  'ます': { romaji: 'masu', english: 'polite verb ending' },
  'います': { romaji: 'imasu', english: 'exists (living)' },
  'あります': { romaji: 'arimasu', english: 'exists (non-living)' },
  'があります': { romaji: 'ga arimasu', english: 'there is' },
  'がいます': { romaji: 'ga imasu', english: 'there is (living)' },
  'があります。': { romaji: 'ga arimasu', english: 'there is' },
  'がいます。': { romaji: 'ga imasu', english: 'there is (living)' },
  'ました': { romaji: 'mashita', english: 'past tense' },
  'ません': { romaji: 'masen', english: 'negative' },
  'した': { romaji: 'shita', english: 'did' },
  'ない': { romaji: 'nai', english: 'not' },
  'ている': { romaji: 'teiru', english: 'is doing' },
  'ています': { romaji: 'teimasu', english: 'is doing' },
  'てください': { romaji: 'tekudasai', english: 'please do' },
  'あの': { romaji: 'ano', english: 'that (over there)' },
  'この': { romaji: 'kono', english: 'this' },
  'その': { romaji: 'sono', english: 'that' },
  'どの': { romaji: 'dono', english: 'which' },
  '。': { romaji: '', english: 'period' },
  '、': { romaji: '', english: 'comma' },
};

// Common i-adjectives that should never be split
// Format: { kanji: full word with reading info }
const I_ADJECTIVES: Record<string, { reading: string; romaji: string; english: string }> = {
  '大きい': { reading: 'おおきい', romaji: 'ookii', english: 'big' },
  '小さい': { reading: 'ちいさい', romaji: 'chiisai', english: 'small' },
  '新しい': { reading: 'あたらしい', romaji: 'atarashii', english: 'new' },
  '古い': { reading: 'ふるい', romaji: 'furui', english: 'old' },
  '高い': { reading: 'たかい', romaji: 'takai', english: 'tall/expensive' },
  '安い': { reading: 'やすい', romaji: 'yasui', english: 'cheap' },
  '長い': { reading: 'ながい', romaji: 'nagai', english: 'long' },
  '短い': { reading: 'みじかい', romaji: 'mijikai', english: 'short' },
  '広い': { reading: 'ひろい', romaji: 'hiroi', english: 'wide' },
  '狭い': { reading: 'せまい', romaji: 'semai', english: 'narrow' },
  '重い': { reading: 'おもい', romaji: 'omoi', english: 'heavy' },
  '軽い': { reading: 'かるい', romaji: 'karui', english: 'light' },
  '暑い': { reading: 'あつい', romaji: 'atsui', english: 'hot (weather)' },
  '寒い': { reading: 'さむい', romaji: 'samui', english: 'cold (weather)' },
  '熱い': { reading: 'あつい', romaji: 'atsui', english: 'hot (to touch)' },
  '冷たい': { reading: 'つめたい', romaji: 'tsumetai', english: 'cold (to touch)' },
  '美しい': { reading: 'うつくしい', romaji: 'utsukushii', english: 'beautiful' },
  '楽しい': { reading: 'たのしい', romaji: 'tanoshii', english: 'fun' },
  '嬉しい': { reading: 'うれしい', romaji: 'ureshii', english: 'happy' },
  '悲しい': { reading: 'かなしい', romaji: 'kanashii', english: 'sad' },
  '難しい': { reading: 'むずかしい', romaji: 'muzukashii', english: 'difficult' },
  '易しい': { reading: 'やさしい', romaji: 'yasashii', english: 'easy' },
  '優しい': { reading: 'やさしい', romaji: 'yasashii', english: 'kind' },
  '強い': { reading: 'つよい', romaji: 'tsuyoi', english: 'strong' },
  '弱い': { reading: 'よわい', romaji: 'yowai', english: 'weak' },
  '若い': { reading: 'わかい', romaji: 'wakai', english: 'young' },
  '白い': { reading: 'しろい', romaji: 'shiroi', english: 'white' },
  '黒い': { reading: 'くろい', romaji: 'kuroi', english: 'black' },
  '赤い': { reading: 'あかい', romaji: 'akai', english: 'red' },
  '青い': { reading: 'あおい', romaji: 'aoi', english: 'blue' },
  '早い': { reading: 'はやい', romaji: 'hayai', english: 'early/fast' },
  '速い': { reading: 'はやい', romaji: 'hayai', english: 'fast' },
  '遅い': { reading: 'おそい', romaji: 'osoi', english: 'slow/late' },
  '近い': { reading: 'ちかい', romaji: 'chikai', english: 'near' },
  '遠い': { reading: 'とおい', romaji: 'tooi', english: 'far' },
  '明るい': { reading: 'あかるい', romaji: 'akarui', english: 'bright' },
  '暗い': { reading: 'くらい', romaji: 'kurai', english: 'dark' },
  '甘い': { reading: 'あまい', romaji: 'amai', english: 'sweet' },
  '辛い': { reading: 'からい', romaji: 'karai', english: 'spicy' },
  '苦い': { reading: 'にがい', romaji: 'nigai', english: 'bitter' },
  '酸っぱい': { reading: 'すっぱい', romaji: 'suppai', english: 'sour' },
  '良い': { reading: 'よい', romaji: 'yoi', english: 'good' },
  'いい': { reading: 'いい', romaji: 'ii', english: 'good' },
  '悪い': { reading: 'わるい', romaji: 'warui', english: 'bad' },
  '可愛い': { reading: 'かわいい', romaji: 'kawaii', english: 'cute' },
  '格好いい': { reading: 'かっこいい', romaji: 'kakkoii', english: 'cool' },
  '面白い': { reading: 'おもしろい', romaji: 'omoshiroi', english: 'interesting' },
  '美味しい': { reading: 'おいしい', romaji: 'oishii', english: 'delicious' },
  'おいしい': { reading: 'おいしい', romaji: 'oishii', english: 'delicious' },
  '茶色い': { reading: 'ちゃいろい', romaji: 'chairoi', english: 'brown' },
  'つまらない': { reading: 'つまらない', romaji: 'tsumaranai', english: 'boring' },
  '忙しい': { reading: 'いそがしい', romaji: 'isogashii', english: 'busy' },
  '欲しい': { reading: 'ほしい', romaji: 'hoshii', english: 'want' },
  '多い': { reading: 'おおい', romaji: 'ooi', english: 'many' },
  '少ない': { reading: 'すくない', romaji: 'sukunai', english: 'few' },
  '厚い': { reading: 'あつい', romaji: 'atsui', english: 'thick' },
  '薄い': { reading: 'うすい', romaji: 'usui', english: 'thin' },
  '太い': { reading: 'ふとい', romaji: 'futoi', english: 'thick/fat' },
  '細い': { reading: 'ほそい', romaji: 'hosoi', english: 'thin/slender' },
  '丸い': { reading: 'まるい', romaji: 'marui', english: 'round' },
  '四角い': { reading: 'しかくい', romaji: 'shikakui', english: 'square' },
  '硬い': { reading: 'かたい', romaji: 'katai', english: 'hard' },
  '柔らかい': { reading: 'やわらかい', romaji: 'yawarakai', english: 'soft' },
  '眠い': { reading: 'ねむい', romaji: 'nemui', english: 'sleepy' },
  '痛い': { reading: 'いたい', romaji: 'itai', english: 'painful' },
  '怖い': { reading: 'こわい', romaji: 'kowai', english: 'scary' },
  '恥ずかしい': { reading: 'はずかしい', romaji: 'hazukashii', english: 'embarrassing' },
  '珍しい': { reading: 'めずらしい', romaji: 'mezurashii', english: 'rare' },
  '素晴らしい': { reading: 'すばらしい', romaji: 'subarashii', english: 'wonderful' },
};

// i-adjective ending patterns (hiragana endings that indicate an i-adjective)
const I_ADJ_ENDINGS = ['きい', 'しい', 'かい', 'たい', 'ない', 'るい', 'よい', 'らい', 'わい', 'がい', 'ぜい', 'ばい', 'まい', 'やい', 'あい', 'おい', 'うい', 'えい', 'いい'];

// Simple hiragana to romaji conversion
const HIRAGANA_ROMAJI: Record<string, string> = {
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
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
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
  'っ': '', // Small tsu (doubles next consonant - handled separately)
  'ー': '-', // Long vowel mark
};

function hiraganaToRomaji(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    // Check for two-character combinations first
    if (i < text.length - 1) {
      const twoChar = text.slice(i, i + 2);
      if (HIRAGANA_ROMAJI[twoChar]) {
        result += HIRAGANA_ROMAJI[twoChar];
        i += 2;
        continue;
      }
    }
    // Single character
    const char = text[i];
    if (char === 'っ' && i < text.length - 1) {
      // Small tsu - double the next consonant
      const nextRomaji = HIRAGANA_ROMAJI[text[i + 1]] || '';
      if (nextRomaji) {
        result += nextRomaji[0]; // Double the first consonant
      }
    } else if (HIRAGANA_ROMAJI[char]) {
      result += HIRAGANA_ROMAJI[char];
    } else {
      result += char; // Keep as-is if not found
    }
    i++;
  }
  return result;
}

// Helper to convert katakana to hiragana for romaji conversion
function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x60);
  });
}

// Helper to generate proper romaji (handles both hiragana and katakana)
function generateRomaji(reading: string): string {
  const hiragana = katakanaToHiragana(reading);
  return hiraganaToRomaji(hiragana);
}

// Grammatical role type
type GrammaticalRole = 'topic' | 'subject' | 'object' | 'location' | 'time' | 'modifier' | 'verb' | 'other';

// Get grammatical role from particle
function getGrammaticalRole(particle: string): GrammaticalRole {
  if (particle === 'は') return 'topic';
  if (particle === 'が') return 'subject';
  if (particle === 'を') return 'object';
  if (particle === 'に' || particle === 'で' || particle === 'へ') return 'location';
  if (particle === 'の') return 'modifier';
  return 'other';
}

// Helper to parse sentence into grammatical chunks (2-4 segments)
function parseSentenceWords(sentence: Sentence, targetWord: Word, allWords: Word[]) {
  const result: { japanese: string; reading: string; romaji: string; english: string; nativeTranslation?: string; isTargetWord: boolean; isPhrase?: boolean; grammaticalRole?: GrammaticalRole; components?: { japanese: string; reading: string; romaji: string; english: string }[] }[] = [];

  // For non-Japanese languages with word breakdown from AI, use that directly
  if (sentence.words && sentence.words.length > 0) {
    return sentence.words.map(w => ({
      japanese: w.word,
      reading: w.reading || '',
      romaji: generateRomaji(w.reading || w.word),
      english: w.meaning,
      nativeTranslation: w.meaning,
      isTargetWord: w.word === targetWord.japanese,
      isPhrase: false,
      grammaticalRole: (w.role as GrammaticalRole) || 'other',
      components: undefined,
    }));
  }

  // Protected patterns - these should NEVER be split (copulas, verb endings, etc.)
  // Must check these BEFORE attempting any particle splitting
  const protectedPatterns = [
    'です', 'ます', 'でした', 'ました', 'ません', 'でしょう', 'ましょう',
    'ている', 'ています', 'ていた', 'ていました', 'てください', 'てくれる', 'てもらう',
    'である', 'であった', 'ではない', 'じゃない', 'ではありません',
    'だった', 'だから', 'だけど', 'だと', 'だろう', 'だね', 'だよ',
    'なので', 'ので', 'のに', 'のは', 'のが', 'のを', 'のも',
    'ことが', 'ことを', 'ことは', 'ことに', 'ことで',
    'ために', 'ような', 'ように', 'らしい', 'みたい', 'そうだ', 'ようだ',
  ];

  // Particles that should attach to PRECEDING word (case markers, topic, etc.)
  // Note: 'で' is context-sensitive - it's a particle but also part of 'です'
  const caseParticles = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'から', 'まで', 'より', 'には', 'では', 'とは', 'への', 'からの', 'までの'];

  // Sentence-ending particles that attach to です/ます
  const sentenceEndParticles = ['ね', 'よ', 'か', 'な', 'わ'];

  // Copula + particle combinations
  const copulaPatterns = ['ですね', 'ですよ', 'ですか', 'ですな', 'ですわ', 'ますね', 'ますよ', 'ますか'];

  // Helper: Check if splitting at this position would break a protected pattern
  const wouldBreakProtectedPattern = (text: string, splitPos: number): boolean => {
    for (const pattern of protectedPatterns) {
      // Check if pattern spans across the split position
      const patternStart = text.indexOf(pattern);
      if (patternStart >= 0 && patternStart < splitPos && patternStart + pattern.length > splitPos) {
        return true; // Split would break this pattern
      }
    }
    return false;
  };

  // Helper: Check if text contains a protected pattern starting at position
  const startsWithProtectedPattern = (text: string): string | null => {
    for (const pattern of protectedPatterns) {
      if (text.startsWith(pattern)) {
        return pattern;
      }
    }
    return null;
  };

  // Connective の that attaches to PRECEDING word (makes adjectival phrase)
  const adjectivalNo = 'の';

  // Verb conjugation endings that should merge with verb stem
  const verbConjugations = ['います', 'ています', 'いています', 'ました', 'でした', 'ません', 'ている', 'ていた', 'ていました', 'ない', 'なかった', 'った', 'いた', 'んだ', 'たい', 'ようだ', 'らしい', 'みたい', 'そうだ', 'ましょう', 'てください', 'ことができる'];

  // Punctuation
  const punctuation = ['。', '、', '！', '？', '…', '・'];

  // Adverbs that should stay standalone (never merge with particles)
  const standaloneAdverbs = ['とても', 'すごく', 'ちょっと', 'もっと', 'たくさん', 'あまり', 'ぜんぜん', 'まだ', 'もう', 'よく', 'いつも', 'ときどき', 'たまに', 'ずっと', 'やっと', 'きっと', 'たぶん', 'ほんとうに', '本当に'];

  if (sentence.furigana && sentence.furigana.length > 0) {
    type TempSegment = {
      japanese: string;
      reading: string;
      components: { japanese: string; reading: string; romaji: string; english: string }[];
      hasPunctuation?: string; // Track attached punctuation
    };

    // First, separate punctuation from segments
    let segments: TempSegment[] = sentence.furigana.map(seg => {
      let text = seg.text;
      let reading = seg.reading;
      let attachedPunct = '';

      // Check if segment ends with punctuation
      for (const p of punctuation) {
        if (text.endsWith(p)) {
          attachedPunct = p;
          text = text.slice(0, -1);
          reading = reading.slice(0, -1);
          break;
        }
      }

      const wordMatch = allWords.find(w => w.japanese === text);
      const grammarMatch = COMMON_GRAMMAR[text];
      const iAdjMatch = I_ADJECTIVES[text];
      return {
        japanese: text,
        reading: reading,
        components: [{
          japanese: text,
          reading: reading,
          romaji: iAdjMatch?.romaji || wordMatch?.romaji || grammarMatch?.romaji || generateRomaji(reading),
          english: iAdjMatch?.english || wordMatch?.english || grammarMatch?.english || '',
        }],
        hasPunctuation: attachedPunct || undefined,
      };
    }).filter(seg => seg.japanese.length > 0); // Remove empty segments

    // Pass 0: Split segments that start with particles (e.g., はギターを → は + ギターを)
    // This handles cases where the API returns malformed segments
    let preprocessed: TempSegment[] = [];
    for (const seg of segments) {
      let remaining = seg.japanese;
      let remainingReading = seg.reading;
      let hasPunct = seg.hasPunctuation;
      const splitParts: TempSegment[] = [];

      // Recursively split at particle boundaries
      let maxIterations = 10; // Prevent infinite loops
      while (remaining.length > 0 && maxIterations > 0) {
        maxIterations--;
        let foundSplit = false;

        // First check: if remaining starts with a protected pattern, don't split it
        const protectedMatch = startsWithProtectedPattern(remaining);
        if (protectedMatch) {
          // Add the protected pattern as a unit
          const grammarMatch = COMMON_GRAMMAR[protectedMatch];
          splitParts.push({
            japanese: protectedMatch,
            reading: protectedMatch,
            components: [{
              japanese: protectedMatch,
              reading: protectedMatch,
              romaji: grammarMatch?.romaji || generateRomaji(protectedMatch),
              english: grammarMatch?.english || 'copula/auxiliary',
            }],
            hasPunctuation: remaining.length === protectedMatch.length ? hasPunct : undefined,
          });
          remaining = remaining.slice(protectedMatch.length);
          remainingReading = remainingReading.slice(protectedMatch.length);
          foundSplit = true;
          continue; // Skip particle check for this iteration
        }

        // Check if segment starts with a particle
        for (const particle of caseParticles) {
          if (remaining.startsWith(particle) && remaining.length > particle.length) {
            // Don't split if it would break a protected pattern
            if (wouldBreakProtectedPattern(remaining, particle.length)) {
              continue;
            }
            // Split off the particle - it should attach to PREVIOUS segment
            // For now, just add it as standalone, Pass 4 will merge it with preceding noun
            const particleGrammar = COMMON_GRAMMAR[particle];
            splitParts.push({
              japanese: particle,
              reading: particle,
              components: [{
                japanese: particle,
                reading: particle,
                romaji: particleGrammar?.romaji || generateRomaji(particle),
                english: particleGrammar?.english || '',
              }],
            });
            remaining = remaining.slice(particle.length);
            remainingReading = remainingReading.slice(particle.length);
            foundSplit = true;
            break;
          }
        }

        if (!foundSplit) {
          // Look for internal particle boundaries (e.g., ギターを → ギター + を)
          let foundInternalSplit = false;
          for (const particle of caseParticles) {
            const particleIdx = remaining.indexOf(particle);
            if (particleIdx > 0) {
              // IMPORTANT: Don't split if it would break a protected pattern like です, ます
              if (wouldBreakProtectedPattern(remaining, particleIdx)) {
                continue; // Skip this particle, try the next one
              }

              // Found particle inside - split before it
              const beforeParticle = remaining.slice(0, particleIdx);
              const beforeReading = remainingReading.slice(0, particleIdx);
              const wordMatch = allWords.find(w => w.japanese === beforeParticle);

              splitParts.push({
                japanese: beforeParticle,
                reading: beforeReading,
                components: [{
                  japanese: beforeParticle,
                  reading: beforeReading,
                  romaji: wordMatch?.romaji || generateRomaji(beforeReading),
                  english: wordMatch?.english || '',
                }],
              });

              remaining = remaining.slice(particleIdx);
              remainingReading = remainingReading.slice(particleIdx);
              foundInternalSplit = true;
              break;
            }
          }

          if (!foundInternalSplit) {
            // No more splits possible - add remaining content
            if (remaining.length > 0) {
              const wordMatch = allWords.find(w => w.japanese === remaining);
              const grammarMatch = COMMON_GRAMMAR[remaining];
              splitParts.push({
                japanese: remaining,
                reading: remainingReading,
                components: [{
                  japanese: remaining,
                  reading: remainingReading,
                  romaji: wordMatch?.romaji || grammarMatch?.romaji || generateRomaji(remainingReading),
                  english: wordMatch?.english || grammarMatch?.english || '',
                }],
                hasPunctuation: hasPunct,
              });
            }
            break;
          }
        }
      }

      preprocessed.push(...splitParts);
    }
    segments = preprocessed;

    // Pass 0b: Legacy split check for specific patterns
    preprocessed = [];
    for (const seg of segments) {
      let remaining = seg.japanese;
      let remainingReading = seg.reading;
      let didSplit = false;

      // Check if segment starts with a case particle that should be separated
      for (const particle of caseParticles) {
        if (remaining.startsWith(particle) && remaining.length > particle.length) {
          const afterParticle = remaining.slice(particle.length);
          const afterReading = remainingReading.slice(particle.length);

          // Check if what follows is a standalone adverb or word
          if (standaloneAdverbs.includes(afterParticle) || COMMON_GRAMMAR[afterParticle] || allWords.some(w => w.japanese === afterParticle)) {
            // Split into particle + rest
            const particleGrammar = COMMON_GRAMMAR[particle];
            preprocessed.push({
              japanese: particle,
              reading: particle,
              components: [{
                japanese: particle,
                reading: particle,
                romaji: particleGrammar?.romaji || generateRomaji(particle),
                english: particleGrammar?.english || '',
              }],
            });

            const restGrammar = COMMON_GRAMMAR[afterParticle];
            const restWord = allWords.find(w => w.japanese === afterParticle);
            preprocessed.push({
              japanese: afterParticle,
              reading: afterReading,
              components: [{
                japanese: afterParticle,
                reading: afterReading,
                romaji: restGrammar?.romaji || restWord?.romaji || generateRomaji(afterReading),
                english: restGrammar?.english || restWord?.english || '',
              }],
              hasPunctuation: seg.hasPunctuation,
            });
            didSplit = true;
            break;
          }
        }
      }

      // Check for i-adjective ending い merged with following content (e.g., いシカが → い + シカが)
      // This happens when previous segment is kanji and this starts with い followed by katakana/kanji
      if (!didSplit && remaining.startsWith('い') && remaining.length > 1) {
        const afterI = remaining.slice(1);
        const afterIReading = remainingReading.slice(1);
        // Check if what follows starts with katakana or kanji (not hiragana continuation)
        const startsWithKatakanaOrKanji = /^[\u30A0-\u30FF\u4E00-\u9FAF]/.test(afterI);
        if (startsWithKatakanaOrKanji) {
          // Split off the い for later merging with previous kanji
          preprocessed.push({
            japanese: 'い',
            reading: 'い',
            components: [{
              japanese: 'い',
              reading: 'い',
              romaji: 'i',
              english: '',
            }],
          });
          preprocessed.push({
            japanese: afterI,
            reading: afterIReading,
            components: [{
              japanese: afterI,
              reading: afterIReading,
              romaji: generateRomaji(afterIReading),
              english: '',
            }],
            hasPunctuation: seg.hasPunctuation,
          });
          didSplit = true;
        }
      }

      if (!didSplit) {
        preprocessed.push(seg);
      }
    }
    segments = preprocessed;

    // Pass 0b: Split segments that have noun+particle merged (e.g., シカが → シカ + が)
    preprocessed = [];
    for (const seg of segments) {
      let didSplit = false;
      const text = seg.japanese;
      const reading = seg.reading;

      // Check for katakana word followed by particle
      for (const particle of caseParticles) {
        if (text.endsWith(particle) && text.length > particle.length) {
          const word = text.slice(0, -particle.length);
          const wordReading = reading.slice(0, -particle.length);
          // Check if the word part is katakana or a known word
          const isKatakana = /^[\u30A0-\u30FF]+$/.test(word);
          const isKnownWord = allWords.some(w => w.japanese === word);
          if (isKatakana || isKnownWord) {
            const wordMatch = allWords.find(w => w.japanese === word);
            preprocessed.push({
              japanese: word,
              reading: wordReading,
              components: [{
                japanese: word,
                reading: wordReading,
                romaji: wordMatch?.romaji || generateRomaji(wordReading),
                english: wordMatch?.english || '',
              }],
            });
            const particleGrammar = COMMON_GRAMMAR[particle];
            preprocessed.push({
              japanese: particle,
              reading: particle,
              components: [{
                japanese: particle,
                reading: particle,
                romaji: particleGrammar?.romaji || generateRomaji(particle),
                english: particleGrammar?.english || '',
              }],
              hasPunctuation: seg.hasPunctuation,
            });
            didSplit = true;
            break;
          }
        }
      }

      if (!didSplit) {
        preprocessed.push(seg);
      }
    }
    segments = preprocessed;

    // Pass 0.5: Fix incorrectly split copulas/auxiliaries (e.g., 好きで + す → 好きです)
    // This catches cases where AI provides bad furigana segments
    preprocessed = [];
    for (let j = 0; j < segments.length; j++) {
      const current = segments[j];
      const next = segments[j + 1];

      // Check if current + next forms a protected pattern
      if (next) {
        const combined = current.japanese + next.japanese;
        // Check if ending forms です, ます, etc.
        for (const pattern of protectedPatterns) {
          if (combined.endsWith(pattern)) {
            // Check if current ends with partial pattern and next completes it
            // e.g., current="好きで", next="す", pattern="です"
            for (let k = 1; k < pattern.length; k++) {
              const partialEnd = pattern.slice(0, k);
              const remainder = pattern.slice(k);
              if (current.japanese.endsWith(partialEnd) && next.japanese === remainder) {
                // Merge them
                const mergedJapanese = current.japanese + next.japanese;
                const mergedReading = current.reading + next.reading;
                preprocessed.push({
                  japanese: mergedJapanese,
                  reading: mergedReading,
                  components: [...current.components, ...next.components],
                  hasPunctuation: next.hasPunctuation,
                });
                j++; // Skip next
                break;
              }
            }
            if (preprocessed.length > 0 && preprocessed[preprocessed.length - 1].japanese === combined.slice(0, -pattern.length) + pattern) {
              break; // Already handled
            }
          }
        }
      }

      // If not merged, add as-is
      if (preprocessed.length === 0 || preprocessed[preprocessed.length - 1] !== segments[j - 1]) {
        // Check we haven't already added this segment via merge
        const lastAdded = preprocessed[preprocessed.length - 1];
        if (!lastAdded || !lastAdded.japanese.endsWith(current.japanese + (next?.japanese || ''))) {
          preprocessed.push(current);
        }
      }
    }
    // Simpler approach: check consecutive pairs for copula fragments
    preprocessed = [];
    for (let j = 0; j < segments.length; j++) {
      const current = segments[j];
      const next = segments[j + 1];

      if (next) {
        // Check if current ends with で/ま and next is す/した/しょう etc.
        const copulaPairs = [
          { end: 'で', next: 'す', result: 'です' },
          { end: 'で', next: 'す。', result: 'です。' },
          { end: 'ま', next: 'す', result: 'ます' },
          { end: 'ま', next: 'す。', result: 'ます。' },
          { end: 'で', next: 'した', result: 'でした' },
          { end: 'ま', next: 'した', result: 'ました' },
          { end: 'ませ', next: 'ん', result: 'ません' },
        ];

        let didMerge = false;
        for (const pair of copulaPairs) {
          if (current.japanese.endsWith(pair.end) && next.japanese === pair.next) {
            // Merge: remove the partial ending from current and add full copula
            const baseJapanese = current.japanese.slice(0, -pair.end.length);
            const baseReading = current.reading.slice(0, -pair.end.length);
            const mergedJapanese = baseJapanese + pair.result;
            const mergedReading = baseReading + pair.result.replace('。', '');
            const hasPunct = pair.result.endsWith('。') ? '。' : next.hasPunctuation;

            preprocessed.push({
              japanese: mergedJapanese,
              reading: mergedReading + (hasPunct === '。' ? '' : ''),
              components: current.components,
              hasPunctuation: hasPunct,
            });
            j++; // Skip next segment
            didMerge = true;
            break;
          }
        }

        if (!didMerge) {
          preprocessed.push(current);
        }
      } else {
        preprocessed.push(current);
      }
    }
    segments = preprocessed;

    // Pass 1: Merge i-adjectives (kanji + hiragana ending like 大 + きい → 大きい)
    let merged: TempSegment[] = [];
    let i = 0;
    while (i < segments.length) {
      const current = segments[i];

      if (i + 1 < segments.length) {
        const next = segments[i + 1];
        const combined = current.japanese + next.japanese;
        const combinedReading = current.reading + next.reading;

        // Check if this forms a known i-adjective
        const iAdjMatch = I_ADJECTIVES[combined];
        if (iAdjMatch) {
          merged.push({
            japanese: combined,
            reading: combinedReading,
            components: [{
              japanese: combined,
              reading: combinedReading,
              romaji: iAdjMatch.romaji,
              english: iAdjMatch.english,
            }],
            hasPunctuation: next.hasPunctuation, // Preserve punctuation from merged segment
          });
          i += 2;
          continue;
        }

        // Check if it looks like an i-adjective pattern (kanji + きい/しい/etc ending)
        const hasKanji = /[\u4e00-\u9faf]/.test(current.japanese);
        const endsWithIAdj = I_ADJ_ENDINGS.some(ending => next.japanese.endsWith(ending));
        if (hasKanji && endsWithIAdj && next.japanese.length >= 2) {
          // Likely an i-adjective - merge it
          const wordMatch = allWords.find(w => w.japanese === combined);
          merged.push({
            japanese: combined,
            reading: combinedReading,
            components: [{
              japanese: combined,
              reading: combinedReading,
              romaji: wordMatch?.romaji || generateRomaji(combinedReading),
              english: wordMatch?.english || '',
            }],
            hasPunctuation: next.hasPunctuation, // Preserve punctuation
          });
          i += 2;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Pass 2: Merge ichidan verb stems with their conjugation endings (e.g., 見 + えます → 見えます)
    segments = merged;
    merged = [];
    i = 0;
    const ichidanEndings = ['えます', 'います', 'えます', 'きます', 'ぎます', 'します', 'ちます', 'にます', 'びます', 'みます', 'ります', 'える', 'いる', 'きる', 'ぎる', 'しる', 'ちる', 'にる', 'びる', 'みる', 'りる'];
    while (i < segments.length) {
      const current = segments[i];

      if (i + 1 < segments.length) {
        const next = segments[i + 1];
        const combined = current.japanese + next.japanese;
        const combinedReading = current.reading + next.reading;

        // Check if this is a kanji stem + ichidan verb ending pattern
        const hasKanji = /^[\u4e00-\u9faf]+$/.test(current.japanese);
        const isIchidanEnding = ichidanEndings.some(ending => next.japanese.startsWith(ending.charAt(0)) &&
          (next.japanese.endsWith('ます') || next.japanese.endsWith('る')));

        if (hasKanji && current.japanese.length <= 2 && isIchidanEnding) {
          const wordMatch = allWords.find(w => w.japanese === combined || w.japanese === current.japanese + next.japanese.replace('ます', 'る'));
          merged.push({
            japanese: combined,
            reading: combinedReading,
            components: [{
              japanese: combined,
              reading: combinedReading,
              romaji: wordMatch?.romaji || generateRomaji(combinedReading),
              english: wordMatch?.english || '',
            }],
            hasPunctuation: next.hasPunctuation,
          });
          i += 2;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Pass 3: Merge です/ます with following sentence-end particles (ね, よ, か)
    segments = merged;
    merged = [];
    i = 0;
    while (i < segments.length) {
      const current = segments[i];

      if (i + 1 < segments.length) {
        const next = segments[i + 1];
        const combined = current.japanese + next.japanese;

        // Check if this forms a copula + particle pattern
        if ((current.japanese === 'です' || current.japanese === 'ます') &&
            sentenceEndParticles.includes(next.japanese)) {
          const grammarMatch = COMMON_GRAMMAR[combined];
          merged.push({
            japanese: combined,
            reading: current.reading + next.reading,
            components: [{
              japanese: combined,
              reading: current.reading + next.reading,
              romaji: grammarMatch?.romaji || generateRomaji(current.reading + next.reading),
              english: grammarMatch?.english || 'polite ending',
            }],
            hasPunctuation: next.hasPunctuation,
          });
          i += 2;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Pass 3: Merge verb stems with conjugations
    segments = merged;
    merged = [];
    i = 0;
    while (i < segments.length) {
      const current = segments[i];

      if (i + 1 < segments.length) {
        const next = segments[i + 1];
        const isVerbConjugation = verbConjugations.some(conj =>
          next.japanese === conj || (next.japanese.startsWith('て') && next.japanese.length > 1)
        );

        const combined = current.japanese + next.japanese;
        const looksLikeVerb = verbConjugations.some(conj => combined.endsWith(conj));

        if (isVerbConjugation || looksLikeVerb) {
          merged.push({
            japanese: combined,
            reading: current.reading + next.reading,
            components: [...current.components, ...next.components],
            hasPunctuation: next.hasPunctuation,
          });
          i += 2;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Pass 4: Merge nouns with following case particles (but NOT adverbs)
    segments = merged;
    merged = [];
    i = 0;
    while (i < segments.length) {
      const current = segments[i];

      if (punctuation.includes(current.japanese)) {
        merged.push(current);
        i++;
        continue;
      }

      // Don't merge adverbs with particles
      if (standaloneAdverbs.includes(current.japanese)) {
        merged.push(current);
        i++;
        continue;
      }

      if (i + 1 < segments.length) {
        const next = segments[i + 1];
        const isCaseParticle = caseParticles.includes(next.japanese);

        if (isCaseParticle) {
          merged.push({
            japanese: current.japanese + next.japanese,
            reading: current.reading + next.reading,
            components: [...current.components, ...next.components],
            hasPunctuation: next.hasPunctuation,
          });
          i += 2;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Pass 5: Merge adjectival phrases (word + の)
    segments = merged;
    merged = [];
    i = 0;
    while (i < segments.length) {
      const current = segments[i];

      if (i + 1 < segments.length) {
        const next = segments[i + 1];

        if (next.japanese === adjectivalNo && !punctuation.includes(current.japanese) && !standaloneAdverbs.includes(current.japanese)) {
          merged.push({
            japanese: current.japanese + next.japanese,
            reading: current.reading + next.reading,
            components: [...current.components, ...next.components],
            hasPunctuation: next.hasPunctuation,
          });
          i += 2;
          continue;
        }
      }

      merged.push(current);
      i++;
    }

    // Convert to result format (attach punctuation to final segment)
    for (let idx = 0; idx < merged.length; idx++) {
      const seg = merged[idx];
      // Skip standalone punctuation
      if (punctuation.includes(seg.japanese)) {
        continue;
      }

      // Add punctuation suffix if this segment has it
      const displayJapanese = seg.hasPunctuation ? seg.japanese + seg.hasPunctuation : seg.japanese;

      const containsTarget = seg.japanese.includes(targetWord.japanese) ||
        seg.components.some(c => c.japanese === targetWord.japanese);

      const phraseWordMatch = allWords.find(w => w.japanese === seg.japanese);
      const iAdjMatch = I_ADJECTIVES[seg.japanese];
      const primaryComponent = seg.components.find(c => c.english) || seg.components[0];

      // Determine grammatical role based on ending particle
      const chunkParticles = ['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'も', 'から', 'まで'];
      let role: GrammaticalRole = 'other';
      for (const p of chunkParticles) {
        if (seg.japanese.endsWith(p) || displayJapanese.replace(/[。、！？]/g, '').endsWith(p)) {
          role = getGrammaticalRole(p);
          break;
        }
      }
      // Check if this is a verb (ends with ます, です, る, た, etc.)
      const verbEndings = ['ます', 'です', 'る', 'た', 'て', 'ない', 'ません'];
      const cleanText = seg.japanese.replace(/[。、！？]/g, '');
      if (role === 'other' && verbEndings.some(v => cleanText.endsWith(v))) {
        role = 'verb';
      }

      // Generate proper romaji using the generateRomaji helper
      const properRomaji = iAdjMatch?.romaji || generateRomaji(seg.reading);

      result.push({
        japanese: displayJapanese, // Include punctuation in display
        reading: seg.reading,
        romaji: properRomaji,
        english: iAdjMatch?.english || phraseWordMatch?.english || primaryComponent?.english || '',
        nativeTranslation: phraseWordMatch?.nativeTranslation || iAdjMatch?.english || primaryComponent?.english || '',
        isTargetWord: containsTarget,
        isPhrase: seg.components.length > 1,
        grammaticalRole: role,
        components: seg.components.length > 1 ? seg.components : undefined,
      });
    }

    // Consolidation: If more than 4 segments, merge smaller adjacent non-verb segments
    while (result.length > 4) {
      // Find the smallest non-verb segment to merge with neighbor
      let smallestIdx = -1;
      let smallestLen = Infinity;
      for (let j = 0; j < result.length - 1; j++) {
        if (result[j].grammaticalRole !== 'verb' && result[j].japanese.length < smallestLen) {
          smallestLen = result[j].japanese.length;
          smallestIdx = j;
        }
      }
      if (smallestIdx >= 0 && smallestIdx < result.length - 1) {
        const curr = result[smallestIdx];
        const next = result[smallestIdx + 1];
        result[smallestIdx] = {
          japanese: curr.japanese + next.japanese,
          reading: curr.reading + next.reading,
          romaji: curr.romaji + ' ' + next.romaji,
          english: [curr.english, next.english].filter(Boolean).join(', '),
          nativeTranslation: [curr.nativeTranslation, next.nativeTranslation].filter(Boolean).join(', '),
          isTargetWord: curr.isTargetWord || next.isTargetWord,
          isPhrase: true,
          grammaticalRole: next.grammaticalRole,
          components: [...(curr.components || [{ japanese: curr.japanese, reading: curr.reading, romaji: curr.romaji, english: curr.english }]),
                       ...(next.components || [{ japanese: next.japanese, reading: next.reading, romaji: next.romaji, english: next.english }])],
        };
        result.splice(smallestIdx + 1, 1);
      } else {
        break;
      }
    }
  } else if (sentence.japanese) {
    // Non-Japanese languages - use space-based tokenization
    // Split by spaces while keeping punctuation attached to words
    const tokens = sentence.japanese.split(/\s+/).filter(w => w.length > 0);

    tokens.forEach(token => {
      // Separate leading/trailing punctuation from the word
      const leadingPunct = token.match(/^[,.!?¿¡;:'"()]+/)?.[0] || '';
      const trailingPunct = token.match(/[,.!?¿¡;:'"()]+$/)?.[0] || '';
      const endIndex = trailingPunct.length > 0 ? token.length - trailingPunct.length : token.length;
      const cleanWord = token.slice(leadingPunct.length, endIndex);

      // Add leading punctuation as separate token
      if (leadingPunct) {
        result.push({
          japanese: leadingPunct,
          reading: leadingPunct,
          romaji: leadingPunct,
          english: '',
          nativeTranslation: '',
          isTargetWord: false,
        });
      }

      // Add the main word
      if (cleanWord) {
        // Try to match against vocabulary words (case-insensitive for Latin scripts)
        const matchedWord = allWords.find(w => {
          const wordTarget = w.japanese || w.romaji || '';
          return wordTarget.toLowerCase() === cleanWord.toLowerCase();
        });

        // Check if this is the target word
        const targetWordText = targetWord.japanese || targetWord.romaji || '';
        const isTarget = targetWordText.toLowerCase() === cleanWord.toLowerCase();

        result.push({
          japanese: cleanWord,
          reading: cleanWord, // For Latin scripts, reading = text
          romaji: cleanWord,
          english: matchedWord?.english || '',
          nativeTranslation: matchedWord?.nativeTranslation || '',
          isTargetWord: isTarget,
        });
      }

      // Add trailing punctuation as separate token
      if (trailingPunct) {
        result.push({
          japanese: trailingPunct,
          reading: trailingPunct,
          romaji: trailingPunct,
          english: '',
          nativeTranslation: '',
          isTargetWord: false,
        });
      }
    });
  } else {
    // Fallback - show whole sentence
    result.push({
      japanese: sentence.japanese || sentence.romaji,
      reading: sentence.reading || sentence.romaji,
      romaji: sentence.romaji,
      english: sentence.translation,
      nativeTranslation: sentence.nativeTranslation || sentence.translation,
      isTargetWord: false,
    });
  }

  return result;
}

const styles = StyleSheet.create({
  // Step Progress Indicator - minimal design
  stepProgressContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: colors.mint,
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: colors.border,
  },
  stepConnectorCompleted: {
    backgroundColor: colors.mint,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCompact: {
    marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  japanese: {
    fontSize: 36,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  japaneseCompact: {
    fontSize: 28,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: colors.primary,
  },
  reading: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.primary,
    marginTop: 2,
  },
  romaji: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  meaning: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
    marginTop: spacing.xs,
  },
  meaningCompact: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  meaningTapArea: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  meaningHidden: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  meaningHiddenText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  pos: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 1,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.white,
  },
  tabContent: {
    flex: 1,
  },

  // Pronunciation tab - full screen centered layout
  pronunciationTab: {
    flex: 1,
    justifyContent: 'center',
  },
  speakAreaCentered: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  listenSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  listenButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listenBtnLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listenBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  listenBtnSmall: {
    alignItems: 'center',
    gap: 2,
    padding: spacing.sm,
  },
  slowLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sectionDivider: {
    width: 60,
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  speakSection: {
    alignItems: 'center',
  },
  sayTarget: {
    fontSize: 28,
    fontWeight: '700' as any,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  recordBtnLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  recordBtnRecording: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
  },
  resultAreaCompact: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  resultInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultInlineText: {
    fontSize: 20,
    fontWeight: '600' as any,
    color: colors.navy,
  },
  tryAgainLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500' as any,
  },
  hearingText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  hearingTextSentence: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statusHint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Legacy styles kept for compatibility
  listenControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  speakArea: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultArea: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapHint: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  resultSuccess: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultSuccessText: {
    fontSize: typography.lg,
    color: colors.mint,
    fontWeight: typography.bold,
  },
  resultScore: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  resultRetryBox: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultRetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultRetryText: {
    fontSize: typography.base,
    color: colors.warning,
    fontWeight: typography.semibold,
  },
  resultErrorText: {
    fontSize: typography.sm,
    color: colors.error,
    textAlign: 'center',
  },
  heardAs: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  tryAgainBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  tryAgainText: {
    fontSize: typography.sm,
    color: colors.white,
    fontWeight: typography.medium,
  },
  masterySection: {
    width: '100%',
  },
  masteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  masteryLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    width: 60,
  },
  masteryBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: 4,
  },
  masteryValue: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.navy,
    width: 40,
    textAlign: 'right',
  },

  // Speak tab
  speakTab: {
    alignItems: 'center',
  },
  speakPrompt: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  speakWord: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  speakReading: {
    fontSize: typography.lg,
    color: colors.primary,
  },
  speakRomaji: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: typography.medium,
    marginBottom: spacing.md,
  },
  exampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  exampleBtnText: {
    fontSize: typography.sm,
    color: colors.primary,
  },
  unavailableBox: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: `${colors.warning}15`,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  unavailableText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Write canvas (draw mode) - maximized square
  writeCanvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    // Subtle shadow for depth
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  writeGuideChar: {
    position: 'absolute',
    fontSize: CANVAS_SIZE * 0.7, // Scale with canvas size
    color: colors.primary,
    opacity: 0.15,
    fontWeight: '300',
  },
  writeGridV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
    opacity: 0.4,
  },
  writeGridH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.4,
  },

  // ============ REDESIGNED WRITE TAB ============
  writeTabContainer: {
    flex: 1,
  },

  // Mode toggle row
  writeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  writeModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 2,
  },
  writeModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  writeModeBtnActive: {
    backgroundColor: colors.primary,
  },
  writeModeBtnLabel: {
    fontSize: 11,
    fontWeight: '600' as any,
    color: colors.textMuted,
  },
  writeModeBtnLabelActive: {
    color: colors.white,
  },
  writeModeBtnCompact: {
    width: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
  },
  writeModeBtnCompactActive: {
    backgroundColor: colors.primary,
  },
  settingsBtn: {
    padding: 4,
  },

  // Script selector (for Japanese kanji/hiragana/katakana)
  scriptSelector: {
    flexDirection: 'row',
    marginLeft: spacing.md,
    gap: 4,
  },
  scriptBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scriptBtnActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  scriptBtnText: {
    fontSize: 11,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
  scriptBtnTextActive: {
    color: colors.primary,
    fontWeight: typography.semibold,
  },

  // Script toggle (visible when multiple scripts available)
  scriptToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 6,
  },
  scriptToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scriptToggleBtnActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: colors.primary,
  },
  scriptToggleText: {
    fontSize: 13,
    fontWeight: '500' as any,
    color: colors.textMuted,
  },
  scriptToggleTextActive: {
    color: colors.primary,
    fontWeight: '600' as any,
  },

  // Settings panel
  settingsPanel: {
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    gap: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsLabel: {
    fontSize: 11,
    color: colors.textMuted,
    width: 40,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 6,
    padding: 2,
    flex: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '500' as any,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.white,
  },

  // Draw mode - clean layout with toolbar always visible
  drawModeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Character navigation with arrows - compact
  charNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 6,
  },
  charNavArrow: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  charNavArrowLarge: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 22,
  },
  charNavArrowDisabled: {
    opacity: 0.3,
  },
  charNavScroll: {
    flex: 1,
    maxHeight: 50,
  },
  charNavScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  charNavCenter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingHorizontal: 4,
  },
  charSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    gap: 8,
    paddingHorizontal: 8,
  },
  charSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  charProgressTextSmall: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600' as any,
    minWidth: 24,
  },
  canvasWithArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sideArrow: {
    width: 40,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    marginHorizontal: 2,
  },
  sideArrowDisabled: {
    opacity: 0.3,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  canvasToolbarCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 4,
    paddingBottom: 12,
  },
  toolbarBtnSmall: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  nextBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 18,
    gap: 4,
  },
  nextBtnInlineDisabled: {
    backgroundColor: colors.border,
  },
  nextBtnInlineText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700' as any,
  },
  nextBtnInlineTextDisabled: {
    color: colors.textMuted,
  },
  charProgressRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  charProgressText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500' as any,
  },
  drawCharBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawCharBoxActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    transform: [{ scale: 1.05 }],
  },
  drawCharBoxComplete: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  drawCharText: {
    fontSize: 16,
    fontWeight: '600' as any,
    color: colors.textMuted,
  },
  drawCharTextActive: {
    color: colors.primary,
    fontWeight: '700' as any,
  },
  drawCharTextComplete: {
    color: colors.white,
  },
  // Toolbar below canvas - always visible
  canvasToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 12,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  toolbarBtn: {
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toolbarBtnDisabled: {
    opacity: 0.35,
  },
  toolbarBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  toolbarBtnTextDisabled: {
    color: colors.border,
  },
  // Legacy (kept for compatibility)
  drawToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  drawToolBtn: {
    padding: 8,
  },

  // Keyboard mode - flex layout with input at top, keyboard at bottom
  keyboardModeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 280, // Ensure minimum height for keyboard + input
  },

  // Input section (top) - compact to maximize keyboard space
  kbInputSection: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  kbInputBoxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  kbInputBox: {
    width: 46,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  kbInputBoxKorean: {
    width: 38,
    height: 44,
    borderRadius: 8,
  },

  // Korean syllable-based UI styles
  koreanInputContainer: {
    alignItems: 'center',
    gap: 16,
  },
  koreanSyllableRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  koreanSyllableBox: {
    width: 56,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  koreanSyllableComplete: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  koreanSyllableCurrent: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  koreanSyllableChar: {
    fontSize: 28,
    fontWeight: '600' as any,
    color: colors.navy,
  },
  koreanSyllableCharComplete: {
    color: colors.white,
  },
  koreanSyllableCharCurrent: {
    color: colors.primary,
  },
  koreanSyllableCharWaiting: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  koreanJamoSection: {
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  koreanJamoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  koreanJamoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  koreanJamoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  koreanJamoBox: {
    width: 36,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  koreanJamoBoxTyped: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  koreanJamoBoxNext: {
    borderColor: colors.primary,
    borderWidth: 2.5,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  koreanJamoChar: {
    fontSize: 18,
    fontWeight: '600' as any,
    color: colors.navy,
  },
  koreanJamoCharTyped: {
    color: colors.white,
  },
  koreanJamoCharNext: {
    color: colors.primary,
  },
  koreanJamoPlus: {
    fontSize: 16,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  koreanJamoEquals: {
    fontSize: 18,
    color: colors.primary,
    marginHorizontal: 8,
    fontWeight: '600' as any,
  },
  koreanJamoResultBox: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  koreanJamoResultChar: {
    fontSize: 24,
    fontWeight: '700' as any,
    color: colors.primary,
  },
  koreanProgressRow: {
    marginTop: 8,
  },
  koreanProgressText: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // Chinese pinyin-based UI styles
  chineseInputContainer: {
    alignItems: 'center',
    gap: 16,
  },
  chineseCharRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  chineseCharBox: {
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chineseCharComplete: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: colors.mint,
  },
  chineseCharCurrent: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: colors.primary,
    borderWidth: 2.5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  chinesePinyinText: {
    fontSize: 12,
    fontWeight: '500' as any,
    color: colors.textMuted,
    marginBottom: 4,
  },
  chinesePinyinComplete: {
    color: colors.mint,
  },
  chinesePinyinCurrent: {
    color: colors.primary,
    fontWeight: '600' as any,
  },
  chinesePinyinWaiting: {
    color: colors.textMuted,
    opacity: 0.6,
  },
  chineseCharText: {
    fontSize: 28,
    fontWeight: '600' as any,
    color: colors.textPrimary,
  },
  chineseCharTextComplete: {
    color: colors.mint,
  },
  chineseCharTextCurrent: {
    color: colors.primary,
  },
  chineseCharTextWaiting: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  chinesePinyinSection: {
    alignItems: 'center',
    gap: 8,
  },
  chinesePinyinLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chinesePinyinTarget: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: colors.primary,
  },
  chinesePinyinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chinesePinyinBox: {
    width: 36,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chinesePinyinBoxTyped: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderColor: colors.mint,
  },
  chinesePinyinBoxNext: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  chinesePinyinChar: {
    fontSize: 18,
    fontWeight: '500' as any,
    color: colors.textMuted,
  },
  chinesePinyinCharTyped: {
    color: colors.mint,
    fontWeight: '600' as any,
  },
  chinesePinyinCharNext: {
    color: colors.primary,
    fontWeight: '600' as any,
  },
  chineseProgressRow: {
    marginTop: 8,
  },
  chineseProgressText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  noPinyinMessage: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1D4DB',
  },
  noPinyinText: {
    fontSize: 16,
    fontWeight: '600' as any,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  noPinyinSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },

  kbInputBoxComplete: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  kbInputBoxCurrent: {
    borderColor: colors.primary,
    borderWidth: 2.5,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    transform: [{ scale: 1.05 }],
  },
  kbInputChar: {
    fontSize: 24,
    fontWeight: '600' as any,
    color: colors.navy,
  },
  kbInputCharComplete: {
    color: colors.white,
  },
  kbInputCharGhost: {
    fontSize: 24,
    fontWeight: '600' as any,
    color: colors.primary,
    opacity: 0.25,
    position: 'absolute',
  },
  kbInputCharWaiting: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  kbInputCursor: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  // Instruction row
  kbInstructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 16,
  },
  kbInstructionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  kbInstructionKey: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: colors.primary,
  },
  kbInstructionTarget: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: colors.mint,
  },

  // Japanese swipe-focused input display
  japaneseInputContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  japaneseWordRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  japaneseWordChar: {
    fontSize: 32,
    fontWeight: '600' as any,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  japaneseWordCharComplete: {
    color: colors.mint,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  japaneseWordCharCurrent: {
    color: colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  japaneseWordCharWaiting: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  japaneseRomajiGuide: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as any,
    letterSpacing: 1,
  },
  japaneseInstructionBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: 4,
  },
  japaneseInstructionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  japaneseInstructionMain: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  japaneseInstructionKey: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: colors.primary,
  },
  japaneseInstructionDirection: {
    fontWeight: '600' as any,
    color: colors.navy,
  },
  japaneseInstructionTarget: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: colors.mint,
  },
  japaneseProgressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  japaneseProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  japaneseProgressDotComplete: {
    backgroundColor: colors.mint,
  },
  japaneseProgressDotCurrent: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.25 }],
  },

  // Keyboard wrapper - extends to card edges
  kbKeyboardWrapper: {
    marginHorizontal: -spacing.lg,
    marginBottom: -spacing.lg,
    // Ensure keyboard is always visible at bottom
    flexShrink: 0,
  },

  // Completion screen
  kbCompleteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kbCompleteContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  kbCompleteTitle: {
    fontSize: 22,
    fontWeight: '700' as any,
    color: colors.navy,
  },
  kbScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  kbScoreStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  kbScoreDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  kbScoreValue: {
    fontSize: 28,
    fontWeight: '700' as any,
    color: colors.primary,
  },
  kbScoreLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  kbRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  kbRetryText: {
    fontSize: 15,
    fontWeight: '600' as any,
    color: colors.white,
  },

  // Spelling tab (for alphabetic languages) - compact layout
  spellingTab: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  spellingPrompt: {
    alignItems: 'center',
  },
  spellingLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  spellingMeaning: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  spellingAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  spellingAudioBtnActive: {
    backgroundColor: colors.primary,
  },
  spellingAudioText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  spellingAudioTextActive: {
    color: colors.white,
  },
  spellingInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  spellingInputWrapper: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  spellingInput: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.navy,
    textAlign: 'center',
  },
  spellingInputPlaceholder: {
    color: colors.textMuted,
    fontWeight: typography.normal,
    fontSize: typography.sm,
  },
  spellingClearBtn: {
    padding: spacing.xs,
  },
  spellingProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.xs,
  },
  spellingProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  spellingProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  spellingProgressComplete: {
    backgroundColor: colors.mint,
  },
  spellingProgressText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
    minWidth: 35,
    textAlign: 'right',
  },
  spellingProgressTextComplete: {
    color: colors.mint,
  },
  telexHint: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    width: '100%',
  },
  telexHintTitle: {
    fontSize: 11,
    fontWeight: typography.semibold,
    color: colors.primary,
    marginBottom: 2,
  },
  telexHintText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  specialCharsRow: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  specialCharBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 6,
    marginRight: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specialCharText: {
    fontSize: typography.lg,
    fontWeight: typography.medium,
    color: colors.navy,
  },
  spellingKeyboard: {
    width: '100%',
    gap: 6,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  keyboardKey: {
    width: 32,
    height: 44,
    backgroundColor: colors.white,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  keyboardKeyWide: {
    width: 90,
  },
  keyboardKeyText: {
    fontSize: typography.lg,
    color: colors.navy,
    fontWeight: typography.medium,
  },
  keyboardKeyCyrillic: {
    width: 26,
    height: 40,
    paddingHorizontal: 2,
  },
  keyboardKeyTextCyrillic: {
    fontSize: 15,
  },
  spellingCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  spellingCheckBtnDisabled: {
    backgroundColor: colors.border,
  },
  spellingCheckText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.white,
  },
  spellingResult: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  spellingSuccessIcon: {
    marginBottom: spacing.sm,
  },
  spellingSuccessText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.mint,
  },
  spellingWrongLabel: {
    fontSize: typography.base,
    color: colors.warning,
    fontWeight: typography.medium,
  },
  spellingComparison: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  spellingLetterBox: {
    alignItems: 'center',
    minWidth: 24,
  },
  spellingTargetLetter: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textMuted,
  },
  spellingLetterCorrect: {
    color: colors.mint,
  },
  spellingLetterWrong: {
    color: colors.error,
  },
  spellingUserLetter: {
    fontSize: typography.sm,
    color: colors.error,
    textDecorationLine: 'line-through',
  },
  spellingCorrectAnswer: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  spellingCorrectLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  spellingCorrectWord: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.mint,
    marginTop: spacing.xs,
  },
  spellingRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  spellingRetryText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },

  // Sentence tab
  sentenceTab: {
    flex: 1,
  },
  noSentenceBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },
  noSentence: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  noSentenceHint: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  fullSentenceBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  fullSentenceJapanese: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  fullSentenceReading: {
    fontSize: typography.sm,
    color: colors.primary,
    textAlign: 'center',
  },
  sentenceAudioRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sentencePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  sentencePlayBtnActive: {
    backgroundColor: colors.primary,
  },
  sentencePlayText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  sentencePlayTextActive: {
    color: colors.white,
  },

  // Speaking practice styles
  speakingPracticeSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },
  speakingPracticeLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontWeight: typography.medium,
  },
  sentenceMicButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  sentenceMicButtonRecording: {
    backgroundColor: colors.error,
  },
  micHintText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  recordingErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.error}15`,
    borderRadius: borderRadius.md,
  },
  recordingErrorText: {
    fontSize: typography.sm,
    color: colors.error,
  },
  pronunciationFeedbackBox: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  scoreText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  feedbackText: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    marginTop: spacing.sm,
  },
  sentenceTryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  sentenceTryAgainText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },

  wordBreakdownLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sentenceWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sentenceWordUnit: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 44,
  },
  sentenceWordTarget: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  sentenceWordSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  swJapanese: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  swJapaneseTarget: {
    color: colors.primary,
  },
  swJapaneseSelected: {
    color: colors.white,
  },
  selectedWordBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  grammaticalRoleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  grammaticalRoleText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.white,
    letterSpacing: 0.5,
  },
  selectedWordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  selectedWordJapanese: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  selectedWordReading: {
    fontSize: typography.base,
    color: colors.primary,
  },
  selectedWordRomaji: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  selectedWordEnglish: {
    fontSize: typography.base,
    color: colors.navy,
    fontWeight: typography.semibold,
    marginTop: spacing.sm,
  },

  // Phrase styles
  sentencePhraseUnit: {
    borderStyle: 'dashed',
  },
  phraseIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    opacity: 0.6,
  },
  phraseBreakdown: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  phraseBreakdownLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phraseComponents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phraseComponent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 50,
  },
  phraseComponentJapanese: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  phraseComponentReading: {
    fontSize: typography.xs,
    color: colors.primary,
    marginTop: 2,
  },
  phraseComponentEnglish: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  sentenceTranslation: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  translationLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  translationText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  sentencePracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  sentencePracticeBtnText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.semibold as any,
  },

  // Quiz tab
  quizTab: {
    flex: 1,
  },
  quizTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  quizProgressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quizProgress: {
    marginBottom: spacing.sm,
  },
  quizProgressText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    minWidth: 30,
  },
  quizProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  quizProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  quizStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.xp,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  quizStreakText: {
    fontSize: typography.sm,
    fontWeight: typography.bold as any,
    color: colors.white,
  },
  quizQuestionBox: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quizWordContainer: {
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quizAudioBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quizJapanese: {
    fontSize: 32,
    fontWeight: typography.bold as any,
    color: colors.navy,
  },
  quizRomaji: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  quizRomajiHidden: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  quizMeaning: {
    fontSize: typography.xl,
    fontWeight: typography.semibold as any,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  quizQuestion: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  quizOptions: {
    gap: spacing.xs,
  },
  quizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quizOptionCorrect: {
    borderColor: colors.mint,
    backgroundColor: `${colors.mint}15`,
  },
  quizOptionWrong: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}15`,
  },
  quizOptionDimmed: {
    opacity: 0.4,
  },
  quizOptionText: {
    fontSize: typography.base,
    color: colors.navy,
    fontWeight: typography.medium as any,
    flex: 1,
  },
  quizOptionTextJapanese: {
    fontSize: typography.xl,
  },
  quizOptionTextCorrect: {
    color: colors.mint,
    fontWeight: typography.bold as any,
  },
  quizOptionTextWrong: {
    color: colors.error,
  },
  // Build word styles (tap to arrange characters)
  quizBuildContainer: {
    gap: spacing.md,
    alignItems: 'center',
  },
  quizBuildAnswer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    minHeight: 60,
    width: '100%',
  },
  quizBuildAnswerCorrect: {
    borderColor: colors.mint,
    borderStyle: 'solid',
    backgroundColor: `${colors.mint}10`,
  },
  quizBuildAnswerWrong: {
    borderColor: colors.error,
    borderStyle: 'solid',
    backgroundColor: `${colors.error}10`,
  },
  quizBuildAnswerChars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  quizBuildSelectedChar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  quizBuildPlaceholder: {
    fontSize: typography.base,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  quizBuildResultIcon: {
    marginLeft: spacing.sm,
  },
  quizBuildBank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  quizBuildBankChar: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    minWidth: 44,
    alignItems: 'center',
  },
  quizBuildBankCharUsed: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  quizBuildCharText: {
    fontSize: 24,
    fontWeight: typography.semibold as any,
    color: colors.navy,
  },
  quizBuildCharCorrect: {
    color: colors.mint,
  },
  quizBuildCharWrong: {
    color: colors.error,
  },
  quizBuildCharUsed: {
    color: colors.textMuted,
    opacity: 0.3,
  },
  quizSubmitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  quizSubmitText: {
    fontSize: typography.base,
    fontWeight: typography.semibold as any,
    color: colors.white,
  },
  // Feedback styles
  quizFeedbackBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  quizXpFloat: {
    position: 'absolute',
    top: -20,
    fontSize: typography.lg,
    fontWeight: typography.bold as any,
    color: colors.xp,
  },
  quizCorrectAnswerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quizCorrectAnswerPlay: {
    width: 40,
    height: 40,
    backgroundColor: colors.white,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizCorrectAnswerWord: {
    fontSize: typography.xl,
    fontWeight: typography.bold as any,
    color: colors.navy,
  },
  quizCorrectAnswerMeaning: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  quizCorrectAnswerReading: {
    fontSize: typography.sm,
    color: colors.primary,
  },
  quizWrongExplanation: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  quizNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  quizNextText: {
    fontSize: typography.base,
    fontWeight: typography.semibold as any,
    color: colors.white,
  },
  quizCompleteBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  quizCompleteTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold as any,
    color: colors.navy,
    marginTop: spacing.md,
  },
  quizCompleteScore: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  quizStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  quizStatItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  quizStatValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold as any,
    color: colors.xp,
  },
  quizStatLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  quizStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  quizCompleteActions: {
    marginTop: spacing.lg,
  },
  quizRestartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },
  quizRestartText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.medium as any,
  },
});

export default WordDetailCard;
