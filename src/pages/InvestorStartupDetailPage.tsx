/**
 * /lookup/startup/:id — Review a startup and save to virtual portfolio.
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { apiUrl } from '../lib/apiConfig';

const SESSION_KEY = 'pythh_investor_session';

function getHeaders(): HeadersInit {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return { 'Content-Type': 'application/json', 'X-Investor-Session': id };
}

type Activity = { type: string; date: string; description: string };
type StartupDetail = {
  id: string;
  name: string;
  tagline: string | null;
  website: string | null;
  pitch: string | null;
  description: string | null;
  sectors: string[];
  stage_estimate: string | null;
  total_god_score: number | null;
  updated_at: string | null;
  recent_activity: Activity[];
};

export default function InvestorStartupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [startup, setStartup] = useState<StartupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(apiUrl(`/api/investor-lookup/startup/${id}`))
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok && json.data) setStartup(json.data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const saveToPortfolio = async () => {
    if (!id) return;
    setSaveError(null);
    const res = await fetch(apiUrl('/api/investor-lookup/portfolio/items'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ startup_id: id }),
    });
    const json = await res.json();
    if (res.ok) setSaved(true);
    else setSaveError(json.error || 'Failed to save');
  };

  if (loading || !startup) {
    return (
      <div className="min-h-screen bg-[#0a0e13]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <PythhUnifiedNav />
        <main className="max-w-3xl mx-auto px-4 py-12">
          {loading ? <p className="text-zinc-500">Loading...</p> : <p className="text-zinc-500">Startup not found.</p>}
          <Link to="/lookup" className="text-amber-400 hover:underline mt-4 inline-block">← Back to search</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e13]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <PythhUnifiedNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/lookup" className="text-sm text-amber-400/90 hover:text-amber-400 mb-6 inline-block">← Back to search</Link>

        <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{startup.name}</h1>
              {startup.tagline && <p className="text-zinc-400 mt-1">{startup.tagline}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {(startup.sectors || []).map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">{s}</span>
                ))}
                {startup.stage_estimate && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400">{startup.stage_estimate}</span>
                )}
                <span className="text-sm font-semibold text-cyan-400">GOD {startup.total_god_score ?? '—'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={saveToPortfolio}
                disabled={saved}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  saved
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-default'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                }`}
              >
                {saved ? 'Saved to portfolio' : 'Save to virtual portfolio'}
              </button>
              <Link to="/lookup/portfolio" className="text-center text-xs text-zinc-500 hover:text-zinc-400">View my portfolio</Link>
            </div>
          </div>

          {startup.website && (
            <a
              href={startup.website.startsWith('http') ? startup.website : `https://${startup.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/90 hover:text-amber-400 text-sm mt-3 inline-block"
            >
              {startup.website.replace(/^https?:\/\//, '')} →
            </a>
          )}

          {(startup.pitch || startup.description) && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">About</h2>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {startup.pitch || startup.description}
              </p>
            </div>
          )}

          {startup.recent_activity && startup.recent_activity.length > 0 && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Recent activity</h2>
              <ul className="space-y-2">
                {startup.recent_activity.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-zinc-600 shrink-0">
                      {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                    </span>
                    <span className="text-zinc-400">{a.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {saveError && (
          <p className="mt-4 text-rose-400 text-sm">{saveError}</p>
        )}
      </main>
    </div>
  );
}
