/**
 * Service account OAuth2 access tokens (no extra dependencies).
 * Used when GCP credentials are a service account JSON key file.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

const CSE_SCOPE = 'https://www.googleapis.com/auth/cse';

let cached = { token: null, expiresAt: 0 };

/**
 * @returns {string|null} path to service account JSON
 */
export function getServiceAccountPath() {
  return (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    ''
  ).trim() || null;
}

/**
 * @param {string} jsonPath
 */
export function loadServiceAccount(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key || !sa.token_uri) {
    throw new Error(`Invalid service account JSON at ${jsonPath}`);
  }
  return sa;
}

/**
 * @param {object} sa
 * @param {string[]} scopes
 */
function signJwt(sa, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: scopes.join(' '),
      aud: sa.token_uri,
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url');
  const input = `${header}.${claim}`;
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(sa.private_key, 'base64url');
  return `${input}.${sig}`;
}

/**
 * @param {string[]} [scopes]
 * @returns {Promise<string|null>}
 */
export async function getServiceAccountAccessToken(scopes = [CSE_SCOPE]) {
  const path = getServiceAccountPath();
  if (!path) return null;

  if (cached.token && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const sa = loadServiceAccount(path);
  const jwt = signJwt(sa, scopes);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Service account token exchange failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cached.token;
}
