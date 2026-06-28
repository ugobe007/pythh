# Phase Change Engine - Week 1 Operational Playbook

**Status:** ✅ All views deployed  
**Date:** January 18, 2026  
**Goal:** Ship investor-legible breakout detection in 5 days

---

## 🎯 Pre-Flight Check

### Verify all views deployed
```sql
SELECT 
  table_name,
  'VIEW' as type
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN (
    'startup_phase_velocity_decayed',
    'startup_goldilocks_dashboard_decayed',
    'startup_feed_v1_1',
    'goldilocks_transition_feed_v1_1'
  )
ORDER BY table_name;
```

**Expected:** 4 rows returned

---

## 📅 Day 1-2: Lock Optimal Thresholds

### Step 1: Pull backtest candidates
```sql
SELECT 
  domains_7d,
  avg_irrev_7d,
  pvi_accel_ratio,
  pvi_7d,
  winner_hit_rate,
  control_false_rate,
  separation_score,
  winner_count,
  control_count
FROM public.backtest_threshold_grid_current
ORDER BY separation_score DESC, winner_hit_rate DESC
LIMIT 25;
```

**If backtest is empty:** The grid requires labeled winner/control cohorts. You have two options:

#### Option A: Use current seed values (fastest)
The deployed profiles are already reasonable:
- `early_goldilocks`: domains≥2, irrev≥0.45, PVI≥1.8, accel≥1.7
- `conviction_goldilocks`: domains≥3, irrev≥0.55, PVI≥3.2, accel≥2.4

Skip to **Step 3** below.

#### Option B: Manual tuning based on current data
```sql
-- See distribution of current metrics
SELECT
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY domains_7d) as p25_domains,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY domains_7d) as p50_domains,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY domains_7d) as p75_domains,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY domains_7d) as p90_domains,
  
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY avg_irrev_7d) as p25_irrev,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY avg_irrev_7d) as p50_irrev,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY avg_irrev_7d) as p75_irrev,
  
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY pvi_7d) as p25_pvi,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pvi_7d) as p50_pvi,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pvi_7d) as p75_pvi,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY pvi_7d) as p90_pvi,
  
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY pvi_accel_ratio) as p50_accel,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY pvi_accel_ratio) as p75_accel,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY pvi_accel_ratio) as p90_accel
FROM public.startup_goldilocks_dashboard
WHERE domains_7d > 0;
```

**Rule of thumb:**
- `early_goldilocks` → Use p50-p60 thresholds (middle 50%)
- `conviction_goldilocks` → Use p75-p85 thresholds (top 15-25%)

---

### Step 2: Choose 2 profiles

**Example choices based on percentile data:**

If your p50 PVI is ~2.5 and p75 is ~4.0:

**Early Profile (higher recall):**
- domains_7d: 2 (catch multi-domain early)
- avg_irrev_7d: 0.47 (slightly below p50)
- pvi_7d: 2.0 (p40-p50 range)
- pvi_accel_ratio: 1.8 (modest acceleration)

**Conviction Profile (lower FP rate):**
- domains_7d: 3 (require proven breadth)
- avg_irrev_7d: 0.56 (p60-p70)
- pvi_7d: 3.3 (p70-p75)
- pvi_accel_ratio: 2.5 (strong acceleration)

---

### Step 3: Update profiles
```sql
-- Lock early_goldilocks thresholds
UPDATE public.goldilocks_threshold_profiles
SET
  min_domains_7d = 2,
  min_avg_irrev_7d = 0.47,
  min_pvi_7d = 2.0,
  min_pvi_accel_ratio = 1.8,
  description = 'Early signal, higher recall (tuned v1.1 - Jan 2026)'
WHERE profile_key = 'early_goldilocks';

-- Lock conviction_goldilocks thresholds
UPDATE public.goldilocks_threshold_profiles
SET
  min_domains_7d = 3,
  min_avg_irrev_7d = 0.56,
  min_pvi_7d = 3.3,
  min_pvi_accel_ratio = 2.5,
  description = 'High precision, conviction-only (tuned v1.1 - Jan 2026)'
WHERE profile_key = 'conviction_goldilocks';

-- Verify update
SELECT * FROM public.goldilocks_threshold_profiles;
```

---

### Step 4: Sanity check - How many qualify?
```sql
SELECT
  profile_key,
  COUNT(*) FILTER (WHERE classification='goldilocks') AS goldilocks_count,
  COUNT(*) AS total_startups,
  ROUND(100.0 * COUNT(*) FILTER (WHERE classification='goldilocks') / COUNT(*), 2) AS pct_goldilocks
FROM public.startup_goldilocks_by_profile
GROUP BY profile_key
ORDER BY profile_key;
```

**Expected output:**
```
profile_key           | goldilocks_count | total_startups | pct_goldilocks
----------------------+------------------+----------------+---------------
conviction_goldilocks | 12               | 150            | 8.00
early_goldilocks      | 45               | 150            | 30.00
```

**Health check:**
- ✅ Early should capture 25-40% of startups
- ✅ Conviction should capture 5-15% of startups
- ✅ Early should be 2-4× larger than Conviction
- ❌ If Early >50% → tighten thresholds
- ❌ If Conviction <2% → loosen slightly

---

## 📅 Day 3: Switch to Decayed Scoring

### Step 1: Compare raw vs decayed impact
```sql
-- See how decay affects top startups
WITH comparison AS (
  SELECT 
    s.name,
    gd.pvi_7d as raw_pvi,
    gd_decay.pvi_7d as decayed_pvi,
    gd.pvi_7d - gd_decay.pvi_7d as pvi_loss,
    gd.goldilocks_phase_state as raw_state,
    gd_decay.goldilocks_phase_state as decayed_state
  FROM startup_uploads s
  JOIN startup_goldilocks_dashboard gd ON s.id = gd.startup_id
  JOIN startup_goldilocks_dashboard_decayed gd_decay ON s.id = gd_decay.startup_id
  WHERE gd.pvi_7d > 0
)
SELECT * FROM comparison
ORDER BY pvi_loss DESC
LIMIT 20;
```

**What to look for:**
- Startups with high `pvi_loss` had old signals → decay working correctly
- State downgrades (surge → warming) = zombie breakouts eliminated ✅
- Recent startups should have minimal loss (<10%)

---

### Step 2: Identify "zombie breakouts" eliminated
```sql
-- Startups that lose Goldilocks status after decay
SELECT 
  s.name,
  gd.goldilocks_phase_state as before_decay,
  gd_decay.goldilocks_phase_state as after_decay,
  gd.pvi_7d as raw_pvi,
  gd_decay.pvi_7d as decayed_pvi,
  gd.last_occurred_at,
  EXTRACT(days FROM NOW() - gd.last_occurred_at) as days_since_last_signal
FROM startup_uploads s
JOIN startup_goldilocks_dashboard gd ON s.id = gd.startup_id
JOIN startup_goldilocks_dashboard_decayed gd_decay ON s.id = gd_decay.startup_id
WHERE gd.goldilocks_phase_state IN ('warming', 'surge', 'breakout')
  AND gd_decay.goldilocks_phase_state IN ('quiet', 'watch')
ORDER BY days_since_last_signal DESC;
```

**Expected:** Startups with signals >60 days old getting downgraded = decay eliminating stale breakouts ✅

---

### Step 3: Decision point - Switch to decayed dashboard?

**If decay feels right:** Update your API/UI to query `startup_goldilocks_dashboard_decayed` instead of `startup_goldilocks_dashboard`

**Code change locations:**
```typescript
// BEFORE
const { data } = await supabase
  .from('startup_goldilocks_dashboard')
  .select('*');

// AFTER
const { data } = await supabase
  .from('startup_goldilocks_dashboard_decayed')
  .select('*');
```

**Files likely affected:**
- `src/components/MatchingEngine.tsx`
- `src/pages/StartupDetail.tsx`
- `src/pages/admin/*Dashboard*.tsx`
- `server/match-regenerator.js` (if using phase data)

**Rollback plan:** Just change the view name back. No data is modified.

---

## 📅 Day 4: Surface Archetypes in UI

### Step 1: Test the unified feed view
```sql
-- This is your single source of truth for UI
SELECT 
  startup_id,
  goldilocks_phase_state,
  is_early_goldilocks,
  is_conviction_goldilocks,
  archetype_key,
  archetype_description,
  pvi_7d,
  domains_7d,
  last_domain,
  last_subtype
FROM public.startup_feed_v1_1
WHERE goldilocks_phase_state IN ('warming', 'surge', 'breakout')
ORDER BY pvi_7d DESC
LIMIT 20;
```

**Expected columns for UI:**
- `archetype_key` → Badge/chip component
- `is_early_goldilocks` / `is_conviction_goldilocks` → Profile badges
- `goldilocks_phase_state` → State indicator
- `last_domain` + `last_subtype` → "Triggered by..." text

---

### Step 2: UI component sketch

**Archetype Badge Component:**
```typescript
interface ArchetypeBadgeProps {
  archetype: string | null;
  size?: 'sm' | 'md';
}

const ARCHETYPE_CONFIG = {
  human_led: { 
    label: 'Human-Led', 
    color: 'bg-blue-100 text-blue-800',
    icon: '👥'
  },
  customer_pull: { 
    label: 'Customer Pull', 
    color: 'bg-green-100 text-green-800',
    icon: '🎯'
  },
  market_tailwind: { 
    label: 'Market Tailwind', 
    color: 'bg-purple-100 text-purple-800',
    icon: '🌊'
  },
  capital_confirmed: { 
    label: 'Capital Confirmed', 
    color: 'bg-yellow-100 text-yellow-800',
    icon: '💰'
  },
  product_inflection: { 
    label: 'Product Inflection', 
    color: 'bg-red-100 text-red-800',
    icon: '🚀'
  },
};

export function ArchetypeBadge({ archetype, size = 'md' }: ArchetypeBadgeProps) {
  if (!archetype || !ARCHETYPE_CONFIG[archetype]) return null;
  
  const config = ARCHETYPE_CONFIG[archetype];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${config.color} ${sizeClass}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
```

---

### Step 3: Add archetype filter
```sql
-- Query for filter dropdown
SELECT 
  archetype_key,
  description as archetype_description,
  COUNT(*) as startup_count
FROM public.startup_phase_archetypes
GROUP BY archetype_key, description
ORDER BY startup_count DESC;
```

**Filter component:**
```typescript
const [archetypeFilter, setArchetypeFilter] = useState<string | null>(null);
const [profileFilter, setProfileFilter] = useState<'early' | 'conviction' | null>(null);

// Apply filters
const filteredStartups = startups.filter(s => {
  if (archetypeFilter && s.archetype_key !== archetypeFilter) return false;
  if (profileFilter === 'early' && !s.is_early_goldilocks) return false;
  if (profileFilter === 'conviction' && !s.is_conviction_goldilocks) return false;
  return true;
});
```

---

### Step 4: Example queries for investor use cases

**"Show me customer-pull breakouts in fintech"**
```sql
SELECT 
  s.name,
  f.archetype_description,
  f.goldilocks_phase_state,
  f.pvi_7d,
  f.last_domain,
  f.last_subtype
FROM startup_uploads s
JOIN startup_feed_v1_1 f ON s.id = f.startup_id
WHERE f.archetype_key = 'customer_pull'
  AND s.sectors && ARRAY['Fintech']
  AND f.goldilocks_phase_state IN ('surge', 'breakout')
ORDER BY f.pvi_7d DESC;
```

**"Who's in conviction_goldilocks but not early_goldilocks?" (high quality only)**
```sql
SELECT 
  s.name,
  f.archetype_key,
  f.goldilocks_phase_state,
  f.pvi_7d
FROM startup_uploads s
JOIN startup_feed_v1_1 f ON s.id = f.startup_id
WHERE f.is_conviction_goldilocks = 1
  AND f.is_early_goldilocks = 0
ORDER BY f.pvi_7d DESC;
```

---

## 📅 Day 5: Deploy State Transition Feed

### Step 1: Test the enriched transition feed
```sql
-- This is your homepage "What's changing right now?" block
SELECT 
  s.name as startup_name,
  t.snapshot_date,
  t.prev_state,
  t.new_state,
  t.archetype_key,
  t.archetype_description,
  t.last_domain,
  t.last_subtype,
  t.is_early_goldilocks,
  t.is_conviction_goldilocks
FROM public.goldilocks_transition_feed_v1_1 t
JOIN startup_uploads s ON t.startup_id = s.id
WHERE t.snapshot_date >= NOW() - INTERVAL '7 days'
ORDER BY t.snapshot_date DESC
LIMIT 50;
```

**If empty:** No state transitions recorded yet. Run:
```sql
SELECT public.snapshot_goldilocks_states();
```

Then wait 24h and check again. Or manually insert historical snapshots:
```sql
INSERT INTO startup_goldilocks_state_history (startup_id, snapshot_date, goldilocks_phase_state, domains_7d, avg_irrev_7d, pvi_7d, pvi_accel_ratio)
SELECT 
  startup_id,
  CURRENT_DATE - INTERVAL '1 day' as snapshot_date,
  goldilocks_phase_state,
  domains_7d,
  avg_irrev_7d,
  pvi_7d,
  pvi_accel_ratio
FROM startup_goldilocks_dashboard
ON CONFLICT DO NOTHING;
```

---

### Step 2: UI Component - Transition Feed
```typescript
interface StateTransition {
  startup_id: string;
  startup_name: string;
  snapshot_date: string;
  prev_state: string;
  new_state: string;
  archetype_key: string;
  archetype_description: string;
  last_domain: string;
  last_subtype: string;
  is_early_goldilocks: number;
  is_conviction_goldilocks: number;
}

export function StateTransitionFeed() {
  const [transitions, setTransitions] = useState<StateTransition[]>([]);

  useEffect(() => {
    async function loadTransitions() {
      const { data } = await supabase
        .from('goldilocks_transition_feed_v1_1')
        .select(`
          *,
          startup_uploads!inner(name)
        `)
        .gte('snapshot_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('snapshot_date', { ascending: false })
        .limit(20);

      if (data) {
        setTransitions(data.map(t => ({
          ...t,
          startup_name: t.startup_uploads.name,
        })));
      }
    }
    loadTransitions();
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold">Recent State Changes</h2>
      {transitions.map((t, i) => (
        <div key={i} className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50">
          <Link to={`/startup/${t.startup_id}`} className="block">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg">{t.startup_name}</span>
              <ArchetypeBadge archetype={t.archetype_key} size="sm" />
              {t.is_conviction_goldilocks === 1 && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  Conviction
                </span>
              )}
            </div>
            
            <div className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{t.prev_state}</span>
              {' → '}
              <span className="font-medium text-blue-600">{t.new_state}</span>
              <span className="text-gray-400 ml-2">
                {formatDistanceToNow(new Date(t.snapshot_date), { addSuffix: true })}
              </span>
            </div>
            
            <div className="text-xs text-gray-500">
              Triggered by: {t.last_domain} · {t.last_subtype}
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
```

---

### Step 3: Example headline copy for transitions

**Template:**
```
{startup_name} moved {prev_state} → {new_state}
Archetype: {archetype_description}
Triggered by: {last_domain} · {last_subtype}
```

**Real examples:**
```
Acme Corp moved SURGE → BREAKOUT
Archetype: Customer-pull (customers pulling product into existence)
Triggered by: customer · enterprise_case_study

Beta Inc entered WARMING
Archetype: Human-led (driven by people and credibility)
Triggered by: human · ex_FAANG_executive

Gamma Labs moved WATCH → WARMING
Archetype: Market tailwind (exogenous market unlock)
Triggered by: market · regulatory_approval
```

---

## 🔄 Daily Operations (Post-Week 1)

### Daily cron job
```sql
-- Run once per day (or twice if you want faster transitions)
SELECT public.run_pce_daily(180, 0.60, 0.35);
SELECT public.snapshot_goldilocks_states();
```

**Add to crontab or PM2:**
```bash
# Daily at 3am
0 3 * * * psql $DATABASE_URL -c "SELECT public.run_pce_daily(180, 0.60, 0.35); SELECT public.snapshot_goldilocks_states();"
```

---

## 📊 Success Metrics (Track Weekly)

### Metric 1: Profile separation
```sql
SELECT 
  profile_key,
  COUNT(*) FILTER (WHERE classification='goldilocks') as goldilocks_count,
  AVG(pvi_7d) FILTER (WHERE classification='goldilocks') as avg_pvi_goldilocks,
  AVG(pvi_7d) FILTER (WHERE classification='non_goldilocks') as avg_pvi_non_goldilocks
FROM startup_goldilocks_by_profile
JOIN startup_goldilocks_dashboard USING (startup_id)
GROUP BY profile_key;
```

**Target:** Goldilocks startups should have 2-3× higher avg PVI than non-Goldilocks

---

### Metric 2: Archetype balance
```sql
SELECT 
  archetype_key,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as pct
FROM startup_phase_archetypes
GROUP BY archetype_key
ORDER BY count DESC;
```

**Target:** No archetype should exceed 40% (would indicate skewed weighting)

---

### Metric 3: Decay impact
```sql
SELECT 
  AVG(gd.pvi_7d - gd_decay.pvi_7d) as avg_decay_loss,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY gd.pvi_7d - gd_decay.pvi_7d) as median_decay_loss,
  COUNT(*) FILTER (WHERE gd.goldilocks_phase_state != gd_decay.goldilocks_phase_state) as state_changes
FROM startup_goldilocks_dashboard gd
JOIN startup_goldilocks_dashboard_decayed gd_decay USING (startup_id);
```

**Target:** 
- Median decay loss: 15-30% of raw PVI
- State changes: 5-15% of startups (zombies eliminated)

---

### Metric 4: Transition volume
```sql
SELECT 
  DATE_TRUNC('day', snapshot_date) as day,
  COUNT(*) as transitions,
  COUNT(*) FILTER (WHERE new_state IN ('surge', 'breakout')) as upward_transitions
FROM goldilocks_state_transitions
WHERE snapshot_date >= NOW() - INTERVAL '14 days'
GROUP BY day
ORDER BY day DESC;
```

**Target:** 5-20 transitions/day depending on dataset size

---

## 🚨 Troubleshooting

### Issue: Transition feed is empty
**Diagnosis:**
```sql
SELECT MAX(snapshot_date) FROM startup_goldilocks_state_history;
```

**If NULL:** No snapshots taken yet. Run:
```sql
SELECT public.snapshot_goldilocks_states();
```

**If date is old:** Snapshots not running daily. Check cron/PM2 jobs.

---

### Issue: All startups have same archetype
**Diagnosis:**
```sql
SELECT * FROM phase_archetypes;
```

**If all weights equal:** Archetypes need differentiation. Update weights so each archetype emphasizes one domain (50% weight).

---

### Issue: Decay has no effect
**Diagnosis:**
```sql
SELECT 
  domain,
  AVG(EXTRACT(days FROM NOW() - occurred_at)) as avg_age_days
FROM startup_phase_ledger_decayed
GROUP BY domain;
```

**If all ages <7 days:** Data is too fresh for decay to matter. Normal.

**If ages >60 days but decay_loss is 0:** Check `decayed_phase_score()` function is being called correctly.

---

## 📋 Week 1 Completion Checklist

- [ ] Day 1-2: Threshold profiles locked (both updated with v1.1 values)
- [ ] Day 3: Decayed views deployed and tested (compare raw vs decayed)
- [ ] Day 3: Code switched to use `_decayed` views in production
- [ ] Day 4: Archetype badges visible on startup cards
- [ ] Day 4: Archetype filter working in UI
- [ ] Day 5: State transition feed deployed on homepage
- [ ] Day 5: Daily snapshot job scheduled (cron/PM2)
- [ ] All 4 operational views verified: `startup_phase_velocity_decayed`, `startup_goldilocks_dashboard_decayed`, `startup_feed_v1_1`, `goldilocks_transition_feed_v1_1`

---

## 🎯 Investor Demo Script (Post-Week 1)

**Opening:**
"We built an early inevitability detection system. Let me show you what just changed this week."

**Show transition feed:**
"These 5 startups moved into SURGE or BREAKOUT state in the last 7 days. Here's one..."

**Click on customer-pull startup:**
"This is a **customer-pull** breakout - meaning customers are pulling the product into existence. They just published an enterprise case study and triggered our detection system."

**Filter by archetype:**
"Let me show you all the customer-pull breakouts we're tracking right now. [clicks filter] Here are 8 more."

**Compare profiles:**
"This startup qualifies under both our early_goldilocks profile (higher recall) and our conviction_goldilocks profile (high precision). That's a strong signal."

**End:**
"The physics is running underneath - tracking 5 orthogonal domains, applying time decay, calculating phase velocity. But what you see is the story: who's breaking out, why, and what pattern they're following."

---

**Next Week Preview:**
- Week 2: Auto-winner cohort generation (self-labeling from outcomes)
- Week 3: Phase decay fine-tuning per domain
- Week 4: Regime shift detection (market-wide breakout frequency)

