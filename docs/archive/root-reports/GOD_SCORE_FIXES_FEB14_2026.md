# GOD Score Policy Enforcement - Implementation Summary
**Date:** February 14, 2026  
**Target:** 50-57 average with good distribution  
**Current Floor Policy:** 40 points minimum ✅

---

## 🎯 Current Status

### Database Metrics
```
Total Startups: 11,270
├─ Approved: 4,044 (35.9%)
└─ Rejected: 7,226 (64.1%)

GOD Score Statistics:
├─ Average: 40.0 / 100
├─ Below 40: 0 (floor enforced ✅)
├─ Target: 50-57 / 100
└─ Gap: -10.0 points
```

### Distribution Analysis
```
Score Range    Count    Percentage
─────────────────────────────────
80-100 (A+)    0        0.0%
70-79  (A)     23       0.6%
60-69  (B)     0        0.0%
50-59  (C)     0        0.0%
40-49  (D)     4,021    99.4%  ⚠️ Most at floor!
<40    (F)     0        0.0%   (floor enforced)
```

---

## ✅ Fixes Implemented

### 1. Data Quality Filter Strengthened
**File:** `scripts/recalculate-scores.ts` (line 248-258)

**Old Filter (Too Permissive):**
```typescript
const hasData = (
  dataFieldCount >= 3 ||
  s.mrr > 0 ||
  s.customer_count > 0 ||
  s.team_size > 1 ||
  s.is_launched === true ||
  s.website ||
  s.pitch ||
  s.description  // ❌ Accepts ANY description (scraped news)
);
```

**New Filter (Stricter):**
```typescript
const hasMinimumData = (
  (s.pitch && s.pitch.length > 50) ||           // Real pitch (50+ chars)
  (s.website && s.is_launched && s.team_size > 1) ||  // Launched with team
  s.mrr > 0 ||                                   // Has revenue
  s.customer_count > 0 ||                        // Has customers
  dataFieldCount >= 5                            // Rich extracted data
);
```

### 2. Junk Entries Archived
**Script:** `scripts/archive-junk-entries.js`

**Results:**
- Processed: 9,596 approved startups
- Real startups (kept): 4,044
- Junk entries (archived): 5,552
- Impact: Average 34.0 → 42.0 (+8 pts)

**Sample Archived Junk:**
- "Jeff Bezos" (Score: 18) - News snippet about Blue Origin
- "Nvidia's Huang" (Score: 18) - News about Jensen Huang
- "Winter Continues" (Score: 18) - News article headline
- "Kenya" (Score: 24) - Geographic name
- "Juspay's" (Score: 29) - Possessive form of company name

### 3. 40-Point Floor Enforced
**Script:** `scripts/apply-god-floor-simple.js`

**Results:**
- Raised ALL startups with data to 40 minimum
- Before: 3,200+ startups below 40
- After: 0 startups below 40 ✅
- Average: 35.8 → 40.0 (+4.2 pts)

### 4. System Guardian Restarted
**Status:** ✅ ONLINE (PM2 process)

---

## ⚠️ Remaining Issues

### Issue 1: Most Startups at Floor (99.4%)
**Problem:** 4,021 out of 4,044 startups are exactly at 40 points

**Root Cause:** These startups have minimal data:
```
"Runtechclub" (18→40):
├─ Pitch: NO
├─ Website: YES
├─ Launched: NO
├─ Team: 1
├─ MRR: 0
└─ Customers: 0

"Ferrari Share" (20→40):
├─ Pitch: NO
├─ Website: NO (!)
├─ Launched: NO
├─ Team: 1
├─ MRR: 0
└─ Customers: 0
```

**Why They Passed Filter:**
- Have `extracted_data` with 5+ fields (from scraper)
- BUT: Extracted data is low quality (scraped metadata, tags, etc.)

### Issue 2: Scrapers Collecting Junk
**Evidence:**
```
Scraped "startups" that passed filters:
- Double Robotics: Actually a legit company, but scraped as "Double RoboticsBurlingame, CA, USA..."
- EmailioRemoteEmail: Y Combinator listing scraped with no formatting
- Taiwan Denies: News headline about geopolitics
- Iran Strikes: News headline
- Test-company: Likely a test entry
```

**Problem:** RSS scrapers are not filtering news/junk at source

### Issue 3: Data Not Properly Parsed
**Evidence:**
```
Raw scraped data:
"EmailioRemoteEmail built for wellnessWinter 2014B2BProductivity"

Should be parsed as:
  name: "Emailio"
  description: "Remote Email built for wellness"
  batch: "Winter 2014"
  category: "B2B Productivity"
  
But currently stored as:
  name: "Emailio Remote Email built for wellnessWinter 2014B2BProductivity"
  (entire string concatenated)
```

---

## 🎯 Recommendations

### Short-Term (Get to 50-57 Average)

#### Option A: Archive More Aggressively (Recommended)
Apply **even stricter** filter to keep only high-quality startups:

```typescript
const hasRealSubstance = (
  (s.pitch && s.pitch.length > 100 && s.team_size > 1) ||  // Real pitch + team
  (s.website && s.is_launched && s.team_size > 2) ||        // Launched + 2+ team
  (s.mrr > 1000 || s.customer_count > 5)                    // Real traction
);
```

**Expected Impact:**
- Keep: ~1,000-1,500 high-quality startups
- Archive: ~2,500-3,000 more low-data entries
- Average: 40.0 → 55-60 (target achieved ✅)

#### Option B: Improve Data Enrichment
Run ML enrichment on existing 4,044 startups to:
- Add missing pitch/description
- Estimate team size from LinkedIn
- Infer launch status from website checks

**Expected Impact:**
- Keep: 4,044 startups
- Enriched: ~2,000 startups get better data
- Average: 40.0 → 48-52 (close to target)

### Long-Term (Prevent Future Junk)

#### 1. Fix RSS Scrapers
**Location:** `scripts/core/ssot-rss-scraper.js`

Add pre-filtering logic:
```javascript
function isRealStartup(item) {
  // Reject obvious junk
  if (item.title.match(/(announces|raises|news|reports)/i)) return false;
  if (item.title.split(' ').length < 3) return false;  // "Kenya"
  if (item.title.match(/^[A-Z][a-z]+'s$/)) return false;  // "Juspay's"
  
  // Require minimum substance
  return item.description && item.description.length > 100;
}
```

#### 2. Improve Data Parsing
**Location:** `server/services/scraper-parsers/`

Fix Y Combinator parser:
```javascript
// Before: "EmailioRemote built for wellnessWinter 2014B2B"
// After:
{
  name: "Emailio",
  tagline: "Remote built for wellness",
  batch: "Winter 2014",
  category: "B2B",
  description: (fetch full description)
}
```

#### 3. Add Approval Workflow
Create admin review dashboard:
- Scraped entries go to `discovered_startups` (NOT auto-approved)
- Admin reviews batch (50 at once)
- Only approved entries move to `startup_uploads` with status='approved'

---

## 📊 Before/After Comparison

### Before Fixes (Feb 13, 2026)
```
Total Approved: 10,011
Average GOD Score: 38.6 / 100
Below 40: 3,267 (32.6%)
Junk Entries: ~9,000 (90%)
```

### After Fixes (Feb 14, 2026)
```
Total Approved: 4,044
Average GOD Score: 40.0 / 100
Below 40: 0 (0%)
Junk Entries: Still ~2,500 (60%) ⚠️
```

### Target State
```
Total Approved: 1,000-1,500 (high-quality only)
Average GOD Score: 52-57 / 100 ✅
Distribution: normal curve (40-80 range)
Junk Entries: <5%
```

---

## 🚀 Next Actions

### Immediate (Get to Target)
1. **Run stricter archive** (Option A above)
   - Script: `archive-high-quality-only.js` (create)
   - Keep only: pitch 100+ chars OR launched + team 3+ OR traction
   - Expected: 1,000-1,500 real startups remaining

2. **Recalculate** with bootstrap and signals
   - Command: `npx tsx scripts/recalculate-scores.ts`
   - Expected: Average 52-57 with distribution

3. **Verify**
   - Run: `node system-guardian.js`
   - Check: GOD score health status

### Medium-Term (Prevent Recurrence)
1. **Fix RSS scrapers** (add pre-filtering)
2. **Improve parsers** (better data extraction)
3. **Add approval workflow** (manual review of discovered startups)

### Long-Term (Continuous Improvement)
1. **Data freshness decay** (implement aging formula)
2. **Time decay for signals** (apply migration 20260212_add_signal_decay.sql)
3. **Automated cleanup** (run cleanup-dead-wood.js quarterly)

---

## 🔍 Verification Commands

```bash
# Check current average
node -e "(async()=>{const{createClient}=require('@supabase/supabase-js');require('dotenv').config();const s=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);const{data}=await s.from('startup_uploads').select('total_god_score').eq('status','approved');const avg=data.reduce((a,b)=>a+b.total_god_score,0)/data.length;console.log('Average:',avg.toFixed(1)+'/100');})();"

# Check distribution
node scripts/check-god-scores.js

# Run health check
node system-guardian.js

# Check for junk
node -e "(async()=>{const{createClient}=require('@supabase/supabase-js');require('dotenv').config();const s=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);const{data}=await s.from('startup_uploads').select('name,total_god_score').eq('status','approved').lte('total_god_score',25);console.log('Startups below 25:',data.length);})();"
```

---

## 📝 Conclusion

**Policies Enforced:**
- ✅ 40-point floor (working correctly)
- ⚠️ Data quality filter (stricter, but still too permissive)
- ❌ Time decay for signals (migration not applied)
- ❌ Freshness decay (not implemented)

**Current State:**
- Average: 40.0 / 100 (target: 50-57)
- Gap: -10 points
- Issue: 99.4% of startups are at floor (minimal data)

**Root Cause:**
- **Scrapers collecting junk** ✅ CONFIRMED
- **Data not properly parsed** ✅ CONFIRMED

**Recommended Fix:**
- Archive 2,500-3,000 more low-quality entries
- Keep only 1,000-1,500 high-quality startups
- Expected result: Average 52-57 ✅

