# Server-Side: Recording Signal History

## Goal
Every time `/api/matches` computes matches for a startup, we record that day's metrics to `startup_signal_history`.

## Where to Add This

**File**: `server/routes/matches.js` (or wherever your `/api/matches` endpoint lives)

---

## Patch 1: Add to `/api/matches` endpoint

**CRITICAL**: Record history from **raw matches** (before tier-gating), not from the filtered response.

Add these helpers near the top of `server/routes/matches.js`:

```javascript
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeFundraisingWindow(powerScore) {
  if (powerScore >= 85) return 'Prime';
  if (powerScore >= 65) return 'Forming';
  return 'Too Early';
}

/**
 * Compute the 4 metrics from raw matches + GOD score
 * Signal Strength = avg(top 5 match_score)
 * Readiness = GOD score
 * Power Score = (Signal Strength * Readiness) / 100
 */
function computeSignalMetrics(rawMatches, godScore) {
  const top = (rawMatches || [])
    .slice()
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 5);

  const signalStrength =
    top.length > 0
      ? Math.round(top.reduce((acc, m) => acc + (m.match_score || 0), 0) / top.length)
      : 50;

  const readiness = clamp(Math.round(godScore ?? 60), 0, 100);
  const powerScore = clamp(Math.round((signalStrength * readiness) / 100), 0, 100);
  const fundraisingWindow = computeFundraisingWindow(powerScore);

  return { signalStrength, readiness, powerScore, fundraisingWindow };
}

async function recordSignalHistory({ supabase, startupId, rawMatches, godScore, source = 'scan', meta = {} }) {
  try {
    const { signalStrength, readiness, powerScore, fundraisingWindow } =
      computeSignalMetrics(rawMatches, godScore);

    const { error } = await supabase.rpc('upsert_signal_history', {
      p_startup_id: startupId,
      p_signal_strength: signalStrength,
      p_readiness: readiness,
      p_power_score: powerScore,
      p_fundraising_window: fundraisingWindow,
      p_source: source,
      p_meta: { ...meta, match_count: rawMatches?.length || 0 }
    });

    if (error) {
      console.error('[matches] Failed to record signal history:', error);
    } else {
      console.log(`[matches] Recorded signal history: ${powerScore} (${fundraisingWindow})`);
    }
  } catch (err) {
    console.error('[matches] Signal history recording error:', err);
  }
}
```

Then inside your `/api/matches` handler, **before you tier-gate/mask**:

```javascript
// rawMatches = your full computed match list (ungated)
// startup.total_god_score = readiness input

await recordSignalHistory({
  supabase,
  startupId: startup.id,
  rawMatches,
  godScore: startup.total_god_score,
  source: 'scan',
  meta: { endpoint: '/api/matches' }
});

// THEN apply tier gating to response
```

---

## Patch 2: Add GET endpoint for history

**File**: `server/routes/startups.js` (or create new file)

**CRITICAL**: Use user's JWT for RLS-safe queries. Filter by date window, not `.limit(days)`.

```javascript
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

function getUserSupabase(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
}

// GET /api/startups/:id/signal-history?days=14
router.get('/:id/signal-history', async (req, res) => {
  try {
    const supabase = getUserSupabase(req);
    const { id } = req.params;

    const days = Math.max(1, Math.min(90, parseInt(req.query.days || '14', 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('startup_signal_history')
      .select('recorded_at, signal_strength, readiness, power_score, fundraising_window')
      .eq('startup_id', id)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('[signal-history] Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    return res.json({ history: data || [] });
  } catch (err) {
    console.error('[signal-history] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

**Why this matters**: Using service key here would leak other founders' data unless you manually enforce ownership. JWT + RLS does it automatically.

---

## Patch 3: Daily Cron (Optional - for continuity even when founders don't scan)

**File**: `server/cron/daily-signal-history.js`

**CRITICAL**: Uses existing match table (no recomputation), service key for admin access.

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeFundraisingWindow(powerScore) {
  if (powerScore >= 85) return 'Prime';
  if (powerScore >= 65) return 'Forming';
  return 'Too Early';
}

function computeSignalMetrics(rawMatches, godScore) {
  const top = (rawMatches || [])
    .slice()
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 5);

  const signalStrength =
    top.length > 0
      ? Math.round(top.reduce((acc, m) => acc + (m.match_score || 0), 0) / top.length)
      : 50;

  const readiness = clamp(Math.round(godScore ?? 60), 0, 100);
  const powerScore = clamp(Math.round((signalStrength * readiness) / 100), 0, 100);
  const fundraisingWindow = computeFundraisingWindow(powerScore);

  return { signalStrength, readiness, powerScore, fundraisingWindow };
}

async function recordDailySignals() {
  console.log('[cron] Starting daily signal history recording...');

  try {
    const { data: startups, error: startupsError } = await supabase
      .from('startup_uploads')
      .select('id, total_god_score')
      .eq('status', 'approved');

    if (startupsError) throw startupsError;

    for (const startup of startups || []) {
      const { data: matches, error: matchesError } = await supabase
        .from('startup_investor_matches')
        .select('match_score')
        .eq('startup_id', startup.id)
        .order('match_score', { ascending: false })
        .limit(50);

      if (matchesError) {
        console.error(`[cron] Failed matches for ${startup.id}:`, matchesError);
        continue;
      }

      const { signalStrength, readiness, powerScore, fundraisingWindow } =
        computeSignalMetrics(matches || [], startup.total_god_score);

      const { error: upsertError } = await supabase.rpc('upsert_signal_history', {
        p_startup_id: startup.id,
        p_signal_strength: signalStrength,
        p_readiness: readiness,
        p_power_score: powerScore,
        p_fundraising_window: fundraisingWindow,
        p_source: 'cron',
        p_meta: { match_count: (matches || []).length }
      });

      if (upsertError) {
        console.error(`[cron] Failed history for ${startup.id}:`, upsertError);
      }
    }

    console.log(`[cron] Recorded signal history for ${(startups || []).length} startups`);
  } catch (err) {
    console.error('[cron] Daily signal history failed:', err);
  }
}

if (require.main === module) {
  recordDailySignals();
}

module.exports = { recordDailySignals };
```

**Add to `ecosystem.config.js`:**
```javascript
{
  name: 'daily-signal-history',
  script: 'server/cron/daily-signal-history.js',
  cron_restart: '0 2 * * *', // 2 AM daily
  autorestart: false,
}
```

---

## ✅ Critical Fixes Applied

1. **Record from raw matches** (ungated) - Prevents tier-gated history corruption
2. **Use JWT for GET endpoint** (RLS-safe) - Prevents data leakage between founders
3. **Filter by date window** (not limit) - Actually fetches "last N days"
4. **Shared helper functions** - Same logic across scan/cron
5. **Service key only for cron** - Admin bypass where needed, RLS everywhere else

**Deduplication check**: Your migration creates:
```sql
create unique index startup_signal_history_unique_day
  on startup_signal_history (startup_id, immutable_date_trunc_day(recorded_at));
```
✅ This ensures **one entry per day per startup**. The `upsert_signal_history` RPC uses this index.

---

## Testing

1. **Run migration in Supabase**: Copy/paste `supabase/migrations/20260120_startup_signal_history.sql`
2. **Add recording to `/api/matches`**: Use Patch 1
3. **Test**: Hit `/match?url=yoursite.com` → check Supabase table for new row
4. **Verify RLS**: Try querying as a different user → should see empty results

---

## What This Unlocks

✅ **Real `+4 today` deltas** (no more `—`)  
✅ **7-day sparklines** (visual proof of progress)  
✅ **Window transitions** ("Forming → Prime (2 days ago)")  
✅ **Addiction loop** (founders check every morning)  
✅ **Daily continuity** (cron ensures data even when not scanning)

---

**Next**: Wire this into `/api/matches` and you're DONE. Founders will start seeing their Power Score move daily.
