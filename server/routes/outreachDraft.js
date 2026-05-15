'use strict';
/**
 * outreachDraft.js
 *
 * Phase 1 Funding Agent — Outreach Pipeline
 *
 * POST /api/outreach/draft          — LLM drafts personalized email for one investor
 * POST /api/outreach/draft-batch    — drafts emails for up to 10 investors at once
 * GET  /api/outreach/drafts/:startup_id — list all drafts for a startup
 * GET  /api/outreach/draft/:id      — single draft detail
 * POST /api/outreach/approve        — founder approves a draft (status → approved)
 * POST /api/outreach/revise         — founder requests LLM revision with notes
 * POST /api/outreach/send           — sends approved draft via Resend
 * GET  /api/outreach/stats/:startup_id — pipeline stats (draft/sent/opened/replied)
 */

const express    = require('express');
const router     = express.Router();
const OpenAI     = require('openai');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
function openai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
function resend() {
  return new Resend(process.env.RESEND_API_KEY);
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchStartup(id) {
  const { data, error } = await sb()
    .from('startup_uploads')
    .select(`
      id, name, pitch, description, tagline, website,
      sectors, stage, raise_amount, raise_type,
      mrr, arr, revenue_annual, customer_count, growth_rate,
      total_god_score, why_now, unfair_advantage, contrarian_belief,
      founders, tam_estimate, location, team_size
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('startup fetch: ' + error.message);
  if (!data) throw new Error('startup not found: ' + id);
  return data;
}

async function fetchInvestor(id) {
  const { data, error } = await sb()
    .from('investors')
    .select(`
      id, name, firm, url, type,
      sectors, stage, check_size_min, check_size_max,
      investment_thesis, notable_investments, portfolio_companies,
      email, email_best_guess, email_candidates, email_status, email_has_mx,
      investor_tier, signals
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('investor fetch: ' + error.message);
  if (!data) throw new Error('investor not found: ' + id);
  return data;
}

// ─── Email address resolution ─────────────────────────────────────────────────

function resolveEmail(investor) {
  // Verified > best_guess > first candidate > null
  if (investor.email) return { address: investor.email, type: 'verified' };
  if (investor.email_best_guess) return { address: investor.email_best_guess, type: investor.email_status || 'inferred' };
  const cands = Array.isArray(investor.email_candidates) ? investor.email_candidates : [];
  if (cands.length > 0) return { address: cands[0].address, type: cands[0].type || 'inferred' };
  return null;
}

// ─── LLM prompt builder ───────────────────────────────────────────────────────

function buildStartupContext(s) {
  const lines = [];
  lines.push(`Company: ${s.name}`);
  if (s.website)      lines.push(`Website: ${s.website}`);
  if (s.pitch)        lines.push(`Pitch: ${s.pitch}`);
  if (s.tagline && s.tagline !== s.pitch) lines.push(`Tagline: ${s.tagline}`);
  if (s.stage)        lines.push(`Stage: ${s.stage}`);
  if (s.sectors?.length) lines.push(`Sectors: ${s.sectors.join(', ')}`);
  if (s.location)     lines.push(`Location: ${s.location}`);

  // Traction — only include what exists
  const traction = [];
  if (s.mrr)              traction.push(`$${fmtNum(s.mrr)} MRR`);
  if (s.arr)              traction.push(`$${fmtNum(s.arr)} ARR`);
  if (s.revenue_annual)   traction.push(`$${fmtNum(s.revenue_annual)} annual revenue`);
  if (s.customer_count)   traction.push(`${fmtNum(s.customer_count)} customers`);
  if (s.growth_rate)      traction.push(`${s.growth_rate}% MoM growth`);
  if (traction.length)    lines.push(`Traction: ${traction.join(', ')}`);

  if (s.raise_amount)     lines.push(`Raising: $${fmtNum(s.raise_amount)}${s.raise_type ? ' ' + s.raise_type : ''}`);
  if (s.why_now)          lines.push(`Why now: ${s.why_now}`);
  if (s.unfair_advantage) lines.push(`Unfair advantage: ${s.unfair_advantage}`);
  if (s.tam_estimate)     lines.push(`TAM estimate: ${s.tam_estimate}`);

  // Founders
  const founders = extractFounders(s.founders);
  if (founders.length) lines.push(`Founders: ${founders.join(', ')}`);

  return lines.join('\n');
}

function buildInvestorContext(inv) {
  const lines = [];
  lines.push(`Investor: ${inv.name}`);
  if (inv.firm && inv.firm !== inv.name) lines.push(`Firm: ${inv.firm}`);
  if (inv.type)  lines.push(`Type: ${inv.type}`);
  if (inv.stage?.length) lines.push(`Stage focus: ${Array.isArray(inv.stage) ? inv.stage.join(', ') : inv.stage}`);
  if (inv.sectors?.length) lines.push(`Sector focus: ${inv.sectors.slice(0,5).join(', ')}`);
  if (inv.check_size_min || inv.check_size_max) {
    const lo = inv.check_size_min ? '$' + fmtNum(inv.check_size_min) : '';
    const hi = inv.check_size_max ? '$' + fmtNum(inv.check_size_max) : '';
    lines.push(`Check size: ${[lo, hi].filter(Boolean).join('–')}`);
  }
  if (inv.investment_thesis) lines.push(`Thesis: ${inv.investment_thesis.slice(0, 300)}`);

  const portfolio = extractPortfolio(inv);
  if (portfolio.length) lines.push(`Known portfolio: ${portfolio.slice(0,6).join(', ')}`);

  return lines.join('\n');
}

function buildDraftPrompt(startup, investor, opts = {}) {
  const { founderName, revisionNotes, tone = 'direct' } = opts;
  const senderName = founderName || extractFounders(startup.founders)[0] || 'the founder';

  return {
    system: `You are an expert fundraising advisor who writes cold outreach emails for startups seeking investment.
Your emails are:
- SHORT: 4–5 sentences maximum. VCs delete long emails.
- SPECIFIC: Reference something real about the investor (their thesis, a portfolio company, a stated focus area).
- DIRECT: Open with the strongest fact about the startup. No "I hope this email finds you well."
- HONEST: Never overstate metrics. If there's no revenue yet, skip it.
- FIRST-PERSON: Written from the founder's perspective.
- CONVERSATIONAL: Friendly but professional. No buzzwords.

Output format — respond with ONLY valid JSON, no markdown:
{
  "subject": "compelling subject line (max 8 words)",
  "body": "the email body text",
  "email_to": "${resolveEmail(investor)?.address || ''}",
  "notes": "brief explanation of what angle you chose and why (1–2 sentences)"
}`,

    user: `Draft a cold outreach email from this startup to this investor.

STARTUP:
${buildStartupContext(startup)}

INVESTOR:
${buildInvestorContext(investor)}

SENDER NAME: ${senderName}
TONE: ${tone}
${revisionNotes ? `\nREVISION NOTES FROM FOUNDER:\n${revisionNotes}` : ''}

Write a personalized email that connects this specific startup's strengths to this specific investor's known focus areas and thesis. Make it feel like the founder researched this investor — not a blast template.`
  };
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function generateDraft(startup, investor, opts = {}) {
  const { system, user } = buildDraftPrompt(startup, investor, opts);
  const ai = openai();

  const completion = await ai.chat.completions.create({
    model:       'gpt-4o',
    temperature: 0.7,
    max_tokens:  600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system',  content: system },
      { role: 'user',    content: user   },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = { subject: '', body: raw, notes: '' }; }

  return {
    subject:  parsed.subject  || `${startup.name} — ${startup.stage || 'seed'} round`,
    body:     parsed.body     || raw,
    email_to: parsed.email_to || resolveEmail(investor)?.address || null,
    notes:    parsed.notes    || '',
    model:    'gpt-4o',
    tokens:   completion.usage?.total_tokens || 0,
  };
}

// ─── DB writes ────────────────────────────────────────────────────────────────

async function saveDraft(startupId, investorId, draft, emailMeta) {
  const { data, error } = await sb()
    .from('investor_outreach')
    .insert({
      startup_id:    startupId,
      investor_id:   investorId,
      outreach_email: draft.email_to || emailMeta.address || '',
      email_type:    emailMeta.type || 'inferred',
      subject:       draft.subject,
      body_preview:  draft.body.slice(0, 500),
      status:        'draft',
      metadata: {
        full_body:      draft.body,
        notes:          draft.notes,
        model:          draft.model,
        tokens:         draft.tokens,
        email_address:  draft.email_to,
        generated_at:   new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) throw new Error('save draft: ' + error.message);
  return data.id;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/outreach/draft
// Body: { startup_id, investor_id, founder_name?, tone? }
router.post('/draft', async (req, res) => {
  const { startup_id, investor_id, founder_name, tone } = req.body || {};
  if (!startup_id || !investor_id) {
    return res.status(400).json({ error: 'startup_id and investor_id required' });
  }
  try {
    const [startup, investor] = await Promise.all([
      fetchStartup(startup_id),
      fetchInvestor(investor_id),
    ]);

    const emailMeta = resolveEmail(investor);
    if (!emailMeta && !investor.email_has_mx) {
      return res.status(422).json({
        error: 'no_email_candidate',
        message: `No reachable email found for ${investor.name}. The domain ${investor.email_domain || '?'} has no MX records.`,
      });
    }

    const draft = await generateDraft(startup, investor, { founderName: founder_name, tone });
    const draftId = await saveDraft(startup_id, investor_id, draft, emailMeta || { address: '', type: 'unknown' });

    return res.json({
      id:         draftId,
      status:     'draft',
      startup:    { id: startup.id, name: startup.name },
      investor:   { id: investor.id, name: investor.name, firm: investor.firm },
      email_to:   draft.email_to,
      email_type: emailMeta?.type,
      subject:    draft.subject,
      body:       draft.body,
      notes:      draft.notes,
      tokens_used: draft.tokens,
    });
  } catch (e) {
    console.error('[outreach/draft]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/outreach/draft-batch
// Body: { startup_id, investor_ids: string[], founder_name? }
// Generates up to 10 drafts in parallel
router.post('/draft-batch', async (req, res) => {
  const { startup_id, investor_ids, founder_name, tone } = req.body || {};
  if (!startup_id || !Array.isArray(investor_ids) || investor_ids.length === 0) {
    return res.status(400).json({ error: 'startup_id and investor_ids[] required' });
  }
  const ids = investor_ids.slice(0, 10);  // hard cap at 10

  try {
    const startup = await fetchStartup(startup_id);
    const investors = await Promise.all(ids.map(id => fetchInvestor(id).catch(() => null)));
    const valid = investors.filter(Boolean);

    const results = await Promise.allSettled(
      valid.map(async investor => {
        const emailMeta = resolveEmail(investor);
        const draft = await generateDraft(startup, investor, { founderName: founder_name, tone });
        const draftId = await saveDraft(startup_id, investor.id, draft, emailMeta || { address: '', type: 'unknown' });
        return { id: draftId, investor_id: investor.id, investor_name: investor.name, email_to: draft.email_to, subject: draft.subject, status: 'draft' };
      })
    );

    const drafts = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const errors = results.filter(r => r.status === 'rejected').map((r, i) => ({ investor_id: valid[i]?.id, error: r.reason?.message }));

    return res.json({ startup_id, drafts, errors, total: drafts.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/outreach/drafts/:startup_id
router.get('/drafts/:startup_id', async (req, res) => {
  try {
    const { data, error } = await sb()
      .from('investor_outreach')
      .select(`
        id, status, outreach_email, email_type, subject, body_preview,
        sequence_step, approved_at, created_at, opened_at, replied_at,
        investors:investor_id (id, name, firm, email_best_guess, email_has_mx)
      `)
      .eq('startup_id', req.params.startup_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ startup_id: req.params.startup_id, drafts: data || [], total: (data || []).length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/outreach/draft/:id
router.get('/draft/:id', async (req, res) => {
  try {
    const { data, error } = await sb()
      .from('investor_outreach')
      .select('*, investors:investor_id(id, name, firm, email_best_guess, email_candidates)')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ error: 'draft not found' });
    const body = data.metadata?.full_body || data.body_preview;
    return res.json({ ...data, body });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/outreach/approve
// Body: { draft_id, approved_by (founder name or email) }
router.post('/approve', async (req, res) => {
  const { draft_id, approved_by } = req.body || {};
  if (!draft_id) return res.status(400).json({ error: 'draft_id required' });
  try {
    // Fetch first to verify it exists and is a draft
    const { data: existing } = await sb().from('investor_outreach').select('id,status,subject,outreach_email').eq('id', draft_id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'draft not found' });
    if (existing.status !== 'draft') return res.status(409).json({ error: `cannot approve: status is already '${existing.status}'` });

    await sb().from('investor_outreach')
      .update({ status: 'approved', approved_by: approved_by || 'founder', approved_at: new Date().toISOString() })
      .eq('id', draft_id);

    return res.json({ ok: true, draft_id, status: 'approved', subject: existing.subject, email_to: existing.outreach_email });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/outreach/revise
// Body: { draft_id, notes (founder instructions for revision) }
router.post('/revise', async (req, res) => {
  const { draft_id, notes } = req.body || {};
  if (!draft_id || !notes) return res.status(400).json({ error: 'draft_id and notes required' });
  try {
    const { data: outreach, error: fetchErr } = await sb()
      .from('investor_outreach')
      .select('*, investors:investor_id(id, name, firm, investment_thesis, sectors, stage, email, email_best_guess, email_candidates, email_has_mx)')
      .eq('id', draft_id)
      .single();
    if (fetchErr || !outreach) return res.status(404).json({ error: 'draft not found' });

    const startup = await fetchStartup(outreach.startup_id);
    const investor = outreach.investors;
    const emailMeta = resolveEmail(investor);

    const draft = await generateDraft(startup, investor, { revisionNotes: notes });

    // Save new revision (keep old one, create fresh draft)
    const newId = await saveDraft(outreach.startup_id, outreach.investor_id, draft, emailMeta || { address: '', type: 'unknown' });

    // Mark old draft as superseded
    await sb().from('investor_outreach').update({ status: 'superseded', notes: `Revised: ${notes}` }).eq('id', draft_id);

    return res.json({ id: newId, status: 'draft', subject: draft.subject, body: draft.body, email_to: draft.email_to, notes: draft.notes });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/outreach/send
// Body: { draft_id, from_email, from_name }
// Sends the approved draft via Resend and marks it sent.
router.post('/send', async (req, res) => {
  const { draft_id, from_email, from_name } = req.body || {};
  if (!draft_id) return res.status(400).json({ error: 'draft_id required' });

  const senderEmail = from_email || process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  const senderName  = from_name  || process.env.OUTREACH_FROM_NAME  || 'Pythh Outreach';

  if (!senderEmail) {
    return res.status(422).json({ error: 'from_email required (or set OUTREACH_FROM_EMAIL env var)' });
  }

  try {
    const { data: outreach, error: fetchErr } = await sb()
      .from('investor_outreach')
      .select('*')
      .eq('id', draft_id)
      .single();

    if (fetchErr || !outreach) return res.status(404).json({ error: 'draft not found' });
    if (outreach.status !== 'approved') {
      return res.status(409).json({ error: 'draft must be approved before sending', current_status: outreach.status });
    }
    if (!outreach.outreach_email) {
      return res.status(422).json({ error: 'no recipient email on this draft' });
    }

    const body = outreach.metadata?.full_body || outreach.body_preview;
    const r = resend();

    const { data: sent, error: sendErr } = await r.emails.send({
      from:    `${senderName} <${senderEmail}>`,
      to:      [outreach.outreach_email],
      subject: outreach.subject,
      text:    body,
      // Optional html version with light formatting
      html:    `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222; max-width: 600px;">${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`,
      tags: [
        { name: 'draft_id',  value: draft_id },
        { name: 'type',      value: 'investor_outreach' },
      ],
    });

    if (sendErr) throw new Error('Resend error: ' + (sendErr.message || JSON.stringify(sendErr)));

    // Mark sent in DB
    await sb().from('investor_outreach').update({
      status:            'sent',
      resend_message_id: sent?.id || null,
      metadata: {
        ...outreach.metadata,
        sent_at:    new Date().toISOString(),
        message_id: sent?.id,
        from_email: senderEmail,
        from_name:  senderName,
      },
    }).eq('id', draft_id);

    console.log(`[outreach] Sent ${draft_id} → ${outreach.outreach_email} (resend: ${sent?.id})`);

    return res.json({
      ok:         true,
      draft_id,
      status:     'sent',
      email_to:   outreach.outreach_email,
      subject:    outreach.subject,
      message_id: sent?.id,
    });
  } catch (e) {
    console.error('[outreach/send]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/outreach/stats/:startup_id
router.get('/stats/:startup_id', async (req, res) => {
  try {
    const { data, error } = await sb()
      .from('investor_outreach')
      .select('status, sequence_step, created_at')
      .eq('startup_id', req.params.startup_id);

    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];
    const stats = {
      total:     rows.length,
      draft:     rows.filter(r => r.status === 'draft').length,
      approved:  rows.filter(r => r.status === 'approved').length,
      sent:      rows.filter(r => r.status === 'sent').length,
      opened:    rows.filter(r => r.status === 'opened').length,
      replied:   rows.filter(r => r.status === 'replied').length,
      bounced:   rows.filter(r => r.status === 'bounced').length,
    };
    stats.open_rate   = stats.sent > 0 ? Math.round(stats.opened  / stats.sent * 100) : 0;
    stats.reply_rate  = stats.sent > 0 ? Math.round(stats.replied / stats.sent * 100) : 0;

    return res.json({ startup_id: req.params.startup_id, stats });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (!n) return '';
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(num);
}

function extractFounders(founders) {
  if (!founders) return [];
  if (typeof founders === 'string') {
    try { founders = JSON.parse(founders); } catch { return [founders.slice(0, 60)]; }
  }
  if (Array.isArray(founders)) {
    return founders.map(f => {
      if (typeof f === 'string') return f;
      return [f.name, f.title ? `(${f.title})` : ''].filter(Boolean).join(' ');
    }).filter(Boolean).slice(0, 3);
  }
  if (typeof founders === 'object' && founders.name) return [founders.name];
  return [];
}

function extractPortfolio(investor) {
  const p = investor.portfolio_companies || investor.notable_investments;
  if (!p) return [];
  if (Array.isArray(p)) return p.map(x => typeof x === 'string' ? x : x.name).filter(Boolean);
  if (typeof p === 'string') return p.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return [];
}

module.exports = router;
