#!/usr/bin/env node
/**
 * ENRICH FROM RSS NEWS
 * ─────────────────────────────────────────────────────────────────────────────
 * Matches startup_events (from RSS scraper) to approved startups and enriches
 * their profiles with press signals and funding/traction info from the news.
 *
 * - Aggregates press mentions by tier (TechCrunch=tier1, PR wire=tier3, etc.)
 * - Merges into extracted_data.web_signals.press_tier (additive with Google News)
 * - Extracts funding (amounts, round) and merges into extracted_data if missing
 *
 * Run: node scripts/enrich-from-rss-news.js
 *   --limit 200     # Process up to 200 startups
 *   --dry-run       # Preview without writing
 *   --all           # Process all approved startups
 *
 * After running, re-run: npx tsx scripts/recalculate-scores.ts
 */

require('dotenv').config();
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

async function fetchRecentEvents() {
  const since = new Date(Date.now() - DAYS_LOOKBACK * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('startup_events')
    .select('id, subject, object, entities, amounts, round, source_publisher, source_title, source_url, source_published_at')
    .gte('occurred_at', since)
    .in('event_type', ['FUNDING', 'INVESTMENT', 'ACQUISITION', 'LAUNCH', 'PARTNERSHIP', 'OTHER']);
  if (error) throw error;
  return data || [];
}

async function fetchApprovedStartups(limit) {
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
  const startupSignals = new Map(); // startupId -> { tier1, tier2, tier3, total, funding, articles }
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
        funding_amount: null, funding_stage: null,
        articles: [],
      });
    }
    const sig = startupSignals.get(tid);

    const tier = classifyTier(event.source_publisher);
    if (tier === 'tier1') sig.tier1++;
    else if (tier === 'tier3') sig.tier3++;
    else sig.tier2++;
    sig.total++;

    if (event.amounts && Array.isArray(event.amounts) && event.amounts[0] && !sig.funding_amount) {
      sig.funding_amount = event.amounts[0];
    }
    if (event.round && !sig.funding_stage) {
      sig.funding_stage = event.round;
    }
    sig.articles.push({
      title: event.source_title,
      url: event.source_url,
      publisher: event.source_publisher,
      tier,
      published_at: event.source_published_at,
    });
  }

  console.log(`  Matched: ${startupSignals.size} startups have RSS news mentions\n`);

  let updated = 0;
  for (const [_id, sig] of startupSignals) {
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

    // Merge funding if we have it and startup doesn't
    if (sig.funding_amount && !existing.funding_amount && !startup.funding_amount) {
      mergedExtracted.funding_amount = sig.funding_amount;
    }
    if (sig.funding_stage && !existing.funding_stage && !startup.funding_stage) {
      mergedExtracted.funding_stage = sig.funding_stage;
    }

    if (!dryRun) {
      const { error } = await supabase
        .from('startup_uploads')
        .update({ extracted_data: mergedExtracted, updated_at: new Date().toISOString() })
        .eq('id', startup.id);
      if (error) {
        console.error(`  ❌ ${startup.name}: ${error.message}`);
        continue;
      }
      updated++;
    }

    const t1 = newPressTier.tier1_count;
    const total = newPressTier.total;
    if (t1 > 0 || total >= 2) {
      console.log(`  ${dryRun ? '[DRY] ' : '✅ '}${startup.name}: t1=${t1} total=${total}${sig.funding_amount ? ` funding=${sig.funding_amount}` : ''}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n  Updated: ${updated} startups`);
  if (!dryRun && updated > 0) {
    console.log('  Run: npx tsx scripts/recalculate-scores.ts');
  }
  console.log('');
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
