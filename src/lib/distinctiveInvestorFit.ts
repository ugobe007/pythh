/**
 * Frontend mirror of lib/distinctiveInvestorFit.js — exports rankValue for deduper.
 * Keep in sync with Node version.
 */

type MatchRow = {
  fit_rank?: number | null;
  match_score?: number | null;
  result?: { score?: number | null } | null;
};

export function rankValue(row: MatchRow | null | undefined): number {
  if (!row || typeof row !== 'object') return 0;
  const fit = Number(row.fit_rank);
  if (Number.isFinite(fit)) return fit;
  return Number(row.match_score ?? row.result?.score) || 0;
}
