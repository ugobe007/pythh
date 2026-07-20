/**
 * First URL preview is anonymous; a second distinct startup prompts sign-in.
 */

const PREVIEW_URL_KEY = 'pythh_anonymous_preview_url';

export function normalizePreviewHost(url: string): string {
  let s = url.trim().toLowerCase();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const host = new URL(s).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

export function recordAnonymousPreview(url: string) {
  const host = normalizePreviewHost(url);
  if (!host) return;
  try {
    localStorage.setItem(PREVIEW_URL_KEY, host);
  } catch {
    /* ignore quota */
  }
}

export function getAnonymousPreviewHost(): string | null {
  try {
    return localStorage.getItem(PREVIEW_URL_KEY);
  } catch {
    return null;
  }
}

/** True when user already ran one anonymous preview and is trying a different startup. */
export function shouldPromptSignInForNewSearch(nextUrl: string): boolean {
  const prev = getAnonymousPreviewHost();
  if (!prev) return false;
  const next = normalizePreviewHost(nextUrl);
  if (!next) return false;
  return prev !== next;
}

export function buildLoginRedirectForSearch(url: string): string {
  const normalized = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
  const next = `/matches?url=${encodeURIComponent(normalized)}`;
  const params = new URLSearchParams({
    redirect: next,
    reason: 'second_search',
  });
  return `/login?${params.toString()}`;
}
