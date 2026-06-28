# GOD Score Guardrails - Deployment Instructions

## ✅ Files Created

### Database
- `server/migrations/20260129_god_guardrails.sql` - Main migration (tables, triggers, RPCs)
- `server/migrations/20260129_god_guardrails_seed.sql` - Initial weights version insert

### API
- `server/routes/god.js` - Express routes for runtime control

### Scripts
- `scripts/god-rollback.js` - Emergency rollback script
- `scripts/god-freeze.js` - Freeze/unfreeze scorer
- `scripts/test-god-golden.js` - Golden set regression test

### Test Data
- `golden/god_golden_set.json` - Golden test cases
- `.github/workflows/god-golden.yml` - CI workflow

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

**In Supabase SQL Editor**, paste and run:

```sql
-- Copy entire contents of server/migrations/20260129_god_guardrails.sql
```

**Then run seed data:**

```sql
-- Copy entire contents of server/migrations/20260129_god_guardrails_seed.sql
```

This creates:
- `god_weight_versions` table (immutable, auto-SHA256)
- `god_runtime_config` table (single-row, freeze flag)
- `god_score_explanations` table (debug payloads)
- RPC functions: `get_god_runtime()`, `get_god_explain()`

### Step 2: Verify Database

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'god_%';

-- Check initial weights version exists
SELECT weights_version, weights_sha256, created_at 
FROM god_weight_versions;

-- Check runtime config
SELECT * FROM get_god_runtime();
```

Expected output:
```
weights_version | weights_sha256 | created_at
----------------|----------------|------------
god_v1_initial  | <auto-hash>    | 2026-01-29...

active_weights_version | override | effective | freeze | updated_at
-----------------------|----------|-----------|--------|------------
god_v1_initial         | null     | god_v1_initial | false | 2026-01-29...
```

### Step 3: Mount API Routes

✅ Already done in Step 1 - `server/index.js` updated with:
```javascript
const godRouter = require('./routes/god');
app.use('/api/god', godRouter);
```

### Step 4: Restart Server

```bash
# If using PM2
pm2 restart server

# Or stop/start
pm2 stop server
pm2 start ecosystem.config.js
```

### Step 5: Test API Endpoints

```bash
# Check runtime config
curl http://localhost:3002/api/god/runtime

# Expected: {"active_weights_version":"god_v1_initial",...}
```

### Step 6: Update Scorer (Add Guardrails)

The scorer (`scripts/recalculate-scores.ts`) needs **5 changes**:

#### Change 1: Check freeze flag

```typescript
// At top of main() function, before processing startups
const { data: runtime, error: runtimeError } = await supabase.rpc('get_god_runtime');

if (runtimeError) {
  console.error('Failed to get GOD runtime config:', runtimeError);
  process.exit(1);
}

const config = runtime?.[0];
if (!config) {
  console.error('No GOD runtime config found');
  process.exit(1);
}

if (config.freeze) {
  console.log('🚨 GOD scoring is FROZEN. Exiting.');
  process.exit(0);
}

const effectiveVersion = config.effective_weights_version;
console.log(`Using weights version: ${effectiveVersion}`);
```

#### Change 2: Load weights from database

```typescript
// After getting effectiveVersion
const { data: weightsRow, error: weightsError } = await supabase
  .from('god_weight_versions')
  .select('weights')
  .eq('weights_version', effectiveVersion)
  .single();

if (weightsError || !weightsRow) {
  console.error(`Failed to load weights version ${effectiveVersion}:`, weightsError);
  process.exit(1);
}

const weights = weightsRow.weights;
console.log(`Loaded weights: normalizationDivisor=${weights.normalizationDivisor}`);
```

#### Change 3: Generate explanation payload

```typescript
// After computing score for each startup
const explanation = {
  total_score: finalScore,
  component_scores: {
    team: teamScore,
    traction: tractionScore,
    market: marketScore,
    product: productScore,
    vision: visionScore
  },
  top_signal_contributions: topSignals.slice(0, 10).map(s => ({
    key: s.key,
    raw: s.raw,
    normalized: s.normalized,
    contribution: s.contribution
  })),
  debug: {
    raw_scores: rawScores,
    normalized_scores: normalizedScores,
    weights_used: weights,
    timestamp: new Date().toISOString()
  }
};
```

#### Change 4: Upsert explanation

```typescript
// After generating explanation
const { error: explainError } = await supabase
  .from('god_score_explanations')
  .upsert({
    startup_id: startup.id,
    weights_version: effectiveVersion,
    total_score: explanation.total_score,
    component_scores: explanation.component_scores,
    top_signal_contributions: explanation.top_signal_contributions,
    debug: explanation.debug,
    computed_at: new Date().toISOString()
  }, {
    onConflict: 'startup_id,weights_version'
  });

if (explainError) {
  console.error(`Failed to save explanation for ${startup.id}:`, explainError);
}
```

#### Change 5: Update startup score

```typescript
// Keep existing update to startup_uploads
const { error: updateError } = await supabase
  .from('startup_uploads')
  .update({
    total_god_score: finalScore,
    // Optional: add weights_version column later
  })
  .eq('id', startup.id);
```

---

## 📋 Usage Examples

### Check Current Runtime

```bash
curl http://localhost:3002/api/god/runtime
```

### Get Explanation for Startup

```bash
# Current effective version
curl http://localhost:3002/api/god/explain/<startup-uuid>

# Specific version
curl "http://localhost:3002/api/god/explain/<startup-uuid>?weights_version=god_v1_old"
```

### Emergency Rollback

```bash
# Set override to previous version (instant)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/god-rollback.js god_v1_initial

# Clear override (back to active)
node scripts/god-rollback.js clear
```

### Freeze Scoring

```bash
# Stop all score computation
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/god-freeze.js true

# Resume
node scripts/god-freeze.js false
```

### Run Golden Set Tests

```bash
# Update golden/god_golden_set.json with real startup UUIDs first
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/test-god-golden.js
```

---

## 🧪 Testing Checklist

- [ ] Migration ran successfully in Supabase
- [ ] Initial weights version exists (`god_v1_initial`)
- [ ] Runtime config returns active version
- [ ] API endpoint `/api/god/runtime` works
- [ ] API endpoint `/api/god/explain/:id` works
- [ ] Rollback script works
- [ ] Freeze script works
- [ ] Scorer respects freeze flag
- [ ] Explanations are being written to database
- [ ] Golden set tests pass

---

## 🔧 Next Steps (Future)

### Add `weights_version` column to `startup_uploads`

```sql
-- Optional: Track which version computed each score
ALTER TABLE startup_uploads 
ADD COLUMN weights_version text REFERENCES god_weight_versions(weights_version);

-- Backfill from explanations
UPDATE startup_uploads s
SET weights_version = (
  SELECT e.weights_version
  FROM god_score_explanations e
  WHERE e.startup_id = s.id
  ORDER BY e.computed_at DESC
  LIMIT 1
);
```

### Update Golden Set with Real UUIDs

Replace placeholder UUIDs in `golden/god_golden_set.json` with real startups:

```sql
-- Find good candidates
SELECT id, name, total_god_score
FROM startup_uploads
WHERE status = 'approved'
ORDER BY total_god_score DESC
LIMIT 10;
```

---

## 📂 File Cleanup

After deploying, these old files can be deleted:

```bash
rm server/config/god-score-weights.json
rm server/config/weights-versioning-schema.sql
rm server/services/scoreExplanation.ts
rm server/services/killSwitch.ts
rm tests/god-score-regression.test.ts
rm tests/god-score-golden-set.json

# Keep this one - still useful for validation
# server/services/invariants.ts
```

---

## 🆘 Troubleshooting

### "god_weight_versions does not exist"
- Migration didn't run successfully
- Check Supabase SQL editor for errors
- Ensure you have `CREATE TABLE` permissions

### "RPC_ERROR: get_god_runtime not found"
- RPC functions weren't created
- Re-run migration SQL
- Check for syntax errors in migration file

### "UNKNOWN_WEIGHTS_VERSION" when rolling back
- Target version doesn't exist in database
- Check: `SELECT * FROM god_weight_versions;`
- Ensure version name matches exactly

### Scorer still running when frozen
- Scorer not checking freeze flag
- Verify changes were made to `recalculate-scores.ts`
- Check scorer logs for freeze check output

---

**All files ready for deployment. Awaiting your confirmation to proceed.**
