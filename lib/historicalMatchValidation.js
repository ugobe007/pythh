'use strict';

function asTime(value) {
  const time = value == null ? NaN : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function classifyHistoricalOutcome({ matchCreatedAt, eventDate, startupId, investorId, sourceUrl }) {
  const matchTime = asTime(matchCreatedAt);
  const eventTime = asTime(eventDate);
  const completeIdentity = Boolean(startupId && investorId);
  const hasProvenance = Boolean(sourceUrl && String(sourceUrl).trim());
  const isPostPrediction = matchTime != null && eventTime != null && eventTime > matchTime;

  return {
    eligible: completeIdentity && hasProvenance && isPostPrediction,
    completeIdentity,
    hasProvenance,
    isPostPrediction,
    reason: !completeIdentity
      ? 'missing_canonical_identity'
      : !hasProvenance
        ? 'missing_source_provenance'
        : matchTime == null || eventTime == null
          ? 'missing_event_or_prediction_date'
          : !isPostPrediction
            ? 'event_not_after_prediction'
            : 'eligible_positive',
  };
}

function labelExposure({ positiveEvidenceCount, matchCreatedAt, observedThrough, minimumObservationDays = 365 }) {
  if (Number(positiveEvidenceCount) > 0) return { label: 1, reason: 'verified_post_prediction_event' };
  const start = asTime(matchCreatedAt);
  const end = asTime(observedThrough);
  if (start == null || end == null || end <= start) return { label: null, reason: 'invalid_observation_window' };
  const observationDays = (end - start) / 86400000;
  if (observationDays < minimumObservationDays) return { label: null, reason: 'insufficient_observation_window' };
  return { label: 0, reason: 'exposed_no_verified_event' };
}

module.exports = { classifyHistoricalOutcome, labelExposure };
