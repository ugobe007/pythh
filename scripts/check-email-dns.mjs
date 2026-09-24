#!/usr/bin/env node
/**
 * Fail if pythh.ai cannot authenticate Resend → Gmail.
 * Root SPF is GoDaddy-only with -all, and send.pythh.ai must exist for SES.
 */
import { resolveMx, resolveTxt } from 'node:dns/promises';

function flattenTxt(records) {
  return (records || []).map((parts) => parts.join('')).join(' ');
}

async function txt(host) {
  try {
    return flattenTxt(await resolveTxt(host));
  } catch {
    return '';
  }
}

async function mx(host) {
  try {
    return await resolveMx(host);
  } catch {
    return [];
  }
}

const errors = [];
const rootSpf = await txt('pythh.ai');
if (!/include:amazonses\.com/i.test(rootSpf) && !/include:resend/i.test(rootSpf)) {
  errors.push(
    `pythh.ai SPF is missing Amazon SES / Resend (have: ${rootSpf || '(none)'}). Gmail + DMARC p=quarantine will hide brief@.`,
  );
}
if (/-all/.test(rootSpf) && !/include:amazonses\.com/i.test(rootSpf)) {
  errors.push('pythh.ai SPF ends in -all without include:amazonses.com — Resend fails SPF on the From domain.');
}

const sendTxt = await txt('send.pythh.ai');
const sendMx = await mx('send.pythh.ai');
if (!/include:amazonses\.com/i.test(sendTxt)) {
  errors.push(`send.pythh.ai TXT SPF is missing (have: ${sendTxt || '(none)'}). Add v=spf1 include:amazonses.com ~all`);
}
if (!sendMx.some((row) => /amazonses\.com$/i.test(row.exchange))) {
  errors.push('send.pythh.ai MX is missing feedback-smtp.us-east-1.amazonses.com');
}

const dkim = await txt('resend._domainkey.pythh.ai');
if (!/p=/.test(dkim)) {
  errors.push('resend._domainkey.pythh.ai DKIM TXT is missing');
}

if (errors.length) {
  console.error('[email-dns] pythh.ai is not deliverable to Gmail via Resend:');
  for (const line of errors) console.error(`  - ${line}`);
  console.error('GoDaddy (ns43/ns44.domaincontrol.com):');
  console.error('  MX  send  10  feedback-smtp.us-east-1.amazonses.com');
  console.error('  TXT send      v=spf1 include:amazonses.com ~all');
  console.error('  TXT @         v=spf1 include:secureserver.net include:amazonses.com -all');
  process.exit(1);
}

console.log('[email-dns] pythh.ai Resend SPF/DKIM/send records look present.');
