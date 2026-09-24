'use strict';

/**
 * pythh.ai cannot authenticate Resend → Gmail today:
 *   - root SPF is `v=spf1 include:secureserver.net -all` (no amazonses)
 *   - send.pythh.ai has no public MX/TXT
 *   - DMARC is p=quarantine
 * Resend last_event=delivered is not Gmail inbox proof. Owner confirmed
 * ugobe07@gmail.com has no brief@pythh.ai mail.
 *
 * orbital-ai.io is the verified Resend domain with working SES bounce records.
 * Set PYTHH_FROM_DNS_OK=1 only after `npm run check:email-dns` passes.
 */

const DELIVERABLE_FROM = 'Pythh Daily Brief <hello@orbital-ai.io>';
const DELIVERABLE_REPLY_TO = 'hello@orbital-ai.io';

function extractEmail(from) {
  const raw = String(from || '').trim();
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

function isPythhFrom(from) {
  return extractEmail(from).endsWith('@pythh.ai');
}

function pythhFromAllowed() {
  const flag = String(process.env.PYTHH_FROM_DNS_OK || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function resolveTransactionalFrom(preferred) {
  const configured = String(
    preferred || process.env.MATCHES_EMAIL_FROM || process.env.EMAIL_FROM || '',
  ).trim();
  if (configured && (!isPythhFrom(configured) || pythhFromAllowed())) {
    return configured;
  }
  return DELIVERABLE_FROM;
}

function resolveTransactionalReplyTo(preferred) {
  const configured = String(preferred || '').trim();
  if (configured && (!isPythhFrom(configured) || pythhFromAllowed())) {
    return configured;
  }
  return DELIVERABLE_REPLY_TO;
}

module.exports = {
  DELIVERABLE_FROM,
  DELIVERABLE_REPLY_TO,
  extractEmail,
  isPythhFrom,
  pythhFromAllowed,
  resolveTransactionalFrom,
  resolveTransactionalReplyTo,
};
