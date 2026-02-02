/**
 * Canonical Supabase Helpers
 * ===========================
 * Single source of truth for common Supabase query patterns.
 * Prevents "data.length" regressions and count extraction bugs.
 */

/**
 * Get exact count from a Supabase query
 * 
 * CRITICAL: When using { count: 'exact', head: true }, Supabase returns:
 *   { data: null, count: 1000 }
 * NOT:
 *   { data: [...], count: 1000 }
 * 
 * This helper extracts the count correctly and throws on errors.
 * 
 * @example
 * const matchCount = await getExactCount(
 *   supabase.from("startup_investor_matches").eq("startup_id", startupId)
 * );
 * 
 * @param {Object} query - A Supabase query builder instance (before .select())
 * @returns {Promise<number>} The exact count, or 0 if no rows match
 * @throws {Error} If the query fails
 */
async function getExactCount(query) {
  const { count, error } = await query.select("*", { count: "exact", head: true });
  
  if (error) {
    throw new Error(`Count query failed: ${error.message}`);
  }
  
  return count ?? 0;
}

/**
 * Get exact count with error handling (returns 0 on error instead of throwing)
 * Use when you want graceful degradation.
 * 
 * @example
 * const matchCount = await getExactCountSafe(
 *   supabase.from("startup_investor_matches").eq("startup_id", startupId)
 * );
 * 
 * @param {Object} query - A Supabase query builder instance (before .select())
 * @returns {Promise<number>} The exact count, or 0 if query fails
 */
async function getExactCountSafe(query) {
  try {
    return await getExactCount(query);
  } catch (err) {
    console.error('getExactCountSafe error:', err.message);
    return 0;
  }
}

/**
 * Check if a count meets a threshold
 * Common pattern: "does this startup have enough matches to be ready?"
 * 
 * @example
 * const isReady = await countMeetsThreshold(
 *   supabase.from("startup_investor_matches").eq("startup_id", id),
 *   1000
 * );
 * 
 * @param {Object} query - A Supabase query builder instance
 * @param {number} threshold - Minimum count required
 * @returns {Promise<boolean>} True if count >= threshold
 */
async function countMeetsThreshold(query, threshold) {
  const count = await getExactCount(query);
  return count >= threshold;
}

module.exports = {
  getExactCount,
  getExactCountSafe,
  countMeetsThreshold,
};
