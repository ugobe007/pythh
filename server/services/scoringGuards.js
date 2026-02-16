/**
 * SCORING SYSTEM GUARD RAILS
 * 
 * Prevents unauthorized modifications to GOD scoring system
 * Validates all score updates before applying
 * Logs changes with audit trail
 */

const GOD_SCORE_GUARDS = {
  // Minimum and maximum score bounds
  MIN_SCORE: 40,  // Database constraint enforced
  MAX_SCORE: 100,
  
  // Expected score distribution (for anomaly detection)
  EXPECTED_AVG_MIN: 45,
  EXPECTED_AVG_MAX: 65,
  
  // Component score bounds (0-100 scale after normalization)
  COMPONENT_BOUNDS: {
    team_score: { min: 0, max: 100 },
    traction_score: { min: 0, max: 100 },
    market_score: { min: 0, max: 100 },
    product_score: { min: 0, max: 100 },
    vision_score: { min: 0, max: 100 },
  },
  
  // Authorized modifiers
  AUTHORIZED: {
    ADMIN: ['andy@pythh.io', 'admin@pythh.io'],
    ML_AGENT: ['ml-training-service'],
  },
  
  // Alert thresholds
  MASS_CHANGE_THRESHOLD: 100,  // Alert if >100 scores change at once
  SCORE_JUMP_THRESHOLD: 20,    // Alert if score changes >20 pts
};

/**
 * Validate score before update
 */
function validateScore(startup_id, new_score, old_score, modifier) {
  const errors = [];
  
  // 1. Check bounds
  if (new_score < GOD_SCORE_GUARDS.MIN_SCORE) {
    errors.push(`Score ${new_score} below minimum ${GOD_SCORE_GUARDS.MIN_SCORE}`);
  }
  if (new_score > GOD_SCORE_GUARDS.MAX_SCORE) {
    errors.push(`Score ${new_score} above maximum ${GOD_SCORE_GUARDS.MAX_SCORE}`);
  }
  
  // 2. Check for suspicious jumps
  if (old_score && Math.abs(new_score - old_score) > GOD_SCORE_GUARDS.SCORE_JUMP_THRESHOLD) {
    errors.push(`Suspicious score jump: ${old_score} → ${new_score} (Δ${Math.abs(new_score - old_score)})`);
  }
  
  // 3. Check authorization (only for direct modifications, not recalculations)
  if (modifier && !isAuthorized(modifier)) {
    errors.push(`Unauthorized modifier: ${modifier}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: errors.length > 0 ? [`Score update blocked for startup ${startup_id}`] : [],
  };
}

/**
 * Validate component scores
 */
function validateComponents(components) {
  const errors = [];
  
  for (const [component, value] of Object.entries(components)) {
    const bounds = GOD_SCORE_GUARDS.COMPONENT_BOUNDS[component];
    if (!bounds) continue;
    
    if (value < bounds.min || value > bounds.max) {
      errors.push(`${component}: ${value} out of bounds [${bounds.min}, ${bounds.max}]`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if modifier is authorized
 */
function isAuthorized(modifier) {
  return (
    GOD_SCORE_GUARDS.AUTHORIZED.ADMIN.includes(modifier) ||
    GOD_SCORE_GUARDS.AUTHORIZED.ML_AGENT.includes(modifier)
  );
}

/**
 * Log score change to audit trail
 */
async function logScoreChange(supabase, change) {
  const {error} = await supabase
    .from('score_history')
    .insert({
      startup_id: change.startup_id,
      old_score: change.old_score,
      new_score: change.new_score,
      change_reason: change.reason,
      modifier: change.modifier || 'system',
      components: change.components,
      timestamp: new Date().toISOString(),
    });
  
  if (error) {
    console.error('Failed to log score change:', error);
  }
}

/**
 * Detect mass score changes (potential corruption)
 */
async function detectMassChanges(supabase, timeWindow = 60) {
  const since = new Date(Date.now() - timeWindow * 1000).toISOString();
  
  const {data, error} = await supabase
    .from('score_history')
    .select('*')
    .gte('timestamp', since);
  
  if (error || !data) return { alert: false };
  
  if (data.length > GOD_SCORE_GUARDS.MASS_CHANGE_THRESHOLD) {
    return {
      alert: true,
      message: `⚠️ MASS SCORE CHANGE DETECTED: ${data.length} scores changed in last ${timeWindow}s`,
      changes: data.length,
    };
  }
  
  return { alert: false };
}

/**
 * Check score distribution health
 */
async function checkDistributionHealth(supabase) {
  const {data} = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .limit(1000);
  
  if (!data || data.length === 0) {
    return { healthy: false, reason: 'No approved startups found' };
  }
  
  const avg = data.reduce((sum, s) => sum + s.total_god_score, 0) / data.length;
  
  const healthy = (
    avg >= GOD_SCORE_GUARDS.EXPECTED_AVG_MIN &&
    avg <= GOD_SCORE_GUARDS.EXPECTED_AVG_MAX
  );
  
  return {
    healthy,
    average: avg.toFixed(2),
    expected: `${GOD_SCORE_GUARDS.EXPECTED_AVG_MIN}-${GOD_SCORE_GUARDS.EXPECTED_AVG_MAX}`,
    status: healthy ? '✅ Healthy' : '⚠️ Out of range',
  };
}

module.exports = {
  GOD_SCORE_GUARDS,
  validateScore,
  validateComponents,
  isAuthorized,
  logScoreChange,
  detectMassChanges,
  checkDistributionHealth,
};
