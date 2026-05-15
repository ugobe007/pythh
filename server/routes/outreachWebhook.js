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
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ─── Signature verification ───────────────────────────────────────────────────
// Resend signs webhook payloads with HMAC-SHA256 using your webhook secret.
// Set RESEND_WEBHOOK_SECRET in your .env

function verifySignature(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // skip if not configured (dev mode)

  const signature = req.headers['svix-signature'] || req.headers['resend-signature'];
  const msgId     = req.headers['svix-id']        || req.headers['resend-message-id'];
  const timestamp = req.headers['svix-timestamp'];

  if (!signature || !timestamp) return false;

  const toSign = `${msgId}.${timestamp}.${JSON.stringify(req.body)}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(toSign)
    .digest('hex');

  // svix format: "v1,<hex>"
  const sigs = signature.split(' ');
  return sigs.some(s => {
    const hex = s.includes(',') ? s.split(',')[1] : s;
    return crypto.timingSafeEqual(Buffer.from(hex), Buffer.from(expected));
  });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleOpened(event, client) {
  const msgId = event.data?.email_id || event.data?.message_id;
  if (!msgId) return;

  const { error } = await client
    .from('investor_outreach')
    .update({
      status:    'opened',
      opened_at: new Date(event.created_at || Date.now()).toISOString(),
    })
    .eq('resend_message_id', msgId)
    .eq('status', 'sent');   // only advance if currently 'sent'

  if (error) console.warn('[webhook] opened update error:', error.message);
  else console.log('[webhook] opened:', msgId);
}

async function handleBounced(event, client) {
  const msgId      = event.data?.email_id || event.data?.message_id;
  const bouncedTo  = event.data?.to?.[0];
  if (!msgId) return;

  // Mark outreach bounced
  await client
    .from('investor_outreach')
    .update({
      status:     'bounced',
      bounced_at: new Date(event.created_at || Date.now()).toISOString(),
      notes:      `Bounced: ${event.data?.bounce_type || 'unknown'} — ${event.data?.bounce_message || ''}`.slice(0, 200),
    })
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
  }
  if (emailAddr) {
    await client.from('investors').update({ email_status: 'bounced' }).eq('email_best_guess', emailAddr);
  }
  console.log('[webhook] complaint:', msgId, emailAddr);
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Parse body for JSON routes (raw middleware gives Buffer)
  if (Buffer.isBuffer(req.body)) {
    try { req.body = JSON.parse(req.body.toString()); } catch { return res.status(400).json({ error: 'invalid json' }); }
  }
  next();
}, async (req, res) => {
  if (!verifySignature(req)) {
    console.warn('[webhook] signature mismatch — rejected');
    return res.status(401).json({ error: 'invalid signature' });
  }

  const event  = req.body;
  const type   = event?.type || '';
  const client = sb();

  console.log('[webhook] received:', type, event?.data?.email_id || '');

  try {
    if (type === 'email.opened')    await handleOpened(event, client);
    if (type === 'email.bounced')   await handleBounced(event, client);
    if (type === 'email.complained') await handleComplained(event, client);
    // email.clicked → no-op for now (could log to metadata)
    // email.delivered → optional, just confirms delivery

    return res.json({ received: true, type });
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
