#!/usr/bin/env node
/**
 * ENRICH FROM RSS NEWS
 * ─────────────────────────────────────────────────────────────────────────────
 * Matches startup_events (from RSS scraper) to approved startups and enriches
 * their profiles with press signals, funding, and M&A info.
 *
 * Identifies:
 *   - Amount: funding size ($XM, $XB, etc.)
 *   - Stage: seed, pre-seed, series-a/b/c, bridge, growth, debt, convertible-note
 *   - Acquisitions & mergers (startup_exits, company_status, funding_outcomes)
 *
 * Run: node scripts/enrich-from-rss-news.js
 *   --all           # Review ALL approved startups (recommended for full coverage)
 *   --limit 200     # Or process up to N startups
 *   --dry-run       # Preview without writing
 *   --skip-recalc   # Skip auto-running recalculate-scores.ts at the end
 *
 * If startups were updated, automatically runs recalculate-scores.ts to refresh GOD scores.
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Same tiers as enrich-web-signals.mjs (scoring compatibility)
const TIER1_DOMAINS = [
  'techcrunch', 'forbes', 'wsj', 'bloomberg', 'reuters', 'ft.com', 'venturebeat',
  'wired', 'theinformation', 'axios', 'cnbc', 'businessinsider', 'fortune',
  'inc.com', 'fastcompany', 'thenextweb', 'sifted', 'eu-startups', 'crunchbase',
];
const PR_WIRE_DOMAINS = [
  'businesswire', 'prnewswire', 'globenewswire', 'accesswire', 'prnews',
  'einpresswire', 'prweb', 'newswire', 'send2press',
];

// Reject entity names that look like article fragments (common words, headlines, news outlets)
const JUNK_ENTITY_WORDS = new Set([
  'the', 'a', 'an', 'into', 'from', 'with', 'for', 'safe', 'direct', 'longer', 'commercial',
  'americans', 'ashley', 'base', 'predict', 'daily', 'human', 'joins', 'cr',
  'wall street journal', 'wsj', 'finland', 'jennifer',
]);
// Patterns that indicate article headline fragments, not company names
const JUNK_ENTITY_PATTERNS = [
  /^(ai-powered|ai infrastructure|ai founder|voice ai|every ai|healthtech)/i,
  /(raises?|boosts?|makes?|looking|deployed|recently|yesterday)\s*$/i,
  /^(complete system|technologies yesterday|the daily|d2c brand|nvidia boosts)/i,
  /^(with amazon|metamask crypto|billion for|predict human|debt isn)/i,
  /^(anthropic recently|february while|shift towards|waymo looking)/i,
  /^(techcrunch trace|techcrunch fundamental|moneycontrol\.com|marketscreener\.com)/i,
  /^(latvian deep|european investment bank|dutch payments|sports-focused prediction)/i,
  /^(food waste|muscle-computer|qa test your|goodbye cloud)/i,
  /^(tether investments|google spinout startup|agentic ai firm)/i,
  /^gen-\d/i,
];

const DAYS_LOOKBACK = 180; // 6 months of events

function domainOfPublisher(publisher) {
  if (!publisher || typeof publisher !== 'string') return '';
  return publisher.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
}

function classifyTier(publisher) {
  const dom = domainOfPublisher(publisher);
  if (TIER1_DOMAINS.some(t => dom.includes(t))) return 'tier1';
  if (PR_WIRE_DOMAINS.some(t => dom.includes(t))) return 'tier3';
  return 'tier2';
}

function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/i, '');
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  // One contains the other (e.g. "Acme" vs "Acme Inc")
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

function entityNamesFromEvent(event) {
  const names = new Set();
  const add = (n) => {
    if (!n || typeof n !== 'string') return;
    const t = n.trim();
    if (t.length < 3 || t.length > 60) return;
    const norm = normalizeName(t);
    if (JUNK_ENTITY_WORDS.has(norm)) return;
    if (JUNK_ENTITY_PATTERNS.some(p => p.test(t))) return;
    names.add(t);
  };
  if (event.subject) add(event.subject);
  if (event.object && !/^(round|funding|series|seed)/i.test(event.object)) add(event.object);
  const entities = event.entities;
  if (Array.isArray(entities)) {
    entities.forEach(e => {
      if (e && e.name && typeof e.name === 'string') add(e.name);
    });
  }
  return [...names];
}

/** Parse amounts from event (object or array) to numeric USD. Returns null if unparseable. */
function parseAmountToUsd(amounts) {
  const amt = amounts && (Array.isArray(amounts) ? amounts[0] : amounts);
  if (!amt || typeof amt !== 'object') return null;
  if (amt.usd != null && typeof amt.usd === 'number') return Math.round(amt.usd);
  const val = amt.value;
  const mag = (amt.magnitude || '').toUpperCase();
  if (val == null || typeof val !== 'number') return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[mag] || 1e6; // default M
  return Math.round(val * mult);
}

/** Normalize round to canonical stage: seed, series-a, series-b, bridge, growth, debt, etc. */
function normalizeRoundToStage(round, sourceTitle = '') {
  const text = (round || sourceTitle || '').toLowerCase();
  if (/pre-seed|preseed/.test(text)) return 'pre-seed';
  if (/\bseed\b/.test(text)) return 'seed';
  if (/angel/.test(text)) return 'angel';
  if (/series\s*a|series a/.test(text)) return 'series-a';
  if (/series\s*b|series b/.test(text)) return 'series-b';
  if (/series\s*c|series c/.test(text)) return 'series-c';
  if (/series\s*d|series d/.test(text)) return 'series-d';
  if (/series\s*e|series e/.test(text)) return 'series-e';
  if (/\bbridge\b/.test(text)) return 'bridge';
  if (/growth/.test(text)) return 'growth';
  if (/debt/.test(text)) return 'debt';
  if (/convertible|convertible\s*note/.test(text)) return 'convertible-note';
  return round || null;
}

/** Extract round from source_title when event.round is null (for existing/future events). */
function extractRoundFromTitle(title) {
  if (!title || typeof title !== 'string') return null;
  const m = title.match(/\b(Pre-Seed|Seed|Angel|Series\s+[A-E]|Growth|Debt|Bridge|Convertible\s+note)\b/i);
  return m ? m[1] : null;
}

const EVENTS_PAGE_SIZE = 1000;

async function fetchRecentEvents() {
  const since = new Date(Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000).toISOString();
  const all = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('startup_events')
      .select('id, event_id, event_type, subject, object, entities, amounts, round, source_publisher, source_title, source_url, source_published_at, occurred_at')
      .gte('occurred_at', since)
      .in('event_type', ['FUNDING', 'INVESTMENT', 'ACQUISITION', 'MERGER', 'LAUNCH', 'PARTNERSHIP', 'OTHER'])
      .order('occurred_at', { ascending: false })
      .range(offset, offset + EVENTS_PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < EVENTS_PAGE_SIZE) break;
    offset += EVENTS_PAGE_SIZE;
  }
  return all;
}

const STARTUPS_PAGE_SIZE = 1000;

async function fetchApprovedStartups(limit) {
  if (limit > 1000) {
    // Fetch all approved startups (paginate — Supabase returns max 1000 per request)
    const all = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('id, name, extracted_data')
        .eq('status', 'approved')
        .range(offset, offset + STARTUPS_PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < STARTUPS_PAGE_SIZE) break;
      offset += STARTUPS_PAGE_SIZE;
    }
    return all;
  }
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id, name, extracted_data')
    .eq('status', 'approved')
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');
  let limit = 500;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) limit = parseInt(args[limitIdx + 1], 10) || 500;
  if (all) limit = 50000;

  console.log('\n📰 ENRICH FROM RSS NEWS\n');
  console.log('═'.repeat(60));
  if (dryRun) console.log('  (DRY RUN — no writes)\n');

  const [events, startups] = await Promise.all([
    fetchRecentEvents(),
    fetchApprovedStartups(limit),
  ]);

  console.log(`  Events: ${events.length} (last ${DAYS_LOOKBACK} days)`);
  console.log(`  Startups: ${startups.length}\n`);

  if (events.length === 0) {
    console.log('  No events to process. Run RSS scraper first.');
    return;
  }

  // Build startup name -> startup map (support multiple name variants)
  const startupByName = new Map();
  for (const s of startups) {
    const key = normalizeName(s.name);
    if (!startupByName.has(key)) startupByName.set(key, s);
    // Also add without suffix (e.g. "Acme Inc" -> "acme")
    const base = key.replace(/\s+(inc|llc|ltd|corp|limited)\.?$/i, '').trim();
    if (base && !startupByName.has(base)) startupByName.set(base, s);
  }

  // For each event, find matching startups and aggregate
  const startupSignals = new Map(); // startupId -> { tier1, tier2, tier3, total, funding, articles, events }
  for (const event of events) {
    const names = entityNamesFromEvent(event);
    if (names.length === 0) continue;

    let matchedStartup = null;
    for (const n of names) {
      const key = normalizeName(n);
      matchedStartup = startupByName.get(key);
      if (!matchedStartup && key.length > 2) {
        for (const [k, s] of startupByName) {
          if (k.includes(key) || key.includes(k)) { matchedStartup = s; break; }
        }
      }
      if (matchedStartup) break;
    }
    if (!matchedStartup) continue;

    // Skip startups whose names look like article fragments or news outlets
    const startupNorm = normalizeName(matchedStartup.name);
    if (JUNK_ENTITY_WORDS.has(startupNorm)) continue;
    if (JUNK_ENTITY_PATTERNS.some(p => p.test(matchedStartup.name))) continue;
    if (/^(wall street|techcrunch|forbes|bloomberg|reuters)\b/i.test(matchedStartup.name)) continue;

    const tid = matchedStartup.id;
    if (!startupSignals.has(tid)) {
      startupSignals.set(tid, {
        startup: matchedStartup,
        tier1: 0, tier2: 0, tier3: 0, total: 0,
        funding_events: [], // { amounts, round, source_*, occurred_at, event_id } — for funding_outcomes
        exit_events: [],    // { event_type, amounts, object, source_*, occurred_at } — for startup_exits
        articles: [],
      });
    }
    const sig = startupSignals.get(tid);

    const tier = classifyTier(event.source_publisher);
    if (tier === 'tier1') sig.tier1++;
    else if (tier === 'tier3') sig.tier3++;
    else sig.tier2++;
    sig.total++;

    // Track funding events (FUNDING, INVESTMENT) for funding_outcomes
    const isFunding = event.event_type === 'FUNDING' || event.event_type === 'INVESTMENT';
    if (isFunding) {
      const rawRound = event.round || extractRoundFromTitle(event.source_title);
      const stage = normalizeRoundToStage(rawRound, event.source_title);
      sig.funding_events.push({
        event_id: event.event_id,
        amounts: event.amounts,
        round: rawRound,
        stage,
        source_url: event.source_url,
        source_title: event.source_title,
        source_published_at: event.source_published_at,
        occurred_at: event.occurred_at || event.source_published_at,
      });
    }

    // Track exit events (ACQUISITION, MERGER) for startup_exits
    const isExit = event.event_type === 'ACQUISITION' || event.event_type === 'MERGER';
    if (isExit) {
      sig.exit_events.push({
        event_type: event.event_type,
        amounts: event.amounts,
        object: event.object, // typically acquirer
        source_url: event.source_url,
        source_title: event.source_title,
        source_published_at: event.source_published_at,
        occurred_at: event.occurred_at || event.source_published_at,
      });
    }

    sig.articles.push({
      title: event.source_title,
      url: event.source_url,
      publisher: event.source_publisher,
      tier,
      published_at: event.source_published_at,
    });
  }

  // Derive best funding for extracted_data merge (latest by date)
  for (const [_id, sig] of startupSignals) {
    if (sig.funding_events.length === 0) continue;
    const sorted = [...sig.funding_events].sort((a, b) => {
      const da = new Date(a.occurred_at || a.source_published_at || 0).getTime();
      const db = new Date(b.occurred_at || b.source_published_at || 0).getTime();
      return db - da;
    });
    const latest = sorted[0];
    const amt = latest.amounts && (Array.isArray(latest.amounts) ? latest.amounts[0] : latest.amounts);
    sig.funding_amount = amt || null;
    sig.funding_stage = latest.stage || latest.round || null;
  }

  const totalFundingEvents = [...startupSignals.values()].reduce((s, sig) => s + (sig.funding_events?.length || 0), 0);
  const totalExitEvents = [...startupSignals.values()].reduce((s, sig) => s + (sig.exit_events?.length || 0), 0);
  const startupsWithFunding = [...startupSignals.values()].filter(s => (s.funding_events?.length || 0) > 0).length;
  const startupsWithExits = [...startupSignals.values()].filter(s => (s.exit_events?.length || 0) > 0).length;

  console.log(`  Matched: ${startupSignals.size} startups have RSS news mentions`);
  if (totalFundingEvents > 0 || totalExitEvents > 0) {
    console.log(`  Funding events to record: ${totalFundingEvents} (${startupsWithFunding} startups)`);
    console.log(`  Exit events to record: ${totalExitEvents} (${startupsWithExits} startups)`);
  }
  console.log('');

  let updated = 0;
  let fundingOutcomesInserted = 0;
  let exitsInserted = 0;

  // Pre-fetch existing funding_outcomes and startup_exits for fast in-memory dedupe
  const startupIds = [...startupSignals.keys()];
  const existingFunding = new Set();
  const existingExits = new Set();
  const BATCH = 100;
  for (let i = 0; i < startupIds.length; i += BATCH) {
    const ids = startupIds.slice(i, i + BATCH);
    const [foRes, exRes] = await Promise.all([
      supabase.from('funding_outcomes').select('startup_id, outcome_type, outcome_date, funding_round').in('startup_id', ids).limit(5000),
      supabase.from('startup_exits').select('startup_id, source_url').in('startup_id', ids).limit(2000),
    ]);
    for (const r of foRes.data || []) {
      const d = r.outcome_date ? new Date(r.outcome_date).toISOString().slice(0, 10) : '';
      existingFunding.add(`${r.startup_id}|${r.outcome_type}|${d}|${r.funding_round || ''}`);
    }
    for (const r of exRes.data || []) {
      existingExits.add(`${r.startup_id}|${r.source_url || ''}`);
    }
  }
  const { data: acqData } = await supabase.from('funding_outcomes').select('startup_id').eq('outcome_type', 'acquired').in('startup_id', startupIds);
  const acquiredByStartup = new Set((acqData || []).map(r => r.startup_id));

  console.log('  Pre-fetch done. Processing startups...\n');
  let processed = 0;
  const fundingBatch = [];
  const BULK_INSERT_SIZE = 50;

  for (const [_id, sig] of startupSignals) {
    processed++;
    if (processed % 50 === 0) {
      console.log(`  Progress: ${processed}/${startupSignals.size} startups, ${fundingOutcomesInserted} funding, ${exitsInserted} exits...`);
    }
    const startup = sig.startup;
    const existing = startup.extracted_data || {};
    const existingWeb = existing.web_signals || {};
    const existingPress = existingWeb.press_tier || {};

    // Merge RSS counts with existing (Google News) - additive
    const newPressTier = {
      tier1_count: (existingPress.tier1_count || 0) + sig.tier1,
      tier2_count: (existingPress.tier2_count || 0) + sig.tier2,
      tier3_pr_count: (existingPress.tier3_pr_count || 0) + sig.tier3,
      total: (existingPress.total || 0) + sig.total,
      tier1_sources: [...new Set([
        ...(existingPress.tier1_sources || []),
        ...sig.articles.filter(a => a.tier === 'tier1').map(a => domainOfPublisher(a.publisher)).slice(0, 5),
      ])].slice(0, 8),
      rss_article_count: sig.total,
      rss_enriched_at: new Date().toISOString(),
      fetched_at: existingPress.fetched_at || new Date().toISOString(),
    };

    const mergedExtracted = { ...existing };
    mergedExtracted.web_signals = {
      ...existingWeb,
      press_tier: newPressTier,
      fetch_version: existingWeb.fetch_version || 1,
      enriched_at: new Date().toISOString(),
    };

    // Merge funding (prefer latest from RSS if startup has none in extracted_data)
    if (sig.funding_amount && !existing.funding_amount) {
      mergedExtracted.funding_amount = sig.funding_amount;
    }
    if (sig.funding_stage && !existing.funding_stage) {
      mergedExtracted.funding_stage = sig.funding_stage;
    }

    // Track funding events in funding_outcomes (batch inserts, in-memory dedupe)
    if (!dryRun && sig.funding_events && sig.funding_events.length > 0) {
      for (const ev of sig.funding_events) {
        const fundingAmount = parseAmountToUsd(ev.amounts);
        const outcomeDate = ev.occurred_at || ev.source_published_at;
        const outcomeDateStr = outcomeDate ? new Date(outcomeDate).toISOString().slice(0, 10) : '';
        const roundVal = ev.stage || ev.round || null;
        const key = `${startup.id}|funded|${outcomeDateStr}|${roundVal || ''}`;
        if (existingFunding.has(key)) continue;
        existingFunding.add(key);
        fundingBatch.push({
          startup_id: startup.id,
          startup_name: startup.name,
          outcome_type: 'funded',
          funding_amount: fundingAmount,
          funding_round: roundVal,
          outcome_date: outcomeDate || null,
        });
        if (fundingBatch.length >= BULK_INSERT_SIZE) {
          const { error: foErr } = await supabase.from('funding_outcomes').insert(fundingBatch);
          if (foErr) console.error(`  ⚠️ funding_outcomes batch: ${foErr.message}`);
          else fundingOutcomesInserted += fundingBatch.length;
          fundingBatch.length = 0;
        }
      }
    }

    // Track exit events in startup_exits and update company_status
    if (!dryRun && sig.exit_events && sig.exit_events.length > 0) {
      for (const ev of sig.exit_events) {
        if (existingExits.has(`${startup.id}|${ev.source_url || ''}`)) continue;
        existingExits.add(`${startup.id}|${ev.source_url || ''}`);
        const exitType = ev.event_type === 'MERGER' ? 'merger' : 'acquisition';
        const amt = ev.amounts && (Array.isArray(ev.amounts) ? ev.amounts[0] : ev.amounts);
        const exitValue = (amt && amt.raw) ? amt.raw : 'Undisclosed';
        const exitValueNumeric = parseAmountToUsd(ev.amounts);
        const exitDate = (ev.occurred_at || ev.source_published_at || '').slice(0, 10);
        const { error: exErr } = await supabase
          .from('startup_exits')
          .insert({
            startup_id: startup.id,
            startup_name: startup.name,
            exit_type: exitType,
            exit_date: exitDate || null,
            exit_value: exitValue,
            exit_value_numeric: exitValueNumeric,
            acquirer_name: ev.object || null,
            source_url: ev.source_url,
            source_title: ev.source_title,
            source_date: ev.source_published_at,
            deal_status: 'completed',
          });
        if (exErr) {
          console.error(`  ⚠️ startup_exits ${startup.name}: ${exErr.message}`);
        } else {
          exitsInserted++;
        }
        // Also record in funding_outcomes for ML (outcome_type=acquired)
        if (!acquiredByStartup.has(startup.id)) {
          acquiredByStartup.add(startup.id);
          const exitDate = ev.occurred_at || ev.source_published_at;
          await supabase.from('funding_outcomes').insert({
            startup_id: startup.id,
            startup_name: startup.name,
            outcome_type: 'acquired',
            outcome_date: exitDate || null,
          });
        }
      }
    }

    if (!dryRun) {
      const updatePayload = { extracted_data: mergedExtracted, updated_at: new Date().toISOString() };
      if (sig.exit_events && sig.exit_events.length > 0) {
        updatePayload.company_status = 'acquired';
      }
      let { error } = await supabase.from('startup_uploads').update(updatePayload).eq('id', startup.id);
      if (error && error.message && error.message.includes('company_status')) {
        delete updatePayload.company_status;
        const retry = await supabase.from('startup_uploads').update(updatePayload).eq('id', startup.id);
        error = retry.error;
      }
      if (error) {
        console.error(`  ❌ ${startup.name}: ${error.message}`);
        continue;
      }
      updated++;
    }

    const t1 = newPressTier.tier1_count;
    const total = newPressTier.total;
    const amtObj = sig.funding_amount && (Array.isArray(sig.funding_amount) ? sig.funding_amount[0] : sig.funding_amount);
    const amountStr = amtObj?.raw ? ` amount=${amtObj.raw}` : '';
    const stageStr = sig.funding_stage ? ` stage=${sig.funding_stage}` : '';
    const exitParts = (sig.exit_events || []).map(e => `${e.event_type?.toLowerCase() || 'exit'}${e.object ? ` by ${e.object}` : ''}`);
    const exitStr = exitParts.length ? ` | ${exitParts.join(', ')}` : '';
    if (t1 > 0 || total >= 2 || sig.funding_events?.length || sig.exit_events?.length) {
      console.log(`  ${dryRun ? '[DRY] ' : '✅ '}${startup.name}: t1=${t1} total=${total}${amountStr}${stageStr}${exitStr}`);
    }
  }

  if (fundingBatch.length > 0) {
    const { error: foErr } = await supabase.from('funding_outcomes').insert(fundingBatch);
    if (foErr) console.error(`  ⚠️ funding_outcomes batch (final): ${foErr.message}`);
    else fundingOutcomesInserted += fundingBatch.length;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n  Updated: ${updated} startups`);
  if (!dryRun) {
    if (fundingOutcomesInserted > 0) console.log(`  Funding outcomes recorded: ${fundingOutcomesInserted}`);
    if (exitsInserted > 0) console.log(`  Exits recorded: ${exitsInserted}`);
    const skipRecalc = process.argv.includes('--skip-recalc');
    if (updated > 0 && !skipRecalc) {
      console.log('\n  Running recalculate-scores.ts to refresh GOD scores...\n');
      await runRecalculateScores();
      console.log('\n  ✓ recalculate-scores.ts completed.\n');
    } else if (updated > 0 && skipRecalc) {
      console.log('  Run: npx tsx scripts/recalculate-scores.ts');
    }
  }
  console.log('');
}

function runRecalculateScores() {
  return new Promise((resolve, reject) => {
    const cwd = path.resolve(__dirname, '..');
    const child = spawn('npx', ['tsx', 'scripts/recalculate-scores.ts'], {
      stdio: 'inherit',
      cwd,
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`recalculate-scores exited with ${code}`))));
  });
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
