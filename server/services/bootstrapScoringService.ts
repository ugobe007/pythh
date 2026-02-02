/**
 * ============================================================================
 * BOOTSTRAP SCORING SERVICE - For Sparse-Data Startups
 * ============================================================================
 * 
 * PURPOSE: Compensate for startups with limited data by using alternative signals
 * 
 * When a startup has sparse data (no MRR, no customer counts, limited description),
 * the standard GOD scoring can't work effectively. This service provides additional
 * scoring based on:
 * 
 *   1. SOCIAL SIGNALS - ProductHunt, IndieHackers, Reddit, HackerNews buzz
 *   2. FOUNDER VELOCITY - Speed from idea to launch
 *   3. FOUNDER REPUTATION - Helpful posts, experience signals, connections
 *   4. COMMUNITY VALIDATION - Upvotes, comments, engagement
 *   5. MARKET BUZZ - Mentions in startup communities
 * 
 * This score is ADDITIVE to the GOD score (0-15 bonus points max)
 * Only applied when data_tier = 'sparse' (less than 50% data completeness)
 * 
 * Created: Jan 31, 2026
 * Author: AI Copilot (admin approved)
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// BOOTSTRAP SCORING CONFIG
// ============================================================================

const BOOTSTRAP_CONFIG = {
  // Maximum bonus points from bootstrap scoring
  maxBonus: 15,
  
  // Data completeness threshold (below this = sparse data)
  sparseDataThreshold: 0.50, // 50%
  
  // Social signal weights (total max: 8 points)
  socialSignals: {
    maxScore: 8,
    weights: {
      productHunt: {
        launch: 2.0,      // Featured on PH
        upvotes: 0.01,    // Per upvote (max 2 pts)
        comments: 0.05,   // Per comment (max 1 pt)
        topProduct: 1.5,  // Top 5 of day/week
      },
      indieHackers: {
        milestone: 1.5,   // Revenue milestone post
        project: 1.0,     // Has project page
        engagement: 0.02, // Per upvote
      },
      betalist: {         // NEW - Jan 31, 2026
        listing: 1.5,     // Listed on BetaList
        featured: 2.5,    // Featured startup
      },
      reddit: {
        mention: 0.3,     // Per mention
        sentiment: {      // Sentiment multipliers
          praise: 2.0,
          interest: 1.5,
          neutral: 1.0,
          concern: -0.5,
        },
      },
      hackerNews: {
        frontPage: 3.0,   // Made HN front page
        showHN: 1.5,      // Show HN post
        points: 0.02,     // Per point (max 2)
      },
      twitter: {
        mention: 0.2,     // Per mention
        engagement: 0.01, // Per like/RT
      },
      // NEW community platforms - Jan 31, 2026
      startupfoundation: {
        mention: 0.5,     // Mentioned in community
      },
      creativetribes: {
        mention: 0.4,     // Mentioned in creative community
      },
      // NEW - Jan 31, 2026 Batch 2
      foundersbeta: {
        listing: 1.5,     // Listed on FoundersBeta directory
        featured: 2.5,    // Featured startup
      },
      nocodefounders: {
        discussion: 0.8,  // Community discussion mention
        featured: 1.5,    // Featured in community
      },
      startupgrind: {
        mention: 2.0,     // Mentioned in Startup Grind blog (prestigious)
        feature: 3.5,     // Full feature article
      },
      discordengineering: {
        mention: 2.5,     // Mentioned by Discord's engineering team (very prestigious)
      },
    },
  },
  
  // Founder velocity weights (total max: 4 points)
  founderVelocity: {
    maxScore: 4,
    weights: {
      ideaToMVP: {       // Months from founding to MVP
        under3: 2.0,
        under6: 1.5,
        under12: 1.0,
        over12: 0.0,
      },
      mvpToLaunch: {     // Months from MVP to public launch
        under1: 1.5,
        under3: 1.0,
        under6: 0.5,
      },
      iterationSpeed: {  // How fast they ship
        daily: 1.0,
        weekly: 0.7,
        monthly: 0.3,
      },
    },
  },
  
  // Founder reputation weights (total max: 3 points)
  founderReputation: {
    maxScore: 3,
    weights: {
      helpfulPosts: 0.3,      // Per helpful community post (max 1.5)
      experienceSignals: 0.5, // Per experience indicator (max 1.5)
      connections: 0.3,       // Has industry connections
      accelerator: 1.0,       // YC/Techstars/etc alumni
    },
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface BootstrapScore {
  total: number;           // Total bootstrap bonus (0-15)
  dataTier: 'rich' | 'standard' | 'sparse';
  dataCompleteness: number; // 0-1
  breakdown: {
    socialSignals: number;
    founderVelocity: number;
    founderReputation: number;
  };
  signals: string[];       // Human-readable signal descriptions
  applied: boolean;        // Whether bootstrap scoring was applied
}

interface SocialSignal {
  platform: string;
  signal_type: string;
  sentiment: string;
  engagement_score: number;
  content?: string;
}

interface StartupData {
  id: string | number;
  name: string;
  description?: string;
  pitch?: string;
  website?: string;
  founded_date?: string;
  is_launched?: boolean;
  mrr?: number;
  customer_count?: number;
  team_size?: number;
  has_technical_cofounder?: boolean;
  founder_voice_score?: number;
  social_score?: number;
  total_god_score?: number;
  sectors?: string[];
}

// ============================================================================
// DATA COMPLETENESS CHECK
// ============================================================================

/**
 * Calculate how complete the startup's data is
 */
function calculateDataCompleteness(startup: StartupData): number {
  const fields = [
    { name: 'description', check: () => startup.description && startup.description.length > 50 },
    { name: 'pitch', check: () => startup.pitch && startup.pitch.length > 50 },
    { name: 'website', check: () => startup.website && startup.website.length > 5 },
    { name: 'mrr', check: () => startup.mrr && startup.mrr > 0 },
    { name: 'customer_count', check: () => startup.customer_count && startup.customer_count > 0 },
    { name: 'is_launched', check: () => startup.is_launched === true },
    { name: 'team_size', check: () => startup.team_size && startup.team_size > 0 },
    { name: 'has_technical_cofounder', check: () => startup.has_technical_cofounder === true },
    { name: 'founded_date', check: () => !!startup.founded_date },
    { name: 'sectors', check: () => startup.sectors && startup.sectors.length > 0 },
  ];
  
  const complete = fields.filter(f => f.check()).length;
  return complete / fields.length;
}

/**
 * Determine data tier
 */
function getDataTier(completeness: number): 'rich' | 'standard' | 'sparse' {
  if (completeness >= 0.7) return 'rich';
  if (completeness >= 0.5) return 'standard';
  return 'sparse';
}

// ============================================================================
// SOCIAL SIGNALS SCORING
// ============================================================================

/**
 * Score based on social signals from the social_signals table
 */
async function scoreSocialSignals(
  supabase: any, // Accept any supabase client to avoid type inference issues
  startupId: string | number
): Promise<{ score: number; signals: string[] }> {
  const signals: string[] = [];
  let score = 0;
  
  try {
    // Get social signals for this startup
    const { data: socialSignals } = await supabase
      .from('social_signals')
      .select('platform, signal_type, sentiment, engagement_score, content')
      .eq('startup_id', startupId);
    
    if (!socialSignals || socialSignals.length === 0) {
      return { score: 0, signals: ['No social signals found'] };
    }
    
    // Group by platform - cast to SocialSignal[] for proper typing
    const platformGroups: Record<string, SocialSignal[]> = {};
    for (const signal of socialSignals as SocialSignal[]) {
      if (!platformGroups[signal.platform]) {
        platformGroups[signal.platform] = [];
      }
      platformGroups[signal.platform].push(signal);
    }
    
    // Score each platform
    const weights = BOOTSTRAP_CONFIG.socialSignals.weights;
    
    // Reddit
    if (platformGroups.reddit) {
      let redditScore = 0;
      for (const signal of platformGroups.reddit) {
        redditScore += weights.reddit.mention;
        const sentiment = signal.sentiment as keyof typeof weights.reddit.sentiment;
        const multiplier = weights.reddit.sentiment[sentiment] || 1.0;
        redditScore *= multiplier;
        redditScore += (signal.engagement_score || 0) * 0.01;
      }
      score += Math.min(redditScore, 2);
      signals.push(`Reddit: ${platformGroups.reddit.length} mentions`);
    }
    
    // Hacker News
    if (platformGroups.hackernews) {
      let hnScore = 0;
      for (const signal of platformGroups.hackernews) {
        // Check for Show HN
        if (signal.content?.toLowerCase().includes('show hn')) {
          hnScore += weights.hackerNews.showHN;
          signals.push('Show HN post detected');
        }
        hnScore += (signal.engagement_score || 0) * weights.hackerNews.points;
      }
      score += Math.min(hnScore, 3);
      signals.push(`HackerNews: ${platformGroups.hackernews.length} mentions`);
    }
    
    // Twitter
    if (platformGroups.twitter) {
      let twitterScore = 0;
      for (const signal of platformGroups.twitter) {
        twitterScore += weights.twitter.mention;
        twitterScore += (signal.engagement_score || 0) * weights.twitter.engagement;
      }
      score += Math.min(twitterScore, 2);
      signals.push(`Twitter: ${platformGroups.twitter.length} mentions`);
    }
    
    // ProductHunt (if we have it)
    if (platformGroups.producthunt) {
      let phScore = weights.productHunt.launch;
      for (const signal of platformGroups.producthunt) {
        phScore += (signal.engagement_score || 0) * weights.productHunt.upvotes;
      }
      score += Math.min(phScore, 3);
      signals.push('ProductHunt launch detected');
    }
    
    // IndieHackers
    if (platformGroups.indiehackers) {
      let ihScore = weights.indieHackers.project;
      for (const signal of platformGroups.indiehackers) {
        if (signal.signal_type === 'milestone') {
          ihScore += weights.indieHackers.milestone;
        }
      }
      score += Math.min(ihScore, 2);
      signals.push('IndieHackers presence detected');
    }
    
    // BetaList (NEW - Jan 31, 2026)
    if (platformGroups.betalist) {
      let blScore = weights.betalist.listing;
      for (const signal of platformGroups.betalist) {
        if (signal.signal_type === 'featured') {
          blScore += weights.betalist.featured;
        }
      }
      score += Math.min(blScore, 2.5);
      signals.push('BetaList listing detected');
    }
    
    // StartupFoundation (NEW - Jan 31, 2026)
    if (platformGroups.startupfoundation) {
      score += Math.min(platformGroups.startupfoundation.length * weights.startupfoundation.mention, 1);
      signals.push(`StartupFoundation: ${platformGroups.startupfoundation.length} mentions`);
    }
    
    // CreativeTribes (NEW - Jan 31, 2026)
    if (platformGroups.creativetribes) {
      score += Math.min(platformGroups.creativetribes.length * weights.creativetribes.mention, 1);
      signals.push(`CreativeTribes: ${platformGroups.creativetribes.length} mentions`);
    }
    
    // FoundersBeta (NEW - Jan 31, 2026 Batch 2)
    if (platformGroups.foundersbeta) {
      let fbScore = weights.foundersbeta.listing;
      for (const signal of platformGroups.foundersbeta) {
        if (signal.signal_type === 'featured') {
          fbScore += weights.foundersbeta.featured;
        }
      }
      score += Math.min(fbScore, 3);
      signals.push('FoundersBeta listing detected');
    }
    
    // NoCodeFounders (NEW - Jan 31, 2026 Batch 2)
    if (platformGroups.nocodefounders) {
      let ncfScore = 0;
      for (const signal of platformGroups.nocodefounders) {
        if (signal.signal_type === 'featured') {
          ncfScore += weights.nocodefounders.featured;
        } else {
          ncfScore += weights.nocodefounders.discussion;
        }
      }
      score += Math.min(ncfScore, 2);
      signals.push(`NoCodeFounders: ${platformGroups.nocodefounders.length} discussions`);
    }
    
    // StartupGrind (NEW - Jan 31, 2026 Batch 2) - High value media
    if (platformGroups.startupgrind) {
      let sgScore = 0;
      for (const signal of platformGroups.startupgrind) {
        if (signal.signal_type === 'media_feature') {
          sgScore += weights.startupgrind.feature;
        } else {
          sgScore += weights.startupgrind.mention;
        }
      }
      score += Math.min(sgScore, 4); // High cap - it's prestigious
      signals.push(`🏆 Startup Grind: ${platformGroups.startupgrind.length} features`);
    }
    
    // Discord Engineering (NEW - Jan 31, 2026 Batch 2) - Very prestigious
    if (platformGroups.discordengineering) {
      score += Math.min(platformGroups.discordengineering.length * weights.discordengineering.mention, 3);
      signals.push(`🎮 Discord Engineering mention detected!`);
    }
    
  } catch (error) {
    console.error('Error scoring social signals:', error);
  }
  
  return { 
    score: Math.min(score, BOOTSTRAP_CONFIG.socialSignals.maxScore), 
    signals 
  };
}

// ============================================================================
// FOUNDER VELOCITY SCORING
// ============================================================================

/**
 * Score based on how fast the founder moved from idea to launch
 */
function scoreFounderVelocity(startup: StartupData): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  const weights = BOOTSTRAP_CONFIG.founderVelocity.weights;
  
  // Calculate months since founding
  if (startup.founded_date) {
    const founded = new Date(startup.founded_date);
    const now = new Date();
    const monthsSinceFounding = (now.getTime() - founded.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    // If launched and young, that's fast execution
    if (startup.is_launched) {
      if (monthsSinceFounding < 3) {
        score += weights.ideaToMVP.under3;
        signals.push(`🚀 Lightning fast: Launched in ${Math.round(monthsSinceFounding)} months`);
      } else if (monthsSinceFounding < 6) {
        score += weights.ideaToMVP.under6;
        signals.push(`⚡ Fast execution: Launched in ${Math.round(monthsSinceFounding)} months`);
      } else if (monthsSinceFounding < 12) {
        score += weights.ideaToMVP.under12;
        signals.push(`✓ Good pace: Launched in ${Math.round(monthsSinceFounding)} months`);
      }
    }
  }
  
  // If they have customers already, add velocity bonus
  if (startup.customer_count && startup.customer_count > 0 && startup.founded_date) {
    const founded = new Date(startup.founded_date);
    const now = new Date();
    const monthsSinceFounding = (now.getTime() - founded.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsSinceFounding < 6 && startup.customer_count > 0) {
      score += 1.0;
      signals.push(`💰 Early traction: ${startup.customer_count} customers in ${Math.round(monthsSinceFounding)}mo`);
    }
  }
  
  // MRR velocity
  if (startup.mrr && startup.mrr > 0 && startup.founded_date) {
    const founded = new Date(startup.founded_date);
    const now = new Date();
    const monthsSinceFounding = (now.getTime() - founded.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsSinceFounding < 12) {
      const mrrPerMonth = startup.mrr / Math.max(monthsSinceFounding, 1);
      if (mrrPerMonth > 1000) {
        score += 1.0;
        signals.push(`📈 Revenue velocity: $${Math.round(mrrPerMonth)}/mo growth rate`);
      }
    }
  }
  
  return {
    score: Math.min(score, BOOTSTRAP_CONFIG.founderVelocity.maxScore),
    signals
  };
}

// ============================================================================
// FOUNDER REPUTATION SCORING
// ============================================================================

/**
 * Score based on founder's reputation and background
 */
function scoreFounderReputation(startup: StartupData): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  
  // Founder voice score (from linguistic analysis)
  if (startup.founder_voice_score && startup.founder_voice_score > 0) {
    const voiceBonus = (startup.founder_voice_score / 100) * 1.5;
    score += voiceBonus;
    signals.push(`🗣️ Founder voice: ${startup.founder_voice_score}/100`);
  }
  
  // Social score (from DB)
  if (startup.social_score && startup.social_score > 0) {
    const socialBonus = (startup.social_score / 100) * 1.0;
    score += socialBonus;
    signals.push(`📱 Social presence: ${startup.social_score}/100`);
  }
  
  // Technical cofounder bonus
  if (startup.has_technical_cofounder) {
    score += 0.5;
    signals.push('👨‍💻 Technical cofounder');
  }
  
  return {
    score: Math.min(score, BOOTSTRAP_CONFIG.founderReputation.maxScore),
    signals
  };
}

// ============================================================================
// MAIN BOOTSTRAP SCORING FUNCTION
// ============================================================================

/**
 * Calculate bootstrap score for a startup
 * Only applies meaningful bonus for sparse-data startups
 */
export async function calculateBootstrapScore(
  supabase: any, // Accept any supabase client to avoid type inference issues
  startup: StartupData
): Promise<BootstrapScore> {
  // Calculate data completeness
  const dataCompleteness = calculateDataCompleteness(startup);
  const dataTier = getDataTier(dataCompleteness);
  
  // If data is rich enough, don't apply bootstrap scoring
  if (dataTier === 'rich') {
    return {
      total: 0,
      dataTier,
      dataCompleteness,
      breakdown: {
        socialSignals: 0,
        founderVelocity: 0,
        founderReputation: 0,
      },
      signals: ['Data tier: RICH - standard GOD scoring applies'],
      applied: false,
    };
  }
  
  // Calculate component scores
  const social = await scoreSocialSignals(supabase, startup.id);
  const velocity = scoreFounderVelocity(startup);
  const reputation = scoreFounderReputation(startup);
  
  // Calculate total with scaling based on data sparseness
  // Sparser data = more weight on bootstrap signals
  const sparsenessMultiplier = dataTier === 'sparse' ? 1.0 : 0.6;
  
  const rawTotal = social.score + velocity.score + reputation.score;
  const total = Math.min(rawTotal * sparsenessMultiplier, BOOTSTRAP_CONFIG.maxBonus);
  
  return {
    total: Math.round(total * 10) / 10, // Round to 1 decimal
    dataTier,
    dataCompleteness,
    breakdown: {
      socialSignals: social.score,
      founderVelocity: velocity.score,
      founderReputation: reputation.score,
    },
    signals: [
      `Data tier: ${dataTier.toUpperCase()} (${Math.round(dataCompleteness * 100)}% complete)`,
      ...social.signals,
      ...velocity.signals,
      ...reputation.signals,
    ],
    applied: true,
  };
}

/**
 * Batch calculate bootstrap scores for multiple startups
 */
export async function calculateBootstrapScoresBatch(
  supabase: any, // Accept any supabase client to avoid type inference issues
  startups: StartupData[]
): Promise<Map<string | number, BootstrapScore>> {
  const results = new Map<string | number, BootstrapScore>();
  
  for (const startup of startups) {
    const score = await calculateBootstrapScore(supabase, startup);
    results.set(startup.id, score);
  }
  
  return results;
}

// Export config for external use
export { BOOTSTRAP_CONFIG };
