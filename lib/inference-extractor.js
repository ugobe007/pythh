/**
 * INFERENCE EXTRACTOR
 * ====================
 * Extracts structured data that feeds into the GOD Score inference engine.
 * NO AI REQUIRED - pure pattern matching against your 5 questions.
 * 
 * Maps scraped text → inference-ready fields for:
 * 1. VALUE PROPOSITION - tagline, description clarity
 * 2. PROBLEM - severity keywords, industry pain points  
 * 3. SOLUTION - execution signals, demo/launch status
 * 4. TEAM - GRIT signals, credentials, technical cofounder
 * 5. INVESTMENT - funding amount, stage, benchmarks
 */

// ═══════════════════════════════════════════════════════════════════════════
// FUNDING EXTRACTION (Question 5: INVESTMENT)
// ═══════════════════════════════════════════════════════════════════════════

const FUNDING_PATTERNS = {
  // "$X million" or "$XM" patterns - also match without $ sign
  amount: [
    /\$(\d+(?:\.\d+)?)\s*(million|M|mil)\b/gi,
    /\$(\d+(?:\.\d+)?)\s*(billion|B|bil)\b/gi,
    /raised\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/gi,
    /(\d+(?:\.\d+)?)\s*(million|M)\s*(?:dollar|USD|\$|round|funding)/gi,
    /funding\s+(?:of\s+)?\$?(\d+(?:\.\d+)?)\s*(M|million|B|billion)/gi,
    /(\d+(?:\.\d+)?)\s*(million|billion)\s+(?:in|round)/gi,
  ],
  
  // Series/Stage patterns
  stage: [
    /\b(pre-?seed|pre seed)\b/gi,
    /\b(seed)\s+(?:round|funding|stage)?/gi,
    /\b(series\s*[A-F])\b/gi,
    /\b(Series\s*[A-F])\b/g, // Case sensitive for proper extraction
    /\b(bridge)\s+(?:round|funding)?/gi,
    /\b(growth)\s+(?:round|funding|stage)/gi,
    /\b(late[\s-]?stage)/gi,
    /\b(early[\s-]?stage)/gi,
  ]
};

function extractFunding(text) {
  const result = {
    funding_amount: null,
    funding_stage: null,
    funding_round: null,
    lead_investor: null,
    investors_mentioned: []
  };
  
  // Extract amount - use exec() with non-global patterns to get capture groups
  const amountPatterns = [
    /\$(\d+(?:\.\d+)?)\s*(million|M|mil)\b/i,
    /\$(\d+(?:\.\d+)?)\s*(billion|B|bil)\b/i,
    /raised\s+\$?(\d+(?:\.\d+)?)\s*(million|M|billion|B)/i,
    /(\d+(?:\.\d+)?)\s*(million|M)\s*(?:dollar|USD|\$|round|funding)/i,
    /funding\s+(?:of\s+)?\$?(\d+(?:\.\d+)?)\s*(M|million|B|billion)/i,
    /(\d+(?:\.\d+)?)\s*(million|billion)\s+(?:in|round)/i,
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
      // Some patterns capture in group 1, others in full match
      const stageText = (match[1] || match[0] || '').trim().replace(/\s+/g, ' ');
      if (stageText) {
        result.funding_stage = stageText;
        result.funding_round = stageText;
        break;
      }
    }
  }
  
  // Extract lead investor - limit to just the firm name (not everything after)
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
  let match;
  while ((match = investorPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Filter out noise - must be reasonable length and not contain common false positives
    if (name.length > 5 && name.length < 40 && !name.match(/^(The|With|From|And)/i)) {
      investors.add(name);
    }
  }
  result.investors_mentioned = Array.from(investors);
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTOR/INDUSTRY EXTRACTION (Feeds all 5 questions via inference tables)
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
  // FIXED: 'gaming' alone is too broad - use specific gaming keywords
  'Gaming': ['gaming company', 'game studio', 'game developer', 'video game', 'esports', 'game platform', 'game engine', 'metaverse', 'virtual reality gaming', 'vr gaming', 'game console'],
  'HRTech': ['hrtech', 'hr tech', 'recruiting platform', 'talent management', 'hiring platform', 'workforce'],
  'LegalTech': ['legaltech', 'legal tech', 'law tech', 'contract management', 'compliance software'],
  'Logistics': ['logistics tech', 'supply chain', 'shipping tech', 'freight tech', 'warehouse automation', 'last mile delivery'],
  'DevTools': ['developer tools', 'devtools', 'developer platform', 'code', 'software development', 'api platform', 'ci/cd'],
};

function extractSectors(text) {
  const textLower = text.toLowerCase();
  const sectors = [];
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
  
  // Sort by match count and take top 3
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  return sorted.map(([sector]) => sector);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM & GRIT EXTRACTION (Question 4: TEAM)
// ═══════════════════════════════════════════════════════════════════════════

const TEAM_PATTERNS = {
  // Technical cofounder signals
  technical_cofounder: [
    /\bCTO\b/,
    /chief\s+technology\s+officer/i,
    /technical\s+co-?founder/i,
    /co-?founder.*(?:engineer|developer|architect)/i,
    /(?:engineer|developer|architect).*co-?founder/i,
  ],
  
  // GRIT signals - "door openers" (credentials)
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
    { pattern: /\bPhD\b|doctorate/i, signal: 'PhD' },
    { pattern: /\bMBA\b/i, signal: 'MBA' },
    { pattern: /\bStanford\b/i, signal: 'Stanford' },
    { pattern: /\bMIT\b/i, signal: 'MIT' },
    { pattern: /\bHarvard\b/i, signal: 'Harvard' },
    { pattern: /\bY\s*Combinator\b|\bYC\b/i, signal: 'YC Alum' },
  ],
  
  // GRIT signals - "success predictors" (execution)
  grit: [
    { pattern: /serial\s+entrepreneur/i, signal: 'Serial Entrepreneur', category: 'grit' },
    { pattern: /second-?time\s+founder/i, signal: 'Repeat Founder', category: 'grit' },
    { pattern: /(?:built|scaled|grew)\s+(?:to|from).*(?:\$|\d+[MBK])/i, signal: 'Scaled Previous Company', category: 'grit' },
    { pattern: /(?:successful|profitable)\s+exit/i, signal: 'Previous Exit', category: 'grit' },
    { pattern: /(?:acquired|sold)\s+(?:previous|last|their)\s+(?:company|startup)/i, signal: 'Previous Exit', category: 'grit' },
    { pattern: /\d+\+?\s*years?\s+(?:of\s+)?(?:experience|industry)/i, signal: 'Deep Domain Experience', category: 'determination' },
    { pattern: /domain\s+expert/i, signal: 'Domain Expert', category: 'determination' },
  ],
  
  // Founder names extraction
  founder_name: [
    /(?:founder|ceo|cto|coo|cpo)[\s:,]+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
    /([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(?:founder|ceo|co-?founder)/gi,
  ]
};

function extractTeamSignals(text) {
  const result = {
    has_technical_cofounder: false,
    team_signals: [],
    grit_signals: [],
    credential_signals: [],
    founders: [],
    team_size_estimate: null
  };
  
  // Check for technical cofounder
  for (const pattern of TEAM_PATTERNS.technical_cofounder) {
    if (pattern.test(text)) {
      result.has_technical_cofounder = true;
      break;
    }
  }
  
  // Extract credentials (door openers)
  for (const { pattern, signal } of TEAM_PATTERNS.credentials) {
    if (pattern.test(text)) {
      result.credential_signals.push(signal);
      result.team_signals.push(signal);
    }
  }
  
  // Extract GRIT signals (success predictors)
  for (const { pattern, signal, category } of TEAM_PATTERNS.grit) {
    if (pattern.test(text)) {
      result.grit_signals.push({ signal, category });
      result.team_signals.push(signal);
    }
  }
  
  // Extract founder names
  const founders = new Set();
  for (const pattern of TEAM_PATTERNS.founder_name) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 40 && !name.match(/^(The|This|That|Series|Round)/)) {
        founders.add(name);
      }
    }
  }
  result.founders = Array.from(founders).slice(0, 5);
  
  // Estimate team size
  const teamSizeMatch = text.match(/(\d+)\s*(?:person|people|employee|member|engineer)/i);
  if (teamSizeMatch) {
    result.team_size_estimate = parseInt(teamSizeMatch[1]);
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION SIGNALS (Question 3: SOLUTION)
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
  ],
  
  has_customers: [
    /(\d+)\s*(?:\+\s*)?(?:paying\s+)?(?:customers?|clients?|users?|companies?)/i,
    /\b(?:customers?|clients?)\s+(?:include|including|like|such as)\b/i,
    /\bworking with\s+(?:\d+|several|multiple|companies like)\b/i,
    /\bhas\s+(?:over\s+)?(\d+)\s+(?:paying\s+)?(?:customers|clients)/i,
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
    execution_signals: []
  };
  
  // Check launched status
  for (const pattern of EXECUTION_PATTERNS.is_launched) {
    if (pattern.test(text)) {
      result.is_launched = true;
      result.execution_signals.push('Product Launched');
      break;
    }
  }
  
  // Check demo status
  for (const pattern of EXECUTION_PATTERNS.has_demo) {
    if (pattern.test(text)) {
      result.has_demo = true;
      result.execution_signals.push('Demo Available');
      break;
    }
  }
  
  // Check customers
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
  
  // Check revenue
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
  
  // Check growth
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
// PROBLEM SEVERITY KEYWORDS (Question 2: PROBLEM)
// ═══════════════════════════════════════════════════════════════════════════

const PROBLEM_SEVERITY_KEYWORDS = {
  high: ['critical', 'urgent', 'broken', 'failing', 'crisis', 'desperate', 'massive pain', 'huge problem', 'billion dollar problem', 'existential'],
  medium: ['inefficient', 'costly', 'slow', 'outdated', 'legacy', 'manual', 'complex', 'frustrating'],
  low: ['inconvenient', 'annoying', 'minor', 'nice to have']
};

function extractProblemSignals(text) {
  const textLower = text.toLowerCase();
  let severityScore = 5; // Default medium
  const problemKeywords = [];
  
  // Check high severity
  for (const keyword of PROBLEM_SEVERITY_KEYWORDS.high) {
    if (textLower.includes(keyword)) {
      severityScore = Math.max(severityScore, 8);
      problemKeywords.push(keyword);
    }
  }
  
  // Check medium severity
  for (const keyword of PROBLEM_SEVERITY_KEYWORDS.medium) {
    if (textLower.includes(keyword)) {
      severityScore = Math.max(severityScore, 6);
      problemKeywords.push(keyword);
    }
  }
  
  return {
    problem_severity_estimate: severityScore,
    problem_keywords: problemKeywords.slice(0, 5)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract all inference-ready data from text
 * @param {string} text - Raw text from article/webpage
 * @param {string} [url] - Source URL for context
 * @returns {object} Structured data ready for GOD Score inference
 */
function extractInferenceData(text, url = '') {
  if (!text || text.length < 50) {
    return null;
  }
  
  const funding = extractFunding(text);
  const sectors = extractSectors(text);
  const team = extractTeamSignals(text);
  const execution = extractExecutionSignals(text);
  const problem = extractProblemSignals(text);
  
  // Extract startup name (first capitalized multi-word at start of sentences)
  let startupName = null;
  const nameMatch = text.match(/^([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)/);
  if (nameMatch) {
    startupName = nameMatch[1];
  }
  
  // Alternative: look for "X, a startup" or "X announced"
  if (!startupName) {
    const altMatch = text.match(/([A-Z][A-Za-z0-9]+),?\s+(?:a |an |the )?(?:startup|company|platform)/);
    if (altMatch) {
      startupName = altMatch[1];
    }
  }
  
  return {
    // Basic info
    name: startupName,
    source_url: url,
    
    // Question 5: INVESTMENT
    ...funding,
    
    // Industry (feeds all questions via inference tables)
    sectors,
    
    // Question 4: TEAM
    has_technical_cofounder: team.has_technical_cofounder,
    team_signals: team.team_signals,
    grit_signals: team.grit_signals,
    credential_signals: team.credential_signals,
    founders: team.founders,
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
    extraction_method: 'pattern',
    extracted_at: new Date().toISOString()
  };
}

/**
 * Merge extracted data with existing startup record
 */
function mergeWithExisting(extracted, existing) {
  if (!existing) return extracted;
  
  return {
    ...existing,
    // Only update if we found something new
    funding_amount: extracted.funding_amount || existing.funding_amount || existing.raise_amount,
    funding_stage: extracted.funding_stage || existing.funding_stage || existing.stage,
    sectors: extracted.sectors?.length > 0 ? extracted.sectors : existing.sectors,
    has_technical_cofounder: extracted.has_technical_cofounder || existing.has_technical_cofounder,
    is_launched: extracted.is_launched || existing.is_launched,
    has_demo: extracted.has_demo || existing.has_demo,
    team_size: extracted.team_size || existing.team_size,
    lead_investor: extracted.lead_investor || existing.lead_investor,
    // Append new signals
    team_signals: [...new Set([...(existing.team_signals || []), ...(extracted.team_signals || [])])],
    grit_signals: [...new Set([...(existing.grit_signals || []), ...(extracted.grit_signals || [])])],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  extractInferenceData,
  extractFunding,
  extractSectors,
  extractTeamSignals,
  extractExecutionSignals,
  extractProblemSignals,
  mergeWithExisting,
  
  // Export patterns for testing/extension
  FUNDING_PATTERNS,
  SECTOR_KEYWORDS,
  TEAM_PATTERNS,
  EXECUTION_PATTERNS,
  PROBLEM_SEVERITY_KEYWORDS
};
