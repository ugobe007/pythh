import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../site/pages/FundingRecord.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/App.tsx', import.meta.url), 'utf8');

test('funding record page publishes the top-50 pair count', () => {
  assert.match(page, /const TOP_50 = 19/);
  assert.match(page, /const TOP_5 = 12/);
  assert.match(page, /const STARTUPS = 45/);
  assert.match(page, /September 30, 2026/);
  assert.match(page, /https:\/\/pythh\.ai\/record/);
  assert.match(app, /path=\{"\/record"\}/);
  assert.doesNotMatch(page, /Jane Smith/);
  assert.match(page, /Peter Thiel is verified on the same round at rank 99/);
  const named = page.match(/startup: "/g) || [];
  assert.equal(named.length, 18);
});
