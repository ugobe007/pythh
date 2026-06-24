'use strict';

/**
 * Admin junk startup scan + cleanup (uses shared name gate heuristics).
 *
 * GET  /api/admin/junk-startups/scan?status=pending|approved|all&limit=3000
 * POST /api/admin/junk-startups/apply  { ids, action: 'reject'|'delete' }
 */

const express = require('express');
const { evaluateStartupNameForPipeline } = require('../../lib/startupNameGate');
const { getSupabaseClient } = require('../lib/supabaseClient');
const { deleteStartupDependents } = require('../lib/deleteStartupDependents');

const router = express.Router();

function getSupabase() {
  return getSupabaseClient();
}

function classifyRow(row) {
  if (String(row.entity_gate || '').toLowerCase() === 'junk') {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      total_god_score: row.total_god_score,
      entity_gate: row.entity_gate,
      created_at: row.created_at,
      junk_reason: row.entity_gate_reason || 'entity_gate_junk',
      source: 'entity_gate',
    };
  }
  const evalResult = evaluateStartupNameForPipeline(row.name);
  if (!evalResult.ok) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      total_god_score: row.total_god_score,
      entity_gate: row.entity_gate,
      created_at: row.created_at,
      junk_reason: evalResult.reason,
      source: 'name_gate',
    };
  }
  return null;
}

router.get('/junk-startups/scan', async (req, res) => {
  try {
    const supabase = getSupabase();
    const status = String(req.query.status || 'active').toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 3000, 10000);
    const PAGE = 500;
    const rows = [];
    let from = 0;

    while (rows.length < limit) {
      let query = supabase
        .from('startup_uploads')
        .select('id,name,status,total_god_score,entity_gate,entity_gate_reason,created_at')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);

      if (status === 'pending') query = query.eq('status', 'pending');
      else if (status === 'approved') query = query.eq('status', 'approved');
      else if (status === 'active') query = query.in('status', ['pending', 'approved']);
      else if (status !== 'all') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const scanned = rows.slice(0, limit);
    const junk = scanned.map(classifyRow).filter(Boolean);
    junk.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const byReason = {};
    for (const j of junk) {
      const key = j.junk_reason || 'unknown';
      byReason[key] = (byReason[key] || 0) + 1;
    }

    res.json({
      scanned: scanned.length,
      junk_count: junk.length,
      by_reason: byReason,
      rows: junk,
    });
  } catch (err) {
    console.error('[GET /api/admin/junk-startups/scan]', err);
    res.status(500).json({ error: err.message || 'scan failed' });
  }
});

router.post('/junk-startups/apply', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { ids, action = 'reject' } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    if (!['reject', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'action must be reject or delete' });
    }

    const uniqueIds = [...new Set(ids.map(String))].slice(0, 500);
    const now = new Date().toISOString();
    let affected = 0;

    if (action === 'reject') {
      const BATCH = 100;
      for (let i = 0; i < uniqueIds.length; i += BATCH) {
        const batch = uniqueIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from('startup_uploads')
          .update({
            status: 'rejected',
            entity_gate: 'junk',
            entity_gate_reason: 'admin_junk_cleanup',
            entity_gate_at: now,
            admin_notes: 'Rejected via admin junk startup cleanup',
            reviewed_at: now,
          })
          .in('id', batch)
          .select('id');
        if (error) throw error;
        affected += data?.length || 0;
      }
    } else {
      const BATCH = 100;
      for (let i = 0; i < uniqueIds.length; i += BATCH) {
        const batch = uniqueIds.slice(i, i + BATCH);
        const deps = await deleteStartupDependents(supabase, batch);
        if (!deps.ok) {
          const msg = deps.failed.map((f) => `${f.table}: ${f.error}`).join('; ');
          throw new Error(`Failed to remove dependent rows: ${msg}`);
        }
        const { data, error } = await supabase
          .from('startup_uploads')
          .delete()
          .in('id', batch)
          .select('id');
        if (error) throw error;
        affected += data?.length || 0;
      }
    }

    try {
      await supabase.from('admin_actions_log').insert({
        action_type: action === 'delete' ? 'junk_startup_delete' : 'junk_startup_reject',
        details: { count: affected, ids: uniqueIds.slice(0, 50) },
        created_at: now,
      });
    } catch {
      /* optional table */
    }

    res.json({ ok: true, action, affected, requested: uniqueIds.length });
  } catch (err) {
    console.error('[POST /api/admin/junk-startups/apply]', err);
    res.status(500).json({ error: err.message || 'apply failed' });
  }
});

module.exports = router;
