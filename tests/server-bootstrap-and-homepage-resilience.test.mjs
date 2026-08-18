import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('cold-start-heavy dependencies are loaded only by the routes that use them', () => {
  const outreach = read('../server/routes/outreachDraft.js');
  const pdfText = read('../server/lib/pdfTextExtractor.js');
  const artExport = read('../server/lib/signalArtExport.js');
  const discovery = read('../server/routes/discoverySubmit.js');

  assert.ok(outreach.indexOf("require('resend')") > outreach.indexOf('function resend()'));
  assert.ok(pdfText.indexOf("require('pdf-parse')") > pdfText.indexOf('async function extractPdfText'));
  assert.ok(artExport.indexOf("require('pdfkit')") > artExport.indexOf('async function buildArtEditionPdf'));
  assert.match(discovery, /function getDiscoveryScrapingTools/);
  assert.ok(discovery.indexOf('require("../services/urlScrapingService.ts")') > discovery.indexOf('function getDiscoveryScrapingTools'));
});

test('full app smoke suite owns server startup and waits for real readiness', () => {
  const smoke = read('../scripts/test-full-app-smoke.mjs');
  const pkg = JSON.parse(read('../package.json'));
  assert.equal(pkg.scripts.test, 'node scripts/test-full-app-smoke.mjs');
  assert.match(smoke, /spawn\(process\.execPath, \['server\/index\.js'\]/);
  assert.match(smoke, /waitFor\('\/ping'/);
  assert.match(smoke, /waitFor\('\/api\/instant\/health'/);
  assert.match(smoke, /server\.kill\('SIGTERM'\)/);
});

test('homepage reveal animations fail open instead of leaving blank sections', () => {
  const home = read('../site/Home.tsx');
  assert.match(home, /typeof IntersectionObserver === "undefined"/);
  assert.match(home, /const failOpen = window\.setTimeout\(\(\) => setIsVisible\(true\), 800\)/);
  assert.match(home, /window\.clearTimeout\(failOpen\)/);
});
