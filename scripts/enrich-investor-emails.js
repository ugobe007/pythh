#!/usr/bin/env node
'use strict';
/**
 * enrich-investor-emails.js
 *
 * Batch-infers email candidates for all investors missing email data.
 * Runs DNS MX checks in parallel, stores results back to Supabase.
 *
 * Usage:
 *   node scripts/enrich-investor-emails.js            # process pending only
 *   node scripts/enrich-investor-emails.js --all      # reprocess all
 *   node scripts/enrich-investor-emails.js --dry-run  # print results, don't write
 *   node scripts/enrich-investor-emails.js --limit 50 # cap at N records
 *   node scripts/enrich-investor-emails.js --audit    # domain MX audit only
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const {
  inferEmails,
  extractDomain,
  domainHasMx,
  INTAKE_SLUGS,
} = require('../lib/investorEmailInfer');

const SUPABASE_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE_SIZE     = 200;
const WRITE_BATCH   = 50;
const DNS_CONCURRENCY = 30;  // parallel DNS lookups

const args = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const ALL      = args.includes('--all');
const AUDIT    = args.includes('--audit');
const LIMIT    = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i+1], 10) : null; })();

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });
}

// ─── Fetch investors ──────────────────────────────────────────────────────────

async function fetchInvestors(client) {
  const results = [];
  let offset = 0;

  while (true) {
    let q = client
      .from('investors')
      .select('id, name, firm, email, url, partners')
      .not('url', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!ALL) {
      q = q.or('email_status.eq.pending,email_status.is.null');
    }

    const { data, error } = await q;
    if (error) throw new Error('Fetch error: ' + error.message);
    if (!data || data.length === 0) break;

    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;

    if (LIMIT && results.length >= LIMIT) break;
  }

  return LIMIT ? results.slice(0, LIMIT) : results;
}

// ─── Domain audit mode ────────────────────────────────────────────────────────

async function runAudit(investors) {
  console.log(`\nAuditing domains for ${investors.length} investors...\n`);

  const domainMap = {};
  for (const inv of investors) {
    const domain = extractDomain(inv.url || inv.website);
    if (!domain) continue;
    if (!domainMap[domain]) domainMap[domain] = { domain, count: 0, firms: [] };
    domainMap[domain].count++;
    domainMap[domain].firms.push(inv.name || inv.firm);
  }

  const entries = Object.values(domainMap);
  console.log(`Checking MX for ${entries.length} unique domains...`);

  // Parallel DNS checks
  const chunks = [];
  for (let i = 0; i < entries.length; i += DNS_CONCURRENCY) {
    chunks.push(entries.slice(i, i + DNS_CONCURRENCY));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async e => { e.hasMx = await domainHasMx(e.domain); }));
  }

  const valid    = entries.filter(e => e.hasMx);
  const invalid  = entries.filter(e => !e.hasMx);
  const coverage = (valid.length / entries.length * 100).toFixed(1);

  console.log(`\n✓ ${valid.length} domains have MX records (${coverage}% of total)`);
  console.log(`✗ ${invalid.length} domains have no MX / unreachable`);
  console.log('\nTop 20 valid domains:');
  valid
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .forEach(e => console.log(`  ${e.domain.padEnd(36)} (${e.count} investors)`));

  if (invalid.length > 0) {
    console.log('\nDomains with no MX (cannot receive email):');
    invalid
      .slice(0, 20)
      .forEach(e => console.log(`  ${e.domain.padEnd(36)} (${e.count} investors)`));
  }
}

// ─── Build candidate objects ──────────────────────────────────────────────────

function buildCandidateObjects(result) {
  const candidates = [];

  // Personal permutations (type: 'personal')
  result.personal.forEach((addr, idx) => {
    candidates.push({
      address:    addr,
      type:       'personal',
      confidence: Math.max(0.9 - idx * 0.07, 0.1),
    });
  });

  // Intake addresses (type: 'intake')
  result.intake.forEach((addr, idx) => {
    candidates.push({
      address:    addr,
      type:       'intake',
      confidence: Math.max(0.5 - idx * 0.04, 0.05),
    });
  });

  return candidates;
}

// ─── Write results to Supabase ────────────────────────────────────────────────

async function writeResults(client, updates) {
  // Update one at a time in parallel batches (upsert requires all NOT NULL cols)
  for (let i = 0; i < updates.length; i += WRITE_BATCH) {
    const batch = updates.slice(i, i + WRITE_BATCH);
    await Promise.all(batch.map(async u => {
      const { id, ...fields } = u;
      const { error } = await client.from('investors').update(fields).eq('id', id);
      if (error) console.error(`  [write error] ${id}:`, error.message);
    }));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = sb();

  console.log('=== Investor Email Enrichment ===');
  if (DRY_RUN) console.log('[DRY RUN — no writes]');
  console.log('Fetching investors...');

  const investors = await fetchInvestors(client);
  console.log(`Loaded ${investors.length} investors to process`);

  if (AUDIT) {
    await runAudit(investors);
    return;
  }

  // Pre-cache MX for all unique domains in parallel
  const domains = [...new Set(
    investors.map(inv => extractDomain(inv.url || inv.website)).filter(Boolean)
  )];
  console.log(`Pre-checking MX for ${domains.length} unique domains...`);

  const chunks = [];
  for (let i = 0; i < domains.length; i += DNS_CONCURRENCY) {
    chunks.push(domains.slice(i, i + DNS_CONCURRENCY));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(d => domainHasMx(d)));
  }
  console.log('DNS pre-cache complete.\n');

  // Process each investor
  let done = 0, withMx = 0, withPersonal = 0, noUrl = 0;
  const updates = [];

  for (const inv of investors) {
    const result = await inferEmails(inv, { verifyDns: true });

    if (!result.domain) { noUrl++; continue; }
    if (result.hasMx) withMx++;
    if (result.personal.length > 0) withPersonal++;

    const candidates = buildCandidateObjects(result);
    const update = {
      id:                 inv.id,
      email_domain:       result.domain,
      email_candidates:   candidates,
      email_status:       result.verified ? 'verified' : (candidates.length > 0 ? 'inferred' : 'unreachable'),
      email_best_guess:   result.bestGuess,
      email_has_mx:       result.hasMx,
      email_enriched_at:  new Date().toISOString(),
      ...(result.verified ? {
        email:             result.verified,
        email_verified_at: new Date().toISOString(),
      } : {}),
    };
    updates.push(update);

    done++;
    if (done % 100 === 0) {
      process.stdout.write(`  ${done}/${investors.length} processed...\r`);
      if (!DRY_RUN) await writeResults(client, updates.splice(0, updates.length));
    }
  }

  // Write remaining
  if (!DRY_RUN && updates.length > 0) {
    await writeResults(client, updates);
  }

  console.log(`\n\n=== Results ===`);
  console.log(`  Processed:          ${done}`);
  console.log(`  With valid MX:      ${withMx} (${(withMx/Math.max(done,1)*100).toFixed(1)}%)`);
  console.log(`  With personal email:${withPersonal} (${(withPersonal/Math.max(done,1)*100).toFixed(1)}%)`);
  console.log(`  No URL (skipped):   ${noUrl}`);

  // Show sample results
  if (DRY_RUN) {
    console.log('\n=== Sample inferences (first 10) ===');
    for (const inv of investors.slice(0, 10)) {
      const r = await inferEmails(inv, { verifyDns: false });
      console.log(`\n  ${inv.name} [${inv.firm}]`);
      console.log(`    domain:    ${r.domain || '—'}  (MX: ${r.hasMx ? 'yes' : 'no'})`);
      console.log(`    personal:  ${r.personal.slice(0,3).join(' | ') || '(none — firm-level)'}`);
      console.log(`    intake:    ${r.intake.slice(0,3).join(' | ')}`);
      console.log(`    bestGuess: ${r.bestGuess || '—'}`);
    }
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
