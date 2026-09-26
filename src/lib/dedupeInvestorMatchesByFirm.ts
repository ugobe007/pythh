/**
 * Deduplicate investor match rows so each VC / firm appears at most once (highest match_score kept).
 * (Mirror of lib/dedupeInvestorMatchesByFirm.js for Node preview — keep logic in sync.)
 */

import { isNonInvestorAggregator } from './investorAggregatorBlocklist';
import { rankValue } from './distinctiveInvestorFit';

export type MatchWithInvestor = {
  match_score?: number | null;
  fit_rank?: number | null;
  result?: { score?: number | null } | null;
  funding_lifecycle_fit?: { level?: string } | null;
  investor?: {
    id?: string;
    firm?: string | null;
    name?: string | null;
  } | null;
  investors?: unknown;
};

function getInvestorFromMatch(m: MatchWithInvestor | null | undefined) {
  if (!m || typeof m !== 'object') return null;
  if (m.investor) return m.investor;
  const inv = m.investors as { id?: string; firm?: string | null; name?: string | null }[] | undefined;
  return Array.isArray(inv) ? inv[0] : inv ?? null;
}

export function normalizeInvestorFirmKey(
  investor: { id?: string; firm?: string | null; name?: string | null } | null | undefined
): string {
  if (!investor || typeof investor !== 'object') return '';
  const firm = investor.firm != null && String(investor.firm).trim();
  if (firm) return firm.toLowerCase().replace(/\s+/g, ' ').trim();
  const name = investor.name != null && String(investor.name).trim();
  if (name) return `name:${name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  if (investor.id) return `id:${investor.id}`;
  return '';
}

export function dedupeInvestorMatchesByFirm<T extends MatchWithInvestor>(matches: T[], limit = 5): T[] {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const lifecycleRank: Record<string, number> = { exact: 3, compatible: 2, inferred: 1, unknown: 0 };
  const sorted = [...matches].sort((a, b) => {
    const lifecycleDelta =
      (lifecycleRank[b.funding_lifecycle_fit?.level || ''] || 0) -
      (lifecycleRank[a.funding_lifecycle_fit?.level || ''] || 0);
    return lifecycleDelta || rankValue(b) - rankValue(a);
  });
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of sorted) {
    const inv = getInvestorFromMatch(m);
    if (isNonInvestorAggregator(inv)) continue;
    const key = normalizeInvestorFirmKey(inv);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}
