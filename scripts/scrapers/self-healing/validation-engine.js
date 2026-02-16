#!/usr/bin/env node
/**
 * VALIDATION ENGINE
 * =================
 * Validates parsed data to ensure quality and completeness.
 * Triggers self-healing if data is invalid.
 */

/**
 * Validate parsed data against expected fields
 */
function validateParsedData(data, expectedFields = {}) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const errors = [];
  const warnings = [];

  // Check required fields
  for (const [fieldName, fieldConfig] of Object.entries(expectedFields)) {
    const required = typeof fieldConfig === 'object' ? fieldConfig.required : false;
    const type = typeof fieldConfig === 'object' ? fieldConfig.type : 'string';
    
    const value = data[fieldName];
    
    // Required field check
    if (required && (value === null || value === undefined || value === '')) {
      errors.push(`Required field '${fieldName}' is missing`);
      continue;
    }
    
    // Type validation
    if (value !== null && value !== undefined) {
      const isValidType = validateType(value, type);
      if (!isValidType) {
        errors.push(`Field '${fieldName}' has invalid type. Expected ${type}, got ${typeof value}`);
      }
    }
  }

  // Data quality checks
  if (data.name) {
    if (data.name.length < 2) {
      warnings.push('Name is too short');
    }
    if (data.name.length > 200) {
      warnings.push('Name is too long');
    }

    const lowerName = data.name.toLowerCase();
    const headlineLikePatterns = [
      /\bceo\b/,
      /\bchief\b/,
      /\bfounder\b/,
      /\bco-founder\b/,
      /\bcofounder\b/,
      /\bchairman\b/,
      /\bpresident\b/,
      /\bvp\b/,
      /\bminister\b/,
      /\bgov\.?\b/,
      /\bsecretary\b/,
      /\bboard\b/,
      /\bexecutive\b/,
      /\bpartner at\b/,
      /\bfrom\b .*\bventures\b/,
      /\bwarns\b/,
      /\bsays\b/,
      /\bsaid\b/,
      /\bour take\b/,
      /\binterview\b/,
      /\bprofile\b/,
      /\bq&a\b/,
      /\bwhat we learned\b/,
      /\b5 things\b/,
      /\bhow to\b/,
      /\bwhy we\b/,
      /\bexplains\b/,
      /\bcomments on\b/,
      /\bwe spoke with\b/,
      /\bin conversation with\b/,
      /\binterview with\b/,
      /\bjoins us\b/,
      /\ba conversation with\b/,
      /\broundtable\b/,
      /\bpanel\b/, 
    ];

    const looksLikeHeadlineSubject =
      /\b\w+'s\b/.test(data.name) || // possessive: "Nvidia's Huang"
      /\bmr\.?\b|\bms\.?\b|\bmrs\.?\b|\bdr\.?\b/.test(lowerName) ||
      headlineLikePatterns.some((re) => re.test(lowerName));

    if (looksLikeHeadlineSubject) {
      warnings.push('Name looks like a person or article headline, not a startup');
    }
  }

  if (data.description) {
    if (data.description.length < 10) {
      warnings.push('Description is too short');
    }
  }

  if (data.funding && typeof data.funding === 'number') {
    if (data.funding < 0) {
      errors.push('Funding amount cannot be negative');
    }
    if (data.funding > 1e12) {
      warnings.push('Funding amount seems unrealistic');
    }
  }

  if (data.url && typeof data.url === 'string') {
    if (!isValidURL(data.url)) {
      errors.push('URL format is invalid');
    }
  }

  // Return validation result
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: calculateQualityScore(data, expectedFields, errors, warnings)
  };
}

/**
 * Type validation helper
 */
function validateType(value, expectedType) {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
    case 'currency':
      return typeof value === 'number';
    case 'date':
      return value instanceof Date || !isNaN(Date.parse(value));
    case 'url':
      return typeof value === 'string' && isValidURL(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && !Array.isArray(value);
    default:
      return true; // Unknown type, accept it
  }
}

/**
 * URL validation
 */
function isValidURL(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Calculate data quality score (0-100)
 */
function calculateQualityScore(data, expectedFields, errors, warnings) {
  let score = 100;
  
  // Penalize errors
  score -= errors.length * 20;
  
  // Penalize warnings
  score -= warnings.length * 5;
  
  // Check completeness
  const totalFields = Object.keys(expectedFields).length;
  const filledFields = Object.keys(data).filter(key => {
    const value = data[key];
    return value !== null && value !== undefined && value !== '';
  }).length;
  
  const completeness = (filledFields / totalFields) * 100;
  score = (score * 0.5) + (completeness * 0.5); // 50% error penalty, 50% completeness
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Check if data quality is acceptable
 */
function isDataQualityAcceptable(validationResult, minScore = 60) {
  return validationResult.valid && validationResult.score >= minScore;
}

module.exports = {
  validateParsedData,
  validateType,
  isValidURL,
  calculateQualityScore,
  isDataQualityAcceptable
};

