/**
 * INFERENCE EXTRACTOR v2
 * ======================
 * Pure pattern-matching engine — NO AI calls, NO external APIs.
 * Extracts structured data from raw website text for GOD Score inference.
 *
 * v2 IMPROVEMENTS:
 * - Phase 0: URL sanitization — strips URLs/emails/handles BEFORE analysis
 * - Phase 1: Name from URL — derives startup name from URL tokens (never from page text)
 * - Phase 2: Sub-extractors — funding, sectors, team (+ advisors), execution, problem, VALUE PROPOSITION [NEW]
 * - Phase 3: Confidence scoring — tier A/B/C classification with missing-field tracking
 *
 * Maps scraped text → inference-ready fields for:
 * 1. VALUE PROPOSITION - tagline, product description, mission [NEW]
 * 2. PROBLEM - severity keywords, industry pain points
 * 3. SOLUTION - execution signals, demo/launch status
 * 4. TEAM - GRIT signals, credentials, advisors, founder narratives [ENHANCED]
 * 5. INVESTMENT - funding amount, stage, valuation, benchmarks [ENHANCED]
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — URL tokenization, TLDs, stop words
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All known TLDs we need to strip from domain names.
 * Sorted longest-first so ".design" matches before ".de"
 */
const URL_TLDS = [
  '.company', '.ventures', '.capital', '.network', '.systems', '.science',
  '.finance', '.digital', '.design', '.studio', '.global', '.online',
  '.health', '.energy', '.supply', '.market',
  '.space', '.build', '.cloud', '.store', '.world', '.media', '.money',
  '.tools', '.works', '.group', '.earth', '.solar', '.green', '.games',
  '.trade', '.click', '.rocks', '.today', '.watch', '.press', '.ninja',
  '.tech', '.site', '.shop', '.fund', '.labs', '.jobs', '.info', '.life',
  '.link', '.news', '.plus', '.team', '.zone', '.wiki', '.cafe',
  '.app', '.dev', '.xyz', '.bio', '.one', '.pro', '.vet', '.art',
  '.fit', '.run', '.wtf', '.fyi', '.pub', '.bet',
  '.co.uk', '.com.au', '.co.in', '.com.br',
  '.com', '.org', '.net', '.edu', '.gov', '.mil',
  '.io', '.ai', '.gg', '.co', '.so', '.to', '.me', '.tv', '.us',
  '.uk', '.de', '.fr', '.jp', '.in', '.ca', '.au', '.nl', '.se',
];

/**
 * Vanity subdomains that should be stripped to get the real company name.
 */
const VANITY_SUBDOMAINS = [
  'www', 'app', 'try', 'get', 'use', 'go', 'my', 'hey', 'meet',
  'join', 'start', 'with', 'about', 'beta', 'demo', 'api', 'docs',
  'help', 'blog', 'mail', 'dash', 'admin',
];

/**
 * Words that should never be returned as a startup name.
 */
const STOP_WORDS = new Set([
  'our', 'the', 'get', 'how', 'why', 'new', 'top', 'all', 'one', 'use',
  'try', 'see', 'let', 'yes', 'now', 'for', 'and', 'but', 'not', 'you',
  'are', 'was', 'has', 'had', 'can', 'will', 'just', 'more', 'also',
  'home', 'about', 'join', 'sign', 'your', 'with', 'from', 'this', 'that',
  'start', 'build', 'grow', 'make', 'help', 'meet', 'find', 'what', 'when',
  'welcome', 'introducing', 'discover', 'learn', 'explore', 'hello',
  'login', 'signin', 'signup', 'register', 'free', 'pricing', 'blog',
  'features', 'products', 'solutions', 'contact', 'team', 'company',
  'platform', 'tools', 'services', 'resources', 'support', 'undefined',
  'skip', 'next', 'back', 'close', 'open', 'menu', 'search', 'share',
  'like', 'follow', 'save', 'edit', 'delete', 'view', 'show', 'hide',
  'loading', 'error', 'success', 'warning', 'info', 'null', 'none',
]);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 0: TEXT SANITIZATION — strip URLs before pattern matching
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remove URLs, email addresses, and social handles from text
 * so that regex patterns don't accidentally match URL fragments.
 */
function sanitizeTextForAnalysis(text) {
  if (!text) return '';
  return text
    // Remove full URLs (http/https/ftp)
    .replace(/(?:https?|ftp):\/\/[^\s<>"')\]]+/gi, ' ')
    // Remove protocol-relative URLs
    .replace(/\/\/[a-z0-9][a-z0-9.-]+\.[a-z]{2,}[^\s<>"')]*$/gim, ' ')
    // Remove www.domain.tld patterns
    .replace(/\bwww\.[a-z0-9][a-z0-9.-]+\.[a-z]{2,}\b/gi, ' ')
    // Remove bare domains with known TLDs (domain.com, domain.io, etc.)
    .replace(/\b[a-z0-9][-a-z0-9]*\.(?:com|org|net|io|ai|co|app|dev|xyz|tech|design|gg|me|tv|so|to|bio|one|pro)\b/gi, ' ')
    // Remove email addresses
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
    // Remove @handles
    .replace(/@[a-z0-9_]+/gi, ' ')
    // Remove #hashtags
    .replace(/#[a-z0-9_]+/gi, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: STARTUP NAME FROM URL — never from page text
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive a clean startup name exclusively from the URL.
 * beehiiv.com   → "Beehiiv"
 * superbloom.design → "Superbloom"
 * try.linear.app → "Linear"
 * https://www.notion.com/product → "Notion"
 *
 * @param {string} url - Full URL or bare domain
 * @returns {string} Capitalized startup name
 */
function parseStartupNameFromUrl(url) {
  if (!url) return 'Unknown';

  let hostname = url
    .replace(/^(?:https?:\/\/)?/i, '')  // strip protocol
    .replace(/\/.*$/, '')                 // strip path
    .replace(/[?#].*$/, '')              // strip query/hash
    .toLowerCase()
    .trim();

  // Strip vanity subdomains: www.notion.com → notion.com, try.linear.app → linear.app
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // Check if first segment is a vanity subdomain
    if (VANITY_SUBDOMAINS.includes(parts[0])) {
      parts.shift();
      hostname = parts.join('.');
    }
  }

  // Strip TLD: beehiiv.com → beehiiv, superbloom.design → superbloom
  // Use longest-first matching so .design beats .de
  let nameToken = hostname;
  for (const tld of URL_TLDS) {
    if (hostname.endsWith(tld)) {
      nameToken = hostname.slice(0, -tld.length);
      break;
    }
  }

  // If we still have dots (e.g. "sub.company"), take the last meaningful segment
  if (nameToken.includes('.')) {
    const segments = nameToken.split('.').filter(s => s.length > 0);
    nameToken = segments[segments.length - 1] || nameToken;
  }

  // Strip hyphens and capitalize: "open-ai" → "OpenAI", "super-bloom" → "SuperBloom"
  if (nameToken.includes('-')) {
    nameToken = nameToken
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
  } else {
    // Simple capitalize: "beehiiv" → "Beehiiv"
    nameToken = nameToken.charAt(0).toUpperCase() + nameToken.slice(1);
  }

  // Validate
  if (!nameToken || nameToken.length < 2 || STOP_WORDS.has(nameToken.toLowerCase())) {
    return 'Unknown';
  }

  return nameToken;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2a: FUNDING EXTRACTION (Question 5: INVESTMENT)
// ═══════════════════════════════════════════════════════════════════════════

const FUNDING_PATTERNS = {
  amount: [
    /\$(\d+(?:\.\d+)?)\s*(million|M|mil)\b/gi,
    /\$(\d+(?:\.\d+)?)\s*(billion|B|bil)\b/gi,
    /raised\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/gi,
    /(\d+(?:\.\d+)?)\s*(million|M)\s*(?:dollar|USD|\$|round|funding)/gi,
    /funding\s+(?:of\s+)?\$?(\d+(?:\.\d+)?)\s*(M|million|B|billion)/gi,
    /(\d+(?:\.\d+)?)\s*(million|billion)\s+(?:in|round)/gi,
    /(?:secured|closed|closes)\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/gi,
  ],
  stage: [
    /\b(pre-?seed|pre seed)\b/gi,
    /\b(seed)\s+(?:round|funding|stage)?/gi,
    /\b(series\s*[A-F])\b/gi,
    /\b(Series\s*[A-F])\b/g,
    /\b(bridge)\s+(?:round|funding)?/gi,
    /\b(growth)\s+(?:round|funding|stage)/gi,
    /\b(late[\s-]?stage)/gi,
    /\b(early[\s-]?stage)/gi,
  ],
  valuation: [
    /(?:valued\s+at|valuation\s+(?:of|at)?)\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/i,
    /\$(\d+(?:\.\d+)?)\s*(million|billion)\s+valuation/i,
    /unicorn/i,  // signals $1B+ valuation
  ]
};

function extractFunding(text) {
  const result = {
    funding_amount: null,
    funding_stage: null,
    funding_round: null,
    lead_investor: null,
    investors_mentioned: [],
    valuation: null,
  };

  // Extract amount
  const amountPatterns = [
    /\$(\d+(?:\.\d+)?)\s*(million|M|mil)\b/i,
    /\$(\d+(?:\.\d+)?)\s*(billion|B|bil)\b/i,
    /raised\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/i,
    /(\d+(?:\.\d+)?)\s*(million|M)\s*(?:dollar|USD|\$|round|funding)/i,
    /funding\s+(?:of\s+)?\$?(\d+(?:\.\d+)?)\s*(M|million|B|billion)/i,
    /(\d+(?:\.\d+)?)\s*(million|billion)\s+(?:in|round)/i,
    /(?:secured|closed|closes)\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      let amount = parseFloat(match[1]);
      const unit = (match[2] || '').toLowerCase();
      if (unit.startsWith('b')) {
        amount *= 1000000000;
      } else if (unit.startsWith('m') || unit.includes('million')) {
        amount *= 1000000;
      }
      if (!isNaN(amount) && amount > 0) {
        result.funding_amount = amount;
        break;
      }
    }
  }

  // Extract stage
  for (const pattern of FUNDING_PATTERNS.stage) {
    const match = text.match(pattern);
    if (match) {
      const stageText = (match[1] || match[0] || '').trim().replace(/\s+/g, ' ');
      if (stageText) {
        result.funding_stage = stageText;
        result.funding_round = stageText;
        break;
      }
    }
  }

  // Extract valuation
  const valPatterns = [
    /(?:valued\s+at|valuation\s+(?:of|at)?)\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/i,
    /\$(\d+(?:\.\d+)?)\s*(million|billion)\s+valuation/i,
  ];
  for (const pattern of valPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      let val = parseFloat(match[1]);
      const unit = (match[2] || '').toLowerCase();
      if (unit.startsWith('b')) val *= 1000000000;
      else if (unit.startsWith('m') || unit.includes('million')) val *= 1000000;
      if (!isNaN(val) && val > 0) {
        result.valuation = val;
        break;
      }
    }
  }
  // Unicorn check
  if (!result.valuation && /\bunicorn\b/i.test(text)) {
    result.valuation = 1000000000;
  }

  // Extract lead investor
  const leadPatterns = [
    /led\s+by\s+([A-Z][A-Za-z]+(?:\s+[A-Z]?[a-z]+)?(?:\s+(?:Capital|Ventures|Partners)))/i,
    /([A-Z][A-Za-z]+(?:\s+[A-Z]?[a-z]+)?(?:\s+(?:Capital|Ventures|Partners)))\s+led/i,
  ];
  for (const pattern of leadPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.lead_investor = match[1].trim();
      break;
    }
  }

  // Extract all mentioned investors
  const investorPattern = /\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)?\s+(?:Capital|Ventures|Partners|Fund|Equity))\b/g;
  const investors = new Set();
  let invMatch;
  while ((invMatch = investorPattern.exec(text)) !== null) {
    const name = invMatch[1].trim();
    if (name.length > 5 && name.length < 40 && !/^(The|With|From|And)/i.test(name)) {
      investors.add(name);
    }
  }
  result.investors_mentioned = Array.from(investors);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2b: SECTOR/INDUSTRY EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

const SECTOR_KEYWORDS = {
  'AI/ML': ['artificial intelligence', 'machine learning', 'ai-powered', 'ai platform', 'llm', 'large language', 'deep learning', 'neural network', 'nlp', 'computer vision', 'generative ai', 'gpt', 'chatbot', 'ai startup'],
  'HealthTech': ['healthcare', 'health tech', 'medical', 'clinical', 'patient', 'hospital', 'pharma', 'drug', 'therapeutics', 'biotech', 'telemedicine', 'digital health', 'diagnostics'],
  'FinTech': ['fintech', 'financial services', 'banking', 'payment', 'lending', 'insurance', 'insurtech', 'neobank', 'crypto', 'blockchain', 'defi', 'trading platform'],
  'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software', 'cloud platform', 'workflow automation', 'developer tools'],
  'E-Commerce': ['ecommerce', 'e-commerce', 'marketplace', 'retail tech', 'dtc', 'direct to consumer', 'online shopping'],
  'EdTech': ['edtech', 'education technology', 'online learning', 'online course', 'tutoring', 'e-learning', 'training platform'],
  'CleanTech': ['cleantech', 'clean tech', 'climate tech', 'sustainability', 'carbon capture', 'renewable energy', 'solar power', 'wind power', 'energy storage', 'electric vehicle'],
  'SpaceTech': ['space tech', 'satellite', 'aerospace', 'rocket', 'orbital', 'space launch', 'spacex'],
  'Robotics': ['robotics', 'robot', 'industrial automation', 'autonomous', 'drone', 'manufacturing automation'],
  'DeepTech': ['deep tech', 'hardware startup', 'semiconductor', 'chip', 'quantum computing', 'materials science'],
  'Cybersecurity': ['cybersecurity', 'cyber security', 'infosec', 'threat detection', 'vulnerability', 'encryption', 'identity management'],
  'PropTech': ['proptech', 'prop tech', 'real estate tech', 'property tech', 'construction tech'],
  'FoodTech': ['foodtech', 'food tech', 'agtech', 'agriculture tech', 'farming tech', 'alternative protein', 'plant-based'],
  'Gaming': ['gaming company', 'game studio', 'game developer', 'video game', 'esports', 'game platform', 'game engine', 'metaverse', 'virtual reality gaming', 'vr gaming', 'game console'],
  'HRTech': ['hrtech', 'hr tech', 'recruiting platform', 'talent management', 'hiring platform', 'workforce'],
  'LegalTech': ['legaltech', 'legal tech', 'law tech', 'contract management', 'compliance software'],
  'Logistics': ['logistics tech', 'supply chain', 'shipping tech', 'freight tech', 'warehouse automation', 'last mile delivery'],
  'DevTools': ['developer tools', 'devtools', 'developer platform', 'code', 'software development', 'api platform', 'ci/cd'],
};

function extractSectors(text) {
  const textLower = text.toLowerCase();
  const scores = {};

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      scores[sector] = matchCount;
    }
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sector]) => sector);
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2c: VALUE PROPOSITION EXTRACTION [NEW in v2]
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extracts value proposition, product description, and mission from text.
 * Three pattern groups:
 *   A: Self-declarations ("we help...", "our mission is...", "our IP...")
 *   B: Third-person / PR language ("X is disrupting...", "with the launch of...")
 *   C: Problem-solution arcs ("solving X with Y")
 *
 * @param {string} text - Sanitized text (URLs already stripped)
 * @param {string} startupName - Name for third-person matching
 * @returns {{ value_proposition: string|null, tagline: string|null, product_description: string|null }}
 */
function extractValueProposition(text, startupName) {
  const result = {
    value_proposition: null,
    tagline: null,
    product_description: null,
  };

  const nameEsc = startupName ? startupName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '[A-Z][A-Za-z]+';

  // Group A: Self-declarations
  const selfPatterns = [
    /(?:we|our\s+(?:mission|platform|product|goal|vision))\s+(?:is\s+to\s+)?(?:help|enable|empower|allow|make\s+it\s+easy|transform|revolutionize|disrupt|automate|simplify|streamline)\s+([^.!]{10,150})/i,
    /(?:we\s+(?:build|create|develop|provide|offer|deliver))\s+([^.!]{10,150})/i,
    /(?:our\s+(?:IP|technology|proprietary|patented|unique)\s+(?:is|enables|powers|allows))\s+([^.!]{10,150})/i,
    /(?:we(?:'re|\s+are)\s+(?:building|creating|developing|on a mission))\s+([^.!]{10,150})/i,
  ];

  for (const pattern of selfPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.value_proposition = match[0].trim().substring(0, 200);
      break;
    }
  }

  // Group B: Third-person / PR language
  if (!result.value_proposition) {
    const thirdPersonPatterns = [
      new RegExp(`${nameEsc}\\s+(?:is\\s+)?(?:disrupting|transforming|reimagining|reinventing|redefining|pioneering|revolutionizing)\\s+([^.!]{10,150})`, 'i'),
      new RegExp(`(?:with\\s+the\\s+(?:launch|debut|introduction)\\s+of\\s+)${nameEsc}([^.!]{10,150})`, 'i'),
      new RegExp(`${nameEsc},?\\s+(?:a|an|the)\\s+([^.!]{10,150})`, 'i'),
    ];

    for (const pattern of thirdPersonPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.value_proposition = match[0].trim().substring(0, 200);
        break;
      }
    }
  }

  // Group C: Problem-solution arcs
  if (!result.value_proposition) {
    const arcPatterns = [
      /(?:solving|tackles?|addresses?|eliminates?)\s+(?:the\s+)?(?:problem\s+of\s+)?([^.!]{10,100})\s+(?:with|by|through|using|via)\s+([^.!]{10,100})/i,
      /(?:instead\s+of|rather\s+than|unlike)\s+([^,]{10,80}),?\s+([^.!]{10,100})/i,
    ];

    for (const pattern of arcPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.value_proposition = match[0].trim().substring(0, 200);
        break;
      }
    }
  }

  // Tagline: short punchy sentence, usually < 80 chars, often quotation or title case
  const taglinePatterns = [
    /"([^"]{15,80})"/,   // Quoted tagline
    /['']([^'']{15,80})['']/,  // Smart-quoted
    /(?:tagline|motto|slogan):\s*([^.!]{10,80})/i,
  ];
  for (const pattern of taglinePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.tagline = match[1].trim();
      break;
    }
  }

  // Product description: first substantial sentence about the product
  const descPatterns = [
    /(?:is\s+(?:a|an|the)\s+)([^.]{20,200}(?:platform|tool|solution|service|software|product|app|marketplace|engine|system)[^.]*)/i,
    new RegExp(`${nameEsc}\\s+(?:is|provides|offers|delivers)\\s+([^.]{20,200})`, 'i'),
  ];
  for (const pattern of descPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.product_description = match[1].trim().substring(0, 250);
      break;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2d: TEAM & GRIT EXTRACTION (Question 4: TEAM) — ENHANCED
// ═══════════════════════════════════════════════════════════════════════════

const TEAM_PATTERNS = {
  technical_cofounder: [
    /\bCTO\b/,
    /chief\s+technology\s+officer/i,
    /technical\s+co-?founder/i,
    /co-?founder.*(?:engineer|developer|architect)/i,
    /(?:engineer|developer|architect).*co-?founder/i,
  ],

  credentials: [
    { pattern: /\b(?:ex-?|former\s+)(?:Google|Googler)/i, signal: 'Ex-Google' },
    { pattern: /\b(?:ex-?|former\s+)(?:Meta|Facebook)/i, signal: 'Ex-Meta' },
    { pattern: /\b(?:ex-?|former\s+)(?:Apple)/i, signal: 'Ex-Apple' },
    { pattern: /\b(?:ex-?|former\s+)(?:Amazon|AWS)/i, signal: 'Ex-Amazon' },
    { pattern: /\b(?:ex-?|former\s+)(?:Microsoft)/i, signal: 'Ex-Microsoft' },
    { pattern: /\b(?:ex-?|former\s+)(?:Netflix)/i, signal: 'Ex-Netflix' },
    { pattern: /\b(?:ex-?|former\s+)(?:Stripe)/i, signal: 'Ex-Stripe' },
    { pattern: /\b(?:ex-?|former\s+)(?:Uber)/i, signal: 'Ex-Uber' },
    { pattern: /\b(?:ex-?|former\s+)(?:Airbnb)/i, signal: 'Ex-Airbnb' },
    { pattern: /\b(?:ex-?|former\s+)(?:Tesla)/i, signal: 'Ex-Tesla' },
    { pattern: /\b(?:ex-?|former\s+)(?:SpaceX)/i, signal: 'Ex-SpaceX' },
    { pattern: /\b(?:ex-?|former\s+)(?:OpenAI)/i, signal: 'Ex-OpenAI' },
    { pattern: /\b(?:ex-?|former\s+)(?:Palantir)/i, signal: 'Ex-Palantir' },
    { pattern: /\b(?:ex-?|former\s+)(?:Snap|Snapchat)/i, signal: 'Ex-Snap' },
    { pattern: /\b(?:ex-?|former\s+)(?:LinkedIn)/i, signal: 'Ex-LinkedIn' },
    { pattern: /\bPhD\b|doctorate/i, signal: 'PhD' },
    { pattern: /\bMBA\b/i, signal: 'MBA' },
    { pattern: /\bStanford\b/i, signal: 'Stanford' },
    { pattern: /\bMIT\b/i, signal: 'MIT' },
    { pattern: /\bHarvard\b/i, signal: 'Harvard' },
    { pattern: /\b(?:Y\s*Combinator|YC\s+(?:W|S)\d{2})\b/i, signal: 'YC Alum' },
    { pattern: /\bTechstars\b/i, signal: 'Techstars' },
    { pattern: /\b500\s*(?:Startups|Global)\b/i, signal: '500 Global' },
  ],

  grit: [
    { pattern: /serial\s+entrepreneur/i, signal: 'Serial Entrepreneur', category: 'grit' },
    { pattern: /second-?time\s+founder/i, signal: 'Repeat Founder', category: 'grit' },
    { pattern: /(?:built|scaled|grew)\s+(?:to|from).*(?:\$|\d+[MBK])/i, signal: 'Scaled Previous Company', category: 'grit' },
    { pattern: /(?:successful|profitable)\s+exit/i, signal: 'Previous Exit', category: 'grit' },
    { pattern: /(?:acquired|sold)\s+(?:previous|last|their)\s+(?:company|startup)/i, signal: 'Previous Exit', category: 'grit' },
    { pattern: /\d+\+?\s*years?\s+(?:of\s+)?(?:experience|industry)/i, signal: 'Deep Domain Experience', category: 'determination' },
    { pattern: /domain\s+expert/i, signal: 'Domain Expert', category: 'determination' },
    { pattern: /(?:Forbes|Inc)\s+(?:\d+\s+)?(?:Under|list)/i, signal: 'Media Recognition', category: 'grit' },
  ],

  // Founder name extraction — classic patterns
  founder_name: [
    /(?:founder|ceo|cto|coo|cpo)[\s:,]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
    /([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(?:founder|ceo|co-?founder)/gi,
  ],

  // NEW in v2: Founder narratives — "NAME started URL to solve PROBLEM"
  founder_narrative: [
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:founded|started|created|launched|built)\s+([A-Za-z]+)\s+(?:to|in order to|because)\s+([^.]{10,120})/gi,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:left|quit|walked away from)\s+(?:their|his|her|a)\s+(?:job|role|position)\s+(?:at\s+[A-Z]\w+\s+)?(?:to|and)\s+([^.]{10,120})/gi,
  ],

  // NEW in v2: Advisor / board patterns
  advisor: [
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:joined|serves?)\s+(?:as\s+)?(?:an?\s+)?(?:advisor|board\s+member|strategic\s+advisor)/gi,
    /(?:advisor|board\s+member)[\s:,]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
    /(?:backed|advised|mentored)\s+by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
  ],
};

/**
 * Validate that a string looks like a real person name and not noise.
 */
function isValidPersonName(name) {
  if (!name || name.length < 4 || name.length > 40) return false;
  const words = name.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  // Each word should start with uppercase
  if (!words.every(w => /^[A-Z]/.test(w))) return false;
  // Reject common false positives
  const fp = /^(The|This|That|Series|Round|Our|New|Get|First|Last|Next|One|Two|Three|Each|Both|Some|Any|All|No|Read|Click|See|More|Sign|Join|Try|View|Show)/i;
  if (fp.test(words[0])) return false;
  return true;
}

function extractTeamSignals(text, startupName) {
  const result = {
    has_technical_cofounder: false,
    team_signals: [],
    grit_signals: [],
    credential_signals: [],
    founders: [],
    advisors: [],
    founder_problem_fit: null,
    team_size_estimate: null,
  };

  // Technical cofounder
  for (const pattern of TEAM_PATTERNS.technical_cofounder) {
    if (pattern.test(text)) {
      result.has_technical_cofounder = true;
      break;
    }
  }

  // Credentials
  for (const { pattern, signal } of TEAM_PATTERNS.credentials) {
    if (pattern.test(text)) {
      result.credential_signals.push(signal);
      result.team_signals.push(signal);
    }
  }

  // GRIT signals
  for (const { pattern, signal, category } of TEAM_PATTERNS.grit) {
    if (pattern.test(text)) {
      result.grit_signals.push({ signal, category });
      result.team_signals.push(signal);
    }
  }

  // Founder names
  const founders = new Set();
  for (const pattern of TEAM_PATTERNS.founder_name) {
    let match;
    pattern.lastIndex = 0; // Reset regex state
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (isValidPersonName(name)) {
        founders.add(name);
      }
    }
  }
  result.founders = Array.from(founders).slice(0, 5);

  // Founder narrative — "NAME started X to solve PROBLEM"
  for (const pattern of TEAM_PATTERNS.founder_narrative) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      const founderName = match[1].trim();
      const problemOrMission = match[match.length - 1].trim();
      if (isValidPersonName(founderName) && problemOrMission.length > 10) {
        result.founder_problem_fit = `${founderName}: ${problemOrMission}`.substring(0, 200);
        if (!founders.has(founderName)) {
          founders.add(founderName);
          result.founders = Array.from(founders).slice(0, 5);
        }
        break;
      }
    }
  }

  // Advisors
  const advisors = new Set();
  for (const pattern of TEAM_PATTERNS.advisor) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (isValidPersonName(name) && !founders.has(name)) {
        advisors.add(name);
      }
    }
  }
  result.advisors = Array.from(advisors).slice(0, 5);

  // Team size estimate
  const teamSizeMatch = text.match(/(\d+)\s*(?:person|people|employee|member|engineer)/i);
  if (teamSizeMatch) {
    result.team_size_estimate = parseInt(teamSizeMatch[1]);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2e: EXECUTION SIGNALS (Question 3: SOLUTION)
// ═══════════════════════════════════════════════════════════════════════════

const EXECUTION_PATTERNS = {
  is_launched: [
    /\b(?:launched|live|in production|generally available|ga)\b/i,
    /\b(?:went live|gone live|now available)\b/i,
    /\bserving\s+(?:customers|clients|users)\b/i,
    /\bproduct\s+launched\b/i,
    /\balready\s+(?:live|available|serving)\b/i,
  ],
  has_demo: [
    /\b(?:demo|prototype|beta|pilot)\s+(?:available|ready|live)/i,
    /\b(?:try|test|preview)\s+(?:it|the product|our)\b/i,
    /\b(?:free\s+trial|start\s+(?:free|your)\s+trial)\b/i,
    /\b(?:request\s+(?:a\s+)?demo|book\s+(?:a\s+)?demo|schedule\s+(?:a\s+)?demo)\b/i,
    /\b(?:sandbox|playground)\b/i,
  ],
  has_customers: [
    /(\d+)\s*(?:\+\s*)?(?:paying\s+)?(?:customers?|clients?|users?|companies?)/i,
    /\b(?:customers?|clients?)\s+(?:include|including|like|such as)\b/i,
    /\bworking with\s+(?:\d+|several|multiple|companies like)\b/i,
    /\bhas\s+(?:over\s+)?(\d+)\s+(?:paying\s+)?(?:customers|clients)/i,
    /\btrusted\s+by\s+(?:\d+|leading|top|major)\b/i,
  ],
  has_revenue: [
    /\b(?:revenue|arr|mrr|sales)\b/i,
    /\$\d+(?:\.\d+)?[MK]?\s*(?:arr|mrr|revenue)/i,
    /\d+[MK]\s+(?:arr|mrr|revenue)/i,
    /\b(?:profitable|break-?even|cash-?flow positive|generating)\b/i,
    /\bgenerating\s+\$?\d+/i,
  ],
  growth_signals: [
    /\b(\d+)[x%]\s+(?:growth|increase|grew)/i,
    /(?:grew|growth|increased)\s+(?:by\s+)?(\d+)[x%]/i,
    /\bMoM\b.*(\d+)%/i,
    /\bYoY\b.*(\d+)%/i,
  ]
};

function extractExecutionSignals(text) {
  const result = {
    is_launched: false,
    has_demo: false,
    has_customers: false,
    customer_count: null,
    has_revenue: false,
    revenue_indicator: null,
    growth_rate: null,
    execution_signals: [],
  };

  for (const pattern of EXECUTION_PATTERNS.is_launched) {
    if (pattern.test(text)) {
      result.is_launched = true;
      result.execution_signals.push('Product Launched');
      break;
    }
  }

  for (const pattern of EXECUTION_PATTERNS.has_demo) {
    if (pattern.test(text)) {
      result.has_demo = true;
      result.execution_signals.push('Demo Available');
      break;
    }
  }

  for (const pattern of EXECUTION_PATTERNS.has_customers) {
    const match = text.match(pattern);
    if (match) {
      result.has_customers = true;
      if (match[1]) {
        result.customer_count = parseInt(match[1]);
      }
      result.execution_signals.push('Has Customers');
      break;
    }
  }

  for (const pattern of EXECUTION_PATTERNS.has_revenue) {
    const match = text.match(pattern);
    if (match) {
      result.has_revenue = true;
      if (match[1]) {
        result.revenue_indicator = match[1];
      }
      result.execution_signals.push('Has Revenue');
      break;
    }
  }

  for (const pattern of EXECUTION_PATTERNS.growth_signals) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.growth_rate = match[1];
      result.execution_signals.push(`${match[1]}x Growth`);
      break;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2f: PROBLEM SEVERITY (Question 2: PROBLEM)
// ═══════════════════════════════════════════════════════════════════════════

const PROBLEM_SEVERITY_KEYWORDS = {
  high: [
    'critical', 'urgent', 'broken', 'failing', 'crisis', 'desperate',
    'massive pain', 'huge problem', 'billion dollar problem', 'existential',
    'life-threatening', 'catastrophic', 'epidemic', 'pandemic',
  ],
  medium: [
    'inefficient', 'costly', 'slow', 'outdated', 'legacy', 'manual',
    'complex', 'frustrating', 'time-consuming', 'error-prone', 'cumbersome',
    'fragmented', 'disconnected', 'siloed',
  ],
  low: ['inconvenient', 'annoying', 'minor', 'nice to have'],
};

function extractProblemSignals(text) {
  const textLower = text.toLowerCase();
  let severityScore = 5;
  const problemKeywords = [];

  for (const keyword of PROBLEM_SEVERITY_KEYWORDS.high) {
    if (textLower.includes(keyword)) {
      severityScore = Math.max(severityScore, 8);
      problemKeywords.push(keyword);
    }
  }

  for (const keyword of PROBLEM_SEVERITY_KEYWORDS.medium) {
    if (textLower.includes(keyword)) {
      severityScore = Math.max(severityScore, 6);
      problemKeywords.push(keyword);
    }
  }

  return {
    problem_severity_estimate: severityScore,
    problem_keywords: problemKeywords.slice(0, 5),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: CONFIDENCE SCORING — tier classification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assess extraction confidence and classify tier.
 * Tier A (≥55): Rich data, no further enrichment needed
 * Tier B (30-54): Moderate data, usable but imperfect
 * Tier C (<30): Sparse data, recommend scraper fallback
 *
 * @param {object} data - Combined extraction result
 * @returns {{ score: number, tier: string, missing: string[], recommendation: string }}
 */
function assessConfidence(data) {
  let score = 0;
  const missing = [];

  // Value proposition (0-15 pts)
  if (data.value_proposition) score += 15;
  else missing.push('value_proposition');

  // Sectors (0-10 pts)
  if (data.sectors?.length >= 2) score += 10;
  else if (data.sectors?.length === 1) score += 5;
  else missing.push('sectors');

  // Team signals (0-15 pts)
  if (data.founders?.length > 0) score += 8;
  else missing.push('founders');
  if (data.team_signals?.length >= 2) score += 7;
  else if (data.team_signals?.length === 1) score += 3;

  // Execution signals (0-20 pts)
  if (data.is_launched) score += 8;
  if (data.has_customers) score += 6;
  if (data.has_revenue) score += 6;
  else if (data.has_demo) score += 3;
  if (!data.is_launched && !data.has_demo) missing.push('execution');

  // Funding (0-15 pts)
  if (data.funding_amount) score += 10;
  if (data.funding_stage) score += 5;
  if (!data.funding_amount && !data.funding_stage) missing.push('funding');

  // Problem signals (0-10 pts)
  if (data.problem_keywords?.length >= 2) score += 10;
  else if (data.problem_keywords?.length === 1) score += 5;
  else missing.push('problem');

  // Growth / revenue (0-10 pts)
  if (data.growth_rate) score += 5;
  if (data.customer_count) score += 5;

  // Advisor bonus (0-5 pts)
  if (data.advisors?.length > 0) score += 5;

  // Determine tier
  let tier, recommendation;
  if (score >= 55) {
    tier = 'A';
    recommendation = 'inference_sufficient';
  } else if (score >= 30) {
    tier = 'B';
    recommendation = 'inference_usable';
  } else {
    tier = 'C';
    recommendation = 'scraper_fallback_recommended';
  }

  return { score, tier, missing, recommendation };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract all inference-ready data from text.
 * v2: sanitizes URLs first, derives name from URL, includes value proposition
 * and confidence scoring.
 *
 * @param {string} text - Raw text from article/webpage
 * @param {string} [url] - Source URL for name derivation and context
 * @returns {object|null} Structured data ready for GOD Score inference
 */
function extractInferenceData(text, url = '') {
  if (!text || text.length < 50) {
    return null;
  }

  // Phase 1: Derive startup name from URL (never from page text)
  const startupName = parseStartupNameFromUrl(url);

  // Phase 0: Sanitize text — strip URLs/emails/handles before pattern matching
  const cleanText = sanitizeTextForAnalysis(text);

  // Phase 2: Run all sub-extractors on clean text
  const funding = extractFunding(cleanText);
  const sectors = extractSectors(cleanText);
  const valueProp = extractValueProposition(cleanText, startupName);
  const team = extractTeamSignals(cleanText, startupName);
  const execution = extractExecutionSignals(cleanText);
  const problem = extractProblemSignals(cleanText);

  // Assemble result
  const result = {
    // Basic info — name ALWAYS from URL
    name: startupName,
    source_url: url,

    // Question 1: VALUE PROPOSITION [NEW]
    value_proposition: valueProp.value_proposition,
    tagline: valueProp.tagline,
    product_description: valueProp.product_description,

    // Question 5: INVESTMENT
    ...funding,

    // Industry (feeds all questions)
    sectors,

    // Question 4: TEAM
    has_technical_cofounder: team.has_technical_cofounder,
    team_signals: team.team_signals,
    grit_signals: team.grit_signals,
    credential_signals: team.credential_signals,
    founders: team.founders,
    advisors: team.advisors,
    founder_problem_fit: team.founder_problem_fit,
    team_size: team.team_size_estimate,

    // Question 3: SOLUTION (Execution)
    is_launched: execution.is_launched,
    has_demo: execution.has_demo,
    has_customers: execution.has_customers,
    customer_count: execution.customer_count,
    has_revenue: execution.has_revenue,
    growth_rate: execution.growth_rate,
    execution_signals: execution.execution_signals,

    // Question 2: PROBLEM
    problem_severity_estimate: problem.problem_severity_estimate,
    problem_keywords: problem.problem_keywords,

    // Metadata
    extraction_method: 'pattern_v2',
    extracted_at: new Date().toISOString(),
  };

  // Phase 3: Confidence scoring
  result.confidence = assessConfidence(result);

  return result;
}

/**
 * Merge extracted data with existing startup record.
 * New data only overwrites if it's non-null/non-empty.
 */
function mergeWithExisting(extracted, existing) {
  if (!existing) return extracted;

  return {
    ...existing,
    // Only update fields where we found something new
    funding_amount: extracted.funding_amount || existing.funding_amount || existing.raise_amount,
    funding_stage: extracted.funding_stage || existing.funding_stage || existing.stage,
    sectors: extracted.sectors?.length > 0 ? extracted.sectors : existing.sectors,
    has_technical_cofounder: extracted.has_technical_cofounder || existing.has_technical_cofounder,
    is_launched: extracted.is_launched || existing.is_launched,
    has_demo: extracted.has_demo || existing.has_demo,
    team_size: extracted.team_size || existing.team_size,
    lead_investor: extracted.lead_investor || existing.lead_investor,
    value_proposition: extracted.value_proposition || existing.value_proposition,
    valuation: extracted.valuation || existing.valuation,
    // Append new signals (deduplicated)
    team_signals: [...new Set([...(existing.team_signals || []), ...(extracted.team_signals || [])])],
    grit_signals: [...new Set([...(existing.grit_signals || []), ...(extracted.grit_signals || [])])],
    founders: [...new Set([...(existing.founders || []), ...(extracted.founders || [])])].slice(0, 5),
    advisors: [...new Set([...(existing.advisors || []), ...(extracted.advisors || [])])].slice(0, 5),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main functions
  extractInferenceData,
  mergeWithExisting,

  // Sub-extractors (for direct use / testing)
  extractFunding,
  extractSectors,
  extractValueProposition,
  extractTeamSignals,
  extractExecutionSignals,
  extractProblemSignals,

  // v2 utilities
  sanitizeTextForAnalysis,
  parseStartupNameFromUrl,
  assessConfidence,
  isValidPersonName,

  // Constants (for testing / extension)
  FUNDING_PATTERNS,
  SECTOR_KEYWORDS,
  TEAM_PATTERNS,
  EXECUTION_PATTERNS,
  PROBLEM_SEVERITY_KEYWORDS,
  URL_TLDS,
  VANITY_SUBDOMAINS,
  STOP_WORDS,
};
