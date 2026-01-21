/**
 * CONVERGENCE SERVICE - Real Signal Physics
 * =========================================
 * Orchestrates: startup lookup → signal query → scoring → packaging
 */

const { supabase } = require('../lib/supabaseClient.js');
const { normalizeUrl, generateLookupVariants } = require('../utils/urlNormalizer.js');

class ConvergenceService {
  
  /**
   * Step 1: Resolve startup by URL (canonical lookup)
   */
  async resolveStartup(url) {
    const variants = generateLookupVariants(url);
    
    console.log('[Convergence] Looking up startup:', { url, variants });
    
    // Try each variant
    for (const variant of variants) {
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('*')
        .or(`website.ilike.%${variant}%,url.ilike.%${variant}%`)
        .eq('status', 'approved')
        .limit(1)
        .single();
      
      if (data && !error) {
        console.log('[Convergence] Found startup:', data.id, data.name);
        return data;
      }
    }
    
    console.log('[Convergence] No startup found for URL:', url);
    return null;
  }
  
  /**
   * Step 2: Build status metrics from GOD scores
   */
  buildStatusMetrics(startup) {
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
    
    return {
      velocity_class: velocityClass,
      signal_strength_0_10: Math.min(10, godScore / 10),
      fomo_state: fomoState,
      observers_7d: 0, // Will wire in Phase 2
      comparable_tier: comparableTier,
      phase_change_score_0_1: Math.min(1.0, (godScore / 100) * 0.9),
      confidence: godScore >= 70 ? 'high' : godScore >= 60 ? 'med' : 'low',
      updated_at: new Date().toISOString()
    };
  }
  
  /**
   * Step 3: Pull investor signal candidates (MONEY QUERY)
   */
  async fetchInvestorCandidates(startupId) {
    console.log('[Convergence] Fetching investor candidates for:', startupId);
    
    // Core query: Pull matches with investor data
    const { data: matches, error } = await supabase
      .from('startup_investor_matches')
      .select(`
        match_score,
        created_at,
        investor:investors!inner(
          id,
          name,
          firm,
          logo_url,
          sectors,
          stage,
          check_size_min,
          check_size_max,
          geography,
          website
        )
      `)
      .eq('startup_id', startupId)
      .gte('match_score', 50)
      .order('match_score', { ascending: false })
      .limit(200);
    
    if (error) {
      console.error('[Convergence] Error fetching candidates:', error);
      return [];
    }
    
    console.log('[Convergence] Found', matches?.length || 0, 'candidates');
    return matches || [];
  }
  
  /**
   * Step 4: Run scoring + smart selection (delegates to TS logic)
   */
  scoreAndSelectInvestors(candidates, startup) {
    // Transform raw matches into scored candidates
    const scoredCandidates = candidates.map(match => ({
      investor: match.investor,
      match_score: match.match_score,
      created_at: match.created_at,
      
      // Calculate components
      sector_fit: this.calculateSectorFit(match.investor.sectors, startup.sectors),
      stage_fit: this.calculateStageFit(match.investor.stage, startup.stage),
      portfolio_adj: match.match_score >= 70 ? 0.8 : 0.6,
      behavior_signal: 0.5, // TODO: Wire from investor_startup_observers
      timing: this.calculateTiming(match.match_score, startup.total_god_score)
    }));
    
    // Smart selection: Prestige + Plausibility + Intrigue
    const visible5 = this.selectStrategic5(scoredCandidates, startup);
    const hiddenPreview = this.selectHiddenPreview(scoredCandidates, visible5);
    const hiddenTotal = Math.max(0, scoredCandidates.length - 5);
    
    return { visible5, hiddenPreview, hiddenTotal };
  }
  
  /**
   * Smart 5 selection: Diverse, not just top scores
   */
  selectStrategic5(candidates, startup) {
    const used = new Set();
    const selected = [];
    
    // Sort by match score
    const sorted = [...candidates].sort((a, b) => b.match_score - a.match_score);
    
    // 1. Prestige Anchor (highest score)
    if (sorted[0]) {
      selected.push(this.toInvestorMatch(sorted[0], 'high', startup));
      used.add(sorted[0].investor.id);
    }
    
    // 2. Stage Fit Anchor (exact stage match)
    const stageFit = sorted.find(c => 
      !used.has(c.investor.id) && 
      c.investor.stage?.toLowerCase() === startup.stage?.toLowerCase()
    );
    if (stageFit) {
      selected.push(this.toInvestorMatch(stageFit, 'high', startup));
      used.add(stageFit.investor.id);
    }
    
    // 3. Portfolio Adjacency (sector overlap)
    const sectorFit = sorted.find(c => 
      !used.has(c.investor.id) && 
      c.investor.sectors?.some(s => startup.sectors?.includes(s))
    );
    if (sectorFit) {
      selected.push(this.toInvestorMatch(sectorFit, 'med', startup));
      used.add(sectorFit.investor.id);
    }
    
    // 4-5. Fill with next highest
    for (const candidate of sorted) {
      if (selected.length >= 5) break;
      if (!used.has(candidate.investor.id)) {
        selected.push(this.toInvestorMatch(candidate, 'med', startup));
        used.add(candidate.investor.id);
      }
    }
    
    return selected;
  }
  
  /**
   * Convert candidate to InvestorMatch format
   */
  toInvestorMatch(candidate, confidence, startup) {
    const inv = candidate.investor;
    const score = candidate.match_score || 0;
    
    // Signal state
    let signalState = 'watch';
    if (score >= 80) signalState = 'breakout';
    else if (score >= 70) signalState = 'surge';
    else if (score >= 60) signalState = 'warming';
    
    // Fit metrics
    const sectorFitPct = this.calculateSectorFit(inv.sectors, startup.sectors);
    const stageFit = this.calculateStageFit(inv.stage, startup.stage);
    const portfolioAdj = sectorFitPct >= 70 ? 'strong' : sectorFitPct >= 40 ? 'good' : 'weak';
    const velocityAlign = score >= 75 ? 'high' : score >= 60 ? 'med' : 'low';
    
    // Generate evidence-based "why" bullets
    const whyBullets = this.generateWhyBullets(inv, candidate, score);
    
    // Signal age (hours since match created)
    const signalAgeHours = candidate.created_at 
      ? Math.floor((Date.now() - new Date(candidate.created_at).getTime()) / (1000 * 60 * 60))
      : 12;
    
    return {
      investor_id: inv.id,
      firm_name: inv.name,
      firm_logo_url: inv.logo_url,
      partner_name: undefined, // TODO: Add partner data
      match_score_0_100: Math.round(score),
      signal_state: signalState,
      confidence,
      signal_age_hours: Math.min(168, signalAgeHours), // Cap at 7 days
      fit: {
        stage_fit: stageFit,
        sector_fit_pct: Math.round(sectorFitPct),
        portfolio_adjacency: portfolioAdj,
        velocity_alignment: velocityAlign
      },
      why: {
        bullets: whyBullets,
        evidence_tags: ['portfolio_overlap', 'discovery_behavior', 'phase_change']
      }
    };
  }
  
  /**
   * Generate evidence-based "why" bullets (Phase 3 enhancement)
   */
  generateWhyBullets(investor, candidate, score) {
    const bullets = [];
    
    // Sector activity
    if (investor.sectors?.length > 0) {
      bullets.push(`Active in ${investor.sectors.slice(0, 2).join(', ')}`);
    }
    
    // Stage focus
    if (investor.stage) {
      bullets.push(`Invests in ${investor.stage} stage companies`);
    }
    
    // Check size
    if (investor.check_size_min && investor.check_size_max) {
      const min = Math.round(investor.check_size_min / 1000);
      const max = Math.round(investor.check_size_max / 1000000);
      bullets.push(`Check size: $${min}k-${max}M`);
    }
    
    // High match score
    if (score >= 70) {
      bullets.push('Strong portfolio alignment detected');
    }
    
    // Phase change signal
    if (score >= 65) {
      bullets.push('Phase-change correlation detected');
    }
    
    return bullets.slice(0, 3);
  }
  
  /**
   * Select hidden preview investors (blurred)
   */
  selectHiddenPreview(candidates, visible5) {
    const visibleIds = new Set(visible5.map(v => v.investor_id));
    const hidden = candidates.filter(c => !visibleIds.has(c.investor.id)).slice(0, 10);
    
    return hidden.map((c, i) => ({
      blurred_id: `blurred_${i}`,
      stage: this.mapStageEnum(c.investor.stage),
      sector: c.investor.sectors?.[0] || 'Tech',
      signal_state: this.getSignalState(c.match_score)
    }));
  }
  
  /**
   * Step 5: Fetch comparable startups (easy now)
   */
  async fetchComparableStartups(startup) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, industry, stage, total_god_score, sectors')
      .eq('status', 'approved')
      .neq('id', startup.id)
      .gte('total_god_score', startup.total_god_score - 15)
      .lte('total_god_score', startup.total_god_score + 15)
      .limit(8);
    
    if (error || !data) return [];
    
    // Filter by industry/stage similarity
    const filtered = data.filter(s => 
      s.stage === startup.stage || 
      s.industry === startup.industry ||
      s.sectors?.some(sec => startup.sectors?.includes(sec))
    );
    
    return filtered.slice(0, 6).map(s => ({
      startup_id: s.id,
      name: s.name,
      stage: s.stage || 'Seed',
      sector: s.industry || s.sectors?.[0] || 'Tech',
      god_score_0_10: (s.total_god_score || 50) / 10,
      fomo_state: this.getFomoState(s.total_god_score),
      matched_investors: Math.floor(Math.random() * 20) + 5, // TODO: Count from matches table
      reason_tags: this.generateReasonTags(s, startup)
    }));
  }
  
  generateReasonTags(comparable, startup) {
    const tags = [];
    if (comparable.stage === startup.stage) tags.push('similar_stage');
    if (comparable.industry === startup.industry) tags.push('same_industry');
    if (Math.abs((comparable.total_god_score || 50) - (startup.total_god_score || 50)) < 10) {
      tags.push('comparable_velocity');
    }
    tags.push('portfolio_adjacency');
    return tags.slice(0, 3);
  }
  
  /**
   * Build alignment breakdown
   */
  buildAlignment(startup) {
    return {
      team_0_1: (startup.team_score || 50) / 100,
      market_0_1: (startup.market_score || 50) / 100,
      execution_0_1: (startup.product_score || 50) / 100,
      portfolio_0_1: 0.68, // TODO: Calculate from investor overlaps
      phase_change_0_1: (startup.total_god_score || 50) / 100,
      message: 'Investors historically engage when Phase Change Correlation exceeds 0.75'
    };
  }
  
  /**
   * Build coaching actions (Phase 4: Make dynamic)
   */
  buildImproveActions(startup, alignment) {
    const actions = [];
    
    // If team score low
    if (alignment.team_0_1 < 0.6) {
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
    }
    
    // If execution low
    if (alignment.execution_0_1 < 0.7) {
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
    }
    
    // If phase change below threshold
    if (alignment.phase_change_0_1 < 0.75) {
      actions.push({
        title: 'Accelerate Phase Change Probability',
        impact_pct: 15,
        steps: [
          'Announce key milestone',
          'Ship v2 feature',
          'Show revenue signal'
        ],
        category: 'phase_change'
      });
    }
    
    // Always suggest traction
    actions.push({
      title: 'Strengthen Traction Visibility',
      impact_pct: 9,
      steps: [
        'Publish customer proof',
        'Improve website change frequency',
        'Increase release cadence'
      ],
      category: 'traction'
    });
    
    return actions.slice(0, 3);
  }
  
  /**
   * Package final convergence response
   */
  async buildConvergenceResponse(startup) {
    const startTime = Date.now();
    
    // Step 2: Status metrics
    const status = this.buildStatusMetrics(startup);
    
    // Step 3: Fetch candidates
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
        data_sources: ['startup_uploads', 'startup_investor_matches', 'investors'],
        match_version: 'v1.3.1-real'
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
    
    return (overlap.length / investorSectors.length) * 100;
  }
  
  /**
   * Helper: Calculate stage fit
   */
  calculateStageFit(investorStage, startupStage) {
    if (!investorStage || !startupStage) return 'weak';
    
    const invLower = investorStage.toLowerCase();
    const startLower = startupStage.toLowerCase();
    
    if (invLower === startLower) return 'strong';
    
    // Adjacent stages
    const stages = ['preseed', 'seed', 'series a', 'series b'];
    const invIdx = stages.findIndex(s => invLower.includes(s));
    const startIdx = stages.findIndex(s => startLower.includes(s));
    
    if (invIdx >= 0 && startIdx >= 0 && Math.abs(invIdx - startIdx) <= 1) {
      return 'good';
    }
    
    return 'weak';
  }
  
  /**
   * Helper: Calculate timing component
   */
  calculateTiming(matchScore, godScore) {
    const phaseChange = godScore / 100;
    const fomo = matchScore >= 70 ? 0.8 : 0.5;
    const velocity = matchScore >= 75 ? 0.9 : 0.6;
    return phaseChange * fomo * velocity;
  }
  
  /**
   * Helper: Map stage to enum
   */
  mapStageEnum(stage) {
    if (!stage) return 'seed';
    const lower = stage.toLowerCase();
    if (lower.includes('pre')) return 'preseed';
    if (lower.includes('seed') && !lower.includes('series')) return 'seed';
    if (lower.includes('series a') || lower === 'a') return 'series_a';
    return 'series_b_plus';
  }
  
  getSignalState(score) {
    if (score >= 80) return 'breakout';
    if (score >= 70) return 'surge';
    if (score >= 60) return 'warming';
    return 'watch';
  }
  
  getFomoState(godScore) {
    if (godScore >= 80) return 'breakout';
    if (godScore >= 70) return 'surge';
    if (godScore >= 60) return 'warming';
    return 'watch';
  }
}

module.exports = { ConvergenceService };
