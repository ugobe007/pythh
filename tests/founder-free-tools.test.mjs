import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('tsx/cjs');
const {
  buildDeckAssessment,
  buildPositioning,
  buildAdvisorMatches,
} = require('../site/lib/founderFreeTools.ts');

const examples = [
  {
    kind: 'revenue_breakout',
    name: 'Higgsfield',
    sector: 'AI video',
    headline: 'Reported $1B annualized revenue in 18 months',
    caveat: 'Company-reported run rate, not audited revenue.',
    sourceName: 'Company claim',
    sourceUrl: 'https://higgsfield.ai',
  },
  {
    kind: 'growth',
    name: 'Parallax',
    sector: 'Energy for AI',
    headline: '$117M to build power for AI data centers',
    caveat: null,
    sourceName: 'Eclipse',
    sourceUrl: 'https://eclipse.capital',
  },
  {
    kind: 'new_fund',
    name: 'ARK Venture',
    sector: 'Crossover fund',
    headline: 'A venture fund',
    caveat: null,
    sourceName: 'ARK',
    sourceUrl: 'https://ark-funds.com',
  },
];

test('deck assessment returns five recommendations and names the weakest score', () => {
  const recs = buildDeckAssessment({
    startupName: 'OrbitalAi',
    sectors: ['Robotics'],
    stage: 'pre-seed',
    scoreComponents: { team: 80, traction: 22, market: 70, product: 60, vision: 55 },
    matches: [
      { investor: { name: 'Paige Craig', firm: 'Arena Ventures' } },
      { investor_class: 'angel', investor: { name: 'Ada Lovelace', firm: 'Independent' } },
    ],
  });
  assert.equal(recs.length, 5);
  assert.match(recs[0].body, /Traction is 22\/100/);
  assert.match(JSON.stringify(recs), /Arena Ventures/);
  assert.match(JSON.stringify(recs), /Ada Lovelace/);
  assert.doesNotMatch(JSON.stringify(recs), /Independent/);
  assert.doesNotMatch(JSON.stringify(recs), /\$\d/);
  assert.doesNotMatch(JSON.stringify(recs), /will fund you/);
});

test('positioning uses sourced startups and skips funds', () => {
  const result = buildPositioning(
    { startupName: 'OrbitalAi', tagline: 'Cloud control for robots', sectors: ['Robotics', 'AI/ML'] },
    examples,
  );
  assert.match(result.thesis, /Cloud control for robots/);
  assert.deepEqual(result.examples.map((item) => item.name), ['Higgsfield', 'Parallax']);
  assert.equal(result.examples[0].fit, 'adjacent');
  assert.match(result.examples[0].why, /Not a claim that you compete/);
  assert.equal(result.examples.find((item) => item.name === 'ARK Venture'), undefined);
});

test('saved account collects the three free tools', () => {
  const hub = readFileSync(new URL('../site/components/FounderOnboardingHub.tsx', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../site/components/FounderFreeTools.tsx', import.meta.url), 'utf8');
  assert.match(hub, /<FounderFreeTools/);
  assert.match(ui, /Collect these and come back/);
  assert.match(ui, /pythh_collected_tools:/);
});

test('advisors are angels and operators already on the shortlist', () => {
  const found = buildAdvisorMatches([
    { investor_class: 'vc', investor: { name: 'Paige Craig', firm: 'Arena Ventures' }, why_you_match: 'Stage fit' },
    { investor_class: 'angel', match_score: 88, investor: { name: 'Ada Lovelace', firm: 'Independent' }, why_you_match: 'Operator angel in robotics' },
  ]);
  assert.equal(found.advisors.length, 1);
  assert.equal(found.advisors[0].name, 'Ada Lovelace');
  assert.match(found.note, /does not email/);

  const none = buildAdvisorMatches([
    { investor_class: 'vc', investor: { name: 'Paige Craig', firm: 'Arena Ventures' }, why_you_match: 'Stage fit' },
  ]);
  assert.equal(none.advisors.length, 0);
  assert.match(none.note, /will not invent an advisor/);
});
