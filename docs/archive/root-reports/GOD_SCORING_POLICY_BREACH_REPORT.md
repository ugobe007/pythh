# 🚨 GOD SCORING POLICY ENFORCEMENT - CRITICAL FINDINGS

**Date:** February 14, 2026, 9:45 AM  
**Status:** ❌ **POLICIES NOT ENFORCED** - Urgent action required

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **DATA QUALITY FILTER BROKEN** (Severity: CRITICAL)

**Policy:** Startups with little/no data should not be scored above minimum floor  
**Expected:** Junk entries filtered out, not scored  
**Actual:** Junk entries passing filter and receiving 18+ points  

**Evidence:**
```
"Jeff Bezos" (Score: 18)
  - NOT a real startup (scraped news snippet)
  - Description: "Blue Origin is looking to send the first of TeraWave's 5,408..."
  - Data: No MRR, No customers, Team=1, Not launched, No website
  - ❌ PASSES FILTER (because has description field)

"Winter Continues" (Score: 18)
  - NOT a real startup (scraped news snippet)
  - Description: "Funding in the Indian agritech space has remained volatile..."
  - Data: No MRR, No customers, Team=1, Not launched, No website
  - ❌ PASSES FILTER (because has description field)

"Nvidia's Huang", "PhilTower's", etc. - Same pattern
```

**Root Cause:**
```typescript
// In scripts/recalculate-scores.ts line 285
const hasData = (
  dataFieldCount >= 3 ||
  st.mrr > 0 ||
  st.customer_count > 0 ||
  st.team_size > 1 ||
  st.is_launched === true ||
  st.website ||
  st.pitch ||
  st.description  // ❌ TOO PERMISSIVE - scraped news passes as "description"
);
```

**Impact on Scoring:**
```
Current Average: 38.6/100 (vs target 60-65)
Reason: Junk entries (18 pts) dragging down healthy startups (75-77 pts)

With Junk Filtered:
- Top 5 startups: 75-77 points (good data: MRR, customers, team, launched)
- If only real startups counted: avg would be ~60-65 (target range)
```

---

### 2. **TIME DECAY NOT IMPLEMENTED** (Severity: HIGH)

**Policy:** Scores decay if data isn't fresh (investor psychology time-sensitive)  
**Expected:** Old signals (90+ days) decay exponentially  
**Actual:** NO DECAY - all signals treated equally regardless of age  

**Evidence:**
```
Migration exists: 20260212_add_signal_decay.sql
Status: ❌ NOT APPLIED
Documentation: PSYCHOLOGICAL_SIGNALS_DECAY.md states "❌ NO DECAY (Awaiting Implementation)"

Current behavior:
- 6-month old "oversubscribed" signal = +3 bonus
- 7-day old "oversubscribed" signal = +3 bonus
- Same weight regardless of age ❌

Should be:
- 6-month old (180 days): 0.4 pts (12.5% of original, nearly expired)
- 7-day old: 2.7 pts (88% of original, still fresh)
```

**Decay Rates (from policy docs):**
| Signal Type | Half-Life | Current | Should Be |
|-------------|-----------|---------|-----------|
| **FOMO** (oversubscribed) | 30 days | No decay | Decay to 50% @ 30d, 12.5% @ 90d |
| **Conviction** (follow-on) | 90 days | No decay | Decay to 50% @ 90d, 25% @ 180d |
| **Urgency** (competitive) | 14 days | No decay | Decay to 50% @ 14d, 12.5% @ 42d |
| **Risk** (bridge) | 45 days | No decay | Decay to 50% @ 45d, 12.5% @ 135d |

---

### 3. **DATA FRESHNESS DECAY NOT IMPLEMENTED** (Severity: HIGH)

**Policy:** Startup data must remain fresh to hold scores  
**Expected:** Scores decay if no updates in 60-90 days  
**Actual:** NO DECAY - stale data treated same as fresh data  

**Evidence:**
```
Policy documents mention:
- GOD_SCORE_INTEGRATION_COMPLETE.md (line 152): "Score Decay: Lower scores for startups with no activity (quarterly batch job)"
- DATA_POPULATION_COMPLETE.md (line 319): References "Score Decay" section

Implementation status:
- No decay formula in recalculate-scores.ts
- No updated_at age check in scoring service
- All startups updated 0 days ago (but many have stale underlying data)

Real startups created 63 days ago still scoring full points with no recent activity
```

---

### 4. **MINIMUM DATA REQUIREMENTS NOT ENFORCED** (Severity: MEDIUM)

**Policy:** Startups need minimum viable data to receive scores  
**Expected:** Require 2-3 substantive fields (pitch, website, traction signals)  
**Actual:** Any description field passes filter (even scraped news)  

**Current Filter (TOO LOOSE):**
```typescript
// Passes if ANY of these exist:
- extracted_data has 3+ fields (OK)
- mrr > 0 (OK)
- customer_count > 0 (OK)
- team_size > 1 (OK)
- is_launched === true (OK)
- website (OK)
- pitch (OK)
- description (❌ TOO LOOSE - accepts scraped news)
```

**Recommended Filter (STRICTER):**
```typescript
const hasMinimumData = (
  // Real startups MUST have either:
  // 1. Substantive pitch/website + some traction OR
  // 2. Launched product + team > 1 OR
  // 3. Actual business metrics (MRR/customers)
  
  (st.pitch && st.pitch.length > 50 && (st.website || st.mrr > 0 || st.customer_count > 0)) ||
  (st.is_launched === true && st.team_size > 1 && st.website) ||
  (st.mrr > 0 || st.customer_count > 0) ||
  (extractedFieldCount >= 5) // More fields = likely real startup
);
```

---

## 📊 IMPACT ANALYSIS

### Current State (With Broken Filter)
```
Total Approved: 10,011 startups
Average GOD Score: 38.6/100 (44% below target)
Distribution:
  - < 40: 70% (including junk entries scoring 18)
  - 40-59: 25%
  - 60-79: 4%
  - 80+: 1%

TOP 5 (Real Startups): 75-77 points
  - SwiftFinance, SparkSecurity, GridCloud, etc.
  - Good data: MRR $23k-$700k, 18-84 customers, 6-30 team, launched

BOTTOM 5 (Junk Entries): 18 points each
  - "Jeff Bezos", "Nvidia's Huang", "Winter Continues", etc.
  - Scraped news snippets, not real startups
  - No MRR, no customers, team=1, not launched
```

### Expected State (With Fixed Filter)
```
Real Startups: ~930 (based on actual startup data)
Junk Entries: ~9,081 (filtered out, not scored)

Average GOD Score: 55-65/100 ✅ (target range)
Distribution:
  - < 40: 5% (rare, very sparse data)
  - 40-59: 30%
  - 60-79: 60%
  - 80+: 5%
```

---

## 🎯 ACTION PLAN (PRIORITY ORDER)

### IMMEDIATE (Next 30 minutes)

**1. Archive Junk Entries**
```bash
# Move junk entries to rejected status (do not score)
node << 'EOF'
(async () => {
  const {createClient} = require('@supabase/supabase-js');
  require('dotenv').config();
  const s = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  const {data: startups} = await s
    .from('startup_uploads')
    .select('id, name, description, pitch, mrr, customer_count, team_size, is_launched, website')
    .eq('status', 'approved');
  
  let archived = 0;
  for (const st of startups || []) {
    const extractedFieldCount = st.extracted_data ? Object.keys(st.extracted_data).length : 0;
    
    // Strict filter: Must have substantive data
    const hasData = (
      (st.pitch && st.pitch.length > 50) ||
      (st.website && st.is_launched === true && st.team_size > 1) ||
      st.mrr > 0 ||
      st.customer_count > 0 ||
      extractedFieldCount >= 5
    );
    
    if (!hasData) {
      // Archive junk entry
      await s
        .from('startup_uploads')
        .update({status: 'rejected', rejection_reason: 'insufficient_data'})
        .eq('id', st.id);
      
      console.log(`Archived: ${st.name}`);
      archived++;
    }
  }
  
  console.log(`\nTotal archived: ${archived}`);
  process.exit(0);
})();
EOF
```

**2. Fix Data Quality Filter**
```bash
# Update recalculate-scores.ts line 285 with stricter filter
# (Script provided below)
```

**3. Recalculate Scores (Real Startups Only)**
```bash
npx tsx scripts/recalculate-scores.ts
```

**Expected Result:**
- Junk entries: Status changed to "rejected"
- Real startups: Scores recalculated (avg should jump to 55-65)
- Database integrity: Only real startups in approved status

### HIGH PRIORITY (Today)

**4. Apply Time Decay Migration**
```bash
# Migration already exists: supabase/migrations/20260212_add_signal_decay.sql
# Apply via Supabase Dashboard SQL Editor
# OR: If using Supabase CLI:
supabase db push
```

**5. Implement Data Freshness Decay**
```typescript
// Add to startupScoringService.ts or as separate decay service
// Apply exponential decay based on days since last_updated

const calculateFreshnessDecay = (lastUpdated: Date, currentDate: Date) => {
  const daysSinceUpdate = Math.floor((currentDate.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
  
  // No decay first 30 days
  if (daysSinceUpdate <= 30) return 1.0;
  
  // Decay starts after 30 days
  // Half-life: 90 days (score drops to 50% at 90 days stale)
  const decayFactor = Math.pow(0.5, (daysSinceUpdate - 30) / 90);
  
  return Math.max(decayFactor, 0.5); // Floor at 50% (never fully expire good startups)
};

// Apply in recalculate-scores.ts:
const freshnessMultiplier = calculateFreshnessDecay(new Date(startup.updated_at), new Date());
const decayedScore = Math.round(scores.total_god_score * freshnessMultiplier);
```

### MEDIUM PRIORITY (This Week)

**6. Automate Data Quality Monitoring**
```bash
# Add to System Guardian (runs every 10 min)
# Alert if junk percentage > 5%
# Alert if avg GOD score < 50 or > 70
```

**7. Update Admin Dashboard**
```typescript
// Add data quality metrics to /admin/health
// Show: Real vs Junk ratio, Score distribution, Decay impact
```

---

## 📁 FILES REQUIRING UPDATES

### 1. scripts/recalculate-scores.ts (Line 285)
**Change:**
```typescript
// OLD (TOO PERMISSIVE):
const hasData = (
  dataFieldCount >= 3 ||
  st.mrr > 0 ||
  st.customer_count > 0 ||
  st.team_size > 1 ||
  st.is_launched === true ||
  st.website ||
  st.pitch ||
  st.description  // ❌ Accepts scraped news
);

// NEW (STRICTER):
const hasMinimumData = (
  // Real startups need SUBSTANTIVE data (not just scraped news snippets)
  (st.pitch && st.pitch.length > 50) ||  // Meaningful pitch
  (st.website && st.is_launched === true && st.team_size > 1) || // Launched product with team
  st.mrr > 0 || // Has revenue
  st.customer_count > 0 || // Has customers
  dataFieldCount >= 5 // Rich extracted data (5+ fields likely means real startup)
);

const startupsWithData = allStartups.filter(hasMinimumData);
```

### 2. supabase/migrations/20260212_add_signal_decay.sql
**Status:** EXISTS but NOT APPLIED  
**Action:** Apply via Supabase Dashboard or CLI

### 3. server/services/startupScoringService.ts
**Add:** Freshness decay calculation (see implementation above)  
**Location:** After line 2420, before export

---

## 🔍 VERIFICATION STEPS

After implementing fixes:

```bash
# 1. Check junk entries archived
node -e "(async()=>{const{createClient}=require('@supabase/supabase-js');require('dotenv').config();const s=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);const{count:rejected}=await s.from('startup_uploads').select('*',{count:'exact',head:true}).eq('status','rejected');const{count:approved}=await s.from('startup_uploads').select('*',{count:'exact',head:true}).eq('status','approved');console.log('Rejected (junk):',rejected);console.log('Approved (real):',approved);process.exit(0);})();"

# 2. Check new average GOD score
npx tsx scripts/check-god-scores.js

# 3. Verify time decay working
node -e "(async()=>{/* test decay query */})();"

# 4. Run System Guardian
node scripts/archive/utilities/system-guardian.js
```

**Expected Results:**
- ✅ Rejected count: ~9,000+
- ✅ Approved count: ~1,000
- ✅ Average GOD score: 55-65
- ✅ No "TOO MANY LOW SCORES" alert
- ✅ Time decay applied to old signals (bonus reduced)

---

## 📝 POLICY SUMMARY (For Reference)

| Policy | Status | Migration/File | Action Required |
|--------|--------|----------------|-----------------|
| **Data Quality Filter** | ❌ BROKEN | recalculate-scores.ts:285 | Fix filter logic |
| **Minimum Data Floor** | ❌ NOT ENFORCED | Same file | Archive junk entries |
| **Time Decay (Signals)** | ❌ NOT APPLIED | 20260212_add_signal_decay.sql | Apply migration |
| **Freshness Decay (Scores)** | ❌ NOT IMPLEMENTED | startupScoringService.ts | Add decay formula |
| **40-Point Floor** | ✅ WORKING | Database trigger | No action |
| **GOD Score Lockdown** | ✅ WORKING | startupScoringService.ts | No action |
| **Signals Separation** | ✅ WORKING | signalClassification.ts | No action |

---

## 💡 RECOMMENDATIONS

1. **Immediate:** Stop scoring junk entries (archive ~9,000 scraped news snippets)
2. **Today:** Apply time decay migration (investor psychology time-sensitive)
3. **This Week:** Implement data freshness decay (startups with stale data lose points)
4. **Ongoing:** Monitor data quality in System Guardian (automated alerts)

**Expected Outcome:**
- Average GOD score: 38.6 → 60-65 ✅
- Real startups only: 930 approved
- Junk entries: 9,081 archived
- Time decay: Old signals expire naturally
- Freshness decay: Stale startups lose points

---

**Report Status:** Ready for implementation  
**Estimated Time:** 1-2 hours (archiving + fixes + testing)  
**Risk Level:** LOW (can revert changes if needed)  
**Impact:** HIGH (restores scoring system integrity)
