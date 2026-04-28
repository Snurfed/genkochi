# PhotoLingo Subscription Implementation Guide

## Overview

This guide covers the complete freemium subscription model implementation for PhotoLingo.

## Files Created

```
src/
├── types/
│   └── subscription.ts         # Subscription types and constants
├── store/
│   └── subscriptionStore.ts    # Zustand subscription state management
├── services/
│   ├── purchaseService.ts      # RevenueCat integration (StoreKit/Play Billing)
│   └── analyticsService.ts     # Subscription event tracking
├── hooks/
│   └── useSubscription.ts      # React hooks for feature gating
├── components/
│   ├── Paywall.tsx             # Full paywall modal UI
│   └── PremiumFeatureLock.tsx  # Feature lock overlay components
docs/
├── SUBSCRIPTION_IMPLEMENTATION.md  # This file
└── SUBSCRIPTION_BACKEND.md         # Backend validation guide
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install RevenueCat SDK
npx expo install react-native-purchases

# Required peer dependencies (should already be installed)
npx expo install expo-linear-gradient expo-blur
```

### 2. Configure RevenueCat

1. Create account at [RevenueCat](https://www.revenuecat.com)
2. Create new project and add iOS/Android apps
3. Get API keys from RevenueCat dashboard
4. Update keys in `src/services/purchaseService.ts`:

```typescript
const REVENUECAT_API_KEY_IOS = 'your_ios_api_key';
const REVENUECAT_API_KEY_ANDROID = 'your_android_api_key';
```

### 3. Configure Products in App Stores

**App Store Connect (iOS):**
1. Create In-App Purchases: Auto-Renewable Subscriptions
2. Product IDs:
   - `com.photolingo.premium.monthly` - $9.99/month
   - `com.photolingo.premium.yearly` - $69.99/year with 7-day trial
3. Create Subscription Group

**Google Play Console (Android):**
1. Create Subscription products with same IDs
2. Configure base plans and offers

### 4. Initialize Purchase Service

In `app/_layout.tsx`:

```typescript
import { purchaseService } from '../src/services/purchaseService';
import { analyticsService } from '../src/services/analyticsService';

useEffect(() => {
  purchaseService.initialize();
  analyticsService.initialize();
}, []);
```

---

## UI Flow

### Paywall Trigger Points

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘

1. FIRST SCAN COMPLETE
   ┌──────────────────────┐
   │  User takes photo    │
   │  ↓                   │
   │  AI analyzes         │
   │  ↓                   │
   │  Shows results       │
   │  ↓                   │
   │  [1.5s delay]        │
   │  ↓                   │
   │  PAYWALL             │ ← "Unlock Your Full Potential"
   │  (dismissible)       │    7-day trial highlighted
   └──────────────────────┘

2. DAILY LIMIT REACHED (Free tier: 2 scans/day)
   ┌──────────────────────┐
   │  User attempts 3rd   │
   │  scan                │
   │  ↓                   │
   │  PAYWALL             │ ← "You've reached today's limit"
   │  (blocking)          │    Unlimited scans CTA
   └──────────────────────┘

3. PREMIUM FEATURE TAP
   ┌──────────────────────┐
   │  User taps locked    │
   │  feature             │
   │  ↓                   │
   │  PAYWALL             │ ← "Premium Feature"
   │  (dismissible)       │    Feature-specific benefits
   └──────────────────────┘

4. WORLD LIMIT REACHED
   ┌──────────────────────┐
   │  User tries to       │
   │  access 3rd+ world   │
   │  ↓                   │
   │  PAYWALL             │ ← "Explore More Worlds"
   │  (dismissible)       │    All 6 worlds unlocked
   └──────────────────────┘
```

### Paywall Screen Layout

```
┌─────────────────────────────────────────┐
│  [X]                                    │  ← Close button
│                                         │
│              ✨                         │  ← Gradient icon
│    Unlock Your Full Potential           │  ← Dynamic headline
│    Start your 7-day free trial          │  ← Subheadline
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📷  Unlimited Photo Scans       ✓│   │
│  │     Learn from any image         │   │
│  │─────────────────────────────────│   │
│  │ 💬  Full Sentence Breakdown     ✓│   │  ← Benefits list
│  │     Grammar & contextual phrases │   │
│  │─────────────────────────────────│   │
│  │ 🎤  Speaking Practice           ✓│   │
│  │ ✏️  Writing Practice            ✓│   │
│  │ 📊  Progress Tracking           ✓│   │
│  │ 🪐  All Memory Worlds           ✓│   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ◉ Yearly         [BEST VALUE]   │   │  ← Plan selection
│  │   7-day free trial, $69.99/year │   │
│  │                $5.83/mo  Save 42%│   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ○ Monthly                        │   │
│  │   $9.99/month                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      Start Free Trial            │   │  ← Primary CTA
│  └─────────────────────────────────┘   │
│                                         │
│  After your 7-day free trial, you'll   │  ← Trial terms
│  be charged $69.99/year...              │
│                                         │
│         Restore Purchases               │  ← Restore link
│                                         │
│    Terms of Service | Privacy Policy    │  ← Legal links
│                                         │
│  Payment will be charged to your Apple  │  ← Auto-renewal
│  ID account at confirmation...          │     disclosure
└─────────────────────────────────────────┘
```

---

## Code Integration Examples

### 1. Gate Photo Scanning

In `app/(tabs)/index.tsx`:

```typescript
import { useScanGate } from '../src/hooks/useSubscription';
import { Paywall } from '../src/components/Paywall';
import { ScanLimitBanner } from '../src/components/PremiumFeatureLock';

function CameraScreen() {
  const { canScan, scansRemaining, attemptScan, isPremium } = useScanGate();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger>('first_scan_complete');

  const handleCapture = async () => {
    // Check if scan is allowed
    if (!attemptScan()) {
      setPaywallTrigger('scan_limit_reached');
      setShowPaywall(true);
      return;
    }

    // Proceed with photo capture and analysis
    await captureAndAnalyze();
  };

  return (
    <View>
      {/* Show remaining scans banner for free users */}
      {!isPremium && (
        <ScanLimitBanner
          scansRemaining={scansRemaining}
          onUpgrade={() => {
            setPaywallTrigger('scan_limit_reached');
            setShowPaywall(true);
          }}
        />
      )}

      {/* Camera view */}
      <CameraView onCapture={handleCapture} />

      {/* Paywall modal */}
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger={paywallTrigger}
      />
    </View>
  );
}
```

### 2. Gate Premium Features

In `WordDetailCard.tsx`:

```typescript
import { PremiumFeatureLock, PremiumBadge } from '../components/PremiumFeatureLock';

// Wrap entire sections
<PremiumFeatureLock feature="sentenceBreakdown">
  <SentenceBreakdownSection word={word} />
</PremiumFeatureLock>

// Use compact lock for tab buttons
<TouchableOpacity>
  <Text>Speaking</Text>
  {!canAccessFeature('speakingFeedback') && <PremiumBadge />}
</TouchableOpacity>
```

### 3. Gate Memory Worlds

In Memory Worlds selector:

```typescript
import { useSubscription } from '../hooks/useSubscription';

function WorldSelector() {
  const { canAccess, showPaywall } = useSubscription();
  const hasAllWorlds = canAccess('allWorlds');

  const handleWorldSelect = (world: MemoryWorld, index: number) => {
    // Free users can only access first 2 worlds
    if (!hasAllWorlds && index >= 2) {
      showPaywall('world_limit_reached');
      return;
    }

    selectWorld(world);
  };

  return (
    <View>
      {worlds.map((world, index) => (
        <WorldCard
          key={world.id}
          world={world}
          locked={!hasAllWorlds && index >= 2}
          onPress={() => handleWorldSelect(world, index)}
        />
      ))}
    </View>
  );
}
```

### 4. Show Paywall After First Scan

In `usePhotoExploration.ts`:

```typescript
import { useScanGate } from './useSubscription';

export function usePhotoExploration() {
  const { recordScan } = useScanGate();
  const [showPaywall, setShowPaywall] = useState(false);

  const onPhotoAnalyzed = (lesson: PhotoLesson) => {
    const result = recordScan();

    // Show paywall after first scan (with delay)
    if (result.showPaywall) {
      setTimeout(() => {
        setShowPaywall(true);
      }, 1500);
    }
  };

  // ... rest of hook
}
```

---

## Feature Access Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Daily photo scans | 2 | Unlimited |
| Basic vocabulary | ✓ | ✓ |
| Word pronunciation | ✓ | ✓ |
| Basic quiz | ✓ | ✓ |
| Sentence breakdown | ✗ | ✓ |
| Grammar analysis | ✗ | ✓ |
| Speaking feedback | ✗ | ✓ |
| Writing practice | ✗ | ✓ |
| Progress tracking | ✗ | ✓ |
| AI contextual phrases | ✗ | ✓ |
| AI stories | ✗ | ✓ |
| Memory Worlds | 2 | 6 |
| Advanced quizzes | ✗ | ✓ |

---

## Analytics Events

| Event | When Triggered | Properties |
|-------|----------------|------------|
| `first_photo_scan` | User's very first scan | - |
| `paywall_view` | Paywall shown | trigger, scans_used_today |
| `paywall_dismiss` | User closes paywall | trigger |
| `subscription_started` | Purchase completed | product_id, price, is_trial |
| `trial_started` | Free trial begins | product_id, trial_days |
| `subscription_renewed` | Auto-renewal | product_id |
| `subscription_cancelled` | User cancels | reason |
| `subscription_expired` | Subscription ends | - |
| `daily_limit_reached` | Free user hits limit | scans_used |
| `restore_purchase` | Restore attempted | success |

---

## Testing Checklist

### Before Release

- [ ] Test purchase flow on iOS sandbox
- [ ] Test purchase flow on Android test track
- [ ] Verify trial starts and converts correctly
- [ ] Test subscription cancellation
- [ ] Test restore purchases
- [ ] Verify feature gating works correctly
- [ ] Test daily limit resets at midnight
- [ ] Verify paywall shows at correct times
- [ ] Test offline behavior
- [ ] Verify backend validation (if applicable)

### Legal Compliance

- [ ] Auto-renewal disclosure visible
- [ ] Terms of Service link works
- [ ] Privacy Policy link works
- [ ] Trial terms clearly stated
- [ ] Pricing clearly displayed
- [ ] Cancel instructions available

---

## Pricing Strategy

**Monthly: $9.99/month**
- No trial
- Lower commitment
- ~$120/year

**Yearly: $69.99/year (Best Value)**
- 7-day free trial
- 42% savings vs monthly
- ~$5.83/month
- Highlighted as recommended

---

## Support

For RevenueCat issues: [RevenueCat Support](https://www.revenuecat.com/docs)
For App Store issues: [App Store Connect Help](https://developer.apple.com/support/)
For Play Store issues: [Play Console Help](https://support.google.com/googleplay/android-developer/)
