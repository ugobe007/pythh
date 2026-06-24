/**
 * Post-preview email capture — nudge viewers who haven't clicked intro/save.
 */

import { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';
import { trackFunnelEvent } from '@/lib/matchEngagement';

type Props = {
  email?: string;
  startupId: string;
  startupUrl: string;
  startupName: string;
  totalMatches: number;
  topInvestors: Array<{ name: string; firm?: string | null }>;
  source?: string;
};

export default function PreviewEmailCapture({
  startupId,
  startupUrl,
  startupName,
  totalMatches,
  topInvestors,
  source = 'instant_preview',
}: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setErrorMsg('Enter a valid email address');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg(null);
    try {
      const res = await fetch(apiUrl('/api/preview/email-shortlist'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          startup_id: startupId,
          startup_url: startupUrl,
          startup_name: startupName,
          match_count: totalMatches,
          top_investors: topInvestors.slice(0, 3),
          source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Could not send email');
      }
      setStatus('sent');
      void trackFunnelEvent('preview_email_captured', {
        startup_id: startupId,
        url: startupUrl,
        source,
        match_count: totalMatches,
      });
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  if (status === 'sent') {
    return (
      <div className="mb-8 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center">
        <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm text-emerald-300 font-medium">Check your inbox — your shortlist link is on the way.</p>
        <p className="text-xs text-zinc-500 mt-1">We sent top matches for {startupName} to {email.trim()}</p>
      </div>
    );
  }

  return (
    <div className="mb-8 p-5 rounded-xl border border-zinc-700/80 bg-zinc-900/50">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-zinc-800 shrink-0">
          <Mail className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1">Email me my shortlist</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Not ready to sign up? Get your top {Math.min(3, topInvestors.length)} matches + a link back to this preview.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          placeholder="you@yourstartup.com"
          className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-zinc-950 border border-zinc-700 text-white outline-none focus:border-emerald-500/50"
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 disabled:opacity-60"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sending…
            </>
          ) : (
            'Send my matches'
          )}
        </button>
      </div>
      {errorMsg && <p className="text-xs text-red-400 mt-2">{errorMsg}</p>}
    </div>
  );
}
