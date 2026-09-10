/** Persist a homepage join and open the first five ranked matches. */

export function normalizeStartupPreviewUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

export function matchesPreviewPath(url: string): string {
  const normalized = normalizeStartupPreviewUrl(url);
  return `/matches?url=${encodeURIComponent(normalized)}`;
}

export function persistJoinPreview(url: string, email: string): string {
  const normalized = normalizeStartupPreviewUrl(url);
  if (typeof sessionStorage !== "undefined") {
    if (normalized) sessionStorage.setItem("pythia_url", normalized);
    if (email.trim()) sessionStorage.setItem("pythia_email", email.trim());
  }
  return matchesPreviewPath(normalized);
}
