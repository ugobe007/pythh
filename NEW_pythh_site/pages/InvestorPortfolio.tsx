/**
 * /investor/portfolio — investor virtual portfolio (up to 10 tracked picks).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { Bookmark, Loader2, Plus, Trash2, TrendingUp } from 'lucide-react';
import SharedNavbar from '@/components/SharedNavbar';
import {
  fetchInvestorPortfolio,
  removePortfolioPick,
  INVESTOR_PORTFOLIO_MAX_PICKS,
  type PortfolioItem,
} from '@/lib/investorPortfolio';

export default function InvestorPortfolio() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [picksUsed, setPicksUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchInvestorPortfolio();
    setItems(data?.items ?? []);
    setPicksUsed(data?.picks_used ?? data?.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = async (startupId: string) => {
    setRemovingId(startupId);
    const ok = await removePortfolioPick(startupId);
    if (ok) {
      setItems((prev) => prev.filter((i) => i.startup_id !== startupId));
      setPicksUsed((n) => Math.max(0, n - 1));
    }
    setRemovingId(null);
  };

  const picksRemaining = Math.max(0, INVESTOR_PORTFOLIO_MAX_PICKS - picksUsed);

  return (
    <div className="min-h-screen bg-[#090909]">
      <Helmet>
        <title>My portfolio — Pythh investor</title>
      </Helmet>
      <SharedNavbar />

      <main className="container max-w-4xl pt-24 pb-16 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-emerald-400 mb-2">Virtual portfolio</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Your tracked picks</h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Up to {INVESTOR_PORTFOLIO_MAX_PICKS} startups — GOD score, funding signals, and momentum over time.
              Export to Carta, Smartsheet, and Standard Metrics coming soon.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-white tabular-nums">
              {picksUsed}<span className="text-zinc-600">/{INVESTOR_PORTFOLIO_MAX_PICKS}</span>
            </div>
            <p className="text-xs text-zinc-500">{picksRemaining} slots left</p>
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-zinc-800 mb-8 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, (picksUsed / INVESTOR_PORTFOLIO_MAX_PICKS) * 100)}%` }}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
            <Bookmark className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-300 mb-2">No picks yet</p>
            <p className="text-sm text-zinc-500 mb-6">
              Pick up to {INVESTOR_PORTFOLIO_MAX_PICKS} startups from Explore — we track signals on each one.
            </p>
            <Link href="/explore">
              <a className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
                <Plus className="w-4 h-4" />
                Browse startups
              </a>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.startup_id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/portfolio/${item.startup_id}`}>
                        <a className="text-lg font-semibold text-white hover:text-emerald-400 truncate">
                          {item.name}
                        </a>
                      </Link>
                      <span className="text-sm font-mono text-cyan-400">
                        GOD {item.total_god_score ?? '—'}
                      </span>
                    </div>
                    {item.tagline && (
                      <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">{item.tagline}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(item.sectors || []).slice(0, 3).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-400">
                          {s}
                        </span>
                      ))}
                      {item.stage_estimate && (
                        <span className="px-2 py-0.5 rounded text-[11px] text-amber-400/90">
                          {item.stage_estimate}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-2">
                      Added {item.added_at ? new Date(item.added_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.website && (
                      <a
                        href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Site
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRemove(item.startup_id)}
                      disabled={removingId === item.startup_id}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      title="Remove from portfolio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {item.recent_activity?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Recent activity
                    </p>
                    <ul className="space-y-1">
                      {item.recent_activity.slice(0, 3).map((a, i) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-500">
                          <span className="shrink-0 tabular-nums">
                            {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                          </span>
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

        {picksRemaining > 0 && items.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/explore">
              <a className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300">
                <Plus className="w-4 h-4" />
                Add {picksRemaining} more from Explore
              </a>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
