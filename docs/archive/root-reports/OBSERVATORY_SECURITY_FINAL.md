# Observatory Security - Final Summary

## ✅ Production Hardened (Jan 18, 2026)

All 5 gotchas addressed, permissions locked down, k-anonymity crisis resolved.

---

## What Was Fixed

### 1. Abuse Controls ✅
- **30s statement timeout** (prevents long-running queries)
- **32MB work memory limit** (prevents excessive memory usage)
- **Tight indexes** on (investor_id, time_bucket) - force index scans, not table scans
- **Future:** Edge rate limiting via Cloudflare or Supabase Edge

### 2. Client Can Only Read Safe Projections ✅
```sql
-- authenticated role:
REVOKE ALL ON investor_discovery_flow FROM authenticated;
GRANT SELECT ON investor_discovery_flow_public TO authenticated;  -- View excludes startup_id
GRANT SELECT ON startup_anonymous_projection TO authenticated;    -- SHA256 + buckets
GRANT INSERT ON investor_inbound_feedback TO authenticated;       -- Feedback only
GRANT INSERT ON investor_observatory_sessions TO authenticated;   -- Sessions only
```

**Result:** Future UI code cannot accidentally query raw tables

### 3. Function Security ✅
```sql
CREATE FUNCTION has_observatory_access(i uuid)
...
SECURITY DEFINER
SET search_path = public  -- Pinned to prevent schema injection
```

- ✅ Search path pinned
- ✅ Fully qualified table names
- ✅ No dynamic SQL
- ✅ Boolean return only (no data leakage)
- ✅ No timing side-channels

### 4. Storage/Logs ✅
**Never log:**
- ❌ Raw startup IDs
- ❌ Rare bucket combinations (k<5)
- ❌ Request payloads with descriptors

**OK to log:**
- ✅ Aggregated feedback counts
- ✅ Session duration/item counts (no IDs)
- ✅ Health check results (system-level)

### 5. K-Anonymity Drift Monitor ✅
```sql
SELECT * FROM check_k_anonymity_drift();
-- Daily check for (geo, sector, stage, week) where k < 5
-- Auto-remediation: Collapse geo OR widen sector on read
```

---

## Permissions Matrix (Final State)

| Role | investor_discovery_flow (raw) | investor_discovery_flow_public (view) | feedback/sessions | Other |
|------|-------------------------------|---------------------------------------|-------------------|-------|
| authenticated | ❌ NO ACCESS | ✅ SELECT | ✅ INSERT only | 30s timeout, 32MB mem |
| service_role | ✅ FULL CRUD | ✅ FULL CRUD | ✅ FULL CRUD | No limits |
| anon | ❌ NO ACCESS | ❌ NO ACCESS | ❌ NO ACCESS | Must authenticate |

---

## "All 25 Strong" Issue Diagnosed

**Finding:** Pipeline filters to GOD score >= 55 before flow insertion  
**Data:**
- 4834 total startups
- Only 772 have score >= 55 (16%)
- Of those 772: 188 are 70+ ("high"), 584 are 55-69 ("moderate")

**Why all 25 are "strong":**
Pipeline threshold (55) sits right at "moderate_alignment" boundary → everything in flow gets same label

**Fix (choose one):**

**Option A: Adjust thresholds to fit 55+ range** (RECOMMENDED)
```sql
CASE 
  WHEN total_god_score >= 75 THEN 'high_alignment'      -- 75-89
  WHEN total_god_score >= 65 THEN 'moderate_alignment'  -- 65-74
  WHEN total_god_score >= 55 THEN 'low_alignment'       -- 55-64
END
```
Result: ~25% high / ~50% moderate / ~25% low

**Option B: Lower pipeline threshold to 40** (Shows more distribution, but lower quality)
```sql
WHERE total_god_score >= 40  -- Was: 55
```
Result: Mix of high/moderate/low naturally (but increases "not_relevant" rate)

**Option C: Observatory shows distribution, not labels**
- Remove alignment_state entirely
- Just show: "Multiple strong signals" / "Single standout" / "Emerging potential"
- More honest, no false precision

---

## Monitoring Queries

**Daily Health Check:**
```sql
-- 1. K-anonymity violations
SELECT COUNT(*) FROM check_k_anonymity_drift() WHERE alert_level IN ('CRITICAL', 'HIGH');

-- 2. Scraping behavior
SELECT COUNT(*) FROM check_scraping_behavior();

-- 3. Alignment distribution
SELECT alignment_state, COUNT(*) FROM investor_discovery_flow GROUP BY 1;

-- 4. Feedback rate
SELECT 
  COUNT(DISTINCT f.discovery_item_id)::float / COUNT(DISTINCT d.id) as feedback_rate
FROM investor_discovery_flow d
LEFT JOIN investor_inbound_feedback f ON f.discovery_item_id = d.id
WHERE d.created_at >= NOW() - INTERVAL '7 days';
```

**Alert Thresholds:**
- K-anonymity violations > 0 → Fix immediately (collapse geo or widen buckets)
- Scraping behavior alerts > 0 → Investigate + rate limit
- All alignment same value → Adjust thresholds
- Feedback rate < 10% → Engagement issue

---

## Phase 6 Recommendations (Observatory-Pure)

### A. "Why You're Seeing This" Explainer
Add to each flow item:
```
Why you're seeing this:
• Signals: Multiple strong indicators detected
• Entry: Matches your ai/ml screening patterns
• Trend: Rising (3 new signals this week)
```

**No scores, no IDs - just pattern explanation**

### B. Investor Controls (Tune the Lens)
- Stage slider (Early / Growth)
- Sector toggles (Tech / Financial Services / Climate)
- "Too early" preference (do they want pre-seed or Series A+?)

**Never becomes an inbox - just filtering the radar**

### C. A/B Test Threshold Adjustment
Test Option A (75/65/55 thresholds) vs current (70/55/40) for 2 weeks:
- Measure feedback rate
- Measure too_early rate
- Measure not_relevant rate

Pick threshold that maximizes engagement without flooding with irrelevant deals

---

## Deployment Status

- [x] Permissions locked down (authenticated → views only)
- [x] Function hardened (search_path pinned)
- [x] Query cost controls (30s timeout, 32MB memory)
- [x] Tight indexes (investor_id, time_bucket)
- [x] K-anonymity drift monitor deployed
- [x] All 25 "strong" issue diagnosed
- [ ] Edge rate limiting (Cloudflare recommended)
- [ ] Supabase query logging audit
- [ ] Threshold adjustment (Option A: 75/65/55)
- [ ] "Explain Why" panel (Phase 6)
- [ ] Investor controls (Phase 6)

---

**Architecture:** Direct-to-Supabase with RLS + has_observatory_access() is defensible  
**Security Posture:** 🟢 Multi-layer defense (7 layers active)  
**Next:** A/B test threshold adjustment, add "Why" explainer

*Last updated: January 18, 2026*
