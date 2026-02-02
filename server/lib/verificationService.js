/**
 * Pythh Canonical Verification Service v2.0.0
 * 
 * Processing pipeline for founder actions → verification → scoring.
 * Implements the "two-lane" system:
 *   - Fast lane: Provisional lifts from founder actions (capped at 0.35)
 *   - Truth lane: Verified lifts from evidence (up to 1.0)
 */

const { getSupabaseClient } = require('./supabaseClient');

// ============================================================================
// CONSTANTS (locked IDs and rules)
// ============================================================================

const ACTION_TYPES = [
  'product_release',
  'customer_closed',
  'revenue_change',
  'hiring',
  'press',
  'partnership',
  'fundraising',
  'investor_meeting',
  'other'
];

const BLOCKER_IDS = {
  IDENTITY_NOT_VERIFIED: 'identity_not_verified',
  EVIDENCE_INSUFFICIENT: 'evidence_insufficient',
  RECENCY_GAP: 'recency_gap',
  INCONSISTENCY_DETECTED: 'inconsistency_detected',
  MISSING_REQUIRED_CONNECTORS: 'missing_required_connectors'
};

const BLOCKER_CONFIG = {
  [BLOCKER_IDS.IDENTITY_NOT_VERIFIED]: {
    severity: 'hard',
    message: 'Founder identity not verified',
    fixPath: '/settings/verification'
  },
  [BLOCKER_IDS.EVIDENCE_INSUFFICIENT]: {
    severity: 'soft',
    message: 'Evidence insufficient for claimed lift',
    fixPath: '/evidence'
  },
  [BLOCKER_IDS.RECENCY_GAP]: {
    severity: 'soft',
    message: 'Data is stale - report recent activity',
    fixPath: '/actions/new'
  },
  [BLOCKER_IDS.INCONSISTENCY_DETECTED]: {
    severity: 'hard',
    message: 'Inconsistent claims detected',
    fixPath: '/evidence/resolve'
  },
  [BLOCKER_IDS.MISSING_REQUIRED_CONNECTORS]: {
    severity: 'soft',
    message: 'Required connectors not connected',
    fixPath: '/settings/connectors'
  }
};

// Action type → required verification
const ACTION_VERIFICATION_REQUIREMENTS = {
  revenue_change: [
    { kind: 'connect', provider: 'stripe' },
    { kind: 'upload', doc: 'invoice' }
  ],
  customer_closed: [
    { kind: 'upload', doc: 'contract' },
    { kind: 'connect', provider: 'hubspot' }
  ],
  hiring: [
    { kind: 'upload', doc: 'offer_letter' },
    { kind: 'link', urlType: 'linkedin' }
  ],
  fundraising: [
    { kind: 'upload', doc: 'term_sheet' },
    { kind: 'connect', provider: 'plaid' }
  ],
  product_release: [
    { kind: 'link', urlType: 'release_notes' },
    { kind: 'connect', provider: 'github' }
  ],
  press: [
    { kind: 'link', urlType: 'press' }
  ],
  partnership: [
    { kind: 'upload', doc: 'contract' }
  ],
  investor_meeting: [
    { kind: 'review', level: 'light' }
  ],
  other: [
    { kind: 'review', level: 'light' }
  ]
};

// Impact → provisional multiplier (capped)
const IMPACT_MULTIPLIERS = {
  low: 0.15,
  medium: 0.25,
  high: 0.35
};

// Feature affected by action type
const ACTION_FEATURE_MAP = {
  revenue_change: ['traction', 'investor_intent'],
  customer_closed: ['traction', 'market_belief_shift'],
  hiring: ['team_strength', 'founder_velocity'],
  fundraising: ['investor_intent', 'capital_convergence'],
  product_release: ['product_quality', 'founder_velocity'],
  press: ['market_belief_shift', 'capital_convergence'],
  partnership: ['market_belief_shift', 'traction'],
  investor_meeting: ['investor_intent'],
  other: ['founder_velocity']
};

// ============================================================================
// HELPERS
// ============================================================================

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clamp01 = (x) => clamp(x, 0, 1);

function getVerificationMultiplier(tier) {
  const multipliers = {
    unverified: 0.20,
    soft_verified: 0.45,
    verified: 0.85,
    trusted: 1.0
  };
  return multipliers[tier] || 0.20;
}

function getTierFromVerification(verification) {
  if (verification >= 0.85) return 'verified';
  if (verification >= 0.45) return 'soft_verified';
  return 'unverified';
}

function computeFreshness(updatedAtISO, asOfISO = new Date().toISOString(), halfLifeDays = 14) {
  const updatedAt = new Date(updatedAtISO).getTime();
  const asOf = new Date(asOfISO).getTime();
  const ageDays = Math.max(0, (asOf - updatedAt) / (1000 * 60 * 60 * 24));
  const lambda = Math.log(2) / Math.max(1e-6, halfLifeDays);
  return clamp01(Math.exp(-lambda * ageDays));
}

// ============================================================================
// STEP 0: INTAKE (founder submits action)
// ============================================================================

/**
 * Submit a new founder action.
 * Creates action_event, verification_state, and applies provisional lift.
 */
async function submitAction(params) {
  const {
    startupId,
    actorUserId,
    type,
    title,
    details,
    occurredAt,
    impactGuess,
    fields
  } = params;

  const supabase = getSupabaseClient();

  // 1. Compute verification plan
  const verificationPlan = computeVerificationPlan(type, impactGuess, fields);

  // 2. Create action event
  const { data: action, error: actionError } = await supabase
    .from('action_events_v2')
    .insert({
      startup_id: startupId,
      actor_user_id: actorUserId || null,
      type,
      title,
      details,
      occurred_at: occurredAt,
      submitted_at: new Date().toISOString(),
      impact_guess: impactGuess,
      fields: fields || {},
      verification_plan: verificationPlan,
      status: 'pending'
    })
    .select()
    .single();

  if (actionError) {
    console.error('[verificationService] submitAction error:', actionError);
    throw new Error(`Failed to create action: ${actionError.message}`);
  }

  // 3. Create verification state
  const missingRequirements = verificationPlan.requirements;
  const { error: vsError } = await supabase
    .from('verification_states_v2')
    .insert({
      action_id: action.id,
      current_verification: 0.2,
      tier: 'unverified',
      satisfied: false,
      missing: missingRequirements,
      matched_evidence_ids: [],
      notes: null
    });

  if (vsError) {
    console.error('[verificationService] verification_state insert error:', vsError);
  }

  // 4. Compute and apply provisional lift
  const provisionalResult = await applyProvisionalLift(startupId, action, impactGuess);

  // 5. Update action with provisional delta reference
  if (provisionalResult.deltaId) {
    await supabase
      .from('action_events_v2')
      .update({
        provisional_delta_id: provisionalResult.deltaId,
        status: 'provisional_applied'
      })
      .eq('id', action.id);
  }

  return {
    action: {
      ...action,
      status: provisionalResult.deltaId ? 'provisional_applied' : action.status,
      provisional_delta_id: provisionalResult.deltaId
    },
    snapshot: provisionalResult.snapshot,
    nextSteps: {
      message: `Action recorded. Verify it within ${verificationPlan.verificationWindowDays} days to unlock full scoring impact.`,
      requirements: missingRequirements,
      deadline: new Date(Date.now() + verificationPlan.verificationWindowDays * 86400000).toISOString()
    }
  };
}

/**
 * Compute verification plan based on action type and magnitude.
 */
function computeVerificationPlan(type, impactGuess, fields) {
  const baseRequirements = ACTION_VERIFICATION_REQUIREMENTS[type] || [];
  const requirements = [...baseRequirements];

  // High impact actions need more verification
  if (impactGuess === 'high') {
    // Add extra requirement if not already present
    if (!requirements.find(r => r.kind === 'review')) {
      requirements.push({ kind: 'review', level: 'standard' });
    }
  }

  // Large revenue claims need bank verification
  if (fields?.mrrDeltaUsd && Math.abs(fields.mrrDeltaUsd) >= 10000) {
    if (!requirements.find(r => r.kind === 'connect' && r.provider === 'plaid')) {
      requirements.push({ kind: 'connect', provider: 'plaid' });
    }
  }

  return {
    requirements,
    targetVerification: impactGuess === 'high' ? 0.90 : impactGuess === 'medium' ? 0.85 : 0.75,
    verificationWindowDays: impactGuess === 'high' ? 7 : 14
  };
}

/**
 * Apply provisional lift (capped, small, immediate).
 */
async function applyProvisionalLift(startupId, action, impactGuess) {
  const supabase = getSupabaseClient();

  // Get latest snapshot
  const { data: prevSnapshot } = await supabase
    .from('score_snapshots_v2')
    .select('*')
    .eq('startup_id', startupId)
    .order('as_of', { ascending: false })
    .limit(1)
    .single();

  // Compute provisional delta
  const provisionalMultiplier = IMPACT_MULTIPLIERS[impactGuess] || 0.25;
  const affectedFeatures = ACTION_FEATURE_MAP[action.type] || ['founder_velocity'];
  
  // Base lift per feature (small and capped)
  const baseLift = 0.05 * provisionalMultiplier; // 0.75% to 1.75% per feature
  
  // Build new features
  const prevFeatures = prevSnapshot?.features || {};
  const nextFeatures = { ...prevFeatures };
  const topMovers = [];

  for (const featureId of affectedFeatures) {
    const prev = prevFeatures[featureId] || {
      featureId,
      value: 0,
      norm: 0,
      weight: 0.10,
      confidence: 0.5,
      verification: 0.2,
      freshness: 1.0,
      contribution: 0,
      updatedAt: new Date().toISOString()
    };

    // Apply provisional lift (capped at 0.35 verification)
    const newNorm = clamp01(prev.norm + baseLift);
    const newVerification = Math.min(0.35, prev.verification + 0.05);
    const newContribution = prev.weight * newNorm * prev.confidence * newVerification * prev.freshness;

    nextFeatures[featureId] = {
      ...prev,
      norm: newNorm,
      verification: newVerification,
      contribution: newContribution,
      updatedAt: new Date().toISOString()
    };

    topMovers.push({
      featureId,
      delta: newContribution - prev.contribution,
      reasons: ['signal_strength_changed', 'verification_changed'],
      evidenceRefs: []
    });
  }

  // Calculate totals
  const totalSignal = Object.values(nextFeatures).reduce((sum, f) => sum + (f.contribution || 0), 0);
  const prevSignal = prevSnapshot?.total_signal || 0;
  const deltaSignal = totalSignal - prevSignal;

  // Create new snapshot
  const { data: newSnapshot, error: snapError } = await supabase
    .from('score_snapshots_v2')
    .insert({
      startup_id: startupId,
      as_of: new Date().toISOString(),
      features: nextFeatures,
      total_signal: totalSignal,
      total_god: prevSnapshot?.total_god || 0 // GOD only moves on verified
    })
    .select()
    .single();

  if (snapError) {
    console.error('[verificationService] snapshot insert error:', snapError);
    return { deltaId: null, snapshot: { signalScore: prevSignal, deltaTotal: 0 } };
  }

  // Create score delta
  const { data: delta, error: deltaError } = await supabase
    .from('score_deltas_v2')
    .insert({
      startup_id: startupId,
      prev_snapshot_id: prevSnapshot?.id || null,
      next_snapshot_id: newSnapshot.id,
      delta_signal: deltaSignal,
      delta_god: 0, // Provisional doesn't move GOD
      top_movers: topMovers,
      blockers: []
    })
    .select()
    .single();

  if (deltaError) {
    console.error('[verificationService] delta insert error:', deltaError);
  }

  return {
    deltaId: delta?.id || null,
    snapshot: {
      signalScore: totalSignal,
      deltaTotal: deltaSignal
    }
  };
}

// ============================================================================
// STEP 1: EVIDENCE ARRIVES
// ============================================================================

/**
 * Submit evidence artifact (from upload, webhook, or link).
 */
async function submitEvidence(params) {
  const {
    startupId,
    actionId,
    type,
    ref,
    extracted
  } = params;

  const supabase = getSupabaseClient();

  // 1. Insert evidence artifact
  const { data: evidence, error } = await supabase
    .from('evidence_artifacts_v2')
    .insert({
      startup_id: startupId,
      action_id: actionId || null,
      type,
      ref: ref || {},
      extracted: extracted || null,
      tier: 'unverified',
      confidence: 0.5
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert evidence: ${error.message}`);
  }

  // 2. Run extraction if not provided
  const finalExtracted = extracted || await extractFromEvidence(evidence);
  
  // 3. Match to relevant actions (if not explicitly linked)
  const matchedActions = actionId 
    ? [{ id: actionId }]
    : await matchEvidenceToActions(startupId, evidence, finalExtracted);

  // 4. Update verification states for matched actions
  const results = [];
  for (const action of matchedActions) {
    const updateResult = await updateVerificationState(action.id, evidence.id, type, finalExtracted);
    results.push(updateResult);

    // If verification satisfied, apply verified lift
    if (updateResult.satisfied) {
      await applyVerifiedLift(startupId, action.id);
    }
  }

  return {
    evidence,
    matchedActions: matchedActions.map(a => a.id),
    verificationUpdates: results
  };
}

/**
 * Extract structured data from evidence (placeholder for ML/parsing).
 */
async function extractFromEvidence(evidence) {
  // TODO: Implement actual extraction (OCR, API calls, etc.)
  return {
    flags: [],
    amounts: null,
    dates: null,
    entities: null
  };
}

/**
 * Match evidence to relevant actions by startup, time window, and entities.
 */
async function matchEvidenceToActions(startupId, evidence, extracted) {
  const supabase = getSupabaseClient();
  
  // Find unverified actions from last 30 days
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  
  const { data: actions } = await supabase
    .from('action_events_v2')
    .select('id, type, fields, verification_plan')
    .eq('startup_id', startupId)
    .in('status', ['pending', 'provisional_applied'])
    .gte('occurred_at', cutoff);

  if (!actions || actions.length === 0) return [];

  // Score each action for relevance
  const scored = actions.map(action => {
    let score = 0;
    const plan = action.verification_plan?.requirements || [];

    // Check if evidence type satisfies a requirement
    for (const req of plan) {
      if (req.kind === 'connect' && evidence.type === 'oauth_connector' && evidence.ref?.provider === req.provider) {
        score += 10;
      }
      if (req.kind === 'upload' && evidence.type === 'document_upload') {
        score += 5;
      }
      if (req.kind === 'link' && evidence.type === 'public_link') {
        score += 5;
      }
    }

    // Check entity matches
    if (extracted?.entities?.customer && action.fields?.customerName) {
      if (extracted.entities.customer.toLowerCase().includes(action.fields.customerName.toLowerCase())) {
        score += 8;
      }
    }

    // Check amount matches (within 20%)
    if (extracted?.amounts?.usd && action.fields?.mrrDeltaUsd) {
      const diff = Math.abs(extracted.amounts.usd - action.fields.mrrDeltaUsd);
      if (diff / Math.abs(action.fields.mrrDeltaUsd) < 0.2) {
        score += 10;
      }
    }

    return { ...action, matchScore: score };
  });

  // Return actions with score > 0, sorted by score
  return scored
    .filter(a => a.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Update verification state when evidence arrives.
 */
async function updateVerificationState(actionId, evidenceId, evidenceType, extracted) {
  const supabase = getSupabaseClient();

  // Get current state
  const { data: vs } = await supabase
    .from('verification_states_v2')
    .select('*')
    .eq('action_id', actionId)
    .single();

  if (!vs) {
    // Create if not exists
    const { data: action } = await supabase
      .from('action_events_v2')
      .select('verification_plan')
      .eq('id', actionId)
      .single();

    await supabase.from('verification_states_v2').insert({
      action_id: actionId,
      current_verification: 0.2,
      tier: 'unverified',
      satisfied: false,
      missing: action?.verification_plan?.requirements || [],
      matched_evidence_ids: [evidenceId]
    });

    return { actionId, currentVerification: 0.2, satisfied: false };
  }

  // Determine verification boost based on evidence type
  const boosts = {
    oauth_connector: 0.30,
    webhook_event: 0.25,
    document_upload: 0.20,
    bank_transaction: 0.35,
    public_link: 0.10,
    screenshot: 0.05,
    email_proof: 0.10,
    manual_review_note: 0.15
  };

  const boost = boosts[evidenceType] || 0.10;
  const newVerification = clamp01(vs.current_verification + boost);
  const newTier = getTierFromVerification(newVerification);

  // Update missing requirements (simplified - real impl checks specifics)
  const missing = vs.missing.filter(req => {
    if (req.kind === 'connect' && evidenceType === 'oauth_connector') return false;
    if (req.kind === 'upload' && evidenceType === 'document_upload') return false;
    if (req.kind === 'link' && evidenceType === 'public_link') return false;
    return true;
  });

  // Get target verification from action
  const { data: action } = await supabase
    .from('action_events_v2')
    .select('verification_plan')
    .eq('id', actionId)
    .single();

  const targetVerification = action?.verification_plan?.targetVerification || 0.85;
  const satisfied = newVerification >= targetVerification && missing.length === 0;

  // Update state
  const matchedIds = [...(vs.matched_evidence_ids || [])];
  if (!matchedIds.includes(evidenceId)) {
    matchedIds.push(evidenceId);
  }

  const { data: updated } = await supabase
    .from('verification_states_v2')
    .update({
      current_verification: newVerification,
      tier: newTier,
      satisfied,
      missing,
      matched_evidence_ids: matchedIds
    })
    .eq('action_id', actionId)
    .select()
    .single();

  return {
    actionId,
    currentVerification: newVerification,
    tier: newTier,
    satisfied,
    missing,
    matchedEvidenceIds: matchedIds
  };
}

/**
 * Apply verified lift (big impact, moves GOD).
 */
async function applyVerifiedLift(startupId, actionId) {
  const supabase = getSupabaseClient();

  // Get action and verification state
  const { data: action } = await supabase
    .from('action_events_v2')
    .select('*')
    .eq('id', actionId)
    .single();

  const { data: vs } = await supabase
    .from('verification_states_v2')
    .select('*')
    .eq('action_id', actionId)
    .single();

  if (!action || !vs) return null;

  // Get latest snapshot
  const { data: prevSnapshot } = await supabase
    .from('score_snapshots_v2')
    .select('*')
    .eq('startup_id', startupId)
    .order('as_of', { ascending: false })
    .limit(1)
    .single();

  // Get config
  const { data: config } = await supabase
    .from('delta_config_v2')
    .select('*')
    .eq('id', 1)
    .single();

  const godWeights = config?.god_weights || {
    signal: 0.25,
    traction: 0.35,
    investorIntent: 0.20,
    penaltyPerBlocker: 0.5
  };

  // Compute verified lift
  const affectedFeatures = ACTION_FEATURE_MAP[action.type] || ['founder_velocity'];
  const verificationMultiplier = getVerificationMultiplier(vs.tier);
  
  // Full lift based on impact and verification
  const impactMultiplier = { low: 0.5, medium: 1.0, high: 1.5 }[action.impact_guess] || 1.0;
  const baseLift = 0.10 * impactMultiplier * verificationMultiplier;

  const prevFeatures = prevSnapshot?.features || {};
  const nextFeatures = { ...prevFeatures };
  const topMovers = [];

  let tractionDelta = 0;
  let investorDelta = 0;

  for (const featureId of affectedFeatures) {
    const prev = prevFeatures[featureId] || {
      featureId,
      value: 0,
      norm: 0,
      weight: 0.10,
      confidence: 0.5,
      verification: 0.2,
      freshness: 1.0,
      contribution: 0,
      updatedAt: new Date().toISOString()
    };

    // Apply verified lift
    const newNorm = clamp01(prev.norm + baseLift);
    const newVerification = verificationMultiplier;
    const newContribution = prev.weight * newNorm * prev.confidence * newVerification * prev.freshness;
    const delta = newContribution - prev.contribution;

    nextFeatures[featureId] = {
      ...prev,
      norm: newNorm,
      verification: newVerification,
      contribution: newContribution,
      updatedAt: new Date().toISOString()
    };

    topMovers.push({
      featureId,
      delta,
      reasons: ['verification_changed', 'signal_strength_changed'],
      evidenceRefs: vs.matched_evidence_ids || []
    });

    // Track for GOD calculation
    if (featureId === 'traction') tractionDelta = delta;
    if (featureId === 'investor_intent') investorDelta = delta;
  }

  // Calculate signal totals
  const totalSignal = Object.values(nextFeatures).reduce((sum, f) => sum + (f.contribution || 0), 0);
  const prevSignal = prevSnapshot?.total_signal || 0;
  const deltaSignal = totalSignal - prevSignal;

  // Calculate GOD adjustment (only verified movement)
  const godAdjustment = 
    godWeights.signal * deltaSignal +
    godWeights.traction * tractionDelta +
    godWeights.investorIntent * investorDelta;

  const prevGod = prevSnapshot?.total_god || 0;
  const newGod = clamp(prevGod + godAdjustment, 0, 100);
  const deltaGod = newGod - prevGod;

  // Create new snapshot
  const { data: newSnapshot } = await supabase
    .from('score_snapshots_v2')
    .insert({
      startup_id: startupId,
      as_of: new Date().toISOString(),
      features: nextFeatures,
      total_signal: totalSignal,
      total_god: newGod
    })
    .select()
    .single();

  // Create score delta
  const { data: delta } = await supabase
    .from('score_deltas_v2')
    .insert({
      startup_id: startupId,
      prev_snapshot_id: prevSnapshot?.id || null,
      next_snapshot_id: newSnapshot?.id,
      delta_signal: deltaSignal,
      delta_god: deltaGod,
      top_movers: topMovers,
      blockers: []
    })
    .select()
    .single();

  // Update action with verified delta reference
  await supabase
    .from('action_events_v2')
    .update({
      verified_delta_id: delta?.id,
      status: 'verified'
    })
    .eq('id', actionId);

  // Update startup's GOD score in startup_uploads
  await supabase
    .from('startup_uploads')
    .update({ total_god_score: newGod })
    .eq('id', startupId);

  return {
    deltaId: delta?.id,
    snapshot: {
      signalScore: totalSignal,
      godScore: newGod,
      deltaSignal,
      deltaGod
    }
  };
}

// ============================================================================
// STEP 2: INCONSISTENCY RESOLVER
// ============================================================================

/**
 * Resolve an inconsistency for an action.
 */
async function resolveInconsistency(actionId, resolution) {
  const supabase = getSupabaseClient();
  const { explanation, evidenceId, verifierNotes } = resolution;

  // Get current verification state
  const { data: vs } = await supabase
    .from('verification_states_v2')
    .select('*')
    .eq('action_id', actionId)
    .single();

  if (!vs) {
    throw new Error('Verification state not found');
  }

  // Add evidence to matched list if provided
  const matchedIds = vs.matched_evidence_ids || [];
  if (evidenceId && !matchedIds.includes(evidenceId)) {
    matchedIds.push(evidenceId);
  }

  // Boost verification (inconsistency resolution = trust signal)
  const newVerification = clamp01(vs.current_verification + 0.20);
  const newTier = getTierFromVerification(newVerification);

  // Update state with notes
  const { data: updated } = await supabase
    .from('verification_states_v2')
    .update({
      current_verification: newVerification,
      tier: newTier,
      matched_evidence_ids: matchedIds,
      notes: `Resolution: ${explanation}. ${verifierNotes || ''}`
    })
    .eq('action_id', actionId)
    .select()
    .single();

  // Get action startup_id
  const { data: action } = await supabase
    .from('action_events_v2')
    .select('startup_id')
    .eq('id', actionId)
    .single();

  // Clear any inconsistency blockers
  await supabase
    .from('active_blocking_factors_v2')
    .update({ is_active: false, resolved_at: new Date().toISOString() })
    .eq('startup_id', action?.startup_id)
    .eq('blocker_id', BLOCKER_IDS.INCONSISTENCY_DETECTED)
    .eq('is_active', true);

  // Check if now satisfied and apply verified lift
  const { data: actionFull } = await supabase
    .from('action_events_v2')
    .select('verification_plan')
    .eq('id', actionId)
    .single();

  const targetVerification = actionFull?.verification_plan?.targetVerification || 0.85;
  const satisfied = newVerification >= targetVerification;

  if (satisfied && action) {
    await applyVerifiedLift(action.startup_id, actionId);
  }

  return {
    actionId,
    currentVerification: newVerification,
    tier: newTier,
    satisfied
  };
}

// ============================================================================
// SCORECARD DATA
// ============================================================================

/**
 * Get full scorecard data for a startup.
 */
async function getScorecard(startupId) {
  const supabase = getSupabaseClient();

  // Get startup base data
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('id', startupId)
    .single();

  if (!startup) {
    throw new Error('Startup not found');
  }

  // Get latest two snapshots for delta
  const { data: snapshots } = await supabase
    .from('score_snapshots_v2')
    .select('*')
    .eq('startup_id', startupId)
    .order('as_of', { ascending: false })
    .limit(2);

  const latest = snapshots?.[0];
  const prev = snapshots?.[1];

  // Calculate deltas
  const signalScore = latest?.total_signal || 0;
  const godScore = latest?.total_god || startup.total_god_score || 0;
  const signalDelta = latest && prev ? latest.total_signal - prev.total_signal : 0;
  const godDelta = latest && prev ? latest.total_god - prev.total_god : 0;

  // Get latest delta for top movers
  const { data: latestDelta } = await supabase
    .from('score_deltas_v2')
    .select('*')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get active blockers
  const { data: blockers } = await supabase
    .from('active_blocking_factors_v2')
    .select('*')
    .eq('startup_id', startupId)
    .eq('is_active', true);

  // Get connected sources
  const { data: sources } = await supabase
    .from('connected_sources_v2')
    .select('*')
    .eq('startup_id', startupId);

  // Get action counts
  const { count: pendingCount } = await supabase
    .from('action_events_v2')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId)
    .in('status', ['pending', 'provisional_applied']);

  const { count: verifiedCount } = await supabase
    .from('action_events_v2')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId)
    .eq('status', 'verified');

  // Calculate aggregate confidence, verification, freshness
  const features = latest?.features || {};
  const featureValues = Object.values(features);
  const avgConfidence = featureValues.length > 0
    ? featureValues.reduce((sum, f) => sum + (f.confidence || 0), 0) / featureValues.length
    : 0.5;
  const avgVerification = featureValues.length > 0
    ? featureValues.reduce((sum, f) => sum + (f.verification || 0), 0) / featureValues.length
    : 0.2;
  const avgFreshness = featureValues.length > 0
    ? featureValues.reduce((sum, f) => sum + (f.freshness || 0), 0) / featureValues.length
    : 1.0;

  // Format top movers with labels
  const featureLabels = {
    traction: 'Traction',
    founder_velocity: 'Founder Velocity',
    investor_intent: 'Investor Intent',
    market_belief_shift: 'Market Belief',
    capital_convergence: 'Capital Convergence',
    team_strength: 'Team Strength',
    product_quality: 'Product Quality',
    market_size: 'Market Size'
  };

  const topMovers = (latestDelta?.top_movers || [])
    .map(m => ({
      featureId: m.featureId,
      label: featureLabels[m.featureId] || m.featureId,
      delta: m.delta,
      reasons: m.reasons || []
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  return {
    signalScore,
    godScore,
    delta: {
      signal: signalDelta,
      god: godDelta,
      direction: signalDelta > 0.01 ? 'up' : signalDelta < -0.01 ? 'down' : 'flat'
    },
    confidence: avgConfidence,
    verification: avgVerification,
    freshness: avgFreshness,
    lastUpdated: latest?.as_of || startup.updated_at || new Date().toISOString(),
    topMovers,
    blockers: (blockers || []).map(b => ({
      id: b.blocker_id,
      severity: b.severity,
      message: b.message,
      fixPath: b.fix_path
    })),
    connectedSources: (sources || []).map(s => ({
      provider: s.provider,
      status: s.status
    })),
    pendingActions: pendingCount || 0,
    verifiedActions: verifiedCount || 0
  };
}

/**
 * Get evidence center data.
 */
async function getEvidenceCenter(startupId) {
  const supabase = getSupabaseClient();

  // Get connected sources
  const { data: sources } = await supabase
    .from('connected_sources_v2')
    .select('*')
    .eq('startup_id', startupId);

  // Get pending evidence (unverified/soft_verified)
  const { data: pendingEvidence } = await supabase
    .from('evidence_artifacts_v2')
    .select('*')
    .eq('startup_id', startupId)
    .in('tier', ['unverified', 'soft_verified'])
    .order('created_at', { ascending: false })
    .limit(10);

  // Get conflicts (evidence with flags)
  const { data: conflicts } = await supabase
    .from('evidence_artifacts_v2')
    .select('id, extracted, action_id')
    .eq('startup_id', startupId)
    .not('extracted->flags', 'is', null);

  const formattedConflicts = (conflicts || [])
    .filter(c => c.extracted?.flags?.length > 0)
    .map(c => ({
      id: c.id,
      type: c.extracted.flags.includes('revenue_mismatch') ? 'revenue_mismatch' :
            c.extracted.flags.includes('date_mismatch') ? 'date_mismatch' : 'entity_mismatch',
      message: c.extracted.flags.join(', '),
      actionId: c.action_id
    }));

  return {
    connectedSources: sources || [],
    pendingEvidence: pendingEvidence || [],
    conflicts: formattedConflicts
  };
}

/**
 * List actions for a startup.
 */
async function listActions(startupId, filters = {}) {
  const supabase = getSupabaseClient();
  const { status, limit = 25, offset = 0 } = filters;

  let query = supabase
    .from('action_events_v2')
    .select(`
      *,
      verification_states_v2 (
        current_verification,
        tier,
        satisfied,
        missing
      )
    `)
    .eq('startup_id', startupId)
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list actions: ${error.message}`);
  }

  return {
    actions: data || [],
    total: count,
    hasMore: (data?.length || 0) === limit
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Step 0: Intake
  submitAction,
  computeVerificationPlan,
  
  // Step 1: Evidence
  submitEvidence,
  updateVerificationState,
  applyVerifiedLift,
  
  // Step 2: Resolution
  resolveInconsistency,
  
  // Scorecard
  getScorecard,
  getEvidenceCenter,
  listActions,
  
  // Constants
  ACTION_TYPES,
  BLOCKER_IDS,
  BLOCKER_CONFIG,
  ACTION_FEATURE_MAP,
  
  // Helpers
  getVerificationMultiplier,
  getTierFromVerification,
  computeFreshness
};
