# Phase 5 Observatory - Operations Playbook

## 72-Hour Pilot Reality Loop (AMEX)

**Target:** 20–50 feedback events to calibrate "alignment"

### Daily Health Check (Next 3 Days)

```sql
-- Morning dashboard query (run daily)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as feedback_events,
  SUM(CASE WHEN feedback_type = 'interested' THEN 1 ELSE 0 END) as thumbs_up,
  SUM(CASE WHEN feedback_type = 'not_relevant' THEN 1 ELSE 0 END) as thumbs_down,
  SUM(CASE WHEN feedback_type = 'too_early' THEN 1 ELSE 0 END) as too_early,
  ROUND(100.0 * SUM(CASE WHEN feedback_type = 'too_early' THEN 1 ELSE 0 END) / COUNT(*), 1) as too_early_rate_pct
FROM investor_inbound_feedback
WHERE investor_id = '0d3cbdbc-3596-42a2-ae90-d440971c9387'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Truth Serum Metrics

| Metric | Threshold | What It Tells You |
|--------|-----------|-------------------|
| `feedback_rate` | > 15% of items shown | They're engaged, not just browsing |
| `too_early_rate` | 20-40% | **YOUR TIMING TRUTH**: If <20% you're too conservative, if >40% you're too aggressive |
| `thumbs_up / thumbs_down` | > 0.5 ratio | Signal quality is decent |
| `session_duration` | > 5 min | They're exploring, not bouncing |

**What "too_early" really means:**
- **20-30%** = Healthy - you're showing moonshots before they're obvious
- **40-50%** = Aggressive - you're catching pre-product/pre-revenue companies
- **> 50%** = Too aggressive - most startups aren't investable yet
- **< 15%** = Too conservative - you're only showing obvious Series A+ companies

---

## Add Second Pilot Investor (Different Archetype)

### AMEX Profile (Current)
- **Type:** Corporate VC
- **Stage:** Series A+
- **Sectors:** Fintech, enterprise SaaS
- **Volume:** High-throughput, pattern-based screening

### Recommended Archetype B (Pick One)

**Option 1: Seed Operator Angel**
- **Why:** Tests early-stage signal detection
- **Sectors:** AI/ML, dev tools
- **Volume:** Low-throughput, high-touch
- **Expected Behavior:** Higher "too_early" tolerance, more "interested" clicks

**Option 2: Sector Specialist Fund**
- **Why:** Tests signal specificity
- **Sectors:** Climate tech, healthcare
- **Volume:** Medium-throughput, domain expertise
- **Expected Behavior:** High precision, low "not_relevant" rate

**Option 3: Geography-Focused Investor**
- **Why:** Tests geo-bucketing effectiveness
- **Sectors:** Broad (LATAM, SEA, Africa)
- **Volume:** Medium-throughput
- **Expected Behavior:** Tests if geo bucketing prevents re-identification

### Onboarding Script

```sql
-- Add new pilot investor
INSERT INTO investor_observatory_access (
  investor_id,
  access_granted,
  granted_at,
  granted_by,
  access_level,
  role,
  expires_at,
  invite_code
) VALUES (
  '<new-investor-uuid>',
  true,
  NOW(),
  'admin',
  'standard',
  'standard',
  '2026-03-31 23:59:59+00', -- 10 weeks
  'PILOT-<NAME>-2026'
);
```

---

## Safety Alarms (Silent Internal Triggers)

### 1. K-Anonymity Risk Monitor

```sql
-- Weekly k-anonymity check (run every Monday)
WITH bucket_combos AS (
  SELECT 
    stage || '|' || industry || '|' || COALESCE(geography, 'null') as combo,
    COUNT(DISTINCT startup_id) as startup_count,
    COUNT(DISTINCT investor_id) as investor_count
  FROM investor_discovery_flow
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY combo
)
SELECT 
  combo,
  startup_count,
  investor_count,
  CASE 
    WHEN startup_count = 1 THEN '🚨 CRITICAL - Unique identifier'
    WHEN startup_count <= 3 THEN '⚠️ HIGH RISK - Low k-anonymity'
    WHEN startup_count <= 5 THEN '⚠️ MEDIUM RISK - Monitor'
    ELSE '✅ OK'
  END as risk_level
FROM bucket_combos
WHERE startup_count <= 5
ORDER BY startup_count ASC;
```

**Trigger Actions:**
- **startup_count = 1:** Immediately widen buckets or suppress that row
- **startup_count = 2-3:** Add "fuzzed timing" (show "this week" instead of exact date)
- **startup_count <= 5:** Monitor for 48h, flag if investor queries repeatedly

### 2. Scraping Behavior Detector

```sql
-- Detect abnormal query volume (run hourly)
WITH session_behavior AS (
  SELECT 
    s.investor_id,
    COUNT(*) as session_count_24h,
    SUM(s.items_viewed) as total_items_viewed,
    AVG(s.duration_minutes) as avg_duration
  FROM investor_observatory_sessions s
  WHERE s.session_start >= NOW() - INTERVAL '24 hours'
  GROUP BY s.investor_id
)
SELECT 
  i.name,
  sb.session_count_24h,
  sb.total_items_viewed,
  sb.avg_duration,
  CASE 
    WHEN sb.session_count_24h > 50 THEN '🚨 SCRAPING SUSPECTED'
    WHEN sb.total_items_viewed > 200 THEN '⚠️ HIGH VOLUME'
    WHEN sb.avg_duration < 1 THEN '⚠️ AUTOMATED BEHAVIOR'
    ELSE '✅ OK'
  END as alert_level
FROM session_behavior sb
JOIN investors i ON i.id = sb.investor_id
WHERE sb.session_count_24h > 20 OR sb.total_items_viewed > 100;
```

**Trigger Actions:**
- **> 50 sessions/day:** Rate-limit to 10 req/min, email admin
- **> 200 items viewed/day:** Flip kill switch, investigate
- **Avg duration < 1 min with high volume:** Likely bot, disable account

### 3. Quality Drift Alarm

```sql
-- Detect sudden "not_relevant" spikes (run daily)
WITH weekly_feedback AS (
  SELECT 
    DATE_TRUNC('week', created_at) as week,
    investor_id,
    COUNT(*) as total_feedback,
    SUM(CASE WHEN feedback_type = 'not_relevant' THEN 1 ELSE 0 END) as not_relevant_count,
    ROUND(100.0 * SUM(CASE WHEN feedback_type = 'not_relevant' THEN 1 ELSE 0 END) / COUNT(*), 1) as not_relevant_pct
  FROM investor_inbound_feedback
  GROUP BY 1, 2
)
SELECT 
  i.name,
  w.week,
  w.not_relevant_pct,
  LAG(w.not_relevant_pct) OVER (PARTITION BY w.investor_id ORDER BY w.week) as prev_week_pct,
  CASE 
    WHEN w.not_relevant_pct > 60 THEN '🚨 CRITICAL - Bad upstream signals'
    WHEN w.not_relevant_pct - LAG(w.not_relevant_pct) OVER (PARTITION BY w.investor_id ORDER BY w.week) > 20 THEN '⚠️ SUDDEN SPIKE'
    ELSE '✅ OK'
  END as alert_level
FROM weekly_feedback w
JOIN investors i ON i.id = w.investor_id
WHERE w.not_relevant_pct > 40
ORDER BY w.week DESC;
```

**Trigger Actions:**
- **> 60% not_relevant:** Pause inbound pipeline, review scrapers
- **+20% week-over-week spike:** Check if new RSS source is low quality
- **Sustained > 50% for 2 weeks:** Investor criteria may have changed, reach out

### 4. Sample Size Drop Detector

```sql
-- Alert when bucket populations drop below safe thresholds
WITH current_buckets AS (
  SELECT 
    industry,
    COUNT(DISTINCT startup_id) as unique_startups
  FROM investor_discovery_flow
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY industry
)
SELECT 
  industry,
  unique_startups,
  CASE 
    WHEN unique_startups < 5 THEN '🚨 CRITICAL - Widen bucket'
    WHEN unique_startups < 10 THEN '⚠️ LOW - Monitor'
    ELSE '✅ OK'
  END as alert_level
FROM current_buckets
WHERE unique_startups < 10
ORDER BY unique_startups ASC;
```

---

## "Explain Why" Panel (Transparency Layer)

### Design Principles
- **NO GOD scores mentioned**
- **NO startup names or domains**
- **YES to signal types and entry paths**
- **YES to trend explanations**

### Suggested Panel Text (Per Flow Item)

**Template:**
```
Why you're seeing this:
• Signals: {top 3 signal types}
• Entry: {entry_path_label}
• Trend: {trend_direction} ({reason})
```

**Example:**
```
Why you're seeing this:
• Signals: Strong team, High traction, Large market
• Entry: Warm intro from LP network
• Trend: Rising (3 new signals this week)
```

### Implementation

Add to [InvestorDashboard.tsx](src/pages/InvestorDashboard.tsx):

```typescript
// In each flow item card
<div className="text-xs text-gray-500 mt-2 border-t border-gray-800 pt-2">
  <div className="font-medium mb-1">Why you're seeing this:</div>
  <div className="space-y-0.5">
    <div>• Signals: {item.signals_present.slice(0, 3).join(', ') || 'Pattern match'}</div>
    <div>• Entry: {getEntryPathLabel(item.why_appeared)}</div>
    {item.trend === 'rising' && (
      <div>• Trend: Rising ({item.signal_count} signals detected)</div>
    )}
  </div>
</div>
```

**Helper function:**
```typescript
function getEntryPathLabel(why: string): string {
  if (why.includes('warm intro')) return 'Warm intro from LP network';
  if (why.includes('referral')) return 'Founder referral';
  if (why.includes('screening')) return 'Matches your screening patterns';
  if (why.includes('momentum')) return 'Topical momentum';
  if (why.includes('hiring')) return 'Hiring velocity signal';
  return 'Pattern match';
}
```

---

## Expand Signal Distribution (Priority Fix)

### Current State
**Problem:** Only 1 signal type populated, makes observatory feel thin

### Target State: 5–8 Canonical Signal Categories

| Signal Type | Description | Data Source | Bucket Levels |
|-------------|-------------|-------------|---------------|
| `founder_network` | Warm intros, LP referrals | Manual tagging, email parsing | low / medium / high |
| `topical_momentum` | Forums, news, social mentions | RSS scrapers, HN API | rising / stable / declining |
| `hiring_velocity` | Job postings, team growth | LinkedIn scraper (bucketed) | slow / moderate / fast |
| `product_proof` | GitHub stars, app reviews | GitHub API, app stores (bucketed) | early / traction / proven |
| `investor_overlap` | Other VCs interested | Crunchbase, AngelList | low / medium / high |
| `market_timing` | Sector tailwinds, policy shifts | News sentiment analysis | favorable / neutral / challenging |
| `team_pedigree` | Prior exits, domain expertise | LinkedIn (bucketed), Crunchbase | emerging / experienced / serial |
| `traction_milestones` | Revenue, users, growth | Self-reported (bucketed) | nascent / growing / scaling |

### Implementation Plan

**Week 1: Add 3 Core Signals**
1. `founder_network` - Tag existing flow items with entry path
2. `topical_momentum` - Use existing RSS scraper data
3. `hiring_velocity` - Add basic LinkedIn scraper (count only, no names)

**Week 2: Add ML-Powered Signals**
4. `product_proof` - GitHub API integration (stars, forks, activity)
5. `investor_overlap` - Crunchbase API (which VCs invested in similar startups)

**Week 3: Add Contextual Signals**
6. `market_timing` - News sentiment analysis via existing RSS
7. `team_pedigree` - LinkedIn Company API (prior company exits, not individual profiles)

### Bucketing Rules (K-Anonymity Safe)

**DO:**
- "Hiring velocity: Fast (10+ roles posted this quarter)"
- "GitHub activity: High (top 5% in sector)"
- "Investor overlap: 3+ tier-1 funds interested"

**DON'T:**
- "12 engineers hired from Google last month" (too specific)
- "4,237 GitHub stars" (exact count reveals identity)
- "Sequoia led their seed round" (names specific investors)

---

## K-Anonymity Analysis

### Your Current View Definition

**Anonymization Layers:**
1. ✅ **SHA256 hashing** of startup IDs with salt
2. ✅ **Coarse buckets** for stage (early/seed/series_a/growth)
3. ✅ **Coarse buckets** for sectors (10 categories + "other")
4. ✅ **Coarse buckets** for geography (8 regions + "other")
5. ✅ **Coarse buckets** for traction (5 levels based on GOD score ranges)
6. ✅ **Signal arrays** (top 3 only, no raw scores)

### Risk Assessment

| Field | Re-identification Risk | Mitigation |
|-------|------------------------|------------|
| `anon_id` (SHA256) | **LOW** - Hash is one-way, salted | ✅ Safe |
| `stage_bucket` | **MEDIUM** - 4 values, but common combos | ⚠️ Combine with sector for k>5 |
| `sector_bucket` | **MEDIUM** - 11 values | ⚠️ Watch rare sectors (edtech, proptech) |
| `geo_bucket` | **LOW** - 8 broad regions | ✅ Safe |
| `traction_bucket` | **MEDIUM** - Based on GOD score ranges | ⚠️ Don't expose with exact stage |
| `alignment_state` | **MEDIUM** - 4 values | ⚠️ Same as traction_bucket risk |
| `top_signals` | **HIGH** - Combo of 3 signals | 🚨 **CRITICAL** - If all 5 component scores >75, only 1-2 startups match |

### Critical Issue: `top_signals` Array

**Problem:** Your current view generates signals like:
```sql
['strong_team', 'high_traction', 'innovative_product']
```

**Risk:** If a startup has 4-5 signals (all component scores >75), this **uniquely identifies them**.

**Example:**
- Startup A: `['strong_team', 'high_traction', 'large_market', 'innovative_product', 'compelling_vision']`
- This combination appears **once** in your entire dataset
- Even with SHA256, the signal combo is a fingerprint

**FIX IMMEDIATELY:**

```sql
-- Replace top_signals generation with bucketed count
CASE
  WHEN (SELECT COUNT(*) FROM (
    SELECT 1 WHERE team_score >= 75
    UNION ALL SELECT 1 WHERE traction_score >= 75
    UNION ALL SELECT 1 WHERE market_score >= 75
    UNION ALL SELECT 1 WHERE product_score >= 75
    UNION ALL SELECT 1 WHERE vision_score >= 75
  ) signals) >= 4 THEN 'many_signals'
  WHEN (SELECT COUNT(*) FROM (
    SELECT 1 WHERE team_score >= 75
    UNION ALL SELECT 1 WHERE traction_score >= 75
    UNION ALL SELECT 1 WHERE market_score >= 75
    UNION ALL SELECT 1 WHERE product_score >= 75
    UNION ALL SELECT 1 WHERE vision_score >= 75
  ) signals) >= 2 THEN 'multiple_signals'
  WHEN (SELECT COUNT(*) FROM (
    SELECT 1 WHERE team_score >= 75
    UNION ALL SELECT 1 WHERE traction_score >= 75
    UNION ALL SELECT 1 WHERE market_score >= 75
    UNION ALL SELECT 1 WHERE product_score >= 75
    UNION ALL SELECT 1 WHERE vision_score >= 75
  ) signals) = 1 THEN 'single_signal'
  ELSE 'no_strong_signals'
END AS signal_strength
```

**Better Approach:**
Instead of naming signals, use **signal categories**:
- "Multiple strong signals" (2-3 signals)
- "Exceptional across dimensions" (4-5 signals)
- "Single standout strength" (1 signal)

### Safe Bucket Combinations

**Current Flow Item Example:**
```json
{
  "startup_type_label": "Seed-stage AI/ML startup",
  "stage": "Seed",
  "industry": "AI/ML",
  "geography": null,
  "alignment_state": "strong",
  "signals_present": [],
  "signal_count": 1
}
```

**Risk Analysis:**
- Stage + Industry + Geography = "Seed AI/ML [null]"
- How many startups match? If < 5, **re-identification risk**

**Query to check:**
```sql
-- Check k-anonymity for each combo
SELECT 
  stage,
  industry,
  COALESCE(geography, 'unspecified') as geo,
  COUNT(DISTINCT startup_id) as k_value,
  CASE 
    WHEN COUNT(DISTINCT startup_id) = 1 THEN '🚨 UNIQUE - DO NOT SHOW'
    WHEN COUNT(DISTINCT startup_id) <= 3 THEN '⚠️ HIGH RISK'
    WHEN COUNT(DISTINCT startup_id) <= 5 THEN '⚠️ MEDIUM RISK'
    ELSE '✅ SAFE'
  END as risk_level
FROM investor_discovery_flow
GROUP BY stage, industry, COALESCE(geography, 'unspecified')
ORDER BY COUNT(DISTINCT startup_id) ASC;
```

**Fix if k < 5:**
- Widen stage bucket: "Early-stage" instead of "Pre-seed"
- Widen industry bucket: "Enterprise Tech" instead of "AI/ML"
- Drop geography entirely if null

---

## Recommended Fixes (Priority Order)

### 1. 🚨 URGENT: Fix `top_signals` Re-identification Risk
- Replace signal names with bucketed counts
- Deploy within 24 hours

### 2. ⚠️ HIGH: Add K-Anonymity Check to Scraper Pipeline
- Run k-value query before inserting into `investor_discovery_flow`
- Suppress rows where k < 5
- Log suppressed items for quality monitoring

### 3. ⚠️ MEDIUM: Expand Signal Distribution to 5-8 Types
- Makes observatory feel real
- Dilutes individual signal strength (reduces fingerprinting)

### 4. ✅ LOW: Add "Explain Why" Panel
- Increases trust without exposing data
- Template provided above

---

## Your First Public Line

**For invited investors:**
> "This is an observatory, not a marketplace. You see anonymized signals about early-stage companies that match your investment criteria. There is no inbox, no direct contact, no names or domains. Think of it as a sector radar, not a deal flow platform."

**Why this works:**
- Sets expectations immediately
- "Observatory" vs "marketplace" is clear mental model
- Emphasizes anonymity and no-contact design
- Positions as research tool, not sourcing tool

---

## Next 72 Hours Checklist

- [ ] Fix `top_signals` re-identification risk (URGENT)
- [ ] Run k-anonymity check query and suppress k<5 rows
- [ ] Run daily health check query for AMEX feedback
- [ ] Watch `too_early_rate` (your timing truth serum)
- [ ] Set up safety alarm queries (run Monday morning)
- [ ] Choose second pilot investor archetype
- [ ] Draft "Explain Why" panel text
- [ ] Plan signal expansion (pick 3 signals for Week 1)

---

**Status:** Observatory is LIVE, but needs immediate `top_signals` fix before heavy pilot usage.

*Last updated: January 18, 2026*
