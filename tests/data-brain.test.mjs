import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const brain = require('../lib/dataBrain.js');
const { sectorsForMatching } = require('../lib/distinctiveInvestorFit.js');
const hotGod = require('../server/scoring/hotGodFromStartupRow.js');

test('headline and boilerplate sentences are withheld from scoring text', () => {
  const headline = brain.scoringTextFromCopy({
    description: 'Pomelo Care raised $92m in Series C funding. The post appeared first on Pulse 2.0.',
  });
  assert.equal(headline.quality, 'headline');
  assert.equal(headline.description, '');

  const fund = brain.scoringTextFromCopy({
    tagline: 'Catalio Capital Management closed its second credit fund with more than $325 million.',
  });
  assert.equal(fund.quality, 'headline');

  const boiler = brain.scoringTextFromCopy({
    tagline: 'A company focused on AI and infrastructure',
    description: 'A company focused on AI and infrastructure.',
  });
  assert.equal(boiler.quality, 'boilerplate');
  assert.equal(boiler.description, '');

  const mixed = brain.scoringTextFromCopy({
    description: 'Cast AI automates Kubernetes workload rightsizing. Cast AI has reached a valuation above $1 billion following a strategic investment.',
  });
  assert.equal(mixed.quality, 'mixed');
  assert.match(mixed.description, /Kubernetes/);
  assert.doesNotMatch(mixed.description, /valuation/);
});

test('product copy is left for scoring', () => {
  const profile = hotGod.toScoringProfileFromStartupUpload({
    tagline: 'Contract test startup',
    description: 'Enterprise AI workflow automation with measurable ROI.',
    extracted_data: {},
  });
  assert.match(profile.pitch, /measurable ROI/);
  assert.equal(profile.brain_copy, 'product');
});

test('a press blurb is not passed to pattern scoring', () => {
  const profile = hotGod.toScoringProfileFromStartupUpload({
    description: 'Agentic AI scaling requires new memory architecture. The post Agentic AI scaling requires new memory architecture appeared first on AI News.',
    extracted_data: {},
  });
  assert.equal(profile.pitch, '');
  assert.equal(profile.description, '');
  assert.equal(profile.brain_copy, 'headline');
});

test('keyword lift maps a term that high-signal companies share', () => {
  const startups = [];
  for (let i = 0; i < 6; i += 1) {
    startups.push({
      id: `h${i}`,
      description: 'Sidecar proxies for service meshes and cluster traffic.',
      sectors: ['Infrastructure'],
      signals_total: 8,
      created_at: '2026-10-01T00:00:00Z',
    });
  }
  for (let i = 0; i < 14; i += 1) {
    startups.push({
      id: `l${i}`,
      description: 'Neighborhood bakery marketplace for weekend bread.',
      sectors: ['Marketplace'],
      signals_total: 1,
      created_at: '2026-08-01T00:00:00Z',
    });
  }
  const signals = new Map(startups.map((row) => [row.id, { signals_total: row.signals_total }]));
  const pack = brain.buildInsightPack({ startups, signalsById: signals, quotes: [], asOf: '2026-10-08T00:00:00Z' });
  assert.equal(pack.weight_change, false);
  const sidecar = pack.match_context.sector_terms.find((row) => row.term === 'sidecar');
  assert.ok(sidecar, 'sidecar should be a sector term');
  assert.equal(sidecar.sector, 'Infrastructure');
  assert.ok(sidecar.lift >= 1.8);
});

test('sector momentum reports a rising specific sector', () => {
  const startups = [];
  for (let i = 0; i < 10; i += 1) {
    startups.push({ sectors: ['CleanTech'], created_at: '2026-09-20T00:00:00Z', description: 'Grid software.' });
  }
  for (let i = 0; i < 4; i += 1) {
    startups.push({ sectors: ['CleanTech'], created_at: '2026-08-20T00:00:00Z', description: 'Grid software.' });
  }
  const trends = brain.sectorMomentum(startups, '2026-10-08T00:00:00Z', 30);
  const climate = trends.find((row) => row.sector === 'CleanTech');
  assert.equal(climate.direction, 'rising');
  assert.equal(climate.recent_count, 10);
  assert.equal(climate.prior_count, 4);

  const noBaseline = brain.sectorMomentum(
    Array.from({ length: 10 }, () => ({ sectors: ['Gaming'], created_at: '2026-09-20T00:00:00Z' })),
    '2026-10-08T00:00:00Z',
    30,
  );
  assert.equal(noBaseline.length, 0);
});

test('spoken thesis lines become phrases, not generated investments', () => {
  const terms = brain.thesisTerms([
    { kind: 'investing_in', firm: 'Paradigm', quote: 'We invest in founders building inference infrastructure for open models.' },
    { kind: 'investing_in', firm: 'Kleiner', quote: 'We invest in founders building inference infrastructure across research labs.' },
    { kind: 'invested_in', firm: 'Felicis', quote: 'We backed Crusoe because the energy was real.' },
  ]);
  assert.equal(terms.length, 1);
  assert.match(terms[0].term, /inference/);
  assert.deepEqual(terms[0].firms.sort(), ['Kleiner', 'Paradigm']);
});

test('learned terms fill a generic sector for matching', () => {
  brain.setActiveBrainPack({
    match_context: {
      sector_terms: [{ term: 'sidecar', sector: 'Infrastructure', support: 6, lift: 2.1 }],
    },
  });
  try {
    const hints = brain.sectorHintsFromPack('Sidecar proxies for service meshes.', brain.getActiveBrainPack());
    assert.deepEqual(hints, ['Infrastructure']);
    const sectors = sectorsForMatching({
      name: 'Mesh Co',
      website: 'https://mesh.example',
      sectors: ['Technology'],
      description: 'Sidecar proxies for service meshes.',
    });
    assert.ok(sectors.includes('Infrastructure'));
  } finally {
    brain.setActiveBrainPack(null);
  }
});

test('a weak or generic learned sector is ignored', () => {
  const pack = {
    match_context: {
      sector_terms: [
        { term: 'sidecar', sector: 'AI/ML', support: 6, lift: 3 },
        { term: 'mesh', sector: 'Infrastructure', support: 2, lift: 4 },
      ],
    },
  };
  assert.deepEqual(brain.sectorHintsFromPack('Sidecar mesh proxies.', pack), []);
});

test('score shape counts saturated traction and headline names', () => {
  const shape = brain.scoreShape([
    { name: 'A', traction_score: 100, market_score: 54, description: 'We sell permits.', entity_gate: 'qualified' },
    { name: 'Catalio', traction_score: 100, market_score: 50, description: 'Catalio closed its second credit fund with $325 million. The post appeared first on Pulse 2.0.', entity_gate: 'review' },
  ]);
  assert.equal(shape.n, 2);
  assert.equal(shape.headline, 1);
  assert.equal(shape.review_gate, 1);
  assert.deepEqual(shape.headline_names, ['Catalio']);
  assert.equal(shape.traction_saturated_share, 1);
});
