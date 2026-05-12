import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ScrollView,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store';
import { colors, spacing, borderRadius, typography, shadows } from '../../src/constants/design';
import { PhotoLesson, MasteryLevel, Word, XP_REWARDS, MemoryStatus, getMemoryStatus } from '../../src/types';
import {
  isSpeechRecognitionAvailable,
  startListening,
  checkJapanesePronunciation,
} from '../../src/utils/speechRecognition';
import { speakJapanese, loadJapaneseVoice } from '../../src/utils/speech';
import { resolveImageUri } from '../../src/utils/photoStorage';

type SpeakingState = {
  wordId: string;
  status: 'listening' | 'success' | 'retry';
  feedback: string;
};

const MASTERY_COLORS: Record<MasteryLevel, string> = {
  new: colors.masteryNew,
  learning: colors.masteryLearning,
  familiar: colors.masteryFamiliar,
  mastered: colors.masteryMastered,
};

const MEMORY_COLORS: Record<MemoryStatus, string> = {
  fresh: '#10B981',    // Green - just reviewed
  strong: '#3B82F6',   // Blue - solid memory
  fading: '#F59E0B',   // Amber - needs review soon
  weak: '#EF4444',     // Red - review urgently
  forgotten: '#6B7280', // Gray - needs relearning
};

export default function CollectionScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: string }>();
  const {
    lessons,
    setCurrentLesson,
    startQuiz,
    getWordsToReview,
    getReviewCount,
    startReviewQuiz,
    reviewMemory,
    stats,
    addXP,
  } = useAppStore();

  // Filter lessons by category if provided
  const filteredLessons = category
    ? lessons.filter(lesson => lesson.category === category)
    : lessons;

  const [selectedLesson, setSelectedLesson] = useState<PhotoLesson | null>(null);
  const [speakingState, setSpeakingState] = useState<SpeakingState | null>(null);
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [canUseSpeechRecognition, setCanUseSpeechRecognition] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const reviewCount = getReviewCount();
  const wordsToReview = getWordsToReview();

  // Check speech recognition availability
  useEffect(() => {
    setCanUseSpeechRecognition(isSpeechRecognitionAvailable());
  }, []);

  // Pulse animation when listening
  useEffect(() => {
    if (speakingState?.status === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [speakingState?.status]);

  // Cleanup on unmount or modal close
  useEffect(() => {
    if (!selectedLesson) {
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
      setSpeakingState(null);
    }
  }, [selectedLesson]);

  const handleLessonPress = (lesson: PhotoLesson) => {
    setSelectedLesson(lesson);
    setSpokenWords(new Set()); // Reset spoken words for this session
  };

  const handleStartQuiz = () => {
    if (!selectedLesson) return;
    setCurrentLesson(selectedLesson);
    startQuiz(selectedLesson.words, selectedLesson.imageUri);
    reviewMemory(selectedLesson.id); // Boost memory strength on review
    setSelectedLesson(null);
    router.push('/quiz');
  };

  const handleStartReview = () => {
    startReviewQuiz();
    router.push('/quiz');
  };

  // Load voice on mount
  useEffect(() => {
    loadJapaneseVoice();
  }, []);

  const speakWord = async (word: Word) => {
    // Use hiragana reading for accurate pronunciation
    await speakJapanese(word.reading || word.japanese);
  };

  const handleStartSpeaking = (word: Word) => {
    // Stop any existing listening
    if (stopListeningRef.current) {
      stopListeningRef.current();
    }

    if (!canUseSpeechRecognition) {
      handleFallbackSpeak(word);
      return;
    }

    setSpeakingState({ wordId: word.id, status: 'listening', feedback: 'Listening...' });

    stopListeningRef.current = startListening('ja-JP', {
      onResult: (transcript) => {
        if (__DEV__) console.log('Heard:', transcript);
        const { score, feedback } = checkJapanesePronunciation(
          transcript,
          word.japanese,
          word.romaji
        );

        if (score >= 60) {
          setSpeakingState({ wordId: word.id, status: 'success', feedback: 'Perfect!' });
          setSpokenWords((prev) => new Set([...prev, word.id]));
          addXP({ type: 'speak', amount: XP_REWARDS.speakWord, description: 'Word spoken!' });

          setTimeout(() => {
            setSpeakingState(null);
          }, 1500);
        } else {
          setSpeakingState({ wordId: word.id, status: 'retry', feedback });
        }
      },
      onError: (error) => {
        if (__DEV__) console.log('Speech recognition error:', error);
        setSpeakingState({ wordId: word.id, status: 'retry', feedback: error });
      },
      onEnd: () => {
        setSpeakingState((prev) => {
          if (prev?.status === 'listening') {
            return { ...prev, status: 'retry', feedback: 'No speech detected. Try again.' };
          }
          return prev;
        });
      },
    });
  };

  const handleFallbackSpeak = async (word: Word) => {
    setSpeakingState({ wordId: word.id, status: 'listening', feedback: 'Say the word...' });
    await speakWord(word);

    setTimeout(() => {
      setSpeakingState({ wordId: word.id, status: 'success', feedback: 'Great effort!' });
      setSpokenWords((prev) => new Set([...prev, word.id]));
      addXP({ type: 'speak', amount: XP_REWARDS.speakWord, description: 'Word spoken!' });

      setTimeout(() => {
        setSpeakingState(null);
      }, 1200);
    }, 2000);
  };

  // Calculate mastery stats
  const allWords = filteredLessons.flatMap((l) => l.words);
  const masteredCount = allWords.filter((w) => w.mastery === 'mastered').length;
  const learningCount = allWords.filter((w) => w.mastery === 'learning' || w.mastery === 'familiar').length;
  const newCount = allWords.filter((w) => w.mastery === 'new').length;

  const getLessonMastery = (lesson: PhotoLesson) => {
    if (lesson.words.length === 0) return 0;
    const total = lesson.words.reduce((sum, w) => sum + w.masteryScore, 0);
    return Math.round(total / lesson.words.length);
  };

  const getLessonDueCount = (lesson: PhotoLesson) => {
    const today = new Date().toISOString().split('T')[0];
    return lesson.words.filter((w) => !w.nextReview || w.nextReview <= today).length;
  };

  const renderLesson = ({ item }: { item: PhotoLesson }) => {
    const mastery = getLessonMastery(item);
    const dueCount = getLessonDueCount(item);
    const hasDue = dueCount > 0;
    const memoryStrength = item.memoryStrength ?? 100;
    const memoryStatus = item.memoryStatus ?? getMemoryStatus(memoryStrength);
    const isFading = memoryStatus === 'fading' || memoryStatus === 'weak' || memoryStatus === 'forgotten';
    const fadeOpacity = memoryStrength / 100;

    return (
      <TouchableOpacity
        style={[styles.lessonCard, isFading && styles.lessonCardFading]}
        onPress={() => handleLessonPress(item)}
      >
        <Image
          source={{ uri: resolveImageUri(item.imageUri) }}
          style={[styles.lessonImage, { opacity: 0.3 + (fadeOpacity * 0.7) }]}
        />

        {/* Memory Strength Indicator */}
        <View style={styles.memoryIndicator}>
          <View
            style={[
              styles.memoryIndicatorFill,
              { backgroundColor: MEMORY_COLORS[memoryStatus] },
            ]}
          >
            <Ionicons
              name={memoryStatus === 'fresh' ? 'sparkles' : memoryStatus === 'forgotten' ? 'help' : 'flame'}
              size={12}
              color="#fff"
            />
          </View>
        </View>

        {/* Needs Review Badge */}
        {isFading && (
          <View style={[styles.dueBadge, { backgroundColor: MEMORY_COLORS[memoryStatus] }]}>
            <Ionicons name="refresh" size={10} color="#fff" />
          </View>
        )}

        {/* Info */}
        <View style={styles.lessonInfo}>
          <Text style={styles.lessonWords}>{item.words.length} words</Text>
          {isFading && (
            <Text style={[styles.lessonStatus, { color: MEMORY_COLORS[memoryStatus] }]}>
              {memoryStatus === 'forgotten' ? 'Forgotten' : 'Fading'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (filteredLessons.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>{category ? 'No photos in this collection' : 'Your Word Map is Empty'}</Text>
        <Text style={styles.emptySubtitle}>
          {category
            ? 'Take photos in this category to add words'
            : "Take your first photo to start building\nYOUR vocabulary from YOUR life"}
        </Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => category ? router.back() : router.push('/(tabs)')}>
          <Ionicons name={category ? 'arrow-back' : 'camera'} size={20} color={colors.white} />
          <Text style={styles.emptyButtonText}>{category ? 'Go Back' : 'Take a Photo'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Lesson Detail Modal */}
      <Modal
        visible={!!selectedLesson}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedLesson(null)}
      >
        {selectedLesson && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Photo Header */}
              <View style={styles.modalPhotoHeader}>
                <Image
                  source={{ uri: resolveImageUri(selectedLesson.imageUri) }}
                  style={styles.modalPhoto}
                />
                <View style={styles.modalPhotoOverlay}>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setSelectedLesson(null)}
                  >
                    <Ionicons name="close" size={24} color={colors.white} />
                  </TouchableOpacity>
                  <View style={styles.modalPhotoInfo}>
                    <Text style={styles.modalLocation}>
                      {selectedLesson.location || 'Your Photo'}
                    </Text>
                    <Text style={styles.modalWordCount}>
                      {selectedLesson.words.length} words
                    </Text>
                  </View>
                </View>
              </View>

              {/* Words List */}
              <ScrollView style={styles.modalWordsList}>
                <View style={styles.modalSectionHeader}>
                  <Text style={styles.modalSectionTitle}>Words from this photo</Text>
                  {spokenWords.size > 0 && (
                    <Text style={styles.spokenProgress}>
                      {spokenWords.size}/{selectedLesson.words.length} spoken
                    </Text>
                  )}
                </View>
                {selectedLesson.words.map((word) => {
                  const isActive = speakingState?.wordId === word.id;
                  const hasSpoken = spokenWords.has(word.id);

                  return (
                    <View
                      key={word.id}
                      style={[
                        styles.modalWordRow,
                        hasSpoken && styles.modalWordRowSpoken,
                        isActive && styles.modalWordRowActive,
                      ]}
                    >
                      {/* Mini photo thumbnail */}
                      <Image
                        source={{ uri: resolveImageUri(selectedLesson.imageUri) }}
                        style={styles.modalWordThumb}
                      />
                      <View style={styles.modalWordInfo}>
                        <View style={styles.modalWordMain}>
                          <Text style={styles.modalWordJapanese}>{word.japanese}</Text>
                          <Text style={styles.modalWordRomaji}>{word.romaji}</Text>
                        </View>
                        <Text style={styles.modalWordEnglish}>{word.english}</Text>

                        {/* Feedback when speaking this word */}
                        {isActive && speakingState && (
                          <View style={[
                            styles.wordFeedback,
                            speakingState.status === 'success' && styles.wordFeedbackSuccess,
                            speakingState.status === 'retry' && styles.wordFeedbackRetry,
                          ]}>
                            {speakingState.status === 'listening' && (
                              <ActivityIndicator size="small" color={colors.primary} />
                            )}
                            {speakingState.status === 'success' && (
                              <Ionicons name="checkmark-circle" size={14} color={colors.mint} />
                            )}
                            {speakingState.status === 'retry' && (
                              <Ionicons name="refresh" size={14} color={colors.warning} />
                            )}
                            <Text style={[
                              styles.wordFeedbackText,
                              speakingState.status === 'success' && { color: colors.mint },
                            ]}>
                              {speakingState.feedback}
                            </Text>
                          </View>
                        )}

                        {/* Mastery status (only show when not active) */}
                        {!isActive && (
                          <View style={styles.modalWordMastery}>
                            <View
                              style={[
                                styles.masteryDot,
                                { backgroundColor: MASTERY_COLORS[word.mastery] },
                              ]}
                            />
                            <Text style={styles.masteryLabel}>{word.mastery}</Text>
                            {hasSpoken && (
                              <View style={styles.spokenBadge}>
                                <Ionicons name="checkmark" size={10} color={colors.white} />
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Action buttons */}
                      <View style={styles.wordActions}>
                        {/* Listen button */}
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => speakWord(word)}
                        >
                          <Ionicons name="volume-high" size={18} color={colors.primary} />
                        </TouchableOpacity>

                        {/* Mic button */}
                        {isActive && speakingState?.status === 'listening' ? (
                          <Animated.View style={[
                            styles.actionButton,
                            styles.micButtonActive,
                            { transform: [{ scale: pulseAnim }] }
                          ]}>
                            <ActivityIndicator size="small" color={colors.white} />
                          </Animated.View>
                        ) : isActive && speakingState?.status === 'retry' ? (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.micButtonRetry]}
                            onPress={() => handleStartSpeaking(word)}
                          >
                            <Ionicons name="refresh" size={18} color={colors.white} />
                          </TouchableOpacity>
                        ) : hasSpoken ? (
                          <View style={[styles.actionButton, styles.micButtonDone]}>
                            <Ionicons name="checkmark" size={18} color={colors.white} />
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.micButton]}
                            onPress={() => handleStartSpeaking(word)}
                          >
                            <Ionicons name="mic" size={18} color={colors.white} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                {/* Speaking progress summary */}
                {spokenWords.size > 0 && (
                  <View style={styles.speakingSummary}>
                    <Ionicons name="mic" size={16} color={colors.mint} />
                    <Text style={styles.speakingSummaryText}>
                      {spokenWords.size} of {selectedLesson.words.length} words spoken this session
                    </Text>
                  </View>
                )}

                <View style={styles.actionButtonsRow}>
                  {/* Quiz button */}
                  <TouchableOpacity
                    style={styles.modalQuizButton}
                    onPress={handleStartQuiz}
                  >
                    <Ionicons name="school" size={20} color={colors.white} />
                    <Text style={styles.modalQuizButtonText}>Quiz</Text>
                  </TouchableOpacity>

                  {/* Re-learn / Practice Speaking button */}
                  <TouchableOpacity
                    style={styles.modalSpeakPracticeButton}
                    onPress={() => {
                      if (!selectedLesson) return;
                      setCurrentLesson(selectedLesson);
                      setSelectedLesson(null);
                      router.push('/learn');
                    }}
                  >
                    <Ionicons name="mic" size={20} color={colors.primary} />
                    <Text style={styles.modalSpeakPracticeText}>Speak</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Stats Overview */}
      <View style={styles.statsOverview}>
        <Text style={styles.statsTitle}>Your Word Map</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.masteryMastered }]}>{masteredCount}</Text>
            <Text style={styles.statLabel}>mastered</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.masteryLearning }]}>{learningCount}</Text>
            <Text style={styles.statLabel}>learning</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.masteryNew }]}>{newCount}</Text>
            <Text style={styles.statLabel}>new</Text>
          </View>
        </View>
        <View style={styles.masteryBar}>
          {masteredCount > 0 && (
            <View
              style={[
                styles.masteryBarSegment,
                {
                  backgroundColor: colors.masteryMastered,
                  flex: masteredCount,
                },
              ]}
            />
          )}
          {learningCount > 0 && (
            <View
              style={[
                styles.masteryBarSegment,
                {
                  backgroundColor: colors.masteryLearning,
                  flex: learningCount,
                },
              ]}
            />
          )}
          {newCount > 0 && (
            <View
              style={[
                styles.masteryBarSegment,
                {
                  backgroundColor: colors.masteryNew,
                  flex: newCount,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Review Section */}
      {reviewCount > 0 && (
        <View style={styles.reviewSection}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewHeaderLeft}>
              <Ionicons name="flash" size={20} color={colors.primary} />
              <Text style={styles.reviewTitle}>Words need you!</Text>
            </View>
            <View style={styles.reviewCount}>
              <Text style={styles.reviewCountText}>{reviewCount}</Text>
            </View>
          </View>

          {/* Word Preview */}
          <View style={styles.reviewPreview}>
            {wordsToReview.slice(0, 5).map((item, idx) => (
              <View key={`${item.word.id}-${idx}`} style={styles.reviewWordChip}>
                <Text style={styles.reviewWordText}>{item.word.japanese}</Text>
              </View>
            ))}
            {reviewCount > 5 && (
              <View style={styles.reviewWordChip}>
                <Text style={styles.reviewWordText}>+{reviewCount - 5}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.reviewButton} onPress={handleStartReview}>
            <Ionicons name="school" size={20} color={colors.white} />
            <Text style={styles.reviewButtonText}>Review All ({reviewCount})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Review Banner */}
      {lessons.filter(l => (l.memoryStrength ?? 100) < 50).length > 0 && (
        <TouchableOpacity
          style={styles.quickReviewBanner}
          onPress={() => router.push('/quick-review')}
        >
          <View style={styles.quickReviewLeft}>
            <Ionicons name="flash" size={20} color="#F59E0B" />
            <Text style={styles.quickReviewText}>
              {lessons.filter(l => (l.memoryStrength ?? 100) < 50).length} memories fading
            </Text>
          </View>
          <View style={styles.quickReviewButton}>
            <Text style={styles.quickReviewButtonText}>Quick Review</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.white} />
          </View>
        </TouchableOpacity>
      )}

      {/* All Photos */}
      <View style={styles.allSection}>
        <View style={styles.sectionHeader}>
          {category && (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={[styles.sectionTitle, category && { paddingHorizontal: 0 }]}>
            {category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Collection` : 'Memory Palace'} ({filteredLessons.length})
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Fresh</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>Strong</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Fading</Text>
          </View>
        </View>

        <FlatList
          data={filteredLessons}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          renderItem={renderLesson}
          scrollEnabled={false}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Stats Overview
  statsOverview: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    ...shadows.sm,
  },
  statsTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  masteryBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  masteryBarSegment: {
    height: '100%',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.navy,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },

  // Review Section
  reviewSection: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.navy,
  },
  reviewCount: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  reviewCountText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  reviewPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reviewWordChip: {
    backgroundColor: colors.navyLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  reviewWordText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  reviewButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.bold,
  },

  // All Section
  allSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.navy,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backButton: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickReviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  quickReviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickReviewText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: '#92400E',
  },
  quickReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  quickReviewButtonText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.white,
  },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  grid: {
    paddingHorizontal: spacing.sm,
  },

  // Lesson Card
  lessonCard: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  lessonCardDue: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  lessonCardFading: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  lessonImage: {
    width: '100%',
    height: '100%',
  },
  lessonInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
    padding: spacing.xs,
  },
  lessonWords: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  lessonStatus: {
    fontSize: 9,
    fontWeight: typography.semibold,
    textAlign: 'center',
    marginTop: 2,
  },

  // Memory Indicator
  memoryIndicator: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  memoryIndicatorFill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  // Mastery Ring
  masteryRing: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  masteryRingFill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  masteryRingText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.bold,
  },

  // Due Badge
  dueBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueBadgeText: {
    color: colors.white,
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalPhotoHeader: {
    height: 200,
    position: 'relative',
  },
  modalPhoto: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  modalPhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: borderRadius.full,
  },
  modalPhotoInfo: {
    alignItems: 'flex-start',
  },
  modalLocation: {
    color: colors.white,
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  modalWordCount: {
    color: colors.white,
    fontSize: typography.base,
    opacity: 0.9,
  },
  modalWordsList: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalSectionTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  spokenProgress: {
    fontSize: typography.sm,
    color: colors.mint,
    fontWeight: typography.semibold,
  },
  modalWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  modalWordRowSpoken: {
    backgroundColor: 'rgba(78, 205, 196, 0.08)',
    borderColor: colors.mint,
  },
  modalWordRowActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  modalWordThumb: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  modalWordInfo: {
    flex: 1,
  },
  modalWordMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  modalWordJapanese: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.navy,
  },
  modalWordRomaji: {
    fontSize: typography.sm,
    color: colors.primary,
  },
  modalWordEnglish: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalWordMastery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  masteryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  masteryLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  spokenBadge: {
    backgroundColor: colors.mint,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  // Word feedback
  wordFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.navyLight,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  wordFeedbackSuccess: {
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
  },
  wordFeedbackRetry: {
    backgroundColor: 'rgba(255, 179, 71, 0.2)',
  },
  wordFeedbackText: {
    fontSize: typography.xs,
    color: colors.navy,
    fontWeight: typography.medium,
  },

  // Word actions
  wordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  micButton: {
    backgroundColor: colors.primary,
  },
  micButtonActive: {
    backgroundColor: colors.mint,
  },
  micButtonRetry: {
    backgroundColor: colors.warning,
  },
  micButtonDone: {
    backgroundColor: colors.mint,
  },
  modalActions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  speakingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: borderRadius.md,
  },
  speakingSummaryText: {
    color: colors.mint,
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalQuizButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  modalQuizButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: typography.bold,
  },
  modalSpeakPracticeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  modalSpeakPracticeText: {
    color: colors.primary,
    fontSize: typography.base,
    fontWeight: typography.bold,
  },
});
