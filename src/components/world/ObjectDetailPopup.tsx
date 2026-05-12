import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorldObject } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { speakJapanese } from '../../utils/speech';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ObjectDetailPopupProps {
  object: WorldObject;
  onClose: () => void;
  onStudy: () => void;  // Navigate to photo/study screen
}

export function ObjectDetailPopup({
  object,
  onClose,
  onStudy,
}: ObjectDetailPopupProps) {
  // Animations
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleSpeak = () => {
    speakJapanese(object.displayName);
  };

  const handleStudy = () => {
    handleClose();
    setTimeout(onStudy, 200);
  };

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity: fadeAnim },
      ]}
    >
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} />

      <Animated.View
        style={[
          styles.popup,
          {
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Emoji display */}
        <View style={styles.emojiContainer}>
          <View style={styles.emojiCircle}>
            <Text style={styles.emojiLarge}>{object.emoji}</Text>
          </View>
        </View>

        {/* Word section */}
        <View style={styles.wordSection}>
          <View style={styles.wordRow}>
            <Text style={styles.japanese}>{object.displayName}</Text>
            <TouchableOpacity style={styles.speakButton} onPress={handleSpeak}>
              <Ionicons name="volume-high" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {object.reading && (
            <Text style={styles.reading}>{object.reading}</Text>
          )}

          <Text style={styles.english}>{object.english}</Text>
        </View>

        {/* Descriptors */}
        {object.descriptors && object.descriptors.length > 0 && (
          <View style={styles.descriptorsSection}>
            <Text style={styles.sectionLabel}>Descriptors</Text>
            <View style={styles.descriptorsList}>
              {object.descriptors.map((desc, index) => (
                <View key={index} style={styles.descriptorItem}>
                  <Text style={styles.descriptorJapanese}>{desc.japanese}</Text>
                  <Text style={styles.descriptorEnglish}>{desc.english}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Study button */}
        <TouchableOpacity style={styles.studyButton} onPress={handleStudy}>
          <Ionicons name="book" size={20} color={colors.white} />
          <Text style={styles.studyButtonText}>Study This Word</Text>
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={handleSpeak}>
            <Ionicons name="ear" size={18} color={colors.textSecondary} />
            <Text style={styles.quickActionText}>Listen</Text>
          </TouchableOpacity>

          <View style={styles.quickActionDivider} />

          <TouchableOpacity style={styles.quickAction} onPress={handleStudy}>
            <Ionicons name="image" size={18} color={colors.textSecondary} />
            <Text style={styles.quickActionText}>View Photo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  popup: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Emoji
  emojiContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emojiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  emojiLarge: {
    fontSize: 56,
  },

  // Word section
  wordSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  japanese: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  speakButton: {
    padding: spacing.xs,
  },
  reading: {
    fontSize: typography.base,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  english: {
    fontSize: typography.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Descriptors
  descriptorsSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  descriptorsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  descriptorItem: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  descriptorJapanese: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  descriptorEnglish: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Study button
  studyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  studyButtonText: {
    color: colors.white,
    fontSize: typography.base,
    fontWeight: '700',
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  quickActionText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  quickActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
});

export default ObjectDetailPopup;
