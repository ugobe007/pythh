import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../site/pages/Newsletter.tsx', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../site/components/SharedNavbar.tsx', import.meta.url), 'utf8');

test('newsletter page is Daily Signal, not the gold Daily Brief newspaper', () => {
  assert.match(nav, /Daily Signal/);
  assert.match(page, /Daily Signal/);
  assert.match(page, /Your first ranked matches arrive tomorrow morning/);
  assert.match(page, /PURPLE_WASH/);
  assert.match(page, /progressive/);
  assert.match(page, /revealMatches/);
  assert.match(page, /persistJoinPreview/);
  assert.match(page, /Who just got funded/);
  assert.match(page, /isPublicFundingMove/);
  assert.match(page, /\/api\/newsletter\/\$\{date\}/);
  assert.doesNotMatch(page, /The Daily Brief/);
  assert.doesNotMatch(page, /PYTHIA.?s Take/);
  assert.doesNotMatch(page, /Partner, Seed Fund/);
  assert.doesNotMatch(page, /Georgia, serif/);
  assert.doesNotMatch(page, /Run PYTHIA on your startup/);
  assert.doesNotMatch(page, /SectionLabel color=\{GOLD\}/);
});
