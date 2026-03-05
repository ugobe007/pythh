#!/usr/bin/env node
/**
 * REMOVE EMPTY STARTUPS
 * Rejects approved startups with no website AND no meaningful data.
 * Safe: sets status='rejected', does NOT hard-delete.
 *
 * Usage:
 *   node scripts/remove-empty-startups.js --dry-run   # preview
 *   node scripts/remove-empty-startups.js             # apply
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

function scoreDataRichness(s) {
  let signals = 0;
  const ed = s.extracted_data || {};

  // Top-level columns (real schema)
  if (s.website || s.company_website) signals += 2;
  if ((s.pitch || s.description || '').length > 30) signals++;
  if (s.sectors?.length > 0) signals++;
  if (s.stage) signals++;
  if (s.raise_amount || s.last_round_amount_usd || s.total_funding_usd) signals++;
  if (s.customer_count || s.parsed_customers) signals++;
  if (s.mrr || s.arr || s.arr_usd || s.revenue_usd) signals++;
  if (s.team_size || s.team_size_estimate || s.parsed_headcount) signals++;
  if (s.location) signals++;
  if ((s.tagline || '').length > 10) signals++;
  if (s.has_revenue) signals++;
  if (s.has_customers) signals++;
  if (s.founders) signals++;
  if ((s.growth_rate || s.arr_growth_rate) > 0) signals++;

  // extracted_data fields
  if (ed.team || ed.founders || ed.team_background) signals++;
  if (ed.revenue || ed.mrr || ed.arr || ed.traction || ed.customers) signals++;
  if (ed.funding || ed.raised || ed.backed_by || ed.investors) signals++;
  if (ed.market_size || ed.tam || ed.market || ed.target_market) signals++;
  if (ed.description || ed.summary) signals++;
  if ((ed.value_proposition || '').length > 10) signals++;
  if ((ed.problem || '').length > 10) signals++;
  if ((ed.solution || '').length > 10) signals++;

  return signals;
}

// Article-title verb patterns — name came from RSS article title
const ARTICLE_VERB_PATTERNS = [
  /\b(has|have)\s+(raised|secured|closed|launched|announced|partnered|acquired|expanded|won|received)/i,
  /\b(raises?|raised)\s+(\$|€|£|\d)/i,
  /\b(secures?|secured)\s+(\$|€|£|\d)/i,
  /\b(closes?)\s+(funding|round|deal|series)\b/i,
  /\b(announces?)\s+(new|launch|partnership|funding)/i,
  /\b(acquires?|acquired)\s+\w/i,
  // Verb chains in the middle of multi-word names
  /\b(raises?|raised|drives?|drove|secures?|secured|launches?|launched|partnered|announces?|announced|expands?|expanded|wins?|won|cuts?|files?\s+for)\b/i,
];

// Single-word generic dictionary nouns that are never company names
const GENERIC_SINGLE_WORDS = new Set([
  'refinance','refinancing','nutrition','natural','organic','renewable','sustainable',
  'digital','virtual','mobile','wireless','broadband','cloud','cyber','smart',
  'banking','insurance','lending','mortgage','investing','trading','crypto','bitcoin',
  'healthcare','wellness','fitness','therapy','medical','pharma',
  'logistics','transport','shipping','delivery','commerce','retail','marketing',
  'analytics','automation','optimization','infrastructure','platform','solution',
  'enterprise','startup','venture','capital','equity','fund','portfolio',
  'innovation','disruption','transformation','acceleration',
  'software','hardware','firmware','semiconductor','microchip',
  'engineering','manufacturing','processing',
  'education','learning','training','coaching',
  'media','content','streaming','broadcasting','publishing',
  'energy','solar','wind','nuclear','hydrogen','battery',
  'agriculture','farming','livestock','aquaculture',
  'construction','architecture','interior','exterior',
  'cybersecurity','blockchain','metaverse','nft','defi','dao',
  'tomorrow','today','future','next','beyond','above','below',
]);

// Well-known political figures and celebrities
const POLITICAL_FIGURE_PATTERN = /^(ocasio|ocasio-cortez|aoc|biden|trump|harris|obama|pelosi|bernie\s+sanders|warren|desantis|rob\s+bresnahan|yongming)/i;

const GENERIC_NAME_PATTERNS = [
  /^post\s+\w+$/i,           // "Post Alora", "Post Mightyfly"
  /^in\s+round\b/i,          // "In Round..."
  /^receives?\s/i,            // "Receives funding"
  /^\d+\s*(million|billion)/i,
  /^test[-_]?\d{4,}/i,
  /^cleantest/i,
  /^quicktest/i,
  /^testmatch/i,
  /^newstartup$/i,
  /^test[-_]startup/i,
  // "Series X Funding" or "Series X Round" patterns
  /^series\s+[a-e]\s+(funding|round|raise)/i,
  // Article title with dash/hyphen separator (e.g. "Company X - SomeTopic")
  /\s-\s.*(funding|round|raise|launch|partner|acqui|expan)/i,
];

function isJunkName(name) {
  if (!name || name.trim().length < 2) return 'name too short';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // Political figures / known individuals (not companies)
  if (POLITICAL_FIGURE_PATTERN.test(trimmed)) return 'political figure or individual';

  // Single generic dictionary noun — ONLY when name is EXACTLY that word (no numbers, no prefix)
  // "Pharma" → flagged, but "35Pharma" or "Pharma Inc" → not flagged
  if (!trimmed.includes(' ') && GENERIC_SINGLE_WORDS.has(lower)) {
    return `generic single-word noun (${trimmed})`;
  }

  // Article verb chain in multi-word name — require 3+ words to reduce false positives
  // (avoids flagging "Drive Health", "Partners Health", etc.)
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) {
    for (const p of ARTICLE_VERB_PATTERNS) {
      if (p.test(trimmed)) return 'article headline verb in name';
    }
  }
  for (const p of GENERIC_NAME_PATTERNS) {
    if (p.test(name)) return 'generic non-company name pattern';
  }
  return null;
}

(async () => {
  console.log(DRY_RUN ? '\n🔍 DRY RUN — no changes will be made\n' : '\n🗑️  REMOVING empty/junk startups\n');

  // Fetch all approved startups — need columns + extracted_data
  let allStartups = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb.from('startup_uploads')
      .select('id, name, website, company_website, pitch, description, sectors, stage, raise_amount, last_round_amount_usd, total_funding_usd, customer_count, parsed_customers, mrr, arr, arr_usd, revenue_usd, team_size, team_size_estimate, parsed_headcount, location, tagline, has_revenue, has_customers, founders, growth_rate, arr_growth_rate, total_god_score, extracted_data')
      .eq('status', 'approved')
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    allStartups = allStartups.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Loaded ${allStartups.length} approved startups\n`);

  const toReject = [];

  for (const s of allStartups) {
    const richness = scoreDataRichness(s);
    const junkReason = isJunkName(s.name);

    // Reject if: junk name regardless of data
    if (junkReason) {
      toReject.push({ ...s, reason: junkReason, richness });
      continue;
    }

    // Reject if: no website AND no extracted data whatsoever (richness <= 1)
    if (!s.website && !s.company_website && richness <= 1) {
      toReject.push({ ...s, reason: 'no website + no data', richness });
      continue;
    }

    // Reject if: no website AND data richness is effectively zero (name-only entry)
    if (!s.website && !s.company_website && richness <= 2 && !s.pitch && !s.tagline) {
      toReject.push({ ...s, reason: 'no website, name-only entry', richness });
      continue;
    }

    // Reject if: no website AND barely any data (just name + maybe sector/stage, no substance)
    if (!s.website && !s.company_website && richness <= 3 && !(s.pitch || s.description || '').length) {
      toReject.push({ ...s, reason: 'no website, no description', richness });
      continue;
    }

    // Reject thin no-URL entries whose pitch is an RSS article snippet (short + low score)
    const pitchText = (s.pitch || s.description || '');
    const isThinPitch = pitchText.length > 0 && pitchText.length < 80;
    if (!s.website && !s.company_website && isThinPitch && (s.total_god_score || 0) < 40) {
      toReject.push({ ...s, reason: 'no website, RSS snippet as pitch (low score)', richness });
      continue;
    }
  }

  // Group by reason
  const byReason = {};
  for (const s of toReject) {
    byReason[s.reason] = (byReason[s.reason] || 0) + 1;
  }

  console.log(`Found ${toReject.length} entries to reject out of ${allStartups.length}\n`);
  console.log('By reason:');
  Object.entries(byReason).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => {
    console.log(`  ${String(n).padStart(4)}  ${r}`);
  });

  const avgScoreBefore = allStartups.reduce((a, b) => a + (b.total_god_score || 0), 0) / allStartups.length;
  const remaining = allStartups.filter(s => !toReject.find(r => r.id === s.id));
  const avgScoreAfter = remaining.reduce((a, b) => a + (b.total_god_score || 0), 0) / remaining.length;

  console.log(`\nAvg GOD score: ${Math.round(avgScoreBefore)} → ${Math.round(avgScoreAfter)} after cleanup`);
  console.log(`Remaining startups: ${remaining.length}\n`);

  // Show samples per reason
  const shown = {};
  console.log('Sample entries:');
  for (const s of toReject) {
    shown[s.reason] = (shown[s.reason] || 0);
    if (shown[s.reason] < 5) {
      console.log(`  [${s.total_god_score}] ${(s.name || '').slice(0, 45).padEnd(45)}  (${s.reason}, richness=${s.richness})`);
      shown[s.reason]++;
    }
  }

  if (DRY_RUN) {
    console.log(`\n✅ DRY RUN done. Would reject ${toReject.length} entries.`);
    console.log('Run without --dry-run to apply.\n');
    return;
  }

  // Apply in batches
  const ids = toReject.map(s => s.id);
  const BATCH = 200;
  let done = 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await sb.from('startup_uploads')
      .update({ status: 'rejected', admin_notes: 'automated cleanup: no website + no data' })
      .in('id', batch);
    if (error) {
      console.error(`  ❌ Batch ${i}-${i + BATCH}: ${error.message}`);
    } else {
      done += batch.length;
    }
  }

  console.log(`\n✅ Rejected ${done} entries.`);
  console.log('Next: run bash run-recalc.sh to update score distribution.\n');
})();
