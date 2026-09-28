#!/usr/bin/env node
/**
 * Research → analyze → update the match model.
 *
 * 1. funding:attention extracts why a trusted raise happened
 * 2. funding:research extracts amount, round, problem, and team
 * 3. funding:match-model folds that into investors.signals.match_model
 * 4. learn:god-weights is the sidebar. It steps startup GOD shares from those
 *    funded rounds. A failed or no-change sidebar does not stop the loop.
 *    --no-sidebar skips that writer. Scheduled runs use it so CI does not
 *    edit GOD source files that never get committed.
 *
 *   npm run funding:match-loop
 *   npm run funding:match-loop -- --apply
 *   npm run funding:match-loop -- --apply --no-sidebar
 */
import { spawnSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const skipSidebar = process.argv.includes('--no-sidebar');
const steps = [
  ['funding:attention', apply ? ['--apply', '--limit=100'] : ['--limit=40']],
  ['funding:research', apply ? ['--apply', '--limit=80'] : ['--limit=40']],
  ['funding:match-model', apply ? ['--apply', '--event-limit=400'] : ['--event-limit=80']],
];

const sidebar = ['learn:god-weights', apply ? ['--apply', '--limit=500'] : ['--limit=200']];

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

if (skipSidebar) {
  console.log('\n▶ sidebar skipped (--no-sidebar)');
} else {
  console.log(`\n▶ sidebar npm run ${sidebar[0]} -- ${sidebar[1].join(' ')}`);
  const side = spawnSync('npm', ['run', sidebar[0], '--', ...sidebar[1]], {
    stdio: 'inherit',
    env: process.env,
  });
  if (side.status !== 0) console.error('sidebar learner did not change weights this pass');
}

if (failed) {
  console.error(`match loop finished with ${failed} failed step(s)`);
  process.exit(1);
}
console.log('\nmatch loop finished');
