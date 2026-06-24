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

  const f = funnel.ai_logs || {};
  const g = funnel.growth_events || {};

  const founderSignups =
    (g.founder_signup_completed || 0) +
    (f.lookup_signup_completed || 0) +
    (f.login_completed || 0);
  const investorSignups = g.investor_signup_completed || 0;

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
      investor_dealflow_digest_sent: f.investor_dealflow_digest_sent || 0,
    },
    rates: {
      preview_per_url: rate(f.preview_requested || 0, f.url_submitted || 0),
      founder_preview_to_started: rate(g.founder_signup_started || 0, f.instant_matches_viewed || 0),
      founder_started_to_completed: rate(
        (g.founder_signup_completed || 0) + (f.lookup_signup_completed || 0),
        g.founder_signup_started || 0,
      ),
      signup_per_preview: rate(founderSignups + investorSignups, f.preview_requested || 0),
      intro_per_match_view: rate(f.match_intro_requested || 0, f.match_viewed || 0),
      checkout_per_pricing: rate(f.checkout_started || 0, f.pricing_viewed || 0),
      preview_view_per_url: rate(f.instant_matches_viewed || 0, f.url_submitted || 0),
      email_capture_per_preview: rate(f.preview_email_captured || 0, f.instant_matches_viewed || 0),
      complete_per_checkout: rate(f.checkout_completed || 0, f.checkout_started || 0),
    },
    totals: {
      signups_7d: founderSignups + investorSignups,
      signups_per_day: Math.round(((founderSignups + investorSignups) / days) * 100) / 100,
      paid_subscribers: subs.active_or_trialing,
      paid_subscribers_source: subs.table,
    },
    funnel_healthy: heartbeat?.verification?.required_stages_ok ?? null,
    heartbeat_diagnosis: heartbeat?.diagnosis ?? null,
    agent_focus: [],
  };

  if ((f.url_submitted || 0) > 15 && (f.instant_matches_viewed || 0) < (f.url_submitted || 0) * 0.15) {
    report.agent_focus.push(
      'Funnel leak: url_submitted >> instant_matches_viewed — route more traffic through /find-investors and matches_preview (now 70%)',
    );
  }
  if ((f.pricing_viewed || 0) < 10 && (f.instant_matches_viewed || 0) > 5) {
    report.agent_focus.push('Monetization: preview→Oracle bridge live — drive pricing_viewed from match preview sticky bar');
  }
  if ((report.totals.signups_per_day || 0) < 1) {
    report.agent_focus.push('Acquisition: SEO /find-investors + paid/community tests for first-time founders (F-12)');
  }
  if (report.funnel_healthy === false || heartbeat?.diagnosis === 'probe_failed') {
    report.agent_focus.push('Fix funnel instrumentation gaps (run npm run funnel:heartbeat)');
  }
  if ((f.instant_matches_viewed || 0) > 0 && (f.match_intro_requested || 0) === 0 && (g.founder_signup_started || 0) < 5) {
    report.agent_focus.push('Activation: intro/email capture on preview — watch match_intro_requested and preview_email_captured');
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
