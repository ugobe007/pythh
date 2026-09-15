import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync(new URL('../site/lib/heroHeadlineExperiment.ts', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');

assert.match(
  hero,
  /Paste your startup URL below\. We score the company and rank investors for this round/,
);
assert.match(hero, /Meet Your Investors\. We connect the dots to fund your round/);
assert.doesNotMatch(hero, /You build the company/);
assert.doesNotMatch(hero, /Oracle qualifies investors/);
assert.doesNotMatch(hero, /investors that "get it"/);

assert.match(
  indexHtml,
  /Paste your startup URL below\. We score the company and rank investors for this round/,
);
assert.doesNotMatch(indexHtml, /Oracle qualifies investors/);
assert.doesNotMatch(indexHtml, /maximum-scale/);

console.log('hero-pythh-identity.test.mjs: ok');
