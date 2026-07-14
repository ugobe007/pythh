#!/usr/bin/env node
/**
 * Ship agent autopilot outputs — code fixes + registry/spec updates as a PR.
 *
 * Runs after daily LLM agents in CI. Commits allowed paths when smoke tests pass.
 *
 * Usage:
 *   node scripts/agent-autopilot-ship.mjs
 *   node scripts/agent-autopilot-ship.mjs --dry
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const date = new Date().toISOString().slice(0, 10);

const CODE_PREFIXES = ['site/', 'server/', 'lib/', 'scripts/'];
const REGISTRY_PREFIXES = [
  'agents/product/specs/',
  'agents/product/opportunity-registry.json',
  'agents/growth/experiment-registry.json',
  'agents/research/briefs/',
  'agents/research/findings-registry.json',
  'agents/growth/outbound/',
];

const BLOCKED_PATHS = [
  '.env',
  'package-lock.json',
  'node_modules/',
  '.DS_Store',
];

function git(args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function isShippable(file) {
  if (!file || BLOCKED_PATHS.some((b) => file.includes(b))) return false;
  return (
    CODE_PREFIXES.some((p) => file.startsWith(p)) ||
    REGISTRY_PREFIXES.some((p) => file.startsWith(p) || file === p.replace(/\/$/, ''))
  );
}

function getChangedFiles() {
  const status = git(['status', '--porcelain']);
  if (status.status !== 0) throw new Error(`git status failed: ${status.stderr}`);
  return status.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(isShippable);
}

function latestAgentSummary() {
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

function runChecks(changed) {
  const needsCodeChecks = changed.some((f) => CODE_PREFIXES.some((p) => f.startsWith(p)));
  if (!needsCodeChecks) return { ok: true, skipped: true };

  const steps = [
    ['npm run test:wizard-smoke', 'wizard smoke'],
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

function writeShipReport(payload) {
  const reportsDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const out = path.join(reportsDir, `agent-autopilot-ship-${date}.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`📁 Ship report: ${out}`);
}

function main() {
  if (!process.env.GITHUB_ACTIONS && !FORCE) {
    console.log('agent-autopilot-ship: skipped (not CI; use --force locally)');
    return;
  }

  const changed = getChangedFiles();
  const agentSummary = latestAgentSummary();

  if (!changed.length) {
    console.log('agent-autopilot-ship: no shippable changes');
    writeShipReport({
      generated_at: new Date().toISOString(),
      date,
      shipped: false,
      reason: 'no_changes',
      agent_summary: agentSummary,
    });
    return;
  }

  console.log(`agent-autopilot-ship: ${changed.length} file(s)`);
  for (const f of changed) console.log(`   · ${f}`);

  const checks = runChecks(changed);
  if (!checks.ok) {
    console.error(`agent-autopilot-ship: blocked — ${checks.failed} failed`);
    writeShipReport({
      generated_at: new Date().toISOString(),
      date,
      shipped: false,
      reason: 'tests_failed',
      failed_check: checks.failed,
      files: changed,
      agent_summary: agentSummary,
    });
    process.exit(1);
  }

  const branch = `agent/autopilot-ship-${date}`;
  const commitBody = agentSummary
    ? `${agentSummary.excerpt}\n\nSource: ${agentSummary.file}`
    : 'Daily agent autopilot improvements.';
  const commitMsg = `Agent autopilot ship ${date}\n\n${commitBody}`;

  if (DRY) {
    console.log(`agent-autopilot-ship: dry-run → branch ${branch}`);
    writeShipReport({
      generated_at: new Date().toISOString(),
      date,
      shipped: false,
      dry_run: true,
      branch,
      files: changed,
      agent_summary: agentSummary,
    });
    return;
  }

  const steps = [
    ['checkout', '-B', branch],
    ['add', ...changed],
    ['commit', '-m', commitMsg],
    ['push', '-f', '-u', 'origin', branch],
  ];

  for (const args of steps) {
    const r = git(args);
    if (r.status !== 0) {
      if (args[0] === 'commit') {
        console.log('agent-autopilot-ship: commit skipped (nothing new?)');
        writeShipReport({
          generated_at: new Date().toISOString(),
          date,
          shipped: false,
          reason: 'commit_empty',
          files: changed,
        });
        return;
      }
      console.error(`git ${args[0]} failed:`, r.stderr || r.stdout);
      process.exit(r.status || 1);
    }
  }

  const bodyPath = path.join(repoRoot, 'reports', `.agent-ship-pr-body-${date}.md`);
  const codeFiles = changed.filter((f) => CODE_PREFIXES.some((p) => f.startsWith(p)));
  const registryFiles = changed.filter((f) => !codeFiles.includes(f));
  fs.writeFileSync(
    bodyPath,
    [
      '## Summary',
      'Daily agent autopilot shipped improvements (code + registry).',
      agentSummary ? `\n**Agent note:** ${agentSummary.excerpt}` : '',
      '',
      '## Code changes',
      codeFiles.length ? codeFiles.map((f) => `- \`${f}\``).join('\n') : '_None_',
      '',
      '## Registry / specs',
      registryFiles.length ? registryFiles.map((f) => `- \`${f}\``).join('\n') : '_None_',
      '',
      '## Checks',
      checks.skipped ? '- Registry-only (smoke tests skipped)' : '- `npm run test:wizard-smoke`',
      checks.skipped ? '' : '- `npm run check:server`',
      '',
      '## Test plan',
      '- [ ] Review diff',
      '- [ ] Merge to deploy improvements',
    ].join('\n'),
  );

  const pr = spawnSync(
    'gh',
    [
      'pr',
      'create',
      '--title',
      `Agent autopilot ship ${date}`,
      '--body-file',
      bodyPath,
      '--base',
      'main',
      '--head',
      branch,
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  let prUrl = null;
  if (pr.status !== 0) {
    const existing = git(['pr', 'list', '--head', branch, '--json', 'url', '--jq', '.[0].url']);
    if (existing.status === 0 && existing.stdout) {
      prUrl = existing.stdout;
      console.log(`agent-autopilot-ship: PR already exists ${prUrl}`);
    } else {
      console.error('gh pr create failed:', pr.stderr || pr.stdout);
      process.exit(pr.status || 1);
    }
  } else {
    prUrl = (pr.stdout || '').trim();
    console.log(`agent-autopilot-ship: PR ${prUrl}`);
  }

  writeShipReport({
    generated_at: new Date().toISOString(),
    date,
    shipped: true,
    branch,
    pr_url: prUrl,
    files: changed,
    code_files: codeFiles,
    registry_files: registryFiles,
    agent_summary: agentSummary,
    checks,
  });
}

main();
