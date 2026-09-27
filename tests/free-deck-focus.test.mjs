import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { buildFreeDeckFocus } = require('../lib/deckOutline.js');

test('free deck advice is three items and stays off the paid outline', () => {
  const focus = buildFreeDeckFocus({
    name: 'Harbor Robotics',
    sectors: ['Robotics'],
    score_components: { traction: 30 },
  });
  assert.equal(focus.length, 3);
  assert.deepEqual(focus.map((item) => item.title), ['Who pays', 'Proof you have', 'Why you, why now']);
  assert.match(focus[0].detail, /Robotics/);
  assert.match(focus[1].detail, /thin/);
  assert.equal('slides' in focus, false);
});

test('free deck advice still has three items without a startup profile', () => {
  const focus = buildFreeDeckFocus();
  assert.equal(focus.length, 3);
  assert.match(focus[0].detail, /buyer/);
  assert.doesNotMatch(focus[1].detail, /thin/);
});
