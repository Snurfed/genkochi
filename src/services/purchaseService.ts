/**
 * Purchase Service - RevenueCat Integration
 *
 * Handles in-app purchases for iOS (StoreKit) and Android (Play Billing)
 * using RevenueCat SDK (react-native-purchases)
 *
 * Setup required:
 * 1. npx expo install react-native-purchases
 * 2. Add RevenueCat API keys to app.json
 * 3. Configure products in App Store Connect / Google Play Console
 * 4. Configure products in RevenueCat dashboard
 */

import { Platform } from 'react-native';

// RevenueCat types (will be provided by react-native-purchases when installed)
interface PurchasesPackage {
  product: {
    identifier: string;
    priceString: string;
    price: number;
  };
}

interface CustomerInfo {
  originalAppUserId: string;
  entitlements: {
    active: Record<string, {
      expirationDate: string | null;
      productIdentifier: string;
      periodType: string;
    }>;
  };
}

interface PurchasesError extends Error {
  userCancelled?: boolean;
}

// Conditional import - RevenueCat SDK
let Purchases: any = null;
let LOG_LEVEL: any = null;

try {
  const purchases = require('react-native-purchases');
  Purchases = purchases.default;
  LOG_LEVEL = purchases.LOG_LEVEL;
} catch (e) {
  if (__DEV__) console.warn('[PurchaseService] react-native-purchases not installed. Run: npx expo install react-native-purchases');
}
import {
  PRODUCT_IDS,
  SubscriptionState,
  SubscriptionProduct,
  SUBSCRIPTION_PRODUCTS,
} from '../types/subscription';
import { useSubscriptionStore } from '../store/subscriptionStore';

// RevenueCat API Keys
const REVENUECAT_API_KEY_IOS = 'appl_OIwgzMzmhWFipFQYlijQUawmyxc';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY'; // Add when you set up Android

// Entitlement identifier in RevenueCat
const PREMIUM_ENTITLEMENT = 'premium';

// Offering identifier
const DEFAULT_OFFERING = 'default';

interface PurchaseResult {
  success: boolean;
  subscription?: SubscriptionState;
  error?: string;
  cancelled?: boolean;
}

interface ProductsResult {
  products: PurchasesPackage[];
  error?: string;
}

class PurchaseService {
  private initialized = false;

  /**
   * Check if RevenueCat SDK is available
   */
  isAvailable(): boolean {
    return Purchases !== null;
  }

  /**
   * Initialize RevenueCat SDK
   * Call this early in app lifecycle (e.g., in App.tsx or _layout.tsx)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.isAvailable()) {
      if (__DEV__) console.warn('[PurchaseService] RevenueCat SDK not available. Install react-native-purchases.');
      return;
    }

    try {
      // Enable debug logging in development
      if (__DEV__ && LOG_LEVEL) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      const apiKey = Platform.OS === 'ios'
        ? REVENUECAT_API_KEY_IOS
        : REVENUECAT_API_KEY_ANDROID;

      await Purchases.configure({ apiKey });
      this.initialized = true;

      // Check current subscription status on init
      await this.syncSubscriptionStatus();

      if (__DEV__) console.log('[PurchaseService] Initialized successfully');
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Failed to initialize:', error);
    }
  }

  /**
   * Set user identifier for RevenueCat (after user authentication)
   */
  async setUserId(userId: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await Purchases.logIn(userId);
      await this.syncSubscriptionStatus();
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Failed to set user ID:', error);
    }
  }

  /**
   * Get available subscription products from the store
   */
  async getProducts(): Promise<ProductsResult> {
    if (!this.isAvailable()) {
      return { products: [], error: 'RevenueCat SDK not installed' };
    }

    try {
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        return { products: [], error: 'No offerings available' };
      }

      const packages = offerings.current.availablePackages;
      return { products: packages };
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Failed to get products:', error);
      return { products: [], error: String(error) };
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchase(pkg: PurchasesPackage): Promise<PurchaseResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'RevenueCat SDK not installed' };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      if (customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]) {
        const subscription = this.customerInfoToSubscriptionState(customerInfo);

        // Update local store
        const store = useSubscriptionStore.getState();
        store.upgradeToPremium(
          pkg.product.identifier,
          customerInfo.originalAppUserId,
          subscription.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
          Platform.OS as 'ios' | 'android'
        );

        return { success: true, subscription };
      }

      return { success: false, error: 'Purchase completed but entitlement not active' };
    } catch (error) {
      const purchaseError = error as PurchasesError;

      // User cancelled the purchase
      if (purchaseError.userCancelled) {
        return { success: false, cancelled: true };
      }

      if (__DEV__) console.error('[PurchaseService] Purchase failed:', error);
      return { success: false, error: purchaseError.message };
    }
  }

  /**
   * Purchase monthly subscription
   */
  async purchaseMonthly(): Promise<PurchaseResult> {
    const { products } = await this.getProducts();
    const monthlyPkg = products.find(
      p => p.product.identifier === PRODUCT_IDS.monthly
    );

    if (!monthlyPkg) {
      return { success: false, error: 'Monthly subscription not available' };
    }

    return this.purchase(monthlyPkg);
  }

  /**
   * Purchase yearly subscription
   */
  async purchaseYearly(): Promise<PurchaseResult> {
    const { products } = await this.getProducts();
    const yearlyPkg = products.find(
      p => p.product.identifier === PRODUCT_IDS.yearly
    );

    if (!yearlyPkg) {
      return { success: false, error: 'Yearly subscription not available' };
    }

    return this.purchase(yearlyPkg);
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<PurchaseResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'RevenueCat SDK not installed' };
    }

    try {
      const customerInfo = await Purchases.restorePurchases();

      if (customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]) {
        const subscription = this.customerInfoToSubscriptionState(customerInfo);

        // Update local store
        const store = useSubscriptionStore.getState();
        store.restoreSubscription(subscription);

        return { success: true, subscription };
      }

      return { success: false, error: 'No active subscription found to restore' };
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Restore failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Sync subscription status with RevenueCat
   */
  async syncSubscriptionStatus(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const subscription = this.customerInfoToSubscriptionState(customerInfo);

      const store = useSubscriptionStore.getState();
      const currentSubscription = store.subscription;

      // Check if subscription status changed
      if (customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]) {
        if (currentSubscription.tier !== 'premium') {
          store.restoreSubscription(subscription);
        } else {
          store.setLastVerified();
        }
      } else if (currentSubscription.tier === 'premium') {
        // Subscription expired
        store.expireSubscription();
      }
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Failed to sync status:', error);
    }
  }

  /**
   * Get customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.isAvailable()) return null;

    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Failed to get customer info:', error);
      return null;
    }
  }

  /**
   * Check if user has active premium subscription
   */
  async checkPremiumStatus(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
    } catch (error) {
      if (__DEV__) console.error('[PurchaseService] Failed to check status:', error);
      return false;
    }
  }

  /**
   * Convert RevenueCat CustomerInfo to our SubscriptionState
   */
  private customerInfoToSubscriptionState(customerInfo: CustomerInfo): SubscriptionState {
    const premiumEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];

    if (!premiumEntitlement) {
      return {
        tier: 'free',
        status: 'none',
        expiresAt: null,
        trialEndsAt: null,
        purchaseToken: customerInfo.originalAppUserId,
        productId: null,
        platform: Platform.OS as 'ios' | 'android',
        lastVerifiedAt: Date.now(),
      };
    }

    const expirationDate = premiumEntitlement.expirationDate
      ? new Date(premiumEntitlement.expirationDate).getTime()
      : null;

    const isTrialing = premiumEntitlement.periodType === 'TRIAL';

    return {
      tier: 'premium',
      status: isTrialing ? 'trial' : 'active',
      expiresAt: expirationDate,
      trialEndsAt: isTrialing ? expirationDate : null,
      purchaseToken: customerInfo.originalAppUserId,
      productId: premiumEntitlement.productIdentifier,
      platform: Platform.OS as 'ios' | 'android',
      lastVerifiedAt: Date.now(),
    };
  }

  /**
   * Format price from store package
   */
  formatPrice(pkg: PurchasesPackage): string {
    return pkg.product.priceString;
  }

  /**
   * Get savings percentage for yearly vs monthly
   */
  getSavingsPercentage(monthlyPkg: PurchasesPackage, yearlyPkg: PurchasesPackage): number {
    const monthlyAnnual = monthlyPkg.product.price * 12;
    const yearlyPrice = yearlyPkg.product.price;
    const savings = ((monthlyAnnual - yearlyPrice) / monthlyAnnual) * 100;
    return Math.round(savings);
  }
}

// Export singleton instance
export const purchaseService = new PurchaseService();

// Export hook for products
export const usePurchaseProducts = () => {
  // This would be used with React Query or similar for caching
  // For now, return static products (real prices come from RevenueCat)
  return SUBSCRIPTION_PRODUCTS;
};
