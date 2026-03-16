/**
 * INVESTOR LOOKUP API
 * ===================
 * Search PYTHH startups and manage curated lists for VCs.
 * - GET  /search          - search/filter startups (no auth)
 * - GET  /thesis/:id      - search pre-filled by investor thesis (no auth)
 * - GET  /lists          - list my curated lists (owner_id via header or body)
 * - POST /lists           - create list
 * - GET  /lists/:id       - get list with startup details
 * - POST /lists/:id/items - add startup to list
 * - DELETE /lists/:id/items/:startupId - remove from list
 * - DELETE /lists/:id     - delete list
 */

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');
const {
  searchStartups,
  getThesisCriteria,
} = require('../services/investorLookupService');

function getOwnerId(req) {
  return (
    req.headers['x-investor-session'] ||
    req.headers['x-session-id'] ||
    req.body?.owner_id ||
    req.query?.owner_id ||
    null
  );
}

// GET /api/investor-lookup/search
router.get('/search', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const q = req.query.q;
    const sectors = req.query.sectors
      ? (Array.isArray(req.query.sectors) ? req.query.sectors : req.query.sectors.split(',').map((s) => s.trim()))
      : undefined;
    const stage = req.query.stage;
    const minScore = req.query.minScore ?? req.query.min_score;
    const maxScore = req.query.maxScore ?? req.query.max_score;
    const limit = req.query.limit;
    const offset = req.query.offset;

    const result = await searchStartups(supabase, {
      q,
      sectors,
      stage,
      minScore,
      maxScore,
      limit,
      offset,
    });

    res.json({
      ok: true,
      data: result.rows,
      meta: {
        total: result.total,
        hasMore: result.hasMore,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (err) {
    console.error('[investor-lookup] search error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Search failed' });
  }
});

// GET /api/investor-lookup/thesis/:investorId — search with investor's thesis (sectors + stage)
router.get('/thesis/:investorId', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { investorId } = req.params;
    const criteria = await getThesisCriteria(supabase, investorId);

    if (!criteria) {
      return res.status(404).json({ ok: false, error: 'Investor not found' });
    }

    const limit = req.query.limit;
    const offset = req.query.offset;
    const minScore = req.query.minScore ?? req.query.min_score;

    const result = await searchStartups(supabase, {
      sectors: criteria.sectors.length > 0 ? criteria.sectors : undefined,
      stage: criteria.stage,
      minScore: minScore ?? 50,
      limit,
      offset,
    });

    res.json({
      ok: true,
      data: result.rows,
      meta: {
        total: result.total,
        hasMore: result.hasMore,
        limit: result.limit,
        offset: result.offset,
        thesis: {
          sectors: criteria.sectors,
          stage: criteria.stage,
        },
      },
    });
  } catch (err) {
    console.error('[investor-lookup] thesis search error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Thesis search failed' });
  }
});

// GET /api/investor-lookup/lists — list curated lists for owner
router.get('/lists', async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing owner id. Send X-Investor-Session or X-Session-Id header, or owner_id in query/body.',
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('investor_curated_lists')
      .select('id, name, created_at, updated_at')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json({ ok: true, data: data || [] });
  } catch (err) {
    console.error('[investor-lookup] list lists error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to list' });
  }
});

// POST /api/investor-lookup/lists — create a new curated list
router.post('/lists', async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    if (!ownerId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing owner id. Send X-Investor-Session or X-Session-Id header, or owner_id in body.',
      });
    }

    const name = req.body?.name || 'My list';
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('investor_curated_lists')
      .insert({ owner_id: ownerId, name })
      .select('id, name, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error('[investor-lookup] create list error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to create list' });
  }
});

// GET /api/investor-lookup/lists/:id — get list with startup details (owner only if owner_id sent)
router.get('/lists/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;
    const ownerId = getOwnerId(req);

    const { data: list, error: listError } = await supabase
      .from('investor_curated_lists')
      .select('id, owner_id, name, created_at, updated_at')
      .eq('id', id)
      .single();

    if (listError || !list) {
      return res.status(404).json({ ok: false, error: 'List not found' });
    }
    if (ownerId && list.owner_id !== ownerId) {
      return res.status(403).json({ ok: false, error: 'Not your list' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('investor_curated_list_items')
      .select('startup_id, added_at, notes')
      .eq('list_id', id)
      .order('added_at', { ascending: false });

    if (itemsError) throw itemsError;

    const startupIds = (items || []).map((i) => i.startup_id);
    let startups = [];
    if (startupIds.length > 0) {
      const { data: su, error: suError } = await supabase
        .from('startup_uploads')
        .select('id, name, tagline, website, sectors, stage_estimate, total_god_score')
        .in('id', startupIds);

      if (!suError && su) {
        const byId = Object.fromEntries(su.map((s) => [s.id, s]));
        startups = startupIds.map((sid) => {
          const item = items.find((i) => i.startup_id === sid);
          const s = byId[sid];
          return {
            startup_id: sid,
            added_at: item?.added_at,
            notes: item?.notes || null,
            name: s?.name,
            tagline: s?.tagline,
            website: s?.website,
            sectors: s?.sectors,
            stage_estimate: s?.stage_estimate,
            total_god_score: s?.total_god_score != null ? Math.round(s.total_god_score) : null,
          };
        });
      }
    }

    res.json({
      ok: true,
      data: {
        ...list,
        items: startups,
        count: startups.length,
      },
    });
  } catch (err) {
    console.error('[investor-lookup] get list error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to get list' });
  }
});

// POST /api/investor-lookup/lists/:id/items — add startup to list
router.post('/lists/:id/items', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id: listId } = req.params;
    const startupId = req.body?.startup_id || req.body?.startupId;

    if (!startupId) {
      return res.status(400).json({ ok: false, error: 'Missing startup_id in body' });
    }

    const { data: list } = await supabase
      .from('investor_curated_lists')
      .select('id')
      .eq('id', listId)
      .single();

    if (!list) {
      return res.status(404).json({ ok: false, error: 'List not found' });
    }

    const { data, error } = await supabase
      .from('investor_curated_list_items')
      .insert({
        list_id: listId,
        startup_id: startupId,
        notes: req.body?.notes || null,
      })
      .select('id, startup_id, added_at, notes')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ ok: false, error: 'Startup already in list' });
      }
      throw error;
    }

    res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error('[investor-lookup] add item error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to add item' });
  }
});

// DELETE /api/investor-lookup/lists/:id/items/:startupId
router.delete('/lists/:id/items/:startupId', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id: listId, startupId } = req.params;

    const { error } = await supabase
      .from('investor_curated_list_items')
      .delete()
      .eq('list_id', listId)
      .eq('startup_id', startupId);

    if (error) throw error;

    res.json({ ok: true, removed: true });
  } catch (err) {
    console.error('[investor-lookup] remove item error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to remove item' });
  }
});

// DELETE /api/investor-lookup/lists/:id
router.delete('/lists/:id', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { id } = req.params;

    const { error } = await supabase
      .from('investor_curated_lists')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('[investor-lookup] delete list error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to delete list' });
  }
});

module.exports = router;
