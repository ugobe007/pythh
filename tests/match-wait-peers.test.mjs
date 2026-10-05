import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { buildPeers, previewHost, usableFunder } = require('../lib/previewPeers.js');
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('preview peers route is registered before the startup id route', () => {
  const preview = read('server/routes/previewRoute.js');
  const peersAt = preview.indexOf("router.get('/peers'");
  const idAt = preview.indexOf("router.get('/:startupId'");
  assert.ok(peersAt > 0);
  assert.ok(idAt > peersAt);
  assert.match(preview, /buildPeers/);
});

test('match preview wait uses the pulsing brain and peer panel', () => {
  const ui = read('site/components/InstantMatchPreview.tsx');
  const wait = read('site/components/MatchWait.tsx');
  const raises = read('site/lib/similarRaises.ts');
  assert.match(ui, /if \(loading\) \{\s*return <MatchWait url=\{url\} \/>;/);
  assert.match(ui, /SimilarRaiseStrip/);
  assert.match(wait, /\/images\/pythh-brain\.png/);
  assert.match(raises, /\/api\/preview\/peers/);
  assert.match(wait, /similarRaisesPath/);
  assert.match(wait, /This usually takes about a minute/);
  assert.doesNotMatch(ui, /Usually a few seconds/);
});

test('peer panel keeps a lead funder, amount, and date and drops junk', () => {
  assert.equal(previewHost('https://www.Neon.tech/path'), 'neon.tech');
  assert.equal(previewHost('not a url'), '');
  assert.equal(usableFunder('Cherry Ventures & Others'), 'Cherry Ventures');
  assert.equal(usableFunder('Ventures Proceeds'), null);

  const peers = buildPeers({
    self: { id: 'self', name: 'Neon', sectors: ['AI/ML'] },
    candidates: [
      { id: 'manifold', name: 'Manifold', sectors: ['AI/ML'], total_god_score: 80 },
      { id: 'junk', name: 'Ventures Proceeds', sectors: ['AI/ML'], entity_gate: 'junk' },
      { id: 'self', name: 'Neon', sectors: ['AI/ML'] },
    ],
    events: [
      {
        id: 'ev1',
        startup_id: 'manifold',
        amount_usd: 8_000_000,
        announced_at: '2026-03-18T00:00:00Z',
        round_type: 'seed',
        verification_status: 'verified',
      },
      {
        id: 'ev-tiny',
        startup_id: 'manifold',
        amount_usd: 1000,
        announced_at: '2026-04-01T00:00:00Z',
        verification_status: 'verified',
      },
    ],
    participants: [
      { funding_event_id: 'ev1', investor_name_raw: 'Someone', participant_role: 'participant' },
      { funding_event_id: 'ev1', investor_name_raw: 'Cherry Ventures', participant_role: 'lead' },
    ],
  });

  assert.equal(peers.length, 1);
  assert.deepEqual(peers[0], {
    name: 'Manifold',
    sector: 'AI/ML',
    funder: 'Cherry Ventures',
    amount_usd: 8_000_000,
    announced_at: '2026-03-18',
    round_type: 'seed',
  });
});
