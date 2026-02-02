const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const { captureSignalSnapshot } = require("../services/snapshotService");
const { checkPhase5Readiness } = require("../services/phase5Service");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[discoveryResults] CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - routes will fail",
    { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_SERVICE_ROLE_KEY }
  );
  const errorRouter = express.Router();
  errorRouter.all("*", (req, res) => {
    res.status(503).json({ error: "Supabase configuration missing" });
  });
  module.exports = errorRouter;
  return;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * GET /api/discovery/results?job_id=...
 * Returns job status and matches when ready
 */
router.get("/results", async (req, res) => {
  try {
    const jobId = req.query?.job_id;
    if (!jobId) {
      return res.status(400).json({ error: "Missing job_id" });
    }

    const { data: job, error: jobErr } = await supabase
      .from("startup_jobs")
      .select(
        "id, startup_id, url, url_normalized, status, progress_percent, match_count, error_message, started_at, finished_at, updated_at"
      )
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) {
      return res.status(500).json({
        error: "DB error fetching job",
        debug: { supabase: jobErr.message },
      });
    }

    if (!job) {
      return res.json({
        status: "unknown",
        message: "No job found. Submit URL first.",
      });
    }

    // States that are not ready yet
    if (job.status !== "ready" && job.status !== "failed") {
      return res.json({
        status: job.status, // queued | building | scoring | matching
        progress: job.progress_percent ?? 0,
        message:
          job.status === "queued"
            ? "Queued…"
            : job.status === "building"
            ? "Reading signals…"
            : job.status === "scoring"
            ? "Scoring startup…"
            : "Matching investors…",
        debug: {
          state: job.status,
          startupId: job.startup_id,
          updatedAt: job.updated_at,
          matchCount: job.match_count,
        },
      });
    }

    // Failed
    if (job.status === "failed") {
      return res.json({
        status: "failed",
        error: job.error_message || "Job failed",
        retryable: true,
        debug: {
          state: "failed",
          startupId: job.startup_id,
          updatedAt: job.updated_at,
        },
      });
    }

    // Ready: ensure finished_at is set (idempotent hardening)
    if (job.status === "ready" && !job.finished_at) {
      await supabase
        .from("startup_jobs")
        .update({ finished_at: new Date().toISOString() })
        .eq("id", job.id);
      job.finished_at = new Date().toISOString();
    }

    // Ready: fetch matches via production RPC (keyset pagination, deterministic ordering)
    // For now, just get first page (top 200). Cursor pagination available if needed.
    const { data: rpcMatches, error: matchesErr } = await supabase.rpc(
      "get_top_matches",
      {
        p_startup_id: job.startup_id,
        p_limit: 200,
        // p_cursor_score: null,  // Optional: for pagination
        // p_cursor_id: null,     // Optional: for pagination
      }
    );

    if (matchesErr) {
      return res.status(500).json({
        error: "Failed to fetch matches",
        debug: { supabase: matchesErr.message },
      });
    }

    // Format matches for frontend (RPC returns flattened investor fields)
    const rawMatches = rpcMatches || [];
    const matches = rawMatches.map(m => ({
      id: m.investor_id,
      name: m.investor_name || m.firm,
      firm_name: m.firm,
      match_score: m.match_score,
      sectors: m.sectors,
      stage: m.stage,
      check_size_min: m.check_size_min,
      check_size_max: m.check_size_max,
      alignment_reasoning: m.reasoning,
      // Note: RPC doesn't return investment_thesis, recent_investments, website, linkedin
      // Add these if needed by extending the RPC function
    }));

    // Latest snapshot for signal values (optional in Phase 3)
    const { data: latestSnap } = await supabase
      .from("startup_signal_snapshots")
      .select("phase_score, signal_band, match_count, signal_strength")
      .eq("startup_id", job.startup_id)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Phase 5 foundation: capture snapshot on ready (non-blocking)
    (async () => {
      try {
        await captureSignalSnapshot({
          startupId: job.startup_id,
          jobId: job.id,
          signal: latestSnap
            ? {
                phase: latestSnap.phase_score,
                band: latestSnap.signal_band,
                signalStrength: latestSnap.signal_strength,
              }
            : null,
          matches: rawMatches || [],
          finishedAt: job.finished_at || new Date().toISOString(),
        });
      } catch (e) {
        console.error("[discoveryResults] Snapshot capture failed:", e?.message);
      }
    })();

    // Phase-5 readiness gate (backend truth)
    let phase5Ready = false;

    try {
      phase5Ready = await checkPhase5Readiness(job.startup_id);
    } catch (e) {
      console.error("[discoveryResults] Phase-5 readiness check failed:", e?.message);
    }

    return res.json({
      status: "ready",
      job_id: job.id,
      startup_id: job.startup_id,
      matches: matches,
      signal: latestSnap
        ? {
            phase: latestSnap.phase_score,
            band: latestSnap.signal_band,
            matchCount: latestSnap.match_count,
            signalStrength: latestSnap.signal_strength,
          }
        : null,
      debug: {
        state: "ready",
        finishedAt: job.finished_at,
        updatedAt: job.updated_at,
        totalMatches: matches.length,
        phase5Ready,
      },
    });
  } catch (e) {
    console.error("[discoveryResults] Error:", e);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

module.exports = router;
