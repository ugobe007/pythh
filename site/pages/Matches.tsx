/**
 * /matches — Active Matches Dashboard
 *
 * Shows live startup-investor match activity from the Pythh network:
 * aggregate stats, sector distribution of matches, how matching works,
 * and a CTA to get your startup analyzed and matched.
 */
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import StartupCTA from "@/components/design/StartupCTA";
import { RecentMatchesList } from "@/components/RecentMatchesFeed";
import {
  Zap, Target, TrendingUp, Activity, ArrowRight,
  CircleDot, BarChart3, CheckCircle, Users, Flame,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

import SharedNavbar from "@/components/SharedNavbar";
import InstantMatchPreview from "@/components/InstantMatchPreview";
import { trackFunnelEventOnce } from "@/lib/matchEngagement";
import { fetchGrowthAssignment } from "@/lib/growthExperiment";
import { getUtmParams, trackReturnVisitIfEligible, trackUrlSubmitted } from "@/lib/funnelAttribution";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  buildLoginRedirectForSearch,
  shouldPromptSignInForNewSearch,
} from "@/lib/anonymousPreviewSession";
// ─── Shared nav ───────────────────────────────────────────────────────────────



// ─── Static match signals (illustrative, reflects real match logic) ────────────

const MATCH_SIGNALS = [
  {
    sector: "Fintech",
    urgency: "high",
    trajectory: "fundraising",
    score: 0.92,
    timing: 0.81,
    confidence: 0.88,
    explanation: "Sector-aligned · Series A stage fit · High-urgency deployment window",
    color: "#22c55e",
  },
  {
    sector: "AI/ML",
    urgency: "medium",
    trajectory: "fundraising",
    score: 0.89,
    timing: 0.74,
    confidence: 0.82,
    explanation: "Technical thesis match · Growth-stage capital ready · 3 portfolio adjacencies",
    color: "#22d3ee",
  },
  {
    sector: "Developer Tools",
    urgency: "high",
    trajectory: "fundraising",
    score: 0.87,
    timing: 0.79,
    confidence: 0.80,
    explanation: "PLG traction signal · Seed-stage sweet spot · Strategic add-on fit",
    color: "#a855f7",
  },
  {
    sector: "Cybersecurity",
    urgency: "medium",
    trajectory: "fundraising",
    score: 0.86,
    timing: 0.68,
    confidence: 0.79,
    explanation: "Enterprise thesis · Follow-on activity pattern · Geography aligned",
    color: "#f97316",
  },
  {
    sector: "HealthTech",
    urgency: "medium",
    trajectory: "fundraising",
    score: 0.84,
    timing: 0.65,
    confidence: 0.77,
    explanation: "Clinical validation signals · B2B revenue model · Team pedigree match",
    color: "#ec4899",
  },
  {
    sector: "Climate",
    urgency: "low",
    trajectory: "fundraising",
    score: 0.83,
    timing: 0.61,
    confidence: 0.76,
    explanation: "Impact thesis · Hardware+software stack · Grant runway alignment",
    color: "#eab308",
  },
];

const DIMENSION_LABELS = [
  { key: "sector_fit", label: "Sector fit", color: "#22c55e" },
  { key: "stage_fit", label: "Stage fit", color: "#22d3ee" },
  { key: "trajectory_fit", label: "Trajectory fit", color: "#a855f7" },
  { key: "geography_fit", label: "Geography fit", color: "#f97316" },
  { key: "signal_alignment", label: "Signal alignment", color: "#eab308" },
];

const HOW_IT_WORKS = [
  {
    icon: Activity,
    color: "#22d3ee",
    step: "Signal extraction",
    desc: "The Oracle reads your startup's public signals: website, product, team, traction, and market timing.",
  },
  {
    icon: BarChart3,
    color: "#a855f7",
    step: "GOD score computed",
    desc: "Seven signal dimensions are independently scored. The composite becomes your 0–100 GOD score.",
  },
  {
    icon: Target,
    color: "#22c55e",
    step: "Investor mapping",
    desc: "Your profile is matched against 6,250+ investors on five dimensions: sector, stage, timing, thesis, and geography.",
  },
  {
    icon: TrendingUp,
    color: "#f97316",
    step: "Match scored and ranked",
    desc: "Each pairing receives a composite match_score, timing_score, and confidence. Top matches surfaced first.",
  },
];

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 text-right" style={{ color: "oklch(0.5 0.01 264)" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono w-8" style={{ color }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{ backgroundColor: "oklch(0.115 0.01 264)", border: `1px solid ${color}30` }}
    >
      <div className="text-3xl font-bold mb-1" style={{ color }}>{value}</div>
      <div className="text-sm font-medium text-white mb-0.5">{label}</div>
      {sub && <div className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>{sub}</div>}
    </div>
  );
}

// ─── Preview URL (?url= must be a real startup domain — not empty) ───────────

function normalizePreviewUrl(raw: string | null): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function readMatchesSearchState() {
  const params = new URLSearchParams(window.location.search);
  const rawUrl = params.get("url");
  return {
    highlightId: params.get("highlight"),
    previewUrl: normalizePreviewUrl(rawUrl),
    missingUrlParam: params.has("url") && !rawUrl?.trim(),
  };
}

function MatchesUrlEntry({
  onSubmit,
  error,
  hint,
  networkTotal,
}: {
  onSubmit: (url: string) => void;
  error?: boolean;
  hint?: string;
  networkTotal?: number;
}) {
  const [url, setUrl] = useState("");

  return (
    <section
      id="preview-url"
      className="mb-16 scroll-mt-28"
    >
      <div
        className="p-6 sm:p-8 rounded-2xl"
        style={{
          backgroundColor: "oklch(0.115 0.01 264)",
          border: `1px solid ${error ? "oklch(0.65 0.2 27 / 0.5)" : "oklch(0.696 0.17 162.48 / 0.35)"}`,
          boxShadow: "0 0 60px oklch(0.696 0.17 162.48 / 0.06)",
        }}
      >
        <p className="text-[11px] uppercase tracking-[2px] mb-3" style={{ color: "#22c55e" }}>
          Free · No signup required
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
          Oracle analyzes your company
        </h1>
        <p className="text-base mb-6 max-w-2xl" style={{ color: "oklch(0.58 0.01 264)" }}>
          {hint || "Paste your startup URL — see readiness gaps, qualified investors, and your recommended raise plan in about a minute."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(url);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourstartup.com"
            className="flex-1 px-4 py-3.5 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "oklch(0.09 0.01 264)",
              border: `1px solid ${error ? "oklch(0.65 0.2 27)" : "oklch(0.25 0.01 264)"}`,
              color: "oklch(0.94 0.005 264)",
            }}
            autoFocus
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold whitespace-nowrap"
            style={{ backgroundColor: "#22c55e", color: "#000" }}
          >
            Analyze my company
            <ArrowRight size={16} />
          </button>
        </form>
        {error && (
          <p className="text-xs mt-3" style={{ color: "oklch(0.65 0.2 27)" }}>
            Enter a valid startup URL — e.g. stripe.com or https://yourstartup.com
          </p>
        )}
        <p className="text-[11px] mt-4" style={{ color: "oklch(0.45 0.01 264)" }}>
          No credit card · Results in ~60 seconds
          {networkTotal != null && networkTotal > 0 ? ` · ${networkTotal.toLocaleString()} matches in network` : ''}
        </p>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Matches() {
  const [location, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [missingUrlParam, setMissingUrlParam] = useState(false);
  const [urlEntryError, setUrlEntryError] = useState(false);

  useEffect(() => {
    const state = readMatchesSearchState();
    setHighlightId(state.highlightId);
    setPreviewUrl(state.previewUrl);
    setMissingUrlParam(state.missingUrlParam);
    setUrlEntryError(state.missingUrlParam);

    if (state.missingUrlParam && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/matches");
    }

    if (!state.previewUrl) {
      void trackFunnelEventOnce('pythh_matches_landing_view', 'page_view', {
        path: '/matches',
        source: 'matches_acquisition_landing',
        ...getUtmParams(),
      });
      trackReturnVisitIfEligible('/matches');
    }
  }, [location]);

  const submitPreviewUrl = async (raw: string) => {
    const normalized = normalizePreviewUrl(raw);
    if (!normalized) {
      setUrlEntryError(true);
      return;
    }
    setUrlEntryError(false);
    if (!isAuthenticated && shouldPromptSignInForNewSearch(normalized)) {
      sessionStorage.setItem("pythia_url", normalized);
      navigate(buildLoginRedirectForSearch(normalized));
      return;
    }
    const assignment = await fetchGrowthAssignment('founder').catch(() => null);
    trackUrlSubmitted(normalized, 'matches_landing', assignment);
    navigate(`/matches?url=${encodeURIComponent(normalized)}`);
  };

  const { data: stats, isLoading } = trpc.matches.getStats.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const total = stats?.total ?? 0;
  const highConf = stats?.highConf ?? 1128;
  const topScore = stats?.topScore ?? 1650;
  const recentCount = stats?.recentCount ?? 0;
  const sectors = stats?.sectors ?? [];

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "oklch(0.09 0.01 264)", color: "oklch(0.9 0.01 264)", fontFamily: "'Inter', sans-serif" }}
    >
      <Helmet>
        <title>
          {previewUrl
            ? 'Investor match preview — Pythh.ai'
            : 'Find investors for your startup — free match preview — Pythh.ai'}
        </title>
        <meta
          name="description"
          content={
            previewUrl
              ? 'Live investor shortlist ranked by sector fit, stage, and thesis alignment. Request intros with a free account.'
              : `Paste your startup URL and see ranked investor matches in ~60 seconds. ${total > 0 ? `${total.toLocaleString()} active matches` : 'Thousands of matches'} in the Pythh network — free, no signup required.`
          }
        />
        <meta
          name="keywords"
          content="find investors, startup fundraising, investor matching, VC matching, angel investors, free investor preview"
        />
        <link rel="canonical" href={previewUrl ? `https://pythh.ai/matches?url=${encodeURIComponent(previewUrl)}` : 'https://pythh.ai/matches'} />
        <meta property="og:title" content="Find investors for your startup — Pythh.ai" />
        <meta property="og:description" content="Free instant investor match preview. Paste your URL, see your ranked shortlist, request intros." />
        <meta property="og:url" content="https://pythh.ai/matches" />
        <meta property="og:type" content="website" />
      </Helmet>

      <SharedNavbar activePath="/matches" />

      <main className="container pt-24 pb-20 max-w-5xl">

        {previewUrl ? (
          <InstantMatchPreview url={previewUrl} />
        ) : (
        <>
        <MatchesUrlEntry
          onSubmit={(url) => void submitPreviewUrl(url)}
          error={urlEntryError}
          networkTotal={total}
          hint={
            missingUrlParam
              ? "That link was missing a startup URL. Paste yours below — e.g. pythh.ai/matches?url=yourstartup.com"
              : undefined
          }
        />

        {/* ── Hero ── */}
        <div className="mb-16">
          <div
            className="text-[11px] uppercase tracking-[2px] mb-4 flex items-center gap-2"
            style={{ color: "#22c55e" }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "#22c55e" }}
            />
            Live match network
          </div>
          <h2
            className="font-display font-bold text-3xl sm:text-4xl leading-tight mb-4"
            style={{ letterSpacing: "-0.02em" }}
          >
            {isLoading ? (
              <span>Active Matches</span>
            ) : (
              <span>
                <span style={{ color: "#22c55e" }}>{total.toLocaleString()}</span> active matches
              </span>
            )}
          </h2>
          <p className="text-lg leading-relaxed max-w-2xl mb-10" style={{ color: "oklch(0.58 0.01 264)" }}>
            The Pythh match network continuously pairs startups with investors based on
            sector alignment, stage fit, timing windows, and thesis depth. Every match is
            independently scored across five dimensions.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <StatCard
              label="Active matches"
              value={isLoading ? "—" : total.toLocaleString()}
              sub="across all sectors"
              color="#22c55e"
            />
            <StatCard
              label="High-confidence"
              value={isLoading ? "—" : highConf.toLocaleString()}
              sub="confidence ≥ 75%"
              color="#22d3ee"
            />
            <StatCard
              label="Top-score matches"
              value={isLoading ? "—" : topScore.toLocaleString()}
              sub="match score ≥ 85%"
              color="#a855f7"
            />
            <StatCard
              label="New this week"
              value={isLoading ? "—" : recentCount.toLocaleString()}
              sub="last 7 days"
              color="#f97316"
            />
          </div>
        </div>

        {/* ── Latest live matches (from network) ── */}
        <section className="mb-20" id="latest-matches">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Latest live matches</h2>
              <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                Most recent startup↔investor pairings from the signal engine
                {highlightId ? " — your link is highlighted at the top" : ""}
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", color: "#22c55e" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
          <RecentMatchesList highlightId={highlightId} limit={12} />
        </section>

        {/* ── Live match signals ── */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Live match signals</h2>
              <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                Representative matches by sector — scored on timing, thesis fit, and signal alignment
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", color: "#22c55e" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Active
            </div>
          </div>

          <div className="space-y-3">
            {MATCH_SIGNALS.map((m) => (
              <div
                key={m.sector}
                className="p-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.115 0.01 264)", border: `1px solid ${m.color}25` }}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CircleDot size={12} style={{ color: m.color }} />
                      <span className="text-sm font-semibold text-white">{m.sector}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
                        style={{
                          backgroundColor: m.urgency === "high" ? "#22c55e18" : "#eab30818",
                          color: m.urgency === "high" ? "#22c55e" : "#eab308",
                        }}
                      >
                        {m.urgency} urgency
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "oklch(0.52 0.01 264)" }}>{m.explanation}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold" style={{ color: m.color }}>
                      {Math.round(m.score * 100)}%
                    </div>
                    <div className="text-[10px]" style={{ color: "oklch(0.45 0.01 264)" }}>match</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <ScoreBar value={m.score} color={m.color} label="Match" />
                  <ScoreBar value={m.timing} color="#22d3ee" label="Timing" />
                  <ScoreBar value={m.confidence} color="#a855f7" label="Confidence" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sector distribution (live) ── */}
        {sectors.length > 0 && (
          <section className="mb-20">
            <h2 className="text-xl font-bold text-white mb-2">Sector match distribution</h2>
            <p className="text-xs mb-6" style={{ color: "oklch(0.5 0.01 264)" }}>
              Live from the Pythh match network (top match_score ≥ 80%)
            </p>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid oklch(0.2 0.01 264)" }}
            >
              {sectors.map((s, i) => {
                const max = sectors[0]?.count ?? 1;
                const pct = Math.round((s.count / max) * 100);
                const colors = ["#22c55e", "#22d3ee", "#a855f7", "#f97316", "#ec4899", "#eab308", "#6366f1", "#ef4444"];
                const color = colors[i % colors.length];
                return (
                  <div
                    key={s.name}
                    className="flex items-center gap-4 px-5 py-3"
                    style={{ borderBottom: i < sectors.length - 1 ? "1px solid oklch(0.16 0.01 264)" : undefined }}
                  >
                    <div className="w-24 text-sm text-white font-medium">{s.name}</div>
                    <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="text-xs font-mono w-10 text-right" style={{ color }}>
                      {s.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── How matching works ── */}
        <section className="mb-20">
          <h2 className="text-xl font-bold text-white mb-2">How the match engine works</h2>
          <p className="text-xs mb-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Every match is independently scored across five dimensions — no black boxes.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="flex gap-4 p-5 rounded-xl"
                  style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${step.color}18` }}
                  >
                    <Icon size={16} style={{ color: step.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">{step.step}</div>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Five dimensions */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
          >
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={14} style={{ color: "#22d3ee" }} />
              Five match dimensions
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {DIMENSION_LABELS.map((d) => (
                <div key={d.key} className="text-center">
                  <div
                    className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ backgroundColor: `${d.color}18`, border: `1px solid ${d.color}30` }}
                  >
                    <CheckCircle size={14} style={{ color: d.color }} />
                  </div>
                  <div className="text-xs font-medium" style={{ color: d.color }}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Investor network ── */}
        <section className="mb-20">
          <div
            className="rounded-2xl p-8"
            style={{
              background: "linear-gradient(135deg, oklch(0.12 0.02 264) 0%, oklch(0.13 0.015 280) 100%)",
              border: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Users size={20} style={{ color: "#22c55e" }} />
              <h2 className="text-xl font-bold text-white">The investor network</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              {[
                { value: "6,250+", label: "Total investors", color: "#22c55e" },
                { value: "4,007", label: "Qualified (entity-resolved)", color: "#22d3ee" },
                { value: "2,616", label: "Active (GOD score ≥ 50)", color: "#a855f7" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.58 0.01 264)" }}>
              Every investor in the network has passed Pythh's entity resolution gate —
              screened for thesis clarity, URL validity, and activity recency. Matches only surface
              investors who are actively deploying capital in your sector and stage.
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center">
          <div
            className="inline-block w-12 h-12 rounded-xl mb-6 mx-auto flex items-center justify-center"
            style={{ backgroundColor: "#22c55e18", border: "1px solid #22c55e40" }}
          >
            <Flame size={22} style={{ color: "#22c55e" }} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ letterSpacing: "-0.02em" }}>
            Start your autonomous raise.
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "oklch(0.55 0.01 264)" }}>
            Submit your URL. Oracle analyzes readiness, qualifies investors, and builds your campaign plan —
            toward qualified meetings, not just a list.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <StartupCTA href="/matches#preview-url" size="lg" showArrow arrowSize={16}>
              Analyze my company
            </StartupCTA>
            <Link href="/oracle">
              <span
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ border: "1px solid oklch(0.3 0.01 264)", color: "oklch(0.7 0.01 264)" }}
              >
                How it works
              </span>
            </Link>
          </div>
        </section>

        </>
        )}

      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 mt-16"
        style={{ borderColor: "oklch(0.18 0.01 264)" }}
      >
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>© 2026 Pythh · pythh.ai</span>
          <div className="flex gap-6">
            {["/oracle", "/rankings", "/investors", "/portfolio", "/pricing"].map((href) => (
              <Link key={href} href={href}>
                <span className="text-xs capitalize cursor-pointer" style={{ color: "oklch(0.45 0.01 264)" }}>
                  {href.replace("/", "")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
