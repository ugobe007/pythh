#!/usr/bin/env node
/**
 * Compare pythh.ai pythh-build meta vs local git HEAD (or EXPECTED_SHA env).
 */
import { execSync } from 'node:child_process';

const ORIGIN = 'https://pythh.ai';
const expected =
  process.env.EXPECTED_SHA?.trim() ||
  execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

const html = await fetch(`${ORIGIN}/?t=${Date.now()}`, {
  headers: { 'Cache-Control': 'no-cache' },
}).then((r) => r.text());

const m = html.match(/name="pythh-build"\s+content="([^"]+)"/);
const live = m?.[1] ?? null;

console.log(`Expected (local HEAD): ${expected}`);
console.log(`Live  (pythh.ai):      ${live ?? '<missing>'}`);

if (!live) {
  console.error('❌ No pythh-build meta — stale or non-Vite deploy');
  process.exit(1);
}

if (live.startsWith(expected.slice(0, 7)) || live === expected) {
  console.log('✅ Frontend deploy matches');
  process.exit(0);
}

console.error('❌ Stale frontend — run Vercel Deploy workflow (see docs/DEPLOY_PYTHH_AI.md)');
process.exit(1);
