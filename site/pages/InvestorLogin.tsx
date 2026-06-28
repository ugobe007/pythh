/**
 * /investor/login — magic-link sign-in for returning investors.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import SharedNavbar from '@/components/SharedNavbar';
import { apiUrl } from '@/lib/apiConfig';
import { saveInvestorSessionToken } from '@/lib/investorSession';

export default function InvestorLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    let cancelled = false;
    setVerifying(true);
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/investors/auth/verify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          session_token?: string;
        };
        if (!res.ok || !json.session_token) {
          throw new Error(json.error || 'Sign-in link expired');
        }
        if (cancelled) return;
        saveInvestorSessionToken(json.session_token);
        window.history.replaceState({}, '', '/investor/login');
        navigate('/investor/profile');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sign-in failed');
          setVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/investors/auth/magic-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not send sign-in link');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send sign-in link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909]">
      <Helmet>
        <title>Investor sign in — Pythh.ai</title>
      </Helmet>
      <SharedNavbar />

      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-6 pt-20 pb-16">
        <div className="w-full max-w-md">
          <Link href="/">
            <a className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs mb-6">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </a>
          </Link>

          {verifying ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm text-zinc-400">Signing you in…</p>
            </div>
          ) : sent ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4">
                <Mail className="w-6 h-6 text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">Check your inbox</h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                If <span className="text-zinc-200">{email}</span> is registered, we sent a sign-in link. It expires in 15 minutes.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white mb-2">Investor sign in</h1>
              <p className="text-sm text-zinc-400 mb-6">
                We&apos;ll email you a magic link to view or edit your thesis, sectors, and check size.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">
                  {error}
                </div>
              )}

              <label className="block text-zinc-500 text-xs mb-1.5">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 mb-4 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm"
                placeholder="you@fund.com"
              />

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !email.includes('@')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Email me a sign-in link'}
              </button>

              <p className="text-center text-xs text-zinc-600 mt-6">
                New here?{' '}
                <Link href="/signup/investor"><a className="text-zinc-400 hover:text-white">Create investor account</a></Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
