#!/usr/bin/env node
/**
 * Peter — founder outreach with thesis-fit investor matches.
 *
 * 1. Score startups against investor universe (same 6-component model as outreach-agent)
 * 2. Find founder email via Hunter.io (personal only — no info@)
 * 3. Validate deliverability via ZeroBounce (when ZEROBOUNCE_API_KEY is set)
 * 4. Send detailed match dossier via Resend (Peter / pythia@pythh.ai)
 *
 * Usage:
 *   node scripts/peter-founder-outreach.mjs --dry-run --limit=5
 *   node scripts/peter-founder-outreach.mjs --limit=20
 *   node scripts/peter-founder-outreach.mjs --limit=20 --scan=400
 *   node scripts/peter-founder-outreach.mjs --min-god=65 --min-match=45
 *   node scripts/peter-founder-outreach.mjs --startup-id=<uuid> --dry-run
 */

import { config } from 'dotenv';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
import { resolveFounderContact } from '../lib/resolveFounderContact.mjs';
import { hasHunterIo } from '../lib/hunterIo.mjs';
import { hasZeroBounce } from '../lib/zeroBounce.mjs';
import { getOutreachFromAddress } from '../lib/outreachFrom.js';
import { loadOutreachBlockedStartups, isOutreachBlocked } from '../lib/portfolioOutreachGate.mjs';

config();

const require = createRequire(import.meta.url);
const { rankInvestorsForStartup } = require('../lib/outreachMatch.js');
const { isValidStartupName } = require('../lib/startupNameValidator');
const {
  defaultMatchReason,
  founderSubject,
  founderHeadline,
  founderOpening,
  founderOpeningText,
  founderAlignmentTagline,
  founderTableLabel,
  founderScoreLabel,
  founderScoreCaption,
  founderFootnote,
  founderCtaTitle,
  founderCtaBody,
  founderCtaPrimaryUrl,
  founderCtaText,
  founderEmailKicker,
  founderEmailSignoff,
} = require('../lib/pythiaVoice.js');
const {
  contactOutreachGreeting,
  isBlockedOutreachEmail,
} = require('../lib/investorEmailInfer.js');

const argv = process.argv.slice(2);
const flag = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};
const has = (name) => argv.some((a) => a === name || a.startsWith(`${name}=`));

const LIMIT = parseInt(flag('--limit') ?? '20', 10);
const SCAN = parseInt(flag('--scan') ?? String(Math.max(LIMIT * 15, 200)), 10);
const MIN_GOD = parseInt(flag('--min-god') ?? '55', 10);
const MIN_MATCH = parseInt(flag('--min-match') ?? '40', 10);
const DRY_RUN = has('--dry-run');
const DRAFT_ONLY = has('--draft-only');
const TEST_TO = flag('--test-to');
const STARTUP_ID = flag('--startup-id');
const CAMPAIGN = flag('--campaign') ?? `peter-founder-${new Date().toISOString().slice(0, 7)}`;
const DELAY_MS = parseInt(flag('--delay') ?? '2000', 10);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = TEST_TO
  ? (process.env.OUTREACH_TEST_FROM || 'onboarding@resend.dev')
  : getOutreachFromAddress();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!hasHunterIo()) {
  console.error('Missing HUNTER_API_KEY — add to .env');
  process.exit(1);
}
if (!DRY_RUN && !DRAFT_ONLY && !RESEND_KEY) {
  console.error('Missing RESEND_API_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const INVESTOR_SELECT =
  'id, name, firm, sectors, stage, check_size_min, check_size_max, investor_score, investor_tier, notable_investments, signals, investment_thesis';
const STARTUP_SELECT =
  'id, name, website, company_website, sectors, total_god_score, stage, tagline, submitted_email, extracted_data';

function scoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#a78bfa';
  if (score >= 50) return '#f59e0b';
  return '#64748b';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadInvestorPool() {
  const { data, error } = await db
    .from('investors')
    .select(INVESTOR_SELECT)
    .neq('entity_gate', 'junk')
    .neq('status', 'inactive')
    .order('investor_score', { ascending: false, nullsFirst: false })
    .limit(1200);
  if (error) throw error;
  return data ?? [];
}

async function alreadyContacted(email) {
  if (DRY_RUN) return false;
  const { data } = await db
    .from('pythh_prospecting_log')
    .select('id')
    .eq('email', email)
    .eq('email_type', 'startup_matches')
    .eq('campaign_slug', CAMPAIGN)
    .in('status', ['sent', 'draft'])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function alreadyContactedStartup(startupId) {
  if (DRY_RUN) return false;
  const { data } = await db
    .from('pythh_prospecting_log')
    .select('id')
    .eq('target_id', String(startupId))
    .eq('email_type', 'startup_matches')
    .eq('campaign_slug', CAMPAIGN)
    .in('status', ['sent', 'draft'])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logSent({ email, startup, subject, html, text, resendId, contact }) {
  if (DRY_RUN) return;
  await db.from('pythh_prospecting_log').insert({
    email,
    actual_recipient: TEST_TO || email,
    email_type: 'startup_matches',
    target_id: String(startup.id),
    target_name: startup.name,
    subject,
    html_body: html,
    text_body: text,
    resend_message_id: resendId,
    campaign_slug: CAMPAIGN,
    status: DRAFT_ONLY ? 'draft' : 'sent',
    sent_at: new Date().toISOString(),
    notes: JSON.stringify({
      contact_source: contact.source,
      hunter_confidence: contact.hunterConfidence,
      position: contact.position,
    }).slice(0, 500),
  });
}

async function sendResend({ to, subject, html, text }) {
  const recipient = TEST_TO || to;
  if (DRY_RUN) {
    console.log(`    [dry-run] → ${recipient}`);
    return { ok: true, id: null, recipient };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [recipient],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: JSON.stringify(data).slice(0, 300) };
  }
  return { ok: true, id: data.id, recipient };
}

function buildEmail(startup, matches, contact) {
  const startupName = (startup.name || startup.website || 'your startup').trim();
  const greeting = contactOutreachGreeting({
    email: contact.email,
    entityName: startupName,
    personName: contact.personName || startup.extracted_data?.founders?.[0]?.name,
  });
  const subject = founderSubject({ startupName, count: matches.length });
  const html = buildStartupHtml({ startup, matches, greeting, startupName });
  const text = buildStartupText({ startup, matches, greeting, startupName });
  return { subject, html, text, startupName };
}

function buildStartupHtml({ startup, matches, greeting, startupName }) {
  const godScore = startup.total_god_score ?? 0;
  const color = scoreColor(godScore);
  const opening = founderOpening({ greeting, startupName, count: matches.length });
  const headline = founderHeadline({ startupName, count: matches.length });
  const encodedUrl = startup.website ? encodeURIComponent(startup.website) : '';
  const activateUrl = founderCtaPrimaryUrl(encodedUrl);

  const rows = matches.map((m, i) => {
    const score = m.match_score ?? 0;
    const col = scoreColor(score);
    const bg = i % 2 === 0 ? '#0f172a' : '#0d1424';
    const checkRange = m.check_size_min
      ? ` · $${Math.round(m.check_size_min / 1000)}K–$${Math.round((m.check_size_max ?? m.check_size_min * 5) / 1000)}K`
      : '';
    const thesis = m.investment_thesis
      ? `<div style="font-size:11px;color:#334155;margin-top:6px;line-height:1.45;font-style:italic;">${String(m.investment_thesis).slice(0, 140)}…</div>`
      : '';

    return `<tr style="background:${bg};">
      <td style="padding:14px 16px;border-bottom:1px solid #1e293b;vertical-align:top;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="52" style="vertical-align:top;">
            <div style="background:#1e293b;color:${col};font-weight:700;font-size:17px;width:44px;height:44px;border-radius:8px;text-align:center;line-height:44px;font-family:monospace;">${score}</div>
          </td>
          <td style="vertical-align:top;padding-left:12px;">
            <div style="font-weight:600;color:#f1f5f9;font-size:14px;">${m.name ?? 'Investor'}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${m.firm ?? ''}${m.stage ? ' · ' + m.stage : ''}${checkRange}</div>
            <div style="font-size:12px;color:#475569;margin-top:4px;line-height:1.5;">${m.match_reason ?? defaultMatchReason()}</div>
            ${thesis}
          </td>
        </tr></table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><body style="margin:0;background:#0b0f1a;font-family:system-ui,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#22c55e;font-family:monospace;margin-bottom:6px;">${founderEmailKicker()}</div>
  <p style="color:#94a3b8;font-size:13px;font-style:italic;">${founderAlignmentTagline()}</p>
  <h1 style="color:#f1f5f9;font-size:22px;">${headline} for ${startupName}.</h1>
  <p style="color:#64748b;font-size:14px;line-height:1.65;">${opening}</p>
  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:12px 16px;margin:20px 0;">
    <span style="font-size:11px;color:#475569;">${founderScoreLabel()}</span>
    <span style="color:${color};font-weight:700;font-size:20px;font-family:monospace;margin-left:8px;">${godScore}</span>
    <span style="font-size:11px;color:#334155;margin-left:8px;">${founderScoreCaption(godScore)}</span>
  </div>
  <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#334155;margin-bottom:8px;">${founderTableLabel()}</div>
  <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  <p style="color:#475569;font-size:12px;margin-top:16px;font-style:italic;">${founderFootnote()}</p>
  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px;text-align:center;margin-top:24px;">
    <div style="font-size:13px;font-weight:700;color:#c4b5fd;margin-bottom:8px;">${founderCtaTitle()}</div>
    <p style="color:#64748b;font-size:13px;">${founderCtaBody()}</p>
    <a href="${activateUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">${founderCtaText().split('\n')[0]}</a>
  </div>
  <p style="color:#334155;font-size:11px;text-align:center;margin-top:24px;">${founderEmailSignoff()}</p>
</div></body></html>`;
}

function buildStartupText({ startup, matches, greeting, startupName }) {
  const opening = founderOpeningText({ greeting, startupName, count: matches.length });
  const rows = matches.map((m, i) => {
    const reason = m.match_reason ? m.match_reason.split('.')[0] : defaultMatchReason();
    return `  ${i + 1}. ${m.name} (${m.firm}) — match ${m.match_score}\n     ${reason}`;
  }).join('\n');
  return `${founderHeadline({ startupName, count: matches.length })}\n\n${opening}\n\n${rows}\n\n${founderCtaText()}\n\n${founderEmailSignoff()}`;
}

async function main() {
  console.log('\n📬 Peter — founder match outreach (Hunter.io + ZeroBounce)');
  console.log(`   campaign: ${CAMPAIGN} · limit ${LIMIT} · scan ${SCAN} · min GOD ${MIN_GOD} · min match ${MIN_MATCH}`);
  console.log(`   mode: ${DRY_RUN ? 'dry-run' : DRAFT_ONLY ? 'draft-only' : 'SEND'} · from ${FROM}`);
  console.log(`   validation: ${hasZeroBounce() ? 'ZeroBounce on (valid only)' : 'ZeroBounce off — set ZEROBOUNCE_API_KEY'}`);
  if (TEST_TO) console.log(`   ⚠️  TEST MODE — all mail → ${TEST_TO}\n`);
  else console.log('');

  const investorPool = await loadInvestorPool();
  console.log(`   investor pool: ${investorPool.length}`);

  const { blockedIds, reasons } = await loadOutreachBlockedStartups(db);
  if (blockedIds.size) console.log(`   portfolio blocklist: ${blockedIds.size} startups\n`);
  else console.log('');

  let query = db
    .from('startup_uploads')
    .select(STARTUP_SELECT)
    .eq('status', 'approved')
    .neq('entity_gate', 'junk')
    .gte('total_god_score', MIN_GOD)
    .not('website', 'is', null)
    .neq('website', '')
    .order('total_god_score', { ascending: false });

  if (STARTUP_ID) query = query.eq('id', STARTUP_ID);
  else query = query.limit(SCAN);

  const { data: startups, error } = await query;
  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }

  let sent = 0;
  let skipped = 0;

  for (const startup of startups ?? []) {
    if (!STARTUP_ID && sent >= LIMIT) break;

    process.stdout.write(`→ ${startup.name} (GOD ${startup.total_god_score}) `);

    if (isOutreachBlocked(startup.id, blockedIds)) {
      console.log(`⏭ portfolio gate (${reasons.get(startup.id)?.slice(0, 50) || 'blocked'})`);
      skipped++;
      continue;
    }

    const nameCheck = isValidStartupName(startup.name);
    if (!nameCheck.isValid) {
      console.log(`⏭ junk name (${nameCheck.reason})`);
      skipped++;
      continue;
    }

    if (!TEST_TO && await alreadyContactedStartup(startup.id)) {
      console.log(`⏭ startup already contacted`);
      skipped++;
      continue;
    }

    const contact = await resolveFounderContact(startup, { useHunter: true });
    if (contact?.rejected) {
      const who = contact.email ? ` (${contact.email})` : '';
      console.log(`⏭ ${contact.reason}${who}`);
      skipped++;
      await sleep(300);
      continue;
    }
    if (!contact?.email || contact.emailType !== 'personal') {
      console.log(`⏭ no personal email (Hunter/submitted)`);
      skipped++;
      await sleep(300);
      continue;
    }
    if (isBlockedOutreachEmail(contact.email)) {
      console.log(`⏭ blocked ${contact.email}`);
      skipped++;
      continue;
    }
    if (!TEST_TO && await alreadyContacted(contact.email)) {
      console.log(`⏭ already contacted`);
      skipped++;
      continue;
    }

    const ranked = rankInvestorsForStartup(startup, investorPool, {
      limit: 8,
      minScore: MIN_MATCH,
    });
    if (ranked.length < 3) {
      console.log(`⏭ only ${ranked.length} matches`);
      skipped++;
      continue;
    }

    const { subject, html, text, startupName } = buildEmail(startup, ranked, contact);
    const zbTag = contact.zeroBounceStatus ? `, zb:${contact.zeroBounceStatus}` : '';
    console.log(`\n   ${contact.email} (${contact.source}${zbTag}, ${ranked.length} matches)`);
    if (DRY_RUN) {
      console.log(`   subject: ${subject}`);
      sent++;
      await sleep(DELAY_MS);
      continue;
    }

    const result = await sendResend({ to: contact.email, subject, html, text });
    if (!result.ok) {
      console.log(`   ✗ send failed: ${result.error}`);
      skipped++;
      continue;
    }

    await logSent({
      email: contact.email,
      startup: { ...startup, name: startupName },
      subject,
      html,
      text,
      resendId: result.id,
      contact,
    });
    sent++;
    console.log(`   ✓ sent (${sent}/${LIMIT})`);
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done — sent ${sent} · skipped ${skipped}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
