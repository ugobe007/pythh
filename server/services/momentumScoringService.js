/**
 * ============================================================================
 * MOMENTUM SCORING SERVICE — Forward Movement Recognition
 * ============================================================================
 *
 * PURPOSE: Recognize startups showing forward movement ("studying for next degree")
 * without penalizing those who already earned their score.
 *
 * PHILOSOPHY:
 *   - PhDs earned their 80+. Don't touch them.
 *   - Masters studying for PhD should be recognized (momentum lift)
 *   - Bachelors showing progress signals deserve credit
 *   - Freshman with basic effort get a small nod
 *   - But garbage stays garbage — no free points for nothing
 *
 * DESIGN:
 *   - Purely ADDITIVE layer (like bootstrap, like signals)
 *   - Integrates at recalculate-scores.ts level
 *   - Does NOT modify calculateHotScore() or startupScoringService.ts
 *   - Max bonus: 8 points (enough to move within a tier, not skip one)
 *   - Uses score_history for trajectory detection
 *
 * SCORING DIMENSIONS:
 *   1. Revenue Trajectory    (0-2 pts) — Has revenue AND growing
 *   2. Customer Trajectory   (0-2 pts) — Has customers AND growing
 *   3. Product Maturity      (0-1.5 pts) — Launched → demo → paying users
 *   4. Team Strength         (0-1 pt) — Tech cofounder + team depth
 *   5. Data Completeness     (0-1 pt) — Filling out profile = doing homework
 *   6. Score Trajectory      (0-0.5 pts) — Score improving over time (from history)
 *
 * ANTI-GAMING:
 *   - Component must be REAL (backed by data, not just field presence)
 *   - Score trajectory only counts verified increases (from recalculation, not bootstrap)
 *   - Data completeness rewards quality, not just quantity
 *   - Cap prevents gaming into the next tier purely through momentum
 *
 * INTEGRATION POINT:
 *   finalScore = GOD + bootstrap + signals + momentum
 *   (wired into scripts/recalculate-scores.ts)
 *
 * Created: Feb 14, 2026
 * Status: AWAITING ADMIN APPROVAL before integration
 */

// ============================================================================
// MOMENTUM CONFIG  
// ============================================================================

const MOMENTUM_CONFIG = {
  // Maximum total momentum bonus
  maxBonus: 8,

  // Per-dimension caps
  revenueTrajectory: {
    maxScore: 2.0,
    levels: {
      revenueAndGrowth: 2.0,   // Has revenue AND positive growth rate
      revenueOnly:      1.0,   // Has revenue/MRR/ARR but no growth data
      revenueClaimed:   0.3,   // has_revenue=true but no numbers
    }
  },

  customerTrajectory: {
    maxScore: 2.0,
    levels: {
      customersAndGrowth: 2.0,   // Has customer count AND positive growth
      customersOnly:     1.0,   // Has customer count but no growth data
      customersClaimed:  0.3,   // has_customers=true but no numbers
    }
  },

  productMaturity: {
    maxScore: 1.5,
    levels: {
      launchedAndDemo:  1.5,   // Launched product WITH demo/working product
      launchedOnly:     0.8,   // Launched but no demo
      mvpOnly:          0.4,   // Has MVP but not "launched"
    }
  },

  teamStrength: {
    maxScore: 1.0,
    levels: {
      techCofounderAndTeam: 1.0,  // Tech cofounder + team ≥ 3
      techCofounderOnly:    0.5,  // Tech cofounder OR team ≥ 3
    }
  },

  dataCompleteness: {
    maxScore: 1.0,
    thresholds: {
      rich:    { minFields: 12, score: 1.0 },  // 12+ high-quality fields filled
      good:    { minFields: 8,  score: 0.5 },  // 8-11 fields
      partial: { minFields: 5,  score: 0.2 },  // 5-7 fields
    }
  },

  scoreTrajectory: {
    maxScore: 0.5,
    // Only count verified score increases from the last N days
    lookbackDays: 30,
    minIncrease: 3,     // Need at least 3-point increase to count
    score: 0.5,         // Flat 0.5 if trajectory is upward
  },
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * @typedef {Object} MomentumResult
 * @property {number} total - Total momentum bonus (0-8)
 * @property {boolean} applied - Whether any momentum was detected
 * @property {Object} breakdown - Per-dimension scores
 * @property {number} breakdown.revenueTrajectory
 * @property {number} breakdown.customerTrajectory
 * @property {number} breakdown.productMaturity
 * @property {number} breakdown.teamStrength
 * @property {number} breakdown.dataCompleteness
 * @property {number} breakdown.scoreTrajectory
 * @property {string[]} signals - Human-readable signal descriptions
 * @property {string} tier - Current degree tier (phd/masters/bachelors/freshman)
 */

// ============================================================================
// MOMENTUM CALCULATION
// ============================================================================

/**
 * Calculate momentum score for a startup.
 * 
 * @param {Object} startup - The startup record from startup_uploads
 * @param {Object} [options] - Optional config overrides  
 * @param {Object[]} [options.scoreHistory] - Score history records (pre-fetched for batch mode)
 * @returns {MomentumResult}
 */
function calculateMomentumScore(startup, options = {}) {
  const ext = startup.extracted_data || {};
  const signals = [];
  const breakdown = {
    revenueTrajectory: 0,
    customerTrajectory: 0,
    productMaturity: 0,
    teamStrength: 0,
    dataCompleteness: 0,
    scoreTrajectory: 0,
  };

  // Determine current tier
  const score = startup.total_god_score || 0;
  const tier = score >= 80 ? 'phd' : score >= 60 ? 'masters' : score >= 45 ? 'bachelors' : 'freshman';

  // ── 1. Revenue Trajectory ──
  const hasMRR = (startup.mrr > 0) || (ext.mrr > 0);
  const hasARR = (startup.arr > 0) || (ext.arr > 0);
  const hasRevenue = hasMRR || hasARR || (ext.revenue > 0);
  const hasGrowth = (startup.growth_rate_monthly > 0) || (ext.growth_rate > 0);

  if (hasRevenue && hasGrowth) {
    breakdown.revenueTrajectory = MOMENTUM_CONFIG.revenueTrajectory.levels.revenueAndGrowth;
    signals.push('revenue+growth');
  } else if (hasRevenue) {
    breakdown.revenueTrajectory = MOMENTUM_CONFIG.revenueTrajectory.levels.revenueOnly;
    signals.push('has_revenue');
  } else if (startup.has_revenue || ext.has_revenue) {
    breakdown.revenueTrajectory = MOMENTUM_CONFIG.revenueTrajectory.levels.revenueClaimed;
    signals.push('revenue_claimed');
  }

  // ── 2. Customer Trajectory ──
  const hasCustomers = (startup.customer_count > 0) || (ext.customer_count > 0) || (ext.customers > 0);
  const hasActiveUsers = (ext.active_users > 0);
  const hasCustomerGrowth = (startup.customer_growth_monthly > 0);

  if ((hasCustomers || hasActiveUsers) && hasCustomerGrowth) {
    breakdown.customerTrajectory = MOMENTUM_CONFIG.customerTrajectory.levels.customersAndGrowth;
    signals.push('customers+growth');
  } else if (hasCustomers || hasActiveUsers) {
    breakdown.customerTrajectory = MOMENTUM_CONFIG.customerTrajectory.levels.customersOnly;
    signals.push('has_customers');
  } else if (startup.has_customers || ext.has_customers) {
    breakdown.customerTrajectory = MOMENTUM_CONFIG.customerTrajectory.levels.customersClaimed;
    signals.push('customers_claimed');
  }

  // ── 3. Product Maturity ──
  const isLaunched = startup.is_launched || ext.is_launched || ext.launched;
  const hasDemo = startup.has_demo || ext.has_demo || ext.demo_available;
  const hasMVP = ext.mvp_stage;

  if (isLaunched && hasDemo) {
    breakdown.productMaturity = MOMENTUM_CONFIG.productMaturity.levels.launchedAndDemo;
    signals.push('launched+demo');
  } else if (isLaunched) {
    breakdown.productMaturity = MOMENTUM_CONFIG.productMaturity.levels.launchedOnly;
    signals.push('launched');
  } else if (hasMVP) {
    breakdown.productMaturity = MOMENTUM_CONFIG.productMaturity.levels.mvpOnly;
    signals.push('mvp');
  }

  // ── 4. Team Strength ──
  const hasTechCofounder = startup.has_technical_cofounder || ext.has_technical_cofounder || (ext.technical_cofounders > 0);
  const hasTeam = (startup.team_size >= 3) || (ext.founders_count >= 3) || (ext.team_size >= 3);

  if (hasTechCofounder && hasTeam) {
    breakdown.teamStrength = MOMENTUM_CONFIG.teamStrength.levels.techCofounderAndTeam;
    signals.push('strong_team');
  } else if (hasTechCofounder || hasTeam) {
    breakdown.teamStrength = MOMENTUM_CONFIG.teamStrength.levels.techCofounderOnly;
    signals.push('some_team');
  }

  // ── 5. Data Completeness ──
  const qualityFields = [
    startup.tagline,
    startup.pitch || startup.description,
    startup.website,
    startup.mrr || ext.mrr,
    startup.arr || ext.arr,
    startup.customer_count || ext.customer_count || ext.customers,
    startup.growth_rate_monthly || ext.growth_rate,
    startup.team_size || ext.founders_count,
    startup.has_technical_cofounder || ext.has_technical_cofounder,
    startup.founder_avg_age,
    startup.is_launched || ext.is_launched,
    startup.has_demo || ext.has_demo,
    startup.sectors?.length > 0,
    startup.latest_funding_amount || ext.funding_amount,
    startup.nps_score,
    startup.experiments_run_last_month,
  ].filter(v => v !== null && v !== undefined && v !== false && v !== 0 && v !== '').length;

  const completenessThresholds = MOMENTUM_CONFIG.dataCompleteness.thresholds;
  if (qualityFields >= completenessThresholds.rich.minFields) {
    breakdown.dataCompleteness = completenessThresholds.rich.score;
    signals.push('data_rich');
  } else if (qualityFields >= completenessThresholds.good.minFields) {
    breakdown.dataCompleteness = completenessThresholds.good.score;
    signals.push('data_good');
  } else if (qualityFields >= completenessThresholds.partial.minFields) {
    breakdown.dataCompleteness = completenessThresholds.partial.score;
    signals.push('data_partial');
  }

  // ── 6. Score Trajectory (from score_history) ──
  const history = options.scoreHistory || [];
  if (history.length >= 2) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MOMENTUM_CONFIG.scoreTrajectory.lookbackDays);
    
    // Find oldest score within lookback window
    const recentHistory = history
      .filter(h => new Date(h.created_at) >= cutoff)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (recentHistory.length >= 2) {
      const oldest = recentHistory[0];
      const newest = recentHistory[recentHistory.length - 1];
      const increase = (newest.new_score || 0) - (oldest.old_score || oldest.new_score || 0);
      
      if (increase >= MOMENTUM_CONFIG.scoreTrajectory.minIncrease) {
        breakdown.scoreTrajectory = MOMENTUM_CONFIG.scoreTrajectory.score;
        signals.push(`score_up_${increase}pts`);
      }
    }
  }

  // ── Total ──
  const total = Math.min(
    breakdown.revenueTrajectory +
    breakdown.customerTrajectory +
    breakdown.productMaturity +
    breakdown.teamStrength +
    breakdown.dataCompleteness +
    breakdown.scoreTrajectory,
    MOMENTUM_CONFIG.maxBonus
  );

  return {
    total: +total.toFixed(1),
    applied: total > 0,
    breakdown,
    signals,
    tier,
    fieldCount: qualityFields,
  };
}

// ============================================================================
// BATCH HELPER: Pre-fetch score history for all startups
// ============================================================================

/**
 * Load score history for a batch of startup IDs.
 * Returns a Map of startup_id → score_history records.
 * 
 * @param {Object} supabase - Supabase client
 * @param {string[]} startupIds - Array of startup IDs to fetch history for
 * @returns {Promise<Map<string, Object[]>>}
 */
async function loadScoreHistoryBatch(supabase, startupIds) {
  const historyMap = new Map();
  
  if (!startupIds.length) return historyMap;

  // Fetch in chunks of 500 to avoid query limits
  const CHUNK = 500;
  for (let i = 0; i < startupIds.length; i += CHUNK) {
    const chunk = startupIds.slice(i, i + CHUNK);
    try {
      const { data, error } = await supabase
        .from('score_history')
        .select('startup_id, old_score, new_score, created_at')
        .in('startup_id', chunk)
        .order('created_at', { ascending: true });

      if (!error && data) {
        for (const row of data) {
          if (!historyMap.has(row.startup_id)) {
            historyMap.set(row.startup_id, []);
          }
          historyMap.get(row.startup_id).push(row);
        }
      }
    } catch {
      // score_history table may not exist — continue without trajectory
    }
  }

  return historyMap;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  calculateMomentumScore,
  loadScoreHistoryBatch,
  MOMENTUM_CONFIG,
};
