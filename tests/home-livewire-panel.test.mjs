import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('livewire meta uses today + GOD without inventing a 60-day hold', async () => {
  const tsx = require.resolve('tsx/cjs');
  require(tsx);
  const {
    livewireTimeLabel,
    livewireMeta,
    firmLabel,
    fillTapePage,
    livewireHeaderStatus,
    livewirePageCount,
  } = require('../site/components/LivewireMatchPanel.tsx');

  assert.equal(livewireTimeLabel('just now'), 'today');
  assert.equal(livewireTimeLabel('12m ago'), 'today');
  assert.equal(livewireTimeLabel('3h ago'), 'today');
  assert.equal(livewireTimeLabel('2d ago'), '2d ago');

  assert.equal(livewireMeta({ time_ago: '4h ago', startup_god_score: 55 }), 'today -- 55');
  assert.equal(livewireMeta({ time_ago: '2d ago', startup_god_score: null }), '2d ago');
  assert.equal(
    firmLabel({ investor_firm: 'Headline', investor_name: 'Jane Doe' }),
    'Headline',
  );

  assert.deepEqual(fillTapePage(['a', 'b', 'c', 'd'], 1, 3), ['a', 'b', 'c']);
  assert.deepEqual(fillTapePage(['a', 'b', 'c', 'd', 'e', 'f'], 0, 6), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(
    fillTapePage(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 1, 6),
    ['g', 'h', 'i', 'j', 'k', 'l'],
  );
  assert.deepEqual(
    fillTapePage(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'], 1, 6),
    ['g', 'h', 'i', 'j', 'k', 'l'],
  );
  assert.equal(livewirePageCount(14, 6), 2);
  assert.equal(livewirePageCount(14, 6, 2), 2);
  assert.equal(livewirePageCount(6, 6, 2), 2);
  assert.equal(livewireHeaderStatus(true, 0, 0, 2), 'Refreshing');
  assert.equal(livewireHeaderStatus(false, 6, 1, 3), '2 of 3');
  assert.equal(livewireHeaderStatus(false, 6, 0, 1), 'Live network');
});

test('live tape renders two filled livewire match panels', () => {
  const tape = readFileSync(new URL('../site/components/HomeLiveNetwork.tsx', import.meta.url), 'utf8');
  assert.match(tape, /id="live-matches"/);
  assert.match(tape, /id="live-matches-next"/);
  assert.match(tape, /nextPage/);
  assert.match(tape, /livewirePageCount/);
  assert.doesNotMatch(tape, /showFunding/);
});
