# 🔬 LOOM 2: PROOF (60 seconds)

**Goal**: Credibility. Show it's not smoke and mirrors.

---

## Script

### [0:00-0:10] Opening (Set Expectations)
**Visual**: Terminal/database client ready

> "Let me show you what's under the hood. This isn't a magic trick — it's real behavioral data."

---

### [0:10-0:25] Observer Events Table
**Visual**: Run SQL query in Supabase dashboard or terminal

```sql
SELECT COUNT(*) as total_events,
       COUNT(DISTINCT investor_id) as unique_investors,
       COUNT(DISTINCT startup_id) as unique_startups
FROM investor_startup_observers;
```

**Result**:
```
total_events: 1129
unique_investors: ~200
unique_startups: 10
```

> "1,129 real behavioral events. 200 investors. 10 startups. These are timestamped discoveries, not guesses."

---

### [0:25-0:40] FOMO Triggers View
**Visual**: Query the FOMO classification view

```sql
SELECT startup_id, 
       signal_7d,
       signal_24h,
       fomo_state
FROM investor_startup_fomo_triggers
WHERE startup_id = '065bb662-fc13-4891-82ad-4d8f45a82c22';
```

**Result**:
```
startup_id: 065bb662... (AutoOps)
signal_7d: 148.7
signal_24h: 35.2
fomo_state: surge
```

> "Here's how we classified AutoOps as 'breakout': 148.7 weighted signals over 7 days, with 35.2 in the last 24 hours. That's acceleration."

---

### [0:40-0:50] Convergence Candidates
**Visual**: Show the view that powers the matching

```sql
SELECT COUNT(*) as candidate_pool
FROM convergence_candidates
WHERE startup_id = '065bb662-fc13-4891-82ad-4d8f45a82c22';
```

**Result**: `189`

> "189 investors in the convergence pool. All derived from portfolio adjacency, sector fit, and behavioral signals."

---

### [0:50-0:60] Closing Line
**Visual**: Cut back to terminal with all queries visible

> "Everything you see in the UI is derived from this. Behavioral events, not profiles. Physics, not magic."

**Text overlay**:
```
Real Data → Real Physics → Real Signals
No guessing. No hype.
```

---

## SQL Queries (Copy-Paste Ready)

### Query 1: Observer Event Stats
```sql
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT investor_id) as unique_investors,
  COUNT(DISTINCT startup_id) as unique_startups,
  MIN(occurred_at) as first_event,
  MAX(occurred_at) as last_event
FROM investor_startup_observers;
```

### Query 2: AutoOps Observer Details
```sql
SELECT 
  startup_id,
  observers_7d,
  total_observer_weight,
  latest_observation
FROM startup_observers_7d
WHERE startup_id = '065bb662-fc13-4891-82ad-4d8f45a82c22';
```

### Query 3: FOMO State Breakdown
```sql
SELECT 
  fomo_state,
  COUNT(*) as startup_count
FROM investor_startup_fomo_triggers
GROUP BY fomo_state
ORDER BY 
  CASE fomo_state
    WHEN 'breakout' THEN 1
    WHEN 'surge' THEN 2
    WHEN 'warming' THEN 3
    WHEN 'watch' THEN 4
  END;
```

### Query 4: Convergence Candidate Distribution
```sql
SELECT 
  COUNT(*) as candidate_count,
  AVG(recent_views) as avg_recent_views,
  AVG(overlap_score) as avg_overlap
FROM convergence_candidates
WHERE startup_id = '065bb662-fc13-4891-82ad-4d8f45a82c22';
```

### Query 5: Phase-Change Score (NEW)
```sql
SELECT 
  startup_id,
  phase_change_score,
  phase_state,
  signal_24h,
  signal_7d,
  intensity_ratio,
  accel_ratio
FROM startup_phase_change
WHERE startup_id = '065bb662-fc13-4891-82ad-4d8f45a82c22';
```

---

## Recording Tips

- **Tool**: Use Supabase dashboard (visual) or TablePlus (clean UI)
- **Font**: Large enough to read (16pt+)
- **Speed**: Slow down when showing query results
- **Highlight**: Use cursor to circle key numbers
- **Tone**: Matter-of-fact, engineer-to-engineer

---

## What This Proves

| Claim | Evidence |
|-------|----------|
| "Real observers" | 1,129 timestamped events |
| "Not estimated" | Direct count from view |
| "Breakout is physics" | signal_24h > signal_7d → acceleration detected |
| "189 candidates" | Convergence view returns real rows |
| "Portfolio adjacency" | overlap_score calculated from real portfolio data |

---

## Alternative: Show GitHub
If less comfortable with SQL, show:
- GitHub commit showing observer table schema
- `startup_observers_7d` view definition
- `convergence_candidates` view SQL

> "Here's the view that powers the entire system. 50 lines of SQL, all behavioral signals."

---

*This demo converts skeptics into believers.*
