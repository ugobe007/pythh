#!/usr/bin/env node
/**
 * Daily LinkedIn / X pack for the owner.
 *   node scripts/send-promo-pack.mjs --dry
 *   node scripts/send-promo-pack.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PROMO_TO,
  loadPromoPack,
  buildPromoText,
  buildPromoHtml,
} = require('../lib/promoPostPack.js');
const { resolveTransactionalFrom } = require('../server/lib/transactionalEmailFrom.js');
const { isBlockedBriefEmail } = require('../server/lib/newsletterRecipientPolicy.js');

const dry = process.argv.includes('--dry');
const to = PROMO_TO;

async function sendViaResend({ subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: resolveTransactionalFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { success: false, error: data.message || `HTTP ${response.status}` };
  return { success: true, id: data.id };
}

async function main() {
  if (isBlockedBriefEmail(to)) {
    console.error(`blocked inbox ${to}`);
    process.exit(1);
  }
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const pack = await loadPromoPack(supabase);
  const text = buildPromoText(pack);
  const subject = `Pythh post pack — ${pack.date}`;
  console.log(text);
  console.log(`\nquotes ${pack.quotes.length} · funding ${pack.funding.length} · trending ${pack.trending.startups.length} · ${dry ? 'DRY' : 'SEND'} → ${to}`);
  if (dry) return;
  const sent = await sendViaResend({ subject, html: buildPromoHtml(pack), text });
  if (!sent.success) {
    console.error(sent.error);
    process.exit(1);
  }
  console.log(`sent ${sent.id}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
