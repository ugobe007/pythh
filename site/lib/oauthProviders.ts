export type SocialOAuthProvider = 'google' | 'github' | 'linkedin_oidc';

export type OAuthProviderHealth = {
  provider: SocialOAuthProvider;
  enabled: boolean;
  ready: boolean;
  reason?: string;
};

const DEFAULT_READY: Record<SocialOAuthProvider, OAuthProviderHealth> = {
  google: { provider: 'google', enabled: true, ready: true },
  github: { provider: 'github', enabled: true, ready: true },
  linkedin_oidc: { provider: 'linkedin_oidc', enabled: false, ready: false, reason: 'not_enabled' },
};

export function providerLabel(provider: SocialOAuthProvider): string {
  if (provider === 'linkedin_oidc') return 'LinkedIn';
  if (provider === 'github') return 'GitHub';
  return 'Google';
}

export function rewriteOAuthClientIdError(raw: string | null | undefined): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (/invalid client_id|invalid_client/i.test(text)) {
    return 'LinkedIn sign-in is misconfigured (invalid client ID). Use Google, GitHub, or email instead.';
  }
  return text;
}

export async function fetchOAuthProviderHealth(): Promise<Record<SocialOAuthProvider, OAuthProviderHealth>> {
  try {
    const res = await fetch('/api/auth/oauth-providers', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return DEFAULT_READY;
    const body = (await res.json()) as {
      providers?: Partial<Record<SocialOAuthProvider, OAuthProviderHealth>>;
    };
    return {
      google: { ...DEFAULT_READY.google, ...body.providers?.google },
      github: { ...DEFAULT_READY.github, ...body.providers?.github },
      linkedin_oidc: { ...DEFAULT_READY.linkedin_oidc, ...body.providers?.linkedin_oidc },
    };
  } catch {
    return DEFAULT_READY;
  }
}
