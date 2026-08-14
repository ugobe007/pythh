#!/usr/bin/env node
/** Peter — top-three canonical startup matches for investors. Defaults to dry-run. */

import { config } from 'dotenv';
import { createRequire } from 'module';
import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { validateEmail, hasZeroBounce } from '../lib/zeroBounce.mjs';
import { getOutreachFromAddress } from '../lib/outreachFrom.js';

config();
const require = createRequire(import.meta.url);
const { TOP_STARTUP_COUNT, uniqueTopStartups, unsubscribeUrl } = require('../lib/investorTopMatchesAgent.js');
const { classifyOutreachEmail, isBlockedOutreachEmail } = require('../lib/investorEmailInfer.js');
const { isCleanInvestorNameForFeed } = require('../server/lib/feedNameGuards.js');

const argv = process.argv.slice(2);
const flag = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
};
const has = (name) => argv.some((a) => a === name || a.startsWith(`${name}=`));

const LIMIT = Number.parseInt(flag('--limit') || '20', 10);
const SCAN = Number.parseInt(flag('--scan') || String(Math.max(LIMIT * 12, 200)), 10);
const MIN_MATCH = Number.parseInt(flag('--min-match') || '40', 10);
const SEND = has('--send');
const DRY_RUN = !SEND || has('--dry-run');
const TEST_TO = flag('--test-to');
const INVESTOR_ID = flag('--investor-id');
const PREVIEW_OUT = flag('--preview-out');
const CAMPAIGN = flag('--campaign') || `peter-investor-${new Date().toISOString().slice(0, 7)}`;
const DELAY_MS = Number.parseInt(flag('--delay') || '2000', 10);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_SECRET = process.env.EMAIL_SECRET;
const FROM = TEST_TO ? (process.env.OUTREACH_TEST_FROM || 'onboarding@resend.dev') : getOutreachFromAddress();

if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase credentials');
if (SEND && (!RESEND_KEY || !EMAIL_SECRET)) throw new Error('RESEND_API_KEY and EMAIL_SECRET are required for sending');

const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const STARTUP_SELECT = 'id, name, website, company_website, sectors, stage, tagline, total_god_score, raise_amount, status';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const firstName = (investor) => {
  const name = String(investor.name || '').trim();
  return name && !/capital|ventures|partners|fund/i.test(name) ? name.split(/\s+/)[0] : 'there';
};
const firmName = (investor) => String(investor.firm || investor.name || 'your firm').trim();
const stageLabel = (stage) => ({ '0':'Idea', '1':'Pre-Seed', '2':'Seed', '3':'Series A', '4':'Series B+' }[String(stage)] || String(stage || 'Early stage'));
const startupEvidence = (startup) => {
  const sectors = Array.isArray(startup.sectors) ? startup.sectors.slice(0, 2).join(' and ') : String(startup.sectors || 'the firm’s target sectors');
  return `${stageLabel(startup.stage)} company aligned with ${sectors}; ${startup.match_score}/100 recorded fit.`;
};

async function loadTopMatches(investorId) {
  const { data, error } = await db.from('startup_investor_matches')
    .select(`startup_id, match_score, why_you_match, reasoning, startup_uploads (${STARTUP_SELECT})`)
    .eq('investor_id', investorId).gte('match_score', MIN_MATCH)
    .order('match_score', { ascending: false }).limit(40);
  if (error) throw error;
  return uniqueTopStartups(data, TOP_STARTUP_COUNT);
}

async function suppressed(email) {
  const normalized = String(email).trim().toLowerCase();
  const [{ data: global }, { data: prior }] = await Promise.all([
    db.from('email_unsubscribes').select('email').eq('email', normalized).maybeSingle(),
    db.from('pythh_prospecting_log').select('id').eq('email', normalized).not('unsubscribed_at', 'is', null).limit(1),
  ]);
  return Boolean(global || prior?.length);
}

async function contacted(investorId, email) {
  if (DRY_RUN) return false;
  const { data } = await db.from('pythh_prospecting_log').select('id')
    .eq('email_type', 'investor_matches').eq('campaign_slug', CAMPAIGN)
    .or(`target_id.eq.${investorId},email.eq.${email}`).in('status', ['sent', 'draft']).limit(1);
  return Boolean(data?.length);
}

function buildEmail(investor, matches) {
  const firm = firmName(investor);
  const url = `https://pythh.ai/investors?utm_source=peter&utm_medium=email&utm_campaign=${encodeURIComponent(CAMPAIGN)}`;
  const unsubscribe = unsubscribeUrl(investor.email_best_guess, EMAIL_SECRET, 'https://pythh.ai');
  const opening = `Hi ${firstName(investor)}, my name is Peter with Pythh. Pythh finds and ranks startups that fit ${firm}'s investment thesis, portfolio, and timing. I found ${matches.length} strong matches for ${firm}. Review them below. We use math, not magic.`;
  const rows = matches.map((m, i) => `<tr><td style="padding:16px;border-top:1px solid #243047"><strong style="color:#f8fafc">${i + 1}. ${esc(m.name)}</strong><span style="float:right;color:#22c55e;font-family:monospace">${m.match_score} fit</span><div style="color:#94a3b8;font-size:12px;margin-top:5px">${esc([stageLabel(m.stage), ...(Array.isArray(m.sectors) ? m.sectors.slice(0, 2) : [])].filter(Boolean).join(' · '))}</div><div style="color:#64748b;font-size:12px;line-height:1.5;margin-top:7px">${esc(startupEvidence(m))}</div></td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#080d16;font-family:system-ui,sans-serif"><div style="max-width:620px;margin:auto;padding:40px 20px"><div style="color:#22c55e;font:700 11px monospace;letter-spacing:.12em">PYTHH · INVESTOR MATCHES</div><h1 style="color:#f8fafc;font-size:24px">${matches.length} startups that fit ${esc(firm)}'s thesis</h1><p style="color:#94a3b8;line-height:1.65">${esc(opening)}</p><table width="100%" cellspacing="0" style="background:#0f172a;border:1px solid #243047;border-radius:10px">${rows}</table><div style="text-align:center;margin-top:26px"><a href="${url}" style="display:inline-block;background:#22c55e;color:#03130b;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:700">Review the 3 matches</a></div><p style="color:#475569;font-size:11px;text-align:center;margin-top:24px">Peter at Pythh · We use math, not magic.</p>${unsubscribe ? `<p style="text-align:center;font-size:10px"><a style="color:#64748b" href="${unsubscribe}">Unsubscribe from investor match emails</a></p>` : ''}</div></body></html>`;
  const text = `${opening}\n\n${matches.map((m, i) => `${i + 1}. ${m.name} — ${m.match_score} fit\n${startupEvidence(m)}`).join('\n\n')}\n\nReview the 3 matches: ${url}\n\nPeter at Pythh\nWe use math, not magic.${unsubscribe ? `\n\nUnsubscribe: ${unsubscribe}` : ''}`;
  return { subject: `${matches.length} startups match ${firm}'s thesis`, html, text, unsubscribe };
}

async function sendEmail(to, bundle) {
  const recipient = TEST_TO || to;
  if (DRY_RUN) return { ok: true, id: null, recipient };
  const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${RESEND_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ from:FROM, to:[recipient], subject:bundle.subject, html:bundle.html, text:bundle.text, headers: bundle.unsubscribe ? { 'List-Unsubscribe':`<${bundle.unsubscribe}>`, 'List-Unsubscribe-Post':'List-Unsubscribe=One-Click' } : undefined }), signal:AbortSignal.timeout(30000) });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok:true, id:data.id, recipient } : { ok:false, error:JSON.stringify(data).slice(0,300), recipient };
}

async function main() {
  console.log(`\nPeter investor top-three outreach · ${DRY_RUN ? 'DRY RUN' : 'SEND'} · limit ${LIMIT}`);
  let query = db.from('investors').select('id, name, firm, email_best_guess, email_status, investor_score, status')
    .not('email_best_guess', 'is', null).eq('email_status', 'verified')
    .order('investor_score', { ascending:false, nullsFirst:false }).limit(SCAN);
  if (INVESTOR_ID) query = query.eq('id', INVESTOR_ID);
  const { data: investors, error } = await query;
  if (error) throw error;
  let sent = 0, skipped = 0, previewWritten = false;
  const seenFirms = new Set();
  for (const investor of investors || []) {
    if (sent >= LIMIT) break;
    const email = String(investor.email_best_guess || '').trim().toLowerCase();
    const firm = firmName(investor);
    const firmKey = firm.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!email || seenFirms.has(firmKey) || classifyOutreachEmail(email, investor.name) !== 'personal' || isBlockedOutreachEmail(email) || !isCleanInvestorNameForFeed(investor.name, firm)) { skipped++; continue; }
    seenFirms.add(firmKey);
    if (await suppressed(email) || await contacted(investor.id, email)) { skipped++; continue; }
    let validation = { ok:true, status: DRY_RUN ? 'dry-run-not-transmitted' : 'skipped' };
    if (!DRY_RUN && hasZeroBounce()) validation = await validateEmail(email);
    if (!validation.ok) { console.log(`→ ${firm} skipped (${validation.reason})`); skipped++; continue; }
    const matches = await loadTopMatches(investor.id);
    if (matches.length !== TOP_STARTUP_COUNT) { console.log(`→ ${firm} skipped (${matches.length} canonical matches)`); skipped++; continue; }
    const bundle = buildEmail(investor, matches);
    if (PREVIEW_OUT && !previewWritten) { await writeFile(PREVIEW_OUT, bundle.html); previewWritten = true; }
    const result = await sendEmail(email, bundle);
    if (!result.ok) { console.log(`→ ${firm} failed: ${result.error}`); continue; }
    if (!DRY_RUN) await db.from('pythh_prospecting_log').insert({ email, actual_recipient:result.recipient, email_type:'investor_matches', target_id:String(investor.id), target_name:firm, subject:bundle.subject, html_body:bundle.html, text_body:bundle.text, resend_message_id:result.id, campaign_slug:CAMPAIGN, status:'sent', sent_at:new Date().toISOString(), notes:JSON.stringify({ match_count:matches.length, validation:validation.status }) });
    sent++;
    console.log(`→ ${firm} · ${email} · ${matches.length} matches · ${DRY_RUN ? 'previewed' : 'sent'} (${sent}/${LIMIT})`);
    if (!DRY_RUN) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  console.log(`Done · ${DRY_RUN ? 'eligible' : 'sent'} ${sent} · skipped ${skipped}`);
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
