/**
 * Hot Matches — full-bleed marketing view (not a narrow dashboard widget).
 */

import { Link } from "react-router-dom";
import PythhUnifiedNav from "../components/PythhUnifiedNav";
import HotMatchesFeed from "../components/HotMatchesFeed";
import SEO from "../components/SEO";
import { PYTHH_MARKETING_BG } from "../lib/pythhMarketingTheme";

export default function HotMatchesPage() {
  return (
    <div className="min-h-screen relative overflow-x-hidden" style={PYTHH_MARKETING_BG}>
      <SEO
        title="Live Matches — founder–investor pairs | pythh.ai"
        description="See real founder–investor matches from Pythh signal intelligence. Find your investors and get funded."
      />
      <PythhUnifiedNav />

      {/* Hero — compact headline + inline text CTAs */}
      <header className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
          <span className="text-white">Live </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300">
            Matches
          </span>
        </h1>
        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-5 leading-snug">
          Real startups matched to real investors — ranked by signal, not luck. Your turn starts with one URL.
        </p>
        <p className="text-sm text-zinc-500 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
          <Link
            to="/signal-matches"
            className="font-semibold text-amber-200/95 hover:text-amber-100 underline-offset-4 decoration-amber-400/40 hover:decoration-amber-300/70 underline"
          >
            Get your matches →
          </Link>
          <span className="text-zinc-600 px-1" aria-hidden>
            ·
          </span>
          <Link
            to="/pricing"
            className="font-medium text-zinc-400 hover:text-zinc-200 underline-offset-4 decoration-transparent hover:decoration-white/25 underline"
          >
            View plans
          </Link>
        </p>
      </header>

      {/* Match grid — wide layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 pb-14">
        <div className="mb-4 flex items-center justify-between gap-4 pb-0.5 border-b border-white/[0.06]">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Live Matches
          </h2>
          <span className="text-[10px] text-zinc-600 tabular-nums">Updates every minute</span>
        </div>
        <HotMatchesFeed
          limit={8}
          hoursAgo={720}
          showHeader={false}
          autoRefresh={true}
          variant="showcase"
        />
      </main>
    </div>
  );
}
