#!/usr/bin/env node
/**
 * Set DATABASE_URL in repo-root .env without sed (Mac-safe).
 * Usage: npm run env:db-set
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

console.error('\n── Set DATABASE_URL in repo-root .env ──');
console.error('File:', ENV_PATH);
console.error('');
console.error('1. Open https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/database');
console.error('2. Click Connect → Session pooler → port 5432 → copy the URI');
console.error('3. Paste the full postgresql://… line below (not the anon or service_role JWT)\n');

rl.question('Paste DATABASE_URL: ', (uri) => {
  uri = uri.trim().replace(/^['"]|['"]$/g, '');
  if (!uri.startsWith('postgresql://') && !uri.startsWith('postgres://')) {
    console.error('\n❌ Must start with postgresql:// — paste the URI from Supabase Connect.');
    rl.close();
    process.exit(1);
  }

  let body = '';
  if (fs.existsSync(ENV_PATH)) {
    body = fs.readFileSync(ENV_PATH, 'utf8');
  }
  const lines = body.split('\n').filter((l) => !/^DATABASE_URL=/.test(l.trim()));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const next = [...lines, `DATABASE_URL=${uri}`, ''].join('\n');
  fs.writeFileSync(ENV_PATH, next, 'utf8');

  console.error('\n✅ Wrote DATABASE_URL to', ENV_PATH);
  console.error('Verify: npm run env:db-check');
  console.error('Then:   npm run dq:runbook\n');
  rl.close();
});
