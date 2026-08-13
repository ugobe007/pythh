import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('matches use the Analyze → Shortlist → Outreach workflow', async () => {
  const preview = await read('site/components/InstantMatchPreview.tsx');
  assert.match(preview, /Company analyzed/);
  assert.match(preview, /Understand your best matches/);
  assert.match(preview, /Start investor outreach/);
  assert.match(preview, /Prepare outreach for my top/);
  assert.match(preview, /handleSignup\('outreach'\)/);
  assert.doesNotMatch(preview, /Step 2 complete/);
  assert.doesNotMatch(preview, /\['2', 'Account created'\]/);
});

test('matches preserve canonical Submit URL and preview calls', async () => {
  const preview = await read('site/components/InstantMatchPreview.tsx');
  assert.match(preview, /apiUrl\('\/api\/instant\/submit'\)/);
  assert.match(preview, /apiUrl\(`\/api\/preview\/\$\{startupId\}/);
  assert.match(preview, /for \(let i = 0; i < 30/);
});
