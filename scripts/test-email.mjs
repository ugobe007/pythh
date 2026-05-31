#!/usr/bin/env node
/**
 * Send a one-line test email to verify GoDaddy SMTP or Resend.
 *
 *   node scripts/test-email.mjs
 *   node scripts/test-email.mjs you@pythh.ai
 */
import 'dotenv/config';
import nodemailer from 'nodemailer';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const to = args[0] || process.env.PORTFOLIO_DIGEST_EMAIL || process.env.ADMIN_EMAIL;
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM = process.env.SMTP_FROM || SMTP_USER || 'bob@pythh.ai';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const TRY_RESEND = process.argv.includes('--try-resend');

async function detectSmtpHint() {
  try {
    const res = await fetch('https://dns.google/resolve?name=pythh.ai&type=MX');
    const data = await res.json();
    const mx = (data.Answer || []).map((a) => a.data).join(' ').toLowerCase();
    if (mx.includes('outlook.com') || mx.includes('protection.outlook')) {
      return {
        host: 'smtp.office365.com',
        port: 587,
        note: 'pythh.ai MX points to Microsoft 365 — use smtp.office365.com:587, not smtpout.secureserver.net',
      };
    }
    if (mx.includes('secureserver') || mx.includes('godaddy')) {
      return { host: 'smtpout.secureserver.net', port: 465, note: 'GoDaddy legacy workspace email' };
    }
  } catch { /* ignore */ }
  return null;
}

function smtpConfig(hint) {
  const host = SMTP_HOST || hint?.host || 'smtpout.secureserver.net';
  const port = SMTP_PORT || hint?.port || (host.includes('office365') ? 587 : 465);
  return { host, port, secure: port === 465 };
}

if (!to) {
  console.error('No recipient. Set PORTFOLIO_DIGEST_EMAIL in .env or pass an address:');
  console.error('  node scripts/test-email.mjs you@pythh.ai');
  process.exit(1);
}

const subject = 'Pythh email test';
const html = '<p>If you received this, outbound email is working.</p>';

async function viaSmtp(hint) {
  const { host, port, secure } = smtpConfig(hint);
  if (hint?.note && SMTP_HOST === 'smtpout.secureserver.net') {
    console.log(`ℹ️  ${hint.note}`);
  }
  console.log(`   SMTP: ${host}:${port} as ${SMTP_USER}`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const info = await transporter.sendMail({ from: FROM, to, subject, html });
  console.log(`✅ Sent via SMTP to ${to} (${info.messageId})`);
}

async function viaResend() {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${JSON.stringify(body)}`);

  const id = body.id;
  console.log(`   Resend accepted id: ${id}`);

  // API "success" ≠ inbox delivery — check status
  await new Promise((r) => setTimeout(r, 2500));
  const statusResp = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const status = await statusResp.json();
  const event = status.last_event || 'unknown';
  if (event === 'delivered' || event === 'sent') {
    console.log(`✅ Resend delivered to ${to} (${event})`);
    return;
  }
  console.log(`⚠️  Resend accepted the email but delivery status is "${event}" — check spam or Resend dashboard.`);
  if (event === 'suppressed') {
    console.log('   This address may be on Resend\'s suppression list after a prior bounce.');
    console.log('   Fix Microsoft SMTP instead, or remove the address in resend.com → Audiences.');
  }
  if (event === 'bounced') {
    console.log('   The message bounced at the recipient mail server (often wrong mailbox or DNS change).');
  }
}

console.log(`\nSending test email to ${to}…\n`);

const smtpHint = await detectSmtpHint();
if (smtpHint?.note && !SMTP_HOST) {
  console.log(`ℹ️  ${smtpHint.note}\n`);
}

if (SMTP_USER && SMTP_PASS) {
  try {
    await viaSmtp(smtpHint);
    process.exit(0);
  } catch (err) {
    console.error('❌ SMTP failed:', err.message);
    if (smtpHint?.host === 'smtp.office365.com' && SMTP_HOST === 'smtpout.secureserver.net') {
      console.error('   Your domain uses Microsoft 365. Update .env:');
      console.error('     SMTP_HOST=smtp.office365.com');
      console.error('     SMTP_PORT=587');
    }
    if (err.message.includes('SmtpClientAuthentication is disabled')) {
      console.error('\n   Microsoft 365 has SMTP disabled for your organization.');
      console.error('   Go to admin.microsoft.com → Settings → Org settings → Email');
      console.error('   Enable SMTP AUTH, or ask GoDaddy support to enable it.');
      console.error('   See: https://aka.ms/smtp_auth_disabled');
    }
    if (!TRY_RESEND && !RESEND_KEY) process.exit(1);
    if (!TRY_RESEND) {
      console.log('\nResend fallback skipped (use --try-resend only after SMTP is fixed).');
      process.exit(1);
    }
    console.log('Trying Resend…');
  }
}

if (RESEND_KEY) {
  try {
    await viaResend();
    process.exit(0);
  } catch (err) {
    console.error('❌ Resend failed:', err.message);
    process.exit(1);
  }
}

console.error('❌ No sender configured. Add to .env:');
console.error('  PORTFOLIO_DIGEST_EMAIL=bob@pythh.ai');
console.error('  SMTP_USER=bob@pythh.ai');
console.error('  SMTP_PASS=your-microsoft-365-password');
console.error('  SMTP_HOST=smtp.office365.com   # pythh.ai uses Microsoft 365, not legacy GoDaddy SMTP');
console.error('  SMTP_PORT=587');
process.exit(1);
