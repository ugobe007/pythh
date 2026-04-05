/**
 * INFERENCE SERVICE - Reusable News-Based Enrichment
 * 
 * Purpose: Extract missing startup data from news sources using pattern matching
 * Used by: instantSubmit.js (real-time), enrich-sparse-startups.js (batch)
 * 
 * NO AI CALLS - pure pattern matching for speed and cost
 */

const Parser = require('rss-parser');
const {
  extractFunding,
  extractSectors,
  extractExecutionSignals,
  extractTeamSignals
} = require('../../lib/inference-extractor');
const { isJunkUrl } = require('../../lib/junk-url-config');
const { detectSignals } = require('./signalDetector');
const { extractOntologyFromNewsText } = require('../../lib/ontologyNewsInference');
const { dedupeAndRankArticles } = require('../../lib/articleDedupe');
const { getResolved: getInferenceConfig } = require('../../lib/inferencePipelineConfig');

// Google News RSS often needs >4s; short timeouts yield 0 articles everywhere.
const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)'
  }
});

// Hard-deadline wrapper — must be >= parser.timeout or rss-parser aborts first
function parseWithDeadline(feedUrl, ms = 20000) {
  return Promise.race([
    parser.parseURL(feedUrl),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`RSS timeout after ${ms}ms`)), ms))
  ]);
}

const DEBUG_INFERENCE = process.env.DEBUG_INFERENCE === '1' || process.env.DEBUG_INFERENCE === 'true';

/**
 * Normalize garbage/fragment names for search — extract the most likely company token.
 * E.g. "Anthropic Introduced" → "Anthropic", "Startup Cloaked" → "Cloaked", "Y-backed X" → "X"
 * Returns null if we shouldn't override (use original name).
 */
function normalizeNameForSearch(name) {
  if (!name || typeof name !== 'string') return null;
  const t = name.trim();
  if (t.length < 4) return null;

  // "Startup X" / "Privacy Startup X" / "The Startup X" → X
  let m = t.match(/^(?:the\s+)?(?:privacy\s+)?startup\s+([A-Za-z0-9]+)/i);
  if (m) return m[1].length >= 4 ? m[1] : null;

  // "X Introduced" / "X Has" / "X Gets" / "X To" / "X Revenue" → X (company did the action)
  m = t.match(/^([A-Za-z0-9]+)\s+(?:introduced|has|gets?|to|revenue|secures?|raises?|earns?|moves?)/i);
  if (m) return m[1].length >= 4 ? m[1] : null;

  // "Y-backed X" / "Sequoia-backed X" → X (company being backed)
  m = t.match(/\b(?:backed|backing)\s+([A-Za-z0-9-]+)$/i);
  if (m) return m[1].length >= 3 ? m[1] : null;

  // "X, a [sector] startup" → X (often in headlines)
  m = t.match(/^([A-Za-z0-9]+),\s*a\s+/i);
  if (m) return m[1].length >= 4 ? m[1] : null;

  // "Visa Processing Start-Up X" / "Start-Up X" → X
  m = t.match(/(?:start[- ]?up|start[- ]?up)\s+([A-Za-z0-9]+)$/i);
  if (m) return m[1].length >= 4 ? m[1] : null;

  // "Mexican edtech Mattilda" / "Spanish edtech BCAS" / "Bladder cancer innovator Combat" → last proper noun
  m = t.match(/^(?:mexican|spanish|us-backed|yc\s+alum|bladder\s+cancer\s+innovator)\s+(?:edtech|fintech|healthtech)?\s*([A-Za-z0-9]+)$/i);
  if (m) return m[1].length >= 3 ? m[1] : null;

  return null;
}

/**
 * Normalize a startup name for matching:
 * - Strip legal suffixes (Inc., LLC, Corp., Ltd., etc.)
 * - Lowercase, trim
 * Returns { full, short } where `short` is first 1-2 significant tokens
 */
function normalizeNameForMatch(name) {
  const legalSuffixes = /\b(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|limited|incorporated|technologies|technology|solutions|labs?|group|ventures?|capital|systems?|networks?|platform|platforms?|software|services?)\b\.?$/gi;
  let full = name.trim().replace(legalSuffixes, '').trim().toLowerCase();
  // Match press copy that omits possessive ("Smith's" in DB vs "Smith raises" in article)
  full = full.replace(/\u2019s$/i, '').replace(/'s$/i, '');
  // "short" = first two words (handles "Acme Technologies" → "Acme")
  const tokens = full.split(/\s+/).filter(Boolean);
  const short = tokens.slice(0, 2).join(' ');
  return { full, short };
}

/** Normalize curly apostrophes and strip trailing possessive for token matching */
function stripTrailingPossessiveToken(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\u2019|\u2018/g, "'").replace(/'s$/i, '').trim();
}

/**
 * Surface forms of the same entity (DB may store "Acme's" or Unicode apostrophe; articles use "Acme").
 * Used by narrative scoring and related filters.
 */
function inferenceNameMatchVariants(name) {
  if (!name || typeof name !== 'string') return [''];
  const t = name.trim();
  if (!t) return [''];
  const set = new Set();
  const ascii = t.replace(/\u2019|\u2018/g, "'");
  set.add(t);
  if (ascii !== t) set.add(ascii);
  const bare = stripTrailingPossessiveToken(ascii);
  if (bare.length >= 2 && bare !== ascii) set.add(bare);
  return [...set];
}

/**
 * Best token for Google News / RSS queries after headline-fragment rules.
 */
function primarySearchToken(startupName) {
  if (!startupName || typeof startupName !== 'string') return '';
  const fromRules = normalizeNameForSearch(startupName);
  if (fromRules) return fromRules;
  const bare = stripTrailingPossessiveToken(startupName);
  if (bare.length >= 4) return bare;
  return startupName.trim();
}

/**
 * Filter articles to only those that actually mention the startup by name.
 * Keeps an article if its title or content contains the full normalized name
 * OR (if the full name is 2+ words) the first-word short name.
 * Returns the filtered array. If ALL articles get filtered out, returns the
 * original array unchanged (fallback — better some data than none).
 */
/**
 * NARRATIVE DISAGGREGATION INFERENCE
 *
 * Language model: words tell a story, and stories position entities in roles.
 * A startup name appearing as a *subject*, *possessive object*, or *comparative
 * reference* in a narrative is strong evidence the article is actually about
 * that startup. A bare mention surrounded by category-noun context is weak.
 *
 * Story frames (in confidence order):
 *   SUBJECT     — "NAME raised $10M", "NAME launched today"     → 0.90
 *   POSSESSIVE  — "at NAME", "from NAME", "NAME's CEO"          → 0.85
 *   ATTRIBUTION — "CEO of NAME", "NAME team", "NAME platform"   → 0.80
 *   ANAPHORIC   — NAME appears then "they/it/the company" follow → 0.55
 *   COMPARATIVE — "like NAME", "next NAME", "similar to NAME"   → 0.65
 *   BARE        — name in text, no contextual frame              → 0.15
 *   PENALISED   — name surrounded by category/sector nouns, no frame → 0.05
 *
 * @param {string} text       — raw article text (title + content)
 * @param {string} startupName — company name to score
 * @returns {{ score: number, frames: string[] }}
 */
function scoreNarrativeRoleForVariant(text, startupName) {
  if (!text || !startupName) return { score: 0, frames: [] };

  const escaped = startupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe  = new RegExp(`\\b${escaped}\\b`, 'i');

  if (!nameRe.test(text)) return { score: 0, frames: [] };

  const frames = [];
  let score = 0.15; // base: name is present

  // ── SUBJECT frame ─────────────────────────────────────────────────────────
  // "NAME <verb>" — name is the grammatical subject of an action (headlines use 3rd person: raises, lands, nets, …)
  const SUBJECT_VERBS = /\b(?:raises?|raised|raising|closes?|closed|closing|secures?|secured|securing|announces?|announced|announcing|launches?|launched|launching|releases?|released|releasing|unveils?|unveiled|unveiling|debuts?|debuted|debuting|is|was|will|has|have|had|expands?|expanded|expanding|pivots?|pivoted|pivoting|acquires?|acquired|acquiring|partners?|partnered|partnering|joins?|joined|joining|exits?|exited|exiting|files?|filed|filing|goes|went|going|lists?|listed|listing|shuts?|shut|shutting|merges?|merged|merging|completes?|completed|completing|signed|signs|signing|drops?|dropped|dropping|hires?|hired|hiring|named|names|naming|appoints?|appointed|appointing|opens?|opened|opening|enters?|entered|entering|hits?|hit|hitting|crosses?|crossed|crossing|reaches?|reached|reaching|lands?|landed|landing|nets?|netted|netting|bags?|bagged|bagging|scores?|scored|scoring|snags?|snagged|snagging|pulls?|pulled|pulling|attracts?|attracted|attracting|receives?|received|receiving|garners?|garnered|garnering|rolls?|rolled|rolling|inks?|inked|inking|snaps?|snapped|snapping|scoops?|scooped|scooping)\b/i;
  if (new RegExp(`\\b${escaped}\\b\\s+` + SUBJECT_VERBS.source, 'i').test(text)) {
    frames.push('subject');
    score = Math.max(score, 0.90);
  }

  // ── POSSESSIVE frame ──────────────────────────────────────────────────────
  // "at NAME", "from NAME", "invested in NAME", "NAME's ..." / Unicode apostrophe
  const POSSESSIVE_PRE = /\b(?:at|from|for|joining?|left|quit|building|built|working at|partnered with|invested in|backed by|funded by|acquired by|spun out of|coming from|coming to|heading to|headed to)\s+/i;
  if (new RegExp(POSSESSIVE_PRE.source + escaped, 'i').test(text) ||
      new RegExp(`\\b${escaped}['\u2019]s\\b`, 'i').test(text)) {
    frames.push('possessive');
    score = Math.max(score, 0.85);
  }

  // ── ATTRIBUTION frame ─────────────────────────────────────────────────────
  // "NAME CEO/team/product" or "CEO/founder of NAME"
  const ROLE_NOUNS = /\b(?:CEO|CTO|COO|CPO|CFO|VP|founder|co-founder|team|platform|product|app|service|technology|system|API|engineer|investors?)\b/i;
  if (new RegExp(`\\b${escaped}\\b\\s+` + ROLE_NOUNS.source, 'i').test(text) ||
      new RegExp(ROLE_NOUNS.source + `\\s+(?:of|at)\\s+\\b${escaped}\\b`, 'i').test(text)) {
    frames.push('attribution');
    score = Math.max(score, 0.80);
  }

  // ── COMPARATIVE frame ─────────────────────────────────────────────────────
  // "like NAME", "the next NAME", "similar to NAME", "think of NAME"
  if (new RegExp(`\\b(?:like|next|unlike|similar to|think of|reminds? (?:me )?of|version of|competitor(?:s)? (?:of|to)|alternative to)\\s+\\b${escaped}\\b`, 'i').test(text)) {
    frames.push('comparative');
    score = Math.max(score, 0.65);
  }

  // ── ANAPHORIC anchor ──────────────────────────────────────────────────────
  // NAME appears in text, then "they/it/the company/the startup" follows within
  // 200 chars — weak but real discourse signal
  const nameIdx = text.search(nameRe);
  if (nameIdx > -1) {
    const afterName = text.slice(nameIdx + startupName.length, nameIdx + startupName.length + 250);
    if (/\b(?:they|it|the company|the startup|the team|the platform|their|its)\b/i.test(afterName)) {
      frames.push('anaphoric');
      score = Math.max(score, 0.55);
    }
  }

  // ── PENALTY: category-noun neighbourhood, no strong frame ─────────────────
  // "Bankers and investors" — 'Bankers' is a category noun, not an actor
  // Only penalise when no strong frame was detected (score still at base 0.15)
  if (frames.length === 0) {
    const SECTOR_SOUP = /\b(?:investors?|banks?|financiers?|firms?|funds?|companies|corporations?|industry|sector|market|players?|competitors?|brands?|analysts?|experts?)\b/i;
    const neighbourhood = text.slice(
      Math.max(0, nameIdx - 120),
      nameIdx + startupName.length + 120
    );
    if (SECTOR_SOUP.test(neighbourhood)) {
      score = 0.05; // heavy penalty — almost certainly a category reference
    }
  }

  if (DEBUG_INFERENCE && frames.length > 0) {
    console.log(`[narrative] "${startupName}" → frames: [${frames.join(', ')}] score: ${score.toFixed(2)}`);
  }

  return { score: Math.min(score, 1), frames };
}

/**
 * Score narrative match using all surface forms (possessive vs bare name, apostrophe variants).
 */
function scoreNarrativeRole(text, startupName) {
  const variants = inferenceNameMatchVariants(startupName);
  let best = { score: 0, frames: [] };
  for (const v of variants) {
    if (!v || v.length < 2) continue;
    const r = scoreNarrativeRoleForVariant(text, v);
    if (r.score > best.score) best = r;
  }
  return best;
}

/**
 * Filter articles by startup name presence, upgraded with narrative role scoring.
 *
 * Confidence thresholds:
 *   strict mode  (extended sources: Reddit, HN, Substack, PRNewswire)
 *     → require score ≥ 0.50 — must have at least one narrative frame
 *   standard mode (primary Google News)
 *     → require score ≥ 0.10 — bare mention is enough (existing behaviour)
 *     → fallback to all articles if nothing passes (existing behaviour)
 *
 * This eliminates the "Bankers = banking industry" class of false positives
 * while preserving backward-compatible behaviour for the primary source.
 *
 * @param {Array} articles
 * @param {string} startupName
 * @param {object} [opts]
 * @param {boolean} [opts.strict=false]
 */
function filterArticlesByName(articles, startupName, { strict = false } = {}) {
  if (!articles || articles.length === 0) return articles;
  const { full, short } = normalizeNameForMatch(startupName);
  if (full.length < 3) return articles;

  const STRICT_THRESHOLD   = 0.50; // must have a narrative frame
  const STANDARD_THRESHOLD = 0.10; // bare mention is fine

  const scored = articles.map(a => {
    const text = `${a.title || ''} ${a.content || ''}`;
    const { score, frames } = scoreNarrativeRole(text, startupName);

    // Also accept short-name match (existing behaviour, gated by length)
    let effectiveScore = score;
    if (score < STANDARD_THRESHOLD) {
      const lower = text.toLowerCase();
      if (lower.includes(full) || (short.length >= 4 && lower.includes(short))) {
        effectiveScore = STANDARD_THRESHOLD;
      }
    }
    return { article: a, score: effectiveScore, frames };
  });

  const threshold = strict ? STRICT_THRESHOLD : STANDARD_THRESHOLD;
  const matches   = scored.filter(s => s.score >= threshold).map(s => s.article);

  if (strict) return matches;

  // non-strict: fall back to all articles if filter removed everything
  return matches.length > 0 ? matches : articles;
}

// Fast news sources (prioritize speed over depth)
const FAST_SOURCES = {
  googleNews: (query) => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
};

/** Google News RSS often returns 503 when rate-limited; not an application/inference bug. */
function isGoogleNews503Message(msg) {
  return /\b503\b|status code 503/i.test(String(msg || ''));
}

// Cooldown after repeated 503s so batch jobs don't spend ~70s per startup retrying GN.
let gn503FailStreak = 0;
let gnPausedUntil = 0;

function gnRecordGoogleNewsSuccess() {
  gn503FailStreak = 0;
}

function gnRecordGoogleNews503Failure() {
  gn503FailStreak++;
  if (gn503FailStreak >= 3) {
    gnPausedUntil = Date.now() + 120000;
    gn503FailStreak = 0;
    console.log(
      '[inference] Google News RSS returned HTTP 503 repeatedly — pausing news fetches for 2m (rate limit / upstream). ' +
        'Inference logic is fine; use `npm run enrich:sparse:html` or retry later.',
    );
  }
}

function isGoogleNewsPaused() {
  return Date.now() < gnPausedUntil;
}

// Load the full news source registry (Tier 1 + Tier 2 = standard enrichment)
const { getStandardSources } = require('./dataSources/newsSources');
const EXTENDED_SOURCES_LIST = getStandardSources();

/**
 * Search for startup news articles
 * @param {string} startupName - Company name
 * @param {string} startupWebsite - Company website (optional)
 * @param {number} maxArticles - Max articles to fetch (default: 5)
 * @param {string} [extraSearchTerms] - Optional extra terms (e.g. VC name) for "StartupName VCName funding" search
 * @param {{ lite?: boolean }} [options] - lite=true: Google News (+GN fallbacks) only; skip extended RSS (required for quickEnrich timeouts)
 * @returns {Promise<Array>} Array of {title, content, link, pubDate, source}
 */
async function searchStartupNews(startupName, startupWebsite = null, maxArticles = null, extraSearchTerms = null, options = {}) {
  const cfg = getInferenceConfig();
  const lite = options.lite === true;
  if (maxArticles == null) maxArticles = cfg.SEARCH_MAX_ARTICLES;
  const articles = [];
  if (isGoogleNewsPaused()) {
    return dedupeAndRankArticles([]);
  }
  const searchToken = primarySearchToken(startupName);
  const useNormalized = searchToken !== startupName.trim();

  // Detect "ambiguous" names: single word, ≤7 chars (Branch, Arc, Bolt, Vibe, etc.)
  const nameWords = searchToken.split(/\s+/);
  const isAmbiguousName = nameWords.length === 1 && searchToken.length <= 7;

  let domain = null;
  if (startupWebsite) {
    try { domain = new URL(startupWebsite).hostname.replace('www.', ''); } catch (e) {}
  }

  // When VC name provided, lead with "StartupName VCName funding"
  const vcQuery = extraSearchTerms && extraSearchTerms.trim()
    ? [`"${searchToken}" ${extraSearchTerms.trim()} funding`, `"${searchToken}" ${extraSearchTerms.trim()} seed series`]
    : [];

  // Build contextual queries
  const queries = vcQuery.length > 0
    ? [...vcQuery, `"${searchToken}" startup funding`, `"${searchToken}" raises series`]
    : isAmbiguousName && domain
      ? [
          `"${domain}" funding`,
          `"${domain}" startup`,
          `"${searchToken}" raises series funding`,
          `"${searchToken}" customers revenue`,
        ]
      : [
          `"${searchToken}" startup funding`,
          `"${searchToken}" raises series`,
          `"${searchToken}" customers revenue growth`,
          `"${searchToken}" launches product`,
          ...(domain ? [`"${domain}" startup`] : []),
        ];

  if (useNormalized && DEBUG_INFERENCE) {
    console.log(`[inference] Normalized "${startupName}" → "${searchToken}" for search`);
  }

  const query = queries[0];
  const feedUrl = FAST_SOURCES.googleNews(query);

  // 503 from Google: at most one retry with short backoff (avoid ~60s+ per startup during GN outages).
  const fetchFeed = async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await parseWithDeadline(feedUrl);
      } catch (e) {
        const msg = String(e.message || e || '');
        const is503 = isGoogleNews503Message(msg);
        const retryable = /timeout|timed out|ETIMEDOUT|ECONNRESET|503|502|429|Status code 5/i.test(msg);
        const maxAttemptIndex = is503 ? 1 : 4;
        if (!retryable || attempt >= maxAttemptIndex) throw e;
        const backoff = is503 ? 1500 : /503|502|429|Status code 5/i.test(msg) ? 6000 + attempt * 2000 : 1200;
        if (DEBUG_INFERENCE) console.log(`[inference] Retry in ${backoff / 1000}s after ${msg}`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  };

  try {
    const feed = await fetchFeed();
    gnRecordGoogleNewsSuccess();
    const rawItems = feed.items.slice(0, maxArticles);
    const rawCount = rawItems.length;

    const rawArticles = rawItems.map(item => ({
      title: item.title || '',
      content: item.contentSnippet || item.content || '',
      link: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      source: 'Google News'
    }));

    // Name-correlation filter: accept articles matching startupName OR searchToken
    let filtered = filterArticlesByName(rawArticles, startupName);
    if (filtered.length === 0 && useNormalized) {
      filtered = filterArticlesByName(rawArticles, searchToken);
    }
    articles.push(...filtered);

    if (DEBUG_INFERENCE) {
      console.log(`[inference] Search "${query}" → raw: ${rawCount}, after filter: ${filtered.length}`);
    }

    // Fallback: try broader Google News queries if primary returned few results
    if (articles.length < 3) {
      for (let i = 1; i < queries.length && articles.length < 3; i++) {
        try {
          const fallbackFeed = await parseWithDeadline(FAST_SOURCES.googleNews(queries[i]));
          const fallbackRaw = fallbackFeed.items.slice(0, 4).map(item => ({
            title: item.title || '',
            content: item.contentSnippet || item.content || '',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            source: `Google News (${i === 1 ? 'series' : i === 2 ? 'product' : 'domain'})`
          }));
          let fallbackFiltered = filterArticlesByName(fallbackRaw, startupName);
          if (fallbackFiltered.length === 0 && useNormalized) {
            fallbackFiltered = filterArticlesByName(fallbackRaw, searchToken);
          }
          articles.push(...fallbackFiltered);
        } catch (e) {
          // Skip failed fallback
        }
      }
    }

    if (lite && DEBUG_INFERENCE) {
      console.log(`[inference] lite search: skipping extended RSS for "${startupName}"`);
    }

    // Extended sources: run in parallel alongside whatever Google News returned.
    // Skipped in lite mode so quickEnrich finishes before per-request timeouts (full fan-out can exceed 60s).
    // Sources are drawn from the news source registry (Tier 1 + Tier 2 = ~30 sources).
    // — Each source has an independent timeout so slow feeds don't block others.
    // — Strict name filter applied: no unrelated articles for supplementary sources.
    // — Results deduplicated by URL across all sources.
    if (lite) {
      return dedupeAndRankArticles(articles);
    }

    const maxExtended = Math.min(
      EXTENDED_SOURCES_LIST.length,
      Math.max(4, cfg.ENRICH_MAX_EXTENDED_SOURCES),
    );
    const extendedJobs = EXTENDED_SOURCES_LIST.slice(0, maxExtended).map(source => ({
      key:     source.key,
      label:   source.label,
      url:     source.url(searchToken),
      timeout: source.timeout,
      strict:  source.strict !== false,
    }));

    const seenUrls = new Set(articles.map(a => a.link));

    // Google News RSS rate-limits hard if we fan out dozens of parallel feeds — batch + pause.
    const EXT_CHUNK = Math.max(2, cfg.ENRICH_EXTENDED_CHUNK);
    const EXT_PAUSE_MS = Math.max(0, cfg.ENRICH_EXTENDED_PAUSE_MS);
    const extendedResults = [];
    for (let j = 0; j < extendedJobs.length; j += EXT_CHUNK) {
      const slice = extendedJobs.slice(j, j + EXT_CHUNK);
      const chunkSettled = await Promise.allSettled(
        slice.map(async ({ url, label, timeout }) => {
          const feed = await parseWithDeadline(url, timeout);
          return feed.items.slice(0, 5).map(item => ({
            title: item.title || '',
            content: item.contentSnippet || item.content || item.summary || '',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            source: label,
          }));
        }),
      );
      extendedResults.push(...chunkSettled);
      if (j + EXT_CHUNK < extendedJobs.length && EXT_PAUSE_MS > 0) {
        await new Promise(r => setTimeout(r, EXT_PAUSE_MS));
      }
    }

    for (let i = 0; i < extendedResults.length; i++) {
      const result = extendedResults[i];
      if (result.status !== 'fulfilled') {
        if (DEBUG_INFERENCE) {
          console.log(`[inference] ${extendedJobs[i].label} failed: ${result.reason?.message || result.reason}`);
        }
        continue;
      }
      const raw = result.value;
      // strict=true: never fall back to unrelated articles for supplementary sources
      let filtered = filterArticlesByName(raw, startupName, { strict: true });
      if (filtered.length === 0 && useNormalized) {
        filtered = filterArticlesByName(raw, searchToken, { strict: true });
      }
      // Deduplicate by URL across all sources
      const deduplicated = filtered.filter(a => !seenUrls.has(a.link));
      deduplicated.forEach(a => seenUrls.add(a.link));
      articles.push(...deduplicated);

      if (DEBUG_INFERENCE && deduplicated.length > 0) {
        console.log(`[inference] ${extendedJobs[i].label}: +${deduplicated.length} articles`);
      }
    }

  } catch (error) {
    const msg = String(error.message || error || '');
    if (isGoogleNews503Message(msg)) gnRecordGoogleNews503Failure();
    console.log(
      `[inference] Search failed for "${query}": ${msg}` +
        (isGoogleNews503Message(msg)
          ? ' (Google News RSS HTTP 503 — upstream/rate limit; not an inference-engine defect.)'
          : ''),
    );
  }

  return dedupeAndRankArticles(articles);
}

// ─── HTML entity decode map for common encodings in RSS content ─────────────
const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&#x27;': "'" };
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str.replace(/&[#a-z0-9]+;/gi, e => HTML_ENTITIES[e] || e);
}

/**
 * WORD-PROXIMITY ASSOCIATION
 * Scan text for domain-like tokens that appear within ±N words of the startup name.
 * Handles bare domains ("brief.ai"), hyphenated slugs, and encoded content.
 *
 * @param {string} text - Raw article text (HTML entities NOT yet stripped)
 * @param {string} startupName - Company name to anchor proximity scan
 * @returns {string|null} Best matching domain or null
 */
function extractUrlByWordProximity(text, startupName) {
  if (!text || !startupName) return null;
  const decoded = decodeHtmlEntities(text);

  // Build a slug of the startup name for proximity scoring
  const slug = startupName.toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|limited|technologies|tech|labs?|group|ventures?|ai|app|platform|software|systems?)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');

  // Domain regex: catches bare TLD domains that sanitizeTextForAnalysis would strip
  const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{1,40})\.(com|io|ai|app|co|xyz|dev|tech|vc|health|finance|me|so|run|sh|org|net|us|eu|uk)\b/gi;

  const tokens = decoded.split(/\s+/);
  const candidates = [];

  // Find the startup name position(s) in the token stream
  const nameLower = startupName.toLowerCase();
  const nameTokens = nameLower.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const windowStr = tokens.slice(Math.max(0, i - 15), Math.min(tokens.length, i + 15)).join(' ');

    // Check if this window contains the startup name
    if (!windowStr.toLowerCase().includes(nameTokens[0])) continue;

    let m;
    DOMAIN_RE.lastIndex = 0;
    while ((m = DOMAIN_RE.exec(windowStr)) !== null) {
      const domain = m[0].toLowerCase();
      if (isJunkUrl(`https://${domain}`)) continue;
      // Score: +3 if slug matches domain stem, +1 otherwise
      const domainStem = m[1].replace(/-/g, '');
      const score = slug.length >= 3 && (domainStem.includes(slug.slice(0, 8)) || slug.slice(0, 8).includes(domainStem)) ? 3 : 1;
      candidates.push({ domain, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].domain;
}

/**
 * NAME→DOMAIN SLUG INFERENCE with HTTP HEAD verification.
 * Derives candidate domains from the startup name and verifies which resolves.
 * Respects a tight timeout to stay fast in batch enrichment.
 *
 * @param {string} startupName - Company name
 * @param {number} timeoutMs - Per-candidate HEAD request timeout
 * @returns {Promise<{domain: string, correctedSlug: string|null}|null>}
 *   domain = verified domain string
 *   correctedSlug = non-null when a typo variant was used (caller should update the startup name)
 */

/**
 * Generate plausible typo/corruption variants of a startup name slug.
 *
 * Linguistic model: verbs (and consonant clusters) are anchors.
 * Scrapers most commonly drop:
 *   1. Nasals (m, n) before bilabial/velar stops — "aplibotics" → "amplibotics"
 *   2. Liquids (l, r) after consonants — "antics" → "analytics" type drops
 *   3. Adjacent consonant transpositions — "recieve" → "receive"
 *   4. Accidental character doubling — "planninng" → "planning"
 *   5. Missing initial letter when the word starts with a rare cluster
 *
 * Deliberately small output (≤20 variants) — we only want high-confidence
 * corrections, not a brute-force search. False positives (wrong domain resolving)
 * are worse than missing the correction.
 */
function generateNameVariants(slug) {
  if (!slug || slug.length < 4) return [];
  const variants = new Set();

  // ── Strategy 1 (HIGH CONFIDENCE ONLY): Insert 'm' before bilabial stops p/b
  // when preceded by a vowel — the strongest and most specific corruption pattern.
  //
  // Target pattern: vowel + (p|b) + consonant  →  vowel + m + (p|b) + consonant
  // "aplibotics" → 'a' + 'p' + 'l' → insert 'm' → "amplibotics"  ✓
  //
  // Intentionally excluded:
  //   • 'n' before alveolar/velar stops (d, t, g, k) — too broad, many false positives
  //     e.g. "adlink" → "andlink" (different company)
  //   • Liquid insertion (l/r) — generates too many speculative paths
  //   • Transpositions — generate too many unrelated words
  //   • Initial vowel prepend — catches real one-letter drops but also many non-starts
  //
  // This single strategy catches the canonical scraper-corruption pattern:
  // a nasal consonant dropped immediately before a bilabial stop by an OCR/scraper.
  const BILABIAL_STOPS = new Set(['p', 'b']);
  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
  for (let i = 1; i < slug.length; i++) {
    if (BILABIAL_STOPS.has(slug[i]) && VOWELS.has(slug[i - 1])) {
      variants.add(slug.slice(0, i) + 'm' + slug.slice(i));
    }
  }

  // ── Strategy 2: Drop accidental doubled letters ───────────────────────────
  // "planninng" → "planning", "companny" → "company"
  // Low false-positive rate: the original slug must have an identical adjacent pair.
  for (let i = 0; i < slug.length - 1; i++) {
    if (slug[i] === slug[i + 1]) {
      variants.add(slug.slice(0, i + 1) + slug.slice(i + 2));
    }
  }

  variants.delete(slug);
  return [...variants].slice(0, 10); // tight cap — fewer, higher-confidence candidates
}

async function inferDomainFromName(startupName, timeoutMs = 2000) {
  if (!startupName) return null;

  /** Whole-function ceiling — sequential HEAD probes used to multiply timeoutMs into 30s+ otherwise */
  const wallMs = Math.min(
    30000,
    Math.max(
      8000,
      parseInt(process.env.INFER_DOMAIN_MAX_WALL_MS || '', 10) || 22000,
    ),
  );
  const wallStart = Date.now();
  const timeLeft = () => Math.max(0, wallMs - (Date.now() - wallStart));

  // Normalize: strip legal/generic suffixes from the END of the name only.
  // Anchored to end-of-string ($) to prevent stripping embedded words:
  // "Ventures Today" must NOT become "Today" (ventures? was removing mid-word).
  // "Acme Technologies" → "Acme", "Stripe Inc" → "Stripe" (correct).
  const cleaned = startupName
    .replace(/\s*\b(inc\.?|llc\.?|corp\.?|ltd\.?|technologies?|technology|solutions?|labs?|group|ventures?|capital|systems?|networks?|platform|platforms?|software|services?|ai|app)\b\.?\s*$/gi, '')
    .trim();

  const slug = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hyphenSlug = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (slug.length < 3) return null;

  /**
   * Probe a domain slug against the standard TLD list.
   * Returns the first domain that resolves (status < 500), or null.
   */
  async function probeSlugs(s, h = null) {
    const tlds = ['.com', '.ai', '.io', '.app', '.co', '.dev', '.xyz'];
    const prefixes = ['', 'try', 'get', 'use'];
    const candidates = [];
    for (const pre of prefixes) {
      for (const tld of tlds) {
        const d = `${pre}${s}${tld}`;
        if (!candidates.includes(d)) candidates.push(d);
      }
    }
    if (h && h !== s) {
      for (const tld of ['.com', '.ai', '.io']) {
        const d = `${h}${tld}`;
        if (!candidates.includes(d)) candidates.push(d);
      }
    }
    for (const domain of candidates) {
      if (timeLeft() < 250) return null;
      const perTry = Math.max(300, Math.min(timeoutMs, timeLeft()));
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), perTry);
        const res = await fetch(`https://${domain}`, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)' }
        });
        clearTimeout(timer);
        if (res.status < 500) return domain;
      } catch { /* try next */ }
    }
    return null;
  }

  // ── Pass A: try original name slug ────────────────────────────────────────
  const primary = await probeSlugs(slug, hyphenSlug);
  if (primary) return { domain: primary, correctedSlug: null };

  // ── Pass B: try typo/corruption variants ─────────────────────────────────
  // Guard: only run for single-word names. Multi-word names whose words
  // concatenate into a new slug (e.g. "Micron To" → "micronto") are a
  // scraper-concatenation class problem, not a letter-drop. Variants on those
  // slugs produce semantically unrelated words ("micronot") that happen to
  // resolve as domains.
  const wordCount = startupName.trim().split(/\s+/).length;
  if (wordCount > 1) return null;

  const variants = generateNameVariants(slug);
  for (const variant of variants) {
    const variantHyphen = variant.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const found = await probeSlugs(variant, variantHyphen);
    if (found) {
      if (DEBUG_INFERENCE) {
        console.log(`[inference] Name variant matched: "${slug}" → "${variant}" (domain: ${found})`);
      }
      return { domain: found, correctedSlug: variant };
    }
  }

  return null;
}

/**
 * Extract the startup's own website URL from article text/content.
 * Strategy (in order):
 *   1. Full http(s):// URLs in text  (regex scan on raw content)
 *   2. www. prefixed domains
 *   3. Word-proximity association    (domain tokens near startup name)
 *   4. Bare startup-TLD domains      (.ai, .io, .app, etc.)
 * Filters all candidates through isJunkUrl().
 *
 * @param {Array} articles - [{title, content, link, pubDate, source}]
 * @param {string} startupName - Company name for heuristic matching
 * @returns {string|null} Clean domain (no protocol/path) or null
 */
function extractCompanyUrlFromArticles(articles, startupName = '') {
  // Match: https?:// URLs or bare www. domains or domains with tech-startup TLDs
  const URL_RE = /(?:https?:\/\/(?:www\.)?|(?:^|[\s(])www\.)([a-z0-9][a-z0-9-]{0,61}[a-z0-9]?\.)+[a-z]{2,}(?:\/[^\s<>"')\]]*)?/gi;
  // Also catch bare startup-style domains: "name.io", "name.ai", "name.app" etc.
  const BARE_DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{2,30})\.(io|ai|app|co|xyz|dev|tech|vc|fund|health|finance|me|so|run|sh)\b/gi;

  const nameLower = startupName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = [];

  for (const article of articles) {
    const rawText = decodeHtmlEntities(`${article.title || ''} ${article.content || ''}`);

    // Pass 1: full URLs (https:// or www.)
    const urlMatches = rawText.match(URL_RE) || [];
    for (const rawUrl of urlMatches) {
      const normalized = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;
      if (isJunkUrl(normalized)) continue;
      try {
        const domain = new URL(normalized).hostname.replace(/^www\./, '').toLowerCase();
        if (!domain || domain.length < 3) continue;
        const score = nameLower.length >= 3 && domain.replace(/\.[^.]+$/, '').includes(nameLower.slice(0, Math.min(nameLower.length, 10))) ? 2 : 1;
        candidates.push({ domain, score });
      } catch { /* malformed */ }
    }

    // Pass 2: bare startup-TLD domains like "serval.ai", "acme.io"
    BARE_DOMAIN_RE.lastIndex = 0;
    let m;
    while ((m = BARE_DOMAIN_RE.exec(rawText)) !== null) {
      const domain = `${m[1]}.${m[2]}`.toLowerCase();
      if (isJunkUrl(`https://${domain}`)) continue;
      const score = nameLower.length >= 3 && domain.startsWith(nameLower.slice(0, Math.min(nameLower.length, 8))) ? 3 : 1;
      candidates.push({ domain, score });
    }

    // Pass 3: word-proximity — domain tokens within ±15 words of startup name
    const proximityUrl = extractUrlByWordProximity(rawText, startupName);
    if (proximityUrl) candidates.push({ domain: proximityUrl, score: 2 });
  }

  if (candidates.length === 0) return null;
  // Return best-scoring candidate (name-match prioritised)
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].domain;
}

/**
 * Extract data from news articles using pattern matching
 * @param {Array} articles - Array of {title, content, link, pubDate, source}
 * @param {Object} currentData - Current startup data (extracted_data object)
 * @param {string} startupName - Used for company URL heuristic matching
 * @returns {Object} {enrichedData, enrichmentCount, fieldsEnriched: []}
 */
function extractDataFromArticles(articles, currentData = {}, startupName = '') {
  const enrichedData = { ...currentData };
  const fieldsEnriched = [];
  const cfg = getInferenceConfig();

  if (!articles || articles.length === 0) {
    return { enrichedData, enrichmentCount: 0, fieldsEnriched };
  }

  articles = dedupeAndRankArticles(articles);

  // Combine all article text for analysis
  const allText = articles.map(a => `${a.title} ${a.content}`).join('\n\n');

  let maxNarrative = 0;
  for (const a of articles) {
    const text = `${a.title || ''} ${a.content || ''}`;
    maxNarrative = Math.max(maxNarrative, scoreNarrativeRole(text, startupName).score);
  }

  // Grammar ontology first (used for funding corroboration + needs)
  const ontologyMaxChars = Math.min(64000, Math.max(4000, cfg.ONTOLOGY_NEWS_MAX_CHARS));
  const ontologyMaxSentences = Math.min(48, Math.max(8, cfg.ONTOLOGY_NEWS_MAX_SENTENCES));
  const ontologyText = allText.slice(0, ontologyMaxChars);
  let ontologyInference = extractOntologyFromNewsText(ontologyText, {
    maxSentences: ontologyMaxSentences,
  });

  const ontologyFundraising =
    ontologyInference &&
    ontologyInference.signal_classes.some(
      (c) =>
        c.signal_class === 'fundraising_signal' &&
        (c.best_certainty ?? 0) >= cfg.FUNDING_ONTOLOGY_CERTAINTY,
    );
  const fundingAgrees =
    maxNarrative >= cfg.FUNDING_NARRATIVE_AGREE_THRESHOLD || !!ontologyFundraising;

  let fundingTentative = null;

  // Funding: only promote to canonical raise_* when regex + (narrative OR ontology fundraising)
  if (!enrichedData.raise_amount || enrichedData.raise_amount === '') {
    const funding = extractFunding(allText);
    const amt = funding.funding_amount;
    if (amt != null && !Number.isNaN(amt) && amt > 0) {
      const stage = funding.funding_stage || funding.funding_round || '';
      const formatted =
        amt >= 1e9
          ? `$${(amt / 1e9).toFixed(2)}B`
          : amt >= 1e6
            ? `$${(amt / 1e6).toFixed(2)}M`
            : amt >= 1e3
              ? `$${Math.round(amt / 1e3)}K`
              : `$${Math.round(amt)}`;
      if (fundingAgrees) {
        enrichedData.raise_amount = formatted;
        enrichedData.raise_type = stage;
        enrichedData.funding_amount = amt;
        enrichedData.funding_stage = stage || enrichedData.funding_stage;
        fieldsEnriched.push('funding');
      } else {
        fundingTentative = {
          raise_amount: formatted,
          funding_amount: amt,
          funding_stage: stage,
          reason: 'regex_only_needs_corroboration',
          max_narrative_score: Math.round(maxNarrative * 1000) / 1000,
          ontology_fundraising: !!ontologyFundraising,
        };
      }
    }
  }
  
  // Extract sectors if missing
  if (!enrichedData.sectors || enrichedData.sectors.length === 0) {
    const sectors = extractSectors(allText);
    if (sectors.length > 0) {
      enrichedData.sectors = sectors;
      enrichedData.industries = sectors;
      fieldsEnriched.push('sectors');
    }
  }
  
  // Extract execution signals (traction, customers, revenue)
  const execution = extractExecutionSignals(allText);
  
  if (execution.customer_count > 0 && !enrichedData.customer_count) {
    enrichedData.customer_count = execution.customer_count;
    enrichedData.customers = execution.customer_count;
    fieldsEnriched.push('customers');
  }
  
  if (execution.revenue > 0 && !enrichedData.arr) {
    enrichedData.arr = execution.revenue;
    enrichedData.revenue = execution.revenue;
    fieldsEnriched.push('revenue');
  }
  
  if (execution.mrr > 0 && !enrichedData.mrr) {
    enrichedData.mrr = execution.mrr;
    fieldsEnriched.push('mrr');
  }
  
  // Extract team signals
  const teamSignals = extractTeamSignals(allText);
  if (teamSignals.length > 0) {
    enrichedData.team_signals = [...(enrichedData.team_signals || []), ...teamSignals];
    fieldsEnriched.push('team_signals');
  }
  
// Extract company website URL from article content (if not already known)
  if (!enrichedData.website && !enrichedData.company_url) {
    const discoveredUrl = extractCompanyUrlFromArticles(articles, startupName);
    if (discoveredUrl) {
      enrichedData.company_url = discoveredUrl;
      fieldsEnriched.push('company_url');
    }
  }

  // Store article references for transparency
  if (articles.length > 0) {
    enrichedData.enrichment_sources = articles.map(a => ({
      title: a.title,
      url: a.link,
      date: a.pubDate,
      source: a.source
    }));
    enrichedData.last_enrichment_date = new Date().toISOString();
  }

  // ── Signal Ontology Detection ─────────────────────────────────────────────
  // Scan articles for colloquial signal phrases (fundraising, traction,
  // trouble, investor interest, hype, founder psychology).
  // Results stored in market_signals for downstream scoring.
  const signalReport = detectSignals(articles, startupName);
  if (signalReport.signals.length > 0) {
    enrichedData.market_signals = {
      primarySignal:  signalReport.primarySignal?.signal || null,
      primaryCategory: signalReport.primarySignal?.category || null,
      primaryMeaning: signalReport.primarySignal?.meaning || null,
      signals:        signalReport.signals.map(s => ({
        signal:   s.signal,
        category: s.category,
        meaning:  s.meaning,
        score:    parseFloat(s.score.toFixed(3)),
        count:    s.count,
        snippet:  s.snippets[0] || null,
      })),
      scores: signalReport.scores,
      detectedAt: new Date().toISOString(),
    };
    fieldsEnriched.push('market_signals');

    if (DEBUG_INFERENCE) {
      console.log(`[signals] "${startupName}": ${signalReport.signals.length} signals — primary: ${signalReport.primarySignal?.signal}`);
    }
  }

  if (
    ontologyInference &&
    (ontologyInference.signal_classes.length > 0 || ontologyInference.inferred_strategic_needs.length > 0)
  ) {
    enrichedData.ontology_inference = ontologyInference;
    fieldsEnriched.push('ontology_inference');
    if (DEBUG_INFERENCE) {
      console.log(
        `[ontology] "${startupName}": ${ontologyInference.signal_classes.length} classes, ${ontologyInference.inferred_strategic_needs.length} strategic needs`,
      );
    }
  }

  enrichedData.enrichment_confidence = {
    ...(enrichedData.enrichment_confidence || {}),
    ...(fundingTentative ? { funding_tentative: fundingTentative } : {}),
    max_narrative_score: Math.round(maxNarrative * 1000) / 1000,
    funding_corroboration: fundingAgrees,
    ontology_fundraising_signal: !!ontologyFundraising,
    fields: {
      funding:
        enrichedData.funding_amount || enrichedData.raise_amount
          ? fundingAgrees
            ? Math.min(0.95, 0.45 + maxNarrative * 0.35 + (ontologyFundraising ? 0.15 : 0))
            : 0.35
          : null,
      sectors: enrichedData.sectors?.length ? 0.55 : null,
      market_signals: enrichedData.market_signals?.signals?.length ? 0.6 : null,
      ontology: ontologyInference?.signal_classes?.length ? 0.65 : null,
    },
    computed_at: new Date().toISOString(),
  };

  return {
    enrichedData,
    enrichmentCount: fieldsEnriched.length,
    fieldsEnriched
  };
}

/**
 * Quick enrichment: Search + Extract in one call (for real-time use)
 * @param {string} startupName - Company name
 * @param {Object} currentData - Current startup data
 * @param {string} startupWebsite - Company website (optional)
 * @param {number} timeoutMs - Max time to spend (default: 3000ms = 3s)
 * @returns {Promise<Object>} {enrichedData, enrichmentCount, fieldsEnriched, articlesFound}
 */
/**
 * Quick enrichment using VC name as search signal (for sparse startups with known T1 backing).
 * Uses query "StartupName VCName funding" to find relevant articles.
 */
async function quickEnrichWithVC(startupName, vcName, currentData = {}, startupWebsite = null, timeoutMs = 6000) {
  const startTime = Date.now();
  try {
    const enrichmentPromise = (async () => {
      const qcfg = getInferenceConfig();
      const liteOpts = { lite: qcfg.QUICK_ENRICH_LITE };
      let articles = await searchStartupNews(startupName, startupWebsite, qcfg.QUICK_ENRICH_VC_ARTICLES, vcName, liteOpts);
      if (articles.length === 0) {
        articles = await searchStartupNews(startupName, startupWebsite, qcfg.QUICK_ENRICH_VC_FALLBACK_ARTICLES, null, liteOpts);
      }
      if (articles.length === 0) {
        return { enrichedData: currentData, enrichmentCount: 0, fieldsEnriched: [], articlesFound: 0 };
      }
      const result = extractDataFromArticles(articles, currentData, startupName);
      if (!result.enrichedData.company_url && !currentData.website && !currentData.company_url) {
        const inferResult = await inferDomainFromName(startupName, Math.max(200, timeoutMs - (Date.now() - startTime) - 500));
        if (inferResult) {
          result.enrichedData.company_url = inferResult.domain;
          result.enrichedData.company_url_source = inferResult.correctedSlug ? 'name_variant_inference' : 'name_inference';
          if (inferResult.correctedSlug) result.enrichedData.corrected_name_slug = inferResult.correctedSlug;
          result.fieldsEnriched.push('company_url');
          result.enrichmentCount++;
        }
      }
      return { ...result, articlesFound: articles.length };
    })();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({
        enrichedData: currentData, enrichmentCount: 0, fieldsEnriched: [], articlesFound: 0, timedOut: true
      }), timeoutMs);
    });
    return await Promise.race([enrichmentPromise, timeoutPromise]);
  } catch (err) {
    return { enrichedData: currentData, enrichmentCount: 0, fieldsEnriched: [], articlesFound: 0, error: err.message };
  }
}

async function quickEnrich(startupName, currentData = {}, startupWebsite = null, timeoutMs = 3000) {
  const startTime = Date.now();

  try {
    const enrichmentPromise = (async () => {
      // Step 1: Search news — now queries Google News + PRNewswire + Substack + HN + Reddit
      const icfg = getInferenceConfig();
      const articles = await searchStartupNews(startupName, startupWebsite, icfg.QUICK_ENRICH_ARTICLES, null, {
        lite: icfg.QUICK_ENRICH_LITE,
      });
      
      if (articles.length === 0) {
        return {
          enrichedData: currentData,
          enrichmentCount: 0,
          fieldsEnriched: [],
          articlesFound: 0
        };
      }
      
      // Step 2: Extract data from articles
      const result = extractDataFromArticles(articles, currentData, startupName);

      // Step 3: If no URL found in articles, try name→domain inference (with variant fallback)
      if (!result.enrichedData.company_url && !currentData.website && !currentData.company_url) {
        const nameForInference = normalizeNameForSearch(startupName) || startupName;
        const inferResult = await inferDomainFromName(nameForInference, Math.max(200, timeoutMs - (Date.now() - startTime) - 500));
        if (inferResult) {
          result.enrichedData.company_url = inferResult.domain;
          result.enrichedData.company_url_source = inferResult.correctedSlug ? 'name_variant_inference' : 'name_inference';
          if (inferResult.correctedSlug) result.enrichedData.corrected_name_slug = inferResult.correctedSlug;
          result.fieldsEnriched.push('company_url');
          result.enrichmentCount++;
        }
      }
      
      return {
        ...result,
        articlesFound: articles.length
      };
    })();
    
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({
        enrichedData: currentData,
        enrichmentCount: 0,
        fieldsEnriched: [],
        articlesFound: 0,
        timedOut: true
      }), timeoutMs);
    });
    
    const result = await Promise.race([enrichmentPromise, timeoutPromise]);

    if (result.timedOut) {
      console.warn(
        `[inference] quickEnrich timed out after ${timeoutMs}ms for "${startupName}" — raise SPARSE_ENRICH_NEWS_TIMEOUT_MS or rely on QUICK_ENRICH_LITE (default) so only Google News runs inside the budget`,
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[inference] Quick enrichment for "${startupName}": ${result.enrichmentCount} fields in ${elapsed}ms` +
                (result.timedOut ? ' (timed out)' : '') +
                (result.articlesFound !== undefined ? ` (${result.articlesFound} articles)` : ''));
    if (DEBUG_INFERENCE && result.enrichmentCount === 0 && result.articlesFound > 0) {
      console.log(`[inference] DEBUG: 0 fields from ${result.articlesFound} articles — extraction patterns may not match`);
    }
    
    return result;
  } catch (error) {
    console.error(`[inference] Quick enrichment failed for "${startupName}":`, error.message);
    return {
      enrichedData: currentData,
      enrichmentCount: 0,
      fieldsEnriched: [],
      articlesFound: 0,
      error: error.message
    };
  }
}

/**
 * Check if startup data is sparse (needs enrichment)
 * @param {Object} startup - Startup object with extracted_data
 * @returns {boolean} True if sparse (< 5 data signals)
 */
function isDataSparse(startup) {
  const extracted = startup.extracted_data || {};
  let signalCount = 0;
  
  // Count key data signals
  if (extracted.raise_amount || extracted.funding_amount) signalCount++;
  if (extracted.sectors && extracted.sectors.length > 0) signalCount++;
  if (extracted.customer_count || extracted.customers) signalCount++;
  if (extracted.arr || extracted.revenue || extracted.mrr) signalCount++;
  if (extracted.team_signals && extracted.team_signals.length > 0) signalCount++;
  if (extracted.market_signals?.signals?.length > 0) signalCount++;
  if (extracted.ontology_inference?.signal_classes?.length > 0) signalCount++;

  return signalCount < 5;
}

module.exports = {
  searchStartupNews,
  extractDataFromArticles,
  quickEnrich,
  quickEnrichWithVC,
  isDataSparse,
  inferDomainFromName,
  normalizeNameForSearch,
  primarySearchToken,
  stripTrailingPossessiveToken,
  inferenceNameMatchVariants,
  generateNameVariants,
  scoreNarrativeRole,
  scoreNarrativeRoleForVariant,
  extractOntologyFromNewsText,
  dedupeAndRankArticles,
};
