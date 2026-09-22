#!/usr/bin/env node
/**
 * Daily Signal trend agent — standalone runner.
 *
 * Compiles today's edition (or loads a saved one), writes the underlying-preference
 * report onto newsletter_editions.data.trendReport, and prints a summary.
 *
 *   npm run newsletter:trends
 *   npm run newsletter:trends -- --date=2026-09-22
 *
 * Does not rematch or retune GOD/fit.
 */
import 'dotenv/config';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { generateNewsletter, loadEdition } = require('../server/newsletter-generator.js');
const { runNewsletterTrendAgent } = require('../server/lib/newsletterTrendAgent.js');
const { getSupabaseClient } = require('../server/lib/supabaseClient.js');

const dateArg = process.argv.find((a) => a.startsWith('--date='))?.slice('--date='.length);
const jsonOut = process.argv.includes('--json');

async function main() {
  let edition = dateArg
    ? (await loadEdition(dateArg)) || await generateNewsletter({ bust: true, date: dateArg })
    : await generateNewsletter({ bust: true });
  
  // If edition exists but lacks trendReport, run the agent and save
  if (!edition?.trendReport) {
    const report = await runNewsletterTrendAgent({
      edition,
      loadPrior: (date) => loadEdition(date),
    });
    edition.trendReport = report;
    
    // Save the updated edition back to the database
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('newsletter_editions')
      .upsert(
        { 
          edition_date: edition.date, 
          data: edition, 
          generated_at: edition.generated_at,
          updated_at: new Date().toISOString() 
        }, 
        { onConflict: 'edition_date' }
      );
    if (error) {
      console.error('Failed to save trend report:', error.message);
      process.exit(1);
    }
  }
  
  const report = edition.trendReport;
  if (!report) {
    console.error('No trend report on the edition.');
    process.exit(1);
  }
  const stamp = report.date || edition.date || new Date().toISOString().slice(0, 10);
  mkdirSync(join(process.cwd(), 'reports'), { recursive: true });
  const path = join(process.cwd(), 'reports', `newsletter-trends-${stamp}.json`);
  writeFileSync(path, JSON.stringify({ edition_date: edition.date, trendReport: report }, null, 2));
  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Daily Signal trends · ${stamp} · ${report.source}`);
    console.log(report.headline);
    console.log(report.thesis);
    for (const d of report.drivers || []) {
      console.log(`- ${d.label}: ${d.finding}`);
    }
    console.log(`wrote ${path}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
