#!/usr/bin/env node
/**
 * Pythh Performance & Accuracy Audit
 * 
 * Measures:
 *  - Resolution latency (URL → startup_id, including which DB tier was hit)
 *  - Match rendering time (investor matching phase)
 *  - End-to-end response time
 *  - Accuracy: correct company name, website, sector, god_score
 * 
 * Usage:
 *   node scripts/pythh-perf-audit.js
 *   PYTHH_API_BASE=http://localhost:3002 node scripts/pythh-perf-audit.js
 */

const BASE = process.env.PYTHH_API_BASE || 'http://127.0.0.1:3002';
const RUNS = Number(process.env.AUDIT_RUNS || 1); // set to 3 for warm avg

// Ground-truth for accuracy checks
const TEST_CASES = [
  {
    url:            'https://stripe.com',
    expectName:     /stripe/i,
    expectWebsite:  /stripe\.com/,
    expectSectors:  ['Fintech', 'Payments', 'SaaS'],
    minGodScore:    55,
    minMatches:     10,
  },
  {
    url:            'https://notion.so',
    expectName:     /notion/i,
    expectWebsite:  /notion\.(so|com)/,
    expectSectors:  ['Productivity', 'SaaS', 'Collaboration'],
    minGodScore:    50,
    minMatches:     5,
  },
  {
    url:            'https://openai.com',
    expectName:     /openai/i,
    expectWebsite:  /openai\.com/,
    expectSectors:  ['AI', 'ML', 'Technology'],
    minGodScore:    55,
    minMatches:     5,
  },
  {
    url:            'https://linear.app',
    expectName:     /linear/i,
    expectWebsite:  /linear\.(app|com)/,
    expectSectors:  ['SaaS', 'Developer', 'Productivity'],
    minGodScore:    40,
    minMatches:     5,
  },
  {
    url:            'https://anthropic.com',
    expectName:     /anthropic/i,
    expectWebsite:  /anthropic\.com/,
    expectSectors:  ['AI', 'ML', 'Technology'],
    minGodScore:    50,
    minMatches:     5,
  },
  {
    url:            'https://vercel.com',
    expectName:     /vercel/i,
    expectWebsite:  /vercel\.com/,
    expectSectors:  ['Developer', 'Cloud', 'Infrastructure'],
    minGodScore:    40,
    minMatches:     5,
  },
];

function pass(msg) { return `\x1b[32m✅ ${msg}\x1b[0m`; }
function fail(msg) { return `\x1b[31m❌ ${msg}\x1b[0m`; }
function warn(msg) { return `\x1b[33m⚠️  ${msg}\x1b[0m`; }
function dim(msg)  { return `\x1b[2m${msg}\x1b[0m`; }

async function submitAndTime(url) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/instant/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(120_000),
  });
  const elapsed = Date.now() - t0;
  const body = await res.json();
  return { elapsed, status: res.status, body };
}

function checkAccuracy(tc, body) {
  const issues = [];
  const ok = [];

  const startup = body.startup || {};
  const name    = startup.name || body.name || '';
  const website = startup.website || body.website || '';
  const sectors = startup.sectors || body.sectors || [];
  const god     = startup.total_god_score ?? body.total_god_score ?? 0;
  const matches = body.match_count ?? (body.matches || []).length ?? 0;

  // Name
  if (tc.expectName.test(name)) ok.push(`name "${name}"`);
  else issues.push(`name "${name}" (expected /${tc.expectName.source}/)`);

  // Website
  if (tc.expectWebsite.test(website)) ok.push(`website "${website}"`);
  else issues.push(`website "${website}" (expected /${tc.expectWebsite.source}/)`);

  // Sectors (at least one must match)
  const sectorStr = JSON.stringify(sectors).toLowerCase();
  const sectorHit = tc.expectSectors.some(s => sectorStr.includes(s.toLowerCase()));
  if (sectorHit) ok.push(`sectors ${JSON.stringify(sectors).substring(0, 60)}`);
  else issues.push(`sectors ${JSON.stringify(sectors)} (expected one of ${tc.expectSectors.join(', ')})`);

  // GOD score
  if (god >= tc.minGodScore) ok.push(`god_score ${god}`);
  else issues.push(`god_score ${god} (expected >= ${tc.minGodScore})`);

  // Matches
  if (matches >= tc.minMatches) ok.push(`match_count ${matches}`);
  else issues.push(`match_count ${matches} (expected >= ${tc.minMatches})`);

  return { ok, issues };
}

async function runAudit() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         PYTHH PERFORMANCE & ACCURACY AUDIT                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check build
  try {
    const r = await fetch(`${BASE}/api/discovery/__submit_build`, { signal: AbortSignal.timeout(5000) });
    const b = await r.json();
    console.log(`  Server: ${b.build}  pid=${b.pid}\n`);
  } catch {
    console.log(fail('Server not reachable at ' + BASE));
    process.exit(1);
  }

  const results = [];
  let totalPass = 0, totalFail = 0;

  for (const tc of TEST_CASES) {
    const times = [];
    let lastBody = null;

    for (let r = 0; r < RUNS; r++) {
      const { elapsed, status, body } = await submitAndTime(tc.url);
      times.push(elapsed);
      lastBody = body;
      if (status !== 200) {
        console.log(fail(`${tc.url} → HTTP ${status}: ${JSON.stringify(body).substring(0, 100)}`));
        break;
      }
    }

    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const serverMs = lastBody?.processing_time_ms ?? null;
    const cached = lastBody?.cached ?? null;
    const isNew = lastBody?.is_new ?? null;

    // Timing breakdown from server field if available
    const timingStr = serverMs != null
      ? `total ${avg}ms (server reported ${serverMs}ms)`
      : `total ${avg}ms`;

    const speedLabel = avg < 1000 ? pass(`${avg}ms`) :
                       avg < 3000 ? warn(`${avg}ms`) :
                       fail(`${avg}ms`);

    const { ok, issues } = checkAccuracy(tc, lastBody || {});
    const accurate = issues.length === 0;
    if (accurate) totalPass++; else totalFail++;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${tc.url}`);
    console.log(`  Speed   : ${speedLabel}  cached=${cached}  is_new=${isNew}`);
    console.log(`  Accuracy: ${accurate ? pass('PASS') : fail('FAIL')}`);

    for (const o of ok) console.log(dim(`    ✓ ${o}`));
    for (const i of issues) console.log(`    ${fail(i)}`);

    results.push({ url: tc.url, avg, accurate, issues });
    console.log('');
  }

  // Summary
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const times = results.map(r => r.avg);
  const p50   = times.slice().sort((a,b)=>a-b)[Math.floor(times.length * 0.5)];
  const p95   = times.slice().sort((a,b)=>a-b)[Math.min(times.length-1, Math.floor(times.length * 0.95))];
  const max   = Math.max(...times);

  console.log(`  Latency  p50=${p50}ms  p95=${p95}ms  max=${max}ms`);
  console.log(`  Accuracy ${totalPass}/${TEST_CASES.length} pass`);
  console.log('');

  const failing = results.filter(r => !r.accurate);
  if (failing.length > 0) {
    console.log('  Accuracy failures:');
    for (const f of failing) {
      console.log(`    ${f.url}`);
      for (const i of f.issues) console.log(`      → ${i}`);
    }
    console.log('');
  }

  const slow = results.filter(r => r.avg > 3000);
  if (slow.length > 0) {
    console.log('  Slow resolvers (>3s):');
    for (const s of slow) console.log(`    ${s.url}  ${s.avg}ms`);
    console.log('');
  }

  if (totalFail === 0 && slow.length === 0) {
    console.log(pass('All checks pass. Service healthy.\n'));
  }
}

runAudit().catch(e => { console.error(e); process.exit(1); });
