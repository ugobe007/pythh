/**
 * ============================================================================
 * GOD SCORE CONFIG VALIDATOR
 * ============================================================================
 * Checks if GOD scores match expected distribution for current config
 * Run this before/after any config changes to verify system health
 * 
 * Usage:
 *   npx tsx scripts/validate-god-config.ts
 * 
 * Exits with code 1 if config is misconfigured
 * ============================================================================
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GOD_SCORE_CONFIG, GOD_SCORE_ACCEPTABLE_RANGES } from '../server/services/startupScoringService';

config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ScoreStats {
  total: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  belowFloor: number;
  tierDistribution: {
    elite: number;      // 80+
    excellent: number;  // 70-79
    strong: number;     // 60-69
    good: number;       // 50-59
    fair: number;       // 40-49
    weak: number;       // < 40
  };
}

async function getScoreStats(): Promise<ScoreStats> {
  // Get all approved startups with scores
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No startup scores found in database');
  }

  const scores = data.map(s => s.total_god_score).filter(s => s !== null) as number[];
  scores.sort((a, b) => a - b);

  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const median = scores[Math.floor(scores.length / 2)];
  const min = scores[0];
  const max = scores[scores.length - 1];
  const belowFloor = scores.filter(s => s < 40).length;

  const tierDistribution = {
    elite: scores.filter(s => s >= 80).length,
    excellent: scores.filter(s => s >= 70 && s < 80).length,
    strong: scores.filter(s => s >= 60 && s < 70).length,
    good: scores.filter(s => s >= 50 && s < 60).length,
    fair: scores.filter(s => s >= 40 && s < 50).length,
    weak: scores.filter(s => s < 40).length,
  };

  return {
    total: scores.length,
    avg,
    median,
    min,
    max,
    belowFloor,
    tierDistribution,
  };
}

function validateStats(stats: ScoreStats): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ranges = GOD_SCORE_ACCEPTABLE_RANGES;

  // Check average score
  if (stats.avg < ranges.averageScoreTarget.min) {
    errors.push(
      `❌ Average score ${stats.avg.toFixed(1)} below target range (${ranges.averageScoreTarget.min}-${ranges.averageScoreTarget.max}). ` +
      `Scores too low - divisor likely too high.`
    );
  } else if (stats.avg > ranges.averageScoreTarget.max) {
    errors.push(
      `❌ Average score ${stats.avg.toFixed(1)} above target range (${ranges.averageScoreTarget.min}-${ranges.averageScoreTarget.max}). ` +
      `Scores too high - divisor likely too low.`
    );
  }

  // Check floor violations
  const floorPct = (stats.belowFloor / stats.total) * 100;
  if (floorPct > 10) {
    errors.push(
      `❌ ${stats.belowFloor} startups (${floorPct.toFixed(1)}%) below quality floor (40). ` +
      `Should be < 10%. Config needs adjustment.`
    );
  } else if (floorPct > 5) {
    warnings.push(
      `⚠️  ${stats.belowFloor} startups (${floorPct.toFixed(1)}%) below quality floor (40). ` +
      `Acceptable but monitor closely.`
    );
  }

  // Check tier distribution
  const totalApproved = stats.total;
  const elitePct = (stats.tierDistribution.elite / totalApproved) * 100;
  const excellentPct = (stats.tierDistribution.excellent / totalApproved) * 100;
  const strongPct = (stats.tierDistribution.strong / totalApproved) * 100;
  const goodPct = (stats.tierDistribution.good / totalApproved) * 100;

  // Elite should be rare (5-10%)
  if (elitePct > 12) {
    warnings.push(`⚠️  Elite tier (80+) at ${elitePct.toFixed(1)}% (expected: 5-10%). Scores may be inflated.`);
  } else if (elitePct < 2 && totalApproved > 100) {
    warnings.push(`⚠️  Elite tier (80+) at ${elitePct.toFixed(1)}% (expected: 5-10%). Few exceptional startups.`);
  }

  // Strong should be 20-30%
  if (strongPct > 35) {
    warnings.push(`⚠️  Strong tier (60-69) at ${strongPct.toFixed(1)}% (expected: 20-30%). Too many "strong" ratings.`);
  } else if (strongPct < 15 && totalApproved > 100) {
    warnings.push(`⚠️  Strong tier (60-69) at ${strongPct.toFixed(1)}% (expected: 20-30%). Too few quality startups.`);
  }

  // Good should be 30-40%
  if (goodPct > 45) {
    warnings.push(`⚠️  Good tier (50-59) at ${goodPct.toFixed(1)}% (expected: 30-40%). Distribution shifted low.`);
  } else if (goodPct < 20 && totalApproved > 100) {
    warnings.push(`⚠️  Good tier (50-59) at ${goodPct.toFixed(1)}% (expected: 30-40%). Distribution shifted high.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function main() {
  console.log('🛡️  GOD SCORE CONFIG VALIDATOR\n');
  console.log('=' .repeat(80));
  
  // Show current config
  console.log('📋 CURRENT CONFIGURATION:\n');
  console.log(`   Normalization Divisor: ${GOD_SCORE_CONFIG.normalizationDivisor}`);
  console.log(`   Acceptable range:      ${GOD_SCORE_ACCEPTABLE_RANGES.normalizationDivisor.min} - ${GOD_SCORE_ACCEPTABLE_RANGES.normalizationDivisor.max}`);
  console.log(`   Base Boost Minimum:    ${GOD_SCORE_CONFIG.baseBoostMinimum}`);
  console.log(`   Acceptable range:      ${GOD_SCORE_ACCEPTABLE_RANGES.baseBoostMinimum.min} - ${GOD_SCORE_ACCEPTABLE_RANGES.baseBoostMinimum.max}`);
  console.log(`   Vibe Bonus Cap:        ${GOD_SCORE_CONFIG.vibeBonusCap}`);
  console.log('');
  
  // Get score stats from database
  console.log('📊 ANALYZING CURRENT SCORES...\n');
  const stats = await getScoreStats();
  
  console.log(`   Total approved startups: ${stats.total}`);
  console.log(`   Average GOD score:       ${stats.avg.toFixed(1)}`);
  console.log(`   Median:  ${stats.median.toFixed(0)}  Min: ${stats.min}  Max: ${stats.max}`);
  console.log(`   Below floor (< 40):      ${stats.belowFloor} (${((stats.belowFloor / stats.total) * 100).toFixed(1)}%)`);
  console.log('');
  
  // Show tier distribution
  console.log('🎯 TIER DISTRIBUTION:\n');
  const total = stats.total;
  console.log(`   🌟 Elite (80+):        ${stats.tierDistribution.elite.toString().padStart(4)} (${((stats.tierDistribution.elite / total) * 100).toFixed(1)}%)`);
  console.log(`   ⭐ Excellent (70-79):   ${stats.tierDistribution.excellent.toString().padStart(4)} (${((stats.tierDistribution.excellent / total) * 100).toFixed(1)}%)`);
  console.log(`   💪 Strong (60-69):      ${stats.tierDistribution.strong.toString().padStart(4)} (${((stats.tierDistribution.strong / total) * 100).toFixed(1)}%)`);
  console.log(`   ✅ Good (50-59):        ${stats.tierDistribution.good.toString().padStart(4)} (${((stats.tierDistribution.good / total) * 100).toFixed(1)}%)`);
  console.log(`   ⚠️  Fair (40-49):        ${stats.tierDistribution.fair.toString().padStart(4)} (${((stats.tierDistribution.fair / total) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Weak (< 40):         ${stats.tierDistribution.weak.toString().padStart(4)} (${((stats.tierDistribution.weak / total) * 100).toFixed(1)}%)`);
  console.log('');
  
  // Validate
  console.log('=' .repeat(80));
  const validation = validateStats(stats);
  
  if (validation.errors.length > 0) {
    console.log('\n🚨 CRITICAL ERRORS:\n');
    validation.errors.forEach(err => console.log(`   ${err}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    validation.warnings.forEach(warn => console.log(`   ${warn}`));
  }
  
  if (validation.valid && validation.warnings.length === 0) {
    console.log('\n✅ CONFIG VALIDATION PASSED\n');
    console.log('   Score distribution matches expected ranges.');
    console.log('   System is properly calibrated.');
  } else if (validation.valid) {
    console.log('\n✅ CONFIG VALIDATION PASSED (with warnings)\n');
    console.log('   No critical errors, but review warnings above.');
  } else {
    console.log('\n❌ CONFIG VALIDATION FAILED\n');
    console.log('   Critical errors detected. Config needs adjustment.');
    console.log('');
    console.log('   RECOMMENDED ACTIONS:');
    if (stats.avg < GOD_SCORE_ACCEPTABLE_RANGES.averageScoreTarget.min) {
      console.log(`   - DECREASE normalizationDivisor (currently ${GOD_SCORE_CONFIG.normalizationDivisor})`);
      console.log(`   - Try: ${(GOD_SCORE_CONFIG.normalizationDivisor - 1).toFixed(1)}`);
    } else if (stats.avg > GOD_SCORE_ACCEPTABLE_RANGES.averageScoreTarget.max) {
      console.log(`   - INCREASE normalizationDivisor (currently ${GOD_SCORE_CONFIG.normalizationDivisor})`);
      console.log(`   - Try: ${(GOD_SCORE_CONFIG.normalizationDivisor + 1).toFixed(1)}`);
    }
    console.log('');
  }
  
  console.log('=' .repeat(80));
  
  process.exit(validation.valid ? 0 : 1);
}

main().catch(err => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});
