/**
 * Google / GitHub / LinkedIn one-click auth for founder gate + signup.
 * LinkedIn is shown only when Supabase Auth has a usable LinkedIn client_id —
 * otherwise LinkedIn renders "Forwarding... Invalid client_id".
 */

import { useEffect, useState } from 'react';
import { Github, Loader2 } from 'lucide-react';
import { supabase, bootstrapSupabase, hasValidSupabaseCredentials } from '@/lib/supabase';
import {
  fetchOAuthProviderHealth,
  providerLabel,
  rewriteOAuthClientIdError,
  type SocialOAuthProvider,
} from '@/lib/oauthProviders';
import {
  buildSupabaseOAuthRedirectUrl,
  clearStaleOAuthKeys,
  markOAuthHandoff,
} from '@/lib/supabaseOAuth';

type Provider = SocialOAuthProvider;

interface FounderSocialAuthProps {
  returnPath: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onStart?: (provider: Provider) => void;
}

const buttonClass =
  'w-full flex items-center justify-center gap-3 py-3 rounded-lg text-sm font-semibold transition-opacity border disabled:opacity-40 disabled:cursor-not-allowed';
const buttonStyle = {
  color: 'oklch(0.94 0.005 264)',
  backgroundColor: 'oklch(0.13 0.01 264)',
  borderColor: 'oklch(0.28 0.01 264)',
};

function LinkedInMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"
      />
    </svg>
  );
}

export default function FounderSocialAuth({ returnPath, disabled, onError, onStart }: FounderSocialAuthProps) {
  const [oauthReady, setOauthReady] = useState(() => hasValidSupabaseCredentials());
  const [loading, setLoading] = useState<Provider | null>(null);
  const [linkedinReady, setLinkedinReady] = useState(false);

  useEffect(() => {
    if (oauthReady) return;
    void bootstrapSupabase().then((ok) => setOauthReady(ok));
  }, [oauthReady]);

  useEffect(() => {
    let cancelled = false;
    void fetchOAuthProviderHealth().then((health) => {
      if (!cancelled) setLinkedinReady(health.linkedin_oidc.ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSocialLogin = async (provider: Provider) => {
    if (provider === 'linkedin_oidc' && !linkedinReady) {
      onError?.(
        'LinkedIn sign-in is not configured yet. Use Google, GitHub, or email — or add a valid LinkedIn OIDC client ID in Supabase Auth.',
      );
      return;
    }
    const ready = oauthReady || (await bootstrapSupabase());
    if (!ready || !supabase) {
      onError?.('OAuth sign-in is not configured. Use email below or try again later.');
      return;
    }
    setLoading(provider);
    clearStaleOAuthKeys();
    onStart?.(provider);
    try {
      const health = await fetchOAuthProviderHealth();
      if (provider === 'linkedin_oidc' && !health[provider]?.ready) {
        throw new Error(
          'LinkedIn sign-in is misconfigured (invalid client ID). Use Google, GitHub, or email instead.',
        );
      }
      const redirectTo = buildSupabaseOAuthRedirectUrl(returnPath);
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (oauthErr) throw oauthErr;
      if (!data?.url) throw new Error('OAuth redirect URL missing');
      markOAuthHandoff();
      window.location.href = data.url;
    } catch (err) {
      const raw = err instanceof Error ? err.message : `Failed to sign in with ${providerLabel(provider)}`;
      onError?.(rewriteOAuthClientIdError(raw) || raw);
      setLoading(null);
    }
  };

  const oauthDisabled = disabled || !oauthReady || !!loading;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void handleSocialLogin('google')}
        disabled={oauthDisabled}
        className={buttonClass}
        style={buttonStyle}
      >
        {loading === 'google' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#EA4335" d="M5.27 9.75A6.46 6.46 0 0 1 12 5.5c1.7 0 3.14.63 4.28 1.65l3.18-3.18C17.4 2.09 14.89 1 12 1 7.7 1 4.05 3.5 2.25 7.1l3.02 2.65z" />
            <path fill="#34A853" d="M16.04 18.01A7.4 7.4 0 0 1 12 19.5a6.46 6.46 0 0 1-6.73-4.75L2.25 17.4C4.05 21 7.7 23.5 12 23.5c2.7 0 5.2-.89 7.17-2.53l-3.13-2.96z" />
            <path fill="#4A90E2" d="M19.17 20.97C21.45 18.93 23 15.7 23 12.23c0-.79-.07-1.53-.2-2.23H12v4.5h6.18c-.3 1.45-1.1 2.64-2.27 3.41l3.26 2.06z" />
            <path fill="#FBBC05" d="M5.27 14.75A6.53 6.53 0 0 1 5.27 9.75L2.25 7.1a10.5 10.5 0 0 0 0 10.3l3.02-2.65z" />
          </svg>
        )}
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => void handleSocialLogin('github')}
        disabled={oauthDisabled}
        className={buttonClass}
        style={buttonStyle}
      >
        {loading === 'github' ? <Loader2 size={16} className="animate-spin" /> : <Github size={18} />}
        Continue with GitHub
      </button>

      {linkedinReady ? (
        <button
          type="button"
          onClick={() => void handleSocialLogin('linkedin_oidc')}
          disabled={oauthDisabled}
          className={buttonClass}
          style={buttonStyle}
        >
          {loading === 'linkedin_oidc' ? <Loader2 size={16} className="animate-spin" /> : <LinkedInMark />}
          Continue with LinkedIn
        </button>
      ) : null}
    </div>
  );
}
