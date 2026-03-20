#!/usr/bin/env node
/**
 * SIGNAL PIPELINE — P1 Automatic Scraping Orchestrator
 * ─────────────────────────────────────────────────────────────────────────
 * Runs the full signal ingestion + enrichment + scoring chain in sequence:
 *   1. RSS scrape (ssot-rss-scraper) → startup_events
 *   2. Enrich from RSS news → startup_uploads, funding_outcomes
 *   3. Recalculate GOD scores (runs automatically inside enrich if updates > 0)
 *
 * Usage:
 *   node scripts/cron/signal-pipeline.js           # Full pipeline
 *   node scripts/cron/signal-pipeline.js --rss-only   # Just RSS scrape
 *   node scripts/cron/signal-pipeline.js --enrich-only # Just enrich (skip RSS)
 *
 * Schedule via PM2 cron or system cron:
 *   cron_restart: '0 */4 * * *'  # Every 4 hours
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: ROOT,
      shell: process.platform === 'win32',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`))));
  });
}

async function main() {
  const rssOnly = process.argv.includes('--rss-only');
  const enrichOnly = process.argv.includes('--enrich-only');

  console.log('\n🔄 SIGNAL PIPELINE');
  console.log('═'.repeat(60));
  const start = Date.now();

  try {
    if (!enrichOnly) {
      console.log('\n1️⃣  RSS scrape (ssot-rss-scraper)...\n');
      await run('npx', ['tsx', 'scripts/core/ssot-rss-scraper.js'], 'rss-scraper');
    }

    if (!rssOnly) {
      console.log('\n2️⃣  Enrich from RSS news (→ recalculate-scores if updates)...\n');
      await run('node', ['scripts/enrich-from-rss-news.js', '--all'], 'enrich-from-rss-news');
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Pipeline complete in ${elapsed}s\n`);
  } catch (err) {
    console.error('\n❌ Pipeline failed:', err.message);
    process.exit(1);
  }
}

main();
