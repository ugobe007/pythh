// --- FILE: scripts/send-daily-brief.js ---
// The Pythh Daily Brief — generates today's edition and emails it to all
// active newsletter_subscribers via Resend.
//
// Run by GitHub Actions (Platform Daily Batch). Reuses the same content
// generator and email builder as the website + admin send-digest endpoint.
//
// Usage:
//   node scripts/send-daily-brief.js                 # send to all subscribers
//   node scripts/send-daily-brief.js --dry           # generate only, no send
//   node scripts/send-daily-brief.js --to a@b.com    # send a single test
//   node scripts/send-daily-brief.js --limit 50      # cap recipients

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getSupabaseClient } = require('../server/lib/supabaseClient');
const { generateNewsletter } = require('../server/newsletter-generator');
const { buildBriefEmailHtml, buildBriefEmailText } = require('../server/lib/newsletterEmail');

const SITE_URL = process.env.APP_BASE_URL || process.env.SITE_URL || 'https://pythh.ai';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Pythh Daily Brief <brief@pythh.ai>';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}
const DRY = process.argv.includes('--dry');
const SINGLE_TO = arg('--to');
const LIMIT = parseInt(arg('--limit') || '0', 10) || null;

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
  console.log('[daily-brief] Generating today\u2019s edition…');
  const nl = await generateNewsletter({ bust: true });
  console.log(
    `[daily-brief] Edition ${nl.date} · editorial:${nl.editorial?.source || 'n/a'} · ` +
    `hottest:${nl.hottestStartups?.length || 0} · matches:${nl.topMatches?.length || 0} · ` +
    `money:${nl.moneyMoves?.length || 0} · vcNews:${nl.vcNews?.length || 0}`
  );

  const subject = `The Pythh Daily Brief — ${nl.date}`;

  if (DRY) {
    console.log('\n--- PYTHIA\u2019S TAKE ---\n' + (nl.editorial?.text || '(none)'));
    console.log(`\n[daily-brief] DRY run — HTML length ${buildBriefEmailHtml(nl, { siteUrl: SITE_URL, email: 'preview@pythh.ai' }).length} chars. No emails sent.`);
    return;
  }

  let recipients;
  if (SINGLE_TO) {
    recipients = [{ email: SINGLE_TO }];
    console.log(`[daily-brief] Single test send to ${SINGLE_TO}`);
  } else {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .is('unsubscribed_at', null);
    if (error) throw error;
    recipients = data || [];
    if (LIMIT) recipients = recipients.slice(0, LIMIT);
  }

  if (!recipients.length) {
    console.log('[daily-brief] No active subscribers. Nothing to send.');
    return;
  }

  console.log(`[daily-brief] Sending to ${recipients.length} recipient(s)…`);
  let sent = 0, failed = 0;
  for (const { email } of recipients) {
    const html = buildBriefEmailHtml(nl, { siteUrl: SITE_URL, email });
    const text = buildBriefEmailText(nl, { siteUrl: SITE_URL, email });
    const r = await sendViaResend({ to: email, subject, html, text });
    if (r.success) sent++;
    else { failed++; console.warn(`[daily-brief] FAILED ${email}: ${r.error}`); }
    await new Promise((res) => setTimeout(res, 60)); // gentle rate limit
  }

  console.log(`[daily-brief] Done. sent=${sent} failed=${failed} total=${recipients.length}`);
  if (failed > 0 && sent === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[daily-brief] Fatal:', e.message);
  process.exit(1);
});
