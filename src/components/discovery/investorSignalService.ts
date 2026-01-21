/**
 * INVESTOR SIGNAL SERVICE
 * =======================
 * Generates the Discovery Snapshot data based on startup analysis.
 * Maps GOD scores and startup attributes to investor-relevant signals.
 * 
 * This is the "market voice" - observational, not evaluative.
 */

import type { 
  AlignmentStatus, 
  SignalCard, 
  AlignmentDriver, 
  ExampleCard,
  DiscoveryData 
} from './DiscoverySnapshot';

// Input: what we know about the startup
export interface StartupAnalysis {
  name: string;
  sectors?: string[];
  stage?: string;
  total_god_score?: number;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  vision_score?: number;
  // Detected attributes
  hasRevenue?: boolean;
  hasProduct?: boolean;
  teamSize?: number;
  foundingYear?: number;
  hasExternalFunding?: boolean;
  techStack?: string[];
  // From enrichment
  description?: string;
  signals?: string[];
}

// Determine alignment status from GOD score
export function determineAlignmentStatus(godScore?: number): AlignmentStatus {
  if (!godScore || godScore < 45) return 'LIMITED';
  if (godScore < 65) return 'FORMING';
  return 'ALIGNED';
}

// Generate signal cards based on startup analysis
export function generateSignalCards(analysis: StartupAnalysis): SignalCard[] {
  const signals: SignalCard[] = [];
  const { team_score, traction_score, market_score, product_score, total_god_score } = analysis;
  
  // Technical credibility signal
  if (team_score && team_score >= 60) {
    signals.push({
      name: 'Technical credibility',
      observation: 'Teams with demonstrated technical expertise attract earlier deep-tech investor interest.'
    });
  } else if (team_score && team_score >= 45) {
    signals.push({
      name: 'Technical credibility',
      observation: 'Emerging technical foundations are being established. Investors monitor team evolution at this stage.'
    });
  }

  // Customer pull / traction signal
  if (traction_score && traction_score >= 60) {
    signals.push({
      name: 'Customer pull',
      observation: 'Usage patterns align with seed-stage investor screening behavior.'
    });
  } else if (traction_score && traction_score >= 45) {
    signals.push({
      name: 'Early adoption signals',
      observation: 'Initial user engagement detected. Investors track velocity of early adoption.'
    });
  }

  // Market signal
  if (market_score && market_score >= 60) {
    signals.push({
      name: 'Market positioning',
      observation: 'Category positioning matches investor thesis patterns in active deployment cycles.'
    });
  } else if (market_score && market_score >= 45) {
    signals.push({
      name: 'Market signal',
      observation: 'Market category is within active investor interest areas. Timing matters at this stage.'
    });
  }

  // Product signal
  if (product_score && product_score >= 60) {
    signals.push({
      name: 'Product velocity',
      observation: 'Development cadence matches companies that typically raise within 6–12 months.'
    });
  } else if (product_score && product_score >= 45) {
    signals.push({
      name: 'Product development',
      observation: 'Product iteration patterns are emerging. Investors observe momentum over features.'
    });
  }

  // Founder velocity (composite signal)
  if (total_god_score && total_god_score >= 70) {
    signals.push({
      name: 'Founder velocity',
      observation: 'Execution cadence matches companies that typically raise within 6–12 months.'
    });
  }

  // Distribution signal (if has traction)
  if (analysis.hasProduct && traction_score && traction_score >= 50) {
    signals.push({
      name: 'Distribution signal',
      observation: 'Organic growth patterns resemble startups investors monitor before outreach.'
    });
  }

  // If we have few signals, add generic observational ones
  if (signals.length < 3) {
    if (!signals.find(s => s.name.includes('Market'))) {
      signals.push({
        name: 'Category presence',
        observation: 'Startup operates in a category with active investor attention.'
      });
    }
  }

  return signals.slice(0, 5); // Max 5 signals
}

// Generate "what strengthens alignment" list
export function generateStrengthens(analysis: StartupAnalysis): string[] {
  const items: string[] = [];
  const stage = analysis.stage?.toLowerCase() || 'seed';
  
  // Universal strengtheners
  items.push('Senior technical hire or co-founder');
  items.push('Independent product validation');
  
  // Stage-specific
  if (stage.includes('pre') || stage.includes('idea')) {
    items.push('First design partner or pilot customer');
    items.push('Working prototype with user testing');
  } else if (stage.includes('seed')) {
    items.push('Sustained usage growth');
    items.push('Credible partnership or customer reference');
  } else {
    items.push('Revenue acceleration');
    items.push('Key executive hires');
  }
  
  // Sector-specific
  if (analysis.sectors?.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('ml'))) {
    items.push('Open-source traction or research publication');
  }
  if (analysis.sectors?.some(s => s.toLowerCase().includes('fintech') || s.toLowerCase().includes('health'))) {
    items.push('Regulatory clarity or compliance milestone');
  }

  return items.slice(0, 5);
}

// Generate "what weakens alignment" list  
export function generateWeakens(): string[] {
  return [
    'Long execution gaps',
    'Loss of technical founder',
    'Negative press or regulatory friction',
    'Churn spikes or usage decline'
  ];
}

// Generate alignment drivers from component scores
export function generateDrivers(analysis: StartupAnalysis): AlignmentDriver[] {
  const drivers: AlignmentDriver[] = [];
  
  const scoreToStatus = (score?: number): 'strong' | 'forming' | 'early' | 'uneven' | 'limited' => {
    if (!score || score < 40) return 'limited';
    if (score < 50) return 'early';
    if (score < 60) return 'uneven';
    if (score < 70) return 'forming';
    return 'strong';
  };

  if (analysis.team_score !== undefined) {
    drivers.push({ name: 'Technical credibility', status: scoreToStatus(analysis.team_score) });
  }
  if (analysis.traction_score !== undefined) {
    drivers.push({ name: 'Customer pull', status: scoreToStatus(analysis.traction_score) });
  }
  if (analysis.product_score !== undefined) {
    drivers.push({ name: 'Execution velocity', status: scoreToStatus(analysis.product_score) });
  }
  if (analysis.market_score !== undefined) {
    drivers.push({ name: 'Market position', status: scoreToStatus(analysis.market_score) });
  }
  if (analysis.vision_score !== undefined) {
    drivers.push({ name: 'Capital signals', status: scoreToStatus(analysis.vision_score) });
  }
  
  // Add distribution if we have enough data
  if (analysis.hasProduct && analysis.traction_score) {
    drivers.push({ 
      name: 'Distribution', 
      status: scoreToStatus(Math.min(analysis.traction_score, analysis.product_score || 50)) 
    });
  }

  return drivers.slice(0, 6);
}

// Generate stage-matched example cards
export function generateExamples(analysis: StartupAnalysis): ExampleCard[] {
  const stage = analysis.stage?.toLowerCase() || 'seed';
  const sectors = analysis.sectors || [];
  const examples: ExampleCard[] = [];

  // Determine primary sector for examples
  const isAI = sectors.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('ml'));
  const isFintech = sectors.some(s => s.toLowerCase().includes('fintech') || s.toLowerCase().includes('finance'));
  const isDevtools = sectors.some(s => s.toLowerCase().includes('dev') || s.toLowerCase().includes('infra'));
  const isHealth = sectors.some(s => s.toLowerCase().includes('health') || s.toLowerCase().includes('bio'));
  const isHardware = sectors.some(s => s.toLowerCase().includes('hardware') || s.toLowerCase().includes('robot'));

  // Pre-seed / Idea stage examples
  if (stage.includes('pre') || stage.includes('idea')) {
    examples.push({
      startupType: 'Pre-seed devtools startup',
      whatChanged: 'Built public beta and onboarded 50 developers in first month',
      result: 'Entered monitoring lists of 3 seed funds within 60 days'
    });
    examples.push({
      startupType: 'First-time founders',
      whatChanged: 'Recruited advisor with successful exit in same category',
      result: 'Investor response rate improved significantly'
    });
  }

  // Seed stage examples
  if (stage.includes('seed') || !stage.includes('pre')) {
    if (isDevtools || isAI) {
      examples.push({
        startupType: 'Seed-stage devtools startup',
        whatChanged: 'Added senior infra engineer and shipped v2 within 90 days',
        result: 'Investor screening frequency increased within 3 months'
      });
    }
    if (isAI) {
      examples.push({
        startupType: 'AI infra company',
        whatChanged: 'Open-sourced core model and gained early technical adoption',
        result: 'Entered shortlists of multiple seed funds'
      });
    }
    if (isFintech) {
      examples.push({
        startupType: 'Fintech founder',
        whatChanged: 'Completed independent compliance audit before fundraising',
        result: 'Investor response rate improved materially'
      });
    }
    if (isHealth) {
      examples.push({
        startupType: 'Healthtech startup',
        whatChanged: 'Secured pilot with regional health system',
        result: 'Healthcare-focused VCs initiated outreach'
      });
    }
    if (isHardware) {
      examples.push({
        startupType: 'Robotics startup',
        whatChanged: 'Signed first design-partner agreement with OEM',
        result: 'Moved into active monitoring by deep-tech funds'
      });
    }
  }

  // Generic high-quality examples if we need more
  if (examples.length < 3) {
    examples.push({
      startupType: 'Technical founder duo',
      whatChanged: 'Published detailed technical blog gaining industry attention',
      result: 'Inbound interest from thesis-aligned investors increased'
    });
    examples.push({
      startupType: 'Solo technical founder',
      whatChanged: 'Recruited experienced go-to-market co-founder',
      result: 'Investor conversations accelerated to term sheet discussions'
    });
    examples.push({
      startupType: 'Seed-stage SaaS',
      whatChanged: 'Achieved 3 consecutive months of 15%+ MoM growth',
      result: 'Multiple investors proactively reached out'
    });
  }

  return examples.slice(0, 5);
}

// Main function: Generate complete discovery data
export function generateDiscoveryData(
  analysis: StartupAnalysis,
  investors: { id: string; name: string; focus: string; whyAligned: string }[] = []
): DiscoveryData {
  const status = determineAlignmentStatus(analysis.total_god_score);
  const signals = generateSignalCards(analysis);
  const strengthens = generateStrengthens(analysis);
  const weakens = generateWeakens();
  const examples = generateExamples(analysis);
  const drivers = generateDrivers(analysis);
  
  // Only include score if we have a GOD score
  const score = analysis.total_god_score ? Math.round(analysis.total_god_score) : undefined;

  return {
    status,
    signals,
    strengthens,
    weakens,
    investors,
    examples,
    score,
    drivers: drivers.length > 0 ? drivers : undefined
  };
}
