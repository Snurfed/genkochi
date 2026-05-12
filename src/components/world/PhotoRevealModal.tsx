/**
 * PhotoRevealModal.tsx
 *
 * Shows the original photo tied to a world object when long-pressing.
 * Appears as a gentle reveal with the photo and capture date.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorldObject } from '../../types';
import { colors, borderRadius, spacing, typography } from '../../constants/design';
import { resolveImageUri } from '../../utils/photoStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhotoRevealModalProps {
  object: WorldObject;
  photoUri?: string;
  captureDate?: string;
  onClose: () => void;
}

export function PhotoRevealModal({
  object,
  photoUri,
  captureDate,
  onClose,
}: PhotoRevealModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
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
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={styles.backdrop} onPress={handleClose} />

      <Animated.View
        style={[
          styles.modal,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>

        {/* Photo */}
        <View style={styles.photoContainer}>
          {photoUri ? (
            <Image source={{ uri: resolveImageUri(photoUri) }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.noPhoto}>
              <Text style={styles.noPhotoEmoji}>{object.emoji}</Text>
              <Text style={styles.noPhotoText}>Photo not available</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.wordRow}>
            <Text style={styles.emoji}>{object.emoji}</Text>
            <View>
              <Text style={styles.japanese}>{object.displayName}</Text>
              <Text style={styles.english}>{object.english}</Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={styles.dateText}>Captured {formatDate(captureDate)}</Text>
          </View>
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
    zIndex: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modal: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 360,
    backgroundColor: '#1a1a2e',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0d0d1a',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  noPhoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  noPhotoText: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
  info: {
    padding: spacing.lg,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 32,
  },
  japanese: {
    color: 'white',
    fontSize: typography.xl,
    fontWeight: '700',
  },
  english: {
    color: colors.textMuted,
    fontSize: typography.base,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: typography.sm,
  },
});

export default PhotoRevealModal;
