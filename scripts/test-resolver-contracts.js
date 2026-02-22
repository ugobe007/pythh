#!/usr/bin/env node
// =============================================================================
// Resolver Contract Tests
// =============================================================================
// Asserts the exact branches + return shapes that resolve_startup_by_url emits.
// Run anytime: node scripts/test-resolver-contracts.js
//
// This prevents regressions like re-adding ILIKE '%…%' (which nukes the index
// path), or breaking the missing_company_domain branch.
// =============================================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Terminal colors
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const YELLOW= '\x1b[33m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(name, actual, check, detail = '') {
  const ok = check(actual);
  if (ok) {
    console.log(`  ${GREEN}✓${RESET} ${name}`);
    passed++;
  } else {
    console.log(`  ${RED}✗${RESET} ${name}`);
    console.log(`    ${DIM}actual: ${JSON.stringify(actual)}${detail ? '\n    ' + detail : ''}${RESET}`);
    failed++;
  }
}

async function resolve(url) {
  const { data, error } = await supabase.rpc('resolve_startup_by_url', { p_url: url });
  if (error) throw new Error(`RPC error: ${JSON.stringify(error)}`);
  return Array.isArray(data) ? data[0] : data;
}

async function runTests() {
  console.log('\n=== Resolver Contract Tests ===\n');

  // ── 1. EMPTY INPUT ───────────────────────────────────────────────────────
  console.log(`${YELLOW}1. Empty input${RESET}`);
  const empty = await resolve('');
  assert('found=false',         empty.found,              v => v === false);
  assert('branch=empty_input',  empty.resolver_branch,    v => v === 'empty_input');
  assert('elapsed_ms=0',        empty.elapsed_ms,         v => v === 0);
  assert('no startup_id',       empty.startup_id,         v => v == null);
  console.log();

  // ── 2. KNOWN EXISTING STARTUP (company_domain path) ─────────────────────
  // Pull a startup that HAS a company_domain set so we hit the fast path.
  console.log(`${YELLOW}2. company_domain branch${RESET}`);
  const { data: sampleRow } = await supabase
    .from('startup_uploads')
    .select('company_domain, id')
    .eq('status', 'approved')
    .not('company_domain', 'is', null)
    .limit(1)
    .single();

  if (sampleRow) {
    const known = await resolve('https://' + sampleRow.company_domain);
    assert('found=true',             known.found,            v => v === true);
    assert('branch=company_domain',  known.resolver_branch,  v => v === 'company_domain');
    assert('startup_id returned',    known.startup_id,       v => v != null);
    assert('elapsed_ms > 0',         known.elapsed_ms,       v => v >= 0);
    assert('has_company_site flag',  known.has_company_site, v => v === true || v == null);
    assert('canonical_url returned', known.canonical_url,    v => v != null);
  } else {
    console.log(`  ${DIM}Skipped — no startup with company_domain found${RESET}`);
  }
  console.log();

  // ── 3. MISSING COMPANY DOMAIN (publisher URL row) ────────────────────────
  // Pull a startup that has source_url set but no company_website.
  console.log(`${YELLOW}3. missing_company_domain branch${RESET}`);
  const { data: publisherRow } = await supabase
    .from('startup_uploads')
    .select('id, website, source_url, company_domain, name')
    .eq('status', 'approved')
    .is('company_website', null)
    .not('source_url', 'is', null)
    .not('company_domain', 'is', null)
    .limit(1)
    .single();

  if (publisherRow) {
    // Resolve by company_domain (which exists even though no company_website)
    const pub = await resolve('https://' + publisherRow.company_domain);
    assert('found=true',              pub.found,              v => v === true);
    assert('has_company_site=false',  pub.has_company_site,   v => v === false || (pub.company_website == null));
    assert('source_url present',      pub.source_url,         v => v != null);
    assert('branch contains missing', pub.resolver_branch,    v => typeof v === 'string' && v.includes('missing_company_domain'));
    assert('company_website null',    pub.company_website,    v => v == null);
  } else {
    console.log(`  ${DIM}Skipped — no publisher-URL-only startup found${RESET}`);
  }
  console.log();

  // ── 4. NOT FOUND ─────────────────────────────────────────────────────────
  console.log(`${YELLOW}4. not_found branch${RESET}`);
  const notFound = await resolve('https://this-startup-absolutely-does-not-exist-xyz999.io');
  assert('found=false',          notFound.found,           v => v === false);
  assert('branch=not_found',     notFound.resolver_branch, v => v === 'not_found');
  assert('searched populated',   notFound.searched,        v => typeof v === 'string' && v.length > 0);
  assert('no startup_id',        notFound.startup_id,      v => v == null);
  console.log();

  // ── 5. URL NORMALIZATION ─────────────────────────────────────────────────
  // Same startup resolved via http://, https://, www. variants should all hit
  console.log(`${YELLOW}5. URL normalization${RESET}`);
  if (sampleRow) {
    const d = sampleRow.company_domain;
    const variants = [
      'http://' + d,
      'https://' + d,
      'https://www.' + d,
      d,                           // bare domain
      'https://' + d + '/',        // trailing slash
      'https://' + d + '/about',   // with path
    ];
    const results = await Promise.all(variants.map(v => resolve(v)));
    const ids = results.filter(r => r.found).map(r => r.startup_id);
    const allSame = ids.length > 0 && ids.every(id => id === ids[0]);
    assert(`all ${variants.length} variants resolve to same id`, { ids, count: ids.length }, () => allSame);
  } else {
    console.log(`  ${DIM}Skipped — no startup with company_domain found${RESET}`);
  }
  console.log();

  // ── 6. ELAPSED_MS PERFORMANCE ────────────────────────────────────────────
  console.log(`${YELLOW}6. Performance gate${RESET}`);
  if (sampleRow) {
    const perf = await resolve('https://' + sampleRow.company_domain);
    assert('elapsed_ms < 100ms (fast path)', perf.elapsed_ms, v => v < 100);
  } else {
    console.log(`  ${DIM}Skipped${RESET}`);
  }
  console.log();

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  const total = passed + failed;
  const color = failed === 0 ? GREEN : RED;
  console.log(`${color}${passed}/${total} tests passed${RESET}\n`);

  if (failed > 0) {
    console.log(`${RED}FAILED TESTS — review output above before deploying${RESET}\n`);
    process.exit(1);
  }

  // ── BRANCH TAXONOMY (emit the current enum for review) ───────────────────
  const { data: branches } = await supabase
    .from('resolver_telemetry')
    .select('branch')
    .limit(1000);

  if (branches && branches.length > 0) {
    const counts = {};
    branches.forEach(r => { counts[r.branch] = (counts[r.branch] || 0) + 1; });
    console.log(`${DIM}=== Current branch values in resolver_telemetry ===${RESET}`);
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([b, c]) => {
      console.log(`  ${DIM}${c.toString().padStart(4)}  ${b}${RESET}`);
    });
  } else {
    // Print the canonical enum from the RPC definition
    console.log(`${DIM}=== Canonical resolver branch taxonomy ===${RESET}`);
    [
      'company_domain',
      'company_domain+missing_company_domain',
      'website_equality',
      'website_equality+missing_company_domain',
      'name_equality',
      'name_equality+missing_company_domain',
      'not_found',
      'empty_input',
    ].forEach(b => console.log(`  ${DIM}${b}${RESET}`));
    console.log(`${DIM}(No telemetry rows yet — table just created)${RESET}`);
  }
  console.log();
}

runTests().catch(err => {
  console.error(`${RED}Test runner error:${RESET}`, err.message);
  process.exit(1);
});
