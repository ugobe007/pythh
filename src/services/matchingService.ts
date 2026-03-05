/**
 * INTEGRATED MATCHING SERVICE
 * Combines GOD algorithm (startup scoring) with AI-powered investor matching
 * 
 * MATCHING MODES:
 * 1. GOD Algorithm Only - Rule-based scoring (default)
 * 2. Semantic Matching - Vector embedding similarity (Option 2)
 * 3. Hybrid - 60% GOD + 40% Semantic (best results)
 */

import { calculateHotScore } from '../../server/services/startupScoringService';
import { getTeamReason, getTractionReason, getMarketReason, getProductReason } from './matchingHelpers';
import { findSemanticInvestorMatches, hasEmbedding } from './semanticMatchingService';
import { Startup, StartupComponent } from '../types';
import { adaptStartupForComponent } from '../utils/startupAdapters';

// Debug logging controls
const DEBUG_GOD = true; // Set to false in production

/**
 * DATA NORMALIZATION FUNCTIONS
 * These ensure consistent field access regardless of data source (direct fields vs extracted_data)
 * 
 * @deprecated Use adaptStartupForComponent() from '@/utils/startupAdapters' for new code
 * This function is kept for backward compatibility with existing matching logic
 */

/**
 * Normalize startup data to consistent format
 * Handles fallback from startup.field to startup.extracted_data.field
 * 
 * @deprecated Use adaptStartupForComponent() instead
 */
function normalizeStartupData(startup: Startup | StartupComponent | any) {
  const extracted = startup.extracted_data || {};
  
  return {
    // Basic info
    id: startup.id,
    name: startup.name,
    description: startup.description || startup.tagline || extracted.description || '',
    tagline: startup.tagline || extracted.tagline || '',
    
    // Stage and funding
    stage: startup.stage ?? extracted.stage ?? 0,
    raise_amount: startup.raise_amount || startup.raise || extracted.raise || extracted.raise_amount || '',
    funding_needed: startup.funding_needed || startup.raise || extracted.raise || '',
    previous_funding: startup.previous_funding || startup.raised || extracted.raised || 0,
    
    // Team data (critical for GOD algorithm)
    team: startup.team || extracted.team || [],
    founders_count: startup.founders_count || extracted.founders_count || startup.team?.length || 1,
    technical_cofounders: startup.technical_cofounders || extracted.technical_cofounders || 0,
    
    // Traction data (critical for GOD algorithm)
    traction: startup.traction || extracted.traction || '',
    revenue: startup.revenue || startup.arr || extracted.revenue || extracted.arr || 0,
    mrr: startup.mrr || extracted.mrr || (startup.arr ? startup.arr / 12 : 0),
    arr: startup.arr || extracted.arr || 0,
    active_users: startup.users || startup.active_users || extracted.users || extracted.active_users || 0,
    growth_rate: startup.growth_rate || startup.mom_growth || extracted.growth_rate || extracted.mom_growth || 0,
    customers: startup.customers || extracted.customers || 0,
    
    // Market data (critical for GOD algorithm)
    sectors: startup.sectors || startup.industries || extracted.sectors || extracted.industries || [],
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    market_size: startup.market_size || extracted.market || extracted.market_size || 0,
    
    // Product data
    pitch: startup.pitch || extracted.pitch || startup.description || '',
    problem: startup.problem || extracted.problem || '',
    solution: startup.solution || extracted.solution || '',
    demo_available: startup.demo_available || extracted.demo_available || false,
    launched: startup.launched || extracted.launched || false,
    unique_ip: startup.unique_ip || extracted.unique_ip || false,
    defensibility: startup.defensibility || extracted.defensibility || 'medium',
    
    // Additional fields
    fivePoints: extracted.fivePoints || startup.fivePoints || [],
    location: startup.location || extracted.location || '',
    website: startup.website || extracted.website || '',
    backed_by: startup.backed_by || startup.investors || extracted.investors || [],
    
    // First Round criteria
    contrarian_insight: startup.contrarian_insight || extracted.contrarian_insight,
    creative_strategy: startup.creative_strategy || extracted.creative_strategy,
    passionate_customers: startup.passionate_customers || extracted.passionate_customers || 0,
    
    // Funding velocity and repeat founder fields (for bonus calculations)
    funding_velocity_score: startup.funding_velocity_score || extracted.funding_velocity_score,
    funding_rounds_count: startup.funding_rounds_count || extracted.funding_rounds_count,
    has_repeat_founder_with_exit: startup.has_repeat_founder_with_exit || extracted.has_repeat_founder_with_exit,
    founder_previous_exits: startup.founder_previous_exits || extracted.founder_previous_exits,
  };
}

/**
 * Normalize investor data to consistent format
 * Handles different field naming conventions (checkSize vs check_size, etc.)
 * Database columns: sectors, stage (correct names)
 */
function normalizeInvestorData(investor: any) {
  // Use correct database column names: sectors, stage
  const sectors = investor.sectors || [];
  const stages = investor.stage || investor.stages || [];
  
  return {
    // Basic info
    id: investor.id,
    name: investor.name,
    description: investor.description || investor.tagline || investor.bio || '',
    tagline: investor.tagline || investor.type || '',
    firm: investor.firm || '',
    bio: investor.bio || investor.investment_thesis || '',
    photo_url: investor.photo_url || '',
    
    // Investment criteria - use sectors and stage from DB
    type: investor.type || 'vc_firm',
    sectors: Array.isArray(sectors) ? sectors : (sectors ? [sectors] : []),
    stages: Array.isArray(stages) ? stages : (stages ? [stages] : []),
    stage: Array.isArray(stages) ? stages : (stages ? [stages] : []),
    
    // Financial
    checkSize: investor.checkSize || investor.check_size || '',
    check_size: investor.check_size || investor.checkSize || '',
    check_size_min: investor.check_size_min,
    check_size_max: investor.check_size_max,
    active_fund_size: investor.active_fund_size,
    
    // Geographic
    geography: investor.geography || investor.geography_focus?.join(', ') || investor.location || '',
    geography_focus: investor.geography_focus || [],
    location: investor.location || investor.geography || '',
    
    // Portfolio info
    notableInvestments: investor.notable_investments || investor.notableInvestments || [],
    notable_investments: investor.notable_investments || investor.notableInvestments || [],
    portfolio_size: investor.portfolio_size || investor.total_investments || 0,
    total_investments: investor.total_investments || investor.portfolio_size || 0,

    // Market intelligence / capital deployment signals
    deployment_velocity_index: investor.deployment_velocity_index ?? null,
    dry_powder_estimate: investor.dry_powder_estimate ?? null,
    capital_power_score: investor.capital_power_score ?? null,
    fund_size_estimate_usd: investor.fund_size_estimate_usd ?? null,
    last_investment_date: investor.last_investment_date ?? null,
  };
}

function logGOD(message: string, data?: any) {
  if (DEBUG_GOD) {
    if (data !== undefined) {
      console.log(`🧮 GOD: ${message}`, data);
    } else {
      console.log(`🧮 GOD: ${message}`);
    }
  }
}

function logScore(label: string, score: number, reason?: string) {
  if (DEBUG_GOD) {
    const paddedLabel = label.padEnd(20);
    const paddedScore = score.toString().padStart(3);
    const reasonText = reason ? ` (${reason})` : '';
    console.log(`   📊 ${paddedLabel} ${paddedScore}${reasonText}`);
  }
}

interface MatchPair {
  startup: {
    id: number | string;
    name: string;
    description: string;
    tags: string[];
    seeking: string;
    status: string;
  };
  investor: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    checkSize: string;
    status: string;
  };
  matchScore: number;
  reasoning: string[];
}

/**
 * Calculate match score using the GOD algorithm
 */
export function calculateAdvancedMatchScore(startup: any, investor: any, verbose: boolean = false): number {
  try {
    // 🚀 CRITICAL FIX: Use pre-calculated total_god_score from database
    // The startup records already have GOD scores calculated (0-100 scale)
    // If available, use it directly instead of recalculating
    if (startup.total_god_score !== undefined && startup.total_god_score > 0) {
      const baseScore = startup.total_god_score;
      
      if (verbose) {
        console.log(`\n${'━'.repeat(60)}`);
        console.log(`🧮 Using Pre-Calculated GOD Score: "${startup.name}"`);
        console.log(`   Base Score: ${baseScore}/100 (from database)`);
        console.log('━'.repeat(60));
      }
      
      // Still apply matching bonuses with investor
      const normalizedInvestor = normalizeInvestorData(investor);
      let matchBonus = 0;
      let hasStageMatch = false;
      let hasSectorMatch = false;
      
      // Stage match bonus (REDUCED from +10 to +5)
      if (normalizedInvestor.stage && startup.stage !== undefined) {
        const investorStages = Array.isArray(normalizedInvestor.stage) ? normalizedInvestor.stage : [normalizedInvestor.stage];
        const stageNum = typeof startup.stage === 'number' ? startup.stage : convertStageToNumber(startup.stage);
        let startupStageNames: string[] = [];
        
        if (stageNum === 0) startupStageNames = ['idea', 'pre-seed', 'preseed', '0'];
        else if (stageNum === 1) startupStageNames = ['pre-seed', 'preseed', 'pre seed', '1'];
        else if (stageNum === 2) startupStageNames = ['seed', '2'];
        else if (stageNum === 3) startupStageNames = ['series a', 'series_a', 'seriesa', 'a', '3'];
        else if (stageNum === 4) startupStageNames = ['series b', 'series_b', 'seriesb', 'b', '4'];
        else if (stageNum === 5) startupStageNames = ['series c', 'series_c', 'seriesc', 'c', '5'];
        
        const stageMatch = investorStages.some((s: string) => {
          const investorStage = String(s).toLowerCase().replace(/[_\s]/g, '');
          return startupStageNames.some(startupStage => {
            const normalizedStartupStage = startupStage.replace(/[_\s]/g, '');
            return investorStage === normalizedStartupStage || // Exact match first
                   investorStage.includes(normalizedStartupStage) || 
                   normalizedStartupStage.includes(investorStage);
          });
        });
        
        if (stageMatch) {
          hasStageMatch = true;
          matchBonus += 5; // REDUCED from 10 to 5
          if (verbose) console.log(`   Stage Match:        +5`);
        } else if (verbose) {
          console.log(`   Stage Match:        +0`);
        }
      }
      
      // Sector match bonus (TIGHTENED - uses strict matching, REDUCED from +15 to +8)
      if (startup.industries && normalizedInvestor.sectors) {
        const startupIndustries = Array.isArray(startup.industries) ? startup.industries : [startup.industries];
        const investorSectors = Array.isArray(normalizedInvestor.sectors) ? normalizedInvestor.sectors : [normalizedInvestor.sectors];
        
        // Strict sector matching - exact match or known synonyms only
        const commonSectors = calculateStrictSectorMatch(startupIndustries, investorSectors);
        const sectorBonus = Math.min(commonSectors.length * 3, 8); // REDUCED: 3 points per match, max 8 (was 5 per match, max 15)
        if (commonSectors.length > 0) {
          hasSectorMatch = true;
          matchBonus += sectorBonus;
          if (verbose) {
            console.log(`   Sector Match:       +${sectorBonus} (${commonSectors.join(', ')})`);
          }
        } else if (verbose) {
          console.log(`   Sector Match:       +0`);
        }
      }
      
      // 🎯 INVESTOR QUALITY BONUS (CONDITIONAL - only if there's actual fit)
      // Only apply if there's at least a stage OR sector match (shows real fit)
      let investorBonus = 0;
      if (hasStageMatch || hasSectorMatch) {
        const investorTier = investor.investor_tier || investor.tier || 'emerging';
        const investorScore = investor.investor_score || 0;
        
        // Tier-based bonus (REDUCED amounts)
        if (investorTier === 'elite') {
          investorBonus += 4; // REDUCED from 8 to 4
          if (verbose) console.log(`   Investor Quality:   +4 (Elite tier - conditional)`);
        } else if (investorTier === 'strong') {
          investorBonus += 2; // REDUCED from 5 to 2
          if (verbose) console.log(`   Investor Quality:   +2 (Strong tier - conditional)`);
        } else if (investorTier === 'solid') {
          investorBonus += 1; // REDUCED from 3 to 1
          if (verbose) console.log(`   Investor Quality:   +1 (Solid tier - conditional)`);
        }
        // Emerging gets 0 bonus now
        
        // Additional bonus for high investor scores (REDUCED)
        if (investorScore >= 9) {
          investorBonus += 1; // REDUCED from 2 to 1
          if (verbose) console.log(`   Investor Score:     +1 (Score: ${investorScore}/10)`);
        } else if (investorScore >= 7) {
          investorBonus += 0.5; // REDUCED from 1 to 0.5
          if (verbose) console.log(`   Investor Score:     +0.5 (Score: ${investorScore}/10)`);
        }

        // 🔥 DEPLOYMENT VELOCITY BONUS
        // Hot investors (recently deployed capital) get a small boost to surface to founders.
        // Only applies when real fit exists (stage or sector match above).
        const velocity = investor.deployment_velocity_index ?? normalizedInvestor.deployment_velocity_index;
        if (velocity !== null && velocity !== undefined) {
          let velocityBonus = 0;
          if (velocity >= 75)      velocityBonus = 3; // Hot — deal in last 30-90 days
          else if (velocity >= 50) velocityBonus = 2; // Active — recent deployment
          else if (velocity >= 35) velocityBonus = 1; // Moderate — has some activity
          if (velocityBonus > 0) {
            investorBonus += velocityBonus;
            if (verbose) console.log(`   Deploy Velocity:    +${velocityBonus} (velocity: ${velocity}/100)`);
          } else if (verbose) {
            console.log(`   Deploy Velocity:    +0 (velocity: ${velocity}/100 — slow)`);
          }
        }
      } else if (verbose) {
        console.log(`   Investor Quality:   +0 (no fit - conditional bonus not applied)`);
      }
      
      matchBonus += Math.round(investorBonus);
      
      // Check size fit bonus (REDUCED from +5 to +3)
      if (normalizedInvestor.checkSize && startup.raise_amount) {
        const raiseAmount = parseFloat(String(startup.raise_amount).replace(/[^0-9.]/g, ''));
        const checkSizeRange = normalizedInvestor.checkSize;
        
        if (checkSizeRange) {
          const checkSizeLower = String(checkSizeRange).toLowerCase();
          if (
            (raiseAmount >= 0.5 && raiseAmount <= 2 && checkSizeLower.includes('seed')) ||
            (raiseAmount >= 2 && raiseAmount <= 10 && checkSizeLower.includes('series')) ||
            checkSizeLower.includes(String(raiseAmount))
          ) {
            matchBonus += 3; // REDUCED from 5 to 3
            if (verbose) console.log(`   Check Size Fit:     +3`);
          } else if (verbose) {
            console.log(`   Check Size Fit:     +0`);
          }
        }
      }
      
      // Geography match (REDUCED from +2 to +1, less important)
      if (normalizedInvestor.geography && startup.location) {
        const investorGeo = Array.isArray(normalizedInvestor.geography) ? normalizedInvestor.geography : [normalizedInvestor.geography];
        const locationMatch = investorGeo.some((geo: string) =>
          String(startup.location).toLowerCase().includes(String(geo).toLowerCase()) ||
          String(geo).toLowerCase().includes(String(startup.location).toLowerCase())
        );
        if (locationMatch) {
          matchBonus += 1; // REDUCED from 2 to 1
          if (verbose) console.log(`   Geography Match:    +1`);
        }
      }
      
      // 🚀 FUNDING VELOCITY BONUS (NEW - emphasizes fast-growing startups)
      // High velocity = raising rounds quickly = strong investor interest
      if (startup.funding_velocity_score !== undefined || startup.funding_rounds_count) {
        const velocityBonus = calculateFundingVelocityBonus(startup);
        if (velocityBonus > 0) {
          matchBonus += velocityBonus;
          if (verbose) {
            console.log(`   Funding Velocity:   +${velocityBonus} (${startup.funding_rounds_count || 'N/A'} rounds, fast growth)`);
          }
        }
      }
      
      // 🏆 REPEAT FOUNDER WITH EXIT BONUS (NEW - emphasizes proven founders)
      // Founders with previous successful exits are highly valued by investors
      if (startup.has_repeat_founder_with_exit || startup.founder_previous_exits) {
        const repeatFounderBonus = calculateRepeatFounderBonus(startup);
        if (repeatFounderBonus > 0) {
          matchBonus += repeatFounderBonus;
          if (verbose) {
            const exitCount = startup.founder_previous_exits || (startup.has_repeat_founder_with_exit ? 1 : 0);
            console.log(`   Repeat Founder:    +${repeatFounderBonus} (${exitCount} previous exit${exitCount > 1 ? 's' : ''})`);
          }
        }
      }
      
      // Calculate final score (cap at 100 instead of 99)
      const finalScore = Math.min(baseScore + matchBonus, 100);
      
      if (verbose) {
        console.log(`\n   ─────────────────────────────`);
        console.log(`   Base Score (GOD):   ${baseScore}/100`);
        console.log(`   Match Bonuses:      +${matchBonus}`);
        console.log(`   Final Score:        ${finalScore}/100`);
        console.log('━'.repeat(60));
      }
      
      return Math.round(finalScore);
    }
    
    // FALLBACK: Calculate GOD score if not pre-calculated
    const normalizedStartup = normalizeStartupData(startup);
    const normalizedInvestor = normalizeInvestorData(investor);
    
    if (verbose) {
      console.log(`\n${'━'.repeat(60)}`);
      console.log(`🧮 GOD Algorithm Scoring: "${normalizedStartup.name}"`);
      console.log('━'.repeat(60));
      
      // Log input data for debugging
      logGOD('Normalized Startup Data:', {
        stage: normalizedStartup.stage,
        sectors: normalizedStartup.sectors,
        raise: normalizedStartup.raise_amount,
        team: normalizedStartup.team ? `${normalizedStartup.team.length} members` : 'undefined',
        revenue: normalizedStartup.revenue || 'undefined',
        traction: normalizedStartup.traction ? normalizedStartup.traction.substring(0, 50) + '...' : 'undefined'
      });
    }
    
    // Convert normalized startup data to StartupProfile format for GOD algorithm
    const startupProfile = {
      // Team data - using normalized fields
      team: normalizedStartup.team,
      founders_count: normalizedStartup.founders_count,
      technical_cofounders: normalizedStartup.technical_cofounders,
      
      // Traction - using normalized fields
      revenue: normalizedStartup.revenue,
      mrr: normalizedStartup.mrr,
      active_users: normalizedStartup.active_users,
      growth_rate: normalizedStartup.growth_rate,
      customers: normalizedStartup.customers,
      
      // Product - using normalized fields
      demo_available: normalizedStartup.demo_available,
      launched: normalizedStartup.launched,
      unique_ip: normalizedStartup.unique_ip,
      defensibility: normalizedStartup.defensibility,
      
      // Market - using normalized fields
      market_size: normalizedStartup.market_size,
      industries: normalizedStartup.industries,
      problem: normalizedStartup.problem,
      solution: normalizedStartup.solution,
      
      // First Round criteria
      contrarian_insight: normalizedStartup.contrarian_insight,
      creative_strategy: normalizedStartup.creative_strategy,
      passionate_customers: normalizedStartup.passionate_customers,
      
      // Stage & Funding - using normalized fields
      stage: convertStageToNumber(normalizedStartup.stage),
      previous_funding: normalizedStartup.previous_funding,
      backed_by: normalizedStartup.backed_by,
      funding_needed: normalizedStartup.funding_needed,
    };

    // Get GOD score
    const godScore = calculateHotScore(startupProfile);
    
    if (verbose) {
      console.log('\n📊 Component Scores:');
      
      // Calculate percentage scores for display
      const teamPct = (godScore.breakdown.team / 3 * 100).toFixed(0);
      const tractionPct = (godScore.breakdown.traction / 3 * 100).toFixed(0);
      const marketPct = (godScore.breakdown.market / 2 * 100).toFixed(0);
      const productPct = (godScore.breakdown.product / 2 * 100).toFixed(0);
      const visionPct = (godScore.breakdown.vision / 2 * 100).toFixed(0);
      const ecosystemPct = (godScore.breakdown.ecosystem / 1.5 * 100).toFixed(0);
      const gritPct = (godScore.breakdown.grit / 1.5 * 100).toFixed(0);
      const problemPct = (godScore.breakdown.problem_validation / 2 * 100).toFixed(0);
      
      // Generate reasons for each score
      const teamReason = getTeamReason(startupProfile, godScore.breakdown.team);
      const tractionReason = getTractionReason(startupProfile, godScore.breakdown.traction);
      const marketReason = getMarketReason(startupProfile, godScore.breakdown.market);
      const productReason = getProductReason(startupProfile, godScore.breakdown.product);
      
      logScore('Team', Number(teamPct), teamReason);
      logScore('Traction', Number(tractionPct), tractionReason);
      logScore('Market', Number(marketPct), marketReason);
      logScore('Product', Number(productPct), productReason);
      logScore('Vision', Number(visionPct), `${godScore.breakdown.vision.toFixed(1)}/2`);
      logScore('Ecosystem', Number(ecosystemPct), `${godScore.breakdown.ecosystem.toFixed(1)}/1.5`);
      logScore('Grit', Number(gritPct), `${godScore.breakdown.grit.toFixed(1)}/1.5`);
      logScore('Problem Validation', Number(problemPct), `${godScore.breakdown.problem_validation.toFixed(1)}/2`);
      
      console.log(`\n   GOD Base Score:     ${godScore.total.toFixed(1)}/10 (${(godScore.total * 10).toFixed(0)}/100)`);
      
      // Show reasoning from GOD algorithm
      if (godScore.reasoning && godScore.reasoning.length > 0) {
        console.log(`\n💡 GOD Algorithm Insights:`);
        godScore.reasoning.slice(0, 3).forEach((reason: string) => {
          console.log(`   • ${reason}`);
        });
      }
    }
    
    // Base score from GOD algorithm (0-10 scale, convert to 0-100)
    let baseScore = godScore.total * 10;
    
    // Additional matching criteria with investor
    let matchBonus = 0;
    
    if (verbose) {
      console.log(`\n🎯 Matching Bonuses for "${normalizedInvestor.name}":`);
      
      // Log investor criteria for debugging
      logGOD('Normalized Investor Data:', {
        type: normalizedInvestor.type,
        stages: normalizedInvestor.stage,
        sectors: normalizedInvestor.sectors,
        checkSize: normalizedInvestor.checkSize,
        geography: normalizedInvestor.geography
      });
      console.log(''); // Empty line for spacing
    }
    
    // Track matches for conditional investor bonus
    let hasStageMatch = false;
    let hasSectorMatch = false;
    
    // Stage match (REDUCED from +10 to +5) - using normalized data
    if (normalizedInvestor.stage && normalizedStartup.stage !== undefined) {
      const investorStages = Array.isArray(normalizedInvestor.stage) ? normalizedInvestor.stage : [normalizedInvestor.stage];
      
      // Convert numeric stage to name for better matching
      let startupStageStr = String(normalizedStartup.stage).toLowerCase();
      let startupStageNames: string[] = [startupStageStr];
      
      // If stage is a number, add corresponding stage names
      const stageNum = typeof normalizedStartup.stage === 'number' ? normalizedStartup.stage : convertStageToNumber(normalizedStartup.stage);
      if (stageNum === 0) startupStageNames = ['idea', 'pre-seed', 'preseed', '0'];
      else if (stageNum === 1) startupStageNames = ['pre-seed', 'preseed', 'pre seed', '1'];
      else if (stageNum === 2) startupStageNames = ['seed', '2'];
      else if (stageNum === 3) startupStageNames = ['series a', 'series_a', 'seriesa', 'a', '3'];
      else if (stageNum === 4) startupStageNames = ['series b', 'series_b', 'seriesb', 'b', '4'];
      else if (stageNum === 5) startupStageNames = ['series c', 'series_c', 'seriesc', 'c', '5'];
      
      const stageMatch = investorStages.some((s: string) => {
        const investorStage = String(s).toLowerCase().replace(/[_\s]/g, '');
        return startupStageNames.some(startupStage => {
          const normalizedStartupStage = startupStage.replace(/[_\s]/g, '');
          return investorStage === normalizedStartupStage || // Exact match first
                 investorStage.includes(normalizedStartupStage) || 
                 normalizedStartupStage.includes(investorStage);
        });
      });
      
      if (stageMatch) {
        hasStageMatch = true;
        matchBonus += 5; // REDUCED from 10 to 5
        if (verbose) {
          const stageNames = startupStageNames.join(', ');
          console.log(`   Stage Match:        +5 (${stageNames} ↔ ${investorStages.join(', ')})`);
        }
      } else if (verbose) {
        console.log(`   Stage Match:        +0 (no match)`);
      }
    }
    
    // Sector/Industry match (TIGHTENED - strict matching, REDUCED from +15 to +8)
    if (normalizedStartup.industries && normalizedInvestor.sectors) {
      const startupIndustries = Array.isArray(normalizedStartup.industries) ? normalizedStartup.industries : [normalizedStartup.industries];
      const investorSectors = Array.isArray(normalizedInvestor.sectors) ? normalizedInvestor.sectors : [normalizedInvestor.sectors];
      
      // Use strict sector matching
      const commonSectors = calculateStrictSectorMatch(startupIndustries, investorSectors);
      const sectorBonus = Math.min(commonSectors.length * 3, 8); // REDUCED: 3 points per match, max 8
      if (commonSectors.length > 0) {
        hasSectorMatch = true;
        matchBonus += sectorBonus;
        if (verbose) {
          console.log(`   Sector Match:       +${sectorBonus} (${commonSectors.join(', ')})`);
        }
      } else if (verbose) {
        console.log(`   Sector Match:       +0 (no match)`);
      }
    }
    
    // Check size fit (REDUCED from +5 to +3) - using normalized data
    if (normalizedInvestor.checkSize && normalizedStartup.raise_amount) {
      const raiseAmount = parseFloat(String(normalizedStartup.raise_amount).replace(/[^0-9.]/g, ''));
      const checkSizeRange = normalizedInvestor.checkSize;
      
      if (checkSizeRange) {
        // Simple check if raise amount is mentioned in check size string
        const checkSizeLower = String(checkSizeRange).toLowerCase();
        if (
          (raiseAmount >= 0.5 && raiseAmount <= 2 && checkSizeLower.includes('seed')) ||
          (raiseAmount >= 2 && raiseAmount <= 10 && checkSizeLower.includes('series')) ||
          checkSizeLower.includes(String(raiseAmount))
        ) {
          matchBonus += 3; // REDUCED from 5 to 3
          if (verbose) {
            console.log(`   Check Size Fit:     +3 ($${raiseAmount}M in range)`);
          }
        } else if (verbose) {
          console.log(`   Check Size Fit:     +0 (outside range)`);
        }
      }
    }
    
      // Geography match (REDUCED from +2 to +1) - modern VCs invest globally
      if (normalizedInvestor.geography && normalizedStartup.location) {
        const investorGeo = Array.isArray(normalizedInvestor.geography) ? normalizedInvestor.geography : [normalizedInvestor.geography];
        const locationMatch = investorGeo.some((geo: string) =>
          String(normalizedStartup.location).toLowerCase().includes(String(geo).toLowerCase()) ||
          String(geo).toLowerCase().includes(String(normalizedStartup.location).toLowerCase())
        );
        if (locationMatch) {
          matchBonus += 1; // REDUCED from 2 to 1
          if (verbose) {
            console.log(`   Geography Match:    +1 (${normalizedStartup.location} matches - minor factor)`);
          }
        } else if (verbose) {
          console.log(`   Geography Match:    +0 (no match - not penalized, modern VC is global)`);
        }
      }
      
      // 🚀 FUNDING VELOCITY BONUS (NEW - emphasizes fast-growing startups)
      // High velocity = raising rounds quickly = strong investor interest
      if (normalizedStartup.funding_velocity_score !== undefined || normalizedStartup.funding_rounds_count) {
        const velocityBonus = calculateFundingVelocityBonus(normalizedStartup);
        if (velocityBonus > 0) {
          matchBonus += velocityBonus;
          if (verbose) {
            console.log(`   Funding Velocity:   +${velocityBonus} (${normalizedStartup.funding_rounds_count || 'N/A'} rounds, fast growth)`);
          }
        }
      }
      
      // 🏆 REPEAT FOUNDER WITH EXIT BONUS (NEW - emphasizes proven founders)
      // Founders with previous successful exits are highly valued by investors
      if (normalizedStartup.has_repeat_founder_with_exit || normalizedStartup.founder_previous_exits) {
        const repeatFounderBonus = calculateRepeatFounderBonus(normalizedStartup);
        if (repeatFounderBonus > 0) {
          matchBonus += repeatFounderBonus;
          if (verbose) {
            const exitCount = normalizedStartup.founder_previous_exits || (normalizedStartup.has_repeat_founder_with_exit ? 1 : 0);
            console.log(`   Repeat Founder:    +${repeatFounderBonus} (${exitCount} previous exit${exitCount > 1 ? 's' : ''})`);
          }
        }
      }
      
      // 🎯 INVESTOR QUALITY BONUS (CONDITIONAL - only if there's actual fit)
    // Only apply if there's at least a stage OR sector match (shows real fit)
    let investorBonus = 0;
    if (hasStageMatch || hasSectorMatch) {
      const investorTier = investor.investor_tier || investor.tier || 'emerging';
      const investorScore = investor.investor_score || 0;
      
      // Tier-based bonus (REDUCED amounts)
      if (investorTier === 'elite') {
        investorBonus += 4; // REDUCED from 8 to 4
        if (verbose) console.log(`   Investor Quality:   +4 (Elite tier - conditional)`);
      } else if (investorTier === 'strong') {
        investorBonus += 2; // REDUCED from 5 to 2
        if (verbose) console.log(`   Investor Quality:   +2 (Strong tier - conditional)`);
      } else if (investorTier === 'solid') {
        investorBonus += 1; // REDUCED from 3 to 1
        if (verbose) console.log(`   Investor Quality:   +1 (Solid tier - conditional)`);
      }
      // Emerging gets 0 bonus now
      
      // Additional bonus for high investor scores (REDUCED)
      if (investorScore >= 9) {
        investorBonus += 1; // REDUCED from 2 to 1
        if (verbose) console.log(`   Investor Score:     +1 (Score: ${investorScore}/10)`);
      } else if (investorScore >= 7) {
        investorBonus += 0.5; // REDUCED from 1 to 0.5
        if (verbose) console.log(`   Investor Score:     +0.5 (Score: ${investorScore}/10)`);
      }
    } else if (verbose) {
      console.log(`   Investor Quality:   +0 (no fit - conditional bonus not applied)`);
    }
    
    matchBonus += Math.round(investorBonus);
    
    // Calculate final score (cap at 100 instead of 99)
    const finalScore = Math.min(baseScore + matchBonus, 100);
    
    if (verbose) {
      console.log(`\n📈 Final Score: ${finalScore.toFixed(1)}/100`);
      console.log('━'.repeat(60));
      console.log(`Base Score (GOD):   ${baseScore.toFixed(0)}/100`);
      console.log(`Match Bonuses:      +${matchBonus}`);
      console.log(`Total:              ${finalScore.toFixed(1)}/100`);
      
      if (godScore.reasoning && godScore.reasoning.length > 0) {
        console.log(`\n💡 Reasoning:`);
        godScore.reasoning.forEach((reason: string) => {
          console.log(`   • ${reason}`);
        });
      }
      console.log('━'.repeat(60) + '\n');
    }
    
    return Math.round(finalScore);
  } catch (error) {
    console.error('Error calculating match score:', error);
    // Return a low default score on error - not 85 which would be misleading
    // This makes it obvious something went wrong while not breaking the UI
    return 30;
  }
}

/**
 * Calculate funding velocity bonus
 * High velocity = raising rounds quickly = strong investor interest
 * 
 * Scoring:
 * - 2+ rounds with avg < 180 days between rounds: +6 points (very fast)
 * - 2+ rounds with avg < 365 days between rounds: +4 points (fast)
 * - 2+ rounds with avg < 730 days between rounds: +2 points (moderate)
 * - 3+ rounds: +1 additional point (proven ability to raise)
 */
function calculateFundingVelocityBonus(startup: any): number {
  // If we have a pre-calculated velocity score (0-10 scale)
  if (startup.funding_velocity_score !== undefined && startup.funding_velocity_score > 0) {
    // Convert 0-10 scale to 0-6 bonus points
    if (startup.funding_velocity_score >= 8) return 6; // Very fast
    if (startup.funding_velocity_score >= 6) return 4; // Fast
    if (startup.funding_velocity_score >= 4) return 2; // Moderate
    return 0;
  }
  
  // Fallback: use funding_rounds_count if available
  const roundCount = startup.funding_rounds_count || 0;
  if (roundCount >= 3) return 3; // 3+ rounds = proven ability
  if (roundCount >= 2) return 1; // 2 rounds = some velocity
  
  return 0;
}

/**
 * Calculate repeat founder with exit bonus
 * Founders with previous successful exits are highly valued by investors
 * 
 * Scoring:
 * - 2+ previous exits: +8 points (serial entrepreneur)
 * - 1 previous exit: +5 points (proven exit)
 * - Has exit flag but no count: +3 points (assumed 1 exit)
 */
function calculateRepeatFounderBonus(startup: any): number {
  const exitCount = startup.founder_previous_exits;
  
  if (exitCount !== undefined && exitCount > 0) {
    if (exitCount >= 2) return 8; // Serial entrepreneur
    if (exitCount >= 1) return 5; // Proven exit
  }
  
  // Fallback: boolean flag
  if (startup.has_repeat_founder_with_exit) {
    return 5; // Assume 1 exit if flag is true
  }
  
  return 0;
}

/**
 * Strict sector matching - uses exact match or known synonyms only
 * Prevents false positives from loose substring matching
 */
function calculateStrictSectorMatch(startupIndustries: string[], investorSectors: string[]): string[] {
  const SECTOR_SYNONYMS: Record<string, string[]> = {
    'ai': ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'generative ai', 'ai/ml'],
    'fintech': ['financial technology', 'payments', 'banking', 'insurtech', 'neobank'],
    'healthtech': ['health tech', 'digital health', 'healthcare', 'medtech', 'biotech'],
    'saas': ['software', 'b2b software', 'enterprise software', 'cloud'],
    'ecommerce': ['e-commerce', 'retail', 'marketplace', 'dtc', 'd2c'],
    'edtech': ['education technology', 'ed-tech', 'learning'],
    'proptech': ['real estate tech', 'property technology'],
    'cleantech': ['clean technology', 'climate tech', 'sustainability', 'greentech'],
    'cybersecurity': ['security', 'infosec', 'information security']
  };
  
  const normalizeSector = (sector: string): string => {
    const normalized = String(sector).toLowerCase().trim();
    // Check if it's a known synonym
    for (const [key, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
      if (normalized === key || synonyms.some(s => normalized === s || normalized.includes(s) || s.includes(normalized))) {
        return key;
      }
    }
    return normalized;
  };
  
  const normalizedStartup = startupIndustries.map(normalizeSector);
  const normalizedInvestor = investorSectors.map(normalizeSector);
  
  // Find exact matches or matches within same synonym group
  const matches: string[] = [];
  for (const startupSector of normalizedStartup) {
    for (const investorSector of normalizedInvestor) {
      // Exact match
      if (startupSector === investorSector) {
        if (!matches.includes(startupSector)) {
          matches.push(startupSector);
        }
        continue;
      }
      
      // Check if both are in the same synonym group
      for (const [key, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
        const allTerms = [key, ...synonyms];
        const startupInGroup = allTerms.some(t => startupSector === t || startupSector.includes(t) || t.includes(startupSector));
        const investorInGroup = allTerms.some(t => investorSector === t || investorSector.includes(t) || t.includes(investorSector));
        
        if (startupInGroup && investorInGroup) {
          if (!matches.includes(key)) {
            matches.push(key);
          }
          break;
        }
      }
    }
  }
  
  return matches;
}

/**
 * Convert stage string to number for GOD algorithm
 */
function convertStageToNumber(stage: string | number | undefined): number {
  if (!stage) return 0;
  
  // If already a number, return it
  if (typeof stage === 'number') return stage;
  
  // Convert to string and lowercase
  const stageLower = String(stage).toLowerCase();
  
  if (stageLower.includes('idea')) return 0;
  if (stageLower.includes('pre-seed') || stageLower.includes('preseed')) return 1;
  if (stageLower.includes('seed') && !stageLower.includes('pre')) return 2;
  if (stageLower.includes('series a') || stageLower.includes('series_a') || stageLower.includes('a')) return 3;
  if (stageLower.includes('series b') || stageLower.includes('series_b') || stageLower.includes('b')) return 4;
  if (stageLower.includes('series c') || stageLower.includes('series_c') || stageLower.includes('c')) return 5;
  
  return 2; // Default to seed
}

/**
 * Generate matches with GOD algorithm integration
 * UPDATED: Now uses pre-calculated scores from database (Option A architecture)
 */
export function generateAdvancedMatches(startups: any[], investors: any[], limit: number = 100): MatchPair[] {
  const matchPairs: MatchPair[] = [];
  
  try {
    // SIMPLIFIED: Use pre-calculated GOD scores from database instead of calculating on-the-fly
    const scoredStartups = startups.map(startup => {
      // NORMALIZE DATA FIRST - prevents field mapping bugs
      const normalized = normalizeStartupData(startup);
      
      // Read pre-calculated GOD score from database (default to 50 if not set)
      const totalScore = startup.total_god_score || 50;
      
      // Build godScore object for backward compatibility
      const godScore = {
        total: totalScore,
        matchCount: Math.min(Math.floor(totalScore / 10), 10), // 50→5, 80→8, 90→9 matches
        reasoning: [`Pre-calculated GOD score: ${totalScore}`],
        breakdown: {
          team: startup.team_score || 0,
          traction: startup.traction_score || 0,
          market: startup.market_score || 0,
          product: startup.product_score || 0,
          vision: startup.vision_score || 0,
          ecosystem: 0,
          grit: 0,
          problem_validation: 0
        },
        tier: (totalScore >= 80 ? 'hot' : totalScore >= 60 ? 'warm' : 'cold') as 'hot' | 'warm' | 'cold'
      };
      
      return { startup, normalized, godScore };
    }).sort((a, b) => b.godScore.total - a.godScore.total); // Sort by GOD score
    
    // Generate matches for top-scored startups
    for (let i = 0; i < Math.min(limit, scoredStartups.length); i++) {
      const { startup, normalized, godScore } = scoredStartups[i];
      
      // Match with appropriate number of investors based on GOD score
      const investorCount = Math.min(godScore.matchCount || 5, investors.length);
      
      // Find best investor match
      let bestInvestor = investors[i % investors.length];
      let bestScore = 0;
      
      // Try to find best fitting investor
      for (let j = 0; j < Math.min(5, investors.length); j++) {
        const investor = investors[(i + j) % investors.length];
        const score = calculateAdvancedMatchScore(startup, investor, i < 3);
        if (score > bestScore) {
          bestScore = score;
          bestInvestor = investor;
        }
      }
      
      const matchScore = calculateAdvancedMatchScore(startup, bestInvestor, i < 5);
      const normalizedInvestor = normalizeInvestorData(bestInvestor);
      
      matchPairs.push({
        startup: {
          id: normalized.id,
          name: normalized.name,
          description: normalized.tagline || normalized.description || '',
          tags: extractTags(normalized),
          seeking: normalized.raise_amount || normalized.funding_needed || '$2M Seeking',
          status: 'Active'
        },
        investor: {
          id: normalizedInvestor.id,
          name: normalizedInvestor.name,
          description: normalizedInvestor.tagline || normalizedInvestor.description || '',
          tags: normalizedInvestor.sectors.slice(0, 3),
          checkSize: normalizedInvestor.checkSize || '$1-5M',
          status: 'Active'
        },
        matchScore,
        reasoning: godScore.reasoning
      });
    }
  } catch (error) {
    console.error('Error generating matches:', error);
  }
  
  return matchPairs;
}

/**
 * Extract relevant tags from startup (works with normalized data)
 */
function extractTags(startup: any): string[] {
  const tags = [];
  
  // Check both direct and normalized fields
  const industries = startup.industries || startup.sectors || [];
  if (industries && industries.length > 0) {
    tags.push(...industries.slice(0, 2));
  }
  
  if (startup.stage !== undefined && startup.stage !== null) {
    const stageNum = typeof startup.stage === 'number' ? startup.stage : convertStageToNumber(startup.stage);
    const stageNames = ['Idea', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
    tags.push(stageNames[stageNum] || 'Seed');
  }
  
  if (startup.launched) {
    tags.push('Launched');
  }
  
  return tags.slice(0, 3);
}

// ============================================
// HYBRID MATCHING (GOD + SEMANTIC)
// ============================================

/**
 * Get matches using hybrid approach:
 * - If startup has embedding: 60% GOD score + 40% semantic similarity
 * - If no embedding: 100% GOD score (fallback)
 */
export async function getHybridMatches(
  startupId: string,
  investors: any[],
  limit: number = 10
): Promise<Array<{
  investor: any;
  matchScore: number;
  semanticScore: number;
  godScore: number;
  matchType: 'hybrid' | 'god-only';
}>> {
  // Check if startup has embedding for semantic matching
  const canUseSemanticMatching = await hasEmbedding(startupId);
  
  if (canUseSemanticMatching) {
    console.log('🧠 Using HYBRID matching (GOD + Semantic)');
    
    // Get semantic matches
    const semanticMatches = await findSemanticInvestorMatches(startupId, limit * 2);
    
    if (semanticMatches.length > 0) {
      // Create investor lookup map
      const investorMap = new Map(investors.map(i => [i.id, i]));
      
      // Combine semantic matches with full investor data
      const hybridMatches = semanticMatches
        .map(sm => {
          const investor = investorMap.get(sm.investorId);
          if (!investor) return null;
          
          return {
            investor,
            matchScore: Math.round(sm.combinedScore),
            semanticScore: Math.round(sm.similarityScore * 100),
            godScore: Math.round(sm.combinedScore / 0.6 - sm.similarityScore * 100 * 0.4 / 0.6),
            matchType: 'hybrid' as const
          };
        })
        .filter(m => m !== null)
        .slice(0, limit);
      
      if (hybridMatches.length > 0) {
        return hybridMatches as any;
      }
    }
  }
  
  console.log('🎯 Using GOD-only matching (no embedding available)');
  
  // Fallback to GOD-only scoring
  return investors.slice(0, limit).map(investor => ({
    investor,
    matchScore: 50, // Will be calculated by existing GOD algorithm
    semanticScore: 0,
    godScore: 50,
    matchType: 'god-only' as const
  }));
}

/**
 * Enhanced match score that combines GOD algorithm with semantic similarity
 */
export function calculateHybridMatchScore(
  godScore: number,
  semanticSimilarity: number,
  godWeight: number = 0.6
): number {
  const semanticWeight = 1 - godWeight;
  const combinedScore = (godScore * godWeight) + (semanticSimilarity * 100 * semanticWeight);
  return Math.round(Math.min(Math.max(combinedScore, 0), 99));
}

// ============================================
// VC GOD ALGORITHM INTEGRATION
// ============================================

/**
 * Calculate a combined match quality score that factors in:
 * 1. Startup quality (GOD score)
 * 2. Investor quality (VC GOD score)
 * 3. Startup-Investor fit
 * 
 * This creates a truly bidirectional matching system where
 * high-quality startups are matched with high-quality VCs.
 */
export function calculateBidirectionalMatchScore(
  startup: any,
  investor: any,
  verbose: boolean = false
): {
  totalScore: number;
  startupScore: number;
  investorScore: number;
  fitScore: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  reasoning: string[];
} {
  const reasoning: string[] = [];
  
  // 1. STARTUP QUALITY (0-100, from GOD algorithm)
  const startupScore = startup.total_god_score || 50;
  reasoning.push(`Startup GOD Score: ${startupScore}/100`);
  
  // 2. INVESTOR QUALITY (0-10, from VC GOD algorithm)
  const investorScoreRaw = investor.investor_score || 2; // Default low if not scored
  const investorScore = investorScoreRaw * 10; // Convert to 0-100 scale
  const investorTier = investor.investor_tier || 'emerging';
  reasoning.push(`Investor Score: ${investorScoreRaw}/10 (${investorTier})`);
  
  // 3. FIT SCORE (calculated from match criteria)
  const baseFitScore = calculateAdvancedMatchScore(startup, investor, false);
  const fitScore = baseFitScore;
  reasoning.push(`Fit Score: ${fitScore}/100`);
  
  // 4. COMBINED SCORE CALCULATION
  // Weights: 40% startup quality + 20% investor quality + 40% fit
  // This ensures high-quality startups get priority but fit is still crucial
  const weights = {
    startup: 0.4,
    investor: 0.2,
    fit: 0.4
  };
  
  const rawTotal = 
    (startupScore * weights.startup) +
    (investorScore * weights.investor) +
    (fitScore * weights.fit);
  
  const totalScore = Math.round(Math.min(rawTotal, 99));
  
  // Determine tier based on combined quality
  let tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  if (startupScore >= 80 && investorScore >= 60 && fitScore >= 70) {
    tier = 'platinum'; // Top startup + Top VC + Great fit
    reasoning.push('🏆 Platinum match: Top startup meets elite VC with strong fit');
  } else if (startupScore >= 60 && investorScore >= 40 && fitScore >= 60) {
    tier = 'gold';
    reasoning.push('🥇 Gold match: Quality startup meets solid VC');
  } else if (fitScore >= 70) {
    tier = 'silver';
    reasoning.push('🥈 Silver match: Good fit despite lower quality scores');
  } else {
    tier = 'bronze';
    reasoning.push('🥉 Bronze match: Potential but needs validation');
  }
  
  if (verbose) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 BIDIRECTIONAL MATCH: ${startup.name} ↔ ${investor.name || investor.firm}`);
    console.log('═'.repeat(60));
    console.log(`   Startup Quality:  ${startupScore}/100 (GOD algorithm)`);
    console.log(`   Investor Quality: ${investorScoreRaw}/10 (${investorTier})`);
    console.log(`   Fit Score:        ${fitScore}/100`);
    console.log(`   ─────────────────────────────`);
    console.log(`   TOTAL SCORE:      ${totalScore}/100 [${tier.toUpperCase()}]`);
    reasoning.forEach(r => console.log(`   • ${r}`));
    console.log('═'.repeat(60) + '\n');
  }
  
  return {
    totalScore,
    startupScore,
    investorScore,
    fitScore,
    tier,
    reasoning
  };
}

/**
 * Generate matches sorted by bidirectional quality
 * High-quality startups get matched with high-quality investors first
 */
export function generateBidirectionalMatches(
  startups: any[],
  investors: any[],
  limit: number = 100
): Array<{
  startup: any;
  investor: any;
  score: ReturnType<typeof calculateBidirectionalMatchScore>;
}> {
  const allMatches: Array<{
    startup: any;
    investor: any;
    score: ReturnType<typeof calculateBidirectionalMatchScore>;
  }> = [];
  
  // Score all possible startup-investor pairs
  for (const startup of startups) {
    for (const investor of investors) {
      const score = calculateBidirectionalMatchScore(startup, investor, false);
      allMatches.push({ startup, investor, score });
    }
  }
  
  // Sort by total score (best matches first)
  allMatches.sort((a, b) => b.score.totalScore - a.score.totalScore);
  
  // Return top matches (avoiding duplicate startups if desired)
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter(m => {
    const key = `${m.startup.id}-${m.investor.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return uniqueMatches.slice(0, limit);
}
