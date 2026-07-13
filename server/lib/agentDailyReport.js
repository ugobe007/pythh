'use strict';

/**
 * Pythh Agent Daily Report — gathers funnel metrics, agent run results, findings,
 * and backlog state for the owner ops email.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getSupabaseClient } = require('./supabaseClient');
const { getFunnelCounts, latestHeartbeatReport } = require('./funnelTelemetry');

const SITE_URL = process.env.APP_BASE_URL || process.env.SITE_URL || 'https://pythh.ai';
const NORTH_STAR_TARGET = 100;

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function latestReport(reportsDir, prefix) {
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files[0] ? readJson(path.join(reportsDir, files[0])) : null;
}

function latestBrief(repoRoot) {
  const dir = path.join(repoRoot, 'agents', 'research', 'briefs');
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('-market-brief.md') && !f.startsWith('_'))
    .sort()
    .reverse();
  if (!files.length) return null;
  const file = path.join(dir, files[0]);
  return { file: files[0], content: fs.readFileSync(file, 'utf8') };
}

function extractBriefHighlight(content) {
  if (!content) return null;
  const oneNumber = content.match(/## The one number[^\n]*\n+([\s\S]*?)(?=\n---|\n## )/);
  if (oneNumber) return oneNumber[1].trim().slice(0, 600);
  const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  return lines.slice(0, 6).join('\n').slice(0, 500);
}

function agentResultText(run) {
  if (!run) return null;
  const r = run.result;
  if (typeof r === 'string') return r.slice(0, 600);
  if (r?.summary) return String(r.summary).slice(0, 600);
  return null;
}

function signupsFromFunnel(funnel) {
  const f = funnel?.ai_logs || {};
  const g = funnel?.growth_events || {};
  const founder =
    (g.founder_signup_completed || 0) +
    (f.lookup_signup_completed || 0) +
    (f.login_completed || 0);
  const investor = g.investor_signup_completed || 0;
  return { founder, investor, total: founder + investor };
}

/** Peter email UTMs: utm_source=peter or known Peter campaign slugs. */
function isPeterAttributed(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.utm_source === 'peter') return true;
  const camp = String(payload.utm_campaign || '');
  return /^peter-founder/i.test(camp) || camp === 'intro_concierge';
}

async function countAiLogPeterUtm(supabase, operation, since) {
  if (!supabase || !operation) return 0;
  const { count, error } = await supabase
    .from('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('operation', operation)
    .eq('output->>utm_source', 'peter')
    .gte('created_at', since)
    .is('output->probe_run_id', null);
  if (error) return 0;
  return count ?? 0;
}

async function countGrowthPeterUtm(supabase, eventName, since) {
  if (!supabase || !eventName) return 0;
  const { data, error } = await supabase
    .from('growth_experiment_events')
    .select('payload')
    .eq('event_name', eventName)
    .gte('created_at', since)
    .is('payload->probe_run_id', null)
    .limit(5000);
  if (error) return 0;
  return (data || []).filter((r) => isPeterAttributed(r.payload)).length;
}

async function peterCampaignBreakdown(supabase, since) {
  const buckets = {};
  const bump = (campaign, field) => {
    const key = campaign || 'peter-unknown';
    buckets[key] = buckets[key] || { url_submitted: 0, signups: 0 };
    buckets[key][field] += 1;
  };

  const { data: urlRows } = await supabase
    .from('ai_logs')
    .select('output')
    .eq('operation', 'url_submitted')
    .eq('output->>utm_source', 'peter')
    .gte('created_at', since)
    .is('output->probe_run_id', null)
    .limit(5000);

  for (const row of urlRows || []) {
    bump(row.output?.utm_campaign, 'url_submitted');
  }

  const { data: signupRows } = await supabase
    .from('growth_experiment_events')
    .select('payload')
    .eq('event_name', 'founder_signup_completed')
    .gte('created_at', since)
    .is('payload->probe_run_id', null)
    .limit(5000);

  for (const row of signupRows || []) {
    if (isPeterAttributed(row.payload)) bump(row.payload?.utm_campaign, 'signups');
  }

  const { data: lookupRows } = await supabase
    .from('ai_logs')
    .select('output')
    .eq('operation', 'lookup_signup_completed')
    .eq('output->>utm_source', 'peter')
    .gte('created_at', since)
    .is('output->probe_run_id', null)
    .limit(5000);

  for (const row of lookupRows || []) {
    bump(row.output?.utm_campaign, 'signups');
  }

  return Object.entries(buckets)
    .map(([campaign, counts]) => ({ campaign, ...counts }))
    .sort((a, b) => b.url_submitted + b.signups - (a.url_submitted + a.signups));
}

async function fetchPeterOutreachSends(supabase, since) {
  const empty = {
    total_sent: 0,
    founder_sent: 0,
    vc_sent: 0,
    opened: 0,
    clicked: 0,
    campaigns: [],
  };
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from('pythh_prospecting_log')
    .select('campaign_slug, email_type, opened_at, clicked_at')
    .eq('status', 'sent')
    .gte('sent_at', since)
    .limit(5000);

  if (error) return empty;

  const peterRows = (data || []).filter((r) => {
    const slug = String(r.campaign_slug || '');
    return /^peter-founder/i.test(slug) || /^vc-/i.test(slug);
  });

  const byCampaign = {};
  for (const row of peterRows) {
    const slug = row.campaign_slug || 'unknown';
    byCampaign[slug] = byCampaign[slug] || { sent: 0, opened: 0, clicked: 0, email_type: row.email_type };
    byCampaign[slug].sent += 1;
    if (row.opened_at) byCampaign[slug].opened += 1;
    if (row.clicked_at) byCampaign[slug].clicked += 1;
  }

  return {
    total_sent: peterRows.length,
    founder_sent: peterRows.filter((r) => r.email_type === 'startup_matches').length,
    vc_sent: peterRows.filter((r) => r.email_type === 'vc_leads').length,
    opened: peterRows.filter((r) => r.opened_at).length,
    clicked: peterRows.filter((r) => r.clicked_at).length,
    campaigns: Object.entries(byCampaign)
      .map(([slug, c]) => ({ slug, ...c }))
      .sort((a, b) => b.sent - a.sent),
  };
}

async function fetchPeterUtmFunnel(supabase, days) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [
    urlSubmitted,
    previews,
    signupStarted,
    signupCompleted,
    lookupCompleted,
    byCampaign,
    outreach,
  ] = await Promise.all([
    countAiLogPeterUtm(supabase, 'url_submitted', since),
    countAiLogPeterUtm(supabase, 'instant_matches_viewed', since),
    countGrowthPeterUtm(supabase, 'founder_signup_started', since),
    countGrowthPeterUtm(supabase, 'founder_signup_completed', since),
    countAiLogPeterUtm(supabase, 'lookup_signup_completed', since),
    peterCampaignBreakdown(supabase, since),
    fetchPeterOutreachSends(supabase, since),
  ]);

  const signups = signupCompleted + lookupCompleted;
  const urlToSignupPct = urlSubmitted > 0 ? Math.round((signups / urlSubmitted) * 1000) / 10 : null;

  return {
    window_days: days,
    since,
    outreach,
    url_submitted: urlSubmitted,
    previews,
    founder_signup_started: signupStarted,
    founder_signup_completed: signups,
    url_to_signup_pct: urlToSignupPct,
    by_campaign: byCampaign,
  };
}

async function fetchRecentAgentRuns(sb, hours = 48) {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const agents = [
    { label: 'Research', table: 'research_agent_runs' },
    { label: 'Growth', table: 'growth_agent_runs' },
    { label: 'Product', table: 'product_agent_runs' },
  ];
  const runs = [];
  for (const a of agents) {
    try {
      const { data } = await sb
        .from(a.table)
        .select('status, result, cost_usd, num_turns, created_at, session_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2);
      for (const row of data || []) {
        runs.push({
          agent: a.label,
          status: row.status,
          summary: agentResultText(row),
          cost_usd: row.cost_usd,
          num_turns: row.num_turns,
          created_at: row.created_at,
        });
      }
    } catch {
      /* table may not exist in all envs */
    }
  }
  return runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function mergeLocalAgentRuns(reportsDir, dbRuns) {
  const prefixes = [
    { label: 'Research', prefix: 'research-agent-run-' },
    { label: 'Growth', prefix: 'growth-agent-run-' },
    { label: 'Product', prefix: 'product-agent-run-' },
  ];
  const local = [];
  for (const p of prefixes) {
    const report = latestReport(reportsDir, p.prefix);
    if (!report) continue;
    local.push({
      agent: p.label,
      status: report.status,
      summary: agentResultText(report) || report.result?.slice?.(0, 600),
      cost_usd: report.cost_usd,
      num_turns: report.num_turns,
      created_at: report.finished_at || report.started_at,
      source: 'local_file',
    });
  }
  if (!dbRuns.length) return local;
  return dbRuns;
}

function ensureConversionSnapshot(repoRoot) {
  spawnSync(process.execPath, ['scripts/conversion-funnel-snapshot.mjs'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env: process.env,
  });
}

/**
 * @param {{ repoRoot?: string, refreshFunnel?: boolean }} opts
 */
async function gatherAgentDailyReportData(opts = {}) {
  const repoRoot = opts.repoRoot || path.join(__dirname, '..', '..');
  const reportsDir = path.join(repoRoot, 'reports');

  if (opts.refreshFunnel !== false) {
    ensureConversionSnapshot(repoRoot);
  }

  const sb = getSupabaseClient();
  const funnel7d = await getFunnelCounts(sb, { days: 7 });
  const funnel1d = await getFunnelCounts(sb, { days: 1 });
  const conversion = latestReport(reportsDir, 'conversion-funnel-');
  const orchestrator = latestReport(reportsDir, 'orchestrator-brief-');
  const heartbeat = latestHeartbeatReport(reportsDir);
  const productMetrics = latestReport(reportsDir, 'product-metrics-');
  const growthMetrics = latestReport(reportsDir, 'growth-metrics-');
  const researchSnapshot = latestReport(reportsDir, 'research-snapshot-');
  const growthCycle = latestReport(reportsDir, 'growth-cycle-');

  const findingsRegistry = readJson(path.join(repoRoot, 'agents', 'research', 'findings-registry.json'));
  const opportunityRegistry = readJson(path.join(repoRoot, 'agents', 'product', 'opportunity-registry.json'));
  const experimentRegistry = readJson(path.join(repoRoot, 'agents', 'growth', 'experiment-registry.json'));
  const northStar = readJson(path.join(repoRoot, 'agents', 'north-star.json'));
  const brief = latestBrief(repoRoot);

  const openFindings = (findingsRegistry?.findings || [])
    .filter((f) => {
      if (['addressed', 'archived', 'handed_off'].includes(f.status)) return false;
      if (f.status_update && /DOWNGRADE priority|superseded by F-/i.test(f.status_update)) return false;
      return f.status === 'open' || f.status === 'validated';
    })
    .sort((a, b) => {
      const conf = { high: 0, medium: 1, low: 2 };
      return (conf[a.confidence] ?? 9) - (conf[b.confidence] ?? 9);
    })
    .slice(0, 6);

  const opportunities = opportunityRegistry?.opportunities || [];
  const activeWork = opportunities.filter((o) =>
    ['building', 'validating', 'in_progress', 'running'].includes(o.status),
  );
  const recentlyShipped = opportunities.filter((o) => o.status === 'shipped').slice(0, 5);
  const p0Open = opportunities.filter(
    (o) => o.priority === 'P0' && !['shipped', 'killed'].includes(o.status),
  );

  const runningExperiments = (experimentRegistry?.experiments || []).filter(
    (e) => e.status === 'running',
  );

  const dbRuns = await fetchRecentAgentRuns(sb);
  const agentRuns = mergeLocalAgentRuns(reportsDir, dbRuns);

  const [peterOutreach7d, peterOutreach1d] = await Promise.all([
    fetchPeterUtmFunnel(sb, 7),
    fetchPeterUtmFunnel(sb, 1),
  ]);

  const s7 = signupsFromFunnel(funnel7d);
  const s1 = signupsFromFunnel(funnel1d);
  const f7 = funnel7d.ai_logs || {};
  const f1 = funnel1d.ai_logs || {};

  const date = new Date().toISOString().slice(0, 10);

  return {
    generated_at: new Date().toISOString(),
    date,
    site_url: SITE_URL,
    north_star: {
      goal: northStar?.goal || '100 signups/day',
      target_per_day: NORTH_STAR_TARGET,
      signups_per_day_7d: conversion?.totals?.signups_per_day ?? Math.round((s7.total / 7) * 100) / 100,
      gap_per_day: Math.max(
        0,
        NORTH_STAR_TARGET -
          (conversion?.totals?.signups_per_day ?? Math.round((s7.total / 7) * 100) / 100),
      ),
    },
    metrics: {
      today: {
        page_views: f1.page_view || 0,
        url_submitted: f1.url_submitted || 0,
        previews: f1.preview_requested || f1.instant_matches_viewed || 0,
        signups: s1.total,
        founder_signups: s1.founder,
        investor_signups: s1.investor,
        checkouts: f1.checkout_completed || 0,
      },
      window_7d: {
        page_views: f7.page_view || 0,
        url_submitted: f7.url_submitted || 0,
        previews: f7.preview_requested || f7.instant_matches_viewed || 0,
        signups: s7.total,
        founder_signups: s7.founder,
        investor_signups: s7.investor,
        checkouts: f7.checkout_completed || 0,
        signups_per_day: conversion?.totals?.signups_per_day ?? Math.round((s7.total / 7) * 100) / 100,
      },
      conversion_rates: conversion?.rates || {},
      paid_subscribers: conversion?.totals?.paid_subscribers ?? null,
      founder_demand_events_7d: conversion?.founder_demand?.events_7d ?? null,
    },
    funnel_health: {
      ok: heartbeat?.verification?.required_stages_ok ?? heartbeat?.ok ?? conversion?.heartbeat_ok,
      diagnosis: heartbeat?.verification?.diagnosis ?? heartbeat?.diagnosis ?? conversion?.heartbeat_diagnosis,
      weakest_stage: orchestrator?.weakest_stage?.label,
      weakest_rate: orchestrator?.weakest_stage?.score,
      todays_focus: orchestrator?.todays_focus?.primary,
      agent_focus: conversion?.agent_focus || [],
    },
    key_findings: openFindings.map((f) => ({
      id: f.id,
      title: f.title,
      confidence: f.confidence,
      status: f.status,
      opportunity: f.pythh_opportunity?.slice?.(0, 200) || f.pythh_opportunity,
    })),
    market_brief: brief
      ? { file: brief.file, highlight: extractBriefHighlight(brief.content) }
      : null,
    research_snapshot: researchSnapshot
      ? {
          signup_velocity: researchSnapshot.signup_velocity,
          friction: researchSnapshot.internal_events?.top_friction_categories?.slice(0, 3),
        }
      : null,
    active_work: activeWork.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      priority: o.priority,
      next_step: o.next_step,
    })),
    p0_backlog: p0Open.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      next_step: o.next_step,
    })),
    recently_shipped: recentlyShipped.map((o) => ({ id: o.id, title: o.title, metric: o.metric })),
    running_experiments: runningExperiments.map((e) => ({
      id: e.id,
      name: e.name,
      primary_metric: e.metrics?.primary,
      note: e.promotion_note,
    })),
    agent_runs: agentRuns.slice(0, 6),
    growth_cycle: growthCycle?.decision
      ? { decision: growthCycle.decision, summary: growthCycle.executive_summary?.slice(0, 3) }
      : null,
    pipeline_grade: productMetrics?.health_grade || productMetrics?.summary?.pipeline_grade,
    url_attribution: conversion?.url_attribution || null,
    peter_outreach: {
      today: peterOutreach1d,
      window_7d: peterOutreach7d,
    },
  };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function metricRow(label, today, week) {
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#444;">${esc(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${esc(today)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:#666;">${esc(week)}</td></tr>`;
}

function buildAgentDailyReportHtml(data) {
  const m = data.metrics;
  const rates = m.conversion_rates;
  const rateLine = [
    rates.preview_view_per_url != null ? `URL→preview ${rates.preview_view_per_url}%` : null,
    rates.signup_per_preview != null ? `preview→signup ${rates.signup_per_preview}%` : null,
    rates.investor_started_to_completed != null
      ? `investor start→done ${rates.investor_started_to_completed}%`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const findingsHtml = data.key_findings.length
    ? data.key_findings
        .map(
          (f) =>
            `<li style="margin-bottom:10px;"><strong>${esc(f.id)}</strong> — ${esc(f.title)}<br><span style="color:#666;font-size:13px;">${esc(f.opportunity || '')}</span></li>`,
        )
        .join('')
    : '<li>No open findings in registry.</li>';

  const agentHtml = data.agent_runs.length
    ? data.agent_runs
        .map((r) => {
          const when = r.created_at ? new Date(r.created_at).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC' : '';
          return `<div style="margin-bottom:16px;padding:12px;background:#f8f9fb;border-radius:8px;border-left:4px solid #6366f1;">
            <div style="font-weight:600;color:#111;">${esc(r.agent)} agent <span style="color:#666;font-weight:400;">· ${esc(r.status)} · ${esc(when)}</span></div>
            ${r.summary ? `<p style="margin:8px 0 0;font-size:14px;color:#333;line-height:1.5;">${esc(r.summary)}</p>` : '<p style="margin:8px 0 0;color:#888;font-size:13px;">Run logged — no summary text yet.</p>'}
            ${r.cost_usd != null ? `<div style="margin-top:6px;font-size:12px;color:#888;">${r.num_turns || '—'} turns · $${Number(r.cost_usd).toFixed(2)}</div>` : ''}
          </div>`;
        })
        .join('')
    : '<p style="color:#666;">No agent runs in the last 48h. Autopilot runs daily at 11:00 UTC.</p>';

  const activeHtml = data.active_work.length
    ? data.active_work
        .map(
          (o) =>
            `<li><strong>${esc(o.id)}</strong> (${esc(o.status)}) — ${esc(o.title)}<br><span style="color:#666;font-size:13px;">Next: ${esc(o.next_step || '—')}</span></li>`,
        )
        .join('')
    : '<li>No items in building/validating state.</li>';

  const shippedHtml = data.recently_shipped.length
    ? data.recently_shipped.map((o) => `<li>${esc(o.title)}</li>`).join('')
    : '<li>—</li>';

  const focusHtml = [...(data.funnel_health.agent_focus || [])]
    .slice(0, 5)
    .map((x) => `<li>${esc(x)}</li>`)
    .join('');

  const experimentsHtml = data.running_experiments.length
    ? data.running_experiments
        .map((e) => `<li><strong>${esc(e.id)}</strong> — ${esc(e.name)}${e.note ? `<br><span style="color:#666;font-size:13px;">${esc(e.note)}</span>` : ''}</li>`)
        .join('')
    : '<li>No running experiments.</li>';

  const p7 = data.peter_outreach?.window_7d;
  const p1 = data.peter_outreach?.today;
  const peterCampaignHtml = (p7?.by_campaign || []).length
    ? (p7.by_campaign || [])
        .slice(0, 5)
        .map(
          (c) =>
            `<li><strong>${esc(c.campaign)}</strong> — ${c.url_submitted} URLs · ${c.signups} signups</li>`,
        )
        .join('')
    : '<li>No Peter UTM events yet in this window.</li>';
  const peterOutreachHtml = p7
    ? `<h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Peter outreach (UTM)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px;">
        <thead><tr style="background:#f8f9fb;">
          <th style="padding:8px 12px;text-align:left;color:#666;font-weight:500;">Metric</th>
          <th style="padding:8px 12px;text-align:right;color:#666;font-weight:500;">Today</th>
          <th style="padding:8px 12px;text-align:right;color:#666;font-weight:500;">7 days</th>
        </tr></thead>
        <tbody>
          ${metricRow('Emails sent', p1?.outreach?.total_sent ?? 0, p7?.outreach?.total_sent ?? 0)}
          ${metricRow('Founder emails', p1?.outreach?.founder_sent ?? 0, p7?.outreach?.founder_sent ?? 0)}
          ${metricRow('VC emails', p1?.outreach?.vc_sent ?? 0, p7?.outreach?.vc_sent ?? 0)}
          ${metricRow('URLs submitted (utm_source=peter)', p1?.url_submitted ?? 0, p7?.url_submitted ?? 0)}
          ${metricRow('Previews', p1?.previews ?? 0, p7?.previews ?? 0)}
          ${metricRow('Founder signups', p1?.founder_signup_completed ?? 0, p7?.founder_signup_completed ?? 0)}
        </tbody>
      </table>
      <p style="font-size:13px;color:#666;margin:0 0 8px;">
        Opens (7d): ${p7?.outreach?.opened ?? 0} · Clicks (7d): ${p7?.outreach?.clicked ?? 0}
        ${p7?.url_to_signup_pct != null ? ` · URL→signup: ${p7.url_to_signup_pct}%` : ''}
      </p>
      <p style="font-size:13px;color:#444;margin:0 0 4px;font-weight:600;">By campaign (7d)</p>
      <ul style="font-size:13px;color:#333;padding-left:20px;margin:0;">${peterCampaignHtml}</ul>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1e1b4b,#4338ca);color:#fff;padding:28px 24px;">
      <div style="font-size:13px;opacity:.85;text-transform:uppercase;letter-spacing:.08em;">Pythh Agent Ops</div>
      <h1 style="margin:12px 0 8px;font-size:22px;font-weight:700;">Daily Report — ${esc(data.date)}</h1>
      <p style="margin:0;opacity:.9;font-size:14px;line-height:1.5;">${esc(data.north_star.goal)}</p>
      <div style="margin-top:16px;display:flex;gap:24px;font-size:14px;">
        <div><span style="opacity:.7;">Signups/day (7d)</span><br><strong style="font-size:24px;">${esc(data.north_star.signups_per_day_7d)}</strong></div>
        <div><span style="opacity:.7;">Gap to 100/day</span><br><strong style="font-size:24px;">${esc(data.north_star.gap_per_day)}</strong></div>
        <div><span style="opacity:.7;">Pipeline</span><br><strong style="font-size:18px;">${esc(data.pipeline_grade || '—')}</strong></div>
      </div>
    </div>

    <div style="padding:24px;">
      <h2 style="font-size:16px;color:#111;margin:0 0 12px;">Site metrics</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f8f9fb;">
          <th style="padding:8px 12px;text-align:left;color:#666;font-weight:500;">Metric</th>
          <th style="padding:8px 12px;text-align:right;color:#666;font-weight:500;">Today</th>
          <th style="padding:8px 12px;text-align:right;color:#666;font-weight:500;">7 days</th>
        </tr></thead>
        <tbody>
          ${metricRow('Page views', m.today.page_views, m.window_7d.page_views)}
          ${metricRow('URLs submitted', m.today.url_submitted, m.window_7d.url_submitted)}
          ${metricRow('Previews', m.today.previews, m.window_7d.previews)}
          ${metricRow('Signups (total)', m.today.signups, m.window_7d.signups)}
          ${metricRow('Founder signups', m.today.founder_signups, m.window_7d.founder_signups)}
          ${metricRow('Investor signups', m.today.investor_signups, m.window_7d.investor_signups)}
          ${metricRow('Paid checkouts', m.today.checkouts, m.window_7d.checkouts)}
        </tbody>
      </table>
      <p style="font-size:13px;color:#666;margin:12px 0 0;">${esc(rateLine)}${m.paid_subscribers != null ? ` · Paid subs: ${m.paid_subscribers}` : ''}${m.founder_demand_events_7d != null ? ` · Founder demand events (7d): ${m.founder_demand_events_7d}` : ''}${data.url_attribution?.founder_demand != null ? ` · URL SSOT (demand): ${data.url_attribution.founder_demand}` : ''}</p>

      ${peterOutreachHtml}

      <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Funnel focus</h2>
      <p style="font-size:14px;color:#333;margin:0 0 8px;"><strong>Weakest stage:</strong> ${esc(data.funnel_health.weakest_stage || '—')} (${esc(data.funnel_health.weakest_rate ?? '—')}%)</p>
      <p style="font-size:14px;color:#333;margin:0 0 12px;">${esc(data.funnel_health.todays_focus || '')}</p>
      <p style="font-size:13px;color:#666;margin:0;">Heartbeat: ${data.funnel_health.ok ? '✅ OK' : data.funnel_health.diagnosis === 'healthy' ? '✅ OK (optional stages pending)' : '⚠️ Needs attention'} — ${esc(data.funnel_health.diagnosis || 'unknown')}</p>
      ${focusHtml ? `<ul style="font-size:13px;color:#444;padding-left:20px;margin:12px 0 0;">${focusHtml}</ul>` : ''}

      ${data.market_brief?.highlight ? `<h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Research highlight (${esc(data.market_brief.file)})</h2>
      <p style="font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap;margin:0;">${esc(data.market_brief.highlight)}</p>` : ''}

      <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Key findings</h2>
      <ul style="font-size:14px;color:#333;padding-left:20px;margin:0;">${findingsHtml}</ul>

      <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">AI agents — recent work & results</h2>
      ${agentHtml}

      <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Active improvements</h2>
      <ul style="font-size:14px;color:#333;padding-left:20px;margin:0 0 16px;">${activeHtml}</ul>

      <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Recently shipped</h2>
      <ul style="font-size:14px;color:#333;padding-left:20px;margin:0 0 16px;">${shippedHtml}</ul>

      <h2 style="font-size:16px;color:#111;margin:28px 0 12px;">Running experiments</h2>
      <ul style="font-size:14px;color:#333;padding-left:20px;margin:0;">${experimentsHtml}</ul>

      <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">
        <a href="${esc(data.site_url)}/admin" style="color:#6366f1;">Admin dashboard</a> ·
        Generated ${esc(data.generated_at)} · Automated by Pythh Agent Autopilot
      </p>
    </div>
  </div>
</body></html>`;
}

function buildAgentDailyReportText(data) {
  const m = data.metrics;
  const p7 = data.peter_outreach?.window_7d;
  const p1 = data.peter_outreach?.today;
  const lines = [
    `PYTHH AGENT DAILY REPORT — ${data.date}`,
    '',
    `North star: ${data.north_star.goal}`,
    `Signups/day (7d): ${data.north_star.signups_per_day_7d} · Gap: ${data.north_star.gap_per_day}/day`,
    '',
    'SITE METRICS (today / 7d)',
    `  Page views: ${m.today.page_views} / ${m.window_7d.page_views}`,
    `  URLs submitted: ${m.today.url_submitted} / ${m.window_7d.url_submitted}`,
    `  Previews: ${m.today.previews} / ${m.window_7d.previews}`,
    `  Signups: ${m.today.signups} / ${m.window_7d.signups} (${m.window_7d.signups_per_day}/day avg)`,
    `  Founder: ${m.today.founder_signups} / ${m.window_7d.founder_signups}`,
    `  Investor: ${m.today.investor_signups} / ${m.window_7d.investor_signups}`,
    '',
    'PETER OUTREACH (UTM)',
    `  Emails sent: ${p1?.outreach?.total_sent ?? 0} today / ${p7?.outreach?.total_sent ?? 0} (7d)`,
    `  Founder emails: ${p1?.outreach?.founder_sent ?? 0} / ${p7?.outreach?.founder_sent ?? 0}`,
    `  URLs (utm_source=peter): ${p1?.url_submitted ?? 0} / ${p7?.url_submitted ?? 0}`,
    `  Founder signups: ${p1?.founder_signup_completed ?? 0} / ${p7?.founder_signup_completed ?? 0}`,
    ...(p7?.by_campaign?.length
      ? ['  By campaign (7d):', ...p7.by_campaign.slice(0, 5).map((c) => `    · ${c.campaign}: ${c.url_submitted} URLs, ${c.signups} signups`)]
      : ['  By campaign (7d): none yet']),
    '',
    'FUNNEL FOCUS',
    `  Weakest: ${data.funnel_health.weakest_stage} (${data.funnel_health.weakest_rate}%)`,
    `  ${data.funnel_health.todays_focus || ''}`,
    '',
    'KEY FINDINGS',
    ...data.key_findings.map((f) => `  · ${f.id}: ${f.title}`),
    '',
    'AI AGENT RUNS',
    ...data.agent_runs.map(
      (r) => `  · ${r.agent} (${r.status}): ${(r.summary || 'no summary').slice(0, 200)}`,
    ),
    '',
    'ACTIVE WORK',
    ...data.active_work.map((o) => `  · [${o.status}] ${o.title}`),
    '',
    data.site_url,
  ];
  return lines.join('\n');
}

module.exports = {
  gatherAgentDailyReportData,
  buildAgentDailyReportHtml,
  buildAgentDailyReportText,
};
