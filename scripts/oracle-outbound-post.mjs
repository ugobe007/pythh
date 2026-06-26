#!/usr/bin/env node
/**
 * Generate Oracle scoreboard outbound posts for X / LinkedIn.
 *
 * Usage:
 *   node scripts/oracle-outbound-post.mjs
 *   node scripts/oracle-outbound-post.mjs --format=linkedin
 *   node scripts/oracle-outbound-post.mjs --startup-url=https://example.com
 */

import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { computeTrackRecord } = require('../server/lib/portfolioTrackRecord.js');

const args = process.argv.slice(2);
const format = (args.find((a) => a.startsWith('--format=')) || '--format=x').split('=')[1];
const startupUrl = (args.find((a) => a.startsWith('--startup-url=')) || '').split('=').slice(1).join('=');

const SITE_BASE = (process.env.SITE_URL || 'https://pythh.ai').replace(/\/$/, '');
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'reports', 'outbound');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function previewLink(url) {
  const encoded = encodeURIComponent(url || '');
  return `${SITE_BASE}/matches?url=${encoded}&utm_source=${format}&utm_medium=social&utm_campaign=oracle_scoreboard`;
}

function findInvestorsLink() {
  return `${SITE_BASE}/find-investors?utm_source=${format}&utm_medium=social&utm_campaign=oracle_scoreboard`;
}

async function main() {
  const record = await computeTrackRecord(sb);
  const metrics = record?.oracle || {};
  const featured = record?.featured_pick;
  const top = (record?.top_performers || [])[0];

  const proofLine =
    metrics.verified_funded_picks > 0
      ? `${metrics.verified_funded_picks} Oracle picks verified funded${metrics.verified_funded_rate_pct ? ` (${metrics.verified_funded_rate_pct}% of picks)` : ''}.`
      : metrics.funded_picks > 0
        ? `${metrics.funded_picks} Oracle picks detected with funding signals.`
        : `Oracle tracks ${metrics.total_picks || 0} GOD 70+ picks live.`;

  const exampleLine = featured?.name
    ? `Example: ${featured.name} entered at GOD ${featured.entry_god_score}${featured.verified ? ' — press-verified raise' : ''}.`
    : top?.name
      ? `Top performer: ${top.name} (GOD ${top.entry_god_score} at entry${top.moic ? `, ${top.moic}× MOIC` : ''}).`
      : '';

  const ctaUrl = startupUrl ? previewLink(startupUrl) : findInvestorsLink();
  const ctaText = startupUrl
    ? 'Paste your URL — see your GOD score + investor matches in ~30 sec (free preview):'
    : 'Built for founders without warm intros — free match preview:';

  const xPost = [
    proofLine,
    exampleLine,
    '',
    'The Oracle reads your startup like a partner meeting — GOD score, gap map, ranked investors.',
    '',
    ctaText,
    ctaUrl,
    '',
    `#startups #venture #fundraising`,
  ]
    .filter(Boolean)
    .join('\n');

  const linkedinPost = [
    'Most founders waste weeks on static investor lists.',
    '',
    `Pythh Oracle does the opposite: ${proofLine.toLowerCase()}`,
    exampleLine,
    '',
    'Paste your startup URL → GOD score + thesis-fit investor shortlist in ~30 seconds. No signup required for preview.',
    '',
    ctaText,
    ctaUrl,
  ]
    .filter(Boolean)
    .join('\n\n');

  const body = format === 'linkedin' ? linkedinPost : xPost;

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = path.join(outDir, `oracle-scoreboard-${format}-${stamp}.md`);
  const content = `# Oracle scoreboard outbound (${format})\n\nGenerated: ${new Date().toISOString()}\n\n---\n\n${body}\n\n---\n\nPortfolio: ${SITE_BASE}/portfolio\n`;
  fs.writeFileSync(outFile, content);

  console.log(body);
  console.log(`\n📁 Saved: ${outFile}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
