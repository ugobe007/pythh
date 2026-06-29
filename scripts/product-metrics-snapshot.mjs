#!/usr/bin/env node
/**
 * Unified product health snapshot — pipeline + growth + opportunity backlog.
 *
 * Usage:
 *   node scripts/product-metrics-snapshot.mjs
 *   node scripts/product-metrics-snapshot.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { getFunnelCounts, latestHeartbeatReport } = require('../server/lib/funnelTelemetry.js');

const JSON_OUT = process.argv.includes('--json');
const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');
const reportsDir = path.join(repoRoot, 'reports');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function latestReport(prefix) {
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files[0] ? readJson(path.join(reportsDir, files[0])) : null;
}

function runSnapshot(script, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, status: r.status };
}

async function main() {
  fs.mkdirSync(reportsDir, { recursive: true });
  const generated_at = new Date().toISOString();

  // Pipeline dashboard (writes report + refreshes platform stats cache)
  const pipelineRun = runSnapshot('scripts/pipeline-weekly-dashboard.mjs', ['--json', '--write']);
  let pipeline = null;
  if (pipelineRun.ok && pipelineRun.stdout) {
    try {
      pipeline = JSON.parse(pipelineRun.stdout);
    } catch {
      pipeline = { parse_error: true, raw: pipelineRun.stdout?.slice(0, 500) };
    }
  } else {
    pipeline = latestReport('pipeline-weekly-') || { error: pipelineRun.stderr?.slice(0, 300) || 'pipeline snapshot failed' };
  }

  // Growth metrics
  const growthRun = runSnapshot('scripts/growth-metrics-snapshot.mjs', ['--json']);
  let growth = null;
  if (growthRun.ok && growthRun.stdout) {
    try {
      growth = JSON.parse(growthRun.stdout);
    } catch {
      growth = latestReport('growth-metrics-') || { parse_error: true };
    }
  } else {
    growth = latestReport('growth-metrics-') || { error: growthRun.stderr?.slice(0, 300) || 'growth snapshot failed' };
  }

  // Research snapshot (RSS + friction + signup velocity)
  const researchRun = runSnapshot('scripts/research-snapshot.mjs', ['--json']);
  let research = null;
  if (researchRun.ok && researchRun.stdout) {
    try {
      research = JSON.parse(researchRun.stdout);
    } catch {
      research = latestReport('research-snapshot-') || { parse_error: true };
    }
  } else {
    research = latestReport('research-snapshot-') || { error: researchRun.stderr?.slice(0, 300) || 'research snapshot failed' };
  }

  const registry = readJson(path.join(repoRoot, 'agents/product/opportunity-registry.json'));
  const domains = readJson(path.join(repoRoot, 'agents/product/domains.json'));
  const growthRegistry = readJson(path.join(repoRoot, 'agents/growth/experiment-registry.json'));

  const opportunities = registry?.opportunities || [];
  const byStatus = {};
  const byPriority = {};
  for (const o of opportunities) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    byPriority[o.priority] = (byPriority[o.priority] || 0) + 1;
  }

  const criticalLearnings = (pipeline?.learnings || []).filter((l) => l.severity === 'critical');
  const p0Open = opportunities.filter((o) => o.priority === 'P0' && !['shipped', 'killed'].includes(o.status));

  let funnel = null;
  let conversion = null;
  try {
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    funnel = await getFunnelCounts(sb, { days: 7 });
    funnel.latest_heartbeat = latestHeartbeatReport(reportsDir);
  } catch (e) {
    funnel = { error: e.message };
  }
  conversion = latestReport('conversion-funnel-');

  const report = {
    generated_at,
    health_grade: pipeline?.health_grade || (criticalLearnings.length ? 'NEEDS_ATTENTION' : 'UNKNOWN'),
    summary: {
      pipeline_grade: pipeline?.health_grade,
      critical_learnings: criticalLearnings.length,
      p0_opportunities_open: p0Open.length,
      growth_experiments_running: (growthRegistry?.experiments || []).filter((e) => e.status === 'running').length,
      backlog_total: opportunities.length,
      backlog_by_status: byStatus,
      backlog_by_priority: byPriority,
    },
    pipeline: pipeline
      ? {
          sections: pipeline.sections,
          learnings: pipeline.learnings,
          health_grade: pipeline.health_grade,
        }
      : null,
    growth,
    funnel,
    conversion,
    research: research
      ? {
          north_star: research.north_star,
          signup_velocity: research.signup_velocity,
          top_friction: research.internal_events?.top_friction_categories,
          open_findings: research.open_findings,
        }
      : null,
    backlog: {
      p0_open: p0Open.map((o) => ({ id: o.id, title: o.title, status: o.status, next_step: o.next_step })),
      all: opportunities.map((o) => ({
        id: o.id,
        domain: o.domain,
        priority: o.priority,
        status: o.status,
        title: o.title,
        metric: o.metric,
      })),
    },
    domains: domains?.domains?.map((d) => d.id) || [],
    recent_agent_runs: {
      research: latestReport('research-agent-run-'),
      product: latestReport('product-agent-run-'),
      growth: latestReport('growth-agent-run-'),
    },
  };

  const outFile = path.join(reportsDir, `product-metrics-${generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n📊 Product metrics · grade: ${report.health_grade}`);
    console.log(`   Critical learnings: ${criticalLearnings.length}`);
    console.log(`   P0 backlog open: ${p0Open.length}`);
    console.log(`   Growth experiments: ${report.summary.growth_experiments_running}`);
    if (funnel && !funnel.error) {
      const hf = funnel.human_funnel || {};
      const p = funnel.ai_logs?.preview_requested ?? 0;
      const u = funnel.ai_logs?.url_submitted ?? 0;
      const g = funnel.growth_events || {};
      const imvUi = hf.instant_matches_viewed ?? funnel.ai_logs?.instant_matches_viewed ?? 0;
      console.log(`   Funnel (7d human): page_view=${hf.page_view ?? 0} url=${hf.url_submitted ?? 0} ui_preview=${imvUi}`);
      console.log(`   Funnel (7d raw/noisy): url_submitted=${u} preview_requested=${p}`);
      console.log(
        `   Founder: ui_preview=${imvUi} signup_started=${g.founder_signup_started ?? 0} completed=${g.founder_signup_completed ?? 0}`,
      );
      if (funnel.rates?.founder_preview_to_started != null) {
        console.log(
          `   Founder preview→started: ${funnel.rates.founder_preview_to_started}% · started→completed: ${funnel.rates.founder_started_to_completed ?? '—'}%`,
        );
      }
      if (funnel.latest_heartbeat?.verification?.required_stages_ok != null) {
        console.log(`   Last heartbeat: ${funnel.latest_heartbeat.verification.required_stages_ok ? 'healthy' : 'gaps'} (${funnel.latest_heartbeat.verification.diagnosis ?? funnel.latest_heartbeat.diagnosis ?? '—'})`);
      } else if (funnel.latest_heartbeat?.diagnosis) {
        console.log(`   Last heartbeat: ${funnel.latest_heartbeat.diagnosis}`);
      }
    }
    if (p0Open.length) {
      console.log('\n   P0 opportunities:');
      for (const o of p0Open) console.log(`     · ${o.id}: ${o.title} (${o.status})`);
    }
    console.log(`\n📁 ${outFile}\n`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
