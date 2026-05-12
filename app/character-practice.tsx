import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../src/constants/design';
import {
  Character,
  CharacterSet,
  getCharactersBySet,
  HIRAGANA,
  KATAKANA,
  BASIC_KANJI,
} from '../src/data/characters';
import { useAppStore } from '../src/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_SIZE = SCREEN_WIDTH - spacing.lg * 2;
const STROKE_WIDTH = 12;

type Point = { x: number; y: number };
type Stroke = Point[];

export default function CharacterPracticeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addXP } = useAppStore();

  // State
  const [selectedSet, setSelectedSet] = useState<CharacterSet>('hiragana');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [showGuide, setShowGuide] = useState(true);
  const [practiced, setPracticed] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);

  const feedbackAnim = useRef(new Animated.Value(0)).current;

  // Refs for tracking strokes (avoid stale closure issues)
  const currentStrokeRef = useRef<Stroke>([]);
  const strokesRef = useRef<Stroke[]>([]);

  // Keep strokesRef in sync with state
  strokesRef.current = strokes;

  const characters = getCharactersBySet(selectedSet);
  const currentCharacter = characters[currentIndex];

  // Handle touch events directly
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    currentStrokeRef.current = [{ x: locationX, y: locationY }];
    setCurrentStroke([{ x: locationX, y: locationY }]);
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    currentStrokeRef.current.push({ x: locationX, y: locationY });
    setCurrentStroke([...currentStrokeRef.current]);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentStrokeRef.current.length > 1) {
      const newStroke = [...currentStrokeRef.current];
      setStrokes([...strokesRef.current, newStroke]);
    }
    currentStrokeRef.current = [];
    setCurrentStroke([]);
  }, []);

  // Convert stroke to SVG path
  const strokeToPath = (stroke: Stroke): string => {
    if (stroke.length < 2) return '';
    let path = `M ${stroke[0].x} ${stroke[0].y}`;
    for (let i = 1; i < stroke.length; i++) {
      path += ` L ${stroke[i].x} ${stroke[i].y}`;
    }
    return path;
  };

  // Clear canvas
  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
    strokesRef.current = [];
    setFeedback(null);
  }, []);

  // Undo last stroke
  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  // Check drawing (simple validation - just checks if user drew something)
  const handleCheck = () => {
    if (strokes.length === 0) {
      showFeedback('Draw the character first!', false);
      return;
    }

    // Basic validation: check if enough strokes
    const expectedStrokes = currentCharacter.strokeCount;
    const drawnStrokes = strokes.length;

    let isGood = false;
    let message = '';

    if (drawnStrokes === expectedStrokes) {
      isGood = true;
      message = 'Perfect stroke count!';
    } else if (drawnStrokes >= expectedStrokes - 1 && drawnStrokes <= expectedStrokes + 1) {
      isGood = true;
      message = 'Good effort!';
    } else if (drawnStrokes < expectedStrokes) {
      message = `Need more strokes (${drawnStrokes}/${expectedStrokes})`;
    } else {
      message = `Too many strokes (${drawnStrokes}/${expectedStrokes})`;
    }

    showFeedback(message, isGood);

    if (isGood) {
      // Mark as practiced
      setPracticed((prev) => new Set([...prev, currentCharacter.id]));
      addXP({ type: 'reading', amount: 5, description: `Practiced ${currentCharacter.character}` });
    }
  };

  // Show feedback animation
  const showFeedback = (message: string, success: boolean) => {
    setFeedback(message);
    feedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(feedbackAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setFeedback(null));
  };

  // Navigate to next character
  const handleNext = () => {
    handleClear();
    setCurrentIndex((prev) => (prev + 1) % characters.length);
  };

  // Navigate to previous character
  const handlePrevious = () => {
    handleClear();
    setCurrentIndex((prev) => (prev - 1 + characters.length) % characters.length);
  };

  // Switch character set
  const handleSetChange = (set: CharacterSet) => {
    setSelectedSet(set);
    setCurrentIndex(0);
    handleClear();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Character Practice</Text>
        <TouchableOpacity
          onPress={() => setShowGuide(!showGuide)}
          style={styles.guideToggle}
        >
          <Ionicons
            name={showGuide ? 'eye' : 'eye-off'}
            size={20}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>

      {/* Character Set Selector */}
      <View style={styles.setSelector}>
        {(['hiragana', 'katakana', 'kanji'] as CharacterSet[]).map((set) => (
          <TouchableOpacity
            key={set}
            style={[styles.setButton, selectedSet === set && styles.setButtonActive]}
            onPress={() => handleSetChange(set)}
          >
            <Text
              style={[
                styles.setButtonText,
                selectedSet === set && styles.setButtonTextActive,
              ]}
            >
              {set.charAt(0).toUpperCase() + set.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {characters.length}
        </Text>
        <Text style={styles.practicedText}>
          {practiced.size} practiced this session
        </Text>
      </View>

      {/* Character Display */}
      <View style={styles.characterInfo}>
        <Text style={styles.romaji}>{currentCharacter.romaji}</Text>
        {currentCharacter.meaning && (
          <Text style={styles.meaning}>({currentCharacter.meaning})</Text>
        )}
        <Text style={styles.strokeInfo}>
          {currentCharacter.strokeCount} stroke{currentCharacter.strokeCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Drawing Canvas */}
      <View style={styles.canvasContainer}>
        {/* Guide Character (background) */}
        {showGuide && (
          <Text style={styles.guideCharacter}>{currentCharacter.character}</Text>
        )}

        {/* Drawing Surface */}
        <View
          style={styles.canvas}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTouchStart}
          onResponderMove={handleTouchMove}
          onResponderRelease={handleTouchEnd}
          onResponderTerminate={handleTouchEnd}
        >
          <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={styles.svgCanvas}>
            {/* Grid lines */}
            <Path
              d={`M ${CANVAS_SIZE / 2} 0 V ${CANVAS_SIZE}`}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
              strokeDasharray="5,5"
            />
            <Path
              d={`M 0 ${CANVAS_SIZE / 2} H ${CANVAS_SIZE}`}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
              strokeDasharray="5,5"
            />

            {/* Completed strokes */}
            {strokes.map((stroke, idx) => (
              <Path
                key={idx}
                d={strokeToPath(stroke)}
                stroke={colors.primary}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}

            {/* Current stroke */}
            {currentStroke.length > 0 && (
              <Path
                d={strokeToPath(currentStroke)}
                stroke={colors.mint}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </Svg>
        </View>

        {/* Feedback Overlay */}
        {feedback && (
          <Animated.View
            style={[
              styles.feedbackOverlay,
              {
                opacity: feedbackAnim,
                transform: [
                  {
                    scale: feedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.feedbackText}>{feedback}</Text>
          </Animated.View>
        )}
      </View>

      {/* Stroke Counter */}
      <View style={styles.strokeCounter}>
        <Text style={styles.strokeCounterText}>
          {strokes.length} / {currentCharacter.strokeCount} strokes
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleClear}>
          <Ionicons name="trash-outline" size={20} color={colors.white} />
          <Text style={styles.controlText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, strokes.length === 0 && styles.controlButtonDisabled]}
          onPress={handleUndo}
          disabled={strokes.length === 0}
        >
          <Ionicons name="arrow-undo" size={20} color={strokes.length === 0 ? colors.textMuted : colors.white} />
          <Text style={[styles.controlText, strokes.length === 0 && styles.controlTextDisabled]}>Undo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.checkButton]}
          onPress={handleCheck}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={styles.controlText}>Check</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity style={styles.navButton} onPress={handlePrevious}>
          <Ionicons name="chevron-back" size={28} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.bigCharacter}>{currentCharacter.character}</Text>
          {practiced.has(currentCharacter.id) && (
            <View style={styles.practicedBadge}>
              <Ionicons name="checkmark" size={12} color={colors.white} />
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.navButton} onPress={handleNext}>
          <Ionicons name="chevron-forward" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Character Grid (quick select) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.characterGrid}
        contentContainerStyle={styles.characterGridContent}
      >
        {characters.slice(0, 20).map((char, idx) => (
          <TouchableOpacity
            key={char.id}
            style={[
              styles.gridChar,
              currentIndex === idx && styles.gridCharActive,
              practiced.has(char.id) && styles.gridCharPracticed,
            ]}
            onPress={() => {
              setCurrentIndex(idx);
              handleClear();
            }}
          >
            <Text
              style={[
                styles.gridCharText,
                currentIndex === idx && styles.gridCharTextActive,
              ]}
            >
              {char.character}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    color: colors.white,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  guideToggle: {
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
  },

  // Set Selector
  setSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  setButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
  },
  setButtonActive: {
    backgroundColor: colors.primary,
  },
  setButtonText: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  setButtonTextActive: {
    color: colors.white,
  },

  // Progress
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
  practicedText: {
    color: colors.mint,
    fontSize: typography.sm,
  },

  // Character Info
  characterInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  romaji: {
    color: colors.white,
    fontSize: typography.xl,
    fontWeight: '700',
  },
  meaning: {
    color: colors.textMuted,
    fontSize: typography.sm,
    marginTop: 2,
  },
  strokeInfo: {
    color: colors.primary,
    fontSize: typography.xs,
    marginTop: spacing.xs,
  },

  // Canvas
  canvasContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    position: 'relative',
  },
  guideCharacter: {
    position: 'absolute',
    fontSize: CANVAS_SIZE * 0.7,
    color: 'rgba(255,255,255,0.08)',
    fontWeight: '300',
  },
  canvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  svgCanvas: {
    backgroundColor: 'transparent',
  },
  feedbackOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(26,26,46,0.9)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  feedbackText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '600',
  },

  // Stroke Counter
  strokeCounter: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  strokeCounterText: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.md,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  checkButton: {
    backgroundColor: colors.mint,
  },
  controlText: {
    color: colors.white,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  controlTextDisabled: {
    color: colors.textMuted,
  },

  // Navigation
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  navButton: {
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.full,
  },
  navCenter: {
    alignItems: 'center',
    position: 'relative',
  },
  bigCharacter: {
    fontSize: 60,
    color: colors.white,
    fontWeight: '300',
  },
  practicedBadge: {
    position: 'absolute',
    top: -4,
    right: -12,
    backgroundColor: colors.mint,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Character Grid
  characterGrid: {
    maxHeight: 60,
    marginTop: spacing.sm,
  },
  characterGridContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  gridChar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  gridCharActive: {
    backgroundColor: colors.primary,
  },
  gridCharPracticed: {
    borderWidth: 2,
    borderColor: colors.mint,
  },
  gridCharText: {
    fontSize: typography.lg,
    color: colors.textMuted,
  },
  gridCharTextActive: {
    color: colors.white,
  },
});
