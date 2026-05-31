/**
 * Investor Match Service
 * Gets ranked investor matches for a startup
 */

import { supabase } from './supabase';
import { isNonInvestorAggregator } from './investorAggregatorBlocklist';

export type InvestorMatch = {
  investor_id: string;
  investor_name: string;
  firm?: string;
  score: number;
  reasons: string[];
  sectors?: string[];
  stage?: string[];
  check_size_min?: number;
  check_size_max?: number;
  type?: string;
  photo_url?: string;
  linkedin_url?: string;
  notable_investments?: string[];
};

export type MatchOptions = {
  limit?: number;
  minScore?: number;
  sectors?: string[];
  stages?: string[];
  checkSizeMin?: number;
  checkSizeMax?: number;
};

/**
 * Generate human-readable match reasons
 */
function generateReasons(startup: any, investor: any, score: number): string[] {
  const reasons: string[] = [];

  // Sector overlap
  const startupSectors = startup?.sectors || [];
  const investorSectors = investor?.sectors || [];
  const sectorOverlap = startupSectors.filter((s: string) =>
    investorSectors.some((is: string) => 
      is?.toLowerCase().includes(s?.toLowerCase()) || 
      s?.toLowerCase().includes(is?.toLowerCase())
    )
  );
  if (sectorOverlap.length > 0) {
    reasons.push(`🎯 Invests in ${sectorOverlap[0]}`);
  }

  // Stage alignment
  const investorStages = investor?.stage || [];
  if (investorStages.length > 0) {
    const stageNames = ['', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
    const startupStageName = stageNames[startup?.stage] || 'Early stage';
    if (investorStages.some((s: string) => s?.toLowerCase().includes('seed'))) {
      reasons.push(`📈 Active at ${startupStageName}`);
    }
  }

  // Check size
  if (investor?.check_size_min || investor?.check_size_max) {
    const min = investor.check_size_min ? `$${(investor.check_size_min / 1000000).toFixed(0)}M` : '';
    const max = investor.check_size_max ? `$${(investor.check_size_max / 1000000).toFixed(0)}M` : '';
    if (min && max) {
      reasons.push(`💰 Writes ${min}-${max} checks`);
    }
  }

  // High score indicator
  if (score >= 85) {
    reasons.push(`⭐ Exceptional thesis alignment`);
  } else if (score >= 75) {
    reasons.push(`✨ Strong investment fit`);
  } else if (score >= 65) {
    reasons.push(`🤝 Good portfolio match`);
  }

  // Notable investments
  if (investor?.notable_investments?.length > 0) {
    const notable = investor.notable_investments.slice(0, 2).join(', ');
    reasons.push(`🏆 Portfolio: ${notable}`);
  }

  return reasons.slice(0, 4);
}

/**
 * Get investor matches for a startup
 * Uses pre-computed matches from startup_investor_matches table
 * Falls back to real-time scoring if no pre-computed matches exist
 */
export async function getInvestorMatchesForStartup(
  startupId: string,
  startup: any,
  options: MatchOptions = {}
): Promise<InvestorMatch[]> {
  const { limit = 50, minScore = 20 } = options;

  // First try: Get pre-computed matches from the matches table
  // Note: Using separate queries instead of join due to FK relationship issue
  const { data: matchData, error: matchError } = await supabase
    .from('startup_investor_matches')
    .select('match_score, reasoning, investor_id')
    .eq('startup_id', startupId)
    .gte('match_score', minScore)
    .order('match_score', { ascending: false })
    .limit(limit);

  if (matchData && matchData.length > 0) {
    // Get investor details in a separate query
    const investorIds = matchData.map(m => m.investor_id).filter((id): id is string => Boolean(id));
    const { data: investors } = await supabase
      .from('investors')
      .select('id, name, firm, sectors, stage, check_size_min, check_size_max, photo_url, linkedin_url, notable_investments')
      .in('id', investorIds);

    const investorMap = new Map((investors as any[] || []).map(inv => [inv.id, inv]));

    return matchData
      .map((m: any) => {
      const investor = investorMap.get(m.investor_id) as any;
      return {
        investor_id: m.investor_id,
        investor_name: investor?.name || 'Unknown Investor',
        firm: investor?.firm,
        score: m.match_score || 0,
        reasons: m.reasoning || generateReasons(startup, investor, m.match_score || 0),
        sectors: investor?.sectors,
        stage: investor?.stage,
        check_size_min: investor?.check_size_min,
        check_size_max: investor?.check_size_max,
        type: investor?.type,
        photo_url: investor?.photo_url,
        linkedin_url: investor?.linkedin_url,
        notable_investments: investor?.notable_investments,
        _investor: investor,
      };
    })
      .filter((m) => !isNonInvestorAggregator(m._investor))
      .map(({ _investor, ...rest }) => rest);
  }

  // Fallback: Real-time scoring for new startups without pre-computed matches
  console.log('No pre-computed matches, doing real-time scoring for startup:', startupId);

  const { data: investors } = await supabase
    .from('investors')
    .select('id, name, firm, sectors, stage, check_size_min, check_size_max, type, photo_url, linkedin_url, notable_investments, investment_thesis')
    .limit(200);

  if (!investors) return [];

  const startupSectors = startup?.sectors || ['Technology'];
  const startupStage = startup?.stage || 1;

  // Score each investor
  const scoredMatches = investors
    .filter((inv: any) => !isNonInvestorAggregator(inv))
    .map((inv: any) => {
    let score = 50; // Base score

    // Sector fit (0-30 points)
    const investorSectors = inv.sectors || [];
    const sectorOverlap = startupSectors.filter((s: string) =>
      investorSectors.some((is: string) => 
        is?.toLowerCase().includes(s?.toLowerCase()) || 
        s?.toLowerCase().includes(is?.toLowerCase())
      )
    );
    score += Math.min(sectorOverlap.length * 15, 30);

    // Stage fit (0-20 points)
    const investorStages = inv.stage || [];
    const stageNames = ['', 'pre-seed', 'seed', 'series a', 'series b', 'series c'];
    const startupStageName = stageNames[startupStage]?.toLowerCase() || 'seed';
    if (investorStages.some((s: string) => s?.toLowerCase().includes(startupStageName))) {
      score += 20;
    } else if (investorStages.length > 0) {
      score += 5; // Partial credit
    }

    // Add some randomness for variety (0-10 points)
    score += Math.floor(Math.random() * 10);

    return {
      investor_id: inv.id,
      investor_name: inv.name || 'Unknown',
      firm: inv.firm,
      score: Math.min(score, 98),
      reasons: generateReasons(startup, inv, score),
      sectors: inv.sectors,
      stage: inv.stage,
      check_size_min: inv.check_size_min,
      check_size_max: inv.check_size_max,
      type: inv.type,
      photo_url: inv.photo_url,
      linkedin_url: inv.linkedin_url,
      notable_investments: inv.notable_investments,
    };
  });

  // Sort by score and return top matches
  return scoredMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
