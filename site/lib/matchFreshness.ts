export type FreshMatch = {
  expires_at?: string | null;
  match_days_left?: number | null;
  match_stale?: boolean;
};

export function formatExpiryDate(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function matchExpiryLine(match: FreshMatch): string | null {
  const date = formatExpiryDate(match.expires_at);
  if (!date) return null;
  if (match.match_stale) return `Expired ${date}. This alignment is stale.`;
  return `Expires ${date}.`;
}

/** Soonest clock on the shortlist. Alignment is one week, then the list is stale. */
export function shortlistExpiryNote(matches: FreshMatch[]): string | null {
  const dated = matches.filter((match) => match.expires_at);
  if (!dated.length) return null;
  const soonest = dated.reduce((left, right) =>
    (left.expires_at || '') < (right.expires_at || '') ? left : right,
  );
  const date = formatExpiryDate(soonest.expires_at);
  if (!date) return null;
  if (soonest.match_stale) {
    return `These matches expired ${date}. Alignment was a moment, and it has gone stale. Start a new campaign before you raise on this list.`;
  }
  return `These matches expire ${date}. Alignment holds for 7 days. Next week investor focus and the market move, and this list goes stale. Start the campaign before then.`;
}
