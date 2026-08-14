'use strict';

const { normalizeMatchReason, unsubscribeUrl } = require('./founderTopMatchesAgent');

const TOP_STARTUP_COUNT = 3;

function uniqueTopStartups(rows, limit = TOP_STARTUP_COUNT) {
  const seen = new Set();
  return (rows || [])
    .filter((row) => row && row.startup_uploads && Number.isFinite(Number(row.match_score)))
    .sort((a, b) => Number(b.match_score) - Number(a.match_score))
    .filter((row) => {
      const startup = row.startup_uploads;
      if (startup.status && startup.status !== 'approved') return false;
      const key = String(row.startup_id || startup.id || startup.website || startup.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.startup_id || row.startup_uploads.id,
      name: row.startup_uploads.name,
      website: row.startup_uploads.website || row.startup_uploads.company_website,
      stage: row.startup_uploads.stage,
      sectors: row.startup_uploads.sectors,
      tagline: row.startup_uploads.tagline,
      god_score: row.startup_uploads.total_god_score,
      raise_amount: row.startup_uploads.raise_amount,
      match_score: Math.round(Number(row.match_score)),
      match_reason: normalizeMatchReason(row.why_you_match || row.reasoning),
    }));
}

module.exports = { TOP_STARTUP_COUNT, uniqueTopStartups, unsubscribeUrl };
