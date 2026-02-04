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

// Create Supabase client with higher row limit for large signal fetches
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-my-custom-header': 'match-regenerator' },
    },
  }
);

// Matching configuration
const CONFIG = {
  SECTOR_MATCH: 40,      // Increased: sector alignment is most critical
  STAGE_MATCH: 20,
  GEO_MATCH: 5,          // Reduced: geography less important (modern VC is global)
  INVESTOR_QUALITY: 20,  // Reduced slightly 
  STARTUP_QUALITY: 25,   // Increased: GOD score matters more
  SIGNAL_BONUS: 10,      // NEW: Market signal bonus (0-10 from startup_signals)
  MIN_MATCH_SCORE: 45,   // ⚠️ UI LABEL ONLY - not used as persistence gate (see PERSISTENCE_FLOOR: 30)
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

// NORMALIZATION UTILITIES (centralized, run once)
function normToken(s) {
  if (s == null) return null;
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

function normTokenList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normToken).filter(Boolean);
}

function normalizeStr(s) {
  if (!s) return '';
  if (typeof s === 'string') return s.toLowerCase().trim();
  if (Array.isArray(s)) return s.map(x => String(x).toLowerCase().trim());
  return String(s).toLowerCase().trim();
}

/**
 * Calculate sector match with reasoning
 * @param {string[]} startupSectors - normalized sector list
 * @param {string[]} investorSectors - normalized sector list
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (0-40)
 */
function calculateSectorMatch(startupSectors, investorSectors, reasons = []) {
  if (!startupSectors || !investorSectors || !startupSectors.length || !investorSectors.length) {
    reasons.push({ key: 'sector', points: 5, note: 'Missing sector data → fallback' });
    return 5;
  }
  
  let matches = 0;
  const matchDetails = [];
  
  for (const ss of startupSectors) {
    for (const is of investorSectors) {
      if (ss === is) {
        matches++;
        matchDetails.push(`EXACT: ${ss}`);
        continue;
      }
      if (ss.includes(is) || is.includes(ss)) {
        matches++;
        matchDetails.push(`PARTIAL: ${ss} ↔ ${is}`);
        continue;
      }
      // Check synonyms
      for (const [key, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
        const allTerms = [key, ...synonyms];
        if (allTerms.some(t => ss.includes(t)) && allTerms.some(t => is.includes(t))) {
          matches++;
          matchDetails.push(`SYNONYM: ${ss} ↔ ${is} (via ${key})`);
          break;
        }
      }
    }
  }
  
  const score = Math.min(matches * 10, CONFIG.SECTOR_MATCH);
  const note = matches > 0 
    ? `${matches} sector match${matches > 1 ? 'es' : ''}: ${matchDetails.slice(0, 2).join(', ')}`
    : `No sector overlap (startup: ${startupSectors.join(', ')} | investor: ${investorSectors.join(', ')})`;
  
  reasons.push({ key: 'sector', points: score, note });
  return score;
}

// Map numeric stages to string stages
const STAGE_MAP = {
  0: 'Pre-Seed',
  1: 'Seed',
  2: 'Series A',
  3: 'Series B',
  4: 'Series C',
  5: 'Growth'
};

/**
 * Normalize startup data and detect missing fields
 */
function normalizeStartup(s, flags = []) {
  const sectors = normTokenList(s.sectors);
  if (!sectors.length) flags.push('startup_sectors_missing');

  const stage = (typeof s.stage === 'number') ? STAGE_MAP[s.stage] : s.stage;
  const stageNorm = normToken(stage);
  if (!stageNorm) flags.push('startup_stage_missing');

  const godScore = Number.isFinite(Number(s.total_god_score)) ? Number(s.total_god_score) : null;
  if (godScore == null) flags.push('startup_god_score_missing');

  return {
    id: s.id,
    name: s.name,
    sectors,
    stage: stageNorm,
    geo: normToken(s.location || s.region || s.geography),
    godScore,
  };
}

/**
 * Normalize investor data and detect missing fields
 */
function normalizeInvestor(i, flags = []) {
  const sectors = normTokenList(i.sectors);
  if (!sectors.length) flags.push('investor_sectors_missing');

  // investor.stage could be string or array; normalize to list
  const stagesRaw = Array.isArray(i.stage) ? i.stage : (i.stage ? [i.stage] : []);
  const stages = stagesRaw
    .map(x => (typeof x === 'number' ? STAGE_MAP[x] : x))
    .map(normToken)
    .filter(Boolean);

  if (!stages.length) flags.push('investor_stages_missing');

  return {
    id: i.id,
    name: i.name,
    sectors,
    stages,
    geo: normToken(i.geography || i.location || i.region),
    score: Number.isFinite(Number(i.investor_score)) ? Number(i.investor_score) : null,
    tier: normToken(i.investor_tier),
  };
}

/**
 * Calculate stage match with reasoning
 * @param {string} startupStage - normalized stage token
 * @param {string[]} investorStages - normalized stage list
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (5 or 20)
 */
function calculateStageMatch(startupStage, investorStages, reasons = []) {
  const s = normToken(startupStage);
  const iStages = Array.isArray(investorStages) ? investorStages.map(normToken).filter(Boolean) : [];
  
  if (!s || !iStages.length) {
    reasons.push({ key: 'stage', points: 5, note: 'Missing stage data → fallback' });
    return 5;
  }
  
  // Normalize for comparison (remove hyphens/spaces)
  const sNorm = s.replace(/[-_\s]/g, '');
  const iNorms = iStages.map(x => x.replace(/[-_\s]/g, ''));
  
  if (iNorms.some(is => is === sNorm || is.includes(sNorm) || sNorm.includes(is))) {
    reasons.push({ key: 'stage', points: CONFIG.STAGE_MATCH, note: `${s} ↔ ${iStages.join('|')} ✓` });
    return CONFIG.STAGE_MATCH;
  }
  
  reasons.push({ key: 'stage', points: 5, note: `No match: ${s} vs ${iStages.join('|')}` });
  return 5;
}

/**
 * Calculate investor quality with reasoning
 * @param {number} score - investor score (0-10)
 * @param {string} tier - investor tier
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (0-20)
 */
function calculateInvestorQuality(score, tier, reasons = []) {
  const baseScore = (score || 5) * 2; // 0-20 from score
  const tierBonus = { elite: 5, strong: 3, solid: 1, emerging: 0 }[tier] || 0;
  const total = Math.min(baseScore + tierBonus, CONFIG.INVESTOR_QUALITY);
  
  const note = tier ? `Tier: ${tier} (${tierBonus} bonus) + score ${score}/10` : `Score: ${score}/10`;
  reasons.push({ key: 'investor_quality', points: total, note });
  return total;
}

/**
 * Calculate startup quality from GOD score with reasoning
 * @param {number} godScore - GOD score (40-100)
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (8-25)
 */
function calculateStartupQuality(godScore, reasons = []) {
  if (!godScore || godScore < 40) {
    reasons.push({ key: 'startup_quality', points: 8, note: 'GOD score missing/low → fallback' });
    return 8;
  }
  // Map GOD score 40-100 to quality 10-25
  const normalized = Math.max(0, (godScore - 40) / 60); // 0-1 scale
  const quality = Math.round(10 + normalized * 15); // 10-25 range
  
  reasons.push({ key: 'startup_quality', points: quality, note: `GOD ${godScore} → quality ${quality}` });
  return quality;
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
  
  // Signal reasoning (NEW)
  if (fitAnalysis.signal >= 8) {
    reasons.push(`High market signal: strong momentum and investor interest detected`);
  } else if (fitAnalysis.signal >= 6) {
    reasons.push(`Emerging market signal: positive momentum building`);
  } else if (fitAnalysis.signal >= 4) {
    reasons.push(`Early market signal: initial traction indicators present`);
  }
  
  // Tier-specific reasoning
  if (fitAnalysis.tier === 'elite') {
    reasons.push(`Elite investor match - high-conviction opportunity`);
  }
  
  return reasons.slice(0, 5).join('. ') + '.';
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
  
  if (fitAnalysis.signal >= 7) {
    matches.push(`Signal: Strong (${fitAnalysis.signal}/10)`);
  } else if (fitAnalysis.signal >= 5) {
    matches.push(`Signal: Emerging (${fitAnalysis.signal}/10)`);
  }
  
  if (fitAnalysis.startup_quality >= 18) {
    matches.push(`GOD Score: ${startup.total_god_score || 'N/A'}`);
  }
  
  return matches.length > 0 ? matches : ['Algorithmic match'];
}

/**
 * Load signal scores for all startups (from startup_signal_scores table)
 * Returns Map<startup_id, signal_score_0_10>
 */
async function loadSignalScores() {
  console.log('📡 Loading signal scores...');
  
  // Read from pre-aggregated startup_signal_scores table (5k+ rows)
  // Use pagination to handle Supabase 1000 row limit
  let allScores = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_signal_scores')
      .select('startup_id, signals_total')
      .order('startup_id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.log(`   Error fetching signal scores page ${page}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    
    allScores = allScores.concat(data);
    
    if (data.length < pageSize) break;
    page++;
  }
  
  if (allScores.length === 0) {
    console.log('   ⚠️ No signal scores available');
    return new Map();
  }
  
  const scoreMap = new Map();
  for (const row of allScores) {
    scoreMap.set(row.startup_id, parseFloat(row.signals_total) || 0);
  }
  
  const avgScore = scoreMap.size > 0 
    ? (Array.from(scoreMap.values()).reduce((a,b) => a+b, 0) / scoreMap.size).toFixed(1) 
    : 0;
  console.log(`   ✅ Loaded ${scoreMap.size} signal scores (avg: ${avgScore}/10)`);
  return scoreMap;
}

async function regenerateMatches() {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(60));
  console.log('🔄 AUTO MATCH REGENERATION (with Signal Scoring)');
  console.log('═'.repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  
  try {
    // Load signal scores first
    const signalScores = await loadSignalScores();
    
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
    
    // ✅ RANK-FIRST PATTERN: score all, sort, save top N
    const allMatches = [];
    let processed = 0;
    const PERSISTENCE_FLOOR = 30; // Very low floor to avoid garbage
    
    for (const startup of startups) {
      // Normalize startup once
      const flags = [];
      const startupNorm = normalizeStartup(startup, flags);
      
      // Get signal score for this startup (0-10)
      const signalScore = signalScores.get(startup.id) || 0;
      
      // Score ALL investors for this startup
      const scoredMatches = [];
      
      for (const investor of investors) {
        // Normalize investor once
        const investorNorm = normalizeInvestor(investor, flags);
        
        // Calculate scores with Match Trace
        const reasons = [];
        const terms = {};
        
        terms.sector = calculateSectorMatch(startupNorm.sectors, investorNorm.sectors, reasons);
        terms.stage = calculateStageMatch(startupNorm.stage, investorNorm.stages, reasons);
        terms.investor_quality = calculateInvestorQuality(investorNorm.score, investorNorm.tier, reasons);
        terms.startup_quality = calculateStartupQuality(startupNorm.godScore, reasons);
        terms.signal = Math.round(signalScore); // 0-10 → add directly
        
        // Add signal to reasons
        if (signalScore >= 7) {
          reasons.push({ key: 'signal', points: terms.signal, note: `Strong market signal (${signalScore.toFixed(1)}/10)` });
        } else if (signalScore >= 5) {
          reasons.push({ key: 'signal', points: terms.signal, note: `Emerging market signal (${signalScore.toFixed(1)}/10)` });
        } else if (signalScore > 0) {
          reasons.push({ key: 'signal', points: terms.signal, note: `Early market signal (${signalScore.toFixed(1)}/10)` });
        }
        
        const totalScore = terms.sector + terms.stage + terms.investor_quality + terms.startup_quality + terms.signal;
        
        // Generate human-readable fields
        const fitAnalysis = { ...terms };
        const reasoning = generateReasoning(startup, investor, terms);
        const whyYouMatch = generateWhyYouMatch(startup, investor, terms);
        
        // Cap at 100 to satisfy DB constraint (formula max is 115)
        const cappedScore = Math.min(totalScore, 100);
        
        scoredMatches.push({
          startup_id: startup.id,
          investor_id: investor.id,
          match_score: cappedScore,
          status: 'suggested',
          confidence_level: cappedScore >= 75 ? 'high' : cappedScore >= 55 ? 'medium' : 'low',
          fit_analysis: fitAnalysis,
          reasoning: reasoning,
          why_you_match: whyYouMatch
        });
      }
      
      // ✅ STABLE SORT: (-score, investor_id)
      scoredMatches.sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        return String(a.investor_id).localeCompare(String(b.investor_id));
      });
      
      // ✅ RANK-FIRST: filter low floor, then take top N
      const topMatches = scoredMatches
        .filter(m => m.match_score >= PERSISTENCE_FLOOR)
        .slice(0, CONFIG.TOP_MATCHES_PER_STARTUP);
      
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
