// server/routes/deltaResults.js

const express = require("express");
const router = express.Router();

const { fetchLatestDelta } = require("../services/deltaFetchService");
const { checkPhase5Readiness } = require("../services/phase5Service");

/**
 * GET /api/discovery/delta?startup_id=...
 *
 * Read-only delta fetch.
 * Phase-5 gated.
 */
router.get("/delta", async (req, res) => {
  try {
    const startupId = req.query?.startup_id;
    if (!startupId) {
      return res.status(400).json({ error: "Missing startup_id" });
    }

    // Phase-5 readiness gate
    const ready = await checkPhase5Readiness(startupId);
    if (!ready) {
      return res.json({
        status: "not_ready",
        message: "Phase-5 evolution not ready yet.",
      });
    }

    const delta = await fetchLatestDelta(startupId);
    if (!delta) {
      return res.json({
        status: "no_delta",
        message: "No delta found.",
      });
    }

    return res.json({
      status: "ready",
      delta: {
        phaseDelta: delta.phase_delta,
        bandChanged: delta.band_changed,
        bandFrom: delta.band_from,
        bandTo: delta.band_to,
        matchCountDelta: delta.match_count_delta,
        alignmentDelta: delta.alignment_delta,
        investorsGained: delta.investors_gained_count,
        investorsLost: delta.investors_lost_count,
        narrative: delta.narrative,
        comparedAt: delta.compared_at,
      },
    });
  } catch (e) {
    console.error("[deltaResults] Error:", e);
    return res.status(500).json({
      error: "Unexpected server error",
    });
  }
});

module.exports = router;
