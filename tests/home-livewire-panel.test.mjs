import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('livewire meta uses today + GOD without inventing a 60-day hold', async () => {
  const tsx = require.resolve('tsx/cjs');
  require(tsx);
  const { livewireTimeLabel, livewireMeta, firmLabel } = require('../site/components/HomeFeaturedMatch.tsx');

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
});
