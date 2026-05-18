/**
 * Portfolio Company Detail — /portfolio/:startupId
 *
 * Full dossier: GOD score, health tier, MOIC, pillar scorecard,
 * signal timeline, deal positioning, and entry rationale.
 *
 * Data: /api/portfolio/:startupId  +  /api/intelligence/positioning/:startupId
 */

import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft, ExternalLink, TrendingUp, Zap, Users, Target,
  Package, Activity, Clock, AlertTriangle, ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  tagline?: string;
  website?: string;
  sectors?: string[];
  entry_date: string;
  entry_stage?: string;
  entry_god_score: number;
  current_god_score?: number;
  entry_valuation_usd?: number;
  current_valuation_usd?: number;
  virtual_check_usd: number;
  status: string;
  moic?: number;
  irr_annualized?: number;
  holding_days?: number;
  entry_rationale?: string;
  notes?: string;
  health_tier?: string;
  god_delta?: number;
  sector_god_percentile?: number;
  pillar_spread?: number;
  pillar_min?: number;
  events_last_180d?: number;
  days_since_last_event?: number;
  maturity_level?: string;
  maturity_score?: number;
  maturity_gaps?: string[];
  goldilocks_alignment?: string;
  goldilocks_maturity_gap?: number;
  in_goldilocks_god_zone?: boolean;
  exit_propensity_score?: number;
  exit_propensity_tier?: string;
  exit_propensity_confidence?: number;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  latest_round_type?: string;
  latest_round_post_money?: number;
  latest_lead_investor?: string;
  total_rounds_tracked?: number;
}

interface PortfolioEvent {
  id: string;
  event_type: string;
  event_date: string;
  amount_usd?: number;
  round_type?: string;
  lead_investor?: string;
  headline?: string;
  god_score_before?: number;
  god_score_after?: number;
  verified?: boolean;
}

interface DealPositioning {
  thesis_alignment: number;
  sector_fit: string;
  stage_fit: string;
  positioning_angle: string;
  key_signals: string[];
  suggested_subject: string;
  suggested_opening: string;
  investors?: { id: string; name: string; firm?: string; url?: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n?: number | null) {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

const G = "oklch(0.696 0.17 162.48)";
const DIM = "oklch(0.5 0.01 264)";
const BORDER = "oklch(0.25 0.01 264)";
const CARD_BG = "oklch(0.16 0.01 264)";

// ── Pillar bar ────────────────────────────────────────────────────────────────
function PillarBar({ label, score, icon: Icon, barColor }: { label: string; score?: number; icon: React.ElementType; barColor: string }) {
  const s = score ?? 0;
  const textColor = s >= 70 ? G : s >= 50 ? "oklch(0.769 0.188 70.08)" : "oklch(0.65 0.22 25)";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5" style={{ color: DIM }}>
          <Icon size={11} />{label}
        </span>
        <span className="font-semibold" style={{ color: textColor }}>{s}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.22 0.01 264)" }}>
        <div className="h-full rounded-full" style={{ width: `${s}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

// ── Event badge ───────────────────────────────────────────────────────────────
function EventBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    funding_round:     { label: "💰 Funding",    color: "oklch(0.696 0.17 162.48)" },
    god_score_change:  { label: "📊 GOD Score",  color: "oklch(0.65 0.15 220)" },
    acquisition:       { label: "🏢 Acquisition",color: "oklch(0.75 0.15 310)" },
    ipo:               { label: "📈 IPO",         color: "oklch(0.769 0.188 70.08)" },
    revenue_milestone: { label: "💵 Revenue",    color: "oklch(0.696 0.17 162.48)" },
    product_launch:    { label: "🚀 Launch",      color: "oklch(0.65 0.15 220)" },
    team_milestone:    { label: "👥 Team",        color: DIM },
    prediction_hit:    { label: "🎯 Prediction", color: "oklch(0.769 0.188 70.08)" },
  };
  const cfg = map[type] || { label: type, color: DIM };
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{ color: cfg.color, borderColor: `${cfg.color}55` }}
    >
      {cfg.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PortfolioDetail() {
  const params = useParams<{ startupId: string }>();
  const startupId = params?.startupId;

  const [entry, setEntry]       = useState<PortfolioEntry | null>(null);
  const [events, setEvents]     = useState<PortfolioEvent[]>([]);
  const [positioning, setPos]   = useState<DealPositioning[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [posExpanded, setPosExp] = useState(false);

  useEffect(() => {
    if (!startupId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/portfolio/${startupId}`).then((r) => r.json()),
      fetch(`/api/intelligence/positioning/${startupId}`).then((r) => r.json()).catch(() => ({ positioning: [] })),
    ])
      .then(([detail, pos]) => {
        setEntry(detail.entry || null);
        setEvents(detail.events || []);
        setPos(pos.positioning || []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
        <div className="flex flex-col items-center gap-3" style={{ color: DIM }}>
          <Activity size={24} className="animate-pulse" style={{ color: G }} />
          <span className="text-sm">Loading portfolio data…</span>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: "oklch(0.65 0.22 25)" }}>{error || "Company not found"}</p>
          <Link href="/portfolio" className="text-sm flex items-center gap-1 justify-center transition-colors" style={{ color: G }}>
            <ArrowLeft size={13} /> Back to portfolio
          </Link>
        </div>
      </div>
    );
  }

  const delta = entry.god_delta ?? 0;
  const tier  = entry.health_tier || "core";
  const moicDelta = (entry.moic ?? 1) - 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.94 0.005 264)" }}>
      {/* ── Nav ── */}
      <div className="sticky top-0 z-20 border-b" style={{ backgroundColor: "oklch(0.13 0.01 264 / 0.95)", borderColor: BORDER, backdropFilter: "blur(12px)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-sm transition-colors" style={{ color: DIM }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = G)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = DIM)}
          >
            <ArrowLeft size={14} /> Portfolio
          </Link>
          <span style={{ color: BORDER }}>/</span>
          <span className="text-sm font-semibold" style={{ color: "oklch(0.94 0.005 264)" }}>{entry.startup_name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-3xl font-display font-bold tracking-tight">{entry.startup_name}</h1>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: healthColor(tier), borderColor: `${healthColor(tier)}55` }}
              >
                {healthLabel(tier)}
              </span>
              {entry.entry_stage && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border" style={{ color: DIM, borderColor: BORDER }}>
                  {entry.entry_stage}
                </span>
              )}
            </div>
            {entry.tagline && <p className="text-sm max-w-xl" style={{ color: DIM }}>{entry.tagline}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: DIM }}>
              {entry.website && (
                <a href={entry.website} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 transition-colors"
                   style={{ color: DIM }}
                   onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = G)}
                   onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = DIM)}
                >
                  <ExternalLink size={10} /> {entry.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span className="flex items-center gap-1"><Clock size={10} /> Picked {fmtDate(entry.entry_date)}</span>
              {(entry.sectors ?? []).map((s) => (
                <span key={s} style={{ color: "oklch(0.65 0.15 220)" }}>{s}</span>
              ))}
            </div>
          </div>

          {/* MOIC */}
          <div className="text-right shrink-0">
            <div
              className="text-4xl font-bold tracking-tight"
              style={{ color: moicDelta > 0.05 ? G : moicDelta < -0.05 ? "oklch(0.65 0.22 25)" : "oklch(0.94 0.005 264)" }}
            >
              {(entry.moic ?? 1).toFixed(2)}×
            </div>
            <div className="text-xs mt-1" style={{ color: DIM }}>MOIC</div>
            {entry.irr_annualized != null && (
              <div className="text-xs mt-0.5" style={{ color: DIM }}>
                IRR {(entry.irr_annualized * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        {/* ── Goldilocks alignment ── */}
        {entry.goldilocks_alignment === "thin_signals" && (
          <div className="flex items-start gap-2 text-xs border-l-2 pl-3 py-1" style={{ color: "oklch(0.769 0.188 70.08)", borderColor: "oklch(0.769 0.188 70.08 / 0.6)" }}>
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>Goldilocks: maturity signals thin vs. what this GOD score implies. Review traction data freshness.</span>
          </div>
        )}
        {entry.goldilocks_alignment === "ahead_of_god" && (
          <div className="flex items-start gap-2 text-xs border-l-2 pl-3 py-1" style={{ color: "oklch(0.65 0.15 220)", borderColor: "oklch(0.65 0.15 220 / 0.5)" }}>
            <Zap size={12} className="mt-0.5 shrink-0" />
            <span>Maturity trajectory runs ahead of raw GOD score — richer signal history than the headline number.</span>
          </div>
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "GOD Score",       value: String(entry.current_god_score ?? entry.entry_god_score), sub: delta !== 0 ? `${delta > 0 ? "+" : ""}${delta} since entry` : "no change", color: delta > 0 ? G : delta < 0 ? "oklch(0.65 0.22 25)" : "oklch(0.94 0.005 264)" },
            { label: "Entry GOD",       value: String(entry.entry_god_score),           sub: `Entry: ${fmtUSD(entry.entry_valuation_usd)}`,  color: "oklch(0.94 0.005 264)" },
            { label: "Current Val",     value: fmtUSD(entry.current_valuation_usd),     sub: `Entry: ${fmtUSD(entry.entry_valuation_usd)}`,  color: "oklch(0.94 0.005 264)" },
            { label: "Exit Propensity", value: entry.exit_propensity_score ? `${entry.exit_propensity_score}/100` : "—", sub: entry.exit_propensity_tier || "—", color: entry.exit_propensity_score && entry.exit_propensity_score >= 80 ? G : "oklch(0.769 0.188 70.08)" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
              <div className="text-xs mb-1" style={{ color: DIM }}>{label}</div>
              <div className="text-xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "oklch(0.4 0.01 264)" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Pillar scorecard ── */}
        {(entry.team_score != null || entry.traction_score != null) && (
          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: DIM }}>Pillar Scorecard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PillarBar label="Team"     score={entry.team_score}     icon={Users}      barColor="oklch(0.65 0.15 220)" />
              <PillarBar label="Traction" score={entry.traction_score} icon={TrendingUp} barColor={G} />
              <PillarBar label="Market"   score={entry.market_score}   icon={Target}     barColor="oklch(0.769 0.188 70.08)" />
              <PillarBar label="Product"  score={entry.product_score}  icon={Package}    barColor="oklch(0.75 0.15 310)" />
            </div>
            {entry.pillar_spread != null && (
              <div className="mt-4 flex flex-wrap gap-4 text-xs" style={{ color: DIM }}>
                <span>Pillar spread: <span style={{ color: entry.pillar_spread > 40 ? "oklch(0.769 0.188 70.08)" : "oklch(0.94 0.005 264)" }}>{entry.pillar_spread} pts</span></span>
                {entry.sector_god_percentile != null && <span>Sector rank: <span style={{ color: "oklch(0.94 0.005 264)" }}>{entry.sector_god_percentile.toFixed(0)}th pct</span></span>}
                {entry.maturity_score != null && <span>Maturity score: <span style={{ color: "oklch(0.94 0.005 264)" }}>{entry.maturity_score}</span></span>}
              </div>
            )}
          </div>
        )}

        {/* ── Signal timeline ── */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: DIM }}>Signal Timeline</h2>
            <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <p className="text-sm italic" style={{ color: DIM }}>
              No portfolio events logged yet. Run <code className="text-xs px-1 rounded" style={{ backgroundColor: "oklch(0.2 0.01 264)", color: "oklch(0.7 0.01 264)" }}>npm run portfolio:refresh</code> to scan.
            </p>
          ) : (
            <div className="space-y-4">
              {events.map((ev) => (
                <div key={ev.id} className="flex gap-4 items-start">
                  <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: G }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <EventBadge type={ev.event_type} />
                      <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>{fmtDate(ev.event_date)}</span>
                      {ev.verified && <span className="text-xs" style={{ color: G }}>✓ verified</span>}
                    </div>
                    <p className="text-sm mt-1" style={{ color: "oklch(0.8 0.005 264)" }}>{ev.headline || ev.round_type}</p>
                    <div className="flex gap-3 mt-0.5 text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
                      {ev.amount_usd && <span>{fmtUSD(ev.amount_usd)}</span>}
                      {ev.lead_investor && <span>Led by {ev.lead_investor}</span>}
                      {ev.god_score_before != null && ev.god_score_after != null && (
                        <span>GOD {ev.god_score_before} → {ev.god_score_after}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Deal positioning ── */}
        {positioning.length > 0 && (
          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: DIM }}>
                Deal Positioning — {positioning.length} investors profiled
              </h2>
              <button
                onClick={() => setPosExp((x) => !x)}
                className="text-xs transition-colors"
                style={{ color: DIM }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = DIM)}
              >
                {posExpanded ? "Show less" : "Show all"}
              </button>
            </div>
            <div className="space-y-4">
              {(posExpanded ? positioning : positioning.slice(0, 3)).map((pos, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2" style={{ borderColor: BORDER }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm font-medium">
                      {pos.investors?.name || "Investor"}
                      {pos.investors?.firm && (
                        <span className="font-normal ml-2 text-xs" style={{ color: DIM }}>{pos.investors.firm}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                        style={{
                          color: pos.thesis_alignment >= 70 ? G : pos.thesis_alignment >= 50 ? "oklch(0.769 0.188 70.08)" : "oklch(0.65 0.22 25)",
                          borderColor: pos.thesis_alignment >= 70 ? `${G}55` : pos.thesis_alignment >= 50 ? "oklch(0.769 0.188 70.08 / 0.4)" : "oklch(0.65 0.22 25 / 0.4)",
                        }}
                      >
                        {pos.thesis_alignment}% thesis match
                      </span>
                      <span className="text-xs" style={{ color: DIM }}>{pos.sector_fit} / {pos.stage_fit}</span>
                    </div>
                  </div>
                  {pos.positioning_angle && (
                    <p className="text-sm italic" style={{ color: "oklch(0.65 0.15 220)" }}>"{pos.positioning_angle}"</p>
                  )}
                  {pos.suggested_subject && (
                    <div className="text-xs">
                      <span style={{ color: DIM }}>Subject: </span>
                      <span style={{ color: "oklch(0.8 0.005 264)" }}>{pos.suggested_subject}</span>
                    </div>
                  )}
                  {pos.key_signals?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {pos.key_signals.map((sig, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${G}15`, color: G }}>
                          ✓ {sig}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Entry rationale ── */}
        {(entry.entry_rationale || entry.notes) && (
          <div className="rounded-xl border p-6" style={{ backgroundColor: CARD_BG, borderColor: BORDER }}>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: DIM }}>Entry Rationale</h2>
            <p className="text-sm" style={{ color: "oklch(0.7 0.005 264)" }}>{entry.entry_rationale}</p>
            {entry.notes && <p className="text-xs mt-2" style={{ color: DIM }}>{entry.notes}</p>}
          </div>
        )}

        {/* ── Footer nav ── */}
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: BORDER }}>
          <Link href="/portfolio" className="text-sm flex items-center gap-1 transition-colors" style={{ color: DIM }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = G)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = DIM)}
          >
            <ArrowLeft size={13} /> Back to portfolio
          </Link>
          <Link href="/rankings" className="text-sm flex items-center gap-1 transition-colors" style={{ color: DIM }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = G)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = DIM)}
          >
            Rankings <ChevronRight size={13} />
          </Link>
        </div>

      </div>
    </div>
  );
}
