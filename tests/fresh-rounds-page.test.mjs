import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../site/pages/FreshRounds.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../site/App.tsx', import.meta.url), 'utf8');

test('fresh rounds sheet is the verified pre-seed ledger', () => {
  assert.match(page, /FRESH ROUNDS/);
  assert.match(page, /Pre-Seed/);
  assert.match(page, /WEDNESDAY \/\/ SEP 30, 2026/);
  assert.match(page, /10 verified pre-seed raises/);
  assert.match(page, /New rounds\. Every Mon \/ Wed \/ Fri\./);
  assert.match(page, /https:\/\/pythh\.ai\/rounds/);
  assert.match(app, /path=\{"\/rounds"\}/);
  for (const name of ['Aranya', 'DataAgent', 'Bluecore Energy', 'Ki 13', 'Cast Insights', 'Coverwatch', 'Vikk AI', 'Tonada', 'Ossprey', 'Sherpa']) {
    assert.match(page, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(page, /Asylum Ventures/);
  assert.match(page, /\$11M/);
  assert.match(page, /\$2\.2M/);
  assert.equal((page.match(/investor: "Undisclosed"/g) || []).length, 3);
  assert.doesNotMatch(page, /Prime Minute/);
  assert.doesNotMatch(page, /United States/);
  assert.doesNotMatch(page, /hot US/);
});
