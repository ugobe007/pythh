#!/usr/bin/env node
/**
 * Pythh Outreach Scheduler
 *
 * Schedules the outreach agent to run automatically on a weekly cadence.
 * By default:
 *   - Monday  08:00 ET — VC mode   (10 startup leads per investor firm)
 *   - Tuesday 08:00 ET — Founder mode (peter-founder-outreach.mjs — Hunter + ZeroBounce)
 *
 * Usage:
 *   node scripts/cron/outreach-scheduler.js              # run once (based on --mode flag or both)
 *   node scripts/cron/outreach-scheduler.js --daemon     # loop with node-cron
 *
 * Env:
 *   OUTREACH_VC_SCHEDULE       — cron expression (default: 0 8 * * 1  = Monday 8am)
 *   OUTREACH_STARTUP_SCHEDULE  — cron expression (default: 0 8 * * 2  = Tuesday 8am)
 *   OUTREACH_SCAN              — startups to scan per founder run (default: 300)
 *   OUTREACH_LIMIT             — emails per run (default: 20)
 *   OUTREACH_TZ                — timezone (default: America/New_York)
 *   OUTREACH_DRAFT_ONLY        — set to "true" to queue drafts instead of sending (default: live send)
 *   OUTREACH_USE_PYTHH_DOMAIN  — must be "true" for production sends (pythia@pythh.ai)
 *   SUPABASE_URL               — required
 *   SUPABASE_SERVICE_ROLE_KEY  — required
 *   RESEND_API_KEY             — required
 *   HUNTER_API_KEY             — required for founder runs
 *   ZEROBOUNCE_API_KEY         — required for founder runs
 */

const path    = require("path");
const { spawn } = require("child_process");

const DAEMON = process.argv.includes("--daemon");
const DRAFT_ONLY = process.argv.includes("--draft-only") || process.env.OUTREACH_DRAFT_ONLY === "true";
const ROOT   = path.join(__dirname, "..", "..");
const AGENT  = path.join(ROOT, "scripts", "outreach-agent.js");
const FOUNDER_AGENT = path.join(ROOT, "scripts", "peter-founder-outreach.mjs");

const VC_SCHEDULE      = process.env.OUTREACH_VC_SCHEDULE      ?? "0 8 * * 1";  // Monday
const STARTUP_SCHEDULE = process.env.OUTREACH_STARTUP_SCHEDULE ?? "0 8 * * 2";  // Tuesday
const LIMIT            = process.env.OUTREACH_LIMIT            ?? "20";
const SCAN             = process.env.OUTREACH_SCAN             ?? "300";
const TZ               = process.env.OUTREACH_TZ               ?? "America/New_York";

// ── Spawn helper ──────────────────────────────────────────────────────────────

function runMode(mode) {
  const now = new Date().toISOString();
  const sendMode = DRAFT_ONLY ? "draft-only" : "live";
  const script = mode === "startup" ? FOUNDER_AGENT : AGENT;
  const args = mode === "startup"
    ? [script, "--limit", LIMIT, "--scan", SCAN]
    : [AGENT, "--mode", mode, "--limit", LIMIT];
  if (DRAFT_ONLY) args.push("--draft-only");

  console.log(`\n[outreach-scheduler] ${now}  starting mode=${mode} limit=${LIMIT}${mode === "startup" ? ` scan=${SCAN}` : ""} send=${sendMode}`);

  const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });

  child.on("close", (code) => {
    const status = code === 0 ? "✓ completed" : `✗ exited with code ${code}`;
    console.log(`[outreach-scheduler] mode=${mode} ${status}`);
  });

  child.on("error", (err) => {
    console.error(`[outreach-scheduler] mode=${mode} spawn error:`, err.message);
  });

  return child;
}

// ── One-shot mode ─────────────────────────────────────────────────────────────

if (!DAEMON) {
  const mode = process.argv.includes("--mode")
    ? process.argv[process.argv.indexOf("--mode") + 1]
    : null;

  if (mode === "vc" || mode === "startup") {
    runMode(mode);
  } else {
    // Run both sequentially
    const vcChild = runMode("vc");
    vcChild.on("close", () => runMode("startup"));
  }
  return;
}

// ── Daemon mode (requires node-cron) ─────────────────────────────────────────

let cron;
try {
  cron = require("node-cron");
} catch {
  console.error("[outreach-scheduler] node-cron not installed. Run: npm install node-cron");
  process.exit(1);
}

console.log(`[outreach-scheduler] Daemon started.`);
console.log(`  VC mode:      ${VC_SCHEDULE} (${TZ})`);
console.log(`  Startup mode: ${STARTUP_SCHEDULE} (${TZ}) — peter-founder-outreach.mjs`);
console.log(`  Limit:        ${LIMIT} emails per run`);
console.log(`  Scan depth:   ${SCAN} startups (founder runs)`);
console.log(`  Send mode:    ${DRAFT_ONLY ? "draft-only" : "live"}\n`);

cron.schedule(VC_SCHEDULE, () => runMode("vc"), {
  timezone: TZ,
  scheduled: true,
});

cron.schedule(STARTUP_SCHEDULE, () => runMode("startup"), {
  timezone: TZ,
  scheduled: true,
});

// Keep alive
process.stdin.resume();

process.on("SIGTERM", () => {
  console.log("[outreach-scheduler] SIGTERM received. Exiting.");
  process.exit(0);
});
