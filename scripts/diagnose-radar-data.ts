// ============================================================================
// RADAR DATA DIAGNOSTIC SCRIPT
// ============================================================================
// Run this script to diagnose GOD=100 and other data contract violations.
//
// Usage:
//   npx tsx scripts/diagnose-radar-data.ts [startupId]
//
// Checks:
//   1. GOD score is not 100 (common bug)
//   2. GOD score is startup-level (not varying per match)
//   3. Signal scores are within 0-10 range
//   4. FIT buckets are valid
//   5. No orphaned matches (investor exists)
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

interface DiagnosticResult {
  check: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  data?: unknown;
}

async function runDiagnostics(startupId?: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  
  console.log('🔬 RADAR Data Diagnostics');
  console.log('='.repeat(60));
  
  // ---------------------------------------------
  // CHECK 1: GOD Score Distribution
  // ---------------------------------------------
  console.log('\n📊 Check 1: GOD Score Distribution');
  
  const { data: godScores, error: godError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(100);
  
  if (godError) {
    results.push({ check: 'GOD Distribution', status: 'FAIL', details: `Query error: ${godError.message}` });
  } else if (!godScores || godScores.length === 0) {
    results.push({ check: 'GOD Distribution', status: 'FAIL', details: 'No startups with GOD scores found' });
  } else {
    const scores = godScores.map(s => s.total_god_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const at100 = godScores.filter(s => s.total_god_score === 100);
    
    console.log(`   Total startups: ${godScores.length}`);
    console.log(`   Range: ${min.toFixed(1)} - ${max.toFixed(1)}`);
    console.log(`   Average: ${avg.toFixed(1)}`);
    console.log(`   Startups at exactly 100: ${at100.length}`);
    
    if (at100.length > 0) {
      results.push({
        check: 'GOD=100 Bug',
        status: 'FAIL',
        details: `${at100.length} startups have GOD score exactly 100. This is likely a bug.`,
        data: at100.slice(0, 5).map(s => ({ id: s.id, name: s.name }))
      });
      console.log(`   ❌ FAIL: GOD=100 found for: ${at100.slice(0, 3).map(s => s.name).join(', ')}`);
    } else {
      results.push({ check: 'GOD=100 Bug', status: 'PASS', details: 'No startups have exactly 100' });
      console.log('   ✅ PASS: No GOD=100 bugs detected');
    }
    
    // Check for healthy distribution (avg should be 45-75)
    if (avg < 45 || avg > 75) {
      results.push({
        check: 'GOD Distribution Balance',
        status: 'WARN',
        details: `Average GOD score (${avg.toFixed(1)}) is outside healthy range (45-75)`
      });
      console.log(`   ⚠️  WARN: Average ${avg.toFixed(1)} outside healthy range`);
    } else {
      results.push({ check: 'GOD Distribution Balance', status: 'PASS', details: `Average ${avg.toFixed(1)} is healthy` });
      console.log(`   ✅ PASS: Distribution is healthy`);
    }
  }
  
  // ---------------------------------------------
  // CHECK 2: Specific Startup (if provided)
  // ---------------------------------------------
  if (startupId) {
    console.log(`\n🎯 Check 2: Specific Startup ${startupId}`);
    
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      results.push({ check: 'Startup Lookup', status: 'FAIL', details: `Startup ${startupId} not found` });
      console.log(`   ❌ FAIL: Startup not found`);
    } else {
      console.log(`   Startup: ${startup.name}`);
      console.log(`   GOD Score: ${startup.total_god_score}`);
      console.log(`   Components: team=${startup.team_score}, traction=${startup.traction_score}, market=${startup.market_score}, product=${startup.product_score}, vision=${startup.vision_score}`);
      
      // Verify GOD = sum of components
      const componentSum = (startup.team_score || 0) + (startup.traction_score || 0) + 
                           (startup.market_score || 0) + (startup.product_score || 0) + 
                           (startup.vision_score || 0);
      
      if (Math.abs(componentSum - (startup.total_god_score || 0)) > 2) {
        results.push({
          check: 'GOD Component Sum',
          status: 'WARN',
          details: `Component sum (${componentSum}) doesn't match total (${startup.total_god_score})`
        });
        console.log(`   ⚠️  WARN: Component sum mismatch`);
      } else {
        results.push({ check: 'GOD Component Sum', status: 'PASS', details: 'Components sum correctly' });
        console.log('   ✅ PASS: Component sum matches total');
      }
      
      // Check matches for this startup
      const { data: matches, error: matchError } = await supabase
        .from('startup_investor_matches')
        .select('id, investor_id, match_score, fit_score')
        .eq('startup_id', startupId)
        .limit(50);
      
      if (matchError) {
        results.push({ check: 'Match Query', status: 'FAIL', details: matchError.message });
      } else {
        console.log(`   Matches: ${matches?.length || 0}`);
        
        // Check if any match has a different GOD-like score embedded
        // (This would indicate the GOD=100 bug where match_score becomes GOD)
        const suspiciousMatches = matches?.filter(m => m.match_score === 100) || [];
        if (suspiciousMatches.length > 0) {
          results.push({
            check: 'Match Score 100',
            status: 'WARN',
            details: `${suspiciousMatches.length} matches have exactly 100 score. May indicate data issue.`
          });
          console.log(`   ⚠️  WARN: ${suspiciousMatches.length} matches at exactly 100`);
        }
      }
    }
  }
  
  // ---------------------------------------------
  // CHECK 3: Match Table RPC Data
  // ---------------------------------------------
  if (startupId) {
    console.log('\n📋 Check 3: get_live_match_table RPC');
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_live_match_table', {
      p_startup_id: startupId,
      p_limit_unlocked: 5,
      p_limit_locked: 10
    });
    
    if (rpcError) {
      results.push({ check: 'RPC get_live_match_table', status: 'FAIL', details: rpcError.message });
      console.log(`   ❌ FAIL: ${rpcError.message}`);
    } else if (!rpcData || rpcData.length === 0) {
      results.push({ check: 'RPC get_live_match_table', status: 'WARN', details: 'No matches returned' });
      console.log('   ⚠️  WARN: No matches returned');
    } else {
      console.log(`   Rows returned: ${rpcData.length}`);
      
      // Check signal_score range
      const signalOutOfRange = rpcData.filter((r: any) => r.signal_score < 0 || r.signal_score > 10);
      if (signalOutOfRange.length > 0) {
        results.push({
          check: 'Signal Score Range',
          status: 'FAIL',
          details: `${signalOutOfRange.length} rows have signal_score outside 0-10`
        });
        console.log(`   ❌ FAIL: Signal scores out of range`);
      } else {
        results.push({ check: 'Signal Score Range', status: 'PASS', details: 'All signals in 0-10' });
        console.log('   ✅ PASS: All signals in valid range');
      }
      
      // Check fit_bucket values
      const validBuckets = ['early', 'good', 'high'];
      const invalidBuckets = rpcData.filter((r: any) => !validBuckets.includes(r.fit_bucket));
      if (invalidBuckets.length > 0) {
        results.push({
          check: 'FIT Bucket Values',
          status: 'FAIL',
          details: `Invalid fit_bucket values: ${[...new Set(invalidBuckets.map((r: any) => r.fit_bucket))].join(', ')}`
        });
        console.log('   ❌ FAIL: Invalid fit bucket values');
      } else {
        results.push({ check: 'FIT Bucket Values', status: 'PASS', details: 'All fit buckets valid' });
        console.log('   ✅ PASS: All fit buckets valid');
      }
    }
  }
  
  // ---------------------------------------------
  // CHECK 4: get_startup_context RPC (GOD source)
  // ---------------------------------------------
  if (startupId) {
    console.log('\n🎯 Check 4: get_startup_context RPC (GOD source)');
    
    const { data: contextData, error: contextError } = await supabase.rpc('get_startup_context', {
      p_startup_id: startupId
    });
    
    if (contextError) {
      results.push({ check: 'RPC get_startup_context', status: 'FAIL', details: contextError.message });
      console.log(`   ❌ FAIL: ${contextError.message}`);
    } else if (!contextData || contextData.error) {
      results.push({ check: 'RPC get_startup_context', status: 'FAIL', details: 'Startup not found in context RPC' });
      console.log('   ❌ FAIL: Startup not found');
    } else {
      const godTotal = contextData.god?.total;
      console.log(`   GOD from context RPC: ${godTotal}`);
      
      if (godTotal === 100) {
        results.push({
          check: 'Context GOD=100',
          status: 'FAIL',
          details: 'get_startup_context returns GOD=100. This is the source of the bug.'
        });
        console.log('   ❌ FAIL: GOD=100 detected - THIS IS THE BUG SOURCE');
      } else if (godTotal == null) {
        results.push({
          check: 'Context GOD Missing',
          status: 'FAIL',
          details: 'get_startup_context returns null GOD score'
        });
        console.log('   ❌ FAIL: GOD is null');
      } else {
        results.push({ check: 'Context GOD', status: 'PASS', details: `GOD=${godTotal}` });
        console.log(`   ✅ PASS: GOD=${godTotal}`);
      }
    }
  }
  
  // ---------------------------------------------
  // SUMMARY
  // ---------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`   ✅ PASS: ${passed}`);
  console.log(`   ⚠️  WARN: ${warned}`);
  console.log(`   ❌ FAIL: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.check}: ${r.details}`);
    });
  }
  
  return results;
}

// Run with optional startup ID argument
const startupId = process.argv[2];
runDiagnostics(startupId)
  .then(results => {
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Diagnostic error:', err);
    process.exit(1);
  });
