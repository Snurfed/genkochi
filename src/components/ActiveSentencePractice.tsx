import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sentence, ReadingLevel } from '../types';
import { FuriganaText } from './FuriganaText';
import { SentenceWordBreakdown } from './SentenceWordBreakdown';
import {
  startListening,
  requestSpeechPermissions,
  checkJapanesePronunciation,
} from '../utils/speechRecognition';
import { speakJapanese, loadJapaneseVoice, stopSpeaking, preloadAudio } from '../utils/speech';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/design';

// Phase type for the active learning loop
type PracticePhase = 'reading' | 'listening' | 'speaking' | 'feedback';

interface ActiveSentencePracticeProps {
  sentence: Sentence;
  readingLevel: ReadingLevel;
  onComplete: (result: { pronunciationScore: number; passed: boolean }) => void;
  onSkip?: () => void;
  requiredScore?: number;
}

/**
 * ActiveSentencePractice - Enforces the active learning loop for sentences
 *
 * Phases (user MUST complete in order):
 * 1. READING - See and read the sentence
 * 2. LISTENING - Hear the pronunciation
 * 3. SPEAKING - Speak the sentence
 * 4. FEEDBACK - See results, retry if needed
 */
export function ActiveSentencePractice({
  sentence,
  readingLevel,
  onComplete,
  onSkip,
  requiredScore = 80,
}: ActiveSentencePracticeProps) {
  // Phase state
  const [currentPhase, setCurrentPhase] = useState<PracticePhase>('reading');
  const [romajiRevealed, setRomajiRevealed] = useState(false);
  const [showRomaji, setShowRomaji] = useState(true); // Romaji toggle (default ON for beginners)
  const [isRecording, setIsRecording] = useState(false);
  const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animation values
  const phaseAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const celebrationAnimation = useRef(new Animated.Value(0)).current;

  // Cleanup ref for speech recognition
  const stopListeningRef = useRef<(() => void) | null>(null);

  // Animate phase transitions
  useEffect(() => {
    phaseAnimation.setValue(0);
    Animated.timing(phaseAnimation, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentPhase]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isRecording]);

  // Load voice on mount, preload audio, cleanup on unmount
  useEffect(() => {
    loadJapaneseVoice();
    // Preload sentence audio for instant playback
    const text = sentence.reading || sentence.japanese;
    preloadAudio(text, false);
    preloadAudio(text, true);

    return () => {
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
      stopSpeaking();
    };
  }, [sentence.id]);

  // Reset state when sentence changes (e.g., moving to next sentence)
  useEffect(() => {
    setCurrentPhase('reading');
    setRomajiRevealed(false);
    setIsRecording(false);
    setPronunciationScore(null);
    setAttempts(0);
    setIsPlaying(false);
    setErrorMessage(null);
  }, [sentence.id]);

  // Auto-play audio when entering listening phase
  useEffect(() => {
    if (currentPhase === 'listening') {
      handlePlayAudio();
    }
  }, [currentPhase]);

  // Get phase number for progress display
  const getPhaseNumber = (): number => {
    const phases: PracticePhase[] = ['reading', 'listening', 'speaking', 'feedback'];
    return phases.indexOf(currentPhase) + 1;
  };

  // Get phase label
  const getPhaseLabel = (): string => {
    switch (currentPhase) {
      case 'reading':
        return 'Read';
      case 'listening':
        return 'Listen';
      case 'speaking':
        return 'Speak';
      case 'feedback':
        return 'Result';
    }
  };

  // Determine furigana display based on reading level
  const getFuriganaMode = (): 'always' | 'kanji-only' | 'on-tap' | 'never' => {
    switch (readingLevel) {
      case 'romaji':
        return 'always';
      case 'kana':
        return 'always';
      case 'kanji-basic':
        return 'always';
      case 'kanji-read':
        return 'on-tap';
      case 'fluent':
        return 'never';
      default:
        return 'always';
    }
  };

  // Handle revealing romaji (with penalty tracking)
  const handleRevealRomaji = () => {
    if (!romajiRevealed) {
      setRomajiRevealed(true);
    }
  };

  // Handle "I've read it" button
  const handleReadingComplete = () => {
    setCurrentPhase('listening');
  };

  // Play audio (normal or slow speed)
  const handlePlayAudio = async (slow: boolean = false) => {
    setIsPlaying(true);
    // Use hiragana reading for accurate pronunciation
    await speakJapanese(sentence.reading || sentence.japanese, {
      slow,
      onDone: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  };

  // Handle listening complete
  const handleListeningComplete = () => {
    setCurrentPhase('speaking');
  };

  // Start speech recognition
  const handleStartRecording = async () => {
    setErrorMessage(null);

    // Request permissions
    const hasPermission = await requestSpeechPermissions();
    if (!hasPermission) {
      setErrorMessage('Microphone permission required');
      return;
    }

    setIsRecording(true);

    stopListeningRef.current = startListening('ja-JP', {
      onResult: (transcript) => {
        setIsRecording(false);
        const result = checkJapanesePronunciation(
          transcript,
          sentence.japanese,
          sentence.romaji
        );
        setPronunciationScore(result.score);
        setAttempts((prev) => prev + 1);
        setCurrentPhase('feedback');

        // Trigger celebration if passed
        if (result.score >= requiredScore) {
          Animated.sequence([
            Animated.timing(celebrationAnimation, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(celebrationAnimation, {
              toValue: 0,
              duration: 300,
              delay: 500,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
      onError: (error) => {
        setIsRecording(false);
        setErrorMessage(error);
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });
  };

  // Stop recording manually
  const handleStopRecording = () => {
    if (stopListeningRef.current) {
      stopListeningRef.current();
      stopListeningRef.current = null;
    }
    setIsRecording(false);
  };

  // Handle retry (go back to speaking phase)
  const handleRetry = () => {
    setPronunciationScore(null);
    setCurrentPhase('speaking');
  };

  // Handle completion
  const handleComplete = () => {
    const passed = (pronunciationScore ?? 0) >= requiredScore;

    // Apply romaji penalty if revealed
    let finalScore = pronunciationScore ?? 0;
    if (romajiRevealed && finalScore > 0) {
      finalScore = Math.max(0, finalScore - 10);
    }

    onComplete({
      pronunciationScore: finalScore,
      passed,
    });
  };

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 90) return colors.mint;
    if (score >= requiredScore) return colors.mint;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  // Render progress indicator
  const renderProgress = () => {
    const phases: PracticePhase[] = ['reading', 'listening', 'speaking', 'feedback'];
    const currentIndex = phases.indexOf(currentPhase);

    return (
      <View style={styles.progressContainer}>
        {phases.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <View key={phase} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  isCompleted && styles.progressDotCompleted,
                  isCurrent && styles.progressDotCurrent,
                ]}
              >
                {isCompleted && (
                  <Ionicons name="checkmark" size={12} color={colors.white} />
                )}
              </View>
              {index < phases.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    isCompleted && styles.progressLineCompleted,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // Render phase label
  const renderPhaseLabel = () => (
    <View style={styles.phaseLabelContainer}>
      <Text style={styles.phaseNumber}>Step {getPhaseNumber()} of 4</Text>
      <Text style={styles.phaseLabel}>{getPhaseLabel()}</Text>
    </View>
  );

  // Render sentence display
  const renderSentenceDisplay = () => (
    <Animated.View
      style={[
        styles.sentenceContainer,
        {
          opacity: phaseAnimation,
          transform: [
            {
              translateY: phaseAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* Romaji toggle button */}
      <TouchableOpacity
        style={styles.romajiToggle}
        onPress={() => setShowRomaji(!showRomaji)}
      >
        <Ionicons
          name={showRomaji ? 'eye' : 'eye-off'}
          size={16}
          color={showRomaji ? colors.primary : colors.textMuted}
        />
        <Text style={[
          styles.romajiToggleText,
          showRomaji && styles.romajiToggleTextActive,
        ]}>
          {showRomaji ? 'Romaji ON' : 'Romaji OFF'}
        </Text>
      </TouchableOpacity>

      {/* Clickable word breakdown */}
      <SentenceWordBreakdown
        segments={sentence.furigana}
        showRomaji={showRomaji}
        words={sentence.words}
      />

      {/* Show romaji below when toggle is ON */}
      {showRomaji && (
        <Text style={styles.romajiBelow}>{sentence.romaji}</Text>
      )}

      {/* Translation hint */}
      <Text style={styles.translationHint}>{sentence.translation}</Text>
    </Animated.View>
  );

  // Render reading phase controls
  const renderReadingControls = () => (
    <View style={styles.controlsContainer}>
      {!romajiRevealed && readingLevel !== 'romaji' && (
        <TouchableOpacity
          style={styles.revealButton}
          onPress={handleRevealRomaji}
        >
          <Ionicons name="eye-outline" size={18} color={colors.textMuted} />
          <Text style={styles.revealButtonText}>Show Romaji (-10 pts)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleReadingComplete}
      >
        <Text style={styles.primaryButtonText}>I've Read It</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  // Render listening phase controls
  const renderListeningControls = () => (
    <View style={styles.controlsContainer}>
      <View style={styles.audioButtonsRow}>
        <TouchableOpacity
          style={[styles.audioButton, isPlaying && styles.audioButtonActive]}
          onPress={() => handlePlayAudio(false)}
          disabled={isPlaying}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color={colors.white}
          />
          <Text style={styles.audioButtonLabel}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.audioButtonSecondary}
          onPress={() => handlePlayAudio(true)}
          disabled={isPlaying}
        >
          <Ionicons name="speedometer-outline" size={24} color={colors.primary} />
          <Text style={styles.audioButtonSecondaryLabel}>Slow</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleListeningComplete}
      >
        <Text style={styles.primaryButtonText}>Ready to Speak</Text>
        <Ionicons name="mic" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  // Render speaking phase controls
  const renderSpeakingControls = () => (
    <View style={styles.controlsContainer}>
      {errorMessage && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Animated.View
        style={[
          styles.micButtonContainer,
          {
            transform: [{ scale: pulseAnimation }],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording && styles.micButtonRecording,
          ]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={40}
            color={colors.white}
          />
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.micInstruction}>
        {isRecording ? 'Listening... Tap to stop' : 'Tap to speak'}
      </Text>

      {attempts > 0 && (
        <Text style={styles.attemptCount}>Attempt {attempts + 1}</Text>
      )}
    </View>
  );

  // Render feedback phase controls
  const renderFeedbackControls = () => {
    const score = pronunciationScore ?? 0;
    const passed = score >= requiredScore;

    return (
      <View style={styles.controlsContainer}>
        {/* Score display */}
        <Animated.View
          style={[
            styles.scoreContainer,
            {
              transform: [
                {
                  scale: celebrationAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            style={[styles.scoreValue, { color: getScoreColor(score) }]}
          >
            {score}
          </Text>
          <Text style={styles.scoreLabel}>/ 100</Text>
        </Animated.View>

        {/* Feedback message */}
        <View style={styles.feedbackMessage}>
          {passed ? (
            <>
              <Ionicons name="checkmark-circle" size={24} color={colors.mint} />
              <Text style={styles.feedbackTextSuccess}>
                {score >= 90 ? 'Perfect!' : 'Great job!'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="trending-up" size={24} color={colors.warning} />
              <Text style={styles.feedbackTextRetry}>
                Keep practicing!
              </Text>
            </>
          )}
        </View>

        {romajiRevealed && (
          <Text style={styles.penaltyNote}>-10 pts for revealing romaji</Text>
        )}

        {/* Action buttons - always allow continue */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleComplete}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>

        {/* Optional retry button if score was low */}
        {!passed && (
          <TouchableOpacity
            style={styles.retryButtonSecondary}
            onPress={handleRetry}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.retryButtonSecondaryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render current phase controls
  const renderControls = () => {
    switch (currentPhase) {
      case 'reading':
        return renderReadingControls();
      case 'listening':
        return renderListeningControls();
      case 'speaking':
        return renderSpeakingControls();
      case 'feedback':
        return renderFeedbackControls();
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      {renderProgress()}

      {/* Phase label */}
      {renderPhaseLabel()}

      {/* Sentence display */}
      {renderSentenceDisplay()}

      {/* Phase-specific controls */}
      {renderControls()}

      {/* Skip button (optional) */}
      {onSkip && currentPhase !== 'feedback' && (
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },

  // Progress indicator
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotCompleted: {
    backgroundColor: colors.mint,
  },
  progressDotCurrent: {
    backgroundColor: colors.primary,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  progressLineCompleted: {
    backgroundColor: colors.mint,
  },

  // Phase label
  phaseLabelContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  phaseNumber: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  phaseLabel: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
  },

  // Sentence display
  sentenceContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  romajiText: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.navy,
    textAlign: 'center',
  },
  romajiBelow: {
    fontSize: typography.base,
    color: colors.primary,
    marginTop: spacing.md,
    fontWeight: typography.medium,
  },
  romajiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  romajiToggleText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  romajiToggleTextActive: {
    color: colors.primary,
  },
  translationHint: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Controls container
  controlsContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },

  // Reveal romaji button
  revealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  revealButtonText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },

  // Primary action button
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    minWidth: 200,
  },
  primaryButtonText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },

  // Audio buttons
  audioButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  audioButtonActive: {
    backgroundColor: colors.mint,
  },
  audioButtonLabel: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.white,
  },
  audioButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  audioButtonSecondaryLabel: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    color: colors.primary,
  },

  // Mic button
  micButtonContainer: {
    marginVertical: spacing.md,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  micButtonRecording: {
    backgroundColor: colors.error,
  },
  micInstruction: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  attemptCount: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },

  // Error message
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.error,
  },

  // Score display
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  scoreValue: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
  },
  scoreLabel: {
    fontSize: typography.lg,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },

  // Feedback message
  feedbackMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  feedbackTextSuccess: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.mint,
  },
  feedbackTextRetry: {
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  penaltyNote: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  // Retry button
  retryButton: {
    backgroundColor: colors.warning,
  },
  retryButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  retryButtonSecondaryText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },

  // Skip button
  skipButton: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  skipButtonText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});

export default ActiveSentencePractice;
