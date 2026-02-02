/**
 * Pythh Canonical Delta Service v1.0.0
 * 
 * Event-sourced, evidence-weighted, time-decayed scoring system.
 * Every point in the score is attributable to feature contributions (auditable).
 * Every lift can be "provisional" until verified (via verification multiplier).
 * Time decay is explicit (freshness), so scores don't stay inflated forever.
 */

const { getSupabaseClient } = require('./supabaseClient');

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const VERIFICATION_TIERS = {
  unverified: 'unverified',
  soft_verified: 'soft_verified',
  verified: 'verified',
  trusted: 'trusted'
};

const BLOCKER_IDS = {
  IDENTITY_NOT_VERIFIED: 'identity_not_verified',
  EVIDENCE_INSUFFICIENT: 'evidence_insufficient',
  RECENCY_GAP: 'recency_gap',
  INCONSISTENCY_DETECTED: 'inconsistency_detected',
  MISSING_REQUIRED_CONNECTORS: 'missing_required_connectors'
};

const FEATURE_IDS = {
  TRACTION: 'traction',
  FOUNDER_VELOCITY: 'founder_velocity',
  INVESTOR_INTENT: 'investor_intent',
  MARKET_BELIEF_SHIFT: 'market_belief_shift',
  CAPITAL_CONVERGENCE: 'capital_convergence',
  TEAM_STRENGTH: 'team_strength',
  PRODUCT_QUALITY: 'product_quality',
  MARKET_SIZE: 'market_size'
};

// Feature categories for action events
const ACTION_FEATURE_MAP = {
  revenue: ['traction', 'investor_intent'],
  product: ['founder_velocity', 'product_quality'],
  hiring: ['team_strength', 'founder_velocity'],
  funding: ['investor_intent', 'capital_convergence'],
  partnership: ['market_belief_shift', 'traction'],
  press: ['market_belief_shift', 'capital_convergence'],
  milestone: ['founder_velocity', 'traction'],
  other: ['founder_velocity']
};

// Identity features for verification checks
const IDENTITY_FEATURES = ['founder_velocity', 'traction'];

// ============================================================================
// HELPERS
// ============================================================================

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const toDays = (ms) => ms / (1000 * 60 * 60 * 24);

/**
 * Exponential time decay: fresh = 0.5 at halfLifeDays
 */
function computeFreshness(updatedAtISO, asOfISO, halfLifeDays) {
  const updatedAt = new Date(updatedAtISO).getTime();
  const asOf = new Date(asOfISO).getTime();
  const ageDays = Math.max(0, toDays(asOf - updatedAt));
  const lambda = Math.log(2) / Math.max(1e-6, halfLifeDays);
  return clamp01(Math.exp(-lambda * ageDays));
}

/**
 * Compute feature contribution: weight * norm * confidence * verification * freshness
 */
function computeContribution(feature) {
  const weight = feature.weight || 1.0;
  const norm = clamp01(feature.norm || 0);
  const confidence = clamp01(feature.confidence || 0.5);
  const verification = clamp01(feature.verification || 0.2);
  const freshness = clamp01(feature.freshness || 1.0);
  
  const contribution = weight * norm * confidence * verification * freshness;
  
  return { weight, norm, confidence, verification, freshness, contribution };
}

/**
 * Get verification multiplier from tier
 */
function getVerificationMultiplier(tier, config) {
  const multipliers = config.verification_multipliers || {
    unverified: 0.20,
    soft_verified: 0.45,
    verified: 0.85,
    trusted: 1.0
  };
  return multipliers[tier] || multipliers.unverified;
}

// ============================================================================
// CORE DELTA COMPUTATION
// ============================================================================

/**
 * Compute delta between two score snapshots
 * Returns decomposed contributions, top movers, and blocking factors
 */
function computeSignalDelta(prev, next, config) {
  const prevFeatures = prev?.features || {};
  const nextFeatures = next?.features || {};
  
  const featureIds = new Set([
    ...Object.keys(prevFeatures),
    ...Object.keys(nextFeatures)
  ]);
  
  const contributions = [];
  
  for (const id of featureIds) {
    const p = prevFeatures[id];
    const n = nextFeatures[id];
    
    const prevParts = p 
      ? computeContribution(p)
      : { weight: 0, norm: 0, confidence: 0, verification: 0, freshness: 0, contribution: 0 };
    
    const nextParts = n
      ? computeContribution(n)
      : { weight: 0, norm: 0, confidence: 0, verification: 0, freshness: 0, contribution: 0 };
    
    const delta = nextParts.contribution - prevParts.contribution;
    
    // Determine reasons for change
    const reasons = [];
    if (!p && n) reasons.push('new_feature_added');
    if (p && !n) reasons.push('feature_removed');
    if (p && n) {
      if (Math.abs(n.norm - p.norm) > 0.05) reasons.push('signal_strength_changed');
      if (Math.abs(n.confidence - p.confidence) > 0.05) reasons.push('confidence_changed');
      if (Math.abs(n.verification - p.verification) > 0.05) reasons.push('verification_changed');
      if (Math.abs(n.freshness - p.freshness) > 0.05) reasons.push('freshness_changed');
      if (Math.abs(n.weight - p.weight) > 1e-6) reasons.push('weight_changed');
    }
    
    contributions.push({
      id,
      prev: prevParts.contribution,
      next: nextParts.contribution,
      delta,
      prevParts,
      nextParts,
      reasons
    });
  }
  
  // Compute totals
  const prevTotalRaw = contributions.reduce((sum, c) => sum + c.prev, 0);
  const nextTotalRaw = contributions.reduce((sum, c) => sum + c.next, 0);
  
  const clampMin = config.clamp_min ?? 0;
  const clampMax = config.clamp_max ?? 100;
  
  const prevTotal = clamp(prevTotalRaw, clampMin, clampMax);
  const nextTotal = clamp(nextTotalRaw, clampMin, clampMax);
  const deltaTotal = nextTotal - prevTotal;
  
  // Sort by absolute delta
  contributions.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  
  const topN = config.top_n || 5;
  const topMovers = contributions.slice(0, topN);
  
  // Compute blocking factors
  const blockers = computeBlockingFactors(next, topMovers);
  
  return { prevTotal, nextTotal, deltaTotal, contributions, topMovers, blockers };
}

/**
 * Compute blocking factors based on current state
 */
function computeBlockingFactors(snapshot, movers) {
  const blockers = [];
  const features = snapshot?.features || {};
  
  // 1) Identity not verified (HARD)
  const identityAvgVer = IDENTITY_FEATURES
    .map(id => features[id]?.verification ?? 0)
    .reduce((a, b) => a + b, 0) / IDENTITY_FEATURES.length;
  
  if (identityAvgVer < 0.35) {
    blockers.push({
      id: BLOCKER_IDS.IDENTITY_NOT_VERIFIED,
      severity: 'hard',
      message: 'Identity / traction sources are not verified enough to unlock full scoring impact.',
      fixPath: '/app/settings/connectors',
      affectedFeatures: IDENTITY_FEATURES
    });
  }
  
  // 2) Evidence insufficient (SOFT)
  const bigUnverifiedMover = movers.find(
    m => m.nextParts.verification < 0.35 && Math.abs(m.delta) > 1.5
  );
  if (bigUnverifiedMover) {
    blockers.push({
      id: BLOCKER_IDS.EVIDENCE_INSUFFICIENT,
      severity: 'soft',
      message: `Big change detected but evidence is weak (${bigUnverifiedMover.id}). Verify to keep the lift.`,
      fixPath: '/app/scorecard/evidence',
      affectedFeatures: [bigUnverifiedMover.id]
    });
  }
  
  // 3) Recency gap (SOFT)
  const featureWeights = Object.entries(features).reduce((acc, [id, f]) => {
    acc[id] = f.weight || 1.0;
    return acc;
  }, {});
  
  const staleCritical = Object.entries(features).some(
    ([id, f]) => (featureWeights[id] || 1.0) >= 2 && (f.freshness || 1.0) < 0.4
  );
  
  if (staleCritical) {
    blockers.push({
      id: BLOCKER_IDS.RECENCY_GAP,
      severity: 'soft',
      message: 'Some critical signals are stale. Refresh sources to restore full freshness.',
      fixPath: '/app/settings/connectors',
      affectedFeatures: Object.entries(features)
        .filter(([_, f]) => (f.freshness || 1.0) < 0.4)
        .map(([id]) => id)
    });
  }
  
  // 4) Inconsistency detected (HARD)
  const inconsistent = Object.values(features).some(f => {
    const raw = f.raw || {};
    return raw.flags?.includes?.('inconsistent_claims');
  });
  
  if (inconsistent) {
    blockers.push({
      id: BLOCKER_IDS.INCONSISTENCY_DETECTED,
      severity: 'hard',
      message: 'We detected inconsistencies across sources. Resolve to remove penalties.',
      fixPath: '/app/scorecard/resolve',
      affectedFeatures: Object.entries(features)
        .filter(([_, f]) => f.raw?.flags?.includes?.('inconsistent_claims'))
        .map(([id]) => id)
    });
  }
  
  // 5) Missing required connectors (SOFT)
  const missingConnectors = Object.values(features).some(f => {
    const raw = f.raw || {};
    return raw.flags?.includes?.('missing_required_connector');
  });
  
  if (missingConnectors) {
    blockers.push({
      id: BLOCKER_IDS.MISSING_REQUIRED_CONNECTORS,
      severity: 'soft',
      message: 'Connect required data sources to fully activate the scorecard and unlock.',
      fixPath: '/app/settings/connectors',
      affectedFeatures: Object.entries(features)
        .filter(([_, f]) => f.raw?.flags?.includes?.('missing_required_connector'))
        .map(([id]) => id)
    });
  }
  
  return blockers;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Get delta config from database
 */
async function getDeltaConfig() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('delta_config')
    .select('*')
    .eq('id', 1)
    .single();
  
  if (error) {
    console.error('[canonicalDelta] Error fetching config:', error);
    // Return defaults
    return {
      freshness_half_life_days: 14.0,
      clamp_min: 0,
      clamp_max: 100,
      top_n: 5,
      feature_weights: {
        traction: 2.5,
        founder_velocity: 2.0,
        investor_intent: 1.8,
        market_belief_shift: 1.5,
        capital_convergence: 1.5,
        team_strength: 1.2,
        product_quality: 1.2,
        market_size: 1.0
      },
      verification_multipliers: {
        unverified: 0.20,
        soft_verified: 0.45,
        verified: 0.85,
        trusted: 1.0
      },
      provisional_multipliers: {
        low: 0.15,
        medium: 0.25,
        high: 0.35
      }
    };
  }
  
  return data;
}

/**
 * Get latest feature snapshots for a startup
 */
async function getLatestFeatures(startupId, asOf = null) {
  const supabase = getSupabaseClient();
  const config = await getDeltaConfig();
  
  const asOfDate = asOf ? new Date(asOf) : new Date();
  
  // Get the most recent snapshot for each feature
  const { data: features, error } = await supabase
    .from('feature_snapshots')
    .select('*')
    .eq('startup_id', startupId)
    .lte('measured_at', asOfDate.toISOString())
    .order('measured_at', { ascending: false });
  
  if (error) {
    console.error('[canonicalDelta] Error fetching features:', error);
    return {};
  }
  
  // Dedupe to get latest per feature_id
  const latestByFeature = {};
  for (const f of features || []) {
    if (!latestByFeature[f.feature_id]) {
      // Recompute freshness as of now
      const freshness = computeFreshness(
        f.measured_at,
        asOfDate.toISOString(),
        config.freshness_half_life_days
      );
      
      latestByFeature[f.feature_id] = {
        id: f.feature_id,
        raw: f.raw,
        norm: parseFloat(f.norm),
        weight: parseFloat(f.weight),
        confidence: parseFloat(f.confidence),
        verification: parseFloat(f.verification),
        freshness,
        verificationTier: f.verification_tier,
        evidenceRefs: f.evidence_refs || [],
        updatedAt: f.measured_at
      };
    }
  }
  
  return latestByFeature;
}

/**
 * Get the most recent score snapshot for a startup
 */
async function getLatestScoreSnapshot(startupId) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('score_snapshots')
    .select('*')
    .eq('startup_id', startupId)
    .order('as_of', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('[canonicalDelta] Error fetching snapshot:', error);
    return null;
  }
  
  return data;
}

/**
 * Compute and store a new score snapshot for a startup
 * Returns the delta result
 */
async function computeAndStoreSnapshot(startupId, triggeredBy = 'system', triggerEventId = null) {
  const supabase = getSupabaseClient();
  const config = await getDeltaConfig();
  
  const asOf = new Date().toISOString();
  
  // Get latest features
  const features = await getLatestFeatures(startupId, asOf);
  
  // Get previous snapshot
  const prevSnapshot = await getLatestScoreSnapshot(startupId);
  
  // Build current state
  const current = {
    asOf,
    features,
    total: 0 // Will be computed
  };
  
  // Build previous state for delta computation
  const previous = prevSnapshot ? {
    asOf: prevSnapshot.as_of,
    features: prevSnapshot.feature_contributions || {},
    total: parseFloat(prevSnapshot.signal_score) || 0
  } : {
    asOf: null,
    features: {},
    total: 0
  };
  
  // Compute delta
  const deltaResult = computeSignalDelta(previous, current, config);
  
  // Calculate aggregated stats
  const featureValues = Object.values(features);
  const avgConfidence = featureValues.length > 0
    ? featureValues.reduce((sum, f) => sum + f.confidence, 0) / featureValues.length
    : 0.5;
  const avgVerification = featureValues.length > 0
    ? featureValues.reduce((sum, f) => sum + f.verification, 0) / featureValues.length
    : 0.2;
  const avgFreshness = featureValues.length > 0
    ? featureValues.reduce((sum, f) => sum + f.freshness, 0) / featureValues.length
    : 1.0;
  
  // Store new snapshot
  const { data: newSnapshot, error } = await supabase
    .from('score_snapshots')
    .insert({
      startup_id: startupId,
      as_of: asOf,
      signal_score: deltaResult.nextTotal,
      avg_confidence: avgConfidence,
      avg_verification: avgVerification,
      avg_freshness: avgFreshness,
      feature_contributions: features,
      blocking_factors: deltaResult.blockers,
      prev_snapshot_id: prevSnapshot?.id || null,
      delta_total: deltaResult.deltaTotal,
      delta_contributions: deltaResult.contributions,
      top_movers: deltaResult.topMovers,
      computed_by: triggeredBy,
      trigger_event_id: triggerEventId
    })
    .select()
    .single();
  
  if (error) {
    console.error('[canonicalDelta] Error storing snapshot:', error);
    throw error;
  }
  
  // Update blocking factors in dedicated table
  await updateBlockingFactors(startupId, deltaResult.blockers);
  
  return {
    snapshot: newSnapshot,
    delta: deltaResult
  };
}

/**
 * Update active blocking factors for a startup
 */
async function updateBlockingFactors(startupId, blockers) {
  const supabase = getSupabaseClient();
  
  // Deactivate existing blockers not in new list
  const activeBlockerIds = blockers.map(b => b.id);
  
  await supabase
    .from('active_blocking_factors')
    .update({ 
      is_active: false, 
      resolved_at: new Date().toISOString(),
      resolution_type: 'auto'
    })
    .eq('startup_id', startupId)
    .eq('is_active', true)
    .not('blocker_id', 'in', `(${activeBlockerIds.map(id => `'${id}'`).join(',')})`);
  
  // Upsert new blockers
  for (const blocker of blockers) {
    await supabase
      .from('active_blocking_factors')
      .upsert({
        startup_id: startupId,
        blocker_id: blocker.id,
        severity: blocker.severity,
        message: blocker.message,
        fix_path: blocker.fixPath,
        affected_features: blocker.affectedFeatures || [],
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'startup_id,blocker_id',
        ignoreDuplicates: false
      });
  }
}

// ============================================================================
// ACTION EVENTS (Founder-reported, provisional lane)
// ============================================================================

/**
 * Submit a founder action event
 * Creates provisional score change
 */
async function submitActionEvent(startupId, action, reportedBy = null) {
  const supabase = getSupabaseClient();
  const config = await getDeltaConfig();
  
  const {
    category,
    title,
    description,
    actionDate,
    impactGuess,
    evidenceArtifactIds
  } = action;
  
  // Determine affected features based on category
  const affectedFeatures = ACTION_FEATURE_MAP[category] || ['founder_velocity'];
  
  // Calculate provisional delta based on impact guess
  const provisionalMultiplier = config.provisional_multipliers?.[impactGuess] || 0.15;
  const provisionalDelta = provisionalMultiplier * (impactGuess === 'high' ? 3 : impactGuess === 'medium' ? 2 : 1);
  
  // Create action event
  const { data: actionEvent, error } = await supabase
    .from('action_events')
    .insert({
      startup_id: startupId,
      reported_by: reportedBy,
      category,
      title,
      description,
      action_date: actionDate || new Date().toISOString().split('T')[0],
      impact_guess: impactGuess,
      affected_features: affectedFeatures,
      provisional_delta: provisionalDelta,
      verification_status: 'pending',
      evidence_artifact_ids: evidenceArtifactIds || []
    })
    .select()
    .single();
  
  if (error) {
    console.error('[canonicalDelta] Error creating action event:', error);
    throw error;
  }
  
  // Create provisional feature updates (low verification)
  for (const featureId of affectedFeatures) {
    const featureWeight = config.feature_weights?.[featureId] || 1.0;
    const verificationMultiplier = getVerificationMultiplier('unverified', config);
    
    await supabase
      .from('feature_snapshots')
      .insert({
        startup_id: startupId,
        feature_id: featureId,
        raw: {
          source: 'action_event',
          action_event_id: actionEvent.id,
          title,
          category,
          provisional: true
        },
        norm: Math.min(1.0, provisionalDelta / featureWeight),
        weight: featureWeight,
        confidence: 0.5,
        verification: verificationMultiplier,
        freshness: 1.0,
        verification_tier: 'unverified',
        evidence_refs: evidenceArtifactIds || [],
        measured_at: new Date().toISOString()
      });
  }
  
  // Trigger snapshot recomputation
  const result = await computeAndStoreSnapshot(startupId, 'action_event', actionEvent.id);
  
  return {
    actionEvent,
    snapshot: result.snapshot,
    delta: result.delta
  };
}

/**
 * Upgrade verification for an action event
 * Called when evidence is verified
 */
async function upgradeActionVerification(actionEventId, newTier, verifiedDelta = null) {
  const supabase = getSupabaseClient();
  const config = await getDeltaConfig();
  
  // Get action event
  const { data: actionEvent, error: fetchError } = await supabase
    .from('action_events')
    .select('*')
    .eq('id', actionEventId)
    .single();
  
  if (fetchError || !actionEvent) {
    throw new Error(`Action event not found: ${actionEventId}`);
  }
  
  const startupId = actionEvent.startup_id;
  const newVerificationMultiplier = getVerificationMultiplier(newTier, config);
  
  // Update feature snapshots linked to this action
  const { data: features } = await supabase
    .from('feature_snapshots')
    .select('*')
    .eq('startup_id', startupId)
    .contains('raw', { action_event_id: actionEventId });
  
  for (const feature of features || []) {
    await supabase
      .from('feature_snapshots')
      .update({
        verification: newVerificationMultiplier,
        verification_tier: newTier,
        raw: {
          ...feature.raw,
          provisional: false,
          verified_at: new Date().toISOString()
        }
      })
      .eq('id', feature.id);
  }
  
  // Update action event status
  await supabase
    .from('action_events')
    .update({
      verification_status: 'verified',
      verified_delta: verifiedDelta,
      verified_at: new Date().toISOString()
    })
    .eq('id', actionEventId);
  
  // Recompute snapshot
  const result = await computeAndStoreSnapshot(startupId, 'verification_upgrade');
  
  return result;
}

// ============================================================================
// SCORECARD API
// ============================================================================

/**
 * Get full scorecard for a startup
 * Returns current snapshot, delta, blockers, and evidence status
 */
async function getScorecard(startupId) {
  const supabase = getSupabaseClient();
  
  // Get latest snapshot
  const snapshot = await getLatestScoreSnapshot(startupId);
  
  if (!snapshot) {
    // No snapshot exists, compute one
    const result = await computeAndStoreSnapshot(startupId);
    return formatScorecardResponse(result.snapshot, result.delta);
  }
  
  // Get active blockers
  const { data: blockers } = await supabase
    .from('active_blocking_factors')
    .select('*')
    .eq('startup_id', startupId)
    .eq('is_active', true)
    .order('severity', { ascending: true }); // hard first
  
  // Get connected sources
  const { data: sources } = await supabase
    .from('connected_sources')
    .select('*')
    .eq('startup_id', startupId);
  
  // Get pending verifications
  const { data: pendingActions } = await supabase
    .from('action_events')
    .select('*')
    .eq('startup_id', startupId)
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);
  
  return formatScorecardResponse(snapshot, {
    prevTotal: snapshot.signal_score - (snapshot.delta_total || 0),
    nextTotal: snapshot.signal_score,
    deltaTotal: snapshot.delta_total || 0,
    topMovers: snapshot.top_movers || [],
    blockers: snapshot.blocking_factors || []
  }, blockers, sources, pendingActions);
}

/**
 * Format scorecard response for API/UI
 */
function formatScorecardResponse(snapshot, delta, blockers = [], sources = [], pendingActions = []) {
  const hardBlockers = (blockers || []).filter(b => b.severity === 'hard');
  const softBlockers = (blockers || []).filter(b => b.severity === 'soft');
  
  return {
    signalScore: parseFloat(snapshot.signal_score) || 0,
    delta: {
      value: delta.deltaTotal || 0,
      direction: (delta.deltaTotal || 0) >= 0 ? 'up' : 'down'
    },
    confidence: parseFloat(snapshot.avg_confidence) || 0.5,
    verification: parseFloat(snapshot.avg_verification) || 0.2,
    freshness: parseFloat(snapshot.avg_freshness) || 1.0,
    lastUpdated: snapshot.as_of,
    
    // Top movers (why it moved)
    topMovers: (delta.topMovers || []).map(m => ({
      featureId: m.id,
      featureName: formatFeatureName(m.id),
      delta: m.delta,
      direction: m.delta >= 0 ? 'up' : 'down',
      reasons: m.reasons || [],
      verification: m.nextParts?.verification || 0
    })),
    
    // Blocking factors
    blockingFactors: {
      hard: hardBlockers.map(formatBlocker),
      soft: softBlockers.map(formatBlocker),
      count: (hardBlockers.length || 0) + (softBlockers.length || 0)
    },
    
    // Evidence status
    evidence: {
      connectedSources: (sources || []).map(s => ({
        type: s.source_type,
        name: s.source_name,
        status: s.status,
        lastSync: s.last_sync_at
      })),
      pendingVerifications: (pendingActions || []).map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        deadline: a.verification_deadline
      }))
    },
    
    // Feature contributions
    features: snapshot.feature_contributions || {}
  };
}

function formatFeatureName(id) {
  const names = {
    traction: 'Traction',
    founder_velocity: 'Founder Velocity',
    investor_intent: 'Investor Intent',
    market_belief_shift: 'Market Belief Shift',
    capital_convergence: 'Capital Convergence',
    team_strength: 'Team Strength',
    product_quality: 'Product Quality',
    market_size: 'Market Size'
  };
  return names[id] || id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function formatBlocker(blocker) {
  return {
    id: blocker.blocker_id,
    severity: blocker.severity,
    message: blocker.message,
    fixPath: blocker.fix_path,
    affectedFeatures: blocker.affected_features || []
  };
}

// ============================================================================
// GOD SCORE INTEGRATION
// ============================================================================

/**
 * Compute GOD score adjustment from verified signal deltas
 * GOD_new = clamp(GOD_prev + α·ΔSignal + β·ΔTractionVerified + γ·ΔInvestorIntentVerified - π·Penalties)
 */
async function computeGodAdjustment(startupId) {
  const supabase = getSupabaseClient();
  
  // Get latest snapshot with delta
  const snapshot = await getLatestScoreSnapshot(startupId);
  if (!snapshot || !snapshot.delta_total) {
    return { adjustment: 0, details: 'No delta available' };
  }
  
  // Only count verified deltas
  const contributions = snapshot.delta_contributions || [];
  const verifiedContributions = contributions.filter(c => 
    c.nextParts?.verification >= 0.45 // soft_verified or better
  );
  
  // Weights for GOD adjustment
  const ALPHA = 0.3; // General signal weight
  const BETA = 0.4;  // Traction weight (most important)
  const GAMMA = 0.2; // Investor intent weight
  const PI = 0.5;    // Penalty weight
  
  // Calculate verified deltas by category
  const tractionDelta = verifiedContributions
    .filter(c => c.id === 'traction')
    .reduce((sum, c) => sum + c.delta, 0);
  
  const investorDelta = verifiedContributions
    .filter(c => c.id === 'investor_intent')
    .reduce((sum, c) => sum + c.delta, 0);
  
  const otherDelta = verifiedContributions
    .filter(c => !['traction', 'investor_intent'].includes(c.id))
    .reduce((sum, c) => sum + c.delta, 0);
  
  // Calculate penalties from blockers
  const blockers = snapshot.blocking_factors || [];
  const hardBlockerPenalty = blockers.filter(b => b.severity === 'hard').length * 2;
  const softBlockerPenalty = blockers.filter(b => b.severity === 'soft').length * 0.5;
  const totalPenalty = hardBlockerPenalty + softBlockerPenalty;
  
  // Final adjustment
  const adjustment = (
    ALPHA * otherDelta +
    BETA * tractionDelta +
    GAMMA * investorDelta -
    PI * totalPenalty
  );
  
  return {
    adjustment: Math.round(adjustment * 100) / 100,
    details: {
      signalDelta: otherDelta,
      tractionDelta,
      investorDelta,
      penalties: totalPenalty,
      formula: `${ALPHA}·${otherDelta.toFixed(2)} + ${BETA}·${tractionDelta.toFixed(2)} + ${GAMMA}·${investorDelta.toFixed(2)} - ${PI}·${totalPenalty.toFixed(2)}`
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Constants
  VERIFICATION_TIERS,
  BLOCKER_IDS,
  FEATURE_IDS,
  ACTION_FEATURE_MAP,
  
  // Core computation
  computeFreshness,
  computeContribution,
  computeSignalDelta,
  computeBlockingFactors,
  
  // Database operations
  getDeltaConfig,
  getLatestFeatures,
  getLatestScoreSnapshot,
  computeAndStoreSnapshot,
  updateBlockingFactors,
  
  // Action events
  submitActionEvent,
  upgradeActionVerification,
  
  // Scorecard
  getScorecard,
  
  // GOD integration
  computeGodAdjustment
};
