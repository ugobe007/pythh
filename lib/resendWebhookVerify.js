'use strict';

const crypto = require('crypto');

/** Raw UTF-8 body string required for Svix HMAC (not parsed JSON). */
function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return null;
}

/**
 * Verify a Resend (Svix) webhook request.
 * @returns {{ ok: true, event: object } | { ok: false, error: string, status?: number }}
 */
function verifyResendWebhook(req, secret) {
  if (!secret) {
    let event;
    try {
      const raw = getRawBody(req);
      event = raw != null ? JSON.parse(raw) : req.body;
    } catch {
      return { ok: false, error: 'Invalid JSON', status: 400 };
    }
    return { ok: true, event, skipVerification: true };
  }

  const raw = getRawBody(req);
  if (raw == null) {
    return {
      ok: false,
      error: 'Invalid signature',
      status: 401,
      detail: 'request body was parsed as JSON before verification',
    };
  }

  const sig = req.headers['svix-signature'] || '';
  const ts = req.headers['svix-timestamp'] || '';
  const id = req.headers['svix-id'] || '';

  if (!sig || !ts || !id) {
    return { ok: false, error: 'Missing Svix headers', status: 401 };
  }

  const tsNum = parseInt(ts, 10);
  if (Number.isNaN(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return { ok: false, error: 'Timestamp too old', status: 401 };
  }

  let rawSecret;
  try {
    rawSecret = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  } catch {
    return { ok: false, error: 'Invalid webhook secret format', status: 500 };
  }

  const computed = crypto
    .createHmac('sha256', rawSecret)
    .update(`${id}.${ts}.${raw}`)
    .digest('base64');

  const valid = sig.split(' ').some((part) => {
    const sigB64 = part.replace(/^v1,/, '');
    const a = Buffer.from(sigB64);
    const b = Buffer.from(computed);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  });

  if (!valid) {
    return { ok: false, error: 'Invalid signature', status: 401 };
  }

  try {
    return { ok: true, event: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'Invalid JSON', status: 400 };
  }
}

module.exports = { verifyResendWebhook, getRawBody };
