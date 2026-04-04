/**
 * Founder /lookup teaser — Top investors by sector.
 * Browser → Fly → Supabase is typically faster and more reliable than browser → Supabase directly,
 * and we can cache hot sectors briefly.
 *
 * Data path: RPC get_lookup_top_investors (SECURITY DEFINER, works with JSONB sectors in DB).
 * If that RPC regresses (e.g. text[]-only ANY()), the UI shows empty rows until the migration is fixed.
 */

const express = require('express');
const { getSupabaseClient } = require('../lib/supabaseClient');

const router = express.Router();

const SELECT_COLS =
  'id, name, firm, sectors, stage, investor_score, investment_pace_per_year, total_investments, linkedin_url, investment_thesis, updated_at';

/** @type {Map<string, { at: number, payload: unknown[] }>} */
const cache = new Map();
const CACHE_TTL_MS = 120_000;
const LOOSE_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 200;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(key, payload) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { at: Date.now(), payload });
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * GET /api/lookup/top-investors?sector=AI/ML&limit=10
 */
router.get('/top-investors', async (req, res) => {
  const sector = String(req.query.sector || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));

  if (!sector) {
    return res.status(400).json({ error: 'Missing sector query parameter' });
  }

  const cacheKey = `${sector}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({ investors: cached, cached: true });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error('[founderLookup] Supabase client:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_lookup_top_investors', {
      p_sector: sector,
      p_limit: limit,
    });

    let rows = [];
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      rows = rpcData;
    } else {
      if (rpcError) {
        console.warn('[founderLookup] RPC get_lookup_top_investors:', rpcError.message || rpcError);
      }

      let { data: ovData, error: ovError } = await supabase
        .from('investors')
        .select(SELECT_COLS)
        .overlaps('sectors', [sector])
        .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
        .limit(limit);

      // jsonb / non-array overlap can fail PostgREST overlap; try contains for JSON array-of-strings
      if (ovError) {
        console.warn('[founderLookup] overlap failed, trying contains:', ovError.message || ovError);
        const cs = await supabase
          .from('investors')
          .select(SELECT_COLS)
          .contains('sectors', [sector])
          .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
          .limit(limit);
        ovData = cs.data;
        ovError = cs.error;
      }

      if (ovError) {
        console.error('[founderLookup] sector query:', ovError);
        return res.status(500).json({ error: ovError.message || 'Investor query failed' });
      }
      rows = ovData || [];

      if (rows.length === 0) {
        const safe = sector.replace(/[%_]/g, '').trim();
        if (safe.length >= 2) {
          try {
            const looseBuilder = supabase
              .from('investors')
              .select(SELECT_COLS)
              .or(`investment_thesis.ilike.%${safe}%,name.ilike.%${safe}%,firm.ilike.%${safe}%`)
              .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
              .limit(limit);

            const looseResult = await withTimeout(Promise.resolve(looseBuilder), LOOSE_TIMEOUT_MS, 'loose_ilike');
            const { data: looseData, error: looseError } = looseResult;
            if (!looseError && looseData?.length) {
              rows = looseData;
            } else if (looseError) {
              console.warn('[founderLookup] loose query:', looseError.message || looseError);
            }
          } catch (e) {
            console.warn('[founderLookup] loose query skipped:', e.message || e);
          }
        }
      }
    }

    cacheSet(cacheKey, rows);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({ investors: rows, cached: false });
  } catch (e) {
    console.error('[founderLookup] top-investors:', e);
    return res.status(500).json({ error: e.message || 'Lookup failed' });
  }
});

module.exports = router;
