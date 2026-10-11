import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('preview / submit reuse stored matches unless the profile materially changed', () => {
  const preview = read('server/routes/previewRoute.js');
  const submit = read('server/routes/instantSubmit.js');

  assert.match(preview, /async function scorePreviewWithEngine/);
  assert.match(preview, /scoreStartupMatches/);
  assert.match(preview, /shouldPreferStoredMatches/);
  assert.match(preview, /account_saved/);
  assert.match(preview, /post_signup/);
  assert.match(preview, /matches_preview/);
  assert.match(preview, /isMatchFingerprintStale/);
  assert.match(preview, /preferStored \? \[\] : await scorePreviewWithEngine/);
  assert.match(preview, /match_source: preferStored \? 'stored' : \(engineRows\.length \? 'matching_engine' : 'stored'\)/);
  assert.match(submit, /function calculateMatchScore/);
  assert.match(submit, /module\.exports\.scoreStartupMatches = generateSyncTopMatchesForHttpResponse/);
  assert.match(submit, /cache_source: 'matching_engine'/);
  assert.match(submit, /cache_source: 'stored'/);
  assert.match(submit, /materialMatchChange/);
  assert.match(submit, /loadStoredSuggestedMatches/);
  assert.doesNotMatch(submit, /cache_source: 'db'/);
  assert.doesNotMatch(submit, /cache_source: 'distinctive'/);
});
