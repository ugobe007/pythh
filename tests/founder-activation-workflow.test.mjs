import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../server/lib/founderActivationEmail.js', import.meta.url),
  'utf8',
);

test('founder activation email sends one hop to the account profile', () => {
  assert.match(source, /Review your account/);
  assert.match(source, /\/account\?saved=1/);
  assert.match(source, /Upgrade to Oracle/);
  assert.doesNotMatch(source, /Open outreach drafts/);
  assert.doesNotMatch(source, /Optional Oracle improvements/);
  assert.doesNotMatch(source, /\/matches\?url=/);
});

test('founder activation email does not send founders through the legacy welcome route', () => {
  assert.doesNotMatch(source, /\/activate\?startup_id=/);
  assert.doesNotMatch(source, /locked outreach preview/);
  assert.doesNotMatch(source, /Fix gap #1 first/);
});
