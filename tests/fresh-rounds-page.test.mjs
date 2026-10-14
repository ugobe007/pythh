import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../site/pages/FreshRounds.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/App.tsx', import.meta.url), 'utf8');

test('fresh rounds sheet loads a daily live edition from /api/rounds', () => {
  assert.match(page, /FRESH ROUNDS|edition\.masthead/);
  assert.match(page, /Pre-Seed|edition\.title/);
  assert.match(page, /\/api\/rounds/);
  assert.match(page, /\/api\/rounds\/pdf/);
  assert.match(page, /Download PDF/);
  assert.match(page, /https:\/\/pythh\.ai\/rounds/);
  assert.match(app, /path=\{"\/rounds"\}/);
  // Must not hardcode a stuck calendar edition in the page component
  assert.doesNotMatch(page, /WEDNESDAY \/\/ SEP 30, 2026/);
  assert.doesNotMatch(page, /Aranya/);
  assert.doesNotMatch(page, /Prime Minute/);
});
