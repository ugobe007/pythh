#!/usr/bin/env node
/**
 * Market research snapshot — RSS + internal events + signup velocity vs north star.
 *
 * Usage:
 *   node scripts/research-snapshot.mjs
 *   node scripts/research-snapshot.mjs --json --days=7
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { buildResearchSnapshot } = require('../server/lib/marketResearch.js');

const JSON_OUT = process.argv.includes('--json');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const report = await buildResearchSnapshot(sb, { days });

  const outDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `research-snapshot-${report.generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const v = report.signup_velocity || {};
    console.log(`\n🔭 Research snapshot (${days}d)`);
    console.log(`   North star: ${report.north_star}`);
    if (!v.error) {
      console.log(`   Signups: ${v.signups_per_day}/day (${v.pct_of_target}% of 100/day target)`);
      console.log(`   Gap: ${v.gap_to_target} signups/day`);
    }
    console.log(`   RSS feeds scanned: ${(report.rss_scan || []).length}`);
    console.log(`   Internal event friction hits: ${report.internal_events?.friction_hits ?? 0}`);
    if (report.internal_events?.top_friction_categories?.length) {
      console.log('   Top friction categories:');
      for (const c of report.internal_events.top_friction_categories.slice(0, 5)) {
        console.log(`     · ${c.category_id}: ${c.count}`);
      }
    }
    console.log(`\n📁 ${outFile}\n`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
