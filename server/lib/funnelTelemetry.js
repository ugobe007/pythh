'use strict';

/** Funnel operations tracked in ai_logs (see product spec founder_supply_seeding). */
const FUNNEL_OPERATIONS = [
  'page_view',
  'pricing_viewed',
  'paywall_shown',
  'url_submitted',
  'preview_requested',
  'instant_matches_viewed',
  'match_viewed',
  'match_intro_requested',
  'match_contacted',
  'login_completed',
  'lookup_signup_completed',
  'checkout_started',
  'checkout_completed',
  'checkout_cancelled',
];

const GROWTH_FUNNEL_EVENTS = [
  'investor_signup_started',
  'investor_signup_completed',
  'founder_signup_started',
  'founder_url_submitted',
  'founder_signup_completed',
];

async function recordFunnelEvent(supabase, operation, output = {}, options = {}) {
  if (!supabase || !operation) return false;
  try {
    const payload = {
      ...(output && typeof output === 'object' ? output : {}),
      source: output?.source || options.source || 'server',
    };
    const { error } = await supabase.from('ai_logs').insert({
      operation,
      status: options.status || 'success',
      output: payload,
    });
    return !error;
  } catch {
    return false;
  }
}

async function logInstantSubmitFunnel(supabase, { startupId, url, matchCount, source, probeRunId }) {
  const base = {
    startup_id: startupId,
    startup_url: url || null,
    match_count: matchCount ?? 0,
    source: source || 'instant_submit',
  };
  if (probeRunId) base.probe_run_id = probeRunId;
  await recordFunnelEvent(supabase, 'url_submitted', base, { source: base.source });
  await recordFunnelEvent(supabase, 'preview_requested', base, { source: base.source });
}

async function logPreviewLoaded(supabase, { startupId, source, probeRunId, matchCount }) {
  const base = {
    startup_id: startupId,
    match_count: matchCount ?? 0,
    source: source || 'preview_api',
  };
  if (probeRunId) base.probe_run_id = probeRunId;
  await recordFunnelEvent(supabase, 'preview_requested', base, { source: base.source });
}

async function getFunnelCounts(supabase, { days = 7 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const ai_logs = Object.fromEntries(FUNNEL_OPERATIONS.map((op) => [op, 0]));

  const { data: rows, error } = await supabase
    .from('ai_logs')
    .select('operation')
    .gte('created_at', since)
    .in('operation', FUNNEL_OPERATIONS)
    .limit(10000);

  if (!error) {
    for (const row of rows || []) {
      ai_logs[row.operation] = (ai_logs[row.operation] || 0) + 1;
    }
  }

  const growth_events = Object.fromEntries(GROWTH_FUNNEL_EVENTS.map((e) => [e, 0]));
  const { data: growthRows, error: gErr } = await supabase
    .from('growth_experiment_events')
    .select('event_name')
    .gte('created_at', since)
    .in('event_name', GROWTH_FUNNEL_EVENTS)
    .limit(5000);

  if (!gErr) {
    for (const row of growthRows || []) {
      growth_events[row.event_name] = (growth_events[row.event_name] || 0) + 1;
    }
  }

  const aiTotal = Object.values(ai_logs).reduce((s, n) => s + n, 0);
  const growthTotal = Object.values(growth_events).reduce((s, n) => s + n, 0);

  return {
    window_days: days,
    since,
    ai_logs,
    growth_events,
    totals: { ai_logs: aiTotal, growth_events: growthTotal },
    funnel_blind: aiTotal === 0 && growthTotal === 0,
  };
}

async function verifyProbeRun(supabase, probeRunId, { sinceMinutes = 15 } = {}) {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const stages = [
    { id: 'page_view', store: 'ai_logs', operation: 'page_view' },
    { id: 'url_submitted', store: 'ai_logs', operation: 'url_submitted' },
    { id: 'preview_requested', store: 'ai_logs', operation: 'preview_requested' },
    { id: 'instant_matches_viewed', store: 'ai_logs', operation: 'instant_matches_viewed' },
    { id: 'match_viewed', store: 'ai_logs', operation: 'match_viewed' },
    { id: 'investor_signup_started', store: 'growth', event_name: 'investor_signup_started' },
  ];

  const { data: aiRows, error: aiErr } = await supabase
    .from('ai_logs')
    .select('operation, output, created_at')
    .gte('created_at', since)
    .in(
      'operation',
      stages.filter((s) => s.store === 'ai_logs').map((s) => s.operation),
    )
    .limit(500);

  const { data: growthRows, error: gErr } = await supabase
    .from('growth_experiment_events')
    .select('event_name, payload, created_at')
    .gte('created_at', since)
    .eq('event_name', 'investor_signup_started')
    .limit(100);

  const probeAi = (aiRows || []).filter((r) => {
    const out = r.output && typeof r.output === 'object' ? r.output : {};
    if (out.probe_run_id === probeRunId) return true;
    if (out.source === 'funnel_probe') return true;
    return false;
  });
  const probeGrowth = (growthRows || []).filter(
    (r) => r.payload && typeof r.payload === 'object' && r.payload.probe_run_id === probeRunId,
  );

  const results = stages.map((stage) => {
    if (stage.store === 'growth') {
      const hit = probeGrowth.some((r) => r.event_name === stage.event_name);
      return { ...stage, logged: hit, count: hit ? 1 : 0 };
    }
    const hits = probeAi.filter((r) => r.operation === stage.operation);
    return { ...stage, logged: hits.length > 0, count: hits.length };
  });

  const loggedCount = results.filter((r) => r.logged).length;
  const required = ['url_submitted', 'preview_requested', 'instant_matches_viewed', 'match_viewed'];
  const requiredOk = required.every((id) => results.find((r) => r.id === id)?.logged);

  let diagnosis = 'healthy';
  if (loggedCount === 0) diagnosis = 'logging_gap_total';
  else if (!requiredOk) diagnosis = 'logging_gap_partial';
  else if (loggedCount < stages.length) diagnosis = 'logging_gap_minor';

  return {
    probe_run_id: probeRunId,
    since,
    stages: results,
    stages_logged: loggedCount,
    stages_total: stages.length,
    required_stages_ok: requiredOk,
    diagnosis,
    query_errors: [aiErr?.message, gErr?.message].filter(Boolean),
  };
}

function latestHeartbeatReport(reportsDir) {
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    if (!fs.existsSync(reportsDir)) return null;
    const files = fs
      .readdirSync(reportsDir)
      .filter((f) => f.startsWith('funnel-heartbeat-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (!files[0]) return null;
    return JSON.parse(fs.readFileSync(path.join(reportsDir, files[0]), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  FUNNEL_OPERATIONS,
  GROWTH_FUNNEL_EVENTS,
  recordFunnelEvent,
  logInstantSubmitFunnel,
  logPreviewLoaded,
  getFunnelCounts,
  verifyProbeRun,
  latestHeartbeatReport,
};
