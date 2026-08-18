'use strict';

const { normalizeEntityName } = require('./fundingEvidenceLedger.js');

function normalizeStage(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreRecentActivity(lastInvestmentAt, asOf = new Date()) {
  if (!lastInvestmentAt) return { points: 0, reason: null };
  const observedAt = new Date(lastInvestmentAt);
  const cutoff = new Date(asOf);
  if (!Number.isFinite(observedAt.getTime()) || !Number.isFinite(cutoff.getTime())) {
    return { points: 0, reason: null };
  }
  const ageDays = (cutoff.getTime() - observedAt.getTime()) / 86_400_000;
  if (ageDays < 0 || ageDays > 183) return { points: 0, reason: null };
  return { points: 3, reason: 'Recent investment activity (+3)' };
}

function buildInvestorHistoricalFeatures({ events = [], participants = [], startups = [], membershipByInvestor = new Map(), cutoffAt = new Date() }) {
  const cutoff = new Date(cutoffAt);
  const startupById = new Map(startups.map(row => [row.id, row]));
  const eventById = new Map(events.filter(event => {
    const eventAt = new Date(event.occurred_at || event.announced_at);
    return Number.isFinite(eventAt.getTime()) && eventAt < cutoff
      && ['corroborated', 'verified'].includes(event.verification_status);
  }).map(row => [row.id, row]));
  const features = new Map();
  const seenRoundsByIdentity = new Map();

  for (const participant of participants) {
    const event = eventById.get(participant.funding_event_id);
    if (!event || !participant.participation_relation || participant.participant_role === 'unknown') continue;
    const identityKey = participant.investor_organization_id
      ? `organization:${participant.investor_organization_id}`
      : participant.investor_id && membershipByInvestor.get(participant.investor_id)
        ? `organization:${membershipByInvestor.get(participant.investor_id)}`
        : participant.investor_id ? `investor:${participant.investor_id}` : null;
    if (!identityKey) continue;
    const roundKey = event.canonical_round_key || event.id;
    if (!seenRoundsByIdentity.has(identityKey)) seenRoundsByIdentity.set(identityKey, new Set());
    if (seenRoundsByIdentity.get(identityKey).has(roundKey)) continue;
    seenRoundsByIdentity.get(identityKey).add(roundKey);
    if (!features.has(identityKey)) features.set(identityKey, {
      deal_count: 0,
      lead_count: 0,
      follow_on_count: 0,
      sectors: {},
      stages: {},
      last_investment_at: null,
      evidence_event_ids: [],
    });
    const feature = features.get(identityKey);
    const startup = startupById.get(event.startup_id) || {};
    const eventAt = new Date(event.occurred_at || event.announced_at).toISOString();
    feature.deal_count += 1;
    if (['lead', 'co_lead'].includes(participant.participant_role)) feature.lead_count += 1;
    if (participant.participant_role === 'existing_investor') feature.follow_on_count += 1;
    for (const sector of startup.sectors || []) {
      const key = normalizeEntityName(sector);
      if (key) feature.sectors[key] = (feature.sectors[key] || 0) + 1;
    }
    const stage = normalizeStage(event.round_type || startup.stage);
    if (stage) feature.stages[stage] = (feature.stages[stage] || 0) + 1;
    if (!feature.last_investment_at || eventAt > feature.last_investment_at) feature.last_investment_at = eventAt;
    feature.evidence_event_ids.push(event.id);
  }
  return features;
}

function scoreHistoricalFit(startup, feature, asOf = new Date()) {
  if (!feature?.deal_count) return { points: 0, reasons: [] };
  let points = Math.min(4, Math.log2(feature.deal_count + 1));
  const reasons = [`Verified pre-cutoff investment history (${feature.deal_count})`];
  const startupSectors = (startup.sectors || []).map(normalizeEntityName).filter(Boolean);
  const sectorHits = startupSectors.filter(sector => feature.sectors?.[sector]).length;
  if (sectorHits) {
    points += Math.min(10, 5 + (sectorHits - 1) * 2.5);
    reasons.push(`Historical sector fit (${sectorHits})`);
  }
  const stage = normalizeStage(startup.stage || startup.extracted_data?.funding_stage);
  if (stage && feature.stages?.[stage]) {
    points += 6;
    reasons.push('Historical stage fit');
  }
  if (feature.last_investment_at) {
    const ageDays = (new Date(asOf).getTime() - new Date(feature.last_investment_at).getTime()) / 86_400_000;
    if (ageDays >= 0 && ageDays <= 365) {
      points += 3;
      reasons.push('Verified investment activity within 12 months');
    }
  }
  return { points: Math.min(20, points), reasons };
}

module.exports = { normalizeStage, buildInvestorHistoricalFeatures, scoreHistoricalFit, scoreRecentActivity };
