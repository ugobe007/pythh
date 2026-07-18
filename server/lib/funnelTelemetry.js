'use strict';

const { recordFounderDemandEvent } = require('./founderDemandEvents');

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
  'intro_concierge_requested',
  'match_contacted',
  'login_completed',
  'lookup_signup_completed',
  'checkout_started',
  'checkout_completed',
  'checkout_cancelled',
  'preview_email_captured',
  'preview_delta_teaser_viewed',
  'preview_oracle_gap_teaser_viewed',
  'preview_evidence_strip_viewed',
  'match_explain_viewed',
  'pricing_strip_viewed',
  'founder_activation_email_sent',
  'wizard_outreach_preview_viewed',
  /** Oracle-centric raise funnel (see docs/PYTHH_VISION.md) */
  'raise_plan_viewed',
  'raise_plan_authorized',
  'outreach_authorized',
  'meeting_request_ready',
  'meeting_approved',
  'meeting_scheduled',
  'meeting_brief_viewed',
  'investor_portfolio_delta_sent',
  'investor_dealflow_digest_sent',
  'investor_portfolio_pick_added',
  'investor_portfolio_cap_reached',
  'investor_portfolio_exported',
  'investor_profile_resume_started',
  'investor_email_captured',
  'investor_profile_completed',
  'return_visit_7d',
  /** Server-side preview API response — not a human UI render (see logPreviewLoaded). */
  'preview_api_served',
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

/** Sources where instant/submit is followed by a user-visible preview (not API-only traffic). */
const UI_PREVIEW_SOURCES = new Set([
  'matches_preview',
  'activate',
  'find_investors_landing',
  'awareness_landing',
  'home_hero',
  'share_preview',
  'hero',
  'funnel_probe',
]);

/** Browser / landing-page URL submits — exclude programmatic instant_submit noise. */
const HUMAN_URL_SOURCES = new Set([
  'home_hero',
  'find_investors_landing',
  'matches_preview',
  'matches_landing',
  'awareness_landing',
  'share_preview',
  'hero',
  'activate',
  'url_first',
  'wizard',
]);

const SYNTHETIC_URL_SOURCES = new Set(['instant_submit', 'preview_api', 'funnel_probe', 'server']);

/** UI-only instant_matches_viewed (exclude server preview_api emissions). */
const UI_INSTANT_MATCHES_SOURCES = [...UI_PREVIEW_SOURCES].filter((s) => s !== 'funnel_probe');

async function hasRecentFunnelEvent(supabase, operation, startupId, { windowMinutes = 60 } = {}) {
  if (!supabase || !startupId || !operation) return false;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await supabase
    .from('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('operation', operation)
    .eq('output->>startup_id', String(startupId))
    .gte('created_at', since)
    .not('output->>source', 'eq', 'funnel_probe')
    .is('output->probe_run_id', null);
  if (error) return false;
  return (count ?? 0) > 0;
}

async function logInstantSubmitFunnel(
  supabase,
  { startupId, url, matchCount, source, probeRunId, startupName, sectors, stage, godScore, utm = {} },
) {
  const base = {
    startup_id: startupId,
    startup_url: url || null,
    match_count: matchCount ?? 0,
    source: source || 'instant_submit',
    ...(utm && typeof utm === 'object' ? utm : {}),
  };
  if (probeRunId) base.probe_run_id = probeRunId;
  await recordFunnelEvent(supabase, 'url_submitted', base, { source: base.source });
  void recordFounderDemandEvent(supabase, {
    eventType: 'url_submitted',
    startupId,
    startupUrl: url,
    startupName,
    sectors,
    stage,
    godScore,
    matchCount,
    source: base.source,
    probeRunId,
    payload: base,
  });

  const src = base.source;
  const isUiPreview =
    UI_PREVIEW_SOURCES.has(src) || (src === 'instant_submit' && Boolean(probeRunId));
  if (isUiPreview && (matchCount ?? 0) > 0) {
    void logPreviewLoaded(supabase, {
      startupId,
      source: src,
      probeRunId,
      matchCount,
      url,
      startupName,
      sectors,
      stage,
      godScore,
    });
  }
}

async function logPreviewLoaded(
  supabase,
  {
    startupId,
    source,
    probeRunId,
    matchCount,
    url,
    startupName,
    sectors,
    stage,
    godScore,
  },
) {
  const base = {
    startup_id: startupId,
    match_count: matchCount ?? 0,
    source: source || 'preview_api',
  };
  if (probeRunId) base.probe_run_id = probeRunId;
  if (url) base.startup_url = url;

  const dupPreview =
    startupId &&
    (await hasRecentFunnelEvent(supabase, 'instant_matches_viewed', startupId));
  if (dupPreview) return;

  await recordFunnelEvent(supabase, 'preview_requested', base, { source: base.source });
  const uiPreviewSource = UI_PREVIEW_SOURCES.has(base.source) && base.source !== 'funnel_probe';
  if (uiPreviewSource) {
    await recordFunnelEvent(supabase, 'instant_matches_viewed', base, { source: base.source });
  } else if (!probeRunId) {
    await recordFunnelEvent(supabase, 'preview_api_served', base, { source: base.source || 'preview_api' });
  }
  void recordFounderDemandEvent(supabase, {
    eventType: 'preview_requested',
    startupId,
    startupUrl: url,
    startupName,
    sectors,
    stage,
    godScore,
    matchCount,
    source: base.source,
    probeRunId,
    payload: base,
  });
}

async function countAiLogOperation(supabase, operation, since, { excludeProbes = true } = {}) {
  if (!supabase || !operation) return 0;
  let query = supabase
    .from('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('operation', operation)
    .gte('created_at', since);
  if (excludeProbes) {
    // Include rows with missing source (legacy client events) — .neq alone drops NULL in PostgREST.
    query = query.or('output->>source.is.null,output->>source.neq.funnel_probe');
    query = query.is('output->probe_run_id', null);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function countAiLogBySources(supabase, operation, since, sources, { excludeProbes = true } = {}) {
  if (!supabase || !operation || !sources?.length) return 0;
  let query = supabase
    .from('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('operation', operation)
    .gte('created_at', since)
    .in('output->>source', sources);
  if (excludeProbes) {
    query = query.is('output->probe_run_id', null);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function countHumanUrlSubmitted(supabase, since, { excludeProbes = true } = {}) {
  return countAiLogBySources(supabase, 'url_submitted', since, [...HUMAN_URL_SOURCES], { excludeProbes });
}

async function countUiInstantMatchesViewed(supabase, since, { excludeProbes = true } = {}) {
  const uiCount = await countAiLogBySources(
    supabase,
    'instant_matches_viewed',
    since,
    UI_INSTANT_MATCHES_SOURCES,
    { excludeProbes },
  );
  if (uiCount > 0) return uiCount;
  // Legacy rows may lack source — count only if not preview_api
  if (!supabase) return 0;
  let query = supabase
    .from('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('operation', 'instant_matches_viewed')
    .gte('created_at', since)
    .is('output->>source', null);
  if (excludeProbes) {
    query = query.is('output->probe_run_id', null);
  }
  const { count, error } = await query;
  if (error) return uiCount;
  return uiCount + (count ?? 0);
}

async function countGrowthFunnelEvent(supabase, eventName, since, { excludeProbes = true } = {}) {
  if (!supabase || !eventName) return 0;
  let query = supabase
    .from('growth_experiment_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', eventName)
    .gte('created_at', since);
  if (excludeProbes) {
    query = query.is('payload->probe_run_id', null);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function getFunnelCounts(supabase, { days = 7, excludeProbes = true } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { countFounderDemandEvents } = require('./founderDemandEvents');

  const aiCounts = await Promise.all(
    FUNNEL_OPERATIONS.map(async (op) => [op, await countAiLogOperation(supabase, op, since, { excludeProbes })]),
  );
  const ai_logs = Object.fromEntries(aiCounts);

  const growthCounts = await Promise.all(
    GROWTH_FUNNEL_EVENTS.map(async (e) => [
      e,
      await countGrowthFunnelEvent(supabase, e, since, { excludeProbes }),
    ]),
  );
  const growth_events = Object.fromEntries(growthCounts);

  const founderUrlGrowth = growth_events.founder_url_submitted || 0;
  const demandUrlCount = await countFounderDemandEvents(supabase, {
    days,
    eventType: 'url_submitted',
    excludeProbes,
  }).catch(() => 0);

  const aiUrlOnly = ai_logs.url_submitted || 0;
  ai_logs.url_submitted_ai_logs_only = aiUrlOnly;
  ai_logs.founder_url_submitted_growth = founderUrlGrowth;
  ai_logs.founder_demand_url_submitted = demandUrlCount;
  ai_logs.url_submitted = Math.max(demandUrlCount, aiUrlOnly + founderUrlGrowth);

  const humanUrlSubmitted = await countHumanUrlSubmitted(supabase, since, { excludeProbes });
  const uiInstantMatchesViewed = await countUiInstantMatchesViewed(supabase, since, { excludeProbes });
  const previewApiServed = ai_logs.preview_api_served || 0;

  const aiTotal = Object.values(ai_logs).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
  const growthTotal = Object.values(growth_events).reduce((s, n) => s + n, 0);

  const human_funnel = {
    page_view: ai_logs.page_view || 0,
    url_submitted: humanUrlSubmitted,
    instant_matches_viewed: uiInstantMatchesViewed,
    preview_api_served: previewApiServed,
    synthetic_url_submitted: Math.max(0, (ai_logs.url_submitted_ai_logs_only || 0) - humanUrlSubmitted),
  };

  return {
    window_days: days,
    since,
    ai_logs,
    growth_events,
    human_funnel,
    totals: { ai_logs: aiTotal, growth_events: growthTotal },
    funnel_blind: aiTotal === 0 && growthTotal === 0,
    rates: {
      founder_preview_to_started:
        uiInstantMatchesViewed > 0
          ? Math.round((growth_events.founder_signup_started / uiInstantMatchesViewed) * 1000) / 10
          : null,
      founder_started_to_completed:
        growth_events.founder_signup_started > 0
          ? Math.round((growth_events.founder_signup_completed / growth_events.founder_signup_started) * 1000) / 10
          : null,
      human_preview_per_page_view:
        human_funnel.page_view > 0
          ? Math.round((uiInstantMatchesViewed / human_funnel.page_view) * 1000) / 10
          : null,
      human_preview_per_url:
        humanUrlSubmitted > 0
          ? Math.round((uiInstantMatchesViewed / humanUrlSubmitted) * 1000) / 10
          : null,
    },
  };
}

async function verifyProbeRun(supabase, probeRunId, { sinceMinutes = 15 } = {}) {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const stages = [
    { id: 'page_view', store: 'ai_logs', operation: 'page_view', required: false },
    { id: 'url_submitted', store: 'ai_logs', operation: 'url_submitted', required: true },
    { id: 'preview_requested', store: 'ai_logs', operation: 'preview_requested', required: true },
    { id: 'instant_matches_viewed', store: 'ai_logs', operation: 'instant_matches_viewed', required: true },
    { id: 'match_viewed', store: 'ai_logs', operation: 'match_viewed', required: true },
    { id: 'match_intro_requested', store: 'ai_logs', operation: 'match_intro_requested', required: false },
    { id: 'investor_signup_started', store: 'growth', event_name: 'investor_signup_started', required: false },
    { id: 'founder_signup_started', store: 'growth', event_name: 'founder_signup_started', required: false },
    { id: 'founder_signup_completed', store: 'growth', event_name: 'founder_signup_completed', required: false },
    { id: 'lookup_signup_completed', store: 'ai_logs', operation: 'lookup_signup_completed', required: false },
    { id: 'pricing_viewed', store: 'ai_logs', operation: 'pricing_viewed', required: false },
    { id: 'checkout_started', store: 'ai_logs', operation: 'checkout_started', required: false },
    { id: 'checkout_completed', store: 'ai_logs', operation: 'checkout_completed', required: false },
    { id: 'preview_email_captured', store: 'ai_logs', operation: 'preview_email_captured', required: false },
    { id: 'preview_oracle_gap_teaser_viewed', store: 'ai_logs', operation: 'preview_oracle_gap_teaser_viewed', required: false },
    { id: 'return_visit_7d', store: 'ai_logs', operation: 'return_visit_7d', optional: true },
    { id: 'founder_activation_email_sent', store: 'ai_logs', operation: 'founder_activation_email_sent', optional: true },
    { id: 'wizard_outreach_preview_viewed', store: 'ai_logs', operation: 'wizard_outreach_preview_viewed', optional: true },
    { id: 'wizard_unlock_flow_started', store: 'ai_logs', operation: 'wizard_unlock_flow_started', required: true },
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
    .in('event_name', ['investor_signup_started', 'founder_signup_started', 'founder_signup_completed'])
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
  const required = stages.filter((s) => s.required).map((s) => s.id);
  const requiredOk = required.every((id) => results.find((r) => r.id === id)?.logged);
  const optionalStages = stages.filter((s) => s.optional);
  const optionalMissing = optionalStages.filter((s) => !results.find((r) => r.id === s.id)?.logged);

  let diagnosis = 'healthy';
  if (loggedCount === 0) diagnosis = 'probe_failed';
  else if (!requiredOk) diagnosis = 'logging_gap_partial';
  else if (optionalMissing.length > 0) diagnosis = 'healthy';

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
      .filter(
        (f) =>
          /^funnel-heartbeat-\d{4}-\d{2}-\d{2}\.json$/.test(f) ||
          (f.startsWith('funnel-heartbeat-') && f.endsWith('.json') && f !== 'funnel-heartbeat-run.json'),
      );
    const reports = files
      .map((f) => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(reportsDir, f), 'utf8'));
          return { file: f, data };
        } catch {
          return null;
        }
      })
      .filter((r) => r?.data?.generated_at || r?.data?.timestamp)
      .sort((a, b) => {
        const ta = a.data.generated_at || a.data.timestamp;
        const tb = b.data.generated_at || b.data.timestamp;
        return String(tb).localeCompare(String(ta));
      });
    return reports[0]?.data ?? null;
  } catch {
    return null;
  }
}

module.exports = {
  FUNNEL_OPERATIONS,
  GROWTH_FUNNEL_EVENTS,
  UI_PREVIEW_SOURCES,
  HUMAN_URL_SOURCES,
  SYNTHETIC_URL_SOURCES,
  recordFunnelEvent,
  logInstantSubmitFunnel,
  logPreviewLoaded,
  getFunnelCounts,
  countUiInstantMatchesViewed,
  countHumanUrlSubmitted,
  verifyProbeRun,
  latestHeartbeatReport,
};
