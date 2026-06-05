/**
 * Pythh Virtual Portfolio — /portfolio
 * Oracle scoreboard: verified picks, live signals, GOD-tier tracking.
 */

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { ExternalLink, ChevronDown } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import InlineMeta from "@/components/design/InlineMeta";
import FilterTabs from "@/components/design/FilterTabs";
import StatStrip from "@/components/design/StatStrip";
import SectionLabel from "@/components/design/SectionLabel";
import {
  G, CYAN, AMBER, MUTED, DIM, BORDER, CARD, PAGE,
  tierColor, tierLabel, moicColor, signalScoreColor,
} from "@/lib/designTokens";

type HealthTier = "core" | "watch" | "review" | "exited";

interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  tagline?: string;
  website?: string;
  entry_date: string;
  entry_god_score: number;
  current_god_score?: number;
  entry_valuation_usd?: number;
  status: string;
  moic?: number;
  irr_annualized?: number;
  latest_round_type?: string;
  latest_round_post_money?: number;
  exit_acquirer?: string;
  primary_sector?: string | null;
  sector_god_percentile?: number | null;
  god_delta?: number | null;
  days_since_last_event?: number | null;
  total_rounds_tracked?: number;
  health_tier?: HealthTier | string;
  goldilocks_alignment?: string;
  exit_propensity_score?: number | null;
  exit_propensity_tier?: string | null;
  signal_score?: number | null;
  brief_description?: string | null;
  entry_rationale?: string | null;
}

interface PortfolioMetrics {
  total_picks: number;
  active_picks: number;
  successful_exits: number;
  acquisitions: number;
  ipos: number;
  funded_picks?: number;
  funded_rate_pct?: number;
  verified_funded_picks?: number;
  verified_funded_rate_pct?: number;
  signal_funded_picks?: number;
  avg_moic: number | null;
  total_virtual_deployed_usd: number;
}

interface PortfolioValue {
  positions: number;
  marked_positions: number;
  cost_basis_usd: number;
  current_value_usd: number;
  signal_implied_value_usd: number;
  gain_usd: number;
  gain_pct: number;
  tvpi: number | null;
  realized_value_usd: number;
  unrealized_value_usd: number;
  winners: number;
  losers: number;
  top_contributors: { startup_id: string; name: string; gain_usd: number; moic: number; basis?: string; status: string }[];
  note: string;
}

interface BenchmarkRow {
  metric: string;
  oracle: string;
  benchmark: string;
  verdict: "ahead" | "inline" | "behind" | "n/a";
}

interface PortfolioAnalytics {
  value: PortfolioValue;
  benchmarks: { rows: BenchmarkRow[]; source: string };
  strategy: {
    thesis: string;
    entry_rule: string;
    top_sectors: { sector: string; count: number; pct: number }[];
    conviction_sweet_spot: string | null;
    conviction_note: string;
  };
  trend: {
    events_last_30d: number;
    events_last_90d: number;
    verdicts: { label: string; ok: boolean; detail: string }[];
  };
}

function fmtUSD(n?: number | null) {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function fmtSignedUSD(n?: number | null) {
  if (n == null || n === 0) return "$0";
  return `${n > 0 ? "+" : "−"}${fmtUSD(Math.abs(n))}`;
}

function verdictColor(v: string) {
  if (v === "ahead") return G;
  if (v === "behind") return AMBER;
  return MUTED;
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function statusWord(status: string): string {
  const map: Record<string, string> = {
    active: "Active",
    acquired: "Acquired",
    ipo: "IPO",
    exited: "Exited",
    written_off: "Written off",
  };
  return map[status] ?? status;
}

function PortfolioRow({ entry }: { entry: PortfolioEntry }) {
  const tier = (entry.health_tier as string) || "core";
  const moic = entry.moic ?? 1;
  const moicClr = moicColor(moic);
  const delta = entry.god_delta;
  const isExit = ["acquired", "ipo", "exited"].includes(entry.status);

  const headlineMeta = [
    { text: statusWord(entry.status), color: entry.status === "active" ? G : MUTED },
    { text: tierLabel(tier), color: tierColor(tier) },
    {
      text:
        entry.current_god_score != null && entry.current_god_score !== entry.entry_god_score
          ? `GOD ${entry.entry_god_score} → ${entry.current_god_score}`
          : `GOD ${entry.entry_god_score}`,
      color: G,
    },
    entry.latest_round_type
      ? {
          text: `${entry.latest_round_type}${entry.latest_round_post_money ? ` ${fmtUSD(entry.latest_round_post_money)}` : ""}`,
          color: CYAN,
        }
      : { text: "" },
    entry.signal_score != null
      ? { text: `Signal ${entry.signal_score.toFixed(1)}/10`, color: signalScoreColor(entry.signal_score) }
      : { text: "" },
    entry.status === "active" && entry.exit_propensity_score != null && entry.exit_propensity_tier
      ? { text: `Exit ${entry.exit_propensity_score} ${entry.exit_propensity_tier}`, color: MUTED }
      : { text: "" },
  ];

  const footMeta = [
    entry.primary_sector ? { text: entry.primary_sector, color: CYAN } : { text: "" },
    entry.sector_god_percentile != null
      ? { text: `sector ${entry.sector_god_percentile.toFixed(0)}th pct` }
      : { text: "" },
    delta != null && delta !== 0
      ? {
          text: `ΔGOD ${delta > 0 ? "+" : ""}${delta}`,
          color: delta < 0 ? AMBER : G,
        }
      : { text: "" },
    entry.days_since_last_event != null
      ? { text: `last signal ${entry.days_since_last_event}d` }
      : { text: "" },
    { text: `picked ${fmtDate(entry.entry_date)}` },
    { text: `entry ${fmtUSD(entry.entry_valuation_usd)}` },
    entry.total_rounds_tracked
      ? { text: `${entry.total_rounds_tracked} round${entry.total_rounds_tracked > 1 ? "s" : ""}` }
      : { text: "" },
    isExit && entry.exit_acquirer
      ? { text: `acq ${entry.exit_acquirer}`, color: CYAN }
      : { text: "" },
  ];

  return (
    <article
      className="py-5 border-b last:border-b-0"
      style={{ borderColor: BORDER }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-8">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link
              href={`/portfolio/${entry.startup_id}`}
              className="text-base font-semibold tracking-tight transition-colors"
              style={{ color: "oklch(0.94 0.005 264)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = G;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)";
              }}
            >
              {entry.startup_name}
            </Link>
          </div>

          <InlineMeta items={headlineMeta} />

          {(entry.brief_description || entry.tagline) && (
            <p className="text-sm leading-relaxed max-w-2xl" style={{ color: MUTED }}>
              {entry.brief_description || entry.tagline}
            </p>
          )}

          {entry.goldilocks_alignment === "thin_signals" && (
            <p className="text-xs font-mono" style={{ color: AMBER }}>
              Goldilocks: maturity signals thin vs. entry GOD score.
            </p>
          )}

          <InlineMeta items={footMeta} />
        </div>

        <div className="md:text-right shrink-0 flex md:flex-col items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight" style={{ color: moicClr }}>
              {moic.toFixed(2)}×
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest mt-0.5" style={{ color: DIM }}>
              MOIC
            </div>
            {entry.irr_annualized != null && (
              <div className="text-xs font-mono mt-1" style={{ color: DIM }}>
                IRR {(entry.irr_annualized * 100).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            {entry.website && (
              <a
                href={entry.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors"
                style={{ color: MUTED }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = CYAN;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = MUTED;
                }}
              >
                Visit <ExternalLink size={10} />
              </a>
            )}
            <Link
              href={`/portfolio/${entry.startup_id}`}
              className="transition-colors"
              style={{ color: G }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "oklch(0.78 0.17 162.48)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = G;
              }}
            >
              Dossier →
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Portfolio() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "exited">("all");
  const [tierFilter, setTierFilter] = useState<"all" | HealthTier>("all");
  const [sortBy, setSortBy] = useState<"health" | "god">("health");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadData();
  }, [sortBy]);

  async function loadData() {
    setListLoading(true);
    setMetricsLoading(true);
    setError(null);

    fetch("/api/portfolio/metrics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load metrics"))))
      .then((metricsData) => setMetrics(metricsData.metrics ?? null))
      .catch(() => {})
      .finally(() => setMetricsLoading(false));

    fetch("/api/portfolio/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load analytics"))))
      .then((data) => setAnalytics(data ?? null))
      .catch(() => {});

    try {
      const sortQ = sortBy === "health" ? "health" : "god";
      const listRes = await fetch(`/api/portfolio?sort=${sortQ}&limit=80&lite=1`);
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

  const statStrip = metrics
    ? [
        {
          value: String(metrics.verified_funded_picks ?? 0),
          label: "Verified funded",
          sub: metrics.verified_funded_rate_pct ? `${metrics.verified_funded_rate_pct}% of picks` : undefined,
          accent: true,
        },
        {
          value: String(metrics.signal_funded_picks ?? Math.max(0, (metrics.funded_picks ?? 0) - (metrics.verified_funded_picks ?? 0))),
          label: "Signal funded",
          sub: metrics.funded_picks ? `${metrics.funded_picks} total detected` : undefined,
        },
        {
          value: String(metrics.successful_exits ?? 0),
          label: "Exited",
          sub: `${metrics.acquisitions ?? 0} acq · ${metrics.ipos ?? 0} IPO`,
        },
        {
          value: String(metrics.total_picks ?? 0),
          label: "Oracle picks",
          sub: `${metrics.active_picks ?? 0} active`,
        },
        {
          value: metrics.avg_moic ? `${metrics.avg_moic}×` : "—",
          label: "Avg MOIC",
          sub: "verified markups",
        },
        {
          value: fmtUSD(metrics.total_virtual_deployed_usd),
          label: "Virtual capital",
          sub: "$100K / pick",
        },
      ]
    : [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE, color: "oklch(0.94 0.005 264)" }}>
      <Helmet>
        <title>Oracle Portfolio — Pythh.ai</title>
        <meta
          name="description"
          content="Public scoreboard for the Pythh virtual fund — verified funded picks, GOD-tier tracking, and live portfolio signals."
        />
      </Helmet>

      <SharedNavbar activePath="/portfolio" />

      <main className="container max-w-5xl pt-24 pb-20 px-4 sm:px-6">
        {/* Hero */}
        <header className="mb-10 pb-10 border-b" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-3">Oracle scoreboard</SectionLabel>
          <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tight mb-3">
            The Oracle&apos;s Picks
          </h1>
          <p className="text-base max-w-2xl leading-relaxed" style={{ color: MUTED }}>
            Every startup crossing GOD 70 enters the virtual fund. We track funding, exits, and
            press-verified outcomes in public — proof the signal engine works.
          </p>
        </header>

        {/* Metrics strip */}
        {metricsLoading && !metrics ? (
          <div className="h-20 mb-10 animate-pulse rounded-lg" style={{ backgroundColor: CARD }} />
        ) : metrics ? (
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 mb-10 py-6 border-y divide-x divide-white/5"
            style={{ borderColor: BORDER }}
          >
            {statStrip.map((s) => (
              <div key={s.label} className="px-4 py-2 text-center first:pl-0">
                <div
                  className="font-display font-bold text-2xl md:text-3xl tabular-nums mb-1"
                  style={{ color: s.accent ? G : "oklch(0.94 0.005 264)" }}
                >
                  {s.value}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>
                  {s.label}
                </div>
                {s.sub && (
                  <div className="text-[10px] font-mono" style={{ color: DIM }}>
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Fund value — invested vs current value */}
        {analytics?.value && (
          <section className="mb-10 rounded-xl border px-5 md:px-6 py-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <SectionLabel className="mb-4">Fund value</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Invested</div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: "oklch(0.94 0.005 264)" }}>
                  {fmtUSD(analytics.value.cost_basis_usd)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>{analytics.value.positions} positions</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Current value</div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: "oklch(0.94 0.005 264)" }}>
                  {fmtUSD(analytics.value.current_value_usd)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                  {analytics.value.marked_positions} verified marks
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Net gain</div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: analytics.value.gain_usd >= 0 ? G : AMBER }}>
                  {fmtSignedUSD(analytics.value.gain_usd)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: analytics.value.gain_pct >= 0 ? G : AMBER }}>
                  {analytics.value.gain_pct >= 0 ? "+" : ""}{analytics.value.gain_pct}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>TVPI</div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: G }}>
                  {analytics.value.tvpi != null ? `${analytics.value.tvpi}×` : "—"}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                  {analytics.value.winners}W · {analytics.value.losers}L
                </div>
              </div>
            </div>
            {analytics.value.top_contributors?.length > 0 && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: BORDER }}>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: DIM }}>Top contributors</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {analytics.value.top_contributors.filter((c) => c.gain_usd > 0).slice(0, 5).map((c) => (
                    <Link key={c.startup_id} href={`/portfolio/${c.startup_id}`} className="text-xs font-mono transition-colors"
                      style={{ color: MUTED }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
                    >
                      {c.name} <span style={{ color: G }}>{fmtSignedUSD(c.gain_usd)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] font-mono mt-4" style={{ color: DIM }}>{analytics.value.note}</p>
          </section>
        )}

        {/* Benchmark + strategy + trend */}
        {analytics && (
          <div className="grid lg:grid-cols-2 gap-6 mb-12">
            {/* vs top VC */}
            <section className="rounded-xl border px-5 py-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
              <SectionLabel className="mb-4">vs. top VC benchmarks</SectionLabel>
              <div className="space-y-3">
                {analytics.benchmarks.rows.map((r) => (
                  <div key={r.metric} className="flex items-baseline justify-between gap-3 pb-3 border-b last:border-b-0 last:pb-0" style={{ borderColor: BORDER }}>
                    <div className="min-w-0">
                      <div className="text-sm" style={{ color: "oklch(0.90 0.005 264)" }}>{r.metric}</div>
                      <div className="text-[10px] font-mono" style={{ color: DIM }}>{r.benchmark}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono tabular-nums" style={{ color: "oklch(0.94 0.005 264)" }}>{r.oracle}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: verdictColor(r.verdict) }}>{r.verdict}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-mono mt-4" style={{ color: DIM }}>{analytics.benchmarks.source}</p>
            </section>

            {/* Strategy + trend */}
            <section className="rounded-xl border px-5 py-6 space-y-5" style={{ backgroundColor: CARD, borderColor: BORDER }}>
              <div>
                <SectionLabel className="mb-3">Strategy</SectionLabel>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{analytics.strategy.thesis}</p>
                {analytics.strategy.conviction_note && (
                  <p className="text-xs font-mono mt-3 border-l-2 pl-3" style={{ color: "oklch(0.85 0.005 264)", borderColor: `${G}66` }}>
                    {analytics.strategy.conviction_note}
                  </p>
                )}
                {analytics.strategy.top_sectors?.length > 0 && (
                  <InlineMeta
                    items={analytics.strategy.top_sectors.map((s) => ({ text: `${s.sector} ${s.pct}%`, color: CYAN }))}
                  />
                )}
              </div>
              <div className="pt-4 border-t" style={{ borderColor: BORDER }}>
                <SectionLabel className="mb-3">Trending right?</SectionLabel>
                <div className="space-y-2.5">
                  {analytics.trend.verdicts.map((v) => (
                    <div key={v.label} className="flex items-start gap-2">
                      <span className="text-sm font-mono mt-px shrink-0" style={{ color: v.ok ? G : AMBER }}>{v.ok ? "✓" : "!"}</span>
                      <div>
                        <div className="text-sm" style={{ color: "oklch(0.90 0.005 264)" }}>{v.label}</div>
                        <div className="text-xs" style={{ color: MUTED }}>{v.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Filters — inline text tabs */}
        <div className="space-y-4 mb-8 pb-6 border-b" style={{ borderColor: BORDER }}>
          <FilterTabs
            label="Status"
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setShowAll(false);
            }}
            options={[
              { id: "all", label: "All", count: entries.length },
              { id: "active", label: "Active", count: entries.filter((e) => e.status === "active").length },
              { id: "exited", label: "Exited", count: exits.length },
            ]}
          />
          <FilterTabs
            label="Tier"
            value={tierFilter}
            onChange={(t) => {
              setTierFilter(t);
              setShowAll(false);
            }}
            options={[
              { id: "all", label: "All tiers", count: entries.length },
              { id: "review", label: "Review", count: entries.filter((e) => e.health_tier === "review").length },
              { id: "watch", label: "Watch", count: entries.filter((e) => e.health_tier === "watch").length },
              { id: "core", label: "Core", count: entries.filter((e) => e.health_tier === "core").length },
              { id: "exited", label: "Exited tier", count: entries.filter((e) => e.health_tier === "exited").length },
            ]}
          />
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-[10px] font-mono uppercase tracking-widest w-14 shrink-0" style={{ color: DIM }}>
              Sort
            </span>
            <button
              type="button"
              onClick={() => setSortBy("health")}
              className="text-sm bg-transparent border-0 p-0 cursor-pointer"
              style={{
                color: sortBy === "health" ? "oklch(0.94 0.005 264)" : MUTED,
                textDecoration: sortBy === "health" ? "underline" : "none",
                textUnderlineOffset: "4px",
                textDecorationColor: G,
              }}
            >
              Health
            </button>
            <span style={{ color: "oklch(0.28 0.01 264)" }}>|</span>
            <button
              type="button"
              onClick={() => setSortBy("god")}
              className="text-sm bg-transparent border-0 p-0 cursor-pointer"
              style={{
                color: sortBy === "god" ? "oklch(0.94 0.005 264)" : MUTED,
                textDecoration: sortBy === "god" ? "underline" : "none",
                textUnderlineOffset: "4px",
                textDecorationColor: G,
              }}
            >
              GOD at entry
            </button>
          </div>
        </div>

        {/* List */}
        {listLoading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="py-5 border-b animate-pulse" style={{ borderColor: BORDER, height: 100 }} />
            ))}
          </div>
        ) : error ? (
          <p className="text-center py-24 text-sm font-mono" style={{ color: AMBER }}>
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-24 text-sm" style={{ color: MUTED }}>
            No entries yet — portfolio builds automatically as startups cross GOD 70.
          </p>
        ) : (
          <>
            <div className="rounded-xl border px-5 md:px-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
              {displayed.map((e) => (
                <PortfolioRow key={e.id} entry={e} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className="inline-flex items-center gap-2 text-sm font-mono bg-transparent border-0 cursor-pointer transition-colors"
                  style={{ color: G }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "oklch(0.78 0.17 162.48)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = G;
                  }}
                >
                  <ChevronDown size={14} className={showAll ? "rotate-180" : ""} />
                  {showAll ? "Show less" : `Show all ${filtered.length}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* How it works */}
        <section className="mt-16 pt-10 border-t" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-4">Methodology</SectionLabel>
          <h2 className="text-lg font-semibold mb-6">How the Oracle fund works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { step: "01", title: "GOD ≥ 70", desc: "Auto-added when a startup clears the investment-grade bar." },
              { step: "02", title: "$100K virtual", desc: "Logged at estimated entry valuation." },
              { step: "03", title: "Track everything", desc: "Rounds, leads, post-money, exits." },
              { step: "04", title: "Verify", desc: "Press-confirmed raises upgrade signal detections." },
              { step: "05", title: "Health tiers", desc: "Core · Watch · Review — momentum vs. maturity." },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-[10px] font-mono mb-2" style={{ color: CYAN }}>
                  {s.step}
                </div>
                <div className="text-sm font-medium mb-1">{s.title}</div>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
