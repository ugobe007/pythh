const express = require('express');
const events = require('../data/pitch-events.json');

const router = express.Router();

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function scoreEvent(event, sectors, stage) {
  const startupSectors = sectors.map(normalized).filter(Boolean);
  const eventSectors = event.sectors.map(normalized);
  const sectorMatches = startupSectors.filter((sector) =>
    eventSectors.some((candidate) => candidate.includes(sector) || sector.includes(candidate)),
  );
  const stageMatch = event.stages.map(normalized).includes(normalized(stage));
  return {
    score: Math.min(100, 45 + Math.min(35, sectorMatches.length * 20) + (stageMatch ? 15 : 0)),
    sharedSectors: sectorMatches,
    stageMatch,
  };
}

router.get('/recommendations', (req, res) => {
  const sectors = String(req.query.sectors || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const stage = String(req.query.stage || '').trim();
  const limit = Math.min(3, Math.max(1, Number(req.query.limit) || 3));

  const recommendations = events
    .filter((event) => event.status === 'open')
    .map((event) => {
      const match = scoreEvent(event, sectors, stage);
      const sectorLabel = sectors.find((sector) =>
        event.sectors.some((candidate) => normalized(candidate).includes(normalized(sector))),
      );
      return {
        ...event,
        match_score: match.score,
        why_this_event: sectorLabel
          ? `${event.organizer} supports ${sectorLabel} startups${match.stageMatch ? ` at the ${stage} stage` : ''}.`
          : `${event.organizer} accepts startups across multiple technology sectors${match.stageMatch ? `, including ${stage}` : ''}.`,
      };
    })
    .sort((a, b) => b.match_score - a.match_score || a.organizer.localeCompare(b.organizer))
    .slice(0, limit);

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  res.json({ recommendations, generated_at: new Date().toISOString() });
});

module.exports = router;
