# 🎁 Referral System Implementation - Prompt 24

## Overview

**"Invite 3, Get 7 Days Elite"** - A production-safe referral system with Stripe-safe entitlements overlay.

### Key Features
- ✅ **Entitlements Overlay**: Temporary access upgrades without touching Stripe subscriptions
- ✅ **3-for-7 Reward**: Invite 3 friends who activate → Get 7 days Elite access
- ✅ **Invitee Bonus**: New signups get 3 days Pro trial
- ✅ **Anti-Abuse**: Rate limits, unique constraints, advisory locks
- ✅ **Full Analytics**: All referral events tracked in events table

---

## 1. Database Migration

### Apply Migration

1. Open **Supabase Dashboard** → SQL Editor
2. Copy and paste the contents of `supabase/migrations/007_referrals.sql`
3. Run the query

### Tables Created

| Table | Purpose |
|-------|---------|
| `invites` | Stores invite tokens and their lifecycle (created → opened → accepted) |
| `referral_progress` | Tracks inviter's activated referrals count |
| `entitlements` | Stripe-safe overlay for temporary plan upgrades |
| `invite_activations` | Prevents double-counting same invitee |

### RLS Policies

- ✅ Users can only read their own invites
- ✅ Users can only read their own entitlements
- ✅ Users can only read their own referral progress

---

## 2. Server Implementation

### New Endpoints

#### `POST /api/invites/create`
**Auth Required**: Yes  
**Purpose**: Generate a new invite link  
**Rate Limit**: 50 invites per day per user

```bash
curl -X POST http://localhost:3002/api/invites/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "invite_url": "https://pythh.ai/i/abc123...",
  "token": "abc123...",
  "expires_at": "2026-02-16T12:00:00Z"
}
```

#### `GET /i/:token`
**Auth Required**: No  
**Purpose**: Redirect invite link to signup  
**Behavior**:
1. Validates token exists and not expired
2. Updates invite status to 'opened' (first time)
3. Logs `invite_opened` event
4. Redirects to `/signup?invite=<token>`

#### `POST /api/invites/accept`
**Auth Required**: Yes  
**Purpose**: Accept invite after signup

```bash
curl -X POST http://localhost:3002/api/invites/accept \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123..."}'
```

**Response:**
```json
{
  "success": true,
  "inviter_progress": {
    "activated_count": 1,
    "target": 3
  }
}
```

**Side Effects:**
- Marks invite as 'accepted'
- Grants invitee 3-day Pro entitlement
- Logs `invite_accepted` event

#### `GET /api/referrals/status`
**Auth Required**: Yes  
**Purpose**: Get user's referral progress

```bash
curl http://localhost:3002/api/referrals/status \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "activated_count": 2,
  "target": 3,
  "reward_active": false,
  "reward_expires_at": null,
  "invites": [
    {
      "id": "...",
      "token": "...",
      "status": "accepted",
      "created_at": "2026-01-17T10:00:00Z",
      "accepted_at": "2026-01-17T10:05:00Z"
    }
  ]
}
```

### Updated Functions

#### `getPlanFromRequest(req)`
**Changes**: Now checks entitlements **before** falling back to Stripe/profiles

```javascript
// NEW: Checks entitlements first
const effectivePlan = await getEffectivePlan(user.id);
// Returns: elite (if entitled) > pro (if entitled) > Stripe plan > free
```

#### `getEffectivePlan(userId)`
**Purpose**: Read effective plan including entitlements overlay

**Logic**:
1. Query `entitlements` table for active (not expired) rows
2. If elite entitlement exists → return 'elite'
3. If pro entitlement exists → return 'pro'
4. Else fallback to `profiles.plan` (Stripe SSOT)
5. Else return 'free'

#### `maybeCreditReferralActivation(userId)`
**Trigger**: Called when user adds first startup to watchlist  
**Purpose**: Credit inviter with 1 activation

**Logic**:
1. Find accepted invite for this invitee
2. Insert into `invite_activations` (unique constraint prevents double-count)
3. Increment `referral_progress.activated_invitees_count`
4. If count reaches 3 → Grant inviter 7-day Elite entitlement
5. Log `referral_activation` and `reward_granted` events

---

## 3. Frontend Implementation

### Components

#### `ReferralCard.tsx`
**Location**: `src/components/ReferralCard.tsx`  
**Usage**: Added to Settings page after Account section

**Features**:
- Progress bar (X / 3 activated)
- "Copy Invite Link" button
- Active reward banner (if Elite unlocked)
- Recent invites table with status
- "How it works" accordion

**Events Tracked**:
- `referral_card_viewed`
- `invite_link_copied`

### Hooks

#### `useReferrals()`
**Location**: `src/hooks/useReferrals.ts`

**Returns**:
```typescript
{
  status: ReferralStatus | null,
  loading: boolean,
  error: string | null,
  createInvite: () => Promise<{invite_url, token}>,
  refreshStatus: () => Promise<void>
}
```

### Signup Flow

#### `SignupFounder.tsx`
**Updated**: Already handles invite acceptance

**Flow**:
1. User lands on `/i/:token` → redirected to `/signup?invite=<token>`
2. Token stored in localStorage via `storePendingInvite(token)`
3. After successful signup → `acceptInvite(token)` called automatically
4. Logs `invite_accepted` event
5. Invitee gets 3-day Pro trial entitlement

---

## 4. Analytics Events

### New Events Added to Allowlist

```javascript
const VALID_EVENT_NAMES = new Set([
  // ... existing events ...
  'invite_created',      // Inviter creates link
  'invite_opened',       // Someone clicks /i/:token
  'invite_accepted',     // Invitee signs up and accepts
  'referral_activation', // Invitee watches first startup
  'reward_granted',      // Inviter earns 7 days Elite
  'invite_link_copied',  // User copies link to clipboard
  'referral_card_viewed' // User views referral card
]);
```

### Admin Dashboard

**Endpoint**: `GET /api/admin/metrics/v2/overview`  
**Added Section**: `referrals`

```json
{
  "referrals": {
    "invite_created": 42,
    "invite_opened": 38,
    "invite_accepted": 25,
    "referral_activation": 18,
    "reward_granted": 6
  }
}
```

---

## 5. Testing Guide (5 Minutes)

### Step 1: Create Invite (User A)
```bash
# Login as User A
curl -X POST http://localhost:3002/api/invites/create \
  -H "Authorization: Bearer <token_A>"
  
# Response: {"invite_url": "http://localhost:5173/i/abc123..."}
```

### Step 2: Open Invite (Incognito)
```bash
# Open in incognito browser
http://localhost:5173/i/abc123...

# Should redirect to: /signup?invite=abc123...
# Check server logs for "invite_opened" event
```

### Step 3: Sign Up as User B
```bash
# Complete signup form
# After signup, should auto-call /api/invites/accept
# Check server logs for "invite_accepted" event

# Verify User B has 3-day Pro trial:
SELECT * FROM entitlements WHERE user_id = '<user_B_id>';
# Should show: entitlement='pro', source='referral_invitee_trial'
```

### Step 4: User B Watches Startup
```bash
# User B adds startup to watchlist
curl -X POST http://localhost:3002/api/watchlist/add \
  -H "Authorization: Bearer <token_B>" \
  -d '{"startup_id": "<any_startup_id>"}'

# Check server logs for "referral_activation" event
# Verify inviter progress incremented:
SELECT * FROM referral_progress WHERE inviter_user_id = '<user_A_id>';
# Should show: activated_invitees_count = 1
```

### Step 5: Repeat for Users C & D
Repeat steps 2-4 with two more users.

After 3rd activation:
```sql
-- User A should have Elite entitlement
SELECT * FROM entitlements 
WHERE user_id = '<user_A_id>' 
  AND entitlement = 'elite' 
  AND source = 'referral';

-- Should show: expires_at = now() + 7 days
```

### Step 6: Verify Plan Access
```bash
# User A makes authenticated request
# getPlanFromRequest should return 'elite' (not 'free')
curl http://localhost:3002/api/profile \
  -H "Authorization: Bearer <token_A>"

# Response should show: "plan": "elite"
```

---

## 6. Anti-Abuse Safeguards

| Protection | Implementation |
|------------|----------------|
| Rate Limiting | 50 invites max per day per user |
| Self-Invite Prevention | Cannot accept own invite (server validates) |
| Double-Count Prevention | `unique(inviter_user_id, invitee_user_id)` constraint |
| Token Expiry | Invites expire after 30 days |
| Advisory Locks | Prevents race conditions in activation crediting |

---

## 7. Important Notes

### Why Entitlements Instead of Stripe?

**Problem**: Updating Stripe subscription dates for rewards causes webhook conflicts and billing issues.

**Solution**: Entitlements overlay:
- ✅ Grants temporary access without touching Stripe
- ✅ `getPlanFromRequest()` reads entitlements first
- ✅ Webhooks can't overwrite entitlements
- ✅ When entitlement expires → falls back to Stripe plan gracefully

### Activation Trigger

**Current**: First watchlist add = activation  
**Why**: Simple, measurable, high-value action

**Alternative triggers** (if needed):
- Export CSV
- Share a startup
- Return visit after 7 days

To change trigger point, update the `maybeCreditReferralActivation()` call location in `server/index.js`.

---

## 8. Admin Queries

### Check Referral Health
```sql
-- How many active referral campaigns?
SELECT COUNT(DISTINCT inviter_user_id) as active_inviters
FROM invites
WHERE created_at > now() - interval '7 days';

-- How many rewards granted?
SELECT COUNT(*) as rewards_granted
FROM entitlements
WHERE entitlement = 'elite' AND source = 'referral';

-- Top inviters
SELECT 
  inviter_user_id,
  COUNT(*) as invites_sent,
  SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
  activated_invitees_count
FROM invites
LEFT JOIN referral_progress USING (inviter_user_id)
GROUP BY inviter_user_id, activated_invitees_count
ORDER BY activated_invitees_count DESC
LIMIT 10;
```

### Manually Grant Entitlement
```sql
-- Grant user 7 days Elite
INSERT INTO entitlements (user_id, entitlement, source, expires_at)
VALUES (
  '<user_id>',
  'elite',
  'admin',
  now() + interval '7 days'
);
```

---

## 9. Environment Variables

No new env vars required! Uses existing:
- `APP_BASE_URL` - For generating invite links (defaults to `https://pythh.ai`)
- `VITE_API_URL` - Frontend API endpoint

---

## 10. Files Changed

### New Files
- ✅ `supabase/migrations/007_referrals.sql` - Database schema
- ✅ `src/hooks/useReferrals.ts` - React hook
- ✅ `src/components/ReferralCard.tsx` - UI component

### Modified Files
- ✅ `server/index.js` - API endpoints + entitlement logic
- ✅ `src/pages/Settings.tsx` - Added ReferralCard
- ✅ `src/pages/InviteLanding.tsx` - Simplified redirect
- ✅ `src/lib/referral.ts` - Updated API calls

---

## 11. Next Steps (Optional Enhancements)

### Short Term
- [ ] Add email notifications when inviter earns reward
- [ ] Show referral leaderboard on homepage
- [ ] Add social share buttons (Twitter, LinkedIn)

### Medium Term
- [ ] Tiered rewards: 3=7 days, 10=30 days, 50=lifetime
- [ ] Referral dashboard with analytics
- [ ] Custom invite codes instead of random tokens

### Long Term
- [ ] Affiliate program: Pay cash for conversions
- [ ] Partner API: Let others create referral links
- [ ] Invite contests: Top referrer wins prize

---

## 🚀 Launch Checklist

Before enabling in production:

- [ ] Apply migration to production database
- [ ] Verify `APP_BASE_URL` env var is correct
- [ ] Test full flow with 3 test accounts
- [ ] Monitor `ai_logs` for errors in first 24 hours
- [ ] Check admin metrics after 7 days
- [ ] Announce referral program to users (email blast)
- [ ] Add referral CTA to post-signup flow

---

**Status**: ✅ Production Ready  
**Reviewed**: Yes  
**Stripe-Safe**: Yes  
**Rate-Limited**: Yes  
**Analytics**: Fully tracked
