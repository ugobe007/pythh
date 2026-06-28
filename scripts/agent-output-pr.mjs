#!/usr/bin/env node
/**
 * Open a PR for agent-generated registry/spec changes (CI only).
 *
 * Usage:
 *   node scripts/agent-output-pr.mjs
 *   node scripts/agent-output-pr.mjs --dry
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const date = new Date().toISOString().slice(0, 10);

const TRACKED_PREFIXES = [
  'agents/product/specs/',
  'agents/product/opportunity-registry.json',
  'agents/growth/experiment-registry.json',
  'agents/research/briefs/',
  'agents/growth/outbound/',
];

function git(args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function main() {
  if (!process.env.GITHUB_ACTIONS) {
    console.log('agent-output-pr: skipped (not in CI)');
    return;
  }

  const status = git(['status', '--porcelain']);
  if (status.status !== 0) {
    console.error('git status failed:', status.stderr);
    process.exit(1);
  }

  const changed = status.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((file) => TRACKED_PREFIXES.some((p) => file.startsWith(p) || file === p.replace(/\/$/, '')));

  if (!changed.length) {
    console.log('agent-output-pr: no tracked agent files changed');
    return;
  }

  const branch = `agent/daily-${date}`;
  console.log(`agent-output-pr: ${changed.length} file(s) → ${branch}`);
  for (const f of changed) console.log(`   · ${f}`);

  if (DRY) return;

  const steps = [
    ['checkout', '-b', branch],
    ['add', ...changed],
    [
      'commit',
      '-m',
      `Agent autopilot outputs ${date}\n\nAuto-generated registry/spec updates from daily agent run.`,
    ],
    ['push', '-u', 'origin', branch],
  ];

  for (const args of steps) {
    const r = git(args);
    if (r.status !== 0) {
      if (args[0] === 'commit') {
        console.log('agent-output-pr: commit skipped (nothing to commit?)');
        return;
      }
      console.error(`git ${args[0]} failed:`, r.stderr || r.stdout);
      process.exit(r.status || 1);
    }
  }

  const bodyPath = path.join(repoRoot, 'reports', `.agent-pr-body-${date}.md`);
  fs.mkdirSync(path.dirname(bodyPath), { recursive: true });
  fs.writeFileSync(
    bodyPath,
    `## Summary\n- Daily agent autopilot updated ${changed.length} tracked file(s).\n\n## Files\n${changed.map((f) => `- \`${f}\``).join('\n')}\n\n## Test plan\n- [ ] Review spec/registry diffs\n- [ ] Merge if changes align with orchestrator brief\n`,
  );

  const pr = spawnSync(
    'gh',
    [
      'pr',
      'create',
      '--title',
      `Agent outputs ${date}`,
      '--body-file',
      bodyPath,
      '--base',
      'main',
      '--head',
      branch,
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );

  if (pr.status !== 0) {
    console.error('gh pr create failed');
    process.exit(pr.status || 1);
  }
}

main();
