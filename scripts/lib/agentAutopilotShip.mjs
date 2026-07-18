/**
 * Shared ship helpers for agent autopilot — commit/push leftovers after LLM agents run.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CODE_PREFIXES = ['site/', 'server/', 'lib/', 'scripts/'];
export const REGISTRY_PREFIXES = [
  'agents/product/specs/',
  'agents/product/opportunity-registry.json',
  'agents/growth/experiment-registry.json',
  'agents/research/briefs/',
  'agents/research/findings-registry.json',
  'agents/growth/outbound/',
];

export const BLOCKED_PATHS = ['.env', 'package-lock.json', 'node_modules/', '.DS_Store'];

export function isPushMainMode(argv = process.argv) {
  return (
    argv.includes('--push-main') ||
    (process.env.AGENT_ALLOW_PUSH === '1' && !argv.includes('--pr-only'))
  );
}

export function git(repoRoot, args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

export function isShippable(file) {
  if (!file || BLOCKED_PATHS.some((b) => file.includes(b))) return false;
  return (
    CODE_PREFIXES.some((p) => file.startsWith(p)) ||
    REGISTRY_PREFIXES.some((p) => file.startsWith(p) || file === p.replace(/\/$/, ''))
  );
}

export function getChangedShippableFiles(repoRoot) {
  const status = git(repoRoot, ['status', '--porcelain']);
  if (status.status !== 0) throw new Error(`git status failed: ${status.stderr}`);
  return status.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(isShippable);
}

export function hasAgentCommitToday(repoRoot, date) {
  const log = git(repoRoot, ['log', '--since', `${date}T00:00:00Z`, '--oneline', '--grep=Agent', '-i']);
  if (log.status !== 0) return false;
  const lines = log.stdout.split('\n').filter(Boolean);
  const agentPatterns = [/growth agent/i, /product agent/i, /research agent/i, /feat\(.*\):/i, /agent autopilot/i];
  return lines.some((line) => agentPatterns.some((p) => p.test(line)));
}

export function latestAgentSummary(repoRoot) {
  const reportsDir = path.join(repoRoot, 'reports');
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => /-(agent-run-|agent-)\d{4}-\d{2}-\d{2}/.test(f) && f.endsWith('.json'))
    .sort()
    .reverse();
  for (const f of files.slice(0, 5)) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(reportsDir, f), 'utf8'));
      const text =
        typeof data.result === 'string'
          ? data.result
          : data.result?.summary || data.summary || data.executive_summary;
      if (text) {
        return {
          file: f,
          agent: f.split('-')[0],
          excerpt: String(text).replace(/\s+/g, ' ').slice(0, 280),
        };
      }
    } catch {
      /* next */
    }
  }
  return null;
}

export function runShipChecks(repoRoot, changed) {
  const needsCodeChecks = changed.some((f) => CODE_PREFIXES.some((p) => f.startsWith(p)));
  if (!needsCodeChecks) return { ok: true, skipped: true };

  const steps = [
    ['npm run test:wizard-smoke', 'wizard API smoke'],
    ['npm run test:wizard-e2e', 'wizard unlock E2E'],
    ['npm run check:server', 'server load check'],
  ];

  for (const [cmd, label] of steps) {
    console.log(`   ▶ ${label}`);
    const r = spawnSync(cmd, { shell: true, cwd: repoRoot, stdio: 'inherit', env: process.env });
    if (r.status !== 0) {
      return { ok: false, failed: label };
    }
  }
  return { ok: true, skipped: false };
}

export function writeShipReport(repoRoot, date, payload) {
  const reportsDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const out = path.join(reportsDir, `agent-autopilot-ship-${date}.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`📁 Ship report: ${out}`);
  return out;
}
