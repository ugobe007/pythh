#!/usr/bin/env node
/**
 * SUBMIT FLOW SMOKE TEST
 * ======================
 * Tests the critical URL → matches pipeline end-to-end.
 * Run this after ANY database schema change or server code change.
 *
 * Usage:
 *   node scripts/test-submit-flow.js              # Tests against localhost:3002
 *   node scripts/test-submit-flow.js --production  # Tests against production
 *
 * What it checks:
 *   1. Express server is alive (port 3002)
 *   2. /api/instant/health returns valid investor count
 *   3. /api/instant/submit with a known URL returns startup_id + matches
 *   4. Supabase RPC fallback (resolve_startup_by_url) works
 *   5. All critical database columns exist on investors table
 *   6. All critical database columns exist on startup_uploads table
 *   7. startup_investor_matches table is queryable
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = one or more checks failed (DEPLOY BLOCKER)
 */

const TEST_URL = 'stripe.com'; // Well-known test URL

const BASE = process.argv.includes('--production')
  ? process.env.API_URL || 'https://pythh.ai'
  : 'http://localhost:3002';

// Required columns that the submit flow depends on
const REQUIRED_INVESTOR_COLUMNS = [
  'id', 'name', 'firm', 'url', 'sectors', 'stage',
  'total_investments', 'active_fund_size', 'investment_thesis', 'type', 'status'
];

const REQUIRED_STARTUP_COLUMNS = [
  'id', 'name', 'website', 'sectors', 'stage',
  'total_god_score', 'status'
];

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✅ ${label}`);
}

function fail(label, detail) {
  failed++;
  console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
}

async function main() {
  console.log(`\n🔍 SUBMIT FLOW SMOKE TEST`);
  console.log(`   Target: ${BASE}\n`);

  // ── 1. Server alive ──────────────────────────────────
  console.log('1. Server connectivity');
  try {
    const r = await fetch(`${BASE}/api/instant/health`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const body = await r.json();
      if (body.status === 'ok' && body.active_investors > 0) {
        ok(`Server alive, ${body.active_investors} active investors`);
      } else {
        fail('Health check returned unexpected body', JSON.stringify(body));
      }
    } else {
      fail('Health endpoint returned ' + r.status);
    }
  } catch (e) {
    fail('Server unreachable', e.message);
    console.error('\n⛔ Express server is not running on port 3002.');
    console.error('   Start it with: node server/index.js');
    console.error('   Or: pm2 start ecosystem.config.js\n');
    process.exit(1);
  }

  // ── 2. Submit URL ────────────────────────────────────
  console.log('\n2. URL submission (/api/instant/submit)');
  try {
    const r = await fetch(`${BASE}/api/instant/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_URL }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      const body = await r.json();
      if (body.startup_id) {
        ok(`Resolved "${TEST_URL}" → startup_id: ${body.startup_id.slice(0, 8)}...`);
      } else {
        fail('No startup_id in response', JSON.stringify(body).slice(0, 200));
      }
      if (body.matches && body.matches.length > 0) {
        ok(`Got ${body.matches.length} matches (top score: ${body.matches[0]?.match_score})`);
      } else if (body.match_count > 0) {
        ok(`${body.match_count} existing matches returned`);
      } else {
        fail('No matches returned');
      }
      // GOD score: new startups must not have placeholder 50; any returned score must be valid
      const score = body.startup?.total_god_score;
      if (score !== undefined && score !== null) {
        if (body.is_new && score === 50) {
          fail('New startup has placeholder GOD score 50 (sync scoring failed)');
        } else if (score < 0 || score > 100) {
          fail(`GOD score out of range: ${score}`);
        } else {
          ok(`GOD score valid: ${score}`);
        }
      }
    } else {
      const text = await r.text();
      fail(`Submit returned HTTP ${r.status}`, text.slice(0, 300));
    }
  } catch (e) {
    fail('Submit request failed', e.message);
  }

  // ── 3. Database schema validation ────────────────────
  console.log('\n3. Database schema (via Supabase REST)');
  
  // Load env for Supabase direct checks
  let supabaseUrl, supabaseKey;
  try {
    const path = require('path');
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    supabaseUrl = process.env.VITE_SUPABASE_URL;
    supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  } catch (e) {
    // Skip schema checks if no env
  }
  
  if (supabaseUrl && supabaseKey) {
    // Check investors columns
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/investors?select=${REQUIRED_INVESTOR_COLUMNS.join(',')}&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (r.ok) {
        ok(`investors table: all ${REQUIRED_INVESTOR_COLUMNS.length} required columns exist`);
      } else {
        const err = await r.text();
        fail('investors table schema mismatch', err.slice(0, 200));
      }
    } catch (e) {
      fail('investors schema check failed', e.message);
    }
    
    // Check startup_uploads columns
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/startup_uploads?select=${REQUIRED_STARTUP_COLUMNS.join(',')}&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (r.ok) {
        ok(`startup_uploads table: all ${REQUIRED_STARTUP_COLUMNS.length} required columns exist`);
      } else {
        const err = await r.text();
        fail('startup_uploads table schema mismatch', err.slice(0, 200));
      }
    } catch (e) {
      fail('startup_uploads schema check failed', e.message);
    }

    // Check startup_investor_matches queryable
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/startup_investor_matches?select=id,match_score,startup_id,investor_id&limit=1`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (r.ok) {
        ok('startup_investor_matches table queryable');
      } else {
        const err = await r.text();
        fail('startup_investor_matches query failed', err.slice(0, 200));
      }
    } catch (e) {
      fail('matches schema check failed', e.message);
    }

    // Check RPC exists
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/rpc/resolve_startup_by_url`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_url: 'test.com' }),
        }
      );
      if (r.ok || r.status === 200) {
        ok('resolve_startup_by_url RPC exists and callable');
      } else {
        fail('RPC check failed', `HTTP ${r.status}`);
      }
    } catch (e) {
      fail('RPC check failed', e.message);
    }
  } else {
    console.log('   ⏭️  Skipped (no VITE_SUPABASE_URL in .env)');
  }

  // ── Summary ──────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
  if (failed > 0) {
    console.log(`\n  ⛔ SUBMIT FLOW IS BROKEN — DO NOT DEPLOY\n`);
    process.exit(1);
  } else {
    console.log(`\n  ✅ Submit flow healthy\n`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
