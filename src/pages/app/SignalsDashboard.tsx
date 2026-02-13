import React, { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import ActionIntakeModalV2 from "@/components/ActionIntakeModalV2";
import useStartupScorecardV2 from "@/hooks/useStartupScorecardV2";

// Ensure the dashboard styles are loaded (safe even if also loaded globally)
import "@/styles/pythh-dashboard.css";

/**
 * PYTHH Dashboard (Supabase Dashboard canonical)
 * - No stage light backgrounds
 * - One primary object: "Your Edge"
 * - Right rail: Next / Blockers / Proof gate
 * - Two signature flares only:
 *    1) Title hairline + glyph
 *    2) One metric text glow (GOD score)
 */

type ScorecardV2 = {
  header?: {
    startupName?: string;
    cohortRank?: string; // "#1"
    windowLabel?: string; // "24h"
  };
  god?: { score?: number; delta?: number };
  signal?: { score?: number; delta?: number };
  verification?: {
    tier?: "unverified" | "soft" | "verified" | "trusted";
    score?: number; // 0..1
    blockers?: string[];
  };
  movers?: Array<{ label: string; direction: "up" | "down" | "flat"; note?: string }>;
};

function Badge({
  kind,
  children,
}: {
  kind: "good" | "warn" | "info";
  children: React.ReactNode;
}) {
  return <span className={`py-badge ${kind}`}>{children}</span>;
}

function fmtDelta(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

function fmtScore(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function tierLabel(t?: ScorecardV2["verification"]["tier"]) {
  if (!t) return "Unverified";
  if (t === "trusted") return "Trusted";
  if (t === "verified") return "Verified";
  if (t === "soft") return "Soft verified";
  return "Unverified";
}

function tierKind(t?: ScorecardV2["verification"]["tier"]): "good" | "warn" | "info" {
  if (t === "trusted" || t === "verified") return "good";
  if (t === "soft") return "info";
  return "warn";
}

function dirGlyph(d: "up" | "down" | "flat") {
  if (d === "up") return <span style={{ color: "rgba(52,211,153,.95)", fontWeight: 700 }}>↑</span>;
  if (d === "down") return <span style={{ color: "rgba(251,191,36,.95)", fontWeight: 700 }}>↓</span>;
  return <span style={{ color: "rgba(255,255,255,.45)", fontWeight: 700 }}>→</span>;
}

function useStartupIdFromQueryOrStorage() {
  const loc = useLocation();
  const [startupId, setStartupId] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(loc.search);
    const fromQuery = qs.get("startupId");
    const fromStorage = localStorage.getItem("pythh_startup_id");
    const id = (fromQuery ?? fromStorage ?? "").trim();
    setStartupId(id.length > 0 ? id : null);
  }, [loc.search]);

  // Keep storage in sync if query provides it
  useEffect(() => {
    const qs = new URLSearchParams(loc.search);
    const fromQuery = qs.get("startupId");
    if (fromQuery && fromQuery.trim().length > 0) {
      localStorage.setItem("pythh_startup_id", fromQuery.trim());
    }
  }, [loc.search]);

  return { startupId, setStartupId };
}

export default function Dashboard() {
  const { startupId } = useStartupIdFromQueryOrStorage();
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Hook (defensive usage — works even if hook returns slightly different shape)
  const scorecardHook: any = useStartupScorecardV2(startupId);
  const loading: boolean = !!scorecardHook?.loading;
  const error: string | null = scorecardHook?.error ?? null;
  const refresh = scorecardHook?.refresh ?? scorecardHook?.refreshScorecard ?? (() => {});
  const data: ScorecardV2 | null =
    (scorecardHook?.data as any) ??
    (scorecardHook?.scorecard as any) ??
    null;

  const startupName = data?.header?.startupName ?? "Your startup";
  const godScore = data?.god?.score;
  const godDelta = data?.god?.delta;
  const signalScore = data?.signal?.score;
  const signalDelta = data?.signal?.delta;

  const verificationTier = data?.verification?.tier;
  const verificationScore = data?.verification?.score;
  const blockers = data?.verification?.blockers ?? [];

  const movers = useMemo(() => {
    const m = data?.movers ?? [];
    // Keep it tight: max 3 lines
    return m.slice(0, 3);
  }, [data]);

  const hasStartup = !!startupId;

  // ── Onboarding / Getting Started (no startup linked yet) ──
  if (!hasStartup) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">

          {/* Intro */}
          <p className="text-sm text-zinc-400 leading-relaxed mb-10">
            Pythh matches your startup with the right investors using{' '}
            <span className="text-cyan-400">signal intelligence</span>. We scrape, score, and rank
            every investor in our network against your company — then give you a playbook
            for who to talk to, when, and what to say. Start by submitting your URL below.
          </p>

          {/* Get started */}
          <div className="border-b border-zinc-800/50 pb-8 mb-8">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Get started</div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Paste your company URL on the{' '}
              <Link to="/" className="text-cyan-400 hover:text-cyan-300 transition">home page</Link>
              . Pythh will automatically extract your company info, generate a GOD score, and start
              finding matching investors. It takes about 30 seconds. Everything below populates once
              your startup is in the system.
            </p>
          </div>

          {/* What you get */}
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-4">What you get</div>

          <div className="space-y-0">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[140px_1fr] gap-4 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
              <span>Section</span>
              <span>What it does</span>
            </div>

            {/* Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition">Dashboard</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Your command center. GOD score, signal strength, verification status, and what changed since your last visit.
                  Track score movements and get recommended next actions.
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  GOD Score — proprietary 0–100 rating of startup quality (team + traction + market + product + vision)
                </p>
              </div>
            </div>

            {/* Matches */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/signal-matches" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition">Matches</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Your personalized investor matchbook — ranked by signal alignment. Each match shows
                  why that investor fits your sector, stage, and thesis. Higher scores mean stronger alignment.
                </p>
              </div>
            </div>

            {/* Engine */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/engine" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition">Engine</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  See exactly how Pythh processes your data — website scraping, entity parsing, signal
                  generation, investor matching. The transparent view of the pipeline so you understand
                  how matches are produced.
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Inputs → Normalization → Signal Layer → Outputs
                </p>
              </div>
            </div>

            {/* Oracle */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/oracle" className="text-amber-400 hover:text-amber-300 text-sm font-medium transition">Oracle</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  AI-powered coaching. The Oracle runs a guided assessment, generates a personalized action plan,
                  and gives you strategic recommendations — VC strategy, cohort benchmarking, score predictions.
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Wizard → Actions → Cohorts → VC Strategy → Predictions → Coaching
                </p>
              </div>
            </div>

            {/* Signal Playbook */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/playbook" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition">Playbook</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Per-investor approach strategies. Timing, thesis alignment, warm paths, talking points,
                  conviction triggers — everything you need to run a tight outreach sequence.
                </p>
              </div>
            </div>

            {/* Pitch Signal Scan */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/pitch-scan" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition">Pitch Scan</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Five-dimension analysis of your pitch signal surface — narrative coherence, obsession density,
                  conviction-evidence ratio, fragility, and trajectory momentum. Shows where you're credible
                  and where you're exposed.
                </p>
              </div>
            </div>

            {/* Timing Map */}
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 px-2 py-4 border-b border-zinc-800/30">
              <Link to="/app/timing-map" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition">Timing Map</Link>
              <div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Your fundraising readiness dashboard. Tracks where you are in the process, what the market
                  looks like, and exactly what to do each week. Timing is the difference between a contested
                  round and a cold outreach graveyard.
                </p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-10 border-t border-zinc-800/50 pt-8">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-4">How it works</div>
            <div className="space-y-3 text-sm">
              <p className="text-zinc-400">
                <span className="text-zinc-300 font-medium mr-3">1</span>
                Submit your startup URL. We extract company data, score it, and generate matches automatically.
              </p>
              <p className="text-zinc-400">
                <span className="text-zinc-300 font-medium mr-3">2</span>
                Review your ranked investor matches. Each match includes why the investor is a fit and their investment focus.
              </p>
              <p className="text-zinc-400">
                <span className="text-zinc-300 font-medium mr-3">3</span>
                Use Oracle coaching and the Playbook to raise your score, sharpen your pitch, and run a tight fundraise.
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-600 mt-10 text-center">
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 transition">Submit your URL</Link> to get started — everything activates in about 30 seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-bg-dashboard" style={{ color: "var(--py-text)" }}>
      {/* Page (AppLayout already provides the nav) */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "22px 18px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <div className="py-kicker">app / dashboard</div>
            <div className="py-title-wrap">
              <h1 className="py-title">
                Dashboard
              </h1>
              <div className="py-hairline" />
            </div>
            <div className="py-subtitle">
              What changed, why it changed, and what to do next.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="py-btn primary"
              onClick={() => setIsReportOpen(true)}
            >
              ＋ Report action
            </button>
            <button className="py-btn" onClick={() => refresh?.()}>
              Refresh
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="py-dashboard-grid" style={{ display: "grid", gap: 14 }}>
          {/* MAIN LANE */}
          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* YOUR EDGE (PRIMARY OBJECT) */}
            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">your edge</div>

                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 750 }}>{startupName}</div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge kind={tierKind(verificationTier)}>{tierLabel(verificationTier)}</Badge>
                      <Badge kind="info">
                        Verification {typeof verificationScore === "number" ? verificationScore.toFixed(2) : "—"}
                      </Badge>
                      <Badge kind="info">Window {data?.header?.windowLabel ?? "24h"}</Badge>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div className="py-panel" style={{ borderRadius: 16 }}>
                      <div className="py-panel-inner" style={{ padding: 12, minWidth: 150 }}>
                        <div className="py-kicker">GOD</div>
                        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }} className="py-metric-glow">
                          {fmtScore(godScore)}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--py-muted)" }}>
                          Δ {fmtDelta(godDelta)}
                        </div>
                      </div>
                    </div>

                    <div className="py-panel" style={{ borderRadius: 16 }}>
                      <div className="py-panel-inner" style={{ padding: 12, minWidth: 150 }}>
                        <div className="py-kicker">Signal</div>
                        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 750 }}>
                          {fmtScore(signalScore)}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--py-muted)" }}>
                          Δ {fmtDelta(signalDelta)}
                        </div>
                      </div>
                    </div>

                    <div className="py-panel" style={{ borderRadius: 16 }}>
                      <div className="py-panel-inner" style={{ padding: 12, minWidth: 150 }}>
                        <div className="py-kicker">Rank</div>
                        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 750 }}>
                          {data?.header?.cohortRank ?? "—"}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--py-muted)" }}>
                          Cohort
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 13, color: "var(--py-muted)", lineHeight: 1.35 }}>
                  Actions create provisional deltas immediately. Proof upgrades verification and unlocks full lift + deeper matches.
                </div>

                {loading ? (
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--py-muted)" }}>Loading scorecard…</div>
                ) : error ? (
                  <div style={{ marginTop: 12, fontSize: 13, color: "rgba(251,191,36,.95)" }}>
                    {String(error)}
                  </div>
                ) : null}
              </div>
            </div>

            {/* WHAT CHANGED (tight, max 3 lines) */}
            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">what changed</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {movers.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--py-muted)" }}>
                      No movers yet. Report an action to create your first provisional delta.
                    </div>
                  ) : (
                    movers.map((m, idx) => (
                      <div key={`${m.label}-${idx}`} style={{ fontSize: 13, color: "rgba(255,255,255,.74)" }}>
                        {dirGlyph(m.direction)}{" "}
                        <span style={{ fontWeight: 650, color: "rgba(255,255,255,.86)" }}>{m.label}</span>
                        {m.note ? <span style={{ color: "var(--py-muted)" }}> — {m.note}</span> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* LIVE MATCH SNAPSHOT (compact strip) */}
            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">live match snapshot</div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "rgba(255,255,255,.74)" }}>
                  <span>Investor A <span style={{ fontWeight: 700 }}>91</span> <span style={{ color: "rgba(52,211,153,.95)" }}>↑</span></span>
                  <span style={{ color: "rgba(255,255,255,.28)" }}>|</span>
                  <span>Investor B <span style={{ fontWeight: 700 }}>88</span> <span style={{ color: "rgba(255,255,255,.55)" }}>→</span></span>
                  <span style={{ color: "rgba(255,255,255,.28)" }}>|</span>
                  <span>Investor C <span style={{ fontWeight: 700 }}>84</span> <span style={{ color: "rgba(52,211,153,.95)" }}>↑</span></span>
                  <span style={{ color: "rgba(255,255,255,.28)" }}>|</span>
                  <Link to="/app/matches" style={{ color: "rgba(219,234,254,.9)" }}>
                    Open matchbook →
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT RAIL */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">next actions</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "rgba(255,255,255,.74)" }}>
                  <div><span style={{ color: "rgba(255,255,255,.32)", marginRight: 8 }}>—</span>Report one meaningful action</div>
                  <div><span style={{ color: "rgba(255,255,255,.32)", marginRight: 8 }}>—</span>Attach one proof artifact</div>
                  <div><span style={{ color: "rgba(255,255,255,.32)", marginRight: 8 }}>—</span>Pick 5 rising matches</div>
                </div>
              </div>
            </div>

            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">blockers</div>
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {blockers.length === 0 ? (
                    <span style={{ fontSize: 13, color: "var(--py-muted)" }}>None detected.</span>
                  ) : (
                    blockers.slice(0, 6).map((b) => (
                      <span key={b} className="py-badge warn">{b}</span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">proof gate</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,.72)", lineHeight: 1.35 }}>
                  Evidence upgrades verification. Verification upgrades lift. Lift unlocks deeper investor detail.
                </div>
              </div>
            </div>

            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">shortcuts</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link to="/signals" style={{ color: "rgba(219,234,254,.9)", fontSize: 13 }}>Signals ledger →</Link>
                  <Link to="/app/signal-matches" style={{ color: "rgba(219,234,254,.9)", fontSize: 13 }}>Matchbook →</Link>
                  <Link to="/app/oracle" style={{ color: "#FFB402", fontSize: 13, fontWeight: 600 }}>Oracle — Signal Coaching →</Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Modal (gated) */}
      <ActionIntakeModalV2
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        startupId={startupId ?? ""}
        startupName={data?.header?.startupName ?? undefined}
        onSuccess={() => {
          // Keep it quiet: background refresh
          setIsReportOpen(false);
          refresh?.();
        }}
      />
    </div>
  );
}
