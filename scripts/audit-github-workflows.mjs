#!/usr/bin/env node
/**
 * Audit recent GitHub Actions workflow runs (public API or GH_TOKEN).
 *
 * Usage:
 *   npm run audit:workflows
 *   GITHUB_REPO=owner/repo npm run audit:workflows
 *   GH_TOKEN=... npm run audit:workflows   # higher rate limits
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(repoRoot, 'reports');

function resolveRepo() {
  if (process.env.GITHUB_REPO?.trim()) return process.env.GITHUB_REPO.trim();
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (m) return m[1].replace(/\.git$/, '');
  } catch {
    /* ignore */
  }
  return 'ugobe007/pythh';
}

const REPO = resolveRepo();
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const DAYS = Number(process.env.AUDIT_WORKFLOW_DAYS || 7);
const since = Date.now() - DAYS * 86_400_000;

async function fetchRuns(page = 1) {
  const url = `https://api.github.com/repos/${REPO}/actions/runs?per_page=100&page=${page}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'pythh-audit-workflows',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function summarize(runs) {
  const byWorkflow = new Map();
  const failures = [];

  for (const run of runs) {
    const created = new Date(run.created_at).getTime();
    if (created < since) continue;

    const name = run.name || run.path || 'unknown';
    const bucket = byWorkflow.get(name) || {
      name,
      total: 0,
      success: 0,
      failure: 0,
      cancelled: 0,
      in_progress: 0,
      last_run: null,
      last_conclusion: null,
    };
    bucket.total += 1;
    const conclusion = run.conclusion || run.status || 'unknown';
    if (conclusion === 'success') bucket.success += 1;
    else if (conclusion === 'failure') bucket.failure += 1;
    else if (conclusion === 'cancelled') bucket.cancelled += 1;
    else bucket.in_progress += 1;

    if (!bucket.last_run || created > new Date(bucket.last_run).getTime()) {
      bucket.last_run = run.created_at;
      bucket.last_conclusion = conclusion;
    }

    if (conclusion === 'failure') {
      failures.push({
        workflow: name,
        run_id: run.id,
        created_at: run.created_at,
        url: run.html_url,
        event: run.event,
      });
    }

    byWorkflow.set(name, bucket);
  }

  return {
    repo: REPO,
    window_days: DAYS,
    workflows: [...byWorkflow.values()].sort((a, b) => a.name.localeCompare(b.name)),
    failures: failures.sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

async function main() {
  console.log(`\n🔎 GitHub Actions audit — ${REPO} (last ${DAYS}d)\n`);

  const allRuns = [];
  for (let page = 1; page <= 5; page++) {
    const json = await fetchRuns(page);
    const batch = json.workflow_runs || [];
    allRuns.push(...batch);
    if (batch.length < 100) break;
    const oldest = batch[batch.length - 1];
    if (oldest && new Date(oldest.created_at).getTime() < since) break;
  }

  const report = summarize(allRuns);
  const failing = report.workflows.filter((w) => w.failure > 0);
  const stale = report.workflows.filter((w) => {
    if (!w.last_run) return true;
    return Date.now() - new Date(w.last_run).getTime() > 48 * 3600_000;
  });

  for (const w of report.workflows) {
    const mark = w.failure > 0 ? '⚠️' : w.last_conclusion === 'success' ? '✅' : '❓';
    console.log(
      `${mark} ${w.name.padEnd(36)} runs=${w.total} ok=${w.success} fail=${w.failure} last=${w.last_run?.slice(0, 10) ?? '—'} (${w.last_conclusion})`,
    );
  }

  console.log('\n── Summary ──');
  console.log(`Workflows seen: ${report.workflows.length}`);
  console.log(`Failures (7d):   ${report.failures.length}`);
  console.log(`With failures:   ${failing.length}`);
  console.log(`Stale (>48h):    ${stale.length}`);

  if (report.failures.length) {
    console.log('\nRecent failures:');
    for (const f of report.failures.slice(0, 10)) {
      console.log(`  • ${f.workflow} — ${f.created_at.slice(0, 16)} — ${f.url}`);
    }
  }

  if (!TOKEN) {
    console.log('\nTip: set GH_TOKEN for higher API limits and private repo access.');
  }

  fs.mkdirSync(reportsDir, { recursive: true });
  const out = path.join(reportsDir, `github-workflows-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(out, JSON.stringify({ generated_at: new Date().toISOString(), ...report }, null, 2));
  console.log(`\n📁 ${out}\n`);

  process.exitCode = report.failures.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('[audit:workflows]', err.message || err);
  process.exit(1);
});
