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
import { parseDate, fetchJson } from "@/lib/dataFetch";

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
  early_positions?: number;
  entered_late_positions?: number;
  entered_late_value_usd?: number;
  entered_late_avg_moic?: number | null;
  marked_positions: number;
  quarantined_positions?: number;
  per_position_moic_cap?: number;
  fund_locked?: boolean;
  fund_lock_date?: string;
  cost_basis_usd: number;
  current_value_usd: number;
  signal_implied_value_usd: number;
  gain_usd: number;
  gain_pct: number;
  tvpi: number | null;
  avg_moic?: number | null;
  avg_moic_capped: number | null;
  avg_moic_early?: number | null;
  avg_moic_industry_avg?: number | null;
  realized_value_usd: number;
  unrealized_value_usd: number;
  inception_date: string | null;
  fund_age_days: number | null;
  avg_holding_days: number | null;
  median_holding_days: number | null;
  irr: number | null;
  irr_pct: number | null;
  irr_meaningful: boolean;
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

interface FollowOnValue {
  positions: number;
  marked_positions: number;
  check_size_usd: number;
  inception_date: string;
  deployed_usd: number;
  cost_basis_usd: number;
  current_value_usd: number;
  gain_usd: number;
  gain_pct: number;
  avg_moic: number | null;
  tvpi: number | null;
  projected_value_usd?: number;
  projected_moic?: number | null;
  projected_stepup?: number;
  per_position_moic_cap?: number;
  win_rate_pct?: number;
  top_contributors?: { name: string; moic: number; basis: string; gain_usd: number; entry_round_type?: string | null }[];
  note?: string;
}

interface SignalTrackRecord {
  flagged: number;
  unicorns_now: number;
  tier_500m_now: number;
  tier_100m_now: number;
  unicorn_hit_rate_pct: number;
  stepped_up_after_flag: number;
  caught_early_unicorns: number;
  median_lead_months: number | null;
  marquee: {
    name: string;
    first_flag_date: string | null;
    first_flag_valuation_usd: number;
    current_valuation_usd: number;
    multiple: number | null;
    lead_months: number | null;
    status: string;
  }[];
  note?: string;
}

interface SignalVelocity {
  window_days: number;
  tiers: { min_index: number; multiple: number; label: string }[];
  positions_scored: number;
  avg_velocity_index: number;
  accelerating_count: number;
  hot_count: number;
  tier_counts: Record<string, number>;
  honest_value_usd: number;
  momentum_implied_value_usd: number;
  momentum_uplift_usd: number;
  momentum_uplift_pct: number;
  top_movers: {
    name: string;
    velocity_index: number;
    momentum_multiple: number;
    tier: string;
    accelerating: boolean;
    signal_level: number;
    honest_value_usd: number;
    momentum_value_usd: number;
    uplift_usd: number;
  }[];
  note?: string;
}

interface PortfolioAnalytics {
  value: PortfolioValue;
  follow_on?: FollowOnValue | null;
  signal?: SignalTrackRecord | null;
  velocity?: SignalVelocity | null;
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

function fmtAge(days?: number | null) {
  if (days == null) return "—";
  if (days < 60) return `${days}d`;
  if (days < 730) return `${(days / 30.44).toFixed(1)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}

function fmtIRR(v?: { irr_pct: number | null; irr_meaningful: boolean }) {
  if (!v || v.irr_pct == null) return "—";
  if (v.irr_pct >= 1000) return ">1000%";
  return `${v.irr_pct >= 0 ? "+" : ""}${v.irr_pct}%`;
}

function fmtDate(s?: string | null) {
  const d = parseDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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

function Collapsible({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 md:px-6 py-4 bg-transparent border-0 cursor-pointer text-left"
      >
        <span className="flex items-baseline gap-3 min-w-0">
          <SectionLabel>{title}</SectionLabel>
          {!open && summary && (
            <span className="text-xs font-mono truncate" style={{ color: MUTED }}>
              {summary}
            </span>
          )}
        </span>
        <ChevronDown
          size={15}
          className={open ? "rotate-180" : ""}
          style={{ color: G, transition: "transform 0.2s", flexShrink: 0 }}
        />
      </button>
      {open && <div className="px-5 md:px-6 pb-6">{children}</div>}
    </section>
  );
}

export default function Portfolio() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "exited">("all");
  const [tierFilter, setTierFilter] = useState<"all" | HealthTier>("all");
  const [sortBy, setSortBy] = useState<"health" | "god">("health");
  const [showAll, setShowAll] = useState(false);
  const [panels, setPanels] = useState({ value: false, bench: false, strategy: false });
  const togglePanel = (k: "value" | "bench" | "strategy") =>
    setPanels((p) => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    loadData();
  }, [sortBy]);

  async function loadData() {
    setListLoading(true);
    setMetricsLoading(true);
    setSlowHint(false);
    setError(null);

    // Surface a "still loading" hint if a cold backend is slow to wake.
    const slowTimer = setTimeout(() => setSlowHint(true), 6000);

    fetchJson<{ metrics: PortfolioMetrics | null }>("/api/portfolio/metrics")
      .then((metricsData) => setMetrics(metricsData.metrics ?? null))
      .catch(() => {})
      .finally(() => setMetricsLoading(false));

    fetchJson<PortfolioAnalytics>("/api/portfolio/analytics")
      .then((data) => setAnalytics(data ?? null))
      .catch(() => {});

    try {
      const sortQ = sortBy === "health" ? "health" : "god";
      const listData = await fetchJson<{ entries?: PortfolioEntry[] }>(
        `/api/portfolio?sort=${sortQ}&limit=80&lite=1`
      );
      setEntries(listData.entries ?? []);
    } catch {
      setError("Portfolio is taking longer than usual to load. Please refresh in a moment.");
    } finally {
      clearTimeout(slowTimer);
      setSlowHint(false);
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
          value:
            analytics?.value.avg_moic != null
              ? `${analytics.value.avg_moic}×`
              : analytics?.value.avg_moic_capped != null
              ? `${analytics.value.avg_moic_capped}×`
              : "—",
          benchmark: analytics?.value.avg_moic_industry_avg
            ? `${analytics.value.avg_moic_industry_avg}×`
            : undefined,
          label: "Avg MOIC",
          valueColor: G, // seed fund = green
          sub: analytics
            ? `seed · blended · capped ${analytics.value?.per_position_moic_cap ?? 50}× · [ ] = industry avg`
            : "loading fund analytics…",
        },
        {
          value:
            analytics?.follow_on && analytics.follow_on.positions > 0 && analytics.follow_on.avg_moic != null
              ? `${analytics.follow_on.avg_moic}×`
              : "—",
          label: "Follow-on MOIC",
          valueColor: CYAN, // follow-on (late-stage) fund = cyan, matches its fund block
          sub:
            analytics?.follow_on && analytics.follow_on.positions > 0
              ? `late-stage · ${analytics.follow_on.positions} bets · $500K / round`
              : "forward-only · fills as winners raise",
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
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-0 mb-10 py-6 border-y divide-x divide-white/5"
            style={{ borderColor: BORDER }}
          >
            {statStrip.map((s) => (
              <div key={s.label} className="px-4 py-2 text-center first:pl-0">
                <div
                  className="font-display font-bold text-2xl md:text-3xl tabular-nums mb-1"
                  style={{ color: s.valueColor || (s.accent ? G : "oklch(0.94 0.005 264)") }}
                >
                  {s.value}
                  {s.benchmark && (
                    <span className="ml-1 text-sm md:text-base font-mono font-normal" style={{ color: DIM }}>
                      [{s.benchmark}]
                    </span>
                  )}
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

        {/* Signal track record — the predictive hit-rate proof (timestamped foresight) */}
        {analytics?.signal && analytics.signal.flagged > 0 && (
          <div className="mb-10 rounded-lg border p-6" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-[11px] font-mono uppercase tracking-widest" style={{ color: CYAN }}>
                Signal track record · predictive foresight
              </div>
              <div className="text-[10px] font-mono" style={{ color: DIM }}>timestamped first-flag → verified valuation</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-5">
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: CYAN }}>
                  {analytics.signal.unicorns_now}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Unicorns flagged</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>now worth ≥ $1B</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: CYAN }}>
                  {analytics.signal.unicorn_hit_rate_pct}%
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Unicorn hit rate</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>{analytics.signal.flagged} flagged · {analytics.signal.tier_500m_now} ≥ $500M</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: G }}>
                  {analytics.signal.median_lead_months != null ? `${analytics.signal.median_lead_months}mo` : "—"}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Median lead time</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>before today&apos;s valuation</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: G }}>
                  {analytics.signal.caught_early_unicorns}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Caught pre-markup</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>unicorns up since flag</div>
              </div>
            </div>
            {analytics.signal.marquee.length > 0 && (
              <div className="pt-4 border-t" style={{ borderColor: BORDER }}>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: DIM }}>Marquee picks · flagged → today</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {analytics.signal.marquee.map((c) => (
                    <span key={c.name} className="text-xs font-mono" style={{ color: MUTED }}>
                      {c.name}{" "}
                      <span style={{ color: DIM }}>{c.first_flag_date?.slice(0, 7)}</span>{" "}
                      <span style={{ color: (c.multiple ?? 1) > 1.05 ? G : "oklch(0.85 0.005 264)" }}>
                        {fmtUSD(c.current_valuation_usd)}
                        {(c.multiple ?? 1) > 1.05 ? ` ${c.multiple}×` : ""}
                      </span>
                      {c.status === "acquired" || c.status === "ipo" ? <span style={{ color: CYAN }}> · exit</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {analytics.signal.note && (
              <p className="text-[10px] font-mono mt-4" style={{ color: DIM }}>{analytics.signal.note}</p>
            )}
          </div>
        )}

        {/* Signal velocity — momentum index → valuation multiple (forward-looking) */}
        {analytics?.velocity && analytics.velocity.positions_scored > 0 && (
          <div className="mb-10 rounded-lg border p-6" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="flex items-baseline justify-between mb-4">
              <div className="text-[11px] font-mono uppercase tracking-widest" style={{ color: AMBER }}>
                Signal velocity · momentum premium
              </div>
              <div className="text-[10px] font-mono" style={{ color: DIM }}>indexed across {analytics.velocity.positions_scored} companies · {analytics.velocity.window_days}d window</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-5">
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: AMBER }}>
                  {analytics.velocity.accelerating_count}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Accelerating</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>signals up vs prior {analytics.velocity.window_days}d</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: AMBER }}>
                  {analytics.velocity.hot_count}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Hot (index ≥ 70)</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>top of the velocity index</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: "oklch(0.90 0.005 264)" }}>
                  {fmtUSD(analytics.velocity.momentum_implied_value_usd)}
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Momentum-implied*</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>from {fmtUSD(analytics.velocity.honest_value_usd)} honest</div>
              </div>
              <div>
                <div className="font-display font-bold text-2xl md:text-3xl tabular-nums" style={{ color: G }}>
                  +{analytics.velocity.momentum_uplift_pct}%
                </div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>Momentum uplift</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>{fmtSignedUSD(analytics.velocity.momentum_uplift_usd)}</div>
              </div>
            </div>

            {/* velocity → multiple tier mapping */}
            <div className="pt-4 border-t" style={{ borderColor: BORDER }}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: DIM }}>Velocity index → multiple</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {analytics.velocity.tiers.map((t) => (
                  <span key={t.label} className="text-xs font-mono" style={{ color: MUTED }}>
                    <span style={{ color: DIM }}>≥{t.min_index}</span>{" "}
                    <span style={{ color: t.multiple > 1 ? AMBER : DIM }}>{t.multiple}×</span>{" "}
                    <span style={{ color: DIM }}>{t.label}</span>
                    {analytics.velocity!.tier_counts[t.label] != null ? (
                      <span style={{ color: DIM }}> ({analytics.velocity!.tier_counts[t.label]})</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>

            {analytics.velocity.top_movers.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: BORDER }}>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: DIM }}>Top movers · velocity index → momentum value</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {analytics.velocity.top_movers.map((c) => (
                    <span key={c.name} className="text-xs font-mono" style={{ color: MUTED }}>
                      {c.accelerating ? <span style={{ color: G }}>▲ </span> : null}
                      {c.name}{" "}
                      <span style={{ color: DIM }}>idx {c.velocity_index}</span>{" "}
                      <span style={{ color: AMBER }}>{c.momentum_multiple}×</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {analytics.velocity.note && (
              <p className="text-[10px] font-mono mt-4" style={{ color: AMBER }}>
                *Momentum-implied = forward premium applying the velocity multiple to each position&apos;s honest current value. Not realized; never mixed into booked MOIC.
              </p>
            )}
          </div>
        )}

        {/* Fund analytics — collapsible to keep the portfolio list above the fold */}
        {analytics?.value && (
          <div className="space-y-3 mb-10">
          <Collapsible
            title="Fund value"
            open={panels.value}
            onToggle={() => togglePanel("value")}
            summary={
              <>
                {fmtUSD(analytics.value.cost_basis_usd)} → {fmtUSD(analytics.value.current_value_usd)} ·{" "}
                <span style={{ color: analytics.value.gain_usd >= 0 ? G : AMBER }}>{fmtSignedUSD(analytics.value.gain_usd)}</span> ·{" "}
                {analytics.value.tvpi != null ? `${analytics.value.tvpi}×` : "—"} TVPI
              </>
            }
          >
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
                  {analytics.value.marked_positions} above cost
                  {analytics.value.entered_late_positions
                    ? ` · ${analytics.value.entered_late_positions} entered-late`
                    : ""}
                  {analytics.value.quarantined_positions
                    ? ` · ${analytics.value.quarantined_positions} held (re-sourcing)`
                    : ""}
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
            {/* Fund timing: vintage, IRR, realized/unrealized split */}
            <div className="mt-5 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-6" style={{ borderColor: BORDER }}>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Fund age</div>
                <div className="text-base font-bold font-mono tabular-nums" style={{ color: "oklch(0.90 0.005 264)" }}>
                  {fmtAge(analytics.value.fund_age_days)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                  avg hold {fmtAge(analytics.value.avg_holding_days)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>IRR (annualized)</div>
                <div className="text-base font-bold font-mono tabular-nums" style={{ color: analytics.value.irr_meaningful ? G : MUTED }}>
                  {fmtIRR(analytics.value)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                  {analytics.value.irr_meaningful ? "money-weighted" : "money-weighted · unverified"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Realized</div>
                <div className="text-base font-bold font-mono tabular-nums" style={{ color: "oklch(0.90 0.005 264)" }}>
                  {fmtUSD(analytics.value.realized_value_usd)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>DPI {analytics.value.cost_basis_usd ? (analytics.value.realized_value_usd / analytics.value.cost_basis_usd).toFixed(2) : "—"}×</div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Unrealized</div>
                <div className="text-base font-bold font-mono tabular-nums" style={{ color: "oklch(0.90 0.005 264)" }}>
                  {fmtUSD(analytics.value.unrealized_value_usd)}
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>paper marks</div>
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

            {/* Secondary fund: late-stage follow-on ("double down" on winners) */}
            {analytics.follow_on && (
              <div className="mt-6 pt-5 border-t" style={{ borderColor: BORDER }}>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[11px] font-mono uppercase tracking-widest" style={{ color: CYAN }}>
                    Follow-on fund · late-stage
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: DIM }}>$500K / round · forward-only</div>
                </div>
                {analytics.follow_on.positions > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Bets</div>
                        <div className="text-base font-bold font-mono tabular-nums" style={{ color: "oklch(0.90 0.005 264)" }}>
                          {analytics.follow_on.positions}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>{fmtUSD(analytics.follow_on.deployed_usd)} deployed</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Current value</div>
                        <div className="text-base font-bold font-mono tabular-nums" style={{ color: "oklch(0.90 0.005 264)" }}>
                          {fmtUSD(analytics.follow_on.current_value_usd)}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>{analytics.follow_on.marked_positions} above cost</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Follow-on MOIC</div>
                        <div className="text-base font-bold font-mono tabular-nums" style={{ color: G }}>
                          {analytics.follow_on.avg_moic != null ? `${analytics.follow_on.avg_moic}×` : "—"}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>since follow-on entry</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>TVPI</div>
                        <div className="text-base font-bold font-mono tabular-nums" style={{ color: G }}>
                          {analytics.follow_on.tvpi != null ? `${analytics.follow_on.tvpi}×` : "—"}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>net {fmtSignedUSD(analytics.follow_on.gain_usd)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>Projected*</div>
                        <div className="text-base font-bold font-mono tabular-nums" style={{ color: AMBER }}>
                          {analytics.follow_on.projected_moic != null ? `${analytics.follow_on.projected_moic}×` : "—"}
                        </div>
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                          {analytics.follow_on.projected_value_usd != null ? fmtUSD(analytics.follow_on.projected_value_usd) : "—"} next round
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] font-mono mt-3" style={{ color: AMBER }}>
                      *Projected = forward estimate applying a conservative {analytics.follow_on.projected_stepup ?? 2}× median late-stage step-up to active positions only. Not realized. Realized exits & write-offs excluded.
                    </p>
                    {analytics.follow_on.top_contributors && analytics.follow_on.top_contributors.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
                        {analytics.follow_on.top_contributors.filter((c) => c.gain_usd > 0).slice(0, 5).map((c) => (
                          <span key={c.name} className="text-xs font-mono" style={{ color: MUTED }}>
                            {c.name} <span style={{ color: G }}>{c.moic}×</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
                <p className="text-[10px] font-mono mt-4" style={{ color: DIM }}>{analytics.follow_on.note}</p>
              </div>
            )}
          </Collapsible>

          {/* vs top VC */}
          <Collapsible
            title="vs. top VC benchmarks"
            open={panels.bench}
            onToggle={() => togglePanel("bench")}
            summary={
              <>
                {analytics.value.tvpi != null ? `${analytics.value.tvpi}×` : "—"} TVPI ·{" "}
                {analytics.benchmarks.rows.filter((r) => r.verdict === "ahead").length} of{" "}
                {analytics.benchmarks.rows.length} ahead
              </>
            }
          >
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
          </Collapsible>

          {/* Strategy + trend */}
          <Collapsible
            title="Strategy"
            open={panels.strategy}
            onToggle={() => togglePanel("strategy")}
            summary={
              <>
                {analytics.strategy.entry_rule}
                {analytics.strategy.top_sectors?.[0]
                  ? ` · ${analytics.strategy.top_sectors[0].sector} ${analytics.strategy.top_sectors[0].pct}%`
                  : ""}
              </>
            }
          >
            <div className="space-y-5">
              <div>
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
            </div>
          </Collapsible>
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
            {slowHint && (
              <p className="text-center pb-6 text-xs font-mono" style={{ color: DIM }}>
                Waking the signal engine… this can take a few seconds on first load.
              </p>
            )}
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
              { step: "02", title: "$100K virtual", desc: "Logged at an assumed seed entry (~$12M)." },
              { step: "03", title: "Signal accretion", desc: "Rounds, partnerships, customers, hires, IP mark it up." },
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
