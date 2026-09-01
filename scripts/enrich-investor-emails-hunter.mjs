#!/usr/bin/env node
/**
 * Batch Hunter.io lookup for investor emails.
 *
 * Usage:
 *   node scripts/enrich-investor-emails-hunter.mjs --dry-run --limit=20
 *   node scripts/enrich-investor-emails-hunter.mjs --apply --limit=100 --delay=1500
 *   node scripts/enrich-investor-emails-hunter.mjs --apply --all --delay=2000
 */

import { config } from 'dotenv';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { hasHunterIo } from '../lib/hunterIo.mjs';
import { resolveInvestorContact } from '../lib/resolveInvestorContact.mjs';

config();

const require = createRequire(import.meta.url);
const { extractDomain, domainHasMx, classifyContactEmail } = require('../lib/investorEmailInfer.js');

const argv = process.argv.slice(2);
const flag = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};
const has = (name) => argv.some((a) => a === name || a.startsWith(`${name}=`));

const APPLY = has('--apply');
const DRY_RUN = !APPLY || has('--dry-run');
const ALL = has('--all');
const LIMIT = parseInt(flag('--limit') ?? '50', 10);
const DELAY_MS = parseInt(flag('--delay') ?? '1500', 10);
const MIN_CONFIDENCE = parseInt(flag('--min-confidence') ?? '70', 10);
const SKIP_ZB = has('--skip-zerobounce');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL and service-role key required');
if (!hasHunterIo()) throw new Error('HUNTER_API_KEY not set');

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchInvestors() {
  const rows = [];
  let offset = 0;
  while (rows.length < LIMIT) {
    let q = db
      .from('investors')
      .select('id, name, firm, email, url, partners, email_best_guess, email_status, email_has_mx')
      .not('url', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + 199);

    if (!ALL) {
      q = q.or('email.is.null,email_status.eq.pending,email_status.eq.inferred,email_status.is.null');
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 200) break;
    offset += 200;
  }
  return rows.slice(0, LIMIT);
}

function buildCandidates(contact, domain) {
  const type = contact.emailType || classifyContactEmail(contact.email);
  return [{
    address: contact.email,
    type: type === 'personal' ? 'personal' : 'intake',
    confidence: Math.min((contact.hunterConfidence || 80) / 100, 0.99),
    source: contact.source,
    position: contact.position || null,
  }];
}

async function main() {
  console.log('=== Investor Email Enrichment (Hunter.io) ===');
  if (DRY_RUN) console.log('[DRY RUN — no writes]');

  const investors = await fetchInvestors();
  console.log(`Loaded ${investors.length} investors`);

  const stats = {
    mode: DRY_RUN ? 'dry-run' : 'apply',
    processed: 0,
    found: 0,
    verified: 0,
    inferred: 0,
    rejected: 0,
    skipped_existing: 0,
    rate_limited: 0,
  };

  for (const inv of investors) {
    if (inv.email && inv.email_status === 'verified') {
      stats.skipped_existing++;
      continue;
    }

    stats.processed++;
    const domain = extractDomain(inv.url);
    process.stdout.write(`[${stats.processed}/${investors.length}] ${inv.name || inv.firm} (${domain || 'no domain'}) ... `);

    try {
      const contact = await resolveInvestorContact(inv, {
        useHunter: true,
        validate: !SKIP_ZB,
      });

      if (!contact || contact.rejected) {
        stats.rejected++;
        console.log(`skip (${contact?.reason || 'not_found'})`);
        await sleep(DELAY_MS);
        continue;
      }

      if ((contact.hunterConfidence || 0) < MIN_CONFIDENCE && contact.source !== 'verified_on_file') {
        stats.rejected++;
        console.log(`skip (low_confidence:${contact.hunterConfidence || 0})`);
        await sleep(DELAY_MS);
        continue;
      }

      stats.found++;
      const hasMx = domain ? await domainHasMx(domain) : false;
      const candidates = buildCandidates(contact, domain);
      const isVerified = contact.source === 'verified_on_file'
        || (contact.hunterConfidence || 0) >= 85
        || contact.zeroBounceStatus === 'valid';

      if (isVerified) stats.verified++;
      else stats.inferred++;

      const update = {
        email_domain: domain,
        email_candidates: candidates,
        email_best_guess: contact.email,
        email_has_mx: hasMx,
        email_status: isVerified ? 'verified' : 'inferred',
        email_enriched_at: new Date().toISOString(),
        ...(isVerified ? {
          email: contact.email,
          email_verified_at: new Date().toISOString(),
        } : {}),
      };

      console.log(`→ ${contact.email} (${contact.source}, conf=${contact.hunterConfidence ?? 'n/a'})`);

      if (!DRY_RUN) {
        const { error } = await db.from('investors').update(update).eq('id', inv.id);
        if (error) console.error(`  write error: ${error.message}`);
      }
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        stats.rate_limited++;
        console.log('rate limited — sleeping 60s');
        await sleep(60_000);
        continue;
      }
      console.log(`error (${err.message})`);
      stats.rejected++;
    }

    await sleep(DELAY_MS);
  }

  console.log('\n' + JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
