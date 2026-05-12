/**
 * PremiumFeatureLock Component
 *
 * Wraps premium features with a lock overlay for free users.
 * Tapping the overlay triggers the paywall.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, spacing, borderRadius, typography } from '../constants/design';
import { useFeatureGate } from '../hooks/useSubscription';
import { FeatureAccess } from '../types/subscription';

interface PremiumFeatureLockProps {
  feature: keyof FeatureAccess;
  children: React.ReactNode;
  title?: string;
  description?: string;
  style?: ViewStyle;
  showPreview?: boolean; // Show blurred preview of content
  compact?: boolean;     // Smaller lock indicator
}

const FEATURE_LABELS: Partial<Record<keyof FeatureAccess, { title: string; icon: keyof typeof Ionicons.glyphMap }>> = {
  sentenceBreakdown: { title: 'Sentence Breakdown', icon: 'chatbubbles' },
  grammarAnalysis: { title: 'Grammar Analysis', icon: 'school' },
  speakingFeedback: { title: 'Speaking Practice', icon: 'mic' },
  writingFeedback: { title: 'Writing Practice', icon: 'create' },
  progressTracking: { title: 'Progress Tracking', icon: 'analytics' },
  contextualPhrases: { title: 'Contextual Phrases', icon: 'bulb' },
  aiStories: { title: 'AI Stories', icon: 'book' },
  allWorlds: { title: 'All Worlds', icon: 'planet' },
  advancedQuizzes: { title: 'Advanced Quizzes', icon: 'trophy' },
};

export function PremiumFeatureLock({
  feature,
  children,
  title,
  description,
  style,
  showPreview = true,
  compact = false,
}: PremiumFeatureLockProps) {
  const { hasAccess, requestAccess } = useFeatureGate(feature);

  // If user has access, render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  const featureInfo = FEATURE_LABELS[feature];
  const displayTitle = title || featureInfo?.title || 'Premium Feature';
  const displayIcon = featureInfo?.icon || 'lock-closed';

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, style]}
        onPress={requestAccess}
        activeOpacity={0.8}
      >
        <View style={styles.compactContent}>
          {children}
        </View>
        <View style={styles.compactOverlay}>
          <View style={styles.compactBadge}>
            <Ionicons name="lock-closed" size={12} color={colors.white} />
            <Text style={styles.compactText}>PRO</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={requestAccess}
      activeOpacity={0.9}
    >
      {/* Blurred preview or placeholder */}
      {showPreview ? (
        <View style={styles.previewContainer}>
          <View style={styles.childrenWrapper}>
            {children}
          </View>
          <BlurView intensity={20} style={styles.blurOverlay} tint="light" />
        </View>
      ) : (
        <View style={styles.placeholder} />
      )}

      {/* Lock overlay */}
      <View style={styles.lockOverlay}>
        <LinearGradient
          colors={[`${colors.primary}20`, `${colors.primary}40`]}
          style={styles.lockGradient}
        >
          <View style={styles.lockContent}>
            <View style={styles.lockIconContainer}>
              <Ionicons name={displayIcon} size={24} color={colors.primary} />
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={10} color={colors.white} />
              </View>
            </View>
            <Text style={styles.lockTitle}>{displayTitle}</Text>
            <Text style={styles.lockDescription}>
              {description || 'Upgrade to Premium to unlock'}
            </Text>
            <View style={styles.unlockButton}>
              <Text style={styles.unlockButtonText}>Unlock</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Premium Badge Component
 *
 * Small badge to indicate premium features in lists/tabs
 */
export function PremiumBadge({ size = 'small' }: { size?: 'small' | 'medium' }) {
  const isSmall = size === 'small';

  return (
    <LinearGradient
      colors={[colors.accent, colors.accentLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium]}
    >
      <Ionicons
        name="star"
        size={isSmall ? 8 : 10}
        color={colors.white}
      />
      <Text style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>
        PRO
      </Text>
    </LinearGradient>
  );
}

/**
 * Scan Limit Banner
 *
 * Shows remaining scans for free users
 */
interface ScanLimitBannerProps {
  scansRemaining: number;
  onUpgrade: () => void;
}

export function ScanLimitBanner({ scansRemaining, onUpgrade }: ScanLimitBannerProps) {
  if (scansRemaining > 2) return null; // Don't show for premium

  const isLow = scansRemaining <= 1;
  const isEmpty = scansRemaining === 0;

  return (
    <TouchableOpacity
      style={[
        styles.scanBanner,
        isLow && styles.scanBannerWarning,
        isEmpty && styles.scanBannerEmpty,
      ]}
      onPress={onUpgrade}
      activeOpacity={0.8}
    >
      <View style={styles.scanBannerContent}>
        <Ionicons
          name={isEmpty ? 'camera-outline' : 'camera'}
          size={18}
          color={isEmpty ? colors.error : isLow ? colors.warning : colors.textSecondary}
        />
        <Text style={[
          styles.scanBannerText,
          isEmpty && styles.scanBannerTextEmpty,
        ]}>
          {isEmpty
            ? "No scans left today"
            : `${scansRemaining} scan${scansRemaining === 1 ? '' : 's'} remaining today`}
        </Text>
      </View>
      <View style={styles.scanBannerAction}>
        <Text style={styles.scanBannerActionText}>
          {isEmpty ? 'Upgrade' : 'Get Unlimited'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
  },
  previewContainer: {
    position: 'relative',
  },
  childrenWrapper: {
    opacity: 0.6,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    height: 120,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },

  // Lock overlay
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  lockIconContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  lockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  lockDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  unlockButtonText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },

  // Compact version
  compactContainer: {
    position: 'relative',
  },
  compactContent: {
    opacity: 0.5,
  },
  compactOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  compactText: {
    fontSize: 10,
    fontWeight: typography.bold,
    color: colors.white,
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  badgeMedium: {
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: colors.white,
  },
  badgeTextSmall: {
    fontSize: 8,
  },

  // Scan limit banner
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  scanBannerWarning: {
    backgroundColor: `${colors.warning}15`,
  },
  scanBannerEmpty: {
    backgroundColor: `${colors.error}15`,
  },
  scanBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanBannerText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  scanBannerTextEmpty: {
    color: colors.error,
    fontWeight: typography.medium,
  },
  scanBannerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  scanBannerActionText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
});

export default PremiumFeatureLock;
