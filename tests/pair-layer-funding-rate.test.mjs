import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  PAIR_LAYER_FUNDING_RATE_SQL,
  ratePct,
  normalizeRateRow,
} = require('../server/lib/pairLayerFundingRate.js');

assert.equal(ratePct(12, 45), 26.7);
assert.equal(ratePct(0, 0), null);
assert.deepEqual(
  normalizeRateRow({ startups: 45, hits: 12, pairs: 107, pair_hits: 20 }),
  {
    pair_funding_startups: 45,
    pair_funding_hits: 12,
    pair_funding_pairs: 107,
    pair_funding_pair_hits: 20,
    pair_funding_rate_pct: 26.7,
  },
);

assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /served-first-top5/);
assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /event_at > m.created_at/);
assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /count\(DISTINCT startup_id\) FILTER \(WHERE hit = 1\)/);

const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
assert.match(home, /label: "Funding rate"/);
assert.doesNotMatch(home, /label: "Startups tracked"/);
assert.match(home, /pair_funding_rate_pct/);
const investorTile = home.slice(
  home.indexOf('label: "Investors in Pythh"'),
  home.indexOf('label: "Funding rate"'),
);
const rateTile = home.slice(
  home.indexOf('label: "Funding rate"'),
  home.indexOf('label: "Investor matches"'),
);
assert.doesNotMatch(investorTile, /featured: true/);
assert.match(rateTile, /featured: true/);
assert.match(rateTile, /color: G/);

const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
assert.match(api, /attachPairLayerFundingRate/);
assert.match(api, /pairLayerFundingRate/);

console.log('pair-layer-funding-rate.test.mjs: ok');
