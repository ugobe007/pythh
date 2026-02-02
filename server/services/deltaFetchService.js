// server/services/deltaFetchService.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Fetch the latest delta for a startup.
 *
 * Invariants:
 * - Returns null if no delta exists
 * - Always returns the most recent delta
 * - Does not compute anything
 */
async function fetchLatestDelta(startupId) {
  if (!startupId) return null;

  const { data, error } = await supabase
    .from("startup_signal_deltas")
    .select("*")
    .eq("startup_id", startupId)
    .order("compared_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[deltaFetchService] Failed to fetch delta:", error.message);
    return null;
  }

  return data || null;
}

module.exports = {
  fetchLatestDelta,
};
