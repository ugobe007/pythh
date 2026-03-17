/**
 * /lookup/portfolio — My virtual portfolio: saved startups + recent activity.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
type PortfolioItem = {
  startup_id: string;
  added_at: string;
  name: string;
  tagline: string | null;
  website: string | null;
  sectors: string[];
  stage_estimate: string | null;
  total_god_score: number | null;
  updated_at: string | null;
  recent_activity: Activity[];
};

export default function InvestorPortfolioPage() {
  const [listName, setListName] = useState('');
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/investor-lookup/portfolio'), { headers: getHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.data) {
          setListName(json.data.list?.name || 'Virtual portfolio');
          setItems(json.data.items || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e13]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <PythhUnifiedNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/lookup" className="text-sm text-amber-400/90 hover:text-amber-400 mb-6 inline-block">← Back to search</Link>
        <h1 className="text-2xl font-semibold text-white mb-2">My virtual portfolio</h1>
        <p className="text-sm text-zinc-500 mb-8">
          Startups you saved and their recent activity from our database.
        </p>

        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : items.length === 0 ? (
          <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-12 text-center">
            <p className="text-zinc-500 mb-4">No startups in your portfolio yet.</p>
            <Link to="/lookup" className="text-amber-400 hover:underline">Search and save startups →</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((item) => (
              <div
                key={item.startup_id}
                className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/lookup/startup/${item.startup_id}`}
                      className="text-lg font-medium text-white hover:text-amber-400"
                    >
                      {item.name}
                    </Link>
                    {item.tagline && <p className="text-zinc-500 text-sm mt-0.5">{item.tagline}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(item.sectors || []).slice(0, 3).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-400">{s}</span>
                      ))}
                      {item.stage_estimate && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] text-amber-400">{item.stage_estimate}</span>
                      )}
                      <span className="text-[11px] text-cyan-400 font-medium">GOD {item.total_god_score ?? '—'}</span>
                    </div>
                  </div>
                  {item.website && (
                    <a
                      href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400/80 hover:text-amber-400"
                    >
                      {item.website.replace(/^https?:\/\//, '')} →
                    </a>
                  )}
                </div>
                {item.recent_activity && item.recent_activity.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Recent activity</p>
                    <ul className="space-y-1">
                      {item.recent_activity.slice(0, 4).map((a, i) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-500">
                          <span className="shrink-0">{a.date ? new Date(a.date).toLocaleDateString() : '—'}</span>
                          <span>{a.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
