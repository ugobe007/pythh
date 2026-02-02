/**
 * Signal Gap Service
 * 
 * The Missing Primitive: Computes diffs between VC expectations and observed evidence.
 * This is NOT advice. This is pure math.
 * 
 * Core logic:
 *   expected_profile_for_lens - observed_profile_for_startup = delta
 *   Largest negative delta = primary blocker
 */

const { getSupabaseClient } = require('./supabaseClient');

// ============================================================================
// FACTOR MAPPING: How component scores map to blocking factors
// ============================================================================

/**
 * Maps startup component scores to blocking factor scores (0-1 normalized)
 * 
 * We derive blocking factors from existing GOD component scores:
 *   - market_score → category_clarity, market_timing
 *   - team_score → talent_signal, founder_market_fit
 *   - traction_score → momentum, traction_proof
 *   - product_score → technical_moat
 *   - vision_score → inevitability, network_effects (future potential)
 */
function deriveBlockingFactors(startup) {
  // Normalize scores to 0-1 (GOD scores are 0-100)
  const norm = (score) => Math.min(1, Math.max(0, (score || 0) / 100));
  
  const market = norm(startup.market_score);
  const team = norm(startup.team_score);
  const traction = norm(startup.traction_score);
  const product = norm(startup.product_score);
  const vision = norm(startup.vision_score);
  
  // Derive blocking factors from component combinations
  return {
    category_clarity: market * 0.6 + vision * 0.4,  // Market positioning + clarity of vision
    momentum: traction * 0.7 + product * 0.3,        // Growth signals + shipping velocity
    talent_signal: team * 0.8 + product * 0.2,       // Team quality + technical execution
    market_timing: market * 0.5 + traction * 0.5,    // Market readiness + proof of timing
    technical_moat: product * 0.7 + team * 0.3,      // Product depth + team capability
    traction_proof: traction * 0.9 + market * 0.1,   // Pure traction evidence
    network_effects: vision * 0.5 + traction * 0.3 + market * 0.2,  // Future potential
    founder_market_fit: team * 0.6 + market * 0.4,   // Founder credibility for market
    inevitability: vision * 0.5 + traction * 0.3 + market * 0.2  // Sense of inevitable success
  };
}

// ============================================================================
// SEVERITY CLASSIFICATION
// ============================================================================

/**
 * Classify gap severity based on delta and weight
 */
function classifySeverity(delta, weight) {
  const weightedDelta = delta * weight;
  
  if (weightedDelta >= 0.35) return 'critical';
  if (weightedDelta >= 0.20) return 'material';
  return 'minor';
}

/**
 * Calculate confidence based on data quality
 * Higher when we have more component scores populated
 */
function calculateConfidence(startup, factor) {
  const scores = [
    startup.market_score,
    startup.team_score,
    startup.traction_score,
    startup.product_score,
    startup.vision_score
  ].filter(s => s !== null && s !== undefined && s > 0);
  
  // Base confidence from data completeness (0.4-0.9)
  const dataCompleteness = scores.length / 5;
  return Math.round((0.4 + dataCompleteness * 0.5) * 100) / 100;
}

// ============================================================================
// CORE GAP COMPUTATION
// ============================================================================

/**
 * Compute signal gaps for a single startup across all lenses
 * 
 * @param {string} startupId - Startup UUID
 * @returns {Array} Computed gaps (not yet persisted)
 */
async function computeGapsForStartup(startupId) {
  const supabase = getSupabaseClient();
  
  // 1. Fetch startup with component scores
  const { data: startup, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, market_score, team_score, traction_score, product_score, vision_score')
    .eq('id', startupId)
    .single();
  
  if (startupError || !startup) {
    console.error('[signalGapService] Startup not found:', startupId);
    return [];
  }
  
  // 2. Fetch all lens expected profiles
  const { data: profiles, error: profileError } = await supabase
    .from('lens_expected_profiles')
    .select('lens, blocking_factor, expected_score, weight');
  
  if (profileError || !profiles || profiles.length === 0) {
    console.error('[signalGapService] No lens profiles found');
    return [];
  }
  
  // 3. Derive observed scores from startup
  const observed = deriveBlockingFactors(startup);
  
  // 4. Group profiles by lens
  const lensProfiles = {};
  for (const p of profiles) {
    if (!lensProfiles[p.lens]) lensProfiles[p.lens] = [];
    lensProfiles[p.lens].push(p);
  }
  
  // 5. Compute gaps per lens
  const gaps = [];
  
  for (const [lens, factors] of Object.entries(lensProfiles)) {
    // Calculate deltas for each factor
    const factorDeltas = factors.map(f => {
      const observedScore = observed[f.blocking_factor] || 0;
      const delta = f.expected_score - observedScore;
      const severity = classifySeverity(delta, f.weight);
      const confidence = calculateConfidence(startup, f.blocking_factor);
      
      return {
        startup_id: startupId,
        lens,
        blocking_factor: f.blocking_factor,
        expected_score: f.expected_score,
        observed_score: Math.round(observedScore * 100) / 100,
        confidence,
        severity,
        weight: f.weight,
        weighted_delta: delta * f.weight
      };
    });
    
    // Only include gaps where delta > 0.1 (meaningful difference)
    const meaningfulGaps = factorDeltas.filter(d => 
      d.expected_score - d.observed_score > 0.1
    );
    
    gaps.push(...meaningfulGaps);
  }
  
  return gaps;
}

/**
 * Get the primary blocker for a startup under a specific lens
 * 
 * @param {string} startupId
 * @param {string} lens - 'sequoia' | 'yc' | 'a16z' | etc
 * @returns {Object|null} Primary gap or null
 */
async function getPrimaryBlocker(startupId, lens) {
  const gaps = await computeGapsForStartup(startupId);
  
  // Filter to requested lens, sort by weighted delta (descending)
  const lensGaps = gaps
    .filter(g => g.lens === lens)
    .sort((a, b) => b.weighted_delta - a.weighted_delta);
  
  return lensGaps[0] || null;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Persist computed gaps to database (upsert)
 * Also auto-resolves gaps that are no longer blocking
 */
async function persistGaps(startupId, computedGaps) {
  const supabase = getSupabaseClient();
  
  // 1. Get existing active gaps for this startup
  const { data: existingGaps } = await supabase
    .from('signal_gaps')
    .select('id, lens, blocking_factor, expected_score, observed_score')
    .eq('startup_id', startupId)
    .is('resolved_at', null);
  
  const existingMap = new Map(
    (existingGaps || []).map(g => [`${g.lens}:${g.blocking_factor}`, g])
  );
  
  const toUpsert = [];
  const toResolve = [];
  
  // 2. Process computed gaps
  for (const gap of computedGaps) {
    const key = `${gap.lens}:${gap.blocking_factor}`;
    const existing = existingMap.get(key);
    
    if (existing) {
      // Update existing gap
      toUpsert.push({
        id: existing.id,
        startup_id: startupId,
        lens: gap.lens,
        blocking_factor: gap.blocking_factor,
        expected_score: gap.expected_score,
        observed_score: gap.observed_score,
        confidence: gap.confidence,
        severity: gap.severity,
        last_updated_at: new Date().toISOString()
      });
      existingMap.delete(key);
    } else {
      // New gap
      toUpsert.push({
        startup_id: startupId,
        lens: gap.lens,
        blocking_factor: gap.blocking_factor,
        expected_score: gap.expected_score,
        observed_score: gap.observed_score,
        confidence: gap.confidence,
        severity: gap.severity,
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      });
    }
  }
  
  // 3. Remaining in existingMap are gaps that are now resolved
  for (const [key, gap] of existingMap) {
    toResolve.push(gap.id);
  }
  
  // 4. Upsert new/updated gaps
  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('signal_gaps')
      .upsert(toUpsert, { onConflict: 'startup_id,lens,blocking_factor' });
    
    if (upsertError) {
      console.error('[signalGapService] Upsert error:', upsertError);
    }
  }
  
  // 5. Resolve gaps that are no longer blocking
  if (toResolve.length > 0) {
    const { error: resolveError } = await supabase
      .from('signal_gaps')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_type: 'score_improved'
      })
      .in('id', toResolve);
    
    if (resolveError) {
      console.error('[signalGapService] Resolve error:', resolveError);
    }
    
    // Also resolve any founder acknowledgments
    await supabase
      .from('founder_gap_acknowledgments')
      .update({ resolved_at: new Date().toISOString() })
      .in('signal_gap_id', toResolve)
      .is('resolved_at', null);
  }
  
  return {
    upserted: toUpsert.length,
    resolved: toResolve.length
  };
}

/**
 * Refresh gaps for a startup (compute + persist)
 */
async function refreshGaps(startupId) {
  const gaps = await computeGapsForStartup(startupId);
  return await persistGaps(startupId, gaps);
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

// Severity ordering (higher = more severe)
const SEVERITY_ORDER = { critical: 3, material: 2, minor: 1 };

/**
 * Get active gaps for a startup
 */
async function getActiveGaps(startupId, lens = null) {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('signal_gaps')
    .select('*')
    .eq('startup_id', startupId)
    .is('resolved_at', null);
  
  if (lens) {
    query = query.eq('lens', lens);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[signalGapService] getActiveGaps error:', error);
    return [];
  }
  
  // Sort by severity (critical > material > minor), then by delta
  const sorted = (data || []).sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    // Same severity: sort by delta (larger gap first)
    return (b.expected_score - b.observed_score) - (a.expected_score - a.observed_score);
  });
  
  return sorted;
}

/**
 * Get evidence levers for a blocking factor
 */
async function getLeversForFactor(blockingFactor) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('evidence_levers')
    .select('*')
    .eq('blocking_factor', blockingFactor)
    .order('typical_lag_days', { ascending: true });
  
  if (error) {
    console.error('[signalGapService] getLeversForFactor error:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Acknowledge a gap (minimal founder action)
 */
async function acknowledgeGap(startupId, signalGapId, selectedLeverId = null) {
  const supabase = getSupabaseClient();
  
  // Get the gap to determine expected resolution window
  const { data: gap } = await supabase
    .from('signal_gaps')
    .select('blocking_factor')
    .eq('id', signalGapId)
    .single();
  
  // Get typical lag for selected lever or default
  let expectedWindow = 14;
  if (selectedLeverId) {
    const { data: lever } = await supabase
      .from('evidence_levers')
      .select('typical_lag_days')
      .eq('id', selectedLeverId)
      .single();
    
    if (lever) {
      expectedWindow = lever.typical_lag_days;
    }
  }
  
  const { data, error } = await supabase
    .from('founder_gap_acknowledgments')
    .upsert({
      startup_id: startupId,
      signal_gap_id: signalGapId,
      selected_lever_id: selectedLeverId,
      acknowledged_at: new Date().toISOString(),
      expected_resolution_window: expectedWindow
    }, { onConflict: 'startup_id,signal_gap_id' })
    .select()
    .single();
  
  if (error) {
    console.error('[signalGapService] acknowledgeGap error:', error);
    return null;
  }
  
  return data;
}

/**
 * Get gap summary for display (formatted for UI)
 */
async function getGapSummary(startupId, lens) {
  const gaps = await getActiveGaps(startupId, lens);
  
  if (gaps.length === 0) {
    return {
      status: 'clear',
      message: 'No blocking signals detected under this lens.',
      gaps: []
    };
  }
  
  const primaryGap = gaps[0];
  const levers = await getLeversForFactor(primaryGap.blocking_factor);
  
  // Human-readable factor labels
  const FACTOR_LABELS = {
    category_clarity: 'Category clarity',
    momentum: 'Momentum',
    talent_signal: 'Talent signal',
    market_timing: 'Market timing',
    technical_moat: 'Technical moat',
    traction_proof: 'Traction proof',
    network_effects: 'Network effects',
    founder_market_fit: 'Founder-market fit',
    inevitability: 'Inevitability'
  };
  
  // Lens-specific interpretation
  const LENS_INTERPRETATIONS = {
    sequoia: {
      category_clarity: 'This lens historically does not move without narrative convergence.',
      momentum: 'Sequoia tracks velocity indicators over extended periods.',
      inevitability: 'The "why now" story needs stronger market pull evidence.'
    },
    yc: {
      momentum: 'YC prioritizes shipping velocity over polished positioning.',
      founder_market_fit: 'Founder credibility for this specific problem is key.',
      traction_proof: 'Usage metrics speak louder than projections.'
    },
    a16z: {
      technical_moat: 'a16z looks for defensible technical advantages.',
      network_effects: 'Platform dynamics and ecosystem potential matter here.',
      category_clarity: 'Category leadership requires clear positioning.'
    }
  };
  
  const interpretation = LENS_INTERPRETATIONS[lens]?.[primaryGap.blocking_factor] || 
    `This factor is below ${lens} expectations.`;
  
  return {
    status: primaryGap.severity,
    primary_blocker: {
      factor: primaryGap.blocking_factor,
      label: FACTOR_LABELS[primaryGap.blocking_factor] || primaryGap.blocking_factor,
      confidence: primaryGap.confidence >= 0.7 ? 'High' : primaryGap.confidence >= 0.5 ? 'Medium' : 'Low',
      expected: primaryGap.expected_score,
      observed: primaryGap.observed_score,
      delta: Math.round((primaryGap.expected_score - primaryGap.observed_score) * 100) / 100
    },
    interpretation,
    levers: levers.slice(0, 3).map(l => ({
      id: l.id,
      type: l.lever_type,
      description: l.description,
      expected_signal: l.expected_signal,
      lag_days: l.typical_lag_days
    })),
    gaps: gaps.map(g => ({
      id: g.id,
      factor: g.blocking_factor,
      label: FACTOR_LABELS[g.blocking_factor] || g.blocking_factor,
      severity: g.severity,
      delta: Math.round((g.expected_score - g.observed_score) * 100) / 100
    }))
  };
}

// ============================================================================
// BATCH OPERATIONS (for score recalculation hooks)
// ============================================================================

/**
 * Refresh gaps for all approved startups (call after score recalculation)
 */
async function refreshAllGaps(limit = 100) {
  const supabase = getSupabaseClient();
  
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  
  if (error || !startups) {
    console.error('[signalGapService] refreshAllGaps error:', error);
    return { processed: 0, errors: 1 };
  }
  
  let totalUpserted = 0;
  let totalResolved = 0;
  
  for (const startup of startups) {
    try {
      const result = await refreshGaps(startup.id);
      totalUpserted += result.upserted;
      totalResolved += result.resolved;
    } catch (err) {
      console.error(`[signalGapService] Error refreshing ${startup.id}:`, err);
    }
  }
  
  return {
    processed: startups.length,
    upserted: totalUpserted,
    resolved: totalResolved
  };
}

module.exports = {
  computeGapsForStartup,
  getPrimaryBlocker,
  persistGaps,
  refreshGaps,
  getActiveGaps,
  getLeversForFactor,
  acknowledgeGap,
  getGapSummary,
  refreshAllGaps,
  deriveBlockingFactors
};
