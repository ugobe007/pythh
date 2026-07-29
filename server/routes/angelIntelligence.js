const express = require('express');
const groups = require('../data/angel-organizations.json');

const router = express.Router();
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function rotationHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreGroup(group, sectors, stage, state) {
  const sectorMatches = sectors.filter((sector) =>
    (group.industries || []).some((industry) => {
      const a = norm(sector);
      const b = norm(industry);
      return b === 'crossindustry' || a.includes(b) || b.includes(a);
    }),
  );
  const stageMatch = (group.preferred_stages || []).some((candidate) => norm(candidate) === norm(stage));
  const geographyMatch = state && (group.state === state || group.region === 'National');
  return Math.min(
    100,
    35 +
      (group.priority_tier === 1 ? 15 : 5) +
      (sectorMatches.length ? 25 : 8) +
      (stageMatch ? 15 : 0) +
      (geographyMatch ? 10 : 0),
  );
}

router.get('/recommendations', (req, res) => {
  const sectors = String(req.query.sectors || '').split(',').map((value) => value.trim()).filter(Boolean);
  const stage = String(req.query.stage || '').trim();
  const state = String(req.query.state || '').trim().toUpperCase();
  const limit = Math.min(3, Math.max(1, Number(req.query.limit) || 3));
  const rotation = Math.max(0, Number.parseInt(String(req.query.rotation || '0'), 10) || 0);
  const seed = String(req.query.seed || `${sectors.join(',')}|${stage}|${state}`).slice(0, 160);

  const ranked = groups
    .filter((group) => group.verification_status === 'source_backed' && group.application_url)
    .map((group) => ({
      ...group,
      match_score: scoreGroup(group, sectors, stage, state),
      why_this_group:
        group.industries?.includes('Cross-industry')
          ? `${group.name} has a structured application path for early-stage companies.`
          : `${group.name} has stated relevance to ${(group.industries || []).slice(0, 2).join(' and ')} companies.`,
      founder_preparation: [
        'Confirm geographic and membership eligibility.',
        'Lead with stage-appropriate traction and use of funds.',
        'Tailor the deck to the group’s screening process.',
      ],
    }))
    .sort((a, b) => b.match_score - a.match_score || a.name.localeCompare(b.name));

  // Rotate within the near-best pool so relevance remains high without showing
  // founders the same alphabetically sorted groups on every match run.
  const bestScore = ranked[0]?.match_score || 0;
  const qualifiedPool = ranked.filter((group) => group.match_score >= bestScore - 15);
  const rotationPool = qualifiedPool.length >= limit ? qualifiedPool : ranked;
  const recommendations = rotationPool
    .map((group) => ({
      group,
      rotation_order: rotationHash(`${seed}|${rotation}|${group.slug}`),
    }))
    .sort((a, b) => a.rotation_order - b.rotation_order)
    .slice(0, limit)
    .map(({ group }) => group);

  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json({
    recommendations,
    rotation: {
      index: rotation,
      available: rotationPool.length,
    },
    catalog: {
      organizations: groups.length,
      source_backed: groups.filter((group) => group.verification_status === 'source_backed').length,
      research_queue: groups.filter((group) => group.verification_status === 'research_queue').length,
    },
  });
});

module.exports = router;
