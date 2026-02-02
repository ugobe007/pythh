/**
 * Canonical Verification API Routes
 * 
 * Locked API surface (do not change paths or response shapes):
 * - GET  /api/scorecard/:startupId
 * - POST /api/actions
 * - POST /api/actions/preview (dry-run)
 * - POST /api/evidence/upload
 * - POST /api/webhooks/stripe
 */

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');

// ============================================================================
// CONSTANTS (locked)
// ============================================================================

const VERIFICATION_TIERS = {
  UNVERIFIED: { name: 'unverified', threshold: 0, multiplier: 0.20 },
  SOFT_VERIFIED: { name: 'soft_verified', threshold: 0.35, multiplier: 0.45 },
  VERIFIED: { name: 'verified', threshold: 0.65, multiplier: 0.85 },
  TRUSTED: { name: 'trusted', threshold: 0.85, multiplier: 1.0 }
};

const VERIFICATION_SCORES = {
  OAUTH_CONNECTOR: 0.35,  // stripe, github, ga4, etc.
  WEBHOOK_EVENT: 0.35,    // authoritative confirmation
  DOC_PROOF: 0.20,        // uploaded document with hash
  PUBLIC_LINK: 0.10,      // public URL (verifiable later)
  BASE: 0.20              // starting score for any action
};

// Evidence type to verification boost mapping
const EVIDENCE_TYPE_BOOST = {
  document_upload: 0.20,
  public_link: 0.10,
  oauth_connector: 0.35,
  webhook_event: 0.35
};

const IMPACT_MULTIPLIERS = {
  low: 0.5,
  medium: 1.0,
  high: 1.5
};

const ACTION_FEATURE_MAP = {
  revenue_change: 'traction',
  customer_closed: 'traction',
  product_release: 'product_quality',
  hiring: 'team_strength',
  press: 'market_belief_shift',
  partnership: 'capital_convergence',
  fundraising: 'investor_intent',
  investor_meeting: 'investor_intent',
  other: 'founder_velocity'
};

const FEATURE_WEIGHTS = {
  traction: 0.20,
  founder_velocity: 0.15,
  investor_intent: 0.15,
  market_belief_shift: 0.10,
  capital_convergence: 0.10,
  team_strength: 0.15,
  product_quality: 0.10,
  market_size: 0.05
};

// Canonical blocker IDs
const BLOCKER_CONFIG = {
  identity_not_verified: {
    severity: 'hard',
    message: 'Founder identity not verified',
    fixPath: '/settings/verify-identity'
  },
  evidence_insufficient: {
    severity: 'soft',
    message: 'Key claims lack supporting evidence',
    fixPath: '/evidence/upload'
  },
  recency_gap: {
    severity: 'soft',
    message: 'No updates in 30+ days',
    fixPath: '/actions/new'
  },
  inconsistency_detected: {
    severity: 'hard',
    message: 'Conflicting data detected',
    fixPath: '/evidence/resolve'
  },
  missing_required_connectors: {
    severity: 'soft',
    message: 'Revenue claims require Stripe connection',
    fixPath: '/settings/connectors'
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTierFromVerification(verification) {
  if (verification >= VERIFICATION_TIERS.TRUSTED.threshold) return 'trusted';
  if (verification >= VERIFICATION_TIERS.VERIFIED.threshold) return 'verified';
  if (verification >= VERIFICATION_TIERS.SOFT_VERIFIED.threshold) return 'soft_verified';
  return 'unverified';
}

function getTierMultiplier(tier) {
  const config = Object.values(VERIFICATION_TIERS).find(t => t.name === tier);
  return config?.multiplier ?? 0.20;
}

function computeVerificationPlan(actionType, fields) {
  const requirements = [];
  
  // Revenue actions need Stripe or bank proof
  if (['revenue_change', 'customer_closed'].includes(actionType)) {
    requirements.push(
      { kind: 'connect', provider: 'stripe', weight: 0.40, satisfied: false },
      { kind: 'upload', doc: 'invoice', weight: 0.15, satisfied: false }
    );
  }
  
  // Product releases need GitHub or public link
  if (actionType === 'product_release') {
    requirements.push(
      { kind: 'connect', provider: 'github', weight: 0.40, satisfied: false },
      { kind: 'link', urlType: 'release_notes', weight: 0.15, satisfied: false }
    );
  }
  
  // Hiring needs offer letter or LinkedIn
  if (actionType === 'hiring') {
    requirements.push(
      { kind: 'upload', doc: 'offer_letter', weight: 0.25, satisfied: false },
      { kind: 'link', urlType: 'linkedin', weight: 0.15, satisfied: false }
    );
  }
  
  // Press needs public link
  if (actionType === 'press') {
    requirements.push(
      { kind: 'link', urlType: 'article', weight: 0.40, satisfied: false }
    );
  }
  
  // Fundraising needs term sheet or bank proof
  if (actionType === 'fundraising') {
    requirements.push(
      { kind: 'upload', doc: 'term_sheet', weight: 0.30, satisfied: false },
      { kind: 'connect', provider: 'plaid', weight: 0.25, satisfied: false }
    );
  }
  
  // Default: manual review
  if (requirements.length === 0) {
    requirements.push(
      { kind: 'review', level: 'manual', weight: 0.40, satisfied: false }
    );
  }
  
  return {
    requirements,
    targetVerification: 0.85,
    verificationWindowDays: 14
  };
}

async function getConnectedSources(supabase, startupId) {
  const { data } = await supabase
    .from('connected_sources_v2')
    .select('provider, status, last_sync_at')
    .eq('startup_id', startupId);
  
  return data || [];
}

async function checkActiveBlockers(supabase, startupId) {
  const blockers = [];
  
  // Check for recent activity
  const { data: recentActions } = await supabase
    .from('action_events_v2')
    .select('id')
    .eq('startup_id', startupId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  
  if (!recentActions?.length) {
    blockers.push({
      id: 'recency_gap',
      ...BLOCKER_CONFIG.recency_gap
    });
  }
  
  // Check for unverified revenue claims without Stripe
  const { data: revenueActions } = await supabase
    .from('action_events_v2')
    .select('id, status')
    .eq('startup_id', startupId)
    .in('type', ['revenue_change', 'customer_closed'])
    .eq('status', 'pending')
    .limit(1);
  
  const sources = await getConnectedSources(supabase, startupId);
  const hasStripe = sources.some(s => s.provider === 'stripe' && s.status === 'connected');
  
  if (revenueActions?.length && !hasStripe) {
    blockers.push({
      id: 'missing_required_connectors',
      ...BLOCKER_CONFIG.missing_required_connectors
    });
  }
  
  // Check for pending evidence
  const { data: pendingVerification } = await supabase
    .from('verification_states_v2')
    .select('action_id, current_verification')
    .lt('current_verification', 0.35)
    .limit(3);
  
  if (pendingVerification?.length >= 2) {
    blockers.push({
      id: 'evidence_insufficient',
      ...BLOCKER_CONFIG.evidence_insufficient
    });
  }
  
  return blockers;
}

// ============================================================================
// GET /api/scorecard/:startupId
// Returns latest snapshot + delta + blockers + movers
// ============================================================================

router.get('/scorecard/:startupId', async (req, res) => {
  try {
    const { startupId } = req.params;
    const supabase = getSupabaseClient();
    
    // 1. Get startup basic info
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Startup not found' }
      });
    }
    
    // 2. Get latest snapshot
    const { data: snapshots } = await supabase
      .from('score_snapshots_v2')
      .select('*')
      .eq('startup_id', startupId)
      .order('as_of', { ascending: false })
      .limit(2);
    
    const latestSnapshot = snapshots?.[0];
    const prevSnapshot = snapshots?.[1];
    
    // 3. Get latest delta
    const { data: deltas } = await supabase
      .from('score_deltas_v2')
      .select('*')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const latestDelta = deltas?.[0];
    
    // 4. Compute signal score from features or use snapshot
    const signalScore = latestSnapshot?.total_signal ?? (
      (startup.team_score || 0) * 0.15 +
      (startup.traction_score || 0) * 0.20 +
      (startup.market_score || 0) * 0.10 +
      (startup.product_score || 0) * 0.10 +
      (startup.vision_score || 0) * 0.10
    ) * 100 / 65; // Normalize to ~0-100
    
    const godScore = startup.total_god_score || 0;
    
    // 5. Compute deltas
    const signalDelta = latestDelta?.delta_signal ?? (
      prevSnapshot ? (latestSnapshot?.total_signal ?? signalScore) - prevSnapshot.total_signal : 0
    );
    const godDelta = latestDelta?.delta_god ?? 0;
    
    // 6. Get top movers from delta or compute
    let movers = [];
    if (latestDelta?.top_movers?.length) {
      movers = latestDelta.top_movers.slice(0, 3);
    } else {
      // Compute basic movers from component scores
      const features = [
        { featureId: 'traction', label: 'Traction', value: startup.traction_score || 0 },
        { featureId: 'team_strength', label: 'Team', value: startup.team_score || 0 },
        { featureId: 'market_belief_shift', label: 'Market', value: startup.market_score || 0 },
        { featureId: 'product_quality', label: 'Product', value: startup.product_score || 0 }
      ];
      
      movers = features
        .filter(f => f.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
        .map(f => ({
          featureId: f.featureId,
          label: f.label,
          delta: f.value * 0.1, // Placeholder delta
          reasons: ['baseline_score'],
          evidenceCount: 0
        }));
    }
    
    // 7. Get blockers
    const blockers = await checkActiveBlockers(supabase, startupId);
    
    // 8. Get connected sources
    const sources = await getConnectedSources(supabase, startupId);
    
    // 9. Compute badges
    const { data: verificationStates } = await supabase
      .from('verification_states_v2')
      .select('current_verification')
      .eq('action_id', startupId);
    
    const avgVerification = verificationStates?.length 
      ? verificationStates.reduce((sum, v) => sum + v.current_verification, 0) / verificationStates.length
      : 0.20;
    
    // Freshness: days since last action
    const { data: lastAction } = await supabase
      .from('action_events_v2')
      .select('created_at')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const daysSinceLastAction = lastAction?.[0]
      ? Math.floor((Date.now() - new Date(lastAction[0].created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    const freshness = Math.max(0, Math.min(1, 1 - (daysSinceLastAction / 30)));
    
    // 10. Build history
    const { data: allSnapshots } = await supabase
      .from('score_snapshots_v2')
      .select('as_of, total_signal, total_god')
      .eq('startup_id', startupId)
      .order('as_of', { ascending: false })
      .limit(10);
    
    const history = (allSnapshots || []).map(s => ({
      asOf: s.as_of,
      signal: s.total_signal,
      god: s.total_god
    }));
    
    // 11. Return canonical response
    return res.json({
      ok: true,
      data: {
        snapshot: {
          id: latestSnapshot?.id ?? null,
          startupId,
          asOf: latestSnapshot?.as_of ?? new Date().toISOString(),
          features: latestSnapshot?.features ?? {},
          totalSignal: signalScore,
          totalGod: godScore
        },
        lastDelta: latestDelta ? {
          id: latestDelta.id,
          deltaSignal: latestDelta.delta_signal,
          deltaGod: latestDelta.delta_god,
          topMovers: latestDelta.top_movers,
          blockers: latestDelta.blockers,
          createdAt: latestDelta.created_at
        } : null,
        
        // ScorecardVM shape
        signal: { value: signalScore, delta: signalDelta },
        god: { value: godScore, delta: godDelta },
        
        badges: {
          confidence: 0.7, // Placeholder
          verification: avgVerification,
          freshness: freshness,
          updatedAt: latestSnapshot?.as_of ?? new Date().toISOString()
        },
        
        movers: movers.map(m => ({
          label: m.label || m.featureId,
          delta: m.delta,
          chips: m.reasons || [],
          evidenceCount: m.evidenceCount || 0,
          onClickEvidencePath: `/startups/${startupId}/evidence`
        })),
        
        blockers: blockers.map(b => ({
          id: b.id,
          severity: b.severity,
          message: b.message,
          ctaLabel: b.severity === 'hard' ? 'Fix Now' : 'Improve',
          ctaPath: b.fixPath
        })),
        
        sources: sources.map(s => ({
          provider: s.provider,
          status: s.status,
          lastSync: s.last_sync_at
        })),
        
        actions: {
          refreshPath: `/api/scorecard/${startupId}`,
          reportActionPath: `/api/actions`,
          connectSourcesPath: `/settings/connectors`
        },
        
        history
      }
    });
  } catch (err) {
    console.error('GET /api/scorecard error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// POST /api/actions/preview
// DRY-RUN: Returns provisionalDeltaEstimate + verificationPlan without persisting
// ============================================================================

router.post('/actions/preview', async (req, res) => {
  console.log('[Canonical] POST /actions/preview hit, body:', JSON.stringify(req.body));
  try {
    const { startupId, type, title, impactGuess, fields } = req.body;
    
    // Validate required fields
    if (!startupId || !type) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: startupId, type' }
      });
    }
    
    const supabase = getSupabaseClient();
    
    // 1. Verify startup exists and get current scores
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Startup not found' }
      });
    }
    
    // 2. Get latest snapshot for current scores
    const { data: existingSnapshot } = await supabase
      .from('score_snapshots_v2')
      .select('total_signal, total_god')
      .eq('startup_id', startupId)
      .order('as_of', { ascending: false })
      .limit(1);
    
    const prevSnapshot = existingSnapshot?.[0];
    const currentSignal = prevSnapshot?.total_signal ?? (startup.total_god_score * 0.8) ?? 50;
    const currentGod = prevSnapshot?.total_god ?? startup.total_god_score ?? 50;
    
    // 3. Compute verification plan
    const verificationPlan = computeVerificationPlan(type, fields);
    
    // 4. Compute provisional delta (same logic as POST /api/actions)
    const featureId = ACTION_FEATURE_MAP[type] || 'founder_velocity';
    const featureWeight = FEATURE_WEIGHTS[featureId] || 0.10;
    const impactMultiplier = IMPACT_MULTIPLIERS[impactGuess || 'medium'] || 1.0;
    const verificationMultiplier = 0.35; // Provisional cap (unverified)
    
    const baseImpact = 5; // Base points for any action
    const provisionalDelta = baseImpact * featureWeight * impactMultiplier * verificationMultiplier;
    
    // 5. Compute potential verified delta (if all evidence provided)
    const verifiedMultiplier = 0.80; // Verified tier
    const verifiedDelta = baseImpact * featureWeight * impactMultiplier * verifiedMultiplier;
    
    // 6. Return preview response
    return res.json({
      ok: true,
      data: {
        preview: true,
        startupId,
        actionType: type,
        
        // Current scores
        currentScores: {
          signal: currentSignal,
          god: currentGod
        },
        
        // Provisional (immediate after submission)
        provisional: {
          deltaSignal: provisionalDelta,
          deltaGod: provisionalDelta * 0.25,
          newSignal: currentSignal + provisionalDelta,
          newGod: currentGod + (provisionalDelta * 0.25),
          tier: 'unverified',
          multiplier: verificationMultiplier,
          cap: 'Capped at 35% until evidence provided'
        },
        
        // Potential (after full verification)
        potential: {
          deltaSignal: verifiedDelta,
          deltaGod: verifiedDelta * 0.25,
          newSignal: currentSignal + verifiedDelta,
          newGod: currentGod + (verifiedDelta * 0.25),
          tier: 'verified',
          multiplier: verifiedMultiplier,
          unlockMessage: 'Provide required evidence to unlock full impact'
        },
        
        // Verification requirements
        verificationPlan: {
          requirements: verificationPlan.requirements.map(r => ({
            kind: r.kind,
            label: r.label,
            description: r.description,
            boostAmount: r.boostAmount || 0.15
          })),
          totalRequirements: verificationPlan.requirements.length,
          estimatedTimeToVerify: `${verificationPlan.requirements.length * 2}-${verificationPlan.requirements.length * 5} minutes`
        },
        
        // Feature impacted
        feature: {
          id: featureId,
          label: featureId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          weight: featureWeight,
          impactCategory: impactGuess || 'medium'
        }
      }
    });
  } catch (err) {
    console.error('POST /api/actions/preview error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// POST /api/actions
// Creates ActionEvent, computes VerificationPlan, applies provisional score
// ============================================================================

router.post('/actions', async (req, res) => {
  try {
    const { startupId, type, title, details, occurredAt, impactGuess, fields } = req.body;
    
    // Validate required fields
    if (!startupId || !type || !title) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: startupId, type, title' }
      });
    }
    
    const supabase = getSupabaseClient();
    
    // 1. Verify startup exists
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Startup not found' }
      });
    }
    
    // 2. Compute verification plan
    const verificationPlan = computeVerificationPlan(type, fields);
    
    // 3. Create action event
    const { data: action, error: actionError } = await supabase
      .from('action_events_v2')
      .insert({
        startup_id: startupId,
        type,
        title,
        details: details || null,
        occurred_at: occurredAt || new Date().toISOString(),
        impact_guess: impactGuess || 'medium',
        fields: fields || {},
        verification_plan: verificationPlan,
        status: 'pending'
      })
      .select()
      .single();
    
    if (actionError) {
      console.error('Failed to create action:', actionError);
      return res.status(500).json({
        ok: false,
        error: { code: 'DB_ERROR', message: 'Failed to create action' }
      });
    }
    
    // 4. Create verification state
    const { data: verificationState, error: vsError } = await supabase
      .from('verification_states_v2')
      .insert({
        action_id: action.id,
        current_verification: VERIFICATION_SCORES.BASE,
        tier: 'unverified',
        satisfied: false,
        missing: verificationPlan.requirements
      })
      .select()
      .single();
    
    if (vsError) {
      console.error('Failed to create verification state:', vsError);
    }
    
    // 5. Compute provisional delta
    const featureId = ACTION_FEATURE_MAP[type] || 'founder_velocity';
    const featureWeight = FEATURE_WEIGHTS[featureId] || 0.10;
    const impactMultiplier = IMPACT_MULTIPLIERS[impactGuess] || 1.0;
    const verificationMultiplier = 0.35; // Provisional cap
    
    // Provisional delta = base_impact * feature_weight * impact_multiplier * verification_cap
    const baseImpact = 5; // Base points for any action
    const provisionalDelta = baseImpact * featureWeight * impactMultiplier * verificationMultiplier;
    
    // 6. Get or create latest snapshot
    const { data: existingSnapshot } = await supabase
      .from('score_snapshots_v2')
      .select('*')
      .eq('startup_id', startupId)
      .order('as_of', { ascending: false })
      .limit(1);
    
    const prevSnapshot = existingSnapshot?.[0];
    const prevSignal = prevSnapshot?.total_signal ?? (startup.total_god_score * 0.8) ?? 50;
    const prevGod = prevSnapshot?.total_god ?? startup.total_god_score ?? 50;
    
    // 7. Create new snapshot
    const newSignal = prevSignal + provisionalDelta;
    const newGod = prevGod + (provisionalDelta * 0.25); // GOD moves slower
    
    const features = prevSnapshot?.features ?? {};
    features[featureId] = {
      value: (features[featureId]?.value ?? 0) + provisionalDelta,
      verification: 0.35,
      lastUpdated: new Date().toISOString()
    };
    
    const { data: newSnapshot, error: snapError } = await supabase
      .from('score_snapshots_v2')
      .insert({
        startup_id: startupId,
        as_of: new Date().toISOString(),
        features,
        total_signal: newSignal,
        total_god: newGod
      })
      .select()
      .single();
    
    if (snapError) {
      console.error('Failed to create snapshot:', snapError);
    }
    
    // 8. Create score delta
    const { data: scoreDelta, error: deltaError } = await supabase
      .from('score_deltas_v2')
      .insert({
        startup_id: startupId,
        prev_snapshot_id: prevSnapshot?.id ?? null,
        next_snapshot_id: newSnapshot?.id ?? null,
        delta_signal: provisionalDelta,
        delta_god: provisionalDelta * 0.25,
        top_movers: [{
          featureId,
          label: featureId.replace(/_/g, ' '),
          delta: provisionalDelta,
          reasons: ['action_reported', 'provisional'],
          evidenceCount: 0
        }],
        blockers: []
      })
      .select()
      .single();
    
    if (deltaError) {
      console.error('Failed to create delta:', deltaError);
    }
    
    // 9. Link delta to action
    if (scoreDelta) {
      await supabase
        .from('action_events_v2')
        .update({
          provisional_delta_id: scoreDelta.id,
          status: 'provisional_applied'
        })
        .eq('id', action.id);
    }
    
    // 10. Return response
    return res.json({
      ok: true,
      data: {
        action: {
          id: action.id,
          startupId: action.startup_id,
          type: action.type,
          title: action.title,
          details: action.details,
          occurredAt: action.occurred_at,
          submittedAt: action.submitted_at,
          impactGuess: action.impact_guess,
          fields: action.fields,
          verificationPlan: action.verification_plan,
          status: 'provisional_applied'
        },
        verificationState: verificationState ? {
          actionId: verificationState.action_id,
          currentVerification: verificationState.current_verification,
          tier: verificationState.tier,
          satisfied: verificationState.satisfied,
          missing: verificationState.missing
        } : null,
        delta: scoreDelta ? {
          id: scoreDelta.id,
          deltaSignal: scoreDelta.delta_signal,
          deltaGod: scoreDelta.delta_god,
          topMovers: scoreDelta.top_movers,
          provisional: true
        } : null,
        nextSteps: {
          message: 'Action submitted with provisional lift. Add evidence to unlock full impact.',
          requirements: verificationPlan.requirements.filter(r => !r.satisfied)
        }
      }
    });
  } catch (err) {
    console.error('POST /api/actions error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// POST /api/evidence/upload
// Uploads doc proof + links to action (optional)
// ============================================================================

router.post('/evidence/upload', async (req, res) => {
  try {
    const { startupId, actionId, type, ref, meta } = req.body;
    
    if (!startupId || !type || !ref) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: startupId, type, ref' }
      });
    }
    
    const supabase = getSupabaseClient();
    
    // 1. Create evidence artifact (store meta in ref.meta if provided)
    const refWithMeta = meta ? { ...ref, meta } : ref;
    
    const { data: evidence, error: evError } = await supabase
      .from('evidence_artifacts_v2')
      .insert({
        startup_id: startupId,
        action_id: actionId || null,
        type,
        ref: refWithMeta,
        tier: 'unverified',
        confidence: 0.5
      })
      .select()
      .single();
    
    if (evError) {
      console.error('Failed to create evidence:', evError);
      return res.status(500).json({
        ok: false,
        error: { code: 'DB_ERROR', message: 'Failed to create evidence' }
      });
    }
    
    // 2. Find action to link (direct link or time-based matching)
    let linkedActionId = actionId;
    let matchedAction = null;
    
    if (!linkedActionId && meta?.occurredAt) {
      // Try to match by time window (±21 days) + entity match
      const occurredAt = new Date(meta.occurredAt);
      const windowStart = new Date(occurredAt.getTime() - 21 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(occurredAt.getTime() + 21 * 24 * 60 * 60 * 1000);
      
      const { data: candidateActions } = await supabase
        .from('action_events_v2')
        .select('*')
        .eq('startup_id', startupId)
        .gte('occurred_at', windowStart.toISOString())
        .lte('occurred_at', windowEnd.toISOString())
        .in('status', ['pending', 'provisional_applied']);
      
      // Score candidates by match quality
      if (candidateActions?.length) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const action of candidateActions) {
          let matchScore = 0.5; // Base time window match
          
          // Customer name match
          if (meta.customerName && action.fields?.customerName) {
            const metaName = meta.customerName.toLowerCase();
            const actionName = action.fields.customerName.toLowerCase();
            if (metaName === actionName || metaName.includes(actionName) || actionName.includes(metaName)) {
              matchScore += 0.3;
            }
          }
          
          // Amount tolerance (±15%)
          if (meta.amountUsd && action.fields?.mrrDeltaUsd) {
            const diff = Math.abs(meta.amountUsd - action.fields.mrrDeltaUsd);
            const tolerance = action.fields.mrrDeltaUsd * 0.15;
            if (diff <= tolerance) {
              matchScore += 0.2;
            }
          }
          
          if (matchScore > bestScore) {
            bestScore = matchScore;
            bestMatch = action;
          }
        }
        
        if (bestMatch && bestScore >= 0.5) {
          linkedActionId = bestMatch.id;
          matchedAction = bestMatch;
          
          // Update evidence with matched action
          await supabase
            .from('evidence_artifacts_v2')
            .update({ action_id: linkedActionId })
            .eq('id', evidence.id);
        }
      }
    }
    
    // 3. Update verification state if action is linked
    let verificationState = null;
    let emittedDelta = null;
    let tierUpgraded = false;
    
    if (linkedActionId) {
      // Get current verification state
      const { data: vs } = await supabase
        .from('verification_states_v2')
        .select('*')
        .eq('action_id', linkedActionId)
        .single();
      
      if (vs) {
        const previousTier = vs.tier;
        const evidenceBoost = EVIDENCE_TYPE_BOOST[type] || 0.10;
        
        // Calculate new verification score
        const newVerification = Math.min(1.0, vs.current_verification + evidenceBoost);
        const newTier = getTierFromVerification(newVerification);
        
        // Update missing requirements
        const missing = (vs.missing || []).map(m => {
          if (m.kind === 'upload' && type === 'document_upload' && !m.satisfied) {
            return { ...m, satisfied: true };
          }
          if (m.kind === 'connect' && type === 'oauth_connector' && !m.satisfied) {
            return { ...m, satisfied: true };
          }
          return m;
        });
        
        const satisfied = missing.every(m => m.satisfied) || newVerification >= 0.65;
        
        // Update verification state
        await supabase
          .from('verification_states_v2')
          .update({
            current_verification: newVerification,
            tier: newTier,
            satisfied,
            missing,
            matched_evidence_ids: [...(vs.matched_evidence_ids || []), evidence.id]
          })
          .eq('action_id', linkedActionId);
        
        verificationState = {
          tier: newTier,
          score: newVerification,
          previousTier,
          satisfied,
          missing: missing.filter(m => !m.satisfied)
        };
        
        tierUpgraded = newTier !== previousTier && 
          ['soft_verified', 'verified', 'trusted'].indexOf(newTier) > 
          ['unverified', 'soft_verified', 'verified', 'trusted'].indexOf(previousTier);
        
        // 4. Emit verified delta if tier crossed threshold or significant score increase
        const shouldEmitDelta = 
          (newTier === 'verified' && previousTier !== 'verified' && previousTier !== 'trusted') ||
          (newTier === 'trusted' && previousTier !== 'trusted') ||
          (evidenceBoost >= 0.20 && newVerification >= 0.65);
        
        if (shouldEmitDelta) {
          // Get the action to know which feature
          const { data: action } = await supabase
            .from('action_events_v2')
            .select('*')
            .eq('id', linkedActionId)
            .single();
          
          if (action) {
            const featureId = ACTION_FEATURE_MAP[action.type] || 'founder_velocity';
            const featureWeight = FEATURE_WEIGHTS[featureId] || 0.10;
            const impactMultiplier = IMPACT_MULTIPLIERS[action.impact_guess] || 1.0;
            
            // Verification upgrade lift = remaining potential from provisional
            // provisional was at 0.35 multiplier, now at tier multiplier
            const tierMultiplier = getTierMultiplier(newTier);
            const additionalMultiplier = tierMultiplier - 0.35;
            
            const verifiedLift = 5 * featureWeight * impactMultiplier * additionalMultiplier;
            
            // Get previous snapshot for linking
            const { data: prevSnapshot } = await supabase
              .from('score_snapshots_v2')
              .select('id, total_signal, total_god')
              .eq('startup_id', startupId)
              .order('as_of', { ascending: false })
              .limit(1)
              .single();
            
            // Create new snapshot
            const newSignal = (prevSnapshot?.total_signal || 50) + verifiedLift;
            const newGod = (prevSnapshot?.total_god || 50) + (verifiedLift * 0.25);
            
            const { data: newSnapshot } = await supabase
              .from('score_snapshots_v2')
              .insert({
                startup_id: startupId,
                as_of: new Date().toISOString(),
                features: {},
                total_signal: newSignal,
                total_god: newGod
              })
              .select()
              .single();
            
            // Create verified delta
            const { data: delta } = await supabase
              .from('score_deltas_v2')
              .insert({
                startup_id: startupId,
                prev_snapshot_id: prevSnapshot?.id || null,
                next_snapshot_id: newSnapshot?.id || null,
                delta_signal: verifiedLift,
                delta_god: verifiedLift * 0.25,
                top_movers: [{
                  featureId,
                  label: featureId.replace(/_/g, ' '),
                  delta: verifiedLift,
                  reasons: ['verification_upgraded', 'evidence_added'],
                  evidenceCount: 1,
                  verificationChanged: true
                }],
                blockers: []
              })
              .select()
              .single();
            
            emittedDelta = delta ? {
              id: delta.id,
              deltaSignal: delta.delta_signal,
              deltaGod: delta.delta_god,
              reason: 'verification_upgraded'
            } : null;
            
            // Update action status
            await supabase
              .from('action_events_v2')
              .update({ 
                status: newTier === 'verified' || newTier === 'trusted' ? 'verified' : 'soft_verified',
                verified_delta_id: delta?.id || null
              })
              .eq('id', linkedActionId);
          }
        }
      }
    }
    
    return res.json({
      ok: true,
      data: {
        evidenceId: evidence.id,
        evidence: {
          id: evidence.id,
          startupId: evidence.startup_id,
          actionId: linkedActionId,
          type: evidence.type,
          ref: evidence.ref,
          tier: evidence.tier,
          confidence: evidence.confidence,
          createdAt: evidence.created_at
        },
        verification: verificationState || {
          tier: 'unverified',
          score: VERIFICATION_SCORES.BASE,
          missing: [],
          note: 'Evidence not linked to any action'
        },
        emittedDelta,
        matched: !!linkedActionId,
        tierUpgraded
      }
    });
  } catch (err) {
    console.error('POST /api/evidence/upload error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// POST /api/webhooks/stripe
// Stripe event → creates EvidenceArtifact → matches actions → upgrades
// ============================================================================

router.post('/webhooks/stripe', async (req, res) => {
  try {
    const event = req.body;
    const supabase = getSupabaseClient();
    
    // Validate event structure
    if (!event.type || !event.data?.object) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_EVENT', message: 'Invalid Stripe event structure' }
      });
    }
    
    const matchedActions = [];
    const deltasEmitted = [];
    
    // Handle relevant event types
    const relevantEvents = ['invoice.paid', 'payment_intent.succeeded', 'customer.subscription.created'];
    
    if (!relevantEvents.includes(event.type)) {
      return res.json({
        ok: true,
        data: { processed: true, matchedActions: [], deltasEmitted: [], skipped: true }
      });
    }
    
    // Extract data from event
    const eventData = event.data.object;
    const amount = eventData.amount_paid || eventData.amount || 0;
    const customerId = eventData.customer;
    const customerEmail = eventData.customer_email;
    
    // Find matching startup by connected source
    const { data: sources } = await supabase
      .from('connected_sources_v2')
      .select('startup_id')
      .eq('provider', 'stripe')
      .eq('status', 'connected');
    
    if (!sources?.length) {
      return res.json({
        ok: true,
        data: { processed: true, matchedActions: [], deltasEmitted: [], noMatchingStartup: true }
      });
    }
    
    for (const source of sources) {
      const startupId = source.startup_id;
      
      // 1. Create evidence artifact from webhook
      const { data: evidence } = await supabase
        .from('evidence_artifacts_v2')
        .insert({
          startup_id: startupId,
          type: 'webhook_event',
          ref: {
            provider: 'stripe',
            providerEventId: event.id,
            hash: `stripe:${event.id}`
          },
          extracted: {
            amounts: { usd: amount / 100, currency: 'USD' },
            dates: { occurredAt: new Date(eventData.created * 1000).toISOString() }
          },
          tier: 'verified',
          confidence: 0.95
        })
        .select()
        .single();
      
      // 2. Find matching actions (same startup, revenue type, within time window)
      const eventDate = new Date(eventData.created * 1000);
      const windowStart = new Date(eventDate.getTime() - 21 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(eventDate.getTime() + 21 * 24 * 60 * 60 * 1000);
      
      const { data: actions } = await supabase
        .from('action_events_v2')
        .select('*')
        .eq('startup_id', startupId)
        .in('type', ['revenue_change', 'customer_closed'])
        .gte('occurred_at', windowStart.toISOString())
        .lte('occurred_at', windowEnd.toISOString())
        .neq('status', 'verified');
      
      for (const action of (actions || [])) {
        // Check amount tolerance (±15%)
        const actionAmount = action.fields?.mrrDeltaUsd || action.fields?.amount || 0;
        const tolerance = actionAmount * 0.15;
        const eventAmountUsd = amount / 100;
        
        const amountMatches = actionAmount === 0 || 
          (eventAmountUsd >= actionAmount - tolerance && eventAmountUsd <= actionAmount + tolerance);
        
        if (amountMatches) {
          matchedActions.push(action.id);
          
          // Update verification state
          const { data: vs } = await supabase
            .from('verification_states_v2')
            .select('*')
            .eq('action_id', action.id)
            .single();
          
          if (vs) {
            const newVerification = Math.min(1.0, 
              vs.current_verification + VERIFICATION_SCORES.OAUTH_CONNECTOR + VERIFICATION_SCORES.WEBHOOK_EVENT
            );
            const newTier = getTierFromVerification(newVerification);
            
            await supabase
              .from('verification_states_v2')
              .update({
                current_verification: newVerification,
                tier: newTier,
                satisfied: newVerification >= 0.65,
                matched_evidence_ids: [...(vs.matched_evidence_ids || []), evidence.id]
              })
              .eq('action_id', action.id);
            
            // Emit verified delta if tier crossed
            if (newTier === 'verified' && vs.tier !== 'verified') {
              const featureId = ACTION_FEATURE_MAP[action.type] || 'traction';
              const verifiedLift = 5 * FEATURE_WEIGHTS[featureId] * IMPACT_MULTIPLIERS[action.impact_guess] * 0.50;
              
              const { data: delta } = await supabase
                .from('score_deltas_v2')
                .insert({
                  startup_id: startupId,
                  delta_signal: verifiedLift,
                  delta_god: verifiedLift * 0.35,
                  top_movers: [{
                    featureId,
                    label: featureId.replace(/_/g, ' '),
                    delta: verifiedLift,
                    reasons: ['verification_changed', 'webhook_confirmed'],
                    evidenceCount: 1
                  }],
                  blockers: []
                })
                .select()
                .single();
              
              if (delta) deltasEmitted.push(delta.id);
              
              // Update action
              await supabase
                .from('action_events_v2')
                .update({ 
                  status: 'verified',
                  verified_delta_id: delta?.id 
                })
                .eq('id', action.id);
            }
          }
        }
      }
    }
    
    return res.json({
      ok: true,
      data: {
        processed: true,
        matchedActions,
        deltasEmitted
      }
    });
  } catch (err) {
    console.error('POST /api/webhooks/stripe error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// GET /api/evidence-center/:startupId
// Returns connected sources, pending evidence, and conflicts
// ============================================================================

router.get('/evidence-center/:startupId', async (req, res) => {
  try {
    const { startupId } = req.params;
    const supabase = getSupabaseClient();
    
    // 1. Get connected sources (create defaults if none exist)
    let { data: sources } = await supabase
      .from('connected_sources_v2')
      .select('*')
      .eq('startup_id', startupId);
    
    // If no sources, return default list of all providers
    const allProviders = ['stripe', 'ga4', 'github', 'plaid', 'hubspot', 'linear', 'notion'];
    const connectedSources = allProviders.map(provider => {
      const existing = sources?.find(s => s.provider === provider);
      return {
        provider,
        status: existing?.status || 'not_connected',
        lastSync: existing?.last_sync_at || null,
        error: null
      };
    });
    
    // 2. Get pending evidence (actions that need verification)
    const { data: pendingActions } = await supabase
      .from('action_events_v2')
      .select(`
        id,
        title,
        type,
        verification_plan
      `)
      .eq('startup_id', startupId)
      .in('status', ['pending', 'provisional_applied']);
    
    // Get verification states for these actions
    const actionIds = (pendingActions || []).map(a => a.id);
    const { data: verificationStates } = await supabase
      .from('verification_states_v2')
      .select('*')
      .in('action_id', actionIds);
    
    const pendingEvidence = (pendingActions || []).map(action => {
      const vs = verificationStates?.find(v => v.action_id === action.id);
      return {
        actionId: action.id,
        actionTitle: action.title,
        actionType: action.type,
        requirements: (vs?.missing || action.verification_plan?.requirements || []).map(r => ({
          kind: r.kind,
          provider: r.provider,
          doc: r.doc,
          urlType: r.urlType,
          satisfied: r.satisfied || false
        }))
      };
    }).filter(p => p.requirements.some(r => !r.satisfied));
    
    // 3. Get conflicts (actions with inconsistency)
    const { data: conflictActions } = await supabase
      .from('action_events_v2')
      .select('id, title')
      .eq('startup_id', startupId)
      .eq('status', 'needs_info');
    
    const conflicts = (conflictActions || []).map(action => ({
      id: `conflict-${action.id}`,
      actionId: action.id,
      actionTitle: action.title,
      issue: 'Inconsistent data detected. Please review and resolve.',
      severity: 'soft',
      options: ['Keep Original', 'Use New Data', 'Manual Review']
    }));
    
    // 4. Compute stats
    const { count: totalEvidence } = await supabase
      .from('evidence_artifacts_v2')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId);
    
    const { count: verifiedCount } = await supabase
      .from('action_events_v2')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId)
      .eq('status', 'verified');
    
    const { count: pendingCount } = await supabase
      .from('action_events_v2')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId)
      .in('status', ['pending', 'provisional_applied']);
    
    return res.json({
      ok: true,
      data: {
        connectedSources,
        pendingEvidence,
        conflicts,
        stats: {
          totalEvidence: totalEvidence || 0,
          verifiedActions: verifiedCount || 0,
          pendingActions: pendingCount || 0,
          activeConflicts: conflicts.length
        }
      }
    });
  } catch (err) {
    console.error('GET /api/evidence-center error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// POST /api/actions/:actionId/resolve
// Resolves an inconsistency for an action
// ============================================================================

router.post('/actions/:actionId/resolve', async (req, res) => {
  try {
    const { actionId } = req.params;
    const { choice, note } = req.body;
    const supabase = getSupabaseClient();
    
    // Update action status
    const { data: action, error } = await supabase
      .from('action_events_v2')
      .update({
        status: choice === 'Manual Review' ? 'needs_info' : 'pending',
        details: note ? `[Resolution: ${choice}] ${note}` : undefined
      })
      .eq('id', actionId)
      .select()
      .single();
    
    if (error) {
      return res.status(500).json({
        ok: false,
        error: { code: 'DB_ERROR', message: 'Failed to resolve action' }
      });
    }
    
    return res.json({
      ok: true,
      data: {
        action,
        resolved: true
      }
    });
  } catch (err) {
    console.error('POST /api/actions/:actionId/resolve error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// ============================================================================
// CONNECTORS - OAuth flows for Stripe, GitHub, GA4
// ============================================================================

/**
 * GET /api/connectors/:startupId/init/:provider
 * Returns OAuth URL for the provider
 * 
 * Response: { ok: true, data: { authUrl: "https://..." } }
 */
router.get('/connectors/:startupId/init/:provider', async (req, res) => {
  try {
    const { startupId, provider } = req.params;
    const validProviders = ['stripe', 'github', 'ga4'];
    
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PROVIDER', message: `Unsupported provider: ${provider}` }
      });
    }
    
    // Generate state token to prevent CSRF
    const state = Buffer.from(JSON.stringify({
      startupId,
      provider,
      ts: Date.now()
    })).toString('base64');
    
    // Store state in session/db for validation on callback
    // For now we'll validate by decoding (in production, store in redis/db)
    
    let authUrl;
    const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    const serverUrl = process.env.API_URL || 'http://localhost:3002';
    
    switch (provider) {
      case 'stripe':
        // Stripe Connect Express OAuth
        // https://stripe.com/docs/connect/express-accounts
        const stripeClientId = process.env.STRIPE_CLIENT_ID;
        if (!stripeClientId) {
          return res.status(503).json({
            ok: false,
            error: { code: 'NOT_CONFIGURED', message: 'Stripe OAuth not configured' }
          });
        }
        authUrl = `https://connect.stripe.com/oauth/authorize?` +
          `response_type=code&` +
          `client_id=${stripeClientId}&` +
          `scope=read_only&` +
          `redirect_uri=${encodeURIComponent(serverUrl + '/api/connectors/callback/stripe')}&` +
          `state=${state}`;
        break;
        
      case 'github':
        // GitHub OAuth
        const githubClientId = process.env.GITHUB_CLIENT_ID;
        if (!githubClientId) {
          return res.status(503).json({
            ok: false,
            error: { code: 'NOT_CONFIGURED', message: 'GitHub OAuth not configured' }
          });
        }
        authUrl = `https://github.com/login/oauth/authorize?` +
          `client_id=${githubClientId}&` +
          `scope=repo:status,read:org&` +
          `redirect_uri=${encodeURIComponent(serverUrl + '/api/connectors/callback/github')}&` +
          `state=${state}`;
        break;
        
      case 'ga4':
        // Google OAuth for GA4
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
          return res.status(503).json({
            ok: false,
            error: { code: 'NOT_CONFIGURED', message: 'Google OAuth not configured' }
          });
        }
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${googleClientId}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly')}&` +
          `redirect_uri=${encodeURIComponent(serverUrl + '/api/connectors/callback/ga4')}&` +
          `access_type=offline&` +
          `prompt=consent&` +
          `state=${state}`;
        break;
    }
    
    return res.json({
      ok: true,
      data: { authUrl }
    });
    
  } catch (err) {
    console.error('GET /api/connectors/:startupId/init/:provider error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

/**
 * GET /api/connectors/callback/:provider
 * OAuth callback handler
 * 
 * On success: redirects to /app/evidence-center?connected=:provider
 * On error: redirects to /app/evidence-center?error=:message
 */
router.get('/connectors/callback/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query;
    const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    
    // Handle OAuth errors
    if (oauthError) {
      return res.redirect(`${baseUrl}/app/evidence-center?error=${encodeURIComponent(oauthError)}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${baseUrl}/app/evidence-center?error=missing_params`);
    }
    
    // Decode and validate state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return res.redirect(`${baseUrl}/app/evidence-center?error=invalid_state`);
    }
    
    const { startupId, ts } = stateData;
    
    // Check state is not too old (15 minutes)
    if (Date.now() - ts > 15 * 60 * 1000) {
      return res.redirect(`${baseUrl}/app/evidence-center?error=expired_state`);
    }
    
    // Exchange code for tokens
    let tokens;
    const serverUrl = process.env.API_URL || 'http://localhost:3002';
    
    switch (provider) {
      case 'stripe':
        // Exchange Stripe code for access token
        const stripeResponse = await fetch('https://connect.stripe.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_secret: process.env.STRIPE_SECRET_KEY,
            code,
            grant_type: 'authorization_code'
          })
        });
        tokens = await stripeResponse.json();
        
        if (tokens.error) {
          console.error('Stripe OAuth error:', tokens);
          return res.redirect(`${baseUrl}/app/evidence-center?error=stripe_auth_failed`);
        }
        break;
        
      case 'github':
        // Exchange GitHub code for access token
        const ghResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: serverUrl + '/api/connectors/callback/github'
          })
        });
        tokens = await ghResponse.json();
        
        if (tokens.error) {
          console.error('GitHub OAuth error:', tokens);
          return res.redirect(`${baseUrl}/app/evidence-center?error=github_auth_failed`);
        }
        break;
        
      case 'ga4':
        // Exchange Google code for tokens
        const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: serverUrl + '/api/connectors/callback/ga4'
          })
        });
        tokens = await googleResponse.json();
        
        if (tokens.error) {
          console.error('Google OAuth error:', tokens);
          return res.redirect(`${baseUrl}/app/evidence-center?error=google_auth_failed`);
        }
        break;
        
      default:
        return res.redirect(`${baseUrl}/app/evidence-center?error=unknown_provider`);
    }
    
    // Store connector in database (using connected_sources_v2 for consistency)
    const { data: connector, error: dbError } = await supabase
      .from('connected_sources_v2')
      .upsert({
        startup_id: startupId,
        provider,
        status: 'connected',
        metadata: { tokens }, // Store tokens in metadata (encrypted in production)
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'startup_id,provider'
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Failed to store connector:', dbError);
      return res.redirect(`${baseUrl}/app/evidence-center?error=db_error`);
    }
    
    // Create oauth_connector evidence artifact
    const { error: evidenceError } = await supabase
      .from('evidence_artifacts_v2')
      .insert({
        startup_id: startupId,
        type: 'oauth_connector',
        ref: {
          provider,
          connectorId: connector.id,
          connectedAt: new Date().toISOString()
        },
        tier: 'verified',
        confidence: 0.9
      });
    
    if (evidenceError) {
      console.warn('Failed to create evidence artifact:', evidenceError);
      // Don't fail - connector is still connected
    }
    
    // Find matching revenue actions and update their verification
    if (provider === 'stripe') {
      const { data: revenueActions } = await supabase
        .from('action_events_v2')
        .select('id')
        .eq('startup_id', startupId)
        .in('type', ['revenue_change', 'contract_signed', 'new_customer', 'mrr_increase'])
        .eq('status', 'provisional_applied');
      
      if (revenueActions?.length) {
        // For each revenue action, check if we should emit a delta
        for (const action of revenueActions) {
          // Get current verification state
          const { data: verState } = await supabase
            .from('verification_states_v2')
            .select('*')
            .eq('action_id', action.id)
            .single();
          
          if (verState) {
            const oldScore = verState.verification_score || 0;
            const newScore = Math.min(1.0, oldScore + VERIFICATION_SCORES.OAUTH_CONNECTOR);
            const oldTier = getTierFromScore(oldScore);
            const newTier = getTierFromScore(newScore);
            
            // Update verification state
            await supabase
              .from('verification_states_v2')
              .update({
                verification_score: newScore,
                tier: newTier,
                updated_at: new Date().toISOString()
              })
              .eq('action_id', action.id);
            
            // Emit delta if crossed verified threshold
            if ((newTier === 'verified' || newTier === 'trusted') && oldTier !== 'verified' && oldTier !== 'trusted') {
              const deltaSignal = newScore;
              const deltaGod = newScore * 0.25;
              
              await supabase
                .from('score_deltas_v2')
                .insert({
                  startup_id: startupId,
                  action_id: action.id,
                  delta_signal: deltaSignal,
                  delta_god: deltaGod,
                  reason: 'oauth_connector_verified',
                  meta: {
                    provider,
                    connectorId: connector.id,
                    previousTier: oldTier,
                    newTier
                  }
                });
            }
          }
        }
      }
    }
    
    // Redirect to success
    return res.redirect(`${baseUrl}/app/evidence-center?connected=${provider}&startupId=${startupId}`);
    
  } catch (err) {
    console.error('GET /api/connectors/callback/:provider error:', err);
    const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    return res.redirect(`${baseUrl}/app/evidence-center?error=server_error`);
  }
});

/**
 * DELETE /api/connectors/:startupId/:provider
 * Disconnect a provider
 */
router.delete('/connectors/:startupId/:provider', async (req, res) => {
  try {
    const { startupId, provider } = req.params;
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('connected_sources_v2')
      .update({
        status: 'not_connected',
        metadata: null,
        updated_at: new Date().toISOString()
      })
      .eq('startup_id', startupId)
      .eq('provider', provider);
    
    if (error) {
      return res.status(500).json({
        ok: false,
        error: { code: 'DB_ERROR', message: 'Failed to disconnect' }
      });
    }
    
    return res.json({
      ok: true,
      data: { disconnected: true }
    });
    
  } catch (err) {
    console.error('DELETE /api/connectors error:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

module.exports = router;
