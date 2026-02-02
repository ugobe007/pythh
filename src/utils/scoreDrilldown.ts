/**
 * SCORE DRILL-DOWN DATA GENERATOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Generates the canonical drill-down payload from:
 * - Startup data (component scores)
 * - Lens configuration (weights + philosophy)
 * 
 * This is the bridge between our VC_LENSES definitions and the drawer UI.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// TYPES (matches ScoreDrilldownDrawer expectations)
// ═══════════════════════════════════════════════════════════════

export interface StartupWithScores {
  id: string;
  name: string;
  company_name?: string;
  sector?: string;
  sectors?: string[];
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  vision_score?: number;
  total_god_score?: number;
}

export interface LensConfig {
  id: string;
  label: string;
  accent: string;
  weights: {
    team: number;
    traction: number;
    market: number;
    product: number;
    vision: number;
  };
  philosophy?: string;
}

export interface DrilldownPayload {
  startup: {
    id: string;
    name: string;
    sector: string;
  };
  lens: {
    id: string;
    label: string;
    accent: string;
  };
  score: {
    value: number;
    rank: number;
    delta: number;
    velocity: string;
    window: string;
  };
  weights: Array<{
    factor: string;
    label: string;
    weight: number;
  }>;
  breakdown: Array<{
    factor: string;
    label: string;
    contribution: number;
  }>;
  evidence: Array<{
    factor: string;
    label: string;
    items: Array<{
      claim: string;
      source: string;
      confidence: 'high' | 'medium' | 'low';
    }>;
  }>;
  sensitivity: Array<{
    factor: string;
    label: string;
    range: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// FACTOR LABELS (human-readable)
// ═══════════════════════════════════════════════════════════════

const FACTOR_LABELS: Record<string, string> = {
  team: 'Team credibility',
  traction: 'Traction quality',
  market: 'Market size & inevitability',
  product: 'Product strength',
  vision: 'Vision & narrative',
};

// ═══════════════════════════════════════════════════════════════
// EVIDENCE TEMPLATES (per factor)
// ═══════════════════════════════════════════════════════════════

const EVIDENCE_TEMPLATES: Record<string, Array<{
  claim: string;
  source: string;
  threshold: number; // Score above which this evidence applies
  confidence: 'high' | 'medium' | 'low';
}>> = {
  team: [
    { claim: 'Strong founding team detected', source: 'profile analysis', threshold: 80, confidence: 'high' },
    { claim: 'Prior startup experience', source: 'public bios', threshold: 70, confidence: 'medium' },
    { claim: 'Domain expertise signals', source: 'background check', threshold: 60, confidence: 'medium' },
    { claim: 'Team completeness assessed', source: 'org data', threshold: 50, confidence: 'low' },
  ],
  traction: [
    { claim: 'Growth acceleration detected', source: 'metrics analysis', threshold: 80, confidence: 'high' },
    { claim: 'User engagement signals strong', source: 'activity data', threshold: 70, confidence: 'medium' },
    { claim: 'Revenue indicators present', source: 'financial signals', threshold: 65, confidence: 'medium' },
    { claim: 'Early traction signals', source: 'market presence', threshold: 50, confidence: 'low' },
  ],
  market: [
    { claim: 'Large addressable market confirmed', source: 'market research', threshold: 85, confidence: 'high' },
    { claim: 'Market timing favorable', source: 'trend analysis', threshold: 75, confidence: 'high' },
    { claim: 'Category tailwinds detected', source: 'industry signals', threshold: 65, confidence: 'medium' },
    { claim: 'Market opportunity identified', source: 'sector data', threshold: 50, confidence: 'low' },
  ],
  product: [
    { claim: 'Product differentiation clear', source: 'competitive analysis', threshold: 80, confidence: 'high' },
    { claim: 'Technical moat detected', source: 'product review', threshold: 70, confidence: 'medium' },
    { claim: 'User feedback positive', source: 'sentiment analysis', threshold: 60, confidence: 'medium' },
    { claim: 'MVP validation signals', source: 'market feedback', threshold: 50, confidence: 'low' },
  ],
  vision: [
    { claim: 'Compelling long-term vision', source: 'narrative analysis', threshold: 85, confidence: 'high' },
    { claim: 'Category-defining potential', source: 'positioning review', threshold: 75, confidence: 'high' },
    { claim: 'Strategic clarity present', source: 'pitch analysis', threshold: 65, confidence: 'medium' },
    { claim: 'Vision articulated', source: 'content review', threshold: 50, confidence: 'low' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// SENSITIVITY TEMPLATES
// ═══════════════════════════════════════════════════════════════

const SENSITIVITY_TEMPLATES: Record<string, {
  positive: string;
  negative: string;
}> = {
  team: {
    positive: '+3 to +8',
    negative: '-2 to -6',
  },
  traction: {
    positive: '+4 to +10',
    negative: '-3 to -8',
  },
  market: {
    positive: '+2 to +6',
    negative: '-2 to -5',
  },
  product: {
    positive: '+2 to +7',
    negative: '-2 to -5',
  },
  vision: {
    positive: '+1 to +5',
    negative: '-1 to -4',
  },
};

// ═══════════════════════════════════════════════════════════════
// MAIN GENERATOR FUNCTION
// ═══════════════════════════════════════════════════════════════

export function generateDrilldownData(
  startup: StartupWithScores,
  lens: LensConfig,
  rank: number,
  delta: number = 0,
): DrilldownPayload {
  // Get component scores (default to 50 if missing)
  const scores = {
    team: startup.team_score ?? 50,
    traction: startup.traction_score ?? 50,
    market: startup.market_score ?? 50,
    product: startup.product_score ?? 50,
    vision: startup.vision_score ?? 50,
  };

  // Calculate weighted contributions
  const contributions = {
    team: scores.team * lens.weights.team,
    traction: scores.traction * lens.weights.traction,
    market: scores.market * lens.weights.market,
    product: scores.product * lens.weights.product,
    vision: scores.vision * lens.weights.vision,
  };

  const totalScore = Object.values(contributions).reduce((a, b) => a + b, 0);

  // Build weights array (sorted by absolute weight descending)
  const weightsArray = Object.entries(lens.weights)
    .map(([factor, weight]) => ({
      factor,
      label: FACTOR_LABELS[factor] || factor,
      weight,
    }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  // Build breakdown array (sorted by contribution descending)
  const breakdownArray = Object.entries(contributions)
    .map(([factor, contribution]) => ({
      factor,
      label: FACTOR_LABELS[factor] || factor,
      contribution,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Build evidence array (only for factors with significant weight)
  const evidenceArray = Object.entries(lens.weights)
    .filter(([_, weight]) => weight >= 0.15) // Only show evidence for meaningful weights
    .map(([factor, weight]) => {
      const factorScore = scores[factor as keyof typeof scores];
      const templates = EVIDENCE_TEMPLATES[factor] || [];
      
      // Get applicable evidence items
      const items = templates
        .filter(t => factorScore >= t.threshold)
        .slice(0, 3) // Max 3 items per factor
        .map(t => ({
          claim: t.claim,
          source: t.source,
          confidence: t.confidence,
        }));

      return {
        factor,
        label: FACTOR_LABELS[factor] || factor,
        items: items.length > 0 ? items : [{
          claim: 'Limited evidence available for this factor (yet)',
          source: 'system',
          confidence: 'low' as const,
        }],
      };
    })
    .filter(e => e.items.length > 0);

  // Build sensitivity array (top 3 factors by weight)
  const sensitivityArray = Object.entries(lens.weights)
    .filter(([_, weight]) => weight >= 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([factor, weight]) => {
      const template = SENSITIVITY_TEMPLATES[factor];
      const factorScore = scores[factor as keyof typeof scores];
      
      // Adjust sensitivity based on current score
      const isStrong = factorScore >= 70;
      
      return {
        factor,
        label: `${FACTOR_LABELS[factor]} ${isStrong ? 'strengthens' : 'improves'}`,
        range: template?.positive || '+1 to +5',
      };
    });

  // Determine sector string
  const sector = startup.sector || 
    (startup.sectors && startup.sectors[0]) || 
    'Technology';

  return {
    startup: {
      id: startup.id,
      name: startup.name || startup.company_name || 'Unknown',
      sector,
    },
    lens: {
      id: lens.id,
      label: lens.label,
      accent: lens.accent,
    },
    score: {
      value: totalScore,
      rank,
      delta,
      velocity: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
      window: '24h',
    },
    weights: weightsArray,
    breakdown: breakdownArray,
    evidence: evidenceArray,
    sensitivity: sensitivityArray,
  };
}

export default generateDrilldownData;
