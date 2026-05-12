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
import { Word, WordDescriptor } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';

type WordState = 'new' | 'explored' | 'quizzed' | 'mastered';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MainSubjectOverlayProps {
  mainWord: Word;
  descriptors: Word[];
  onMainWordPress: () => void;
  onDescriptorPress: (word: Word) => void;
  activeWordId?: string;
  getWordState?: (word: Word) => WordState;
}

/**
 * MainSubjectOverlay - Displays main subject prominently in center
 * with descriptor words arranged in a radial pattern around it
 */
export function MainSubjectOverlay({
  mainWord,
  descriptors,
  onMainWordPress,
  onDescriptorPress,
  activeWordId,
  getWordState,
}: MainSubjectOverlayProps) {
  const mainWordState = getWordState?.(mainWord) || 'new';
  const mainScaleAnim = useRef(new Animated.Value(0)).current;
  const descriptorAnims = useRef(descriptors.map(() => new Animated.Value(0))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Entrance animations
  useEffect(() => {
    // Main word pops in first
    Animated.spring(mainScaleAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Descriptors animate in with staggered delay
    descriptorAnims.forEach((anim, index) => {
      Animated.sequence([
        Animated.delay(300 + index * 100),
        Animated.spring(anim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Subtle pulse for main word
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Calculate descriptor positions in a radial pattern
  const getDescriptorPosition = (index: number, total: number) => {
    // Start from top (-90 degrees) and distribute evenly
    const startAngle = -90;
    const angleStep = 360 / Math.max(total, 1);
    const angle = (startAngle + index * angleStep) * (Math.PI / 180);

    // Radius from center - varies slightly for visual interest
    const baseRadius = 120;
    const radiusVariation = index % 2 === 0 ? 0 : 15;
    const radius = baseRadius + radiusVariation;

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  return (
    <View style={styles.container}>
      {/* Main Subject - Center */}
      <Animated.View
        style={[
          styles.mainWordContainer,
          {
            transform: [
              { scale: Animated.multiply(mainScaleAnim, pulseAnim) },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.mainWordBubble,
            activeWordId === mainWord.id && styles.mainWordActive,
            mainWordState === 'quizzed' && styles.mainWordQuizzed,
            mainWordState === 'mastered' && styles.mainWordMastered,
          ]}
          onPress={onMainWordPress}
          activeOpacity={0.8}
        >
          {(mainWordState === 'quizzed' || mainWordState === 'mastered') && (
            <View style={styles.checkBadge}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={mainWordState === 'mastered' ? colors.xp : colors.mint}
              />
            </View>
          )}
          <Text style={styles.mainJapanese}>{mainWord.japanese}</Text>
          <Text style={styles.mainEnglish}>{mainWord.english}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Descriptor Words - Radial arrangement */}
      {descriptors.map((word, index) => {
        const position = getDescriptorPosition(index, descriptors.length);
        const anim = descriptorAnims[index] || new Animated.Value(1);
        const wordState = getWordState?.(word) || 'new';

        return (
          <Animated.View
            key={word.id}
            style={[
              styles.descriptorContainer,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { scale: anim },
                ],
                opacity: anim,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.descriptorBubble,
                activeWordId === word.id && styles.descriptorActive,
                wordState === 'quizzed' && styles.descriptorQuizzed,
                wordState === 'mastered' && styles.descriptorMastered,
              ]}
              onPress={() => onDescriptorPress(word)}
              activeOpacity={0.8}
            >
              {(wordState === 'quizzed' || wordState === 'mastered') && (
                <View style={styles.checkBadgeSmall}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={wordState === 'mastered' ? colors.xp : colors.mint}
                  />
                </View>
              )}
              <Text style={styles.descriptorJapanese}>{word.japanese}</Text>
              <Text style={styles.descriptorEnglish}>{word.english}</Text>
            </TouchableOpacity>

            {/* Connection line to center */}
            <View
              style={[
                styles.connectionLine,
                {
                  width: Math.sqrt(position.x ** 2 + position.y ** 2) - 60,
                  transform: [
                    { rotate: `${Math.atan2(position.y, position.x)}rad` },
                    { translateX: -Math.sqrt(position.x ** 2 + position.y ** 2) / 2 + 30 },
                  ],
                },
              ]}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.4,
    left: SCREEN_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },

  // Main word (center)
  mainWordContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  mainWordBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 100,
  },
  mainWordActive: {
    borderColor: colors.mint,
    borderWidth: 4,
  },
  mainJapanese: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
  },
  mainEnglish: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Descriptor words (radial)
  descriptorContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  descriptorBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  descriptorActive: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  descriptorJapanese: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  descriptorEnglish: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  descriptorQuizzed: {
    borderColor: colors.mint,
  },
  descriptorMastered: {
    borderColor: colors.xp,
  },

  // Check badges for completed words
  checkBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: 10,
    zIndex: 5,
  },
  checkBadgeSmall: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.white,
    borderRadius: 8,
    zIndex: 5,
  },

  // Main word state styles
  mainWordQuizzed: {
    borderColor: colors.mint,
  },
  mainWordMastered: {
    borderColor: colors.xp,
  },

  // Connection lines
  connectionLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: -1,
  },
});

export default MainSubjectOverlay;
