# GOD Score Guardrails - Implementation Report & Production Specification

## Executive Summary

**What I Built:** TypeScript-based guardrails with file-based configuration
**What You Need:** SQL-based guardrails integrated with Supabase + production architecture
**Status:** ⚠️ My implementation needs replacement with production-ready version

---

## Part 1: What I Implemented (Initial Approach)

### Files Created

| File | Purpose | Status |
|------|---------|--------|
| `server/config/god-score-weights.json` | JSON config file for weights v1.0.0 | ❌ Replace with DB table |
| `server/config/weights-versioning-schema.sql` | Basic SQL schema | ❌ Replace with production schema |
| `server/services/scoreExplanation.ts` | TypeScript explanation generator | ❌ Replace with DB storage |
| `server/services/invariants.ts` | TypeScript validation utilities | ✅ Keep for scoring logic |
| `server/services/killSwitch.ts` | Environment variable-based controls | ❌ Replace with DB-based runtime config |
| `tests/god-score-golden-set.json` | 10 canonical test cases | ✅ Migrate to production format |
| `tests/god-score-regression.test.ts` | TypeScript test runner | ❌ Replace with Node.js + RPC |

### Architecture Issues

❌ **File-based config** - Not production-ready, requires code deploy to change weights
❌ **Environment variables** - Kill switch requires server restart
❌ **TypeScript-only** - Not integrated with Supabase/Express patterns
❌ **No API routes** - Can't query explanations or control system via HTTP
❌ **Separate from current scorer** - Doesn't integrate with existing `recalculate-scores.ts`

---

## Part 2: Production Specification (Your Architecture)

### Database Schema

#### Table 1: `god_weight_versions` (Immutable Weights)

```sql
create table public.god_weight_versions (
  weights_version text primary key,
  status god_weight_status not null default 'active',
  weights jsonb not null,
  weights_sha256 text not null,
  created_by text,
  created_at timestamptz not null default now(),
  comment text
);

-- Immutability trigger (prevent edits)
create or replace function public.guard_immutable_god_weights()
returns trigger language plpgsql as $$
begin
  raise exception 'god_weight_versions is immutable. Create a new weights_version instead.';
end $$;

create trigger trg_guard_immutable_god_weights
before update or delete on public.god_weight_versions
for each row execute function public.guard_immutable_god_weights();
```

**Key Features:**
- Immutable by trigger (cannot UPDATE or DELETE)
- SHA256 hash for integrity verification
- JSONB weights blob (flexible structure)
- Created timestamp and author tracking

#### Table 2: `god_runtime_config` (Active Version Pointer)

```sql
create table public.god_runtime_config (
  id int primary key default 1,
  active_weights_version text not null,
  override_weights_version text,  -- Emergency rollback
  freeze boolean not null default false,  -- Kill switch
  updated_at timestamptz not null default now()
);

insert into public.god_runtime_config (id, active_weights_version)
values (1, 'god_v1_initial')
on conflict (id) do nothing;
```

**Key Features:**
- Single row config (id always = 1)
- `active_weights_version` = normal production version
- `override_weights_version` = instant rollback target
- `freeze` = stop all score computation
- No server restart needed to change

#### Table 3: `god_score_explanations` (Debug Payload Storage)

```sql
create table public.god_score_explanations (
  startup_id uuid not null,
  weights_version text not null references public.god_weight_versions(weights_version),
  total_score numeric,
  component_scores jsonb not null default '{}'::jsonb,
  top_signal_contributions jsonb not null default '[]'::jsonb,
  debug jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (startup_id, weights_version)
);

create index idx_god_score_explanations_weights
on public.god_score_explanations (weights_version, computed_at desc);

create index idx_god_score_explanations_startup
on public.god_score_explanations (startup_id, computed_at desc);
```

**Key Features:**
- One explanation per (startup_id, weights_version)
- Component breakdown stored as JSONB
- Top N signal contributions tracked
- Indexed for fast queries by startup or version

### RPC Functions

#### 1. Get Runtime Config

```sql
create or replace function public.get_god_runtime()
returns table(
  active_weights_version text,
  override_weights_version text,
  effective_weights_version text,
  freeze boolean,
  updated_at timestamptz
)
language sql stable as $$
  select
    c.active_weights_version,
    c.override_weights_version,
    coalesce(c.override_weights_version, c.active_weights_version) as effective_weights_version,
    c.freeze,
    c.updated_at
  from public.god_runtime_config c
  where c.id = 1;
$$;
```

**Returns:**
- `effective_weights_version` = override if set, else active
- Used by scorer to determine which weights to use

#### 2. Get Explanation for Startup

```sql
create or replace function public.get_god_explain(
  p_startup_id uuid, 
  p_weights_version text default null
)
returns jsonb
language plpgsql stable as $$
declare
  v_eff text;
  rec jsonb;
begin
  if p_weights_version is null then
    select effective_weights_version into v_eff 
    from public.get_god_runtime() limit 1;
  else
    v_eff := p_weights_version;
  end if;

  select to_jsonb(e.*) into rec
  from public.god_score_explanations e
  where e.startup_id = p_startup_id
    and e.weights_version = v_eff;

  if rec is null then
    return jsonb_build_object(
      'startup_id', p_startup_id,
      'weights_version', v_eff,
      'found', false
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'weights_version', v_eff,
    'explain', rec
  );
end $$;
```

**Usage:**
- `select * from get_god_explain('startup-uuid')` → current effective version
- `select * from get_god_explain('startup-uuid', 'god_v1_old')` → specific version

### Express API Routes

#### File: `server/routes/god.js`

```javascript
import express from "express";
import { supabaseAdmin } from "../supabaseAdmin.js";

const router = express.Router();

// GET /api/god/runtime
router.get("/runtime", async (req, res) => {
  const { data, error } = await supabaseAdmin.rpc("get_god_runtime");
  if (error) return res.status(500).json({ error: "RPC_ERROR", details: error });
  return res.json(data?.[0] ?? null);
});

// GET /api/god/explain/:startupId?weights_version=...
router.get("/explain/:startupId", async (req, res) => {
  const { startupId } = req.params;
  const weightsVersion = req.query.weights_version || null;

  const { data, error } = await supabaseAdmin.rpc("get_god_explain", {
    p_startup_id: startupId,
    p_weights_version: weightsVersion,
  });

  if (error) return res.status(500).json({ error: "RPC_ERROR", details: error });
  return res.json(data);
});

// POST /api/god/override { override_weights_version: "..." | null }
router.post("/override", async (req, res) => {
  // TODO: Add admin auth middleware
  const { override_weights_version } = req.body || {};

  const { error } = await supabaseAdmin
    .from("god_runtime_config")
    .update({ override_weights_version })
    .eq("id", 1);

  if (error) return res.status(500).json({ error: "DB_ERROR", details: error });
  return res.json({ ok: true, override_weights_version });
});

// POST /api/god/activate { active_weights_version: "..." }
router.post("/activate", async (req, res) => {
  // TODO: Add admin auth middleware
  const { active_weights_version } = req.body || {};
  if (!active_weights_version) 
    return res.status(400).json({ error: "MISSING_ACTIVE_VERSION" });

  const { error } = await supabaseAdmin
    .from("god_runtime_config")
    .update({ active_weights_version })
    .eq("id", 1);

  if (error) return res.status(500).json({ error: "DB_ERROR", details: error });
  return res.json({ ok: true, active_weights_version });
});

// POST /api/god/freeze { freeze: true|false }
router.post("/freeze", async (req, res) => {
  // TODO: Add admin auth middleware
  const { freeze } = req.body || {};
  if (typeof freeze !== "boolean") 
    return res.status(400).json({ error: "INVALID_FREEZE" });

  const { error } = await supabaseAdmin
    .from("god_runtime_config")
    .update({ freeze })
    .eq("id", 1);

  if (error) return res.status(500).json({ error: "DB_ERROR", details: error });
  return res.json({ ok: true, freeze });
});

export default router;
```

**Mount in `server/index.js`:**
```javascript
import godRoutes from './routes/god.js';
app.use("/api/god", godRoutes);
```

### Golden Set Regression Tests

#### File: `golden/god_golden_set.json`

```json
{
  "weights_version": "god_v1_initial",
  "cases": [
    {
      "startup_id": "00000000-0000-0000-0000-000000000001",
      "name": "Elite funded startup",
      "min_total": 85,
      "max_total": 95,
      "must_include_components": ["team", "traction", "market"]
    },
    {
      "startup_id": "00000000-0000-0000-0000-000000000002",
      "name": "Early-stage promising",
      "min_total": 65,
      "max_total": 75,
      "must_include_components": ["team", "vision"]
    },
    {
      "startup_id": "00000000-0000-0000-0000-000000000003",
      "name": "Low quality no traction",
      "min_total": 40,
      "max_total": 50,
      "must_include_components": ["vision"]
    }
  ]
}
```

#### File: `scripts/test-god-golden.js`

```javascript
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const goldenPath = path.resolve("golden/god_golden_set.json");
const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));

let failed = 0;

for (const c of golden.cases) {
  const { data, error } = await supabase.rpc("get_god_explain", {
    p_startup_id: c.startup_id,
    p_weights_version: golden.weights_version,
  });

  if (error) {
    failed++;
    console.error(`[FAIL] RPC error for ${c.startup_id}`, error);
    continue;
  }

  if (!data?.found) {
    failed++;
    console.error(`[FAIL] No explanation found for ${c.startup_id} @ ${golden.weights_version}`);
    continue;
  }

  const explain = data.explain;
  const total = Number(explain.total_score ?? NaN);
  
  if (!Number.isFinite(total)) {
    failed++;
    console.error(`[FAIL] total_score missing/invalid for ${c.startup_id}`);
    continue;
  }

  if (total < c.min_total || total > c.max_total) {
    failed++;
    console.error(
      `[FAIL] ${c.name}: total_score ${total} not in [${c.min_total}, ${c.max_total}]`
    );
  }

  const comps = explain.component_scores || {};
  for (const k of c.must_include_components || []) {
    if (!(k in comps)) {
      failed++;
      console.error(`[FAIL] ${c.name}: missing component "${k}"`);
    }
  }

  console.log(`[OK] ${c.name}: total=${total}`);
}

if (failed > 0) {
  console.error(`\n❌ Golden set failed: ${failed} checks failed`);
  process.exit(1);
}

console.log("\n✅ Golden set passed");
```

### Emergency Rollback Scripts

#### File: `scripts/god-rollback.js`

```javascript
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const target = process.argv[2]; // weights_version OR "clear"

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

if (!target) {
  console.error('Usage: node scripts/god-rollback.js <weights_version|clear>');
  console.error('Example: node scripts/god-rollback.js god_v1_initial');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const override = target === "clear" ? null : target;

// Validate target exists
if (override) {
  const { data, error } = await supabase
    .from("god_weight_versions")
    .select("weights_version")
    .eq("weights_version", override)
    .maybeSingle();

  if (error || !data) {
    console.error(`❌ weights_version not found: ${override}`);
    process.exit(1);
  }
}

const { error } = await supabase
  .from("god_runtime_config")
  .update({ override_weights_version: override })
  .eq("id", 1);

if (error) {
  console.error("❌ Failed to set override", error);
  process.exit(1);
}

console.log(`✅ Rollback complete: override_weights_version = ${override ?? "null (cleared)"}`);
```

#### File: `scripts/god-freeze.js`

```javascript
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const on = process.argv[2]; // "true" or "false"

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars");
  process.exit(2);
}

if (on !== "true" && on !== "false") {
  console.error("Usage: node scripts/god-freeze.js true|false");
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const freeze = on === "true";

const { error } = await supabase
  .from("god_runtime_config")
  .update({ freeze })
  .eq("id", 1);

if (error) {
  console.error("❌ Failed to set freeze", error);
  process.exit(1);
}

console.log(`✅ Freeze ${freeze ? "ENABLED" : "DISABLED"}`);
```

---

## Part 3: Integration with Current Scorer

### Current State Analysis

**Existing scorer:** `scripts/recalculate-scores.ts`
**Current storage:** `startup_uploads.total_god_score`
**Scoring logic:** `server/services/startupScoringService.ts`

### Required Changes to Scorer

#### 1. Check freeze flag before running

```typescript
// At top of recalculate-scores.ts
const { data: runtime } = await supabase.rpc('get_god_runtime');
if (runtime?.[0]?.freeze) {
  console.log('🚨 GOD scoring is FROZEN. Exiting.');
  process.exit(0);
}

const effectiveVersion = runtime?.[0]?.effective_weights_version;
console.log(`Using weights version: ${effectiveVersion}`);
```

#### 2. Load weights from database

```typescript
// Load weights from DB instead of hardcoded config
const { data: weightsRow } = await supabase
  .from('god_weight_versions')
  .select('weights')
  .eq('weights_version', effectiveVersion)
  .single();

const weights = weightsRow.weights;
```

#### 3. Generate explanation payload

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
  top_signal_contributions: topSignals.slice(0, 10), // Top 10 signals
  debug: {
    raw_scores: rawScores,
    normalized_scores: normalizedScores,
    timestamp: new Date().toISOString()
  }
};
```

#### 4. Upsert explanation to database

```typescript
// Write explanation (upsert)
await supabase
  .from('god_score_explanations')
  .upsert({
    startup_id: startup.id,
    weights_version: effectiveVersion,
    total_score: finalScore,
    component_scores: explanation.component_scores,
    top_signal_contributions: explanation.top_signal_contributions,
    debug: explanation.debug,
    computed_at: new Date().toISOString()
  }, {
    onConflict: 'startup_id,weights_version'
  });
```

#### 5. Update startup_uploads with version

```typescript
// Update startup score with version tracking
await supabase
  .from('startup_uploads')
  .update({
    total_god_score: finalScore,
    weights_version: effectiveVersion // NEW: track which version computed this
  })
  .eq('id', startup.id);
```

---

## Part 4: API Usage Examples

### Query Runtime Config

```bash
curl http://localhost:3002/api/god/runtime
```

**Response:**
```json
{
  "active_weights_version": "god_v1_initial",
  "override_weights_version": null,
  "effective_weights_version": "god_v1_initial",
  "freeze": false,
  "updated_at": "2026-01-29T12:00:00Z"
}
```

### Get Explanation for Startup

```bash
# Current effective version
curl http://localhost:3002/api/god/explain/123e4567-e89b-12d3-a456-426614174000

# Specific version
curl "http://localhost:3002/api/god/explain/123e4567-e89b-12d3-a456-426614174000?weights_version=god_v1_old"
```

**Response:**
```json
{
  "found": true,
  "weights_version": "god_v1_initial",
  "explain": {
    "startup_id": "123e4567-e89b-12d3-a456-426614174000",
    "weights_version": "god_v1_initial",
    "total_score": 87.5,
    "component_scores": {
      "team": 22.5,
      "traction": 25.0,
      "market": 18.0,
      "product": 12.0,
      "vision": 10.0
    },
    "top_signal_contributions": [
      {"key": "raised_5m", "raw": 5000000, "norm": 0.8, "contrib": 2.5},
      {"key": "mom_growth", "raw": 1.0, "norm": 1.0, "contrib": 2.0}
    ],
    "computed_at": "2026-01-29T12:00:00Z"
  }
}
```

### Emergency Rollback

```bash
# Rollback to previous version (instant)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/god-rollback.js god_v1_initial

# Clear override (back to normal)
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

---

## Part 5: CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/god-golden.yml`

```yaml
name: GOD Golden Set

on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  golden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run GOD golden set
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/test-god-golden.js
```

**Behavior:**
- Runs on every PR and push to main
- Fails if any golden case violates expected range
- Prevents merging broken scoring changes

---

## Part 6: Comparison Matrix

| Feature | My Implementation | Production Spec | Winner |
|---------|-------------------|-----------------|--------|
| **Weights Storage** | JSON file | Supabase table | ✅ Production |
| **Versioning** | File-based | Database immutable rows | ✅ Production |
| **Kill Switch** | ENV vars (restart required) | DB flag (instant) | ✅ Production |
| **Rollback** | Git revert | SQL update (instant) | ✅ Production |
| **Explanation** | TypeScript generator | DB table with RPC | ✅ Production |
| **API Access** | None | Express routes | ✅ Production |
| **Golden Tests** | TypeScript runner | Node.js + RPC | ✅ Production |
| **CI Integration** | Not implemented | GitHub Actions | ✅ Production |
| **Invariants** | TypeScript validation | ✅ Keep for logic | ✅ Both |

---

## Part 7: Migration Plan

### Step 1: Create Database Schema
```bash
# Run in Supabase SQL editor
psql $DATABASE_URL -f server/migrations/god-guardrails-schema.sql
```

### Step 2: Seed Initial Weights Version
```sql
INSERT INTO god_weight_versions (weights_version, weights, weights_sha256, comment)
VALUES (
  'god_v1_initial',
  '{
    "normalizationDivisor": 23,
    "baseBoostMinimum": 2.0,
    "vibeBonusCap": 1.0,
    "componentWeights": {
      "team": 0.25,
      "traction": 0.25,
      "market": 0.20,
      "product": 0.15,
      "vision": 0.15
    }
  }'::jsonb,
  encode(sha256('...'::bytea), 'hex'),
  'Original GOD score weights from Jan 2026'
);
```

### Step 3: Add API Routes
```bash
# Create server/routes/god.js
# Mount in server/index.js
```

### Step 4: Update Scorer
```bash
# Modify scripts/recalculate-scores.ts
# Add freeze check, weights loading, explanation write
```

### Step 5: Create Rollback Scripts
```bash
# scripts/god-rollback.js
# scripts/god-freeze.js
```

### Step 6: Add Golden Set Tests
```bash
# golden/god_golden_set.json
# scripts/test-god-golden.js
# .github/workflows/god-golden.yml
```

### Step 7: Remove My Old Files
```bash
rm server/config/god-score-weights.json
rm server/config/weights-versioning-schema.sql
rm server/services/scoreExplanation.ts
rm server/services/killSwitch.ts
rm tests/god-score-regression.test.ts
# Keep: server/services/invariants.ts
```

---

## Part 8: Next Steps

### I Need From You:

1. **Confirm schema location**
   - Should I create `server/migrations/god-guardrails-schema.sql`?
   - Or paste directly into Supabase SQL editor?

2. **Confirm current scorer location**
   - Is it `scripts/recalculate-scores.ts`?
   - Any other scoring scripts I should update?

3. **Confirm API patterns**
   - Do you have a `supabaseAdmin.js` file with service role key?
   - Any auth middleware I should use for admin routes?

4. **Golden set startups**
   - Can you provide 3-5 real startup UUIDs for golden set?
   - What are their expected score ranges?

### Ready to Implement:

Once you confirm the above, I will:
1. ✅ Create production SQL schema
2. ✅ Create Express API routes
3. ✅ Update your scorer (`recalculate-scores.ts`)
4. ✅ Create rollback scripts
5. ✅ Create golden set tests
6. ✅ Add GitHub Actions workflow
7. ✅ Remove my old TypeScript-only files

---

## Summary

**What I built:** TypeScript guardrails (good intent, wrong architecture)
**What you need:** SQL-based guardrails integrated with Supabase (production-ready)
**Status:** Ready to implement your specification

Your architecture is significantly better:
- ✅ No server restart for rollback
- ✅ SQL-driven (no code deploys)
- ✅ Integrated with existing patterns
- ✅ API accessible
- ✅ CI-ready

**Awaiting your confirmation to proceed with production implementation.**
