#!/usr/bin/env node
/**
 * Export the public Oracle book (pythh.ai/portfolio) as a CSV for LP / investor review.
 *
 *   npm run portfolio:export-csv
 *   node scripts/export-pythiam-portfolio-csv.mjs --out reports/pythiam-portfolio.csv
 *
 * Default source is the live public API so the file matches the scoreboard gate
 * (quarantined / junk / written-off rows stay off).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  PORTFOLIO_API_URL,
  portfolioEntriesToCsv,
} from '../lib/pythiamPortfolioCsv.mjs';

function argValue(flag, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}

const outArg = argValue('--out');
const sort = argValue('--sort', 'health');
const apiBase = argValue('--api', PORTFOLIO_API_URL);
const today = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(outArg || `reports/pythiam-portfolio-${today}.csv`);

const url = new URL(apiBase);
url.searchParams.set('sort', sort);
url.searchParams.set('limit', '500');

const res = await fetch(url, {
  headers: { Accept: 'application/json', 'User-Agent': 'pythh-portfolio-csv/1.0' },
});
if (!res.ok) {
  throw new Error(`portfolio API ${res.status} ${res.statusText} (${url})`);
}
const payload = await res.json();
const entries = Array.isArray(payload.entries) ? payload.entries : [];
if (!entries.length) throw new Error('portfolio API returned no public entries');

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, portfolioEntriesToCsv(entries));

const byStatus = Object.fromEntries(
  [...new Set(entries.map((e) => e.status || 'unknown'))].map((status) => [
    status,
    entries.filter((e) => (e.status || 'unknown') === status).length,
  ]),
);

console.log(
  JSON.stringify(
    {
      source: url.toString(),
      out: outPath,
      rows: entries.length,
      status: byStatus,
    },
    null,
    2,
  ),
);
