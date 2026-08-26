#!/usr/bin/env node
/**
 * Run Hit@5 participant wave — sequential, from repo root.
 *   npm run hit5:wave:apply
 */
import { spawnSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const steps = apply
  ? [
      ['npm', ['run', 'funding:participants:seed-indeterminate', '--', '--apply']],
      ['npm', ['run', 'funding:ingest:audited:apply']],
      ['npm', ['run', 'funding:corroborate:apply']],
      ['npm', ['run', 'funding:coverage:investors:resolve:apply']],
      ['npm', ['run', 'funding:repair:organization-links:apply']],
      ['npm', ['run', 'funding:match-funding-audit']],
    ]
  : [
      ['npm', ['run', 'hit5:doctor']],
    ];

for (const [cmd, args] of steps) {
  console.log(`\n========== ${cmd} ${args.join(' ')} ==========\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    console.error(`\nStopped: ${cmd} exited ${r.status ?? 1}`);
    process.exit(r.status ?? 1);
  }
}
