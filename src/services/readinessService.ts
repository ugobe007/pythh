/**
 * Readiness Assessment Service
 * 
 * Evaluates founder readiness for specific investors.
 * "Pythh doesn't introduce founders. It shows you how to enter the flow correctly."
 */

import type { InvestorPrepProfile, FounderReadinessSnapshot, EntryPathPattern } from '../lib/database.types';

// =============================================================================
// FOUNDER SIGNAL EXTRACTION
// =============================================================================

export interface FounderSignals {
  // Technical signals
  technicalCredibility: boolean;
  technicalTeam: boolean;
  openSourceContributions: boolean;
  technicalBlogContent: boolean;
  
  // Traction signals
  designPartnerTraction: boolean;
  paidCustomers: boolean;
  enterprisePilot: boolean;
  revenueGrowth: boolean;
  userGrowth: boolean;
  
  // Team signals
  seniorTechnicalHire: boolean;
  domainExpertise: boolean;
  repeatFounder: boolean;
  founderVelocity: boolean;
  
  // Validation signals
  operatorReferral: boolean;
  advisorIntro: boolean;
  independentValidation: boolean;
  industryRecognition: boolean;
  
  // Stage indicators
  currentStage: 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'growth';
  monthsInMarket: number;
  lastMilestoneDate?: Date;
}

/**
 * Extract founder signals from startup data
 */
export function extractFounderSignals(startupData: Record<string, unknown>): FounderSignals {
  const extracted = startupData?.extracted_data as Record<string, unknown> | undefined;
  const team = (extracted?.team || startupData?.team || '') as string;
  const traction = (extracted?.traction || startupData?.traction || '') as string;
  const product = (extracted?.product || startupData?.product || '') as string;
  const funding = startupData?.total_funding_usd as number | undefined;
  
  // Heuristic signal detection
  const teamLower = team.toLowerCase();
  const tractionLower = traction.toLowerCase();
  const productLower = product.toLowerCase();
  
  return {
    // Technical signals
    technicalCredibility: teamLower.includes('engineer') || teamLower.includes('technical') || teamLower.includes('phd'),
    technicalTeam: teamLower.includes('cto') || teamLower.includes('vp engineering') || teamLower.includes('tech lead'),
    openSourceContributions: productLower.includes('open source') || productLower.includes('github'),
    technicalBlogContent: false, // Would need external data
    
    // Traction signals
    designPartnerTraction: tractionLower.includes('design partner') || tractionLower.includes('pilot'),
    paidCustomers: tractionLower.includes('paying customer') || tractionLower.includes('revenue'),
    enterprisePilot: tractionLower.includes('enterprise') && tractionLower.includes('pilot'),
    revenueGrowth: tractionLower.includes('mrr') || tractionLower.includes('arr') || tractionLower.includes('revenue growth'),
    userGrowth: tractionLower.includes('users') || tractionLower.includes('growth'),
    
    // Team signals
    seniorTechnicalHire: teamLower.includes('vp') || teamLower.includes('director') || teamLower.includes('senior'),
    domainExpertise: teamLower.includes('years') || teamLower.includes('expert') || teamLower.includes('veteran'),
    repeatFounder: teamLower.includes('serial') || teamLower.includes('previously founded') || teamLower.includes('exited'),
    founderVelocity: Boolean((startupData?.god_score_details as Record<string, number> | undefined)?.velocity_score && (startupData.god_score_details as Record<string, number>).velocity_score > 70),
    
    // Validation signals
    operatorReferral: false, // Would need relationship data
    advisorIntro: false, // Would need relationship data
    independentValidation: tractionLower.includes('featured') || tractionLower.includes('press') || tractionLower.includes('award'),
    industryRecognition: tractionLower.includes('top') || tractionLower.includes('best') || tractionLower.includes('leading'),
    
    // Stage indicators
    currentStage: inferStage(funding),
    monthsInMarket: calculateMonthsInMarket(startupData?.created_at as string | undefined),
    lastMilestoneDate: undefined
  };
}

function inferStage(funding?: number): FounderSignals['currentStage'] {
  if (!funding || funding < 500000) return 'pre-seed';
  if (funding < 3000000) return 'seed';
  if (funding < 15000000) return 'series-a';
  if (funding < 50000000) return 'series-b';
  return 'growth';
}

function calculateMonthsInMarket(createdAt?: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

// =============================================================================
// SIGNAL MATCHING
// =============================================================================

const SIGNAL_DISPLAY_NAMES: Record<string, string> = {
  technicalCredibility: 'Technical credibility',
  technicalTeam: 'Strong technical team',
  openSourceContributions: 'Open source contributions',
  technicalBlogContent: 'Technical thought leadership',
  designPartnerTraction: 'Design partner traction',
  paidCustomers: 'Paying customers',
  enterprisePilot: 'Enterprise pilot',
  revenueGrowth: 'Revenue growth',
  userGrowth: 'User growth',
  seniorTechnicalHire: 'Senior technical hire',
  domainExpertise: 'Domain expertise',
  repeatFounder: 'Repeat founder',
  founderVelocity: 'High founder velocity',
  operatorReferral: 'Operator referral',
  advisorIntro: 'Advisor introduction',
  independentValidation: 'Independent validation',
  industryRecognition: 'Industry recognition'
};

/**
 * Match founder signals against investor requirements
 */
export function matchSignals(
  founderSignals: FounderSignals,
  investorProfile: InvestorPrepProfile
): { matched: string[]; missing: string[]; coverageRatio: number } {
  const allRequiredSignals = [
    ...investorProfile.dominant_signals,
    ...investorProfile.secondary_signals
  ];
  
  const matched: string[] = [];
  const missing: string[] = [];
  
  for (const signal of allRequiredSignals) {
    const signalKey = signal.replace(/\s+/g, '').toLowerCase();
    const founderHasSignal = Object.entries(founderSignals).some(([key, value]) => {
      if (typeof value !== 'boolean') return false;
      return key.toLowerCase().includes(signalKey) || signalKey.includes(key.toLowerCase());
    });
    
    // Also check by display name match
    const founderHasByName = Object.entries(SIGNAL_DISPLAY_NAMES).some(([key, displayName]) => {
      if (displayName.toLowerCase() === signal.toLowerCase()) {
        return founderSignals[key as keyof FounderSignals] === true;
      }
      return false;
    });
    
    if (founderHasSignal || founderHasByName) {
      matched.push(signal);
    } else {
      missing.push(signal);
    }
  }
  
  const dominantMatched = investorProfile.dominant_signals.filter(s => matched.includes(s)).length;
  const dominantTotal = investorProfile.dominant_signals.length;
  
  // Weight dominant signals more heavily
  const coverageRatio = dominantTotal > 0
    ? (dominantMatched / dominantTotal) * 0.7 + (matched.length / Math.max(allRequiredSignals.length, 1)) * 0.3
    : matched.length / Math.max(allRequiredSignals.length, 1);
  
  return { matched, missing, coverageRatio };
}

// =============================================================================
// TIMING ASSESSMENT
// =============================================================================

export interface TimingAssessment {
  state: FounderReadinessSnapshot['timing_state'];
  reason: string;
  suggestion: string;
}

/**
 * Assess timing for outreach
 */
export function assessTiming(
  founderSignals: FounderSignals,
  investorProfile: InvestorPrepProfile,
  signalCoverage: number
): TimingAssessment {
  const { timing_sensitivity, typical_timing_triggers } = investorProfile;
  
  // Check if founder has typical timing triggers
  const hasTriggers = typical_timing_triggers.some(trigger => {
    const triggerLower = trigger.toLowerCase();
    if (triggerLower.includes('design partner') && founderSignals.designPartnerTraction) return true;
    if (triggerLower.includes('enterprise pilot') && founderSignals.enterprisePilot) return true;
    if (triggerLower.includes('revenue') && founderSignals.revenueGrowth) return true;
    if (triggerLower.includes('hire') && founderSignals.seniorTechnicalHire) return true;
    return false;
  });
  
  // Timing state logic
  if (signalCoverage >= 0.8 && hasTriggers) {
    return {
      state: 'optimal',
      reason: 'You have strong signal coverage and recent timing triggers',
      suggestion: 'This is an ideal time to pursue introduction'
    };
  }
  
  if (signalCoverage >= 0.6 && hasTriggers) {
    return {
      state: 'optimal',
      reason: 'Good signal match with active timing triggers',
      suggestion: 'Consider reaching out now while momentum is fresh'
    };
  }
  
  if (signalCoverage >= 0.6) {
    return {
      state: 'early',
      reason: 'Good signal coverage but no recent timing trigger',
      suggestion: timing_sensitivity === 'critical'
        ? 'Wait for a clear milestone before outreach'
        : 'You could reach out now with a soft touch'
    };
  }
  
  if (signalCoverage >= 0.4) {
    if (timing_sensitivity === 'low') {
      return {
        state: 'early',
        reason: 'Moderate signal coverage, investor is timing-flexible',
        suggestion: 'Build more traction, but early outreach won\'t hurt'
      };
    }
    return {
      state: 'too_early',
      reason: 'Need more signal coverage before this investor will engage',
      suggestion: 'Focus on building the missing signals first'
    };
  }
  
  return {
    state: 'too_early',
    reason: 'Significant signal gaps exist',
    suggestion: 'Build foundation before approaching this investor'
  };
}

// =============================================================================
// READINESS SCORE CALCULATION
// =============================================================================

/**
 * Calculate overall readiness score (0-100)
 */
export function calculateReadinessScore(
  signalCoverage: number,
  timingState: FounderReadinessSnapshot['timing_state'],
  hasEntryPath: boolean
): number {
  let score = signalCoverage * 60; // Signal coverage is 60% of score
  
  // Timing state contribution (25%)
  const timingScores: Record<FounderReadinessSnapshot['timing_state'], number> = {
    'optimal': 25,
    'late': 20,
    'early': 15,
    'too_early': 5,
    'missed': 0,
    'unknown': 10
  };
  score += timingScores[timingState];
  
  // Entry path availability (15%)
  if (hasEntryPath) {
    score += 15;
  }
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

// =============================================================================
// RECOMMENDED ACTIONS
// =============================================================================

/**
 * Generate recommended next steps based on gaps
 */
export function generateRecommendedSteps(
  missingSignals: string[],
  timingState: FounderReadinessSnapshot['timing_state'],
  investorProfile: InvestorPrepProfile
): string[] {
  const steps: string[] = [];
  
  // Address missing signals
  for (const signal of missingSignals.slice(0, 3)) {
    const action = getActionForSignal(signal);
    if (action) steps.push(action);
  }
  
  // Add timing-based recommendations
  if (timingState === 'too_early' || timingState === 'early') {
    const triggers = investorProfile.typical_timing_triggers;
    if (triggers.length > 0) {
      steps.push(`Wait for: ${triggers[0]}`);
    }
  }
  
  // Add entry path recommendations
  const topPath = investorProfile.entry_paths_ranked[0];
  if (topPath) {
    steps.push(`Best entry path: ${topPath.path}`);
  }
  
  return steps.slice(0, 5);
}

function getActionForSignal(signal: string): string | null {
  const signalLower = signal.toLowerCase();
  
  if (signalLower.includes('design partner') || signalLower.includes('pilot')) {
    return 'Secure a design partner or pilot customer';
  }
  if (signalLower.includes('technical') && signalLower.includes('hire')) {
    return 'Make a senior technical hire';
  }
  if (signalLower.includes('validation') || signalLower.includes('independent')) {
    return 'Get independent validation (press, award, or expert endorsement)';
  }
  if (signalLower.includes('referral') || signalLower.includes('operator')) {
    return 'Build relationship with a domain operator who can refer you';
  }
  if (signalLower.includes('revenue') || signalLower.includes('paying')) {
    return 'Convert pilot to paying customer';
  }
  if (signalLower.includes('technical') && signalLower.includes('blog')) {
    return 'Publish technical thought leadership content';
  }
  if (signalLower.includes('open source')) {
    return 'Contribute to or launch open source project';
  }
  
  return `Build: ${signal}`;
}

// =============================================================================
// FULL READINESS ASSESSMENT
// =============================================================================

export interface ReadinessAssessment {
  matchedSignals: string[];
  missingSignals: string[];
  signalCoverageRatio: number;
  timing: TimingAssessment;
  readinessScore: number;
  recommendedNextSteps: string[];
  entryPaths: EntryPathPattern[];
  investorProfile: InvestorPrepProfile;
}

/**
 * Perform full readiness assessment for a founder-investor pair
 */
export function assessFounderReadiness(
  startupData: Record<string, unknown>,
  investorProfile: InvestorPrepProfile,
  entryPaths: EntryPathPattern[] = []
): ReadinessAssessment {
  // Extract founder signals
  const founderSignals = extractFounderSignals(startupData);
  
  // Match against investor requirements
  const { matched, missing, coverageRatio } = matchSignals(founderSignals, investorProfile);
  
  // Assess timing
  const timing = assessTiming(founderSignals, investorProfile, coverageRatio);
  
  // Calculate readiness score
  const readinessScore = calculateReadinessScore(
    coverageRatio,
    timing.state,
    entryPaths.length > 0
  );
  
  // Generate recommendations
  const recommendedNextSteps = generateRecommendedSteps(missing, timing.state, investorProfile);
  
  return {
    matchedSignals: matched,
    missingSignals: missing,
    signalCoverageRatio: coverageRatio,
    timing,
    readinessScore,
    recommendedNextSteps,
    entryPaths: entryPaths.sort((a, b) => a.rank_order - b.rank_order),
    investorProfile
  };
}

// =============================================================================
// DEFAULT INVESTOR PROFILES (for demo/MVP)
// =============================================================================

export const DEFAULT_INVESTOR_PROFILES: Record<string, Partial<InvestorPrepProfile>> = {
  'technical_deep_tech': {
    dominant_signals: ['Technical credibility', 'Technical team depth', 'Domain expertise'],
    secondary_signals: ['Open source contributions', 'Technical thought leadership'],
    negative_signals: ['No technical founder', 'Outsourced development'],
    entry_paths_ranked: [
      { path: 'Technical community', effectiveness: 0.85, description: 'Conferences, open source, technical writing' },
      { path: 'Founder referral', effectiveness: 0.75, description: 'Introduction from technical founder in portfolio' },
      { path: 'Cold outreach with demo', effectiveness: 0.45, description: 'Technical demo or prototype walkthrough' }
    ],
    typical_timing_triggers: ['Working prototype', 'First technical hire', 'Open source traction'],
    timing_sensitivity: 'moderate',
    engagement_triggers: ['Novel technical approach', 'Deep domain expertise', 'Open source momentum']
  },
  'consumer_growth': {
    dominant_signals: ['User growth', 'Engagement metrics', 'Viral coefficient'],
    secondary_signals: ['Design excellence', 'Community building', 'Influencer traction'],
    negative_signals: ['No product-market fit signals', 'Paid acquisition only'],
    entry_paths_ranked: [
      { path: 'Viral product experience', effectiveness: 0.90, description: 'They discover and use the product' },
      { path: 'Founder referral', effectiveness: 0.70, description: 'Introduction from consumer founder' },
      { path: 'Twitter/social presence', effectiveness: 0.55, description: 'Building in public, thought leadership' }
    ],
    typical_timing_triggers: ['Hockey stick growth', '10k DAU', 'Press coverage'],
    timing_sensitivity: 'high',
    engagement_triggers: ['Explosive growth', 'Cultural moment', 'Influencer adoption']
  },
  'enterprise_saas': {
    dominant_signals: ['Enterprise pilot', 'Revenue growth', 'Sales efficiency'],
    secondary_signals: ['Domain expertise', 'Enterprise relationships', 'Technical credibility'],
    negative_signals: ['No enterprise experience', 'Consumer-only background'],
    entry_paths_ranked: [
      { path: 'Customer referral', effectiveness: 0.85, description: 'Introduction from enterprise customer or prospect' },
      { path: 'Operator referral', effectiveness: 0.80, description: 'Introduction from enterprise sales/GTM operator' },
      { path: 'Industry conference', effectiveness: 0.50, description: 'Speaking or exhibiting at relevant conference' }
    ],
    typical_timing_triggers: ['First enterprise contract', '$100k ARR', 'Strategic partnership'],
    timing_sensitivity: 'moderate',
    engagement_triggers: ['Land-and-expand evidence', 'Enterprise logo', 'Clear ICP definition']
  },
  'generalist_seed': {
    dominant_signals: ['Founder quality', 'Market insight', 'Early traction'],
    secondary_signals: ['Team completeness', 'Technical execution', 'Vision clarity'],
    negative_signals: ['Unfocused strategy', 'No differentiation'],
    entry_paths_ranked: [
      { path: 'Founder referral', effectiveness: 0.80, description: 'Introduction from portfolio founder' },
      { path: 'Advisor intro', effectiveness: 0.70, description: 'Introduction from known advisor or operator' },
      { path: 'Cold outreach with traction', effectiveness: 0.40, description: 'Compelling metrics in cold email' }
    ],
    typical_timing_triggers: ['Product launch', 'First customers', 'Key hire'],
    timing_sensitivity: 'low',
    engagement_triggers: ['Founder velocity', 'Unique insight', 'Early signal of PMF']
  }
};

/**
 * Get investor profile by archetype (for demo/MVP)
 */
export function getProfileByArchetype(archetype: string): InvestorPrepProfile {
  const profile = DEFAULT_INVESTOR_PROFILES[archetype] || DEFAULT_INVESTOR_PROFILES['generalist_seed'];
  
  return {
    id: `default-${archetype}`,
    investor_id: '',
    dominant_signals: profile.dominant_signals || [],
    secondary_signals: profile.secondary_signals || [],
    negative_signals: profile.negative_signals || [],
    entry_paths_ranked: profile.entry_paths_ranked || [],
    typical_timing_triggers: profile.typical_timing_triggers || [],
    timing_sensitivity: profile.timing_sensitivity || 'moderate',
    engagement_triggers: profile.engagement_triggers || [],
    confidence_level: 'inferred'
  };
}

/**
 * Infer archetype from investor data
 */
export function inferInvestorArchetype(investor: Record<string, unknown>): string {
  const sectors = (investor.sectors as string[] | undefined) || [];
  const thesis = ((investor.thesis || investor.description || '') as string).toLowerCase();
  const stage = investor.stage as string | undefined;
  
  // Check for deep tech
  if (sectors.some(s => ['deep tech', 'ai/ml', 'infrastructure', 'developer tools'].includes(s.toLowerCase())) ||
      thesis.includes('technical') || thesis.includes('deep tech')) {
    return 'technical_deep_tech';
  }
  
  // Check for consumer
  if (sectors.some(s => ['consumer', 'social', 'gaming', 'media'].includes(s.toLowerCase())) ||
      thesis.includes('consumer') || thesis.includes('viral')) {
    return 'consumer_growth';
  }
  
  // Check for enterprise
  if (sectors.some(s => ['enterprise', 'saas', 'b2b'].includes(s.toLowerCase())) ||
      thesis.includes('enterprise') || thesis.includes('b2b')) {
    return 'enterprise_saas';
  }
  
  // Default to generalist
  return 'generalist_seed';
}
