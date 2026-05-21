/**
 * Outreach Dashboard API
 *
 * GET  /api/outreach/stats          — campaign summary stats
 * GET  /api/outreach/contacts       — paginated contact list with status
 * GET  /api/outreach/campaigns      — list of distinct campaign slugs
 * POST /api/outreach/run            — spawn the outreach agent (vc|startup, dry-run optional)
 * GET  /api/outreach/run/:id        — poll status of a running campaign job
 * POST /api/webhooks/resend-outreach — Resend webhook: open/click/bounce events
 */

const express = require("express");
const router  = express.Router();
const { createClient } = require("@supabase/supabase-js");
const crypto  = require("crypto");
const { spawn } = require("child_process");
const path    = require("path");

// ── In-memory job store (per-process; resets on restart) ─────────────────────
const jobs = new Map(); // jobId → { status, log, startedAt, finishedAt, exitCode }

function makeJobId() {
  return crypto.randomBytes(6).toString("hex");
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[outreachDashboard] Missing Supabase config");
  module.exports = router;
  return;
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── GET /api/outreach/campaigns ───────────────────────────────────────────────
router.get("/campaigns", async (req, res) => {
  try {
    const { data, error } = await db
      .from("pythh_prospecting_log")
      .select("campaign_slug, email_type, sent_at")
      .order("sent_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Dedupe campaigns
    const seen = new Set();
    const campaigns = [];
    for (const row of data ?? []) {
      const key = row.campaign_slug ?? "default";
      if (!seen.has(key)) {
        seen.add(key);
        campaigns.push({ slug: key, sent_at: row.sent_at });
      }
    }
    res.json({ campaigns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/outreach/stats?campaign=vc-2026-05 ───────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const campaign = req.query.campaign || null;

    let query = db.from("pythh_prospecting_log").select("*");
    if (campaign) query = query.eq("campaign_slug", campaign);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const rows = data ?? [];
    const vc      = rows.filter((r) => r.email_type === "vc_leads");
    const startup = rows.filter((r) => r.email_type === "startup_matches");

    const stat = (subset) => ({
      sent:        subset.length,
      opened:      subset.filter((r) => r.opened_at).length,
      clicked:     subset.filter((r) => r.clicked_at).length,
      bounced:     subset.filter((r) => r.bounced_at).length,
      unsubscribed:subset.filter((r) => r.unsubscribed_at).length,
      openRate:    subset.length ? Math.round(subset.filter((r) => r.opened_at).length / subset.length * 100) : 0,
    });

    res.json({
      total:   stat(rows),
      vc:      stat(vc),
      startup: stat(startup),
      campaign: campaign ?? "all",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/outreach/contacts?campaign=...&type=vc&page=0&limit=50 ───────────
router.get("/contacts", async (req, res) => {
  try {
    const campaign = req.query.campaign || null;
    const type     = req.query.type || null;  // 'vc_leads' | 'startup_matches'
    const page     = parseInt(req.query.page  ?? "0",  10);
    const limit    = parseInt(req.query.limit ?? "50", 10);

    let query = db
      .from("pythh_prospecting_log")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (campaign) query = query.eq("campaign_slug", campaign);
    if (type)     query = query.eq("email_type",    type);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ contacts: data ?? [], total: count ?? 0, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/outreach/run ────────────────────────────────────────────────────
// Spawns the outreach agent. Returns a jobId immediately for polling.
router.post("/run", express.json(), async (req, res) => {
  const { mode = "vc", limit = 20, dryRun = true, campaign, testTo } = req.body ?? {};

  if (!["vc", "startup"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'vc' or 'startup'" });
  }
  if (typeof limit !== "number" || limit < 1 || limit > 500) {
    return res.status(400).json({ error: "limit must be 1–500" });
  }

  const jobId = makeJobId();
  const job = { status: "running", log: [], startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, mode, limit, dryRun };
  jobs.set(jobId, job);

  // Build args
  const agentScript = path.resolve(__dirname, "../../scripts/outreach-agent.js");
  const args = ["--mode", mode, "--limit", String(limit)];
  if (dryRun)   args.push("--dry-run");
  if (campaign) args.push("--campaign", campaign);
  if (testTo)   args.push("--test-to", testTo);

  const child = spawn("node", [agentScript, ...args], {
    env: { ...process.env },
    cwd: path.resolve(__dirname, "../../"),
  });

  function appendLog(line) {
    job.log.push(line);
    if (job.log.length > 2000) job.log.shift(); // cap at 2000 lines
  }

  child.stdout.on("data", (d) => d.toString().split("\n").forEach((l) => l && appendLog(l)));
  child.stderr.on("data", (d) => d.toString().split("\n").forEach((l) => l && appendLog(`[err] ${l}`)));

  child.on("close", (code) => {
    job.status    = code === 0 ? "done" : "error";
    job.exitCode  = code;
    job.finishedAt = new Date().toISOString();
    // Auto-clean after 1 hour
    setTimeout(() => jobs.delete(jobId), 60 * 60 * 1000);
  });

  res.json({ jobId, status: "running" });
});

// ── GET /api/outreach/run/:id ─────────────────────────────────────────────────
router.get("/run/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({
    jobId: req.params.id,
    status:     job.status,
    log:        job.log,
    startedAt:  job.startedAt,
    finishedAt: job.finishedAt,
    exitCode:   job.exitCode,
    mode:       job.mode,
    limit:      job.limit,
    dryRun:     job.dryRun,
  });
});

// ── POST /api/webhooks/resend-outreach ────────────────────────────────────────
// Resend sends events via Svix: email.opened, email.clicked, email.bounced, email.unsubscribed
// Svix signing: HMAC-SHA256 over "{svix-id}.{svix-timestamp}.{raw body}"
// Secret format: whsec_<base64> — strip prefix and base64-decode to get raw key bytes
router.post("/webhook/resend", express.raw({ type: "application/json" }), async (req, res) => {
  if (RESEND_WEBHOOK_SECRET) {
    const sig = req.headers["svix-signature"] || "";
    const ts  = req.headers["svix-timestamp"] || "";
    const id  = req.headers["svix-id"] || "";

    if (!sig || !ts || !id) {
      return res.status(401).json({ error: "Missing Svix headers" });
    }

    // Reject timestamps older than 5 minutes (replay protection)
    const tsNum = parseInt(ts, 10);
    if (Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return res.status(401).json({ error: "Timestamp too old" });
    }

    // whsec_ prefix → strip it, base64-decode the rest to get raw key bytes
    const rawSecret = Buffer.from(
      RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ""),
      "base64"
    );

    const toSign  = `${id}.${ts}.${req.body.toString()}`;
    const computed = crypto.createHmac("sha256", rawSecret).update(toSign).digest("base64");

    // svix-signature can be "v1,<sig1> v1,<sig2>" — any match is valid
    const valid = sig.split(" ").some((s) => {
      const part = s.replace(/^v1,/, "");
      return crypto.timingSafeEqual(Buffer.from(part), Buffer.from(computed));
    });

    if (!valid) {
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const messageId = event?.data?.email_id || event?.data?.id || "";
  const type      = event?.type || "";

  if (!messageId) return res.status(200).json({ ok: true }); // ignore unknown events

  const update = {};
  if (type === "email.opened")       update.opened_at        = new Date().toISOString();
  if (type === "email.clicked")      update.clicked_at       = new Date().toISOString();
  if (type === "email.bounced")      update.bounced_at       = new Date().toISOString();
  if (type === "email.unsubscribed") update.unsubscribed_at  = new Date().toISOString();

  if (Object.keys(update).length > 0) {
    await db
      .from("pythh_prospecting_log")
      .update(update)
      .eq("resend_message_id", messageId);
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
