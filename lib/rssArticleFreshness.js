'use strict';

/**
 * Drop RSS items older than MAX_ARTICLE_AGE_DAYS (default 14).
 * Prevents stale backlog items from re-entering the pipeline when a source
 * hasn't been scraped in days.
 */

function maxArticleAgeDays() {
  const n = Number(process.env.MAX_ARTICLE_AGE_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

function parsePubDate(pubDate) {
  if (!pubDate) return null;
  const d = pubDate instanceof Date ? pubDate : new Date(pubDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date|string|undefined|null} pubDate
 * @param {{ maxDays?: number, now?: Date }} [opts]
 * @returns {{ fresh: boolean, ageDays: number|null, reason: string }}
 */
function isArticleFresh(pubDate, opts = {}) {
  const maxDays = opts.maxDays ?? maxArticleAgeDays();
  const now = opts.now ?? new Date();
  const parsed = parsePubDate(pubDate);

  // No date → treat as fresh (many feeds omit pubDate on newest item)
  if (!parsed) {
    return { fresh: true, ageDays: null, reason: 'no_pub_date' };
  }

  const ageMs = now.getTime() - parsed.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  // Future-dated items (bad feed clocks) — allow within 1 day
  if (ageDays < -1) {
    return { fresh: false, ageDays, reason: 'future_dated' };
  }

  if (ageDays > maxDays) {
    return { fresh: false, ageDays, reason: 'stale' };
  }

  return { fresh: true, ageDays, reason: 'ok' };
}

module.exports = {
  maxArticleAgeDays,
  isArticleFresh,
  parsePubDate,
};
