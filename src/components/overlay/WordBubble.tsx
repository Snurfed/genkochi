import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Word } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { useAppStore } from '../../store';
import { getNativeTranslation } from '../../utils/nativeTranslation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUBBLE_ESTIMATED_WIDTH = 150; // Estimated max bubble width for longer words

type BubbleState = 'new' | 'explored' | 'quizzed' | 'mastered';

interface WordBubbleProps {
  word: Word;
  position: { x: number; y: number };
  state: BubbleState;
  isActive: boolean;
  onPress: () => void;
  delay?: number;
}

/**
 * WordBubble - Clean, minimal word overlay on photo
 * Shows target language word with native language hint below
 */
export function WordBubble({
  word,
  position,
  state,
  isActive,
  onPress,
  delay = 0,
}: WordBubbleProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Get native language for translation (NOT English unless native IS English)
  const { nativeLanguage } = useAppStore();
  const nativeMeaning = getNativeTranslation(word, nativeLanguage);

  // Entrance animation
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  // Subtle pulse for new words
  useEffect(() => {
    if (state === 'new') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Clamp Y to keep bubble visible
  const clampedY = Math.max(8, Math.min(75, position.y));

  // Convert position to pixels and calculate safe positioning
  const pixelX = (position.x / 100) * SCREEN_WIDTH;

  // Calculate how much to offset to keep bubble centered but on screen
  const halfBubble = BUBBLE_ESTIMATED_WIDTH / 2;
  const minX = halfBubble + 10; // 10px padding from left edge
  const maxX = SCREEN_WIDTH - halfBubble - 10; // 10px padding from right edge

  // Clamp the pixel position
  const clampedPixelX = Math.max(minX, Math.min(maxX, pixelX));

  // Convert back to percentage for positioning
  const clampedX = (clampedPixelX / SCREEN_WIDTH) * 100;

  const getBubbleColors = () => {
    switch (state) {
      case 'mastered':
        return { bg: colors.xp, border: colors.xp, text: colors.white };
      case 'quizzed':
        return { bg: colors.mint, border: colors.mint, text: colors.white };
      case 'explored':
        return { bg: 'rgba(255,255,255,0.95)', border: colors.textMuted, text: colors.navy };
      default:
        return { bg: 'rgba(255,255,255,0.98)', border: colors.primary, text: colors.navy };
    }
  };

  const bubbleColors = getBubbleColors();
  const isCompleted = state === 'quizzed' || state === 'mastered';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: `${clampedX}%`,
          top: `${clampedY}%`,
          transform: [
            { translateX: -BUBBLE_ESTIMATED_WIDTH / 2 },
            { translateY: -25 },
            { scale: Animated.multiply(scaleAnim, pulseAnim) },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColors.bg,
            borderColor: bubbleColors.border,
          },
          isActive && styles.bubbleActive,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Main target language text */}
        <Text
          style={[styles.japanese, { color: bubbleColors.text }]}
        >
          {word.japanese || word.romaji || word.reading}
        </Text>

        {/* Native language hint - only show for new/explored */}
        {!isCompleted && (word.japanese || word.romaji) !== nativeMeaning && (
          <Text style={styles.english}>
            {nativeMeaning}
          </Text>
        )}

        {/* Completion indicator */}
        {isCompleted && (
          <View style={styles.completedIcon}>
            <Ionicons
              name={state === 'mastered' ? 'star' : 'checkmark'}
              size={10}
              color={colors.white}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Pointer/arrow pointing down to object */}
      <View style={[
        styles.pointer,
        { borderTopColor: bubbleColors.border },
      ]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleActive: {
    borderWidth: 3,
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  japanese: {
    fontSize: 18,
    fontWeight: '700',
  },
  english: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  completedIcon: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'inherit',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

export default WordBubble;
