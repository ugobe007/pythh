#!/usr/bin/env node
/**
 * AUTO MATCH REGENERATION
 * =======================
 * Runs every 4 hours to keep matches fresh.
 * Called by PM2 automation pipeline.
 * 
 * PM2: pm2 start match-regenerator.js --name match-regen --cron "0 0,4,8,12,16,20 * * *"
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Matching configuration
const CONFIG = {
  SECTOR_MATCH: 40,      // Increased: sector alignment is most critical
  STAGE_MATCH: 20,
  GEO_MATCH: 5,          // Reduced: geography less important (modern VC is global)
  INVESTOR_QUALITY: 20,  // Reduced slightly 
  STARTUP_QUALITY: 25,   // Increased: GOD score matters more
  MIN_MATCH_SCORE: 45,   // Raised from 35 to reduce match flood
  TOP_MATCHES_PER_STARTUP: 100, // Only keep top 100 matches per startup
  BATCH_SIZE: 500
};

// Sector synonyms
const SECTOR_SYNONYMS = {
  'ai': ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'generative ai'],
  'fintech': ['financial technology', 'payments', 'banking', 'insurtech'],
  'healthtech': ['health tech', 'digital health', 'healthcare', 'medtech', 'biotech'],
  'saas': ['software', 'b2b software', 'enterprise software', 'cloud'],
  'ecommerce': ['e-commerce', 'retail', 'marketplace', 'dtc'],
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
  for (const ss of sSectors) {
    for (const is of iSectors) {
      if (ss === is || ss.includes(is) || is.includes(ss)) {
        matches++;
        continue;
      }
      // Check synonyms
      for (const [key, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
        const allTerms = [key, ...synonyms];
        if (allTerms.some(t => ss.includes(t)) && allTerms.some(t => is.includes(t))) {
          matches++;
          break;
        }
      }
    }
  }
  
  return Math.min(matches * 10, CONFIG.SECTOR_MATCH);
}

function calculateStageMatch(startupStage, investorStages) {
  if (!startupStage || !investorStages) return 5;
  
  const normalize = (s) => normalizeStr(s).replace(/[-_\s]/g, '');
  const sStage = normalize(startupStage);
  const iStages = (Array.isArray(investorStages) ? investorStages : [investorStages]).map(normalize);
  
  if (iStages.some(is => is === sStage || is.includes(sStage) || sStage.includes(is))) {
    return CONFIG.STAGE_MATCH;
  }
  return 5;
}

function calculateInvestorQuality(score, tier) {
  const baseScore = (score || 5) * 2; // 0-20 from score
  const tierBonus = { elite: 5, strong: 3, solid: 1, emerging: 0 }[tier] || 0;
  return Math.min(baseScore + tierBonus, CONFIG.INVESTOR_QUALITY);
}

function calculateStartupQuality(godScore) {
  if (!godScore) return 8;
  // Map GOD score 40-100 to quality 10-25
  // This gives calibrated startups proper representation
  const normalized = Math.max(0, (godScore - 40) / 60); // 0-1 scale
  return Math.round(10 + normalized * 15); // 10-25 range
}

/**
 * Generate human-readable reasoning for why this match works
 */
function generateReasoning(startup, investor, fitAnalysis) {
  const reasons = [];
  
  // Sector alignment reasoning
  if (fitAnalysis.sector >= 30) {
    reasons.push(`Strong sector alignment: ${investor.name} actively invests in ${formatSectors(startup.sectors)}`);
  } else if (fitAnalysis.sector >= 20) {
    reasons.push(`Good sector fit: Investment focus overlaps with ${startup.name}'s market`);
  } else if (fitAnalysis.sector >= 10) {
    reasons.push(`Adjacent sector interest detected`);
  }
  
  // Stage reasoning
  if (fitAnalysis.stage >= 15) {
    reasons.push(`Stage match: ${investor.name} targets ${startup.stage || 'early'}-stage companies`);
  } else if (fitAnalysis.stage >= 10) {
    reasons.push(`Stage overlap with investor's typical dealflow`);
  }
  
  // Investor quality reasoning
  if (fitAnalysis.investor_quality >= 18) {
    reasons.push(`Top-tier investor with strong track record`);
  } else if (fitAnalysis.investor_quality >= 15) {
    reasons.push(`Established investor with relevant portfolio`);
  }
  
  // Startup quality reasoning
  if (fitAnalysis.startup_quality >= 22) {
    reasons.push(`Exceptional startup fundamentals (GOD Score: ${startup.total_god_score || 'N/A'})`);
  } else if (fitAnalysis.startup_quality >= 18) {
    reasons.push(`Strong startup metrics and team`);
  }
  
  // Tier-specific reasoning
  if (fitAnalysis.tier === 'elite') {
    reasons.push(`Elite investor match - high-conviction opportunity`);
  }
  
  return reasons.slice(0, 4).join('. ') + '.';
}

function formatSectors(sectors) {
  if (!sectors) return 'their target sectors';
  if (Array.isArray(sectors)) return sectors.slice(0, 3).join(', ');
  return sectors;
}

/**
 * Generate why_you_match array for UI display
 */
function generateWhyYouMatch(startup, investor, fitAnalysis) {
  const matches = [];
  
  if (fitAnalysis.sector >= 20) {
    matches.push(`Sector: ${formatSectors(startup.sectors)}`);
  }
  
  if (fitAnalysis.stage >= 10) {
    matches.push(`Stage: ${startup.stage || 'Early'}`);
  }
  
  if (fitAnalysis.investor_quality >= 15) {
    matches.push(`Investor Tier: ${investor.investor_tier || 'Active'}`);
  }
  
  if (fitAnalysis.startup_quality >= 18) {
    matches.push(`GOD Score: ${startup.total_god_score || 'N/A'}`);
  }
  
  return matches.length > 0 ? matches : ['Algorithmic match'];
}

async function regenerateMatches() {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(60));
  console.log('🔄 AUTO MATCH REGENERATION');
  console.log('═'.repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  
  try {
    // Fetch ALL approved startups (paginated)
    console.log('📥 Fetching all startups...');
    let allStartups = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('id, name, sectors, stage, total_god_score')
        .eq('status', 'approved')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw new Error(`Startup fetch error: ${error.message}`);
      if (!data || data.length === 0) break;
      
      allStartups = allStartups.concat(data);
      console.log(`   Fetched ${allStartups.length} startups...`);
      
      if (data.length < pageSize) break; // Last page
      page++;
    }
    
    // Fetch ALL investors (paginated)
    console.log('📥 Fetching all investors...');
    let allInvestors = [];
    page = 0;
    
    while (true) {
      const { data, error } = await supabase
        .from('investors')
        .select('id, name, sectors, stage, investor_score, investor_tier')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw new Error(`Investor fetch error: ${error.message}`);
      if (!data || data.length === 0) break;
      
      allInvestors = allInvestors.concat(data);
      console.log(`   Fetched ${allInvestors.length} investors...`);
      
      if (data.length < pageSize) break; // Last page
      page++;
    }
    
    const startups = allStartups;
    const investors = allInvestors;
    
    console.log(`\n📊 Found ${startups.length} startups × ${investors.length} investors`);
    
    if (startups.length === 0 || investors.length === 0) {
      console.log('⚠️  No data to match');
      return;
    }
    
    // NOTE: DO NOT DELETE existing matches - use upsert to update them instead
    // This preserves matches for startups not in the current run
    console.log('💾 Using upsert to update existing matches (preserving all matches)\n');
    
    // Generate new matches - keep only TOP_MATCHES_PER_STARTUP per startup
    const allMatches = [];
    let processed = 0;
    
    for (const startup of startups) {
      // Calculate scores for all investors for this startup
      const startupMatches = [];
      
      for (const investor of investors) {
        const sectorScore = calculateSectorMatch(startup.sectors, investor.sectors);
        const stageScore = calculateStageMatch(startup.stage, investor.stage);
        const investorQuality = calculateInvestorQuality(investor.investor_score, investor.investor_tier);
        const startupQuality = calculateStartupQuality(startup.total_god_score);
        
        const totalScore = sectorScore + stageScore + investorQuality + startupQuality;
        
        if (totalScore >= CONFIG.MIN_MATCH_SCORE) {
          const fitAnalysis = {
            sector: sectorScore,
            stage: stageScore,
            investor_quality: investorQuality,
            startup_quality: startupQuality,
            tier: investor.investor_tier
          };
          
          startupMatches.push({
            startup_id: startup.id,
            investor_id: investor.id,
            match_score: totalScore,
            status: 'suggested',
            confidence_level: totalScore >= 70 ? 'high' : totalScore >= 50 ? 'medium' : 'low',
            fit_analysis: fitAnalysis,
            reasoning: generateReasoning(startup, investor, fitAnalysis),
            why_you_match: generateWhyYouMatch(startup, investor, fitAnalysis)
          });
        }
      }
      
      // Sort and keep only top N matches for this startup
      startupMatches.sort((a, b) => b.match_score - a.match_score);
      const topMatches = startupMatches.slice(0, CONFIG.TOP_MATCHES_PER_STARTUP);
      allMatches.push(...topMatches);
      
      processed++;
      if (processed % 100 === 0) {
        process.stdout.write(`\r   Processed ${processed}/${startups.length} startups...`);
      }
    }
    
    console.log(`\n\n📦 Saving ${allMatches.length} matches...`);
    
    // Batch insert
    let saved = 0;
    for (let i = 0; i < allMatches.length; i += CONFIG.BATCH_SIZE) {
      const batch = allMatches.slice(i, i + CONFIG.BATCH_SIZE);
      
      // Use upsert to handle any duplicate key conflicts
      const { error: insErr } = await supabase
        .from('startup_investor_matches')
        .upsert(batch, { 
          onConflict: 'startup_id,investor_id',
          ignoreDuplicates: false 
        });
      
      if (insErr) {
        console.error(`   Batch ${Math.floor(i/CONFIG.BATCH_SIZE)+1} error:`, insErr.message);
      } else {
        saved += batch.length;
      }
      
      process.stdout.write(`\r   Saved ${saved}/${allMatches.length}`);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n\n' + '═'.repeat(60));
    console.log('✅ MATCH REGENERATION COMPLETE');
    console.log('═'.repeat(60));
    console.log(`   Startups: ${startups.length}`);
    console.log(`   Investors: ${investors.length}`);
    console.log(`   Matches: ${saved}`);
    console.log(`   High confidence: ${allMatches.filter(m => m.confidence_level === 'high').length}`);
    console.log(`   Time: ${elapsed}s`);
    console.log('═'.repeat(60) + '\n');
    
    // Log to monitoring table (ignore errors)
    await supabase.from('system_logs').insert({
      event: 'match_regeneration',
      details: {
        startups: startups.length,
        investors: investors.length,
        matches: saved,
        elapsed_seconds: parseFloat(elapsed)
      }
    }).then(() => {}).catch(() => {}); // Ignore if table doesn't exist
    
  } catch (error) {
    console.error('❌ Match regeneration failed:', error.message);
    process.exit(1);
  }
}

// Run
regenerateMatches().then(() => {
  console.log('🏁 Done');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
