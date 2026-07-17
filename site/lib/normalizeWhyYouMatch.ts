/** DB stores why_you_match as string[]; preview fallbacks may use string. */
export function normalizeWhyYouMatch(raw: string | string[] | null | undefined): string {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean).join(' · ');
  }
  return String(raw).trim();
}
