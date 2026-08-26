#!/usr/bin/env node
/**
 * Preflight for Hit@5 ops scripts — run from repo root:
 *   npm run hit5:doctor
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pkgPath = path.join(root, 'package.json');
const envPath = path.join(root, '.env');

function ok(msg) {
  console.log(`  OK  ${msg}`);
}
function fail(msg) {
  console.log(`  FAIL ${msg}`);
}

console.log('Hit@5 ops doctor\n');
console.log(`cwd: ${root}`);

if (!fs.existsSync(pkgPath)) {
  fail('package.json not found — cd to the repo root (folder with package.json name pythai)');
  process.exit(1);
}
ok('package.json found');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const requiredScripts = [
  'funding:match-funding-audit',
  'funding:participants:seed-indeterminate',
  'funding:ingest:audited:apply',
  'funding:corroborate:apply',
  'funding:coverage:investors:resolve:apply',
  'funding:repair:organization-links:apply',
];
for (const name of requiredScripts) {
  if (!pkg.scripts?.[name]) {
    fail(`npm script missing: ${name} — git pull origin main`);
  } else {
    ok(`script ${name}`);
  }
}

if (!fs.existsSync(envPath)) {
  fail('.env missing at repo root — copy from teammate or npm run env:open');
} else {
  ok('.env exists');
  const envText = fs.readFileSync(envPath, 'utf8');
  const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  for (const key of need) {
    const re = new RegExp(`^${key}=.+`, 'm');
    if (!re.test(envText)) fail(`${key} not set in .env`);
    else ok(`${key} present`);
  }
  if (/^GEMINI_API_KEY=.+$/m.test(envText)) ok('GEMINI_API_KEY present');
  else console.log('  WARN GEMINI_API_KEY missing — inference search still works; gemini provider will fail');
}

const nodeV = process.version;
ok(`node ${nodeV}`);

const probe = spawnSync('node', ['scripts/art-gemini-probe.mjs'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 30000,
});
if (probe.status === 0 && probe.stdout?.includes('OK')) ok('Gemini probe');
else if (probe.stderr?.includes('missing_api_key')) console.log('  WARN Gemini probe: no API key');
else if (probe.error) fail(`Gemini probe: ${probe.error.message}`);
else console.log('  WARN Gemini probe failed — check GEMINI_API_KEY');

console.log('\nIf all OK, run the wave (one step at a time):\n');
console.log('  npm run hit5:wave:apply\n');
console.log('Or stepwise:\n');
console.log('  npm run funding:participants:seed-indeterminate -- --apply');
console.log('  npm run funding:ingest:audited:apply');
console.log('  npm run funding:corroborate:apply');
console.log('  npm run funding:coverage:investors:resolve:apply');
console.log('  npm run funding:repair:organization-links:apply');
console.log('  npm run funding:match-funding-audit');
