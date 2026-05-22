#!/usr/bin/env node
/**
 * Pythh Outreach Agent
 *
 * Automatically identifies hot leads and sends prospecting emails:
 *   vc mode     → sends 10 investment-grade startup matches to VC firms,
 *                 prompts them to connect Pythh's MCP to their AI agent
 *   startup mode → sends top 5 investor matches to founders,
 *                  prompts them to sign up for MCP services
 *
 * Usage:
 *   node scripts/outreach-agent.js --mode vc      --limit 50  --dry-run
 *   node scripts/outreach-agent.js --mode startup --limit 100 --dry-run
 *   node scripts/outreach-agent.js --mode vc      --test-to you@example.com
 *   node scripts/outreach-agent.js --mode startup --campaign startup-may-2026
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY        (not needed with --dry-run)
 */

import { config } from "dotenv";
import { createRequire } from "module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { rankStartupsForInvestor, rankInvestorsForStartup } = require("../lib/outreachMatch.js");
const { classifyOutreachEmail, outreachGreeting } = require("../lib/investorEmailInfer.js");

// Load .env from repo root (script lives at scripts/outreach-agent.js → one level up)
const envPath = new URL("../.env", import.meta.url).pathname;
config({ path: envPath });

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(name);

const MODE     = flag("--mode")     ?? "vc";           // 'vc' | 'startup'
const LIMIT    = parseInt(flag("--limit") ?? "20", 10);
const DRY_RUN    = has("--dry-run");
const DRAFT_ONLY = has("--draft-only");
const TEST_TO    = flag("--test-to");                    // override all To: addresses
const CAMPAIGN   = flag("--campaign") ?? `${MODE}-${new Date().toISOString().slice(0, 7)}`; // e.g. vc-2026-05
const NOTIFY_TO  = process.env.OUTREACH_NOTIFY_EMAIL || "ugobe07@gmail.com";

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_ADDRESS  = TEST_TO
  ? (process.env.OUTREACH_TEST_FROM || "onboarding@resend.dev")
  : (process.env.OUTREACH_FROM || "pythia@pythh.ai");
const FROM_NAME     = "PYTHIA at Pythh";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[outreach-agent] ✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
if (!RESEND_KEY && !DRY_RUN && !DRAFT_ONLY) {
  console.error("[outreach-agent] ✗ Missing RESEND_API_KEY. Use --dry-run or --draft-only to preview without sending.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Utilities ─────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 70) return "#22c55e";
  if (score >= 55) return "#eab308";
  return "#94a3b8";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Resend ───────────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html, text, meta = {} }) {
  const recipient = TEST_TO ?? to;
  const finalSubject = TEST_TO ? `[PYTHH PREVIEW] ${subject}` : subject;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] → ${recipient}  |  "${finalSubject}"`);
    return { ok: true, id: "dry-run-" + Math.random().toString(36).slice(2), recipient, subject: finalSubject, html, text };
  }

  if (DRAFT_ONLY) {
    await logDraft({
      email: to,
      actualRecipient: recipient,
      emailType: meta.emailType,
      targetId: meta.targetId,
      targetName: meta.targetName,
      subject: finalSubject,
      html,
      text,
      campaign: CAMPAIGN,
    });
    console.log(`  [DRAFT] saved for ${meta.targetName ?? to} → review in /admin/outreach`);
    return { ok: true, id: "draft-" + Math.random().toString(36).slice(2), recipient, subject: finalSubject, html, text };
  }

  const payload = {
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: [recipient],
    reply_to: NOTIFY_TO,
    subject: finalSubject,
    html,
    text,
  };
  // Always BCC admin so outreach copies land in your inbox
  if (NOTIFY_TO && NOTIFY_TO !== recipient) {
    payload.bcc = [NOTIFY_TO];
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error(`  [outreach-agent] Resend error for ${recipient}:`, data);
    return { ok: false, error: data, recipient, subject: finalSubject, html, text };
  }
  return { ok: true, id: data.id ?? "", recipient, subject: finalSubject, html, text };
}

// ── Dedup log ─────────────────────────────────────────────────────────────────

async function alreadySent({ email, emailType, campaign }) {
  if (DRY_RUN || DRAFT_ONLY) return false;
  const { data } = await db
    .from("pythh_prospecting_log")
    .select("id")
    .eq("email", email)
    .eq("email_type", emailType)
    .eq("campaign_slug", campaign)
    .eq("status", "sent")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logDraft({ email, actualRecipient, emailType, targetId, targetName, subject, html, text, campaign }) {
  // Replace existing draft for same target in this campaign
  await db
    .from("pythh_prospecting_log")
    .delete()
    .eq("email", email)
    .eq("email_type", emailType)
    .eq("campaign_slug", campaign)
    .eq("status", "draft");

  await db.from("pythh_prospecting_log").insert({
    email,
    actual_recipient: actualRecipient,
    email_type: emailType,
    target_id: String(targetId ?? ""),
    target_name: targetName ?? null,
    subject,
    html_body: html,
    text_body: text,
    campaign_slug: campaign,
    status: "draft",
    sent_at: new Date().toISOString(),
  });
}

async function logSent({ email, actualRecipient, emailType, targetId, targetName, subject, html, text, resendId, campaign }) {
  if (DRY_RUN) return;
  await db.from("pythh_prospecting_log").insert({
    email,
    actual_recipient: actualRecipient ?? email,
    email_type: emailType,
    target_id: String(targetId ?? ""),
    target_name: targetName ?? null,
    subject,
    html_body: html,
    text_body: text,
    resend_message_id: resendId,
    campaign_slug: campaign,
    status: "sent",
    sent_at: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VC MODE — send 10 hot startup leads to VC firms
// ═══════════════════════════════════════════════════════════════════════════════

async function runVcMode() {
  console.log("\n[VC mode] Fetching investors with inferred emails…");

  const { data: investors, error } = await db
    .from("investors")
    .select("id, name, firm, sectors, stage, check_size_min, check_size_max, investor_score, investor_tier, email_best_guess, notable_investments, signals, investment_thesis")
    .not("email_best_guess", "is", null)
    .in("email_status", ["inferred", "verified"])
    .order("investor_score", { ascending: false, nullsFirst: false })
    .limit(LIMIT * 3);

  if (error) { console.error("[VC mode] DB error:", error); return; }
  console.log(`[VC mode] Found ${investors?.length ?? 0} candidate investors`);

  const { data: startupPool } = await db
    .from("startup_uploads")
    .select("id, name, website, sectors, total_god_score, stage, tagline")
    .gte("total_god_score", 40)
    .eq("status", "approved")
    .order("total_god_score", { ascending: false })
    .limit(500);

  console.log(`[VC mode] Scoring against ${startupPool?.length ?? 0} approved startups\n`);

  let sent = 0;

  for (const inv of investors ?? []) {
    if (sent >= LIMIT) break;

    const email = inv.email_best_guess;
    if (!email) continue;

    if (await alreadySent({ email, emailType: "vc_leads", campaign: CAMPAIGN })) {
      console.log(`  [skip] ${email} already contacted in campaign ${CAMPAIGN}`);
      continue;
    }

    const invSectors = Array.isArray(inv.sectors) ? inv.sectors : [inv.sectors ?? "technology"];
    const primarySector = invSectors[0] ?? "technology";
    const emailType = classifyOutreachEmail(email, inv.name);

    const ranked = rankStartupsForInvestor(inv, startupPool ?? [], { limit: 10, minScore: 35 });
    const leads = ranked.map((r) => ({
      ...r.startup,
      match_score: r.match_score,
      match_reason: r.match_reason,
      is_super_match: r.is_super_match,
    }));

    if (leads.length === 0) {
      console.log(`  [skip] No scored matches for ${inv.name}`);
      continue;
    }

    const checkSize = inv.check_size_min
      ? `$${Math.round(inv.check_size_min / 1000)}K–$${Math.round((inv.check_size_max ?? inv.check_size_min * 5) / 1000)}K`
      : "seed to Series A";

    const firmLabel = inv.firm && inv.firm !== "null" ? inv.firm : inv.name ?? "your firm";
    const greeting = outreachGreeting({ ...inv, firm: firmLabel }, emailType);
    const subject = emailType === "personal"
      ? `Signals forming in ${primarySector} — aligned with your orbit`
      : `Signal digest: ${primarySector} clusters entering ${firmLabel}'s orbit`;

    const html = vcEmail({ investor: { ...inv, firm: firmLabel, sector: primarySector, checkSize, emailType }, leads, greeting });
    const text = vcEmailText({ investor: { ...inv, firm: firmLabel, sector: primarySector, checkSize, emailType }, leads, greeting });

    process.stdout.write(`  Sending to ${inv.name} <${email}> [${emailType}] (${leads.length} signals)… `);
    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      meta: { emailType: "vc_leads", targetId: inv.id, targetName: inv.name ?? firmLabel },
    });

    if (result.ok && !DRAFT_ONLY) {
      await logSent({
        email,
        actualRecipient: result.recipient,
        emailType: "vc_leads",
        targetId: inv.id,
        targetName: inv.name ?? firmLabel,
        subject: result.subject,
        html: result.html,
        text: result.text,
        resendId: result.id,
        campaign: CAMPAIGN,
      });
      sent++;
      console.log(`✓ (${sent}/${LIMIT})`);
    } else if (result.ok && DRAFT_ONLY) {
      sent++;
      console.log(`✓ draft (${sent}/${LIMIT})`);
    } else {
      console.log("✗ failed");
    }

    await sleep(500);
  }

  console.log(`\n[VC mode] Done. Sent ${sent} emails in campaign "${CAMPAIGN}".`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP MODE — send top 5 investor matches to founders
// ═══════════════════════════════════════════════════════════════════════════════

async function runStartupMode() {
  console.log("\n[Startup mode] Fetching startups with contact emails…");

  const BLOCKED_EMAILS = ["bulk@import.com", "auto@test.com", "test@test.com", "noreply@", "admin@hotmoneyhoney.com"];

  const { data: startups, error } = await db
    .from("startup_uploads")
    .select("id, name, website, sectors, total_god_score, stage, tagline, submitted_email")
    .not("submitted_email", "is", null)
    .eq("status", "approved")
    .gte("total_god_score", 40)
    .order("total_god_score", { ascending: false })
    .limit(LIMIT * 5);

  if (error) { console.error("[Startup mode] DB error:", error); return; }
  console.log(`[Startup mode] Found ${startups?.length ?? 0} startups with emails`);

  const { data: investorPool } = await db
    .from("investors")
    .select("id, name, firm, sectors, stage, check_size_min, check_size_max, investor_score, investor_tier, notable_investments, signals, investment_thesis")
    .order("investor_score", { ascending: false, nullsFirst: false })
    .limit(800);

  console.log(`[Startup mode] Scoring against ${investorPool?.length ?? 0} investors\n`);

  let sent = 0;

  for (const startup of startups ?? []) {
    if (sent >= LIMIT) break;

    const email = startup.submitted_email;
    if (!email) continue;

    if (BLOCKED_EMAILS.some((b) => email.toLowerCase().includes(b.toLowerCase()))) {
      console.log(`  [skip] ${email} is a blocked/placeholder address`);
      continue;
    }

    if (await alreadySent({ email, emailType: "startup_matches", campaign: CAMPAIGN })) {
      console.log(`  [skip] ${email} already contacted in campaign ${CAMPAIGN}`);
      continue;
    }

    const ranked = rankInvestorsForStartup(startup, investorPool ?? [], { limit: 5, minScore: 35 });

    if (ranked.length === 0) {
      console.log(`  [skip] No scored matches for ${startup.name ?? startup.website}`);
      continue;
    }

    const founderName = email.split("@")[0].replace(/[._+-]/g, " ");
    const user = { name: founderName, email };
    const startupLabel = (startup.name ?? startup.website ?? "your startup").trim();
    const subject = `Who recognizes ${startupLabel} now — ${ranked.length} investors aligned`;
    const html = startupEmail({ user, startup: { ...startup, name: startupLabel }, matches: ranked });
    const text = startupEmailText({ user, startup: { ...startup, name: startupLabel }, matches: ranked });

    process.stdout.write(`  Sending to ${email} (${startupLabel}, ${ranked.length} matches)… `);
    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      meta: { emailType: "startup_matches", targetId: startup.id, targetName: startupLabel },
    });

    if (result.ok && !DRAFT_ONLY) {
      await logSent({
        email,
        actualRecipient: result.recipient,
        emailType: "startup_matches",
        targetId: startup.id,
        targetName: startupLabel,
        subject: result.subject,
        html: result.html,
        text: result.text,
        resendId: result.id,
        campaign: CAMPAIGN,
      });
      sent++;
      console.log(`✓ (${sent}/${LIMIT})`);
    } else if (result.ok && DRAFT_ONLY) {
      sent++;
      console.log(`✓ draft (${sent}/${LIMIT})`);
    } else {
      console.log("✗ failed");
    }

    await sleep(500);
  }

  console.log(`\n[Startup mode] Done. Sent ${sent} emails in campaign "${CAMPAIGN}".`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// ── VC leads email (HTML) ─────────────────────────────────────────────────────

function vcEmail({ investor, leads, greeting }) {
  const sector = investor.sector ?? "technology";
  const emailType = investor.emailType ?? "intake";
  const isPersonal = emailType === "personal";

  const rows = leads.slice(0, 10).map((s) => {
    const score = s.match_score ?? s.total_god_score ?? 0;
    const godScore = s.total_god_score ?? 0;
    const color = scoreColor(score);
    const sectors = Array.isArray(s.sectors)
      ? s.sectors.slice(0, 2).join(" · ")
      : (s.sectors ?? sector);
    const label = s.name ?? s.website ?? "Signal cluster";
    const website = s.website ? encodeURIComponent(s.website) : "";
    const reason = s.match_reason
      ? s.match_reason.split(".")[0]
      : "Thesis and sector alignment";

    return `<tr>
      <td style="padding:14px 16px;border-bottom:1px solid #1e293b;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="52" style="vertical-align:middle;">
            <div style="background:#1e293b;color:${color};font-weight:700;font-size:17px;
                        width:44px;height:44px;border-radius:8px;text-align:center;
                        line-height:44px;font-family:monospace;">${score}</div>
          </td>
          <td style="vertical-align:top;padding-left:12px;">
            <div style="font-weight:600;color:#f1f5f9;font-size:14px;margin-bottom:2px;">${label}${s.is_super_match ? ' <span style="color:#a855f7;font-size:10px;">&#10022;</span>' : ""}</div>
            <div style="font-size:12px;color:#64748b;">${sectors}${s.stage ? " · " + s.stage : ""}${godScore ? " · GOD " + godScore : ""}</div>
            <div style="font-size:11px;color:#475569;margin-top:4px;line-height:1.45;">${reason}</div>
          </td>
          <td width="90" style="vertical-align:middle;text-align:right;">
            ${website ? `<a href="https://pythh.ai/activate?startup=${website}" style="color:#a78bfa;font-size:12px;text-decoration:none;white-space:nowrap;">Observe &rarr;</a>` : ""}
          </td>
        </tr></table>
      </td>
    </tr>`;
  }).join("");

  const headline = isPersonal
    ? `${leads.length} signal clusters forming in ${sector}.<br>Aligned with your orbit.`
    : `${leads.length} ${sector} signals entering ${investor.firm}&apos;s orbit.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pythh observatory preview — ${investor.firm}</title></head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="margin-bottom:32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                color:#a78bfa;font-family:monospace;margin-bottom:6px;">PYTHIA · Observatory Preview</div>
    <div style="width:28px;height:2px;background:#a78bfa;margin-bottom:24px;"></div>
    <p style="color:#94a3b8;font-size:13px;font-style:italic;margin:0 0 16px;">
      Everyone sees the surface. You see the patterns.
    </p>
    <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.35;margin:0 0 14px;">
      ${headline}
    </h1>
    <p style="color:#64748b;font-size:14px;line-height:1.65;margin:0;">
      ${greeting} Pythh tracked behavioral signals across sector, stage, conviction themes, and momentum —
      then ranked what is entering ${investor.firm}&apos;s alignment orbit. This is observatory-grade intelligence:
      patterns forming before the market notices. Not a pitch inbox.
    </p>
  </div>

  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;margin-bottom:24px;">
    <div style="padding:10px 16px;border-bottom:1px solid #1e293b;background:#0d1424;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                   color:#334155;font-family:monospace;">MATCH · SIGNAL · WHY</td>
        <td style="text-align:right;font-size:10px;color:#22c55e;font-family:monospace;">&#x25cf; live signals</td>
      </tr></table>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </div>

  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                color:#475569;font-family:monospace;margin-bottom:10px;">HOW THESE SIGNALS WERE DETECTED</div>
    <p style="color:#64748b;font-size:13px;line-height:1.65;margin:0;">
      Scored with Pythh&apos;s 6-component match model: sector fit, stage fit, investor quality,
      startup fundamentals (GOD score), market momentum, and conviction-theme alignment.
      Filtered for ${investor.firm}&apos;s focus (${sector}, ${investor.stage ?? "early-stage"},
      ${investor.checkSize ?? "seed to Series A"}). Updated daily from market signals.
    </p>
  </div>

  <div style="background:linear-gradient(135deg,#160929,#0f172a);border:1px solid #3b1d6e;
              border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;color:#c4b5fd;margin-bottom:8px;">
      Connect the observatory to your AI agent
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.55;margin:0 0 22px;">
      Query live signals in plain English inside Claude, Cursor, or any MCP client.
      Watch discovery form around your thesis — continuously, not as a static list.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="padding-right:12px;">
          <a href="https://pythh.ai/developers"
             style="display:inline-block;padding:12px 22px;border:1px solid #7c3aed;color:#a78bfa;
                    text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;
                    background:transparent;">Connect AI agent &rarr;</a>
        </td>
        <td>
          <a href="https://pythh.ai/investors"
             style="display:inline-block;padding:12px 22px;border:1px solid #1e293b;color:#64748b;
                    text-decoration:none;border-radius:8px;font-size:13px;background:transparent;">
            Browse rankings</a>
        </td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;padding-top:16px;border-top:1px solid #1e293b;">
    <p style="color:#334155;font-size:11px;margin:0 0 4px;font-family:monospace;">
      Pythh Capital &middot; pythh.ai &middot; ai@pythh.ai
    </p>
    <p style="font-size:11px;margin:0;">
      <a href="https://pythh.ai/support" style="color:#334155;text-decoration:none;">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      <a href="https://pythh.ai" style="color:#334155;text-decoration:none;">pythh.ai</a>
    </p>
  </div>

</div>
</body>
</html>`;
}

function vcEmailText({ investor, leads, greeting }) {
  const sector = investor.sector ?? "technology";

  const leadsText = leads
    .slice(0, 10)
    .map((s, i) => {
      const sectors = Array.isArray(s.sectors) ? s.sectors[0] : (s.sectors ?? "");
      const score = s.match_score ?? s.total_god_score ?? "—";
      const reason = s.match_reason ? s.match_reason.split(".")[0] : "";
      return `  ${i + 1}. ${s.name ?? s.website}  |  Match: ${score}  |  GOD: ${s.total_god_score ?? "—"}  |  ${sectors}${reason ? "\n     " + reason : ""}`;
    })
    .join("\n");

  return `${greeting}

Everyone sees the surface. You see the patterns.

Pythh detected ${leads.length} signal clusters forming in ${sector}, aligned with ${investor.firm}'s orbit:

${leadsText}

Scored with sector fit, stage fit, conviction themes, startup fundamentals, and market momentum.
This is observatory-grade intelligence — patterns forming before the market notices. Not a pitch inbox.

─────────────────────────────────────────────────

Connect the observatory to your AI agent (Claude, Cursor, MCP):
→ https://pythh.ai/developers
→ https://pythh.ai/investors

─────────────────────────────────────────────────
Pythh Capital · pythh.ai · ai@pythh.ai
Unsubscribe: https://pythh.ai/support
`;
}

// ── Startup matches email (HTML) ──────────────────────────────────────────────

function startupEmail({ user, startup, matches }) {
  const firstName = (user.name ?? "Founder").split(" ")[0];
  const startupName = startup.name ?? startup.website ?? "your startup";
  const godScore = startup.total_god_score ?? 0;
  const color = scoreColor(godScore);
  const scoreLabel = godScore >= 70 ? "Strong · Investment-grade"
    : godScore >= 55 ? "Solid · Signal-building"
    : "Emerging · Keep building";

  const rows = matches.map((m, i) => {
    const score = m.match_score ?? 0;
    const col = scoreColor(score);
    const bg = i % 2 === 0 ? "#0f172a" : "#0d1424";
    const checkRange = m.check_size_min
      ? ` · $${Math.round(m.check_size_min / 1000)}K–$${Math.round((m.check_size_max ?? m.check_size_min * 5) / 1000)}K`
      : "";

    return `<tr style="background:${bg};">
      <td style="padding:14px 16px;border-bottom:1px solid #1e293b;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="52" style="vertical-align:top;">
            <div style="background:#1e293b;color:${col};font-weight:700;font-size:17px;
                        width:44px;height:44px;border-radius:8px;text-align:center;
                        line-height:44px;font-family:monospace;">${score}</div>
          </td>
          <td style="vertical-align:top;padding-left:12px;">
            <div style="display:block;">
              <span style="font-weight:600;color:#f1f5f9;font-size:14px;">${m.name ?? "Investor"}</span>
              ${m.is_super_match
                ? `&nbsp;<span style="border:1px solid #a855f7;color:#a855f7;font-size:10px;
                             font-weight:700;padding:1px 5px;border-radius:4px;">&#10022; SUPER</span>`
                : ""}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">
              ${m.firm ?? ""}${m.stage ? " · " + m.stage : ""}${checkRange}
            </div>
            <div style="font-size:12px;color:#475569;margin-top:4px;line-height:1.5;">
              ${m.match_reason ?? "Thesis and sector alignment confirmed by Pythh signal engine."}
            </div>
          </td>
        </tr></table>
      </td>
    </tr>`;
  }).join("");

  const encodedUrl = startup.website ? encodeURIComponent(startup.website) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Who recognizes ${startupName} — Pythh</title></head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <div style="margin-bottom:32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                color:#22c55e;font-family:monospace;margin-bottom:6px;">PYTHIA · Cause–Effect Oracle</div>
    <div style="width:28px;height:2px;background:#22c55e;margin-bottom:24px;"></div>
    <p style="color:#94a3b8;font-size:13px;font-style:italic;margin:0 0 16px;">
      Who recognizes you now. Who will recognize you next.
    </p>
    <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.35;margin:0 0 14px;">
      ${matches.length} investors aligned with<br>${startupName}.
    </h1>
    <p style="color:#64748b;font-size:14px;line-height:1.65;margin:0;">
      Hi ${firstName}, PYTHIA scored <strong style="color:#94a3b8;">${startupName}</strong> against 6,000+ investors
      using sector fit, stage fit, conviction themes, and market momentum — the same model that powers
      instant matching on pythh.ai. These are your strongest alignment signals right now.
    </p>
  </div>

  ${godScore ? `
  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;
              padding:16px 20px;margin-bottom:20px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td width="70" style="vertical-align:middle;text-align:center;">
        <div style="font-size:38px;font-weight:700;color:${color};font-family:monospace;line-height:1;">${godScore}</div>
        <div style="font-size:9px;font-family:monospace;color:#475569;letter-spacing:0.08em;
                    text-transform:uppercase;margin-top:2px;">GOD SCORE</div>
      </td>
      <td style="border-left:1px solid #1e293b;padding-left:16px;vertical-align:middle;">
        <div style="font-size:13px;color:#94a3b8;font-weight:600;margin-bottom:3px;">${startupName}</div>
        <div style="font-size:12px;color:#475569;">Grit &middot; Opportunity &middot; Determination</div>
        <div style="font-size:12px;color:${color};margin-top:4px;font-weight:600;">${scoreLabel}</div>
      </td>
    </tr></table>
  </div>` : ""}

  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;margin-bottom:24px;">
    <div style="padding:10px 16px;border-bottom:1px solid #1e293b;background:#0d1424;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                  color:#334155;font-family:monospace;">MATCH · INVESTOR · WHY YOU ALIGN</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </div>

  <div style="background:linear-gradient(135deg,#051a0c,#0f172a);border:1px solid #14532d;
              border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;color:#4ade80;margin-bottom:8px;">
      See who recognizes you next
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.55;margin:0 0 22px;">
      Unlock your full match list, refine your GOD score, and generate personalized outreach —
      or connect Pythh to your AI agent for continuous investor intelligence.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="padding-right:12px;">
          <a href="https://pythh.ai/activate${encodedUrl ? "?startup=" + encodedUrl : ""}"
             style="display:inline-block;padding:12px 22px;border:1px solid #16a34a;color:#22c55e;
                    text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;
                    background:transparent;">See all my matches &rarr;</a>
        </td>
        <td>
          <a href="https://pythh.ai/developers"
             style="display:inline-block;padding:12px 22px;border:1px solid #1e293b;color:#64748b;
                    text-decoration:none;border-radius:8px;font-size:13px;background:transparent;">
            Connect AI agent</a>
        </td>
      </tr>
    </table>
  </div>

  <div style="text-align:center;padding-top:16px;border-top:1px solid #1e293b;">
    <p style="color:#334155;font-size:11px;margin:0 0 4px;font-family:monospace;">
      Pythh Capital &middot; pythh.ai &middot; ai@pythh.ai
    </p>
    <p style="font-size:11px;margin:0;">
      <a href="https://pythh.ai/support" style="color:#334155;text-decoration:none;">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      <a href="https://pythh.ai" style="color:#334155;text-decoration:none;">pythh.ai</a>
    </p>
  </div>

</div>
</body>
</html>`;
}

function startupEmailText({ user, startup, matches }) {
  const firstName = (user.name ?? "Founder").split(" ")[0];
  const startupName = startup.name ?? startup.website ?? "your startup";

  const matchesText = matches
    .map((m, i) => [
      `  ${i + 1}. ${m.name ?? "Investor"} at ${m.firm ?? "Unknown Firm"}  |  Match: ${m.match_score ?? "—"}${m.is_super_match ? "  ★ SUPER" : ""}`,
      `     ${m.match_reason ?? "Thesis and sector alignment confirmed."}`,
    ].join("\n"))
    .join("\n\n");

  const encodedUrl = startup.website ? encodeURIComponent(startup.website) : "";

  return `Hi ${firstName},

Who recognizes you now. Who will recognize you next.

PYTHIA scored ${startupName} against 6,000+ investors. These ${matches.length} show the strongest alignment signals right now:

${matchesText}

${startup.total_god_score ? `Your GOD Score: ${startup.total_god_score}/100\n` : ""}
─────────────────────────────────────────────────

See your full match list:
→ https://pythh.ai/activate${encodedUrl ? "?startup=" + encodedUrl : ""}

Connect Pythh to your AI agent for continuous investor intelligence:
→ https://pythh.ai/developers

─────────────────────────────────────────────────
Pythh Capital · pythh.ai · ai@pythh.ai
Unsubscribe: https://pythh.ai/support
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

console.log("┌─────────────────────────────────────────────────┐");
console.log("│  Pythh Outreach Agent                           │");
console.log("├─────────────────────────────────────────────────┤");
console.log(`│  mode:     ${MODE.padEnd(38)}│`);
console.log(`│  limit:    ${String(LIMIT).padEnd(38)}│`);
console.log(`│  campaign: ${CAMPAIGN.padEnd(38)}│`);
console.log(`│  dry run:  ${String(DRY_RUN).padEnd(38)}│`);
console.log(`│  drafts:   ${String(DRAFT_ONLY).padEnd(38)}│`);
console.log(`│  test to:  ${(TEST_TO ?? "—").padEnd(38)}│`);
console.log("└─────────────────────────────────────────────────┘");

if (MODE === "vc") {
  await runVcMode();
} else if (MODE === "startup") {
  await runStartupMode();
} else {
  console.error(`\n[outreach-agent] Unknown mode "${MODE}". Use --mode vc or --mode startup\n`);
  process.exit(1);
}
