#!/usr/bin/env node
/**
 * Post-ship funnel verification for agent autopilot.
 * Warns when critical stages are still blind after a deploy window.
 *
 * Usage:
 *   node scripts/autopilot-ship-verify.mjs
 *   node scripts/autopilot-ship-verify.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { getFunnelCounts, latestHeartbeatReport, countUiInstantMatchesViewed } = require('../server/lib/funnelTelemetry.js');

const JSON_OUT = process.argv.includes('--json');
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(repoRoot, 'reports');

async function countRecentUiPreview(supabase, hours = 24) {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  return countUiInstantMatchesViewed(supabase, since, { excludeProbes: true });
}

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const funnel7 = await getFunnelCounts(sb, { days: 7, excludeProbes: true });
  const hf = funnel7.human_funnel || {};
  const preview24h = await countRecentUiPreview(sb, 24);
  const pageView24h = await (async () => {
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { count } = await sb
      .from('ai_logs')
      .select('*', { count: 'exact', head: true })
      .eq('operation', 'page_view')
      .gte('created_at', since)
      .or('output->>source.is.null,output->>source.neq.funnel_probe')
      .is('output->probe_run_id', null);
    return count ?? 0;
  })();
  const heartbeat = latestHeartbeatReport(reportsDir);

  const checks = [
    {
      id: 'heartbeat_required_stages',
      ok: heartbeat?.verification?.required_stages_ok ?? heartbeat?.ok ?? null,
      detail:
        heartbeat?.verification?.diagnosis ??
        heartbeat?.diagnosis ??
        (heartbeat ? 'unknown' : 'no heartbeat report in reports/ — run npm run funnel:heartbeat'),
    },
    {
      id: 'instant_matches_viewed_24h',
      ok: preview24h > 0,
      count: preview24h,
      detail: preview24h > 0 ? `${preview24h} UI preview views in 24h` : 'No UI instant_matches_viewed (matches_preview) in 24h',
    },
    {
      id: 'page_view_24h',
      ok: pageView24h > 0,
      count: pageView24h,
      detail: pageView24h > 0 ? `${pageView24h} page views in 24h` : 'No page_view events in 24h — awareness instrumentation gap',
    },
    {
      id: 'preview_view_rate_7d',
      ok:
        (hf.url_submitted || 0) < 5 ||
        (hf.instant_matches_viewed || 0) / Math.max(hf.url_submitted || 1, 1) >= 0.3,
      detail: `7d human preview/human url: ${hf.instant_matches_viewed || 0}/${hf.url_submitted || 0} (raw: ${funnel7.ai_logs.instant_matches_viewed || 0}/${funnel7.ai_logs.url_submitted || 0})`,
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    checks,
    ok: checks.every((c) => c.ok !== false),
    warnings: checks.filter((c) => c.ok === false).map((c) => c.detail),
  };

  fs.mkdirSync(reportsDir, { recursive: true });
  const outFile = path.join(reportsDir, `autopilot-ship-verify-${report.generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n🚢 Autopilot ship verify');
    for (const c of checks) {
      const icon = c.ok === false ? '⚠️' : c.ok === true ? '✅' : '❓';
      console.log(`   ${icon} ${c.id}: ${c.detail}`);
    }
    if (report.warnings.length) {
      console.log('\n   Warnings (non-blocking):');
      for (const w of report.warnings) console.log(`     · ${w}`);
    }
    console.log(`\n📁 ${outFile}\n`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
