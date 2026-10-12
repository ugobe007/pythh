'use strict';

/**
 * Admin entity-gate backlog drain.
 *
 * POST /api/admin/entity-gate/classify-unset
 *   Body: { limit?: number }  — max rows to classify this call (default 2000, max 5000)
 *
 * Classifies approved startup_uploads where entity_gate IS NULL using the same
 * classifyStartup() contract as scripts/entity-resolution-gate.js --unset-only.
 * Designed for repeated UI / cron calls (each request stays under Fly timeouts).
 */

const express = require('express');
const { classifyStartup } = require('../../lib/entityResolutionGate');
const { getSupabaseClient } = require('../lib/supabaseClient');

const router = express.Router();

const PAGE = 500;
const BATCH = 150;
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;

async function patchIds(supabase, ids, payload) {
  let n = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error } = await supabase.from('startup_uploads').update(payload).in('id', chunk);
    if (error) throw error;
    n += chunk.length;
  }
  return n;
}

function bucketByClassification(rows) {
  const m = new Map();
  for (const row of rows) {
    const { gate, reason } = classifyStartup(row);
    const key = JSON.stringify({ gate, reason: reason || null });
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(row.id);
  }
  return m;
}

router.post('/entity-gate/classify-unset', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const limit = Math.min(
      Math.max(parseInt(req.body?.limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const now = new Date().toISOString();
    const counts = { junk: 0, needs_url: 0, qualified: 0 };
    let updated = 0;
    let fetched = 0;

    while (fetched < limit) {
      const take = Math.min(PAGE, limit - fetched);
      // Always offset 0 — updates remove rows from the unset filter.
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('id, name, website, company_website, entity_gate, enrichment_attempts')
        .eq('status', 'approved')
        .is('entity_gate', null)
        .order('id', { ascending: true })
        .range(0, take - 1);
      if (error) throw error;
      if (!data?.length) break;

      fetched += data.length;
      for (const row of data) {
        counts[classifyStartup(row).gate] += 1;
      }

      const buckets = bucketByClassification(data);
      for (const [key, ids] of buckets) {
        const { gate, reason } = JSON.parse(key);
        updated += await patchIds(supabase, ids, {
          entity_gate: gate,
          entity_gate_reason: reason,
          entity_gate_at: now,
        });
      }

      if (data.length < take) break;
    }

    const { count: remainingUnset, error: countErr } = await supabase
      .from('startup_uploads')
      .select('id', { count: 'exact', head: true })
      .is('entity_gate', null);
    if (countErr) throw countErr;

    try {
      await supabase.from('admin_actions_log').insert({
        action_type: 'entity_gate_classify_unset',
        details: { updated, fetched, counts, remaining_unset: remainingUnset ?? null },
        created_at: now,
      });
    } catch {
      /* optional */
    }

    res.json({
      ok: true,
      updated,
      fetched,
      counts,
      remaining_unset: remainingUnset ?? null,
      done: (remainingUnset ?? 0) === 0 || fetched < limit,
    });
  } catch (err) {
    console.error('[POST /api/admin/entity-gate/classify-unset]', err);
    res.status(500).json({ error: err.message || 'classify failed' });
  }
});

router.get('/entity-gate/stats', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const gates = ['qualified', 'needs_url', 'junk', 'review', 'url_blocked'];
    const [unsetRes, ...gateRes] = await Promise.all([
      supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).is('entity_gate', null),
      ...gates.map((g) =>
        supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('entity_gate', g),
      ),
    ]);
    if (unsetRes.error) throw unsetRes.error;
    const stats = [
      { gate: 'unset', cnt: unsetRes.count ?? 0 },
      ...gates.map((g, i) => {
        if (gateRes[i].error) throw gateRes[i].error;
        return { gate: g, cnt: gateRes[i].count ?? 0 };
      }),
    ].filter((r) => r.cnt > 0);
    res.json({ stats });
  } catch (err) {
    console.error('[GET /api/admin/entity-gate/stats]', err);
    res.status(500).json({ error: err.message || 'stats failed' });
  }
});

module.exports = router;
