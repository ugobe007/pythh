'use strict';

/**
 * Dedupe news articles that repeat across Google News + wire + verticals.
 * Prefer the variant with richer body text for downstream ontology / extraction.
 */

function normalizeTitleKey(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function articleRichness(a) {
  return (a.content || '').length + (a.title || '').length;
}

/**
 * @param {Array<{ title?: string, content?: string, link?: string }>} articles
 * @returns {Array<object>} same shape, order by richness descending
 */
function dedupeAndRankArticles(articles) {
  if (!articles || articles.length === 0) return [];
  const byKey = new Map();
  for (const a of articles) {
    const key = normalizeTitleKey(a.title) || (a.link || '').split('?')[0] || '';
    if (!key) continue;
    const score = articleRichness(a);
    const prev = byKey.get(key);
    if (!prev || score > prev._dedupeScore) {
      byKey.set(key, { ...a, _dedupeScore: score });
    }
  }
  return Array.from(byKey.values())
    .sort((x, y) => y._dedupeScore - x._dedupeScore)
    .map(({ _dedupeScore, ...rest }) => rest);
}

module.exports = { dedupeAndRankArticles, normalizeTitleKey };
