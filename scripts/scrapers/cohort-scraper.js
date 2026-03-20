#!/usr/bin/env node
/**
 * P3: Cohort Scraper — Populate accelerator_cohorts + cohort_companies
 * Uses yc-oss API (JSON) — YC site is JS-rendered, scraping returns empty.
 *
 * Run: node scripts/scrapers/cohort-scraper.js [--dry-run]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search };
    https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${body.slice(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

// YC batch identifiers (yc-oss uses lowercase: w25, s24, etc.)
const YC_BATCHES = ['W25', 'S24', 'W24', 'S23', 'W23'];

async function fetchYCBatch(batch) {
  const batchKey = batch.toLowerCase();
  const url = `https://yc-oss.github.io/api/batches/${batchKey}.json`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data.map((c) => ({
    company_name: (c.name || c.company || '').trim(),
    company_url: c.website || c.url || null,
  })).filter((c) => c.company_name && c.company_name.length > 1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('\n📦 P3 Cohort Scraper');
  console.log('═'.repeat(50));

  for (const batch of YC_BATCHES) {
    try {
      const companies = await fetchYCBatch(batch);
      const program = 'YC';
      const displayName = `YC ${batch}`;

      if (dryRun) {
        console.log(`   [DRY RUN] ${displayName}: ${companies.length} companies`);
        companies.slice(0, 3).forEach(c => console.log(`     - ${c.company_name}`));
        continue;
      }

      const { data: cohort, error: cohortErr } = await supabase
        .from('accelerator_cohorts')
        .upsert(
          { program, batch, display_name: displayName, company_count: companies.length, source_url: `https://www.ycombinator.com/companies?batch=${batch}` },
          { onConflict: 'program,batch' }
        )
        .select('id')
        .single();

      if (cohortErr) {
        console.log(`   ⚠️  ${displayName}: cohort upsert failed: ${cohortErr.message}`);
        continue;
      }

      let inserted = 0;
      for (const c of companies) {
        const { error } = await supabase.from('cohort_companies').upsert(
          { cohort_id: cohort.id, company_name: c.company_name, company_url: c.company_url || null },
          { onConflict: 'cohort_id,company_name' }
        );
        if (!error) inserted++;
      }
      console.log(`   ✅ ${displayName}: ${inserted} companies`);
    } catch (err) {
      console.log(`   ⚠️  YC ${batch}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n   Done.\n');
}

main().catch(console.error);
