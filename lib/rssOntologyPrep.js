'use strict';

/**
 * RSS / news headline prep for ontological inference.
 * Strips publisher glue, dedupes title repeats, filters low-relevance articles,
 * and validates entity names extracted from headlines.
 */

const PUBLISHER_TOKENS = new Set([
  'getlatka', 'techcrunch', 'crunchbase', 'latin lawyer', 'business wire', 'pr newswire',
  'forbes', 'bloomberg', 'reuters', 'venturebeat', 'axios', 'fortune', 'wsj', 'ft',
  'pitchbook', 'sifted', 'tech.eu', 'the information', 'benzinga', 'yahoo', 'cnbc',
]);

const HEADLINE_DESCRIPTOR_WORDS = new Set([
  'colombian', 'zimbabwean', 'latin', 'american', 'european', 'indian', 'african',
  'fintech', 'insurtech', 'healthtech', 'proptech', 'saas', 'startup', 'startups',
  'company', 'platform', 'full-stack', 'full', 'stack', 'carrier', 'insurance',
  'revenue', 'valuation', 'credit', 'upsize', 'banking', 'licence', 'license',
  'regulatory', 'approval', 'million', 'billion', 'series', 'seed', 'round',
  'lawyer', 'talks', 'secures', 'gets', 'got', 'receives', 'announces', 'launches',
  'first', 'new', 'top', 'leading', 'global', 'digital', 'ai', 'the', 'a', 'an',
  'and', 'for', 'with', 'from', 'into', 'its', 'their', 'our', 'we',
]);

const HEADLINE_VERB_RE = /\b(raises?|raised|raising|secures?|secured|gets?|got|receives?|received|announces?|announced|launches?|launched|closes?|closed|invests?|invested|led|leads?|backs?|backed|acquires?|acquired|partners?|partnered|files?|filed|appoints?|appointed|hires?|hired)\b/i;

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize RSS title: drop publisher suffix, collapse duplicate headline glue. */
function normalizeRssTitle(title) {
  if (!title || typeof title !== 'string') return '';
  let t = title.replace(/\s+/g, ' ').trim();

  const dashParts = t.split(/\s+[-–|]\s+/);
  if (dashParts.length > 1) {
    const pub = dashParts[dashParts.length - 1].toLowerCase();
    if (PUBLISHER_TOKENS.has(pub) || pub.length < 40) {
      t = dashParts[0].trim();
    }
  }

  const half = Math.floor(t.length / 2);
  if (t.length > 40) {
    const a = t.slice(0, half).trim();
    const b = t.slice(half).trim();
    if (b.startsWith(a.slice(0, Math.min(24, a.length)))) {
      t = a;
    }
  }

  // Strip leading publisher brand prefix ("GetLatka Nango ...")
  for (const pub of PUBLISHER_TOKENS) {
    const pubRe = new RegExp(`^${escapeRe(pub)}\\s+`, 'i');
    if (pubRe.test(t)) {
      t = t.replace(pubRe, '').trim();
      break;
    }
  }

  // Collapse duplicated headline prefix: "Nango Revenue Nango Revenue reaches..."
  const words = t.split(/\s+/);
  for (let len = 2; len <= 4 && words.length >= len * 2; len++) {
    const a = words.slice(0, len).join(' ');
    const b = words.slice(len, len * 2).join(' ');
    if (a.toLowerCase() === b.toLowerCase()) {
      t = words.slice(len).join(' ');
      break;
    }
  }

  return t.slice(0, 220);
}

/**
 * Build scored ontology inputs from RSS articles (title-first, narrative-filtered).
 */
function articlesToOntologyInputs(articles, startupName, scoreFn, opts = {}) {
  const minScore = opts.minScore ?? 0.15;
  const maxArticles = opts.maxArticles ?? 10;

  const inputs = [];
  for (const a of articles || []) {
    const title = normalizeRssTitle(a.title || '');
    const rawBody = (a.content || a.contentSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 360);
    const body =
      rawBody && !rawBody.toLowerCase().startsWith(title.toLowerCase().slice(0, Math.min(title.length, 48)))
        ? rawBody
        : '';
    const text = body ? `${title}. ${body}` : title;
    if (text.length < 12) continue;

    const { score = 0 } = scoreFn ? scoreFn(text, startupName) : { score: 1 };
    if (score < minScore) continue;

    inputs.push({
      text,
      title,
      narrative_score: score,
      source: a.source || null,
      link: a.link || null,
    });
  }

  return inputs
    .sort((x, y) => y.narrative_score - x.narrative_score)
    .slice(0, maxArticles);
}

/** Pull the company token from a headline subject span. */
function extractCompanyFromHeadlineSubject(raw, startupName) {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();

  if (startupName && startupName.length >= 2) {
    const re = new RegExp(`\\b${escapeRe(startupName)}\\b`, 'i');
    if (re.test(text)) return startupName.trim();
  }

  const beforeVerb = text.split(HEADLINE_VERB_RE)[0].trim();
  const tokens = beforeVerb.split(/\s+/).filter((w) => /^[A-Z][a-zA-Z0-9&.-]{1,28}$/.test(w));
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i];
    if (!HEADLINE_DESCRIPTOR_WORDS.has(tok.toLowerCase()) && tok.length >= 2) {
      return tok;
    }
  }

  return null;
}

function isPlausibleEntityName(name, { startupName, roleHint } = {}) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 48) return false;

  const lower = n.toLowerCase();
  if (PUBLISHER_TOKENS.has(lower)) return false;
  if (HEADLINE_VERB_RE.test(n)) return false;
  if (/\$|\d{4}|\.com\b/i.test(n)) return false;

  const words = n.split(/\s+/);
  if (words.length > 4) return false;

  const descriptorHits = words.filter((w) => HEADLINE_DESCRIPTOR_WORDS.has(w.toLowerCase())).length;
  if (descriptorHits >= 2) return false;
  if (words.length >= 2 && descriptorHits >= 1 && roleHint === 'startup') return false;

  if (startupName && lower === startupName.toLowerCase()) return true;

  if (roleHint === 'investor' || /\b(capital|ventures|partners|vc|fund|holdings|a16z)\b/i.test(n)) {
    return words.length <= 4;
  }

  if (roleHint === 'startup' && words.length > 2) return false;
  if (/\b(gets|gets|receives|secures|announces|launches|raises|raised)\b/i.test(n)) return false;

  if (/^(arr|mrr|crm|valuation|revenue|credit|upsize)$/i.test(n)) return false;

  return true;
}

/** Filter and anchor objects using known startup + RSS heuristics. */
function sanitizeOntologyObjects(objects, { startupName, sourceType, text } = {}) {
  if (!Array.isArray(objects)) return [];

  const seen = new Set();
  const out = [];

  const anchor = startupName && startupName.length >= 2 ? startupName.trim() : null;
  const anchorInText =
    anchor &&
    (!text || new RegExp(`\\b${escapeRe(anchor)}\\b`, 'i').test(text));
  if (anchorInText) {
    out.push({
      name: anchor,
      entity_type: 'STARTUP',
      role: 'startup',
      span: anchor,
      confidence: 0.92,
      source: 'startup_anchor',
    });
    seen.add(anchor.toLowerCase());
  }

  for (const obj of objects) {
    if (!obj?.name) continue;

    let name = obj.name.trim();
    if (obj.role === 'startup' || obj.entity_type === 'STARTUP') {
      const extracted = extractCompanyFromHeadlineSubject(name, startupName);
      if (extracted) name = extracted;
    }

    if (!isPlausibleEntityName(name, { startupName, roleHint: obj.role })) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      ...obj,
      name,
      entity_type:
        obj.role === 'investor' || /\b(capital|ventures|partners|vc|fund)\b/i.test(name)
          ? 'INVESTOR'
          : obj.entity_type === 'STARTUP' || (anchor && key === anchor.toLowerCase())
            ? 'STARTUP'
            : obj.entity_type,
    });
  }

  if (sourceType === 'news_article' && anchor) {
    return out.filter(
      (o) => o.source !== 'capitalization_heuristic' || o.entity_type === 'INVESTOR',
    );
  }

  return out.slice(0, 6);
}

module.exports = {
  normalizeRssTitle,
  articlesToOntologyInputs,
  extractCompanyFromHeadlineSubject,
  isPlausibleEntityName,
  sanitizeOntologyObjects,
  PUBLISHER_TOKENS,
  HEADLINE_DESCRIPTOR_WORDS,
};
