# Observatory Invite Email Template

**Purpose:** First communication when investor is granted access to the observatory  
**Tone:** Premium, intelligence-oriented, zero sales language  
**Goal:** Frame this as a perception layer, not a marketplace

---

## Email Template

**Subject:** Your access to [pyth] observatory

---

**Body:**

[Investor Name],

Everyone sees the surface. You see the patterns.

We've opened observatory access for you—an intelligence layer that tracks how early-stage discovery is forming around your investment thesis.

**Access:** https://hot-honey.fly.dev/investor-dashboard  
**Invite code:** `[GENERATED_CODE]`

---

### What this is

This is not deal flow. This is not a marketplace.

The observatory shows you **anonymized signals** forming in real time:
- What sectors are entering your alignment orbit
- How timing patterns shift across stages
- Where signal strength clusters before the market notices

You observe discovery. You don't receive pitches.

---

### First 72 hours

Log in and watch your discovery flow populate. You'll see:

- **Pattern drivers:** What's bringing startups into your orbit  
- **Entry signals:** How companies surface based on your thesis  
- **Timing readiness:** Early vs ready-to-deploy capital

Use the feedback controls (👍 👎 ⏸) to refine what signals matter to you.

---

### What you won't see

- Founder names or contact info
- Exact GOD scores or rankings
- Individual startup identification
- Any form of messaging or inbox

This is observatory-grade intelligence, not a CRM.

---

### Support

Questions? Reply to this email or visit the [health dashboard](https://hot-honey.fly.dev/admin/health).

Your access expires: **[EXPIRATION_DATE]**

— The [pyth] ai team

---

P.S. You're one of our first pilot investors. Your feedback shapes how this evolves. What patterns are you seeing?

---

## Alternative Shorter Version (If Email is Too Long)

**Subject:** Observatory access granted

---

[Investor Name],

Everyone sees the surface. You see the patterns.

Your observatory access is live: https://hot-honey.fly.dev/investor-dashboard

**What this is:**  
An intelligence layer that shows you how discovery is forming around your investment thesis.

**What this isn't:**  
Deal flow, marketplace, or inbox. You observe anonymized signals—you don't receive pitches.

**First step:**  
Log in. Watch your discovery flow populate. Use 👍 👎 ⏸ to refine what signals matter.

Your invite code: `[GENERATED_CODE]`  
Access expires: **[EXPIRATION_DATE]**

Questions? Reply here.

— [pyth] ai

---

## SMS/Slack Version (Ultra-Short)

```
Observatory access granted.

Everyone sees the surface. You see the patterns.

Login: https://hot-honey.fly.dev/investor-dashboard
Code: [GENERATED_CODE]

This is intelligence, not deal flow. You observe signals—not pitches.

— [pyth] ai
```

---

## Key Copywriting Principles Applied

1. **Open with identity line:** "Everyone sees the surface. You see the patterns."
2. **Define what it IS first:** Intelligence layer, observatory
3. **Then define what it ISN'T:** Not deal flow, not marketplace, not inbox
4. **Zero product jargon:** No "unlock," "features," "tiers," "premium"
5. **Premium tone:** Feels like Palantir invite, not SaaS trial
6. **Action-oriented:** Clear first step (log in, watch, refine)
7. **Reinforces principles:** Observatory purity maintained throughout

---

## Personalization Variables

| Variable | Example | Source |
|----------|---------|--------|
| `[Investor Name]` | Sarah Chen | `investors.name` |
| `[GENERATED_CODE]` | PILOT-AMEX-2026 | `investor_observatory_access.invite_code` |
| `[EXPIRATION_DATE]` | March 31, 2026 | `investor_observatory_access.expires_at` |
| `[ACCESS_LEVEL]` | standard | `investor_observatory_access.access_level` |

---

## Implementation Notes

### Send Trigger

```sql
-- After granting access via SQL
INSERT INTO investor_observatory_access (...) VALUES (...);

-- Trigger email send via Supabase function or external service
SELECT send_observatory_invite_email(
  investor_id := '<uuid>',
  invite_code := 'PILOT-<NAME>-2026',
  expires_at := '2026-03-31 23:59:59+00'
);
```

### Email Service Options

**Option 1: Resend (Recommended)**
- Transactional email API
- Clean HTML templates
- Delivery tracking
- Cost: ~$0.001 per email

**Option 2: SendGrid**
- More robust tracking
- A/B testing built-in
- Cost: Free tier → 100 emails/day

**Option 3: Supabase Edge Function + SMTP**
- Full control
- No third-party dependency
- Cost: Free (compute only)

---

## A/B Test Variants (Future)

### Variant A: Current (Identity-first)
```
Everyone sees the surface. You see the patterns.

Your observatory access is live...
```

### Variant B: Capability-first
```
Your intelligence layer for early-stage discovery is ready.

Everyone sees the surface. You see the patterns.

Access: https://...
```

### Variant C: Urgency-first
```
Your observatory access expires March 31.

Everyone sees the surface. You see the patterns.

Log in now: https://...
```

**Hypothesis:** Variant A (identity-first) will have highest click-through because it positions the investor before describing the tool.

---

## Legal/Compliance Notes

- ✅ No claims about returns or performance
- ✅ No guarantees about deal sourcing
- ✅ Clear that this is observational intelligence
- ✅ Expiration date disclosed
- ✅ Contact method provided
- ✅ No promotional language (no "free," "trial," "upgrade")

---

## Success Metrics (First 7 Days)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Email open rate | >60% | Resend/SendGrid tracking |
| Click-through to dashboard | >40% | UTM params + session start |
| First login within 48h | >70% | `investor_observatory_sessions.session_start` |
| Feedback submissions (👍/👎/⏸) | >3 per investor | `investor_inbound_feedback.created_at` |
| Session depth (items viewed) | >10 | `investor_observatory_sessions.items_viewed` |

---

## Related Documentation

- [PHASE5_OPERATIONS_PLAYBOOK.md](PHASE5_OPERATIONS_PLAYBOOK.md) - Pilot investor selection
- [OBSERVATORY_SECURITY_HARDENING.md](OBSERVATORY_SECURITY_HARDENING.md) - Security principles
- [OBSERVATORY_3_COMMIT_SUMMARY.md](OBSERVATORY_3_COMMIT_SUMMARY.md) - Latest product updates

---

**Status:** Ready for implementation  
**Owner:** Product team  
**Review:** Legal (no compliance issues)  
**Last updated:** January 18, 2026
