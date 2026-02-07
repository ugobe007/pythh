// ============================================================================
// Pythh Oracle — VC Thesis Knowledge Base
// ============================================================================
// Proprietary intelligence on what top VCs actually look for.
// This is the Oracle's brain — the accumulated wisdom of how the best
// investors think, what triggers their conviction, and what kills deals.
//
// Sources: public interviews, blog posts, investment patterns, portfolio
// analysis, and proprietary Pythh signal correlation data.
// ============================================================================

// ---------------------------------------------------------------------------
// VC THESIS PROFILES
// ---------------------------------------------------------------------------

export interface VCThesisProfile {
  id: string;
  name: string;
  shortName: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  stage_focus: string[];
  avg_check: string;
  thesis_summary: string;

  // What they look for (weighted 0-1)
  founder_signals: FounderSignalWeights;

  // Deal-breakers & conviction triggers
  conviction_triggers: string[];
  deal_breakers: string[];

  // What they value in founder DNA
  dna_preferences: DNAPreference[];

  // Approach strategy
  approach_intel: ApproachIntel;
}

export interface FounderSignalWeights {
  technical_depth: number;        // Deep tech knowledge
  domain_expertise: number;       // Industry-specific experience
  previous_exits: number;         // Track record of exits
  operator_experience: number;    // Built/scaled teams before
  market_timing_sense: number;    // Why-now narrative strength
  narrative_clarity: number;      // Can they tell the story
  speed_of_execution: number;     // Ship velocity
  customer_obsession: number;     // User love / NPS / retention
  contrarian_thinking: number;    // Non-consensus, right
  network_density: number;        // Who they know, warm intros
  resilience_markers: number;     // Grit signals, pivots survived
  coachability: number;           // Open to feedback, learns fast
}

export interface DNAPreference {
  archetype: FounderArchetype;
  weight: number;  // 0-1, how much this VC values this archetype
  notes: string;
}

export type FounderArchetype =
  | 'repeat_founder'           // Done it before, doing it again
  | 'technical_visionary'      // Deep tech, building the future
  | 'domain_insider'           // Decade+ in the industry, saw the gap
  | 'corporate_spinout'        // Left BigCo with the insight
  | 'hot_startup_alumni'       // Left unicorn to build own thing
  | 'research_commercializer'  // PhD/researcher bringing science to market
  | 'young_technical'          // Under 30, native to current tech wave
  | 'industry_transformer'     // Rebuilding an old industry with new tech
  | 'marketplace_builder'      // Network effects, two-sided market expert
  | 'ai_native'               // Built on AI from day one
  | 'mission_driven'          // Solving a problem they lived through
  | 'immigrant_founder'       // Global perspective, hunger, resilience
  | 'serial_operator'         // COO/VP who finally starts own company
  | 'open_source_to_commercial'; // Community-first, monetizing open source

export interface ApproachIntel {
  best_intro_paths: string[];
  timing_notes: string;
  pitch_format_preference: string;
  meeting_style: string;
  decision_speed: string;
  follow_up_cadence: string;
  red_flags_in_pitch: string[];
  what_impresses_them: string[];
}

// ---------------------------------------------------------------------------
// THE KNOWLEDGE BASE
// ---------------------------------------------------------------------------

export const VC_THESIS_PROFILES: VCThesisProfile[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Y COMBINATOR
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'yc',
    name: 'Y Combinator',
    shortName: 'YC',
    tier: 'tier1',
    stage_focus: ['pre-seed', 'seed'],
    avg_check: '$500K (standard deal)',
    thesis_summary: 'Back exceptional founders building something people want. Bias toward speed, technical talent, and large markets. YC bets on founders first — the idea can change, the founders cannot.',

    founder_signals: {
      technical_depth: 0.9,
      domain_expertise: 0.5,
      previous_exits: 0.3,
      operator_experience: 0.4,
      market_timing_sense: 0.7,
      narrative_clarity: 0.8,
      speed_of_execution: 0.95,
      customer_obsession: 0.9,
      contrarian_thinking: 0.8,
      network_density: 0.3,
      resilience_markers: 0.8,
      coachability: 0.9,
    },

    conviction_triggers: [
      'Founder built the first version themselves (technical co-founder)',
      'Launched and has early users/revenue within weeks',
      'Solving a problem they personally experienced',
      'Growth rate > 15% week-over-week',
      'Can articulate the insight others are missing',
      'Team of 2-3 technical co-founders who complement each other',
      'Evidence of relentless execution speed',
    ],

    deal_breakers: [
      'No technical co-founder (outsourced dev)',
      'Founder cannot articulate what they build clearly in 1 sentence',
      'Spending before product-market fit',
      'Large team pre-revenue',
      'Problem is not large enough (niche hobby project)',
      'Founder is not full-time committed',
    ],

    dna_preferences: [
      { archetype: 'young_technical', weight: 0.9, notes: 'YC loves young technical founders who ship fast and iterate' },
      { archetype: 'technical_visionary', weight: 0.85, notes: 'Deep technical founders building hard things' },
      { archetype: 'repeat_founder', weight: 0.7, notes: 'Prior YC founders get fast-tracked' },
      { archetype: 'ai_native', weight: 0.85, notes: 'AI-first companies are a major current thesis' },
      { archetype: 'mission_driven', weight: 0.6, notes: 'Mission matters but execution matters more' },
      { archetype: 'immigrant_founder', weight: 0.8, notes: 'YC has strong track record backing immigrant founders' },
    ],

    approach_intel: {
      best_intro_paths: [
        'Apply directly (yc.com/apply) — this is the primary path',
        'Referral from YC alumni (strongest signal)',
        'Referral from YC partners or group partners',
        'YC Demo Day scouts and visiting partners',
      ],
      timing_notes: 'Two batches per year (Winter: Jan, Summer: Jun). Apply 2-3 months before. Off-cycle applications are reviewed but slower.',
      pitch_format_preference: 'Written application first (short, direct answers). Then 10-minute interview over video. No slides in interview — just conversation.',
      meeting_style: 'Fast, direct, challenging. They will interrupt. They test clarity of thought under pressure.',
      decision_speed: 'Very fast — 24 hours after interview. Sometimes same day.',
      follow_up_cadence: 'Weekly updates during batch. Post-batch: monthly investor updates.',
      red_flags_in_pitch: [
        'Buzzword-heavy pitch with no substance',
        'Cannot explain the product simply',
        'Co-founder conflict signals',
        'Unrealistic market size claims',
        'No evidence of customer conversations',
      ],
      what_impresses_them: [
        'Working product with real users',
        'Founder built it themselves over a weekend',
        'Clear, specific problem statement',
        'Evidence of learning velocity',
        'Unusual insight into the market',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ANDREESSEN HOROWITZ (a16z)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'a16z',
    name: 'Andreessen Horowitz',
    shortName: 'a16z',
    tier: 'tier1',
    stage_focus: ['seed', 'series-a', 'series-b', 'growth'],
    avg_check: '$5M-$100M (stage dependent)',
    thesis_summary: 'Software is eating the world. Back founders who are building category-defining companies in massive markets. Strong platform support model — a16z provides recruiting, marketing, BD, and executive coaching.',

    founder_signals: {
      technical_depth: 0.8,
      domain_expertise: 0.7,
      previous_exits: 0.6,
      operator_experience: 0.7,
      market_timing_sense: 0.9,
      narrative_clarity: 0.85,
      speed_of_execution: 0.7,
      customer_obsession: 0.7,
      contrarian_thinking: 0.9,
      network_density: 0.6,
      resilience_markers: 0.7,
      coachability: 0.6,
    },

    conviction_triggers: [
      'Founder has a proprietary insight about a massive market shift',
      'Network effects or strong moats in the business model',
      'Evidence of category creation (not just competing in existing market)',
      'AI/crypto thesis alignment with current a16z investment themes',
      'Founder can articulate a 10-year vision convincingly',
      'Enterprise customers willing to pay 10x existing solutions',
      'Technical founder with business acumen (or vice versa)',
    ],

    deal_breakers: [
      'Small market (< $1B TAM)',
      'No defensible moat or competitive advantage',
      'Founder lacks ambition for massive scale',
      'Pure services business disguised as software',
      'Regulatory risk without a mitigation strategy',
      'Cap table issues from prior rounds',
    ],

    dna_preferences: [
      { archetype: 'technical_visionary', weight: 0.9, notes: 'a16z loves visionary technical founders building the future' },
      { archetype: 'repeat_founder', weight: 0.85, notes: 'Strong bias toward proven founders' },
      { archetype: 'corporate_spinout', weight: 0.7, notes: 'Especially from FAANG/top tech companies' },
      { archetype: 'ai_native', weight: 0.95, notes: 'AI is the #1 thesis right now' },
      { archetype: 'industry_transformer', weight: 0.8, notes: 'Rebuilding industries with software' },
      { archetype: 'open_source_to_commercial', weight: 0.7, notes: 'a16z has strong open-source thesis' },
    ],

    approach_intel: {
      best_intro_paths: [
        'Warm intro from a16z portfolio founder (strongest)',
        'Warm intro from a16z executive or operating partner',
        'Direct pitch via a16z.com/pitch (they actually review these)',
        'Meet partners at conferences, a16z events, or Clubhouse-era connections',
      ],
      timing_notes: 'Always investing. No batch cycles. Best to approach when you have clear traction metrics and a why-now narrative.',
      pitch_format_preference: 'Polished deck + strong narrative. a16z appreciates big-picture thinking. Lead with the market shift, not the product features.',
      meeting_style: 'Intellectual, thesis-driven. Partners have strong views. Be prepared to debate market dynamics. They want founders who think bigger than their current product.',
      decision_speed: 'Moderate — 2-6 weeks for seed/A, longer for growth. Multiple partner meetings required.',
      follow_up_cadence: 'Monthly updates. Include key metrics, wins, and asks.',
      red_flags_in_pitch: [
        'Thinking too small',
        'Cannot articulate the technology moat',
        'Defensive when challenged',
        'No clear thesis on why now',
        'Founders who just want money, not platform help',
      ],
      what_impresses_them: [
        'A contrarian insight that makes them rethink the market',
        'Evidence of thought leadership (blogs, papers, talks)',
        'Clear network effects or data advantages',
        'Founder who has lived the problem deeply',
        'Technical depth combined with market vision',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SEQUOIA CAPITAL
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'sequoia',
    name: 'Sequoia Capital',
    shortName: 'Sequoia',
    tier: 'tier1',
    stage_focus: ['seed', 'series-a', 'series-b', 'growth'],
    avg_check: '$1M-$200M (stage dependent)',
    thesis_summary: 'We help the daring build legendary companies. Sequoia looks for founders with clarity, courage, and a burning need to solve a real problem. They want to be early to transformational shifts.',

    founder_signals: {
      technical_depth: 0.8,
      domain_expertise: 0.8,
      previous_exits: 0.5,
      operator_experience: 0.7,
      market_timing_sense: 0.95,
      narrative_clarity: 0.9,
      speed_of_execution: 0.8,
      customer_obsession: 0.85,
      contrarian_thinking: 0.9,
      network_density: 0.5,
      resilience_markers: 0.9,
      coachability: 0.7,
    },

    conviction_triggers: [
      'Founder discovered the problem through deep personal or professional experience',
      'Evidence of a market that is 10x bigger than current perception',
      'Product-market fit signals (retention, engagement, NPS)',
      'Founder-market fit is undeniable',
      'Business model clarity from early stage',
      'Evidence the founder can recruit exceptional talent',
      'Customer love — not just usage, but advocacy',
    ],

    deal_breakers: [
      'Founder cannot clearly explain the problem',
      'No evidence of customer insight (built in isolation)',
      'Feature, not a company',
      'Market timing is wrong (too early or too late)',
      'Founder-market mismatch',
      'Inability to attract co-founders or early team',
    ],

    dna_preferences: [
      { archetype: 'domain_insider', weight: 0.9, notes: 'Sequoia loves founders who deeply know their market' },
      { archetype: 'mission_driven', weight: 0.85, notes: 'Founders on a mission are more resilient' },
      { archetype: 'repeat_founder', weight: 0.8, notes: 'Track record matters but is not required' },
      { archetype: 'industry_transformer', weight: 0.85, notes: 'Transforming existing industries with technology' },
      { archetype: 'research_commercializer', weight: 0.7, notes: 'Especially in bio, climate, and AI' },
      { archetype: 'corporate_spinout', weight: 0.75, notes: 'Founders who saw the problem from inside' },
    ],

    approach_intel: {
      best_intro_paths: [
        'Warm intro from Sequoia portfolio founder or CEO',
        'YC/top accelerator demo day with strong metrics',
        'Direct outreach to relevant partner with a concise cold email',
        'Sequoia Scout program referrals',
      ],
      timing_notes: 'Always investing. Prefer to lead rounds. Best approached when you have early PMF signals and a clear market thesis.',
      pitch_format_preference: 'Sequoia famously values the narrative arc. Use their template: Problem → Solution → Why Now → Market Size → Competition → Business Model → Team → Financials → Ask.',
      meeting_style: 'Rigorous, detail-oriented. Partners will drill into unit economics, customer conversations, and market dynamics. They want founders who know their numbers cold.',
      decision_speed: '2-4 weeks for seed/A. Partners conviction-driven — one champion partner can push a deal through.',
      follow_up_cadence: 'Monthly investor updates. Sequoia provides a template. Be honest about challenges.',
      red_flags_in_pitch: [
        'Inflated metrics or vanity numbers',
        'Cannot name specific customers or their pain',
        'Vague market sizing',
        'Founder has not talked to customers',
        'Pitch deck is polished but substance is thin',
      ],
      what_impresses_them: [
        'Deep customer empathy backed by specific stories',
        'A market insight that changes their mental model',
        'Evidence of founder-market fit',
        'Strong early retention metrics',
        'Clarity on unit economics even at small scale',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BENCHMARK
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'benchmark',
    name: 'Benchmark',
    shortName: 'Benchmark',
    tier: 'tier1',
    stage_focus: ['seed', 'series-a'],
    avg_check: '$5M-$15M',
    thesis_summary: 'Equal partnership, concentrated bets. Benchmark takes board seats and is deeply involved. They look for potential to build $10B+ outcomes and founders who will be the CEO for the long haul.',

    founder_signals: {
      technical_depth: 0.7,
      domain_expertise: 0.8,
      previous_exits: 0.4,
      operator_experience: 0.6,
      market_timing_sense: 0.85,
      narrative_clarity: 0.8,
      speed_of_execution: 0.8,
      customer_obsession: 0.9,
      contrarian_thinking: 0.95,
      network_density: 0.4,
      resilience_markers: 0.9,
      coachability: 0.8,
    },

    conviction_triggers: [
      'Founder is building in a market others are ignoring',
      'Evidence of natural product-market pull (users come to them)',
      'Marketplace or network-effect dynamics',
      'Founder will be a long-term CEO (not looking to flip)',
      'Clear path to $10B+ outcome',
      'Organic growth without heavy marketing spend',
    ],

    deal_breakers: [
      'Crowded cap table with too many investors',
      'Founder wants to sell in 3-5 years',
      'No evidence of organic demand',
      'Market is too consensus (everyone sees it)',
      'Heavy reliance on paid acquisition',
    ],

    dna_preferences: [
      { archetype: 'marketplace_builder', weight: 0.9, notes: 'Benchmark has the best marketplace track record (eBay, Uber, etc.)' },
      { archetype: 'contrarian_thinking' as any, weight: 0.85, notes: 'Non-consensus bets that are right' },
      { archetype: 'mission_driven', weight: 0.8, notes: 'Long-term CEO energy' },
      { archetype: 'domain_insider', weight: 0.75, notes: 'Deep understanding of the market they are disrupting' },
    ],

    approach_intel: {
      best_intro_paths: [
        'Warm intro from Benchmark portfolio company CEO',
        'Cold email directly to a partner with a compelling one-liner',
        'Build something notable enough they come to you',
      ],
      timing_notes: 'Always looking but very selective (4-6 deals per year). Best when you have clear product-market pull.',
      pitch_format_preference: 'Keep it short and compelling. Benchmark partners are allergic to fluff. Lead with the market insight and customer pull.',
      meeting_style: 'Conversational, probing. They want to understand how you think, not just what you are building. Expect deep questions about market dynamics.',
      decision_speed: 'Can be very fast (days) when a partner has conviction. Otherwise, slow or pass.',
      follow_up_cadence: 'As needed. They prefer founders who communicate naturally, not on a schedule.',
      red_flags_in_pitch: [
        'Too many slides, too little substance',
        'Founder does not have strong opinions',
        'Market is obvious / consensus',
        'Relying on sales-driven growth',
      ],
      what_impresses_them: [
        'Product that sells itself',
        'A market insight that is non-obvious',
        'Founder who thinks in decades',
        'Evidence of organic, bottom-up adoption',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FOUNDERS FUND
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'founders_fund',
    name: 'Founders Fund',
    shortName: 'FF',
    tier: 'tier1',
    stage_focus: ['seed', 'series-a', 'series-b', 'growth'],
    avg_check: '$3M-$50M',
    thesis_summary: 'We wanted flying cars, instead we got 140 characters. Founders Fund backs founders building hard, transformative technology. Contrarian by nature — they want to fund the future, not incremental improvements.',

    founder_signals: {
      technical_depth: 0.95,
      domain_expertise: 0.7,
      previous_exits: 0.5,
      operator_experience: 0.5,
      market_timing_sense: 0.8,
      narrative_clarity: 0.7,
      speed_of_execution: 0.7,
      customer_obsession: 0.6,
      contrarian_thinking: 0.95,
      network_density: 0.5,
      resilience_markers: 0.9,
      coachability: 0.4,
    },

    conviction_triggers: [
      'Technology is genuinely hard to replicate (deep tech moat)',
      'Founder has unique technical insight others cannot see',
      'Building something that seems impossible but is actually inevitable',
      'Potential for 100x returns, not 10x',
      'Founder is a domain expert or pioneer in the technology',
      'The company will still matter in 20 years',
    ],

    deal_breakers: [
      'Incremental improvement over existing solutions',
      'No technical differentiation',
      'Founder is a business person without technical depth',
      'Copying a model from another geography',
      'B2B SaaS with no technology moat',
    ],

    dna_preferences: [
      { archetype: 'technical_visionary', weight: 0.95, notes: 'FF wants the deepest technical founders' },
      { archetype: 'research_commercializer', weight: 0.9, notes: 'PhDs and researchers building the future' },
      { archetype: 'ai_native', weight: 0.85, notes: 'AI/ML at the core, not as a feature' },
      { archetype: 'hot_startup_alumni', weight: 0.7, notes: 'Ex-SpaceX, ex-Palantir, ex-Anduril type founders' },
      { archetype: 'repeat_founder', weight: 0.75, notes: 'Especially those with technical exits' },
    ],

    approach_intel: {
      best_intro_paths: [
        'Referral from FF portfolio founder (SpaceX, Palantir, Anduril alumni)',
        'Referral from Peter Thiel network',
        'Direct cold pitch with a technical breakthrough demo',
        'YC/top accelerator with hard-tech focus',
      ],
      timing_notes: 'Always open. But extremely selective. Technology must be genuinely hard.',
      pitch_format_preference: 'Lead with the technology. Show it working. Explain why it was considered impossible and why you solved it. Market slides can be sparse — if the tech works, the market is obvious.',
      meeting_style: 'Intellectual sparring. They will challenge your technical claims. Be prepared to go deep. They respect founders who push back with evidence.',
      decision_speed: 'Variable — fast when excited about the tech, slower otherwise.',
      follow_up_cadence: 'Technical updates trump financial updates. Share breakthroughs.',
      red_flags_in_pitch: [
        'No technical depth — just a business wrapper',
        'Pitch starts with market size, not the technology',
        'Founder cannot explain the technical innovation simply',
        'Incremental improvement pitched as revolutionary',
      ],
      what_impresses_them: [
        'A working demo of something previously thought impossible',
        'Deep technical publications or patents',
        'Founder who built the technology themselves',
        'Clarity on the hard technical problems that remain',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LIGHTSPEED VENTURE PARTNERS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'lightspeed',
    name: 'Lightspeed Venture Partners',
    shortName: 'Lightspeed',
    tier: 'tier1',
    stage_focus: ['seed', 'series-a', 'series-b'],
    avg_check: '$1M-$50M',
    thesis_summary: 'Back exceptional entrepreneurs at the earliest stages. Global platform with deep sector expertise in enterprise, consumer, and health. Emphasis on market timing and founder-market fit.',

    founder_signals: {
      technical_depth: 0.75,
      domain_expertise: 0.85,
      previous_exits: 0.5,
      operator_experience: 0.7,
      market_timing_sense: 0.9,
      narrative_clarity: 0.8,
      speed_of_execution: 0.8,
      customer_obsession: 0.85,
      contrarian_thinking: 0.7,
      network_density: 0.6,
      resilience_markers: 0.7,
      coachability: 0.8,
    },

    conviction_triggers: [
      'Clear market timing thesis (why now is the moment)',
      'Founder has domain advantage over competitors',
      'Early revenue signals with strong unit economics',
      'Product solves an acute pain point (painkiller, not vitamin)',
      'Global market applicability',
    ],

    deal_breakers: [
      'Market timing is off (too early or too late)',
      'Founder cannot explain why they are the right person',
      'No customer validation',
      'Weak competitive positioning',
    ],

    dna_preferences: [
      { archetype: 'domain_insider', weight: 0.9, notes: 'Deep industry expertise is the #1 signal' },
      { archetype: 'serial_operator', weight: 0.75, notes: 'Operators who finally build their own thing' },
      { archetype: 'industry_transformer', weight: 0.8, notes: 'Enterprise transformation is a core thesis' },
      { archetype: 'ai_native', weight: 0.8, notes: 'AI-first companies across verticals' },
    ],

    approach_intel: {
      best_intro_paths: [
        'Warm intro from portfolio company',
        'Direct pitch via website or partner LinkedIn',
        'Sector-specific conferences and events',
      ],
      timing_notes: 'Always investing. Prefer to be early. Best when you have pilot customers or strong design partners.',
      pitch_format_preference: 'Structured deck following standard VC format. Strong emphasis on market timing and competitive landscape.',
      meeting_style: 'Professional, analytical. Deep dive into market dynamics and customer profiles.',
      decision_speed: '2-4 weeks typical.',
      follow_up_cadence: 'Monthly updates with key metrics.',
      red_flags_in_pitch: [
        'Cannot explain competitive advantage clearly',
        'Market timing argument is weak',
        'No customer evidence',
      ],
      what_impresses_them: [
        'Design partners or pilot customers at brand-name companies',
        'Clear wedge strategy into a large market',
        'Evidence of founder-market fit',
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// FOUNDER DNA ARCHETYPES — What the Oracle evaluates
// ---------------------------------------------------------------------------

export interface FounderDNAProfile {
  primary_archetype: FounderArchetype;
  secondary_archetype?: FounderArchetype;
  hypothesis_clarity: number;      // 0-10: How clear is their core thesis
  motivation_score: number;        // 0-10: Why are they doing this (mission vs money)
  timing_awareness: number;        // 0-10: Do they understand why now
  domain_depth: number;            // 0-10: How deep is their domain expertise
  technical_capability: number;    // 0-10: Can they build it themselves
  team_completeness: number;       // 0-10: Right co-founders, gaps filled
  trade_secret_risk: number;       // 0-10: How much IP/knowledge from prior employer
  early_traction_quality: number;  // 0-10: Not just numbers, who are the customers
  narrative_power: number;         // 0-10: Can they tell the story
  network_leverage: number;        // 0-10: Can they attract talent, advisors, customers
  resilience_evidence: number;     // 0-10: Pivots survived, setbacks overcome
  cofounder_dynamics: number;      // 0-10: How strong is the founding team dynamic
}

// ---------------------------------------------------------------------------
// NON-OBVIOUS SIGNAL FRAMEWORK
// ---------------------------------------------------------------------------
// These are the signals that separate winners from losers.
// The Oracle looks beyond surface metrics to find hidden patterns.

export interface NonObviousSignal {
  id: string;
  name: string;
  description: string;
  category: 'founder_dna' | 'market_timing' | 'customer_quality' | 'competitive_moat' | 'execution_pattern' | 'network_effect';
  detection_method: string;
  weight_in_prediction: number;  // 0-1
  examples: string[];
}

export const NON_OBVIOUS_SIGNALS: NonObviousSignal[] = [
  {
    id: 'customer_quality_signal',
    name: 'Customer Quality Over Quantity',
    description: 'Who your first 10 customers are matters more than having 1000 random users. Design partners at respected companies signal product-market fit more than raw signup counts.',
    category: 'customer_quality',
    detection_method: 'Analyze first customers — are they brand names? Industry leaders? Or random individuals?',
    weight_in_prediction: 0.85,
    examples: [
      'Stripe launched with 7 friends — but they were all YC founders building real companies',
      'Snowflake had Netflix and Capital One as early adopters, signaling enterprise readiness',
      'A healthtech startup whose beta users are Mayo Clinic and Johns Hopkins physicians',
    ],
  },
  {
    id: 'trade_secret_advantage',
    name: 'Proprietary Knowledge Edge',
    description: 'Founders who leave companies with deep institutional knowledge (not stolen IP, but mental models and market understanding) often have a 12-18 month headstart their competitors cannot replicate.',
    category: 'founder_dna',
    detection_method: 'Map the founder journey: where did they work, what did they learn, what gap did they see from the inside?',
    weight_in_prediction: 0.8,
    examples: [
      'Ex-Google Brain researcher who understands where LLMs actually fail at the infrastructure level',
      'Former Stripe payments team lead who sees the B2B payments gap Stripe will not address',
      'Ex-Epic Systems engineer who knows exactly why healthcare interoperability keeps failing',
    ],
  },
  {
    id: 'market_contradiction_signal',
    name: 'Everyone Agrees But Nobody Acts',
    description: 'The strongest markets are where an obvious problem exists, everyone acknowledges it, but incumbents are structurally unable to solve it due to misaligned incentives, technical debt, or organizational inertia.',
    category: 'market_timing',
    detection_method: 'Ask: who benefits from this problem NOT being solved? If incumbents profit from the status quo, there is a wedge.',
    weight_in_prediction: 0.9,
    examples: [
      'Healthcare billing — everyone hates it, hospitals profit from complexity',
      'Enterprise data integration — IT budgets depend on complexity remaining',
      'Financial advisor fees — advisors resist transparency that commoditizes their work',
    ],
  },
  {
    id: 'founder_narrative_evolution',
    name: 'Narrative Gets Sharper Over Time',
    description: 'Founders who refine their story with each telling — incorporating customer feedback, investor pushback, and market signals — signal coachability and learning velocity.',
    category: 'founder_dna',
    detection_method: 'Track how the pitch evolves across conversations. Is it getting clearer, more specific, more evidence-based?',
    weight_in_prediction: 0.75,
    examples: [
      'Pitch v1: "We are building AI for healthcare." Pitch v5: "We reduce diagnostic errors in radiology by 40% using a model trained on 2M annotated scans from 3 partner hospitals."',
    ],
  },
  {
    id: 'talent_magnet_signal',
    name: 'Top Talent Joins Pre-Funding',
    description: 'When exceptional engineers, designers, or operators join for equity before funding — that is a strong signal. They are betting their own career, which is the ultimate due diligence.',
    category: 'execution_pattern',
    detection_method: 'Review early team — did top talent leave good jobs to join? Or is the team whoever was available?',
    weight_in_prediction: 0.8,
    examples: [
      'A senior Google Brain engineer leaves to join as CTO for equity only',
      'A Stanford AI PhD chooses this startup over a FAANG offer',
    ],
  },
  {
    id: 'corporate_cant_do_signal',
    name: 'BigCo Identified But Cannot Execute',
    description: 'When a large company identified the exact same problem but structurally cannot solve it — because it would cannibalize existing revenue, upset key customers, or require organizational change the bureaucracy prevents.',
    category: 'competitive_moat',
    detection_method: 'Research if any large company attempted this. Why did they fail or stop? The answer is often structural, not technical.',
    weight_in_prediction: 0.85,
    examples: [
      'Microsoft knew Teams could not compete with Slack in UX but could not reorganize to fix it',
      'Banks all know their apps are terrible but legacy systems and compliance prevent a restart',
      'Pharma companies sit on drug candidates that are too niche to justify their overhead',
    ],
  },
  {
    id: 'usage_pattern_signal',
    name: 'Users Do Unexpected Things',
    description: 'When early users use the product in ways the founder did not anticipate — that signals genuine value. The product is solving something deeper than what was designed.',
    category: 'customer_quality',
    detection_method: 'Ask: what surprised you most about how users use your product? The best answers reveal non-obvious product-market fit.',
    weight_in_prediction: 0.7,
    examples: [
      'Slack was a game company — the internal chat tool became the product',
      'Instagram started as Burbn (location sharing) — people only used the photo filter',
    ],
  },
  {
    id: 'founder_time_in_wilderness',
    name: 'Wilderness Period Before Insight',
    description: 'Many of the best founders spent years working in or adjacent to a problem before the insight clicked. This is not failure — it is incubation. The Oracle looks for evidence of this deep immersion.',
    category: 'founder_dna',
    detection_method: 'Map the founder timeline: years in domain, pivots, adjacent projects, research periods. The insight usually comes after extended immersion.',
    weight_in_prediction: 0.7,
    examples: [
      'The founders of Airbnb spent 2 years struggling with the idea before the design conference hack',
      'Brian Chesky worked in industrial design for years before seeing the hosting opportunity',
    ],
  },
  {
    id: 'regulatory_wave_signal',
    name: 'Regulation Creates Opportunity',
    description: 'New regulations, policy changes, or compliance requirements create forced adoption windows. Companies that are positioned before the mandate hits have enormous pull-through demand.',
    category: 'market_timing',
    detection_method: 'Track upcoming regulations, compliance deadlines, and policy shifts. Map them to startup timing.',
    weight_in_prediction: 0.8,
    examples: [
      'GDPR created a wave of privacy-tech companies',
      'Open Banking regulations created fintech middleware opportunities',
      'SEC climate disclosure rules will drive ESG data companies',
    ],
  },
  {
    id: 'cofounder_complementarity',
    name: 'Co-Founder Complementarity Score',
    description: 'The best founding teams have minimal overlap and maximum complementarity. Technical + commercial + domain is the golden triangle. Two business co-founders with no builder is a red flag.',
    category: 'founder_dna',
    detection_method: 'Map each co-founder skills. Score overlap (bad) vs complementarity (good). Check for the builder/seller/domain triangle.',
    weight_in_prediction: 0.75,
    examples: [
      'Steve + Woz (vision + engineering)',
      'Page + Brin (similar skills, actually rare success pattern)',
      'A healthcare startup with: MD researcher + ML engineer + healthcare sales VP',
    ],
  },
];

// ---------------------------------------------------------------------------
// GOD SCORE ↔ VC THESIS ALIGNMENT
// ---------------------------------------------------------------------------
// Maps the 5 GOD score components to VC preferences

export interface GODToVCMapping {
  god_component: 'team_score' | 'traction_score' | 'market_score' | 'product_score' | 'vision_score';
  vc_signal_weights: Record<string, number>; // vc_id → weight multiplier
  oracle_coaching_prompts: string[];
}

export const GOD_VC_MAPPINGS: GODToVCMapping[] = [
  {
    god_component: 'team_score',
    vc_signal_weights: {
      yc: 1.3,           // YC over-indexes on team (especially technical founders)
      a16z: 1.1,
      sequoia: 1.2,
      benchmark: 1.0,
      founders_fund: 1.4, // FF cares most about technical founder depth
      lightspeed: 1.1,
    },
    oracle_coaching_prompts: [
      'What is unique about your founding team that no other team brings?',
      'If your top competitor hired the best possible team, what would your team still do better?',
      'What critical skill is missing from your team right now, and what is your plan to fill it?',
      'How did your co-founders meet and why did you choose each other?',
      'What is the hardest thing your team has survived together?',
    ],
  },
  {
    god_component: 'traction_score',
    vc_signal_weights: {
      yc: 1.4,           // YC obsesses over growth rate
      a16z: 1.0,
      sequoia: 1.3,      // Sequoia wants early PMF proof
      benchmark: 1.5,    // Benchmark wants organic pull
      founders_fund: 0.7, // FF cares less about early traction — more about tech
      lightspeed: 1.2,
    },
    oracle_coaching_prompts: [
      'What is your week-over-week growth rate? If you do not know, you need to start measuring.',
      'Who are your best customers and WHY are they your best customers?',
      'If you lost your product tomorrow, would your customers feel pain? How would they describe that pain?',
      'What keeps customers coming back? Is it habit, dependency, delight, or switching costs?',
      'What is your customer acquisition cost and lifetime value? Even rough estimates matter.',
    ],
  },
  {
    god_component: 'market_score',
    vc_signal_weights: {
      yc: 1.0,
      a16z: 1.5,         // a16z wants massive markets
      sequoia: 1.3,
      benchmark: 1.2,
      founders_fund: 1.1,
      lightspeed: 1.3,
    },
    oracle_coaching_prompts: [
      'What is the market size — and more importantly, what is the market size going to be?',
      'Is this market growing because of a structural shift, or is growth cyclical?',
      'Who profits from this problem remaining unsolved? That is your real competitor.',
      'Are you creating a new market or competing in an existing one? Both can work but require different strategies.',
      'What regulatory, technological, or cultural shift makes this market available NOW that was not available 3 years ago?',
    ],
  },
  {
    god_component: 'product_score',
    vc_signal_weights: {
      yc: 1.3,
      a16z: 1.1,
      sequoia: 1.1,
      benchmark: 1.0,
      founders_fund: 1.5, // FF over-indexes on technical product depth
      lightspeed: 1.0,
    },
    oracle_coaching_prompts: [
      'What can your product do that no one else can? Be extremely specific.',
      'Is your product a vitamin (nice to have) or a painkiller (must have)?',
      'What is the moment your users experience the "aha" of your product?',
      'What is the hardest technical problem you solved to build this?',
      'If a well-funded competitor copied your product today, how long would it take them to catch up? Why?',
    ],
  },
  {
    god_component: 'vision_score',
    vc_signal_weights: {
      yc: 0.8,
      a16z: 1.5,         // a16z wants massive vision
      sequoia: 1.2,
      benchmark: 1.1,
      founders_fund: 1.4, // FF wants transformative futures
      lightspeed: 1.0,
    },
    oracle_coaching_prompts: [
      'What does the world look like in 10 years if you succeed?',
      'What is the biggest risk to your vision — and what is your plan for it?',
      'If everything goes perfectly, how big can this get?',
      'What adjacent markets will you expand into after you win your core market?',
      'What is the insight you have that most smart people disagree with?',
    ],
  },
];

// ---------------------------------------------------------------------------
// HELPER: Score a startup against a specific VC thesis
// ---------------------------------------------------------------------------

export function scoreStartupVCAlignment(
  godScores: { team_score: number; traction_score: number; market_score: number; product_score: number; vision_score: number },
  founderDNA: Partial<FounderDNAProfile>,
  vcId: string,
): {
  alignment_score: number;  // 0-100
  dimension_scores: Record<string, number>;
  strengths: string[];
  gaps: string[];
  approach_recommendations: string[];
} {
  const vc = VC_THESIS_PROFILES.find((v) => v.id === vcId);
  if (!vc) return { alignment_score: 0, dimension_scores: {}, strengths: [], gaps: [], approach_recommendations: [] };

  const dimensionScores: Record<string, number> = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Score each GOD component against VC weights
  for (const mapping of GOD_VC_MAPPINGS) {
    const godScore = godScores[mapping.god_component] || 0;
    const vcWeight = mapping.vc_signal_weights[vcId] || 1.0;
    const weightedScore = (godScore / 100) * vcWeight;
    dimensionScores[mapping.god_component] = Math.min(weightedScore * 100, 100);
    totalWeightedScore += weightedScore;
    totalWeight += vcWeight;
  }

  // Factor in founder DNA alignment
  let dnaBonus = 0;
  if (founderDNA.primary_archetype) {
    const pref = vc.dna_preferences.find((p) => p.archetype === founderDNA.primary_archetype);
    if (pref) dnaBonus += pref.weight * 10;
  }
  if (founderDNA.secondary_archetype) {
    const pref = vc.dna_preferences.find((p) => p.archetype === founderDNA.secondary_archetype);
    if (pref) dnaBonus += pref.weight * 5;
  }

  const baseScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
  const alignment_score = Math.min(Math.round(baseScore + dnaBonus), 100);

  // Generate strengths and gaps
  const strengths: string[] = [];
  const gaps: string[] = [];

  // Check conviction triggers
  if (godScores.traction_score > 70) strengths.push('Strong traction signals align with what this VC looks for');
  if (godScores.team_score > 70) strengths.push('Team strength is a positive signal for this VC');
  if (godScores.vision_score > 70 && vc.founder_signals.contrarian_thinking > 0.8) {
    strengths.push('Your vision aligns with this VC\'s appetite for contrarian bets');
  }

  // Check for gaps
  if (godScores.market_score < 50 && vc.founder_signals.market_timing_sense > 0.8) {
    gaps.push('Market narrative needs strengthening — this VC heavily weights market timing');
  }
  if (godScores.product_score < 50 && vc.founder_signals.technical_depth > 0.8) {
    gaps.push('Product/technical depth is below what this VC typically requires');
  }
  if (godScores.traction_score < 40 && vc.founder_signals.customer_obsession > 0.8) {
    gaps.push('Traction is thin — this VC wants evidence of real customer demand');
  }

  // Approach recommendations
  const approach_recommendations = [
    ...vc.approach_intel.best_intro_paths.slice(0, 2),
    `Timing: ${vc.approach_intel.timing_notes}`,
    `Pitch style: ${vc.approach_intel.pitch_format_preference.slice(0, 120)}...`,
  ];

  return { alignment_score, dimension_scores: dimensionScores, strengths, gaps, approach_recommendations };
}
