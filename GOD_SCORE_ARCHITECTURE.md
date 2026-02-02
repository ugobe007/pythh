/**
 * ============================================================================
 * GOD SCORING SYSTEM - ARCHITECTURE REVIEW
 * ============================================================================
 * 
 * Last reviewed: January 30, 2026
 * 
 * ============================================================================
 * ARCHITECTURE (CORRECT)
 * ============================================================================
 * 
 * 1. GOD SCORE (0-100): 23 weighted algorithms evaluating startup fundamentals
 *    - Calculated in: startupScoringService.ts → calculateHotScore()
 *    - Returns breakdown on 0-10 internal scale
 *    - Multiplied by 10 → stored as total_god_score (0-100)
 * 
 * 2. SIGNALS BONUS (0-10): Market intelligence layer
 *    - Calculated in: signalApplicationService.ts
 *    - 5 dimensions: product_velocity, funding_acceleration, customer_adoption,
 *                    market_momentum, competitive_dynamics
 *    - 50% change threshold for stability
 *    - NOT YET ACTIVE (tables need to be created)
 * 
 * 3. FINAL SCORE = GOD + SIGNALS (0-110 theoretical max, clamped to 100)
 * 
 * ============================================================================
 * GOD SCORE BREAKDOWN (from calculateHotScore)
 * ============================================================================
 * 
 * The algorithm returns breakdown values on SMALL scales (0-3, 0-2, etc.)
 * These are INTERNAL algorithm values, NOT the stored component scores.
 * 
 * INTERNAL BREAKDOWN:
 *   - team_execution: 0-3 (team quality, pedigree)
 *   - team_age: 0-1 (founder age factor)
 *   - product_vision: 0-2 (vision clarity)
 *   - traction: 0-3 (revenue, growth, customers)
 *   - market: 0-2 (market size, hot sectors)
 *   - market_insight: 0-1.5 (unique insight)
 *   - product: 0-2 (product quality)
 *   - founder_courage: 0-1.5 (courage indicators)
 *   - baseBoost: ~4.2 minimum (vibe + content signals)
 *   - redFlags: 0 to -1.5 (penalties)
 * 
 * TOTAL = baseBoost + all components + redFlags
 *       ≈ 4.2 + 16 (max) - 1.5 (max penalty) = ~18.7 max raw
 * 
 * NORMALIZATION:
 *   total = (rawTotal / normalizationDivisor) * 10 → 0-10 scale
 *   stored = total * 10 → 0-100 scale (total_god_score)
 * 
 * ============================================================================
 * COMPONENT SCORES IN DATABASE
 * ============================================================================
 * 
 * The database stores DERIVED component scores on 0-100 scale.
 * These are SEPARATE from the internal breakdown values.
 * 
 * QUESTION: What should the component score scaling be?
 * 
 * Option A (Current): Direct percentage of max
 *   team_score = (team_execution + team_age) / 4.0 * 100
 *   → If team_execution=3 and team_age=1, score = 100%
 * 
 * Option B (Original): Higher multiplier to spread distribution
 *   team_score = (team_execution + team_age) / 2.0 * 100
 *   → Allows scores > 100 but spreads out the distribution
 * 
 * The component scores are FOR DISPLAY/ANALYSIS ONLY.
 * They don't affect the total_god_score calculation.
 * total_god_score is calculated independently from rawTotal.
 * 
 * ============================================================================
 * SIGNAL SERVICE STATUS: ✅ CLEAN
 * ============================================================================
 * 
 * The signalApplicationService.ts is properly architected:
 * 
 * 1. ✅ 5 clear dimensions with defined point allocations (total 10 max)
 * 2. ✅ 50% change threshold prevents noise/over-reaction
 * 3. ✅ Each dimension has clear calculation logic
 * 4. ✅ Signals are LAYERED on top, never modify GOD algorithms
 * 5. ✅ Defensive clamping and runtime invariants
 * 
 * SIGNAL POINT ALLOCATIONS:
 *   - product_velocity: 2.0 points max
 *   - funding_acceleration: 2.5 points max  
 *   - customer_adoption: 2.0 points max
 *   - market_momentum: 1.5 points max
 *   - competitive_dynamics: 2.0 points max
 *   - TOTAL: 10.0 points max
 * 
 * SIGNAL ACTIVATION REQUIRES:
 *   1. Run migration: 20260130_add_signal_tables.sql
 *   2. Create startup_signals_state table (referenced in service)
 *   3. Run signal calculation batch job
 * 
 * ============================================================================
 */
