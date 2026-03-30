#!/usr/bin/env node
/**
 * normalize-junk-names.js
 * Ontological name normalization using disassociation policies.
 *
 * Linguistic model: verbs (and verb-like participials) are anchors.
 * The LEFT cluster of an anchor = descriptor/actor.
 * The RIGHT cluster = the actual startup name candidate.
 * Adjectives/geo-terms/category nouns complicate word strings — dissociate and discard them.
 *
 * Disassociation Policies (applied in order):
 *   P1  PARTICIPIAL_ANCHOR   — "Vienna-based Minimist"      → "Minimist"
 *   P2  PRESENTATIONAL_VERB  — "Introducing Tin Can"        → "Tin Can"
 *   P3  CAPITAL_EVENT_VERB   — "BigHat Launches Service"    → "BigHat" (left of verb)
 *   P4  DESCRIPTOR_PREFIX    — "French fintech Pennylane"   → "Pennylane"
 *   P5  MULTI_CLAUSE_SPLIT   — "X began Y while CTO was Z"  → apply P3 to clause 1
 *   REJECT                   — no valid name extractable
 *
 * Usage:
 *   node scripts/normalize-junk-names.js                   # dry run (show all matches)
 *   node scripts/normalize-junk-names.js --apply           # write name updates to DB
 *   node scripts/normalize-junk-names.js --apply --reject-unrecoverable
 *                                                          # also reject un-fixable entries
 *   node scripts/normalize-junk-names.js --score 55        # limit to GOD score ≤ 55
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('../lib/startupNameValidator');

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
);

const APPLY_MODE           = process.argv.includes('--apply');
const REJECT_UNRECOVERABLE = process.argv.includes('--reject-unrecoverable');
const SCORE_CEILING = (() => {
  const idx = process.argv.indexOf('--score');
  return idx >= 0 ? Number(process.argv[idx + 1]) : Infinity;
})();


// ─── GEOGRAPHIC TERMS (left-side descriptor indicators) ──────────────────────
// When one of these appears as a prefix cluster, it marks the LEFT side of
// a disassociation — the real actor lives to the RIGHT.
const GEO_TERMS = new Set([
  'french', 'german', 'british', 'american', 'indian', 'chinese', 'australian',
  'canadian', 'brazilian', 'spanish', 'italian', 'dutch', 'swedish', 'finnish',
  'norwegian', 'danish', 'israeli', 'singaporean', 'korean', 'japanese',
  'european', 'african', 'asian', 'nordic', 'global', 'international',
  'vienna', 'london', 'berlin', 'paris', 'amsterdam', 'stockholm', 'copenhagen',
  'tel aviv', 'singapore', 'australia', 'toronto', 'sydney', 'melbourne',
  'hong kong', 'new york', 'los angeles', 'san francisco', 'chicago', 'boston',
  'austin', 'seattle', 'denver', 'miami', 'atlanta', 'dallas', 'houston',
  'uk', 'us', 'eu', 'usa',
]);

// ─── CATEGORY / SECTOR NOUNS (descriptor nouns — not company names) ──────────
// These bind to proper nouns as classifiers: "French [fintech] Pennylane"
// They are ALWAYS descriptors when appearing as a prefix before a ProperNoun.
// IMPORTANT: only add words that are NEVER part of a real company name.
// "next", "first", "new" are excluded — they appear in real names (Next Insurance, First Round).
const CATEGORY_NOUNS = new Set([
  'startup', 'company', 'firm', 'venture', 'enterprise', 'platform',
  'app', 'tool', 'software', 'service', 'solution', 'product', 'system',
  'marketplace', 'exchange', 'protocol', 'infrastructure',
  'tech', 'fintech', 'healthtech', 'edtech', 'proptech', 'insurtech',
  'legaltech', 'cleantech', 'deeptech', 'biotech', 'regtech', 'martech',
  'adtech', 'wealthtech', 'govtech', 'agritech', 'retailtech', 'hrtech',
  'saas', 'paas', 'iaas', 'b2b', 'b2c', 'd2c', 'api', 'sdk',
  'ai', 'ml', 'llm', 'nlp', 'iot', 'ar', 'vr', 'blockchain',
  'crypto', 'defi', 'web3',
  'early-stage', 'seed-stage', 'growth-stage', 'pre-seed', 'stealth',
  'spinout', 'spinoff', 'spin-off', 'incubated',
  // Status/role descriptors that precede a proper name
  'former', 'unicorn', 'decacorn', 'soonicorn',
  // Specific compound sector classifiers that are never brand names
  'lendtech', 'insurtech', 'proptech',
]);

// ─── STOP WORDS — common English words that are never a startup name ──────────
// Single-word extraction results that match these are rejected even if they
// technically pass isValidStartupName (which has no stop-word gate).
const STOP_WORDS = new Set([
  'has', 'is', 'are', 'was', 'were', 'will', 'can', 'may', 'might', 'must',
  'have', 'had', 'does', 'did', 'be', 'been', 'being', 'do',
  'get', 'gets', 'got', 'make', 'makes', 'made', 'go', 'goes', 'went',
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'it', 'its', 'this', 'that', 'these', 'those', 'they', 'them',
  // Single-word remnants that are too generic to be a startup name
  'worth', 'biz', 'ecosystem', 'payment', 'insurance', 'network',
  'system', 'group', 'fund', 'capital', 'news', 'media', 'report',
]);


// ─── PARTICIPIAL ANCHORS (P1) ─────────────────────────────────────────────────
// "-based", "-backed", "-funded" etc. are participial anchors.
// They behave exactly like verb anchors: LEFT = descriptor, RIGHT = actor.
// "Vienna-based Minimist" → anchor=based, left=Vienna, right=Minimist
// "Sequoia-backed Stripe" → anchor=backed, left=Sequoia, right=Stripe
const PARTICIPIAL_ANCHOR_RE = /^(.+?)[-–](based|backed|funded|founded|led|built|born|focused|native|friendly|centric|powered|driven|enabled|supported|owned|operated|certified|incubated)\s+(.+)$/i;

// ─── PRESENTATIONAL VERBS (P2) ───────────────────────────────────────────────
// Intro verbs signal that the RIGHT side is the actor being introduced.
// "Introducing Tin Can" → Tin Can is the startup
const PRESENTATIONAL_VERB_RE = /^(?:introducing|meet|presenting|welcoming?|announcing|debuting|here(?:'s| is))\s+(.+)$/i;

// ─── CAPITAL EVENT VERBS (P3) ────────────────────────────────────────────────
// When a capital-event verb is present, the LEFT cluster is the startup.
// "BigHat Launches Service" → verb=Launches, left=BigHat
// This mirrors frameParser.ts's PATTERNS exactly — same linguistic model.
// NOTE: "partners" alone is excluded — it reads as a company-name noun
// ("Triton Partners", "Arax Investment Partners") far more often than a verb.
// The verb form "partners with" is caught below.
const CAPITAL_EVENT_VERB_RE = /\b(raises?|raised|secures?|secured|closes?|closed|launches?|launched|unveils?|unveiled|acquires?|acquired|partnered|partners?\s+with|merges?|merged|expands?|expanded|pivots?|pivoted|files?|filed|appoints?|appointed|hires?|hired|joins?|joined|wins?|won|lands?|landed|gets?\s+funding|receives?|received|signs?|signed|begins?|began|opens?|opened|debuts?|debuted|introduces?|introduced|announces?|announced|reveals?|revealed|releases?|released|deploys?|deployed|ships?|shipped|raises?\s+\$|closes?\s+\$|secures?\s+\$)\b/i;

// ─── SUBORDINATING CONJUNCTIONS (P5) — multi-clause boundary ─────────────────
// These mark where clause 1 ends and a subordinate modifier begins.
// "BigHat began prelaunch while their CTO was on vacation" → split at "while"
// Only clause 1 (LEFT of conjunction) is evaluated for actor extraction.
const SUBORDINATE_CONJ_RE = /\b(while|when|as\s+(?:it|its|their|the)\b|after|before|since|although|though|because|whereas|unless)\b/i;

// ─── TITLECASE CHUNK EXTRACTION (mirrors frameParser.ts) ─────────────────────
// Extracts contiguous TitleCase word groups — the same primitive the frameParser uses.
const TITLECASE_CHUNK_RE = /\b[A-Z][A-Za-z0-9]*(?:[\s][A-Z][A-Za-z0-9]*)*/g;

function pickFirstTitlecaseChunk(s) {
  const m = s.match(TITLECASE_CHUNK_RE);
  return m?.[0]?.trim() ?? null;
}

function pickLastTitlecaseChunk(s) {
  const m = s.match(TITLECASE_CHUNK_RE);
  return m?.length ? m[m.length - 1].trim() : null;
}

/**
 * Check whether a single token is a known descriptor (geo, category, stage).
 * When a token is a descriptor, it belongs to the LEFT cluster — not the actor.
 */
function isDescriptorToken(token) {
  const lower = token.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return GEO_TERMS.has(lower) || CATEGORY_NOUNS.has(lower);
}

/**
 * Check whether a candidate extracted name should be rejected as a stop word.
 * Single-word results that are common English words or too-generic nouns are rejected.
 */
function isStopWordCandidate(candidate) {
  const words = candidate.trim().split(/\s+/);
  // Only gate single-word extractions — multi-word candidates can have generic words
  if (words.length > 1) return false;
  return STOP_WORDS.has(words[0].toLowerCase());
}

/**
 * Check whether a multi-word geo phrase is a prefix of the candidate string.
 * Handles "Hong Kong Fintech Startup" → strips "Hong Kong" as a geo term.
 */
function stripMultiWordGeoPrefix(name) {
  const lower = name.toLowerCase();
  for (const geo of GEO_TERMS) {
    if (geo.includes(' ') && lower.startsWith(geo + ' ')) {
      return name.slice(geo.length).trim();
    }
  }
  return null;
}

/**
 * P4: Strip a leading descriptor prefix chain and return the remainder.
 *
 * "French fintech Pennylane"         → strips "French fintech" → "Pennylane"
 * "Hong Kong Fintech Startup"        → strips "Hong Kong" (multi-word geo) → "Fintech Startup"
 *                                      → strips "Fintech Startup" → null (all descriptors)
 * "Early-stage AI startup Draftbit"  → strips prefix → "Draftbit"
 * "BigHat"                           → nothing stripped → null (no change needed)
 *
 * Stops stripping as soon as it hits a non-descriptor token.
 * Requires at least one token to remain on the RIGHT after stripping.
 */
function stripDescriptorPrefixChain(name) {
  // First check for multi-word geo prefix (e.g. "Hong Kong", "New York")
  const multiWordStripped = stripMultiWordGeoPrefix(name);
  if (multiWordStripped) {
    // Recursively strip any remaining descriptor prefix
    const further = stripDescriptorPrefixChain(multiWordStripped);
    return further ?? multiWordStripped;
  }

  const tokens = name.split(/\s+/);
  let i = 0;
  while (i < tokens.length - 1) {
    if (isDescriptorToken(tokens[i])) {
      i++;
    } else {
      break;
    }
  }
  if (i === 0) return null; // nothing stripped
  return tokens.slice(i).join(' ') || null;
}

/**
 * Core disassociation engine.
 *
 * Applies policies in order. Each policy models the same linguistic principle:
 * find the anchor, classify the LEFT cluster, extract the RIGHT cluster as candidate.
 *
 * depth: recursion guard (max 2) — prevents infinite loops when stripping
 * reveals another strippable prefix.
 *
 * Returns: { extracted, policy, confidence } | { extracted: null, policy: 'NO_MATCH' }
 */
function dissociate(name, depth = 0) {
  if (depth > 2) return { extracted: null, policy: 'MAX_DEPTH', confidence: 0 };
  const s = name.trim();

  // P5: MULTI_CLAUSE_SPLIT
  // Subordinating conjunctions mark the boundary between the main clause
  // (which contains the actor) and modifier clauses (which are pure context).
  // Split here first, then apply remaining policies to clause 1 only.
  const conjMatch = s.match(SUBORDINATE_CONJ_RE);
  if (conjMatch && conjMatch.index > 2) {
    const clause1 = s.slice(0, conjMatch.index).trim();
    if (clause1.length > 2) {
      const inner = dissociate(clause1, depth + 1);
      if (inner.extracted) {
        return { ...inner, policy: `P5→${inner.policy}` };
      }
    }
  }

  // P1: PARTICIPIAL_ANCHOR
  // "-based", "-backed", "-funded" act as verb anchors separating descriptor from actor.
  // LEFT of anchor = known descriptor (location, investor, category).
  // RIGHT of anchor = the startup name candidate.
  // After extracting the RIGHT side, recursively apply P4 in case the right side is
  // itself a descriptor chain: "HongShan-Backed Hong Kong Fintech Startup" →
  //   P1 right = "Hong Kong Fintech Startup" → P4 strips → still junk → REJECT
  const partMatch = s.match(PARTICIPIAL_ANCHOR_RE);
  if (partMatch) {
    const [, left, anchor, right] = partMatch;
    let candidate = pickFirstTitlecaseChunk(right) ?? right.trim();
    if (candidate && candidate.length > 1) {
      // Recursive P4: strip any descriptor chain from the extracted right side
      const recursiveStrip = stripDescriptorPrefixChain(candidate);
      if (recursiveStrip && recursiveStrip !== candidate) {
        candidate = pickFirstTitlecaseChunk(recursiveStrip) ?? recursiveStrip;
      }
      // Post-extraction gate: reject if the candidate is a descriptor or stop word
      if (candidate && candidate.length > 1 && !isDescriptorToken(candidate) && !isStopWordCandidate(candidate)) {
        return {
          extracted: candidate,
          policy: 'P1_PARTICIPIAL',
          confidence: 0.90,
          debug: { left: left.trim(), anchor, right: right.trim() },
        };
      }
    }
  }

  // P2: PRESENTATIONAL_VERB
  // Intro verbs ("Introducing", "Meet", "Presenting") declare the RIGHT side as the actor.
  // The verb is the anchor; LEFT is empty/implicit; RIGHT is the startup being introduced.
  const presMatch = s.match(PRESENTATIONAL_VERB_RE);
  if (presMatch) {
    const candidate = presMatch[1].trim();
    if (candidate.length > 1) {
      return {
        extracted: candidate,
        policy: 'P2_PRESENTATIONAL',
        confidence: 0.85,
      };
    }
  }

  // P3: CAPITAL_EVENT_VERB
  // When a capital-event verb is present, the LEFT cluster before the verb is the startup.
  // "BigHat Launches Service" → verb=Launches → LEFT=BigHat → actor
  // This mirrors frameParser.ts's slot extraction: verbIdx → title.slice(0, verbIdx)
  // Guard: verb must NOT be the terminal word — "Triton Partners" has "Partners" at end
  // with no content to the right, meaning it's a noun, not a verb usage.
  const verbMatch = s.match(CAPITAL_EVENT_VERB_RE);
  if (verbMatch && verbMatch.index > 0) {
    const afterVerb = s.slice(verbMatch.index + verbMatch[0].length).trim();
    if (afterVerb.length > 1) { // verb must have content after it (it's acting as a verb)
      const leftSide = s.slice(0, verbMatch.index).trim();
      if (leftSide.length > 1) {
        const candidate = pickLastTitlecaseChunk(leftSide) ?? leftSide;
        if (candidate && candidate.length > 1 && !isDescriptorToken(candidate) && !isStopWordCandidate(candidate)) {
          return {
            extracted: candidate,
            policy: 'P3_CAPITAL_VERB',
            confidence: 0.85,
            debug: { verb: verbMatch[0], left: leftSide },
          };
        }
      }
    }
  }

  // P4: DESCRIPTOR_PREFIX_CHAIN
  // Stacked adjective/geo/category prefix before a ProperNoun.
  // "French fintech Pennylane" → strip "French fintech" → "Pennylane"
  // Adjectives complicate the word string but the terminal ProperNoun is the actor.
  //
  // After stripping, recursively apply dissociate() to the remainder — this catches
  // cases where the stripped result still contains a capital-event verb:
  // "Startup Vima Adds Parkinson" → strip "Startup" → "Vima Adds Parkinson"
  //   → recursive P3 → verb="Adds" → left="Vima" → extracted="Vima"
  const stripped = stripDescriptorPrefixChain(s);
  if (stripped && stripped !== s) {
    // First try recursive dissociation on the stripped remainder
    if (depth < 2) {
      const inner = dissociate(stripped, depth + 1);
      if (inner.extracted && !isDescriptorToken(inner.extracted) && !isStopWordCandidate(inner.extracted)) {
        return { ...inner, policy: `P4→${inner.policy}` };
      }
    }
    // Fall back to taking the first TitleCase chunk of the stripped remainder
    const candidate = pickFirstTitlecaseChunk(stripped) ?? stripped;
    if (
      candidate &&
      candidate.length > 1 &&
      !isDescriptorToken(candidate) &&
      !isStopWordCandidate(candidate)
    ) {
      return {
        extracted: candidate,
        policy: 'P4_DESCRIPTOR_PREFIX',
        confidence: 0.75,
        debug: { stripped },
      };
    }
  }

  return { extracted: null, policy: 'NO_MATCH', confidence: 0 };
}

async function run() {
  const modeLabel = APPLY_MODE
    ? `⚡ APPLY MODE${REJECT_UNRECOVERABLE ? ' + REJECT UNRECOVERABLE' : ''}`
    : '🔍 DRY RUN';
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  JUNK NAME NORMALIZER — ${modeLabel}`);
  if (SCORE_CEILING < Infinity) console.log(`  GOD score ceiling: ≤ ${SCORE_CEILING}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Paginated fetch — stable order, full dataset
  let allData = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    let q = supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, status')
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (SCORE_CEILING < Infinity) q = q.lte('total_god_score', SCORE_CEILING);
    const { data, error } = await q;
    if (error) { console.error('Fetch error:', error.message); return; }
    allData = allData.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`📊 Loaded ${allData.length} approved startup records\n`);

  const updates      = []; // { id, original, extracted, policy, score }
  const rejections   = []; // { id, original, policy, score, tried? }
  const clean        = []; // no change needed

  for (const row of allData) {
    const name = (row.name || '').trim();

    if (!name) {
      rejections.push({ ...row, policy: 'EMPTY_NAME' });
      continue;
    }

    const result = dissociate(name);

    // No policy fired
    if (!result.extracted) {
      const precheck = isValidStartupName(name);
      if (!precheck.isValid) {
        rejections.push({ id: row.id, original: name, policy: `NO_MATCH:${precheck.reason}`, score: row.total_god_score });
      } else {
        clean.push(row);
      }
      continue;
    }

    const candidate = result.extracted.trim();

    // Extraction is a no-op (normalized == original)
    if (candidate.toLowerCase() === name.toLowerCase()) {
      clean.push(row);
      continue;
    }

    // Gate: validate the extracted candidate through the ontological validator
    const valid = isValidStartupName(candidate);
    if (valid.isValid) {
      updates.push({
        id: row.id,
        original: name,
        extracted: candidate,
        policy: result.policy,
        confidence: result.confidence,
        score: row.total_god_score,
      });
    } else {
      rejections.push({
        id: row.id,
        original: name,
        extracted: candidate,
        policy: `${result.policy}:INVALID(${valid.reason})`,
        score: row.total_god_score,
      });
    }
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log(`✅ CLEAN  (no change):         ${clean.length}`);
  console.log(`🔄 NORMALIZABLE (update name): ${updates.length}`);
  console.log(`❌ UNRECOVERABLE (reject):     ${rejections.length}`);
  console.log('');

  // Group updates by policy for visibility
  const byPolicy = {};
  updates.forEach(u => {
    byPolicy[u.policy] = (byPolicy[u.policy] || 0) + 1;
  });
  if (Object.keys(byPolicy).length) {
    console.log('─── Updates by policy ──────────────────────────────────────────');
    Object.entries(byPolicy).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => {
      console.log(`  ${p.padEnd(30)} ${n}`);
    });
    console.log('');
  }

  if (updates.length) {
    console.log('─── NORMALIZABLE NAMES (first 50) ──────────────────────────────');
    updates.slice(0, 50).forEach(u => {
      const score = u.score != null ? `GOD ${String(u.score).padStart(3)}` : '      ';
      console.log(`  [${score}] [${u.policy}]`);
      console.log(`    "${u.original}"  →  "${u.extracted}"`);
    });
    if (updates.length > 50) console.log(`  ... and ${updates.length - 50} more`);
    console.log('');
  }

  if (rejections.length) {
    console.log('─── UNRECOVERABLE (first 30) ───────────────────────────────────');
    rejections.slice(0, 30).forEach(r => {
      const score = r.score != null ? `GOD ${String(r.score).padStart(3)}` : '      ';
      const tried = r.extracted ? `  → tried: "${r.extracted}"` : '';
      console.log(`  [${score}] [${r.policy}] "${r.original}"${tried}`);
    });
    if (rejections.length > 30) console.log(`  ... and ${rejections.length - 30} more`);
    console.log('');
  }

  if (!APPLY_MODE) {
    console.log('ℹ️  On --apply: entries whose normalized name already exists in the DB will be');
    console.log('   rejected as duplicates instead of renamed. This is correct deduplication.');
    console.log('💡 To apply:');
    console.log('   node scripts/normalize-junk-names.js --apply');
    console.log('   node scripts/normalize-junk-names.js --apply --reject-unrecoverable');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DRY RUN COMPLETE — No changes made.');
    console.log('═══════════════════════════════════════════════════════════════');
    return;
  }

  // ─── APPLY: NAME UPDATES ─────────────────────────────────────────────────────
  // Attempt rename for each entry. If the unique constraint fires (error code 23505),
  // the normalized name already exists in the table — this entry is a descriptor-prefixed
  // duplicate, so reject it instead of renaming. No pre-fetch needed.
  if (updates.length) {
    console.log(`\n⚡ Applying ${updates.length} name normalizations...`);
    let renamed = 0;
    let deduped = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (const u of updates) {
      // Try rename first
      const { error: renameErr } = await supabase
        .from('startup_uploads')
        .update({
          name: u.extracted,
          admin_notes: `normalized [${u.policy}]: "${u.original}" → "${u.extracted}"`,
          reviewed_at: now,
        })
        .eq('id', u.id)
        .eq('status', 'approved');

      if (!renameErr) {
        renamed++;
      } else if (renameErr.code === '23505' || (renameErr.message || '').includes('unique')) {
        // Name already taken — reject this descriptor-prefixed duplicate
        const { error: rejectErr } = await supabase
          .from('startup_uploads')
          .update({
            status: 'rejected',
            admin_notes: `auto-rejected: duplicate of existing entry "${u.extracted}" [${u.policy}] (normalize-junk-names.js)`,
            reviewed_at: now,
          })
          .eq('id', u.id)
          .eq('status', 'approved');
        if (rejectErr) {
          console.error(`  ✗ dedupe-reject id=${u.id}: ${rejectErr.message}`);
          failed++;
        } else {
          deduped++;
        }
      } else {
        console.error(`  ✗ rename id=${u.id}: ${renameErr.message}`);
        failed++;
      }
      process.stdout.write(`  ${renamed + deduped + failed}/${updates.length}\r`);
    }
    console.log(`\n  ✅ Renamed: ${renamed}  |  Deduped (rejected): ${deduped}  |  Failed: ${failed}`);
  }

  // ─── APPLY: REJECTIONS ───────────────────────────────────────────────────────
  if (REJECT_UNRECOVERABLE && rejections.length) {
    console.log(`\n📛 Rejecting ${rejections.length} unrecoverable entries...`);
    const BATCH = 100;
    let done = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < rejections.length; i += BATCH) {
      const batch = rejections.slice(i, i + BATCH);
      const ids = batch.map(r => r.id);
      const { error } = await supabase
        .from('startup_uploads')
        .update({
          status: 'rejected',
          admin_notes: `auto-rejected: no valid name extractable (normalize-junk-names.js) — policy=${batch[0]?.policy}`,
          reviewed_at: now,
        })
        .in('id', ids)
        .eq('status', 'approved');
      if (error) {
        console.error(`  ✗ batch ${i}: ${error.message}`);
      } else {
        done += ids.length;
      }
      process.stdout.write(`  ${Math.min(i + BATCH, rejections.length)}/${rejections.length}\r`);
    }
    console.log(`\n  ✅ Rejected ${done} entries.`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  NORMALIZATION COMPLETE');
  console.log('  Re-run: npm run recalc  to refresh GOD scores after cleanup.');
  console.log('═══════════════════════════════════════════════════════════════');
}

run().catch(console.error);
