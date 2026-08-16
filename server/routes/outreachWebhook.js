'use strict';
/**
 * outreachWebhook.js
 *
 * Handles Resend webhook events for investor outreach tracking:
 *   email.opened  → status='opened', opened_at=now
 *   email.clicked → record click (inside opened)
 *   email.bounced → status='bounced', bounced_at=now, flag investor domain
 *   email.complained → unsubscribed
 *
 * Mount at: POST /api/outreach/webhook
 * Configure in Resend dashboard → Webhooks → this URL
 *
 * Resend docs: https://resend.com/docs/dashboard/webhooks/introduction
 */

const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { verifyResendWebhook } = require('../../lib/resendWebhookVerify.js');

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleOpened(event, client) {
  const msgId = event.data?.email_id || event.data?.message_id;
  if (!msgId) return;

  const openedAt = new Date(event.created_at || Date.now()).toISOString();

  const { error: outreachErr } = await client
    .from('investor_outreach')
    .update({ status: 'opened', opened_at: openedAt })
    .eq('resend_message_id', msgId)
    .eq('status', 'sent');

  if (outreachErr) console.warn('[webhook] investor_outreach opened:', outreachErr.message);

  const { error: logErr } = await client
    .from('pythh_prospecting_log')
    .update({ opened_at: openedAt })
    .eq('resend_message_id', msgId);

  if (logErr) console.warn('[webhook] prospecting_log opened:', logErr.message);
  else console.log('[webhook] opened:', msgId);
}

async function handleClicked(event, client) {
  const msgId = event.data?.email_id || event.data?.message_id;
  if (!msgId) return;
  const clickedAt = new Date(event.created_at || Date.now()).toISOString();
  await client.from('pythh_prospecting_log').update({ clicked_at: clickedAt }).eq('resend_message_id', msgId);
}

async function handleBounced(event, client) {
  const msgId      = event.data?.email_id || event.data?.message_id;
  const bouncedTo  = event.data?.to?.[0];
  if (!msgId) return;

  const bouncedAt = new Date(event.created_at || Date.now()).toISOString();

  await client
    .from('investor_outreach')
    .update({
      status:     'bounced',
      bounced_at: bouncedAt,
      notes:      `Bounced: ${event.data?.bounce_type || 'unknown'} — ${event.data?.bounce_message || ''}`.slice(0, 200),
    })
    .eq('resend_message_id', msgId);

  await client
    .from('pythh_prospecting_log')
    .update({ bounced_at: bouncedAt, status: 'bounced' })
    .eq('resend_message_id', msgId);

  // Downgrade investor email_status to 'bounced' so future inference skips it
  if (bouncedTo) {
    await client
      .from('investors')
      .update({ email_status: 'bounced' })
      .eq('email_best_guess', bouncedTo);
  }

  console.log('[webhook] bounced:', msgId, bouncedTo);
}

async function handleComplained(event, client) {
  const msgId     = event.data?.email_id || event.data?.message_id;
  const emailAddr = event.data?.to?.[0];

  if (msgId) {
    await client.from('investor_outreach').update({ status: 'unsubscribed' }).eq('resend_message_id', msgId);
    await client
      .from('pythh_prospecting_log')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('resend_message_id', msgId);
  }
  if (emailAddr) {
    await client.from('investors').update({ email_status: 'bounced' }).eq('email_best_guess', emailAddr);
    await client.from('email_unsubscribes').upsert({
      email: String(emailAddr).trim().toLowerCase(),
      reason: 'resend_complaint',
      unsubscribed_at: new Date().toISOString(),
    }, { onConflict: 'email' });
  }
  console.log('[webhook] complaint:', msgId, emailAddr);
}

function inboundReplyReference(event) {
  const data = event?.data || {};
  const headers = data.headers || {};
  const referenced = headers['in-reply-to'] || headers['In-Reply-To'] || data.in_reply_to;
  const normalizedReference = String(referenced || '').trim().replace(/^<|>$/g, '');
  const inboundId = String(data.email_id || data.message_id || '').trim();
  const recipients = Array.isArray(data.to) ? data.to : [data.to].filter(Boolean);
  const aliasId = recipients
    .map((value) => String(value).match(/reply\+(\d+)@/i)?.[1])
    .find(Boolean);
  return { inboundId, normalizedReference, outreachEmailId: aliasId ? Number(aliasId) : null };
}

async function handleReceived(event, client) {
  const { inboundId, normalizedReference, outreachEmailId } = inboundReplyReference(event);
  if (!inboundId) return { matched: false };

  let query = client
    .from('pythh_outreach_emails')
    .select('id, user_id, run_id, investor_name, investor_firm, resend_message_id');
  query = outreachEmailId
    ? query.eq('id', outreachEmailId)
    : query.eq('resend_message_id', normalizedReference || '__missing_reference__');
  const { data: email, error } = await query.maybeSingle();
  if (error) throw error;
  if (!email) {
    console.warn('[webhook] inbound reply could not be attributed:', inboundId);
    return { matched: false };
  }

  const occurredAt = new Date(event.created_at || Date.now()).toISOString();
  const idempotencyKey = `resend:reply_received:${inboundId}`;
  const { error: outcomeError } = await client.from('pythh_fundraising_outcomes').upsert({
    user_id: email.user_id,
    run_id: email.run_id,
    outreach_email_id: email.id,
    event_type: 'reply_received',
    source: 'resend',
    verified: 1,
    idempotency_key: idempotencyKey,
    occurred_at: occurredAt,
    metadata: {
      inbound_email_id: inboundId,
      investor_name: email.investor_name,
      investor_firm: email.investor_firm,
      attribution: outreachEmailId ? 'reply_alias' : 'in_reply_to',
    },
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  if (outcomeError) throw outcomeError;

  await client.from('pythh_outreach_emails').update({ status: 'replied' }).eq('id', email.id);
  console.log('[webhook] verified reply recorded:', inboundId, email.id);
  return { matched: true, outreachEmailId: email.id };
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const verified = verifyResendWebhook(req, process.env.RESEND_WEBHOOK_SECRET);
  if (!verified.ok) {
    console.warn('[webhook] signature mismatch — rejected:', verified.error);
    return res.status(verified.status || 401).json({ error: verified.error });
  }

  const event  = verified.event;
  const type   = event?.type || '';
  const client = sb();

  console.log('[webhook] received:', type, event?.data?.email_id || '');

  try {
    if (type === 'email.opened')    await handleOpened(event, client);
    if (type === 'email.clicked')   await handleClicked(event, client);
    if (type === 'email.bounced')   await handleBounced(event, client);
    if (type === 'email.complained') await handleComplained(event, client);
    if (type === 'email.received') await handleReceived(event, client);
    // email.clicked → no-op for now (could log to metadata)
    // email.delivered → optional, just confirms delivery

    return res.json({ received: true, type });
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

router.post('/calendar/webhook', express.json(), async (req, res) => {
  if (!secureEqual(req.get('x-pythh-calendar-secret'), process.env.PYTHH_CALENDAR_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'invalid_calendar_signature' });
  }
  const meetingId = Number(req.body?.meeting_id);
  const providerEventId = String(req.body?.provider_event_id || '').trim();
  const confirmedTime = Number(req.body?.confirmed_time_ms);
  if (!Number.isInteger(meetingId) || meetingId <= 0 || providerEventId.length < 8 || !Number.isFinite(confirmedTime)) {
    return res.status(400).json({ error: 'meeting_id, provider_event_id, and confirmed_time_ms are required' });
  }

  const client = sb();
  try {
    const { data: meeting, error } = await client
      .from('pythh_meetings')
      .select('id, user_id, run_id, outreach_email_id, investor_name, investor_firm')
      .eq('id', meetingId)
      .maybeSingle();
    if (error) throw error;
    if (!meeting) return res.status(404).json({ error: 'meeting_not_found' });

    await client.from('pythh_meetings').update({
      status: 'confirmed',
      confirmed_time: confirmedTime,
    }).eq('id', meeting.id);

    const { error: outcomeError } = await client.from('pythh_fundraising_outcomes').upsert({
      user_id: meeting.user_id,
      run_id: meeting.run_id,
      outreach_email_id: meeting.outreach_email_id,
      meeting_id: meeting.id,
      event_type: 'meeting_confirmed',
      source: 'calendar',
      verified: 1,
      idempotency_key: `calendar:meeting_confirmed:${providerEventId}`,
      occurred_at: new Date(confirmedTime).toISOString(),
      metadata: {
        provider_event_id: providerEventId,
        investor_name: meeting.investor_name,
        investor_firm: meeting.investor_firm,
      },
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (outcomeError) throw outcomeError;
    return res.json({ received: true, meeting_id: meeting.id, verified: true });
  } catch (error) {
    console.error('[calendar-webhook] handler error:', error.message);
    return res.status(500).json({ error: 'calendar_outcome_recording_failed' });
  }
});

module.exports = router;
module.exports.inboundReplyReference = inboundReplyReference;
module.exports.handleReceived = handleReceived;
module.exports.secureEqual = secureEqual;
