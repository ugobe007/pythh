#!/usr/bin/env node
/**
 * Ship agent autopilot outputs — code fixes + registry/spec updates.
 *
 * Modes:
 *   --push-main (default when AGENT_ALLOW_PUSH=1) — commit + push leftovers to main
 *   --pr-only — open a PR branch (legacy / review gate)
 *
 * Usage:
 *   node scripts/agent-autopilot-ship.mjs
 *   node scripts/agent-autopilot-ship.mjs --dry
 *   node scripts/agent-autopilot-ship.mjs --pr-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  CODE_PREFIXES,
  getChangedShippableFiles,
  git,
  hasAgentCommitToday,
  isPushMainMode,
  latestAgentSummary,
  runShipChecks,
  writeShipReport,
} from './lib/agentAutopilotShip.mjs';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const PUSH_MAIN = isPushMainMode();
const date = new Date().toISOString().slice(0, 10);

function pushMainShip({ changed, agentSummary, checks }) {
  const commitBody = agentSummary
    ? `${agentSummary.excerpt}\n\nSource: ${agentSummary.file}`
    : 'Daily agent autopilot improvements.';
  const commitMsg = `feat(agents): autopilot ship ${date}\n\n${commitBody}`;

  if (DRY) {
    writeShipReport(repoRoot, date, {
      generated_at: new Date().toISOString(),
      date,
      shipped: false,
      dry_run: true,
      mode: 'push_main',
      files: changed,
      agent_summary: agentSummary,
    });
    return;
  }

  const add = git(repoRoot, ['add', ...changed]);
  if (add.status !== 0) {
    console.error('git add failed:', add.stderr || add.stdout);
    process.exit(add.status || 1);
  }

  const stagedDiff = git(repoRoot, ['diff', '--cached', '--quiet']);
  if (stagedDiff.status === 0) {
    console.log('agent-autopilot-ship: staged diff empty (agent already committed)');
    writeShipReport(repoRoot, date, {
      generated_at: new Date().toISOString(),
      date,
      shipped: true,
      mode: 'push_main',
      reason: 'already_shipped',
      files: changed,
      agent_summary: agentSummary,
    });
    return;
  }

  const commit = git(repoRoot, ['commit', '-m', commitMsg]);
  if (commit.status !== 0) {
    console.log('agent-autopilot-ship: commit skipped (nothing new?)');
    writeShipReport(repoRoot, date, {
      generated_at: new Date().toISOString(),
      date,
      shipped: hasAgentCommitToday(repoRoot, date),
      mode: 'push_main',
      reason: hasAgentCommitToday(repoRoot, date) ? 'agent_direct_push' : 'commit_empty',
      files: changed,
      agent_summary: agentSummary,
    });
    return;
  }

  const push = git(repoRoot, ['push', 'origin', 'HEAD']);
  if (push.status !== 0) {
    console.error('git push failed:', push.stderr || push.stdout);
    process.exit(push.status || 1);
  }

  console.log('agent-autopilot-ship: pushed leftovers to main');
  writeShipReport(repoRoot, date, {
    generated_at: new Date().toISOString(),
    date,
    shipped: true,
    mode: 'push_main',
    reason: 'leftovers_pushed',
    files: changed,
    agent_summary: agentSummary,
    checks,
  });
}

function prShip({ changed, agentSummary, checks }) {
  const branch = `agent/autopilot-ship-${date}`;
  const commitBody = agentSummary
    ? `${agentSummary.excerpt}\n\nSource: ${agentSummary.file}`
    : 'Daily agent autopilot improvements.';
  const commitMsg = `Agent autopilot ship ${date}\n\n${commitBody}`;

  if (DRY) {
    writeShipReport(repoRoot, date, {
      generated_at: new Date().toISOString(),
      date,
      shipped: false,
      dry_run: true,
      mode: 'pr',
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
    const r = git(repoRoot, args);
    if (r.status !== 0) {
      if (args[0] === 'commit') {
        writeShipReport(repoRoot, date, {
          generated_at: new Date().toISOString(),
          date,
          shipped: hasAgentCommitToday(repoRoot, date),
          mode: 'pr',
          reason: hasAgentCommitToday(repoRoot, date) ? 'agent_direct_push' : 'commit_empty',
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
    const existing = git(repoRoot, ['pr', 'list', '--head', branch, '--json', 'url', '--jq', '.[0].url']);
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

  writeShipReport(repoRoot, date, {
    generated_at: new Date().toISOString(),
    date,
    shipped: true,
    mode: 'pr',
    branch,
    pr_url: prUrl,
    files: changed,
    code_files: codeFiles,
    registry_files: registryFiles,
    agent_summary: agentSummary,
    checks,
  });
}

function main() {
  if (!process.env.GITHUB_ACTIONS && !FORCE) {
    console.log('agent-autopilot-ship: skipped (not CI; use --force locally)');
    return;
  }

  const changed = getChangedShippableFiles(repoRoot);
  const agentSummary = latestAgentSummary(repoRoot);

  if (!changed.length) {
    const agentPushed = hasAgentCommitToday(repoRoot, date);
    console.log(
      agentPushed
        ? 'agent-autopilot-ship: no leftovers — agent already pushed to main'
        : 'agent-autopilot-ship: no shippable changes',
    );
    writeShipReport(repoRoot, date, {
      generated_at: new Date().toISOString(),
      date,
      shipped: agentPushed,
      mode: PUSH_MAIN ? 'push_main' : 'pr',
      reason: agentPushed ? 'agent_direct_push' : 'no_changes',
      agent_summary: agentSummary,
    });
    return;
  }

  console.log(`agent-autopilot-ship: ${changed.length} file(s) (${PUSH_MAIN ? 'push-main' : 'pr'})`);
  for (const f of changed) console.log(`   · ${f}`);

  const checks = runShipChecks(repoRoot, changed);
  if (!checks.ok) {
    console.error(`agent-autopilot-ship: blocked — ${checks.failed} failed`);
    writeShipReport(repoRoot, date, {
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

  if (PUSH_MAIN) {
    pushMainShip({ changed, agentSummary, checks });
  } else {
    prShip({ changed, agentSummary, checks });
  }
}

main();
