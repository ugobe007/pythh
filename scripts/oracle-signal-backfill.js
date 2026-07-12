#!/usr/bin/env node
/**
 * Oracle Signal Backfill
 * ============================================================================
 *
 * Populates `signals[]` and `focus_areas` for firm-level investors in the DB.
 *
 * Usage:
 *   node scripts/oracle-signal-backfill.js              # all firm-level candidates
 *   node scripts/oracle-signal-backfill.js --limit=100
 *   node scripts/oracle-signal-backfill.js --dry-run
 *   node scripts/oracle-signal-backfill.js --force
 *   node scripts/oracle-signal-backfill.js --include-partners
 *   node scripts/oracle-signal-backfill.js --name=sequoia
 *   node scripts/oracle-signal-backfill.js --firm=vsquared
 *
 * ============================================================================
 */

'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const {
  fetchInvestorUniverse,
  parseLimitArg,
  parseOffsetArg,
  parseCohortArg,
} = require('../lib/investorUniverse.mjs');
const { searchInvestorNews, extractInvestorDataFromArticles, buildOracleSignals } = require('../server/services/investorInferenceService');
const { isFirmLevelOracleRow } = require('../lib/investorNameHeuristics');

const FIRM_SUFFIX =
  /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Advisors?|Holdings?|Management|Accelerator|Studio|Combinator)\b/i;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const LIMIT = parseLimitArg(args, { defaultZero: true });
const OFFSET = parseOffsetArg(args);
const COHORT = parseCohortArg(args);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const INCLUDE_PARTNERS = args.includes('--include-partners');
const NAME_FILTER = (() => {
  const a = args.find((x) => x.startsWith('--name='));
  return a ? a.split('=').slice(1).join('=').toLowerCase() : '';
})();
const FIRM_FILTER = (() => {
  const a = args.find((x) => x.startsWith('--firm='));
  return a ? a.split('=').slice(1).join('=').toLowerCase() : '';
})();

const DELAY_HIT_MS = 1500;
const DELAY_SKIP_MS = 250;

function oraclePriority(inv) {
  const name = (inv.name || '').trim();
  const firm = (inv.firm || '').trim();
  let score = Number(inv.investor_score) || 0;
  if (firm && name.toLowerCase() === firm.toLowerCase()) score += 50;
  else if (FIRM_SUFFIX.test(name)) score += 40;
  if (inv.url) score += 10;
  if (inv.bio && inv.bio.length >= 50) score += 5;
  return score;
}

function prepareOraclePool(raw) {
  return raw
    .filter((inv) => {
      const name = (inv.name || '').toLowerCase();
      const firm = (inv.firm || '').toLowerCase();
      if (NAME_FILTER && !name.includes(NAME_FILTER) && !firm.includes(NAME_FILTER)) return false;
      if (FIRM_FILTER && !name.includes(FIRM_FILTER) && !firm.includes(FIRM_FILTER)) return false;
      return isFirmLevelOracleRow(inv, { includePartners: INCLUDE_PARTNERS });
    })
    .sort((a, b) => oraclePriority(b) - oraclePriority(a));
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function logProgress(done, total, name, firm, signalCount, status) {
  const pct = total ? Math.round((done / total) * 100) : '?';
  const tag = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`${tag}[${done}/${total} ${pct}%] ${name} @ ${firm || 'unknown'} → ${signalCount} signals (${status})`);
}

function roundCheckSize(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value));
}

async function fetchUncheckedEmptySignals(sb) {
  const pageSize = 1000;
  const rows = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb
      .from('investors')
      .select(
        'id, name, firm, bio, url, blog_url, investor_type, type, is_individual, investor_score, ' +
          'entity_gate, status, last_enrichment_date, signals, sectors, stage'
      )
      .eq('signals', '[]')
      .is('last_enrichment_date', null)
      .neq('status', 'inactive')
      .neq('entity_gate', 'junk')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return rows;
}

async function markOracleAttempted(investorId, updatePayload) {
  if (DRY_RUN) return;
  const { error } = await supabase.from('investors').update(updatePayload).eq('id', investorId);
  if (error) throw new Error(error.message);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Oracle Signal Backfill');
  if (DRY_RUN) console.log('DRY RUN MODE — no DB writes');
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} investors`);
  else console.log('Limit: ALL firm-level candidates');
  if (OFFSET) console.log(`Offset: ${OFFSET}`);
  console.log(`Cohort: ${COHORT}`);
  if (FORCE) console.log('FORCE mode — re-processing investors with existing signals');
  if (INCLUDE_PARTNERS) console.log('Including partner/person rows (default: firm-level only)');
  if (NAME_FILTER) console.log(`Name filter: ${NAME_FILTER}`);
  if (FIRM_FILTER) console.log(`Firm filter: ${FIRM_FILTER}`);
  console.log('='.repeat(60));

  const { isVentureOrAngel } = require('../lib/investorUniverse.mjs');

  const skipPrune = FORCE && (FIRM_FILTER || NAME_FILTER);
  let raw = [];

  if (!skipPrune) {
    const unchecked = await fetchUncheckedEmptySignals(supabase);
    const prunable = unchecked.filter((inv) => !isFirmLevelOracleRow(inv, { includePartners: INCLUDE_PARTNERS }));
    let pruned = 0;

    if (!DRY_RUN && prunable.length > 0) {
      for (let i = 0; i < prunable.length; i += 100) {
        const chunk = prunable.slice(i, i + 100);
        const ids = chunk.map((inv) => inv.id);
        const { error } = await supabase
          .from('investors')
          .update({ last_enrichment_date: new Date().toISOString() })
          .in('id', ids);
        if (error) console.error(`  Prune batch error:`, error.message);
        else pruned += chunk.length;
      }
      if (pruned > 0) console.log(`Pruned ${pruned} non-firm rows from oracle queue (no RSS)`);
    } else if (DRY_RUN && prunable.length > 0) {
      console.log(`Would prune ${prunable.length} non-firm rows from oracle queue`);
    }

    raw = unchecked.filter(
      (inv) => isFirmLevelOracleRow(inv, { includePartners: INCLUDE_PARTNERS }) && isVentureOrAngel(inv, COHORT)
    );
  }

  if (FORCE || FIRM_FILTER || NAME_FILTER) {
    const all = await fetchInvestorUniverse(supabase, {
      limit: 0,
      cohort: COHORT,
      needsSignals: false,
    });
    raw = prepareOraclePool(all);
  }

  const poolAll = prepareOraclePool(raw);
  const filteredOut = raw.length - poolAll.length;
  let pool = poolAll;
  if (OFFSET > 0) pool = pool.slice(OFFSET);
  if (LIMIT > 0) pool = pool.slice(0, LIMIT);

  if (!pool.length) {
    console.log('No investors to process. All done!');
    return;
  }

  console.log(
    `Candidates: ${raw.length} unchecked empty signals → ${poolAll.length} firm-level` +
      ` (${filteredOut} partner/junk/person skipped)` +
      (LIMIT > 0 || OFFSET ? ` · running ${pool.length} after offset/limit` : '')
  );
  console.log(`Processing ${pool.length} investors…\n`);

  let enriched = 0;
  let skipped = 0;
  let dbErrors = 0;
  let totalSignals = 0;

  for (let i = 0; i < pool.length; i++) {
    const investor = pool[i];
    const name = investor.name || 'Unknown';
    const firm = investor.firm || '';
    let hadArticles = false;

    try {
      const articles = await searchInvestorNews(name, firm);
      hadArticles = articles.length > 0;

      if (!hadArticles) {
        logProgress(i + 1, pool.length, name, firm, 0, 'no news');
        try {
          await markOracleAttempted(investor.id, { last_enrichment_date: new Date().toISOString() });
        } catch (err) {
          console.error(`  DB error for ${name}:`, err.message);
          dbErrors++;
        }
        skipped++;
        await sleep(DELAY_SKIP_MS);
        continue;
      }

      const { enrichedData } = extractInvestorDataFromArticles(articles, investor);
      const mergedInvestor = { ...investor, ...enrichedData };
      const { signals, focus_areas, last_investment_date } = buildOracleSignals(mergedInvestor, articles);

      totalSignals += signals.length;
      logProgress(i + 1, pool.length, name, firm, signals.length, `${articles.length} articles`);

      if (!DRY_RUN) {
        const updatePayload = {
          last_enrichment_date: new Date().toISOString(),
        };

        if (signals.length > 0) {
          updatePayload.signals = signals;
          updatePayload.focus_areas = focus_areas;
          if (last_investment_date) updatePayload.last_investment_date = last_investment_date;
          if (enrichedData.sectors) updatePayload.sectors = enrichedData.sectors;
          if (enrichedData.stage) updatePayload.stage = enrichedData.stage;
          if (enrichedData.portfolio_companies) updatePayload.portfolio_companies = enrichedData.portfolio_companies;
          const min = roundCheckSize(enrichedData.check_size_min);
          const max = roundCheckSize(enrichedData.check_size_max);
          if (min != null) updatePayload.check_size_min = min;
          if (max != null) updatePayload.check_size_max = max;
          if (enrichedData.inferred_bio && !investor.bio) updatePayload.bio = enrichedData.inferred_bio;
          if (enrichedData.geography_focus) updatePayload.geography_focus = enrichedData.geography_focus;
        }

        try {
          await markOracleAttempted(investor.id, updatePayload);
          if (signals.length > 0) enriched++;
          else skipped++;
        } catch (err) {
          console.error(`  DB error for ${name}:`, err.message);
          dbErrors++;
        }
      } else if (signals.length > 0) {
        enriched++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  Error processing ${name}:`, err.message);
      skipped++;
    }

    await sleep(hadArticles ? DELAY_HIT_MS : DELAY_SKIP_MS);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Oracle Signal Backfill Complete');
  console.log(`  Processed : ${pool.length}`);
  console.log(`  Enriched  : ${enriched}`);
  console.log(`  Skipped   : ${skipped} (no articles/signals — marked checked)`);
  console.log(`  Filtered  : ${filteredOut} (partner/junk/person removed pre-run)`);
  console.log(`  DB errors : ${dbErrors}`);
  console.log(`  Avg sigs  : ${enriched ? (totalSignals / enriched).toFixed(1) : 0} per investor`);
  if (DRY_RUN) console.log('\n  ** DRY RUN — no changes written to DB **');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
