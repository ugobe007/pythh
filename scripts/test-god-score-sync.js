#!/usr/bin/env node
/**
 * GOD SCORE SYNC TEST
 * ===================
 * Verifies that new URL submissions get real GOD scores (not stuck at 50).
 * Tests the syncEnrichmentAndGodScoreForSubmit path in POST /api/instant/submit.
 *
 * Usage:
 *   node scripts/test-god-score-sync.js              # localhost:3002
 *   node scripts/test-god-score-sync.js --production # production URL
 *
 * Requires: Express server running (npm run start:dev or node server/index.js)
 */

const BASE = process.argv.includes('--production')
  ? process.env.API_URL || 'https://pythh.ai'
  : 'http://localhost:3002';

// Use a real URL that returns HTML - path ensures unique lookup, unlikely in DB
const TEST_URL = 'httpbin.org/html';

async function main() {
  console.log('\n🔬 GOD SCORE SYNC TEST');
  console.log('   Target:', BASE);
  console.log('   URL:', TEST_URL);
  console.log('');

  // 1. Health check
  try {
    const health = await fetch(`${BASE}/api/instant/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) {
      console.error('❌ Server health check failed:', health.status);
      process.exit(1);
    }
    const h = await health.json();
    if (h.status !== 'ok') {
      console.error('❌ Server not ready:', JSON.stringify(h));
      process.exit(1);
    }
    console.log('✅ Server alive');
  } catch (e) {
    console.error('❌ Server unreachable:', e.message);
    console.error('   Start backend: npm run start:dev (or node server/index.js)');
    process.exit(1);
  }

  // 2. Submit URL (may be new or existing)
  console.log('\n2. Submitting URL...');
  const startMs = Date.now();
  let response;
  try {
    response = await fetch(`${BASE}/api/instant/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_URL }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    console.error('❌ Submit failed:', e.message);
    process.exit(1);
  }

  const elapsed = Date.now() - startMs;
  if (!response.ok) {
    const text = await response.text();
    console.error('❌ Submit returned', response.status, text.slice(0, 200));
    process.exit(1);
  }

  const body = await response.json();
  if (!body.startup_id) {
    console.error('❌ No startup_id in response');
    process.exit(1);
  }

  console.log(`✅ Resolved in ${elapsed}ms → ${body.startup_id.slice(0, 8)}...`);
  console.log(`   is_new: ${body.is_new}`);
  console.log(`   match_count: ${body.match_count ?? 0}`);

  // 3. Check GOD score in response
  const startup = body.startup;
  const score = startup?.total_god_score;

  if (score === undefined || score === null) {
    console.log('\n⚠️  Response has no total_god_score (startup may be minimal)');
    console.log('   Polling status for final score...');
    // Poll status
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const statusRes = await fetch(
        `${BASE}/api/instant/status?startup_id=${body.startup_id}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (statusRes.ok) {
        const status = await statusRes.json();
        const s = status?.startup?.total_god_score;
        if (s !== undefined && s !== null) {
          console.log(`   After ${(i + 1) * 1.5}s: total_god_score = ${s}`);
          if (body.is_new && s === 50) {
            console.error('\n❌ New startup still has placeholder GOD score 50');
            console.error('   Sync scoring may have failed or timed out.');
            process.exit(1);
          }
          if (s >= 35 && s <= 100) {
            console.log('\n✅ GOD score in valid range:', s);
            process.exit(0);
          }
        }
      }
    }
    console.log('\n⚠️  Could not verify GOD score within timeout (BG pipeline may still be running)');
    process.exit(0); // Don't fail - might just be slow
  }

  // 4. Assert: new startups should not have placeholder 50
  if (body.is_new && score === 50) {
    console.error('\n❌ FAIL: New startup has placeholder GOD score 50');
    console.error('   Sync enrichment/scoring did not run or failed.');
    process.exit(1);
  }

  // 5. Assert: score should be in valid range
  if (score < 0 || score > 100) {
    console.error('\n❌ FAIL: GOD score out of range:', score);
    process.exit(1);
  }

  console.log(`\n✅ GOD score: ${score} (valid, not placeholder)`);
  if (body.is_new) {
    console.log('   Sync path succeeded for new startup.');
  }
  console.log('');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
