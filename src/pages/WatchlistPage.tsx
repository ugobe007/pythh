/**
 * /watchlist — User's saved startups
 * ════════════════════════════════════════════
 * Shows all startups the user has bookmarked.
 * Uses useWatchlist hook (all API calls pre-built).
 */

import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Flame, ExternalLink, Trash2, TrendingUp, ArrowRight, LogIn } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuth } from '../contexts/AuthContext';
import { WatchButton } from '../components/WatchButton';

// ─── Score helpers ────────────────────────────────────────────────────────────

function godScoreColor(score: number | undefined) {
  if (!score) return 'text-zinc-500';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 55) return 'text-cyan-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-zinc-400';
}

function godScoreBg(score: number | undefined) {
  if (!score) return 'bg-zinc-800';
  if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/30';
  if (score >= 55) return 'bg-cyan-500/10 border-cyan-500/30';
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-zinc-800 border-zinc-700';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { watchlist, isLoading, error } = useWatchlist();

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Bookmark className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Your Watchlist</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Sign in to save and track startups you're interested in.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-medium rounded-lg transition"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-orange-400" />
            Your Watchlist
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isLoading ? 'Loading…' : `${watchlist.length} startup${watchlist.length !== 1 ? 's' : ''} saved`}
          </p>
        </div>
        <Link
          to="/explore"
          className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition"
        >
          Discover more
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && watchlist.length === 0 && (
        <div className="text-center py-20">
          <Bookmark className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium mb-1">Nothing saved yet</p>
          <p className="text-zinc-600 text-sm mb-6">
            Hit the bookmark icon on any startup to track it here.
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-sm hover:bg-orange-500/30 transition"
          >
            <TrendingUp className="w-4 h-4" />
            Browse Startups
          </Link>
        </div>
      )}

      {/* Watchlist grid */}
      {!isLoading && watchlist.length > 0 && (
        <div className="space-y-3">
          {watchlist.map(item => {
            const s = item.startup;
            if (!s) return null;
            const score = s.total_god_score;
            const sectors = Array.isArray(s.sectors) ? s.sectors : [];

            return (
              <div
                key={item.startup_id}
                className="group relative flex items-center justify-between gap-4 p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl hover:border-zinc-700 transition"
              >
                {/* Left: info */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white shadow">
                    {s.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <Link
                      to={`/matches/preview/${item.startup_id}`}
                      className="font-semibold text-white hover:text-orange-300 transition text-sm"
                    >
                      {s.name}
                    </Link>
                    {s.tagline && (
                      <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-xs">{s.tagline}</p>
                    )}
                    {sectors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sectors.slice(0, 3).map(sec => (
                          <span key={sec} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">
                            {sec}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: score + actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* GOD Score */}
                  {score != null && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${godScoreBg(score)}`}>
                      <Flame className="w-3 h-3 text-orange-400" />
                      <span className={godScoreColor(score)}>{score}</span>
                    </div>
                  )}

                  {/* View */}
                  <Link
                    to={`/matches/preview/${item.startup_id}`}
                    className="p-1.5 text-zinc-500 hover:text-white transition opacity-0 group-hover:opacity-100"
                    title="View matches"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  {/* Remove from watchlist */}
                  <WatchButton
                    startupId={item.startup_id}
                    variant="icon"
                    className="opacity-0 group-hover:opacity-100"
                  />
                </div>

                {/* Saved date */}
                <div className="absolute top-2 right-3 text-zinc-700 text-xs">
                  {new Date(item.watched_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA: discover more */}
      {!isLoading && watchlist.length >= 3 && (
        <div className="mt-8 p-5 bg-zinc-900/40 border border-zinc-800 rounded-xl text-center">
          <p className="text-zinc-400 text-sm mb-3">
            Want to find more companies that match your thesis?
          </p>
          <Link
            to="/signal-matches"
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-lg transition"
          >
            Run a Signal Match
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
