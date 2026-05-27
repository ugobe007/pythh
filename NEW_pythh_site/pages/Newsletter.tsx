import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import StartupCTA from "@/components/design/StartupCTA";
import {
  ArrowRight,
  Mail,
  Zap,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  BarChart2,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  id: string;
  name: string;
  tagline: string;
  total_god_score: number;
  traction_score: number;
  team_score: number;
  sectors: string[];
}

interface SectorTrend {
  sector: string;
  count: number;
  avg_score: number;
}

interface ScoreMover {
  id: string;
  name: string;
  tagline: string;
  sectors: string[];
  total_god_score: number;
  old_score: number;
  new_score: number;
  delta: number;
}

interface HotMatch {
  match_score: number;
  startup: { name: string; tagline: string; sectors: string[]; total_god_score: number } | null;
  investor: { name: string; firm_name: string; sectors: string[] } | null;
}

interface NewsletterData {
  date: string;
  generated_at: string;
  hotMatches?: HotMatch[];
  leaderboard?: LeaderboardEntry[];
  sectorTrends?: SectorTrend[];
  scoreMovers?: ScoreMover[];
}

// ─── Small Components ─────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80
      ? "oklch(0.696 0.17 162.48)"
      : score >= 65
      ? "#22d3ee"
      : score >= 50
      ? "#eab308"
      : "oklch(0.55 0.01 264)";
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold"
      style={{ color, border: `1px solid ${color}40`, backgroundColor: `${color}12` }}
    >
      {score}
    </span>
  );
}

function SectorChip({ sector }: { sector: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs"
      style={{ backgroundColor: "oklch(0.18 0.01 264)", color: "oklch(0.55 0.01 264)" }}
    >
      {sector}
    </span>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────



// ─── What's in every issue ────────────────────────────────────────────────────

const WHAT_YOU_GET = [
  { label: "Top investor moves", desc: "Which VCs wrote checks this week, what sectors they're loading up on, and the signals that preceded each deal." },
  { label: "VC thesis shifts", desc: "When a fund's investment pace changes, we notice first. Capital flow rotation before it hits TechCrunch." },
  { label: "Hidden capital flows", desc: "Emerging investors flying under the radar — pre-brand, post-thesis, actively deploying." },
  { label: "PYTHIA's watch list", desc: "The 5 investors she's tracking most closely this week and the startups they're circling." },
  { label: "Weekly GOD score movers", desc: "Startups that jumped or fell in signal score — and what drove the change." },
];

// ─── Live Digest Section ──────────────────────────────────────────────────────

function LiveDigest() {
  const [data, setData] = useState<NewsletterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/newsletter/today")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 flex items-center justify-center min-h-[120px]"
        style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
      >
        <span className="text-sm animate-pulse" style={{ color: "oklch(0.45 0.01 264)" }}>
          Loading today's digest…
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
      >
        <p className="text-sm" style={{ color: "oklch(0.45 0.01 264)" }}>
          Digest unavailable — check back soon.
        </p>
      </div>
    );
  }

  const leaderboard = data.leaderboard?.slice(0, 8) ?? [];
  const movers = data.scoreMovers?.filter((m) => Math.abs(m.delta) >= 2).slice(0, 5) ?? [];
  const sectorTrends = data.sectorTrends?.slice(0, 5) ?? [];
  const hotMatches = data.hotMatches?.slice(0, 4) ?? [];

  return (
    <div className="space-y-6">
      {/* Edition header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.4)" }} />
        <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.769 0.188 70.08)" }}>
          TODAY'S DIGEST · {data.date ?? "LIVE"}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.4)" }} />
      </div>

      {/* Grid: Leaderboard + Movers */}
      <div className="grid md:grid-cols-2 gap-5">

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid oklch(0.22 0.01 264)", backgroundColor: "oklch(0.12 0.01 264)" }}
          >
            <div
              className="px-4 py-3 border-b flex items-center gap-2"
              style={{ borderColor: "oklch(0.2 0.01 264)" }}
            >
              <BarChart2 size={13} style={{ color: "#22d3ee" }} />
              <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.55 0.01 264)" }}>
                LEADERBOARD
              </span>
            </div>
            <div>
              {leaderboard.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b"
                  style={{ borderColor: "oklch(0.16 0.01 264)" }}
                >
                  <span
                    className="text-xs font-mono w-5 text-right flex-shrink-0"
                    style={{ color: i < 3 ? "#22d3ee" : "oklch(0.4 0.01 264)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.name}</p>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {(s.sectors || []).slice(0, 2).map((sec) => (
                        <SectorChip key={sec} sector={sec} />
                      ))}
                    </div>
                  </div>
                  <ScorePill score={s.total_god_score} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Movers */}
        {movers.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid oklch(0.22 0.01 264)", backgroundColor: "oklch(0.12 0.01 264)" }}
          >
            <div
              className="px-4 py-3 border-b flex items-center gap-2"
              style={{ borderColor: "oklch(0.2 0.01 264)" }}
            >
              <TrendingUp size={13} style={{ color: "#22c55e" }} />
              <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.55 0.01 264)" }}>
                SCORE MOVERS
              </span>
            </div>
            <div>
              {movers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b"
                  style={{ borderColor: "oklch(0.16 0.01 264)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    <p className="text-xs truncate" style={{ color: "oklch(0.45 0.01 264)" }}>
                      {m.tagline}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>
                      {m.old_score}
                    </span>
                    {m.delta > 0 ? (
                      <TrendingUp size={12} style={{ color: "#22c55e" }} />
                    ) : (
                      <TrendingDown size={12} style={{ color: "oklch(0.65 0.18 25)" }} />
                    )}
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ color: m.delta > 0 ? "#22c55e" : "oklch(0.65 0.18 25)" }}
                    >
                      {m.delta > 0 ? "+" : ""}{m.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sector Trends */}
      {sectorTrends.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ border: "1px solid oklch(0.22 0.01 264)", backgroundColor: "oklch(0.12 0.01 264)" }}
        >
          <p
            className="text-xs font-bold tracking-widest mb-3"
            style={{ color: "oklch(0.55 0.01 264)" }}
          >
            SECTOR HEAT
          </p>
          <div className="flex flex-wrap gap-2">
            {sectorTrends.map((s) => (
              <div
                key={s.sector}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "oklch(0.16 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
              >
                <span className="text-sm font-medium text-white">{s.sector}</span>
                <span className="text-xs font-mono" style={{ color: "#22d3ee" }}>
                  {s.count} co
                </span>
                <span className="text-xs font-mono" style={{ color: "oklch(0.45 0.01 264)" }}>
                  ⌀{s.avg_score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hot Matches */}
      {hotMatches.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid oklch(0.22 0.01 264)", backgroundColor: "oklch(0.12 0.01 264)" }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
            <Zap size={13} style={{ color: "#f97316" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.55 0.01 264)" }}>
              HOT MATCHES
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-0">
            {hotMatches.map((m, i) => (
              <div
                key={i}
                className="p-4 border-b sm:border-r last:border-r-0"
                style={{ borderColor: "oklch(0.16 0.01 264)" }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-white leading-tight">
                    {m.startup?.name ?? "—"}
                  </p>
                  <span
                    className="text-xs font-mono font-bold flex-shrink-0"
                    style={{ color: "#f97316" }}
                  >
                    {m.match_score}%
                  </span>
                </div>
                <p className="text-xs mb-2 truncate" style={{ color: "oklch(0.45 0.01 264)" }}>
                  {m.startup?.tagline ?? ""}
                </p>
                <p className="text-xs font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                  {m.investor?.name ?? ""} · {m.investor?.firm_name ?? ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA to analyze */}
      <div className="text-center pt-2">
        <StartupCTA href="/activate" size="sm" showArrow>
          Run PYTHIA on your startup
        </StartupCTA>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>The Daily Signal — Pythh.ai Newsletter</title>
        <meta
          name="description"
          content="Weekly VC intelligence for founders. Thesis shifts, capital flows, and the investors PYTHIA is watching — delivered every week."
        />
        <meta property="og:title" content="The Daily Signal — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/newsletter" />
      </Helmet>

      <SharedNavbar activePath="/newsletter" />

      <div className="container pt-24 pb-20">

        {/* ── Hero ── */}
        <div className="max-w-2xl mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
            <span
              className="text-xs font-bold tracking-widest"
              style={{ color: "oklch(0.769 0.188 70.08)" }}
            >
              THE DAILY SIGNAL
            </span>
          </div>
          <h1
            className="font-display font-bold mb-4 leading-tight"
            style={{
              fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
              color: "oklch(0.97 0.005 264)",
            }}
          >
            Get the signal
            <br />
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>before the noise.</span>
          </h1>
          <p
            className="text-lg leading-relaxed mb-8"
            style={{ color: "oklch(0.6 0.01 264)" }}
          >
            Weekly breakdown of VC thesis shifts, hidden capital flows, and the investors PYTHIA is
            watching right now. Delivered every week to 12,000+ founders.
          </p>

          {/* Subscribe form */}
          <div
            className="p-6 rounded-2xl mb-6"
            style={{
              backgroundColor: "oklch(0.14 0.01 264)",
              border: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            {submitted ? (
              <div
                className="flex items-center gap-3 py-4 px-5 rounded-xl"
                style={{
                  backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
                  border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
                }}
              >
                <Zap size={16} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                    You're in.
                  </p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>
                    First signal drops this week. Check your inbox.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div
                  className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{
                    backgroundColor: "oklch(0.11 0.01 264)",
                    border: "1px solid oklch(0.28 0.01 264)",
                  }}
                >
                  <Mail size={15} style={{ color: "oklch(0.45 0.01 264)" }} />
                  <input
                    type="email"
                    placeholder="founder@startup.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: "oklch(0.94 0.005 264)" }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap"
                  style={{
                    backgroundColor: "oklch(0.769 0.188 70.08)",
                    color: "oklch(0.1 0.01 70)",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? (
                    "Subscribing…"
                  ) : (
                    <>
                      <span>Subscribe</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            )}
            <p className="text-xs mt-3" style={{ color: "oklch(0.35 0.01 264)" }}>
              No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>

        {/* ── Live Digest ── */}
        <section className="max-w-4xl mb-16">
          <h2
            className="font-display font-semibold text-xl mb-6"
            style={{ color: "oklch(0.85 0.01 264)" }}
          >
            Today's digest
          </h2>
          <LiveDigest />
        </section>

        {/* ── What you get ── */}
        <section className="mb-16 max-w-3xl">
          <h2
            className="font-display font-semibold text-xl mb-6"
            style={{ color: "oklch(0.85 0.01 264)" }}
          >
            What's in every issue
          </h2>
          <div className="space-y-3">
            {WHAT_YOU_GET.map((item) => (
              <div
                key={item.label}
                className="flex gap-4 p-4 rounded-xl"
                style={{
                  backgroundColor: "oklch(0.14 0.01 264)",
                  border: "1px solid oklch(0.22 0.01 264)",
                }}
              >
                <div
                  className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full"
                  style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }}
                />
                <div>
                  <p
                    className="text-sm font-medium mb-0.5"
                    style={{ color: "oklch(0.85 0.01 264)" }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "oklch(0.5 0.01 264)" }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Social proof ── */}
        <div
          className="max-w-3xl p-6 rounded-2xl"
          style={{
            backgroundColor: "oklch(0.12 0.01 264)",
            border: "1px solid oklch(0.2 0.01 264)",
          }}
        >
          <p className="text-sm italic mb-3" style={{ color: "oklch(0.6 0.01 264)" }}>
            "The Daily Signal gave me the context I needed to time my Sequoia outreach
            perfectly. Closed the meeting within a week of getting the alert."
          </p>
          <p className="text-xs font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
            — Founder, Series A · AI Infrastructure
          </p>
        </div>
      </div>

      <footer
        className="border-t py-8 mt-4"
        style={{
          borderColor: "oklch(0.2 0.01 264)",
          backgroundColor: "oklch(0.11 0.01 264)",
        }}
      >
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Signal Trends", href: "/signal-trends" },
            { label: "Rankings", href: "/rankings" },
            { label: "Platform", href: "/platform" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing", href: "/pricing" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span
                className="text-xs cursor-pointer"
                style={{ color: "oklch(0.35 0.01 264)" }}
              >
                {label}
              </span>
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
