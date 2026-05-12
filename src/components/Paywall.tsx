/**
 * Paywall Component
 *
 * Clean, minimal paywall UI that shows:
 * - Clear benefits of upgrading
 * - Monthly and yearly pricing options
 * - Free trial callout
 * - Restore purchases
 * - Legal links (Terms, Privacy)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/design';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { purchaseService } from '../services/purchaseService';
import { SUBSCRIPTION_PRODUCTS, PaywallTrigger } from '../types/subscription';
import { useTranslations } from '../hooks/useTranslations';

// Legal links - GitHub Pages hosted
const TERMS_URL = 'https://snurfed.github.io/genkochi/terms.html';
const PRIVACY_URL = 'https://snurfed.github.io/genkochi/privacy.html';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  trigger?: PaywallTrigger;
}

// Benefit icons - titles and descriptions come from translations
const BENEFIT_ICONS = ['camera', 'chatbubbles', 'mic', 'create', 'footsteps'] as const;

export function Paywall({ visible, onClose, trigger }: PaywallProps) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations();

  const { markFirstScanPaywallSeen, trackEvent } = useSubscriptionStore();

  // Benefits with translations
  const PREMIUM_BENEFITS = [
    { icon: 'camera' as const, title: t.paywall.unlimitedScans, description: t.paywall.unlimitedScansDesc },
    { icon: 'chatbubbles' as const, title: t.paywall.sentenceBreakdown, description: t.paywall.sentenceBreakdownDesc },
    { icon: 'mic' as const, title: t.paywall.speakingPractice, description: t.paywall.speakingPracticeDesc },
    { icon: 'create' as const, title: t.paywall.writingPractice, description: t.paywall.writingPracticeDesc },
    { icon: 'footsteps' as const, title: t.paywall.stepTracking, description: t.paywall.stepTrackingDesc },
  ];

  // Get products (in production, fetch from RevenueCat)
  const monthlyProduct = SUBSCRIPTION_PRODUCTS.find(p => p.period === 'monthly');
  const yearlyProduct = SUBSCRIPTION_PRODUCTS.find(p => p.period === 'yearly');

  useEffect(() => {
    if (visible && trigger === 'first_scan_complete') {
      markFirstScanPaywallSeen();
    }
  }, [visible, trigger]);

  const handlePurchase = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = selectedPlan === 'yearly'
        ? await purchaseService.purchaseYearly()
        : await purchaseService.purchaseMonthly();

      if (result.success) {
        onClose();
      } else if (result.cancelled) {
        // User cancelled, do nothing
      } else if (result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(t.paywall.purchaseFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);

    try {
      const result = await purchaseService.restorePurchases();

      if (result.success) {
        onClose();
      } else {
        setError(result.error || t.paywall.noSubscriptionFound);
      }
    } catch (e) {
      setError(t.paywall.restoreFailed);
    } finally {
      setIsRestoring(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  const getHeadline = () => {
    switch (trigger) {
      case 'scan_limit_reached':
        return t.paywall.reachedLimit;
      case 'first_scan_complete':
        return t.paywall.unlockPotential;
      case 'premium_feature_tap':
        return t.paywall.premiumFeature;
      case 'world_limit_reached':
        return t.paywall.exploreMore;
      default:
        return t.paywall.upgradeToPremium;
    }
  };

  const getSubheadline = () => {
    switch (trigger) {
      case 'scan_limit_reached':
        return t.paywall.upgradeForUnlimited;
      case 'first_scan_complete':
        return t.paywall.startFreeTrial;
      default:
        return t.paywall.unlimitedLearning;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.iconGradient}
            >
              <Ionicons name="sparkles" size={32} color={colors.white} />
            </LinearGradient>
            <Text style={styles.headline}>{getHeadline()}</Text>
            <Text style={styles.subheadline}>{getSubheadline()}</Text>
          </View>

          {/* Benefits List */}
          <View style={styles.benefitsSection}>
            {PREMIUM_BENEFITS.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={benefit.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.benefitText}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>{benefit.description}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.mint} />
              </View>
            ))}
          </View>

          {/* Plan Selection */}
          <View style={styles.plansSection}>
            {/* Yearly Plan - Best Value */}
            {yearlyProduct && (
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'yearly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('yearly')}
                activeOpacity={0.8}
                accessibilityLabel={`${t.paywall.yearly}, ${yearlyProduct.price}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPlan === 'yearly' }}
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>{t.paywall.bestValue}</Text>
                </View>
                <View style={styles.planHeader}>
                  <View style={styles.planRadio}>
                    {selectedPlan === 'yearly' && (
                      <View style={styles.planRadioInner} />
                    )}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planTitle}>{t.paywall.yearly}</Text>
                    <Text style={styles.planDescription}>
                      {t.paywall.freeTrialThen.replace('{price}', yearlyProduct.price)}
                    </Text>
                  </View>
                </View>
                <View style={styles.planPricing}>
                  <Text style={styles.planPerMonth}>
                    ${(yearlyProduct.priceAmount / 12 / 100).toFixed(2)}/mo
                  </Text>
                  <Text style={styles.planSavings}>{t.paywall.savePercent.replace('{percent}', '42')}</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Monthly Plan */}
            {monthlyProduct && (
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'monthly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
                accessibilityLabel={`${t.paywall.monthly}, ${monthlyProduct.price}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPlan === 'monthly' }}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planRadio}>
                    {selectedPlan === 'monthly' && (
                      <View style={styles.planRadioInner} />
                    )}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planTitle}>{t.paywall.monthly}</Text>
                    <Text style={styles.planDescription}>
                      {monthlyProduct.price}{t.paywall.perMonth}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, isLoading && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={isLoading || isRestoring}
            activeOpacity={0.9}
            accessibilityLabel={selectedPlan === 'yearly' ? t.paywall.startFreeTrialButton : t.paywall.subscribeNow}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading || isRestoring }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.ctaText}>
                  {selectedPlan === 'yearly' ? t.paywall.startFreeTrialButton : t.paywall.subscribeNow}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Trial Terms */}
          {selectedPlan === 'yearly' && (
            <Text style={styles.trialTerms}>
              {t.paywall.trialTerms.replace('{price}', yearlyProduct?.price || '$69.99')}
            </Text>
          )}

          {/* Restore Purchases */}
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={isLoading || isRestoring}
            accessibilityLabel={t.paywall.restorePurchases}
            accessibilityRole="button"
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.restoreText}>{t.paywall.restorePurchases}</Text>
            )}
          </TouchableOpacity>

          {/* Legal Links */}
          <View style={styles.legalSection}>
            <TouchableOpacity onPress={() => openLink(TERMS_URL)}>
              <Text style={styles.legalLink}>{t.paywall.termsOfService}</Text>
            </TouchableOpacity>
            <Text style={styles.legalDivider}>|</Text>
            <TouchableOpacity onPress={() => openLink(PRIVACY_URL)}>
              <Text style={styles.legalLink}>{t.paywall.privacyPolicy}</Text>
            </TouchableOpacity>
          </View>

          {/* Auto-Renewal Disclosure */}
          <Text style={styles.renewalDisclosure}>
            {Platform.OS === 'ios' ? t.paywall.appleDisclosure : t.paywall.googleDisclosure}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.navy,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subheadline: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Benefits Section
  benefitsSection: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.navy,
  },
  benefitDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },

  // Plans Section
  plansSection: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: borderRadius.sm,
  },
  bestValueText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.white,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  planRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.navy,
  },
  planDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  planPerMonth: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.navy,
  },
  planSavings: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.mint,
    backgroundColor: `${colors.mint}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  // Error
  errorContainer: {
    backgroundColor: `${colors.error}15`,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sm,
    textAlign: 'center',
  },

  // CTA Button
  ctaButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.white,
  },

  // Trial Terms
  trialTerms: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 16,
  },

  // Restore
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  restoreText: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: typography.medium,
  },

  // Legal
  legalSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  legalLink: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },

  // Renewal Disclosure
  renewalDisclosure: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: spacing.md,
  },
});

export default Paywall;
