/**
 * Pythh Virtual Portfolio — /portfolio
 *
 * The Oracle's Picks: YC-style virtual fund tracking every startup that
 * crosses GOD 70. Shows metrics bar, active/exited grid, and "how we pick".
 *
 * Data: /api/portfolio  +  /api/portfolio/metrics  (Fly.io backend)
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Award, Target, TrendingUp, Star, DollarSign, Clock,
  ExternalLink, Zap, ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type HealthTier = "core" | "watch" | "review" | "exited";

interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  tagline?: string;
  website?: string;
  sectors?: string[];
  current_stage?: string;
  entry_date: string;
  entry_stage?: string;
  entry_god_score: number;
  current_god_score?: number;
  entry_valuation_usd?: number;
  current_valuation_usd?: number;
  virtual_check_usd: number;
  status: string;
  exit_date?: string;
  exit_type?: string;
  exit_valuation_usd?: number;
  exit_acquirer?: string;
  moic?: number;
  irr_annualized?: number;
  holding_days?: number;
  entry_rationale?: string;
  latest_round_type?: string;
  latest_round_post_money?: number;
  latest_lead_investor?: string;
  total_rounds_tracked?: number;
  primary_sector?: string | null;
  sector_god_percentile?: number | null;
  god_delta?: number | null;
  days_since_last_event?: number | null;
  events_last_180d?: number | null;
  health_tier?: HealthTier | string;
  maturity_level?: string | null;
  goldilocks_alignment?: string;
  exit_propensity_score?: number | null;
  exit_propensity_confidence?: number | null;
  exit_propensity_tier?: string | null;
  in_goldilocks_god_zone?: boolean;
}

interface PortfolioMetrics {
  total_picks: number;
  active_picks: number;
  successful_exits: number;
  acquisitions: number;
  ipos: number;
  funded_picks?: number;
  funded_rate_pct?: number;
  win_rate_pct: number;
  avg_moic: number | null;
  best_moic: number | null;
  total_virtual_deployed_usd: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n?: number | null) {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function healthLabel(tier: string) {
  const map: Record<string, string> = { core: "Core", watch: "Watch", review: "Review ⚠", exited: "Exited" };
  return map[tier] ?? tier;
}

function healthColor(tier: string): string {
  if (tier === "core")   return "oklch(0.696 0.17 162.48)";
  if (tier === "watch")  return "oklch(0.769 0.188 70.08)";
  if (tier === "review") return "oklch(0.65 0.22 25)";
  return "oklch(0.5 0.01 264)";
}

function godColor(score: number): string {
  if (score >= 85) return "oklch(0.696 0.17 162.48)";
  if (score >= 70) return "oklch(0.65 0.15 220)";
  return "oklch(0.6 0.01 264)";
}

function statusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    active:      { label: "Active",      color: "oklch(0.696 0.17 162.48)" },
    acquired:    { label: "Acquired 🎯", color: "oklch(0.65 0.15 220)" },
    ipo:         { label: "IPO 🚀",      color: "oklch(0.65 0.15 220)" },
    exited:      { label: "Exited",      color: "oklch(0.5 0.01 264)" },
    written_off: { label: "Written Off", color: "oklch(0.65 0.22 25)" },
  };
  return map[status] ?? map.active;
}

// ── Portfolio Card ────────────────────────────────────────────────────────────
function PortfolioCard({ entry }: { entry: PortfolioEntry }) {
  const tier = (entry.health_tier as string) || "core";
  const st = statusLabel(entry.status);
  const delta = entry.god_delta;
  const moicDelta = (entry.moic ?? 1) - 1;
  const isExit = ["acquired", "ipo", "exited"].includes(entry.status);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}
    >
      <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        {/* Left */}
        <div className="space-y-2">
          {/* Name + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/portfolio/${entry.startup_id}`}
              className="text-base font-bold transition-colors"
              style={{ color: "oklch(0.94 0.005 264)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.696 0.17 162.48)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
            >
              {entry.startup_name}
            </Link>

            {/* Status */}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full border"
              style={{ color: st.color, borderColor: `${st.color}55` }}
            >
              {st.label}
            </span>

            {/* Health tier */}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full border"
              style={{ color: healthColor(tier), borderColor: `${healthColor(tier)}55` }}
            >
              {healthLabel(tier)}
            </span>

            {/* GOD score */}
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full border"
              style={{ color: godColor(entry.entry_god_score), borderColor: `${godColor(entry.entry_god_score)}55` }}
            >
              GOD {entry.entry_god_score}
              {entry.current_god_score != null && entry.current_god_score !== entry.entry_god_score
                ? <span style={{ color: "oklch(0.5 0.01 264)", fontWeight: 400 }}> → {entry.current_god_score}</span>
                : null}
            </span>

            {/* Latest round */}
            {entry.latest_round_type && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full border"
                style={{ color: "oklch(0.65 0.15 220)", borderColor: "oklch(0.65 0.15 220 / 0.4)" }}
              >
                {entry.latest_round_type}
                {entry.latest_round_post_money ? ` · ${fmtUSD(entry.latest_round_post_money)}` : ""}
              </span>
            )}

            {/* Exit propensity */}
            {entry.status === "active" && entry.exit_propensity_score != null && entry.exit_propensity_tier && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: "oklch(0.769 0.188 70.08)", borderColor: "oklch(0.769 0.188 70.08 / 0.4)" }}
                title={`Exit propensity: ${entry.exit_propensity_score}/100`}
              >
                Exit {entry.exit_propensity_score} · {entry.exit_propensity_tier}
              </span>
            )}
          </div>

          {/* Tagline */}
          {entry.tagline && (
            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.6 0.01 264)" }}>
              {entry.tagline}
            </p>
          )}

          {/* Goldilocks warning */}
          {entry.goldilocks_alignment === "thin_signals" && (
            <p
              className="text-xs border-l-2 pl-2 py-0.5"
              style={{ color: "oklch(0.769 0.188 70.08)", borderColor: "oklch(0.769 0.188 70.08 / 0.6)" }}
            >
              Goldilocks: maturity signals thin vs. what this GOD score implies.
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
            {entry.primary_sector && (
              <span style={{ color: "oklch(0.65 0.15 220)" }}>{entry.primary_sector}</span>
            )}
            {entry.sector_god_percentile != null && (
              <span>Sector {entry.sector_god_percentile.toFixed(0)}th pct</span>
            )}
            {delta != null && delta !== 0 && (
              <span style={{ color: delta < 0 ? "oklch(0.65 0.22 25)" : "oklch(0.696 0.17 162.48)" }}>
                ΔGOD {delta > 0 ? "+" : ""}{delta}
              </span>
            )}
            {entry.days_since_last_event != null && (
              <span>Last signal {entry.days_since_last_event}d ago</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} /> Picked {fmtDate(entry.entry_date)}
            </span>
            <span>Entry val: {fmtUSD(entry.entry_valuation_usd)}</span>
            {entry.total_rounds_tracked ? (
              <span>{entry.total_rounds_tracked} round{entry.total_rounds_tracked > 1 ? "s" : ""} tracked</span>
            ) : null}
            {isExit && entry.exit_acquirer && (
              <span style={{ color: "oklch(0.65 0.15 220)" }}>Acquired by {entry.exit_acquirer}</span>
            )}
          </div>
        </div>

        {/* Right — MOIC */}
        <div className="text-right min-w-[90px]">
          <div
            className="text-2xl font-bold tracking-tight"
            style={{
              color: moicDelta > 0.05
                ? "oklch(0.696 0.17 162.48)"
                : moicDelta < -0.05
                ? "oklch(0.65 0.22 25)"
                : "oklch(0.94 0.005 264)",
            }}
          >
            {(entry.moic ?? 1).toFixed(2)}×
          </div>
          <div className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 264)" }}>MOIC</div>
          {entry.irr_annualized != null && (
            <div className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 264)" }}>
              IRR {(entry.irr_annualized * 100).toFixed(1)}%
            </div>
          )}
          <div className="flex flex-col items-end gap-1.5 mt-2">
            {entry.website && (
              <a
                href={entry.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs transition-colors"
                style={{ color: "oklch(0.5 0.01 264)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.65 0.15 220)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.5 0.01 264)")}
              >
                <ExternalLink size={10} /> Visit
              </a>
            )}
            <Link
              href={`/portfolio/${entry.startup_id}`}
              className="inline-flex items-center gap-1 text-xs transition-colors"
              style={{ color: "oklch(0.696 0.17 162.48 / 0.7)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.696 0.17 162.48)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.696 0.17 162.48 / 0.7)")}
            >
              Full dossier →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Portfolio() {
  const [entries, setEntries]   = useState<PortfolioEntry[]>([]);
  const [metrics, setMetrics]   = useState<PortfolioMetrics | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<"all" | "active" | "exited">("all");
  const [tierFilter, setTierFilter] = useState<"all" | HealthTier>("all");
  const [sortBy, setSortBy]     = useState<"health" | "god">("health");
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => { loadData(); }, [sortBy]);

  async function loadData() {
    setListLoading(true);
    setMetricsLoading(true);
    setError(null);

    const sortQ = sortBy === "health" ? "health" : "god";
    const listUrl = `/api/portfolio?sort=${sortQ}&limit=80&lite=1`;

    // Metrics is fast — paint the header bar as soon as it lands.
    fetch("/api/portfolio/metrics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load metrics"))))
      .then((metricsData) => setMetrics(metricsData.metrics ?? null))
      .catch(() => {})
      .finally(() => setMetricsLoading(false));

    try {
      const listRes = await fetch(listUrl);
      if (!listRes.ok) throw new Error("Failed to load portfolio");
      const listData = await listRes.json();
      setEntries(listData.entries ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setListLoading(false);
    }
  }

  const exits = entries.filter((e) => ["acquired", "ipo", "exited"].includes(e.status));
  const filtered = entries
    .filter((e) => {
      if (filter === "active") return e.status === "active";
      if (filter === "exited") return ["acquired", "ipo", "exited"].includes(e.status);
      return true;
    })
    .filter((e) => {
      if (tierFilter === "all") return true;
      return (e.health_tier as string) === tierFilter;
    });
  const displayed = showAll ? filtered.slice(0, 50) : filtered.slice(0, 10);
  const hasMore = filtered.length > (showAll ? 50 : 10);

  const G = "oklch(0.696 0.17 162.48)";
  const DIM = "oklch(0.5 0.01 264)";
  const BORDER = "oklch(0.25 0.01 264)";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.94 0.005 264)" }}>
      {/* ── Nav ── */}
      <div className="sticky top-0 z-20 border-b" style={{ backgroundColor: "oklch(0.13 0.01 264 / 0.95)", borderColor: BORDER, backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display font-bold text-base" style={{ color: G }}>PYTHIA</span>
            <span className="text-xs" style={{ color: DIM }}>/ Portfolio</span>
          </Link>
          <nav className="flex gap-5 text-sm" style={{ color: DIM }}>
            <Link href="/rankings" className="transition-colors hover:text-white">Rankings</Link>
            <Link href="/explore"  className="transition-colors hover:text-white">Explore</Link>
            <Link href="/activate" className="transition-colors" style={{ color: G }}>Activate</Link>
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* ── Hero ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} style={{ color: G }} />
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: G }}>
              Virtual Portfolio
            </span>
          </div>
          <h1 className="text-4xl font-display font-bold mb-3 tracking-tight">
            The Oracle's Picks
          </h1>
          <p className="text-base max-w-2xl leading-relaxed" style={{ color: DIM }}>
            Every startup that crosses a GOD score of 70 is added to the Pythh virtual fund.
            We track them like YC — funding rounds, acquisitions, IPOs — and score each pick on
            peer-relative momentum and thesis balance so slow or overstretched names surface in Review.
          </p>
        </div>

        {/* ── Metrics Bar ── */}
        {metricsLoading && !metrics ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-12">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ borderColor: BORDER, backgroundColor: "oklch(0.16 0.01 264)", height: 88 }} />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-12">
            {[
              { icon: <Target size={14} />,    label: "Total Picks",    value: String(metrics.total_picks ?? 0),                     sub: `${metrics.active_picks ?? 0} active` },
              { icon: <TrendingUp size={14} />, label: "Funded",         value: String(metrics.funded_picks ?? 0),                   sub: metrics.funded_rate_pct ? `${metrics.funded_rate_pct}% of picks · raises detected` : "raises detected" },
              { icon: <Star size={14} />,       label: "Avg MOIC",       value: metrics.avg_moic ? `${metrics.avg_moic}×` : "—",       sub: `best: ${metrics.best_moic ? `${metrics.best_moic}×` : "—"}` },
              { icon: <DollarSign size={14} />, label: "Virtual Capital", value: fmtUSD(metrics.total_virtual_deployed_usd),            sub: "$100K / pick" },
              { icon: <Award size={14} />,      label: "Exited",         value: String(metrics.successful_exits ?? 0),                 sub: `${metrics.acquisitions ?? 0} acq · ${metrics.ipos ?? 0} IPO` },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: "oklch(0.16 0.01 264)" }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: G }}>
                  {m.icon}
                  <span className="text-xs uppercase tracking-wider" style={{ color: DIM }}>{m.label}</span>
                </div>
                <div className="text-xl font-bold tracking-tight">{m.value}</div>
                <div className="text-xs mt-1" style={{ color: DIM }}>{m.sub}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Filters ── */}
        <div className="space-y-3 mb-6">
          {/* Status */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wider w-20" style={{ color: "oklch(0.4 0.01 264)" }}>Status</span>
            {(["all", "active", "exited"] as const).map((f) => {
              const count = f === "all" ? entries.length : f === "active" ? entries.filter((e) => e.status === "active").length : exits.length;
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setShowAll(false); }}
                  className="px-3 py-1.5 rounded-full border text-sm font-semibold capitalize transition-colors"
                  style={{
                    borderColor: active ? G : BORDER,
                    color: active ? G : DIM,
                  }}
                >
                  {f} ({count})
                </button>
              );
            })}
          </div>

          {/* Health tier */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wider w-20" style={{ color: "oklch(0.4 0.01 264)" }}>Tier</span>
            {(["all", "review", "watch", "core", "exited"] as const).map((t) => {
              const count = t === "all" ? entries.length : entries.filter((e) => (e.health_tier as string) === t).length;
              const active = tierFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => { setTierFilter(t === "all" ? "all" : t); setShowAll(false); }}
                  className="px-3 py-1.5 rounded-full border text-sm font-semibold capitalize transition-colors"
                  style={{
                    borderColor: active ? "oklch(0.65 0.15 220)" : BORDER,
                    color: active ? "oklch(0.65 0.15 220)" : DIM,
                  }}
                >
                  {t === "all" ? "All tiers" : healthLabel(t)} ({count})
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider" style={{ color: "oklch(0.4 0.01 264)" }}>Sort</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as "health" | "god"); setShowAll(false); }}
              className="rounded-lg px-3 py-2 text-sm border focus:outline-none"
              style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: BORDER, color: "oklch(0.94 0.005 264)" }}
            >
              <option value="health">Health (Review first)</option>
              <option value="god">GOD score (entry)</option>
            </select>
          </div>
        </div>

        {/* ── Content ── */}
        {listLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border animate-pulse" style={{ borderColor: BORDER, backgroundColor: "oklch(0.16 0.01 264)", height: 120 }} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-sm" style={{ color: DIM }}>
            No entries yet — portfolio builds automatically as startups cross GOD 70.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayed.map((e) => <PortfolioCard key={e.id} entry={e} />)}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                  style={{ borderColor: "oklch(0.65 0.15 220 / 0.5)", color: "oklch(0.65 0.15 220)" }}
                >
                  <ChevronDown size={14} />
                  {showAll ? "Show Less" : `Show All (${filtered.length})`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── How we pick ── */}
        <div className="mt-20 rounded-xl border p-8" style={{ borderColor: BORDER, backgroundColor: "oklch(0.16 0.01 264)" }}>
          <div className="flex items-center gap-2 mb-6">
            <Zap size={16} style={{ color: G }} />
            <h2 className="text-lg font-bold">How the Pythh Fund works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { step: "01", title: "GOD Score ≥ 70",     desc: "Every approved startup scoring 70+ on the GOD algorithm is added automatically." },
              { step: "02", title: "$100K virtual check", desc: "We log a $100K virtual investment at the estimated entry valuation." },
              { step: "03", title: "We track everything", desc: "Funding rounds, lead investors, post-money valuations, acquisitions, and IPOs." },
              { step: "04", title: "MOIC + IRR",          desc: "As valuations update we compute unrealised MOIC and annualised IRR like a real fund." },
              { step: "05", title: "Health + Goldilocks", desc: "Core / Watch / Review blends momentum with maturity-vs-GOD alignment to flag thin-signal risk." },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-xs font-bold tracking-wider mb-2" style={{ color: "oklch(0.65 0.15 220)" }}>STEP {s.step}</div>
                <div className="text-sm font-semibold mb-2">{s.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: DIM }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
