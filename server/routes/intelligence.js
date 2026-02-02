/**
 * INTELLIGENCE API ROUTES
 * =======================
 * Read-only endpoints for Pythh Brain v1 intelligence
 * 
 * Endpoints:
 * - GET /api/startup/resolve?url=... → { startup_id, exists }
 * - GET /api/matches/count?startup_id=... → { count }
 * - GET /api/intel/founder-profile?startup_id=... → founder intelligence object
 * - GET /api/intel/match-deltas?startup_id=...&investor_id=... → alignment differential
 */

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');

/**
 * GET /api/startup/resolve?url=...
 * Resolves a URL to a startup_id without creating records
 * READ-ONLY - no mutations
 */
router.get('/startup/resolve', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    const supabase = getSupabaseClient();
    
    // Normalize URL for lookup
    const normalizedUrl = url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    // Check if startup exists by website or canonical_key
    const { data: startup, error } = await supabase
      .from('startup_uploads')
      .select('id, name, website, total_god_score, status')
      .or(`website.ilike.%${normalizedUrl}%,canonical_key.eq.${normalizedUrl}`)
      .eq('status', 'approved')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[resolve] Error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (startup) {
      return res.json({
        startup_id: startup.id,
        name: startup.name,
        exists: true,
        total_god_score: startup.total_god_score
      });
    }

    return res.json({ 
      startup_id: null, 
      exists: false,
      message: 'No approved startup found for this URL'
    });
  } catch (err) {
    console.error('[resolve] Exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/matches/count?startup_id=...
 * Returns count of matches for a startup
 * READ-ONLY
 */
router.get('/matches/count', async (req, res) => {
  try {
    const { startup_id } = req.query;
    if (!startup_id) {
      return res.status(400).json({ error: 'Missing startup_id parameter' });
    }

    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startup_id);

    if (error) {
      console.error('[matches/count] Error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    return res.json({ 
      startup_id,
      count: count || 0
    });
  } catch (err) {
    console.error('[matches/count] Exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/intel/founder-profile?startup_id=...
 * Returns derived intelligence for a founder/startup
 * READ-ONLY - computes from existing DB data
 * 
 * Output:
 * - narrative_coherence: story compression analysis
 * - obsession_density: activity cadence signals
 * - conviction_evidence_ratio: claims vs proof
 * - fragility_index: where investors will hesitate
 * - trajectory_momentum: FOMO state if available
 * - copy_blocks: founder-facing language
 */
router.get('/intel/founder-profile', async (req, res) => {
  try {
    const { startup_id } = req.query;
    if (!startup_id) {
      return res.status(400).json({ error: 'Missing startup_id parameter' });
    }

    const supabase = getSupabaseClient();

    // Fetch startup data (Dimensions 1-3)
    const { data: startup, error: startupErr } = await supabase
      .from('startup_uploads')
      .select(`
        id, name, website, tagline, description, pitch,
        extracted_data, stage, status,
        has_revenue, has_customers, is_launched,
        mrr, arr, growth_rate_monthly, team_size,
        total_god_score, team_score, traction_score,
        market_score, product_score, vision_score,
        created_at, updated_at
      `)
      .eq('id', startup_id)
      .single();

    if (startupErr) {
      console.error('[intel/founder-profile] Startup error:', startupErr);
      return res.status(404).json({ error: 'Startup not found' });
    }

    // Fetch match reasoning (Dimension 4: Fragility)
    const { data: matches } = await supabase
      .from('startup_investor_matches')
      .select('investor_id, match_score, reasoning')
      .eq('startup_id', startup_id)
      .order('match_score', { ascending: false })
      .limit(50);

    // Fetch FOMO state (Dimension 5: Trajectory)
    const { data: fomo } = await supabase
      .from('startup_fomo_triggers')
      .select('*')
      .eq('startup_id', startup_id)
      .limit(1);

    // === COMPUTE INTELLIGENCE DIMENSIONS ===

    // Dimension 1: Narrative Coherence
    const narrative = computeNarrativeCoherence(startup);

    // Dimension 2: Obsession Density  
    const obsession = computeObsessionDensity(startup);

    // Dimension 3: Conviction-Evidence Ratio
    const convictionEvidence = computeConvictionEvidence(startup);

    // Dimension 4: Fragility Index
    const fragility = computeFragilityIndex(matches || []);

    // Dimension 5: Trajectory Momentum
    const trajectory = computeTrajectoryMomentum(fomo?.[0]);

    // Generate copy blocks
    const copyBlocks = generateFounderCopyBlocks({
      narrative,
      obsession,
      convictionEvidence,
      fragility,
      trajectory,
      startup
    });

    return res.json({
      startup_id,
      startup_name: startup.name,
      total_god_score: startup.total_god_score,
      dimensions: {
        narrative_coherence: narrative,
        obsession_density: obsession,
        conviction_evidence_ratio: convictionEvidence,
        fragility_index: fragility,
        trajectory_momentum: trajectory
      },
      copy_blocks: copyBlocks,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[intel/founder-profile] Exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/intel/match-deltas?startup_id=...&investor_id=...
 * Returns alignment differential between startup and investor
 * READ-ONLY
 * 
 * Output:
 * - reflection: how the market reads them
 * - tension: where belief breaks
 * - direction: what changes outcome
 * - next_proof: specific evidence to show
 */
router.get('/intel/match-deltas', async (req, res) => {
  try {
    const { startup_id, investor_id } = req.query;
    if (!startup_id || !investor_id) {
      return res.status(400).json({ error: 'Missing startup_id or investor_id parameter' });
    }

    const supabase = getSupabaseClient();

    // Fetch startup
    const { data: startup } = await supabase
      .from('startup_uploads')
      .select('id, name, stage, sectors, total_god_score, traction_score, market_score')
      .eq('id', startup_id)
      .single();

    if (!startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // Fetch investor
    const { data: investor } = await supabase
      .from('investors')
      .select('id, name, firm, stage, sectors, investment_thesis, check_size_min, check_size_max')
      .eq('id', investor_id)
      .single();

    if (!investor) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    // Fetch the match record
    const { data: match } = await supabase
      .from('startup_investor_matches')
      .select('match_score, confidence_level, reasoning')
      .eq('startup_id', startup_id)
      .eq('investor_id', investor_id)
      .single();

    // Compute alignment differential
    const delta = computeAlignmentDelta(startup, investor, match);

    return res.json({
      startup_id,
      investor_id,
      startup_name: startup.name,
      investor_name: investor.name,
      investor_firm: investor.firm,
      match_score: match?.match_score || null,
      confidence_level: match?.confidence_level || null,
      alignment_delta: delta,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('[intel/match-deltas] Exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// === INTELLIGENCE COMPUTATION FUNCTIONS ===

function computeNarrativeCoherence(startup) {
  const tagline = startup.tagline || '';
  const description = startup.description || '';
  const oneLiner = startup.extracted_data?.one_liner || '';
  const fivePoints = startup.extracted_data?.fivePoints || [];

  // Story compression: shorter is tighter
  const storyLength = (tagline + oneLiner).length;
  const descLength = description.length;
  
  // Clarity: presence of structured content
  const hasTagline = tagline.length > 10;
  const hasOneLiner = oneLiner.length > 10;
  const hasFivePoints = fivePoints.length >= 3;
  
  // Score 0-100
  let score = 50;
  if (hasTagline) score += 15;
  if (hasOneLiner) score += 15;
  if (hasFivePoints) score += 20;
  if (storyLength > 0 && storyLength < 100) score += 10; // Concise
  if (descLength > 50 && descLength < 500) score += 10; // Not too long
  
  score = Math.min(100, Math.max(0, score));

  const status = score >= 70 ? 'strong' : score >= 45 ? 'moderate' : 'weak';

  return {
    score,
    status,
    signals: {
      has_tagline: hasTagline,
      has_one_liner: hasOneLiner,
      has_five_points: hasFivePoints,
      story_length: storyLength,
      description_length: descLength
    },
    insight: score >= 70 
      ? 'Your story lands fast. Narrative is tight.'
      : score >= 45 
        ? 'Story has pieces. Not yet compressing into belief.'
        : 'Narrative is scattered. Investors will project their own story.'
  };
}

function computeObsessionDensity(startup) {
  const createdAt = new Date(startup.created_at);
  const updatedAt = new Date(startup.updated_at);
  const now = new Date();
  
  const hoursSinceUpdate = (now - updatedAt) / (1000 * 60 * 60);
  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
  
  // Fresh updates signal active iteration
  let score = 50;
  if (hoursSinceUpdate < 24) score += 25;
  else if (hoursSinceUpdate < 72) score += 15;
  else if (hoursSinceUpdate < 168) score += 5;
  
  // Recent creation with updates = active building
  if (daysSinceCreation < 30 && hoursSinceUpdate < 48) score += 15;
  
  score = Math.min(100, Math.max(0, score));
  const status = score >= 65 ? 'active' : score >= 40 ? 'moderate' : 'dormant';

  return {
    score,
    status,
    signals: {
      hours_since_update: Math.round(hoursSinceUpdate),
      days_since_creation: Math.round(daysSinceCreation)
    },
    insight: status === 'active' 
      ? 'Recent activity signals focused iteration.'
      : status === 'moderate'
        ? 'Some activity. Cadence could be tighter.'
        : 'Activity is stale. Signals dormancy or distraction.'
  };
}

function computeConvictionEvidence(startup) {
  // Claims: GOD score components, stage positioning
  const totalClaim = startup.total_god_score || 50;
  const visionClaim = startup.vision_score || 50;
  
  // Evidence: hard metrics
  const hasRevenue = startup.has_revenue;
  const hasCustomers = startup.has_customers;
  const isLaunched = startup.is_launched;
  const mrr = startup.mrr || 0;
  const teamSize = startup.team_size || 0;
  const tractionScore = startup.traction_score || 0;
  
  // Evidence score
  let evidenceScore = 0;
  if (hasRevenue) evidenceScore += 25;
  if (hasCustomers) evidenceScore += 20;
  if (isLaunched) evidenceScore += 15;
  if (mrr > 1000) evidenceScore += 20;
  if (mrr > 10000) evidenceScore += 10;
  if (teamSize >= 2) evidenceScore += 10;
  
  evidenceScore = Math.min(100, evidenceScore);
  
  // Ratio: evidence vs claims
  const claimLevel = visionClaim; // Vision score = conviction level
  const ratio = evidenceScore / Math.max(claimLevel, 1);
  
  let status;
  let insight;
  
  if (ratio >= 1.0) {
    status = 'evidence_strong';
    insight = 'Proof exceeds claims. You might be underselling.';
  } else if (ratio >= 0.6) {
    status = 'balanced';
    insight = 'Claims and evidence roughly match. Solid ground.';
  } else if (ratio >= 0.3) {
    status = 'conviction_ahead';
    insight = 'Conviction exceeds evidence. Need more proof points.';
  } else {
    status = 'unproven';
    insight = 'Strong claims, thin evidence. Investors will hesitate.';
  }

  return {
    evidence_score: evidenceScore,
    conviction_level: claimLevel,
    ratio: Math.round(ratio * 100) / 100,
    status,
    signals: {
      has_revenue: hasRevenue,
      has_customers: hasCustomers,
      is_launched: isLaunched,
      mrr: mrr,
      team_size: teamSize,
      traction_score: tractionScore
    },
    insight
  };
}

function computeFragilityIndex(matches) {
  // Extract common hesitation patterns from match reasoning
  const reasoningTexts = matches
    .filter(m => m.reasoning && Array.isArray(m.reasoning))
    .flatMap(m => m.reasoning)
    .map(r => r.toLowerCase());

  // Count pattern frequencies
  const patterns = {
    stage_unclear: 0,
    market_broad: 0,
    traction_weak: 0,
    team_questions: 0,
    timing_concern: 0,
    competition: 0
  };

  reasoningTexts.forEach(text => {
    if (text.includes('stage') || text.includes('early')) patterns.stage_unclear++;
    if (text.includes('market') && (text.includes('broad') || text.includes('large') || text.includes('unclear'))) patterns.market_broad++;
    if (text.includes('traction') || text.includes('revenue') || text.includes('customers')) patterns.traction_weak++;
    if (text.includes('team') || text.includes('founder')) patterns.team_questions++;
    if (text.includes('timing') || text.includes('early') || text.includes('premature')) patterns.timing_concern++;
    if (text.includes('compet') || text.includes('crowded')) patterns.competition++;
  });

  // Find top fragility hotspots
  const hotspots = Object.entries(patterns)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pattern, count]) => ({
      pattern,
      frequency: count,
      label: {
        stage_unclear: 'Stage signals are mixed',
        market_broad: 'Market definition is too wide',
        traction_weak: 'Traction needs proof',
        team_questions: 'Team questions linger',
        timing_concern: 'Timing feels early',
        competition: 'Competitive positioning unclear'
      }[pattern]
    }));

  // Overall fragility score (lower = more fragile)
  const totalHesitations = Object.values(patterns).reduce((a, b) => a + b, 0);
  const fragilityScore = Math.max(0, 100 - (totalHesitations * 3));

  return {
    score: fragilityScore,
    status: fragilityScore >= 70 ? 'resilient' : fragilityScore >= 40 ? 'some_concerns' : 'fragile',
    hotspots,
    total_hesitation_signals: totalHesitations,
    analyzed_matches: matches.length
  };
}

function computeTrajectoryMomentum(fomo) {
  if (!fomo) {
    return {
      status: 'unknown',
      signals: null,
      insight: 'No velocity data available yet.'
    };
  }

  const state = fomo.fomo_state || 'watch';
  const signalDelta = fomo.signal_delta_24h || 0;
  const events7d = fomo.events_7d || 0;

  let insight;
  if (state === 'breakout' || state === 'surge') {
    insight = `Signal velocity is accelerating. ${events7d} events in 7 days.`;
  } else if (state === 'warming') {
    insight = 'Momentum is building. Watch → Warming transition.';
  } else {
    insight = 'Signals are steady. No acceleration detected.';
  }

  return {
    status: state,
    signals: {
      fomo_state: fomo.fomo_state,
      events_24h: fomo.events_24h,
      signal_24h: fomo.signal_24h,
      events_7d: fomo.events_7d,
      signal_delta_24h: signalDelta
    },
    insight
  };
}

function generateFounderCopyBlocks({ narrative, obsession, convictionEvidence, fragility, trajectory, startup }) {
  // Template A: Founder Snapshot
  let snapshotBody;
  if (narrative.score >= 65 && convictionEvidence.ratio < 0.6) {
    snapshotBody = "Your story lands fast. The hesitation is proof.";
  } else if (narrative.score < 50 && convictionEvidence.evidence_score >= 50) {
    snapshotBody = "You have evidence. You're not translating it into belief.";
  } else if (narrative.score < 50 && convictionEvidence.evidence_score < 40) {
    snapshotBody = "Right now, investors will project their own story onto you. That's fragile.";
  } else if (narrative.score >= 60 && convictionEvidence.evidence_score >= 60) {
    snapshotBody = "This reads like momentum. The only risk is timing.";
  } else {
    snapshotBody = "Mixed signals. Story and proof aren't yet aligned.";
  }

  // Template B: Fragility Callout
  const fragilityBullets = fragility.hotspots.slice(0, 2).map(h => h.label);

  // Template C: Direction
  const directionBullets = [];
  if (convictionEvidence.ratio < 0.5) {
    directionBullets.push("If you show proof of traction, the conversation shifts.");
  }
  if (narrative.score < 50) {
    directionBullets.push("If you compress your story to one sentence, investors stop projecting.");
  }
  if (fragility.hotspots.some(h => h.pattern === 'stage_unclear')) {
    directionBullets.push("If you clarify your stage, hesitation disappears.");
  }
  if (directionBullets.length === 0) {
    directionBullets.push("Continue building. Current signals are working.");
  }

  // Template E: Momentum line
  let momentumLine = null;
  if (trajectory.status === 'warming' || trajectory.status === 'surge' || trajectory.status === 'breakout') {
    momentumLine = `Signal velocity increased in the last 7 days. You're moving from 'watch' → '${trajectory.status}' behaviorally.`;
  }

  return {
    snapshot: {
      title: "How the market reads you right now",
      body: snapshotBody
    },
    fragility: {
      title: "Where belief breaks",
      bullets: fragilityBullets.length > 0 ? fragilityBullets : ["No major fragility detected"]
    },
    direction: {
      title: "What changes the outcome",
      bullets: directionBullets
    },
    momentum: momentumLine
  };
}

function computeAlignmentDelta(startup, investor, match) {
  // Why they'll lean in
  const leanInReasons = [];
  const hesitateReasons = [];
  const proofNeeded = [];

  // Sector alignment
  const startupSectors = startup.sectors || [];
  const investorSectors = investor.sectors || [];
  const sectorOverlap = startupSectors.filter(s => 
    investorSectors.some(is => is.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(is.toLowerCase()))
  );

  if (sectorOverlap.length > 0) {
    leanInReasons.push(`Their focus includes ${sectorOverlap[0]}. You're in their wheelhouse.`);
  }

  // Stage alignment
  const startupStage = startup.stage || 'unknown';
  const investorStage = investor.stage || '';
  if (investorStage.toLowerCase().includes(startupStage.toLowerCase())) {
    leanInReasons.push(`They invest at ${startupStage}. Stage fits.`);
  } else {
    hesitateReasons.push(`Stage mismatch: you're ${startupStage}, they typically do ${investorStage}.`);
  }

  // Thesis alignment
  const thesis = investor.investment_thesis || '';
  if (thesis.length > 20) {
    leanInReasons.push(`Their thesis suggests forward bias toward your space.`);
  }

  // Traction check
  if (startup.traction_score < 40) {
    hesitateReasons.push(`Traction signals are thin. They'll want more proof.`);
    proofNeeded.push(`Show customer count, revenue, or usage metrics.`);
  }

  // Market score
  if (startup.market_score < 45) {
    hesitateReasons.push(`Market positioning reads as broad.`);
    proofNeeded.push(`Sharpen your ICP and TAM story.`);
  }

  // Add from match reasoning if available
  if (match?.reasoning && Array.isArray(match.reasoning)) {
    match.reasoning.slice(0, 2).forEach(r => {
      if (r.toLowerCase().includes('align') || r.toLowerCase().includes('match') || r.toLowerCase().includes('fit')) {
        leanInReasons.push(r);
      }
    });
  }

  return {
    reflection: leanInReasons.length > 0 
      ? leanInReasons[0] 
      : "Alignment exists but isn't immediately obvious.",
    tension: hesitateReasons.slice(0, 2),
    direction: proofNeeded.length > 0 ? proofNeeded : ["Current positioning may work. Test it."],
    next_proof: proofNeeded
  };
}

module.exports = router;
