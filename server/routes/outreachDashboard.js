/**
 * Outreach Dashboard API
 *
 * GET  /api/outreach/stats          — campaign summary stats
 * GET  /api/outreach/contacts       — paginated contact list with status
 * GET  /api/outreach/campaigns      — list of distinct campaign slugs
 * POST /api/webhooks/resend-outreach — Resend webhook: open/click/bounce events
 */

const express = require("express");
const router  = express.Router();
const { createClient } = require("@supabase/supabase-js");
const crypto  = require("crypto");

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

// ── POST /api/webhooks/resend-outreach ────────────────────────────────────────
// Resend sends events: email.opened, email.clicked, email.bounced, email.unsubscribed
router.post("/webhook/resend", express.raw({ type: "application/json" }), async (req, res) => {
  // Verify Resend webhook signature if secret is configured
  if (RESEND_WEBHOOK_SECRET) {
    const sig = req.headers["svix-signature"] || req.headers["resend-signature"] || "";
    const ts  = req.headers["svix-timestamp"] || "";
    const id  = req.headers["svix-id"] || "";
    const payload = `${id}.${ts}.${req.body.toString()}`;
    const expected = crypto
      .createHmac("sha256", RESEND_WEBHOOK_SECRET)
      .update(payload)
      .digest("base64");
    if (!sig.split(" ").some((s) => s.replace(/^v1,/, "") === expected)) {
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
