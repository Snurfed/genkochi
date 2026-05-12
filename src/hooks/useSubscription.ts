/**
 * useSubscription Hook
 *
 * Provides easy access to subscription state and feature gating
 * throughout the app.
 */

import { useCallback, useEffect } from 'react';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { purchaseService } from '../services/purchaseService';
import { FeatureAccess, PaywallTrigger } from '../types/subscription';

interface UseSubscriptionReturn {
  // Subscription state
  isPremium: boolean;
  isTrialing: boolean;
  tier: 'free' | 'premium';
  daysLeftInTrial: number | null;

  // Usage
  dailyScansRemaining: number;
  canScan: boolean;
  totalScans: number;

  // Feature access
  canAccess: (feature: keyof FeatureAccess) => boolean;
  features: FeatureAccess;

  // Actions
  recordScan: () => { allowed: boolean; showPaywall: boolean };
  showPaywall: (trigger: PaywallTrigger, feature?: keyof FeatureAccess) => void;
  hidePaywall: () => void;
  restorePurchases: () => Promise<boolean>;

  // Paywall state
  paywallVisible: boolean;
  paywallTrigger: PaywallTrigger | null;
}

export function useSubscription(): UseSubscriptionReturn {
  const store = useSubscriptionStore();

  const {
    subscription,
    isPremium: checkIsPremium,
    isTrialing: checkIsTrialing,
    canAccessFeature,
    getFeatureAccess,
    canScanPhoto,
    recordPhotoScan,
    showPaywall: showPaywallAction,
    hidePaywall: hidePaywallAction,
    paywallVisible,
    paywallContext,
    totalPhotoScans,
    dailyUsage,
    needsVerification,
  } = store;

  const isPremium = checkIsPremium();
  const isTrialing = checkIsTrialing();

  // Calculate days left in trial
  const daysLeftInTrial = isTrialing && subscription.trialEndsAt
    ? Math.max(0, Math.ceil((subscription.trialEndsAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Get scan status
  const scanStatus = canScanPhoto();

  // Verify subscription periodically
  useEffect(() => {
    if (needsVerification() && subscription.tier === 'premium') {
      purchaseService.syncSubscriptionStatus();
    }
  }, []);

  // Record a scan and check if paywall should show
  const recordScan = useCallback(() => {
    const result = recordPhotoScan();
    return {
      allowed: result.allowed,
      showPaywall: result.showPaywall,
    };
  }, [recordPhotoScan]);

  // Show paywall
  const showPaywall = useCallback((trigger: PaywallTrigger, feature?: keyof FeatureAccess) => {
    showPaywallAction(trigger, feature);
  }, [showPaywallAction]);

  // Hide paywall
  const hidePaywall = useCallback(() => {
    hidePaywallAction();
  }, [hidePaywallAction]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    const result = await purchaseService.restorePurchases();
    return result.success;
  }, []);

  // Can access feature
  const canAccess = useCallback((feature: keyof FeatureAccess): boolean => {
    return canAccessFeature(feature);
  }, [canAccessFeature]);

  return {
    // State
    isPremium,
    isTrialing,
    tier: subscription.tier,
    daysLeftInTrial,

    // Usage (FREE_TIER_LIMITS.dailyPhotoScans = 3)
    dailyScansRemaining: isPremium ? Infinity : Math.max(0, 3 - dailyUsage.photoScans),
    canScan: scanStatus.allowed,
    totalScans: totalPhotoScans,

    // Features
    canAccess,
    features: getFeatureAccess(),

    // Actions
    recordScan,
    showPaywall,
    hidePaywall,
    restorePurchases,

    // Paywall
    paywallVisible,
    paywallTrigger: paywallContext?.trigger || null,
  };
}

/**
 * Feature Gate Component Helper
 *
 * Use this to conditionally render premium features
 */
export function useFeatureGate(feature: keyof FeatureAccess) {
  const { canAccess, showPaywall, isPremium } = useSubscription();

  const hasAccess = canAccess(feature);

  const requestAccess = useCallback(() => {
    if (!hasAccess) {
      showPaywall('premium_feature_tap', feature);
    }
  }, [hasAccess, showPaywall, feature]);

  return {
    hasAccess,
    isPremium,
    requestAccess,
  };
}

/**
 * Photo Scan Gate
 *
 * Use before allowing a photo scan
 */
export function useScanGate() {
  const { canScan, dailyScansRemaining, recordScan, showPaywall, isPremium } = useSubscription();

  const attemptScan = useCallback((): boolean => {
    if (isPremium) {
      recordScan();
      return true;
    }

    if (!canScan) {
      showPaywall('scan_limit_reached');
      return false;
    }

    const result = recordScan();

    if (result.showPaywall) {
      // Show paywall after scan (first scan complete or limit reached)
      setTimeout(() => {
        showPaywall(
          result.allowed ? 'first_scan_complete' : 'scan_limit_reached'
        );
      }, 1500); // Delay to let user see their scan result first
    }

    return result.allowed;
  }, [canScan, isPremium, recordScan, showPaywall]);

  return {
    canScan: isPremium || canScan,
    scansRemaining: dailyScansRemaining,
    attemptScan,
    isPremium,
  };
}

export default useSubscription;
