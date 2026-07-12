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
const { verifyResendWebhook } = require('../../lib/resendWebhookVerify.js');

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
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
  }
  if (emailAddr) {
    await client.from('investors').update({ email_status: 'bounced' }).eq('email_best_guess', emailAddr);
  }
  console.log('[webhook] complaint:', msgId, emailAddr);
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
    // email.clicked → no-op for now (could log to metadata)
    // email.delivered → optional, just confirms delivery

    return res.json({ received: true, type });
  } catch (e) {
    console.error('[webhook] handler error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
