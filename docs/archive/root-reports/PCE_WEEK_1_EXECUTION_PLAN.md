# Phase Change Engine v1.1 - Week 1 Execution Plan

**Goal:** Transform from "impressive infra" → "product investors emotionally trust"  
**Timeline:** 5 days  
**Status:** Ready to Execute

---

## 📅 Day 1-2: Threshold Optimization

### Morning (2 hours)
**Task:** Mine backtest data for optimal thresholds

```sql
-- Step 1: View current separation scores
SELECT 
  domains_7d,
  avg_irrev_7d,
  pvi_accel_ratio,
  pvi_7d,
  winner_hit_rate,
  control_false_rate,
  separation_score
FROM backtest_threshold_grid_current
ORDER BY separation_score DESC
LIMIT 10;
```

**Action Items:**
1. ✅ Run query above
2. ✅ Pick top 3 parameter combinations
3. ✅ Note separation scores (target: >0.20)
4. ✅ Export to spreadsheet for documentation

---

### Afternoon (3 hours)
**Task:** Create new threshold profiles

```sql
-- Step 2: Insert optimized profiles
INSERT INTO goldilocks_threshold_profiles
(profile_key, description, min_domains_7d, min_avg_irrev_7d, min_pvi_7d, min_pvi_accel_ratio)
VALUES
('high_precision_v1', 'Backtest-optimized: max separation (0.XX)', 
 <domains_7d>, <avg_irrev_7d>, <pvi_7d>, <pvi_accel_ratio>),

('balanced_v1', 'Backtest-optimized: balanced coverage vs precision', 
 <domains_7d>, <avg_irrev_7d>, <pvi_7d>, <pvi_accel_ratio>),

('early_risk_v1', 'Backtest-optimized: catch early signals', 
 <domains_7d>, <avg_irrev_7d>, <pvi_7d>, <pvi_accel_ratio>);
```

**Action Items:**
1. ✅ Replace `<placeholders>` with actual values from backtest
2. ✅ Run INSERT statement
3. ✅ Verify with: `SELECT * FROM goldilocks_threshold_profiles;`
4. ✅ Document profile rationale in `PCE_THRESHOLD_PROFILES.md`

---

### Validation (30 min)
```sql
-- Step 3: Compare profile results
SELECT 
  profile_key,
  COUNT(*) FILTER (WHERE classification = 'goldilocks') as goldilocks_count,
  COUNT(*) as total_startups,
  ROUND(100.0 * COUNT(*) FILTER (WHERE classification = 'goldilocks') / COUNT(*), 2) as pct_goldilocks
FROM startup_goldilocks_by_profile
GROUP BY profile_key
ORDER BY goldilocks_count DESC;
```

**Expected Output:**
```
profile_key         | goldilocks_count | total_startups | pct_goldilocks
--------------------+------------------+----------------+---------------
early_goldilocks    | 45               | 150            | 30.00
balanced_v1         | 28               | 150            | 18.67
conviction_goldilocks| 12              | 150            | 8.00
high_precision_v1   | 8                | 150            | 5.33
```

**Success Criteria:**
- ✅ Profiles show clear gradation (early > balanced > conviction > precision)
- ✅ No profile captures >50% of startups (too loose)
- ✅ No profile captures <2% of startups (too strict)

---

## 📅 Day 3: Switch to Decayed Analytics

### Morning (1 hour)
**Task:** Audit current queries using non-decayed data

**Action Items:**
1. ✅ Search codebase: `grep -r "startup_phase_ledger" --include="*.ts" --include="*.tsx" --include="*.js"`
2. ✅ List all files using `startup_phase_ledger` (not `_decayed`)
3. ✅ Document locations in spreadsheet

**Expected locations:**
- Dashboard components
- Analytics pages
- Match regeneration scripts
- GOD score calculations

---

### Afternoon (4 hours)
**Task:** Replace with decayed ledger

**Find/Replace Pattern:**
```typescript
// BEFORE
const { data } = await supabase
  .from('startup_phase_ledger')
  .select('*');

// AFTER
const { data } = await supabase
  .from('startup_phase_ledger_decayed')
  .select('*, phase_score_decayed'); // Use decayed score instead of phase_score
```

**Critical Files to Update:**
1. `src/components/MatchingEngine.tsx` - If using PCE data
2. `src/pages/StartupDetail.tsx` - Timeline/phase info
3. `server/match-regenerator.js` - If using phase scores
4. Any admin dashboards showing phase data

**Action Items:**
1. ✅ Create git branch: `git checkout -b feature/phase-decay`
2. ✅ Update each file (commit per file for safety)
3. ✅ Test locally: `npm run dev`
4. ✅ Verify decayed scores appear lower than raw scores

---

### Validation (1 hour)
```sql
-- Step 1: Compare old vs new for sample startup
WITH comparison AS (
  SELECT 
    startup_id,
    SUM(phase_score) as total_raw,
    SUM(phase_score_decayed) as total_decayed,
    SUM(phase_score) - SUM(phase_score_decayed) as decay_loss
  FROM startup_phase_ledger_decayed
  GROUP BY startup_id
)
SELECT * FROM comparison
ORDER BY decay_loss DESC
LIMIT 10;
```

**Expected Output:**
```
startup_id | total_raw | total_decayed | decay_loss
-----------+-----------+---------------+-----------
<uuid>     | 125.4     | 78.2          | 47.2
<uuid>     | 98.1      | 62.5          | 35.6
```

**Success Criteria:**
- ✅ Decay loss should be 20-50% for most startups
- ✅ Older startups lose more (expected)
- ✅ Recent startups lose little (<10%)

---

## 📅 Day 4: Surface Archetypes in UI

### Morning (3 hours)
**Task:** Add archetype to startup cards

**File:** `src/components/StartupCard.tsx` (or equivalent)

```typescript
// Step 1: Fetch archetype
interface StartupWithArchetype extends Startup {
  archetype_key?: string;
  archetype_description?: string;
}

const { data: startups } = await supabase
  .from('startup_uploads')
  .select(`
    *,
    startup_phase_archetypes (
      archetype_key,
      archetype_description
    )
  `);

// Step 2: Add badge component
const ArchetypeBadge = ({ archetype }: { archetype?: string }) => {
  const colors = {
    human_led: 'bg-blue-100 text-blue-800',
    customer_pull: 'bg-green-100 text-green-800',
    market_tailwind: 'bg-purple-100 text-purple-800',
    capital_confirmed: 'bg-yellow-100 text-yellow-800',
    product_inflection: 'bg-red-100 text-red-800',
  };
  
  if (!archetype) return null;
  
  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[archetype]}`}>
      {archetype.replace('_', ' ')}
    </span>
  );
};

// Step 3: Use in card
<div className="startup-card">
  <h3>{startup.name}</h3>
  <ArchetypeBadge archetype={startup.startup_phase_archetypes?.[0]?.archetype_key} />
  {/* rest of card */}
</div>
```

**Action Items:**
1. ✅ Update type definitions
2. ✅ Add Supabase join query
3. ✅ Create `ArchetypeBadge` component
4. ✅ Style with Tailwind colors
5. ✅ Test on dev server

---

### Afternoon (3 hours)
**Task:** Add archetype filter

**File:** `src/components/StartupFilters.tsx` (or equivalent)

```typescript
const [archetypeFilter, setArchetypeFilter] = useState<string | null>(null);

const archetypes = [
  { key: 'human_led', label: 'Human-Led', color: 'blue' },
  { key: 'customer_pull', label: 'Customer Pull', color: 'green' },
  { key: 'market_tailwind', label: 'Market Tailwind', color: 'purple' },
  { key: 'capital_confirmed', label: 'Capital Confirmed', color: 'yellow' },
  { key: 'product_inflection', label: 'Product Inflection', color: 'red' },
];

// Filter logic
const filteredStartups = startups.filter(s => {
  if (!archetypeFilter) return true;
  return s.startup_phase_archetypes?.[0]?.archetype_key === archetypeFilter;
});

// UI
<select onChange={(e) => setArchetypeFilter(e.target.value || null)}>
  <option value="">All Archetypes</option>
  {archetypes.map(a => (
    <option key={a.key} value={a.key}>{a.label}</option>
  ))}
</select>
```

**Action Items:**
1. ✅ Add archetype state
2. ✅ Add filter dropdown
3. ✅ Wire up filter logic
4. ✅ Test: select "customer_pull" → should filter list

---

## 📅 Day 5: State Transition Feed on Homepage

### Morning (3 hours)
**Task:** Build transition feed component

**File:** `src/components/StateTransitionFeed.tsx` (new file)

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface StateTransition {
  startup_id: string;
  snapshot_date: string;
  prev_state: string;
  new_state: string;
  archetype_key: string;
  archetype_description: string;
  last_domain: string;
  last_subtype: string;
  startup_name: string;
}

export function StateTransitionFeed() {
  const [transitions, setTransitions] = useState<StateTransition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransitions();
  }, []);

  async function loadTransitions() {
    const { data } = await supabase
      .from('goldilocks_state_transitions')
      .select(`
        *,
        startup_uploads!inner(name)
      `)
      .gte('snapshot_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('snapshot_date', { ascending: false })
      .limit(20);

    if (data) {
      const mapped = data.map(t => ({
        ...t,
        startup_name: t.startup_uploads.name,
      }));
      setTransitions(mapped);
    }
    setLoading(false);
  }

  if (loading) return <div>Loading transitions...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Recent Breakouts</h2>
      {transitions.map((t, i) => (
        <div key={i} className="border-l-4 border-blue-500 pl-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t.startup_name}</span>
            <span className="text-gray-500">
              {t.prev_state} → {t.new_state}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {t.archetype_description}
          </div>
          <div className="text-xs text-gray-400">
            Triggered by: {t.last_domain} · {t.last_subtype}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Action Items:**
1. ✅ Create component file
2. ✅ Add to homepage: `src/App.tsx` or `src/pages/Home.tsx`
3. ✅ Style with Tailwind
4. ✅ Make startup names clickable: `<Link to={`/startup/${t.startup_id}`}>`

---

### Afternoon (2 hours)
**Task:** Polish and deploy

**Polish Checklist:**
1. ✅ Add archetype icon/emoji to each transition
2. ✅ Format dates nicely: `"2 days ago"` instead of ISO string
3. ✅ Add "View All" link if >20 transitions
4. ✅ Add loading skeleton
5. ✅ Add empty state: "No transitions in last 7 days"

**Deployment:**
```bash
git add .
git commit -m "feat: add phase archetypes and decay scoring"
git push origin feature/phase-decay
# Create PR, merge to main
npm run build
# Deploy to production
```

---

## ✅ Week 1 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Threshold profiles deployed | 3-5 profiles | `SELECT COUNT(*) FROM goldilocks_threshold_profiles` |
| Decay applied across codebase | 100% | No queries use `startup_phase_ledger` directly |
| Archetype visible in UI | Yes | Badge shows on all startup cards |
| Transition feed live | Yes | Homepage shows last 7 days of state changes |
| Investor engagement | Baseline | Track clicks on transition feed |

---

## 🔥 Quick Wins to Highlight

After Week 1, you can now answer:

### Question 1: "What makes this startup different?"
**Before:** "It has a high GOD score and good traction."  
**After:** "This is a **customer-pull** breakout - customers are literally pulling the product into existence. They just published an enterprise case study and moved into SURGE state."

---

### Question 2: "Are there any others like this?"
**Before:** "Let me filter by sector..."  
**After:** "There are 8 other **customer-pull** breakouts in fintech right now. Here they are." [click filter → instant results]

---

### Question 3: "What happened this week?"
**Before:** [manually check each startup]  
**After:** [scroll transition feed] "3 startups entered WARMING, 2 moved to SURGE, and Acme Corp hit BREAKOUT after their Series A closed."

---

## 🚨 Troubleshooting

### Decay not working?
```sql
-- Check if decay function exists
SELECT decayed_phase_score(100, 'product', NOW() - INTERVAL '60 days');
-- Should return ~25 (75% decay after 2 half-lives)
```

### Archetypes all showing same value?
```sql
-- Check weight distribution
SELECT 
  archetype_key,
  product_weight + human_weight + customer_weight + capital_weight + market_weight as total_weight
FROM phase_archetypes;
-- Should all sum to 1.0
```

### Transition feed empty?
```sql
-- Check if snapshots are running
SELECT MAX(snapshot_date) FROM startup_goldilocks_state_history;
-- Should be < 24 hours ago

-- Manually trigger snapshot
SELECT snapshot_goldilocks_states();
```

---

## 📖 Additional Resources

- **Query Examples:** [PCE_QUERY_EXAMPLES.md](PCE_QUERY_EXAMPLES.md)
- **Deployment Summary:** [PCE_V1_1_DEPLOYMENT_SUMMARY.md](PCE_V1_1_DEPLOYMENT_SUMMARY.md)
- **System Guardian:** [SYSTEM_GUARDIAN.md](SYSTEM_GUARDIAN.md) - Add PCE health checks
- **Copilot Instructions:** [.github/copilot-instructions.md](.github/copilot-instructions.md) - Add PCE patterns

---

**Last Updated:** January 18, 2026  
**Owner:** [Your Team]  
**Next Review:** End of Week 1 (January 24, 2026)
