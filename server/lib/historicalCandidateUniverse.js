'use strict';

function validDate(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function profileExistedAtCutoff(profile, cutoffAt) {
  const createdAt = validDate(profile?.created_at);
  const cutoff = validDate(cutoffAt);
  // Legacy profiles without a creation timestamp remain in the historical
  // universe. Newly repaired profiles always carry a creation timestamp.
  if (createdAt === null || cutoff === null) return true;
  return createdAt <= cutoff;
}

function classifyHistoricalCandidate(candidateIds, investorById, cutoffAt) {
  const current = [...new Set((candidateIds || []).filter(Boolean))];
  const historical = current.filter(id => profileExistedAtCutoff(investorById.get(id), cutoffAt));
  return {
    current,
    historical,
    repaired_after_cutoff: current.filter(id => !historical.includes(id)),
  };
}

module.exports = { profileExistedAtCutoff, classifyHistoricalCandidate };
