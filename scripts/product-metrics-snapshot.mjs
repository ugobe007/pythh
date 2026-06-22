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
import * as dotenv from 'dotenv';

dotenv.config();

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
