# Prompt 11: Stripe Billing Integration - COMPLETE

## What Was Implemented

### 1. Database: profiles table
**File:** [migrations/001_create_profiles_table.sql](migrations/001_create_profiles_table.sql)

Creates a `profiles` table linked to `auth.users` with:
- `stripe_customer_id` - Links Supabase user to Stripe customer
- `stripe_subscription_id` - Active subscription ID
- `plan` - Current plan: 'free' | 'pro' | 'elite'
- `plan_status` - Subscription status: 'active' | 'canceled' | 'past_due' | 'trialing'
- `current_period_end` - When current billing period ends

Auto-creates profiles for new signups via trigger.

### 2. Server Endpoints
**File:** [server/index.js](server/index.js) (lines ~573-920)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/billing/create-checkout-session` | POST | Creates Stripe Checkout session for upgrading |
| `/api/billing/create-portal-session` | POST | Opens Stripe Customer Portal for managing subscription |
| `/api/billing/webhook` | POST | Handles Stripe webhook events (signature verified) |
| `/api/billing/status` | GET | Returns current subscription status |

### 3. Plan Resolution Updated
**File:** [server/index.js](server/index.js) - `getPlanFromRequest()`

Now reads from `profiles` table (source of truth updated by Stripe webhooks):
1. Verify JWT via `auth.getUser(token)`
2. Query `profiles` table for plan
3. Cache result for 5 minutes
4. Fallback to user_metadata (legacy)
5. Default to 'free'

Only honors 'active' or 'trialing' subscriptions - past_due/canceled returns 'free'.

### 4. Frontend Hook
**File:** [src/hooks/useBilling.ts](src/hooks/useBilling.ts)

```typescript
import { useBilling } from '@/hooks/useBilling';

function MyComponent() {
  const { 
    plan,           // 'free' | 'pro' | 'elite'
    planStatus,     // 'active' | 'canceled' | etc
    isLoading,
    hasSubscription,
    createCheckoutSession,  // (plan) => Promise<url>
    openBillingPortal,      // () => Promise<url>
    refresh
  } = useBilling();
  
  const handleUpgrade = async () => {
    const url = await createCheckoutSession('pro');
    if (url) window.location.href = url;
  };
}
```

### 5. Environment Variables
**File:** [STRIPE_ENV_TEMPLATE.txt](STRIPE_ENV_TEMPLATE.txt)

Required env vars to add to `.env`:
```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx    # $99/mo
STRIPE_PRICE_ELITE_MONTHLY=price_xxx  # $399/mo
```

---

## Setup Steps

### 1. Run the Database Migration
```sql
-- In Supabase SQL Editor, run:
-- migrations/001_create_profiles_table.sql
```

### 2. Create Stripe Products
In Stripe Dashboard > Products:
- **Pro Plan**: $99/month, recurring
- **Elite Plan**: $399/month, recurring
- Copy the Price IDs

### 3. Set Environment Variables
Add to `.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_ELITE_MONTHLY=price_...
```

### 4. Set Up Webhook (for production)
Stripe Dashboard > Webhooks > Add endpoint:
- URL: `https://yourapp.com/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 5. Local Testing with Stripe CLI
```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3002/api/billing/webhook
# Copy the webhook signing secret
```

---

## Flow Diagram

```
User clicks "Upgrade to Pro"
         ↓
Frontend calls createCheckoutSession('pro')
         ↓
POST /api/billing/create-checkout-session
         ↓
Server creates Stripe Checkout Session
         ↓
Redirect to Stripe Checkout
         ↓
User enters payment info
         ↓
Stripe sends webhook: checkout.session.completed
         ↓
POST /api/billing/webhook
         ↓
Server updates profiles table: plan='pro', plan_status='active'
         ↓
Next API call reads plan from profiles table
         ↓
User sees Pro tier content!
```

---

## Files Changed

| File | Change |
|------|--------|
| `server/index.js` | Added billing endpoints, updated `getPlanFromRequest()` |
| `src/hooks/useBilling.ts` | NEW - Frontend billing hook |
| `migrations/001_create_profiles_table.sql` | NEW - Database migration |
| `STRIPE_ENV_TEMPLATE.txt` | NEW - Env var template |
| `package.json` | Added `stripe` dependency |

---

## Testing

### Without Stripe configured:
- All users default to 'free' plan
- Billing endpoints return "STRIPE_SECRET_KEY not configured" error

### With Stripe test mode:
1. Add test keys to `.env`
2. Use Stripe CLI for local webhook testing
3. Use test card: `4242 4242 4242 4242`

### Production checklist:
- [ ] Run migration on production Supabase
- [ ] Set live Stripe keys in production env
- [ ] Configure webhook endpoint in Stripe Dashboard
- [ ] Test full checkout flow with test cards
- [ ] Switch to live mode

---

*Prompt 11 complete. Ready for Prompts 12-13 (CSV Export, Alerts).*
