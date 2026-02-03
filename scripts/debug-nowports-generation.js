#!/usr/bin/env node
/**
 * DEBUG: Nowports Match Generation
 * ================================
 * Manually run the match generator for Nowports to see:
 * 1. How many investors are evaluated
 * 2. Why scores are low
 * 3. What filters discard matches
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Matching configuration (from match-regenerator.js)
const CONFIG = {
  SECTOR_MATCH: 40,
  STAGE_MATCH: 20,
  GEO_MATCH: 5,
  INVESTOR_QUALITY: 20,
  STARTUP_QUALITY: 25,
  MIN_MATCH_SCORE: 45,
};

const SECTOR_SYNONYMS = {
  'ai': ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'generative ai'],
  'fintech': ['financial technology', 'payments', 'banking', 'insurtech'],
  'healthtech': ['health tech', 'digital health', 'healthcare', 'medtech', 'biotech'],
  'saas': ['software', 'b2b software', 'enterprise software', 'cloud'],
  'ecommerce': ['e-commerce', 'retail', 'marketplace', 'dtc'],
  'logistics': ['supply chain', 'shipping', 'freight', 'transportation'],
};

// Map numeric stages to string stages
const STAGE_MAP = {
  0: 'Pre-Seed',
  1: 'Seed',
  2: 'Series A',
  3: 'Series B',
  4: 'Series C',
  5: 'Growth'
};

function normalizeStr(s) {
  if (!s) return '';
  if (typeof s === 'string') return s.toLowerCase().trim();
  if (Array.isArray(s)) return s.map(normalizeStr).join(' ');
  return String(s).toLowerCase().trim();
}

function calculateSectorMatch(startupSectors, investorSectors) {
  if (!startupSectors || !investorSectors) return 5;
  
  const normalize = (arr) => (Array.isArray(arr) ? arr : [arr]).map(normalizeStr);
  const sSectors = normalize(startupSectors);
  const iSectors = normalize(investorSectors);
  
  let matches = 0;
  const details = [];
  
  for (const ss of sSectors) {
    for (const is of iSectors) {
      if (ss === is || ss.includes(is) || is.includes(ss)) {
        matches++;
        details.push(`EXACT: "${ss}" ↔ "${is}"`);
        continue;
      }
      // Check synonyms
      for (const [key, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
        const allTerms = [key, ...synonyms];
        if (allTerms.some(t => ss.includes(t)) && allTerms.some(t => is.includes(t))) {
          matches++;
          details.push(`SYNONYM: "${ss}" ↔ "${is}" (via ${key})`);
          break;
        }
      }
    }
  }
  
  const score = Math.min(matches * 10, CONFIG.SECTOR_MATCH);
  return { score, matches, details };
}

function calculateStageMatch(startupStage, investorStages) {
  if (!startupStage || !investorStages) return { score: 5, match: false };
  
  // Convert numeric stage to string
  let sStageStr = startupStage;
  if (typeof startupStage === 'number') {
    sStageStr = STAGE_MAP[startupStage] || 'Seed';
  }
  
  const normalize = (s) => normalizeStr(s).replace(/[-_\s]/g, '');
  const sStage = normalize(sStageStr);
  const iStages = (Array.isArray(investorStages) ? investorStages : [investorStages]).map(normalize);
  
  const match = iStages.some(is => is === sStage || is.includes(sStage) || sStage.includes(is));
  return { score: match ? CONFIG.STAGE_MATCH : 5, match, sStage, iStages };
}

function calculateInvestorQuality(score, tier) {
  const baseScore = (score || 5) * 2; // 0-20 from score
  const tierBonus = { elite: 5, strong: 3, solid: 1, emerging: 0 }[tier] || 0;
  return Math.min(baseScore + tierBonus, CONFIG.INVESTOR_QUALITY);
}

function calculateStartupQuality(godScore) {
  if (!godScore) return 8;
  const normalized = Math.max(0, (godScore - 40) / 60); // 0-1 scale
  return Math.round(10 + normalized * 15); // 10-25 range
}

async function debugNowports() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 NOWPORTS MATCH GENERATION DEBUG');
  console.log('═'.repeat(70) + '\n');

  // 1. Fetch Nowports
  console.log('📥 Fetching Nowports...');
  const { data: nowports, error: nowErr } = await supabase
    .from('startup_uploads')
    .select('*')
    .ilike('name', '%nowports%')
    .eq('status', 'approved')
    .single();

  if (nowErr || !nowports) {
    console.error('❌ Could not find Nowports:', nowErr?.message);
    return;
  }

  console.log('✅ Nowports found:');
  console.log(`   ID: ${nowports.id}`);
  console.log(`   Name: ${nowports.name}`);
  console.log(`   Sectors: ${JSON.stringify(nowports.sectors)}`);
  console.log(`   Stage: ${nowports.stage}`);
  console.log(`   GOD Score: ${nowports.total_god_score}`);
  console.log(`   Location: ${nowports.location}\n`);

  // 2. Fetch ALL investors
  console.log('📥 Fetching ALL investors...');
  let allInvestors = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, sectors, stage, investor_score, investor_tier')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`❌ Error fetching investors page ${page}:`, error.message);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allInvestors = allInvestors.concat(data);
    console.log(`   Fetched ${allInvestors.length} investors...`);
    
    if (data.length < pageSize) break; // Last page
    page++;
  }

  const investors = allInvestors;

  if (!investors || investors.length === 0) {
    console.error('❌ No investors found');
    return;
  }

  console.log(`✅ Found ${investors.length} investors total\n`);

  // 3. Calculate scores for EVERY investor
  console.log('🎯 Calculating match scores for ALL investors...\n');
  
  const startupQuality = calculateStartupQuality(nowports.total_god_score);
  console.log(`   Nowports Startup Quality: ${startupQuality}/${CONFIG.STARTUP_QUALITY}\n`);

  const scoredInvestors = [];
  const rejectReasons = {
    'below_threshold': 0,
    'zero_sector': 0,
    'zero_stage': 0,
    'total_evaluated': 0
  };

  for (const investor of investors) {
    const sectorAnalysis = calculateSectorMatch(nowports.sectors, investor.sectors);
    const stageAnalysis = calculateStageMatch(nowports.stage, investor.stage);
    const investorQuality = calculateInvestorQuality(investor.investor_score, investor.investor_tier);

    const totalScore = sectorAnalysis.score + stageAnalysis.score + investorQuality + startupQuality;

    rejectReasons.total_evaluated++;

    const analysis = {
      investor: {
        id: investor.id,
        name: investor.name,
        sectors: investor.sectors,
        stage: investor.stage,
        tier: investor.investor_tier
      },
      scores: {
        sector: sectorAnalysis.score,
        stage: stageAnalysis.score,
        investor_quality: investorQuality,
        startup_quality: startupQuality,
        total: totalScore
      },
      sector_details: sectorAnalysis.details,
      stage_match: stageAnalysis.match,
      passes_threshold: totalScore >= CONFIG.MIN_MATCH_SCORE
    };

    if (totalScore >= CONFIG.MIN_MATCH_SCORE) {
      scoredInvestors.push(analysis);
    } else {
      if (sectorAnalysis.score === 5) rejectReasons.zero_sector++;
      if (stageAnalysis.score === 5) rejectReasons.zero_stage++;
      rejectReasons.below_threshold++;
    }
  }

  // Sort by score
  scoredInvestors.sort((a, b) => b.scores.total - a.scores.total);

  console.log('📊 SCORING SUMMARY:');
  console.log('═'.repeat(70));
  console.log(`   Total investors evaluated: ${rejectReasons.total_evaluated}`);
  console.log(`   Matches above threshold (>=${CONFIG.MIN_MATCH_SCORE}): ${scoredInvestors.length}`);
  console.log(`   Rejected below threshold: ${rejectReasons.below_threshold}`);
  console.log(`   Rejected (zero sector match): ${rejectReasons.zero_sector}`);
  console.log(`   Rejected (zero stage match): ${rejectReasons.zero_stage}\n`);

  // Show top 10 matches
  console.log('🏆 TOP 10 MATCHES:');
  console.log('═'.repeat(70));
  
  for (let i = 0; i < Math.min(10, scoredInvestors.length); i++) {
    const m = scoredInvestors[i];
    console.log(`\n${i + 1}. ${m.investor.name}`);
    console.log(`   Total Score: ${m.scores.total} (threshold: ${CONFIG.MIN_MATCH_SCORE})`);
    console.log(`   Breakdown:`);
    console.log(`     Sector: ${m.scores.sector}/${CONFIG.SECTOR_MATCH}`);
    if (m.sector_details.length > 0) {
      m.sector_details.forEach(d => console.log(`       • ${d}`));
    }
    console.log(`     Stage: ${m.scores.stage}/${CONFIG.STAGE_MATCH} ${m.stage_match ? '✓' : '✗'}`);
    console.log(`     Investor Quality: ${m.scores.investor_quality}/${CONFIG.INVESTOR_QUALITY}`);
    console.log(`     Startup Quality: ${m.scores.startup_quality}/${CONFIG.STARTUP_QUALITY}`);
    console.log(`   Investor Sectors: ${JSON.stringify(m.investor.sectors)}`);
    console.log(`   Investor Stage: ${JSON.stringify(m.investor.stage)}`);
  }

  // Show worst rejections (right at the cutoff)
  const almostMatches = investors
    .map(inv => {
      const sectorAnalysis = calculateSectorMatch(nowports.sectors, inv.sectors);
      const stageAnalysis = calculateStageMatch(nowports.stage, inv.stage);
      const investorQuality = calculateInvestorQuality(inv.investor_score, inv.investor_tier);
      const total = sectorAnalysis.score + stageAnalysis.score + investorQuality + startupQuality;
      return {
        name: inv.name,
        total,
        sector: sectorAnalysis.score,
        stage: stageAnalysis.score
      };
    })
    .filter(m => m.total >= 40 && m.total < CONFIG.MIN_MATCH_SCORE)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  if (almostMatches.length > 0) {
    console.log('\n\n⚠️  CLOSE CALLS (just below threshold):');
    console.log('═'.repeat(70));
    almostMatches.forEach((m, i) => {
      console.log(`${i + 1}. ${m.name}: ${m.total} (sector: ${m.sector}, stage: ${m.stage})`);
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎬 DIAGNOSIS COMPLETE');
  console.log('═'.repeat(70) + '\n');
}

debugNowports().then(() => {
  console.log('✅ Done');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
