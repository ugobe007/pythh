#!/usr/bin/env node
/**
 * Batch Hunter.io lookup for startup founder emails.
 *
 * Writes results to startup_uploads.extracted_data.outreach_contact (does not overwrite submitted_email).
 *
 * Usage:
 *   node scripts/enrich-founder-emails.mjs --dry-run --limit=20
 *   node scripts/enrich-founder-emails.mjs --apply --limit=100 --delay=2000
 *   node scripts/enrich-founder-emails.mjs --apply --startup-id=<uuid> --dry-run
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { hasHunterIo } from '../lib/hunterIo.mjs';
import { resolveFounderContact } from '../lib/resolveFounderContact.mjs';

config();

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
const LIMIT = parseInt(flag('--limit') ?? '50', 10);
const SCAN = parseInt(flag('--scan') ?? String(Math.max(LIMIT * 10, 200)), 10);
const DELAY_MS = parseInt(flag('--delay') ?? '2000', 10);
const STARTUP_ID = flag('--startup-id');
const SKIP_ZB = has('--skip-zerobounce');
const FILL_SUBMITTED = has('--fill-submitted');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL and service-role key required');
if (!hasHunterIo()) throw new Error('HUNTER_API_KEY not set');

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchStartups() {
  if (STARTUP_ID) {
    const { data, error } = await db
      .from('startup_uploads')
      .select('id, name, website, submitted_email, extracted_data, total_god_score')
      .eq('id', STARTUP_ID)
      .maybeSingle();
    if (error) throw error;
    return data ? [data] : [];
  }

  const { data, error } = await db
    .from('startup_uploads')
    .select('id, name, website, submitted_email, extracted_data, total_god_score')
    .not('website', 'is', null)
    .order('total_god_score', { ascending: false, nullsFirst: false })
    .limit(SCAN);

  if (error) throw error;

  return (data || [])
    .filter((s) => {
      const cached = s.extracted_data?.outreach_contact?.email;
      if (cached) return false;
      if (!FILL_SUBMITTED && s.submitted_email?.trim()) return false;
      return true;
    })
    .slice(0, LIMIT);
}

async function main() {
  console.log('=== Founder Email Enrichment (Hunter.io) ===');
  if (DRY_RUN) console.log('[DRY RUN — no writes]');

  const startups = await fetchStartups();
  console.log(`Loaded ${startups.length} startups to scan`);

  const stats = {
    mode: DRY_RUN ? 'dry-run' : 'apply',
    processed: 0,
    found: 0,
    rejected: 0,
    filled_submitted: 0,
    rate_limited: 0,
  };

  for (const startup of startups) {
    stats.processed++;
    process.stdout.write(`[${stats.processed}/${startups.length}] ${startup.name} ... `);

    try {
      const contact = await resolveFounderContact(startup, {
        useHunter: true,
        validate: !SKIP_ZB,
      });

      if (!contact || contact.rejected) {
        stats.rejected++;
        console.log(`skip (${contact?.reason || 'not_found'})`);
        await sleep(DELAY_MS);
        continue;
      }

      stats.found++;
      const outreachContact = {
        email: contact.email,
        source: contact.source,
        email_type: contact.emailType,
        person_name: contact.personName || null,
        hunter_confidence: contact.hunterConfidence ?? null,
        position: contact.position || null,
        zero_bounce_status: contact.zeroBounceStatus || null,
        enriched_at: new Date().toISOString(),
      };

      const extracted = { ...(startup.extracted_data || {}), outreach_contact: outreachContact };
      const update = { extracted_data: extracted };

      if (FILL_SUBMITTED && !startup.submitted_email?.trim() && contact.emailType === 'personal') {
        update.submitted_email = contact.email;
        stats.filled_submitted++;
      }

      console.log(`→ ${contact.email} (${contact.source})`);

      if (!DRY_RUN) {
        const { error } = await db.from('startup_uploads').update(update).eq('id', startup.id);
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
