/**
 * INVESTOR FINGERPRINT SERVICE
 * ============================
 * The core moat engine that generates investor decision intelligence.
 * 
 * This service:
 * 1. Generates investor fingerprints (signals they respond to)
 * 2. Computes engagement patterns
 * 3. Determines timing patterns
 * 4. Identifies response triggers
 * 
 * This becomes incredibly hard to reverse engineer.
 */

import type { 
  InvestorFingerprint, 
  InvestorSignal,
  AlignmentExplanation,
  InvestorLensData 
} from './InvestorLensPanel';

// Input: What we know about the investor from our database
export interface InvestorData {
  id: string;
  name: string;
  firm?: string;
  title?: string;
  sectors?: string[];
  stage?: string;
  check_size_min?: number;
  check_size_max?: number;
  investment_thesis?: string;
  portfolio_companies?: string[];
  // Enrichment data
  focus_areas?: string[];
  investment_style?: string;
  preferred_intro_paths?: string[];
}

// Input: What we know about the startup for alignment
export interface StartupContext {
  sectors?: string[];
  stage?: string;
  total_god_score?: number;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
}

// Signal templates by investor archetype
const SIGNAL_TEMPLATES: Record<string, InvestorSignal[]> = {
  // Deep tech / Infra investors
  'infra': [
    { name: 'Technical founder credibility', observation: 'Often screens infra startups after senior engineering hires.' },
    { name: 'Open-source traction', observation: 'Prioritizes teams with early community adoption.' },
    { name: 'Execution velocity', observation: 'Responds to consistent shipping cadence pre-seed.' },
    { name: 'Design partners', observation: 'Engages after early OEM or enterprise pilots.' },
    { name: 'Technical benchmarks', observation: 'Values independent performance validation.' },
    { name: 'Founder network', observation: 'Introductions commonly come from domain operators.' },
    { name: 'Architecture clarity', observation: 'Looks for teams with clear technical vision.' },
  ],
  // AI / ML investors
  'ai': [
    { name: 'Technical founder credibility', observation: 'Screens AI teams after demonstrated ML expertise.' },
    { name: 'Research velocity', observation: 'Tracks teams shipping model improvements consistently.' },
    { name: 'Data moat signals', observation: 'Looks for proprietary data or unique training approaches.' },
    { name: 'Open-source traction', observation: 'Engages teams with community adoption of models or tools.' },
    { name: 'Enterprise pilots', observation: 'Responds after design partners validate production readiness.' },
    { name: 'Technical blog presence', observation: 'Values founders who share technical insights publicly.' },
    { name: 'Compute efficiency', observation: 'Looks for teams optimizing inference costs.' },
  ],
  // Fintech investors
  'fintech': [
    { name: 'Regulatory clarity', observation: 'Engages after compliance milestones or audits.' },
    { name: 'Financial services experience', observation: 'Values founders with domain expertise in banking/payments.' },
    { name: 'Partnership signals', observation: 'Responds to bank or financial institution pilots.' },
    { name: 'Trust infrastructure', observation: 'Looks for teams building secure, auditable systems.' },
    { name: 'Customer acquisition patterns', observation: 'Tracks CAC efficiency in financial verticals.' },
    { name: 'Revenue traction', observation: 'Engages after demonstrable transaction volume.' },
  ],
  // Consumer investors
  'consumer': [
    { name: 'Organic growth signals', observation: 'Prioritizes startups with viral or word-of-mouth adoption.' },
    { name: 'Retention metrics', observation: 'Looks for strong cohort retention before engaging.' },
    { name: 'Community building', observation: 'Values founders creating engaged user communities.' },
    { name: 'Brand clarity', observation: 'Responds to teams with distinct positioning.' },
    { name: 'Distribution insight', observation: 'Looks for unique go-to-market approaches.' },
    { name: 'Usage intensity', observation: 'Tracks daily/weekly active user patterns.' },
  ],
  // Enterprise / SaaS investors
  'enterprise': [
    { name: 'Enterprise pilots', observation: 'Engages after design partner agreements.' },
    { name: 'Sales motion clarity', observation: 'Values founders with clear go-to-market strategy.' },
    { name: 'Revenue traction', observation: 'Responds to demonstrated ARR growth.' },
    { name: 'Customer concentration', observation: 'Looks for diverse customer base signals.' },
    { name: 'Expansion revenue', observation: 'Tracks net revenue retention patterns.' },
    { name: 'Domain expertise', observation: 'Values founders with target industry experience.' },
  ],
  // Healthcare / Bio investors
  'healthcare': [
    { name: 'Regulatory pathway', observation: 'Engages after FDA/regulatory clarity.' },
    { name: 'Clinical validation', observation: 'Responds to pilot data from health systems.' },
    { name: 'Reimbursement clarity', observation: 'Looks for teams with payor strategy.' },
    { name: 'Domain expertise', observation: 'Values founders with clinical or healthcare operations experience.' },
    { name: 'Health system partnerships', observation: 'Tracks design partner agreements with providers.' },
  ],
  // Generalist / seed
  'generalist': [
    { name: 'Founder credibility', observation: 'Values demonstrated expertise in target domain.' },
    { name: 'Market timing', observation: 'Looks for startups riding macro trends.' },
    { name: 'Execution velocity', observation: 'Responds to consistent shipping and iteration.' },
    { name: 'Early traction', observation: 'Engages after initial customer validation.' },
    { name: 'Team completeness', observation: 'Values balanced founding teams.' },
    { name: 'Network quality', observation: 'Introductions from trusted sources carry weight.' },
  ],
};

// Engagement patterns by archetype
const ENGAGEMENT_PATTERNS: Record<string, string[]> = {
  'infra': [
    'Introduced through technical founders in portfolio',
    'Referred by domain operators or engineering leaders',
    'Meets founders through open-source communities',
    'Screens inbound after independent technical validation',
    'Often engages after design-partner traction',
    'Attends infrastructure-focused events and meetups',
  ],
  'ai': [
    'Introduced through ML researchers or practitioners',
    'Meets founders through AI research communities',
    'Screens inbound after technical blog posts or papers',
    'Referred by other technical founders in portfolio',
    'Engages after open-source model adoption',
    'Attends AI/ML conferences and academic events',
  ],
  'fintech': [
    'Introduced through financial services operators',
    'Referred by compliance or regulatory experts',
    'Meets founders through fintech industry events',
    'Screens inbound after bank or financial institution partnerships',
    'Often engages after regulatory milestone',
    'Values introductions from portfolio company CFOs',
  ],
  'consumer': [
    'Introduced through consumer brand operators',
    'Meets founders through product communities',
    'Screens inbound after viral growth signals',
    'Referred by successful consumer founders',
    'Engages after strong retention metrics emerge',
    'Attends consumer and D2C focused events',
  ],
  'enterprise': [
    'Introduced through enterprise sales leaders',
    'Referred by CXOs at target customer companies',
    'Meets founders through industry conferences',
    'Screens inbound after enterprise pilot closes',
    'Often engages after ARR milestone',
    'Values introductions from portfolio company executives',
  ],
  'healthcare': [
    'Introduced through healthcare operators or clinicians',
    'Referred by health system executives',
    'Meets founders through healthcare conferences',
    'Screens inbound after clinical pilot data',
    'Engages after regulatory clarity established',
    'Values introductions from clinical advisors',
  ],
  'generalist': [
    'Introduced through founders in portfolio',
    'Referred by trusted operators in relevant domain',
    'Screens inbound after strong traction signals',
    'Meets founders through accelerator networks',
    'Often engages after market timing aligns',
    'Values warm introductions from mutual connections',
  ],
};

// Timing patterns by archetype
const TIMING_PATTERNS: Record<string, string[]> = {
  'infra': [
    'After senior technical hire',
    'After first enterprise pilot',
    'During infra build cycles',
    'After benchmark results published',
    'After open-source adoption milestone',
  ],
  'ai': [
    'After model performance breakthrough',
    'After first enterprise deployment',
    'During AI infrastructure investment cycles',
    'After open-source release gains traction',
    'After technical validation from practitioners',
  ],
  'fintech': [
    'After regulatory approval or audit',
    'After first bank partnership',
    'During fintech funding cycles',
    'After transaction volume milestone',
    'After compliance framework established',
  ],
  'consumer': [
    'After viral growth signal',
    'After retention metrics stabilize',
    'During consumer market expansion',
    'After community reaches critical mass',
    'After unit economics prove out',
  ],
  'enterprise': [
    'After first enterprise contract',
    'After ARR milestone',
    'During enterprise budget cycles',
    'After expansion revenue demonstrated',
    'After sales motion validated',
  ],
  'healthcare': [
    'After FDA/regulatory milestone',
    'After clinical pilot data',
    'After health system partnership',
    'During healthcare innovation cycles',
    'After reimbursement pathway clear',
  ],
  'generalist': [
    'After clear product-market fit signal',
    'After founding team complete',
    'During favorable market timing',
    'After early customer validation',
    'After execution velocity demonstrated',
  ],
};

// Response triggers by archetype
const RESPONSE_TRIGGERS: Record<string, string[]> = {
  'infra': [
    'Technical blog post with benchmarks',
    'Operator referral from domain expert',
    'Design-partner LOI or pilot agreement',
    'Open-source repository milestone',
    'Independent technical audit or validation',
  ],
  'ai': [
    'Research paper or technical publication',
    'Model benchmark results',
    'Open-source model adoption metrics',
    'Enterprise pilot case study',
    'Referral from ML practitioner',
  ],
  'fintech': [
    'Regulatory milestone announcement',
    'Bank partnership press release',
    'Compliance audit completion',
    'Transaction volume milestone',
    'Referral from financial services operator',
  ],
  'consumer': [
    'Viral growth metric or press mention',
    'Strong retention data',
    'Community milestone',
    'Unit economics proof point',
    'Referral from successful consumer founder',
  ],
  'enterprise': [
    'Enterprise contract announcement',
    'ARR growth milestone',
    'Expansion revenue case study',
    'Customer reference from Fortune 500',
    'Referral from enterprise sales leader',
  ],
  'healthcare': [
    'FDA or regulatory approval',
    'Clinical pilot results',
    'Health system partnership',
    'Reimbursement pathway validation',
    'Referral from clinical advisor',
  ],
  'generalist': [
    'Clear traction milestone',
    'Press or industry recognition',
    'Customer validation story',
    'Operator referral',
    'Market timing signal',
  ],
};

/**
 * Determine investor archetype from their data
 */
function determineArchetype(investor: InvestorData): string {
  const sectors = (investor.sectors || []).map(s => s.toLowerCase());
  const thesis = (investor.investment_thesis || '').toLowerCase();
  const focus = (investor.focus_areas || []).map(f => f.toLowerCase());
  
  // Check for specific archetypes
  if (sectors.some(s => s.includes('infra') || s.includes('developer') || s.includes('devtools'))) {
    return 'infra';
  }
  if (sectors.some(s => s.includes('ai') || s.includes('ml') || s.includes('machine learning'))) {
    return 'ai';
  }
  if (sectors.some(s => s.includes('fintech') || s.includes('finance') || s.includes('banking'))) {
    return 'fintech';
  }
  if (sectors.some(s => s.includes('consumer') || s.includes('d2c') || s.includes('social'))) {
    return 'consumer';
  }
  if (sectors.some(s => s.includes('enterprise') || s.includes('saas') || s.includes('b2b'))) {
    return 'enterprise';
  }
  if (sectors.some(s => s.includes('health') || s.includes('bio') || s.includes('medical'))) {
    return 'healthcare';
  }
  
  // Default to generalist
  return 'generalist';
}

/**
 * Generate focus string from investor data
 */
function generateFocusString(investor: InvestorData): string {
  const stage = investor.stage || 'Seed';
  const sectors = (investor.sectors || ['Generalist']).slice(0, 3).join(', ');
  return `${stage} — ${sectors}`;
}

/**
 * Generate typical entry string
 */
function generateTypicalEntry(investor: InvestorData): string {
  const stage = (investor.stage || 'seed').toLowerCase();
  
  if (stage.includes('pre')) return 'Pre-seed → Seed';
  if (stage.includes('seed')) return 'Pre-seed → Series A';
  if (stage.includes('series a')) return 'Seed → Series A';
  if (stage.includes('series b')) return 'Series A → Series B';
  if (stage.includes('growth')) return 'Series B → Growth';
  
  return 'Seed → Series A';
}

/**
 * Generate the investor fingerprint
 */
export function generateInvestorFingerprint(investor: InvestorData): InvestorFingerprint {
  const archetype = determineArchetype(investor);
  
  return {
    id: investor.id,
    name: investor.firm ? `${investor.name} — ${investor.firm}` : investor.name,
    focus: generateFocusString(investor),
    typicalEntry: generateTypicalEntry(investor),
    dominantSignals: SIGNAL_TEMPLATES[archetype] || SIGNAL_TEMPLATES['generalist'],
    engagementPatterns: ENGAGEMENT_PATTERNS[archetype] || ENGAGEMENT_PATTERNS['generalist'],
    timingPatterns: TIMING_PATTERNS[archetype] || TIMING_PATTERNS['generalist'],
    responseTriggers: RESPONSE_TRIGGERS[archetype] || RESPONSE_TRIGGERS['generalist'],
  };
}

/**
 * Generate the alignment explanation (exactly 3 bullets)
 */
export function generateAlignmentExplanation(
  investor: InvestorData,
  startup: StartupContext
): AlignmentExplanation {
  const archetype = determineArchetype(investor);
  const bullets: string[] = [];
  
  // Bullet 1: Signal match based on scores
  if (startup.team_score && startup.team_score >= 60) {
    if (archetype === 'infra' || archetype === 'ai') {
      bullets.push('Matches technical credibility pattern seen in recent seed investments');
    } else {
      bullets.push('Founder credibility signals align with screening patterns');
    }
  } else if (startup.traction_score && startup.traction_score >= 60) {
    bullets.push('Early traction signals match companies monitored before outreach');
  } else {
    bullets.push('Signal profile matches startups at similar formation stage');
  }
  
  // Bullet 2: Execution/timing alignment
  if (startup.product_score && startup.product_score >= 55) {
    bullets.push('Execution cadence aligns with startups screened at formation stage');
  } else if (startup.market_score && startup.market_score >= 55) {
    bullets.push('Market positioning matches current investment thesis focus');
  } else {
    bullets.push('Stage and focus area overlap with active deployment patterns');
  }
  
  // Bullet 3: Pattern match
  const sectors = startup.sectors || [];
  const investorSectors = investor.sectors || [];
  const sectorOverlap = sectors.some(s => 
    investorSectors.some(is => 
      is.toLowerCase().includes(s.toLowerCase()) || 
      s.toLowerCase().includes(is.toLowerCase())
    )
  );
  
  if (sectorOverlap) {
    bullets.push(`Category focus (${sectors.slice(0, 2).join(', ')}) matches active screening areas`);
  } else if (startup.traction_score && startup.traction_score >= 50) {
    bullets.push('Customer pull resembles companies monitored before first outreach');
  } else {
    bullets.push('Profile archetype matches recent portfolio additions');
  }
  
  return { bullets: bullets.slice(0, 3) };
}

/**
 * Check if startup is aligned with investor
 */
export function checkAlignment(
  investor: InvestorData,
  startup: StartupContext
): boolean {
  // Stage alignment
  const investorStage = (investor.stage || 'seed').toLowerCase();
  const startupStage = (startup.stage || 'seed').toLowerCase();
  
  const stageCompatible = 
    investorStage.includes('seed') || 
    investorStage.includes('pre') ||
    investorStage.includes(startupStage) ||
    startupStage.includes('seed');
  
  // Sector alignment
  const investorSectors = (investor.sectors || []).map(s => s.toLowerCase());
  const startupSectors = (startup.sectors || []).map(s => s.toLowerCase());
  
  const sectorOverlap = investorSectors.length === 0 || startupSectors.some(ss =>
    investorSectors.some(is => is.includes(ss) || ss.includes(is))
  );
  
  // Score threshold
  const hasDecentScore = (startup.total_god_score || 50) >= 45;
  
  return stageCompatible && sectorOverlap && hasDecentScore;
}

/**
 * Generate complete Investor Lens data
 */
export function generateInvestorLensData(
  investor: InvestorData,
  startup: StartupContext
): InvestorLensData {
  const fingerprint = generateInvestorFingerprint(investor);
  const alignment = generateAlignmentExplanation(investor, startup);
  const isAligned = checkAlignment(investor, startup);
  
  return {
    fingerprint,
    alignment,
    isAligned,
  };
}
