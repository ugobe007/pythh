/**
 * Spiky Bachelor Recognition Service
 * ====================================
 * 
 * Identifies Bachelors (45-59) with "spiky" profiles where one or more component
 * scores significantly exceed the cohort average. These startups show genuine 
 * strength in specific dimensions but are pulled down by data gaps elsewhere.
 * 
 * Unlike the AP system (which looks for prestigious signals like Tier 1 investors
 * or FAANG teams), this service rewards ORGANIC quality — a startup with 75 traction
 * score but 30 vision score is clearly strong, just unevenly documented.
 * 
 * Also handles "Hot Startup" detection for any tier — startups with momentum
 * signals (FOMO, growth, oversubscribed) get a heat bonus.
 * 
 * Scoring:
 *   Spiky Profile Bonus (Bachelors only): +0 to +4
 *     - 1 component ≥65: +1.5
 *     - 2+ components ≥55: +1.0 additional  
 *     - Spike ≥75: +1.5 additional (exceptional in one area)
 *     - Requires at least one component ≥55 AND another ≥40 (not just random noise)
 * 
 *   Hot Startup Bonus (any tier, additive): +0 to +3
 *     - Growth rate evidence: +1.0
 *     - Oversubscribed/FOMO signals: +1.0
 *     - Multiple traction signals: +1.0
 *     - Requires GOD score ≥43 (don't boost garbage)
 * 
 * ============================================================================
 */

interface SpikyResult {
  applied: boolean;
  spikyBonus: number;
  hotBonus: number;
  totalBonus: number;
  spikes: string[];      // Which components spiked
  heatSignals: string[]; // Which heat signals found
}

// Component score averages for Bachelor cohort (from score-depth-analysis diagnostic)
const BACHELOR_COMPONENT_AVGS = {
  team_score: 35,
  traction_score: 21,
  market_score: 40,
  product_score: 26,
  vision_score: 28,
};

// Threshold for a "spike" — significantly above cohort average
const SPIKE_THRESHOLD = 65;     // 1 standard deviation above for most components
const SECONDARY_THRESHOLD = 55; // Solid — noticeably above average
const EXCEPTIONAL_SPIKE = 75;   // Top-tier in one dimension

/**
 * Calculate spiky profile and hot startup bonuses
 */
export function calculateSpikyAndHotBonus(startup: any, currentScore: number): SpikyResult {
  const spikes: string[] = [];
  const heatSignals: string[] = [];
  let spikyBonus = 0;
  let hotBonus = 0;
  
  // ── SPIKY PROFILE BONUS (Bachelors 45-59 only) ──
  if (currentScore >= 45 && currentScore <= 59) {
    const components = {
      team: startup.team_score || 0,
      traction: startup.traction_score || 0,
      market: startup.market_score || 0,
      product: startup.product_score || 0,
      vision: startup.vision_score || 0,
    };
    
    const values = Object.values(components);
    const spikeCount = values.filter(v => v >= SPIKE_THRESHOLD).length;
    const solidCount = values.filter(v => v >= SECONDARY_THRESHOLD).length;
    const exceptionalCount = values.filter(v => v >= EXCEPTIONAL_SPIKE).length;
    const minComponent = Math.min(...values);
    
    // Identify which components spiked
    for (const [name, val] of Object.entries(components)) {
      if (val >= SPIKE_THRESHOLD) {
        spikes.push(`${name}=${val}`);
      }
    }
    
    // Must have at least one meaningful component (floor > 40 means some data exists)
    if (spikeCount >= 1 && minComponent >= 10) {
      // Base spike bonus: one strong component
      spikyBonus += 1.5;
      
      // Multi-strength bonus: 2+ components solidly above average
      if (solidCount >= 2) {
        spikyBonus += 1.0;
      }
      
      // Exceptional spike: one component is truly outstanding
      if (exceptionalCount >= 1) {
        spikyBonus += 1.5;
      }
      
      // Cap at 2 — RECALIBRATED (Feb 16, 2026) (ADMIN APPROVED)
      spikyBonus = Math.min(spikyBonus, 2);
    }
  }
  
  // ── HOT STARTUP BONUS (any tier, score ≥ 43) ──
  if (currentScore >= 43) {
    const ed = startup.extracted_data || {};
    const allText = [
      startup.description || '',
      startup.pitch || '',
      startup.tagline || '',
      ed.value_proposition || '',
      JSON.stringify(startup.signals || {}),
    ].join(' ').toLowerCase();
    
    // Growth rate evidence
    const growthRate = startup.growth_rate_monthly || startup.growth_rate || ed.growth_rate || 0;
    if (growthRate > 20) {
      hotBonus += 1.0;
      heatSignals.push(`growth:${growthRate}%`);
    } else if (growthRate > 10) {
      hotBonus += 0.5;
      heatSignals.push(`growth:${growthRate}%`);
    } else if (allText.match(/\b(growing|growth|accelerat|scaling|scale|hockey.?stick|exponential)\b/)) {
      hotBonus += 0.3;
      heatSignals.push('growth-mention');
    }
    
    // Oversubscribed / FOMO signals
    if (startup.is_oversubscribed || startup.fomo_signal_strength > 0) {
      hotBonus += 1.0;
      heatSignals.push('oversubscribed');
    } else if (allText.match(/\b(oversubscrib|waitlist|demand|inbound|high.?demand|buzz|viral)\b/)) {
      hotBonus += 0.4;
      heatSignals.push('fomo-mention');
    }
    
    // Multiple traction evidence points
    let tractionPoints = 0;
    if (startup.mrr || ed.mrr) tractionPoints++;
    if (startup.arr || ed.arr || ed.revenue) tractionPoints++;
    if (startup.customer_count > 0 || ed.customers) tractionPoints++;
    if (startup.has_revenue || ed.has_revenue) tractionPoints++;
    if (allText.match(/\b(paying|subscriber|contract|client|user.?base)\b/)) tractionPoints++;
    
    if (tractionPoints >= 3) {
      hotBonus += 1.0;
      heatSignals.push(`traction:${tractionPoints}signals`);
    } else if (tractionPoints >= 2) {
      hotBonus += 0.5;
      heatSignals.push(`traction:${tractionPoints}signals`);
    }
    
    // Cap hot bonus at 1 — RECALIBRATED (Feb 16, 2026) (ADMIN APPROVED)
    hotBonus = Math.min(hotBonus, 1);
  }
  
  const totalBonus = spikyBonus + hotBonus;
  
  return {
    applied: totalBonus > 0,
    spikyBonus: Math.round(spikyBonus * 10) / 10,
    hotBonus: Math.round(hotBonus * 10) / 10,
    totalBonus: Math.round(totalBonus * 10) / 10,
    spikes,
    heatSignals,
  };
}
