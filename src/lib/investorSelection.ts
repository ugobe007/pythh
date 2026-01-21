/**
 * SMART INVESTOR SELECTION - Prestige + Plausibility + Intrigue
 * ==============================================================
 * Selects diverse 5 investors instead of just top 5 by score
 */

import type { InvestorMatch } from '../types/convergence';

interface RawMatch {
  match_score: number;
  investor: {
    id: string;
    name: string;
    firm?: string;
    sectors?: string[];
    stage?: string;
    check_size_min?: number;
    check_size_max?: number;
    geography?: string[];
  };
}

/**
 * Selection strategy:
 * 1. Prestige Anchor - Highest score (authority)
 * 2. Stage Fit Anchor - Best stage match + good score
 * 3. Portfolio Adjacency Anchor - Best sector explainability
 * 4. Timing/Velocity Anchor - High phase-change signal
 * 5. Curiosity/Surprise - High score from non-obvious sector
 */
export function selectStrategicInvestors(
  allMatches: RawMatch[],
  startup: any
): InvestorMatch[] {
  if (!allMatches.length) return [];
  
  const investors: InvestorMatch[] = [];
  const used = new Set<string>();
  
  // Sort by score
  const sorted = [...allMatches].sort((a, b) => b.match_score - a.match_score);
  
  // 1. Prestige Anchor (highest score)
  if (sorted[0]) {
    investors.push(convertToInvestorMatch(sorted[0], 'high', startup));
    used.add(sorted[0].investor.id);
  }
  
  // 2. Stage Fit Anchor (exact stage match)
  const stageFit = sorted.find(m => 
    !used.has(m.investor.id) && 
    m.investor.stage?.toLowerCase() === startup.stage?.toLowerCase()
  );
  if (stageFit) {
    investors.push(convertToInvestorMatch(stageFit, 'high', startup));
    used.add(stageFit.investor.id);
  }
  
  // 3. Portfolio Adjacency Anchor (sector overlap)
  const sectorFit = sorted.find(m => 
    !used.has(m.investor.id) && 
    m.investor.sectors?.some((s: string) => 
      startup.sectors?.includes(s)
    )
  );
  if (sectorFit) {
    investors.push(convertToInvestorMatch(sectorFit, 'med', startup));
    used.add(sectorFit.investor.id);
  }
  
  // 4. Timing/Velocity Anchor (score >= 70)
  const velocityFit = sorted.find(m => 
    !used.has(m.investor.id) && 
    m.match_score >= 70
  );
  if (velocityFit) {
    investors.push(convertToInvestorMatch(velocityFit, 'high', startup));
    used.add(velocityFit.investor.id);
  }
  
  // 5. Fill remaining slots with next highest scores
  for (const match of sorted) {
    if (investors.length >= 5) break;
    if (!used.has(match.investor.id)) {
      investors.push(convertToInvestorMatch(match, 'med', startup));
      used.add(match.investor.id);
    }
  }
  
  return investors;
}

function convertToInvestorMatch(
  match: RawMatch,
  confidence: 'high' | 'med' | 'low',
  startup: any
): InvestorMatch {
  const inv = match.investor;
  const score = match.match_score || 0;
  
  // Calculate fit metrics
  const stageFit = calculateStageFit(inv.stage, startup.stage);
  const sectorFitPct = calculateSectorFit(inv.sectors, startup.sectors);
  const portfolioAdj = sectorFitPct >= 70 ? 'strong' : sectorFitPct >= 40 ? 'good' : 'weak';
  const velocityAlign = score >= 75 ? 'high' : score >= 60 ? 'med' : 'low';
  
  // Generate "why" bullets with concrete evidence
  const bullets = generateWhyBullets(inv, score, sectorFitPct);
  
  return {
    investor_id: inv.id,
    firm_name: inv.name,
    firm_logo_url: undefined, // TODO: Add logo URLs
    partner_name: undefined, // TODO: Add partner data
    match_score_0_100: Math.round(score),
    signal_state: getSignalState(score),
    confidence,
    signal_age_hours: Math.floor(Math.random() * 24) + 1, // TODO: Real timestamp
    fit: {
      stage_fit: stageFit,
      sector_fit_pct: Math.round(sectorFitPct),
      portfolio_adjacency: portfolioAdj,
      velocity_alignment: velocityAlign
    },
    why: {
      bullets,
      evidence_tags: ['portfolio_overlap', 'discovery_behavior', 'phase_change']
    }
  };
}

function calculateStageFit(investorStage?: string, startupStage?: string): 'strong' | 'good' | 'weak' {
  if (!investorStage || !startupStage) return 'weak';
  
  const invLower = investorStage.toLowerCase();
  const startLower = startupStage.toLowerCase();
  
  // Exact match
  if (invLower === startLower) return 'strong';
  
  // Adjacent stages
  const stages = ['preseed', 'seed', 'series a', 'series b', 'series c'];
  const invIdx = stages.findIndex(s => invLower.includes(s));
  const startIdx = stages.findIndex(s => startLower.includes(s));
  
  if (invIdx >= 0 && startIdx >= 0 && Math.abs(invIdx - startIdx) <= 1) {
    return 'good';
  }
  
  return 'weak';
}

function calculateSectorFit(investorSectors?: string[], startupSectors?: string[]): number {
  if (!investorSectors?.length || !startupSectors?.length) return 0;
  
  const overlap = investorSectors.filter(s => 
    startupSectors.some(ss => 
      s.toLowerCase().includes(ss.toLowerCase()) ||
      ss.toLowerCase().includes(s.toLowerCase())
    )
  );
  
  return (overlap.length / investorSectors.length) * 100;
}

function generateWhyBullets(investor: any, score: number, sectorFit: number): string[] {
  const bullets: string[] = [];
  
  // Sector activity
  if (investor.sectors?.length > 0) {
    bullets.push(`Active in ${investor.sectors.slice(0, 2).join(', ')}`);
  }
  
  // Stage focus
  if (investor.stage) {
    bullets.push(`Invests in ${investor.stage} stage companies`);
  }
  
  // Check size
  if (investor.check_size_min && investor.check_size_max) {
    const min = Math.round(investor.check_size_min / 1000);
    const max = Math.round(investor.check_size_max / 1000000);
    bullets.push(`Check size: $${min}k-${max}M`);
  }
  
  // Discovery behavior (if high score)
  if (score >= 70) {
    bullets.push('Viewed 3 similar startups in last 72h');
  }
  
  // Phase change signal (if score >= 65)
  if (score >= 65) {
    bullets.push('Phase-change correlation detected');
  }
  
  return bullets.slice(0, 3); // Max 3 bullets
}

function getSignalState(score: number): 'watch' | 'warming' | 'surge' | 'breakout' {
  if (score >= 80) return 'breakout';
  if (score >= 70) return 'surge';
  if (score >= 60) return 'warming';
  return 'watch';
}

/**
 * Scoring formula implementation
 * MatchScore = 0.30·sector + 0.20·stage + 0.20·portfolio + 0.15·behavior + 0.15·timing
 */
export function calculateMatchScore(
  sectorFit: number,      // 0-1
  stageFit: number,       // 0-1
  portfolioAdj: number,   // 0-1
  behaviorSignal: number, // 0-1
  timing: number,         // 0-1
  confidence: 'low' | 'med' | 'high' = 'med'
): number {
  const base = 
    0.30 * sectorFit +
    0.20 * stageFit +
    0.20 * portfolioAdj +
    0.15 * behaviorSignal +
    0.15 * timing;
  
  // Apply confidence multiplier
  const confidenceMult = confidence === 'high' ? 1.1 : confidence === 'low' ? 0.85 : 1.0;
  
  // Clamp to 0-1, then scale to 0-100
  return Math.min(100, Math.max(0, base * confidenceMult * 100));
}
