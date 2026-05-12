import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SentenceBreakdown, GrammarRole } from '../types';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/design';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Color mapping for grammar roles
const roleColors: Record<GrammarRole, string> = {
  subject: colors.mint,           // Mint for subject (ga marker)
  object: colors.primary,         // Coral for object (wo marker)
  verb: colors.level,             // Purple for verbs
  particle: colors.xp,            // Gold/yellow for particles
  topic: '#5B9BD5',               // Blue for topic (wa)
  location: '#4CAF50',            // Green for location (ni, de)
  adjective: '#FF9800',           // Orange for adjectives
  adverb: '#9C27B0',              // Deep purple for adverbs
  time: '#00BCD4',                // Cyan for time
  other: colors.textSecondary,    // Gray for other
};

// Lighter background versions for bubbles - Cosmic theme
const roleBgColors: Record<GrammarRole, string> = {
  subject: 'rgba(34, 197, 94, 0.2)',
  object: 'rgba(239, 68, 68, 0.2)',
  verb: 'rgba(139, 92, 246, 0.2)',
  particle: 'rgba(251, 191, 36, 0.2)',
  topic: 'rgba(59, 130, 246, 0.2)',
  location: 'rgba(34, 197, 94, 0.2)',
  adjective: 'rgba(245, 158, 11, 0.2)',
  adverb: 'rgba(168, 85, 247, 0.2)',
  time: 'rgba(6, 182, 212, 0.2)',
  other: 'rgba(148, 163, 184, 0.2)',
};

interface GrammarBreakdownProps {
  breakdown: SentenceBreakdown;
  sentence: string;
  onClose?: () => void;
  variant?: 'modal' | 'inline';
}

export const GrammarBreakdown: React.FC<GrammarBreakdownProps> = ({
  breakdown,
  sentence,
  onClose,
  variant = 'inline',
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleWordPress = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedIndex(selectedIndex === index ? null : index);
  }, [selectedIndex]);

  const selectedElement = selectedIndex !== null ? breakdown.elements[selectedIndex] : null;

  const renderContent = () => (
    <View style={styles.container}>
      {/* Header with sentence */}
      <View style={styles.header}>
        <Text style={styles.sentenceText}>{sentence}</Text>
      </View>

      {/* Word bubbles */}
      <View style={styles.wordsContainer}>
        {breakdown.elements.map((element, index) => {
          const isSelected = selectedIndex === index;
          const roleColor = roleColors[element.role];
          const roleBgColor = roleBgColors[element.role];

          return (
            <TouchableOpacity
              key={`${element.word}-${index}`}
              style={[
                styles.wordBubble,
                { backgroundColor: roleBgColor, borderColor: roleColor },
                isSelected && { backgroundColor: roleColor },
              ]}
              onPress={() => handleWordPress(index)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.wordText,
                  { color: isSelected ? colors.white : roleColor },
                ]}
              >
                {element.word}
              </Text>
              <Text
                style={[
                  styles.readingText,
                  { color: isSelected ? colors.white : roleColor, opacity: 0.8 },
                ]}
              >
                {element.reading}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation panel */}
      {selectedElement && (
        <View style={styles.explanationPanel}>
          <View style={styles.explanationHeader}>
            <View
              style={[
                styles.roleTag,
                { backgroundColor: roleColors[selectedElement.role] },
              ]}
            >
              <Text style={styles.roleTagText}>
                {selectedElement.role.toUpperCase()}
              </Text>
            </View>
            {selectedElement.particleType && (
              <Text style={styles.particleType}>
                ({selectedElement.particleType})
              </Text>
            )}
          </View>
          <Text style={styles.explanationText}>{selectedElement.explanation}</Text>
        </View>
      )}

      {/* Structure pattern */}
      <View style={styles.structureSection}>
        <Text style={styles.structureLabel}>Sentence Structure:</Text>
        <View style={styles.structureContainer}>
          <Text style={styles.structureText}>{breakdown.structure}</Text>
        </View>
        {breakdown.patternName && (
          <View style={styles.patternContainer}>
            <Text style={styles.patternLabel}>Pattern:</Text>
            <Text style={styles.patternName}>{breakdown.patternName}</Text>
          </View>
        )}
        {breakdown.notes && (
          <Text style={styles.notesText}>{breakdown.notes}</Text>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Color Legend:</Text>
        <View style={styles.legendItems}>
          <LegendItem role="subject" label="Subject" />
          <LegendItem role="object" label="Object" />
          <LegendItem role="verb" label="Verb" />
          <LegendItem role="particle" label="Particle" />
          <LegendItem role="topic" label="Topic" />
          <LegendItem role="location" label="Location" />
        </View>
      </View>
    </View>
  );

  if (variant === 'modal') {
    return (
      <Modal
        visible={true}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {onClose && (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>X</Text>
              </TouchableOpacity>
            )}
            {renderContent()}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return renderContent();
};

// Legend item component
const LegendItem: React.FC<{ role: GrammarRole; label: string }> = ({ role, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: roleColors[role] }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.navy,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  sentenceText: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.white,
    textAlign: 'center',
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  wordBubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 50,
  },
  wordText: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
  },
  readingText: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  explanationPanel: {
    backgroundColor: colors.navyLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roleTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  roleTagText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.white,
    letterSpacing: 1,
  },
  particleType: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  explanationText: {
    fontSize: typography.base,
    color: colors.white,
    lineHeight: 22,
  },
  structureSection: {
    backgroundColor: colors.navyLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  structureLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: typography.medium,
  },
  structureContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  structureText: {
    fontSize: typography.base,
    color: colors.mint,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  patternContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  patternLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  patternName: {
    fontSize: typography.sm,
    color: colors.xp,
    fontWeight: typography.semibold,
  },
  notesText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  legend: {
    marginTop: spacing.sm,
  },
  legendTitle: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navyLight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.white,
  },
});

export default GrammarBreakdown;
