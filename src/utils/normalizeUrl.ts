/**
 * URL Normalization Utility
 * Handles websites, LinkedIn, Crunchbase, App Store URLs
 *
 * CANONICAL: Use normalizeStartupUrl() for the submit workflow.
 * The RPC resolve_startup_by_url expects host-based matching.
 */

// -----------------------------------------------------------------------------
// CANONICAL: Single normalizer for submit workflow (used everywhere)
// -----------------------------------------------------------------------------

/**
 * Normalize startup URL to canonical form for DB lookup and submission.
 * Used by: submitStartup, PythhMain, SignalMatches, RPC calls.
 * Do NOT keep multiple normalizers.
 */
export function normalizeStartupUrl(input: string): string {
  let raw = (input || '').trim();
  if (!raw) return '';

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return path ? `${host}${path}` : host;
  } catch {
    return '';
  }
}

// -----------------------------------------------------------------------------
// Legacy: Rich normalization (for components that need domain/kind/etc.)
// -----------------------------------------------------------------------------

export type NormalizedUrl = {
  raw: string;
  fullUrl: string;
  hostname: string;
  domain: string;  // without www
  kind: 'website' | 'linkedin' | 'crunchbase' | 'appstore' | 'unknown';
  linkedinSlug?: string;  // company slug from LinkedIn URL
  crunchbaseSlug?: string;  // org slug from Crunchbase URL
};

export function normalizeUrl(input: string): NormalizedUrl | null {
  const raw = (input || '').trim();
  if (!raw) return null;

  // Ensure scheme so URL() can parse it
  const fullUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let u: URL;
  try {
    u = new URL(fullUrl);
  } catch {
    return null;
  }

  let hostname = u.hostname.toLowerCase();
  let domain = hostname;
  if (domain.startsWith('www.')) domain = domain.slice(4);

  // Detect URL kind and extract slugs
  let kind: NormalizedUrl['kind'] = 'website';
  let linkedinSlug: string | undefined;
  let crunchbaseSlug: string | undefined;

  if (hostname.includes('linkedin.com')) {
    kind = 'linkedin';
    const match = u.pathname.match(/\/company\/([^/]+)/i);
    if (match) linkedinSlug = match[1];
  } else if (hostname.includes('crunchbase.com')) {
    kind = 'crunchbase';
    const match = u.pathname.match(/\/organization\/([^/]+)/i);
    if (match) crunchbaseSlug = match[1];
  } else if (hostname.includes('apps.apple.com') || hostname.includes('play.google.com')) {
    kind = 'appstore';
  } else if (!hostname) {
    kind = 'unknown';
  }

  return {
    raw,
    fullUrl,
    hostname,
    domain,
    kind,
    linkedinSlug,
    crunchbaseSlug,
  };
}

/**
 * Simple domain extraction (for backward compatibility)
 */
export function normalizeUrlToDomain(input: string): string | null {
  const result = normalizeUrl(input);
  return result?.domain ?? null;
}

const SECOND_LEVEL_TLDS = new Set(['co', 'com', 'org', 'net', 'gov', 'ac']);

function getRegistrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const third = parts[parts.length - 3];
  const isCountryTld = tld.length === 2;
  if (isCountryTld && SECOND_LEVEL_TLDS.has(sld) && third) {
    return `${third}.${sld}.${tld}`;
  }
  return `${sld}.${tld}`;
}

function toTitleCaseCompany(slug: string): string {
  return slug
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Canonical startup URL details used by the submit workflow.
 * Wraps normalizeStartupUrl for consumers that need domain/companyName.
 */
export function canonicalizeStartupUrl(input: string): {
  canonicalUrl: string;
  domain: string;
  companyName: string;
} | null {
  const norm = normalizeStartupUrl(input);
  if (!norm) return null;

  const host = norm.split('/')[0] || norm;
  const domain = getRegistrableDomain(host);
  const domainLabel = domain.split('.')[0] || '';
  const companyName = toTitleCaseCompany(domainLabel) || domainLabel;

  return {
    canonicalUrl: `https://${host}/`,
    domain,
    companyName,
  };
}
