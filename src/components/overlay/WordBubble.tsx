import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Word } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { useAppStore } from '../../store';
import { getNativeTranslation } from '../../utils/nativeTranslation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_ESTIMATED_WIDTH = 150;

type BubbleState = 'new' | 'explored' | 'quizzed' | 'mastered';

interface WordBubbleProps {
  word: Word;
  position: { x: number; y: number };
  state: BubbleState;
  isActive: boolean;
  onPress: () => void;
  delay?: number;
  onPositionChange?: (wordId: string, newPosition: { x: number; y: number }) => void;
  isDragEnabled?: boolean;
}

export function WordBubble({
  word,
  position,
  state,
  isActive,
  onPress,
  delay = 0,
  onPositionChange,
  isDragEnabled = true,
}: WordBubbleProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dragScaleAnim = useRef(new Animated.Value(1)).current;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const startPosition = useRef({ x: position.x, y: position.y });

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
    if (state === 'new' && !isDragging) {
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
  }, [state, isDragging]);

  // Calculate position with drag offset
  const currentX = position.x + (dragOffset.x / SCREEN_WIDTH) * 100;
  const currentY = position.y + (dragOffset.y / SCREEN_HEIGHT) * 100;

  // Clamp position to keep bubble visible
  const clampedY = Math.max(8, Math.min(75, currentY));
  const pixelX = (currentX / 100) * SCREEN_WIDTH;
  const halfBubble = BUBBLE_ESTIMATED_WIDTH / 2;
  const minX = halfBubble + 10;
  const maxX = SCREEN_WIDTH - halfBubble - 10;
  const clampedPixelX = Math.max(minX, Math.min(maxX, pixelX));
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

  // Long press gesture to initiate drag
  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .enabled(isDragEnabled && !!onPositionChange)
    .onStart(() => {
      'worklet';
      startPosition.current = { x: position.x, y: position.y };
    })
    .runOnJS(true)
    .onEnd(() => {
      setIsDragging(true);
      Animated.spring(dragScaleAnim, {
        toValue: 1.1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .enabled(isDragging)
    .onUpdate((event) => {
      setDragOffset({
        x: event.translationX,
        y: event.translationY,
      });
    })
    .onEnd((event) => {
      // Calculate final position in percentage
      const newX = Math.max(10, Math.min(90,
        startPosition.current.x + (event.translationX / SCREEN_WIDTH) * 100
      ));
      const newY = Math.max(8, Math.min(75,
        startPosition.current.y + (event.translationY / SCREEN_HEIGHT) * 100
      ));

      // Save the new position
      if (onPositionChange) {
        onPositionChange(word.id, { x: newX, y: newY });
      }

      // Reset drag state
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      Animated.spring(dragScaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    })
    .runOnJS(true);

  // Tap gesture for press
  const tapGesture = Gesture.Tap()
    .enabled(!isDragging)
    .onEnd(() => {
      onPress();
    })
    .runOnJS(true);

  // Combine gestures
  const composedGesture = Gesture.Race(
    Gesture.Simultaneous(longPressGesture, panGesture),
    tapGesture
  );

  const bubbleContent = (
    <Animated.View
      style={[
        styles.container,
        {
          left: `${clampedX}%`,
          top: `${clampedY}%`,
          transform: [
            { translateX: -BUBBLE_ESTIMATED_WIDTH / 2 },
            { translateY: -25 },
            { scale: Animated.multiply(Animated.multiply(scaleAnim, pulseAnim), dragScaleAnim) },
          ],
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColors.bg,
            borderColor: isDragging ? colors.primary : bubbleColors.border,
          },
          isActive && styles.bubbleActive,
          isDragging && styles.bubbleDragging,
        ]}
      >
        <Text style={[styles.japanese, { color: bubbleColors.text }]}>
          {word.japanese || word.romaji || word.reading}
        </Text>

        {!isCompleted && (word.japanese || word.romaji) !== nativeMeaning && (
          <Text style={styles.english}>{nativeMeaning}</Text>
        )}

        {isCompleted && (
          <View style={styles.completedIcon}>
            <Ionicons
              name={state === 'mastered' ? 'star' : 'checkmark'}
              size={10}
              color={colors.white}
            />
          </View>
        )}

        {isDragging && (
          <View style={styles.dragIndicator}>
            <Ionicons name="move" size={12} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={[
        styles.pointer,
        { borderTopColor: isDragging ? colors.primary : bubbleColors.border },
      ]} />
    </Animated.View>
  );

  // If drag is enabled, wrap with gesture detector
  if (isDragEnabled && onPositionChange) {
    return (
      <GestureDetector gesture={composedGesture}>
        {bubbleContent}
      </GestureDetector>
    );
  }

  // Fallback to simple touchable
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      {bubbleContent}
    </TouchableOpacity>
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
  bubbleDragging: {
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
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
  dragIndicator: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
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
