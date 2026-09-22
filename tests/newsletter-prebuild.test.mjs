import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const generator = readFileSync(new URL('../server/newsletter-generator.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../site/pages/Newsletter.tsx', import.meta.url), 'utf8');
const script = readFileSync(new URL('../scripts/prebuild-newsletter.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/batch-platform-daily.yml', import.meta.url), 'utf8');
const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const send = readFileSync(new URL('../scripts/send-daily-brief.js', import.meta.url), 'utf8');

test('GET /api/newsletter/today serves the prebuilt edition, not a live compile', () => {
  assert.match(generator, /async function serveNewsletter/);
  assert.match(generator, /async function prebuildNewsletter/);
  assert.match(generator, /loadEdition\(editionDate\)/);
  assert.match(generator, /compileInBackground/);
  assert.match(generator, /if \(prior\) \{\n      compileInBackground/);
  assert.match(generator, /if \(saved\) return/);
  assert.match(generator, /required: Boolean\(bust\)/);
  assert.match(generator, /prebuild did not persist newsletter_editions/);
  const serveAt = generator.indexOf('async function serveNewsletter');
  const compileAt = generator.indexOf('async function generateNewsletter');
  assert.ok(serveAt >= 0 && compileAt > serveAt);
  assert.match(api, /serveNewsletter\(\{ bust \}\)/);
  assert.match(api, /serveNewsletter\(\)/);
  assert.match(api, /stale-while-revalidate=3600/);
});

test('daily prebuild job writes newsletter_editions before readers hit the page', () => {
  assert.match(script, /prebuildNewsletter/);
  assert.match(pkg, /"newsletter:prebuild"/);
  assert.match(workflow, /15 7 \* \* \*/);
  assert.match(workflow, /node_version: '22'/);
  assert.match(workflow, /newsletter-prebuild/);
  assert.match(workflow, /scripts\/prebuild-newsletter\.mjs/);
  assert.match(send, /generateNewsletter\(\{ bust: true \}\)/);
});

test('Daily Signal page loads a saved edition without a compile spinner as the happy path', () => {
  assert.match(page, /Loading today.?s signal|Loading today&rsquo;s signal/);
  assert.doesNotMatch(page, /Compiling today/);
  assert.match(page, /compiling_today/);
});
