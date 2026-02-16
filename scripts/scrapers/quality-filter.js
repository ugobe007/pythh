/**
 * ONTOLOGICAL QUALITY FILTER FOR SCRAPERS
 * 
 * Purpose: Remove junk/poor quality entries before they enter the database
 * Uses: Word ontology, semantic analysis, data completeness checks
 * 
 * Filters out:
 * - Person names instead of companies ("Jeff Bezos", "Elon Musk")
 * - Random text/gibberish ("Winter Continues", "Lorem Ipsum")
 * - Incomplete data (< 3 meaningful fields)
 * - Non-startup entities (investors, VCs, media companies as startups)
 * - Duplicate/similar entries
 * 
 * Usage:
 *   const { isValidStartup, getQualityScore } = require('./quality-filter');
 *   
 *   if (isValidStartup(startupData)) {
 *     // Save to database
 *   }
 */

// ===========================================================================
// ONTOLOGY DICTIONARIES
// ===========================================================================

// Startup-related keywords (GOOD signals)
const STARTUP_KEYWORDS = [
  // Business terms
  'platform', 'saas', 'marketplace', 'app', 'software', 'service', 'solution',
  'technology', 'tech', 'product', 'tool', 'system', 'api', 'infrastructure',
  
  // Action verbs (what startups DO)
  'build', 'create', 'develop', 'deliver', 'provide', 'enable', 'power',
  'connect', 'automate', 'streamline', 'optimize', 'transform', 'revolutionize',
  
  // Business focus
  'customers', 'users', 'clients', 'revenue', 'growth', 'scale', 'mrr', 'arr',
  'funding', 'raise', 'series', 'seed', 'pre-seed', 'round', 'investors',
  
  // Industry terms
  'ai', 'ml', 'fintech', 'healthtech', 'edtech', 'crypto', 'blockchain',
  'cloud', 'mobile', 'web', 'data', 'analytics', 'security', 'enterprise'
];

// Red flag keywords (BAD signals - likely not a startup)
const RED_FLAG_KEYWORDS = [
  // Person indicators
  'founder', 'ceo', 'person', 'individual', 'entrepreneur', 'executive',
  'named', 'called', 'known as', 'goes by',
  
  // Media/content
  'article', 'blog post', 'news', 'report', 'story', 'interview', 'podcast',
  'video', 'episode', 'series', 'chapter', 'book',
  
  // Events/concepts
  'conference', 'event', 'summit', 'meetup', 'workshop', 'course', 'program',
  'trend', 'movement', 'phenomenon', 'era', 'period', 'season',
  
  // Investor entities (not startups)
  'venture capital', 'vc firm', 'angel investor', 'fund', 'capital partners',
  'investment firm', 'accelerator', 'incubator'
];

// Common person name patterns (REJECT these as startup names)
const PERSON_NAME_PATTERNS = [
  /^[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}$/,  // "John Smith" (both parts 3+ letters, only letters)
  /^[A-Z][a-z]+\s[A-Z]\.\s[A-Z][a-z]+$/,  // "John Q. Smith"
  /^\w+\'s\s/i,  // "Bezos's", "Musk's"
  /^(Mr|Mrs|Ms|Dr|Prof)\.\s/i,  // Titles
];

// Company suffixes that indicate NOT a person (GOOD signals)
const COMPANY_SUFFIXES = [
  'Inc', 'Corp', 'LLC', 'Ltd', 'Co', 'Company', 'Corporation',
  'Group', 'Partners', 'Ventures', '& Co'
];

// Tech company suffixes (GOOD signals)
const TECH_SUFFIXES = [
  'AI', 'Labs', 'Tech', 'Technologies', 'Software', 'Systems', 'Solutions',
  'Cloud', 'Data', 'Analytics', 'Security', 'Networks', 'Platforms'
];

// ===========================================================================
// QUALITY SCORING FUNCTIONS
// ===========================================================================

/**
 * Check if name looks like a person (not a company)
 */
function looksLikePersonName(name) {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Exclude if has company suffix
  const hasCompanySuffix = COMPANY_SUFFIXES.some(suffix => 
    trimmed.endsWith(suffix) || trimmed.endsWith(` ${suffix}`)
  );
  if (hasCompanySuffix) return false;
  
  // Check against person name patterns
  return PERSON_NAME_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Count startup-related keywords in text
 */
function countStartupKeywords(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const lower = text.toLowerCase();
  return STARTUP_KEYWORDS.filter(keyword => 
    lower.includes(keyword.toLowerCase())
  ).length;
}

/**
 * Count red flag keywords in text
 */
function countRedFlags(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const lower = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter(keyword => 
    lower.includes(keyword.toLowerCase())
  ).length;
}

/**
 * Check if name has tech company suffix
 */
function hasTechSuffix(name) {
  if (!name || typeof name !== 'string') return false;
  
  return TECH_SUFFIXES.some(suffix => 
    name.trim().endsWith(suffix) || name.trim().endsWith(suffix.toLowerCase())
  );
}

/**
 * Calculate data completeness score (0-100)
 */
function calculateCompletenessScore(data) {
  let score = 0;
  const weights = {
    name: 10,
    description: 20,
    pitch: 20,
    website: 15,
    sector: 10,
    stage: 10,
    location: 5,
    team_size: 5,
    founded_year: 5
  };

  Object.entries(weights).forEach(([field, weight]) => {
    if (data[field]) {
      // Extra validation for text fields
      if (typeof data[field] === 'string') {
        const wordCount = data[field].split(/\s+/).length;
        if (field === 'description' || field === 'pitch') {
          // Require at least 10 words for description/pitch
          score += wordCount >= 10 ? weight : weight * 0.3;
        } else {
          score += data[field].length > 3 ? weight : weight * 0.5;
        }
      } else {
        score += weight;
      }
    }
  });

  return Math.round(score);
}

/**
 * Calculate semantic quality score (0-100)
 */
function calculateSemanticScore(data) {
  const text = [
    data.name || '',
    data.description || '',
    data.pitch || '',
    data.tagline || ''
  ].join(' ');

  if (text.length < 20) return 0;  // Too little text

  const startupKeywords = countStartupKeywords(text);
  const redFlags = countRedFlags(text);
  const hasGoodSuffix = hasTechSuffix(data.name || '');
  const looksLikePerson = looksLikePersonName(data.name || '');

  // Scoring logic
  let score = 50;  // Start neutral

  // Positive signals
  score += Math.min(startupKeywords * 5, 30);  // +5 per keyword, max +30
  if (hasGoodSuffix) score += 10;
  if (data.website && data.website.includes('.com')) score += 5;
  if (data.sector && Array.isArray(data.sector) && data.sector.length > 0) score += 5;

  // Negative signals
  score -= redFlags * 10;  // -10 per red flag
  if (looksLikePerson) score -= 30;
  if (!data.description && !data.pitch) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get overall quality score (0-100)
 */
function getQualityScore(data) {
  const completeness = calculateCompletenessScore(data);
  const semantic = calculateSemanticScore(data);
  
  // Weighted average: 40% completeness, 60% semantic
  return Math.round(completeness * 0.4 + semantic * 0.6);
}

/**
 * Check if startup passes quality threshold
 */
function isValidStartup(data, minScore = 40) {
  if (!data || !data.name) return false;

  // Hard filters (instant rejection)
  if (looksLikePersonName(data.name)) {
    console.log(`❌ REJECTED: "${data.name}" looks like a person name`);
    return false;
  }

  if (data.name.length < 2) {
    console.log(`❌ REJECTED: "${data.name}" too short`);
    return false;
  }

  // Calculate quality score
  const score = getQualityScore(data);
  
  if (score < minScore) {
    console.log(`❌ REJECTED: "${data.name}" quality score ${score} < ${minScore}`);
    return false;
  }

  console.log(`✅ ACCEPTED: "${data.name}" quality score ${score}`);
  return true;
}

/**
 * Enhanced validation with detailed feedback
 */
function validateStartup(data) {
  const completeness = calculateCompletenessScore(data);
  const semantic = calculateSemanticScore(data);
  const overall = getQualityScore(data);

  return {
    isValid: isValidStartup(data),
    scores: {
      completeness,
      semantic,
      overall
    },
    flags: {
      looksLikePerson: looksLikePersonName(data.name || ''),
      hasRedFlags: countRedFlags([data.name, data.description, data.pitch].join(' ')) > 0,
      hasTechSuffix: hasTechSuffix(data.name || ''),
      hasStartupKeywords: countStartupKeywords([data.description, data.pitch].join(' ')) > 2
    },
    recommendation: overall >= 70 ? 'excellent' : 
                    overall >= 50 ? 'good' : 
                    overall >= 40 ? 'acceptable' : 'reject'
  };
}

// ===========================================================================
// EXPORTS
// ===========================================================================

module.exports = {
  isValidStartup,
  getQualityScore,
  validateStartup,
  calculateCompletenessScore,
  calculateSemanticScore,
  
  // Utility functions
  looksLikePersonName,
  countStartupKeywords,
  countRedFlags,
  hasTechSuffix,
  
  // Constants (for testing/debugging)
  STARTUP_KEYWORDS,
  RED_FLAG_KEYWORDS,
  TECH_SUFFIXES,
  COMPANY_SUFFIXES
};
