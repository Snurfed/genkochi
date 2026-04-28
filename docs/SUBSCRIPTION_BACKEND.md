# Subscription Backend Validation Guide

This document explains how to securely validate subscriptions on your backend server.

## Why Backend Validation?

Client-side subscription checks can be bypassed. Always validate subscription status server-side for:
- API calls that provide premium content
- Generating AI responses
- Accessing premium data

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────>│   Your Backend  │────>│   RevenueCat    │
│  (PhotoLingo)   │     │     Server      │     │   Webhooks/API  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │    Database     │
                        │  (User + Sub)   │
                        └─────────────────┘
```

## Option 1: RevenueCat Webhooks (Recommended)

RevenueCat sends webhooks for subscription events. Set up a webhook endpoint:

### Webhook Events to Handle

| Event | Description | Action |
|-------|-------------|--------|
| `INITIAL_PURCHASE` | New subscription | Grant premium access |
| `RENEWAL` | Subscription renewed | Extend access period |
| `CANCELLATION` | User cancelled | Mark as cancelled, keep access until period ends |
| `EXPIRATION` | Subscription expired | Revoke premium access |
| `BILLING_ISSUE` | Payment failed | Send reminder, grace period |
| `PRODUCT_CHANGE` | Plan changed | Update subscription tier |

### Example Webhook Handler (Node.js/Express)

```typescript
// routes/webhooks/revenuecat.ts
import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Verify webhook signature
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

router.post('/revenuecat', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-revenuecat-signature'] as string;
  const payload = req.body.toString();

  // Verify signature
  if (!verifySignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(payload);
  const { event_type, app_user_id, product_id, expiration_at_ms } = event;

  try {
    switch (event_type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        await updateUserSubscription(app_user_id, {
          tier: 'premium',
          status: 'active',
          productId: product_id,
          expiresAt: new Date(expiration_at_ms),
        });
        break;

      case 'CANCELLATION':
        await updateUserSubscription(app_user_id, {
          status: 'cancelled',
          // Keep tier as 'premium' until expiration
        });
        break;

      case 'EXPIRATION':
        await updateUserSubscription(app_user_id, {
          tier: 'free',
          status: 'expired',
        });
        break;

      case 'BILLING_ISSUE':
        await handleBillingIssue(app_user_id);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

export default router;
```

## Option 2: Direct API Validation

For real-time validation, call RevenueCat's API:

```typescript
// services/subscriptionValidator.ts
import axios from 'axios';

const REVENUECAT_API_KEY = process.env.REVENUECAT_SECRET_KEY;
const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1';

interface SubscriberInfo {
  subscriber: {
    entitlements: {
      premium?: {
        expires_date: string;
        product_identifier: string;
        purchase_date: string;
      };
    };
    subscriptions: Record<string, {
      expires_date: string;
      is_sandbox: boolean;
      original_purchase_date: string;
      store: string;
      unsubscribe_detected_at?: string;
    }>;
  };
}

export async function validateSubscription(appUserId: string): Promise<{
  isPremium: boolean;
  expiresAt: Date | null;
  productId: string | null;
}> {
  try {
    const response = await axios.get<SubscriberInfo>(
      `${REVENUECAT_API_URL}/subscribers/${appUserId}`,
      {
        headers: {
          'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { subscriber } = response.data;
    const premiumEntitlement = subscriber.entitlements.premium;

    if (!premiumEntitlement) {
      return { isPremium: false, expiresAt: null, productId: null };
    }

    const expiresAt = new Date(premiumEntitlement.expires_date);
    const isPremium = expiresAt > new Date();

    return {
      isPremium,
      expiresAt,
      productId: premiumEntitlement.product_identifier,
    };
  } catch (error) {
    console.error('RevenueCat API error:', error);
    // Fail open or closed based on your preference
    return { isPremium: false, expiresAt: null, productId: null };
  }
}
```

## Database Schema

```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  revenuecat_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  tier VARCHAR(20) DEFAULT 'free', -- 'free' | 'premium'
  status VARCHAR(20) DEFAULT 'none', -- 'none' | 'active' | 'trial' | 'cancelled' | 'expired'
  product_id VARCHAR(100),
  platform VARCHAR(20), -- 'ios' | 'android'
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX idx_users_revenuecat_id ON users(revenuecat_id);
```

## API Middleware for Premium Features

```typescript
// middleware/requirePremium.ts
import { Request, Response, NextFunction } from 'express';
import { validateSubscription } from '../services/subscriptionValidator';

export async function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check cache first (Redis recommended)
  const cachedStatus = await getCachedSubscription(userId);

  if (cachedStatus) {
    if (cachedStatus.isPremium) {
      return next();
    }
    return res.status(403).json({
      error: 'Premium subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }

  // Validate with RevenueCat
  const subscription = await validateSubscription(userId);

  // Cache result (5 minute TTL)
  await cacheSubscription(userId, subscription, 300);

  if (!subscription.isPremium) {
    return res.status(403).json({
      error: 'Premium subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }

  next();
}

// Usage in routes
app.get('/api/premium/ai-story', requirePremium, generateAIStory);
app.post('/api/premium/speaking-feedback', requirePremium, analyzeSpeaking);
```

## Security Best Practices

### 1. Never Trust Client Data
```typescript
// BAD: Trusting client-sent subscription status
app.post('/api/scan', (req, res) => {
  if (req.body.isPremium) { // DON'T DO THIS
    // ...
  }
});

// GOOD: Validate on server
app.post('/api/scan', async (req, res) => {
  const subscription = await validateSubscription(req.user.id);
  if (subscription.isPremium) {
    // ...
  }
});
```

### 2. Validate Receipt Integrity
For extra security, validate receipts directly with Apple/Google:

```typescript
// iOS App Store validation
async function validateAppleReceipt(receiptData: string): Promise<boolean> {
  const response = await axios.post(
    'https://buy.itunes.apple.com/verifyReceipt', // Use sandbox URL for testing
    {
      'receipt-data': receiptData,
      'password': process.env.APPLE_SHARED_SECRET,
    }
  );

  return response.data.status === 0;
}
```

### 3. Handle Grace Periods
```typescript
function isInGracePeriod(subscription: Subscription): boolean {
  if (subscription.status !== 'billing_issue') return false;

  const gracePeriodDays = 16; // Apple's grace period
  const gracePeriodEnd = new Date(subscription.expiresAt);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

  return new Date() < gracePeriodEnd;
}
```

### 4. Log Subscription Events
```typescript
// Audit trail for subscription changes
async function logSubscriptionEvent(
  userId: string,
  event: string,
  details: Record<string, any>
) {
  await db.insert('subscription_events', {
    user_id: userId,
    event_type: event,
    details: JSON.stringify(details),
    ip_address: req.ip,
    created_at: new Date(),
  });
}
```

## Testing

### Test Scenarios

1. **New subscription** - Verify premium access granted
2. **Renewal** - Verify continued access
3. **Cancellation** - Verify access until period ends
4. **Expiration** - Verify access revoked
5. **Restore purchase** - Verify previous subscription restored
6. **Cross-platform** - iOS purchase works on Android and vice versa

### RevenueCat Sandbox Testing

1. Create sandbox test users in App Store Connect / Google Play Console
2. Configure RevenueCat to use sandbox environment
3. Use test card numbers provided by Apple/Google
4. Subscriptions renew quickly in sandbox (monthly = 5 min)

## Environment Variables

```bash
# .env
REVENUECAT_API_KEY_IOS=your_ios_api_key
REVENUECAT_API_KEY_ANDROID=your_android_api_key
REVENUECAT_SECRET_KEY=your_server_api_key
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret
APPLE_SHARED_SECRET=your_apple_shared_secret
```

## Monitoring

Set up alerts for:
- Webhook failures
- High rate of subscription validation failures
- Unusual subscription patterns (fraud detection)
- API rate limiting
