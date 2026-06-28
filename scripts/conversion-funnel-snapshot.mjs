#!/usr/bin/env node
/**
 * Full conversion funnel — visitor → signup → use → pay (7d window).
 *
 * Usage:
 *   node scripts/conversion-funnel-snapshot.mjs
 *   node scripts/conversion-funnel-snapshot.mjs --json --days=14
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { getFunnelCounts, latestHeartbeatReport } = require('../server/lib/funnelTelemetry.js');

const JSON_OUT = process.argv.includes('--json');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(repoRoot, 'reports');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function rate(num, denom) {
  if (!denom) return null;
  return Math.round((num / denom) * 1000) / 10;
}

async function countSubscriptions(sb) {
  const tables = ['user_subscriptions', 'pythh_subscriptions', 'subscriptions'];
  for (const table of tables) {
    try {
      const { count, error } = await sb
        .from(table)
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'trialing']);
      if (!error && count != null) {
        return { table, active_or_trialing: count };
      }
    } catch {
      /* try next */
    }
  }
  return { table: null, active_or_trialing: null };
}

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const funnel = await getFunnelCounts(sb, { days });
  const subs = await countSubscriptions(sb);
  const heartbeat = latestHeartbeatReport(reportsDir);
  const northStar = readJson(path.join(repoRoot, 'agents/north-star.json'));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const f = funnel.ai_logs || {};
  const g = funnel.growth_events || {};

  const founderSignups =
    (g.founder_signup_completed || 0) +
    (f.lookup_signup_completed || 0) +
    (f.login_completed || 0);
  const investorSignups = g.investor_signup_completed || 0;
  const investorStarted = g.investor_signup_started || 0;
  const previewViews = f.instant_matches_viewed || 0;
  const previewDenom = previewViews || f.preview_requested || 0;
  const totalSignups = founderSignups + investorSignups;

  const { data: oracleGapEvents } = await sb
    .from('growth_experiment_events')
    .select('event_name, payload')
    .eq('experiment_id', 'founder_preview_oracle_gap_gate')
    .gte('created_at', since)
    .limit(5000);

  const oracleGapStarted = (oracleGapEvents || []).filter((e) => e.event_name === 'founder_signup_started').length;
  const oracleGapCompleted = (oracleGapEvents || []).filter((e) => e.event_name === 'founder_signup_completed').length;
  const oracleGapTeaserViews = f.preview_oracle_gap_teaser_viewed || 0;

  const { data: investorCompletedEvents } = await sb
    .from('growth_experiment_events')
    .select('event_name, payload')
    .eq('event_name', 'investor_signup_completed')
    .gte('created_at', since)
    .limit(5000);

  const investorEmailCaptured = (investorCompletedEvents || []).filter(
    (e) => e.payload?.email_first || e.payload?.profile_incomplete,
  ).length;
  const investorProfileCompleted = (investorCompletedEvents || []).filter(
    (e) => e.payload?.profile_completed,
  ).length;
  const investorProfileResumeStarted = f.investor_profile_resume_started || 0;
  const investorEmailCapturedEvents = f.investor_email_captured || 0;

  const { count: founderDemandCount } = await sb
    .from('founder_demand_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)
    .then((r) => (r.error ? { count: null } : r))
    .catch(() => ({ count: null }));

  const { data: urlSubmitRows } = await sb
    .from('ai_logs')
    .select('output')
    .eq('operation', 'url_submitted')
    .gte('created_at', since)
    .or('output->>source.is.null,output->>source.neq.funnel_probe')
    .is('output->probe_run_id', null)
    .limit(5000);

  const utmAttribution = {};
  let legacyPreviewRequested = 0;
  for (const row of urlSubmitRows || []) {
    const src = row.output?.utm_source || row.output?.source || 'direct';
    utmAttribution[src] = (utmAttribution[src] || 0) + 1;
  }

  const { data: previewRows } = await sb
    .from('ai_logs')
    .select('output')
    .eq('operation', 'preview_requested')
    .gte('created_at', since)
    .or('output->>source.is.null,output->>source.neq.funnel_probe')
    .is('output->probe_run_id', null)
    .limit(5000);

  for (const row of previewRows || []) {
    if (row.output?.source === 'instant_submit') legacyPreviewRequested += 1;
  }

  const uiPreviewRequested = Math.max(0, (f.preview_requested || 0) - legacyPreviewRequested);

  const report = {
    generated_at: new Date().toISOString(),
    window_days: days,
    north_star: northStar?.goal,
    stages: {
      page_view: f.page_view || 0,
      url_submitted: f.url_submitted || 0,
      preview_requested: f.preview_requested || 0,
      instant_matches_viewed: f.instant_matches_viewed || 0,
      match_viewed: f.match_viewed || 0,
      match_intro_requested: f.match_intro_requested || 0,
      founder_signup_started: g.founder_signup_started || 0,
      founder_signup_completed: g.founder_signup_completed || 0,
      lookup_signup_completed: f.lookup_signup_completed || 0,
      founder_signup_completed_all:
        (g.founder_signup_completed || 0) + (f.lookup_signup_completed || 0),
      investor_signup_started: g.investor_signup_started || 0,
      investor_signup_completed: investorSignups,
      pricing_viewed: f.pricing_viewed || 0,
      checkout_started: f.checkout_started || 0,
      checkout_completed: f.checkout_completed || 0,
      checkout_cancelled: f.checkout_cancelled || 0,
      preview_email_captured: f.preview_email_captured || 0,
      preview_oracle_gap_teaser_viewed: f.preview_oracle_gap_teaser_viewed || 0,
      founder_activation_email_sent: f.founder_activation_email_sent || 0,
      wizard_outreach_preview_viewed: f.wizard_outreach_preview_viewed || 0,
      investor_portfolio_delta_sent: f.investor_portfolio_delta_sent || 0,
      investor_dealflow_digest_sent: f.investor_dealflow_digest_sent || 0,
      investor_profile_resume_started: f.investor_profile_resume_started || 0,
      investor_portfolio_exported: f.investor_portfolio_exported || 0,
      investor_email_captured: f.investor_email_captured || 0,
      investor_profile_completed: f.investor_profile_completed || 0,
      preview_evidence_strip_viewed: f.preview_evidence_strip_viewed || 0,
      match_explain_viewed: f.match_explain_viewed || 0,
      pricing_strip_viewed: f.pricing_strip_viewed || 0,
      return_visit_7d: f.return_visit_7d || 0,
    },
    founder_demand: {
      events_7d: founderDemandCount,
    },
    utm_attribution: utmAttribution,
    preview_attribution: {
      legacy_instant_submit: legacyPreviewRequested,
      ui_preview_requested: uiPreviewRequested,
      note: 'Before 2026-06-28, preview_requested fired on API submit — use instant_matches_viewed for real preview views.',
    },
    rates: {
      preview_per_url: rate(f.preview_requested || 0, f.url_submitted || 0),
      founder_preview_to_started: rate(g.founder_signup_started || 0, previewViews),
      founder_started_to_completed: rate(
        (g.founder_signup_completed || 0) + (f.lookup_signup_completed || 0),
        g.founder_signup_started || 0,
      ),
      signup_per_preview: rate(totalSignups, previewDenom),
      intro_per_match_view: rate(f.match_intro_requested || 0, f.match_viewed || 0),
      checkout_per_pricing: rate(f.checkout_started || 0, f.pricing_viewed || 0),
      preview_view_per_url: rate(previewViews, f.url_submitted || 0),
      preview_view_per_ui_url: rate(previewViews, Math.max(f.page_view || 0, uiPreviewRequested || 0)),
      url_submitted_per_page_view: rate(f.url_submitted || 0, f.page_view || 0),
      email_capture_per_preview: rate(f.preview_email_captured || 0, previewViews),
      oracle_gap_teaser_per_preview: rate(f.preview_oracle_gap_teaser_viewed || 0, previewViews),
      oracle_gap_signup_per_teaser: rate(oracleGapStarted, f.preview_oracle_gap_teaser_viewed || 0),
      investor_started_to_completed: rate(investorSignups, investorStarted),
      investor_email_to_profile: rate(investorProfileCompleted, investorEmailCaptured || investorSignups),
      investor_resume_to_profile: rate(investorProfileCompleted, investorProfileResumeStarted),
      complete_per_checkout: rate(f.checkout_completed || 0, f.checkout_started || 0),
      return_visit_per_preview: rate(f.return_visit_7d || 0, previewViews),
      wizard_per_founder_signup: rate(
        f.wizard_outreach_preview_viewed || 0,
        (g.founder_signup_completed || 0) + (f.lookup_signup_completed || 0),
      ),
      url_submitted_per_day: Math.round(((f.url_submitted || 0) / days) * 100) / 100,
    },
    url_attribution: {
      ai_logs_only: f.url_submitted_ai_logs_only ?? null,
      founder_url_growth: f.founder_url_submitted_growth ?? null,
      founder_demand: f.founder_demand_url_submitted ?? null,
    },
    experiments: {
      founder_preview_oracle_gap_gate: {
        teaser_viewed: oracleGapTeaserViews,
        signup_started: oracleGapStarted,
        signup_completed: oracleGapCompleted,
        teaser_to_signup_pct: rate(oracleGapStarted, oracleGapTeaserViews),
        started_to_completed_pct: rate(oracleGapCompleted, oracleGapStarted),
      },
      investor_signup: {
        email_captured: investorEmailCapturedEvents || investorEmailCaptured,
        profile_completed: investorProfileCompleted,
        resume_started: investorProfileResumeStarted,
      },
    },
    totals: {
      signups_7d: totalSignups,
      signups_per_day: Math.round((totalSignups / days) * 100) / 100,
      paid_subscribers: subs.active_or_trialing,
      paid_subscribers_source: subs.table,
    },
    north_star_gap: {
      signups_per_day: Math.max(0, (northStar?.targets?.signups_per_day ?? 100) - Math.round((totalSignups / days) * 100) / 100),
      target_signups_per_day: northStar?.targets?.signups_per_day ?? 100,
    },
    funnel_healthy: heartbeat?.verification?.required_stages_ok ?? heartbeat?.ok ?? null,
    heartbeat_ok: heartbeat?.verification?.required_stages_ok ?? heartbeat?.ok ?? null,
    heartbeat_diagnosis: heartbeat?.verification?.diagnosis ?? heartbeat?.diagnosis ?? null,
    agent_focus: [],
    agent_priorities: [],
  };

  report.conversion_rates = {
    url_submitted_per_page_view: report.rates.url_submitted_per_page_view,
    preview_per_url_submitted: report.rates.preview_view_per_url,
    signup_per_preview: report.rates.signup_per_preview,
    first_match_per_signup: rate(f.match_viewed || 0, totalSignups),
    return_7d: report.rates.return_visit_per_preview,
    checkout_per_pricing_view: report.rates.checkout_per_pricing,
  };

  if ((f.page_view || 0) < 20 && (f.url_submitted || 0) > 50) {
    report.agent_focus.push(
      'Awareness blind spot: page_view << url_submitted — instrument hero + /find-investors; filter API-only submits from conversion rates',
    );
    report.agent_priorities.push('awareness: instrument page_view on hero and acquisition landings');
  }
  if ((f.url_submitted || 0) > 15 && previewViews < (f.url_submitted || 0) * 0.15) {
    report.agent_focus.push(
      'Funnel leak: url_submitted >> instant_matches_viewed — route more traffic through /find-investors and matches_preview (now 70%)',
    );
  }
  if ((f.pricing_viewed || 0) < 10 && previewViews > 5) {
    report.agent_focus.push('Monetization: preview→Oracle bridge live — drive pricing_viewed from match preview sticky bar');
  }
  if ((report.totals.signups_per_day || 0) < 1) {
    report.agent_focus.push('Acquisition: SEO /find-investors + paid/community tests for first-time founders (F-12)');
  }
  if (report.funnel_healthy === false && heartbeat?.verification?.required_stages_ok === false) {
    report.agent_focus.push('Fix funnel instrumentation gaps (run npm run funnel:heartbeat)');
  }
  if (founderDemandCount === 0 && (f.preview_requested || 0) > 5) {
    report.agent_focus.push(
      'Founder demand corpus empty — run npm run pipeline:apply-founder-demand after deploy',
    );
  }
  if (previewViews > 0 && (f.match_intro_requested || 0) === 0 && (g.founder_signup_started || 0) < 5) {
    report.agent_focus.push('Activation: intro/email capture on preview — watch match_intro_requested and preview_email_captured');
    report.agent_priorities.push('use: match_explain + intro CTA on preview strip');
  }
  if (previewViews > 0 && (f.return_visit_7d || 0) < previewViews * 0.1) {
    report.agent_focus.push('Retention: return_visit_7d low — ship signal-delta or match-movement nudge');
    report.agent_priorities.push('return: signal_delta email + preview cliffhanger save gate');
  }
  if ((f.match_viewed || 0) > 10 && (f.match_intro_requested || 0) === 0) {
    report.agent_priorities.push('use: match_explain blocks — 0 intros despite match views');
  }
  if ((f.pricing_viewed || 0) === 0 && previewViews > 20) {
    report.agent_priorities.push('pay: pricing bridge from preview sticky bar — 0 pricing_viewed');
  }
  if ((f.page_view || 0) < 50) {
    report.agent_priorities.push('awareness: outbound_find_investors + share cards — page_view near zero');
  }
  if ((f.pricing_viewed || 0) === 0 && (f.pricing_strip_viewed || 0) > 0) {
    report.agent_focus.push('Pay bridge: pricing strip seen but no pricing page view — tighten trial CTA copy/link');
    report.agent_priorities.push('pay: pricing strip impressions without click — A/B trial CTA');
  }
  if ((f.match_viewed || 0) > 5 && (f.match_explain_viewed || 0) === 0) {
    report.agent_priorities.push('use: match explain blocks not expanding — test default-open top match');
  }
  if (investorStarted > 0 && investorSignups / investorStarted < 0.2) {
    report.agent_focus.push(
      `Investor signup leak: ${investorSignups}/${investorStarted} email captured (${report.rates.investor_started_to_completed ?? '—'}%) — ${investorProfileCompleted} profiles completed; email-first now skips to resume form`,
    );
  }
  if ((f.preview_oracle_gap_teaser_viewed || 0) > 0 && oracleGapStarted === 0) {
    report.agent_focus.push('Oracle gap experiment: teaser views but no oracle_gap signups — review CTA copy');
  }
  if (investorSignups > 0 && (f.investor_dealflow_digest_sent || 0) === 0) {
    report.agent_focus.push('Investor retention: run npm run digest:investor:dry then digest:investor (--to signed-up)');
  }

  fs.mkdirSync(reportsDir, { recursive: true });
  const outFile = path.join(reportsDir, `conversion-funnel-${report.generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n📈 Conversion funnel (${days}d)`);
    console.log(`   Signups: ${report.totals.signups_7d} (${report.totals.signups_per_day}/day)`);
    console.log(`   URL → preview view: ${report.rates.preview_view_per_url ?? '—'}%`);
    console.log(`   Preview → signup rate: ${report.rates.signup_per_preview ?? '—'}%`);
    console.log(`   Oracle gap teaser → signup: ${report.experiments.founder_preview_oracle_gap_gate.teaser_to_signup_pct ?? '—'}%`);
    console.log(`   Investor started → completed: ${report.rates.investor_started_to_completed ?? '—'}%`);
    console.log(`   Investor email → profile: ${report.rates.investor_email_to_profile ?? '—'}%`);
    console.log(`   Pricing → checkout: ${report.rates.checkout_per_pricing ?? '—'}%`);
    console.log(`   Paid subscribers: ${report.totals.paid_subscribers ?? 'unknown'}`);
    if (report.agent_focus.length) {
      console.log('   Agent focus:');
      for (const item of report.agent_focus) console.log(`     · ${item}`);
    }
    console.log(`\n📁 ${outFile}\n`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
