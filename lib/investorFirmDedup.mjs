/**
 * Firm-level deduplication for VC intelligence scraping and profiling.
 * Groups person-at-firm rows (e.g. "Viviana Faga (Felicis)") by resolved domain/registry.
 */

import { resolveInvestorUrls, extractDomain, normalizeFirmNameForMatch } from './investorUrlResolver.mjs';
import { resolveVcWebsiteKey } from './topVcFirms.mjs';

const VC_SUFFIX =
  /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Advisors?|Holdings?|Management|Accelerator|Studio|Combinator)\b/i;

/**
 * @param {string} [name]
 * @returns {string|null}
 */
export function extractParentheticalFirm(name) {
  const m = String(name || '').match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

/**
 * Best-effort canonical firm label for RSS/news queries (not a person name).
 * @param {{ name?: string; firm?: string; url?: string|null; blog_url?: string|null }} investor
 */
export function resolveCanonicalFirmName(investor) {
  const resolved = resolveInvestorUrls(investor);
  if (resolved.key) return resolved.key;

  const paren = extractParentheticalFirm(investor.name);
  if (paren) {
    const fromParen = resolveVcWebsiteKey(paren);
    if (fromParen) return fromParen;
    if (VC_SUFFIX.test(paren) || paren.length > 3) return paren;
  }

  const firmField = (investor.firm || '').trim();
  if (firmField) {
    const fromFirm = resolveVcWebsiteKey(firmField);
    if (fromFirm) return fromFirm;
    return firmField;
  }

  const name = normalizeFirmNameForMatch(investor.name);
  const fromName = resolveVcWebsiteKey(name);
  if (fromName) return fromName;
  if (VC_SUFFIX.test(name)) return name;

  return name || 'Unknown';
}

/**
 * @param {{ name?: string; firm?: string; url?: string|null; blog_url?: string|null; id?: string }} investor
 */
export function resolveFirmScrapeGroup(investor) {
  const resolved = resolveInvestorUrls(investor);
  const canonicalName = resolveCanonicalFirmName(investor);

  let firmUrl = (investor.url || '').trim() || null;
  if (resolved.config?.website) {
    firmUrl = resolved.config.website;
  }

  const domain = firmUrl ? extractDomain(firmUrl) : null;
  const registryKey = resolved.key || resolveVcWebsiteKey(canonicalName) || null;

  let dedupKey;
  if (domain) dedupKey = `domain:${domain}`;
  else if (registryKey) dedupKey = `registry:${registryKey}`;
  else dedupKey = `investor:${investor.id}`;

  return {
    dedupKey,
    firmName: registryKey || canonicalName,
    firmUrl,
    domain,
    registryKey,
  };
}

/**
 * @param {Array<{ id: string; name?: string; firm?: string; url?: string|null; blog_url?: string|null; investor_score?: number|null }>} investors
 */
export function groupInvestorsByFirm(investors) {
  /** @type {Map<string, { dedupKey: string; firmName: string; firmUrl: string|null; domain: string|null; registryKey: string|null; investors: typeof investors }>} */
  const groups = new Map();

  for (const inv of investors) {
    const info = resolveFirmScrapeGroup(inv);
    if (!groups.has(info.dedupKey)) {
      groups.set(info.dedupKey, {
        dedupKey: info.dedupKey,
        firmName: info.firmName,
        firmUrl: info.firmUrl,
        domain: info.domain,
        registryKey: info.registryKey,
        investors: [],
      });
    }
    const group = groups.get(info.dedupKey);
    group.investors.push(inv);

    if (info.domain && !group.domain) {
      group.domain = info.domain;
      group.firmUrl = info.firmUrl;
    }
    if (info.registryKey) {
      group.registryKey = info.registryKey;
      group.firmName = info.firmName;
      if (!group.firmUrl && info.firmUrl) group.firmUrl = info.firmUrl;
    }
  }

  return [...groups.values()];
}

/**
 * Dedup key for an existing vc_intelligence row (profiling fan-out).
 * @param {{ firm_url?: string|null; firm_name?: string|null; investor_id?: string|null }} record
 */
export function dedupKeyForIntelRecord(record) {
  const domain = extractDomain(record.firm_url || '');
  if (domain) return `domain:${domain}`;
  const name = (record.firm_name || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  return `investor:${record.investor_id || record.id}`;
}

/**
 * @param {Array<Record<string, unknown>>} records
 */
export function groupIntelRecordsByFirm(records) {
  /** @type {Map<string, { dedupKey: string; representative: Record<string, unknown>; records: typeof records }>} */
  const groups = new Map();

  for (const rec of records) {
    const dedupKey = dedupKeyForIntelRecord(rec);
    if (!groups.has(dedupKey)) {
      groups.set(dedupKey, { dedupKey, representative: rec, records: [] });
    }
    const group = groups.get(dedupKey);
    group.records.push(rec);
    const repScore = Number(group.representative.source_count || 0);
    const recScore = Number(rec.source_count || 0);
    if (recScore > repScore) group.representative = rec;
  }

  return [...groups.values()];
}
