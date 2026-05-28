#!/usr/bin/env node
/**
 * Smoke-test Resend webhook endpoints (Svix HMAC).
 * Usage: BASE_URL=https://hot-honey.fly.dev node scripts/verify-outreach-webhooks.mjs
 */
import crypto from 'crypto';

const BASE = (process.env.BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
const SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

const ENDPOINTS = [
  { path: '/api/webhooks/webhook/resend', label: 'prospecting log' },
  { path: '/api/webhooks/resend', label: 'prospecting log (alias)' },
  { path: '/api/outreach/webhook', label: 'investor outreach' },
];

function sign(body, secret) {
  const raw = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const id = `msg_verify_${Date.now()}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', raw).update(`${id}.${ts}.${body}`).digest('base64');
  return { id, ts, sig: `v1,${sig}` };
}

async function probe(path, label) {
  const payload = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: { email_id: 'verify-smoke-test', to: ['verify@example.com'] },
  });

  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) {
    const { id, ts, sig } = sign(payload, SECRET);
    headers['svix-id'] = id;
    headers['svix-timestamp'] = ts;
    headers['svix-signature'] = sig;
  }

  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 120) }; }

  const ok = res.status >= 200 && res.status < 300;
  console.log(`${ok ? '✓' : '✗'} ${path} (${label}) → ${res.status}`, json);
  return ok;
}

console.log(`Verifying outreach webhooks at ${BASE}${SECRET ? '' : ' (unsigned — set RESEND_WEBHOOK_SECRET)'}\n`);

let passed = 0;
for (const ep of ENDPOINTS) {
  if (await probe(ep.path, ep.label)) passed++;
}

console.log(`\n${passed}/${ENDPOINTS.length} endpoints OK`);
process.exit(passed === ENDPOINTS.length ? 0 : 1);
