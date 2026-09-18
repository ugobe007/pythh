'use strict';

/**
 * Pair-level top-5 funding: of the investors we ranked in a sealed top-5,
 * how many later funded that startup?
 *
 * Official positives still require match_validation_evidence.verified and
 * event_at > match.created_at. Ledger rows are a second evidence layer so we
 * can hunt funding before it is promoted to official pairs.
 * Does not rematch or retune GOD/fit.
 */

const {
  predictionIdentityKeys,
  participantIdentityKeys,
  identityKeysOverlap,
} = require('./fundingHitIdentity.js');

function eventTime(event) {
  return new Date(event.occurred_at || event.announced_at || event.event_at);
}

function trustedLedgerEvent(event, { classifyFundingEvidence, assessFundingSource }) {
  if (!classifyFundingEvidence({
    event_type: 'FUNDING',
    source_title: event.source_title,
    frame_confidence: 1,
    extraction_meta: { decision: 'ACCEPT', graph_safe: true },
  }).eligible) return false;
  if (event.verification_status === 'rejected') return false;
  if (['verified', 'corroborated'].includes(event.verification_status)) return true;
  return event.verification_status === 'observed' && assessFundingSource(event).trusted;
}

function namedParticipants(rows) {
  return (rows || []).filter((row) =>
    row.participation_relation
    && row.participant_role !== 'unknown'
    && String(row.investor_name_raw || '').trim());
}

function officialEvidenceForPrediction(prediction, evidenceRows, identityCtx, predictedAt, asOf) {
  const predKeys = new Set(predictionIdentityKeys(prediction, identityCtx));
  return (evidenceRows || []).filter((row) => {
    if (!['funding', 'investment'].includes(row.evidence_type || 'funding')) return false;
    const at = eventTime(row);
    if (!Number.isFinite(at.getTime()) || at <= predictedAt || at > asOf) return false;
    if (row.match_created_at) {
      const matchAt = new Date(row.match_created_at);
      if (Number.isFinite(matchAt.getTime()) && at <= matchAt) return false;
    }
    const keys = predictionIdentityKeys({ investor_id: row.investor_id }, identityCtx);
    return identityKeysOverlap(keys, predKeys);
  });
}

function ledgerHitsForPrediction(prediction, events, participantsByEvent, identityCtx, predictedAt, asOf, helpers) {
  const predKeys = new Set(predictionIdentityKeys(prediction, identityCtx));
  const trusted = [];
  const observed = [];
  for (const event of events || []) {
    if (event.verification_status === 'rejected') continue;
    const at = eventTime(event);
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    if (!Number.isFinite(at.getTime()) || at <= predictedAt || at > asOf) continue;
    if (!Number.isFinite(discoveredAt.getTime()) || discoveredAt < predictedAt) continue;
    const hits = namedParticipants(participantsByEvent.get(event.id)).filter((row) =>
      identityKeysOverlap(participantIdentityKeys(row, identityCtx), predKeys));
    if (!hits.length) continue;
    if (trustedLedgerEvent(event, helpers)) trusted.push({ event, hits });
    else observed.push({ event, hits });
  }
  return { trusted, observed };
}

function evaluateSealedTop5Pairs({
  set,
  events = [],
  participantsByEvent = new Map(),
  officialEvidence = [],
  identityCtx,
  asOf = new Date(),
  classifyFundingEvidence,
  assessFundingSource,
}) {
  const predictedAt = new Date(set.predicted_at);
  const helpers = { classifyFundingEvidence, assessFundingSource };
  const postEvents = (events || []).filter((event) => {
    if (event.verification_status === 'rejected') return false;
    const at = eventTime(event);
    const discoveredAt = new Date(event.discovered_at || event.created_at);
    return Number.isFinite(at.getTime()) && at > predictedAt && at <= asOf
      && Number.isFinite(discoveredAt.getTime()) && discoveredAt >= predictedAt;
  });
  const startupFundedAfterMatch = postEvents.some((event) => trustedLedgerEvent(event, helpers));
  const pairs = (set.predictions || []).map((prediction) => {
    const official = officialEvidenceForPrediction(prediction, officialEvidence, identityCtx, predictedAt, asOf);
    const officialVerified = official.filter((row) => row.verified);
    const officialPending = official.filter((row) => !row.verified && row.review_status === 'pending');
    const ledger = ledgerHitsForPrediction(
      prediction, events, participantsByEvent, identityCtx, predictedAt, asOf, helpers,
    );
    const officialHit = officialVerified.length > 0;
    const ledgerTrustedHit = ledger.trusted.length > 0;
    const ledgerObservedHit = ledger.observed.length > 0;
    return {
      rank: Number(prediction.rank_position),
      investor_id: prediction.investor_id,
      official_verified: officialHit,
      official_pending: officialPending.length > 0,
      ledger_trusted: ledgerTrustedHit,
      ledger_observed: ledgerObservedHit,
      pair_hit: officialHit || ledgerTrustedHit,
      evidence_found: officialHit || ledgerTrustedHit || ledgerObservedHit || officialPending.length > 0,
      source_url: officialVerified[0]?.source_url
        || officialPending[0]?.source_url
        || ledger.trusted[0]?.event?.source_url
        || ledger.observed[0]?.event?.source_url
        || null,
    };
  });
  return {
    startup_id: set.startup_id,
    predicted_at: set.predicted_at,
    pair_count: pairs.length,
    pair_hits: pairs.filter((row) => row.pair_hit).length,
    evidence_pairs: pairs.filter((row) => row.evidence_found).length,
    official_pair_hits: pairs.filter((row) => row.official_verified).length,
    ledger_trusted_pair_hits: pairs.filter((row) => row.ledger_trusted).length,
    startup_funded_after_match: startupFundedAfterMatch,
    pairs,
  };
}

function summarizeTop5PairFunding(evaluated) {
  const pairs = evaluated.reduce((sum, row) => sum + row.pair_count, 0);
  const pairHits = evaluated.reduce((sum, row) => sum + row.pair_hits, 0);
  const officialPairHits = evaluated.reduce((sum, row) => sum + row.official_pair_hits, 0);
  const evidencePairs = evaluated.reduce((sum, row) => sum + row.evidence_pairs, 0);
  const startups = evaluated.length;
  const startupHits = evaluated.filter((row) => row.pair_hits > 0).length;
  const fundedStartups = evaluated.filter((row) => row.startup_funded_after_match).length;
  const searchCandidates = evaluated
    .filter((row) => !row.startup_funded_after_match && row.evidence_pairs === 0)
    .map((row) => row.startup_id);
  const pct = (n, d) => {
    if (!(d > 0)) return null;
    const value = (n / d) * 100;
    return value < 0.1 && value > 0 ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10;
  };
  return {
    sealed_startups: startups,
    sealed_top5_pairs: pairs,
    official_pair_hits: officialPairHits,
    trusted_pair_hits: pairHits,
    evidence_pairs: evidencePairs,
    startups_with_a_top5_funder: startupHits,
    startups_funded_after_match: fundedStartups,
    pair_hit_rate_pct: pct(pairHits, pairs),
    official_pair_hit_rate_pct: pct(officialPairHits, pairs),
    startup_hit_rate_pct: pct(startupHits, startups),
    search_candidate_ids: searchCandidates,
  };
}

module.exports = {
  eventTime,
  trustedLedgerEvent,
  evaluateSealedTop5Pairs,
  summarizeTop5PairFunding,
};
