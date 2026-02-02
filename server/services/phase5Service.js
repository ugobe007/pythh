// server/services/phase5Service.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Phase-5 readiness:
 * - at least 2 snapshots
 * - at least 1 delta
 */
async function checkPhase5Readiness(startupId) {
  if (!startupId) return false;

  const [{ count: snapCount }, { count: deltaCount }] = await Promise.all([
    supabase
      .from("startup_signal_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("startup_id", startupId),

    supabase
      .from("startup_signal_deltas")
      .select("id", { count: "exact", head: true })
      .eq("startup_id", startupId),
  ]);

  return (snapCount || 0) >= 2 && (deltaCount || 0) >= 1;
}

module.exports = {
  checkPhase5Readiness,
};
