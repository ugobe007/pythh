/**
 * Growth experiment API — variant assignment + event tracking.
 */

const express = require('express');
const {
  assignVariant,
  recordEvent,
  syncRegistryToDb,
  getMetricsSnapshot,
} = require('../lib/growthExperiments');

module.exports = function growthRouter(getSupabaseClient) {
  const router = express.Router();

  router.get('/assign', async (req, res) => {
    try {
      const audience = req.query.audience;
      if (!['founder', 'investor'].includes(audience)) {
        return res.status(400).json({ error: 'audience must be founder or investor' });
      }
      const anonId = req.query.anon_id || req.headers['x-pyth-anon-id'] || null;
      const experimentId = req.query.experiment_id || null;
      const supabase = getSupabaseClient();
      const assignment = await assignVariant(supabase, { audience, anonId, experimentId });
      if (!assignment) {
        return res.status(404).json({ error: 'no_running_experiment' });
      }
      res.set('Cache-Control', 'private, no-store');
      return res.json({ success: true, assignment });
    } catch (err) {
      console.error('[growth/assign]', err.message);
      return res.status(500).json({ error: 'assign_failed', message: err.message });
    }
  });

  router.post('/event', async (req, res) => {
    try {
      const {
        experiment_id,
        variant_key,
        audience,
        event_name,
        anon_id,
        session_id,
        payload,
      } = req.body || {};
      if (!experiment_id || !variant_key || !audience || !event_name) {
        return res.status(400).json({ error: 'missing required fields' });
      }
      const supabase = getSupabaseClient();
      await recordEvent(supabase, {
        experiment_id,
        variant_key,
        audience,
        event_name,
        anon_id,
        session_id,
        payload,
      });
      return res.json({ success: true });
    } catch (err) {
      console.error('[growth/event]', err.message);
      return res.status(500).json({ error: 'event_failed', message: err.message });
    }
  });

  router.get('/metrics', async (req, res) => {
    try {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
      const supabase = getSupabaseClient();
      const metrics = await getMetricsSnapshot(supabase, { days });
      return res.json({ success: true, metrics });
    } catch (err) {
      console.error('[growth/metrics]', err.message);
      return res.status(500).json({ error: 'metrics_failed', message: err.message });
    }
  });

  router.post('/sync-registry', async (req, res) => {
    try {
      const supabase = getSupabaseClient();
      const result = await syncRegistryToDb(supabase);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('[growth/sync-registry]', err.message);
      return res.status(500).json({ error: 'sync_failed', message: err.message });
    }
  });

  return router;
};
