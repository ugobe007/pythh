#!/usr/bin/env node
'use strict';

/**
 * pythia-sage-review.js
 *
 * INDEPENDENT second-pass review of SCRAPED startups. Runs AFTER the scraper has
 * extracted/parsed/stored a row — it never touches scraper code. For each row it:
 *   1. scans for missing high-impact fields the scoring engine relies on
 *   2. asks PYTHIA (LLM, tiered model) to reconstruct only what the evidence supports
 *      and to flag missing logic / value
 *   3. merges the result under strict guardrails (allowlist, confidence gate,
 *      fill-gaps + low-confidence only; never clobbers existing strong data)
 *   4. stamps extracted_data.sage_review for idempotency/audit
 *
 * It does NOT score. The existing 2-hourly recalc (recalculate-scores.ts) reads the
 * same fields this job fills and updates total_god_score on its next run — keeping
 * this pipeline fully decoupled from the scoring path.
 *
 * Usage:
 *   node scripts/pythia-sage-review.js                       # dry run, 50 rows
 *   node scripts/pythia-sage-review.js --apply               # write changes
 *   node scripts/pythia-sage-review.js --apply --limit=200
 *   node scripts/pythia-sage-review.js --id=<uuid> --apply   # single startup
 *   node scripts/pythia-sage-review.js --apply --force       # re-review reviewed rows
 *   node scripts/pythia-sage-review.js --apply --include-holding --promote-holding
 *   node scripts/pythia-sage-review.js --apply --status=approved
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { reviewStartup, alreadyReviewed, SAGE_VERSION } = require('../server/lib/pythiaSageReview');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`${name}=`));
  return a ? a.split('=').slice(1).join('=') : dflt;
};

const APPLY = has('--apply');
const FORCE = has('--force');
const INCLUDE_HOLDING = has('--include-holding');
const PROMOTE_HOLDING = has('--promote-holding');
const JUNK_GATE = !has('--no-junk-gate'); // flag non-startups via entity_gate (default on)
const LIMIT = parseInt(val('--limit', '50'), 10);
const SINGLE_ID = val('--id', null);
const STATUS_OVERRIDE = val('--status', null);

const SCRAPED_SOURCES = ['rss', 'rss_discovery', 'rss_scraper'];

// NOTE: problem / solution / value_proposition / market_size / one_liner are NOT
// root columns on startup_uploads — they live only inside extracted_data, so we
// never SELECT or write them at the top level.
const SELECT_COLS = [
  'id', 'name', 'website', 'company_website', 'tagline', 'description', 'pitch',
  'sectors', 'stage', 'status', 'source_type', 'submitted_email', 'entity_gate',
  'data_completeness', 'total_god_score', 'traction_confidence', 'funding_confidence',
  'extracted_data', 'updated_at',
].join(', ');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function statuses() {
  if (STATUS_OVERRIDE) return STATUS_OVERRIDE.split(',').map((s) => s.trim()).filter(Boolean);
  const base = ['pending', 'approved'];
  if (INCLUDE_HOLDING) base.push('holding');
  return base;
}

async function fetchCandidates(supabase) {
  if (SINGLE_ID) {
    const { data, error } = await supabase.from('startup_uploads').select(SELECT_COLS).eq('id', SINGLE_ID).limit(1);
    if (error) throw error;
    return data || [];
  }

  // Pull a generous window (lowest data-completeness first), then filter
  // already-reviewed client-side so --force can re-review without a column.
  const fetchSize = Math.min(Math.max(LIMIT * 4, 100), 1000);
  const { data, error } = await supabase
    .from('startup_uploads')
    .select(SELECT_COLS)
    .in('source_type', SCRAPED_SOURCES)
    .is('submitted_email', null)
    .in('status', statuses())
    .or('entity_gate.is.null,entity_gate.neq.junk')
    .order('data_completeness', { ascending: true, nullsFirst: true })
    .limit(fetchSize);
  if (error) throw error;

  const rows = (data || []).filter((r) => FORCE || !alreadyReviewed(r));
  return rows.slice(0, LIMIT);
}

async function applyPatch(supabase, startup, result) {
  const { extractedPatch, rootPatch, sageMeta, filled, notStartup, notStartupReason } = result;
  const newExtracted = { ...(startup.extracted_data || {}), ...extractedPatch, sage_review: sageMeta };

  const update = { extracted_data: newExtracted, ...rootPatch, updated_at: new Date().toISOString() };

  let didGate = false;
  if (notStartup && JUNK_GATE) {
    // Flag via the established post-scrape gate (removes it from recalc + UI).
    // The sage is more authoritative than the name/URL heuristic gate, so it MAY
    // override a prior 'qualified' — but only when it gave a specific reason, to
    // guard against a vague false-negative demoting a real startup.
    const hasSpecificReason = notStartupReason && notStartupReason !== 'not a fundable startup';
    if (startup.entity_gate !== 'qualified' || hasSpecificReason) {
      update.entity_gate = 'junk';
      const override = startup.entity_gate === 'qualified' ? ' (override qualified)' : '';
      update.entity_gate_reason = `sage: ${notStartupReason || 'not a fundable startup'}${override}`.slice(0, 240);
      update.entity_gate_at = new Date().toISOString();
      didGate = true;
    }
  } else if (PROMOTE_HOLDING && startup.status === 'holding' && filled.length > 0) {
    // Opt-in: lift a holding row into the recalc-eligible queue once it was
    // materially enriched, so the scoring pass actually picks it up.
    update.status = 'pending';
  }

  const { error } = await supabase.from('startup_uploads').update(update).eq('id', startup.id);
  if (error) throw error;
  return {
    promoted: update.status === 'pending' && startup.status === 'holding',
    gated: didGate,
  };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[sage] Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1);
  }
  if (!OPENAI_KEY) {
    console.error('[sage] Missing OPENAI_API_KEY'); process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const openai = new OpenAI({ apiKey: OPENAI_KEY });

  console.log(`\n🔮 PYTHIA Sage Review v${SAGE_VERSION}  ${APPLY ? '(APPLY)' : '(dry run)'}`);
  console.log(`   statuses=[${statuses().join(', ')}]  limit=${LIMIT}  force=${FORCE}` +
    `${SINGLE_ID ? `  id=${SINGLE_ID}` : ''}\n`);

  const candidates = await fetchCandidates(supabase);
  console.log(`   ${candidates.length} startup(s) queued for review.\n`);

  let reviewed = 0, enriched = 0, promoted = 0, gated = 0, failed = 0;
  const fillCounts = {};

  for (const startup of candidates) {
    const result = await reviewStartup(startup, { openai, fillPlusLowConf: true });
    reviewed += 1;

    if (!result.ok) {
      failed += 1;
      console.log(`   ✗ ${startup.name?.slice(0, 40).padEnd(40)}  [${result.model}]  ERROR: ${result.error}`);
      await sleep(300);
      continue;
    }

    const { filled, model, sageMeta, notStartup } = result;
    if (filled.length) enriched += 1;
    for (const f of filled) fillCounts[f] = (fillCounts[f] || 0) + 1;

    const name = String(startup.name || '?').slice(0, 40).padEnd(40);
    if (notStartup) {
      console.log(`   ⚑ ${name}  [${model}]  not-a-startup: ${sageMeta.not_startup_reason || ''}`.trimEnd());
    } else {
      const tag = filled.length ? `+${filled.join(',')}` : 'no-fills';
      const q = sageMeta.quality ? ` (${sageMeta.quality})` : '';
      console.log(`   ${filled.length ? '✓' : '·'} ${name}  [${model}]  ${tag}${q}`);
    }

    if (APPLY) {
      try {
        const { promoted: didPromote, gated: didGate } = await applyPatch(supabase, startup, result);
        if (didPromote) promoted += 1;
        if (didGate) gated += 1;
      } catch (e) {
        failed += 1;
        console.log(`     ! write failed: ${e.message}`);
      }
    }

    await sleep(model === 'gpt-4o' ? 500 : 250);
  }

  console.log(`\n─── Summary ────────────────────────────────`);
  console.log(`   reviewed:  ${reviewed}`);
  console.log(`   enriched:  ${enriched}${APPLY ? '' : ' (would enrich)'}`);
  if (JUNK_GATE) console.log(`   gated:     ${gated} flagged not-a-startup → entity_gate=junk`);
  if (PROMOTE_HOLDING) console.log(`   promoted:  ${promoted} holding → pending`);
  console.log(`   failed:    ${failed}`);
  const top = Object.entries(fillCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) {
    console.log(`   fields filled:`);
    for (const [f, c] of top) console.log(`     ${String(f).padEnd(24)} ${c}`);
  }
  if (!APPLY) console.log(`\n   Dry run — no writes. Re-run with --apply to persist.`);
  console.log('');
}

main().catch((e) => { console.error('[sage] fatal:', e); process.exit(1); });
