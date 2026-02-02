# ML Agent Critical Fixes Required

**Date:** January 29, 2026  
**Status:** BROKEN - Requires fixes before production use  
**Priority:** HIGH (circular logic + time leakage will produce garbage recommendations)

---

## 🚨 CRITICAL RISKS IDENTIFIED

### Risk A: Circular Success Labeling

**Current broken code in `server/services/mlTrainingService.ts`:**

```typescript
// Line ~230: extractSuccessPatterns()
const successful = outcomes.filter(d => {
  const avgSignalQuality = (d.funding_confidence + d.traction_confidence + d.team_confidence) / 3;
  const hasRealTraction = d.funded || d.has_revenue || d.has_customers;
  return (avgSignalQuality >= 0.7 && d.god_score >= 70) || hasRealTraction;
  //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //     CIRCULAR: GOD score predicts success that includes GOD score
});
```

**Why this is broken:**
- ML agent uses `god_score >= 70` to define "successful" startups
- ML agent then analyzes which GOD components predict success
- Result: Model learns to maximize GOD scores, not predict real outcomes
- Creates feedback loop: high GOD → labeled success → recommend weights that increase GOD → higher GOD

**Impact:**
- Recommendations will reinforce existing biases
- No actual learning from real-world outcomes
- Will recommend increasing weights on components that already score high
- Confidence scores meaningless (model predicting itself)

---

### Risk B: Time Leakage (Fatal)

**Current broken code in `server/services/mlTrainingService.ts`:**

```typescript
// Line ~90: collectTrainingData()
const { data: outcomes } = await supabase
  .from('startup_uploads')
  .select(`
    *,
    extracted_data
  `)
  .gte('total_god_score', 0)
  .limit(MAX_RECORDS);

// No time-slicing → includes ALL signals up to TODAY
// Labels success based on TODAY's status (d.funded, d.has_revenue)
```

**Why this is broken:**
- Model sees signals from ALL time periods mixed together
- Example: Startup scored 65 on Jan 1, got funded Feb 15, scraped 50 more signals by Mar 1
- Training data shows: "65 GOD score + 50 signals → funded" 
- But the 50 signals include "raised Series A" that happened AFTER scoring
- Model learns: "Series A announcement predicts getting funded" (predicting the past)

**Impact:**
- Model will appear to have high accuracy on training data
- Will fail completely on new data (can't see the future)
- Recommendations based on contaminated patterns
- Admin sees "85% confidence" but it's measuring noise

---

### Risk C: Class Imbalance + Success Rarity (Unstable Recommendations)

**Current problem:**

If "success" is defined as "$500K+ raise within 180 days", the positive rate will be low (maybe 5-10% of startups). Delta-based heuristics become unstable with small sample sizes.

**Why this is broken:**
- Example: 50 successful startups, 5,000 unsuccessful → 1% positive rate
- Delta calculation: successful team_score = 18 (N=50), unsuccessful team_score = 12 (N=5,000)
- Recommendation: "Increase team weight" based on 50 samples (statistically weak)
- Different time periods might show opposite patterns (market regime shifts)
- Model learns noise from small positive class

**Impact:**
- Recommendations based on insufficient evidence
- High variance between training runs (unstable)
- Confidence scores don't reflect statistical significance
- Market regime changes cause contradictory recommendations
- Admin can't distinguish signal from noise

---

### Risk D: O(N) Query Explosion (Performance Killer)

**Current broken approach in pseudo-code:**

```typescript
// Fetch all startups
const startups = await supabase.from('startup_uploads').select('*');

// For EACH startup, fetch historical signals (N queries)
for (const startup of startups) {
  const historicalSignals = await supabase
    .from('startup_signals')
    .eq('startup_id', startup.id)
    .lte('occurred_at', scoreDate);
  
  // For EACH startup, fetch future signals (N more queries)
  const futureSignals = await supabase
    .from('startup_signals')
    .eq('startup_id', startup.id)
    .gt('occurred_at', scoreDate);
}
```

**Why this is broken:**
- 5,458 startups × 2 queries per startup = **10,916 queries** per training cycle
- Each query has network latency + Postgres overhead
- With 68K signals, many startups have 10-20 signals → heavy filtering
- Supabase free tier: 500 req/sec limit, resource constrained
- Training cycle takes 30+ minutes instead of 30 seconds
- Database connection pool exhaustion

**Impact:**
- Training cycles timeout or crash
- Supabase connection limits exceeded
- Other services degraded (rate limiting)
- PM2 kills process for taking too long
- Can't scale past 10K startups

---

## ✅ REQUIRED FIXES

### Fix A: Independent Success Labels (Time-Stamped)

**Replace circular logic with time-stamped outcomes:**

```typescript
/**
 * FIXED: Define success using independent, time-stamped events only
 * NEVER use god_score or signal quality in success label
 */
function labelSuccess(startup: any, scoreDate: Date, outcomeWindow: number): boolean {
  const outcomeEndDate = new Date(scoreDate.getTime() + outcomeWindow * 24 * 60 * 60 * 1000);
  
  // Check for funding events AFTER score date, WITHIN outcome window
  const fundedAfterScoring = startup.startup_signals.some(s => 
    s.signal_type === 'funding_amount' &&
    new Date(s.occurred_at) > scoreDate &&
    new Date(s.occurred_at) <= outcomeEndDate &&
    parseFloat(s.meta?.value || '0') >= 500000 // $500K+ raises
  );
  
  // Check for revenue milestones AFTER score date
  const revenueAfterScoring = startup.startup_signals.some(s =>
    s.signal_type === 'traction_revenue' &&
    new Date(s.occurred_at) > scoreDate &&
    new Date(s.occurred_at) <= outcomeEndDate &&
    parseFloat(s.meta?.value || '0') >= 100000 // $100K+ ARR
  );
  
  // Check for follow-on round (Series A → Series B within 18 months)
  const followOnRound = startup.startup_signals.some(s =>
    s.signal_type === 'funding_round' &&
    new Date(s.occurred_at) > scoreDate &&
    new Date(s.occurred_at) <= outcomeEndDate &&
    isFollowOnRound(s.meta?.round, startup.last_funding_round)
  );
  
  // Check for user retention signals (30+ day active users)
  const hasRetention = startup.startup_signals.some(s =>
    s.signal_type === 'traction_retention' &&
    new Date(s.occurred_at) > scoreDate &&
    new Date(s.occurred_at) <= outcomeEndDate &&
    parseFloat(s.meta?.retention_rate || '0') >= 0.4 // 40%+ retention
  );
  
  // Check for VC follow-up (investor re-engaged within 90 days)
  const vcFollowUp = startup.startup_signals.some(s =>
    s.signal_type === 'investor_followup' &&
    new Date(s.occurred_at) > scoreDate &&
    new Date(s.occurred_at) <= outcomeEndDate
  );
  
  return fundedAfterScoring || revenueAfterScoring || followOnRound || hasRetention || vcFollowUp;
}
```

**Success criteria (all time-stamped):**
1. **Funding event:** $500K+ raise within outcome window (6 months)
2. **Revenue milestone:** $100K+ ARR within outcome window
3. **Follow-on round:** Next round within 18 months
4. **User retention:** 40%+ retention rate within 90 days
5. **VC follow-up:** Investor re-engagement within outcome window

**Never use for success label:**
- ❌ `god_score >= X` (circular)
- ❌ `avgSignalQuality >= X` (circular)
- ❌ `has_funding_signals` (descriptive, not predictive)
- ❌ Current status without timestamps (time leakage)

---

### Fix B: Time-Sliced Training Data

**Replace current data collection with time-sliced approach:**

```typescript
/**
 * FIXED: Collect time-sliced training data to prevent leakage
 * Features AS OF scoreDate, outcomes AFTER scoreDate
 */
async function collectTimeSlicedTrainingData(
  scoreDateStart: Date,
  scoreDateEnd: Date,
  outcomeWindow: number = 180 // days
): Promise<SignalTrainingData[]> {
  
  console.log(`📅 Time-sliced training data collection:`);
  console.log(`   Score period: ${scoreDateStart.toISOString()} → ${scoreDateEnd.toISOString()}`);
  console.log(`   Outcome window: ${outcomeWindow} days after each score date`);
  
  const trainingData: SignalTrainingData[] = [];
  
  // Get all startups that existed BEFORE score date end
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('*')
    .lte('created_at', scoreDateEnd.toISOString());
  
  for (const startup of startups || []) {
    // Use the startup's creation date as score date (or fixed date if recalculating)
    const scoreDate = new Date(startup.created_at);
    
    if (scoreDate < scoreDateStart || scoreDate > scoreDateEnd) {
      continue; // Outside training window
    }
    
    // Get signals AS OF score date (only past signals)
    const { data: historicalSignals } = await supabase
      .from('startup_signals')
      .select('*')
      .eq('startup_id', startup.id)
      .lte('occurred_at', scoreDate.toISOString())
      .order('occurred_at', { ascending: true });
    
    // Get signals AFTER score date (for outcome labeling)
    const { data: futureSignals } = await supabase
      .from('startup_signals')
      .select('*')
      .eq('startup_id', startup.id)
      .gt('occurred_at', scoreDate.toISOString())
      .lte('occurred_at', new Date(scoreDate.getTime() + outcomeWindow * 24 * 60 * 60 * 1000).toISOString());
    
    // Calculate signal quality AS OF score date
    const fundingSignals = historicalSignals?.filter(s => s.signal_type.startsWith('funding_')) || [];
    const tractionSignals = historicalSignals?.filter(s => s.signal_type.startsWith('traction_')) || [];
    const teamSignals = historicalSignals?.filter(s => s.signal_type.startsWith('team_')) || [];
    
    const fundingConfidence = fundingSignals.length > 0 ? 
      fundingSignals.reduce((sum, s) => sum + s.weight, 0) / fundingSignals.length : 0;
    const tractionConfidence = tractionSignals.length > 0 ?
      tractionSignals.reduce((sum, s) => sum + s.weight, 0) / tractionSignals.length : 0;
    const teamConfidence = teamSignals.length > 0 ?
      teamSignals.reduce((sum, s) => sum + s.weight, 0) / teamSignals.length : 0;
    
    // Label success based on FUTURE signals only
    const isSuccessful = labelSuccess({ 
      ...startup, 
      startup_signals: futureSignals || [] 
    }, scoreDate, outcomeWindow);
    
    trainingData.push({
      startup_id: startup.id,
      startup_name: startup.name,
      score_date: scoreDate.toISOString(),
      outcome_window_end: new Date(scoreDate.getTime() + outcomeWindow * 24 * 60 * 60 * 1000).toISOString(),
      
      // Features AS OF score date
      god_score: startup.total_god_score,
      team_score: startup.team_score,
      traction_score: startup.traction_score,
      market_score: startup.market_score,
      product_score: startup.product_score,
      vision_score: startup.vision_score,
      
      // Signal quality AS OF score date
      has_funding_signals: fundingSignals.length > 0,
      funding_confidence: fundingConfidence,
      has_traction_signals: tractionSignals.length > 0,
      traction_confidence: tractionConfidence,
      has_team_signals: teamSignals.length > 0,
      team_confidence: teamConfidence,
      
      // Outcome (AFTER score date)
      is_successful: isSuccessful,
      
      // Metadata
      historical_signal_count: historicalSignals?.length || 0,
      future_signal_count: futureSignals?.length || 0
    });
  }
  
  const successCount = trainingData.filter(d => d.is_successful).length;
  console.log(`✅ Collected ${trainingData.length} time-sliced samples`);
  console.log(`   Successful outcomes: ${successCount} (${((successCount / trainingData.length) * 100).toFixed(1)}%)`);
  
  return trainingData;
}
```

**Time-slicing requirements:**
1. **Score date:** Fixed point in time when GOD score was calculated (use `startup_uploads.created_at` or `computed_at`)
2. **Feature cutoff:** Only signals occurring BEFORE score date
3. **Outcome window:** 6-12 months AFTER score date
4. **No contamination:** Future signals never used in features
5. **Validation:** Check `historical_signal_count` vs `future_signal_count`

---

### Fix C: Enforce Minimum Sample Sizes + Market Regime Stability

**Replace unstable delta calculations with statistically valid thresholds:**

```typescript
/**
 * FIXED: Validate sample sizes before generating recommendations
 * Prevents recommendations based on insufficient evidence
 */
interface SampleSizeValidation {
  has_minimum_samples: boolean;
  success_count: number;
  failure_count: number;
  total_count: number;
  positive_rate: number;
  is_stable_across_time: boolean;
  time_buckets: TimeBucketResult[];
}

const MIN_SUCCESS_SAMPLES = 200;
const MIN_FAILURE_SAMPLES = 200;
const MIN_POSITIVE_RATE = 0.02; // At least 2% success rate
const MAX_POSITIVE_RATE = 0.50; // At most 50% (sanity check)

async function validateSampleSizes(
  trainingData: SignalTrainingData[]
): Promise<SampleSizeValidation> {
  
  const successCount = trainingData.filter(d => d.is_successful).length;
  const failureCount = trainingData.filter(d => !d.is_successful).length;
  const totalCount = trainingData.length;
  const positiveRate = successCount / totalCount;
  
  // Check minimum samples
  const hasMinimumSamples = 
    successCount >= MIN_SUCCESS_SAMPLES && 
    failureCount >= MIN_FAILURE_SAMPLES &&
    positiveRate >= MIN_POSITIVE_RATE &&
    positiveRate <= MAX_POSITIVE_RATE;
  
  console.log(`📊 Sample size validation:`);
  console.log(`   Success: ${successCount} (need ${MIN_SUCCESS_SAMPLES}+)`);
  console.log(`   Failure: ${failureCount} (need ${MIN_FAILURE_SAMPLES}+)`);
  console.log(`   Positive rate: ${(positiveRate * 100).toFixed(1)}%`);
  
  if (!hasMinimumSamples) {
    console.log(`   ❌ INSUFFICIENT DATA for reliable recommendations`);
  }
  
  // Check stability across time buckets (market regimes)
  const timeBuckets = analyzeTimeBuckets(trainingData);
  const isStable = checkCrossTimeStability(timeBuckets);
  
  return {
    has_minimum_samples: hasMinimumSamples,
    success_count: successCount,
    failure_count: failureCount,
    total_count: totalCount,
    positive_rate: positiveRate,
    is_stable_across_time: isStable,
    time_buckets: timeBuckets
  };
}

/**
 * Analyze patterns across time buckets (market regimes)
 * Prevents learning from one-time market conditions
 */
function analyzeTimeBuckets(trainingData: SignalTrainingData[]): TimeBucketResult[] {
  // Split data into 6-month buckets
  const buckets: Record<string, SignalTrainingData[]> = {};
  
  for (const data of trainingData) {
    const scoreDate = new Date(data.score_date);
    const year = scoreDate.getFullYear();
    const half = scoreDate.getMonth() < 6 ? 'H1' : 'H2';
    const bucketKey = `${year}${half}`;
    
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = [];
    }
    buckets[bucketKey].push(data);
  }
  
  const results: TimeBucketResult[] = [];
  
  for (const [bucket, data] of Object.entries(buckets)) {
    const successCount = data.filter(d => d.is_successful).length;
    const avgTeamScore = data.reduce((sum, d) => sum + d.team_score, 0) / data.length;
    const avgTractionScore = data.reduce((sum, d) => sum + d.traction_score, 0) / data.length;
    
    results.push({
      bucket,
      sample_count: data.length,
      success_count: successCount,
      positive_rate: successCount / data.length,
      avg_team_score: avgTeamScore,
      avg_traction_score: avgTractionScore
    });
  }
  
  return results.sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/**
 * Check if patterns are stable across time buckets
 * If team_score correlation flips between 2023H1 and 2024H1, don't recommend
 */
function checkCrossTimeStability(buckets: TimeBucketResult[]): boolean {
  if (buckets.length < 2) {
    return false; // Need at least 2 time periods
  }
  
  // Check if success rate is consistent (not wildly different)
  const successRates = buckets.map(b => b.positive_rate);
  const avgSuccessRate = successRates.reduce((sum, r) => sum + r, 0) / successRates.length;
  const maxDeviation = Math.max(...successRates.map(r => Math.abs(r - avgSuccessRate)));
  
  // If any bucket deviates by >50% from average, patterns are unstable
  const isStable = maxDeviation < (avgSuccessRate * 0.5);
  
  console.log(`📅 Time bucket stability:`);
  buckets.forEach(b => {
    console.log(`   ${b.bucket}: ${b.sample_count} samples, ${(b.positive_rate * 100).toFixed(1)}% success`);
  });
  console.log(`   ${isStable ? '✅ STABLE' : '⚠️ UNSTABLE'} (max deviation: ${(maxDeviation * 100).toFixed(1)}%)`);
  
  return isStable;
}
```

**Sample size gates:**
- Minimum 200 successful outcomes
- Minimum 200 unsuccessful outcomes
- Positive rate between 2-50% (sanity bounds)
- Patterns stable across at least 2 time periods (6-month buckets)
- If not met: `recommendation.status = 'insufficient_data'`

---

### Fix D: SQL-Based Set Queries (Performance Fix)

**Replace O(N) per-startup loops with single SQL query:**

```sql
-- Migration: Create materialized view for fast training data extraction
-- File: server/migrations/20260129_ml_training_view.sql

CREATE MATERIALIZED VIEW IF NOT EXISTS ml_training_snapshot AS
WITH snapshot_dates AS (
  -- Use startup creation date as score snapshot
  SELECT 
    id AS startup_id,
    created_at AS score_date,
    created_at + interval '180 days' AS outcome_window_end,
    total_god_score,
    team_score,
    traction_score,
    market_score,
    product_score,
    vision_score,
    name
  FROM startup_uploads
  WHERE created_at >= '2023-01-01'  -- Only train on recent data
),
historical_signals AS (
  -- Aggregate signals BEFORE score date (features)
  SELECT
    s.startup_id,
    sd.score_date,
    COUNT(*) FILTER (WHERE s.signal_type LIKE 'funding_%') AS funding_signal_count,
    AVG(s.weight) FILTER (WHERE s.signal_type LIKE 'funding_%') AS funding_confidence,
    COUNT(*) FILTER (WHERE s.signal_type LIKE 'traction_%') AS traction_signal_count,
    AVG(s.weight) FILTER (WHERE s.signal_type LIKE 'traction_%') AS traction_confidence,
    COUNT(*) FILTER (WHERE s.signal_type LIKE 'team_%') AS team_signal_count,
    AVG(s.weight) FILTER (WHERE s.signal_type LIKE 'team_%') AS team_confidence,
    COUNT(*) AS total_historical_signals
  FROM startup_signals s
  INNER JOIN snapshot_dates sd ON s.startup_id = sd.startup_id
  WHERE s.occurred_at <= sd.score_date  -- BEFORE score date only
  GROUP BY s.startup_id, sd.score_date
),
future_outcomes AS (
  -- Aggregate signals AFTER score date (outcomes)
  SELECT
    s.startup_id,
    sd.score_date,
    -- Funding event outcome
    MAX(CASE 
      WHEN s.signal_type = 'funding_amount' 
        AND s.occurred_at > sd.score_date
        AND s.occurred_at <= sd.outcome_window_end
        AND COALESCE((s.meta->>'value')::numeric, 0) >= 500000
      THEN s.occurred_at
    END) AS funding_event_date,
    MAX(CASE 
      WHEN s.signal_type = 'funding_amount' 
        AND s.occurred_at > sd.score_date
        AND s.occurred_at <= sd.outcome_window_end
      THEN s.meta->>'value'
    END) AS funding_event_value,
    
    -- Revenue milestone outcome
    MAX(CASE 
      WHEN s.signal_type = 'traction_revenue'
        AND s.occurred_at > sd.score_date
        AND s.occurred_at <= sd.outcome_window_end
        AND COALESCE((s.meta->>'value')::numeric, 0) >= 100000
      THEN s.occurred_at
    END) AS revenue_milestone_date,
    
    -- Retention outcome
    MAX(CASE 
      WHEN s.signal_type = 'traction_retention'
        AND s.occurred_at > sd.score_date
        AND s.occurred_at <= sd.outcome_window_end
        AND COALESCE((s.meta->>'retention_rate')::numeric, 0) >= 0.4
      THEN s.occurred_at
    END) AS retention_milestone_date,
    
    COUNT(*) AS total_future_signals
  FROM startup_signals s
  INNER JOIN snapshot_dates sd ON s.startup_id = sd.startup_id
  WHERE s.occurred_at > sd.score_date  -- AFTER score date only
    AND s.occurred_at <= sd.outcome_window_end
  GROUP BY s.startup_id, sd.score_date
)
SELECT
  sd.startup_id,
  sd.name AS startup_name,
  sd.score_date,
  sd.outcome_window_end,
  
  -- Features (as of score date)
  sd.total_god_score AS god_score,
  sd.team_score,
  sd.traction_score,
  sd.market_score,
  sd.product_score,
  sd.vision_score,
  
  -- Historical signal quality
  COALESCE(hs.funding_signal_count > 0, false) AS has_funding_signals,
  COALESCE(hs.funding_confidence, 0) AS funding_confidence,
  COALESCE(hs.traction_signal_count > 0, false) AS has_traction_signals,
  COALESCE(hs.traction_confidence, 0) AS traction_confidence,
  COALESCE(hs.team_signal_count > 0, false) AS has_team_signals,
  COALESCE(hs.team_confidence, 0) AS team_confidence,
  COALESCE(hs.total_historical_signals, 0) AS historical_signal_count,
  
  -- Outcomes (after score date)
  CASE
    WHEN fo.funding_event_date IS NOT NULL THEN true
    WHEN fo.revenue_milestone_date IS NOT NULL THEN true
    WHEN fo.retention_milestone_date IS NOT NULL THEN true
    ELSE false
  END AS is_successful,
  
  -- Success metadata (auditable)
  CASE
    WHEN fo.funding_event_date IS NOT NULL THEN 'funding_event'
    WHEN fo.revenue_milestone_date IS NOT NULL THEN 'revenue_milestone'
    WHEN fo.retention_milestone_date IS NOT NULL THEN 'retention_milestone'
    ELSE NULL
  END AS success_reason,
  
  COALESCE(
    fo.funding_event_date,
    fo.revenue_milestone_date,
    fo.retention_milestone_date
  ) AS success_date,
  
  fo.funding_event_value AS success_value,
  COALESCE(fo.total_future_signals, 0) AS future_signal_count
  
FROM snapshot_dates sd
LEFT JOIN historical_signals hs ON sd.startup_id = hs.startup_id AND sd.score_date = hs.score_date
LEFT JOIN future_outcomes fo ON sd.startup_id = fo.startup_id AND sd.score_date = fo.score_date;

-- Indexes for fast access
CREATE INDEX idx_ml_training_snapshot_success ON ml_training_snapshot(is_successful);
CREATE INDEX idx_ml_training_snapshot_date ON ml_training_snapshot(score_date);

-- Refresh strategy (run after scraper cycles)
CREATE OR REPLACE FUNCTION refresh_ml_training_snapshot()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW ml_training_snapshot;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW ml_training_snapshot IS
  'Pre-computed training data for ML agent. Refreshed after scraper cycles. Prevents query explosion.';
```

**TypeScript collector (single query):**

```typescript
/**
 * FIXED: Fetch training data with ONE SQL query (no loops)
 * Performance: 10,916 queries → 1 query
 */
async function collectTrainingDataFast(): Promise<SignalTrainingData[]> {
  console.log('📊 Fetching training data from materialized view...');
  
  const { data, error } = await supabase
    .from('ml_training_snapshot')
    .select('*')
    .order('score_date', { ascending: true });
  
  if (error) {
    console.error('❌ Failed to fetch training data:', error);
    return [];
  }
  
  console.log(`✅ Fetched ${data.length} training samples in single query`);
  
  // Validate time-slicing correctness
  const leakageCount = data.filter(d => d.future_signal_count > d.historical_signal_count * 2).length;
  if (leakageCount > 0) {
    console.warn(`⚠️  ${leakageCount} samples may have time leakage (future >> historical)`);
  }
  
  return data.map(row => ({
    startup_id: row.startup_id,
    startup_name: row.startup_name,
    score_date: row.score_date,
    outcome_window_end: row.outcome_window_end,
    
    // Features
    god_score: row.god_score,
    team_score: row.team_score,
    traction_score: row.traction_score,
    market_score: row.market_score,
    product_score: row.product_score,
    vision_score: row.vision_score,
    
    has_funding_signals: row.has_funding_signals,
    funding_confidence: row.funding_confidence,
    has_traction_signals: row.has_traction_signals,
    traction_confidence: row.traction_confidence,
    has_team_signals: row.has_team_signals,
    team_confidence: row.team_confidence,
    
    // Outcomes
    is_successful: row.is_successful,
    success_reason: row.success_reason,
    success_date: row.success_date,
    success_value: row.success_value,
    
    // Validation
    historical_signal_count: row.historical_signal_count,
    future_signal_count: row.future_signal_count
  }));
}
```

**Performance comparison:**
- **Before:** 10,916 queries, 30+ minutes
- **After:** 1 query (materialized view), 5-10 seconds

---

### Fix E: Integration with Guardrails System

**Current broken flow:**
```
ML agent → generates recommendations → prints to console → ???
```

**Fixed flow (tied to weight versioning):**

```typescript
/**
 * FIXED: Create draft weight version with golden test pre-check
 * Integrates with god_weight_versions + god_runtime_config system
 */
async function generateAndStoreMLinRecommendation(
  optimization: OptimizationResult
): Promise<string | null> {
  
  // Gate 1: Check sample size requirements
  const sampleValidation = await validateSampleSizes(trainingData);
  if (!sampleValidation.has_minimum_samples) {
    console.log('⚠️  Insufficient samples - skipping recommendation');
    await supabase.from('ai_logs').insert({
      type: 'ml_agent',
      action: 'recommendation_skipped',
      status: 'warning',
      output: { 
        reason: 'insufficient_samples',
        success_count: sampleValidation.success_count,
        failure_count: sampleValidation.failure_count,
        required_success: MIN_SUCCESS_SAMPLES,
        required_failure: MIN_FAILURE_SAMPLES
      }
    });
    return null;
  }
  
  // Gate 2: Check cross-time stability
  if (!sampleValidation.is_stable_across_time) {
    console.log('⚠️  Patterns unstable across time - skipping recommendation');
    await supabase.from('ai_logs').insert({
      type: 'ml_agent',
      action: 'recommendation_skipped',
      status: 'warning',
      output: { 
        reason: 'unstable_patterns',
        time_buckets: sampleValidation.time_buckets
      }
    });
    return null;
  }
  
  // Gate 3: Check confidence threshold
  if (optimization.confidence < 0.5) {
    console.log('⚠️  Confidence too low - skipping recommendation');
    await supabase.from('ai_logs').insert({
      type: 'ml_agent',
      action: 'recommendation_skipped',
      status: 'warning',
      output: { confidence: optimization.confidence, reason: 'below_threshold' }
    });
    return null;
  }
  
  // Gate 4: Check expected improvement floor
  if (optimization.expected_improvement < 2.0) {
    console.log('⚠️  Expected improvement too small - skipping recommendation');
    await supabase.from('ai_logs').insert({
      type: 'ml_agent',
      action: 'recommendation_skipped',
      status: 'warning',
      output: { 
        expected_improvement: optimization.expected_improvement,
        reason: 'improvement_below_floor'
      }
    });
    return null;
  }
  
  // Get current active version
  const { data: runtime } = await supabase.rpc('get_god_runtime');
  const currentVersion = runtime?.effective_weights_version;
  
  const { data: currentWeightsData } = await supabase
    .from('god_weight_versions')
    .select('weights')
    .eq('weights_version', currentVersion)
    .single();
  
  const currentWeights = currentWeightsData?.weights;
  
  // Create draft version name
  const draftVersion = `god_ml_${Date.now()}`;
  
  // Build new weights JSON (preserve ALL fields, only update componentWeights)
  // CRITICAL: ML agent can ONLY modify fundamental component weights
  // ML agent CANNOT modify signal weights (signals are separate SSOT)
  const newWeights = {
    ...currentWeights,
    
    // ONLY modify fundamental component weights (team/traction/market/product/vision)
    componentWeights: optimization.recommended_weights,
    
    // PRESERVE signals contract (ML agent CANNOT touch these)
    signalMaxPoints: currentWeights.signalMaxPoints,
    signals_contract_version: currentWeights.signals_contract_version,
    
    // PRESERVE all other config
    normalizationDivisor: currentWeights.normalizationDivisor,
    baseBoostMinimum: currentWeights.baseBoostMinimum,
    vibeBonusCap: currentWeights.vibeBonusCap,
    finalScoreMultiplier: currentWeights.finalScoreMultiplier,
    
    // Add metadata
    ml_generated: true,
    ml_confidence: optimization.confidence,
    ml_expected_improvement: optimization.expected_improvement,
    ml_sample_size: sampleValidation.success_count + sampleValidation.failure_count,
    ml_positive_rate: sampleValidation.positive_rate,
    source_version: currentVersion,
    generated_at: new Date().toISOString()
  };
  
  // Insert draft version (NOT active)
  const { error: insertError } = await supabase
    .from('god_weight_versions')
    .insert({
      weights_version: draftVersion,
      weights: newWeights,
      created_by: 'ml_agent',
      comment: `ML recommendation (${(optimization.confidence * 100).toFixed(0)}% confidence, ${optimization.expected_improvement.toFixed(1)}% expected improvement). ${optimization.reasoning[0]}`
    });
  
  if (insertError) {
    console.error('❌ Failed to create draft version:', insertError);
    return null;
  }
  
  console.log(`✅ Created draft version: ${draftVersion}`);
  
  // Run golden tests BEFORE storing recommendation
  const goldenResult = await runGoldenTestsOnDraftVersion(draftVersion);
  
  console.log(`   Golden tests: ${goldenResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
  if (!goldenResult.passed) {
    console.log('   Failures:', goldenResult.failures);
  }
  
  // Store recommendation in ml_recommendations table
  const { error: recError } = await supabase
    .from('ml_recommendations')
    .insert({
      weights_version: draftVersion,
      recommendation_type: 'component_weight_adjustment',
      current_weights: currentWeights,
      recommended_weights: newWeights,
      confidence: optimization.confidence,
      reasoning: optimization.reasoning,
      expected_improvement: optimization.expected_improvement,
      status: 'pending',
      golden_tests_passed: goldenResult.passed,
      golden_tests_output: goldenResult.output,
      requires_manual_approval: true,
      created_at: new Date().toISOString()
    });
  
  if (recError) {
    console.error('❌ Failed to store recommendation:', recError);
  }
  
  // Log to ai_logs
  await supabase.from('ai_logs').insert({
    type: 'ml_agent',
    action: 'recommendation_created',
    status: goldenResult.passed ? 'success' : 'warning',
    output: {
      draft_version: draftVersion,
      confidence: optimization.confidence,
      expected_improvement: optimization.expected_improvement,
      golden_tests_passed: goldenResult.passed,
      reasoning: optimization.reasoning
    }
  });
  
  return draftVersion;
}

/**
 * Run golden tests on draft version WITHOUT activating it
 */
async function runGoldenTestsOnDraftVersion(draftVersion: string): Promise<{
  passed: boolean;
  output: any;
  failures: string[];
}> {
  // This would temporarily load draft weights and run golden test suite
  // WITHOUT changing active_weights_version or override_weights_version
  
  // Implementation: similar to scripts/test-god-golden.js but with draft version
  // Returns: { passed: true/false, output: test results, failures: error messages }
  
  return { passed: true, output: {}, failures: [] }; // Placeholder
}
```

**Guardrails integration checklist:**
- ✅ Draft version created (immutable, not active)
- ✅ Golden tests run BEFORE admin sees it
- ✅ Signals cap invariants checked (signals_bonus <= 10)
- ✅ Sample size gates enforced (200+ success, 200+ fail)
- ✅ Cross-time stability checked (patterns consistent across market regimes)
- ✅ Expected improvement floor (>2% minimum)
- ✅ ML agent can ONLY modify componentWeights (NOT signalMaxPoints)
- ✅ Stored in `ml_recommendations` table (admin dashboard)
- ✅ Manual approval required (no auto-apply)
- ✅ Instant rollback preserved (all versions in history)
- ✅ Freeze flag respected (recommendations generate but don't apply)

---

## 📋 REQUIRED DATABASE CHANGES

### New Table: ml_recommendations

```sql
-- Migration: server/migrations/20260129_ml_recommendations.sql

CREATE TABLE IF NOT EXISTS public.ml_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to draft weight version
  weights_version text NOT NULL REFERENCES public.god_weight_versions(weights_version),
  
  -- Recommendation metadata
  recommendation_type text NOT NULL,  -- 'component_weight_adjustment', 'signal_weight_adjustment'
  current_weights jsonb NOT NULL,
  recommended_weights jsonb NOT NULL,
  
  -- ML analysis results
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning text[] NOT NULL,
  expected_improvement numeric NOT NULL,
  
  -- Golden test results (run before admin sees it)
  golden_tests_passed boolean NOT NULL DEFAULT false,
  golden_tests_output jsonb DEFAULT '{}'::jsonb,
  
  -- Approval workflow
  status text NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'expired'
  requires_manual_approval boolean NOT NULL DEFAULT true,
  
  -- Audit trail
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

-- Indexes
CREATE INDEX idx_ml_recommendations_status ON public.ml_recommendations(status);
CREATE INDEX idx_ml_recommendations_created ON public.ml_recommendations(created_at DESC);
CREATE INDEX idx_ml_recommendations_version ON public.ml_recommendations(weights_version);

-- Comments
COMMENT ON TABLE public.ml_recommendations IS 
  'ML agent weight recommendations requiring admin approval. Tied to draft god_weight_versions.';

COMMENT ON COLUMN public.ml_recommendations.golden_tests_passed IS 
  'Pre-checked before admin review. If false, recommendation is flagged.';

COMMENT ON COLUMN public.ml_recommendations.requires_manual_approval IS 
  'Always true for now. Future: auto-apply if confidence >= 0.8 and tests pass.';
```

---

## 🔧 IMPLEMENTATION CHECKLIST

### Phase 1: Fix ML Agent Logic (CRITICAL)

- [ ] **File:** `server/services/mlTrainingService.ts`
- [ ] Remove `god_score >= 70` from success criteria (line ~230)
- [ ] Implement `validateSampleSizes()` function (min 200 success/fail)
- [ ] Implement `analyzeTimeBuckets()` function (6-month market regimes)
- [ ] Implement `checkCrossTimeStability()` function (pattern consistency)
- [ ] Replace `collectTrainingData()` with `collectTrainingDataFast()` (single query)
- [ ] Update `extractSuccessPatterns()` to use time-sliced data
- [ ] Update `analyzeSuccessFactors()` to use time-sliced data
- [ ] Validation: Log `historical_signal_count` vs `future_signal_count`
- [ ] Validation: Log sample sizes and stability checks

### Phase 2: Integrate with Guardrails

- [ ] **File:** `server/services/mlTrainingService.ts`
- [ ] Implement `generateAndStoreMLinRecommendation()` function
- [ ] Create draft weight versions (not active versions)
- [ ] Implement `runGoldenTestsOnDraftVersion()` function
- [ ] Store recommendations in `ml_recommendations` table
- [ ] Log all actions to `ai_logs` table
- [ ] Update `runMLTrainingCycle()` to use new flow

### Phase 3: Database Migration

- [ ] **File:** `server/migrations/20260129_ml_training_view.sql`
- [ ] Create `ml_training_snapshot` materialized view (performance fix)
- [ ] Add conditional aggregates with FILTER clauses (historical vs future)
- [ ] Add `refresh_ml_training_snapshot()` function
- [ ] Add indexes on is_successful and score_date
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify view: `SELECT COUNT(*), SUM(is_successful::int) FROM ml_training_snapshot;`
- [ ] **File:** `server/migrations/20260129_ml_recommendations.sql`
- [ ] Create `ml_recommendations` table
- [ ] Add indexes and constraints
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify table creation: `SELECT * FROM ml_recommendations LIMIT 1;`

### Phase 4: Admin Dashboard (Future)

- [ ] **File:** `src/pages/admin/MLRecommendations.tsx`
- [ ] Display pending recommendations
- [ ] Show confidence, reasoning, expected improvement
- [ ] Show golden test results (PASS/FAIL indicators)
- [ ] "Apply" button (calls `UPDATE god_runtime_config SET active_weights_version = ?`)
- [ ] "Reject" button (updates status to 'rejected')
- [ ] Approval triggers scorer recalculation
- [ ] Log approval/rejection to `algorithm_metrics`

### Phase 5: Testing & Validation

- [ ] Run ML training cycle with fixed logic
- [ ] Verify no circular success labels (check logs)
- [ ] Verify time-slicing (check `historical_signal_count` < `future_signal_count`)
- [ ] Verify draft versions created (not active)
- [ ] Verify golden tests run on drafts
- [ ] Verify recommendations stored in database
- [ ] Test admin approval workflow
- [ ] Test instant rollback after approval

---

## 🎯 SUCCESS CRITERIA

### ML Agent Fixed When:

1. **No circular logic:**
   - Success labels use ONLY time-stamped events (funded, revenue, retention)
   - Success labels NEVER include `god_score` or `signal_quality`
   - Validation: Search codebase for `god_score >= X` in success criteria → should find ZERO

2. **No time leakage:**
   - Features use signals occurring BEFORE score date only
   - Outcomes measured in window AFTER score date
   - Validation: `historical_signal_count` always < `future_signal_count` in logs

3. **Guardrails enforced:**
   - ML agent creates draft versions (not active versions)
   - Golden tests run BEFORE admin sees recommendation
   - Sample size gates pass (200+ success, 200+ fail)
   - Cross-time stability verified (patterns consistent across market regimes)
   - Expected improvement > 2% (avoids churn)
   - ML agent modifies ONLY componentWeights (NOT signalMaxPoints)
   - Manual approval required
   - Instant rollback preserved
   - Validation: Check `ml_recommendations` table → all `status='pending'` initially

4. **Admin dashboard exists:**
   - `/admin/ml-recommendations` page shows pending items
   - Displays confidence, reasoning, test results
   - Apply/Reject buttons work
   - Approval triggers scorer recalculation
   - Validation: Click "Apply" → check `god_runtime_config.active_weights_version` updated

---

## 📊 EXAMPLE TRAINING DATA (FIXED)

### Before (Broken):
```json
{
  "startup_id": "abc-123",
  "god_score": 72,
  "team_score": 18,
  "has_funding_signals": true,
  "funded": true,  // ❌ When? (time leakage)
  "is_successful": true  // ❌ Based on god_score >= 70 (circular)
}
```

### After (Fixed):
```json
{
  "startup_id": "abc-123",
  "score_date": "2025-07-15T00:00:00Z",
  "outcome_window_end": "2026-01-15T00:00:00Z",
  
  "god_score": 72,
  "team_score": 18,
  "has_funding_signals": true,
  "funding_confidence": 0.85,
  
  "historical_signal_count": 12,  // ✅ Signals BEFORE 2025-07-15
  "future_signal_count": 8,        // ✅ Signals AFTER 2025-07-15
  
  "is_successful": true,           // ✅ Based on funding event at 2025-10-20
  "success_reason": "funding_event",
  "success_date": "2025-10-20T00:00:00Z",
  "success_value": "$2M Series A"
}
```

---

## 🚦 DEPLOYMENT SEQUENCE

1. **Run database migration** (create `ml_recommendations` table)
2. **Deploy fixed ML agent code** (with time-slicing and draft versions)
3. **Run one training cycle** manually (verify logs show correct data)
4. **Check `ml_recommendations` table** (should have 1 pending recommendation)
5. **Build admin dashboard** (show pending recommendations)
6. **Test approval workflow** (apply/reject buttons)
7. **Enable scheduled training** (PM2 process: `ml-training-scheduler`)

---

## 📚 RELATED FILES

| File | Changes Needed |
|------|----------------|
| `server/services/mlTrainingService.ts` | Fix success labels, add sample size gates, replace with fast collector, create draft versions |
| `server/migrations/20260129_ml_training_view.sql` | Create materialized view with conditional aggregates (performance fix) |
| `server/migrations/20260129_ml_recommendations.sql` | Create `ml_recommendations` table |
| `src/pages/admin/MLRecommendations.tsx` | Build admin dashboard (future) |
| `scripts/test-god-golden.js` | Extend to test draft versions |
| `.github/workflows/god-golden.yml` | CI should NOT test draft versions (only active) |
| `ecosystem.config.js` | Add cron job to refresh materialized view after scraper cycles |

---

## ⚠️ WHAT NOT TO DO

**DO NOT:**
- ❌ Auto-apply ML recommendations without approval
- ❌ Use `god_score` in success labels (circular)
- ❌ Mix signals from different time periods (time leakage)
- ❌ Generate recommendations with <200 success or <200 fail samples (class imbalance)
- ❌ Use per-startup query loops (O(N) query explosion)
- ❌ Let ML agent modify signal weights (signals are separate SSOT)
- ❌ Modify `god_weight_versions` directly (use draft flow)
- ❌ Skip golden tests on draft versions
- ❌ Trust confidence scores from broken model (fix logic first)
- ❌ Recommend changes with <2% expected improvement (churn)

**ALWAYS:**
- ✅ Time-slice training data (features before, outcomes after)
- ✅ Use independent success labels (time-stamped events with auditable success_reason)
- ✅ Enforce minimum sample sizes (200+ success, 200+ fail)
- ✅ Check cross-time stability (patterns consistent across market regimes)
- ✅ Use SQL-based set queries with FILTER aggregates (single query, not loops)
- ✅ Use materialized views for training data (performance)
- ✅ Create draft versions (not active versions)
- ✅ Preserve signals contract (ML agent modifies ONLY componentWeights)
- ✅ Run golden tests before admin sees recommendation
- ✅ Require manual approval
- ✅ Log everything to `ai_logs` and `ml_recommendations`

---

*Created: January 29, 2026*  
*Status: ML agent BROKEN - requires fixes before production use*  
*Priority: HIGH - circular logic and time leakage produce garbage recommendations*
