'use strict';

/**
 * Multi-clause RSS / wire copy often bundles several companies in one item
 * ("… invested $X in A … but did not invest in B …"). Single-pass headline
 * extraction misses secondary names. This module adds lightweight, pattern-based
 * company *mentions* for matching — not coreference, not full IE.
 *
 * Used by scripts/enrich-from-rss-news.js with the full text blob (title +
 * subject/object + semantic_context snippets when present).
 */

const TRAIL_JUNK = /[,;.\s]+(and|but|since|which|that|a|the|an|when|where)\s*$/i;

/**
 * Regexes use the `i` flag for verbs ("did not", "invested"), which also makes
 * `[A-Z]` match lowercase — so "… in Smithery since …" can capture
 * "Smithery since they did not". Keep only the leading run of words whose
 * first character is ASCII uppercase (wire-style proper names).
 */
function trimCapitalizedNameRun(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.trim().split(/\s+/);
  const out = [];
  for (const p of parts) {
    if (!p) continue;
    const first = p.charAt(0);
    if (/[A-Z]/.test(first)) out.push(p);
    else break;
  }
  return out.length ? out.join(' ') : null;
}

function cleanMention(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const capped = trimCapitalizedNameRun(raw);
  if (!capped) return null;
  let s = capped.replace(TRAIL_JUNK, '').trim();
  s = s.replace(/[,;:.]$/, '').trim();
  if (s.length < 2 || s.length > 80) return null;
  return s;
}

/**
 * @param {string} text
 * @returns {string[]} deduped candidate company strings (capitalized phrases)
 */
function extractDealCompanyMentions(text) {
  if (!text || typeof text !== 'string') return [];
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return [];
  const names = new Set();

  const patterns = [
    // "invested $5M in Gitlab", "invests in Acme Labs"
    /\b(?:invested|invests|investing)\s+(?:\$[\d.,]+\s*[KMBkmb]?\s+)?in\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})/gi,
    /\binvestment\s+in\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})/gi,
    // "backing Smithery", "backed Acme"
    /\b(?:backing|backed)\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})\b/gi,
    // Negation / pass — still matchable if that startup exists in DB
    /\b(?:did\s+not|never)\s+invest\s+in\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})/gi,
    /\bpassed\s+on\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,3})/gi,
    /\b(?:no|not)\s+investment\s+in\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      const c = cleanMention(m[1]);
      if (c) names.add(c);
    }
  }

  return [...names];
}

/**
 * Concatenate all RSS event text we have in DB for mention mining.
 * @param {Record<string, unknown>} event startup_events row
 */
function buildEventTextBlob(event) {
  if (!event || typeof event !== 'object') return '';
  const parts = [];
  if (event.source_title) parts.push(String(event.source_title));
  if (event.subject) parts.push(String(event.subject));
  if (event.object) parts.push(String(event.object));
  const sc = event.semantic_context;
  if (Array.isArray(sc)) {
    for (const ev of sc) {
      if (ev && typeof ev === 'object' && ev.text) parts.push(String(ev.text));
    }
  } else if (sc && typeof sc === 'string') {
    parts.push(sc);
  }
  return parts.join(' ');
}

module.exports = { extractDealCompanyMentions, buildEventTextBlob };
