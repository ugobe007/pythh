# Stripe Integration Setup Guide - PYTHH Freemium

## Overview
**PYTHH** uses Stripe for freemium subscriptions. The integration is **fully implemented** in [server/index.js](server/index.js) (lines 1304-1650). This guide walks through configuration only.

## 1. Stripe Dashboard Setup

### Create Products & Prices
Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products) (Test Mode) and create:

#### Pro Tier ($49/month)

| Product | Monthly Price | Yearly Price | Price ID Env Var |
|---------|---------------|--------------|-------------------|
| **Pro** | $49/month | $468/year ($39/mo) | `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_ANNUAL` |

**Features:** Unlimited analyses, investor contact info, match history, signal alerts

#### Signal Navigator / Elite Tier ($99/month)

| Product | Monthly Price | Yearly Price | Price ID Env Var |
|---------|---------------|--------------|-------------------|
| **Signal Navigator** | $99/month | $948/year ($79/mo) | `STRIPE_PRICE_ELITE_MONTHLY` / `STRIPE_PRICE_ELITE_ANNUAL` |

**Features:** Everything in Pro + Signal Playbook, timing maps, real-time alerts, CSV export

### Get API Keys
1. Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your **Secret Key** (starts with `sk_test_` for test mode)

### Configure Webhook
1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set webhook endpoint URL:
   - **Development:** `http://localhost:3002/api/billing/webhook`
   - **Production:** `https://hot-honey.fly.dev/api/billing/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### Configure Customer Portal
1. Go to [Stripe Dashboard → Settings → Billing → Customer Portal](https://dashboard.stripe.com/settings/billing/portal)
2. Enable the portal
3. Configure:
   - Allow customers to update payment methods ✓
   - Allow customers to cancel subscriptions ✓
   - Allow customers to switch plans ✓

---

## 2. Environment Variables

### Local Development (.env)

Add to `.env` file in project root:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Product Price IDs (copy from Stripe dashboard)
STRIPE_PRICE_PRO_MONTHLY=price_YOUR_PRO_MONTHLY_ID
STRIPE_PRICE_ELITE_MONTHLY=price_YOUR_ELITE_MONTHLY_ID

# Optional URLs (defaults work for localhost:5173)
STRIPE_SUCCESS_URL=http://localhost:5173/billing/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=http://localhost:5173/pricing
STRIPE_PORTAL_RETURN_URL=http://localhost:5173/settings
```

### Production (Fly.io Secrets)

Set secrets for production deployment:

```bash
# Navigate to project directory
cd /Users/leguplabs/Desktop/hot-honey

# Set all Stripe secrets at once
flyctl secrets set \
  STRIPE_SECRET_KEY="sk_test_YOUR_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET" \
  STRIPE_PRICE_PRO_MONTHLY="price_YOUR_PRO_MONTHLY_ID" \
  STRIPE_PRICE_ELITE_MONTHLY="price_YOUR_ELITE_MONTHLY_ID" \
  STRIPE_SUCCESS_URL="https://hot-honey.fly.dev/billing/success?session_id={CHECKOUT_SESSION_ID}" \
  STRIPE_CANCEL_URL="https://hot-honey.fly.dev/pricing" \
  STRIPE_PORTAL_RETURN_URL="https://hot-honey.fly.dev/settings"
```

---

## 3. Database Schema (Already Exists)

The `profiles` table stores Stripe subscription data:

### `profiles` Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  plan TEXT DEFAULT 'free',              -- 'free' | 'pro' | 'elite'
  plan_status TEXT DEFAULT 'active',      -- 'active' | 'past_due' | 'canceled'
  stripe_customer_id TEXT,                -- Stripe customer ID
  stripe_subscription_id TEXT,            -- Stripe subscription ID
  current_period_end TIMESTAMPTZ,        -- Subscription renewal date
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Updated by Stripe webhooks:**
- `checkout.session.completed` → Sets plan to 'pro' or 'elite'
- `customer.subscription.updated` → Updates plan_status, current_period_end
- `customer.subscription.deleted` → Downgrades to 'free'

---

## 4. API Endpoints (Already Implemented)

All endpoints are live in [server/index.js](server/index.js):

| Endpoint | Method | Purpose | Auth Required? |
|----------|--------|---------|----------------|
| `/api/billing/create-checkout-session` | POST | Create Stripe Checkout (logged-in users) | ✅ Yes |
| `/api/billing/create-guest-checkout` | POST | Create Stripe Checkout (new users) | ❌ No |
| `/api/billing/status` | GET | Get current subscription status | ✅ Yes |
| `/api/billing/create-portal-session` | POST | Create Customer Portal session | ✅ Yes |
| `/api/billing/webhook` | POST | Handle Stripe webhook events | ❌ No (signature verified) |

**Webhook Events Handled:**
- `checkout.session.completed` → Upgrade user to paid plan
- `customer.subscription.updated` → Update plan/status/renewal date
- `customer.subscription.deleted` → Downgrade to free
- `invoice.payment_failed` → Mark as past_due

---

## 5. Testing Flow

### Test Mode Setup
1. Ensure you're in **Test Mode** in Stripe dashboard (toggle top right)
2. Use test card for payments:
   - **Card:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/34`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)

### Test the Freemium Flow

1. **Start dev servers:**
   ```bash
   npm run dev              # Frontend (port 5175)
   cd server && npm start   # Backend (port 3002)
   ```

2. **Hit the paywall:**
   - Visit http://localhost:5175/
   - Submit 6 URLs to exhaust free analyses
   - Paywall modal should appear on 6th submission

3. **Navigate to pricing:**
   - Click "Upgrade to Pro - $49/month"
   - Should redirect to `/pricing?source=analysis_limit`

4. **Test checkout (without auth):**
   - Click "Upgrade to Pro" button
   - Should redirect to Stripe Checkout
   - Complete payment with test card
   - Should redirect to success page

5. **Verify webhook delivery:**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Check endpoint logs
   - Should see `checkout.session.completed` with 200 response

6. **Verify database update:**
   ```sql
   SELECT id, email, plan, plan_status, stripe_customer_id
   FROM profiles
   WHERE plan = 'pro';
   ```

### Test Webhook Locally (Optional)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3002/api/billing/webhook

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

## 6. Freemium User Flow

```
User visits homepage (hot-honey.fly.dev)
    ↓
Submits startup URL for analysis
    ↓
[1st-5th submission] → Shows "X analyses remaining" counter
    ↓
[6th submission] → Paywall modal appears 🔒
    ↓
Clicks "Upgrade to Pro - $49/month"
    ↓
Redirects to /pricing?source=analysis_limit
    ↓
[Guest user] → Clicks "Upgrade to Pro" → Stripe Checkout (guest flow)
[Logged-in] → Clicks "Upgrade to Pro" → Stripe Checkout (auth flow)
    ↓
Completes payment (test card: 4242 4242 4242 4242)
    ↓
Stripe webhook → Updates profiles table (plan: 'pro')
    ↓
Redirects to /billing/success with 🎉
    ↓
User can submit unlimited analyses
    ↓
[Later] Manage subscription at /settings → Customer Portal
```

**Key Metrics:**
- 10K MAU × 15% submission = 1,500 URL submissions
- 1,500 submissions × 15% paywall hit = 225 Pro users
- 225 Pro users × $49/mo = **$11K MRR**

---

## 7. Managing Subscriptions

### Customer Portal
Users can manage subscriptions via Customer Portal:
- **Route:** Click "Manage Subscription" in settings
- **API:** `POST /api/billing/create-portal-session`
- **Allows:** Update payment method, cancel subscription, download invoices

### Admin Access
View subscriptions:
- **Stripe Dashboard:** https://dashboard.stripe.com/test/subscriptions
- **Database:** Query `profiles` table where `plan != 'free'`

```sql
-- Active Pro/Elite subscribers
SELECT 
  id,
  email,
  plan,
  plan_status,
  current_period_end,
  stripe_subscription_id
FROM profiles
WHERE plan IN ('pro', 'elite')
  AND plan_status = 'active'
ORDER BY current_period_end DESC;
```

---

## 8. Revenue Reports

### Stripe Dashboard
- **Revenue:** https://dashboard.stripe.com/test/revenue
- **Subscriptions:** https://dashboard.stripe.com/test/subscriptions
- **Customers:** https://dashboard.stripe.com/test/customers

### Custom Queries

```sql
-- Monthly Recurring Revenue (MRR)
SELECT 
  plan,
  COUNT(*) as active_subscribers,
  CASE 
    WHEN plan = 'pro' THEN COUNT(*) * 49
    WHEN plan = 'elite' THEN COUNT(*) * 99
    ELSE 0
  END as monthly_revenue
FROM profiles
WHERE plan_status = 'active' AND plan != 'free'
GROUP BY plan;

-- Conversion Rate from Freemium
WITH total_users AS (
  SELECT COUNT(*) as total FROM profiles
),
paying_users AS (
  SELECT COUNT(*) as paying FROM profiles 
  WHERE plan IN ('pro', 'elite') AND plan_status = 'active'
)
SELECT 
  paying,
  total,
  ROUND((paying::NUMERIC / total * 100), 2) as conversion_rate_pct
FROM total_users, paying_users;

-- Churn Rate (last 30 days)
SELECT 
  COUNT(*) FILTER (WHERE plan_status = 'canceled' AND updated_at >= NOW() - INTERVAL '30 days') as churned,
  COUNT(*) FILTER (WHERE plan IN ('pro', 'elite')) as total_subscribers,
  ROUND(
    COUNT(*) FILTER (WHERE plan_status = 'canceled' AND updated_at >= NOW() - INTERVAL '30 days')::NUMERIC 
    / NULLIF(COUNT(*) FILTER (WHERE plan IN ('pro', 'elite')), 0) * 100, 
    2
  ) as churn_rate_pct
FROM profiles;
```

---

## 9. Troubleshooting

### Common Issues

**"STRIPE_SECRET_KEY not configured" Error**
- Check `.env` file has `STRIPE_SECRET_KEY=sk_test_...`
- Restart server: `cd server && npm start`
- Verify environment variable: `node -e "console.log(process.env.STRIPE_SECRET_KEY)"`

**Webhook 400 Error "Signature verification failed"**
- Check webhook signing secret matches `.env` file
- Verify endpoint URL is correct in Stripe dashboard
- Check server logs: `tail -f server/logs/server.log`

**Payment Succeeds But User Not Upgraded**
- Check webhook events in Stripe dashboard (should show 200 response)
- Verify `metadata.supabase_user_id` is present in checkout session
- Check server logs for webhook processing errors
- Manually check `profiles` table for updated record

**Customer Portal Button Not Working**
- User must have `stripe_customer_id` set in `profiles` table
- Check `profiles.stripe_customer_id` is not null
- Verify auth token is valid and passed in Authorization header

**Paywall Not Showing After 5 Submissions**
- Check localStorage: `localStorage.getItem('pythh_usage_data')`
- Reset for testing: `localStorage.removeItem('pythh_usage_data')`
- Verify `hasHitLimit` logic in [PythhMain.tsx](src/pages/PythhMain.tsx)

---

## 10. Going Live Checklist

### Before Production Launch

- [ ] Switch Stripe dashboard to **Live Mode**
- [ ] Create live products and prices (Pro $49/mo, Elite $99/mo)
- [ ] Copy live price IDs
- [ ] Update Fly.io secrets with **live keys** (replace `sk_test_` with `sk_live_`)
- [ ] Create production webhook endpoint: `https://hot-honey.fly.dev/api/billing/webhook`
- [ ] Update webhook signing secret in Fly.io
- [ ] Test full flow with real card (small amount first!)
- [ ] Enable Stripe Radar for fraud protection
- [ ] Set up Stripe email notifications for:
  - Failed payments
  - Disputes
  - Refunds
- [ ] Configure tax settings if applicable (Stripe Tax)
- [ ] Set up Stripe billing alerts for unusual activity
- [ ] Document customer support process for billing issues

### Post-Launch Monitoring

- [ ] Track conversion funnel: Paywall → Pricing → Checkout → Payment
- [ ] Monitor webhook delivery success rate (should be >99%)
- [ ] Set up alerts for failed payments
- [ ] Weekly MRR/churn reports
- [ ] Customer feedback on pricing

---

## 11. Next Steps (Phase 1 Week 3-4)

**Completed:**
- ✅ Freemium paywall (5 free analyses)
- ✅ Pricing page with Pro/Elite tiers
- ✅ Usage tracking with localStorage
- ✅ Stripe integration (backend fully implemented)

**Ready to Configure:**
- ⏳ **Stripe setup** (this guide) - Create products, add env vars
- ⏳ **Supabase Auth** - Email/password + Google/GitHub social login
- ⏳ **Pro user bypass** - Check subscription status before showing paywall
- ⏳ **Dashboard page** - Show saved analyses + match history
- ⏳ **Email alerts** - Hot match notifications for Pro users

**Phase 1 Target:**
- 10K MAU → 1,500 submissions → 225 Pro users → **$11K MRR** 🚀

---

## Support Resources

- **Stripe Docs:** https://docs.stripe.com/
- **Test Cards:** https://docs.stripe.com/testing#cards
- **Webhook Testing:** https://docs.stripe.com/webhooks/test
- **Customer Portal:** https://docs.stripe.com/billing/subscriptions/integrating-customer-portal
- **Stripe CLI:** https://docs.stripe.com/stripe-cli
