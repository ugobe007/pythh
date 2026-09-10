'use strict';

/**
 * Founder lead unlock + Pythh-relayed email.
 * Investor addresses stay on the server — responses never include them.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { getAuthedUserFromRequest } = require('../lib/pythhSession');
const { getOutreachFromAddress } = require('../../lib/outreachFrom');
const { investorHasContact, resolveInvestorEmail } = require('../../lib/recentInvestorDeals');

const router = express.Router();
const DAILY_EMAIL_CAP = 8;

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

function publicUnlockPayload({ investorId, contactable, unlocked = true }) {
  return {
    ok: true,
    unlocked: Boolean(unlocked),
    investor_id: investorId,
    contactable: Boolean(contactable),
  };
}

async function requireUser(req, res) {
  const user = await getAuthedUserFromRequest(req);
  if (!user?.id) {
    res.status(401).json({ error: 'sign_in_required', message: 'Sign in to unlock and email through Pythh.' });
    return null;
  }
  return user;
}

async function loadInvestor(client, investorId) {
  const { data, error } = await client
    .from('investors')
    .select('id, email, email_best_guess, email_candidates, email_status')
    .eq('id', investorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function isUnlocked(client, startupId, investorId) {
  const { data, error } = await client
    .from('investor_unlocks')
    .select('investor_id')
    .eq('startup_id', startupId)
    .eq('investor_id', investorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.investor_id);
}

async function recordUnlock(client, startupId, investorId) {
  const { error } = await client.from('investor_unlocks').insert({
    startup_id: startupId,
    investor_id: investorId,
    unlock_source: 'free_daily',
  });
  if (error && !String(error.message || '').includes('duplicate') && error.code !== '23505') {
    throw new Error(error.message);
  }
}

router.get('/unlocks', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const startupId = String(req.query.startup_id || '');
  if (!isUuid(startupId)) return res.status(400).json({ error: 'startup_id required' });

  try {
    const { data, error } = await sb()
      .from('investor_unlocks')
      .select('investor_id')
      .eq('startup_id', startupId);
    if (error) throw new Error(error.message);
    return res.json({
      ok: true,
      startup_id: startupId,
      investor_ids: (data || []).map((row) => row.investor_id).filter(Boolean),
    });
  } catch (err) {
    console.error('[match-leads] unlocks', err.message);
    return res.status(500).json({ error: 'Could not load unlocks' });
  }
});

router.post('/unlock', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const startupId = String(req.body?.startup_id || '');
  const investorId = String(req.body?.investor_id || '');
  if (!isUuid(startupId) || !isUuid(investorId)) {
    return res.status(400).json({ error: 'startup_id and investor_id required' });
  }

  try {
    const client = sb();
    const investor = await loadInvestor(client, investorId);
    if (!investor) return res.status(404).json({ error: 'investor not found' });
    await recordUnlock(client, startupId, investorId);
    return res.json(
      publicUnlockPayload({
        investorId,
        contactable: investorHasContact(investor),
      }),
    );
  } catch (err) {
    console.error('[match-leads] unlock', err.message);
    return res.status(500).json({ error: 'Could not unlock investor' });
  }
});

router.post('/email', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const startupId = String(req.body?.startup_id || '');
  const investorId = String(req.body?.investor_id || '');
  const subject = String(req.body?.subject || '').trim().slice(0, 200);
  const body = String(req.body?.body || '').trim().slice(0, 4000);
  if (!isUuid(startupId) || !isUuid(investorId)) {
    return res.status(400).json({ error: 'startup_id and investor_id required' });
  }
  if (subject.length < 4 || body.length < 20) {
    return res.status(400).json({ error: 'Write a subject and a short note (20+ characters).' });
  }

  const replyTo = String(user.email || req.body?.reply_to || '').trim();
  if (!replyTo.includes('@')) {
    return res.status(400).json({ error: 'Add a reply email on your account so the investor can answer you.' });
  }

  try {
    const client = sb();
    const investor = await loadInvestor(client, investorId);
    if (!investor) return res.status(404).json({ error: 'investor not found' });

    if (!(await isUnlocked(client, startupId, investorId))) {
      await recordUnlock(client, startupId, investorId);
    }

    const resolved = resolveInvestorEmail(investor);
    if (!resolved) {
      return res.status(422).json({
        ok: false,
        unlocked: true,
        contactable: false,
        error: 'No deliverable address on file yet',
      });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await client
      .from('investor_outreach')
      .select('id', { count: 'exact', head: true })
      .eq('approved_by', user.id)
      .gte('created_at', since)
      .eq('status', 'sent');
    if (countErr) throw new Error(countErr.message);
    if ((count || 0) >= DAILY_EMAIL_CAP) {
      return res.status(429).json({ error: 'Daily send limit reached. Try again tomorrow.' });
    }

    const { data: already } = await client
      .from('investor_outreach')
      .select('id, status')
      .eq('startup_id', startupId)
      .eq('investor_id', investorId)
      .eq('status', 'sent')
      .gte('created_at', since)
      .limit(1);
    if (already?.length) {
      return res.status(409).json({ error: 'Already emailed this investor through Pythh today.' });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({ error: 'Email relay is not configured yet.' });
    }

    const { data: startup } = await client
      .from('startup_uploads')
      .select('id, name')
      .eq('id', startupId)
      .maybeSingle();

    const fromAddress = getOutreachFromAddress();
    const fromName = process.env.OUTREACH_FROM_NAME || 'Pythh';
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    const founderLabel = String(user.name || replyTo).replace(/[<>]/g, '');
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;"><p>${escaped}</p><p style="color:#666;font-size:12px;margin-top:24px;">Sent through Pythh on behalf of ${founderLabel}. Reply directly to the founder.</p></div>`;

    const { data: sent, error: sendErr } = await resend.emails.send(
      {
        from: `${fromName} <${fromAddress}>`,
        to: [resolved.address],
        reply_to: replyTo,
        subject,
        text: `${body}\n\n— Sent through Pythh on behalf of ${user.name || replyTo}. Reply to the founder.`,
        html,
        tags: [
          { name: 'type', value: 'founder_lead_relay' },
          { name: 'startup_id', value: startupId },
        ],
      },
      { idempotencyKey: `lead-relay/${startupId}/${investorId}/${user.id}/${since.slice(0, 10)}` },
    );

    if (sendErr) {
      console.error('[match-leads] resend', sendErr.message || sendErr);
      return res.status(502).json({ error: 'Could not send through Pythh. Try again.' });
    }

    const { error: insertErr } = await client.from('investor_outreach').insert({
      startup_id: startupId,
      investor_id: investorId,
      outreach_email: resolved.address,
      email_type: resolved.type,
      subject,
      body_preview: body.slice(0, 500),
      resend_message_id: sent?.id || null,
      status: 'sent',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      metadata: {
        relay: true,
        founder_reply_to: replyTo,
        startup_name: startup?.name || null,
        sent_at: new Date().toISOString(),
        message_id: sent?.id || null,
      },
    });
    if (insertErr) console.error('[match-leads] outreach insert', insertErr.message);

    return res.json({
      ok: true,
      sent: true,
      unlocked: true,
      contactable: true,
      investor_id: investorId,
    });
  } catch (err) {
    console.error('[match-leads] email', err.message);
    return res.status(500).json({ error: 'Could not send through Pythh' });
  }
});

module.exports = router;
module.exports.publicUnlockPayload = publicUnlockPayload;
module.exports.DAILY_EMAIL_CAP = DAILY_EMAIL_CAP;
