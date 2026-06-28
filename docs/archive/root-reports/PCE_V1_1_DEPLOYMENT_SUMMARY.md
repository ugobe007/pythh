# Phase Change Engine v1.1 - Deployment Summary

**Deployed:** January 18, 2026  
**Status:** ✅ Production Ready  
**Migration:** `phase_archetypes_and_profiles_v1_1` + `integrate_archetypes_into_timeline`

---

## 🎯 What Just Shipped

### 1️⃣ Threshold Profiles (Goldilocks v1.1)
**Before:** Thresholds hardcoded in views  
**After:** Externalized, versioned threshold profiles

**New Tables:**
- `goldilocks_threshold_profiles` - Store named threshold sets

**New Views:**
- `startup_goldilocks_by_profile` - Cross-product of startups × profiles

**Seed Profiles:**
- `early_goldilocks` - Higher risk tolerance (domains ≥2, irrev ≥0.45, PVI ≥1.8, accel ≥1.7)
- `conviction_goldilocks` - Stronger inevitability (domains ≥3, irrev ≥0.55, PVI ≥3.2, accel ≥2.4)

**Impact:** Investors can now say "This startup is Goldilocks under early_goldilocks but not conviction_goldilocks" - natural language + precision.

---

### 2️⃣ Phase Decay (Time-Aware Scoring)
**Before:** Old signals counted same as new signals  
**After:** Exponential decay based on domain-specific half-lives

**New Tables:**
- `phase_decay_params` - Domain-specific decay parameters

**New Functions:**
- `decayed_phase_score(base_score, domain, occurred_at)` - Apply exponential decay

**New Views:**
- `startup_phase_ledger_decayed` - Drop-in replacement with decay applied

**Decay Parameters:**
| Domain | Half-Life | Min Multiplier | Reasoning |
|--------|-----------|----------------|-----------|
| Product | 30 days | 0.20 | Rapid iteration, signals fade fast |
| Human | 120 days | 0.35 | Advisors/board = stable signal |
| Customer | 90 days | 0.30 | Logos age but matter longer |
| Capital | 150 days | 0.40 | Funding announcements last |
| Market | 180 days | 0.45 | Regulatory/platform changes persist |

**Formula:** `decayed_score = base_score × max(min_multiplier, exp(ln(0.5) × days_old / half_life))`

**Impact:** Eliminates "zombie breakouts" - startups that triggered once 6 months ago but haven't moved since.

---

### 3️⃣ Phase Archetypes (Human-Readable Intelligence)
**Before:** Math soup - hard to explain to investors  
**After:** Named patterns investors understand intuitively

**New Tables:**
- `phase_archetypes` - Weighted archetype definitions

**New Views:**
- `startup_phase_archetypes` - Dominant archetype per startup (uses decayed scores)

**Seed Archetypes:**
| Archetype | Description | Dominant Domain | Use Case |
|-----------|-------------|-----------------|----------|
| `human_led` | Breakout driven by people and credibility | Human (50%) | Founder-driven companies |
| `customer_pull` | Customers pulling product into existence | Customer (50%) | Product-market fit stories |
| `market_tailwind` | Exogenous market unlock drives inevitability | Market (50%) | Regulatory/platform plays |
| `capital_confirmed` | Capital validates earlier signals | Capital (50%) | Later-stage conviction |
| `product_inflection` | Sharp product/ICP discovery | Product (50%) | Technical breakthroughs |

**Scoring Logic:**
```
archetype_score = (
  product_s × product_weight +
  human_s × human_weight +
  customer_s × customer_weight +
  capital_s × capital_weight +
  market_s × market_weight
)

# Highest scoring archetype wins
SELECT DISTINCT ON (startup_id)
  startup_id, archetype_key, archetype_score
ORDER BY startup_id, archetype_score DESC
```

**Impact:** Turns technical sophistication into investor-legible narratives. "This is a customer-pull breakout" > "irreversibility = 0.73, coupling = 0.82"

---

### 4️⃣ State Transition Feed (Narrative Engine)
**Before:** Static state snapshots  
**After:** Temporal feed of state changes with context

**New Views:**
- `goldilocks_state_transitions` - Window function-based transition detector

**Columns:**
- `startup_id`, `snapshot_date`
- `prev_state`, `new_state` - State transition
- `archetype_key`, `archetype_description` - Pattern context
- `last_domain`, `last_subtype`, `last_phase_score`, `last_occurred_at` - Trigger event

**Example Output:**
```
SURGE → BREAKOUT on 2026-01-17
Archetype: customer_pull
Triggered by:
  • Customer: enterprise case study (score 22.3)
  • Human: technical cofounder joined
```

**Impact:** This is homepage gold. Real-time feed of "who's breaking out and why".

---

## 🔧 Enhanced Functions

### `get_startup_phase_timeline(uuid, limit)`
**New Fields:**
- `current_archetype` - Dominant archetype key
- `archetype_description` - Human-readable explanation

**Usage:**
```sql
SELECT get_startup_phase_timeline('<uuid>', 50);
```

**Returns:**
```json
{
  "startup_id": "...",
  "current_archetype": "customer_pull",
  "archetype_description": "Customers pulling product into existence",
  "events": [...]
}
```

---

### `explain_goldilocks(uuid)`
**New Fields:**
- `current_archetype` - Archetype key
- `archetype_description` - Explanation
- `archetype_score` - Numerical score
- `profile_classifications` - Array of profile verdicts

**Usage:**
```sql
SELECT explain_goldilocks('<uuid>');
```

**Returns:**
```json
{
  "startup_id": "...",
  "current_state": "surge",
  "current_archetype": "customer_pull",
  "archetype_description": "Customers pulling product into existence",
  "archetype_score": 12.5,
  "metrics": {
    "domains_7d": 3,
    "avg_irrev_7d": 0.68,
    "pvi_7d": 4.2,
    "pvi_accel_ratio": 2.8
  },
  "last_signal": {...},
  "profile_classifications": [
    {
      "profile": "early_goldilocks",
      "classification": "goldilocks",
      "thresholds": {
        "domains_7d": 2,
        "avg_irrev_7d": 0.45,
        "pvi_7d": 1.8,
        "pvi_accel_ratio": 1.7
      }
    },
    {
      "profile": "conviction_goldilocks",
      "classification": "non_goldilocks",
      "thresholds": {...}
    }
  ]
}
```

---

## 📊 Database Objects Created

### Tables (4)
1. `goldilocks_threshold_profiles` - Named threshold sets
2. `phase_decay_params` - Domain-specific decay parameters
3. `phase_archetypes` - Weighted archetype definitions
4. (Pre-existing) `startup_goldilocks_state_history` - Used by transition feed

### Functions (3)
1. `decayed_phase_score(numeric, phase_domain, timestamptz)` - Exponential decay calculator
2. `get_startup_phase_timeline(uuid, int)` - Enhanced with archetype
3. `explain_goldilocks(uuid)` - Enhanced with archetype + profiles

### Views (4)
1. `startup_goldilocks_by_profile` - Startup × profile cross-product
2. `startup_phase_ledger_decayed` - Ledger with decay applied
3. `startup_phase_archetypes` - Dominant archetype per startup
4. `goldilocks_state_transitions` - State change feed

---

## 🎯 Key Metrics to Monitor

### Decay Effectiveness
```sql
SELECT 
  domain,
  AVG(phase_score - phase_score_decayed) as avg_decay_loss,
  AVG(phase_score_decayed / NULLIF(phase_score, 0)) as avg_decay_ratio
FROM startup_phase_ledger_decayed
GROUP BY domain;
```

**Expected:** Product should decay fastest (ratio ~0.3-0.5), Market slowest (ratio ~0.7-0.9)

---

### Archetype Distribution
```sql
SELECT 
  archetype_key,
  COUNT(*) as startup_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM startup_phase_archetypes
GROUP BY archetype_key;
```

**Expected:** Roughly even distribution (15-25% each). If one archetype dominates (>50%), weights may need adjustment.

---

### Profile Calibration
```sql
SELECT 
  profile_key,
  classification,
  COUNT(*) as count,
  AVG(pvi_7d) as avg_pvi
FROM startup_goldilocks_by_profile
GROUP BY profile_key, classification;
```

**Expected:**
- `early_goldilocks` should have ~2-3× more Goldilocks startups than `conviction_goldilocks`
- Avg PVI for Goldilocks startups should be >2.0 for early, >3.5 for conviction

---

### State Transition Volume
```sql
SELECT 
  DATE_TRUNC('day', snapshot_date) as day,
  COUNT(*) as transitions
FROM goldilocks_state_transitions
WHERE snapshot_date >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day;
```

**Expected:** 5-20 transitions/day depending on dataset size. If 0 transitions for >3 days, check if `snapshot_goldilocks_states()` is running.

---

## 🚀 Next Steps (Week 1)

### Day 1-2: Threshold Optimization
1. Run backtest grid to find optimal thresholds:
   ```sql
   SELECT * FROM backtest_threshold_grid_current
   ORDER BY separation_score DESC
   LIMIT 10;
   ```
2. Pick top 2-3 parameter sets
3. Insert as new profiles in `goldilocks_threshold_profiles`
4. Document profile rationale

**Goal:** Move from intuition-based thresholds to data-driven profiles

---

### Day 3: Switch to Decayed Analytics
1. Update all analytics dashboards to use `startup_phase_ledger_decayed` instead of `startup_phase_ledger`
2. Compare old vs new PVI calculations
3. Document any startups that drop out of Goldilocks after decay applied

**Goal:** Eliminate zombie breakouts from investor view

---

### Day 4: Surface Archetypes in UI
1. Add archetype badge to startup cards
2. Color-code by archetype:
   - `human_led` = Blue
   - `customer_pull` = Green
   - `market_tailwind` = Purple
   - `capital_confirmed` = Gold
   - `product_inflection` = Red
3. Add filter: "Show only customer_pull breakouts"

**Goal:** Make archetypes visible, filterable, actionable

---

### Day 5: State Transition Feed on Homepage
1. Query `goldilocks_state_transitions` for last 7 days
2. Render as timeline:
   ```
   Jan 18: Acme Corp moved SURGE → BREAKOUT
           Archetype: customer_pull
           Trigger: Enterprise case study published
   
   Jan 17: Beta Inc entered WARMING
           Archetype: human_led
           Trigger: Ex-Google VP joined as CTO
   ```
3. Make startup names clickable → detail page
4. Add archetype icon next to each transition

**Goal:** Real-time "what's changing?" feed that tells a story

---

## 🔐 Reversibility Plan

### Rollback Strategy
If decay/archetypes cause issues, **switch views only**:

```sql
-- Use non-decayed ledger
SELECT * FROM startup_phase_ledger; -- instead of startup_phase_ledger_decayed

-- Ignore archetypes
-- Just don't query startup_phase_archetypes

-- Use original dashboard
SELECT * FROM startup_goldilocks_dashboard; -- ignores profiles
```

**No data is modified** - all changes are views/functions only. Raw `startup_phase_changes` table untouched.

---

### Data Cleanup (if needed)
```sql
-- Drop new objects (keeps old system intact)
DROP VIEW IF EXISTS goldilocks_state_transitions;
DROP VIEW IF EXISTS startup_phase_archetypes;
DROP VIEW IF EXISTS startup_phase_ledger_decayed;
DROP VIEW IF EXISTS startup_goldilocks_by_profile;

DROP FUNCTION IF EXISTS decayed_phase_score(numeric, phase_domain, timestamptz);

DROP TABLE IF EXISTS phase_archetypes;
DROP TABLE IF EXISTS phase_decay_params;
DROP TABLE IF EXISTS goldilocks_threshold_profiles;
```

---

## 📖 Documentation References

- **Query Examples:** [PCE_QUERY_EXAMPLES.md](PCE_QUERY_EXAMPLES.md)
- **Archetype Theory:** See "3️⃣ Phase Archetypes" above
- **Decay Math:** `exp(ln(0.5) × days_old / half_life)` - standard exponential decay
- **Profile Tuning:** Use `backtest_threshold_grid_current` for empirical optimization

---

## 🎓 Investor Talking Points

### Before (v1.0)
"We track phase changes across 5 domains and calculate a phase velocity index."

**Investor reaction:** "Huh? What's a phase change?"

---

### After (v1.1)
"We detect early breakout patterns. Right now we're seeing 12 startups in **customer-pull** mode - meaning customers are pulling the product into existence. Here's one that just moved from SURGE to BREAKOUT this week because they published an enterprise case study."

**Investor reaction:** "Show me more customer-pull breakouts in fintech."

---

## ✅ Deployment Checklist

- [x] `goldilocks_threshold_profiles` table created
- [x] Seed profiles (`early_goldilocks`, `conviction_goldilocks`) inserted
- [x] `startup_goldilocks_by_profile` view deployed
- [x] `phase_decay_params` table created
- [x] Domain decay parameters seeded
- [x] `decayed_phase_score()` function deployed
- [x] `startup_phase_ledger_decayed` view deployed
- [x] `phase_archetypes` table created
- [x] Seed archetypes (5 types) inserted
- [x] `startup_phase_archetypes` view deployed
- [x] `goldilocks_state_transitions` view deployed
- [x] `get_startup_phase_timeline()` enhanced with archetypes
- [x] `explain_goldilocks()` enhanced with archetypes + profiles
- [x] Query examples documented
- [x] Deployment summary created

---

## 🔥 What This Unlocks

1. **Threshold Profiles** → Data-driven calibration, A/B testing profiles
2. **Phase Decay** → True signal quality, no more zombie breakouts
3. **Archetypes** → Investor-legible patterns, story-driven discovery
4. **State Transitions** → Real-time narrative feed, engagement driver

---

## 🎯 Success Metrics (30 days)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Decay reduces "stale" Goldilocks by | 15-25% | Compare ledger vs ledger_decayed |
| Archetype distribution balance | No archetype >40% | `startup_phase_archetypes` breakdown |
| Profile separation | Early = 2-3× Conviction | `startup_goldilocks_by_profile` counts |
| Investor engagement | +50% on transition feed | Click-through rate on homepage feed |

---

**Last Updated:** January 18, 2026  
**Next Review:** Week of January 25, 2026 (post Day 1-5 execution)
