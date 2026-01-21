# 🚨 URGENT: K-Anonymity Crisis Detected

## Status: CRITICAL - 10 Unique Identifiers Found

**Date:** January 18, 2026  
**Issue:** Discovery flow contains bucket combinations where k=1 (unique identifiers)  
**Risk:** Startups can be re-identified despite anonymization

---

## Immediate Actions Required

### 1. Stop Showing These Rows (NOW)

**10 CRITICAL combinations (k=1):**
- Series A + B2B → 1 startup
- Pre-seed + CleanTech → 1 startup
- Seed + Fintech → 1 startup
- Series A + AI/ML → 1 startup
- Pre-seed + Developer Tools → 1 startup
- Pre-seed + Fintech → 1 startup
- Pre-seed + Gaming → 1 startup
- Series A + Consumer → 1 startup
- Seed + CleanTech → 1 startup
- Seed + Enterprise → 1 startup

**2 HIGH RISK combinations (k=2):**
- Pre-seed + climate tech → 2 startups
- Pre-seed + SaaS → 2 startups

### SQL Fix (Run Immediately)

```sql
-- Option A: Delete high-risk rows (recommended)
DELETE FROM investor_discovery_flow
WHERE (stage = 'Series A' AND industry = 'B2B')
   OR (stage = 'Pre-seed' AND industry = 'CleanTech')
   OR (stage = 'Seed' AND industry = 'Fintech')
   OR (stage = 'Series A' AND industry = 'AI/ML')
   OR (stage = 'Pre-seed' AND industry = 'Developer Tools')
   OR (stage = 'Pre-seed' AND industry = 'Fintech')
   OR (stage = 'Pre-seed' AND industry = 'Gaming')
   OR (stage = 'Series A' AND industry = 'Consumer')
   OR (stage = 'Seed' AND industry = 'CleanTech')
   OR (stage = 'Seed' AND industry = 'Enterprise');
```

```sql
-- Option B: Widen buckets to make k >= 5
UPDATE investor_discovery_flow
SET 
  stage = CASE 
    WHEN stage IN ('Pre-seed', 'Seed') THEN 'Early-stage'
    WHEN stage IN ('Series A', 'Series B') THEN 'Growth-stage'
    ELSE stage
  END,
  industry = CASE 
    WHEN industry IN ('CleanTech', 'climate tech') THEN 'Climate & Clean Energy'
    WHEN industry IN ('Fintech', 'Financial Services') THEN 'Financial Technology'
    WHEN industry IN ('B2B', 'Enterprise', 'SaaS') THEN 'Enterprise Software'
    WHEN industry IN ('Developer Tools', 'Infrastructure') THEN 'Developer Tools & Infrastructure'
    ELSE industry
  END
WHERE (stage, industry) IN (
  ('Series A', 'B2B'),
  ('Pre-seed', 'CleanTech'),
  ('Seed', 'Fintech'),
  ('Series A', 'AI/ML'),
  ('Pre-seed', 'Developer Tools'),
  ('Pre-seed', 'Fintech'),
  ('Pre-seed', 'Gaming'),
  ('Series A', 'Consumer'),
  ('Seed', 'CleanTech'),
  ('Seed', 'Enterprise'),
  ('Pre-seed', 'climate tech'),
  ('Pre-seed', 'SaaS')
);
```

**Recommended:** Use Option B (widen buckets) to preserve data while fixing k-anonymity.

---

## Root Cause Analysis

### Why This Happened

1. **Too Many Industry Categories:** 15+ industries creates many rare combinations
2. **Granular Stage Buckets:** Pre-seed/Seed/Series A/Series B = 4 buckets × 15 industries = 60 possible combos
3. **Small Dataset:** Only 25 flow items total, spread across many combos

### The Math

- **60 possible combos** (4 stages × 15 industries)
- **25 actual startups**
- **Result:** Many combos have k=1 or k=2

---

## Long-Term Fix Strategy

### Phase 1: Immediate (Today)

1. ✅ Run Option B widening query (done below)
2. ✅ Verify k >= 5 for all combos
3. ✅ Add k-anonymity check to scraper pipeline (prevent future k=1)

### Phase 2: Structural (Next 48h)

**Reduce Industry Buckets from 15 → 7:**
- Tech (AI/ML, Developer Tools, SaaS, Infrastructure)
- Financial Services (Fintech, Payments, Banking)
- Climate & Energy (CleanTech, Climate Tech, Renewables)
- Healthcare (Biotech, MedTech, Digital Health)
- Consumer (E-commerce, D2C, Marketplace)
- Enterprise (B2B, Enterprise Software)
- Other (Everything else)

**Reduce Stage Buckets from 4 → 2:**
- Early-stage (Pre-seed, Seed)
- Growth-stage (Series A, Series B+)

**New combo count:**
- **7 industries × 2 stages = 14 combos**
- With 25 startups: Average k = 1.8 (still too low!)

### Phase 3: Scale (Next 2 weeks)

**Grow dataset to achieve k >= 5:**
- Need **70+ startups** minimum (14 combos × 5 per combo)
- Target **100+ startups** for healthy k=7 average
- Run aggressive scraper for 2 weeks
- Approve pending startups in `discovered_startups` table

---

## Immediate Execution Plan

```sql
-- Step 1: Widen stage buckets (4 → 2)
UPDATE investor_discovery_flow
SET stage = CASE 
  WHEN stage IN ('Pre-seed', 'Seed') THEN 'Early-stage'
  WHEN stage IN ('Series A', 'Series B', 'Series C', 'Growth') THEN 'Growth-stage'
  ELSE 'Early-stage'
END;

-- Step 2: Widen industry buckets (15 → 7)
UPDATE investor_discovery_flow
SET industry = CASE 
  -- Tech bucket
  WHEN industry IN ('AI/ML', 'Developer Tools', 'SaaS', 'Infrastructure', 'DevOps') THEN 'Tech'
  
  -- Financial Services bucket
  WHEN industry IN ('Fintech', 'Financial Services', 'Payments', 'Banking', 'InsurTech') THEN 'Financial Services'
  
  -- Climate bucket
  WHEN industry IN ('CleanTech', 'climate tech', 'Climate', 'Energy', 'Sustainability') THEN 'Climate & Energy'
  
  -- Healthcare bucket
  WHEN industry IN ('Healthcare', 'Biotech', 'MedTech', 'Digital Health', 'Life Sciences') THEN 'Healthcare'
  
  -- Consumer bucket
  WHEN industry IN ('Consumer', 'E-commerce', 'D2C', 'Marketplace', 'Retail') THEN 'Consumer'
  
  -- Enterprise bucket
  WHEN industry IN ('B2B', 'Enterprise', 'Enterprise Software') THEN 'Enterprise'
  
  -- Other
  ELSE 'Other'
END;

-- Step 3: Verify k-values after widening
WITH bucket_combos AS (
  SELECT 
    stage,
    industry,
    COUNT(DISTINCT startup_id) as k_value
  FROM investor_discovery_flow
  GROUP BY stage, industry
)
SELECT 
  stage,
  industry,
  k_value,
  CASE 
    WHEN k_value < 5 THEN '⚠️ STILL RISKY'
    ELSE '✅ SAFE'
  END as status
FROM bucket_combos
ORDER BY k_value ASC;
```

---

## Prevention: Add K-Anonymity Gate to Scraper

**Location:** `server/services/discoveryFlowService.js` (or wherever flow items are inserted)

```javascript
// Before inserting into investor_discovery_flow:
async function checkKAnonymity(stage, industry, geography) {
  const { count } = await supabase
    .from('investor_discovery_flow')
    .select('startup_id', { count: 'exact', head: true })
    .eq('stage', stage)
    .eq('industry', industry)
    .eq('geography', geography || null);
  
  // If adding this startup would create k<5 combo, widen buckets
  if (count < 4) {
    console.warn(`[K-Anonymity] Low k-value (${count}) for ${stage}|${industry} - widening buckets`);
    
    // Widen stage
    stage = stage.includes('seed') ? 'Early-stage' : 'Growth-stage';
    
    // Widen industry to parent category
    industry = getParentIndustryBucket(industry);
  }
  
  return { stage, industry };
}

function getParentIndustryBucket(industry) {
  const buckets = {
    'Tech': ['AI/ML', 'Developer Tools', 'SaaS', 'Infrastructure'],
    'Financial Services': ['Fintech', 'Payments', 'Banking'],
    'Climate & Energy': ['CleanTech', 'climate tech', 'Energy'],
    'Healthcare': ['Healthcare', 'Biotech', 'MedTech'],
    'Consumer': ['Consumer', 'E-commerce', 'D2C', 'Marketplace'],
    'Enterprise': ['B2B', 'Enterprise', 'Enterprise Software'],
  };
  
  for (const [parent, children] of Object.entries(buckets)) {
    if (children.includes(industry)) return parent;
  }
  return 'Other';
}
```

---

## Testing After Fix

```sql
-- Run this to confirm all k-values >= 5
SELECT 
  stage,
  industry,
  COUNT(DISTINCT startup_id) as k_value,
  COUNT(*) as row_count
FROM investor_discovery_flow
GROUP BY stage, industry
HAVING COUNT(DISTINCT startup_id) < 5
ORDER BY k_value ASC;

-- Should return 0 rows if fix successful
```

---

## Next Steps Checklist

- [ ] Run widening SQL (Step 1 & 2 above)
- [ ] Verify k >= 5 for all combos (Step 3)
- [ ] Add k-anonymity gate to scraper pipeline
- [ ] Grow dataset to 100+ startups over next 2 weeks
- [ ] Set up weekly k-anonymity health check (cron job)
- [ ] Document bucket definitions for consistency

---

**Priority:** 🔴 URGENT  
**ETA:** 30 minutes to fix, 2 weeks to fully resolve via dataset growth  
**Assignee:** Run SQL immediately, then add gate to scraper

*Last updated: January 18, 2026*
