// server/services/snapshotService.js

const { createClient } = require("@supabase/supabase-js");
const { computeAndPersistDelta } = require("./deltaService");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Capture a signal snapshot for a startup.
 * This is Phase-5 foundation logic.
 *
 * Invariants:
 * - Called only when job.status === 'ready'
 * - Must be idempotent per (startup_id, finished_at)
 */
async function captureSignalSnapshot({
  startupId,
  jobId,
  signal,
  matches,
  finishedAt,
}) {
  if (!startupId || !signal) return;

  // Guard: do not duplicate snapshot for same job completion
  const { data: existing } = await supabase
    .from("startup_signal_snapshots")
    .select("id")
    .eq("startup_id", startupId)
    .eq("captured_at", finishedAt)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return; // idempotent no-op
  }

  const top5Ids = Array.isArray(matches)
    ? matches.slice(0, 5).map((m) => m.investor_id || m.investor?.id).filter(Boolean)
    : [];

  const snapshotRow = {
    startup_id: startupId,
    captured_at: finishedAt || new Date().toISOString(),

    phase_score: signal.phase ?? null,
    signal_band: signal.band ?? null,
    signal_strength: signal.signalStrength ?? null,
    match_count: matches?.length ?? 0,
    alignment_score: null, // Phase 5 future

    top_5_investor_ids: top5Ids,

    heat: null,           // Phase 5 future
    velocity_label: null,
    tier_label: null,
    observers_7d: 0,
  };

  const { data: inserted, error } = await supabase
    .from("startup_signal_snapshots")
    .insert([snapshotRow])
    .select("id")
    .single();

  if (error) {
    console.error("[snapshotService] Failed to insert snapshot:", error.message);
    return;
  }

  // Phase 5 foundation: compute delta after snapshot insert
  (async () => {
    try {
      await computeAndPersistDelta(startupId);
    } catch (e) {
      console.error("[snapshotService] Delta computation failed:", e?.message);
    }
  })();
}

module.exports = {
  captureSignalSnapshot,
};
