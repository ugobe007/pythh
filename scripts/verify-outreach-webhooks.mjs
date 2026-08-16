#!/usr/bin/env node
/**
 * Smoke-test verified fundraising webhook boundaries.
 * Usage: BASE_URL=https://hot-honey.fly.dev node scripts/verify-outreach-webhooks.mjs
 */
import crypto from 'crypto';

const BASE = (process.env.BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
const SECRET = process.env.RESEND_WEBHOOK_SECRET || '';
const CALENDAR_SECRET = process.env.PYTHH_CALENDAR_WEBHOOK_SECRET || '';

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

async function probeResend(path, label) {
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

  const ok = SECRET
    ? res.status >= 200 && res.status < 300
    : res.status === 401 && /svix|signature/i.test(String(json.error || json.detail || ''));
  console.log(`${ok ? '✓' : '✗'} ${path} (${label}) → ${res.status}${!SECRET && ok ? ' [secured]' : ''}`, json);
  return ok;
}

async function probeCalendar() {
  const path = '/api/outreach/calendar/webhook';
  const headers = { 'Content-Type': 'application/json' };
  if (CALENDAR_SECRET) headers['x-pythh-calendar-secret'] = CALENDAR_SECRET;
  const body = JSON.stringify({
    meeting_id: 2147483647,
    provider_event_id: `smoke-calendar-${Date.now()}`,
    confirmed_time_ms: Date.now(),
  });
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 120) }; }

  // A signed request intentionally uses a nonexistent meeting. 404 proves that
  // authentication and payload validation passed without creating an outcome.
  const ok = CALENDAR_SECRET
    ? res.status === 404 && json.error === 'meeting_not_found'
    : res.status === 401 && json.error === 'invalid_calendar_signature';
  console.log(`${ok ? '✓' : '✗'} ${path} (calendar confirmation) → ${res.status}${!CALENDAR_SECRET && ok ? ' [secured]' : ''}`, json);
  return ok;
}

console.log(`Verifying fundraising webhooks at ${BASE}`);
console.log(`Resend: ${SECRET ? 'signed functional probe' : 'unsigned security-boundary probe'}`);
console.log(`Calendar: ${CALENDAR_SECRET ? 'signed non-mutating probe' : 'unsigned security-boundary probe'}\n`);

let passed = 0;
for (const ep of ENDPOINTS) {
  if (await probeResend(ep.path, ep.label)) passed++;
}
if (await probeCalendar()) passed++;

const total = ENDPOINTS.length + 1;
console.log(`\n${passed}/${total} webhook boundaries OK`);
process.exit(passed === total ? 0 : 1);
