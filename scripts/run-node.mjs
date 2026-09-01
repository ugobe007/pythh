#!/usr/bin/env node
/**
 * Run a node script after the Node version guard passes.
 * Usage: node scripts/run-node.mjs scripts/some-script.mjs -- --flag value
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-node-version.mjs');
const guardResult = spawnSync(process.execPath, [guard], { stdio: 'inherit' });
if (guardResult.status !== 0) process.exit(guardResult.status ?? 1);

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/run-node.mjs <script.mjs> [-- args...]');
  process.exit(1);
}

let args = process.argv.slice(3);
if (args[0] === '--') args = args.slice(1);

const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
