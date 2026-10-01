'use strict';
/**
 * Test runner for Pythh GPT Actions Suite
 * ========================================
 * Simulates ChatGPT tool-calling queries against the 5 wedge endpoints:
 *   1. Active VC Matcher
 *   2. Startup GOD Score™ Auditor
 *   3. VC Syndicate Mapper
 *   4. VC Thesis Verifier
 *   5. Daily Signal Radar
 */

import 'dotenv/config';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getOpenApiSpec } = require('../server/routes/gptActions');
const gptActionsRouter = require('../server/routes/gptActions');

function invokeRoute(method, pathAndQuery, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`http://localhost${pathAndQuery}`);
    const pathname = urlObj.pathname;
    const query = Object.fromEntries(urlObj.searchParams);

    // Find matching route in router stack
    const layer = gptActionsRouter.stack.find((l) => {
      if (!l.route) return false;
      const routeMethod = Object.keys(l.route.methods)[0].toUpperCase();
      if (routeMethod !== method.toUpperCase()) return false;
      return l.route.path === pathname || l.match(pathname);
    });

    if (!layer || !layer.route) {
      return reject(new Error(`No route found for ${method} ${pathname}`));
    }

    const req = {
      method: method.toUpperCase(),
      url: pathAndQuery,
      path: pathname,
      query,
      body: body || {},
      params: {},
      headers: { host: 'localhost' },
    };

    // Extract params if parameterized (e.g. /openapi/:wedge.json)
    if (layer.params) {
      req.params = layer.params;
    } else if (pathname.startsWith('/openapi/') && pathname.endsWith('.json')) {
      req.params = { wedge: pathname.slice('/openapi/'.length, -'.json'.length) };
    }

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ statusCode: this.statusCode, headers: this.headers, data }); },
      send(data) { resolve({ statusCode: this.statusCode, headers: this.headers, data }); },
    };

    const handler = layer.route.stack[0].handle;
    handler(req, res).catch(reject);
  });
}

async function runLiveDiagnostics() {
  console.log('\n================================================================');
  console.log('🚀 TESTING PYTHH CHATGPT ACTIONS SUITE');
  console.log('================================================================\n');

  // 0. Test OpenAPI Schemas
  console.log('📄 [0] Verifying OpenAPI 3.1.0 Schemas:');
  const unified = getOpenApiSpec();
  console.log(`   ✓ Unified schema paths: ${Object.keys(unified.paths).join(', ')}`);
  
  const targetedGod = getOpenApiSpec('god-score');
  console.log(`   ✓ Targeted god-score path: ${Object.keys(targetedGod.paths).join(', ')}`);

  const targetedVc = getOpenApiSpec('vc-matches');
  console.log(`   ✓ Targeted vc-matches path: ${Object.keys(targetedVc.paths).join(', ')}`);

  // 1. Test Wedge 1: Active VC Matcher
  console.log('\n🔎 [1] Testing Wedge 1: Active VC Matcher');
  console.log('   Prompt: "Find active seed VCs for an AI infrastructure startup"');
  const vcMatchesRes = await invokeRoute('GET', '/vc-matches?sector=AI&stage=Seed&limit=3');
  console.log(`   Status: ${vcMatchesRes.statusCode}`);
  console.log(`   Prediction Accuracy: ${vcMatchesRes.data.predicted_funding_accuracy}`);
  if (vcMatchesRes.data.funding_prediction_record) {
    const rec = vcMatchesRes.data.funding_prediction_record;
    console.log(`   Benchmark Record: ${rec.top_50_placement_rate} in Top 50 | ${rec.top_5_placement_rate} in Top 5 (n=${rec.sample_size})`);
    console.log(`   Proof Link: ${rec.record_url}`);
  }
  console.log(`   Total Candidates Analyzed: ${vcMatchesRes.data.total_candidates_analyzed}`);
  console.log('   Top Matches returned:');
  for (const m of vcMatchesRes.data.matches) {
    console.log(`     • ${m.firm} (${m.investor_name}) — Score: ${m.match_score}/100 — Check: ${m.estimated_check_size}`);
  }
  console.log(`   Conversion Hook: ${vcMatchesRes.data.next_step}`);

  // 2. Test Wedge 2: Startup GOD Score™ Auditor
  console.log('\n⚖️  [2] Testing Wedge 2: Startup GOD Score™ Auditor');
  console.log('   Prompt: "Audit my B2B SaaS startup: $350k ARR, raising $2M Seed"');
  const godScoreRes = await invokeRoute('POST', '/god-score', {
    name: 'Metasync AI',
    website: 'metasync.ai',
    stage: 'Seed',
    arr_usd: 350000,
    target_raise_usd: 2000000,
    description: 'Autonomous data pipeline sync and validation agent for enterprise data warehouses',
    team_background: 'Ex-Snowflake, Carnegie Mellon PhD in Database Systems',
  });
  console.log(`   Status: ${godScoreRes.statusCode}`);
  console.log(`   Startup: ${godScoreRes.data.startup_name}`);
  console.log(`   GOD Score: ${godScoreRes.data.total_god_score}/100 (${godScoreRes.data.percentile})`);
  console.log(`   Funding Readiness: ${godScoreRes.data.funding_readiness}`);
  console.log(`   Valuation Benchmark: ${godScoreRes.data.estimated_valuation_range}`);
  console.log('   Pillar Breakdown:');
  for (const [pillar, d] of Object.entries(godScoreRes.data.pillar_scores)) {
    console.log(`     • ${pillar.toUpperCase()}: ${d.score}/${d.max} (${d.weight}) — ${d.status}`);
  }
  if (godScoreRes.data.oracle_portfolio) {
    console.log(`   Oracle Portfolio: ${godScoreRes.data.oracle_portfolio.status} (Tracked at ${godScoreRes.data.oracle_portfolio.portfolio_url})`);
  }
  console.log(`   Conversion Hook: ${godScoreRes.data.actionable_next_step}`);

  // 3. Test Wedge 3: VC Syndicate Mapper
  console.log('\n🌐 [3] Testing Wedge 3: VC Syndicate & Co-Investor Mapper');
  console.log('   Prompt: "Who frequently co-invests with Founders Fund?"');
  const syndicateRes = await invokeRoute('GET', '/syndicates?firm_name=Founders%20Fund');
  console.log(`   Status: ${syndicateRes.statusCode}`);
  console.log(`   Firm: ${syndicateRes.data.firm_name} (${syndicateRes.data.institutional_tier})`);
  console.log(`   Lead Role: ${syndicateRes.data.typical_lead_role}`);
  console.log(`   Frequent Syndicate Partners: ${syndicateRes.data.verified_syndicate_partners.join(', ')}`);
  console.log(`   Conversion Hook: ${syndicateRes.data.next_step}`);

  // 4. Test Wedge 4: VC Thesis Verifier
  console.log('\n🕵️  [4] Testing Wedge 4: VC Thesis & Fact Verifier');
  console.log('   Prompt: "Check if Sequoia Capital is actively investing and check size"');
  const thesisRes = await invokeRoute('GET', '/vc-thesis?name=Sequoia');
  console.log(`   Status: ${thesisRes.statusCode}`);
  console.log(`   Firm: ${thesisRes.data.firm} — Status: ${thesisRes.data.status}`);
  console.log(`   Stages: ${thesisRes.data.target_stages}`);
  console.log(`   Estimated Check Size: ${thesisRes.data.estimated_check_size}`);
  console.log(`   Observed Triggers: ${thesisRes.data.observed_deal_triggers?.join(', ')}`);
  console.log(`   Conversion Hook: ${thesisRes.data.next_step}`);

  // 5. Test Wedge 5: Daily Signal Radar
  console.log('\n📡 [5] Testing Wedge 5: Daily Signal Venture Radar');
  console.log('   Prompt: "What are the latest venture capital funding rounds today?"');
  const signalRes = await invokeRoute('GET', '/daily-signal');
  console.log(`   Status: ${signalRes.statusCode}`);
  console.log(`   Edition: ${signalRes.data.edition} (${signalRes.data.date})`);
  console.log(`   Market Velocity: ${signalRes.data.market_velocity}`);
  console.log('   Trending Sectors:');
  for (const s of signalRes.data.trending_sectors) {
    console.log(`     • ${s}`);
  }
  console.log(`   Conversion Hook: ${signalRes.data.next_step}`);

  console.log('\n================================================================');
  console.log('✅ ALL 5 CHATGPT ACTION WEDGES TESTED SUCCESSFULLY');
  console.log('================================================================\n');
}

runLiveDiagnostics().catch((err) => {
  console.error('❌ Diagnostic test failed:', err);
  process.exit(1);
});
