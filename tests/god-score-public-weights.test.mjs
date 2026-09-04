import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

function read(rel) {
  return readFileSync(path.join(here, rel), 'utf8');
}

test('public GOD weight copy matches live config JSON', () => {
  const cfg = JSON.parse(read('../server/config/god-score-weights.json'));
  const live = cfg.weights.componentWeights;
  const pub = read('../site/lib/godScorePublicWeights.ts');
  assert.equal(live.team, 0.22);
  assert.equal(live.traction, 0.3);
  assert.equal(live.market, 0.2);
  assert.equal(live.product, 0.15);
  assert.equal(live.vision, 0.13);
  assert.match(pub, /team: 0\.22/);
  assert.match(pub, /traction: 0\.3/);
  assert.match(pub, /market: 0\.2/);
  assert.match(pub, /product: 0\.15/);
  assert.match(pub, /vision: 0\.13/);
  assert.match(pub, /traction 30/);
});

test('public scoring pages no longer claim equal 20-point GOD buckets', () => {
  const pages = {
    methodology: read('../site/pages/Methodology.tsx'),
    platform: read('../site/pages/Platform.tsx'),
    trends: read('../site/pages/SignalTrends.tsx'),
    chart: read('../site/components/HorizontalSignalChart.tsx'),
  };
  for (const [name, src] of Object.entries(pages)) {
    assert.match(src, /godScorePublicWeights|godWeightPts|STARTUP_GOD_WEIGHT/, name);
    assert.doesNotMatch(src, /each scored 0–20/);
    assert.doesNotMatch(src, /Five dimensions scored 0–20 each/);
    assert.doesNotMatch(src, /GOD dimensions · 0–20 each/);
  }
  assert.match(pages.methodology, /godWeightPtsLabel\("team"\)/);
  assert.match(pages.methodology, /godWeightPtsLabel\("traction"\)/);
  assert.match(pages.methodology, /godWeightPtsLabel\("vision"\)/);
});
