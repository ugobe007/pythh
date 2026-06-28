/**
 * Growth experiments — variant assignment + registry sync.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REGISTRY_PATH = path.join(__dirname, '../../agents/growth/experiment-registry.json');

function loadRegistry() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 0, experiments: [] };
    throw err;
  }
}

function hashToUnit(str) {
  const h = crypto.createHash('sha256').update(str).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

/** Deterministic variant pick from anon_id + experiment id. */
function pickVariant(experiment, anonId) {
  const running = (experiment.variants || []).filter((v) => v.traffic_pct > 0);
  if (!running.length) return null;
  const total = running.reduce((s, v) => s + Number(v.traffic_pct), 0);
  let r = hashToUnit(`${anonId}:${experiment.id}`) * total;
  for (const v of running) {
    r -= Number(v.traffic_pct);
    if (r <= 0) return v;
  }
  return running[running.length - 1];
}

async function syncRegistryToDb(supabase) {
  const registry = loadRegistry();
  const rows = [];
  for (const exp of registry.experiments || []) {
    for (const v of exp.variants || []) {
      rows.push({
        experiment_id: exp.id,
        audience: exp.audience,
        name: exp.name,
        variant_key: v.key,
        status: exp.status === 'running' ? 'running' : exp.status || 'draft',
        traffic_pct: Number(v.traffic_pct) || 0,
        schema: v.schema || {},
        copy: v.copy || {},
        hypothesis: exp.hypothesis || null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (!rows.length) return { synced: 0 };
  const { error } = await supabase
    .from('growth_experiments')
    .upsert(rows, { onConflict: 'experiment_id,variant_key' });
  if (error) throw error;
  return { synced: rows.length };
}

async function assignVariant(supabase, { audience, anonId, experimentId }) {
  const registry = loadRegistry();
  if (!experimentId) {
    experimentId = (registry.experiments || []).find(
      (e) => e.audience === audience && e.status === 'running' && !e.parent_experiment,
    )?.id;
  }

  let query = supabase
    .from('growth_experiments')
    .select('*')
    .eq('audience', audience)
    .eq('status', 'running');
  if (experimentId) query = query.eq('experiment_id', experimentId);

  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) {
    const exp = (registry.experiments || []).find(
      (e) => e.audience === audience && (!experimentId || e.id === experimentId),
    );
    if (!exp) return null;
    const variant = pickVariant(exp, anonId || crypto.randomUUID());
    if (!variant) return null;
    return {
      experiment_id: exp.id,
      variant_key: variant.key,
      audience: exp.audience,
      schema: variant.schema,
      copy: variant.copy,
      source: 'registry',
    };
  }

  const byExperiment = {};
  for (const row of data) {
    if (!byExperiment[row.experiment_id]) {
      byExperiment[row.experiment_id] = { id: row.experiment_id, audience: row.audience, variants: [] };
    }
    byExperiment[row.experiment_id].variants.push({
      key: row.variant_key,
      traffic_pct: Number(row.traffic_pct),
      schema: row.schema,
      copy: row.copy,
    });
  }

  const exp = experimentId ? byExperiment[experimentId] : Object.values(byExperiment)[0];
  if (!exp) return null;
  const variant = pickVariant(exp, anonId || crypto.randomUUID());
  if (!variant) return null;
  return {
    experiment_id: exp.id,
    variant_key: variant.key,
    audience: exp.audience,
    schema: variant.schema,
    copy: variant.copy,
    source: 'db',
  };
}

async function recordEvent(supabase, event) {
  const { error } = await supabase.from('growth_experiment_events').insert({
    experiment_id: event.experiment_id,
    variant_key: event.variant_key,
    audience: event.audience,
    anon_id: event.anon_id || null,
    session_id: event.session_id || null,
    event_name: event.event_name,
    payload: event.payload || {},
  });
  if (error) throw error;
}

const {
  GROWTH_FUNNEL_EVENTS,
  getFunnelCounts,
} = require('./funnelTelemetry');

function isProbeGrowthEvent(event) {
  return Boolean(event?.payload?.probe_run_id);
}

async function getMetricsSnapshot(supabase, { days = 7, excludeProbes = true } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: events, error: evErr } = await supabase
    .from('growth_experiment_events')
    .select('experiment_id, variant_key, audience, event_name, created_at, payload')
    .gte('created_at', since);
  if (evErr) throw evErr;

  const filteredEvents = excludeProbes
    ? (events || []).filter((e) => !isProbeGrowthEvent(e))
    : events || [];

  const funnelCounts = await getFunnelCounts(supabase, { days, excludeProbes });

  const byVariant = {};
  for (const e of filteredEvents) {
    const k = `${e.experiment_id}:${e.variant_key}`;
    if (!byVariant[k]) {
      byVariant[k] = {
        experiment_id: e.experiment_id,
        variant_key: e.variant_key,
        audience: e.audience,
        events: {},
      };
    }
    byVariant[k].events[e.event_name] = (byVariant[k].events[e.event_name] || 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    exclude_probes: excludeProbes,
    funnel_from_ai_logs: funnelCounts.ai_logs,
    growth_funnel_events: GROWTH_FUNNEL_EVENTS.reduce((acc, name) => {
      acc[name] = funnelCounts.growth_events[name] ?? 0;
      return acc;
    }, {}),
    experiment_variants: Object.values(byVariant),
    growth_event_count: filteredEvents.length,
  };
}

module.exports = {
  loadRegistry,
  syncRegistryToDb,
  assignVariant,
  recordEvent,
  getMetricsSnapshot,
  REGISTRY_PATH,
};
