import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../server/lib/founderActivationEmail.js', import.meta.url),
  'utf8',
);

test('founder activation email follows the matches-first workflow', () => {
  assert.match(source, /View investor matches/);
  assert.match(source, /Open outreach drafts/);
  assert.match(source, /Optional Oracle improvements/);
  assert.match(source, /\/matches\?url=/);
  assert.match(source, /\/wizard\/\$\{encodeURIComponent\(startupId\)\}\?tab=round&force_wizard=1/);
  assert.match(source, /start_unlocks=1&return_to=matches/);
});

test('founder activation email does not send founders through the legacy welcome route', () => {
  assert.doesNotMatch(source, /\/activate\?startup_id=/);
  assert.doesNotMatch(source, /locked outreach preview/);
  assert.doesNotMatch(source, /Fix gap #1 first/);
});
