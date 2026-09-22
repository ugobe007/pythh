import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../site/pages/Newsletter.tsx', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../site/components/SharedNavbar.tsx', import.meta.url), 'utf8');

test('newsletter page is Daily Signal, not the gold Daily Brief newspaper', () => {
  assert.match(nav, /Daily Signal/);
  assert.match(page, /Daily Signal/);
  assert.match(page, /Get the daily brief/);
  assert.match(page, /NEWSLETTER_JOIN_CTA/);
  assert.match(page, /PURPLE_WASH/);
  assert.match(page, /Who just got funded/);
  assert.match(page, /isPublicFundingMove/);
  assert.match(page, /\/api\/newsletter\/\$\{date\}/);
  assert.match(page, /hidePrimaryCta/);
  assert.match(nav, /hidePrimaryCta/);
  assert.doesNotMatch(page, /The Daily Brief/);
  assert.doesNotMatch(page, /PYTHIA.?s Take/);
  assert.doesNotMatch(page, /Partner, Seed Fund/);
  assert.doesNotMatch(page, /Georgia, serif/);
  assert.doesNotMatch(page, /Run PYTHIA on your startup/);
  assert.doesNotMatch(page, /SectionLabel color=\{GOLD\}/);
  assert.doesNotMatch(page, /Your first ranked matches arrive tomorrow morning/);
  assert.doesNotMatch(page, /PREVIEW_MATCHES_CTA/);
  assert.doesNotMatch(page, /revealMatches/);
  assert.doesNotMatch(page, /persistJoinPreview/);
  assert.doesNotMatch(page, /See your matches/);
});
