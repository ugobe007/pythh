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
    query = query.eq("status", "sent");

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
      .eq("status", "sent")
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
  const { mode = "vc", limit = 20, dryRun = true, draftOnly = false, campaign, testTo } = req.body ?? {};

  if (!["vc", "startup"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'vc' or 'startup'" });
  }
  if (typeof limit !== "number" || limit < 1 || limit > 500) {
    return res.status(400).json({ error: "limit must be 1–500" });
  }

  const jobId = makeJobId();
  const job = { status: "running", log: [], startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, mode, limit, dryRun, draftOnly };
  jobs.set(jobId, job);

  const agentScript = path.resolve(__dirname, "../../scripts/outreach-agent.js");
  const args = ["--mode", mode, "--limit", String(limit)];
  if (dryRun)     args.push("--dry-run");
  if (draftOnly)  args.push("--draft-only");
  if (campaign)   args.push("--campaign", campaign);
  if (testTo)     args.push("--test-to", testTo);

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
    draftOnly:  job.draftOnly,
  });
});

// ── GET /api/outreach/drafts?campaign=... ─────────────────────────────────────
router.get("/drafts", async (req, res) => {
  try {
    const campaign = req.query.campaign || null;
    let query = db
      .from("pythh_prospecting_log")
      .select("id, email, actual_recipient, email_type, subject, target_name, campaign_slug, sent_at, status")
      .eq("status", "draft")
      .order("sent_at", { ascending: false })
      .limit(100);
    if (campaign) query = query.eq("campaign_slug", campaign);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ drafts: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/outreach/message/:id ─────────────────────────────────────────────
router.get("/message/:id", async (req, res) => {
  try {
    const { data, error } = await db
      .from("pythh_prospecting_log")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json({ message: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/outreach/inbox ───────────────────────────────────────────────────
router.get("/inbox", async (req, res) => {
  try {
    const [draftsRes, sentRes, repliesRes] = await Promise.all([
      db.from("pythh_prospecting_log").select("id, email, actual_recipient, email_type, subject, target_name, campaign_slug, sent_at, status, opened_at, bounced_at").eq("status", "draft").order("sent_at", { ascending: false }).limit(50),
      db.from("pythh_prospecting_log").select("id, email, actual_recipient, email_type, subject, target_name, campaign_slug, sent_at, status, opened_at, bounced_at, resend_message_id").eq("status", "sent").order("sent_at", { ascending: false }).limit(50),
      db.from("pythh_outreach_replies").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (draftsRes.error) return res.status(500).json({ error: draftsRes.error.message });
    if (sentRes.error) return res.status(500).json({ error: sentRes.error.message });
    if (repliesRes.error && !repliesRes.error.message.includes("does not exist")) {
      return res.status(500).json({ error: repliesRes.error.message });
    }
    res.json({
      drafts: draftsRes.data ?? [],
      sent: sentRes.data ?? [],
      replies: repliesRes.data ?? [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/outreach/send-drafts ────────────────────────────────────────────
router.post("/send-drafts", express.json(), async (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array required" });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(503).json({ error: "RESEND_API_KEY not configured" });

  const fromAddress = process.env.OUTREACH_FROM || "pythia@pythh.ai";
  const fromName = "PYTHIA at Pythh";
  const notifyTo = process.env.OUTREACH_NOTIFY_EMAIL || "ugobe07@gmail.com";

  const { data: drafts, error } = await db
    .from("pythh_prospecting_log")
    .select("*")
    .in("id", ids)
    .eq("status", "draft");
  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const draft of drafts ?? []) {
    const recipient = draft.actual_recipient || draft.email;
    const payload = {
      from: `${fromName} <${fromAddress}>`,
      to: [recipient],
      reply_to: notifyTo,
      subject: draft.subject,
      html: draft.html_body,
      text: draft.text_body || "",
    };
    if (notifyTo && notifyTo !== recipient) payload.bcc = [notifyTo];

    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        results.push({ id: draft.id, ok: false, error: data });
        await db.from("pythh_prospecting_log").update({ status: "failed", notes: JSON.stringify(data).slice(0, 200) }).eq("id", draft.id);
        continue;
      }
      await db.from("pythh_prospecting_log").update({
        status: "sent",
        resend_message_id: data.id,
        approved_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      }).eq("id", draft.id);
      results.push({ id: draft.id, ok: true, resendId: data.id });
    } catch (e) {
      results.push({ id: draft.id, ok: false, error: e.message });
    }
  }

  res.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
});

// ── POST /api/outreach/replies/:id/read ───────────────────────────────────────
router.post("/replies/:id/read", async (req, res) => {
  const { error } = await db
    .from("pythh_outreach_replies")
    .update({ read_at: new Date().toISOString() })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── POST /api/outreach/webhook/inbound ────────────────────────────────────────
router.post("/webhook/inbound", express.json(), async (req, res) => {
  const event = req.body;
  const type = event?.type || "";
  if (type !== "email.received") return res.status(200).json({ ok: true });

  const data = event.data || {};
  const fromEmail = data.from || data.from_email || "unknown";
  const toEmail = Array.isArray(data.to) ? data.to[0] : data.to;
  const subject = data.subject || "(no subject)";
  const textBody = data.text || data.text_body || "";
  const htmlBody = data.html || data.html_body || null;
  const inReplyTo = data.in_reply_to || data.message_id || null;

  let prospectingLogId = null;
  if (inReplyTo) {
    const { data: logRow } = await db
      .from("pythh_prospecting_log")
      .select("id")
      .eq("resend_message_id", inReplyTo)
      .maybeSingle();
    prospectingLogId = logRow?.id ?? null;
  }

  await db.from("pythh_outreach_replies").insert({
    from_email: fromEmail,
    to_email: toEmail,
    subject,
    text_body: textBody,
    html_body: htmlBody,
    in_reply_to_message_id: inReplyTo,
    prospecting_log_id: prospectingLogId,
  });

  res.status(200).json({ ok: true });
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
