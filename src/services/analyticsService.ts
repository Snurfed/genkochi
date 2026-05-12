/**
 * Analytics Service
 *
 * Tracks subscription-related events and user behavior.
 * Integrates with your analytics provider (e.g., Mixpanel, Amplitude, Firebase).
 *
 * Setup:
 * 1. Choose an analytics provider
 * 2. Install their SDK (e.g., npx expo install @react-native-firebase/analytics)
 * 3. Replace the placeholder implementations below
 */

import { Platform } from 'react-native';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { SubscriptionEvent, SubscriptionEventData } from '../types/subscription';

// Analytics configuration
const ANALYTICS_ENABLED = !__DEV__; // Disable in development
const FLUSH_INTERVAL_MS = 30000; // Flush events every 30 seconds

interface AnalyticsUser {
  userId?: string;
  tier: 'free' | 'premium';
  platform: 'ios' | 'android';
  appVersion: string;
  locale: string;
}

interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

class AnalyticsService {
  private isInitialized = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private user: AnalyticsUser | null = null;

  /**
   * Initialize analytics
   * Call this early in app lifecycle
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize your analytics SDK here
      // Example with Firebase:
      // await analytics().setAnalyticsCollectionEnabled(ANALYTICS_ENABLED);

      this.isInitialized = true;

      // Start periodic flush
      this.startFlushTimer();

      if (__DEV__) console.log('[Analytics] Initialized');
    } catch (error) {
      if (__DEV__) console.error('[Analytics] Failed to initialize:', error);
    }
  }

  /**
   * Identify the user
   */
  async identify(userId: string, properties?: Partial<AnalyticsUser>): Promise<void> {
    try {
      this.user = {
        userId,
        tier: properties?.tier || 'free',
        platform: Platform.OS as 'ios' | 'android',
        appVersion: '1.0.0', // Replace with actual version
        locale: 'en-US', // Replace with actual locale
        ...properties,
      };

      // Set user ID in your analytics SDK
      // Example with Firebase:
      // await analytics().setUserId(userId);
      // await analytics().setUserProperties({
      //   subscription_tier: this.user.tier,
      //   platform: this.user.platform,
      // });

      if (__DEV__) console.log('[Analytics] User identified:', userId);
    } catch (error) {
      if (__DEV__) console.error('[Analytics] Failed to identify user:', error);
    }
  }

  /**
   * Track a subscription-related event
   */
  async track(event: SubscriptionEvent, properties?: EventProperties): Promise<void> {
    if (!ANALYTICS_ENABLED) {
      if (__DEV__) console.log(`[Analytics] Track (dev): ${event}`, properties);
      return;
    }

    try {
      const eventData: EventProperties = {
        ...properties,
        timestamp: Date.now(),
        platform: Platform.OS,
        tier: this.user?.tier || 'free',
      };

      // Log to your analytics SDK
      // Example with Firebase:
      // await analytics().logEvent(event, eventData);

      // Example with Mixpanel:
      // Mixpanel.track(event, eventData);

      if (__DEV__) console.log(`[Analytics] Tracked: ${event}`, eventData);
    } catch (error) {
      if (__DEV__) console.error('[Analytics] Failed to track event:', error);
    }
  }

  /**
   * Track first photo scan
   */
  async trackFirstPhotoScan(): Promise<void> {
    await this.track('first_photo_scan', {
      is_first_scan: true,
    });
  }

  /**
   * Track paywall view
   */
  async trackPaywallView(trigger: string, scansUsed?: number): Promise<void> {
    await this.track('paywall_view', {
      trigger,
      scans_used_today: scansUsed,
      is_at_limit: scansUsed !== undefined && scansUsed >= 2,
    });
  }

  /**
   * Track paywall dismissal
   */
  async trackPaywallDismiss(trigger: string): Promise<void> {
    await this.track('paywall_dismiss', {
      trigger,
    });
  }

  /**
   * Track subscription started
   */
  async trackSubscriptionStarted(
    productId: string,
    price: number,
    currency: string,
    isTrial: boolean
  ): Promise<void> {
    await this.track('subscription_started', {
      product_id: productId,
      price,
      currency,
      is_trial: isTrial,
    });

    // Update user tier
    if (this.user) {
      this.user.tier = 'premium';
      await this.identify(this.user.userId || 'anonymous', { tier: 'premium' });
    }
  }

  /**
   * Track trial started
   */
  async trackTrialStarted(productId: string, trialDays: number): Promise<void> {
    await this.track('trial_started', {
      product_id: productId,
      trial_days: trialDays,
    });
  }

  /**
   * Track subscription cancelled
   */
  async trackSubscriptionCancelled(reason?: string): Promise<void> {
    await this.track('subscription_cancelled', {
      reason,
    });
  }

  /**
   * Track daily limit reached
   */
  async trackDailyLimitReached(scansUsed: number): Promise<void> {
    await this.track('daily_limit_reached', {
      scans_used: scansUsed,
    });
  }

  /**
   * Track restore purchase attempt
   */
  async trackRestorePurchase(success: boolean): Promise<void> {
    await this.track('restore_purchase', {
      success,
    });
  }

  /**
   * Flush pending events from subscription store
   */
  async flushPendingEvents(): Promise<void> {
    const store = useSubscriptionStore.getState();
    const events = store.flushEvents();

    for (const event of events) {
      await this.track(event.event, event.properties);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushPendingEvents();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Stop flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Update user tier (called when subscription changes)
   */
  async updateTier(tier: 'free' | 'premium'): Promise<void> {
    if (this.user) {
      this.user.tier = tier;
      // Update user properties in analytics
      // analytics().setUserProperties({ subscription_tier: tier });
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// Export hook for tracking in components
export function useAnalytics() {
  return {
    trackPaywallView: analyticsService.trackPaywallView.bind(analyticsService),
    trackPaywallDismiss: analyticsService.trackPaywallDismiss.bind(analyticsService),
    trackSubscriptionStarted: analyticsService.trackSubscriptionStarted.bind(analyticsService),
    trackTrialStarted: analyticsService.trackTrialStarted.bind(analyticsService),
    trackFirstPhotoScan: analyticsService.trackFirstPhotoScan.bind(analyticsService),
    trackDailyLimitReached: analyticsService.trackDailyLimitReached.bind(analyticsService),
  };
}
