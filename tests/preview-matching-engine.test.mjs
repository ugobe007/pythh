import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('preview scores investors with the matching engine instead of serving stored rows', () => {
  const preview = read('server/routes/previewRoute.js');
  const submit = read('server/routes/instantSubmit.js');

  assert.match(preview, /async function scorePreviewWithEngine/);
  assert.match(preview, /scoreStartupMatches/);
  assert.match(preview, /match_source: engineRows\.length \? 'matching_engine' : 'stored'/);
  assert.match(preview, /let pool = engineRows\.length \? engineRows : eligibleRows/);
  assert.match(submit, /function calculateMatchScore/);
  assert.match(submit, /module\.exports\.scoreStartupMatches = generateSyncTopMatchesForHttpResponse/);
  assert.match(submit, /cache_source: 'matching_engine'/);
  assert.doesNotMatch(submit, /cache_source: 'db'/);
  assert.doesNotMatch(submit, /cache_source: 'distinctive'/);
});
