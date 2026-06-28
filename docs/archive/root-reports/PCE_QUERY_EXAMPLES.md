# Phase Change Engine - Query Examples

## 🎯 Quick Reference

### View all available profiles
```sql
SELECT * FROM goldilocks_threshold_profiles;
```

### Check a startup's archetype
```sql
SELECT startup_id, archetype_key, archetype_description, archetype_score
FROM startup_phase_archetypes
WHERE startup_id = '<uuid>';
```

### See how a startup performs across different profiles
```sql
SELECT profile_key, classification, domains_7d, avg_irrev_7d, pvi_7d, pvi_accel_ratio
FROM startup_goldilocks_by_profile
WHERE startup_id = '<uuid>';
```

### Get the full explanation with archetype
```sql
SELECT explain_goldilocks('<uuid>');
```

### Get timeline with archetype context
```sql
SELECT get_startup_phase_timeline('<uuid>', 50);
```

---

## 📊 Dashboard Queries

### Goldilocks startups by archetype
```sql
SELECT 
  a.archetype_key,
  a.archetype_description,
  COUNT(*) as startup_count,
  AVG(d.pvi_7d) as avg_pvi,
  AVG(d.avg_irrev_7d) as avg_irreversibility
FROM startup_phase_archetypes a
JOIN startup_goldilocks_dashboard d USING (startup_id)
WHERE d.goldilocks_phase_state IN ('warming', 'surge', 'breakout')
GROUP BY a.archetype_key, a.archetype_description
ORDER BY startup_count DESC;
```

### Early vs Conviction Goldilocks comparison
```sql
SELECT 
  profile_key,
  COUNT(*) FILTER (WHERE classification = 'goldilocks') as goldilocks_count,
  COUNT(*) as total_startups
FROM startup_goldilocks_by_profile
GROUP BY profile_key;
```

### State transitions feed (homepage worthy)
```sql
SELECT 
  s.name as startup_name,
  t.snapshot_date,
  t.prev_state,
  t.new_state,
  t.archetype_key,
  t.archetype_description,
  t.last_domain,
  t.last_subtype
FROM goldilocks_state_transitions t
JOIN startup_uploads s ON t.startup_id = s.id
WHERE t.snapshot_date >= NOW() - INTERVAL '7 days'
ORDER BY t.snapshot_date DESC
LIMIT 20;
```

---

## 🔍 Analysis Queries

### Phase decay impact analysis
```sql
-- Compare raw vs decayed scores
SELECT 
  domain,
  COUNT(*) as phase_changes,
  AVG(phase_score) as avg_raw_score,
  AVG(phase_score_decayed) as avg_decayed_score,
  AVG(phase_score - phase_score_decayed) as avg_decay_loss
FROM startup_phase_ledger_decayed
GROUP BY domain
ORDER BY avg_decay_loss DESC;
```

### Archetype transitions over time
```sql
-- Track how archetypes shift
WITH archetype_history AS (
  SELECT 
    startup_id,
    archetype_key,
    created_at
  FROM startup_phase_changes pc
  JOIN startup_phase_archetypes USING (startup_id)
)
SELECT 
  archetype_key,
  DATE_TRUNC('week', created_at) as week,
  COUNT(DISTINCT startup_id) as active_startups
FROM archetype_history
GROUP BY archetype_key, week
ORDER BY week DESC, active_startups DESC;
```

### Domain concentration by archetype
```sql
SELECT 
  a.archetype_key,
  SUM(l.phase_score_decayed) FILTER (WHERE l.domain = 'product') as product_total,
  SUM(l.phase_score_decayed) FILTER (WHERE l.domain = 'human') as human_total,
  SUM(l.phase_score_decayed) FILTER (WHERE l.domain = 'customer') as customer_total,
  SUM(l.phase_score_decayed) FILTER (WHERE l.domain = 'capital') as capital_total,
  SUM(l.phase_score_decayed) FILTER (WHERE l.domain = 'market') as market_total
FROM startup_phase_archetypes a
JOIN startup_phase_ledger_decayed l USING (startup_id)
GROUP BY a.archetype_key;
```

---

## 🎯 Investor-Facing Queries

### "Show me customer-pull breakouts in fintech"
```sql
SELECT 
  s.name,
  s.sectors,
  a.archetype_description,
  d.pvi_7d,
  d.goldilocks_phase_state,
  d.last_occurred_at
FROM startup_uploads s
JOIN startup_phase_archetypes a ON s.id = a.startup_id
JOIN startup_goldilocks_dashboard d ON s.id = d.startup_id
WHERE a.archetype_key = 'customer_pull'
  AND s.sectors && ARRAY['Fintech']
  AND d.goldilocks_phase_state IN ('surge', 'breakout')
ORDER BY d.pvi_7d DESC
LIMIT 20;
```

### "What just changed in my watchlist?"
```sql
SELECT 
  s.name,
  t.prev_state,
  t.new_state,
  t.archetype_key,
  t.last_domain,
  t.last_subtype,
  t.snapshot_date
FROM goldilocks_state_transitions t
JOIN startup_uploads s ON t.startup_id = s.id
WHERE t.startup_id IN ('<uuid1>', '<uuid2>', '<uuid3>')
  AND t.snapshot_date >= NOW() - INTERVAL '7 days'
ORDER BY t.snapshot_date DESC;
```

### "Who's riding market tailwinds?"
```sql
SELECT 
  s.name,
  a.archetype_description,
  d.pvi_7d,
  d.goldilocks_phase_state,
  ml.event_title,
  ml.relevance_score
FROM startup_uploads s
JOIN startup_phase_archetypes a ON s.id = a.startup_id
JOIN startup_goldilocks_dashboard d ON s.id = d.startup_id
LEFT JOIN (
  SELECT 
    sml.startup_id,
    me.title as event_title,
    sml.relevance_score,
    ROW_NUMBER() OVER (PARTITION BY sml.startup_id ORDER BY sml.relevance_score DESC) as rn
  FROM startup_market_event_links sml
  JOIN market_events me ON sml.market_event_id = me.id
) ml ON s.id = ml.startup_id AND ml.rn = 1
WHERE a.archetype_key = 'market_tailwind'
  AND d.goldilocks_phase_state IN ('surge', 'breakout')
ORDER BY d.pvi_7d DESC
LIMIT 20;
```

---

## 🛠️ Admin / Maintenance Queries

### Update threshold profiles based on backtest results
```sql
-- Find best separation scores from backtest
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
LIMIT 5;

-- Insert as new profile
INSERT INTO goldilocks_threshold_profiles
(profile_key, description, min_domains_7d, min_avg_irrev_7d, min_pvi_7d, min_pvi_accel_ratio)
VALUES
('high_precision_v1', 'Backtest-optimized for max separation', 3, 0.60, 3.5, 2.2);
```

### Adjust phase decay parameters
```sql
-- Make human signals decay slower (they're more stable)
UPDATE phase_decay_params
SET half_life_days = 150
WHERE domain = 'human';

-- Make product signals decay faster (rapid iteration)
UPDATE phase_decay_params
SET half_life_days = 21
WHERE domain = 'product';
```

### Add new archetype
```sql
INSERT INTO phase_archetypes
(archetype_key, description, product_weight, human_weight, customer_weight, capital_weight, market_weight)
VALUES
('stealth_momentum', 'Rising fast across all domains equally', 0.2, 0.2, 0.2, 0.2, 0.2);
```

---

## 📈 Performance Monitoring

### Check decay effectiveness
```sql
SELECT 
  domain,
  AVG(EXTRACT(days FROM NOW() - occurred_at)) as avg_age_days,
  AVG(phase_score_decayed / NULLIF(phase_score, 0)) as avg_decay_ratio
FROM startup_phase_ledger_decayed
GROUP BY domain;
```

### Archetype distribution health
```sql
SELECT 
  archetype_key,
  COUNT(*) as startup_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM startup_phase_archetypes
GROUP BY archetype_key
ORDER BY startup_count DESC;
```

### Profile calibration check
```sql
SELECT 
  profile_key,
  classification,
  COUNT(*) as count,
  AVG(domains_7d) as avg_domains,
  AVG(pvi_7d) as avg_pvi
FROM startup_goldilocks_by_profile
GROUP BY profile_key, classification;
```

---

## 🚀 Next-Level Queries

### Multi-archetype transitions
```sql
-- Startups that changed archetypes in last 30 days
WITH archetype_changes AS (
  SELECT 
    startup_id,
    archetype_key as current_archetype,
    LAG(archetype_key) OVER (PARTITION BY startup_id ORDER BY created_at) as prev_archetype
  FROM (
    SELECT DISTINCT startup_id, archetype_key, MAX(created_at) as created_at
    FROM startup_phase_changes
    JOIN startup_phase_archetypes USING (startup_id)
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY startup_id, archetype_key
  ) x
)
SELECT 
  s.name,
  ac.prev_archetype,
  ac.current_archetype,
  d.goldilocks_phase_state
FROM archetype_changes ac
JOIN startup_uploads s ON ac.startup_id = s.id
JOIN startup_goldilocks_dashboard d ON ac.startup_id = d.startup_id
WHERE ac.prev_archetype IS DISTINCT FROM ac.current_archetype;
```

### Cross-profile Goldilocks (only on strict profile)
```sql
-- Startups that are Goldilocks ONLY on conviction_goldilocks (high quality)
SELECT 
  s.name,
  a.archetype_key,
  bp_conviction.classification as conviction_class,
  bp_early.classification as early_class,
  d.pvi_7d,
  d.goldilocks_phase_state
FROM startup_uploads s
JOIN startup_phase_archetypes a ON s.id = a.startup_id
JOIN startup_goldilocks_dashboard d ON s.id = d.startup_id
LEFT JOIN startup_goldilocks_by_profile bp_conviction 
  ON s.id = bp_conviction.startup_id AND bp_conviction.profile_key = 'conviction_goldilocks'
LEFT JOIN startup_goldilocks_by_profile bp_early 
  ON s.id = bp_early.startup_id AND bp_early.profile_key = 'early_goldilocks'
WHERE bp_conviction.classification = 'goldilocks'
  AND bp_early.classification = 'non_goldilocks';
```

---

## 📋 Daily Operations

### Morning digest
```sql
-- What changed overnight?
SELECT 
  s.name,
  t.prev_state,
  t.new_state,
  t.archetype_key,
  t.last_domain,
  COUNT(*) OVER (PARTITION BY t.archetype_key) as archetype_transitions_today
FROM goldilocks_state_transitions t
JOIN startup_uploads s ON t.startup_id = s.id
WHERE t.snapshot_date >= CURRENT_DATE
ORDER BY t.snapshot_date DESC;
```

### Weekly archetype summary
```sql
SELECT 
  a.archetype_key,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE d.goldilocks_phase_state = 'breakout') as breakout_count,
  AVG(d.pvi_7d) as avg_pvi,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY d.pvi_7d) as p75_pvi
FROM startup_phase_archetypes a
JOIN startup_goldilocks_dashboard d ON a.startup_id = d.startup_id
GROUP BY a.archetype_key
ORDER BY breakout_count DESC;
```

---

## 🎓 Explanation Templates

### For investors (using functions)
```sql
-- Get everything an investor needs in one call
SELECT explain_goldilocks('<startup_uuid>');

-- Result example:
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
  "last_signal": {
    "domain": "customer",
    "subtype": "case_study",
    "score": 18.5,
    "occurred_at": "2026-01-15T..."
  },
  "profile_classifications": [
    {
      "profile": "early_goldilocks",
      "classification": "goldilocks",
      "thresholds": {...}
    },
    {
      "profile": "conviction_goldilocks",
      "classification": "goldilocks",
      "thresholds": {...}
    }
  ]
}
```
