/**
 * Inference Gate V2 - Gating Matrix
 * 
 * Implements the 3-step gating matrix:
 * Step 1: Identity gate (hard fail)
 * Step 2: Completeness gate (browser)
 * Step 3: Score-impact gate (LLM)
 */

class InferenceGateV2 {
  /**
   * Step 1: Identity Gate (hard fail)
   * If any of these are true → do NOT LLM yet (re-crawl / try alternate evidence)
   */
  static checkIdentityGate(contract) {
    const failures = [];
    
    // No canonical domain
    if (!contract.canonical_domain) {
      failures.push({
        reason: 'no_canonical_domain',
        action: 're_crawl',
        message: 'Missing canonical domain - run domain finder (Tier 1)'
      });
    }
    
    // Domain is generic host (linktree, notion, substack, medium)
    if (contract.canonical_domain) {
      const genericHosts = ['linktr.ee', 'notion.site', 'substack.com', 'medium.com', 'wixsite.com', 'wordpress.com'];
      const isGeneric = genericHosts.some(host => contract.canonical_domain.includes(host));
      
      if (isGeneric) {
        // Check if we found an official site in evidence
        const hasOfficialSite = contract.evidence.some(e => {
          const url = e.url?.toLowerCase() || '';
          return !genericHosts.some(host => url.includes(host));
        });
        
        if (!hasOfficialSite) {
          failures.push({
            reason: 'generic_host_no_official_site',
            action: 'domain_finder',
            message: 'Domain is generic host (linktree/notion/substack) - need to find official site'
          });
        }
      }
    }
    
    // Company name too short/ambiguous
    if (contract.company_name) {
      const ambiguousNames = ['Halo', 'Nova', 'Pilot', 'Spark', 'Edge', 'Core', 'Base', 'Flow', 'Wave'];
      if (ambiguousNames.includes(contract.company_name) && !contract.canonical_domain) {
        failures.push({
          reason: 'ambiguous_name_no_domain',
          action: 're_crawl',
          message: 'Company name is ambiguous and no domain found'
        });
      }
    }
    
    return {
      passed: failures.length === 0,
      failures,
      action: failures.length > 0 ? failures[0].action : 'continue'
    };
  }
  
  /**
   * Step 2: Completeness Gate (browser)
   * Escalate to Tier 2 if conditions are met
   */
  static checkCompletenessGate(contract, earlyGODScore = null) {
    const needsBrowser = [];
    
    // one_liner missing AND site is JS-rendered (we'd need to check this, but assume if missing)
    if (!contract.one_liner) {
      needsBrowser.push({
        reason: 'missing_one_liner',
        action: 'tier2_browser',
        message: 'One-liner missing - may need browser for JS-rendered content'
      });
    }
    
    // Category/stage confidence < 0.6
    if (contract.stage_confidence && contract.stage_confidence < 0.6) {
      needsBrowser.push({
        reason: 'low_stage_confidence',
        action: 'tier2_browser',
        message: 'Stage confidence too low - need browser to verify'
      });
    }
    
    // Team signals empty AND "About/Team" route exists (we'd need to check, but assume if empty)
    if (contract.team_signals.length === 0 && contract.website_url) {
      needsBrowser.push({
        reason: 'missing_team_signals',
        action: 'tier2_browser',
        message: 'Team signals missing - may need browser for About/Team page'
      });
    }
    
    // Startup is in top X% of Early GOD and missing key fields
    if (earlyGODScore !== null && earlyGODScore >= 60) {
      const missingFields = [];
      if (!contract.category_primary) missingFields.push('category');
      if (!contract.stage_estimate) missingFields.push('stage');
      if (!contract.one_liner) missingFields.push('one_liner');
      if (contract.traction_signals.length === 0) missingFields.push('traction_signals');
      
      if (missingFields.length > 0) {
        needsBrowser.push({
          reason: 'top_startup_missing_fields',
          action: 'tier2_browser',
          message: `Top startup (score ${earlyGODScore}) missing: ${missingFields.join(', ')}`
        });
      }
    }
    
    return {
      needsBrowser: needsBrowser.length > 0,
      reasons: needsBrowser,
      action: needsBrowser.length > 0 ? 'tier2_browser' : 'continue'
    };
  }
  
  /**
   * Step 3: Score-Impact Gate (LLM)
   * Only call LLM if startup is in top 5-15% AND missing field would change GOD by ≥ threshold
   */
  static checkScoreImpactGate(contract, earlyGODScore, percentileRank, threshold = 5) {
    // Only for top 5-15% of startups
    if (percentileRank > 15) {
      return {
        shouldUseLLM: false,
        reason: 'not_top_percentile',
        action: 'skip',
        message: `Startup is in ${percentileRank}th percentile - not worth LLM cost`
      };
    }
    
    // Check if missing/uncertain field would change GOD by ≥ threshold
    const impactAnalysis = this._analyzeFieldImpact(contract, threshold);
    
    if (impactAnalysis.wouldChangeScore) {
      return {
        shouldUseLLM: true,
        reason: impactAnalysis.reason,
        action: 'llm_enrich',
        message: impactAnalysis.message,
        fields: impactAnalysis.fields
      };
    }
    
    return {
      shouldUseLLM: false,
      reason: 'low_impact',
      action: 'skip',
      message: 'Missing fields would not change GOD score significantly'
    };
  }
  
  /**
   * Analyze which fields would impact GOD score
   */
  static _analyzeFieldImpact(contract, threshold) {
    const impacts = [];
    
    // "Is this enterprise or consumer?" (affects investor matching)
    if (!contract.category_primary || contract.category_tags.length === 0) {
      impacts.push({
        field: 'category',
        impact: 8, // High impact on matching
        reason: 'category_uncertainty',
        message: 'Category unclear - affects investor matching significantly'
      });
    }
    
    // "Is this actually funded / YC-backed?" (affects credibility)
    if (contract.funding_mentions.length === 0 && contract.accelerators.length === 0) {
      impacts.push({
        field: 'funding_status',
        impact: 10, // Very high impact
        reason: 'funding_uncertainty',
        message: 'Funding status unknown - high impact on credibility score'
      });
    }
    
    // "Is traction real or marketing fluff?" (affects opportunity/determination)
    if (contract.traction_signals.length === 0) {
      impacts.push({
        field: 'traction',
        impact: 7, // High impact
        reason: 'traction_uncertainty',
        message: 'No traction signals - affects opportunity/determination scores'
      });
    }
    
    // Stage uncertainty (affects matching)
    if (!contract.stage_estimate || (contract.stage_confidence && contract.stage_confidence < 0.7)) {
      impacts.push({
        field: 'stage',
        impact: 6, // Medium-high impact
        reason: 'stage_uncertainty',
        message: 'Stage uncertain - affects investor matching'
      });
    }
    
    // Find fields that would change score by ≥ threshold
    const significantImpacts = impacts.filter(i => i.impact >= threshold);
    
    return {
      wouldChangeScore: significantImpacts.length > 0,
      reason: significantImpacts.length > 0 ? significantImpacts[0].reason : 'no_impact',
      message: significantImpacts.length > 0 ? significantImpacts[0].message : 'No significant impact',
      fields: significantImpacts.map(i => i.field)
    };
  }
  
  /**
   * Main gating decision function
   */
  static shouldEnrich(contract, earlyGODScore = null, percentileRank = null) {
    // Step 1: Identity gate
    const identityCheck = this.checkIdentityGate(contract);
    if (!identityCheck.passed) {
      return {
        shouldEnrich: false,
        tier: null,
        reason: identityCheck.failures[0].reason,
        action: identityCheck.action,
        message: identityCheck.failures[0].message
      };
    }
    
    // Step 2: Completeness gate (browser)
    const completenessCheck = this.checkCompletenessGate(contract, earlyGODScore);
    if (completenessCheck.needsBrowser) {
      return {
        shouldEnrich: true,
        tier: 2, // Browser
        reason: completenessCheck.reasons[0].reason,
        action: 'tier2_browser',
        message: completenessCheck.reasons[0].message
      };
    }
    
    // Step 3: Score-impact gate (LLM) - only if percentile rank provided
    if (percentileRank !== null && earlyGODScore !== null) {
      const scoreImpactCheck = this.checkScoreImpactGate(contract, earlyGODScore, percentileRank);
      if (scoreImpactCheck.shouldUseLLM) {
        return {
          shouldEnrich: true,
          tier: 2, // LLM (via browser)
          reason: scoreImpactCheck.reason,
          action: 'llm_enrich',
          message: scoreImpactCheck.message,
          fields: scoreImpactCheck.fields
        };
      }
    }
    
    // Default: don't enrich (sufficient data)
    return {
      shouldEnrich: false,
      tier: null,
      reason: 'sufficient_data',
      action: 'skip',
      message: 'Contract has sufficient data - no enrichment needed'
    };
  }
  
  /**
   * Estimate early GOD score (without expensive enrichment)
   */
  static estimateEarlyGOD(contract) {
    let score = 40; // Base score
    
    // Category match (+5)
    if (contract.category_primary) {
      score += 5;
    }
    
    // Stage indication (+5)
    if (contract.stage_estimate) {
      score += 5;
    }
    
    // Traction signals (+2 per signal, max +10)
    score += Math.min(contract.traction_signals.length * 2, 10);
    
    // Investor signals (+3 per signal, max +15)
    score += Math.min(contract.funding_mentions.length * 3, 15);
    score += Math.min(contract.accelerators.length * 5, 15);
    
    // Team signals (+2 per signal, max +10)
    score += Math.min(contract.team_signals.length * 2, 10);
    
    // Confidence boost (+5 if high confidence)
    if (contract.confidence_scores.overall >= 0.7) {
      score += 5;
    }
    
    // Domain boost (+5 if canonical domain exists)
    if (contract.canonical_domain) {
      score += 5;
    }
    
    return Math.min(score, 100);
  }
}

module.exports = InferenceGateV2;


