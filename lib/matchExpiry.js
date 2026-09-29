'use strict';

/** Alignment is a moment. The shortlist stays current for one week. */
const MATCH_FRESH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function matchExpiry(createdAt, now = new Date()) {
  if (!createdAt) return null;
  const matched = new Date(createdAt);
  if (Number.isNaN(matched.getTime())) return null;
  const expires = new Date(matched.getTime() + MATCH_FRESH_DAYS * DAY_MS);
  const msLeft = expires.getTime() - now.getTime();
  return {
    matched_at: matched.toISOString(),
    expires_at: expires.toISOString(),
    days_left: Math.ceil(msLeft / DAY_MS),
    stale: msLeft <= 0,
  };
}

function soonestExpiry(rows, now = new Date()) {
  const expiries = (rows || []).map((row) => matchExpiry(row?.created_at || row?.matched_at, now)).filter(Boolean);
  if (!expiries.length) return null;
  return expiries.reduce((soonest, item) => (item.expires_at < soonest.expires_at ? item : soonest));
}

function formatMatchDate(iso, timeZone = 'UTC') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
}

module.exports = {
  MATCH_FRESH_DAYS,
  matchExpiry,
  soonestExpiry,
  formatMatchDate,
};
