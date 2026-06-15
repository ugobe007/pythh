#!/usr/bin/env node
/**
 * ENRICH NO-TIER STARTUPS
 * =======================
 * Targets approved startups that have a website but no extracted_data.data_tier.
 * These are legacy rows that were ingested before the inference pipeline was built.
 *
 * Steps:
 *   1. Fetch website HTML → extractInferenceData (local pattern matching, free)
 *   2. Merge with existing extracted_data
 *   3. Write back to extracted_data + mark enrichment_status = 'enriched'
 *
 * After each batch: run `npx tsx scripts/recalculate-scores.ts --limit=500` to
 * update GOD score components for newly enriched rows.
 *
 * Usage:
 *   node scripts/enrich-notier-startups.js [--dry-run] [--limit=100] [--run-all]
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { extractInferenceData } = require('../lib/inference-extractor');
const { isJunkUrl } = require('../lib/junk-url-config');
const { isGarbage } = require('./cleanup-garbage');
const { ontologyJunkReason } = require('../lib/pendingNameOntology');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN  = process.argv.includes('--dry-run');
const RUN_ALL  = process.argv.includes('--run-all');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const CHUNK    = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;
const HTML_TIMEOUT_MS = 5000; // Fast-fail — junk/large sites should not stall the batch

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s (${label})`)), ms)
    ),
  ]);
}

// Known large/junk domains that will never yield startup copy
const SKIP_DOMAINS = new Set([
  '9to5google.com', 'techcrunch.com', 'venturebeat.com', 'forbes.com',
  'bloomberg.com', 'reuters.com', 'businessinsider.com', 'cnbc.com',
  'nytimes.com', 'wsj.com', 'ft.com', 'theguardian.com',
  'drseuss.com', 'disney.com', 'amazon.com', 'google.com', 'apple.com',
  'microsoft.com', 'spacex.com', 'tesla.com', 'openai.com',
]);

function isKnownJunkDomain(url) {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    return SKIP_DOMAINS.has(host);
  } catch { return false; }
}

async function fetchHtml(url) {
  try {
    const full = url.startsWith('http') ? url : `https://${url}`;
    if (isKnownJunkDomain(full)) return null;
    if (isJunkUrl && isJunkUrl(full)) return null;
    const res = await axios.get(full, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; pythh-enricher/1.0)' },
      timeout: HTML_TIMEOUT_MS,
      maxRedirects: 3,
      responseType: 'text',
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

async function enrichOne(row) {
  const url = row.website || row.company_website;
  if (!url) return { status: 'skip', reason: 'no_url' };

  let html;
  try {
    html = await withTimeout(fetchHtml(url), HTML_TIMEOUT_MS + 1000, `fetch ${url}`);
  } catch (e) {
    return { status: 'error', reason: e.message };
  }

  if (!html || html.length < 50) return { status: 'skip', reason: 'no_html' };

  const extracted = extractInferenceData(html, url);
  if (!extracted) return { status: 'skip', reason: 'no_extraction' };

  const merged = { ...(row.extracted_data || {}), ...extracted };

  if (!DRY_RUN) {
    const { error } = await supabase
      .from('startup_uploads')
      .update({ extracted_data: merged, enrichment_status: 'enriched' })
      .eq('id', row.id);

    if (error) return { status: 'error', reason: error.message };
  }

  return {
    status: 'enriched',
    tier: extracted.confidence?.tier ?? extracted.data_tier ?? '?',
    fields: Object.keys(extracted).filter(k => extracted[k] != null).length,
  };
}

async function runChunk() {
  // Filter to real submitted startups only — exclude junk at DB level first.
  const { data: rawRows, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, company_website, pitch, raise_amount, extracted_data, enrichment_status, entity_gate')
    .eq('status', 'approved')
    .or('extracted_data.is.null,extracted_data->>data_tier.is.null')
    .not('website', 'is', null)
    .or('pitch.not.is.null,raise_amount.not.is.null')
    // Exclude rows the entity gate already marked as junk
    .or('entity_gate.is.null,entity_gate.eq.qualified,entity_gate.eq.needs_url')
    .order('updated_at', { ascending: true })
    .limit(CHUNK * 3); // fetch extra to account for name-filter losses

  // JS-level name gate — same rules as enrich-sparse-startups.js
  const rows = (rawRows || []).filter(r => {
    if (!r.name) return false;
    if (isGarbage(r.name)) return false;
    if (ontologyJunkReason(r.name)) return false;
    return true;
  }).slice(0, CHUNK);

  if (error) { console.error('Query error:', error.message); return 0; }
  const junkFiltered = (rawRows?.length ?? 0) - rows.length;
  if (junkFiltered > 0) console.log(`  Skipped ${junkFiltered} junk names (garbage/ontology gate)`);
  if (!rows || rows.length === 0) { console.log('  Nothing left to process.'); return 0; }

  console.log(`  Processing ${rows.length} rows…`);

  let enrichedCount = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const res = await enrichOne(row);
    const tag = DRY_RUN ? '[dry]' : '';
    if (res.status === 'enriched') {
      enrichedCount++;
      console.log(`    ✓ ${tag} ${(row.name || row.id).slice(0,40)} → tier ${res.tier} (${res.fields} fields)`);
    } else if (res.status === 'error') {
      errors++;
      console.log(`    ✗ ${(row.name || row.id).slice(0,40)} — ${res.reason}`);
    } else {
      skipped++;
    }
  }

  console.log(`  Batch done: ${enrichedCount} enriched, ${skipped} skipped, ${errors} errors\n`);
  return rows.length;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  ENRICH NO-TIER STARTUPS — HTML inference for legacy approved rows');
  console.log('═'.repeat(70));
  console.log(`  Mode:  ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Chunk: ${CHUNK} | Run-all: ${RUN_ALL}\n`);

  let totalProcessed = 0;
  let pass = 1;

  do {
    console.log(`Pass ${pass}:`);
    const processed = await runChunk();
    totalProcessed += processed;
    pass++;
    if (processed === 0 || (!RUN_ALL && pass > 1)) break;
    // Brief pause between passes to avoid hammering Supabase
    if (RUN_ALL && processed > 0) await new Promise(r => setTimeout(r, 1000));
  } while (RUN_ALL);

  console.log('═'.repeat(70));
  console.log(`  Total rows attempted: ${totalProcessed}`);
  if (!DRY_RUN && totalProcessed > 0) {
    console.log('\n  Next: recalculate GOD scores for newly enriched rows:');
    console.log('    npx tsx scripts/recalculate-scores.ts --limit=500');
  }
  console.log('═'.repeat(70));
}

main().catch(e => { console.error(e); process.exit(1); });
