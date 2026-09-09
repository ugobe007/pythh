'use strict';

const {
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  welcomeSubject,
  publicSiteUrl,
} = require('./newsletterEmail');
const { loadSubscriberMatches } = require('./subscriberMatches');

const EMAIL_FROM = process.env.EMAIL_FROM || 'Pythh Daily Brief <brief@pythh.ai>';

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return { success: false, error: data.message || `HTTP ${resp.status}` };
  return { success: true, id: data.id };
}

/**
 * Same-day welcome with the first shortlist. Does not rematch.
 * Skips if welcome_sent_at is already set. Missing column is non-fatal.
 */
async function sendSubscriberWelcome(supabase, { email, startupUrl, startupId } = {}) {
  if (!email) return { sent: false, reason: 'no_email' };

  let unsubscribeToken = '';
  if (supabase) {
    const existing = await supabase
      .from('newsletter_subscribers')
      .select('unsubscribe_token, welcome_sent_at, startup_url, startup_id')
      .eq('email', email)
      .maybeSingle();
    if (existing.error && /welcome_sent_at/i.test(existing.error.message || '')) {
      const retry = await supabase
        .from('newsletter_subscribers')
        .select('unsubscribe_token, startup_url, startup_id')
        .eq('email', email)
        .maybeSingle();
      unsubscribeToken = retry.data?.unsubscribe_token || '';
      startupUrl = startupUrl || retry.data?.startup_url || null;
      startupId = startupId || retry.data?.startup_id || null;
    } else if (existing.error) {
      console.warn('[newsletter] welcome lookup:', existing.error.message);
    } else {
      if (existing.data?.welcome_sent_at) return { sent: false, reason: 'already_sent' };
      unsubscribeToken = existing.data?.unsubscribe_token || '';
      startupUrl = startupUrl || existing.data?.startup_url || null;
      startupId = startupId || existing.data?.startup_id || null;
    }
  }

  let personal = null;
  if (supabase && (startupUrl || startupId)) {
    try {
      personal = await loadSubscriberMatches(supabase, { startupUrl, startupId });
    } catch (err) {
      console.warn('[newsletter] welcome matches:', err.message);
      personal = { inspectUrl: startupUrl || null, matches: [], pending: true };
    }
  }

  const siteUrl = publicSiteUrl();
  const payload = {
    to: email,
    subject: welcomeSubject(personal),
    html: buildWelcomeEmailHtml({ personal, siteUrl, unsubscribeToken }),
    text: buildWelcomeEmailText({ personal, siteUrl, unsubscribeToken }),
  };

  const result = await sendViaResend(payload);
  if (!result.success) {
    console.warn('[newsletter] welcome send:', result.error);
    return { sent: false, reason: result.error || 'send_failed', subject: payload.subject };
  }

  if (supabase) {
    const stamped = await supabase
      .from('newsletter_subscribers')
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq('email', email);
    if (stamped.error && !/welcome_sent_at/i.test(stamped.error.message || '')) {
      console.warn('[newsletter] welcome stamp:', stamped.error.message);
    }
  }

  return {
    sent: true,
    id: result.id,
    subject: payload.subject,
    matchCount: personal?.matches?.length || 0,
  };
}

module.exports = { sendSubscriberWelcome, sendViaResend };
