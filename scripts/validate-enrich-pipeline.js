#!/usr/bin/env node
/**
 * validate-enrich-pipeline.js
 *
 * Three-pass validation gate for sparse/held startups.
 * A startup must clear at least ONE of the three passes to survive.
 * If it fails all three, it is auto-rejected.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PASS 1 — Semantic / Ontological Parsing                             │
 * │  Can we extract or confirm a valid startup name?                     │
 * │  Uses disassociation policies + stop-word gates from                 │
 * │  normalize-junk-names.js.  Name corrections are applied immediately  │
 * │  in --apply mode so that Passes 2 & 3 run against the cleaner name. │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  PASS 2 — News Correlation                                           │
 * │  Does this name appear in ANY news / community source?               │
 * │  Queries Google News, PRNewswire, Substack, Hacker News, Reddit.     │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │  PASS 3 — Inference Engine                                           │
 * │  Can we resolve a live domain for this startup?                      │
 * │  Tries primary slug then auto-generated typo/corruption variants.    │
 * │  Name corrections (e.g. Aplibotics → Amplibotics) are saved in      │
 * │  --apply mode.                                                       │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * If a startup fails PASS 2 AND PASS 3, it is marked rejected.
 * (PASS 1 failure alone is not grounds for rejection — the name may simply
 * be unusual, like a pure invented word. Passes 2 & 3 are the evidence gates.)
 *
 * Usage:
 *   node scripts/validate-enrich-pipeline.js                          # dry run
 *   node scripts/validate-enrich-pipeline.js --apply                  # persist corrections + rejections
 *   node scripts/validate-enrich-pipeline.js --limit 50               # test on first 50
 *   node scripts/validate-enrich-pipeline.js --concurrency 3          # parallel workers (default 3)
 *
 *   Rescue mode — re-run P2+P3 on auto-rejected companies using expanded 30-source news registry:
 *   node scripts/validate-enrich-pipeline.js --rescue-rejected              # dry run (P2+P3)
 *   node scripts/validate-enrich-pipeline.js --rescue-rejected --apply      # apply rescues
 *   node scripts/validate-enrich-pipeline.js --rescue-rejected --p3-only    # domain only (fast, ~10 min)
 *   node scripts/validate-enrich-pipeline.js --rescue-rejected --p3-only --apply  # fast apply
 *   node scripts/validate-enrich-pipeline.js --rescue-rejected --days 7     # look back 7 days
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('../lib/startupNameValidator');
const { searchStartupNews, inferDomainFromName, scoreNarrativeRole } = require('../server/services/inferenceService');

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '').trim()
);

const APPLY_MODE       = process.argv.includes('--apply');
const RESCUE_MODE      = process.argv.includes('--rescue-rejected'); // re-run P2+P3 on auto-rejects
const P3_ONLY          = process.argv.includes('--p3-only');          // rescue mode: skip P2, domain-only (faster)
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : Infinity; })();
const CONCURRENCY = (() => { const i = process.argv.indexOf('--concurrency'); return i >= 0 ? Number(process.argv[i + 1]) : 3; })();
// --days N: how far back to look for auto-rejections in rescue mode (default: 30)
const RESCUE_DAYS = (() => { const i = process.argv.indexOf('--days'); return i >= 0 ? Number(process.argv[i + 1]) : 30; })();

// ═══════════════════════════════════════════════════════════════════════════════
// ONTOLOGICAL PARSING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
//
// Linguistic model: every string has an entity TYPE. Startup names are noun
// phrases of type ORGANIZATION/BRAND. Strings that resolve to other types
// (SENTENCE_FRAGMENT, INVESTOR, GOVERNMENT, MEDIA_CONCAT, CATEGORY_NOUN)
// are ontological mismatches — they cannot be valid startup names regardless
// of syntactic appearance.
//
// Entity types:
//   SENTENCE_FRAGMENT  — contains verb anchors, preposition chains, or
//                        subordinate conjunctions that mark it as a clause,
//                        not a noun phrase. HARD FAIL — reject immediately.
//   INVESTOR           — ends in VC/Fund/Capital/Partners/Holdings/Equity.
//                        Wrong entity type for a startup database. HARD FAIL.
//   GOVERNMENT         — contains institutional/civic keywords (Department,
//                        Ministry, Authority, State Development). HARD FAIL.
//   MEDIA_CONCAT       — first word is a known media/data site. The second
//                        part may be the real startup name. RECOVERABLE.
//   CORPORATE_PREFIX   — first word is a corporate relationship descriptor
//                        (Subsidiary, Portfolio, Division). RECOVERABLE.
//   GEO_DESC_PREFIX    — first word is a geographic or sector descriptor
//                        (French, Fintech, European). RECOVERABLE.
//   CATEGORY_NOUN      — single word that is a pure English category noun
//                        with no brand signal (Costs, Bankers, Perspectives).
//                        SOFT FAIL — skip to P2/P3 evidence gate.
//   STARTUP            — plausible startup name noun phrase. PASS.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GEO / SECTOR DESCRIPTOR TABLE ───────────────────────────────────────────
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

// ─── CATEGORY NOUNS (descriptor prefixes, never brand names) ─────────────────
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
  'chip', 'chips', 'agent', 'agents', 'bot', 'bots', 'copilot',
  'network', 'networks', 'protocol', 'protocols',
  'data', 'analytics', 'intelligence', 'compute', 'computing',
  'cloud', 'edge', 'quantum', 'robotics', 'autonomous',
  'management', 'operations', 'automation', 'workflow',
  'payments', 'payment', 'lending', 'insurance', 'banking',
  'therapeutics', 'diagnostics', 'genomics', 'imaging',
  // domain/industry terms used as prefixes
  'primary', 'care', 'litigation', 'legal', 'medical', 'clinical', 'digital',
  'school', 'bus', 'mobility', 'logistics', 'freight', 'supply', 'chain',
  'construction', 'real', 'estate', 'retail', 'consumer', 'industrial',
  'defense', 'security', 'cyber', 'enterprise', 'commercial', 'residential',
  'lithography', 'semiconductor', 'materials', 'hardware', 'embedded',
  'space', 'satellite', 'drone', 'aerial', 'marine', 'energy', 'solar', 'nuclear',
  'early-stage', 'seed-stage', 'growth-stage', 'pre-seed', 'stealth',
  'spinout', 'spinoff', 'spin-off', 'incubated',
  'former', 'unicorn', 'decacorn', 'soonicorn',
  'subsidiary', 'division', 'portfolio', 'portfolio-company', 'wholly-owned',
  'affiliate', 'joint-venture', 'wholly', 'owned',
]);

// ─── STOP WORDS ───────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'has', 'is', 'are', 'was', 'were', 'will', 'can', 'may', 'might', 'must',
  'have', 'had', 'does', 'did', 'be', 'been', 'being', 'do',
  'get', 'gets', 'got', 'make', 'makes', 'made', 'go', 'goes', 'went',
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'it', 'its', 'this', 'that', 'these', 'those', 'they', 'them',
  'worth', 'biz', 'ecosystem', 'payment', 'insurance', 'network',
  'system', 'group', 'fund', 'capital', 'news', 'media', 'report',
  // pure plural category words — never a brand
  'costs', 'bankers', 'suvs', 'trucks', 'cars', 'loans', 'banks', 'funds',
  'stocks', 'bonds', 'shares', 'markets', 'brands', 'firms', 'ventures',
  'services', 'solutions', 'platforms', 'applications', 'systems', 'tools',
  'products', 'features', 'updates', 'releases', 'announcements',
  'perspectives', 'insights', 'reports', 'trends', 'ideas', 'thoughts',
  'tips', 'tricks', 'lessons', 'notes', 'updates', 'news', 'stories',
  // common English words that produce false-positive domain matches
  'use', 'using', 'used', 'build', 'building', 'built', 'bring', 'brings',
  'make', 'making', 'create', 'creating', 'launch', 'launches', 'help',
  'helps', 'drive', 'drives', 'grow', 'grows', 'scale', 'scales',
  'operating', 'operation', 'endpoint', 'nanotech', 'deeptech',
  'prepaid', 'simple', 'advance', 'advanced',
  'validate', 'replace', 'shift', 'generate', 'manage', 'connect',
  // funding stage labels — never a company name
  'seed', 'series', 'pre-seed', 'bridge', 'round', 'raise',
  // common generic two-word phrases that produce false positive domains
  'series a', 'series b', 'series c', 'series d',
  'skill ecosystem', 'oral peptide',
]);

// ─── KNOWN MEDIA / DATA AGGREGATOR SITE PREFIXES ─────────────────────────────
// When these appear as the first word of a multi-word name, the second part
// is likely the real startup name scraped with the source site prepended.
const KNOWN_MEDIA_PREFIXES = new Set([
  // African / emerging market tech media
  'ventureburn', 'entrackr', 'disruptafrica', 'techcabal', 'techpoint',
  'innovationvillage', 'watchdoq', 'techinasia', 'technode', 'krasia',
  // Global tech media
  'techcrunch', 'venturebeat', 'thenextweb', 'sifted', 'techeu',
  'restofworld', 'wired', 'fastcompany', 'businessinsider', 'axios',
  'theverge', 'mashable', 'startupnation', 'startupblink', 'startups',
  // Data / research platforms (often prepended as source)
  'crunchbase', 'pitchbook', 'dealroom', 'cbinsights', 'tracxn',
  'angellist', 'producthunt', 'ycombinator',
  // Newsletters / aggregators
  'geekwire', 'pymnts', 'finsmes', 'eu-startups', 'failory',
  // Generic news aggregator artifacts
  'notepad', 'summary', 'digest', 'roundup', 'recap', 'daily', 'weekly',
]);

// ─── VERB-INITIAL SENTENCE FRAGMENT DETECTION ────────────────────────────────
// If the string starts with a verb (conjugated, past tense, gerund), it is
// a clause or sentence — not a noun phrase, not a startup name.
//
// Linguistic anchor: verbs are the engine of a sentence. A string beginning
// with a verb is telling a story about an implied or explicit subject.
// "led to a startup idea" → verb "led" anchors a past-tense clause.
// "raising a new fund" → gerund "raising" anchors an ongoing-action clause.
// Verb-initial sentence fragment detector.
// Covers past tense, present tense, gerunds, prepositions, demonstratives as first word.
const VERB_INITIAL_RE = /^(?:led|said|told|found|made|built|launched?|raised?|closed?|secured?|announced?|acquired?|merged?|partnered?|joined?|exited?|filed?|listed?|pivoted?|grew|expanded?|entered?|opened?|dropped?|hit|crossed?|reached?|signed?|completed?|selected?|won|beat|set|broke|hired?|named?|came|went|got|did|has|is|are|was|were|will|would|could|should|must|does|do|had|embeds?|fuels?|adds?|slides?|gains?|loses?|attracts?|enables?|powers?|backs?|leads?|drives?|cuts?|beats?|takes?|makes?|runs?|sees?|shows?|helps?|uses?|brings?|keeps?|gets?|sets?|lets?|gives?|puts?|sends?|raising|building|launching|growing|scaling|pivoting|merging|acquiring|introducing|featuring|presenting|announcing|joining|closing|securing|keeping|bringing|embedding|fuell?ing|adding|sliding|gaining|losing|enabling|powering|helping|using|taking|running|showing|telling|making|a\s|an\s|the\s|to\s|of\s|in\s|at\s|by\s|from\s|with\s|for\s|this\s|these\s|those\s|their\s|its\s|our\s|my\s|your\s|\d+)\b/i;

  // Internal preposition chains — signals the string is a mid-sentence fragment
  // "led to a startup idea", "of the largest biotech"
  const INTERNAL_PREP_CHAIN_RE = /\b(?:to a|to the|of a|of the|in a|in the|on a|on the|for a|for the|with a|with the|from a|from the)\b/i;

// Stock market / financial headline: "[Company] Shares [market verb]"
// "Nintendo Shares Gain", "Tesla Stock Drops", "Apple Shares Rise After Earnings"
// "shares" / "stock" here are NOUNS (the company's equity), not verbs.
// This is structurally [Actor][Noun][Verb] — a sentence, not a startup name.
const STOCK_HEADLINE_RE = /^(.+?)\s+(?:shares?|stock)\s+(?:gain|gains|rise|rises|rose|fell|fall|falls|drop|drops|dropped|slip|slips|slipped|surge|surges|surged|climb|climbs|climbed|plunge|plunges|plunged|jump|jumps|jumped|tumble|tumbles|tumbled|slide|slides|slid|soar|soars|soared|rally|rallies|rallied|retreat|retreats|retreated|dip|dips|dipped|sink|sinks|sank|recover|recovers|recovered|extend|extends|extended|pare|pares|pared)\b/i;

// ─── INVESTOR ENTITY DETECTION ────────────────────────────────────────────────
// These suffixes mark investor/fund entities, not startups.
// "Deetech Vc", "360 Capital", "Third Rock Partners", "Acme Holdings"
const INVESTOR_SUFFIX_RE = /\b(?:vc|venture\s+capital|fund(?:s)?|holdings?|equity|asset\s+management|associates?|investment(?:s)?)\s*$/i;

// Standalone "Capital" or "Partners" at the end of a multi-word name.
// Single-word "Capital" could be a startup brand — require ≥2 words.
// "360 Capital" → 2 words, ends in Capital → INVESTOR
// "Human Capital Management" → 3 words, ends in Management (not caught here — different pattern)
const INVESTOR_CAPITAL_END_RE  = /^.+\s+capital\s*$/i;
const INVESTOR_PARTNERS_END_RE = /^.+\s+partners\s*$/i;

// Compound investor patterns — always investor regardless of position
const INVESTOR_STRONG_RE = /\b(?:capital\s+partners|equity\s+partners|growth\s+partners|venture\s+partners|seed\s+fund|growth\s+fund|micro\s*vc|angel\s+fund|family\s+office)\b/i;

// ─── GOVERNMENT / INSTITUTIONAL ENTITY DETECTION ─────────────────────────────
// "Empire State Development", "Ministry of Trade", "Office of Innovation"
const GOVT_KEYWORD_RE = /\b(?:department|ministry|office|bureau|agency|authority|commission|council|committee|board|government|municipality|prefecture|province)\b/i;
// "State Development", "Economic Development", "Regional Development Corporation"
const GOVT_DEV_RE = /\b(?:state|economic|regional|national|local|municipal|city|county|provincial|federal)\s+(?:development|corporation|enterprise|authority|agency|council|board)\b/i;

// ─── DISASSOCIATION POLICY REGEXES ───────────────────────────────────────────
// These implement the verb-anchor parsing model: verbs divide a string into
// left (descriptor/actor) and right (subject/object) clusters.

// P1 — Participial anchor: "Vienna-based Minimist" → anchor=based, right=Minimist
const PARTICIPIAL_ANCHOR_RE = /^(.+?)[-–](based|backed|funded|founded|led|built|born|focused|native|friendly|centric|powered|driven|enabled|supported|owned|operated|certified|incubated)\s+(.+)$/i;

// P2 — Presentational verb: "Introducing Tin Can" → right=Tin Can
const PRESENTATIONAL_VERB_RE = /^(?:introducing|meet|presenting|welcoming?|announcing|debuting|here(?:'s| is))\s+(.+)$/i;

// P3 — Capital event verb: "BigHat Launches Service" → left=BigHat
const CAPITAL_EVENT_VERB_RE = /^(.+?)\s+(?:launches?|acquires?|raises?|closes?|secures?|announces?|expands?|pivots?|merges?|partners?\s+with|joins?|exits?|spins?\s+off|shuts?\s+down|files?\s+for|goes?\s+public|lists?|ipo|debuts?|unveils?|introduces?|releases?|drops?|embeds?|fuels?|adds?|gains?|loses?|attracts?|receives?|accepts?|adopts?|integrates?|enables?|powers?|backs?|invests?\s+in|cuts?|beats?|wins?|hits?|crosses?|reaches?|signs?|completes?|appoints?|hires?|names?|promotes?|selects?|taps?|earns?|nets?|generates?|posts?|reports?|records?|achieves?|surpasses?|exceeds?|tops?|doubles?|triples?|slides?|falls?|dips?|tumbles?|plunges?|prepares?\s+to|plans?\s+to|aims?\s+to|seeks?\s+to|moves?\s+to)\s+.+$/i;

// P5 — Multi-clause subordinate conjunction split
const SUBORDINATE_CONJ_RE = /\s+(?:while|as|after|before|since|when|although|though|because|if|unless|until|despite|even\s+though)\s+/i;

// ─── PARSING HELPERS ──────────────────────────────────────────────────────────
function pickFirstTitlecaseChunk(str) {
  const words = str.trim().split(/\s+/);
  const result = [];
  for (const w of words) {
    if (result.length === 0 && /^[A-Z]/.test(w)) { result.push(w); continue; }
    if (result.length > 0 && (/^[A-Z]/.test(w) || /^[a-z]/.test(w))) { result.push(w); continue; }
    if (result.length > 0) break;
  }
  return result.join(' ') || null;
}

function pickLastTitlecaseChunk(str) {
  const words = str.trim().split(/\s+/);
  const result = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (result.length === 0 && /^[A-Z]/.test(w)) { result.unshift(w); continue; }
    if (result.length > 0 && /^[A-Z]/.test(w)) { result.unshift(w); continue; }
    if (result.length > 0) break;
  }
  return result.join(' ') || null;
}

// Prepositions that can appear as trailing tokens in descriptor chains —
// strip them when they appear at the end of an extracted phrase.
const TRAILING_PREPS = new Set([
  'for', 'with', 'by', 'of', 'to', 'in', 'on', 'at', 'from',
  'about', 'into', 'through', 'within', 'between', 'among',
  'and', 'or', 'but', 'nor', 'yet', 'so',
]);

function isDescriptorToken(token) {
  const lc = token.toLowerCase();
  return GEO_TERMS.has(lc) || CATEGORY_NOUNS.has(lc) || KNOWN_MEDIA_PREFIXES.has(lc) || TRAILING_PREPS.has(lc);
}

function isStopWordCandidate(str) {
  if (!str) return true;
  const lower = str.trim().toLowerCase();
  const words = lower.split(/\s+/);
  // Single-word stop word
  if (words.length === 1 && STOP_WORDS.has(lower)) return true;
  // Two-word stop phrase (e.g. "Series A")
  if (words.length === 2 && STOP_WORDS.has(lower)) return true;
  // Single-word extractions that are pure common English (≤4 chars after trim)
  // catches "Use", "Set", "Inc", "Get", etc.
  if (words.length === 1 && lower.length <= 4) return true;
  // Single generic category noun that made it into the extractor
  if (words.length === 1 && CATEGORY_NOUNS.has(lower)) return true;
  return false;
}

// ─── ENTITY TYPE CLASSIFIER ───────────────────────────────────────────────────
/**
 * Classify the entity type of a startup name string.
 *
 * Returns:
 *   { type, confidence, extractedName? }
 *
 * type values and their P1 treatment:
 *   SENTENCE_FRAGMENT  → hard fail (reject immediately, skip P2/P3)
 *   INVESTOR           → hard fail (wrong entity type for startup DB)
 *   GOVERNMENT         → hard fail (civic entity, not a startup)
 *   MEDIA_CONCAT       → recoverable — extract right-side as candidate
 *   CORPORATE_PREFIX   → recoverable — extract right-side as candidate
 *   GEO_DESC_PREFIX    → recoverable — extract right-side as candidate
 *   CATEGORY_NOUN_SOLO → soft fail — single common word, no brand signal
 *   STARTUP            → pass — plausible startup name noun phrase
 */
function classifyEntityType(name) {
  if (!name || typeof name !== 'string') return { type: 'INVALID', confidence: 1.0 };

  const trimmed  = name.trim();
  const lower    = trimmed.toLowerCase();
  const words    = trimmed.split(/\s+/);
  const firstLow = words[0].toLowerCase();
  const lastLow  = words[words.length - 1].toLowerCase();

  // ── SENTENCE FRAGMENT / DESCRIPTOR PHRASE ────────────────────────────────
  // Verb-initial: the first word is a conjugated or past-tense verb.
  if (VERB_INITIAL_RE.test(trimmed)) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.95,
      reason: `verb-initial ("${words[0]}")` };
  }
  // Stock market headline: "[Company] Shares/Stock Gain/Rise/Fall/..."
  // "shares"/"stock" is a NOUN here (equity), not a verb — but the whole
  // string is still a sentence fragment, not a startup name.
  if (STOCK_HEADLINE_RE.test(trimmed)) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.92,
      reason: `stock market headline ("[shares/stock] + market verb")` };
  }
  // Internal preposition chain signals mid-sentence fragment
  if (INTERNAL_PREP_CHAIN_RE.test(trimmed) && words.length > 3) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.85,
      reason: 'internal preposition chain' };
  }
  // Long string (> 5 words) without a TitleCase anchor is almost certainly prose
  if (words.length > 5 && !/[A-Z]/.test(trimmed.slice(1))) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.80,
      reason: 'long lowercase string' };
  }
  // "Ex-Apple team", "Ex-Google engineer" — person/team descriptor, not a startup
  // "Ex-" prefix signals a former employee, not an organization.
  if (/^ex[-–]/i.test(trimmed)) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.90,
      reason: 'Ex- prefix (former-employee descriptor)' };
  }
  // "[Word]-backed", "[Word]-based", "[Word]-funded" etc. as standalone or trailing fragment.
  // "Visa-backed African" → the whole string describes a company, not naming one.
  // "Switzerland-based" alone is a descriptor, not a brand.
  // These are hyphenated participial modifiers — never startup names.
  if (/^[A-Za-z0-9]+-(?:backed|based|funded|led|built|born|focused|native|friendly|centric|powered|driven|enabled|supported|owned|operated|certified|incubated|specific)\b/i.test(trimmed)) {
    if (words.length === 1) {
      // Standalone "Switzerland-based" — no name, pure descriptor
      return { type: 'SENTENCE_FRAGMENT', confidence: 0.90,
        reason: 'standalone hyphenated participial (no name follows)' };
    }
    // Multi-word: right side may contain the real name — check it
    const candidate = words.slice(1).join(' ');
    if (!candidate || isDescriptorToken(candidate) || isStopWordCandidate(candidate)) {
      // "Visa-backed African" → right side is a geo term → no usable name
      return { type: 'SENTENCE_FRAGMENT', confidence: 0.85,
        reason: `hyphenated participial + descriptor right side ("${candidate}")` };
    }
    // "Vienna-based Minimist" → right side looks like a brand → treat as geo prefix
    return { type: 'GEO_DESC_PREFIX', confidence: 0.85,
      reason: `hyphenated participial prefix ("${words[0]}")`,
      extractedName: candidate };
  }
  // "team" / "group" / "crew" as the last word of a short phrase = team descriptor
  if (words.length >= 2 && /^(?:team|crew|group|squad|collective)$/i.test(lastLow)) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.80,
      reason: `descriptor phrase ends in "${lastLow}"` };
  }
  // "Nvidia Ceo", "Apple Exec", "Google Engineer" — person role as last word.
  // "Ceo/Cto/Coo/Exec/Founder" at the end of a NAME means scraper grabbed
  // "CompanyName Role" as if it were a startup name.
  if (words.length >= 2 && /^(?:ceo|cto|coo|cpo|cfo|svp|vp|exec|executive|founder|co-founder|cofounder|engineer|developer|designer|scientist|researcher|analyst|advisor|chairman|president|director|officer)$/i.test(lastLow)) {
    return { type: 'SENTENCE_FRAGMENT', confidence: 0.88,
      reason: `person role suffix ("${words[words.length - 1]}")` };
  }

  // ── INVESTOR / FUND ───────────────────────────────────────────────────────
  if (INVESTOR_SUFFIX_RE.test(trimmed) || INVESTOR_STRONG_RE.test(trimmed)) {
    return { type: 'INVESTOR', confidence: 0.90,
      reason: `investor suffix ("${lastLow}")` };
  }
  // "360 Capital", "Withings-backer 360 Capital" — ends in Capital (multi-word)
  if (words.length >= 2 && INVESTOR_CAPITAL_END_RE.test(trimmed)) {
    return { type: 'INVESTOR', confidence: 0.85,
      reason: `ends in "Capital" (multi-word — likely fund)` };
  }
  // "Third Rock Partners", "Insight Partners" — ends in Partners (multi-word)
  if (words.length >= 2 && INVESTOR_PARTNERS_END_RE.test(trimmed)) {
    return { type: 'INVESTOR', confidence: 0.80,
      reason: `ends in "Partners" (multi-word — likely fund/firm)` };
  }

  // ── GOVERNMENT / INSTITUTIONAL ────────────────────────────────────────────
  if (GOVT_DEV_RE.test(trimmed)) {
    return { type: 'GOVERNMENT', confidence: 0.90,
      reason: 'government development pattern' };
  }
  if (GOVT_KEYWORD_RE.test(trimmed)) {
    return { type: 'GOVERNMENT', confidence: 0.80,
      reason: 'government keyword' };
  }

  // ── MEDIA SITE CONCATENATION ──────────────────────────────────────────────
  // "Ventureburn Overmatch", "Entrackr Kidbea" — source site + startup name
  if (words.length >= 2 && KNOWN_MEDIA_PREFIXES.has(firstLow)) {
    const candidate = words.slice(1).join(' ');
    return { type: 'MEDIA_CONCAT', confidence: 0.90,
      reason: `media prefix ("${words[0]}")`, extractedName: candidate };
  }

  // ── PRODUCT CATEGORY PREFIX ───────────────────────────────────────────────
  // "Automaker Opel", "Supercomputer Caspir", "Retailer Zalando"
  // The first word is a product/industry category noun — not a name qualifier
  // but a scraper-prepended category label. The second part is the real entity.
  const PRODUCT_CATEGORY_PREFIXES = new Set([
    'automaker', 'carmaker', 'automaker', 'manufacturer', 'retailer',
    'supercomputer', 'chipmaker', 'drugmaker', 'drugstore', 'insurer',
    'lender', 'broker', 'operator', 'provider', 'developer', 'publisher',
    'carrier', 'airline', 'railway', 'utility', 'refiner',
  ]);
  if (words.length >= 2 && PRODUCT_CATEGORY_PREFIXES.has(firstLow)) {
    const candidate = words.slice(1).join(' ');
    return { type: 'MEDIA_CONCAT', confidence: 0.85,
      reason: `product-category prefix ("${words[0]}")`, extractedName: candidate };
  }

  // ── CORPORATE RELATIONSHIP PREFIX ─────────────────────────────────────────
  // "Subsidiary Ari10", "Portfolio Notion" — legal relationship + real name
  const CORPORATE_PREFIX = new Set(['subsidiary', 'portfolio', 'division',
    'affiliate', 'spinoff', 'spin-off', 'wholly', 'acquired', 'formerly',
    'formerly-known-as', 'fka', 'dba', 'doing-business-as']);
  if (words.length >= 2 && CORPORATE_PREFIX.has(firstLow)) {
    const candidate = words.slice(1).join(' ');
    return { type: 'CORPORATE_PREFIX', confidence: 0.90,
      reason: `corporate prefix ("${words[0]}")`, extractedName: candidate };
  }

  // ── GEO / SECTOR DESCRIPTOR PREFIX ───────────────────────────────────────
  // "French fintech Pennylane", "Vienna-based Minimist"
  if (words.length >= 2 && (GEO_TERMS.has(firstLow) || CATEGORY_NOUNS.has(firstLow))) {
    // Walk the descriptor chain to find where the actual name starts
    let i = 0;
    while (i < words.length - 1 && isDescriptorToken(words[i])) i++;
    if (i > 0) {
      const candidate = words.slice(i).join(' ');
      return { type: 'GEO_DESC_PREFIX', confidence: 0.85,
        reason: `descriptor prefix chain ("${words.slice(0, i).join(' ')}")`,
        extractedName: candidate };
    }
  }

  // ── SINGLE-WORD CATEGORY NOUN ─────────────────────────────────────────────
  // A single word that maps directly to a STOP_WORDS or CATEGORY_NOUNS entry.
  // These have no brand signal — they describe a class, not a specific entity.
  if (words.length === 1 && (STOP_WORDS.has(lower) || CATEGORY_NOUNS.has(lower))) {
    return { type: 'CATEGORY_NOUN_SOLO', confidence: 0.80,
      reason: `single category word ("${trimmed}")` };
  }

  // ── DEFAULT: plausible startup name ──────────────────────────────────────
  return { type: 'STARTUP', confidence: 0.50 };
}

// ─── DISASSOCIATION (VERB-ANCHOR PARSING) ────────────────────────────────────
/**
 * Attempt to extract the startup name from a complex string using
 * disassociation policies (P1–P5).
 *
 * Policies (applied in order, recursive to depth 4):
 *   P1 Participial anchor  — "Vienna-based Minimist"     → "Minimist"
 *   P2 Presentational verb — "Introducing Tin Can"       → "Tin Can"
 *   P3 Capital event verb  — "BigHat Launches Service"   → "BigHat"
 *   P4 Descriptor prefix   — "French fintech Pennylane"  → "Pennylane"
 *   P5 Multi-clause split  — split on subordinate conj, recurse
 */
function dissociate(name, depth = 0) {
  if (!name || depth > 4) return null;
  const trimmed = name.trim();

  // P1 — participial anchor
  const p1 = trimmed.match(PARTICIPIAL_ANCHOR_RE);
  if (p1) {
    const right = dissociate(p1[3].trim(), depth + 1) || pickFirstTitlecaseChunk(p1[3]);
    if (right && !isDescriptorToken(right) && !isStopWordCandidate(right)) return right;
  }

  // P2 — presentational verb
  const p2 = trimmed.match(PRESENTATIONAL_VERB_RE);
  if (p2) {
    const right = dissociate(p2[1].trim(), depth + 1) || pickFirstTitlecaseChunk(p2[1]);
    if (right && !isDescriptorToken(right) && !isStopWordCandidate(right)) return right;
  }

  // P3 — capital event verb: actor is to the LEFT
  const p3 = trimmed.match(CAPITAL_EVENT_VERB_RE);
  if (p3) {
    const left = pickLastTitlecaseChunk(p3[1]);
    if (left && !isDescriptorToken(left) && !isStopWordCandidate(left)) return left;
  }

  // P4 — descriptor prefix chain (geo/sector/media/corporate)
  // "Irish fintech Circit" → strip "Irish fintech" → "Circit"
  // "Owkin spinout Waiv" → "Owkin" is not a descriptor so prefix strip fails;
  //   handled below in P4b (spinout/spinoff inline pattern)
  const words = trimmed.split(/\s+/);
  let prefixEnd = 0;
  while (prefixEnd < words.length - 1 && isDescriptorToken(words[prefixEnd])) prefixEnd++;
  if (prefixEnd > 0) {
    const remainder = words.slice(prefixEnd).join(' ');
    const candidate = dissociate(remainder, depth + 1) || pickFirstTitlecaseChunk(remainder);
    if (candidate && !isDescriptorToken(candidate) && !isStopWordCandidate(candidate)) return candidate;
  }

  // P4b — inline spinout/spinoff pattern: "[ParentCo] spinout [RealName]"
  // "Owkin spinout Waiv" → "Waiv", "Rivian spin-out Mind Robotics" → "Mind Robotics"
  const spinMatch = trimmed.match(/^.+?\s+(?:spinout|spinoff|spin-?off|spin-?out|spun\s+out\s+of|incubated\s+(?:at|by)|backed\s+by)\s+(.+)$/i);
  if (spinMatch) {
    const candidate = spinMatch[1].trim();
    if (candidate && !isDescriptorToken(candidate) && !isStopWordCandidate(candidate)) return candidate;
  }

  // P4e — mid-sentence "startup X" / "start-up X" tail extraction
  // "[geo/desc chain] startup [RealName]" → "[RealName]"
  // "Portland cybersecurity startup Eclypsium" → "Eclypsium"
  // "Physical AI data infrastructure startup Encord" → "Encord"
  // "Tajik start-up Shokhin Airlines" → "Shokhin Airlines"
  const startupTailMatch = trimmed.match(/^.+?\bstart(?:up|-up|-\s*up)\s+(.+)$/i);
  if (startupTailMatch) {
    const candidate = startupTailMatch[1].trim();
    if (candidate && !isDescriptorToken(candidate) && !isStopWordCandidate(candidate)) {
      const deeper = dissociate(candidate, depth + 1) || candidate;
      if (deeper && !isDescriptorToken(deeper) && !isStopWordCandidate(deeper)) return deeper;
    }
  }

  // P4c — trailing descriptor strip: "[Brand] [descriptor] [descriptor]"
  // "MatX AI Chip Startup" → "MatX"
  // "Gumloop AI Agent Platform" → "Gumloop"
  // Strategy: strip trailing descriptor tokens from the right; if first token remains
  // and looks like a brand (title-case, not a descriptor), return it.
  {
    let suffixStart = words.length;
    while (suffixStart > 1 && isDescriptorToken(words[suffixStart - 1])) suffixStart--;
    if (suffixStart < words.length && suffixStart >= 1) {
      const core = words.slice(0, suffixStart).join(' ');
      if (core !== trimmed && /^[A-Z]/.test(words[0]) && !isDescriptorToken(words[0])) {
        const candidate = dissociate(core, depth + 1) || core;
        if (candidate && !isDescriptorToken(candidate) && !isStopWordCandidate(candidate)) return candidate;
      }
    }
  }

  // P4d — brand-last: "[descriptor chain] [Brand]"
  // "Primary Care Platform MaxHealth" → "MaxHealth"
  // "Litigation Startup Wexler"       → "Wexler"
  // "School Bus Unicorn Zum"          → "Zum"
  // "Chip lithography start-up Lace"  → "Lace"
  // Strategy: if all words except the last are descriptors and the last word is
  // title-case and not itself a descriptor, return the last word as the brand.
  {
    const allButLast = words.slice(0, -1);
    const lastWord   = words[words.length - 1];
    if (
      words.length >= 2 &&
      allButLast.every(w => isDescriptorToken(w) || /^[a-z]/.test(w)) &&
      /^[A-Z]/.test(lastWord) &&
      !isDescriptorToken(lastWord) &&
      !isStopWordCandidate(lastWord) &&
      lastWord.length >= 3
    ) {
      return lastWord;
    }
    // Also handle: last two words form the brand (e.g. "Swiss BioTech FoRx Therapeutics")
    // All words except last two are descriptors, and last two form a brand phrase
    if (words.length >= 3) {
      const allButLast2 = words.slice(0, -2);
      const lastTwo     = words.slice(-2).join(' ');
      if (
        allButLast2.every(w => isDescriptorToken(w) || /^[a-z]/.test(w)) &&
        /^[A-Z]/.test(words[words.length - 2]) &&
        !isDescriptorToken(words[words.length - 2])
      ) {
        return lastTwo;
      }
    }
  }

  // P5 — multi-clause split
  const p5 = trimmed.split(SUBORDINATE_CONJ_RE);
  if (p5.length > 1) {
    for (const clause of p5) {
      const fromClause = dissociate(clause.trim(), depth + 1);
      if (fromClause && !isDescriptorToken(fromClause) && !isStopWordCandidate(fromClause)) return fromClause;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASS 1 — Semantic / Ontological Parsing
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Entity type classification + name extraction/validation.
 *
 * Returns:
 *   { valid: true,  correctedName: null,  type, reason }   — original name OK
 *   { valid: true,  correctedName: "X",   type, reason }   — extracted cleaner name
 *   { valid: false, hardFail: true,  type, reason }         — wrong entity type; reject immediately
 *   { valid: false, hardFail: false, type, reason }         — weak name; let P2/P3 decide
 */
function pass1Semantic(name) {
  if (!name) return { valid: false, hardFail: true, type: 'INVALID', reason: 'empty name' };

  const entity = classifyEntityType(name);

  // ── Hard fails — wrong entity type, skip P2/P3 ──────────────────────────
  if (entity.type === 'SENTENCE_FRAGMENT') {
    return { valid: false, hardFail: true, type: entity.type, reason: entity.reason };
  }
  if (entity.type === 'INVESTOR') {
    return { valid: false, hardFail: true, type: entity.type, reason: entity.reason };
  }
  if (entity.type === 'GOVERNMENT') {
    return { valid: false, hardFail: true, type: entity.type, reason: entity.reason };
  }

  // ── Recoverable types — attempt name extraction ──────────────────────────
  if (['MEDIA_CONCAT', 'CORPORATE_PREFIX', 'GEO_DESC_PREFIX'].includes(entity.type)) {
    const candidate = entity.extractedName || dissociate(name) || null;
    if (candidate && isValidStartupName(candidate) && !isStopWordCandidate(candidate)) {
      // Recurse to validate the extracted candidate itself
      const inner = pass1Semantic(candidate);
      if (inner.valid) {
        return { valid: true, correctedName: inner.correctedName || candidate,
          type: entity.type, reason: entity.reason };
      }
    }
    // Could not extract a valid name from the recoverable prefix
    return { valid: false, hardFail: false, type: entity.type, reason: entity.reason };
  }

  // ── Soft fail — single category noun ─────────────────────────────────────
  // Not an immediate reject — a domain or news signal can override this.
  if (entity.type === 'CATEGORY_NOUN_SOLO') {
    return { valid: false, hardFail: false, type: entity.type, reason: entity.reason };
  }

  // ── Default STARTUP path ─────────────────────────────────────────────────
  // Always run dissociate() even on valid names — it may produce a cleaner form.
  const extracted = dissociate(name);
  if (extracted && extracted !== name && isValidStartupName(extracted) && !isStopWordCandidate(extracted)) {
    return { valid: true, correctedName: extracted, type: 'STARTUP', reason: 'dissociated' };
  }
  if (isValidStartupName(name)) {
    return { valid: true, correctedName: null, type: 'STARTUP', reason: 'valid' };
  }
  return { valid: false, hardFail: false, type: 'STARTUP', reason: 'failed isValidStartupName' };
}

// ─── PASS 2: News Correlation + Narrative Role Scoring ───────────────────────
// Articles are pre-filtered by filterArticlesByName inside searchStartupNews.
// We additionally score the best narrative role across returned articles to
// distinguish "subject of a startup story" from "mentioned as a category noun".
//
// Confidence gates:
//   score ≥ 0.80  → strong frame (subject/possessive/attribution)  → P2 PASS
//   score ≥ 0.50  → weak frame (anaphoric/comparative)             → P2 PASS
//   score < 0.50  → bare mention or penalised category context      → P2 FAIL
const P2_THRESHOLD = 0.50;

async function pass2News(name) {
  try {
    const articles = await searchStartupNews(name, null, 3);
    if (articles.length === 0) return { found: false, count: 0, score: 0, frames: [] };

    // Score each article and take the best narrative role signal
    let bestScore = 0;
    let bestFrames = [];
    for (const a of articles) {
      const text = `${a.title || ''} ${a.content || ''}`;
      const { score, frames } = scoreNarrativeRole(text, name);
      if (score > bestScore) { bestScore = score; bestFrames = frames; }
    }

    const found = bestScore >= P2_THRESHOLD;
    return { found, count: articles.length, score: bestScore, frames: bestFrames };
  } catch {
    return { found: false, count: 0, score: 0, frames: [] };
  }
}

// ─── PASS 3: Inference Engine (domain resolution + variant fallback) ──────────
async function pass3Inference(name) {
  try {
    const result = await inferDomainFromName(name, 2000);
    if (!result) return { found: false };
    return {
      found: true,
      domain: result.domain,
      correctedSlug: result.correctedSlug || null,
    };
  } catch {
    return { found: false };
  }
}

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

/** Standard mode: approved + sparse/holding */
async function fetchTargetStartups() {
  const PAGE = 1000;
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, status, enrichment_status, data_completeness, website, company_website')
      .eq('status', 'approved')
      .or('enrichment_status.is.null,enrichment_status.eq.holding,enrichment_status.eq.waiting,data_completeness.lte.10')
      .order('total_god_score', { ascending: true, nullsFirst: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase fetch: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/**
 * Rescue mode: companies auto-rejected by the pipeline as "no press signal"
 * within the last RESCUE_DAYS days.  We re-run P2+P3 with the expanded
 * 30-source news registry — many real companies were mis-rejected when
 * the pipeline only had 6 sources.
 */
async function fetchRejectedForRescue() {
  const cutoff = new Date(Date.now() - RESCUE_DAYS * 86_400_000).toISOString();
  const PAGE   = 1000;
  const rows   = [];
  let from     = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, status, enrichment_status, data_completeness, website, company_website, admin_notes, updated_at')
      .eq('status', 'rejected')
      .ilike('admin_notes', '%auto-rejected: no press signal%')
      .gte('updated_at', cutoff)
      .order('total_god_score', { ascending: false, nullsFirst: false }) // rescue highest-GOD first
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase rescue fetch: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/** Restore a rescued company to approved status. */
async function applyRescue(id, name, reason) {
  const { error } = await supabase
    .from('startup_uploads')
    .update({
      status:            'approved',
      enrichment_status: 'waiting',  // queue for next enrichment pass
      admin_notes:       `[pipeline] rescued: ${reason}`,
    })
    .eq('id', id);
  if (error) throw new Error(`Rescue failed: ${error.message}`);
}

async function applyNameCorrection(id, oldName, newName, reason) {
  const { error } = await supabase
    .from('startup_uploads')
    .update({
      name: newName,
      admin_notes: `[pipeline] ${reason}: "${oldName}" → "${newName}"`,
    })
    .eq('id', id);
  if (error && error.code === '23505') {
    // Corrected name already exists — reject this one as a duplicate
    await supabase.from('startup_uploads').update({
      status: 'rejected',
      admin_notes: `[pipeline] rejected: corrected name "${newName}" already exists (duplicate)`,
    }).eq('id', id);
    return { applied: false, duplicate: true };
  }
  if (error) throw error;
  return { applied: true };
}

async function applyRejection(id, reason) {
  const { error } = await supabase
    .from('startup_uploads')
    .update({
      status: 'rejected',
      admin_notes: `[pipeline] auto-rejected: ${reason}`,
    })
    .eq('id', id);
  if (error) throw new Error(`Reject failed: ${error.message}`);
}

// ─── RESULT BUCKETS ───────────────────────────────────────────────────────────
const results = {
  p1Corrected:    [],  // name fixed by semantic parsing
  p1PassedClean:  [],  // valid as-is
  p1Failed:       [],  // unrecoverable by semantics alone
  p2Found:        [],  // has press coverage
  p2None:         [],  // no press signal
  p3Found:        [],  // domain resolved
  p3Variant:      [],  // domain via typo variant (name corrected)
  p3None:         [],  // no domain found
  autoRejected:   [],  // failed P2 + P3 → dumped
  errors:         [],
};

// ─── WORKER ───────────────────────────────────────────────────────────────────
async function processOne(startup, idx, total) {
  const { id, name, total_god_score: god_score } = startup;
  const prefix = `[${idx + 1}/${total}] "${name}" (GOD ${god_score ?? '?'})`;

  // ── PASS 1: Semantic / Ontological Classification ──────────────────────────
  const p1 = pass1Semantic(name);
  let activeName = name; // the name forwarded to P2 and P3

  if (p1.correctedName) {
    results.p1Corrected.push({ id, original: name, corrected: p1.correctedName, type: p1.type, god_score });
    console.log(`  ${prefix} │ P1 ✓ [${p1.type}] corrected → "${p1.correctedName}" (${p1.reason})`);
    if (APPLY_MODE) {
      const r = await applyNameCorrection(id, name, p1.correctedName, `${p1.type}: ${p1.reason}`);
      if (r.duplicate) {
        console.log(`  ${prefix} │ P1 ⚠  duplicate after correction — rejected`);
        return;
      }
    }
    activeName = p1.correctedName;
  } else if (p1.valid) {
    results.p1PassedClean.push({ id, name, god_score });
    console.log(`  ${prefix} │ P1 ✓ [${p1.type}] valid as-is`);
  } else if (p1.hardFail) {
    // ── HARD FAIL: wrong entity type — reject immediately, skip P2/P3 ──────
    const reason = `${p1.type}: ${p1.reason}`;
    results.autoRejected.push({ id, name, original: name, god_score, reason });
    console.log(`  ${prefix} │ P1 ✗✗ HARD FAIL [${p1.type}] — ${p1.reason} → immediate reject`);
    if (APPLY_MODE) await applyRejection(id, reason);
    return; // stop here — no P2/P3
  } else {
    // Soft fail — let P2/P3 decide
    results.p1Failed.push({ id, name, type: p1.type, god_score });
    console.log(`  ${prefix} │ P1 ✗ [${p1.type}] ${p1.reason} — forwarding to P2/P3`);
  }

  // ── PASS 2: News Correlation ────────────────────────────────────────────────
  const p2 = await pass2News(activeName);
  if (p2.found) {
    results.p2Found.push({ id, name: activeName, count: p2.count, score: p2.score, frames: p2.frames, god_score });
    const frameStr = p2.frames.length ? ` [${p2.frames.join('+')}]` : '';
    console.log(`  ${prefix} │ P2 ✓ ${p2.count} article(s) score:${p2.score.toFixed(2)}${frameStr}`);
  } else {
    const reason = p2.count > 0 ? `articles found but no narrative frame (score:${p2.score.toFixed(2)})` : 'no articles';
    results.p2None.push({ id, name: activeName, god_score, reason });
    console.log(`  ${prefix} │ P2 ✗ ${reason}`);
  }

  // ── PASS 3: Inference Engine ────────────────────────────────────────────────
  const p3 = await pass3Inference(activeName);
  if (p3.found) {
    if (p3.correctedSlug) {
      // ── Variant cross-validation ─────────────────────────────────────────
      // A domain resolved via a typo variant, but the variant itself might be
      // a different company entirely (e.g. "Adlink" → "andlink.com" ≠ Adlink).
      // Require P2 to find press coverage for the VARIANT name before accepting
      // the correction — if no press exists for the variant, treat as P3 domain
      // found only (no name change).
      const variantDisplay = p3.correctedSlug
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const variantP2 = await pass2News(variantDisplay);
      if (variantP2.found) {
        results.p3Variant.push({ id, name: activeName, domain: p3.domain, slug: p3.correctedSlug, god_score });
        const frameStr = variantP2.frames.length ? ` [${variantP2.frames.join('+')}]` : '';
        console.log(`  ${prefix} │ P3 ✓ variant "${variantDisplay}" corroborated${frameStr} (domain: ${p3.domain})`);
        if (APPLY_MODE) {
          await applyNameCorrection(id, activeName, variantDisplay, 'domain-variant correction');
        }
      } else {
        // Variant domain resolves but no press — likely a different company
        console.log(`  ${prefix} │ P3 ⚠  variant "${variantDisplay}" rejected — domain resolves but no press corroboration`);
        results.p3Found.push({ id, name: activeName, domain: p3.domain, god_score, note: 'variant domain only, no corroboration' });
      }
    } else {
      results.p3Found.push({ id, name: activeName, domain: p3.domain, god_score });
      console.log(`  ${prefix} │ P3 ✓ domain resolved: ${p3.domain}`);
    }
  } else {
    results.p3None.push({ id, name: activeName, god_score });
    console.log(`  ${prefix} │ P3 ✗ no domain found`);
  }

  // ── GATE: fail P2 + P3 → auto-reject ───────────────────────────────────────
  if (!p2.found && !p3.found) {
    const reason = p1.valid
      ? 'no press signal and no resolvable domain'
      : 'semantic parse failed + no press + no domain';
    results.autoRejected.push({ id, name: activeName, original: name, god_score, reason });
    console.log(`  ${prefix} │ DUMPED — ${reason}`);
    if (APPLY_MODE) {
      await applyRejection(id, reason);
    }
  }
}

// ─── CONCURRENCY POOL ─────────────────────────────────────────────────────────
async function runWithConcurrency(items, fn, concurrency) {
  const queue = [...items]; // [{ item, idx }, ...]
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      try { await fn(entry); }
      catch (err) { results.errors.push({ name: entry.item.name, error: err.message }); }
    }
  });
  await Promise.all(workers);
}

// ─── RESCUE WORKER ────────────────────────────────────────────────────────────
// Skips P1 (semantic parse already ran and passed — these failed only P2+P3).
// Re-runs P2 then P3 with the expanded 30-source news registry.
// If either passes, restores the company to approved status.

const rescueResults = { rescued: [], stillRejected: [], errors: [] };

async function processRescue({ item, idx }, total) {
  const { id, name, total_god_score: god_score } = item;
  const prefix = `[${String(idx + 1).padStart(4, ' ')}/${total}] "${name}" (GOD ${god_score || '?'})`;

  // Pre-pass: run P1 extraction to get the cleanest search token.
  // "Irish fintech Circit" → "Circit", "School Bus Unicorn Zum" → "Zum"
  // We use the extracted name for P3 even if it didn't meet isValidStartupName
  // in the original pipeline (was too short / no brand signal alone).
  const p1rescue = pass1Semantic(name);
  const searchName = (p1rescue.correctedName && p1rescue.correctedName !== name)
    ? p1rescue.correctedName
    : name;
  const nameWasCorrected = searchName !== name;
  if (nameWasCorrected) {
    console.log(`  ${prefix} │ P1 extracted: "${searchName}"`);
  }

  // P2 — news correlation (now using 30 sources). Skip in --p3-only mode.
  if (!P3_ONLY) {
    // Try with extracted name first, fall back to original
    const p2 = await pass2News(searchName);
    const p2orig = (!p2.found && nameWasCorrected) ? await pass2News(name) : { found: false };
    const p2win = p2.found ? p2 : p2orig;
    const p2name = p2.found ? searchName : name;
    if (p2win.found) {
      const frameStr = p2win.frames.length ? ` [${p2win.frames.join('+')}]` : '';
      console.log(`  ${prefix} │ RESCUED via P2 ✓ score:${p2win.score.toFixed(2)}${frameStr} (${p2win.count} articles) name:"${p2name}"`);
      rescueResults.rescued.push({ id, name, god_score, via: 'P2', correctedName: nameWasCorrected ? searchName : null });
      if (APPLY_MODE) {
        if (nameWasCorrected) await applyNameCorrection(id, name, searchName, 'rescue-P1-extract');
        await applyRescue(id, nameWasCorrected ? searchName : name, `P2 press signal found (${p2win.count} articles)`);
      }
      return;
    }
  }

  // P3 — domain inference: try extracted name first, then original
  const p3 = await pass3Inference(searchName);
  const p3orig = (!p3.found && nameWasCorrected) ? await pass3Inference(name) : { found: false };
  const p3win = p3.found ? p3 : p3orig;
  const p3name = p3.found ? searchName : name;
  if (p3win.found) {
    // Guard: reject if the resolved name is a generic English word or stop phrase
    // (e.g. "Use" → use.com, "Operating" → operating.com, "Series A" → seriesa.com)
    if (isStopWordCandidate(p3name) || isDescriptorToken(p3name.toLowerCase())) {
      console.log(`  ${prefix} │ P3 domain found (${p3win.domain}) but name "${p3name}" is too generic — leaving rejected`);
      rescueResults.stillRejected.push({ id, name, god_score });
      return;
    }
    console.log(`  ${prefix} │ RESCUED via P3 ✓ domain: ${p3win.domain}${nameWasCorrected ? ` (name: "${p3name}")` : ''}`);
    rescueResults.rescued.push({ id, name, god_score, via: 'P3', domain: p3win.domain, correctedName: nameWasCorrected ? p3name : null });
    if (APPLY_MODE) {
      if (nameWasCorrected && p3name === searchName) await applyNameCorrection(id, name, searchName, 'rescue-P1-extract');
      await applyRescue(id, nameWasCorrected ? searchName : name, `P3 domain resolved: ${p3win.domain}`);
    }
    return;
  }

  console.log(`  ${prefix} │ still no signal — leaving rejected`);
  rescueResults.stillRejected.push({ id, name, god_score });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  if (RESCUE_MODE) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  VALIDATE-ENRICH PIPELINE  — Rescue Mode');
    console.log(`  Passes: ${P3_ONLY ? 'P3 only (domain inference, fast)' : 'P2 (news) + P3 (domain)'}`);
    console.log(`  Window: last ${RESCUE_DAYS} days`);
    console.log(`  Mode: ${APPLY_MODE ? '⚡ APPLY' : '🔍 DRY RUN'}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    let startups = await fetchRejectedForRescue();
    console.log(`Found ${startups.length} auto-rejected startups (last ${RESCUE_DAYS} days, "no press signal").\n`);

    if (startups.length === 0) {
      console.log('Nothing to rescue.');
      return;
    }

    if (Number.isFinite(LIMIT) && LIMIT < startups.length) {
      console.log(`Limiting to first ${LIMIT} (--limit flag).\n`);
      startups = startups.slice(0, LIMIT);
    }

    const total   = startups.length;
    const indexed = startups.map((item, idx) => ({ item, idx }));
    await runWithConcurrency(indexed, (entry) => processRescue(entry, total), CONCURRENCY);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  RESCUE SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Evaluated            : ${total}`);
    console.log(`  Rescued (restored)   : ${rescueResults.rescued.length}`);
    console.log(`  Still no signal      : ${rescueResults.stillRejected.length}`);
    console.log(`  Errors               : ${rescueResults.errors.length}`);
    if (rescueResults.rescued.length) {
      console.log('\n  ── Rescued ──');
      rescueResults.rescued.forEach(r =>
        console.log(`    "${r.name}" (GOD ${r.god_score || '?'}) — via ${r.via}${r.domain ? ': ' + r.domain : ''}`)
      );
    }
    if (!APPLY_MODE) {
      console.log('\n  ⚠  DRY RUN — no changes written. Re-run with --apply to persist.');
    } else {
      console.log('\n  ✓  Rescued companies restored to approved + enrichment_status=waiting.');
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    return;
  }

  // ── STANDARD MODE ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  VALIDATE-ENRICH PIPELINE  — Three-Pass Quality Gate');
  console.log(`  Mode: ${APPLY_MODE ? '⚡ APPLY' : '🔍 DRY RUN'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let startups = await fetchTargetStartups();
  console.log(`Loaded ${startups.length} sparse/unenriched approved startups.\n`);

  if (startups.length === 0) {
    console.log('Nothing to process. All startups have enrichment data or are not approved.');
    return;
  }

  if (Number.isFinite(LIMIT) && LIMIT < startups.length) {
    console.log(`Limiting to first ${LIMIT} (--limit flag).\n`);
    startups = startups.slice(0, LIMIT);
  }

  const total = startups.length;
  const indexed = startups.map((item, idx) => ({ item, idx }));

  await runWithConcurrency(indexed, (entry) => processOne(entry.item, entry.idx, total), CONCURRENCY);

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  const hardFails = results.autoRejected.filter(r => r.reason && r.reason.includes(':'));
  const byType = {};
  hardFails.forEach(r => {
    const t = (r.reason || '').split(':')[0];
    byType[t] = (byType[t] || 0) + 1;
  });
  console.log(`  Total evaluated      : ${total}`);
  console.log(`  P1 valid (clean)     : ${results.p1PassedClean.length}`);
  console.log(`  P1 corrected         : ${results.p1Corrected.length}`);
  console.log(`  P1 hard fail         : ${hardFails.length} ${Object.keys(byType).length ? '(' + Object.entries(byType).map(([k,v]) => `${k}:${v}`).join(', ') + ')' : ''}`);
  console.log(`  P1 soft fail→P2/P3   : ${results.p1Failed.length}`);
  console.log(`  P2 press signal      : ${results.p2Found.length}`);
  console.log(`  P2 no press          : ${results.p2None.length}`);
  console.log(`  P3 domain found      : ${results.p3Found.length}`);
  console.log(`  P3 domain via variant: ${results.p3Variant.length}`);
  console.log(`  P3 no domain         : ${results.p3None.length}`);
  console.log(`  ─────────────────────────────────────────────────────────`);
  console.log(`  AUTO-REJECTED        : ${results.autoRejected.length}`);
  console.log(`  Errors               : ${results.errors.length}`);

  if (results.p1Corrected.length) {
    console.log('\n  ── P1 Name Corrections ──');
    results.p1Corrected.forEach(r => console.log(`    "${r.original}" → "${r.corrected}"`));
  }

  if (results.p3Variant.length) {
    console.log('\n  ── P3 Typo/Corruption Corrections ──');
    results.p3Variant.forEach(r => console.log(`    "${r.name}" → slug "${r.slug}" (domain: ${r.domain})`));
  }

  if (results.autoRejected.length) {
    console.log('\n  ── Auto-Rejected ──');
    results.autoRejected.forEach(r => console.log(`    "${r.name}" — ${r.reason}`));
  }

  if (results.errors.length) {
    console.log('\n  ── Errors ──');
    results.errors.forEach(e => console.log(`    "${e.name}": ${e.error}`));
  }

  if (!APPLY_MODE) {
    console.log('\n  ⚠  DRY RUN — no changes written. Re-run with --apply to persist.');
  } else {
    console.log('\n  ✓  Changes applied to database.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Pipeline error:', err); process.exit(1); });
