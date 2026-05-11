/**
 * ENHANCED MATCHING SERVICE v2
 * =============================
 * 
 * Integrates DynamicMatch v2 for intelligent startup-investor matching.
 * 
 * Improvements over v1:
 * 1. Signal-based enrichment before matching
 * 2. Investor thesis alignment (not just sectors)
 * 3. Predictive scoring based on investment likelihood
 * 
 * Expected Results:
 * - Average match score: 40 → 55+
 * - High-quality matches (60+): 2% → 30%
 * - More actionable matches for investors
 */

const { DynamicMatchEngine } = require('../../lib/dynamicmatch-v2');

class EnhancedMatchingService {
  constructor(supabase) {
    this.supabase = supabase;
    this.engine = new DynamicMatchEngine();
    
    // Investor thesis patterns - what signals matter to different investor types
    this.investorThesis = {
      // Stage-based preferences
      'pre-seed': {
        weights: { team: 0.4, product: 0.3, market: 0.2, traction: 0.1 },
        signals: ['technicalFounder', 'repeatFounder', 'yc', 'bigTechAlumni'],
        minGodScore: 30
      },
      'seed': {
        weights: { team: 0.3, product: 0.25, traction: 0.25, market: 0.2 },
        signals: ['isLaunched', 'hasCustomers', 'technicalFounder'],
        minGodScore: 40
      },
      'series-a': {
        weights: { traction: 0.4, team: 0.25, market: 0.2, product: 0.15 },
        signals: ['hasRevenue', 'growthRate', 'hasCustomers'],
        minGodScore: 50
      },
      'series-b': {
        weights: { traction: 0.5, market: 0.25, team: 0.15, product: 0.1 },
        signals: ['hasRevenue', 'arr', 'growthRate'],
        minGodScore: 58
      },
      'growth': {
        weights: { traction: 0.6, market: 0.25, team: 0.1, product: 0.05 },
        signals: ['hasRevenue', 'arr', 'profitability'],
        minGodScore: 65
      }
    };

    // Sector affinity matrix - how related sectors are
    this.sectorAffinity = {
      'ai': ['devtools', 'enterprise', 'saas', 'healthtech'],
      'fintech': ['crypto', 'enterprise', 'saas'],
      'healthtech': ['biotech', 'ai', 'consumer'],
      'devtools': ['ai', 'saas', 'enterprise'],
      'saas': ['enterprise', 'devtools', 'ai'],
      'consumer': ['marketplace', 'fintech'],
      'marketplace': ['consumer', 'saas'],
      'climatetech': ['hardware', 'enterprise'],
      'crypto': ['fintech', 'consumer'],
      'biotech': ['healthtech'],
      'enterprise': ['saas', 'ai', 'devtools'],
      'hardware': ['climatetech', 'consumer']
    };
  }

  /**
   * Generate matches for a startup using enhanced matching
   */
  async generateMatches(startupId, options = {}) {
    const { maxMatches = 50, minScore = 35 } = options;

    try {
      // 1. Get and enrich startup data
      const startup = await this.getEnrichedStartup(startupId);
      if (!startup) {
        throw new Error(`Startup not found: ${startupId}`);
      }

      // 2. Get potential investors
      const investors = await this.getActiveInvestors();
      if (investors.length === 0) {
        throw new Error('No active investors found');
      }

      // 3. Score each investor match
      const matches = [];
      for (const investor of investors) {
        const matchResult = this.calculateMatch(startup, investor);
        if (matchResult.score >= minScore) {
          const details = matchResult.analysis?.details || [];
          const reasoning =
            details.length > 0 ? details.join(' · ') : `Match score ${Math.round(matchResult.score)}`;
          matches.push({
            startup_id: startupId,
            investor_id: investor.id,
            match_score: Math.round(matchResult.score),
            confidence_level: matchResult.confidence,
            reasoning,
            why_you_match: details,
            fit_analysis: matchResult.analysis,
            status: 'suggested',
          });
        }
      }

      // 4. Sort and limit
      matches.sort((a, b) => b.match_score - a.match_score);
      const topMatches = matches.slice(0, maxMatches);

      // 5. Upsert to database
      if (topMatches.length > 0) {
        const { error } = await this.supabase
          .from('startup_investor_matches')
          .upsert(topMatches, { onConflict: 'startup_id,investor_id' });

        if (error) throw error;
      }

      return {
        success: true,
        startupId,
        matchCount: topMatches.length,
        avgScore: topMatches.length > 0 
          ? Math.round(topMatches.reduce((s, m) => s + m.match_score, 0) / topMatches.length)
          : 0,
        topScore: topMatches[0]?.match_score || 0
      };

    } catch (error) {
      console.error(`Match generation failed for ${startupId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get startup with enriched signals from DynamicMatch v2
   */
  async getEnrichedStartup(startupId) {
    // Get base startup data
    const { data: startup, error } = await this.supabase
      .from('startup_uploads')
      .select('*')
      .eq('id', startupId)
      .single();

    if (error || !startup) return null;

    // Extract signals from existing data
    const signals = this.extractSignalsFromStartup(startup);

    // If we have a website, try to enrich further
    if (startup.website && !startup.enriched_at) {
      try {
        const enrichment = await this.engine.analyze(startup.website, {
          companyName: startup.company_name
        });
        
        if (enrichment.success) {
          // Merge enriched signals
          Object.assign(signals, this.mergeSignals(signals, enrichment.signals));
          
          // Update startup with enrichment timestamp
          await this.supabase
            .from('startup_uploads')
            .update({ 
              enriched_at: new Date().toISOString(),
              extracted_data: { ...startup.extracted_data, dynamicmatch: enrichment }
            })
            .eq('id', startupId);
        }
      } catch (e) {
        // Enrichment failed, continue with existing data
        console.log(`Enrichment skipped for ${startupId}: ${e.message}`);
      }
    }

    return {
      ...startup,
      signals,
      godScore: startup.total_god_score || this.calculateGodScore(signals)
    };
  }

  /**
   * Extract signals from startup database record
   */
  extractSignalsFromStartup(startup) {
    const extracted = startup.extracted_data || {};
    
    return {
      // Traction
      hasRevenue: startup.has_revenue || extracted.hasRevenue || false,
      hasCustomers: startup.has_customers || extracted.hasCustomers || false,
      isLaunched: startup.is_launched || extracted.isLaunched || false,
      userCount: extracted.users || 0,
      growthRate: extracted.growthRate || 0,
      arr: extracted.arr || 0,
      
      // Team
      teamSize: startup.team_size || extracted.employees || 1,
      technicalFounder: extracted.technicalFounder || false,
      repeatFounder: extracted.repeatFounder || false,
      bigTechAlumni: extracted.bigTechAlumni || false,
      yc: extracted.yc || startup.tagline?.toLowerCase().includes('yc') || false,
      
      // Product
      category: startup.sectors?.[0]?.toLowerCase() || 'unknown',
      hasDemo: extracted.hasDemo || false,
      hasApi: extracted.hasApi || false,
      openSource: extracted.openSource || false,
      
      // Funding
      hasFunding: startup.funding_stage && startup.funding_stage !== 'pre-seed',
      fundingStage: this.normalizeFundingStage(startup.funding_stage),
      fundingAmount: startup.funding_amount || extracted.fundingAmount || 0,
      
      // Market
      sectors: startup.sectors || [],
      
      // Meta
      godScore: startup.total_god_score || 0
    };
  }

  /**
   * Merge signals from multiple sources
   */
  mergeSignals(existing, newSignals) {
    const merged = { ...existing };
    
    // Prefer truthy values
    for (const [key, value] of Object.entries(newSignals)) {
      if (value && (value === true || value > (existing[key] || 0))) {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  /**
   * Get active investors with their preferences
   */
  async getActiveInvestors() {
    const { data, error } = await this.supabase
      .from('investors')
      .select('id, name, sectors, stage, check_size_min, check_size_max, thesis, location')
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  }

  /**
   * Calculate match score between startup and investor
   */
  calculateMatch(startup, investor) {
    let score = 0;
    const analysis = {
      sectorFit: 0,
      stageFit: 0,
      signalFit: 0,
      thesisFit: 0,
      details: []
    };

    // 1. SECTOR FIT (0-30 points)
    const sectorScore = this.calculateSectorFit(startup, investor);
    score += sectorScore;
    analysis.sectorFit = sectorScore;
    if (sectorScore >= 20) {
      analysis.details.push('Strong sector alignment');
    }

    // 2. STAGE FIT (0-25 points)
    const stageScore = this.calculateStageFit(startup, investor);
    score += stageScore;
    analysis.stageFit = stageScore;
    if (stageScore >= 15) {
      analysis.details.push('Stage-appropriate');
    }

    // 3. SIGNAL FIT (0-30 points)
    const signalScore = this.calculateSignalFit(startup, investor);
    score += signalScore;
    analysis.signalFit = signalScore;
    if (signalScore >= 20) {
      analysis.details.push('Strong traction signals');
    }

    // 4. THESIS FIT (0-15 points)
    const thesisScore = this.calculateThesisFit(startup, investor);
    score += thesisScore;
    analysis.thesisFit = thesisScore;
    if (thesisScore >= 10) {
      analysis.details.push('Matches investor thesis');
    }

    // 5. GOD SCORE BONUS (0-10 points)
    const godBonus = Math.min(10, (startup.godScore - 40) / 4);
    if (godBonus > 0) {
      score += godBonus;
      analysis.details.push(`High GOD score (${startup.godScore})`);
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(analysis, startup);

    return {
      score: Math.min(100, Math.max(0, score)),
      confidence,
      analysis
    };
  }

  /**
   * Calculate sector fit (0-30 points)
   */
  calculateSectorFit(startup, investor) {
    const startupSectors = (startup.sectors || []).map(s => s.toLowerCase());
    const investorSectors = (investor.sectors || []).map(s => s.toLowerCase());

    if (startupSectors.length === 0 || investorSectors.length === 0) {
      return 10; // Base score for unknown
    }

    let score = 0;

    // Direct match (30 points)
    const directMatch = startupSectors.some(s => 
      investorSectors.some(is => is.includes(s) || s.includes(is))
    );
    if (directMatch) {
      score = 30;
    } else {
      // Check affinity (15-20 points)
      const primarySector = startupSectors[0];
      const relatedSectors = this.sectorAffinity[primarySector] || [];
      
      const affinityMatch = relatedSectors.some(rs =>
        investorSectors.some(is => is.includes(rs) || rs.includes(is))
      );
      
      if (affinityMatch) {
        score = 18;
      } else {
        // No match (5-10 points base)
        score = 8;
      }
    }

    return score;
  }

  /**
   * Calculate stage fit (0-25 points)
   */
  calculateStageFit(startup, investor) {
    const startupStage = startup.signals.fundingStage || 0;
    const investorStage = this.normalizeFundingStage(investor.stage);

    // Perfect match
    if (Math.abs(startupStage - investorStage) === 0) {
      return 25;
    }

    // Adjacent stage (investor invests in next stage)
    if (investorStage - startupStage === 1) {
      return 20; // Startup ready for next round
    }

    // One stage behind
    if (startupStage - investorStage === 1) {
      return 12; // Startup might be too advanced
    }

    // Two or more stages apart
    const diff = Math.abs(startupStage - investorStage);
    return Math.max(0, 15 - diff * 5);
  }

  /**
   * Calculate signal fit based on investor preferences (0-30 points)
   */
  calculateSignalFit(startup, investor) {
    const signals = startup.signals;
    const investorStage = investor.stage?.toLowerCase() || 'seed';
    const thesis = this.investorThesis[investorStage] || this.investorThesis['seed'];

    let score = 0;
    let matchedSignals = 0;

    // Check for thesis-relevant signals
    for (const signal of thesis.signals) {
      if (signals[signal]) {
        matchedSignals++;
      }
    }

    // Base score from signal matches
    score = (matchedSignals / thesis.signals.length) * 20;

    // Weighted component scores
    const weights = thesis.weights;
    
    // Traction component
    if (signals.hasRevenue) score += weights.traction * 15;
    else if (signals.hasCustomers) score += weights.traction * 10;
    else if (signals.isLaunched) score += weights.traction * 5;

    // Team component
    if (signals.repeatFounder) score += weights.team * 12;
    if (signals.yc) score += weights.team * 10;
    if (signals.bigTechAlumni) score += weights.team * 6;
    if (signals.technicalFounder) score += weights.team * 4;

    // Product component
    if (signals.hasDemo) score += weights.product * 5;
    if (signals.hasApi) score += weights.product * 5;

    // Market component (sector heat already in sector fit)
    
    return Math.min(30, score);
  }

  /**
   * Calculate thesis fit (0-15 points)
   */
  calculateThesisFit(startup, investor) {
    // If investor has explicit thesis keywords, match against startup
    const thesis = (investor.thesis || '').toLowerCase();
    if (!thesis) return 8; // Neutral

    const startupText = [
      startup.company_name,
      startup.tagline,
      startup.description,
      ...(startup.sectors || [])
    ].join(' ').toLowerCase();

    // Count thesis keyword matches
    const thesisWords = thesis.split(/\s+/).filter(w => w.length > 3);
    let matches = 0;
    
    for (const word of thesisWords) {
      if (startupText.includes(word)) {
        matches++;
      }
    }

    const matchRate = thesisWords.length > 0 ? matches / thesisWords.length : 0;
    return Math.round(matchRate * 15);
  }

  /**
   * Calculate confidence level
   */
  calculateConfidence(analysis, startup) {
    const totalPossible = 30 + 25 + 30 + 15 + 10; // 110
    const achieved = analysis.sectorFit + analysis.stageFit + analysis.signalFit + analysis.thesisFit;
    const rate = achieved / totalPossible;

    // Also factor in data quality
    const hasGoodData = startup.signals.godScore > 0 && startup.sectors?.length > 0;

    if (rate >= 0.7 && hasGoodData) return 'high';
    if (rate >= 0.5 || hasGoodData) return 'medium';
    return 'low';
  }

  /**
   * Normalize funding stage to numeric value
   */
  normalizeFundingStage(stage) {
    const stages = {
      'pre-seed': 0,
      'angel': 0,
      'seed': 1,
      'series a': 2,
      'series-a': 2,
      'series b': 3,
      'series-b': 3,
      'series c': 4,
      'series-c': 4,
      'series d': 5,
      'series-d': 5,
      'growth': 5,
      'late': 6
    };
    return stages[(stage || '').toLowerCase()] ?? 1;
  }

  /**
   * Calculate GOD score from signals (fallback)
   */
  calculateGodScore(signals) {
    let score = 30;

    // Traction
    if (signals.hasRevenue) score += 15;
    if (signals.hasCustomers) score += 8;
    if (signals.isLaunched) score += 5;

    // Team
    if (signals.repeatFounder) score += 10;
    if (signals.yc) score += 8;
    if (signals.bigTechAlumni) score += 5;
    if (signals.technicalFounder) score += 4;

    // Funding
    if (signals.hasFunding) score += 5;

    return Math.min(100, score);
  }

  /**
   * Batch process multiple startups
   */
  async processBatch(startupIds, onProgress = null) {
    const results = [];
    
    for (let i = 0; i < startupIds.length; i++) {
      const result = await this.generateMatches(startupIds[i]);
      results.push(result);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: startupIds.length,
          percent: Math.round((i + 1) / startupIds.length * 100),
          lastResult: result
        });
      }
    }

    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      avgMatchScore: Math.round(
        results.filter(r => r.success).reduce((s, r) => s + r.avgScore, 0) / 
        results.filter(r => r.success).length
      )
    };
  }
}

module.exports = { EnhancedMatchingService };
