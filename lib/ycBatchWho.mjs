/**
 * Identity + title helpers for wiring a YC batch roster as "who".
 *
 * Website-host match only. Name-only matching is rejected (Jo ≠ Jo).
 * Does not stamp verified / Hit@5-ready events.
 */

export const YC_FIRM_NAME = 'Y Combinator';
export const YC_BATCH_WHO_VERSION = 'yc-batch-who-v1';
export const DEFAULT_YC_BATCH = 'Spring 2026';
export const YC_OSS_BATCH_URL = (batchSlug) =>
  `https://yc-oss.github.io/api/batches/${batchSlug}.json`;

export function batchToSlug(batch = DEFAULT_YC_BATCH) {
  return String(batch || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeHost(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function normalizeStartupName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function namesCompatible(existingName, incomingName) {
  const existing = normalizeStartupName(existingName);
  const incoming = normalizeStartupName(incomingName);
  if (!existing || !incoming) return false;
  if (existing === incoming) return true;
  if (existing.startsWith(`${incoming} `) || incoming.startsWith(`${existing} `)) return true;
  return false;
}

export function buildYcWhoTitle(startupName, batch = DEFAULT_YC_BATCH) {
  return `${startupName} is backed by Y Combinator (${batch})`;
}

export function buildYcWhoPhrase(startupName, batch = DEFAULT_YC_BATCH) {
  return `${startupName} is backed by Y Combinator (${batch})`;
}

export function buildYcWhoExcerpt(company, batch = DEFAULT_YC_BATCH) {
  const name = company?.name || 'This company';
  const oneLiner = String(company?.one_liner || '').replace(/\s+/g, ' ').trim();
  return [
    buildYcWhoPhrase(name, batch),
    oneLiner,
  ].filter(Boolean).join('. ');
}

export function sourceEventKey(batch, slug) {
  return `yc-batch:${batchToSlug(batch)}:${String(slug || '').trim().toLowerCase()}`;
}

export function decideStartupAttach({ companyHost, companyName, existing } = {}) {
  if (!companyHost) return { action: 'skip', reason: 'missing_website' };
  if (!existing) return { action: 'create' };
  const existingHost = normalizeHost(existing.website) || normalizeHost(existing.company_domain);
  if (existingHost !== companyHost) return { action: 'skip', reason: 'host_mismatch' };
  if (!namesCompatible(existing.name, companyName)) {
    return { action: 'skip', reason: 'website_taken_other_name' };
  }
  return { action: 'reuse', startupId: existing.id };
}
