# Observatory Fixes - Deployment Checklist

**Date:** December 18, 2025  
**Target:** Production (https://hot-honey.fly.dev/investor-dashboard)

---

## Pre-Deployment

### 1. Database Migration
- [x] Migration created: `observatory_alignment_threshold_fix_v2.sql`
- [x] Migration applied successfully
- [x] Verified new distribution (24% high, 76% low)
- [ ] Backup database before deployment:
  ```bash
  # Using Supabase CLI
  npx supabase db dump > backup_pre_threshold_fix_$(date +%Y%m%d).sql
  ```

### 2. Frontend Changes
- [x] Type definitions updated (`observatoryTypes.ts`)
- [x] Service functions added (`investorObservatoryService.ts`)
- [x] Dashboard component updated (`InvestorDashboard.tsx`)
- [ ] TypeScript compilation passes:
  ```bash
  npm run build
  ```
- [ ] No console errors in dev mode:
  ```bash
  npm run dev
  # Navigate to /investor-dashboard and check console
  ```

### 3. Local Testing
- [ ] Start dev server: `npm run dev`
- [ ] Visit: http://localhost:5173/investor-dashboard
- [ ] Verify:
  - [ ] Alignment badges show new labels ("Strong pattern match", "Multiple signals", "Early signals")
  - [ ] Colors correct (emerald, blue, amber)
  - [ ] "Why you're seeing this" panel displays
  - [ ] Panel dismisses correctly
  - [ ] No console errors

---

## Deployment Steps

### Step 1: Build Production Bundle
```bash
npm run build
```

**Expected output:**
```
✓ built in XXXms
dist/index.html                   X.XX kB
dist/assets/index-XXXXXXXX.js    XXX.XX kB
```

### Step 2: Deploy to Fly.io
```bash
fly deploy
```

**Monitor deployment:**
```bash
fly logs
```

**Wait for:** `✓ Deployment successful`

### Step 3: Verify Production
```bash
# Open production site
open https://hot-honey.fly.dev/investor-dashboard
```

**Check:**
- [ ] Page loads without errors
- [ ] Alignment badges render correctly
- [ ] Explainer panel shows
- [ ] Data loads (25 discovery flow items)

---

## Post-Deployment Verification

### 1. Database Queries

**Check distribution in production:**
```sql
SELECT 
  alignment_state,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM investor_discovery_flow_public
GROUP BY alignment_state
ORDER BY count DESC;
```

**Expected:**
```
alignment_state    | count | pct
-------------------+-------+-----
low_alignment      |  19   | 76.0
high_alignment     |   6   | 24.0
```

### 2. Frontend Smoke Test

**Open production:** https://hot-honey.fly.dev/investor-dashboard

- [ ] Summary stats load (25 in flow, X new this week)
- [ ] "Why you're seeing this" panel displays
  - [ ] Shows 3 signal strengths
  - [ ] Shows 2 entry paths
  - [ ] Shows timing dial
- [ ] Discovery flow items render
  - [ ] ~6 items show "Strong pattern match" (emerald)
  - [ ] ~19 items show "Early signals" (amber)
- [ ] Badges have correct colors
- [ ] No JavaScript errors in browser console

### 3. Performance Check

**Open DevTools → Network:**
- [ ] View query completes in <500ms
- [ ] No 500 errors
- [ ] RLS policies enforcing correctly (no unauthorized data)

---

## Cloudflare Rate Limiting Setup (Optional - Post-Launch)

**Prerequisites:**
- Cloudflare account with Pro plan ($20/month)
- Domain added to Cloudflare (e.g., observatory.hotmatch.ai)

**Steps:**
1. [ ] Add domain to Cloudflare
2. [ ] Update nameservers at registrar
3. [ ] Create rate limiting rule (see `CLOUDFLARE_RATE_LIMITING_SETUP.md`)
4. [ ] Test with `test-rate-limit.js` script
5. [ ] Enable monitoring alerts

**Timeline:** Can be done after deployment (not blocking)

---

## Rollback Plan

### If labels cause confusion:

**Database rollback:**
```sql
DROP VIEW investor_discovery_flow_public;
CREATE VIEW investor_discovery_flow_public AS
SELECT 
  id, investor_id, created_at, date_trunc('week', created_at) AS created_week,
  startup_type_label AS startup_descriptor, stage, industry AS sector_bucket,
  'strong' as alignment_state,  -- Revert to single label
  signals_present AS top_signals, why_appeared, trend, signal_count
FROM investor_discovery_flow;
```

**Frontend rollback:**
```bash
git revert HEAD~3  # Revert last 3 commits
npm run build
fly deploy
```

### If deployment fails:

```bash
# Redeploy previous version
fly deploy --strategy rolling

# Check logs
fly logs --app hot-honey
```

---

## Monitoring (First 48 Hours)

### 1. Database Health

**Daily query:**
```sql
-- Check for k-anonymity drift
SELECT * FROM check_k_anonymity_drift();

-- Check alignment distribution stability
SELECT 
  date_trunc('day', created_at) as day,
  alignment_state,
  COUNT(*)
FROM investor_discovery_flow
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day, alignment_state
ORDER BY day DESC, COUNT(*) DESC;
```

### 2. User Behavior

**Track feedback rates:**
```sql
SELECT 
  idf.alignment_state,
  COUNT(DISTINCT idf.id) as total_items,
  COUNT(ifb.id) as feedback_count,
  ROUND(100.0 * COUNT(ifb.id) / COUNT(DISTINCT idf.id), 1) as feedback_rate
FROM investor_discovery_flow_public idf
LEFT JOIN investor_inbound_feedback ifb ON idf.id = ifb.flow_item_id
GROUP BY idf.alignment_state
ORDER BY feedback_rate DESC;
```

**Goal:** 
- high_alignment items should have >30% feedback rate
- low_alignment items should have <10% feedback rate

### 3. System Guardian

**Run health check:**
```bash
node system-guardian.js
```

**Check for:**
- [ ] No k-anonymity violations
- [ ] GOD score distribution healthy
- [ ] Match quality stable
- [ ] Data freshness OK

---

## Success Criteria

**Week 1 goals:**
- ✅ Deployment completes without errors
- ✅ No rollback needed
- ✅ Distribution shows 2-3 distinct buckets
- ✅ Feedback rate >10% on high_alignment items
- ✅ No security incidents

**Week 2 goals:**
- Dashboard loads in <2 seconds
- Zero 500 errors
- K-anonymity maintained (k≥5)
- At least 5 feedback submissions

---

## Post-Deployment Communication

### Internal (Slack/Email)
```
🎯 Observatory Alignment Fix Deployed

Changes:
✅ New thresholds (75/65/55) → clearer signal distinction
✅ Better labels ("Strong pattern match" vs generic "strong")
✅ "Why you're seeing this" panel → builds trust

Current distribution:
• 24% Strong pattern match (GOD 81-89)
• 76% Early signals (GOD 55)

Next: Cloudflare rate limiting (optional, $20/month)

Monitoring: https://hot-honey.fly.dev/admin/health
```

### Pilot Investor (AMEX - If Needed)
```
Hi [Name],

Quick update on your observatory dashboard:

We've refined how we label alignment strength to make signals 
clearer. You'll now see:
• "Strong pattern match" (top-tier signals)
• "Early signals" (emerging patterns)

We also added a "Why you're seeing this" panel at the top 
that explains the patterns driving your flow.

No action needed - everything else stays the same.

Best,
[Your name]
```

---

**Deployment Owner:** [Your Name]  
**Review Date:** December 18, 2025  
**Approved By:** Andy (Product Owner)

*Checklist last updated: December 18, 2025*
