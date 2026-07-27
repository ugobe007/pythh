/** Normalize user/data-supplied website links without allowing script URLs. */
export function safeExternalUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function founderSignupPath(input: {
  startupId?: string | null;
  url?: string | null;
  intent?: 'matches';
}): string {
  const params = new URLSearchParams();
  if (input.startupId) params.set('startup_id', input.startupId);
  if (input.url) params.set('url', input.url);
  if (input.intent) params.set('intent', input.intent);
  const query = params.toString();
  return `/signup/founder${query ? `?${query}` : ''}`;
}

export function activatePath(startupId: string, options?: { pipeline?: boolean; welcome?: boolean }): string {
  const params = new URLSearchParams({ startup_id: startupId });
  if (options?.pipeline) params.set('pipeline', '1');
  if (options?.welcome) params.set('welcome', '1');
  return `/activate?${params.toString()}`;
}
