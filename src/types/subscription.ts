// Subscription Types for PhotoLingo Freemium Model

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionPeriod = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial' | 'none';

export interface SubscriptionProduct {
  id: string;
  period: SubscriptionPeriod;
  price: string;           // Formatted price string (e.g., "$9.99")
  priceAmount: number;     // Raw price in cents
  currency: string;
  trialDays?: number;
  title: string;
  description: string;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  expiresAt: number | null;           // Unix timestamp
  trialEndsAt: number | null;         // Unix timestamp for trial
  purchaseToken: string | null;       // For backend validation
  productId: string | null;           // Current subscription product
  platform: 'ios' | 'android' | null;
  lastVerifiedAt: number | null;      // Last backend verification timestamp
}

export interface UsageLimits {
  dailyPhotoScans: number;
  maxFreeWords: number;
  maxFreeWorlds: number;
}

export interface FeatureAccess {
  unlimitedScans: boolean;
  sentenceBreakdown: boolean;
  grammarAnalysis: boolean;
  speakingFeedback: boolean;
  writingFeedback: boolean;
  contextualPhrases: boolean;
  aiStories: boolean;
  progressTracking: boolean;
  allWorlds: boolean;
  advancedQuizzes: boolean;
}

// Free tier limits
export const FREE_TIER_LIMITS: UsageLimits = {
  dailyPhotoScans: 3,
  maxFreeWords: 50,
  maxFreeWorlds: 2,
};

// Feature access by tier
export const TIER_FEATURES: Record<SubscriptionTier, FeatureAccess> = {
  free: {
    unlimitedScans: false,
    sentenceBreakdown: false,
    grammarAnalysis: false,
    speakingFeedback: false,
    writingFeedback: false,
    contextualPhrases: false,
    aiStories: false,
    progressTracking: false,
    allWorlds: false,
    advancedQuizzes: false,
  },
  premium: {
    unlimitedScans: true,
    sentenceBreakdown: true,
    grammarAnalysis: true,
    speakingFeedback: true,
    writingFeedback: true,
    contextualPhrases: true,
    aiStories: true,
    progressTracking: true,
    allWorlds: true,
    advancedQuizzes: true,
  },
};

// Product identifiers for App Store / Play Store
export const PRODUCT_IDS = {
  monthly: 'com.photolingo.premium.monthly',
  yearly: 'com.photolingo.premium.yearly',
} as const;

// Subscription products configuration
export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  {
    id: PRODUCT_IDS.monthly,
    period: 'monthly',
    price: '$9.99',
    priceAmount: 999,
    currency: 'USD',
    title: 'Monthly',
    description: 'Billed monthly',
  },
  {
    id: PRODUCT_IDS.yearly,
    period: 'yearly',
    price: '$69.99',
    priceAmount: 6999,
    currency: 'USD',
    trialDays: 7,
    title: 'Yearly',
    description: 'Save 42% - 7 day free trial',
  },
];

// Analytics event types
export type SubscriptionEvent =
  | 'first_photo_scan'
  | 'paywall_view'
  | 'paywall_dismiss'
  | 'subscription_started'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'trial_started'
  | 'trial_converted'
  | 'restore_purchase'
  | 'daily_limit_reached';

export interface SubscriptionEventData {
  event: SubscriptionEvent;
  timestamp: number;
  properties?: Record<string, string | number | boolean>;
}

// Paywall trigger conditions
export type PaywallTrigger =
  | 'scan_limit_reached'
  | 'first_scan_complete'
  | 'premium_feature_tap'
  | 'settings_upgrade'
  | 'world_limit_reached';

export interface PaywallContext {
  trigger: PaywallTrigger;
  featureRequested?: keyof FeatureAccess;
  scansUsedToday?: number;
  wordsLearned?: number;
}

// Default subscription state for new users
export const DEFAULT_SUBSCRIPTION_STATE: SubscriptionState = {
  tier: 'free',
  status: 'none',
  expiresAt: null,
  trialEndsAt: null,
  purchaseToken: null,
  productId: null,
  platform: null,
  lastVerifiedAt: null,
};
