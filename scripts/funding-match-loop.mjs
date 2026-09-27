#!/usr/bin/env node
/**
 * Research → analyze → update the match model.
 *
 * 1. funding:attention extracts why a trusted raise happened
 * 2. funding:research extracts amount, round, problem, and team
 * 3. funding:match-model folds that into investors.signals.match_model
 *
 * Preview reads the model on the next match. No paid model. No GOD retune.
 *
 *   npm run funding:match-loop
 *   npm run funding:match-loop -- --apply
 */
import { spawnSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const steps = [
  ['funding:attention', apply ? ['--apply', '--limit=100'] : ['--limit=40']],
  ['funding:research', apply ? ['--apply', '--limit=80'] : ['--limit=40']],
  ['funding:match-model', apply ? ['--apply', '--event-limit=400'] : ['--event-limit=80']],
];

let failed = 0;
for (const [script, args] of steps) {
  console.log(`\n▶ npm run ${script} -- ${args.join(' ')}`);
  const result = spawnSync('npm', ['run', script, '--', ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`step failed: ${script} (${result.status})`);
  }
}

if (failed) {
  console.error(`match loop finished with ${failed} failed step(s)`);
  process.exit(1);
}
console.log('\nmatch loop finished');
