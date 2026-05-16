/**
 * Discovery Submit Endpoint (Phase 3)
 * 
 * POST /api/discovery/submit
 * 
 * URL → startup_uploads resolution is shared with instant submit (see server/lib/resolveStartupUploadForUrl.js).
 * Idempotent: returns existing job if URL is queued / in progress / ready.
 * A previous failed job for the same URL is deleted so submit can create a new job.
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const { normalizeUrl } = require("../lib/urlNormalize");
const intel = require("../services/submitUrlIntelligence");
const { isJunkUrl } = require("../../lib/junk-url-config");
const { enrichSocialScore } = require("../services/newsSignalService");

// Scraping for discovery: scrape + update only. Do not call processUrlSubmission here — it INSERTs
// with scraped display names (e.g. "Stripe") and hits startup_uploads_name_unique when dedupe misses.
let scrapeAndScoreStartup;
let updateStartupWithScrapedData;
try {
  const scraping = require("../services/urlScrapingService.ts");
  scrapeAndScoreStartup = scraping.scrapeAndScoreStartup;
  updateStartupWithScrapedData = scraping.updateStartupWithScrapedData;
} catch (e) {
  console.warn("[discoverySubmit] urlScrapingService.ts not available:", e?.message || e);
  scrapeAndScoreStartup = null;
  updateStartupWithScrapedData = null;
}

/** Canonical https URL for scrapers */
function toFullUrl(raw, urlNormalized) {
  const t = String(raw || "").trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${urlNormalized}`;
}

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

const {
  resolveApprovedStartupUploadForUrl,
  getStartupUploadIdByExactWebsite,
} = require("../lib/resolveStartupUploadForUrl");

/** User-facing copy for idempotent GET of an in-flight startup_jobs row */
function discoveryJobStatusMessage(status) {
  switch (String(status || "").toLowerCase()) {
    case "ready":
      return "Job already complete.";
    case "failed":
      return "Previous run failed; retrying with a new job.";
    case "queued":
      return "Job is queued. Poll /results for updates.";
    case "building":
      return "Building profile. Poll /results for updates.";
    case "scoring":
      return "Scoring in progress. Poll /results for updates.";
    case "matching":
      return "Matching investors. Poll /results for updates.";
    default:
      return "Job in progress. Poll /results for updates.";
  }
}

/** Which discovery submit bundle is loaded in this Node process (restart server after editing this file). */
const DISCOVERY_SUBMIT_BUILD = "discoverySubmit-v2.2";

router.get("/__submit_build", (req, res) => {
  res.json({
    build: DISCOVERY_SUBMIT_BUILD,
    pid: process.pid,
    cwd: process.cwd(),
  });
});

/**
 * POST /api/discovery/submit
 * Body: { url }
 * Returns existing in-flight or complete job; replaces failed jobs with a new run.
 */
router.post("/submit", async (req, res) => {
  const _t0 = Date.now();
  let _startupId = null, _isNew = false, _resolverTier = null, _intelErr = null;
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

    // Reject news sites, directories, and social platforms before any DB work
    const urlForJunkCheck = url.startsWith('http') ? url : `https://${url_normalized}`;
    if (isJunkUrl(urlForJunkCheck)) {
      return res.status(400).json({
        error: 'Not a startup website',
        message: 'That URL appears to be a news site, directory, or social platform. Please enter the startup\'s own website.',
      });
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
      if (existing.status === "ready") {
        return res.json({
          job_id: existing.id,
          startup_id: existing.startup_id,
          status: existing.status,
          message: "Job already complete.",
          debug: {
            progress: existing.progress_percent,
            matchCount: existing.match_count,
            updatedAt: existing.updated_at,
          },
        });
      }

      // Allow a clean resubmit after a failed run (same normalized URL)
      if (existing.status === "failed") {
        const { error: delErr } = await supabase
          .from("startup_jobs")
          .delete()
          .eq("id", existing.id);
        if (delErr) {
          console.error("[discoverySubmit] could not delete failed job for resubmit:", delErr);
          return res.status(500).json({
            error: "Could not reset failed job for resubmit",
            debug: { supabase: delErr.message },
          });
        }
        // fall through — create a new job row for this URL
      } else {
        return res.json({
          job_id: existing.id,
          startup_id: existing.startup_id,
          status: existing.status,
          message: discoveryJobStatusMessage(existing.status),
          debug: {
            progress: existing.progress_percent,
            matchCount: existing.match_count,
            updatedAt: existing.updated_at,
          },
        });
      }
    }

    // 2) Get or create startup_upload row
    const companyName = url_normalized.split('.')[0].charAt(0).toUpperCase() + url_normalized.split('.')[0].slice(1);

    const fullUrl = toFullUrl(url, url_normalized);

    let startupId;

    const resolvedRow = await resolveApprovedStartupUploadForUrl(supabase, {
      inputRaw: url,
      log: (line) => console.log(`[discoverySubmit] ${line}`),
    });
    if (resolvedRow?.id) {
      startupId = resolvedRow.id;
    }

    // ── Enrich existing row OR create via shared scrape→DB path (instantSubmit parity) ──
    if (startupId && scrapeAndScoreStartup && updateStartupWithScrapedData) {
      try {
        const { data, dataTier } = await scrapeAndScoreStartup(fullUrl);
        if (data) {
          const ok = await updateStartupWithScrapedData(startupId, data, dataTier, { omitName: true });
          if (!ok) {
            console.warn(`[discoverySubmit] scrape/update existing startup ${startupId}: update returned false`);
          }
        }
      } catch (e) {
        console.warn(`[discoverySubmit] scrape/update existing startup ${startupId}:`, e?.message || e);
      }
    } else if (!startupId) {
      const { isValidStartupName } = await import("../utils/startupNameValidator.js");
      const nameValidation = isValidStartupName(companyName);
      if (!nameValidation.isValid) {
        console.warn(
          `[discovery/submit] Rejected invalid startup name: "${companyName}" (reason: ${nameValidation.reason})`
        );
        return res.status(400).json({
          error: "Invalid startup name",
          reason: nameValidation.reason,
          suggestion: "Please provide a valid company website",
        });
      }

      if (!startupId) {
        // Name must be globally unique (startup_uploads_name_unique). Do not rely on short hex alone.
        const insertWebsite = `https://${url_normalized}`;
        let startupUpload;
        let uploadErr;
        let lastTriedName = null;
        for (let attempt = 0; attempt < 4 && !startupUpload?.id; attempt++) {
          // Random hex name — never use scraped brand ("Stripe") as DB name (global unique).
          lastTriedName = `disc-${crypto.randomBytes(20).toString("hex")}`;
          const ins = await supabase
            .from("startup_uploads")
            .insert([
              {
                name: lastTriedName,
                website: insertWebsite,
                status: "approved",
                source_type: "url",
                tagline: `${companyName} — ${url_normalized}`,
                sectors: ["Technology"],
                total_god_score: 65,
              },
            ])
            .select("id")
            .single();
          startupUpload = ins.data;
          uploadErr = ins.error;
          if (!uploadErr && startupUpload?.id) break;
          const isDup =
            uploadErr?.code === "23505" ||
            String(uploadErr?.message || "").toLowerCase().includes("duplicate");
          if (!isDup) break;
        }

        // Any unique violation on insert: re-resolve (website / race) and attach
        const dupRecoverable =
          uploadErr &&
          (uploadErr.code === "23505" ||
            String(uploadErr.message || "")
              .toLowerCase()
              .includes("duplicate"));
        if (!startupUpload?.id && dupRecoverable) {
          const variants = [
            insertWebsite,
            `https://www.${url_normalized}`,
            `http://${url_normalized}`,
            `http://www.${url_normalized}`,
            `${insertWebsite}/`,
            `https://www.${url_normalized}/`,
          ];
          for (const w of variants) {
            const sid = await getStartupUploadIdByExactWebsite(supabase, w);
            if (sid) {
              startupId = sid;
              uploadErr = null;
              break;
            }
          }
          if (uploadErr && !startupId) {
            const recovered = await resolveApprovedStartupUploadForUrl(supabase, {
              inputRaw: fullUrl,
              log: () => {},
            });
            if (recovered?.id) {
              startupId = recovered.id;
              uploadErr = null;
            }
          }
        }

        if (uploadErr || (!startupUpload?.id && !startupId)) {
          const errObj = uploadErr && typeof uploadErr === "object" ? uploadErr : {};
          return res.status(500).json({
            error: "Failed to create startup_upload (discovery v2.2)",
            debug: {
              handler: DISCOVERY_SUBMIT_BUILD,
              attempted_insert_name: typeof lastTriedName === "string" ? lastTriedName : null,
              supabase: uploadErr?.message || "unknown",
              code: errObj.code != null ? String(errObj.code) : null,
              details: errObj.details != null ? String(errObj.details) : null,
              hint: errObj.hint != null ? String(errObj.hint) : null,
            },
          });
        }
        if (!startupId) startupId = startupUpload?.id;
        // Best-effort: fill profile on the new row (omitName — display name stays disc-* until curated)
        if (scrapeAndScoreStartup && updateStartupWithScrapedData) {
          try {
            const { data, dataTier } = await scrapeAndScoreStartup(fullUrl);
            if (data) {
              await updateStartupWithScrapedData(startupId, data, dataTier, { omitName: true });
            }
          } catch (e) {
            console.warn("[discoverySubmit] fallback row scrape/update:", e?.message || e);
          }
        }
        // Async news signal enrichment (fire-and-forget)
        enrichSocialScore(startupId, companyName, `https://${url_normalized}`).catch(e =>
          console.warn(`[discoverySubmit] newsSignal failed for ${startupId}: ${e.message}`)
        );
      }
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

    _startupId = job.startup_id;
    _resolverTier = _isNew ? 'new' : 'exact';
    intel.log({
      url: req.body?.url || '',
      domain: normalizeUrl(String(req.body?.url || '')).split('/')[0],
      endpoint: 'discovery',
      resolverTier: _resolverTier,
      startupId: _startupId,
      isNew: _isNew,
      latencyMs: Date.now() - _t0,
      errorMsg: _intelErr || undefined,
      errorCode: _intelErr ? 'runtime_error' : undefined,
    }).catch(() => {});

    return res.json({
      job_id: job.id,
      startup_id: job.startup_id,
      status: "queued",
      message: "Job queued. Poll /results for updates.",
    });
  } catch (e) {
    console.error("[discoverySubmit] Error:", e);
    _intelErr = e?.message || 'unexpected';
    intel.log({
      url: req.body?.url || '',
      domain: normalizeUrl(String(req.body?.url || '')).split('/')[0],
      endpoint: 'discovery',
      isNew: false,
      latencyMs: Date.now() - _t0,
      errorMsg: _intelErr,
      errorCode: 'runtime_error',
    }).catch(() => {});
    return res.status(500).json({ error: "Unexpected server error" });
  }
});

module.exports = router;
