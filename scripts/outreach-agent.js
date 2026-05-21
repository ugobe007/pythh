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
import { createClient } from "@supabase/supabase-js";

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
const DRY_RUN  = has("--dry-run");
const TEST_TO  = flag("--test-to");                    // override all To: addresses
const CAMPAIGN = flag("--campaign") ?? `${MODE}-${new Date().toISOString().slice(0, 7)}`; // e.g. vc-2026-05

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_ADDRESS  = "pythia@pythh.ai";
const FROM_NAME     = "PYTHIA at Pythh";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[outreach-agent] ✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
if (!RESEND_KEY && !DRY_RUN) {
  console.error("[outreach-agent] ✗ Missing RESEND_API_KEY. Use --dry-run to preview without sending.");
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

async function sendEmail({ to, subject, html, text }) {
  const recipient = TEST_TO ?? to;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] → ${recipient}  |  "${subject}"`);
    return { ok: true, id: "dry-run-" + Math.random().toString(36).slice(2) };
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: [recipient],
      reply_to: "ugobe07@gmail.com",
      subject,
      html,
      text,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error(`  [outreach-agent] Resend error for ${recipient}:`, data);
    return { ok: false, error: data };
  }
  return { ok: true, id: data.id ?? "" };
}

// ── Dedup log ─────────────────────────────────────────────────────────────────

async function alreadySent({ email, emailType, campaign }) {
  if (DRY_RUN) return false;
  const { data } = await db
    .from("pythh_prospecting_log")
    .select("id")
    .eq("email", email)
    .eq("email_type", emailType)
    .eq("campaign_slug", campaign)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logSent({ email, emailType, targetId, subject, resendId, campaign }) {
  if (DRY_RUN) return;
  await db.from("pythh_prospecting_log").insert({
    email,
    email_type:        emailType,
    target_id:         String(targetId ?? ""),
    subject,
    resend_message_id: resendId,
    campaign_slug:     campaign,
    sent_at:           new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// VC MODE — send 10 hot startup leads to VC firms
// ═══════════════════════════════════════════════════════════════════════════════

async function runVcMode() {
  console.log("\n[VC mode] Fetching investors with inferred emails…");

  const { data: investors, error } = await db
    .from("investors")
    .select("id, name, firm, sectors, stage, check_size_min, check_size_max, investor_score, investor_tier, email_best_guess, notable_investments")
    .not("email_best_guess", "is", null)
    .in("email_status", ["inferred", "verified"])
    .order("investor_score", { ascending: false, nullsFirst: false })
    .limit(LIMIT * 3);

  if (error) { console.error("[VC mode] DB error:", error); return; }
  console.log(`[VC mode] Found ${investors?.length ?? 0} candidate investors\n`);

  let sent = 0;

  for (const inv of investors ?? []) {
    if (sent >= LIMIT) break;

    const email = inv.email_best_guess;
    if (!email) continue;

    // Dedup check
    if (await alreadySent({ email, emailType: "vc_leads", campaign: CAMPAIGN })) {
      console.log(`  [skip] ${email} already contacted in campaign ${CAMPAIGN}`);
      continue;
    }

    // Determine primary sector (sectors is an array)
    const invSectors = Array.isArray(inv.sectors) ? inv.sectors : [inv.sectors ?? "technology"];
    const primarySector = invSectors[0] ?? "technology";

    // Fetch top 10 matching startups for this investor's sector
    let { data: leads } = await db
      .from("startup_uploads")
      .select("id, name, website, sectors, total_god_score, stage, tagline")
      .gte("total_god_score", 55)
      .eq("status", "approved")
      .order("total_god_score", { ascending: false })
      .limit(50);

    leads = (leads ?? []).filter((s) => {
      const sSectors = Array.isArray(s.sectors) ? s.sectors : [s.sectors ?? ""];
      return invSectors.some((is) =>
        sSectors.some((ss) =>
          (ss ?? "").toLowerCase().includes((is ?? "").toLowerCase()) ||
          (is ?? "").toLowerCase().includes((ss ?? "").toLowerCase())
        )
      );
    }).slice(0, 10);

    // Fallback to top GOD score startups if no sector match
    if (leads.length < 5) {
      const { data: fallback } = await db
        .from("startup_uploads")
        .select("id, name, website, sectors, total_god_score, stage, tagline")
        .gte("total_god_score", 60)
        .eq("status", "approved")
        .order("total_god_score", { ascending: false })
        .limit(10);
      leads = fallback ?? [];
    }

    if (leads.length === 0) {
      console.log(`  [skip] No startup leads found for ${inv.name}`);
      continue;
    }

    const checkSize = inv.check_size_min
      ? `$${Math.round(inv.check_size_min / 1000)}K–$${Math.round((inv.check_size_max ?? inv.check_size_min * 5) / 1000)}K`
      : "seed to Series A";

    const firmLabel = inv.firm && inv.firm !== "null" ? inv.firm : inv.name ?? "your firm";
    const subject = `${leads.length} investment-grade ${primarySector} startups matched to ${firmLabel}'s thesis`;
    const html    = vcEmail({ investor: { ...inv, firm: firmLabel, sector: primarySector, checkSize: checkSize }, leads });
    const text    = vcEmailText({ investor: { ...inv, firm: firmLabel, sector: primarySector, checkSize: checkSize }, leads });

    process.stdout.write(`  Sending to ${inv.name} <${email}> (${leads.length} leads)… `);
    const result = await sendEmail({ to: email, subject, html, text });

    if (result.ok) {
      await logSent({ email, emailType: "vc_leads", targetId: inv.id, subject, resendId: result.id, campaign: CAMPAIGN });
      sent++;
      console.log(`✓ (${sent}/${LIMIT})`);
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

  // startup_uploads has submitted_email — use that as the founder contact
  // Exclude known bulk/placeholder import addresses
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
  console.log(`[Startup mode] Found ${startups?.length ?? 0} startups with emails\n`);

  let sent = 0;

  for (const startup of startups ?? []) {
    if (sent >= LIMIT) break;

    const email = startup.submitted_email;
    if (!email) continue;

    // Skip placeholder/bulk import addresses
    if (BLOCKED_EMAILS.some((b) => email.toLowerCase().includes(b.toLowerCase()))) {
      console.log(`  [skip] ${email} is a blocked/placeholder address`);
      continue;
    }

    if (await alreadySent({ email, emailType: "startup_matches", campaign: CAMPAIGN })) {
      console.log(`  [skip] ${email} already contacted in campaign ${CAMPAIGN}`);
      continue;
    }

    // Find top 5 investors matching this startup's sector
    const startupSectors = Array.isArray(startup.sectors)
      ? startup.sectors
      : [startup.sectors ?? "technology"];

    const { data: investors } = await db
      .from("investors")
      .select("id, name, firm, sectors, stage, check_size_min, check_size_max, investor_score, investor_tier, notable_investments")
      .not("email_best_guess", "is", null)
      .order("investor_score", { ascending: false, nullsFirst: false })
      .limit(100);

    // Score each investor by sector overlap
    const ranked = (investors ?? [])
      .map((inv) => {
        const invSecs = Array.isArray(inv.sectors) ? inv.sectors : [inv.sectors ?? ""];
        const overlap = startupSectors.filter((ss) =>
          invSecs.some((is) =>
            (is ?? "").toLowerCase().includes((ss ?? "").toLowerCase()) ||
            (ss ?? "").toLowerCase().includes((is ?? "").toLowerCase())
          )
        ).length;
        return { ...inv, _overlap: overlap };
      })
      .sort((a, b) => b._overlap - a._overlap || (b.investor_score ?? 0) - (a.investor_score ?? 0))
      .slice(0, 5)
      .map((inv) => ({
        ...inv,
        match_score: Math.min(99, Math.round((inv.investor_score ?? 50) * 0.6 + inv._overlap * 10)),
        match_reason: inv._overlap > 0
          ? `Sector overlap confirmed (${startupSectors.slice(0, 2).join(", ")}). ${inv.investor_tier ? `${inv.investor_tier} tier investor.` : ""}`
          : `Strong investor profile. ${inv.investor_tier ? `${inv.investor_tier} tier.` : ""}`,
        is_super_match: inv._overlap > 0 && (inv.investor_score ?? 0) >= 80,
      }));

    if (ranked.length === 0) {
      console.log(`  [skip] No investor matches for ${startup.name ?? startup.website}`);
      continue;
    }

    const founderName = email.split("@")[0].replace(/[._+-]/g, " ");
    const user = { name: founderName, email };
    const startupLabel = startup.name ?? startup.website ?? "your startup";
    const subject = `Your top ${ranked.length} investor matches — ${startupLabel}`;
    const html    = startupEmail({ user, startup, matches: ranked });
    const text    = startupEmailText({ user, startup, matches: ranked });

    process.stdout.write(`  Sending to ${email} (${startup.name ?? startup.website}, ${ranked.length} matches)… `);
    const result = await sendEmail({ to: email, subject, html, text });

    if (result.ok) {
      await logSent({ email, emailType: "startup_matches", targetId: startup.id, subject, resendId: result.id, campaign: CAMPAIGN });
      sent++;
      console.log(`✓ (${sent}/${LIMIT})`);
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

function vcEmail({ investor, leads }) {
  const sector = investor.sector ?? "technology";
  const firstName = (investor.name ?? "").split(" ")[0] || investor.name;

  const rows = leads.slice(0, 10).map((s, i) => {
    const score   = s.total_god_score ?? 0;
    const color   = scoreColor(score);
    const sectors = Array.isArray(s.sectors)
      ? s.sectors.slice(0, 2).join(" · ")
      : (s.sectors ?? sector);
    const label = s.name ?? s.website ?? "Startup";
    const website = s.website ? encodeURIComponent(s.website) : "";

    return `<tr>
      <td style="padding:14px 16px;border-bottom:1px solid #1e293b;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="52" style="vertical-align:middle;">
            <div style="background:#1e293b;color:${color};font-weight:700;font-size:17px;
                        width:44px;height:44px;border-radius:8px;text-align:center;
                        line-height:44px;font-family:monospace;">${score}</div>
          </td>
          <td style="vertical-align:top;padding-left:12px;">
            <div style="font-weight:600;color:#f1f5f9;font-size:14px;margin-bottom:2px;">${label}</div>
            <div style="font-size:12px;color:#64748b;">${sectors}${s.stage ? " · " + s.stage : ""}</div>
            ${s.tagline ? `<div style="font-size:12px;color:#475569;margin-top:2px;font-style:italic;">${s.tagline}</div>` : ""}
          </td>
          <td width="90" style="vertical-align:middle;text-align:right;">
            ${website ? `<a href="https://pythh.ai/activate?startup=${website}" style="color:#a78bfa;font-size:12px;text-decoration:none;white-space:nowrap;">View →</a>` : ""}
          </td>
        </tr></table>
      </td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${leads.length} startup matches for ${investor.firm}</title></head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <!-- Brand -->
  <div style="margin-bottom:32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                color:#a78bfa;font-family:monospace;margin-bottom:6px;">PYTHIA · Pythh.ai</div>
    <div style="width:28px;height:2px;background:#a78bfa;margin-bottom:24px;"></div>
    <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.35;margin:0 0 14px;">
      ${leads.length} investment-grade ${sector} startups<br>matched to ${investor.firm}&apos;s thesis.
    </h1>
    <p style="color:#64748b;font-size:14px;line-height:1.65;margin:0;">
      Hi ${firstName}, Pythh&rsquo;s signal engine scored these startups across 40+ behavioral indicators —
      Grit, Opportunity, and Determination — then ranked them against ${investor.firm}&apos;s known thesis.
      GOD scores above 60 indicate investment-grade quality.
    </p>
  </div>

  <!-- Table header -->
  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;margin-bottom:24px;">
    <div style="padding:10px 16px;border-bottom:1px solid #1e293b;background:#0d1424;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                   color:#334155;font-family:monospace;">GOD · STARTUP · SECTOR</td>
        <td style="text-align:right;font-size:10px;color:#22c55e;font-family:monospace;">&#x25cf; live · updated daily</td>
      </tr></table>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </div>

  <!-- Why these matches -->
  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin-bottom:24px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                color:#475569;font-family:monospace;margin-bottom:10px;">HOW PYTHH MATCHED THESE</div>
    <p style="color:#64748b;font-size:13px;line-height:1.65;margin:0;">
      Each startup was scored against ${investor.firm}&apos;s stated thesis signals: sector focus
      (${sector}), stage preference (${investor.stage ?? "early-stage"}), and check size
      (${investor.check_size ?? "seed to Series A"}). Matches derive from 1.2M+ active pairings
      updated daily from real-time market signals &mdash; funding announcements, job posts,
      founder activity, and VC behavioral shifts.
    </p>
  </div>

  <!-- CTA -->
  <div style="background:linear-gradient(135deg,#160929,#0f172a);border:1px solid #3b1d6e;
              border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;color:#c4b5fd;margin-bottom:8px;">
      Want continuous deal flow &mdash; connected to your AI agent?
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.55;margin:0 0 22px;">
      Connect Pythh to Claude, Cursor, or any MCP-compatible AI agent. Query 33,000+ scored startups
      and 6,250+ investors in plain English. No SQL. No API spec. New deals every day.
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
            Browse investor rankings</a>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
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

function vcEmailText({ investor, leads }) {
  const sector    = investor.sector ?? "technology";
  const firstName = (investor.name ?? "").split(" ")[0] || investor.name;

  const leadsText = leads
    .slice(0, 10)
    .map((s, i) => {
      const sectors = Array.isArray(s.sectors) ? s.sectors[0] : (s.sectors ?? "");
      return `  ${i + 1}. ${s.name ?? s.website}  |  GOD: ${s.total_god_score ?? "—"}  |  ${sectors}${s.stage ? "  |  " + s.stage : ""}`;
    })
    .join("\n");

  return `Hi ${firstName},

Pythh identified ${leads.length} investment-grade ${sector} startups that match ${investor.firm}'s thesis:

${leadsText}

Each startup scored against Grit, Opportunity, and Determination across 40+ behavioral signals.
GOD scores above 60 indicate investment-grade quality. Pythh's database has 1.2M+ active matches,
updated daily.

─────────────────────────────────────────────────

Want continuous deal flow connected to your AI agent?
Connect Pythh to Claude, Cursor, or any MCP-compatible AI.
Query 33,000+ scored startups in plain English.

→ Connect AI agent: https://pythh.ai/developers
→ Browse investor rankings: https://pythh.ai/investors

─────────────────────────────────────────────────
Pythh Capital · pythh.ai · ai@pythh.ai
Unsubscribe: https://pythh.ai/support
`;
}

// ── Startup matches email (HTML) ──────────────────────────────────────────────

function startupEmail({ user, startup, matches }) {
  const firstName   = (user.name ?? "Founder").split(" ")[0];
  const startupName = startup.name ?? startup.website ?? "your startup";
  const godScore    = startup.total_god_score ?? 0;
  const color       = scoreColor(godScore);
  const scoreLabel  = godScore >= 70 ? "Strong · Investment-grade"
    : godScore >= 55 ? "Solid · Signal-building"
    : "Emerging · Keep building";

  const rows = matches.map((m, i) => {
    const score = m.match_score ?? 0;
    const col   = scoreColor(score);
    const bg    = i % 2 === 0 ? "#0f172a" : "#0d1424";
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
<title>Your top investor matches — ${startupName}</title></head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <!-- Brand -->
  <div style="margin-bottom:32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                color:#22c55e;font-family:monospace;margin-bottom:6px;">PYTHIA · Pythh.ai</div>
    <div style="width:28px;height:2px;background:#22c55e;margin-bottom:24px;"></div>
    <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;line-height:1.35;margin:0 0 14px;">
      Your top ${matches.length} investor matches<br>are ready, ${firstName}.
    </h1>
    <p style="color:#64748b;font-size:14px;line-height:1.65;margin:0;">
      PYTHIA analyzed <strong style="color:#94a3b8;">${startupName}</strong> against 6,250+ investors
      and ranked these as your strongest thesis matches &mdash; scored by timing, sector alignment,
      check size fit, and GOD score proximity.
    </p>
  </div>

  <!-- GOD score card -->
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

  <!-- Match table -->
  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;margin-bottom:24px;">
    <div style="padding:10px 16px;border-bottom:1px solid #1e293b;background:#0d1424;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
                  color:#334155;font-family:monospace;">MATCH SCORE · INVESTOR · WHY YOU MATCH</div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
  </div>

  <!-- CTA -->
  <div style="background:linear-gradient(135deg,#051a0c,#0f172a);border:1px solid #14532d;
              border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
    <div style="font-size:13px;font-weight:700;color:#4ade80;margin-bottom:8px;">
      See all your matches. Automate your outreach.
    </div>
    <p style="color:#64748b;font-size:13px;line-height:1.55;margin:0 0 22px;">
      Pythh has 1.2M+ active matches. Connect your AI agent to get unlimited access &mdash;
      query investors, refine your GOD score, and generate personalized outreach in plain English.
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

  <!-- Footer -->
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
  const firstName   = (user.name ?? "Founder").split(" ")[0];
  const startupName = startup.name ?? startup.website ?? "your startup";

  const matchesText = matches
    .map((m, i) => [
      `  ${i + 1}. ${m.name ?? "Investor"} at ${m.firm ?? "Unknown Firm"}  |  Match: ${m.match_score ?? "—"}${m.is_super_match ? "  ★ SUPER" : ""}`,
      `     ${m.match_reason ?? "Thesis and sector alignment confirmed."}`,
    ].join("\n"))
    .join("\n\n");

  const encodedUrl = startup.website ? encodeURIComponent(startup.website) : "";

  return `Hi ${firstName},

PYTHIA matched ${startupName} to ${matches.length} investors from our database of 6,250+:

${matchesText}

${startup.total_god_score ? `Your GOD Score: ${startup.total_god_score}/100\n` : ""}
─────────────────────────────────────────────────

See all your matches and start outreach:
→ https://pythh.ai/activate${encodedUrl ? "?startup=" + encodedUrl : ""}

Want unlimited access? Connect Pythh to your AI agent (Claude, Cursor, etc.)
for continuous investor matching and outreach automation.
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
