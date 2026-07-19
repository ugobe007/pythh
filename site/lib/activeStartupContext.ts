/**
 * Pin the founder's active startup to the URL they scanned — prevents cross-company bleed
 * (e.g. OrbitalAi id stuck in session while viewing pythh.ai matches).
 */

const STARTUP_ID_KEY = 'pythia_startup_id';
const STARTUP_URL_KEY = 'pythia_url';
const STARTUP_NAME_KEY = 'pythia_startup_name';

export function extractDomain(url: string | null | undefined): string {
  if (!url) return '';
  let s = url.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return s;
}

export function domainsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = extractDomain(a);
  const db = extractDomain(b);
  if (!da || !db) return true;
  return da === db || da.endsWith(`.${db}`) || db.endsWith(`.${da}`);
}

export function pinActiveStartup(startupId: string, website?: string | null, name?: string | null) {
  if (!startupId) return;
  sessionStorage.setItem(STARTUP_ID_KEY, startupId);
  if (website) sessionStorage.setItem(STARTUP_URL_KEY, website.startsWith('http') ? website : `https://${website}`);
  if (name) sessionStorage.setItem(STARTUP_NAME_KEY, name);
}

export function clearActiveStartupPin() {
  sessionStorage.removeItem(STARTUP_ID_KEY);
  sessionStorage.removeItem(STARTUP_NAME_KEY);
}

export function getPinnedStartupUrl(): string | null {
  return sessionStorage.getItem(STARTUP_URL_KEY);
}

export function getPinnedStartupId(): string | null {
  return sessionStorage.getItem(STARTUP_ID_KEY);
}

/** Prefer in-page result, then URL param, then session pin only if domain-consistent. */
export function resolveOutreachStartupId(options: {
  apiStartupId?: string | null;
  urlStartupId?: string | null;
  apiWebsite?: string | null;
}): string | null {
  const pinnedUrl = getPinnedStartupUrl();
  const pinnedId = getPinnedStartupId();

  if (options.apiStartupId && options.apiWebsite && pinnedUrl) {
    if (domainsMatch(options.apiWebsite, pinnedUrl)) return options.apiStartupId;
  } else if (options.apiStartupId) {
    return options.apiStartupId;
  }

  if (options.urlStartupId && options.apiWebsite && pinnedUrl) {
    if (domainsMatch(options.apiWebsite, pinnedUrl)) return options.urlStartupId;
  } else if (options.urlStartupId) {
    return options.urlStartupId;
  }

  if (pinnedId && pinnedUrl) return pinnedId;
  return options.apiStartupId ?? options.urlStartupId ?? pinnedId;
}

export async function resolveStartupIdForUrl(url: string): Promise<string | null> {
  if (!url.trim()) return null;
  try {
    const res = await fetch(`/api/instant/status?url=${encodeURIComponent(url.trim())}`);
    if (!res.ok) return null;
    const data = await res.json() as { startup_id?: string | null };
    return data.startup_id ?? null;
  } catch {
    return null;
  }
}
