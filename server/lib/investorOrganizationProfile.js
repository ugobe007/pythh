'use strict';

const { normalizeEntityName } = require('./fundingEvidenceLedger.js');

const ARRAY_FIELDS = ['sectors', 'stage', 'geography_focus', 'portfolio_companies', 'notable_investments'];
const PROFILE_FIELDS = [...ARRAY_FIELDS, 'check_size_min', 'check_size_max', 'investment_thesis'];
const TIER_RANK = { emerging: 1, solid: 2, strong: 3, elite: 4 };

function values(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function normalizeAttributeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueValues(profiles, field) {
  const byKey = new Map();
  for (const profile of profiles) {
    for (const value of values(profile[field])) {
      const key = normalizeAttributeValue(value);
      if (key && !byKey.has(key)) byKey.set(key, value);
    }
  }
  return [...byKey.values()];
}

function profileCompleteness(profile = {}) {
  return PROFILE_FIELDS.reduce((score, field) => {
    if (ARRAY_FIELDS.includes(field)) return score + (values(profile[field]).length ? 1 : 0);
    return score + (profile[field] !== null && profile[field] !== undefined && profile[field] !== '' ? 1 : 0);
  }, 0);
}

function isFirstPartySafeThesis(value) {
  const text = String(value || '').trim();
  return text.length >= 20 && !/^\[inferred from news\]/i.test(text);
}

function chooseRepresentative(profiles) {
  return [...profiles].sort((a, b) => {
    const aFirmRow = normalizeEntityName(a.name) && normalizeEntityName(a.name) === normalizeEntityName(a.firm) ? 1 : 0;
    const bFirmRow = normalizeEntityName(b.name) && normalizeEntityName(b.name) === normalizeEntityName(b.firm) ? 1 : 0;
    return bFirmRow - aFirmRow
      || profileCompleteness(b) - profileCompleteness(a)
      || String(a.id).localeCompare(String(b.id));
  })[0] || null;
}

function mergeReviewedOrganizationProfiles(profiles = []) {
  const reviewed = profiles.filter(profile => profile.membership_reviewed === true);
  const representative = chooseRepresentative(reviewed);
  if (!representative) return { representative: null, merged: null, provenance: {}, fields_gained: [] };
  const merged = { ...representative };
  const provenance = {};
  for (const field of ARRAY_FIELDS) {
    merged[field] = uniqueValues(reviewed, field);
    provenance[field] = reviewed.filter(profile => values(profile[field]).length).map(profile => profile.id);
  }
  const mins = reviewed.map(profile => Number(profile.check_size_min)).filter(value => Number.isFinite(value) && value > 0);
  const maxes = reviewed.map(profile => Number(profile.check_size_max)).filter(value => Number.isFinite(value) && value > 0);
  merged.check_size_min = mins.length ? Math.min(...mins) : null;
  merged.check_size_max = maxes.length ? Math.max(...maxes) : null;
  provenance.check_size_min = reviewed.filter(profile => Number(profile.check_size_min) > 0).map(profile => profile.id);
  provenance.check_size_max = reviewed.filter(profile => Number(profile.check_size_max) > 0).map(profile => profile.id);
  const theses = reviewed.filter(profile => isFirstPartySafeThesis(profile.investment_thesis))
    .sort((a, b) => String(b.investment_thesis).length - String(a.investment_thesis).length || String(a.id).localeCompare(String(b.id)));
  merged.investment_thesis = theses[0]?.investment_thesis || null;
  provenance.investment_thesis = theses[0] ? [theses[0].id] : [];
  const dates = reviewed.map(profile => profile.last_investment_date).filter(Boolean).sort();
  merged.last_investment_date = dates.at(-1) || null;
  merged.investment_pace_per_year = Math.max(0, ...reviewed.map(profile => Number(profile.investment_pace_per_year) || 0));
  merged.investor_score = Math.max(0, ...reviewed.map(profile => Number(profile.investor_score) || 0));
  merged.investor_tier = reviewed.map(profile => String(profile.investor_tier || '').toLowerCase())
    .sort((a, b) => (TIER_RANK[b] || 0) - (TIER_RANK[a] || 0))[0] || representative.investor_tier;
  merged.leads_rounds = reviewed.some(profile => profile.leads_rounds === true);
  merged.follows_rounds = reviewed.some(profile => profile.follows_rounds === true);
  const fieldsGained = PROFILE_FIELDS.filter(field => {
    const before = ARRAY_FIELDS.includes(field) ? values(representative[field]).length : representative[field];
    const after = ARRAY_FIELDS.includes(field) ? values(merged[field]).length : merged[field];
    return (!before && !!after) || (ARRAY_FIELDS.includes(field) && after > before);
  });
  return { representative, merged, provenance, fields_gained: fieldsGained };
}

module.exports = {
  ARRAY_FIELDS,
  PROFILE_FIELDS,
  profileCompleteness,
  chooseRepresentative,
  mergeReviewedOrganizationProfiles,
  isFirstPartySafeThesis,
  normalizeAttributeValue,
};
