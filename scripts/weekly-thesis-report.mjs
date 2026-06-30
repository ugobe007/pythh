#!/usr/bin/env node
/**
 * Weekly public thesis report — sector Thesis Fit Index + outbound queue.
 *
 * Usage:
 *   npm run report:weekly-thesis
 *   node scripts/weekly-thesis-report.mjs --sector=Fintech
 *   node scripts/weekly-thesis-report.mjs --json
 *   node scripts/weekly-thesis-report.mjs --no-queue
 *
 * Outputs:
 *   reports/weekly-thesis-YYYY-MM-DD.json
 *   agents/growth/outbound/queue/YYYY-MM-DD-weekly-thesis.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { generateWeeklyThesisReport } = require('../server/lib/weeklyThesisReport.js');

const args = process.argv.slice(2);
const argVal = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const hasFlag = (f) => args.includes(f);

const SECTOR = argVal('--sector');
const DAYS = parseInt(argVal('--days', '7'), 10);
const JSON_MODE = hasFlag('--json');
const NO_QUEUE = hasFlag('--no-queue');

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(repoRoot, 'reports');
const queueDir = path.join(repoRoot, 'agents', 'growth', 'outbound', 'queue');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { report, markdown, queueMarkdown } = await generateWeeklyThesisReport(sb, {
    sector: SECTOR || undefined,
    days: DAYS,
  });

  fs.mkdirSync(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, `weekly-thesis-${report.report_date}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const spotlightPath = path.join(repoRoot, 'public', 'thesis-spotlight.json');
  const s = report.sector;
  fs.writeFileSync(
    spotlightPath,
    JSON.stringify(
      {
        report_date: report.report_date,
        featured_sector: report.featured_sector,
        god70_plus: s.god70_plus,
        god70_pct: s.god70_pct,
        investors_early_stage: s.investors.active_early_stage || s.investors.early_stage,
        new_this_week: s.new_7d,
        top_names: (s.top_startups || []).slice(0, 3).map((row) => ({
          name: row.name,
          score: row.score,
        })),
        updated_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  let queuePath = null;
  if (!NO_QUEUE) {
    fs.mkdirSync(queueDir, { recursive: true });
    queuePath = path.join(queueDir, `${report.report_date}-weekly-thesis.md`);
    fs.writeFileSync(queuePath, queueMarkdown);
  }

  if (JSON_MODE) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const s = report.sector;
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  Pythh Weekly: ${report.featured_sector} Thesis Fit`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`  Approved pipeline: ${report.global.approved_startups.toLocaleString()} startups`);
    console.log(`  Investors profiled: ${report.global.investors_profiled.toLocaleString()}`);
    console.log('');
    console.log('  Thesis Fit Index');
    console.log(`    GOD 70+:        ${s.god70_plus} (${s.god70_pct}% of sector)`);
    console.log(`    Pre-seed/seed:  ${s.investors.active_early_stage || s.investors.early_stage} investors`);
    console.log(`    Active deploy:  ${s.investors.active_deploy} investors`);
    console.log('');
    console.log('  Signal Delta (7d)');
    console.log(`    New approved:   ${s.new_7d} (${s.signal_delta >= 0 ? '+' : ''}${s.signal_delta} vs prior 7d)`);
    console.log(`    Slop filter:    ${s.slop_filter_pct}% AI-tagged & score <50`);
    console.log('');
    if (s.top_startups.length) {
      console.log('  Top names (GOD 70+)');
      for (const t of s.top_startups.slice(0, 3)) {
        console.log(`    · ${t.name} — ${t.score}`);
      }
      console.log('');
    }
    console.log(`  CTA: ${report.cta}\n`);
    console.log('--- LinkedIn preview ---\n');
    console.log(report.social.linkedin);
    console.log(`\n📁 JSON:  ${jsonPath}`);
    if (queuePath) console.log(`📁 Queue: ${queuePath}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
