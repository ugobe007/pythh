/** Single-line investor label — avoids `Name · Name` when firm duplicates name. */
export function formatInvestorDisplayLabel(
  name?: string | null,
  firm?: string | null,
  fallback = 'Investor'
): string {
  const n = String(name || '').trim();
  const f = String(firm || '').trim();
  if (!n && !f) return fallback;
  if (!f || f.toLowerCase() === n.toLowerCase()) return n || f || fallback;
  return `${n} · ${f}`;
}
