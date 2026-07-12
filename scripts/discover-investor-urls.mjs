#!/usr/bin/env node
/**
 * Discover investor firm homepages via Gemini Google Search (primary) or Custom Search.
 * Writes discovered URLs to investors.url for enrichment downstream.
 *
 * Prerequisites:
 *   - Custom Search API enabled in GCP
 *   - Programmable Search Engine (search entire web) → GOOGLE_CUSTOM_SEARCH_CX
 *   - API key → GOOGLE_CUSTOM_SEARCH_API_KEY
 *
 * Usage:
 *   node scripts/discover-investor-urls.mjs --dry-run --limit=5
 *   node scripts/discover-investor-urls.mjs --apply --limit=100    # daily free quota
 *   node scripts/discover-investor-urls.mjs --apply --limit=0      # all missing (paid after 100/day)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchInvestorUniverse,
  parseLimitArg,
  parseOffsetArg,
  parseCohortArg,
} from '../lib/investorUniverse.mjs';
import { resolveInvestorUrls } from '../lib/investorUrlResolver.mjs';
import { discoverInvestorUrl } from '../lib/discoverInvestorUrl.mjs';
import { getCustomSearchConfig } from '../lib/googleCustomSearch.mjs';
import { hasGeminiSearch } from '../lib/geminiInvestorSearch.mjs';

dotenv.config();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const DRY_RUN = !APPLY || argv.includes('--dry-run');
const LIMIT = parseLimitArg(argv, { defaultZero: false, fallback: 100 });
const OFFSET = parseOffsetArg(argv);
const COHORT = parseCohortArg(argv);
const DELAY_MS = parseInt((argv.find((a) => a.startsWith('--delay=')) || '--delay=1200').split('=')[1], 10);
const MIN_WRITE_SCORE = parseInt((argv.find((a) => a.startsWith('--min-score=')) || '--min-score=70').split('=')[1], 10);

const root = path.dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_PATH = path.join(root, '..', 'data', 'url-discovery-misses.json');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isBadExistingUrl(url) {
  if (!url) return false;
  const u = String(url).toLowerCase();
  return (
    u.includes('crunchbase.com') ||
    u.includes('linkedin.com') ||
    u.includes('twitter.com') ||
    u.includes('pitchbook.com') ||
    u.includes('wikipedia.org')
  );
}

function needsDiscovery(inv) {
  const resolved = resolveInvestorUrls(inv);
  if (resolved.source === 'registry') return false;
  if (resolved.source === 'database' && !isBadExistingUrl(inv.url)) return false;
  if (resolved.source === 'blog_url' && !inv.url) return false;
  return !inv.url || isBadExistingUrl(inv.url);
}

async function loadMissedIds() {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, 'utf8');
    return new Set(JSON.parse(raw).ids || []);
  } catch {
    return new Set();
  }
}

async function saveMissedIds(ids) {
  await fs.mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true });
  await fs.writeFile(
    CHECKPOINT_PATH,
    JSON.stringify({ ids: [...ids], updated_at: new Date().toISOString() }, null, 2),
  );
}

function labelsToTry(inv) {
  return [...new Set([inv.firm, inv.name].filter((s) => s && String(s).trim()))];
}

async function main() {
  const cse = getCustomSearchConfig();
  const saPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const gemini = hasGeminiSearch();
  console.log('\n🔎 Investor URL discovery');
  if (!gemini && !cse) {
    console.error('❌ No search backend configured:');
    console.error('   GEMINI_API_KEY — recommended (Google Search grounding, whole web)');
    console.error('   OR GOOGLE_CUSTOM_SEARCH_CX + service account/API key (site-restricted engines only since Jan 2026)');
    process.exit(1);
  }
  console.log(`   backends: ${[gemini && 'Gemini Google Search (primary)', cse && 'Custom Search API'].filter(Boolean).join(' + ')}`);
  if (gemini) console.log('   gemini: whole-web search via GEMINI_API_KEY');
  if (cse) console.log(`   cse cx: ${cse.cx.slice(0, 16)}...`);
  console.log(`   mode: ${DRY_RUN ? 'dry-run' : 'APPLY'} · limit ${LIMIT || 'ALL'} · delay ${DELAY_MS}ms`);
  if (!gemini && cse) console.log('   free tier: 100 queries/day — use --limit=100 for daily batch\n');
  else console.log('');

  const all = await fetchInvestorUniverse(sb, { cohort: COHORT, limit: 0 });
  const missedIds = await loadMissedIds();
  let pool = all.filter(needsDiscovery).filter((inv) => !missedIds.has(inv.id));
  pool.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (OFFSET > 0) pool = pool.slice(OFFSET);
  if (LIMIT > 0) pool = pool.slice(0, LIMIT);

  console.log(`   universe ${all.length} · need URL discovery ${pool.length}${missedIds.size ? ` · skipped ${missedIds.size} prior misses` : ''}\n`);
  if (!pool.length) {
    console.log('Nothing to discover.');
    return;
  }

  let found = 0;
  let written = 0;
  let failed = 0;
  let skippedLow = 0;
  let quotaHit = false;
  const newMisses = new Set(missedIds);

  for (let i = 0; i < pool.length; i++) {
    const inv = pool[i];
    const label = `[${i + 1}/${pool.length}] ${inv.name}`;
    try {
      let result = { url: null, source: 'none', score: 0 };
      for (const tryName of labelsToTry(inv)) {
        result = await discoverInvestorUrl(tryName, { skipSearch: false });
        if (result.url) break;
      }
      if (result.url) {
        if (result.score < MIN_WRITE_SCORE && result.source !== 'registry') {
          skippedLow++;
          console.log(`—  ${label} — low confidence ${result.source} (${result.score}), skip`);
          newMisses.add(inv.id);
          continue;
        }
        found++;
        console.log(`✅ ${label}`);
        console.log(`   ${result.source} (score ${result.score}): ${result.url}`);
        if (!DRY_RUN) {
          const { error } = await sb
            .from('investors')
            .update({ url: result.url })
            .eq('id', inv.id);
          if (error) {
            console.warn(`   ⚠️ DB write failed: ${error.message}`);
            failed++;
          } else {
            written++;
          }
        }
      } else {
        console.log(`—  ${label} — no URL found`);
        newMisses.add(inv.id);
      }
    } catch (err) {
      if (err.code === 'QUOTA_EXCEEDED') {
        console.error(`\n⛔ ${err.message} — stopping at ${i + 1}/${pool.length}`);
        quotaHit = true;
        break;
      }
      console.warn(`❌ ${label}: ${err.message}`);
      failed++;
    }

    if (i < pool.length - 1 && !quotaHit) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  if (!DRY_RUN && newMisses.size > missedIds.size) {
    await saveMissedIds(newMisses);
  }

  console.log(
    `\n📊 Done — found ${found} · written ${written} · failed ${failed} · low-confidence skip ${skippedLow}${quotaHit ? ' · quota exceeded' : ''}\n`,
  );
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
