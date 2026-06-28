# GOLDEN PATH VERIFICATION CHECKLIST
## Day 2 Completion - One Startup Fully Real

**Goal**: Verify ONE startup shows complete behavioral physics (proves the system works)

---

## Pre-Flight Checklist

### Database Setup
- [ ] Migration applied successfully
  ```bash
  node scripts/apply-convergence-migration.js
  ```
  
- [ ] Tables exist:
  ```sql
  SELECT COUNT(*) FROM investor_startup_observers;
  SELECT COUNT(*) FROM investor_portfolio_adjacency;
  SELECT COUNT(*) FROM investor_behavior_summary;
  ```

- [ ] Views work:
  ```sql
  SELECT COUNT(*) FROM investor_startup_fomo_triggers;
  SELECT COUNT(*) FROM startup_observers_7d;
  SELECT COUNT(*) FROM convergence_candidates;
  SELECT COUNT(*) FROM comparable_startups;
  ```

### Observer Data Seeded
- [ ] 500+ observer events created
  ```bash
  node scripts/seed-observer-clusters.js
  ```

- [ ] FOMO states present:
  ```sql
  SELECT fomo_state, COUNT(*) 
  FROM investor_startup_fomo_triggers 
  GROUP BY fomo_state;
  ```
  
  **Expected**:
  - 2+ breakout
  - 5+ surge
  - 10+ warming
  - Rest watch

---

## Golden Path Startup Selection

Pick ONE startup with:
- GOD score >= 70 (strong signal)
- Seeded observer data (from clustering script)
- Real matches in `startup_investor_matches`

```sql
SELECT 
  s.id,
  s.name,
  s.website,
  s.total_god_score,
  (SELECT COUNT(*) FROM investor_startup_observers o WHERE o.startup_id = s.id) as observer_events,
  (SELECT COUNT(*) FROM startup_investor_matches m WHERE m.startup_id = s.id) as match_count
FROM startup_uploads s
WHERE s.status = 'approved'
  AND s.total_god_score >= 70
  AND (SELECT COUNT(*) FROM investor_startup_observers o WHERE o.startup_id = s.id) > 0
ORDER BY observer_events DESC
LIMIT 5;
```

**Document golden startup**:
- [ ] Startup ID: `_________________`
- [ ] Name: `_________________`
- [ ] Website: `_________________`

---

## API Response Verification

### 1. Call Convergence Endpoint

```bash
curl -s "http://localhost:3002/api/discovery/convergence?url=<golden-startup-url>" > golden_path_response.json
```

### 2. Status Bar Metrics (ALL MUST BE REAL)

```bash
cat golden_path_response.json | jq '.status'
```

**Checklist**:
- [ ] `observers_7d` > 0 (not 0!)
  - Expected: 15-35 observers
  - Source: `startup_observers_7d` view
  
- [ ] `fomo_state` in ["breakout", "surge", "warming", "watch"]
  - Not hardcoded
  - Source: `investor_startup_fomo_triggers`
  
- [ ] `signal_strength_0_10` matches `total_god_score / 10`
  - Real GOD score
  
- [ ] `velocity_class` in ["fast_feedback", "building", "early"]
  - Derived from GOD score
  
- [ ] `comparable_tier` in ["top_5", "top_12", "top_25", "unranked"]
  - Real percentile

### 3. Visible Investors (20-50 candidates expected)

```bash
cat golden_path_response.json | jq '.visible_investors | length'
cat golden_path_response.json | jq '.visible_investors[]'
```

**Checklist**:
- [ ] 5 investors returned
- [ ] At least 1 with `signal_state: "breakout"` or `"surge"`
- [ ] `signal_age_hours` < 168 (within 7 days)
- [ ] `confidence` in ["high", "med", "low"] (not random)

### 4. Evidence-Based "Why" Bullets

```bash
cat golden_path_response.json | jq '.visible_investors[0].why.bullets'
```

**Must include at least ONE of**:
- [ ] "Viewed X similar startups in last 72h" (from `recent_views`)
- [ ] "Portfolio adjacency detected" (from `overlap_score`)
- [ ] "Acceleration in discovery behavior" (from `signal_24h`)
- [ ] "Investor entering active sourcing phase" (from `fomo_state`)

**NOT acceptable**:
- Generic: "Active in AI, DevTools"
- Generic: "Invests in Seed stage"
- Generic: "Check size: $X"

### 5. FOMO Signal States

```bash
cat golden_path_response.json | jq '[.visible_investors[].signal_state] | group_by(.) | map({state: .[0], count: length})'
```

**Expected distribution**:
- [ ] Breakout: 0-2 (rare, high signal)
- [ ] Surge: 1-3 (strong momentum)
- [ ] Warming: 2-4 (building interest)
- [ ] Watch: 0-2 (background)

### 6. Hidden Investors

```bash
cat golden_path_response.json | jq '.hidden_investors_total'
```

**Checklist**:
- [ ] `hidden_investors_total` > 10
- [ ] `hidden_investors_preview` has 10 blurred cards
- [ ] Each preview has `stage`, `sector`, `signal_state`

### 7. Comparable Startups

```bash
cat golden_path_response.json | jq '.comparable_startups | length'
cat golden_path_response.json | jq '.comparable_startups[0]'
```

**Checklist**:
- [ ] 3-6 comparable startups
- [ ] Each has `matched_investors` count (not random)
- [ ] Each has `reason_tags` array
- [ ] `god_score_0_10` within ±1.5 of golden startup

### 8. Alignment Breakdown

```bash
cat golden_path_response.json | jq '.alignment'
```

**Checklist**:
- [ ] All scores between 0-1
- [ ] `team_0_1`, `market_0_1`, `execution_0_1` from real GOD components
- [ ] `phase_change_0_1` from `total_god_score`
- [ ] Message explains threshold

### 9. Improve Actions (Coaching)

```bash
cat golden_path_response.json | jq '.improve_actions | length'
cat golden_path_response.json | jq '.improve_actions[0]'
```

**Checklist**:
- [ ] 3 actions
- [ ] Each has `impact_pct` (realistic 9-18%)
- [ ] Each has 3 concrete `steps`
- [ ] Actions target weakest alignment dimensions

### 10. Debug Info

```bash
cat golden_path_response.json | jq '.debug'
```

**Checklist**:
- [ ] `query_time_ms` < 500ms
- [ ] `data_sources` includes "convergence_candidates"
- [ ] `data_sources` includes "startup_observers_7d"
- [ ] `data_sources` includes "comparable_startups"
- [ ] `match_version` = "v2.0.0-behavioral-physics"
- [ ] `candidate_pool_size` > 20

---

## Database Cross-Verification

### Verify observer count matches

```sql
SELECT observers_7d 
FROM startup_observers_7d 
WHERE startup_id = '<golden-startup-id>';
```

Compare with API response: `status.observers_7d`

- [ ] **MUST MATCH EXACTLY**

### Verify FOMO states

```sql
SELECT COUNT(*), fomo_state
FROM investor_startup_fomo_triggers
WHERE startup_id = '<golden-startup-id>'
GROUP BY fomo_state;
```

Compare with visible investors `signal_state` distribution

- [ ] Breakout count matches
- [ ] Surge count matches
- [ ] Warming count matches

### Verify convergence candidates

```sql
SELECT COUNT(*)
FROM convergence_candidates
WHERE startup_id = '<golden-startup-id>';
```

Compare with debug info: `candidate_pool_size`

- [ ] **MUST MATCH EXACTLY**

---

## Frontend Verification

### 1. Navigate to Discovery Page

```
http://localhost:5176/discovery?url=<golden-startup-url>
```

### 2. Status Bar Visual Check

- [ ] Velocity class pill shows correct label
- [ ] Signal strength gauge shows correct value (0-10)
- [ ] FOMO badge shows correct emoji + state
- [ ] Observers count shows real number (not 0)
- [ ] Comparable tier chip shows correct percentile

### 3. Investor Cards Visual Check

**For each of the 5 visible investors**:

- [ ] Firm logo displays (if available)
- [ ] Match score shows (0-100)
- [ ] Signal state badge correct color:
  - Breakout = red
  - Surge = orange
  - Warming = yellow
  - Watch = blue
  
- [ ] Fit metrics grid shows:
  - Stage fit (strong/good/weak)
  - Sector fit % (0-100)
  - Portfolio adjacency (strong/good/weak)
  - Velocity alignment (high/med/low)
  
- [ ] "Why" bullets show EVIDENCE (not generic)
- [ ] Signal age shows hours (0-168)

### 4. Blurred Layer Visual Check

- [ ] Header shows total count (e.g., "50 investors")
- [ ] 10 blurred cards visible
- [ ] Unlock CTA displays with gradient
- [ ] Sticky on mobile scroll

### 5. Comparable Startups Check

- [ ] 3-6 cards display
- [ ] Each shows GOD score
- [ ] Each shows FOMO badge
- [ ] Each shows matched investor count
- [ ] Reason tags display correctly

---

## Success Criteria

**ALL MUST PASS**:

✅ **Observers Count**: Real number from database (not 0)  
✅ **FOMO States**: At least 1 breakout or surge  
✅ **Evidence Bullets**: At least 1 behavioral bullet (not generic)  
✅ **Convergence Pool**: 20+ candidates  
✅ **Query Time**: < 500ms  
✅ **Comparable Startups**: 3+ with real match counts  
✅ **Debug Info**: Shows correct data sources  

---

## If Golden Path Passes

🎉 **YOU NOW HAVE THE FIRST REAL CAPITAL EARLY WARNING SYSTEM**

### Next Immediate Steps:

1. **Document the win**:
   ```bash
   cp golden_path_response.json PROOF_OF_BEHAVIORAL_PHYSICS.json
   ```

2. **Record Loom demo** showing:
   - Paste golden startup URL
   - Show real observers count
   - Show breakout/surge investors
   - Show evidence-based why bullets
   - Show blurred layer with real count

3. **Prepare investor deck** with:
   - "We observe investor behavior at scale"
   - "We detect capital convergence early"
   - Screenshot of golden path working
   - Moat: "Behavioral data compounds"

4. **Start outreach**:
   - YC application (timing intelligence pitch)
   - 5 pre-seed/seed funds
   - 3 angel platforms
   - 2 accelerators

---

## If Golden Path Fails

**Troubleshooting Priority**:

1. **Observers = 0**:
   - Check observer events inserted
   - Check startup_observers_7d view
   - Re-run seeding script

2. **No breakout/surge**:
   - Check FOMO trigger thresholds
   - Add more events in 24h window
   - Verify signal_7d calculation

3. **Generic why bullets**:
   - Check convergence_candidates view has real data
   - Verify recent_views, overlap_score populated
   - Check ConvergenceServiceV2 bullet generation

4. **Query timeout**:
   - Check indexes exist
   - Consider materializing convergence_candidates
   - Add Redis caching

---

**Status**: 📋 Checklist ready for Day 2 verification

**Goal**: Prove ONE startup shows complete behavioral physics end-to-end

