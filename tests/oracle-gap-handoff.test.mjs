import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('new users see matches before signup and stay on matches after', async () => {
  const preview = await read('site/components/InstantMatchPreview.tsx');
  assert.match(preview, /keep these \$\{visible\.length\} matches on your profile/);
  assert.match(preview, /Next — save these matches/);
  assert.match(preview, /Review your account/);
  assert.match(preview, /href=\{savedMatchesPath\(\)\}/);
  assert.match(preview, /Improve my matches/);
  assert.match(preview, /skipImprove/);
  assert.match(preview, /handleSignup\('save'\)/);
  assert.match(preview, /ANON_IMPROVE_LIMIT/);
  assert.doesNotMatch(preview, /href=["']\/newsletter["']/);
  assert.doesNotMatch(preview, /Get daily matches/);
  assert.doesNotMatch(preview, /Get my daily matches/);
  assert.doesNotMatch(preview, /Your fundraising workflow/);
  assert.doesNotMatch(preview, /Start investor outreach/);
  assert.doesNotMatch(preview, /Prepare outreach for my top/);
  assert.match(preview, /apiUrl\('\/api\/instant\/submit'\)/);
  assert.match(preview, /apiUrl\(`\/api\/preview\/\$\{startupId\}/);

  const home = await read('site/Home.tsx');
  assert.match(home, /NewsletterJoinForm/);
  assert.match(home, /HomeLiveTape/);
  assert.doesNotMatch(home, /signup\/founder\?intent=matches/);

  const matchesPage = await read('site/pages/Matches.tsx');
  assert.doesNotMatch(matchesPage, /signup\/founder\?intent=matches/);
  assert.match(matchesPage, /InstantMatchPreview/);

  const gate = await read('site/lib/founderSignupGate.ts');
  assert.match(gate, /\/matches\?url=/);
  assert.doesNotMatch(gate, /force_wizard=1&tab=round/);
  assert.doesNotMatch(gate, /sessionStorage\.removeItem\('pythia_startup_id'\)/);
});
