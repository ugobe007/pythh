import { useMemo, useState } from "react";
import type { PublicMomentum, StageBand } from "../../types/publicPulse";
import { usePublicPulses } from "../../hooks/usePublicPulses";
import PulseFilters from "./PulseFilters";
import LiveAlignmentTape from "./LiveAlignmentTape";
import AlignmentFeed from "./AlignmentFeed";

export default function HomeProofFeed({
  onRunMySignals,
}: {
  onRunMySignals: () => void;
}) {
  const [filters, setFilters] = useState<{
    category: string;
    stageBand: StageBand | "All";
    momentum: PublicMomentum | "All";
  }>({
    category: "All",
    stageBand: "All",
    momentum: "All",
  });

  const query = useMemo(() => {
    return {
      category: filters.category === "All" ? undefined : filters.category,
      stageBand: filters.stageBand === "All" ? undefined : filters.stageBand,
      momentum: filters.momentum === "All" ? undefined : filters.momentum,
      limit: 12,
    };
  }, [filters.category, filters.stageBand, filters.momentum]);

  const { pulses, loading, error } = usePublicPulses(query);

  const categories = useMemo(() => {
    // Keep your curated base list for demo consistency.
    // Later: merge in categories coming back from API if you want.
    const base = [
      "Infrastructure",
      "Energy Infra",
      "AI DevTools",
      "Climate",
      "Security",
      "Robotics",
      "FinOps",
    ];
    return Array.from(new Set(base)).sort();
  }, []);

  const hasResults = pulses.length > 0;

  return (
    <section className="space-y-6">
      <PulseFilters
        category={filters.category}
        stageBand={filters.stageBand}
        momentum={filters.momentum}
        categories={categories}
        onChange={setFilters}
      />

      {loading && <div className="text-white/60">Loading live alignment…</div>}

      {/* In prod you want clean error messaging. In dev you already have fallback pulses. */}
      {error && !loading && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error loading public pulses: {error}
        </div>
      )}

      {hasResults ? (
        <>
          <LiveAlignmentTape pulses={pulses} />
          <AlignmentFeed pulses={pulses} onRunMySignals={onRunMySignals} />
        </>
      ) : !loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white">No public pulses match these filters</h3>
              <p className="text-sm text-white/60 mt-1 leading-relaxed">
                This feed only shows anonymized public-signal deltas. Broaden your filters,
                or run a private scan to compute your full investor alignment.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setFilters({
                  category: "All",
                  stageBand: "All",
                  momentum: "All",
                })
              }
              className="shrink-0 rounded-xl border border-white/15 bg-black/30 hover:bg-black/40 text-white/80 px-4 py-2 text-sm transition"
            >
              Reset filters
            </button>
          </div>

          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">
              <div className="text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                Why you're seeing this
              </div>
              <div className="mt-2 text-sm text-white/70 leading-relaxed">
                Some categories/stages have fewer public pulses at any moment.
                Your private scan adds the missing signals (traction depth, team, narrative, proof)
                and produces your ranked investor list + actions.
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-xs text-white/50 uppercase tracking-[0.18em] font-mono">
                Do this now
              </div>
              <div className="mt-2 text-sm text-white/70">
                Compute your signals to unlock best-fit investors and what to change.
              </div>
              <button
                onClick={onRunMySignals}
                className="mt-3 inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold py-2.5 transition"
              >
                Read my signals →
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 text-sm text-white/70">
        <span className="font-semibold text-white">The point:</span> you're not late — you're misaligned.
        Pythh shows what investors respond to <span className="text-white/80">right now</span>, and what to
        change to improve your odds.
      </div>
    </section>
  );
}
