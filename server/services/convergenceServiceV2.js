/**
 * CONVERGENCE SERVICE V2 - Behavioral Physics Engine
 * ===================================================
 * Uses: convergence_candidates view + observer tracking
 * Replaces: Simple match queries with real behavioral signals
 */

const { supabase } = require('../lib/supabaseClient.js');
const { normalizeUrl, generateLookupVariants } = require('../utils/urlNormalizer.js');

class ConvergenceServiceV2 {
  
  constructor() {
    this.supabase = supabase;
  }
  
  /**
   * Step 1: Resolve startup by URL (canonical lookup)
   */
  async resolveStartup(url) {
    const variants = generateLookupVariants(url);
    
    console.log('[Convergence V2] Looking up startup:', { url, variants });
    
    // Try each variant
    for (const variant of variants) {
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('*')
        .ilike('website', `%${variant}%`)
        .eq('status', 'approved')
        .limit(1);
      
      if (data && data.length > 0 && !error) {
        console.log('[Convergence V2] Found startup:', data[0].id, data[0].name);
        return data[0];
      }
    }
    
    console.log('[Convergence V2] No startup found for URL:', url);
    return null;
  }
  
  /**
   * Fast mode helper: Get status for a startup ID
   */
  async getStatusForStartup(startupId) {
    const { data: startup } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('id', startupId)
      .single();
    
    if (!startup) return null;
    
    return await this.buildStatusMetrics(startup);
  }
  
  /**
   * Step 2: Build status metrics from GOD scores + observer tracking
   */
  async buildStatusMetrics(startup) {
    const godScore = startup.total_god_score || 45;
    
    // Velocity class
    let velocityClass = 'early';
    if (godScore >= 70) velocityClass = 'fast_feedback';
    else if (godScore >= 60) velocityClass = 'building';
    
    // FOMO state
    let fomoState = 'watch';
    if (godScore >= 80) fomoState = 'breakout';
    else if (godScore >= 70) fomoState = 'surge';
    else if (godScore >= 60) fomoState = 'warming';
    
    // Comparable tier
    let comparableTier = 'unranked';
    if (godScore >= 80) comparableTier = 'top_5';
    else if (godScore >= 70) comparableTier = 'top_12';
    else if (godScore >= 60) comparableTier = 'top_25';
    
    // REAL OBSERVERS COUNT (7d) - NEW!
    const { data: observerData } = await supabase
      .from('startup_observers_7d')
      .select('observers_7d')
      .eq('startup_id', startup.id)
      .single();
    
    const observers7d = observerData?.observers_7d || 0;
    
    // DYNAMIC PHASE-CHANGE SCORE (event-based)
    const { data: phaseData } = await supabase
      .from('startup_phase_change')
      .select('phase_change_score, phase_state, signal_24h, signal_7d')
      .eq('startup_id', startup.id)
      .single();
    
    const phaseChangeScore = phaseData?.phase_change_score || Math.min(1.0, (godScore / 100) * 0.9);
    const phaseState = phaseData?.phase_state || 'quiet';
    
    return {
      velocity_class: velocityClass,
      signal_strength_0_10: Math.min(10, godScore / 10),
      fomo_state: fomoState,
      observers_7d: observers7d, // REAL DATA!
      comparable_tier: comparableTier,
      phase_change_score_0_1: phaseChangeScore, // DYNAMIC!
      phase_state: phaseState, // NEW!
      confidence: godScore >= 70 ? 'high' : godScore >= 60 ? 'med' : 'low',
      updated_at: new Date().toISOString()
    };
  }
  
  /**
   * Step 3: Pull investor candidates from CONVERGENCE_CANDIDATES view
   * This is the MONEY QUERY - everything comes from the view
   */
  async fetchInvestorCandidates(startupId) {
    console.log('[Convergence V2] Fetching candidates from convergence_candidates view');
    
    const { data: candidates, error } = await supabase
      .from('convergence_candidates')
      .select('*')
      .eq('startup_id', startupId)
      .order('signal_7d', { ascending: false })
      .order('overlap_score', { ascending: false })
      .order('recent_views', { ascending: false })
      .limit(200);
    
    if (error) {
      console.error('[Convergence V2] Error fetching candidates:', error);
      return [];
    }
    
    console.log('[Convergence V2] Found', candidates?.length || 0, 'candidates');
    return candidates || [];
  }
  
  /**
   * Step 4: Score and select investors using behavioral signals
   */
  scoreAndSelectInvestors(candidates, startup) {
    // Transform candidates with behavioral scoring
    const scoredCandidates = candidates.map(c => {
      // Calculate comprehensive match score
      const sectorFit = this.calculateSectorFit(c.sector_focus, startup.sectors);
      const stageFit = this.calculateStageFitScore(c.stage_focus, startup.stage);
      
      // Behavioral components (FROM REAL DATA NOW)
      const behaviorSignal = Math.min(1.0, (c.recent_views || 0) / 10);
      const portfolioAdj = c.overlap_score || 0;
      const timing = this.calculateTiming(c.signal_7d, c.signal_age_hours, startup.total_god_score);
      
      // Confidence from signal strength
      const confidence = c.signal_7d >= 10 ? 'high' : c.signal_7d >= 5 ? 'med' : 'low';
      
      // Composite score (weighted)
      const compositeScore = (
        0.30 * sectorFit +
        0.20 * stageFit +
        0.20 * portfolioAdj +
        0.15 * behaviorSignal +
        0.15 * timing
      ) * (confidence === 'high' ? 1.2 : confidence === 'med' ? 1.0 : 0.8);
      
      return {
        ...c,
        sector_fit: sectorFit,
        stage_fit: stageFit,
        behavior_signal: behaviorSignal,
        portfolio_adj: portfolioAdj,
        timing,
        confidence,
        composite_score: compositeScore
      };
    });
    
    console.log('[Convergence V2] Scored candidates:', scoredCandidates.length);
    console.log('[Convergence V2] Sample scores:', scoredCandidates.slice(0, 3).map(c => ({
      name: c.name,
      match_score: c.match_score,
      signal_7d: c.signal_7d
    })));
    
    // Smart selection: Diverse 5
    const visible5 = this.selectStrategic5(scoredCandidates, startup);
    const hiddenPreview = this.selectHiddenPreview(scoredCandidates, visible5);
    const hiddenTotal = Math.max(0, scoredCandidates.length - 5);
    
    console.log('[Convergence V2] Selected visible:', visible5.length);
    console.log('[Convergence V2] Hidden preview:', hiddenPreview.length);
    
    return { visible5, hiddenPreview, hiddenTotal };
  }
  
  /**
   * Smart 5 selection with real behavioral signals
   */
  selectStrategic5(candidates, startup) {
    const used = new Set();
    const selected = [];
    
    // Sort by composite score
    const sorted = [...candidates].sort((a, b) => b.composite_score - a.composite_score);
    
    // 1. FOMO Anchor - Breakout/Surge state
    const fomoAnchor = sorted.find(c => 
      !used.has(c.investor_id) && 
      (c.fomo_state === 'breakout' || c.fomo_state === 'surge')
    );
    if (fomoAnchor) {
      selected.push(this.toInvestorMatch(fomoAnchor, startup));
      used.add(fomoAnchor.investor_id);
    }
    
    // 2. Prestige Anchor - Highest composite score
    if (sorted[0] && !used.has(sorted[0].investor_id)) {
      selected.push(this.toInvestorMatch(sorted[0], startup));
      used.add(sorted[0].investor_id);
    }
    
    // Helper to normalize stage for comparison
    const normalizeStage = (stage) => {
      if (stage == null) return null;
      if (typeof stage === 'number') {
        const stageMap = ['preseed', 'seed', 'series a', 'series b', 'series c'];
        return stageMap[stage - 1] || null;
      }
      return String(stage).toLowerCase();
    };
    
    // 3. Stage Fit Anchor
    const startupStageNorm = normalizeStage(startup.stage);
    const stageFit = sorted.find(c => {
      if (used.has(c.investor_id)) return false;
      if (!c.stage_focus || !startupStageNorm) return false;
      
      const invStageNorm = normalizeStage(c.stage_focus);
      return invStageNorm === startupStageNorm;
    });
    if (stageFit) {
      selected.push(this.toInvestorMatch(stageFit, startup));
      used.add(stageFit.investor_id);
    }
    
    // 4. Portfolio Adjacency Anchor
    const adjAnchor = sorted.find(c => 
      !used.has(c.investor_id) && 
      (c.overlap_score || 0) > 0.7
    );
    if (adjAnchor) {
      selected.push(this.toInvestorMatch(adjAnchor, startup));
      used.add(adjAnchor.investor_id);
    }
    
    // 5. Fill remaining slots
    for (const candidate of sorted) {
      if (selected.length >= 5) break;
      if (!used.has(candidate.investor_id)) {
        selected.push(this.toInvestorMatch(candidate, startup));
        used.add(candidate.investor_id);
      }
    }
    
    return selected;
  }
  
  /**
   * Convert candidate to InvestorMatch with REAL BEHAVIORAL DATA
   */
  toInvestorMatch(candidate, startup) {
    const score = Math.round(candidate.composite_score * 100);
    
    // Signal state from FOMO triggers
    const signalState = candidate.fomo_state || 'watch';
    
    // Fit metrics from real data
    const sectorFitPct = Math.round(candidate.sector_fit * 100);
    const stageFit = this.mapStageFitLabel(candidate.stage_fit);
    const portfolioAdj = candidate.overlap_score >= 0.7 ? 'strong' : 
                         candidate.overlap_score >= 0.4 ? 'good' : 'weak';
    const velocityAlign = candidate.signal_7d >= 10 ? 'high' : 
                          candidate.signal_7d >= 5 ? 'med' : 'low';
    
    // Generate EVIDENCE-BASED why bullets
    const whyBullets = this.generateEvidenceBasedBullets(candidate, startup);
    
    return {
      investor_id: candidate.investor_id,
      firm_name: candidate.firm_name,
      firm_logo_url: candidate.logo_url,
      partner_name: undefined, // TODO: Add partner data
      match_score_0_100: score,
      signal_state: signalState,
      confidence: candidate.confidence,
      signal_age_hours: Math.min(168, candidate.signal_age_hours || 12),
      fit: {
        stage_fit: stageFit,
        sector_fit_pct: sectorFitPct,
        portfolio_adjacency: portfolioAdj,
        velocity_alignment: velocityAlign
      },
      why: {
        bullets: whyBullets,
        evidence_tags: this.generateEvidenceTags(candidate)
      }
    };
  }
  
  /**
   * Generate evidence-based "why" bullets from REAL DISCOVERY DATA + Oracle signals
   */
  generateEvidenceBasedBullets(candidate, startup) {
    const bullets = [];
    const signals = Array.isArray(candidate.signals) ? candidate.signals : [];
    const focusAreas = candidate.focus_areas || {};

    // ── Oracle signals (highest priority — "where are they investing now/next") ──

    // Active thesis themes
    const themeSignals = signals
      .filter(s => s.type === 'thesis_theme')
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 2);
    if (themeSignals.length > 0) {
      bullets.push(`Thesis: ${themeSignals.map(s => s.label).join(', ')}`);
    }

    // Trending / next-bet themes (Oracle prediction)
    const trendingThemes = focusAreas.trending_themes || [];
    if (trendingThemes.length > 0) {
      const newThemes = trendingThemes.filter(t => !themeSignals.some(s => s.label === t));
      if (newThemes.length > 0) {
        bullets.push(`Tracking: ${newThemes.slice(0, 2).join(', ')}`);
      }
    }

    // Recent deal activity
    const recentDeal = signals.find(s => s.type === 'recent_deal');
    if (recentDeal) {
      bullets.push(`Recent deal: ${recentDeal.company}`);
    }

    // Deployment signal
    const depSignal = signals.find(s => s.type === 'deployment_signal');
    if (depSignal?.label === 'actively_deploying') {
      bullets.push('Actively deploying capital');
    } else if (candidate.deployment_velocity_index > 0.6) {
      bullets.push('High deployment velocity');
    }

    // ── Behavioral evidence (from real discovery data) ──

    if (bullets.length < 3 && candidate.recent_views >= 3) {
      bullets.push(`Viewed ${candidate.recent_views} similar startups in last 72h`);
    }

    if (bullets.length < 3 && candidate.overlap_score > 0.7) {
      bullets.push(`Portfolio adjacency detected (${Math.round(candidate.overlap_score * 100)}% overlap)`);
    } else if (bullets.length < 3 && candidate.adjacent_companies > 0) {
      bullets.push(`${candidate.adjacent_companies} adjacent portfolio companies`);
    }

    if (bullets.length < 3 && candidate.signal_24h > 0) {
      bullets.push(`Acceleration in discovery behavior (+${candidate.signal_24h} signals 24h)`);
    }

    if (bullets.length < 3 && (candidate.fomo_state === 'surge' || candidate.fomo_state === 'breakout')) {
      bullets.push('Investor entering active sourcing phase');
    }

    // ── Structural fallbacks ──

    const sectorSrc = focusAreas.primary_sectors?.length > 0 ? focusAreas.primary_sectors : (candidate.sector_focus || []);
    if (bullets.length < 2 && sectorSrc.length > 0) {
      bullets.push(`Active in ${sectorSrc.slice(0, 2).join(', ')}`);
    }

    if (bullets.length < 3 && candidate.stage_focus) {
      const stageSrc = Array.isArray(candidate.stage_focus) ? candidate.stage_focus.slice(0, 2).join(', ') : candidate.stage_focus;
      bullets.push(`Stage focus: ${stageSrc}`);
    }

    if (bullets.length < 3 && candidate.check_size_min && candidate.check_size_max) {
      const min = Math.round(candidate.check_size_min / 1000);
      const max = Math.round(candidate.check_size_max / 1000000);
      bullets.push(`Check: $${min}k–$${max}M`);
    }

    return bullets.slice(0, 3);
  }
  
  /**
   * Generate evidence tags from real signals
   */
  generateEvidenceTags(candidate) {
    const tags = [];
    
    if (candidate.overlap_score > 0.5) tags.push('portfolio_overlap');
    if (candidate.recent_views >= 2) tags.push('discovery_behavior');
    if (candidate.signal_7d >= 5) tags.push('phase_change');
    if (candidate.fomo_state !== 'watch') tags.push('timing_signal');
    
    return tags;
  }
  
  /**
   * Select hidden preview investors
   */
  selectHiddenPreview(candidates, visible5) {
    const visibleIds = new Set(visible5.map(v => v.investor_id));
    const hidden = candidates
      .filter(c => !visibleIds.has(c.investor_id))
      .slice(0, 10);
    
    return hidden.map((c, i) => ({
      blurred_id: `blurred_${i}`,
      stage: this.mapStageEnum(c.stage_focus),
      sector: c.sector_focus?.[0] || 'Technology',
      signal_state: c.fomo_state || 'watch'
    }));
  }
  
  /**
   * Step 5: Fetch comparable startups from view
   */
  async fetchComparableStartups(startup) {
    const { data, error } = await supabase
      .from('comparable_startups')
      .select('*')
      .eq('for_startup_id', startup.id)
      .order('god_score_delta', { ascending: true })
      .order('matched_investors_count', { ascending: false })
      .limit(8);
    
    if (error || !data) {
      console.log('[Convergence V2] No comparable startups found');
      return [];
    }
    
    return data.slice(0, 6).map(s => ({
      startup_id: s.comparable_id,
      name: s.name,
      stage: s.stage || 'Seed',
      sector: s.industry || 'Technology',
      god_score_0_10: (s.total_god_score || 50) / 10,
      fomo_state: this.getFomoState(s.total_god_score),
      matched_investors: s.matched_investors_count || 0,
      reason_tags: s.reason_tags || []
    }));
  }
  
  /**
   * Build alignment breakdown
   */
  buildAlignment(startup) {
    return {
      team_0_1: (startup.team_score || 50) / 100,
      market_0_1: (startup.market_score || 50) / 100,
      execution_0_1: (startup.product_score || 50) / 100,
      portfolio_0_1: 0.68, // TODO: Calculate from actual adjacency scores
      phase_change_0_1: (startup.total_god_score || 50) / 100,
      message: 'Investors historically engage when Phase Change Correlation exceeds 0.75'
    };
  }
  
  /**
   * Build dynamic coaching actions from weakest dimensions
   */
  buildImproveActions(startup, alignment) {
    const actions = [];
    
    // Find weakest dimension
    const dims = [
      { name: 'team', score: alignment.team_0_1 },
      { name: 'market', score: alignment.market_0_1 },
      { name: 'execution', score: alignment.execution_0_1 },
      { name: 'phase_change', score: alignment.phase_change_0_1 }
    ].sort((a, b) => a.score - b.score);
    
    // Suggest improvements for weakest 3
    for (const dim of dims.slice(0, 3)) {
      if (dim.name === 'team' && dim.score < 0.7) {
        actions.push({
          title: 'Strengthen Team Signal',
          impact_pct: 15,
          steps: [
            'Add key hire announcements',
            'Publish team bios with expertise',
            'Show advisor network'
          ],
          category: 'technical'
        });
      } else if (dim.name === 'execution' && dim.score < 0.7) {
        actions.push({
          title: 'Increase Technical Signal Density',
          impact_pct: 12,
          steps: [
            'Publish product benchmarks',
            'Ship public API / SDK',
            'Release technical blog'
          ],
          category: 'technical'
        });
      } else if (dim.name === 'phase_change' && dim.score < 0.75) {
        actions.push({
          title: 'Accelerate Phase Change Probability',
          impact_pct: 18,
          steps: [
            'Announce key milestone',
            'Ship v2 feature',
            'Show revenue signal'
          ],
          category: 'phase_change'
        });
      } else if (dim.name === 'market' && dim.score < 0.7) {
        actions.push({
          title: 'Strengthen Market Velocity Signal',
          impact_pct: 14,
          steps: [
            'Publish market traction data',
            'Show customer adoption curve',
            'Increase market presence'
          ],
          category: 'traction'
        });
      }
    }
    
    return actions.slice(0, 3);
  }
  
  /**
   * Package final convergence response
   */
  async buildConvergenceResponse(startup) {
    const startTime = Date.now();
    
    // Step 2: Status metrics (with REAL observer count)
    const status = await this.buildStatusMetrics(startup);
    
    // Step 3: Fetch candidates from view
    const candidates = await this.fetchInvestorCandidates(startup.id);
    
    // Step 4: Score + select
    const { visible5, hiddenPreview, hiddenTotal } = this.scoreAndSelectInvestors(candidates, startup);
    
    // Step 5: Comparable startups
    const comparableStartups = await this.fetchComparableStartups(startup);
    
    // Alignment + coaching
    const alignment = this.buildAlignment(startup);
    const improveActions = this.buildImproveActions(startup, alignment);
    
    const response = {
      startup: {
        id: startup.id,
        url: startup.website || startup.url,
        name: startup.name,
        stage_hint: this.mapStageEnum(startup.stage),
        sector_hint: startup.sectors || [],
        created_at: startup.created_at
      },
      status,
      visible_investors: visible5,
      hidden_investors_preview: hiddenPreview,
      hidden_investors_total: hiddenTotal,
      comparable_startups: comparableStartups,
      alignment,
      improve_actions: improveActions,
      debug: {
        query_time_ms: Date.now() - startTime,
        data_sources: ['convergence_candidates', 'startup_observers_7d', 'comparable_startups'],
        match_version: 'v2.0.0-behavioral-physics',
        candidate_pool_size: candidates.length
      }
    };
    
    return response;
  }
  
  /**
   * Helper: Calculate sector fit percentage
   */
  calculateSectorFit(investorSectors, startupSectors) {
    if (!investorSectors?.length || !startupSectors?.length) return 0;
    
    const overlap = investorSectors.filter(s => 
      startupSectors.some(ss => 
        s.toLowerCase().includes(ss.toLowerCase()) ||
        ss.toLowerCase().includes(s.toLowerCase())
      )
    );
    
    return overlap.length / investorSectors.length;
  }
  
  /**
   * Helper: Calculate stage fit score (0-1)
   */
  calculateStageFitScore(investorStage, startupStage) {
    if (!investorStage || startupStage == null) return 0.5;
    
    // Handle numeric stage (1=Preseed, 2=Seed, 3=Series A, etc.)
    let startLower;
    if (typeof startupStage === 'number') {
      const stageMap = ['preseed', 'seed', 'series a', 'series b', 'series c'];
      startLower = stageMap[startupStage - 1] || 'unknown';
    } else {
      startLower = String(startupStage).toLowerCase();
    }
    
    // Handle array (investors.stage can be array)
    let invLower;
    if (Array.isArray(investorStage)) {
      invLower = investorStage.map(s => String(s).toLowerCase());
    } else {
      invLower = String(investorStage).toLowerCase();
    }
    
    // Check exact match (handle array or string)
    if (Array.isArray(invLower)) {
      if (invLower.includes(startLower)) return 1.0;
    } else {
      if (invLower === startLower) return 1.0;
    }
    
    // Adjacent stages
    const stages = ['preseed', 'seed', 'series a', 'series b'];
    const startIdx = stages.findIndex(s => startLower.includes(s));
    
    // For array, find best match
    if (Array.isArray(invLower)) {
      let bestScore = 0;
      for (const stage of invLower) {
        const invIdx = stages.findIndex(s => stage.includes(s));
        if (invIdx >= 0 && startIdx >= 0) {
          const distance = Math.abs(invIdx - startIdx);
          let score = 0;
          if (distance === 0) score = 1.0;
          else if (distance === 1) score = 0.7;
          else if (distance === 2) score = 0.4;
          bestScore = Math.max(bestScore, score);
        }
      }
      return bestScore || 0.3;
    }
    
    // For string, single comparison
    const invIdx = stages.findIndex(s => invLower.includes(s));
    
    if (invIdx >= 0 && startIdx >= 0) {
      const distance = Math.abs(invIdx - startIdx);
      if (distance === 0) return 1.0;
      if (distance === 1) return 0.7;
      if (distance === 2) return 0.4;
    }
    
    return 0.3;
  }
  
  /**
   * Helper: Map stage fit score to label
   */
  mapStageFitLabel(score) {
    if (score >= 0.9) return 'strong';
    if (score >= 0.6) return 'good';
    return 'weak';
  }
  
  /**
   * Helper: Calculate timing component
   */
  calculateTiming(signal7d, signalAgeHours, godScore) {
    const phaseChange = godScore / 100;
    const fomo = signal7d >= 10 ? 0.9 : signal7d >= 5 ? 0.7 : 0.5;
    const recency = signalAgeHours ? Math.max(0, 1 - (signalAgeHours / 168)) : 0.5;
    return phaseChange * fomo * recency;
  }
  
  /**
   * Helper: Map stage to enum
   */
  mapStageEnum(stage) {
    if (!stage) return 'seed';
    
    // Handle numeric stage
    if (typeof stage === 'number') {
      const stageMap = ['preseed', 'seed', 'series_a', 'series_b_plus', 'series_b_plus'];
      return stageMap[stage - 1] || 'seed';
    }
    
    const lower = String(stage).toLowerCase();
    if (lower.includes('pre')) return 'preseed';
    if (lower.includes('seed') && !lower.includes('series')) return 'seed';
    if (lower.includes('series a') || lower === 'a') return 'series_a';
    return 'series_b_plus';
  }
  
  getFomoState(godScore) {
    if (godScore >= 80) return 'breakout';
    if (godScore >= 70) return 'surge';
    if (godScore >= 60) return 'warming';
    return 'watch';
  }
  
  /**
   * Founder-friendly FOMO state descriptions (avoids hype)
   */
  getFomoStateDescription(fomoState) {
    const descriptions = {
      breakout: 'Breakout detected: investor attention is accelerating.',
      surge: 'Surge detected: discovery activity rising.',
      warming: 'Warming up: early convergence forming.',
      watch: 'Monitoring: signals are present but not accelerating yet.'
    };
    return descriptions[fomoState] || descriptions.watch;
  }
}

module.exports = { ConvergenceServiceV2 };
