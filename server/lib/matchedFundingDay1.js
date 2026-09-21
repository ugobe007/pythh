/**
 * Official pair-level funding proof.
 *
 * Day 1 is the match clock: min(startup_investor_matches.created_at) for that
 * pair (the row linked on match_validation_evidence.match_id). A raise counts
 * only when event_at is strictly after that instant.
 *
 * Does not rematch or retune GOD/fit.
 */
'use strict';

function officialDay1Pairs(evidenceRows = [], matchById = new Map()) {
  const pairs = [];
  for (const row of evidenceRows || []) {
    if (!row?.verified) continue;
    const evidenceType = row.evidence_type || 'funding';
    if (!['funding', 'investment'].includes(evidenceType)) continue;
    const match = row.match_id ? matchById.get(row.match_id) : null;
    if (!match?.created_at || !row.event_at) continue;
    const day1 = new Date(match.created_at);
    const at = new Date(row.event_at);
    if (!Number.isFinite(day1.getTime()) || !Number.isFinite(at.getTime())) continue;
    if (at <= day1) continue;
    if (match.startup_id && row.startup_id && match.startup_id !== row.startup_id) continue;
    if (match.investor_id && row.investor_id && match.investor_id !== row.investor_id) continue;
    pairs.push({
      evidence_id: row.id,
      match_id: row.match_id,
      startup_id: row.startup_id || match.startup_id,
      investor_id: row.investor_id || match.investor_id,
      event_at: row.event_at,
      match_created_at: match.created_at,
      days_after_match: Math.round((at.getTime() - day1.getTime()) / 86_400_000),
      source_url: row.source_url || null,
      evidence_type: evidenceType,
      review_status: row.review_status || null,
    });
  }
  return pairs;
}

function summarizeOfficialPairs(pairs = []) {
  const startups = new Set();
  const investors = new Set();
  const uniquePairs = new Set();
  let minDays = null;
  let maxDays = null;
  for (const row of pairs) {
    if (row.startup_id) startups.add(row.startup_id);
    if (row.investor_id) investors.add(row.investor_id);
    if (row.startup_id && row.investor_id) {
      uniquePairs.add(`${row.startup_id}:${row.investor_id}`);
    }
    const days = Number(row.days_after_match);
    if (!Number.isFinite(days)) continue;
    if (minDays == null || days < minDays) minDays = days;
    if (maxDays == null || days > maxDays) maxDays = days;
  }
  return {
    official_pairs: uniquePairs.size,
    startups_with_official_pair: startups.size,
    investors_in_official_pairs: investors.size,
    min_days_after_match: minDays,
    max_days_after_match: maxDays,
    clock: 'startup_investor_matches.created_at',
    rule: 'match_validation_evidence.verified and event_at > match.created_at',
  };
}

function ledgerEventTime(event) {
  const raw = event?.occurred_at || event?.announced_at || event?.event_at;
  const at = raw ? new Date(raw) : null;
  return at && Number.isFinite(at.getTime()) ? at : null;
}

function isPostDay1LedgerEvent(event, day1) {
  const at = ledgerEventTime(event);
  const clock = day1 ? new Date(day1) : null;
  if (!at || !clock || !Number.isFinite(clock.getTime())) return false;
  return at > clock;
}

module.exports = {
  officialDay1Pairs,
  summarizeOfficialPairs,
  ledgerEventTime,
  isPostDay1LedgerEvent,
};
