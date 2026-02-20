/**
 * Data Completeness Service
 * 
 * Calculates how complete a startup's profile is (0-100%)
 * and identifies missing fields that would improve their GOD score.
 */

const CRITICAL_FIELDS = [
  { field: 'description', weight: 15, label: 'Company Description' },
  { field: 'pitch', weight: 10, label: 'Elevator Pitch' },
  { field: 'problem', weight: 10, label: 'Problem Statement' },
  { field: 'solution', weight: 10, label: 'Solution' },
  { field: 'team', weight: 10, label: 'Team Info' },
];

const HIGH_VALUE_FIELDS = [
  { field: 'founders', weight: 8, label: 'Founder Details', path: 'extracted_data.founders' },
  { field: 'funding_amount', weight: 7, label: 'Funding Raised', path: 'extracted_data.funding_amount' },
  { field: 'customer_count', weight: 7, label: 'Customer Count' },
  { field: 'mrr', weight: 7, label: 'Monthly Revenue (MRR)' },
  { field: 'arr', weight: 6, label: 'Annual Revenue (ARR)' },
  { field: 'growth_rate_monthly', weight: 6, label: 'Growth Rate' },
  { field: 'team_size', weight: 5, label: 'Team Size' },
];

const NICE_TO_HAVE_FIELDS = [
  { field: 'has_demo', weight: 3, label: 'Product Demo Link', path: 'extracted_data.has_demo' },
  { field: 'is_launched', weight: 3, label: 'Launch Status', path: 'extracted_data.is_launched' },
  { field: 'has_technical_cofounder', weight: 2, label: 'Technical Co-founder', path: 'extracted_data.has_technical_cofounder' },
  { field: 'valuation', weight: 2, label: 'Valuation', path: 'extracted_data.valuation' },
];

const ALL_FIELDS = [...CRITICAL_FIELDS, ...HIGH_VALUE_FIELDS, ...NICE_TO_HAVE_FIELDS];
const MAX_SCORE = ALL_FIELDS.reduce((sum, f) => sum + f.weight, 0);

/**
 * Get value from nested path (e.g., 'extracted_data.founders')
 */
function getNestedValue(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

/**
 * Check if a field has meaningful data
 */
function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 3;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

/**
 * Calculate data completeness score (0-100) and identify missing fields
 */
function calculateCompleteness(startup) {
  const present = [];
  const missing = [];
  let earnedScore = 0;

  for (const fieldDef of ALL_FIELDS) {
    const path = fieldDef.path || fieldDef.field;
    const value = path.includes('.') ? getNestedValue(startup, path) : startup[fieldDef.field];
    
    if (hasValue(value)) {
      earnedScore += fieldDef.weight;
      present.push({
        field: fieldDef.field,
        label: fieldDef.label,
        weight: fieldDef.weight
      });
    } else {
      missing.push({
        field: fieldDef.field,
        label: fieldDef.label,
        weight: fieldDef.weight,
        path: path
      });
    }
  }

  const percentage = Math.round((earnedScore / MAX_SCORE) * 100);

  // Sort missing by weight (highest impact first)
  missing.sort((a, b) => b.weight - a.weight);

  return {
    percentage,
    earnedScore,
    maxScore: MAX_SCORE,
    present,
    missing,
    tier: getTier(percentage),
    projectedImprovement: estimateScoreImprovement(missing.slice(0, 5)) // Top 5 missing fields
  };
}

/**
 * Get data quality tier
 */
function getTier(percentage) {
  if (percentage >= 80) return 'excellent';
  if (percentage >= 60) return 'good';
  if (percentage >= 40) return 'fair';
  return 'sparse';
}

/**
 * Estimate how much the GOD score would improve if missing fields were filled
 */
function estimateScoreImprovement(topMissingFields) {
  // Critical fields have highest impact on GOD score
  let estimatedIncrease = 0;

  for (const field of topMissingFields) {
    if (CRITICAL_FIELDS.find(f => f.field === field.field)) {
      estimatedIncrease += 3; // 3-5 points per critical field
    } else if (HIGH_VALUE_FIELDS.find(f => f.field === field.field)) {
      estimatedIncrease += 2; // 2-3 points per high value field
    } else {
      estimatedIncrease += 1; // 1-2 points per nice-to-have
    }
  }

  return Math.min(estimatedIncrease, 20); // Cap at +20 points
}

/**
 * Generate human-readable completeness message
 */
function getCompletenessMessage(completeness) {
  const { percentage, missing, projectedImprovement } = completeness;

  if (percentage >= 80) {
    return {
      title: 'Profile Complete',
      message: 'Your startup profile is robust. Keep it updated for the best matches.',
      emoji: '✅',
      priority: 'low'
    };
  }

  if (percentage >= 60) {
    return {
      title: 'Almost There',
      message: `Add ${missing.length} more details to unlock premium matches. Est. score increase: +${projectedImprovement} points`,
      emoji: '📈',
      priority: 'medium'
    };
  }

  if (percentage >= 40) {
    return {
      title: 'Low Data',
      message: `We found limited data about your startup. Complete your profile to improve your score by ~${projectedImprovement} points.`,
      emoji: '⚠️',
      priority: 'high'
    };
  }

  return {
    title: 'Incomplete Profile',
    message: `Help us give you better matches by completing your profile. Est. score increase: +${projectedImprovement} points`,
    emoji: '🚀',
    priority: 'critical'
  };
}

module.exports = {
  calculateCompleteness,
  getCompletenessMessage,
  CRITICAL_FIELDS,
  HIGH_VALUE_FIELDS,
  NICE_TO_HAVE_FIELDS
};
