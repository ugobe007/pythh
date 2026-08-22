'use strict';

/**
 * Firm-level Hit@5 identity keys.
 * Align claim-readiness / startup Hit@5 reports with reconcile-historical matching:
 * investor id, reviewed organization id, and normalized firm label (after headline strip).
 * Duplicate firm profiles (e.g. "Insight Partners" vs "Insightpartners") share a label key
 * even when organization membership is missing on one side.
 */

const {
  normalizeEntityName,
  stripInvestorHeadlineNoise,
} = require('./fundingEvidenceLedger.js');

function firmLabelKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const cleaned = stripInvestorHeadlineNoise(raw) || raw;
  const label = normalizeEntityName(cleaned);
  return label ? `label:${label}` : null;
}

function investorProfileLabel(investor) {
  if (!investor) return null;
  return firmLabelKey(investor.firm || investor.name);
}

/**
 * Keys for a sealed prediction row.
 * @param {{ investor_id: string }} prediction
 * @param {{ organizationByInvestor: Map<string, string>, investorById: Map<string, object> }} ctx
 */
function predictionIdentityKeys(prediction, { organizationByInvestor, investorById }) {
  const investor = investorById.get(prediction.investor_id);
  const organizationId = organizationByInvestor.get(prediction.investor_id);
  return [
    prediction.investor_id ? `investor:${prediction.investor_id}` : null,
    organizationId ? `organization:${organizationId}` : null,
    investorProfileLabel(investor),
  ].filter(Boolean);
}

/**
 * Keys for a funding-evidence participant (actual funder).
 * Prefers reviewed organization + investor id; always includes cleaned raw + profile labels.
 * @param {{ investor_id?: string|null, investor_organization_id?: string|null, investor_name_raw?: string|null }} participant
 * @param {{ investorById?: Map<string, object> }} [ctx]
 */
function participantIdentityKeys(participant, { investorById } = {}) {
  const investor = participant.investor_id && investorById
    ? investorById.get(participant.investor_id)
    : null;
  return [
    participant.investor_organization_id
      ? `organization:${participant.investor_organization_id}`
      : null,
    participant.investor_id ? `investor:${participant.investor_id}` : null,
    firmLabelKey(participant.investor_name_raw),
    investorProfileLabel(investor),
  ].filter(Boolean);
}

/** Stable primary key for de-duplicating participants within a round. */
function participantPrimaryKey(participant, ctx = {}) {
  return participantIdentityKeys(participant, ctx)[0]
    || `raw:${normalizeEntityName(participant.investor_name_raw || '')}`
    || null;
}

function identityKeysOverlap(leftKeys, rightKeySet) {
  return (leftKeys || []).some((key) => rightKeySet.has(key));
}

module.exports = {
  firmLabelKey,
  investorProfileLabel,
  predictionIdentityKeys,
  participantIdentityKeys,
  participantPrimaryKey,
  identityKeysOverlap,
};
