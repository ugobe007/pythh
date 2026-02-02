/**
 * Discovery Submit Endpoint (Phase 3)
 * 
 * POST /api/discovery/submit
 * 
 * Submits a startup URL for processing and returns a job ID.
 * Idempotent - returns existing job if URL already queued/processing.
 */

const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const { normalizeUrl } = require("../lib/urlNormalize");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[discoverySubmit] CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - routes will fail",
    { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_SERVICE_ROLE_KEY }
  );
  // Export a router that returns 503 for all requests
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
 * POST /api/discovery/submit
 * Body: { url }
 * Returns idempotently: existing job if url_normalized already exists.
 */
router.post("/submit", async (req, res) => {
  try {
    const urlRaw = req.body?.url;
    if (!urlRaw) {
      return res.status(400).json({ error: "Missing url" });
    }

    const url = String(urlRaw).trim();
    const url_normalized = normalizeUrl(url);

    if (!url_normalized || url_normalized.length < 3) {
      return res.status(400).json({ error: "Invalid url" });
    }

    // 1) See if a job already exists for this normalized URL
    const { data: existing, error: existingErr } = await supabase
      .from("startup_jobs")
      .select("id, startup_id, status, progress_percent, match_count, updated_at")
      .eq("url_normalized", url_normalized)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return res.status(500).json({
        error: "DB error checking existing job",
        debug: { supabase: existingErr.message },
      });
    }

    if (existing) {
      return res.json({
        job_id: existing.id,
        startup_id: existing.startup_id,
        status: existing.status,
        message:
          existing.status === "ready"
            ? "Job already complete."
            : "Job already exists. Poll /results for updates.",
        debug: {
          progress: existing.progress_percent,
          matchCount: existing.match_count,
          updatedAt: existing.updated_at,
        },
      });
    }

    // 2) Get or create startup_upload row
    const companyName = url_normalized.split('.')[0].charAt(0).toUpperCase() + url_normalized.split('.')[0].slice(1);
    
    // Look up startup by website - check all existing startups and normalize on client side
    // (More reliable than ILIKE patterns which can miss variations)
    let { data: existingStartups } = await supabase
      .from("startup_uploads")
      .select("id, website")
      .not('website', 'is', null)
      .limit(100); // Reasonable limit for normalization check

    let startupId;
    if (existingStartups && existingStartups.length > 0) {
      // Find exact match by normalizing all websites client-side
      const match = existingStartups.find(s => {
        if (!s.website) return false;
        const siteNorm = normalizeUrl(s.website);
        return siteNorm === url_normalized;
      });
      if (match) {
        startupId = match.id;
      }
    }

    if (!startupId) {
      // Create new startup
      const { data: startupUpload, error: uploadErr } = await supabase
        .from("startup_uploads")
        .insert([{ 
          name: companyName,
          website: `https://${url_normalized}`, 
          status: 'approved',
          source_type: 'url',
          tagline: `Startup at ${url_normalized}`,
          sectors: ['Technology'],
          total_god_score: 65
        }])
        .select("id")
        .single();

      if (uploadErr || !startupUpload?.id) {
        return res.status(500).json({
          error: "Failed to create startup_upload",
          debug: { supabase: uploadErr?.message || "unknown" },
        });
      }
      startupId = startupUpload.id;
    }

    // 3) Hard guard: prevent null url_normalized regression
    if (!url_normalized) {
      return res.status(500).json({
        error: "Internal: url_normalized missing",
        debug: { url, url_normalized, startupId },
      });
    }

    // 4) Insert job as queued
    const { data: job, error: jobErr } = await supabase
      .from("startup_jobs")
      .insert([
        {
          startup_id: startupId,
          url: url,
          url_normalized: url_normalized, // Explicit value until DB function deployed
          status: "queued",
          progress_percent: 0,
          match_count: 0,
        },
      ])
      .select("id, startup_id, status, url_normalized")
      .single();

    if (jobErr || !job?.id) {
      return res.status(500).json({
        error: "Failed to create job",
        debug: { supabase: jobErr?.message || "unknown" },
      });
    }

    // 5) Kick off background processing
    await supabase
      .from("startup_jobs")
      .update({ status: "building", progress_percent: 5 })
      .eq("id", job.id);

    return res.json({
      job_id: job.id,
      startup_id: job.startup_id,
      status: "queued",
      message: "Job queued. Poll /results for updates.",
    });
  } catch (e) {
    console.error("[discoverySubmit] Error:", e);
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

module.exports = router;
