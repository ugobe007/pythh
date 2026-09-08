import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../site/lib/heroHeadlineExperiment.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');

assert.match(
  hero,
  /Paste your URL — Pythh finds investors who will fund your startup/,
);
assert.match(hero, /investors that "get it"/);
assert.doesNotMatch(hero, /You build the company/);
assert.doesNotMatch(hero, /Oracle qualifies investors/);

assert.match(
  indexHtml,
  /Paste your URL — Pythh finds investors who will fund your startup/,
);
assert.doesNotMatch(indexHtml, /Oracle qualifies investors/);

console.log('hero-pythh-identity.test.mjs: ok');
