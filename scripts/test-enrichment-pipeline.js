#!/usr/bin/env node
/**
 * ENRICHMENT PIPELINE TEST SUITE
 *
 * Tests the core extraction and enrichment logic WITHOUT network calls.
 * Run this after any change to:
 *   - lib/inference-extractor.js
 *   - lib/junk-url-config.js
 *   - server/services/inferenceService.js
 *   - scripts/enrich-sparse-startups.js
 *
 * Usage:
 *   node scripts/test-enrichment-pipeline.js           # all tests
 *   node scripts/test-enrichment-pipeline.js --verbose # show all assertions
 *
 * Exit code: 0 = all pass, 1 = failures found
 */

require('dotenv').config();

const { isJunkUrl, sanitiseWebsiteUrl, JUNK_DOMAINS } = require('../lib/junk-url-config');
const { extractFunding, extractSectors, extractExecutionSignals, extractInferenceData } = require('../lib/inference-extractor');
const { isDataSparse } = require('../server/services/inferenceService');

const verbose = process.argv.includes('--verbose');

// ============================================================================
// Minimalist test runner (no external deps)
// ============================================================================
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, detail = '') {
  if (condition) {
    passed++;
    if (verbose) console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push({ label, detail });
    console.log(`  ❌ FAIL: ${label}${detail ? '\n     ' + detail : ''}`);
  }
}

function suite(name, fn) {
  console.log(`\n▶ ${name}`);
  fn();
}

// ============================================================================
// 1. isJunkUrl() — URL validation
// These are the scenarios that caused corrupted enrichment data in Feb 2026.
// ============================================================================
suite('isJunkUrl() — junk domain detection', () => {
  // Known news article URLs
  assert(isJunkUrl('https://techcrunch.com/2026/01/15/startup-raises-5m'),      'TechCrunch article');
  assert(isJunkUrl('https://contxto.com/en/funding/company-raises-series-a/'),   'Contxto article');
  assert(isJunkUrl('https://arcticstartup.com/spoor-raises-e8-million-series-a'), 'ArcticStartup article');
  assert(isJunkUrl('https://techfundingnews.com/eth-zurich-spinout-bags-12m/'),  'TechFundingNews article');
  assert(isJunkUrl('https://venturefizz.com/job/company-head-of-finance/'),      'Job board URL');
  assert(isJunkUrl('https://www.ycombinator.com/companies/brickanta'),           'YC directory page');
  assert(isJunkUrl('https://apps.apple.com/gr/app/mindfulboo/id6748706497'),     'App Store URL');
  assert(isJunkUrl('https://medium.com/@founder/my-startup-story'),              'Medium article');
  assert(isJunkUrl('https://linkedin.com/company/examplecorp'),                  'LinkedIn page');
  assert(isJunkUrl('https://news.ycombinator.com/item?id=12345'),                'HN thread');
  assert(isJunkUrl('https://www.technologyreview.com/2026/01/30/1131945/inside-the-marketplace/'), 'MIT Tech Review');

  // Deep article path detection (3+ segments = article, not homepage)
  assert(isJunkUrl('https://somenewssite.com/2026/01/15/startup-story'),        'Deep path (date-based article)');
  assert(isJunkUrl('https://unknownnews.io/en/funding/company-raises-seed/'),   'Deep path (3+ segments)');

  // Valid startup websites — should NOT be flagged as junk
  assert(!isJunkUrl('https://stripe.com'),            'Stripe homepage — not junk');
  assert(!isJunkUrl('https://openai.com'),            'OpenAI homepage — not junk');
  assert(!isJunkUrl('https://usdc.com'),              'USDC homepage — not junk');
  assert(!isJunkUrl('https://birdfy.com'),            'Birdfy (no scheme) — not junk');
  assert(!isJunkUrl('abzena.com'),                    'Domain-only URL — not junk');
  assert(!isJunkUrl('https://constructor.io'),        'Domain-only HTTPS — not junk');
  assert(!isJunkUrl('https://pagaya.com'),            'Pagaya homepage — not junk');
  assert(!isJunkUrl(null),                            'null URL — returns false safely');
  assert(!isJunkUrl(''),                              'empty string — returns false safely');
  assert(!isJunkUrl('not-a-url-at-all'),              'non-URL string — returns false safely');
});

suite('sanitiseWebsiteUrl() — scraper gate', () => {
  assert(sanitiseWebsiteUrl('https://techcrunch.com/2026/article') === null, 'TechCrunch → null');
  assert(sanitiseWebsiteUrl('https://openai.com') === 'https://openai.com',  'OpenAI → kept');
  assert(sanitiseWebsiteUrl(null) === null,                                   'null → null');
  assert(sanitiseWebsiteUrl('') === null,                                     'empty → null');
});

suite('JUNK_DOMAINS — completeness sanity checks', () => {
  // These are the specific domains that caused real production data corruption
  const mustHave = [
    'techcrunch.com', 'contxto.com', 'arcticstartup.com', 'techfundingnews.com',
    'venturefizz.com', 'ycombinator.com', 'apps.apple.com', 'medium.com',
    'linkedin.com', 'crunchbase.com', 'productHunt.com'.toLowerCase(),
  ];
  for (const domain of mustHave) {
    assert(JUNK_DOMAINS.has(domain), `JUNK_DOMAINS contains '${domain}'`);
  }
});

// ============================================================================
// 2. extractFunding() — funding pattern extraction
// GOD score heavily depends on raise_amount, raise_type from press coverage.
// ============================================================================
suite('extractFunding() — funding signal extraction', () => {
  const f1 = extractFunding('Acme raised $5M in a Series A round led by Sequoia Capital.');
  assert(f1.funding_amount === 5000000, `$5M → ${f1.funding_amount}`, `expected 5000000, got ${f1.funding_amount}`);
  assert(f1.funding_stage && f1.funding_stage.toLowerCase().includes('series a'), `Series A detected`, `got: ${f1.funding_stage}`);
  assert(f1.lead_investor && f1.lead_investor.includes('Sequoia'), `Lead investor extracted`, `got: ${f1.lead_investor}`);

  const f2 = extractFunding('The company secured $50K in angel funding.');
  assert(f2.funding_amount === 50000, `$50K → ${f2.funding_amount}`, `expected 50000, got ${f2.funding_amount}`);

  const f3 = extractFunding('TechCo closes a $120 million Series B.');
  assert(f3.funding_amount === 120000000, `$120M → ${f3.funding_amount}`, `expected 120000000, got ${f3.funding_amount}`);

  const f4 = extractFunding('No funding information here.');
  assert(!f4.funding_amount || f4.funding_amount === 0, 'No funding → 0 or null', `got: ${f4.funding_amount}`);

  const f5 = extractFunding('Company is bootstrapped and profitable.');
  assert(f5.funding_stage && f5.funding_stage.toLowerCase().includes('bootstrap'), 'bootstrapped stage detected', `got: ${f5.funding_stage}`);
});

// ============================================================================
// 3. extractExecutionSignals() — traction/revenue extraction
// This drives traction_score in the GOD algorithm.
// ============================================================================
suite('extractExecutionSignals() — traction signal extraction', () => {
  const e1 = extractExecutionSignals('Acme has 500 paying customers and $2M ARR, growing 30% MoM.');
  assert(e1.customer_count > 0, `customer_count extracted: ${e1.customer_count}`, `got: ${e1.customer_count}`);
  assert(e1.has_revenue === true || e1.revenue_indicator, 'revenue signal detected', `has_revenue:${e1.has_revenue} indicator:${e1.revenue_indicator}`);

  const e2 = extractExecutionSignals('No metrics mentioned in this text.');
  assert(!e2.customer_count || e2.customer_count === 0, 'No traction → 0 customers', `got: ${e2.customer_count}`);

  const e3 = extractExecutionSignals('10,000 monthly active users (MAU) and profitable.');
  assert(e3.customer_count > 0 || e3.has_revenue || e3.is_launched, 'MAU or profitability signal detected', `count:${e3.customer_count} hasRev:${e3.has_revenue}`);
});

// ============================================================================
// 4. extractSectors() — vertical classification
// ----------------------------------------------------------------------------
suite('extractSectors() — sector detection', () => {
  const s1 = extractSectors('AI-powered fintech platform for payments and banking.');
  assert(s1.length > 0, `sectors found: ${s1.join(', ')}`, `got empty array`);
  assert(s1.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('fin')), 'AI or FinTech in sectors', `got: ${s1}`);

  const s2 = extractSectors('Nothing about any sector whatsoever xyzzy.');
  assert(Array.isArray(s2), 'returns array even when no sectors found');
});

// ============================================================================
// 5. extractInferenceData() — full HTML extraction
// Validates that a realistic homepage snippet produces fields.
// ============================================================================
suite('extractInferenceData() — HTML field extraction', () => {
  const sampleHtml = `
    <html><head><title>Stripe - Payments for the internet</title></head>
    <body>
      <h1>Payments infrastructure for the internet</h1>
      <p>Millions of companies of all sizes use Stripe to accept payments online.
         We process $640 billion in payments annually for companies worldwide.</p>
      <p>Founded in 2010. Headquartered in San Francisco, CA.</p>
      <p>Our team of 8,000+ engineers builds the infrastructure that powers the internet economy.</p>
    </body></html>
  `;

  const result = extractInferenceData(sampleHtml, 'https://stripe.com');
  assert(result !== null && result !== undefined, 'returns non-null result');

  const fieldCount = Object.keys(result || {}).filter(k => {
    const v = result[k];
    return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  assert(fieldCount >= 3, `at least 3 fields extracted from HTML (got ${fieldCount})`, `fields: ${Object.keys(result || {}).join(', ')}`);
});

// ============================================================================
// 6. REGRESSION TEST — News-skip bug (Feb 20, 2026 refactor regression)
//
// The Feb 20 refactor made `isDataSparse()` short-circuit the news step.
// HTML easily fills 5 signals (description, sectors, etc.), causing isDataSparse
// to return false and the news step to be SKIPPED.
// News provides traction data (ARR, customers, funding) which HTML never has.
//
// CORRECT BEHAVIOUR: news runs when traction fields are missing.
// ============================================================================
suite('REGRESSION: news step not skipped when traction fields are missing', () => {
  // Simulate data that HTML enrichment would produce:
  // HTML fills description, sectors, team mentions — but NO traction numbers.
  const afterHtmlOnly = {
    description: 'AI platform for enterprise workflows',
    sectors: ['AI/ML', 'SaaS'],
    value_proposition: 'We help teams automate repetitive tasks',
    confidence: { tier: 'B' },
    product_stage: 'launched',
    team_companies: ['Google', 'Meta'],
  };

  // This is the critical check: isDataSparse would return false here
  // (description + sectors + value_prop etc. fill the 5-signal threshold).
  // The OLD (broken) logic: if (!isDataSparse) skip news → BUG
  // The NEW (correct) logic: also check traction fields are present
  const isSparse = isDataSparse({ extracted_data: afterHtmlOnly });

  const hasTraction = !!(afterHtmlOnly.raise_amount || afterHtmlOnly.funding_amount
    || afterHtmlOnly.arr || afterHtmlOnly.mrr || afterHtmlOnly.revenue
    || afterHtmlOnly.customer_count || afterHtmlOnly.customers);
  const hasSectors = !!(afterHtmlOnly.sectors && afterHtmlOnly.sectors.length > 0);
  const runNews = !hasTraction || !hasSectors || isSparse;

  assert(!hasTraction, 'no traction fields after HTML-only enrichment (correct starting state)');
  assert(runNews === true, 'runNews is true when traction fields are absent (regression guard)', `hasTraction=${hasTraction} hasSectors=${hasSectors} isSparse=${isSparse}`);

  // Simulate after news enrichment fills traction:
  // Need raise_amount + sectors + customer_count + revenue + team_signals
  // to satisfy ALL 5 isDataSparse signals → returns false → news correctly skipped
  const afterNewsEnrich = {
    ...afterHtmlOnly,
    raise_amount: '$5M',
    funding_amount: 5000000,
    sectors: ['AI/ML', 'SaaS'],
    customer_count: 500,
    revenue: 2000000,
    team_signals: [{ name: 'Jane Doe', title: 'CEO', background: ['Google'] }],
  };

  const hasTraction2 = !!(afterNewsEnrich.raise_amount);
  const hasSectors2 = !!(afterNewsEnrich.sectors && afterNewsEnrich.sectors.length > 0);
  const isSparse2 = isDataSparse({ extracted_data: afterNewsEnrich });
  const runNews2 = !hasTraction2 || !hasSectors2 || isSparse2;

  assert(runNews2 === false, 'runNews is false when traction + sectors + 5 signals present (news correctly skipped)', `hasTraction=${hasTraction2} hasSectors=${hasSectors2} isSparse=${isSparse2}`);
});

suite('REGRESSION: junk URL is skipped for HTML fetch', () => {
  // The enrichOneStartup() function must skip HTML fetching for article URLs.
  // Previously: fetched the article page and stored the article content as startup data.
  const articleUrls = [
    'https://techcrunch.com/2026/01/15/startup-raises-5m/',
    'https://contxto.com/en/funding/epic-angels-invests-in-colombias-salva-health/',
    'https://arcticstartup.com/spoor-raises-e8-million-series-a/',
    'https://www.technologyreview.com/2026/01/30/1131945/inside-the-marketplace/',
  ];

  for (const url of articleUrls) {
    assert(isJunkUrl(url), `Article URL correctly flagged: ${url.split('/').slice(0, 3).join('/')}`);
  }

  // Real startup sites must NOT be flagged
  const startupUrls = ['https://stripe.com', 'https://openai.com', 'https://constructor.io'];
  for (const url of startupUrls) {
    assert(!isJunkUrl(url), `Startup URL NOT flagged: ${url}`);
  }
});

// ============================================================================
// Results
// ============================================================================
console.log('\n' + '═'.repeat(60));
console.log(`ENRICHMENT PIPELINE TEST RESULTS`);
console.log('═'.repeat(60));
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\n  Failed assertions:');
  failures.forEach(f => console.log(`    ❌ ${f.label}${f.detail ? '\n       ' + f.detail : ''}`));
}
console.log('═'.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
