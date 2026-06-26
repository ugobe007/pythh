// Pythh Agent Daily Report — owner ops email with metrics, findings, and agent results.
//
// Usage:
//   node scripts/send-agent-daily-report.js
//   node scripts/send-agent-daily-report.js --dry
//   node scripts/send-agent-daily-report.js --to you@example.com

'use strict';

const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  gatherAgentDailyReportData,
  buildAgentDailyReportHtml,
  buildAgentDailyReportText,
} = require('../server/lib/agentDailyReport');

const DEFAULT_TO = 'ugobe07@gmail.com';
const EMAIL_FROM = process.env.AGENT_DAILY_REPORT_FROM || process.env.EMAIL_FROM || 'Pythh Ops <ops@pythh.ai>';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const DRY = process.argv.includes('--dry');
const SINGLE_TO = arg('--to');

function resolveRecipient() {
  if (SINGLE_TO) return SINGLE_TO;
  const explicit = process.env.AGENT_DAILY_REPORT_TO || process.env.ADMIN_EMAIL;
  if (explicit) return explicit.split(',')[0].trim();
  const owners = process.env.OWNER_EMAILS;
  if (owners) return owners.split(',')[0].trim();
  return DEFAULT_TO;
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { success: false, error: data.message || `HTTP ${resp.status}` };
    return { success: true, id: data.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const reportsDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  console.log('[agent-daily-report] Gathering metrics and agent results…');
  const data = await gatherAgentDailyReportData({ repoRoot, refreshFunnel: true });

  const outFile = path.join(reportsDir, `agent-daily-report-${data.date}.json`);
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`[agent-daily-report] Snapshot: ${outFile}`);

  const subject = `Pythh Agent Daily — ${data.date} · ${data.north_star.signups_per_day_7d} signups/day · ${data.metrics.today.signups} today`;
  const html = buildAgentDailyReportHtml(data);
  const text = buildAgentDailyReportText(data);

  if (DRY) {
    console.log('\n--- TEXT PREVIEW ---\n');
    console.log(text);
    console.log(`\n[agent-daily-report] DRY run — HTML ${html.length} chars. No email sent.`);
    return;
  }

  const to = resolveRecipient();
  console.log(`[agent-daily-report] Sending to ${to}…`);
  const result = await sendViaResend({ to, subject, html, text });
  if (!result.success) {
    console.error(`[agent-daily-report] FAILED: ${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[agent-daily-report] Sent (${result.id})`);
}

main().catch((e) => {
  console.error('[agent-daily-report] Fatal:', e.message);
  process.exit(1);
});
