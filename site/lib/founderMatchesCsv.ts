/**
 * Founder-facing CSV for the shortlist (top 5 / saved matches).
 * No email / Hunter columns — those stay server-side after signup.
 */

import { csvEscape } from '@/lib/targetedMatchesCsv';

export type FounderCsvMatch = {
  investor_id?: string;
  match_score?: number;
  fitness_score?: number;
  why_you_match?: string | null;
  investor_class?: 'angel' | 'vc' | string | null;
  investor?: {
    id?: string;
    name?: string;
    firm?: string | null;
    type?: string | null;
    sectors?: string[] | null;
    stage?: string | string[] | null;
    check_size_min?: number | null;
    check_size_max?: number | null;
    contactable?: boolean;
    website?: string | null;
    linkedin_url?: string | null;
    total_investments?: number | null;
    last_investment_date?: string | null;
  } | null;
};

export type FounderCsvStartup = {
  id?: string;
  name?: string | null;
  website?: string | null;
  god_score?: number | null;
  sectors?: string[] | null;
  stage?: string | null;
};

function checkSizeLabel(min?: number | null, max?: number | null) {
  if (min == null && max == null) return '';
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `up to ${fmt(max!)}`;
}

function stageCell(stage: string | string[] | null | undefined) {
  if (Array.isArray(stage)) return stage.filter(Boolean).join('; ');
  return stage || '';
}

const HEADERS = [
  'rank',
  'firm',
  'investor_name',
  'investor_id',
  'investor_class',
  'match_score',
  'fitness_score',
  'stage',
  'sectors',
  'check_size',
  'contactable',
  'website',
  'linkedin',
  'total_investments',
  'last_investment_date',
  'why_you_match',
  'startup_name',
  'startup_website',
  'startup_id',
  'startup_god_score',
] as const;

export function founderMatchesToCsv(
  matches: FounderCsvMatch[],
  startup?: FounderCsvStartup | null,
): string {
  const startupName = startup?.name || '';
  const startupWebsite = startup?.website || '';
  const startupId = startup?.id || '';
  const startupGod =
    startup?.god_score != null && Number.isFinite(Number(startup.god_score))
      ? String(Math.round(Number(startup.god_score)))
      : '';

  const lines = [HEADERS.join(',')];
  matches.forEach((m, index) => {
    const inv = m.investor || {};
    lines.push(
      [
        index + 1,
        inv.firm || '',
        inv.name || '',
        m.investor_id || inv.id || '',
        m.investor_class || inv.type || '',
        m.match_score != null ? Math.round(Number(m.match_score)) : '',
        m.fitness_score != null ? Math.round(Number(m.fitness_score)) : '',
        stageCell(inv.stage),
        (inv.sectors || []).join('; '),
        checkSizeLabel(inv.check_size_min, inv.check_size_max),
        inv.contactable ? 'yes' : 'no',
        inv.website || '',
        inv.linkedin_url || '',
        inv.total_investments ?? '',
        inv.last_investment_date || '',
        m.why_you_match || '',
        startupName,
        startupWebsite,
        startupId,
        startupGod,
      ]
        .map((v) => csvEscape(String(v ?? '')))
        .join(','),
    );
  });
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function founderMatchesCsvFilename(startup?: FounderCsvStartup | null) {
  const slug = (startup?.name || startup?.website || startup?.id || 'matches')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `pythh-matches-${slug || 'matches'}-${stamp}.csv`;
}

export function downloadFounderMatchesCsv(
  matches: FounderCsvMatch[],
  startup?: FounderCsvStartup | null,
) {
  if (typeof document === 'undefined' || !matches.length) return false;
  const blob = new Blob([founderMatchesToCsv(matches, startup)], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = founderMatchesCsvFilename(startup);
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
