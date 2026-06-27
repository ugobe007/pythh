'use strict';

/**
 * Persist founder demand-side events (preview / URL submit) for digest + research corpus.
 * Complements ai_logs funnel ops — queryable inventory for agents.
 */

async function recordFounderDemandEvent(supabase, fields = {}) {
  if (!supabase) return { ok: false, error: 'no_supabase' };
  try {
    const row = {
      event_type: fields.eventType || fields.event_type || 'preview_requested',
      startup_id: fields.startupId || fields.startup_id || null,
      startup_url: fields.startupUrl || fields.startup_url || null,
      startup_name: fields.startupName || fields.startup_name || null,
      sectors: fields.sectors ?? null,
      stage: fields.stage ?? null,
      god_score:
        fields.godScore != null
          ? Math.round(Number(fields.godScore))
          : fields.god_score != null
            ? Math.round(Number(fields.god_score))
            : null,
      match_count: fields.matchCount ?? fields.match_count ?? null,
      source: fields.source || 'preview_api',
      probe_run_id: fields.probeRunId || fields.probe_run_id || null,
      payload: fields.payload && typeof fields.payload === 'object' ? fields.payload : {},
    };

    const { error } = await supabase.from('founder_demand_events').insert(row);
    if (error) {
      console.warn('[founderDemandEvents] insert failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[founderDemandEvents] insert error:', err.message);
    return { ok: false, error: err.message };
  }
}

async function countFounderDemandEvents(supabase, { days = 7, eventType = null, excludeProbes = true } = {}) {
  if (!supabase) return 0;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  let query = supabase
    .from('founder_demand_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);
  if (eventType) query = query.eq('event_type', eventType);
  if (excludeProbes) query = query.is('probe_run_id', null);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

module.exports = {
  recordFounderDemandEvent,
  countFounderDemandEvents,
};
