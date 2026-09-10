import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('homepage join opens the first five matches on /matches?url=', () => {
  const helper = readFileSync(new URL('../site/lib/openFirstMatches.ts', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../site/components/InstantMatchPreview.tsx', import.meta.url), 'utf8');
  assert.match(helper, /function persistJoinPreview/);
  assert.match(helper, /pythia_url/);
  assert.match(helper, /pythia_email/);
  assert.match(helper, /\/matches\?url=/);
  assert.match(home, /persistJoinPreview/);
  assert.match(home, /revealMatches/);
  assert.match(preview, /PREVIEW_LIMIT = 5/);
  assert.match(preview, /\/api\/instant\/submit/);
});
