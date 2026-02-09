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
      <div className="py-bg-dashboard" style={{ color: "var(--py-text)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 18px 60px" }}>
          {/* Welcome header */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Welcome to Pythh
            </h1>
            <p style={{ marginTop: 8, fontSize: 15, color: "rgba(255,255,255,.55)", maxWidth: 520, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
              Pythh matches your startup with the right investors using signal intelligence.
              Here's how to get started and what each section does.
            </p>
          </div>

          {/* Step 1 — Submit your startup */}
          <div className="py-panel" style={{ marginBottom: 20 }}>
            <div className="py-panel-inner" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(6,182,212,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, fontWeight: 800, color: "rgb(6,182,212)" }}>
                  1
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>Submit your startup</div>
                  <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.5 }}>
                    Paste your company URL on the home page — Pythh will automatically extract your company info,
                    score your startup, and start finding matching investors. It takes about 30 seconds.
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <Link
                      to="/"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 20px",
                        borderRadius: 10,
                        background: "rgb(6,182,212)",
                        color: "#000",
                        fontWeight: 700,
                        fontSize: 14,
                        textDecoration: "none",
                      }}
                    >
                      Go to Home Page &amp; Submit URL →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* What each section does */}
          <div style={{ marginBottom: 16 }}>
            <div className="py-kicker" style={{ marginBottom: 6 }}>your tools</div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>What each section does</h2>
            <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.4 }}>
              Once you've submitted your startup, these sections will populate with live data.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
            {/* Dashboard */}
            <div className="py-panel">
              <div className="py-panel-inner" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    📊
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Dashboard</div>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.45 }}>
                  Your command center. See your startup's GOD score, signal strength, verification status,
                  and what changed since your last visit. Track score movements and get recommended next actions.
                </p>
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.35)" }}>
                  <strong style={{ color: "rgba(255,255,255,.5)" }}>GOD Score</strong> — Our proprietary 0–100 rating of startup quality (team + traction + market + product + vision).
                </div>
              </div>
            </div>

            {/* Matches */}
            <div className="py-panel">
              <div className="py-panel-inner" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    🎯
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Matches</div>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.45 }}>
                  Your personalized investor matchbook. See which VCs and angels are the best fit for your
                  startup, ranked by match score. Each match shows why that investor aligns with your sector,
                  stage, and thesis.
                </p>
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.35)" }}>
                  Higher match scores = stronger alignment between your startup and the investor's portfolio.
                </div>
              </div>
            </div>

            {/* Engine */}
            <div className="py-panel">
              <div className="py-panel-inner" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    ⚙️
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Engine</div>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.45 }}>
                  See exactly how Pythh processes your data — from website scraping to entity parsing to signal
                  generation to investor matching. This is the transparent view of our pipeline so you
                  understand how matches are produced.
                </p>
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.35)" }}>
                  Inputs → Normalization → Signal Layer → Outputs.
                </div>
              </div>
            </div>

            {/* Oracle */}
            <div className="py-panel">
              <div className="py-panel-inner" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,182,2,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    🔮
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#FFB402" }}>Oracle</div>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.45 }}>
                  AI-powered coaching to improve your investor readiness. The Oracle wizard walks you through
                  a guided assessment, generates a personalized action plan, and provides strategic recommendations
                  — including VC strategy, cohort benchmarking, and score predictions.
                </p>
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.35)" }}>
                  Wizard → Actions → Cohorts → VC Strategy → Predictions → Coaching.
                </div>
              </div>
            </div>
          </div>

          {/* Quick tips */}
          <div className="py-panel">
            <div className="py-panel-inner" style={{ padding: "18px 24px" }}>
              <div className="py-kicker" style={{ marginBottom: 8 }}>how it works</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>1. Submit</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>
                    Paste your startup URL. We extract company data, score it, and generate matches automatically.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>2. Review matches</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>
                    Browse your ranked investor matches. Each match includes why the investor is a fit and their investment focus.
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>3. Improve &amp; track</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>
                    Use Oracle coaching to raise your score. Report actions and attach proof to unlock stronger matches.
                  </p>
                </div>
              </div>
            </div>
          </div>
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
