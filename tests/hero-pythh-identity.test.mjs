import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../site/lib/heroHeadlineExperiment.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');

assert.match(
  hero,
  /Paste your startup URL\. We read the company and build the raise: strategy, deck, and the note that gets the meeting/,
);
assert.match(hero, /Automate Your Raise\. We find investors who will fund you/);
assert.doesNotMatch(hero, /You build the company/);
assert.doesNotMatch(hero, /Oracle qualifies investors/);
assert.doesNotMatch(hero, /investors that "get it"/);

assert.match(
  indexHtml,
  /Paste your startup URL\. We read the company and build the raise: strategy, deck, and the note that gets the meeting/,
);
assert.doesNotMatch(indexHtml, /Oracle qualifies investors/);
assert.doesNotMatch(indexHtml, /maximum-scale/);

console.log('hero-pythh-identity.test.mjs: ok');
