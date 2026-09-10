'use strict';

const { normalizeUrl, extractDomain } = require('../utils/urlNormalizer');

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function normalizeStartupUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = normalizeUrl(withProto);
    return host ? `https://${host}` : withProto;
  } catch {
    return withProto;
  }
}

function isValidEmail(email) {
  return Boolean(email && email.includes('@') && email.includes('.'));
}

/**
 * Persist email + optional startup URL. Resolves an existing upload when possible.
 * Does not block on scoring / rematch.
 */
async function upsertNewsletterSubscriber(supabase, { email, url, source = 'website' }) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, status: 400, error: 'Valid email required' };
  }
  const startupUrl = normalizeStartupUrl(url);
  const row = {
    email: normalizedEmail,
    source,
    startup_url: startupUrl,
  };

  if (startupUrl && supabase) {
    try {
      const { resolveApprovedStartupUploadForUrl } = require('./resolveStartupUploadForUrl');
      const startup = await resolveApprovedStartupUploadForUrl(supabase, { inputRaw: startupUrl });
      if (startup?.id) row.startup_id = startup.id;
    } catch (err) {
      console.warn('[newsletter] resolve startup:', err.message);
    }
  }

  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert(row, { onConflict: 'email', ignoreDuplicates: false });

  if (error) {
    if (error.message?.includes('startup_url') || error.message?.includes('schema cache')) {
      const fallback = { email: normalizedEmail, source };
      const retry = await supabase
        .from('newsletter_subscribers')
        .upsert(fallback, { onConflict: 'email', ignoreDuplicates: false });
      if (retry.error) {
        if (retry.error.message?.includes('does not exist')) {
          return { ok: false, status: 503, error: 'Subscriber table not yet set up — contact admin.' };
        }
        throw retry.error;
      }
      return { ok: true, email: normalizedEmail, startup_url: startupUrl, schemaPending: true };
    }
    if (error.message?.includes('does not exist')) {
      return { ok: false, status: 503, error: 'Subscriber table not yet set up — contact admin.' };
    }
    throw error;
  }

  return {
    ok: true,
    email: normalizedEmail,
    startup_url: startupUrl,
    startup_id: row.startup_id || null,
    domain: startupUrl ? extractDomain(startupUrl) : null,
  };
}

/**
 * Score a new subscriber URL without blocking signup. Existing uploads are
 * already resolved; this only hits instant submit when we have no startup_id.
 * Does not rematch or rewrite prediction clocks.
 */
async function kickoffSubscriberUrlScore(supabase, { email, startupUrl, startupId }) {
  if (!startupUrl || startupId) return { startupId: startupId || null };
  const port = process.env.PORT || 3002;
  const base = (process.env.APP_INTERNAL_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, '');
  try {
    const resp = await fetch(`${base}/api/instant/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: startupUrl, source: 'newsletter_subscribe' }),
    });
    const data = await resp.json().catch(() => ({}));
    const id = data.startup?.id || data.startup_id || data.id || null;
    if (id && email && supabase) {
      await supabase.from('newsletter_subscribers').update({ startup_id: id }).eq('email', email);
    }
    return { startupId: id || null };
  } catch (err) {
    console.warn('[newsletter] kickoff score:', err.message);
    return { startupId: null, error: err.message };
  }
}

module.exports = {
  normalizeEmail,
  normalizeStartupUrl,
  isValidEmail,
  upsertNewsletterSubscriber,
  kickoffSubscriberUrlScore,
};
