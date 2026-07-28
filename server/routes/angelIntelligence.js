const express = require('express');
const groups = require('../data/angel-organizations.json');

const router = express.Router();
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

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

  const recommendations = groups
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
    .sort((a, b) => b.match_score - a.match_score || a.name.localeCompare(b.name))
    .slice(0, limit);

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.json({
    recommendations,
    catalog: {
      organizations: groups.length,
      source_backed: groups.filter((group) => group.verification_status === 'source_backed').length,
      research_queue: groups.filter((group) => group.verification_status === 'research_queue').length,
    },
  });
});

module.exports = router;
