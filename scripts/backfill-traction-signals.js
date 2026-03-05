#!/usr/bin/env node
/**
 * backfill-traction-signals.js
 *
 * Tier 1 enrichment: parse existing pitch/description/extracted_data text
 * to infer and backfill structured boolean + array fields that the scoring
 * engine directly rewards:
 *
 *   is_launched      (+0.4 pts raw → +4 GOD)
 *   has_revenue      (+1.0 pts raw → +10 GOD)
 *   has_customers    (+0.6 pts raw → +6 GOD)
 *   has_demo         (+0.15 pts raw → +1.5 GOD)
 *   execution_signals  (array of matched tags)
 *   team_signals       (array of pedigree tags)
 *
 * Also backfills structured fields when values can be parsed from text:
 *   growth_rate_monthly   (extracted "X% MoM growth")
 *   mrr                   (extracted "$Xk MRR")
 *   arr_usd               (extracted "$X ARR")
 *   customer_count        (extracted "X customers/clients")
 *
 * Only updates a startup if at least one field changes.
 * Never overwrites fields that already have truthy values.
 *
 * Usage:
 *   node scripts/backfill-traction-signals.js [--dry-run] [--limit=N] [--force]
 *
 *   --dry-run  Preview what would change, don't write
 *   --limit=N  Process only N startups (default: all)
 *   --force    Re-process even startups that already have some signals set
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const CONCURRENCY = 30;

// ─── Pattern Libraries ────────────────────────────────────────────────────────

const LAUNCHED_PATTERNS = [
  /\b(launched|live|in production|deployed|in beta|publicly available|available now|shipped|released|went live|in market|operating|active(ly)?)\b/i,
  /\b(app store|play store|product hunt|general availability|ga launch)\b/i,
  /\b(customers (are |already )?(using|on|live|active)|serving customers|in use at)\b/i,
  /\b(mvp (is |is now )?(live|complete|launched|shipping)|product is live)\b/i,
  /\b(already (launched|deployed|live|operating))\b/i,
];

const REVENUE_PATTERNS = [
  /\b(generating revenue|has revenue|revenue([ -])?generating|profitable|cash flow positive)\b/i,
  /\b(arr|mrr|annual recurring|monthly recurring)\b.*(\$|usd|dollars)/i,
  /(\$|€|£|USD\s*)[\d,.]+\s*(k|m|million|thousand|hundred)?\s*(arr|mrr|revenue|sales|gmv)/i,
  /[\d,.]+\s*(k|m|million|thousand)?\s*(in\s+)?(revenue|sales|annual run rate)/i,
  /\b(subscription([ -])?based|software fee|license fee|saas pricing|paying customers|paid users|revenue model)\b/i,
  /\b(charged|charges|billing|billed|invoice|contract value|deal size)\b/i,
  /\b(paywall|freemium.*paid|upsell|cross-?sell|enterprise plan)\b/i,
];

const CUSTOMER_PATTERNS = [
  /\b(\d+[,\d]*)\+?\s*(paying |active |enterprise |b2b )?customers\b/i,
  /\b(\d+[,\d]*)\+?\s*(paying |active |enterprise )?clients\b/i,
  /\b(\d+[,\d]*)\+?\s*(monthly active|daily active|registered|paying) users\b/i,
  /\b(paying customers|enterprise customers|b2b customers|client base|customer base)\b/i,
  /\b(signed|onboarded|serving|work(ing)? with|powering)\s+[\d]+\s*(companies|organizations|brands|enterprises|hospitals|schools)\b/i,
  /\b(contracts|signed deals|lois|letters of intent|pilots)\b/i,
  /\b(has customers|customer traction|early customers|first customers|initial customers)\b/i,
];

const TEAM_PEDIGREE_PATTERNS = [
  { pattern: /\b(ex[-\s]?google|from google|google alumni|google engineer|google pm)\b/i, tag: 'Ex-Google' },
  { pattern: /\b(ex[-\s]?meta|ex[-\s]?facebook|from facebook|meta engineer)\b/i, tag: 'Ex-Meta' },
  { pattern: /\b(ex[-\s]?apple|from apple|apple engineer)\b/i, tag: 'Ex-Apple' },
  { pattern: /\b(ex[-\s]?amazon|from amazon|amazon engineer|aws)\b/i, tag: 'Ex-Amazon' },
  { pattern: /\b(ex[-\s]?microsoft|from microsoft)\b/i, tag: 'Ex-Microsoft' },
  { pattern: /\b(ex[-\s]?openai|openai (engineer|researcher|alumnu))\b/i, tag: 'Ex-OpenAI' },
  { pattern: /\b(ex[-\s]?stripe|stripe (engineer|alumni))\b/i, tag: 'Ex-Stripe' },
  { pattern: /\b(ex[-\s]?uber|uber (engineer|alumni))\b/i, tag: 'Ex-Uber' },
  { pattern: /\b(yc|y combinator|ycombinator)\b/i, tag: 'YC Alumni' },
  { pattern: /\b(stanford)\b/i, tag: 'Stanford' },
  { pattern: /\b(mit|massachusetts institute)\b/i, tag: 'MIT' },
  { pattern: /\b(harvard)\b/i, tag: 'Harvard' },
  { pattern: /\b(serial (founder|entrepreneur)|previously founded|second.time founder|2x founder|3x founder)\b/i, tag: 'Serial Founder' },
  { pattern: /\b(acquired|exit|acqui-?hire|ipo|exited|successful exit)\b/i, tag: 'Prior Exit' },
  { pattern: /\b(phd|doctorate|dr\.)\b/i, tag: 'PhD' },
  { pattern: /\b(techstars|500 startups|sequoia scout|a16z|andreessen)\b/i, tag: 'Top Accelerator' },
];

const DEMO_PATTERNS = [
  /\b(demo (available|ready|live|at)|try (our|the) demo|live demo|watch demo|demo\.)\b/i,
  /\b(prototype|proof of concept|poc|working prototype|functional prototype)\b/i,
  /\b(beta (available|access|users)|open beta|closed beta|beta testing)\b/i,
];

// ─── Numeric extractors ──────────────────────────────────────────────────────

function extractMRR(text) {
  // "$50K MRR", "50k mrr", "$1.2M MRR"
  const m = text.match(/(\$|€|£|USD\s*)?([\d,.]+)\s*(k|thousand|m|million)?\s*(mrr|monthly recurring revenue)/i);
  if (!m) return null;
  let num = parseFloat(m[2].replace(/,/g, ''));
  const unit = (m[3] || '').toLowerCase();
  if (unit.startsWith('m')) num *= 1000000;
  else if (unit.startsWith('k') || unit.startsWith('t')) num *= 1000;
  return num > 0 ? Math.round(num) : null;
}

function extractARR(text) {
  const m = text.match(/(\$|€|£|USD\s*)?([\d,.]+)\s*(k|thousand|m|million|b|billion)?\s*(arr|annual recurring revenue|annual run rate)/i);
  if (!m) return null;
  let num = parseFloat(m[2].replace(/,/g, ''));
  const unit = (m[3] || '').toLowerCase();
  if (unit.startsWith('b')) num *= 1000000000;
  else if (unit.startsWith('m')) num *= 1000000;
  else if (unit.startsWith('k') || unit.startsWith('t')) num *= 1000;
  return num > 0 ? Math.round(num) : null;
}

function extractGrowthRate(text) {
  // "30% MoM growth", "growing 25% month-over-month"
  const m = text.match(/([\d.]+)\s*%\s*(mom|month.over.month|monthly growth|monthly|per month|m\/m)/i)
    || text.match(/(growing|grew|grows)\s+(?:at\s+)?([\d.]+)\s*%\s*(monthly|mom|per month)?/i);
  if (!m) return null;
  const num = parseFloat(m[m[1].match(/^\d/) ? 1 : 2]);
  return num > 0 && num < 1000 ? Math.round(num) : null;
}

function extractCustomerCount(text) {
  // "500 customers", "1,200+ clients"
  const m = text.match(/([\d,]+)\+?\s*(paying\s+|active\s+|enterprise\s+|b2b\s+)?(customers|clients|users|companies|enterprises)/i);
  if (!m) return null;
  const num = parseInt(m[1].replace(/,/g, ''));
  return num > 0 && num < 10000000 ? num : null;
}

// ─── Main inference logic per startup ────────────────────────────────────────

function inferSignals(startup) {
  const ext = startup.extracted_data || {};

  // Build composite text from all available text fields
  const textSources = [
    startup.pitch,
    startup.description,
    startup.tagline,
    ext.description,
    ext.pitch,
    ext.tagline,
    ext.value_proposition,
    ext.problem,
    ext.solution,
    ext.traction,
    ext.team_description,
    // Array fields
    ...(Array.isArray(ext.execution_signals) ? ext.execution_signals : []),
    ...(Array.isArray(ext.team_signals) ? ext.team_signals : []),
  ].filter(Boolean).join(' ');

  if (!textSources || textSources.trim().length < 10) return null;

  const updates = {};
  const executionTags = new Set(Array.isArray(startup.execution_signals) ? startup.execution_signals : []);
  const teamTags = new Set(Array.isArray(startup.team_signals) ? startup.team_signals : []);

  // ── is_launched ──────────────────────────────────────────────────────────
  if (!startup.is_launched && !FORCE) {
    const isLaunched = LAUNCHED_PATTERNS.some(p => p.test(textSources));
    if (isLaunched) {
      updates.is_launched = true;
      executionTags.add('Product Launched');
    }
  }

  // ── has_revenue ─────────────────────────────────────────────────────────
  if (!startup.has_revenue) {
    const hasRevenue = REVENUE_PATTERNS.some(p => p.test(textSources));
    if (hasRevenue) {
      updates.has_revenue = true;
      executionTags.add('Has Revenue');
    }
  }

  // ── has_customers ────────────────────────────────────────────────────────
  if (!startup.has_customers) {
    const hasCustomers = CUSTOMER_PATTERNS.some(p => p.test(textSources));
    if (hasCustomers) {
      updates.has_customers = true;
      executionTags.add('Has Customers');
    }
  }

  // ── has_demo ─────────────────────────────────────────────────────────────
  if (!startup.has_demo) {
    const hasDemo = DEMO_PATTERNS.some(p => p.test(textSources));
    if (hasDemo) {
      updates.has_demo = true;
      executionTags.add('Has Demo');
    }
  }

  // ── team_signals ─────────────────────────────────────────────────────────
  for (const { pattern, tag } of TEAM_PEDIGREE_PATTERNS) {
    if (!teamTags.has(tag) && pattern.test(textSources)) {
      teamTags.add(tag);
    }
  }

  // ── Numeric extractions ──────────────────────────────────────────────────
  if (!startup.mrr) {
    const mrr = extractMRR(textSources);
    if (mrr) {
      updates.mrr = mrr;
      executionTags.add('Has Revenue');
      updates.has_revenue = true;
    }
  }

  if (!startup.arr_usd) {
    const arr = extractARR(textSources);
    if (arr) {
      updates.arr_usd = arr;
      executionTags.add('Has Revenue');
      updates.has_revenue = true;
    }
  }

  if (!startup.growth_rate_monthly) {
    const gr = extractGrowthRate(textSources);
    if (gr) {
      updates.growth_rate_monthly = gr;
      executionTags.add('Has Growth Rate');
    }
  }

  if (!startup.customer_count) {
    const cc = extractCustomerCount(textSources);
    if (cc) {
      updates.customer_count = cc;
      executionTags.add('Has Customers');
      updates.has_customers = true;
    }
  }

  // ── Write back tag arrays if they changed ─────────────────────────────────
  const origExec = JSON.stringify([...(startup.execution_signals || [])].sort());
  const newExec  = JSON.stringify([...executionTags].sort());
  if (origExec !== newExec) {
    updates.execution_signals = [...executionTags];
  }

  const origTeam = JSON.stringify([...(startup.team_signals || [])].sort());
  const newTeam  = JSON.stringify([...teamTags].sort());
  if (origTeam !== newTeam) {
    updates.team_signals = [...teamTags];
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Traction Signal Backfill${DRY_RUN ? ' [DRY RUN]' : ''}${FORCE ? ' [FORCE]' : ''} ===\n`);

  // Fetch all approved startups needing enrichment
  // If not --force, skip those that already have all booleans set
  let allStartups = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    let query = sb.from('startup_uploads')
      .select(`
        id, name, pitch, description, tagline,
        is_launched, has_revenue, has_customers, has_demo,
        execution_signals, team_signals,
        mrr, arr_usd, growth_rate_monthly, customer_count,
        extracted_data
      `)
      .eq('status', 'approved')
      .range(from, from + PAGE - 1);

    if (!FORCE) {
      // Only fetch startups missing at least one boolean
      query = query.or('is_launched.is.null,has_revenue.is.null,has_customers.is.null,execution_signals.is.null');
    }

    const { data, error } = await query;
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (LIMIT) allStartups = allStartups.slice(0, LIMIT);
  console.log(`Candidates to process: ${allStartups.length}`);

  // Run inference
  const pendingUpdates = [];
  let noText = 0;

  for (const startup of allStartups) {
    const updates = inferSignals(startup);
    if (!updates) {
      noText++;
      continue;
    }
    pendingUpdates.push({ id: startup.id, name: startup.name, updates });
  }

  // Tally what we'd set
  const tally = { is_launched: 0, has_revenue: 0, has_customers: 0, has_demo: 0,
    mrr: 0, arr_usd: 0, growth_rate_monthly: 0, customer_count: 0,
    execution_signals: 0, team_signals: 0 };

  for (const { updates } of pendingUpdates) {
    for (const k of Object.keys(tally)) {
      if (updates[k] !== undefined) tally[k]++;
    }
  }

  console.log(`\nInference results:`);
  console.log(`  No usable text (skipped): ${noText}`);
  console.log(`  Updates planned:          ${pendingUpdates.length}`);
  console.log();
  console.log(`  is_launched       will be set: ${tally.is_launched}`);
  console.log(`  has_revenue       will be set: ${tally.has_revenue}`);
  console.log(`  has_customers     will be set: ${tally.has_customers}`);
  console.log(`  has_demo          will be set: ${tally.has_demo}`);
  console.log(`  mrr               will be set: ${tally.mrr}`);
  console.log(`  arr_usd           will be set: ${tally.arr_usd}`);
  console.log(`  growth_rate_monthly will be set: ${tally.growth_rate_monthly}`);
  console.log(`  customer_count    will be set: ${tally.customer_count}`);
  console.log(`  execution_signals updated:     ${tally.execution_signals}`);
  console.log(`  team_signals      updated:     ${tally.team_signals}`);

  if (DRY_RUN) {
    console.log('\n--- Sample (first 20 updates) ---');
    pendingUpdates.slice(0, 20).forEach(({ name, updates }) => {
      const keys = Object.keys(updates).filter(k => k !== 'execution_signals' && k !== 'team_signals');
      const exec = updates.execution_signals;
      console.log(`  ${name?.substring(0, 40).padEnd(40)} → [${keys.join(', ')}]${exec ? ' exec:' + exec.join(',') : ''}`);
    });
    console.log('\n[Dry run — no writes]');
    return;
  }

  // Write in concurrent batches
  let written = 0;
  let errors = 0;

  for (let i = 0; i < pendingUpdates.length; i += CONCURRENCY) {
    const chunk = pendingUpdates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(({ id, updates }) =>
        sb.from('startup_uploads').update(updates).eq('id', id)
      )
    );
    for (const r of results) {
      if (r.error) errors++;
      else written++;
    }
    process.stdout.write(`\r  Written ${written + errors}/${pendingUpdates.length}  (${errors} errors)...`);
  }

  console.log(`\n\n✓ Done. Written: ${written}, Errors: ${errors}`);
  console.log('\nNext step: run `npx tsx scripts/recalculate-scores.ts` to update GOD scores.');
}

main().catch(err => { console.error(err); process.exit(1); });
