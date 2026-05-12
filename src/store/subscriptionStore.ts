// Subscription Store - Zustand slice for subscription state management
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SubscriptionState,
  SubscriptionTier,
  SubscriptionStatus,
  FeatureAccess,
  UsageLimits,
  PaywallContext,
  PaywallTrigger,
  SubscriptionEvent,
  SubscriptionEventData,
  DEFAULT_SUBSCRIPTION_STATE,
  FREE_TIER_LIMITS,
  TIER_FEATURES,
} from '../types/subscription';

interface DailyUsage {
  date: string; // YYYY-MM-DD format
  photoScans: number;
  premiumFeatureAttempts: number;
}

interface SubscriptionStore {
  // Subscription state
  subscription: SubscriptionState;

  // Usage tracking
  dailyUsage: DailyUsage;
  totalPhotoScans: number;
  hasSeenFirstScanPaywall: boolean;

  // Paywall state
  paywallVisible: boolean;
  paywallContext: PaywallContext | null;

  // Analytics events queue (for offline support)
  pendingEvents: SubscriptionEventData[];

  // Actions - Subscription Management
  setSubscription: (subscription: Partial<SubscriptionState>) => void;
  upgradeToPremium: (productId: string, purchaseToken: string, expiresAt: number, platform: 'ios' | 'android') => void;
  startTrial: (productId: string, trialEndsAt: number, platform: 'ios' | 'android') => void;
  cancelSubscription: () => void;
  expireSubscription: () => void;
  restoreSubscription: (subscription: SubscriptionState) => void;

  // Actions - Usage Tracking
  recordPhotoScan: () => { allowed: boolean; remaining: number; showPaywall: boolean };
  canScanPhoto: () => { allowed: boolean; remaining: number };
  resetDailyUsage: () => void;

  // Actions - Feature Gating
  canAccessFeature: (feature: keyof FeatureAccess) => boolean;
  getFeatureAccess: () => FeatureAccess;
  getLimits: () => UsageLimits;
  isPremium: () => boolean;
  isTrialing: () => boolean;

  // Actions - Paywall
  showPaywall: (trigger: PaywallTrigger, featureRequested?: keyof FeatureAccess) => void;
  hidePaywall: () => void;
  markFirstScanPaywallSeen: () => void;

  // Actions - Analytics
  trackEvent: (event: SubscriptionEvent, properties?: Record<string, string | number | boolean>) => void;
  flushEvents: () => SubscriptionEventData[];

  // Actions - Verification
  setLastVerified: () => void;
  needsVerification: () => boolean;
}

const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

const createDefaultDailyUsage = (): DailyUsage => ({
  date: getTodayDateString(),
  photoScans: 0,
  premiumFeatureAttempts: 0,
});

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      subscription: DEFAULT_SUBSCRIPTION_STATE,
      dailyUsage: createDefaultDailyUsage(),
      totalPhotoScans: 0,
      hasSeenFirstScanPaywall: false,
      paywallVisible: false,
      paywallContext: null,
      pendingEvents: [],

      // Subscription Management
      setSubscription: (updates) => {
        set((state) => ({
          subscription: { ...state.subscription, ...updates },
        }));
      },

      upgradeToPremium: (productId, purchaseToken, expiresAt, platform) => {
        const now = Date.now();
        set({
          subscription: {
            tier: 'premium',
            status: 'active',
            expiresAt,
            trialEndsAt: null,
            purchaseToken,
            productId,
            platform,
            lastVerifiedAt: now,
          },
        });
        get().trackEvent('subscription_started', { productId, platform });
      },

      startTrial: (productId, trialEndsAt, platform) => {
        const now = Date.now();
        set({
          subscription: {
            tier: 'premium',
            status: 'trial',
            expiresAt: trialEndsAt,
            trialEndsAt,
            purchaseToken: null,
            productId,
            platform,
            lastVerifiedAt: now,
          },
        });
        get().trackEvent('trial_started', { productId, platform });
      },

      cancelSubscription: () => {
        set((state) => ({
          subscription: {
            ...state.subscription,
            status: 'cancelled',
          },
        }));
        get().trackEvent('subscription_cancelled');
      },

      expireSubscription: () => {
        set({
          subscription: {
            ...DEFAULT_SUBSCRIPTION_STATE,
            status: 'expired',
          },
        });
        get().trackEvent('subscription_expired');
      },

      restoreSubscription: (subscription) => {
        set({ subscription });
        get().trackEvent('restore_purchase', {
          tier: subscription.tier,
          status: subscription.status,
        });
      },

      // Usage Tracking
      recordPhotoScan: () => {
        const state = get();
        const today = getTodayDateString();

        // Reset daily usage if it's a new day
        if (state.dailyUsage.date !== today) {
          set({ dailyUsage: createDefaultDailyUsage() });
        }

        const isPremium = state.isPremium();
        const currentUsage = state.dailyUsage.date === today ? state.dailyUsage : createDefaultDailyUsage();
        const remaining = FREE_TIER_LIMITS.dailyPhotoScans - currentUsage.photoScans;

        // Premium users have unlimited scans
        if (isPremium) {
          set((s) => ({
            dailyUsage: {
              ...s.dailyUsage,
              date: today,
              photoScans: s.dailyUsage.photoScans + 1,
            },
            totalPhotoScans: s.totalPhotoScans + 1,
          }));

          // Track first scan event
          if (state.totalPhotoScans === 0) {
            state.trackEvent('first_photo_scan');
          }

          return { allowed: true, remaining: Infinity, showPaywall: false };
        }

        // Free tier: check limits
        if (remaining <= 0) {
          state.trackEvent('daily_limit_reached');
          return { allowed: false, remaining: 0, showPaywall: true };
        }

        // Allow scan and update usage
        set((s) => ({
          dailyUsage: {
            ...s.dailyUsage,
            date: today,
            photoScans: s.dailyUsage.photoScans + 1,
          },
          totalPhotoScans: s.totalPhotoScans + 1,
        }));

        const newRemaining = remaining - 1;
        const isFirstScan = state.totalPhotoScans === 0;

        // Track first scan event
        if (isFirstScan) {
          state.trackEvent('first_photo_scan');
        }

        // Only show paywall when daily limit is reached (after 3rd photo)
        const showPaywall = newRemaining === 0;

        return {
          allowed: true,
          remaining: newRemaining,
          showPaywall,
        };
      },

      canScanPhoto: () => {
        const state = get();
        const today = getTodayDateString();

        if (state.isPremium()) {
          return { allowed: true, remaining: Infinity };
        }

        const currentUsage = state.dailyUsage.date === today ? state.dailyUsage : createDefaultDailyUsage();
        const remaining = FREE_TIER_LIMITS.dailyPhotoScans - currentUsage.photoScans;

        return {
          allowed: remaining > 0,
          remaining: Math.max(0, remaining),
        };
      },

      resetDailyUsage: () => {
        set({ dailyUsage: createDefaultDailyUsage() });
      },

      // Feature Gating
      canAccessFeature: (feature) => {
        const state = get();
        if (state.isPremium()) return true;
        return TIER_FEATURES.free[feature];
      },

      getFeatureAccess: () => {
        const state = get();
        return state.isPremium() ? TIER_FEATURES.premium : TIER_FEATURES.free;
      },

      getLimits: () => {
        const state = get();
        if (state.isPremium()) {
          return {
            dailyPhotoScans: Infinity,
            maxFreeWords: Infinity,
            maxFreeWorlds: 6,
          };
        }
        return FREE_TIER_LIMITS;
      },

      isPremium: () => {
        // DEV MODE: Bypass subscription for testing
        if (__DEV__) return true;

        const { subscription } = get();
        if (subscription.tier !== 'premium') return false;

        // Check if subscription is still valid
        if (subscription.status === 'active' || subscription.status === 'trial') {
          if (subscription.expiresAt && subscription.expiresAt > Date.now()) {
            return true;
          }
        }
        return false;
      },

      isTrialing: () => {
        const { subscription } = get();
        return subscription.status === 'trial' &&
               subscription.trialEndsAt !== null &&
               subscription.trialEndsAt > Date.now();
      },

      // Paywall
      showPaywall: (trigger, featureRequested) => {
        const state = get();
        const { canScanPhoto } = state;
        const scanStatus = canScanPhoto();

        set({
          paywallVisible: true,
          paywallContext: {
            trigger,
            featureRequested,
            scansUsedToday: state.dailyUsage.photoScans,
          },
        });

        state.trackEvent('paywall_view', { trigger, featureRequested: featureRequested || 'none' });
      },

      hidePaywall: () => {
        get().trackEvent('paywall_dismiss');
        set({
          paywallVisible: false,
          paywallContext: null,
        });
      },

      markFirstScanPaywallSeen: () => {
        set({ hasSeenFirstScanPaywall: true });
      },

      // Analytics
      trackEvent: (event, properties = {}) => {
        const eventData: SubscriptionEventData = {
          event,
          timestamp: Date.now(),
          properties,
        };

        set((state) => ({
          pendingEvents: [...state.pendingEvents, eventData],
        }));

        // Log for debugging
        if (__DEV__) console.log(`[Analytics] ${event}`, properties);
      },

      flushEvents: () => {
        const events = get().pendingEvents;
        set({ pendingEvents: [] });
        return events;
      },

      // Verification
      setLastVerified: () => {
        set((state) => ({
          subscription: {
            ...state.subscription,
            lastVerifiedAt: Date.now(),
          },
        }));
      },

      needsVerification: () => {
        const { subscription } = get();
        if (!subscription.lastVerifiedAt) return true;

        // Re-verify every 24 hours
        const twentyFourHours = 24 * 60 * 60 * 1000;
        return Date.now() - subscription.lastVerifiedAt > twentyFourHours;
      },
    }),
    {
      name: 'photolingo-subscription',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        subscription: state.subscription,
        dailyUsage: state.dailyUsage,
        totalPhotoScans: state.totalPhotoScans,
        hasSeenFirstScanPaywall: state.hasSeenFirstScanPaywall,
        pendingEvents: state.pendingEvents,
      }),
    }
  )
);

// Export selector hooks for common operations
export const useIsPremium = () => useSubscriptionStore((state) => state.isPremium());
export const useSubscriptionTier = () => useSubscriptionStore((state) => state.subscription.tier);
export const useCanAccessFeature = (feature: keyof FeatureAccess) =>
  useSubscriptionStore((state) => state.canAccessFeature(feature));
