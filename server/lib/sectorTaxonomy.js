// ============================================================================
// SECTOR TAXONOMY
// ============================================================================
// Canonical sector definitions with:
// - synonyms (same thing, different names)
// - related (cross-match worthy)
// - groups (parent categories)
//
// Used by: match-regenerator.js, instantSubmit.js, enrichment scripts
// ============================================================================

/**
 * CANONICAL SECTORS
 * The "true" sector name we normalize to
 */
const CANONICAL_SECTORS = [
  // Tech Categories
  'AI/ML',
  'SaaS',
  'Enterprise',
  'Developer Tools',
  'Infrastructure',
  'Cybersecurity',
  'Data',
  
  // Verticals
  'Fintech',
  'HealthTech',
  'EdTech',
  'PropTech',
  'CleanTech',
  'AgTech',
  'FoodTech',
  
  // Business Models
  'Marketplace',
  'E-commerce',
  'D2C',
  'Consumer',
  
  // Deep Tech
  'DeepTech',
  'Biotech',
  'Robotics',
  'SpaceTech',
  'Defense',
  
  // Other
  'Crypto/Web3',
  'Gaming',
  'Media',
  'Climate',
];

/**
 * SECTOR SYNONYMS
 * Maps various sector names to their canonical form
 * Key = canonical, Values = alternatives that mean the same thing
 */
const SECTOR_SYNONYMS = {
  // AI/ML
  'AI/ML': [
    'ai', 'ml', 'artificial intelligence', 'machine learning',
    'deep learning', 'generative ai', 'gen ai', 'llm',
    'computer vision', 'nlp', 'natural language processing',
  ],
  
  // SaaS
  'SaaS': [
    'saas', 'software as a service', 'b2b software', 'software',
    'cloud software', 'subscription software', 'b2b saas',
  ],
  
  // Enterprise
  'Enterprise': [
    'enterprise', 'enterprise software', 'enterprise tech',
    'b2b', 'b2b tech', 'business software', 'erp',
    'enterprise applications', 'workflow', 'productivity',
  ],
  
  // Developer Tools
  'Developer Tools': [
    'developer tools', 'devtools', 'dev tools', 'api',
    'developer platform', 'developer infrastructure',
    'open source', 'oss', 'sdk',
  ],
  
  // Infrastructure
  'Infrastructure': [
    'infrastructure', 'infra', 'cloud', 'cloud computing',
    'cloud infrastructure', 'iaas', 'paas', 'serverless',
    'devops', 'infrastructure software',
  ],
  
  // Cybersecurity
  'Cybersecurity': [
    'cybersecurity', 'security', 'infosec', 'information security',
    'cyber security', 'cyber', 'identity', 'authentication',
  ],
  
  // Data
  'Data': [
    'data', 'big data', 'data infrastructure', 'analytics',
    'data analytics', 'business intelligence', 'bi',
    'data platform', 'data management',
  ],
  
  // Fintech
  'Fintech': [
    'fintech', 'financial technology', 'financial services',
    'payments', 'banking', 'neobank', 'insurtech', 'insurance',
    'lending', 'credit', 'wealth management', 'wealthtech',
    'regtech', 'trading',
  ],
  
  // HealthTech
  'HealthTech': [
    'healthtech', 'health tech', 'healthcare', 'digital health',
    'health', 'medtech', 'medical technology', 'telemedicine',
    'telehealth', 'health/wellness', 'wellness',
  ],
  
  // EdTech
  'EdTech': [
    'edtech', 'education', 'ed tech', 'educational technology',
    'e-learning', 'elearning', 'learning',
  ],
  
  // PropTech
  'PropTech': [
    'proptech', 'real estate', 'real estate tech', 'property',
    'property technology', 'retech', 'construction tech',
  ],
  
  // CleanTech
  'CleanTech': [
    'cleantech', 'clean tech', 'clean energy', 'renewable',
    'renewable energy', 'sustainability', 'green tech',
    'energy', 'energy tech',
  ],
  
  // AgTech
  'AgTech': [
    'agtech', 'agriculture', 'ag tech', 'agritech',
    'farming', 'food/beverage', 'food tech',
  ],
  
  // FoodTech
  'FoodTech': [
    'foodtech', 'food tech', 'food', 'food delivery',
    'restaurant tech', 'cpg', 'consumer packaged goods',
  ],
  
  // Marketplace
  'Marketplace': [
    'marketplace', 'marketplaces', 'two-sided marketplace',
    'platform', 'gig economy',
  ],
  
  // E-commerce
  'E-commerce': [
    'e-commerce', 'ecommerce', 'e commerce', 'retail',
    'retail tech', 'commerce', 'online retail',
  ],
  
  // D2C
  'D2C': [
    'd2c', 'dtc', 'direct to consumer', 'd2c brands',
    'consumer brands', 'consumer products',
  ],
  
  // Consumer
  'Consumer': [
    'consumer', 'consumer tech', 'consumer internet',
    'consumer software', 'b2c', 'consumer apps',
    'social', 'social media',
  ],
  
  // DeepTech
  'DeepTech': [
    'deeptech', 'deep tech', 'hard tech', 'frontier tech',
    'advanced manufacturing', 'materials', 'science',
  ],
  
  // Biotech
  'Biotech': [
    'biotech', 'biotechnology', 'life sciences', 'therapeutics',
    'pharmaceuticals', 'pharma', 'drug discovery',
    'bioinformatics', 'genomics',
  ],
  
  // Robotics
  'Robotics': [
    'robotics', 'robots', 'automation', 'industrial automation',
    'autonomous', 'drones', 'iot', 'hardware',
  ],
  
  // SpaceTech
  'SpaceTech': [
    'spacetech', 'space tech', 'space', 'aerospace',
    'satellites', 'launch',
  ],
  
  // Defense
  'Defense': [
    'defense', 'defence', 'defense tech', 'military',
    'government tech', 'govtech',
  ],
  
  // Crypto/Web3
  'Crypto/Web3': [
    'crypto', 'web3', 'blockchain', 'cryptocurrency',
    'defi', 'nfts', 'decentralized', 'crypto/blockchain',
  ],
  
  // Gaming
  'Gaming': [
    'gaming', 'games', 'video games', 'esports',
    'game dev', 'ar/vr', 'vr/ar', 'metaverse',
  ],
  
  // Media
  'Media': [
    'media', 'entertainment', 'content', 'streaming',
    'creator economy', 'digital media', 'publishing',
  ],
  
  // Climate
  'Climate': [
    'climate', 'climate tech', 'carbon', 'environmental',
    'impact', 'social impact', 'sustainability',
  ],
};

/**
 * RELATED SECTORS
 * Sectors that should cross-match (if a startup is AI SaaS, match both AI and SaaS investors)
 * Key = canonical sector, Values = related sectors for cross-matching
 */
const RELATED_SECTORS = {
  // AI companies often match with these
  'AI/ML': ['SaaS', 'Enterprise', 'Data', 'Developer Tools', 'DeepTech'],
  
  // SaaS companies can match with vertical-specific investors
  'SaaS': ['Enterprise', 'AI/ML', 'Developer Tools', 'Data'],
  
  // Enterprise overlaps heavily with SaaS
  'Enterprise': ['SaaS', 'AI/ML', 'Data', 'Cybersecurity'],
  
  // Developer Tools are often SaaS
  'Developer Tools': ['SaaS', 'Infrastructure', 'AI/ML', 'Data'],
  
  // Infrastructure is technical
  'Infrastructure': ['SaaS', 'Developer Tools', 'Cybersecurity', 'Data'],
  
  // Fintech verticals
  'Fintech': ['SaaS', 'AI/ML', 'Data', 'Cybersecurity'],
  
  // HealthTech can be AI or SaaS
  'HealthTech': ['SaaS', 'AI/ML', 'Biotech', 'Data'],
  
  // EdTech is often SaaS
  'EdTech': ['SaaS', 'Consumer', 'AI/ML'],
  
  // E-commerce relates to
  'E-commerce': ['Marketplace', 'Consumer', 'D2C', 'Fintech'],
  
  // Consumer tech
  'Consumer': ['E-commerce', 'D2C', 'Gaming', 'Media'],
  
  // D2C
  'D2C': ['E-commerce', 'Consumer', 'Marketplace'],
  
  // Biotech
  'Biotech': ['HealthTech', 'DeepTech', 'AI/ML'],
  
  // DeepTech
  'DeepTech': ['AI/ML', 'Robotics', 'Biotech', 'Climate'],
  
  // Climate
  'Climate': ['CleanTech', 'DeepTech', 'Infrastructure'],
  
  // CleanTech
  'CleanTech': ['Climate', 'DeepTech', 'Infrastructure'],
};

/**
 * SECTOR GROUPS
 * Higher-level groupings for UI categorization
 */
const SECTOR_GROUPS = {
  'Software': ['SaaS', 'Enterprise', 'Developer Tools', 'Infrastructure', 'AI/ML', 'Data', 'Cybersecurity'],
  'Vertical Tech': ['Fintech', 'HealthTech', 'EdTech', 'PropTech', 'CleanTech', 'AgTech', 'FoodTech'],
  'Consumer': ['Consumer', 'E-commerce', 'D2C', 'Marketplace', 'Gaming', 'Media'],
  'DeepTech': ['DeepTech', 'Biotech', 'Robotics', 'SpaceTech', 'Defense'],
  'Emerging': ['Crypto/Web3', 'Climate'],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize a sector string to lowercase, trimmed
 */
function normSector(s) {
  if (!s) return null;
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get canonical sector name from any variant
 * @param {string} sector - raw sector string
 * @returns {string|null} canonical sector name or original if no match
 */
function getCanonicalSector(sector) {
  if (!sector) return null;
  const norm = normSector(sector);
  
  // Check if it's already canonical
  for (const canonical of CANONICAL_SECTORS) {
    if (normSector(canonical) === norm) return canonical;
  }
  
  // Check synonyms
  for (const [canonical, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
    if (synonyms.some(syn => normSector(syn) === norm)) {
      return canonical;
    }
    // Also check partial match
    if (synonyms.some(syn => norm.includes(normSector(syn)) || normSector(syn).includes(norm))) {
      return canonical;
    }
  }
  
  // Return original with proper casing if no canonical match
  return sector;
}

/**
 * Normalize an array of sectors to their canonical forms
 * @param {string[]} sectors - raw sector array
 * @returns {string[]} canonical sector array (deduplicated)
 */
function normalizeSectors(sectors) {
  if (!Array.isArray(sectors)) return [];
  
  const canonical = new Set();
  for (const s of sectors) {
    const c = getCanonicalSector(s);
    if (c) canonical.add(c);
  }
  
  return Array.from(canonical);
}

/**
 * Get related sectors for cross-matching
 * @param {string[]} sectors - canonical sector array
 * @returns {string[]} expanded sector array including related
 */
function expandRelatedSectors(sectors) {
  if (!Array.isArray(sectors)) return [];
  
  const expanded = new Set(sectors);
  
  for (const sector of sectors) {
    const related = RELATED_SECTORS[sector];
    if (related) {
      for (const r of related) {
        expanded.add(r);
      }
    }
  }
  
  return Array.from(expanded);
}

/**
 * Calculate sector match score with cross-matching support
 * @param {string[]} startupSectors - startup's sectors (will be normalized)
 * @param {string[]} investorSectors - investor's sectors (will be normalized)
 * @param {boolean} allowCrossMatch - whether to expand to related sectors
 * @returns {{ score: number, matches: string[], isRelated: boolean }}
 */
function calculateSectorMatchScore(startupSectors, investorSectors, allowCrossMatch = true) {
  // Normalize both
  const startupNorm = normalizeSectors(startupSectors);
  const investorNorm = normalizeSectors(investorSectors);
  
  if (!startupNorm.length || !investorNorm.length) {
    return { score: 5, matches: [], isRelated: false };
  }
  
  // Direct matches
  const directMatches = startupNorm.filter(s => investorNorm.includes(s));
  
  if (directMatches.length > 0) {
    return {
      score: Math.min(directMatches.length * 15, 40),
      matches: directMatches,
      isRelated: false,
    };
  }
  
  // Try cross-matching if enabled
  if (allowCrossMatch) {
    const startupExpanded = expandRelatedSectors(startupNorm);
    const relatedMatches = startupExpanded.filter(s => investorNorm.includes(s));
    
    if (relatedMatches.length > 0) {
      return {
        score: Math.min(relatedMatches.length * 8, 25), // Lower score for related matches
        matches: relatedMatches,
        isRelated: true,
      };
    }
  }
  
  return { score: 0, matches: [], isRelated: false };
}

/**
 * Check if a startup sector array should match an investor's sectors
 * Returns true for exact OR related matches
 */
function sectorsMatch(startupSectors, investorSectors) {
  const result = calculateSectorMatchScore(startupSectors, investorSectors, true);
  return result.score > 0;
}

/**
 * Get all sectors that an investor should see startups for
 * (their stated sectors + related sectors)
 */
function getExpandedInvestorSectors(investorSectors) {
  return expandRelatedSectors(normalizeSectors(investorSectors));
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Data
  CANONICAL_SECTORS,
  SECTOR_SYNONYMS,
  RELATED_SECTORS,
  SECTOR_GROUPS,
  
  // Functions
  normSector,
  getCanonicalSector,
  normalizeSectors,
  expandRelatedSectors,
  calculateSectorMatchScore,
  sectorsMatch,
  getExpandedInvestorSectors,
};
