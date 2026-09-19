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
    pair_funding_hits_top50: 0,
    pair_funding_pair_hits_top50: 0,
    pair_funding_rate_top50_pct: null,
  },
);
assert.deepEqual(
  normalizeRateRow({
    startups: 45,
    hits: 13,
    hits_top50: 29,
    pairs: 107,
    pair_hits: 20,
    pair_hits_top50: 48,
  }),
  {
    pair_funding_startups: 45,
    pair_funding_hits: 13,
    pair_funding_pairs: 107,
    pair_funding_pair_hits: 20,
    pair_funding_rate_pct: 28.9,
    pair_funding_hits_top50: 29,
    pair_funding_pair_hits_top50: 48,
    pair_funding_rate_top50_pct: 64.4,
  },
);

assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /served-first-top5/);
assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /event_at > m.created_at/);
assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /count\(DISTINCT startup_id\) FILTER \(WHERE hit = 1\)/);
assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /count\(DISTINCT startup_id\) FILTER \(WHERE hit50 = 1\)/);
assert.match(PAIR_LAYER_FUNDING_RATE_SQL, /live_rank <= 50/);

const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
const proof = readFileSync(new URL('../site/components/HomeProofStrip.tsx', import.meta.url), 'utf8');
assert.match(home, /<HomeProofStrip/);
assert.match(home, /pair_funding_rate_pct/);
assert.match(home, /pair_funding_rate_top50_pct/);
assert.match(home, /pairRateTop50/);
assert.match(proof, /Verified funding/);
assert.match(proof, /Startups funded \(scale\)/);
assert.match(proof, /later raised from an investor we ranked in the top five/);
assert.match(proof, /later raised from an investor we ranked in the top fifty/);
assert.match(proof, /label="top 5"/);
assert.match(proof, /label="top 50"/);
assert.match(proof, /size="lg"/);
assert.match(proof, /size="sm"/);
assert.match(proof, /not predictive quality/);
assert.doesNotMatch(proof, /post-prediction/);
assert.match(proof, /Methodology/);
assert.doesNotMatch(proof, /label: "Startups tracked"/);

const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
assert.match(api, /attachPairLayerFundingRate/);
assert.match(api, /pairLayerFundingRate/);

console.log('pair-layer-funding-rate.test.mjs: ok');
