'use strict';

/**
 * Probe Supabase social OAuth providers and refuse to send users to LinkedIn
 * (or any IdP) when the configured client_id is missing or unusable.
 *
 * LinkedIn's authorize page shows "Forwarding... Error: Invalid client_id"
 * when Supabase Auth has LinkedIn enabled with a placeholder/revoked key.
 */

const SOCIAL_OAUTH_PROVIDERS = ['google', 'github', 'linkedin_oidc'];

const PLACEHOLDER_CLIENT_IDS = new Set([
  '',
  'undefined',
  'null',
  'invalid',
  'your_client_id',
  'your-client-id',
  'client_id',
  'xxx',
  'test',
  'changeme',
  'replace_me',
]);

function normalizeClientId(clientId) {
  return String(clientId || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function isPlaceholderClientId(clientId) {
  const value = normalizeClientId(clientId);
  if (!value) return true;
  return PLACEHOLDER_CLIENT_IDS.has(value.toLowerCase());
}

/**
 * @param {'google'|'github'|'linkedin_oidc'|string} provider
 * @param {string|null|undefined} clientId
 */
function isUsableOAuthClientId(provider, clientId) {
  const value = normalizeClientId(clientId);
  if (isPlaceholderClientId(value)) return false;

  if (provider === 'google') {
    return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(value);
  }
  if (provider === 'github') {
    return /^(Ov23|Iv1)[A-Za-z0-9]{8,}$/.test(value);
  }
  if (provider === 'linkedin_oidc' || provider === 'linkedin') {
    // LinkedIn app client IDs are short alphanumeric consumer keys.
    return /^[A-Za-z0-9]{8,32}$/.test(value);
  }
  return value.length >= 8 && !/\s/.test(value);
}

function extractClientIdFromAuthorizeUrl(location) {
  if (!location) return null;
  try {
    const url = new URL(location, 'https://invalid.example');
    const fromQuery = url.searchParams.get('client_id');
    if (fromQuery) return fromQuery;
    const hash = url.hash ? new URLSearchParams(url.hash.replace(/^#/, '')) : null;
    return hash?.get('client_id') || null;
  } catch {
    const match = String(location).match(/[?&#]client_id=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

function hostFromLocation(location) {
  try {
    return new URL(location, 'https://invalid.example').hostname.toLowerCase();
  } catch {
    return '';
  }
}

function reasonForProvider(provider, { status, location, body }) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || {});
  if (status === 400 && /not enabled/i.test(text)) return 'not_enabled';
  if (status === 400 && /could not be found|unsupported provider/i.test(text)) {
    return 'not_enabled';
  }
  if (status === 0) return 'probe_failed';
  if (!location) return status >= 400 ? 'authorize_failed' : 'missing_redirect';

  const clientId = extractClientIdFromAuthorizeUrl(location);
  if (!isUsableOAuthClientId(provider, clientId)) return 'invalid_client_id';

  const host = hostFromLocation(location);
  if (provider === 'linkedin_oidc' || provider === 'linkedin') {
    if (!host.includes('linkedin.com')) return 'unexpected_idp';
  }
  if (provider === 'google' && !host.includes('google.com') && !host.includes('googleusercontent.com')) {
    return 'unexpected_idp';
  }
  if (provider === 'github' && !host.includes('github.com')) return 'unexpected_idp';
  return null;
}

function summarizeProbe(provider, probe) {
  const reason = reasonForProvider(provider, probe);
  if (reason === 'probe_failed') {
    const ready = provider !== 'linkedin_oidc' && provider !== 'linkedin';
    return { provider, enabled: true, ready, reason: 'probe_failed' };
  }
  const enabled = reason !== 'not_enabled';
  return {
    provider,
    enabled,
    ready: enabled && !reason,
    reason: reason || undefined,
  };
}

async function probeProviderAuthorize({
  supabaseUrl,
  anonKey,
  provider,
  redirectTo = 'https://pythh.ai/account',
  fetchImpl = fetch,
  timeoutMs = 8000,
}) {
  const base = String(supabaseUrl || '').replace(/\/$/, '');
  if (!base || !anonKey) {
    return { status: 503, location: null, body: 'supabase_unconfigured' };
  }

  const url = `${base}/auth/v1/authorize?${new URLSearchParams({
    provider,
    redirect_to: redirectTo,
  })}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    const location = res.headers.get('location') || res.headers.get('Location');
    let body = '';
    if (!location) {
      body = await res.text().catch(() => '');
    }
    return { status: res.status, location, body };
  } catch (err) {
    return { status: 0, location: null, body: err?.message || 'probe_failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function probeSocialOAuthProviders(opts) {
  const results = {};
  await Promise.all(
    SOCIAL_OAUTH_PROVIDERS.map(async (provider) => {
      const probe = await probeProviderAuthorize({ ...opts, provider });
      results[provider] = summarizeProbe(provider, probe);
    }),
  );
  return results;
}

function oauthClientIdErrorMessage(raw) {
  const text = String(raw || '');
  if (/invalid client_id|invalid_client/i.test(text)) {
    return 'LinkedIn sign-in is misconfigured (invalid client ID). Use Google, GitHub, or email instead.';
  }
  return text || null;
}

module.exports = {
  SOCIAL_OAUTH_PROVIDERS,
  extractClientIdFromAuthorizeUrl,
  isPlaceholderClientId,
  isUsableOAuthClientId,
  oauthClientIdErrorMessage,
  probeProviderAuthorize,
  probeSocialOAuthProviders,
  summarizeProbe,
};
