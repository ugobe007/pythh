export type SimilarRaise = {
  name: string;
  sector: string | null;
  funder: string;
  amount_usd: number;
  announced_at: string;
  round_type: string | null;
};

export function similarRaisesPath(url: string): string {
  return `/api/preview/peers?url=${encodeURIComponent(url)}`;
}

export function formatRaiseAmount(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '';
  if (usd >= 1_000_000_000) {
    const billions = usd / 1_000_000_000;
    const label = billions >= 10 ? String(Math.round(billions)) : billions.toFixed(1).replace(/\.0$/, '');
    return `$${label}B`;
  }
  if (usd >= 1_000_000) {
    const millions = usd / 1_000_000;
    const label = millions >= 10 ? String(Math.round(millions)) : millions.toFixed(1).replace(/\.0$/, '');
    return `$${label}M`;
  }
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}K`;
  return `$${Math.round(usd)}`;
}

export function formatRaiseWhen(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatRaiseRound(raw: string | null): string {
  const text = String(raw || '').trim();
  if (!text || text.toLowerCase() === 'unknown') return '';
  const words = text.replace(/[_-]+/g, ' ').toLowerCase();
  return words.replace(/\b[a-z]/g, (ch) => ch.toUpperCase()).replace(/\bSeed Stage\b/, 'Seed');
}
