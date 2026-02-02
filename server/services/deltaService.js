// server/services/deltaService.js

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Compute and persist a signal delta between the two most recent snapshots.
 *
 * Invariants:
 * - Called only after a new snapshot is inserted
 * - Compares snapshot N-1 → snapshot N
 * - Idempotent per (startup_id, snapshot_from_id, snapshot_to_id)
 */
async function computeAndPersistDelta(startupId) {
  if (!startupId) return;

  // 1) Fetch the last two snapshots
  const { data: snaps, error: snapErr } = await supabase
    .from("startup_signal_snapshots")
    .select("*")
    .eq("startup_id", startupId)
    .order("captured_at", { ascending: false })
    .limit(2);

  if (snapErr || !snaps || snaps.length < 2) {
    return; // No delta possible yet
  }

  const [toSnap, fromSnap] = snaps; // newest first

  // 2) Guard: do not recompute same delta
  const { data: existing } = await supabase
    .from("startup_signal_deltas")
    .select("id")
    .eq("startup_id", startupId)
    .eq("snapshot_from_id", fromSnap.id)
    .eq("snapshot_to_id", toSnap.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return; // idempotent no-op
  }

  // 3) Compute numeric deltas
  const phaseFrom = Number(fromSnap.phase_score ?? 0);
  const phaseTo = Number(toSnap.phase_score ?? 0);
  const phaseDelta = phaseTo - phaseFrom;

  const matchFrom = Number(fromSnap.match_count ?? 0);
  const matchTo = Number(toSnap.match_count ?? 0);
  const matchCountDelta = matchTo - matchFrom;

  const alignFrom = Number(fromSnap.alignment_score ?? 0);
  const alignTo = Number(toSnap.alignment_score ?? 0);
  const alignmentDelta =
    alignFrom && alignTo ? alignTo - alignFrom : null;

  const bandFrom = fromSnap.signal_band ?? null;
  const bandTo = toSnap.signal_band ?? null;
  const bandChanged = bandFrom !== bandTo;

  // 4) Compute investor gained/lost (top 5 comparison)
  const fromIds = new Set(fromSnap.top_5_investor_ids || []);
  const toIds = new Set(toSnap.top_5_investor_ids || []);

  const investorsGained = [...toIds].filter((id) => !fromIds.has(id));
  const investorsLost = [...fromIds].filter((id) => !toIds.has(id));

  // 5) Narrative stub (Phase 5 UI will render this)
  const narrativeParts = [];

  if (phaseDelta > 0.01) {
    narrativeParts.push(
      `Signal phase increased by ${(phaseDelta * 100).toFixed(0)}%.`
    );
  } else if (phaseDelta < -0.01) {
    narrativeParts.push(
      `Signal phase decreased by ${(Math.abs(phaseDelta) * 100).toFixed(0)}%.`
    );
  }

  if (bandChanged) {
    narrativeParts.push(`Signal band changed from ${bandFrom} to ${bandTo}.`);
  }

  if (matchCountDelta > 0) {
    narrativeParts.push(`You gained ${matchCountDelta} new investor matches.`);
  } else if (matchCountDelta < 0) {
    narrativeParts.push(
      `You lost ${Math.abs(matchCountDelta)} investor matches.`
    );
  }

  if (investorsGained.length > 0) {
    narrativeParts.push(
      `${investorsGained.length} new investors entered your top range.`
    );
  }

  if (investorsLost.length > 0) {
    narrativeParts.push(
      `${investorsLost.length} investors dropped from your top range.`
    );
  }

  const narrative = narrativeParts.join(" ");

  // 6) Persist delta
  const deltaRow = {
    startup_id: startupId,
    snapshot_from_id: fromSnap.id,
    snapshot_to_id: toSnap.id,

    phase_delta: phaseDelta,
    band_changed: bandChanged,
    band_from: bandFrom,
    band_to: bandTo,

    match_count_delta: matchCountDelta,
    alignment_delta: alignmentDelta,

    investors_gained: investorsGained,
    investors_lost: investorsLost,
    investors_gained_count: investorsGained.length,
    investors_lost_count: investorsLost.length,

    narrative,
  };

  const { error: insertErr } = await supabase
    .from("startup_signal_deltas")
    .insert([deltaRow]);

  if (insertErr) {
    console.error("[deltaService] Failed to insert delta:", insertErr.message);
  }
}

module.exports = {
  computeAndPersistDelta,
};
