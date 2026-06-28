# ML Agent v2 - Safe Release Plan

## ✅ Go Criteria (ALL MET)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| No leakage | ✅ | Features ≤ score_date, outcomes after |
| No circular labeling | ✅ | Success = pure future events (funding/revenue/retention) |
| One-query snapshot | ✅ | Materialized view eliminates O(N) explosion |
| Gates enforced | ✅ | Min 200 samples, positive rate 2-50%, cross-time stability |
| Non-blocking logging | ✅ | Aggregated warnings, throttled, top-10 offenders |
| Signal-zero included | ✅ | No bias toward signal-rich startups |
| Signals protection | ✅ | CHECK constraint prevents ML from touching signals |
| Draft-only output | ✅ | No auto-activation, golden precheck required |

**System is SAFE TO RUN.**

---

## 🚦 Release Leash (Phase 1: Canary)

### 1. Refresh Cadence
```bash
# Materialized view refresh: 1x per day (off-peak)
# PM2 cron: 2 AM daily
npm run ml:refresh
```

**DO NOT** run every 10 minutes until Supabase resources are green.

**Circuit breakers:**
- MV refresh: abort/log if > 60s
- Total query timeout: 70s (hard limit)

### 2. Training Cadence
```bash
# ML training cycle: 1x per day after refresh
# PM2 cron: 3 AM daily
npm run ml:train
```

**Hard cap:** Max 1 recommendation per day.  
**Gate failure:** Log and exit cleanly (no retry spam).

**Circuit breakers:**
- Training: abort if > 120s
- Sample size: max 50k rows (prevents "2AM job ate the whole database")

### 3. Recommendation Guardrails (Anti-Whiplash)
Before creating draft version, enforce:
- **Max absolute change per component:** ≤ 2pp (percentage points)
- **Max total L1 drift:** ≤ 5pp across all components
- **Normalization:** Weights always sum to 1.0

If ML wants bigger moves → split into multiple steps across weeks.

### 4. Read-Only Output
ML worker can ONLY:
- ✅ `INSERT INTO god_weight_versions` (status = 'draft' or 'retired')
- ✅ `INSERT INTO ml_recommendations` (status = 'pending')
- ✅ `INSERT INTO ai_logs`

**FORBIDDEN:**
- ❌ Write to `startup_uploads`
- ❌ Activate weight versions (UPDATE active_weights_version)
- ❌ Override runtime config
- ❌ Toggle freeze/unfreeze

**Weight version statuses:**
- `draft` - ML recommendation, not yet approved
- `active` - Currently in use (only via admin approval)
- `retired` - Previously active, replaced

### 5. Canary Run (First 3-7 Days)

**Inspect these metrics ONLY:**
```sql
SELECT * FROM refresh_ml_training_snapshot();
-- row_count
-- success_count
-- positive_rate
-- anomaly_count
-- zero_signal_count
```

**Gate check results:**
```sql
SELECT * FROM ml_gate_check('180d');
-- sample_success_count
-- sample_fail_count
-- positive_rate
-- cross_time_stable
```

**If any metrics look weird but don't trip hard bounds:**
- 🟡 Log and observe
- 🛑 Do NOT apply recommendations
- 🔍 Investigate data patterns

---

## 📊 Admin Dashboard (Build Next)

Create `/admin/ml-recommendations` view with:

### Section 1: Training Snapshot Health
```
Last Refresh: 2026-01-29 02:00:00
Duration: 8.3s
Total Rows: 1,247
Success Rows: 312 (25.0%)
Anomalies: 3 (scraper burst)
Zero-Signal Rows: 89 (7.1%)
```

### Section 2: Gate Check Status
```
Sample Size: ✅ PASS (success=312, fail=935)
Positive Rate: ✅ PASS (25.0% in [2%, 50%])
Cross-Time Stable: ✅ PASS (6/6 buckets agree)
```

### Section 3: Pending Recommendations
Table columns:
- Created At
- Source Version → Recommended Version
- Component Deltas (team: +2%, traction: -1%, etc.)
- Expected Improvement
- Confidence
- Golden Tests (PASS/FAIL/WARN)
- Sample Sizes
- Actions: [View Details] [Approve] [Reject]

### Section 4: Top Proposed Deltas
```
team_score:     28% → 32% (+4pp, largest change)
traction_score: 25% → 23% (-2pp)
market_score:   20% → 20% (unchanged)
...
```

### Section 5: Stability by Bucket
```
2024-Q1: 18% positive rate (n=143)
2024-Q2: 22% positive rate (n=187)
2024-Q3: 26% positive rate (n=209)
2024-Q4: 25% positive rate (n=189)
2025-Q1: 24% positive rate (n=241)
2025-Q2: 27% positive rate (n=278)

Stability score: 83% (5/6 buckets within ±10pp)
```

---

## 🔐 Production Rollout Sequence

### Week 1 (Observation Only)
1. Deploy migrations to Supabase
2. Add PM2 cron jobs (refresh + train)
3. **Watch metrics, no approvals**
4. Validate positive_rate stays in bounds
5. Check anomaly patterns

### Week 2 (First Approval)
1. Review 7 days of recommendations
2. Pick safest delta (smallest change, highest confidence)
3. **Run shadow scoring** (sample 500 startups, compare distributions)
4. Approve ONE recommendation if shadow looks sane
5. Observe GOD score distribution impact
6. Run System Guardian health checks

#### Shadow Scoring Checklist
Before activating any recommendation:
```bash
# Sample 500 startups
# Compute shadow totals (base + signals) using new weights
# Compare vs current:
- Mean shift: ±3 points acceptable
- Top-50 churn: < 20% acceptable
- Elite (>90): Must have at least 2-3
```

Log to `algorithm_metrics` table. Only if sane → run full recalculation.

### Week 3+ (Gradual Ramp)
1. If Week 2 approval was stable → approve 1-2/week
2. Monitor for:
   - GOD score drift
   - Elite drought
   - Match quality degradation
   - Signal-score correlation changes
3. If any metrics degrade → rollback weights, investigate

---

## 🛑 Kill Switch

If ML agent produces bad recommendations:

```sql
-- 1. Expire all pending recommendations
UPDATE ml_recommendations 
SET status = 'expired' 
WHERE status = 'pending';

-- 2. Stop PM2 jobs
pm2 stop ml-training-scheduler

-- 3. Investigate ai_logs
SELECT * FROM ai_logs 
WHERE type = 'ml_training' 
ORDER BY created_at DESC 
LIMIT 50;
```

---

## 📈 Success Metrics (30-Day Target)

| Metric | Target | Current |
|--------|--------|---------|
| MV refresh time | < 60s (hard limit) | TBD |
| Training cycle time | < 120s (hard limit) | TBD |
| Gate pass rate | > 80% | TBD |
| Positive rate stability | 20-30% | TBD |
| Anomaly rate | < 1% | TBD |
| Zero-signal rate | < 15% | TBD |
| Recommendations approved | 3-5 | 0 |
| GOD score stability | ±5pp | TBD |
| Max component change | ≤ 2pp per step | Enforced |
| Total L1 drift | ≤ 5pp per step | Enforced |

---

## 🔍 Next Steps (Priority Order)

1. ✅ **Deploy migrations** (20260129_ml_*.sql)
2. ✅ **Run first refresh** (observe metrics)
3. ✅ **Run first training cycle** (observe gates)
4. 🔲 **Build admin dashboard** (/admin/ml-recommendations)
5. 🔲 **Add PM2 scheduler** (nightly cadence)
6. 🔲 **Observe for 7 days** (no approvals)
7. 🔲 **First approval** (safest delta only)
8. 🔲 **Monitor for 7 more days** (rollback if needed)
9. 🔲 **Gradual ramp** (1-2 approvals/week)

---

**Teeth stay behind glass until you've seen 3-7 daily cycles and recommendations look sane.**
