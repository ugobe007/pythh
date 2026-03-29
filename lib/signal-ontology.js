/**
 * PYTHH SIGNAL ONTOLOGY — Colloquial Layer v2
 *
 * Translation layer between what people say publicly and what is actually
 * happening at a startup. Every phrase is a data point. Combined, they
 * produce seven composite intelligence scores.
 *
 * Schema per signal:
 *   category       — signal bucket (FUNDRAISING, HIRING_GROWTH, etc.)
 *   signal         — machine-readable intent label
 *   signal_type    — LANGUAGE | HIRING | BEHAVIOR | METRICS
 *   strength       — 0.0–1.0 base confidence for a single match
 *   stage          — pre-seed | seed | growth | late | any
 *   actor          — FOUNDER | INVESTOR | JOURNALIST | COMPANY | ANY
 *   meaning        — human-readable interpretation
 *   anchors        — key phrase fragments for fuzzy substring matching
 *
 * Categories:
 *   FUNDRAISING            — raising or will raise
 *   ROUND_DYNAMICS         — state of the round
 *   ROUND_STAGE            — what stage/instrument
 *   TRACTION               — growth and momentum
 *   GROWTH_METRICS         — quantitative growth language
 *   HIRING_GROWTH          — job signals indicating expansion
 *   HIRING_ROLE_SIGNAL     — specific roles that predict strategy
 *   HIRING_TROUBLE         — job freeze / reduction signals
 *   TROUBLE                — distress, layoffs, shutdown
 *   DISTRESS_LANGUAGE      — coded distress phrases
 *   INVESTOR_INTEREST      — investor engaged / moving forward
 *   INVESTOR_BEHAVIOR_POS  — positive investor behavioral signals
 *   INVESTOR_BEHAVIOR_NEG  — investor pass behavioral signals
 *   INVESTOR_PASS          — coded rejection language
 *   PRESS_LANGUAGE         — journalist framing signals
 *   HYPE_FOMO              — competitive round / hot deal
 *   ACQUISITION            — M&A signals
 *   FOUNDER_PSYCHOLOGY_POS — positive founder tone
 *   FOUNDER_PSYCHOLOGY_NEG — negative founder tone / ending signals
 */

const SIGNALS = [

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNDRAISING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'FUNDRAISING', signal: 'ACTIVELY_RAISING',
    signal_type: 'LANGUAGE', strength: 0.90, stage: 'any', actor: 'FOUNDER',
    meaning: 'Currently in a fundraise',
    anchors: [
      'opening up conversations',
      'starting to talk to investors',
      'in conversations with investors',
      'meeting with investors',
      'on the road',
      'doing a roadshow',
      'we are raising',
      'currently raising',
      'raising a round',
      'raising our seed',
      'raising our series',
      'announcing our raise',
      'closed our round',
    ],
  },
  {
    category: 'FUNDRAISING', signal: 'RAISING_SOON',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'any', actor: 'FOUNDER',
    meaning: 'Planning to raise in the near term',
    anchors: [
      'thinking about raising',
      'planning to raise',
      'exploring strategic partners',
      'looking for the right partners',
      'if the right partner comes along',
      'open to the right investor',
      'raise later this year',
      'raise in the coming months',
    ],
  },
  {
    category: 'FUNDRAISING', signal: 'DEFINITELY_RAISING',
    signal_type: 'LANGUAGE', strength: 0.95, stage: 'any', actor: 'FOUNDER',
    meaning: 'Classic denial that signals active raise',
    anchors: [
      "we're not raising but",
      'not actively raising',
      'not looking to raise right now but',
      'not focused on fundraising but',
    ],
  },
  {
    category: 'FUNDRAISING', signal: 'INBOUND_INTEREST',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'FOUNDER',
    meaning: 'Investors approaching company — hot signal',
    anchors: [
      'a lot of inbound interest',
      'a lot of inbound from investors',
      'investors have been reaching out',
      'unsolicited interest',
      'inbound from top funds',
      'humbled by the support',
      'grateful for our investors',
    ],
  },
  {
    category: 'FUNDRAISING', signal: 'LAUNCH_INCOMING',
    signal_type: 'LANGUAGE', strength: 0.70, stage: 'seed', actor: 'FOUNDER',
    meaning: 'Teasing a launch or announcement — often fundraise or product',
    anchors: [
      'big things coming',
      'stay tuned',
      'huge announcement soon',
      "we've been quiet but",
      'after months of hard work',
      'exciting news soon',
      'cannot say more yet',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND DYNAMICS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'ROUND_DYNAMICS', signal: 'OVERSUBSCRIBED',
    signal_type: 'LANGUAGE', strength: 0.95, stage: 'any', actor: 'ANY',
    meaning: 'More demand than supply — very hot round',
    anchors: [
      'oversubscribed',
      'over-subscribed',
      'more demand than we can accommodate',
      'turning investors away',
      'had to turn away',
    ],
  },
  {
    category: 'ROUND_DYNAMICS', signal: 'ROUND_CLOSING',
    signal_type: 'LANGUAGE', strength: 0.90, stage: 'any', actor: 'FOUNDER',
    meaning: 'Round nearly full — final close imminent',
    anchors: [
      'allocating the round',
      'last few spots',
      'final close',
      'closing the round',
      'round is closing',
    ],
  },
  {
    category: 'ROUND_DYNAMICS', signal: 'ROLLING_CLOSE',
    signal_type: 'LANGUAGE', strength: 0.75, stage: 'any', actor: 'FOUNDER',
    meaning: 'Raising over time, not a single close',
    anchors: [
      'rolling close',
      'first close',
      'second close',
    ],
  },
  {
    category: 'ROUND_DYNAMICS', signal: 'EXTENSION_TROUBLE',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Extension/bridge — missed milestones or runway pressure',
    anchors: [
      'extension round',
      'round extension',
      'extending the round',
      'seed extension',
      'pre-seed extension',
      'series a extension',
      'bridge round',
      'bridge financing',
      'insider round',
      'existing investors are leading',
      'existing investors are supporting',
      'strategic round',
      'friends and family round',
    ],
  },
  {
    category: 'ROUND_DYNAMICS', signal: 'DOWN_ROUND_RISK',
    signal_type: 'LANGUAGE', strength: 0.92, stage: 'growth', actor: 'ANY',
    meaning: 'Raising below previous valuation',
    anchors: [
      'down round',
      'flat round',
      'reduced valuation',
      'valuation correction',
      'mark down',
      'marked down',
      'haircut on valuation',
      'significant dilution',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUND STAGE — what instrument / stage is being raised
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'ROUND_STAGE', signal: 'STAGE_PRE_SEED',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'pre-seed', actor: 'ANY',
    meaning: 'Very early — friends/family or angels',
    anchors: [
      'friends and family round',
      'angel round',
      'pre-seed round',
      'pre-seed funding',
      'safe note',
      'convertible safe',
    ],
  },
  {
    category: 'ROUND_STAGE', signal: 'STAGE_SEED',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'seed', actor: 'ANY',
    meaning: 'Seed stage raise',
    anchors: [
      'seed round',
      'seed funding',
      'seed stage',
      'raising seed',
    ],
  },
  {
    category: 'ROUND_STAGE', signal: 'STAGE_SERIES_A',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'growth', actor: 'ANY',
    meaning: 'Series A — scaling proven model',
    anchors: [
      'series a round',
      'series a funding',
      'raising a series a',
      'series a led by',
    ],
  },
  {
    category: 'ROUND_STAGE', signal: 'STAGE_SERIES_B_PLUS',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'late', actor: 'ANY',
    meaning: 'Series B or later — scaling',
    anchors: [
      'series b round',
      'series b funding',
      'series c',
      'series d',
      'growth round',
      'late stage round',
    ],
  },
  {
    category: 'ROUND_STAGE', signal: 'STAGE_DEBT',
    signal_type: 'LANGUAGE', strength: 0.75, stage: 'any', actor: 'ANY',
    meaning: 'Debt/venture debt — runway extension, not equity raise',
    anchors: [
      'venture debt',
      'revenue based financing',
      'im credit facility',
      'line of credit',
      'convertible note',
      'convertible debt',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACTION
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'TRACTION', signal: 'ORGANIC_GROWTH',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Growing without paid acquisition — very strong signal',
    anchors: [
      'organic growth',
      'word of mouth',
      'growing organically',
      'viral growth',
      'product led growth',
      'users are referring',
      'referral driven',
      'zero marketing spend',
      'no paid acquisition',
      'network effects kicking in',
    ],
  },
  {
    category: 'TRACTION', signal: 'STRONG_DEMAND',
    signal_type: 'LANGUAGE', strength: 0.82, stage: 'any', actor: 'ANY',
    meaning: 'Demand exceeding current capacity',
    anchors: [
      'strong demand',
      'high demand',
      'supply constrained',
      'demand exceeds',
      'waitlist',
      'wait list',
      'sold out',
      'backordered',
      'design partners',
      'beta waitlist',
      "can't keep up with demand",
    ],
  },
  {
    category: 'TRACTION', signal: 'REVENUE_GROWTH',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Revenue metrics trending positively',
    anchors: [
      'revenue growing',
      'revenue up',
      'record revenue',
      'best month',
      'best quarter',
      'record month',
      'record quarter',
      'hit our first million',
      'crossed a million',
      'reached profitability',
      'profitable',
      'successfully raised',
    ],
  },
  {
    category: 'TRACTION', signal: 'ENTERPRISE_SIGNAL',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'growth', actor: 'ANY',
    meaning: 'Enterprise deals in pipeline',
    anchors: [
      'enterprise pilots',
      'large enterprise',
      'fortune 500',
      'fortune 100',
      'pilot with',
      'signed a deal with',
      'multi-year agreement',
      'exclusive partnership',
      'major partnership',
    ],
  },
  {
    category: 'TRACTION', signal: 'RETENTION_ENGAGEMENT',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'any', actor: 'ANY',
    meaning: 'Strong retention and engagement — product market fit signal',
    anchors: [
      'retention is strong',
      'retention metrics',
      'engagement is high',
      'users are coming back',
      'daily active users',
      'weekly active users',
      'high nps',
      'net promoter score',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH METRICS — quantitative / hypergrowth language
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'GROWTH_METRICS', signal: 'HYPERGROWTH_RATE',
    signal_type: 'METRICS', strength: 0.90, stage: 'any', actor: 'ANY',
    meaning: 'Extremely fast quantitative growth being cited',
    anchors: [
      'growing 10% wow',
      'growing 20% mom',
      'growing week over week',
      'doubling every',
      'tripling every',
      'growing 10x',
      'triple digit growth',
      '100% month over month',
      'explosive growth',
      'hypergrowth',
      'hockey stick',
      'can\'t hire fast enough',
      'experiencing rapid growth',
    ],
  },
  {
    category: 'GROWTH_METRICS', signal: 'DEMAND_INDICATORS',
    signal_type: 'METRICS', strength: 0.82, stage: 'any', actor: 'ANY',
    meaning: 'Quantitative demand signal',
    anchors: [
      'viral growth',
      'went viral',
      'blew up',
      'sold out',
      'backordered',
      'oversold',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HIRING GROWTH — job signals indicating expansion
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'HIRING_GROWTH', signal: 'GENERAL_HIRING',
    signal_type: 'HIRING', strength: 0.75, stage: 'any', actor: 'COMPANY',
    meaning: 'Company is growing headcount broadly',
    anchors: [
      'hiring across the board',
      'hiring aggressively',
      'scaling the team',
      'building out the team',
      'looking for a players',
      'we are hiring',
      'join our team',
      'multiple open roles',
      'hiring recruiters',
    ],
  },
  {
    category: 'HIRING_GROWTH', signal: 'EARLY_STAGE_HIRING',
    signal_type: 'HIRING', strength: 0.80, stage: 'seed', actor: 'COMPANY',
    meaning: 'Founding team hires — early but growing',
    anchors: [
      'hiring founding engineers',
      'founding engineer',
      'first engineer',
      'first hire',
      'employee number',
      'early team',
    ],
  },
  {
    category: 'HIRING_GROWTH', signal: 'SALES_PUSH',
    signal_type: 'HIRING', strength: 0.82, stage: 'growth', actor: 'COMPANY',
    meaning: 'Revenue push — sales headcount growing',
    anchors: [
      'hiring sales team',
      'hiring account executives',
      'hiring ae',
      'hiring sdr',
      'sales development',
      'revenue push',
    ],
  },
  {
    category: 'HIRING_GROWTH', signal: 'UPMARKET_MOVE',
    signal_type: 'HIRING', strength: 0.85, stage: 'growth', actor: 'COMPANY',
    meaning: 'Moving upmarket toward enterprise',
    anchors: [
      'hiring enterprise sales',
      'enterprise account executive',
      'enterprise ae',
      'hiring vp sales',
      'vp of sales',
      'chief revenue officer',
      'hiring cro',
    ],
  },
  {
    category: 'HIRING_GROWTH', signal: 'INFRA_SCALING',
    signal_type: 'HIRING', strength: 0.78, stage: 'growth', actor: 'COMPANY',
    meaning: 'Scaling infrastructure — usage growing fast',
    anchors: [
      'hiring devops',
      'site reliability',
      'sre engineer',
      'platform engineer',
      'infrastructure engineer',
      'scaling infrastructure',
      'hiring ml engineers',
      'machine learning engineer',
      'data engineers',
      'data infrastructure',
    ],
  },
  {
    category: 'HIRING_GROWTH', signal: 'ENTERPRISE_READINESS',
    signal_type: 'HIRING', strength: 0.82, stage: 'growth', actor: 'COMPANY',
    meaning: 'Hiring for enterprise compliance/security — big contracts coming',
    anchors: [
      'hiring security engineers',
      'information security',
      'hiring compliance',
      'compliance officer',
      'general counsel',
      'hiring legal',
      'hiring gc',
    ],
  },
  {
    category: 'HIRING_GROWTH', signal: 'PEOPLE_SCALING',
    signal_type: 'HIRING', strength: 0.80, stage: 'growth', actor: 'COMPANY',
    meaning: 'Team growing so fast they need dedicated people ops',
    anchors: [
      'hiring head of people',
      'chief people officer',
      'vp of people',
      'head of hr',
      'head of talent',
      'recruiting lead',
      'talent acquisition',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HIRING ROLE SIGNAL — specific roles that predict strategy
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'FUNDRAISE_PREP_HIRE',
    signal_type: 'HIRING', strength: 0.85, stage: 'any', actor: 'COMPANY',
    meaning: 'Hiring finance/IR roles — fundraise or IPO preparation',
    anchors: [
      'hiring head of finance',
      'hiring vp finance',
      'chief financial officer',
      'hiring cfo',
      'hiring fp&a',
      'financial planning',
      'hiring investor relations',
      'investor relations',
      'hiring controller',
    ],
  },
  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'ACQUISITION_PREP_HIRE',
    signal_type: 'HIRING', strength: 0.88, stage: 'late', actor: 'COMPANY',
    meaning: 'Hiring corp dev — acquisitions are coming',
    anchors: [
      'hiring corp dev',
      'corporate development',
      'vp of corporate development',
      'm&a',
      'mergers and acquisitions',
    ],
  },
  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'GOVERNMENT_CONTRACTS',
    signal_type: 'HIRING', strength: 0.82, stage: 'growth', actor: 'COMPANY',
    meaning: 'Hiring for government sales — large contracts coming',
    anchors: [
      'government sales',
      'federal sales',
      'public sector',
      'government contracts',
      'dod',
      'federal government',
    ],
  },
  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'HARDWARE_SCALING',
    signal_type: 'HIRING', strength: 0.80, stage: 'growth', actor: 'COMPANY',
    meaning: 'Scaling physical operations',
    anchors: [
      'hiring manufacturing',
      'supply chain',
      'operations manager',
      'hiring operations',
      'hardware engineer',
    ],
  },
  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'CUSTOMER_GROWTH',
    signal_type: 'HIRING', strength: 0.75, stage: 'growth', actor: 'COMPANY',
    meaning: 'More customers coming — support and success scaling',
    anchors: [
      'customer success',
      'customer support',
      'account manager',
      'hiring csm',
      'client success',
    ],
  },
  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'AI_PUSH',
    signal_type: 'HIRING', strength: 0.78, stage: 'any', actor: 'COMPANY',
    meaning: 'Company investing heavily in AI/ML',
    anchors: [
      'hiring ml engineer',
      'machine learning engineer',
      'ai engineer',
      'research scientist',
      'deep learning',
      'llm engineer',
    ],
  },
  {
    category: 'HIRING_ROLE_SIGNAL', signal: 'MARKETING_PUSH',
    signal_type: 'HIRING', strength: 0.75, stage: 'growth', actor: 'COMPANY',
    meaning: 'Growth push — marketing investment increasing',
    anchors: [
      'hiring head of marketing',
      'vp marketing',
      'chief marketing officer',
      'cmo',
      'growth marketer',
      'demand generation',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HIRING TROUBLE — freeze / reduction signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'HIRING_TROUBLE', signal: 'HIRING_FREEZE',
    signal_type: 'HIRING', strength: 0.88, stage: 'any', actor: 'COMPANY',
    meaning: 'Hiring stopped — cash or growth concern',
    anchors: [
      'hiring freeze',
      'pausing hiring',
      'pause on hiring',
      'putting hiring on hold',
      'no open roles',
      'selective hiring',
      're-evaluating hiring plan',
      'restructuring team',
    ],
  },
  {
    category: 'HIRING_TROUBLE', signal: 'HEADCOUNT_REDUCTION',
    signal_type: 'HIRING', strength: 0.92, stage: 'any', actor: 'ANY',
    meaning: 'Active or imminent layoffs',
    anchors: [
      'rightsizing team',
      'rightsizing the team',
      'reducing workforce',
      'workforce reduction',
      'announced layoffs',
      'announced restructuring',
      'restructuring team',
      'focusing on efficiency',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TROUBLE — distress signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'TROUBLE', signal: 'GROWTH_STALLED',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'any', actor: 'FOUNDER',
    meaning: 'Growth stopped — pivoting to profitability narrative',
    anchors: [
      'focusing on profitability',
      'focused on profitability',
      'path to profitability',
      'becoming capital efficient',
      'capital efficiency',
      'sustainable growth',
      'disciplined growth',
      'quality over quantity',
    ],
  },
  {
    category: 'TROUBLE', signal: 'LAYOFFS',
    signal_type: 'LANGUAGE', strength: 0.92, stage: 'any', actor: 'ANY',
    meaning: 'Team reduction in progress or planned',
    anchors: [
      'restructuring',
      'streamlining operations',
      'rightsizing',
      'right-sizing',
      'workforce reduction',
      'headcount reduction',
      'letting people go',
      'layoffs',
      'laid off',
      'announced layoffs',
    ],
  },
  {
    category: 'TROUBLE', signal: 'RUNWAY_CONCERN',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Cash runway under pressure',
    anchors: [
      'extending runway',
      'extend our runway',
      'managing runway',
      'preserving cash',
      'default alive',
      'ramen profitable',
      'tightening the belt',
      'cost cutting',
      'reducing burn',
      'exploring options',
    ],
  },
  {
    category: 'TROUBLE', signal: 'PIVOT',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'FOUNDER',
    meaning: 'Company changing direction — original thesis failed',
    anchors: [
      'we pivoted',
      'we are pivoting',
      'pivoting to',
      'narrowing focus',
      'narrowing our focus',
      'customers kept asking for',
      'after many conversations we realized',
      'we realized that',
      'new direction',
      'refocusing on',
    ],
  },
  {
    category: 'TROUBLE', signal: 'SHUTDOWN',
    signal_type: 'LANGUAGE', strength: 0.98, stage: 'any', actor: 'ANY',
    meaning: 'Company is shutting down',
    anchors: [
      'shutting down',
      'wind down',
      'winding down',
      'pausing operations',
      'ceasing operations',
      'returning capital to investors',
      'decided to shut down',
      'closing our doors',
      'sunsetting',
      'shutting down operations',
    ],
  },
  {
    category: 'TROUBLE', signal: 'TALENT_EXODUS',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Key people leaving — often precedes shutdown or acquisition',
    anchors: [
      'stepping down as ceo',
      'transitioning to chairman',
      'transitioning leadership',
      'departing the company',
      'leaving the company',
      'co-founder departure',
      'cofounder departure',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRESS LANGUAGE — coded phrases for distress
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'DISTRESS_LANGUAGE', signal: 'CODED_DISTRESS',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'any', actor: 'ANY',
    meaning: 'Corporate-speak that signals underlying distress',
    anchors: [
      'exploring alternatives',
      'strategic alternatives',
      'exploring strategic options',
      'exploring strategic alternatives',
      'focus on profitability focus',
      'capital efficient',
      'profitability focus',
      'bridge round',
      'exploring options',
      'announced restructuring',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACQUISITION — M&A signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'ACQUISITION', signal: 'SEEKING_ACQUIRER',
    signal_type: 'LANGUAGE', strength: 0.90, stage: 'any', actor: 'ANY',
    meaning: 'Company actively trying to be acquired',
    anchors: [
      'exploring strategic options',
      'in conversations with potential acquirers',
      'in acquisition talks',
      'exploring a sale',
      'in discussions with strategic buyers',
      'merger',
    ],
  },
  {
    category: 'ACQUISITION', signal: 'SOFT_LANDING',
    signal_type: 'LANGUAGE', strength: 0.92, stage: 'any', actor: 'ANY',
    meaning: 'Acqui-hire or below-expectation acquisition',
    anchors: [
      'soft landing',
      'acqui-hire',
      'acquihire',
      'joining forces with',
      'team is joining',
      'we are joining',
    ],
  },
  {
    category: 'ACQUISITION', signal: 'ACQUIRED',
    signal_type: 'LANGUAGE', strength: 0.95, stage: 'any', actor: 'ANY',
    meaning: 'Company has been acquired',
    anchors: [
      'acquired by',
      'acquisition by',
      'being acquired',
      'strategic acquisition',
      'entered into a definitive agreement',
      'signed a definitive agreement',
      'acquired for undisclosed amount',
      'joining forces',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTOR INTEREST — positive investor behavior
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'INVESTOR_INTEREST', signal: 'INVESTOR_DILIGENCE',
    signal_type: 'BEHAVIOR', strength: 0.90, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor seriously evaluating — high conversion probability',
    anchors: [
      'doing diligence',
      'in diligence',
      'conducting diligence',
      'financial diligence',
      'technical diligence',
      'customer calls',
      'data room',
      'send the data room',
    ],
  },
  {
    category: 'INVESTOR_INTEREST', signal: 'INVESTOR_LEADING',
    signal_type: 'BEHAVIOR', strength: 0.96, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor wants to lead — very strong signal',
    anchors: [
      'we would like to lead',
      'interested in leading',
      'preparing a term sheet',
      'sending a term sheet',
      'term sheet',
      'we are in',
      'preempt offer',
      'asking for allocation',
      'led by',
    ],
  },
  {
    category: 'INVESTOR_INTEREST', signal: 'INVESTOR_SOCIAL_PROOF',
    signal_type: 'BEHAVIOR', strength: 0.75, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor checking who else is in — social proof matters',
    anchors: [
      'who else is in the round',
      'who is leading',
      'who are the other investors',
      'what is the syndicate',
    ],
  },
  {
    category: 'INVESTOR_INTEREST', signal: 'PARTNER_MEETING',
    signal_type: 'BEHAVIOR', strength: 0.85, stage: 'any', actor: 'INVESTOR',
    meaning: 'Partner-level engagement — serious interest',
    anchors: [
      'partner meeting',
      'multiple partner meetings',
      'investor introducing you to other partners',
      'investor bringing operating partner',
      'investor asking about hiring',
      'investor asking about scaling',
    ],
  },
  {
    category: 'INVESTOR_INTEREST', signal: 'FAST_FOLLOW',
    signal_type: 'BEHAVIOR', strength: 0.88, stage: 'any', actor: 'INVESTOR',
    meaning: 'Fast follow investor piling in — very hot deal',
    anchors: [
      'fast follow',
      'fast-follow investor',
      'participation from',
      'top-tier firms are in',
      'tier 1 leading',
      'tier one leading',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTOR PASS — coded rejection language
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'INVESTOR_PASS', signal: 'SOFT_PASS',
    signal_type: 'BEHAVIOR', strength: 0.90, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor is passing — standard polite language',
    anchors: [
      'a bit early for us',
      'too early for us',
      'not the right fit',
      'not a fit for our thesis',
      'not a fit for our fund',
      'keep us posted',
      'send updates',
      'stay in touch',
      'circle back',
      'come back at series',
      'we passed',
      'not moving forward',
      'we passed but keep us updated',
      'quarterly updates please',
      'associate call only',
      'no partner meeting',
      'slow responses',
    ],
  },
  {
    category: 'INVESTOR_PASS', signal: 'CONCERNS',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor has specific concerns — likely passing',
    anchors: [
      'concerned about market size',
      'concerned about competition',
      'need more traction',
      'need to see more data',
      'would love to see more customers',
      'we love the team but',
      'we love the vision but',
      'interesting but',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRESS LANGUAGE — journalist framing signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'PRESS_LANGUAGE', signal: 'STRONG_PRESS_SIGNAL',
    signal_type: 'LANGUAGE', strength: 0.82, stage: 'any', actor: 'JOURNALIST',
    meaning: 'Press coverage framing is positive and high-signal',
    anchors: [
      'successfully raised',
      'led by',
      'experiencing rapid growth',
      'to accelerate growth',
      'to expand internationally',
      'to scale operations',
      'to meet demand',
    ],
  },
  {
    category: 'PRESS_LANGUAGE', signal: 'CORPORATE_INTEREST',
    signal_type: 'LANGUAGE', strength: 0.78, stage: 'growth', actor: 'JOURNALIST',
    meaning: 'Strategic/corporate investors involved — potential acquisition interest',
    anchors: [
      'strategic investors included',
      'strategic investor',
      'corporate venture',
      'participation from',
    ],
  },
  {
    category: 'PRESS_LANGUAGE', signal: 'NEGATIVE_PRESS',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'JOURNALIST',
    meaning: 'Journalist is covering negative events',
    anchors: [
      'announced restructuring',
      'announced layoffs',
      'exploring alternatives',
      'shutting down operations',
      'acquired for undisclosed amount',
      'wind down',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HYPE / FOMO
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'HYPE_FOMO', signal: 'HOT_ROUND',
    signal_type: 'LANGUAGE', strength: 0.90, stage: 'any', actor: 'ANY',
    meaning: 'Competitive round with strong investor interest',
    anchors: [
      'hot round',
      'competitive round',
      'multiple term sheets',
      'had multiple offers',
      'preempted',
      'moving fast',
      'closed in days',
      'backed by top investors',
    ],
  },
  {
    category: 'HYPE_FOMO', signal: 'HYPE_LANGUAGE',
    signal_type: 'LANGUAGE', strength: 0.65, stage: 'any', actor: 'ANY',
    meaning: 'Hyperbolic language — may or may not reflect reality',
    anchors: [
      'category defining',
      'category leader',
      'generational company',
      'the next stripe',
      'the next openai',
      'the next uber',
      'unicorn potential',
      'trillion dollar market',
      'decade defining',
      'disrupting',
      'revolutionizing',
      'revolutionary',
      'reinventing',
      'game changing',
      'market leader',
      'world-class team',
      'ai-powered',
    ],
  },
  {
    category: 'HYPE_FOMO', signal: 'BREAKOUT_SIGNAL',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Viral or rapid adoption signal',
    anchors: [
      'went viral',
      'product hunt number one',
      'top of hacker news',
      'trending on',
      'exploding growth',
      'blew up',
      'hockey stick',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDER PSYCHOLOGY — positive
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'FOUNDER_PSYCHOLOGY_POS', signal: 'CONFIDENT_MOMENTUM',
    signal_type: 'LANGUAGE', strength: 0.70, stage: 'any', actor: 'FOUNDER',
    meaning: 'Founder communicating positive energy / momentum',
    anchors: [
      "couldn't be more excited",
      'incredibly excited to',
      'this is just the beginning',
      'after months of hard work',
      'proud of what we built',
      'big things coming',
      'we are just getting started',
    ],
  },
  {
    category: 'FOUNDER_PSYCHOLOGY_POS', signal: 'FUNDRAISE_SENTIMENT',
    signal_type: 'LANGUAGE', strength: 0.75, stage: 'any', actor: 'FOUNDER',
    meaning: 'Gratitude language typically accompanies fundraise announcement',
    anchors: [
      'humbled by the support',
      'grateful for our investors',
      'grateful to our backers',
      'incredible support from',
      'thrilled to welcome',
      'excited to announce',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDER PSYCHOLOGY — negative / ending signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'FOUNDER_PSYCHOLOGY_NEG', signal: 'SHUTDOWN_IMMINENT',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'any', actor: 'FOUNDER',
    meaning: 'Gratitude/farewell language before shutdown or departure',
    anchors: [
      'proud of the team',
      'grateful for the team',
      'huge thanks to the team',
      'could not have done it without',
      'bittersweet',
      'on to the next adventure',
      'new chapter ahead',
      'excited for the next chapter',
      'stepping back',
      'proud of what we built',
      'new chapter',
      'moving on',
    ],
  },
  {
    category: 'FOUNDER_PSYCHOLOGY_NEG', signal: 'SOMETHING_FAILED',
    signal_type: 'LANGUAGE', strength: 0.78, stage: 'any', actor: 'FOUNDER',
    meaning: 'Implicit acknowledgment of failure or difficulty',
    anchors: [
      'we learned a lot',
      'incredibly valuable lessons',
      'this has been a crazy journey',
      'it has not been easy',
      'the honest truth',
      'this was not an easy decision',
      'after much reflection',
      'after a lot of soul searching',
    ],
  },
  {
    category: 'FOUNDER_PSYCHOLOGY_NEG', signal: 'PIVOT_INCOMING',
    signal_type: 'LANGUAGE', strength: 0.75, stage: 'any', actor: 'FOUNDER',
    meaning: 'Founder reconsidering direction — pivot announcement coming',
    anchors: [
      "i've been thinking a lot about",
      'been reflecting on',
      'challenging ourselves to',
      'revisiting our roadmap',
      'customers kept asking for',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TALENT INBOUND — top-tier alumni joining, signal-rich senior hires
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'TALENT_INBOUND', signal: 'TOP_CO_ALUMNI',
    signal_type: 'HIRING', strength: 0.88, stage: 'any', actor: 'COMPANY',
    meaning: 'Alumni from elite companies joining — strong credibility and network signal',
    anchors: [
      'ex-google', 'ex google', 'formerly google', 'from google',
      'ex-meta', 'ex meta', 'formerly meta', 'from meta', 'ex-facebook',
      'ex-apple', 'ex apple', 'formerly apple',
      'ex-microsoft', 'ex microsoft', 'formerly microsoft',
      'ex-amazon', 'ex amazon', 'formerly amazon',
      'ex-stripe', 'ex stripe', 'formerly stripe',
      'ex-openai', 'ex openai', 'formerly openai',
      'ex-anthropic', 'formerly anthropic',
      'ex-tesla', 'ex tesla', 'formerly tesla',
      'ex-spacex', 'ex spacex', 'formerly spacex',
      'ex-palantir', 'formerly palantir',
      'ex-coinbase', 'formerly coinbase',
      'ex-airbnb', 'formerly airbnb',
      'ex-uber', 'formerly uber',
      'ex-lyft', 'formerly lyft',
      'ex-linkedin', 'formerly linkedin',
      'ex-twitter', 'formerly twitter',
      'ex-netflix', 'formerly netflix',
      'ex-salesforce', 'formerly salesforce',
      'alum of',
      'alumni of',
      'spent years at',
      'previously at google',
      'previously at meta',
      'previously at stripe',
      'previously at openai',
    ],
  },
  {
    category: 'TALENT_INBOUND', signal: 'CLEVEL_HIRE',
    signal_type: 'HIRING', strength: 0.85, stage: 'growth', actor: 'COMPANY',
    meaning: 'C-suite hire signals scaling or fundraise preparation',
    anchors: [
      'welcomes new cfo',
      'appoints cfo',
      'new chief financial officer',
      'welcomes new cto',
      'appoints cto',
      'new chief technology officer',
      'welcomes new coo',
      'appoints coo',
      'new chief operating officer',
      'welcomes new cmo',
      'appoints cmo',
      'new chief marketing officer',
      'new vp of sales',
      'new vp of engineering',
      'new head of finance',
      'new general counsel',
      'new chief revenue officer',
    ],
  },
  {
    category: 'TALENT_INBOUND', signal: 'SENIOR_HIRE_MOMENTUM',
    signal_type: 'HIRING', strength: 0.78, stage: 'growth', actor: 'COMPANY',
    meaning: 'Senior hires from well-known companies indicate momentum and legitimacy',
    anchors: [
      'senior hire',
      'key hire',
      'strategic hire',
      'brings on',
      'joins from',
      'joins the team from',
      'adds to the team',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TALENT OUTBOUND — key departures that signal trouble
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'TALENT_OUTBOUND', signal: 'FOUNDER_DEPARTURE',
    signal_type: 'BEHAVIOR', strength: 0.92, stage: 'any', actor: 'FOUNDER',
    meaning: 'Founder leaving is a very strong negative signal',
    anchors: [
      'founder leaving',
      'founder departure',
      'co-founder leaving',
      'cofounder leaving',
      'founder steps down',
      'founder resigned',
      'founder has left',
    ],
  },
  {
    category: 'TALENT_OUTBOUND', signal: 'EXEC_DEPARTURE',
    signal_type: 'BEHAVIOR', strength: 0.88, stage: 'any', actor: 'ANY',
    meaning: 'Key executive departure — especially bad before a fundraise',
    anchors: [
      'cto leaving',
      'cfo leaving',
      'coo leaving',
      'vp leaving',
      'chief officer departure',
      'exec departure',
      'executive leaves',
      'executive departure',
      'open to work',
      'open to new opportunities',
      'exploring new opportunities',
    ],
  },
  {
    category: 'TALENT_OUTBOUND', signal: 'MASS_EXODUS',
    signal_type: 'BEHAVIOR', strength: 0.90, stage: 'any', actor: 'ANY',
    meaning: 'Multiple engineers or sales staff leaving — company health declining',
    anchors: [
      'many engineers leaving',
      'engineers leaving',
      'sales team leaving',
      'layoffs on linkedin',
      'open to work cluster',
      'multiple employees leaving',
      'early employees leaving',
      'early team departing',
      'joins competitor',
      'joins a competitor',
      'left to join',
    ],
  },
  {
    category: 'TALENT_OUTBOUND', signal: 'STEALTH_COMPETITOR',
    signal_type: 'BEHAVIOR', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Exec leaving to start a stealth company — new competitor forming',
    anchors: [
      'joins stealth startup',
      'left to found',
      'left to start',
      'departed to start',
      'starting a new company',
      'starting a new venture',
      'new stealth venture',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPENSATION POSITIVE — above-market signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'COMPENSATION_POSITIVE', signal: 'COMPETITIVE_COMP',
    signal_type: 'HIRING', strength: 0.75, stage: 'growth', actor: 'COMPANY',
    meaning: 'Above-market compensation — company competing hard for talent',
    anchors: [
      'above market salary',
      'above-market salary',
      'competitive salary',
      'top of market compensation',
      'market-leading compensation',
      'signing bonus',
      'sign-on bonus',
      'remote plus high pay',
      'competitive equity package',
      'recruiters reaching out aggressively',
      'visa sponsorship',
    ],
  },
  {
    category: 'COMPENSATION_POSITIVE', signal: 'LATE_STAGE_EQUITY',
    signal_type: 'HIRING', strength: 0.80, stage: 'late', actor: 'COMPANY',
    meaning: 'Late-stage equity signals — likely past Series B, IPO on horizon',
    anchors: [
      'pre-ipo equity',
      'pre ipo equity',
      'liquid equity',
      'rsus',
      'restricted stock units',
      'performance bonus tied to revenue',
      'large equity grant',
      'meaningful equity',
    ],
  },
  {
    category: 'COMPENSATION_POSITIVE', signal: 'EARLY_STAGE_EQUITY',
    signal_type: 'HIRING', strength: 0.72, stage: 'pre-seed', actor: 'COMPANY',
    meaning: 'Early equity offers signal pre-revenue or very early stage',
    anchors: [
      'early equity',
      'founding equity',
      'significant equity stake',
      'token allocation',
      'equity only',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPENSATION NEGATIVE — cash-constrained signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'COMPENSATION_NEGATIVE', signal: 'CASH_CONSTRAINED',
    signal_type: 'HIRING', strength: 0.82, stage: 'any', actor: 'COMPANY',
    meaning: 'Below-market or equity-only pay — company is cash constrained',
    anchors: [
      'below market pay',
      'below-market salary',
      'equity only compensation',
      'deferred salary',
      'delayed salary',
      'offer rescinded',
      'rescinded offer',
      'hiring contractors instead',
      'contractors only',
      'hiring offshore only',
      'reduced offer',
      'lowered offer',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT LAUNCH — lifecycle signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'PRODUCT_LAUNCH', signal: 'EARLY_LAUNCH',
    signal_type: 'LANGUAGE', strength: 0.72, stage: 'pre-seed', actor: 'COMPANY',
    meaning: 'Product in early testing or beta — demand signal only',
    anchors: [
      'launching soon',
      'beta launch',
      'private beta',
      'early access',
      'join the waitlist',
      'join our waitlist',
      'on the waitlist',
      'request early access',
      'coming soon',
    ],
  },
  {
    category: 'PRODUCT_LAUNCH', signal: 'PUBLIC_LAUNCH',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'seed', actor: 'COMPANY',
    meaning: 'Product is publicly live — significant momentum milestone',
    anchors: [
      'public beta',
      'generally available',
      'ga today',
      'shipping today',
      'product hunt launch',
      'launched today',
      'now live',
      'open for everyone',
    ],
  },
  {
    category: 'PRODUCT_LAUNCH', signal: 'PLATFORM_STRATEGY',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'growth', actor: 'COMPANY',
    meaning: 'Opening a platform / API — ecosystem and distribution play',
    anchors: [
      'api released',
      'api is live',
      'developer platform',
      'developer api',
      'sdk released',
      'api sdk',
      'marketplace launched',
      'app marketplace',
      'new platform',
    ],
  },
  {
    category: 'PRODUCT_LAUNCH', signal: 'EXPANSION',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'growth', actor: 'ANY',
    meaning: 'Expanding product surface or market',
    anchors: [
      'new product line',
      'version 2.0',
      'major release',
      'new platform',
      'now supporting enterprise',
      'expanding to new markets',
      'international expansion',
    ],
  },
  {
    category: 'PRODUCT_LAUNCH', signal: 'ENTERPRISE_COMPLIANCE',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'growth', actor: 'COMPANY',
    meaning: 'Compliance certifications signal enterprise readiness',
    anchors: [
      'soc2 compliant',
      'soc 2 certified',
      'hipaa compliant',
      'hipaa certified',
      'fedramp',
      'iso 27001',
      'gdpr compliant',
      'enterprise ready',
      'enterprise security',
    ],
  },
  {
    category: 'PRODUCT_LAUNCH', signal: 'BIG_PARTNERSHIP',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'growth', actor: 'ANY',
    meaning: 'Major distribution partnership with cloud or platform giant',
    anchors: [
      'partnership with aws',
      'partnership with microsoft',
      'partnership with google',
      'partnership with salesforce',
      'aws marketplace',
      'azure marketplace',
      'google cloud partner',
      'integrations with',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER ADOPTION — product-market fit language
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'CUSTOMER_ADOPTION', signal: 'STRONG_PMF',
    signal_type: 'LANGUAGE', strength: 0.92, stage: 'growth', actor: 'ANY',
    meaning: 'Customer language indicating deep product dependence — strong PMF',
    anchors: [
      'we love this product',
      'we rely on this',
      'mission critical',
      'we rolled this out company-wide',
      'rolled out across the company',
      'deployed company-wide',
      'standardizing on',
      'switching from',
      'replacing',
      'we expanded our contract',
      'expanded the contract',
      'multi-year contract',
    ],
  },
  {
    category: 'CUSTOMER_ADOPTION', signal: 'SOCIAL_PROOF',
    signal_type: 'LANGUAGE', strength: 0.82, stage: 'growth', actor: 'ANY',
    meaning: 'Social proof artifacts — case study, testimonial, community',
    anchors: [
      'case study',
      'customer testimonial',
      'customer conference',
      'user community',
      'developer community',
      'ecosystem partners',
      'customer story',
      'success story',
    ],
  },
  {
    category: 'CUSTOMER_ADOPTION', signal: 'ENTERPRISE_DEAL',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'growth', actor: 'ANY',
    meaning: 'Significant enterprise contract or long-term commitment',
    anchors: [
      'multi-year agreement',
      'multi year deal',
      'enterprise contract',
      'seven figure deal',
      '7-figure deal',
      'eight figure deal',
      'eight-figure contract',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER TRIAL — weak/early customer signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'CUSTOMER_TRIAL', signal: 'PILOT_STAGE',
    signal_type: 'LANGUAGE', strength: 0.55, stage: 'seed', actor: 'ANY',
    meaning: 'Customer testing but not yet committed — weak positive signal',
    anchors: [
      'pilot program',
      'proof of concept',
      'running a poc',
      'running a pilot',
      'trial period',
      'experimenting with',
      'exploring the use of',
      'considering the product',
      'evaluating',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTOR THESIS — social signals showing sector/company interest
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'INVESTOR_THESIS', signal: 'ACTIVELY_LOOKING',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor is actively sourcing in a specific sector',
    anchors: [
      "we're excited about",
      'who is building in',
      'send me startups in',
      'office hours for founders',
      'writing checks in',
      'actively investing in',
      'actively looking for',
      'looking to invest in',
    ],
  },
  {
    category: 'INVESTOR_THESIS', signal: 'THESIS_FORMING',
    signal_type: 'BEHAVIOR', strength: 0.75, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor articulating a thesis — deal flow will follow',
    anchors: [
      'we just led a round in',
      'looking for technical founders',
      "we love developer tools",
      "we're doubling down on",
      'doubling down on ai',
      'the future of',
      'market map of',
      'investment memo',
      'hot take',
      'contrarian view',
    ],
  },
  {
    category: 'INVESTOR_THESIS', signal: 'INVESTOR_WATCHING',
    signal_type: 'BEHAVIOR', strength: 0.70, stage: 'any', actor: 'INVESTOR',
    meaning: 'Investor showing public interest in a specific company or founder',
    anchors: [
      'impressed by what',
      'met with',
      'had coffee with the founder',
      'huge fan of this team',
      'bullish on this space',
      'this is interesting',
      'investor follows',
      'investor likes',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GITHUB POSITIVE — active development signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'GITHUB_POSITIVE', signal: 'ACTIVE_DEVELOPMENT',
    signal_type: 'BEHAVIOR', strength: 0.78, stage: 'any', actor: 'COMPANY',
    meaning: 'Repo activity signals active product development and team size',
    anchors: [
      'rapid commits',
      'many contributors',
      'frequent releases',
      'new repo created',
      'repo suddenly active',
      'open sourcing',
      'open sourced',
      'open source',
      'released the sdk',
      'api sdk released',
    ],
  },
  {
    category: 'GITHUB_POSITIVE', signal: 'DEVELOPER_ADOPTION',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'growth', actor: 'ANY',
    meaning: 'GitHub stars, forks, and enterprise features signal real adoption',
    anchors: [
      'many stars',
      'github stars',
      'star on github',
      'many forks',
      'enterprise features',
      'security features added',
      'scalability improvements',
      'performance optimization',
      'documentation added',
      'docs released',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GITHUB NEGATIVE — dead or struggling codebase signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'GITHUB_NEGATIVE', signal: 'DEAD_CODEBASE',
    signal_type: 'BEHAVIOR', strength: 0.85, stage: 'any', actor: 'COMPANY',
    meaning: 'Repository inactivity — product likely dead or on life support',
    anchors: [
      'repo archived',
      'repository archived',
      'no commits',
      'no updates',
      'no recent activity',
      'last commit',
      'years ago',
      'repo made private',
      'repository made private',
    ],
  },
  {
    category: 'GITHUB_NEGATIVE', signal: 'STRUGGLING_PRODUCT',
    signal_type: 'BEHAVIOR', strength: 0.72, stage: 'any', actor: 'COMPANY',
    meaning: 'Only bug fixes or rewrite signals product instability',
    anchors: [
      'rewrite from scratch',
      'complete rewrite',
      'ground-up rewrite',
      'only bug fixes',
      'mostly bug fixes',
      'few contributors',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VC HIRING — fund growth and thesis signals from VC's own job postings
  //
  // When a VC firm hires in a domain, capital follows within 6–18 months.
  // This is pre-deal intelligence — before any startups are funded.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'VC_HIRING', signal: 'VC_NEW_FUND',
    signal_type: 'HIRING', strength: 0.85, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC hiring partners — new fund raise or major expansion underway',
    anchors: [
      'hiring partner',
      'hiring a general partner',
      'hiring managing director',
      'new fund announced',
      'raised a new fund',
      'closed new fund',
      'fund ii',
      'fund iii',
      'fund iv',
      'fund v',
      'new venture fund',
      'new fund close',
    ],
  },
  {
    category: 'VC_HIRING', signal: 'VC_DEPLOYING',
    signal_type: 'HIRING', strength: 0.78, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC scaling deal team — actively deploying capital',
    anchors: [
      'hiring associate',
      'hiring principal',
      'hiring platform team',
      'hiring operating partner',
      'venture associate',
      'investment associate',
    ],
  },
  {
    category: 'VC_HIRING', signal: 'VC_AI_THESIS',
    signal_type: 'HIRING', strength: 0.88, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC hiring domain-specific partner — that sector will receive capital',
    anchors: [
      'hiring ai partner',
      'ai partner',
      'hiring crypto partner',
      'crypto partner',
      'hiring robotics partner',
      'robotics partner',
      'hiring healthcare partner',
      'healthcare partner',
      'hiring climate partner',
      'climate partner',
      'hiring defense partner',
      'defense partner',
      'hiring fintech partner',
      'fintech partner',
      'hiring bio partner',
      'bio partner',
    ],
  },
  {
    category: 'VC_HIRING', signal: 'VC_REGIONAL_EXPANSION',
    signal_type: 'HIRING', strength: 0.75, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC opening new office — capital will flow to that geography',
    anchors: [
      'opens new office',
      'opening office in',
      'expanding to',
      'new office in',
      'regional expansion',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VC BEHAVIOR — public signal prediction before deals happen
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'VC_BEHAVIOR', signal: 'VC_ENTERING_SECTOR',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC publishing research or hosting events in a sector — entering soon',
    anchors: [
      'publishes market map',
      'market map',
      'writes thesis',
      'investment thesis',
      'thesis article',
      'hosts events in',
      'sector report',
      'landscape report',
      'state of the market',
      'we are doubling down',
      'increased conviction',
    ],
  },
  {
    category: 'VC_BEHAVIOR', signal: 'VC_ACTIVELY_SOURCING',
    signal_type: 'BEHAVIOR', strength: 0.85, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC publicly asking for deal flow — high intent signal',
    anchors: [
      'partners asking for startups',
      'send us startups',
      'looking for startups in',
      'vc follows many founders',
      'writing checks in',
      'open to meet founders',
      'open office hours',
      'coffee with founders',
    ],
  },
  {
    category: 'VC_BEHAVIOR', signal: 'VC_HIGH_CONVICTION',
    signal_type: 'BEHAVIOR', strength: 0.92, stage: 'any', actor: 'INVESTOR',
    meaning: 'VC moving faster than normal — very high conviction deal',
    anchors: [
      'leads round quickly',
      'led the round in',
      'preempted round',
      'preempts the round',
      'preempt offer extended',
      'term sheet in',
      'fast close',
      'moved quickly',
      'invested in multiple',
    ],
  },
  {
    category: 'VC_BEHAVIOR', signal: 'VC_SEED_FOCUS',
    signal_type: 'BEHAVIOR', strength: 0.72, stage: 'pre-seed', actor: 'INVESTOR',
    meaning: 'VC explicitly focused on early stage — more seed deals expected',
    anchors: [
      'seed focused fund',
      'pre-seed fund',
      'writing seed checks',
      'seed stage investor',
      'does many seed deals',
      'portfolio of seed investments',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCELERATOR — early validation and demo day fundraise signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'ACCELERATOR', signal: 'TOP_ACCELERATOR_ACCEPTANCE',
    signal_type: 'LANGUAGE', strength: 0.92, stage: 'pre-seed', actor: 'COMPANY',
    meaning: 'Accepted into a top-tier accelerator — strong early validation',
    anchors: [
      'y combinator',
      'yc batch',
      'yc s',
      'yc w',
      'ycombinator',
      'a16z speedrun',
      'neo scholar',
      'hf0',
      'pioneer tournament',
    ],
  },
  {
    category: 'ACCELERATOR', signal: 'STRONG_ACCELERATOR',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'pre-seed', actor: 'COMPANY',
    meaning: 'Accepted into a well-known accelerator — solid early signal',
    anchors: [
      'techstars',
      '500 global',
      '500 startups',
      'plug and play',
      'sosv',
      'antler',
      'first round',
      'entrepreneur first',
      'ef cohort',
      'sequoia arc',
      'a16z scout',
    ],
  },
  {
    category: 'ACCELERATOR', signal: 'DEMO_DAY',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'seed', actor: 'ANY',
    meaning: 'Demo day is imminent or just passed — fundraise window is open',
    anchors: [
      'demo day',
      'yc demo day',
      'techstars demo day',
      'batch announcement',
      'presenting at demo',
      'presenting our company',
      'pitch day',
    ],
  },
  {
    category: 'ACCELERATOR', signal: 'DEMO_DAY_HOT',
    signal_type: 'LANGUAGE', strength: 0.90, stage: 'seed', actor: 'ANY',
    meaning: 'Strong demo day performance — fundraising will be fast',
    anchors: [
      'top 10 demo day',
      'top company at demo',
      'wins demo day award',
      'raised right after demo',
      'oversubscribed after demo',
      'many vcs attend demo',
      'accelerator invests follow-on',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIVERSITY SPINOUT — deep tech radar signal
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'UNIVERSITY_SPINOUT', signal: 'TOP_UNIVERSITY_ORIGIN',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'pre-seed', actor: 'ANY',
    meaning: 'Company emerged from elite research university — deep tech credibility',
    anchors: [
      'spun out of stanford',
      'from stanford',
      'mit spinout',
      'spun out of mit',
      'from mit',
      'uc berkeley',
      'carnegie mellon',
      'georgia tech',
      'caltech',
      'university of washington',
      'university of toronto',
      'eth zurich',
      'oxford university',
      'cambridge university',
      'imperial college',
    ],
  },
  {
    category: 'UNIVERSITY_SPINOUT', signal: 'RESEARCH_ORIGIN',
    signal_type: 'LANGUAGE', strength: 0.82, stage: 'pre-seed', actor: 'ANY',
    meaning: 'Technology derived from academic research — strong deep tech signal',
    anchors: [
      'spun out of',
      'based on research from',
      'professor founded',
      'phd founders',
      'phd founder',
      'research lab technology',
      'licensed technology from university',
      'technology licensed from',
      'research commercialization',
      'out of the lab',
    ],
  },
  {
    category: 'UNIVERSITY_SPINOUT', signal: 'ACADEMIC_FUNDING',
    signal_type: 'LANGUAGE', strength: 0.80, stage: 'pre-seed', actor: 'ANY',
    meaning: 'Government-backed academic funding validates the underlying science',
    anchors: [
      'nsf funded',
      'nsf grant',
      'darpa funded',
      'nih funded',
      'department of energy funded',
      'doe funded',
      'sbir grant',
      'sttr grant',
      'arpa-e funded',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PATENT — real technology defensibility signal
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'PATENT', signal: 'PATENT_FILED',
    signal_type: 'BEHAVIOR', strength: 0.80, stage: 'any', actor: 'COMPANY',
    meaning: 'Patent activity confirms proprietary technology exists',
    anchors: [
      'filed patent',
      'patent filed',
      'patent application',
      'patents filed',
      'filed a patent',
      'granted patent',
      'patent granted',
      'patent awarded',
      'patent assigned to',
      'patent portfolio',
      'pending patent',
    ],
  },
  {
    category: 'PATENT', signal: 'PATENT_DEEP_TECH',
    signal_type: 'BEHAVIOR', strength: 0.87, stage: 'any', actor: 'COMPANY',
    meaning: 'Patents in hard science domains signal serious deep tech IP',
    anchors: [
      'patent in ai',
      'ai patent',
      'machine learning patent',
      'robotics patent',
      'patent in robotics',
      'battery patent',
      'patent in batteries',
      'materials patent',
      'patent in materials',
      'semiconductor patent',
      'patent in semiconductors',
      'medical device patent',
      'patent in medical devices',
      'biotech patent',
      'drug patent',
    ],
  },
  {
    category: 'PATENT', signal: 'PATENT_MOMENTUM',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'any', actor: 'ANY',
    meaning: 'Growing patent citations indicate technology is becoming foundational',
    anchors: [
      'patent citations',
      'cited patent',
      'widely cited',
      'patent spinout',
      'patent to startup',
      'founded around the patent',
      'many patents',
      'dozens of patents',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOVT GRANT — non-dilutive funding and government validation
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'GOVT_GRANT', signal: 'SBIR_STTR',
    signal_type: 'LANGUAGE', strength: 0.82, stage: 'pre-seed', actor: 'ANY',
    meaning: 'SBIR/STTR award — government validated the science, early non-dilutive capital',
    anchors: [
      'sbir grant',
      'sbir award',
      'awarded sbir',
      'phase i sbir',
      'phase ii sbir',
      'phase i grant',
      'phase ii grant',
      'sttr grant',
      'sttr award',
      'awarded sttr',
      'non-dilutive funding',
      'non dilutive',
    ],
  },
  {
    category: 'GOVT_GRANT', signal: 'DARPA_DOD',
    signal_type: 'LANGUAGE', strength: 0.95, stage: 'any', actor: 'ANY',
    meaning: 'DARPA or DoD selected — extremely high bar, very strong validation',
    anchors: [
      'selected by darpa',
      'darpa award',
      'darpa contract',
      'darpa funded',
      'awarded dod contract',
      'dod contract',
      'department of defense contract',
      'defense contract',
      'air force contract',
      'navy contract',
    ],
  },
  {
    category: 'GOVT_GRANT', signal: 'NIH_BIOTECH',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'NIH-backed biotech — peer-reviewed science with federal validation',
    anchors: [
      'nih grant',
      'nih funded',
      'nih award',
      'national institutes of health',
      'national cancer institute',
      'national institute of',
    ],
  },
  {
    category: 'GOVT_GRANT', signal: 'ENERGY_GRANT',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'DOE or ARPA-E grant — energy sector deep tech validation',
    anchors: [
      'department of energy grant',
      'doe grant',
      'arpa-e grant',
      'arpa-e award',
      'selected by arpa-e',
      'doe funded',
      'energy department award',
    ],
  },
  {
    category: 'GOVT_GRANT', signal: 'GOVT_CONTRACT_REVENUE',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'growth', actor: 'ANY',
    meaning: 'Government contract = real revenue + credibility',
    anchors: [
      'government contract',
      'federal contract',
      'government pilot',
      'pilot program with government',
      'nasa contract',
      'nasa award',
      'nsf grant',
      'nsf award',
      'eu horizon',
      'horizon europe',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFERENCE — visibility and fundraising proximity signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'CONFERENCE', signal: 'MAJOR_TECH_CONFERENCE',
    signal_type: 'BEHAVIOR', strength: 0.80, stage: 'any', actor: 'COMPANY',
    meaning: 'Startup presence at a major tech conference — visibility and fundraise signal',
    anchors: [
      'techcrunch disrupt',
      'web summit',
      'collision conference',
      'ces',
      'aws reinvent',
      'google i/o',
      'apple wwdc',
      'microsoft build',
    ],
  },
  {
    category: 'CONFERENCE', signal: 'DOMAIN_CONFERENCE',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'any', actor: 'COMPANY',
    meaning: 'Presence at a domain-specific conference signals sector momentum',
    anchors: [
      'neurips',
      'nips conference',
      'icml',
      'cvpr',
      'iclr',
      'rsa conference',
      'money 20/20',
      'money2020',
      're+ conference',
      'automate conference',
      'promat',
      'manifest conference',
    ],
  },
  {
    category: 'CONFERENCE', signal: 'CONFERENCE_RISING',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'any', actor: 'COMPANY',
    meaning: 'Startup speaking, on panels, or winning awards — signal of rising profile',
    anchors: [
      'keynote speaker',
      'keynote at',
      'speaking at',
      'founder on panel',
      'panel speaker',
      'demo at conference',
      'wins innovation award',
      'innovation award',
      'best startup award',
      'startup competition winner',
    ],
  },
  {
    category: 'CONFERENCE', signal: 'CONFERENCE_FUNDRAISING',
    signal_type: 'BEHAVIOR', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'VC attention at conference booth signals active fundraise conversations',
    anchors: [
      'many vcs attending',
      'vcs at the booth',
      'investor interest at',
      'private meetings booked',
      'fundraising meetings',
      'booth at',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PODCAST — momentum and sector heat signals
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'PODCAST', signal: 'TOP_PODCAST_APPEARANCE',
    signal_type: 'BEHAVIOR', strength: 0.85, stage: 'any', actor: 'ANY',
    meaning: 'Major podcast appearance — immediate credibility and visibility spike',
    anchors: [
      'all-in podcast',
      'all in podcast',
      'acquired podcast',
      'a16z podcast',
      '20vc',
      'invest like the best',
      'this week in startups',
      "lenny's podcast",
      'latent space podcast',
      'bg2 podcast',
      'stratechery',
      'lex fridman',
      'how i built this',
      'founders podcast',
    ],
  },
  {
    category: 'PODCAST', signal: 'PODCAST_MOMENTUM_SIGNAL',
    signal_type: 'BEHAVIOR', strength: 0.82, stage: 'any', actor: 'ANY',
    meaning: 'Podcast appearance patterns that signal momentum or hot sector',
    anchors: [
      'founder invited to',
      'vc talking about',
      'same startup on multiple',
      'stealth founder appears',
      'appears on multiple podcasts',
      'repeated podcast guest',
      'sector hot on',
      'trending topic',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEWSLETTER / MEDIA — trend and momentum signals from key publications
  // ═══════════════════════════════════════════════════════════════════════════

  {
    category: 'NEWSLETTER_MEDIA', signal: 'TIER1_COVERAGE',
    signal_type: 'LANGUAGE', strength: 0.85, stage: 'any', actor: 'JOURNALIST',
    meaning: 'Coverage in a tier-1 tech or VC publication — strong signal amplifier',
    anchors: [
      'the information',
      'axios pro rata',
      'term sheet',
      'pitchbook',
      'crunchbase news',
      'techcrunch exclusive',
      'forbes cloud',
      'wsj tech',
      'ft tech',
      'bloomberg technology',
      'not boring',
      'stratechery',
      'first round review',
      'nfx',
    ],
  },
  {
    category: 'NEWSLETTER_MEDIA', signal: 'HOT_STARTUP_FRAMING',
    signal_type: 'LANGUAGE', strength: 0.88, stage: 'any', actor: 'JOURNALIST',
    meaning: 'Media language signals a company is breaking out or is a hot deal',
    anchors: [
      'raised quietly',
      'preempted round',
      'top vcs competed',
      'came out of stealth with funding',
      'serial founder',
      'could be an acquisition target',
      'in talks with acquirers',
      'growing fast without funding',
      'bootstrapped to',
      'profitable startup',
      'stealth startup',
    ],
  },
  {
    category: 'NEWSLETTER_MEDIA', signal: 'FOUNDER_CREDIBILITY',
    signal_type: 'LANGUAGE', strength: 0.82, stage: 'any', actor: 'JOURNALIST',
    meaning: 'Media framing of founder pedigree — strong signal of credibility',
    anchors: [
      'ex-big company founders',
      'repeat founder',
      'second-time founder',
      'second time founder',
      'third-time founder',
      'successful exit before',
      'previously founded',
      'unicorn founder',
    ],
  },
];


/**
 * Build a flat anchor index sorted by anchor length descending.
 * Longer anchors matched first → higher specificity, fewer false positives.
 */
const ANCHOR_INDEX = [];
for (const signal of SIGNALS) {
  for (const anchor of signal.anchors) {
    ANCHOR_INDEX.push({
      anchor:      anchor.toLowerCase(),
      signal:      signal.signal,
      category:    signal.category,
      signal_type: signal.signal_type,
      meaning:     signal.meaning,
      strength:    signal.strength,
      stage:       signal.stage,
      actor:       signal.actor,
    });
  }
}
ANCHOR_INDEX.sort((a, b) => b.anchor.length - a.anchor.length);

module.exports = { SIGNALS, ANCHOR_INDEX };
