import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import StartupCTA from "@/components/design/StartupCTA";
import {
  ArrowRight,
  Mail,
  Zap,
  TrendingUp,
  Activity,
  Newspaper,
  Banknote,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import {
  G,
  CYAN,
  GOLD,
  G_BORDER,
  G_SUBTLE,
  PAGE,
  BORDER,
  CARD,
  MUTED,
  DIM,
  TEXT,
  godScoreColor,
} from "@/lib/designTokens";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pillar {
  label: string;
  value: number;
}
interface HottestStartup {
  id: string;
  name: string;
  tagline: string | null;
  website: string | null;
  sectors: string[];
  total_god_score: number;
  pillars: Pillar[];
  signals_total: number | null;
  why: string;
}
interface SignalDimension {
  key: string;
  label: string;
  blurb: string;
  avg: number;
  cap: number;
  pct: number;
}
interface SignalExemplar {
  startup_id: string;
  name: string;
  sectors: string[];
  total_god_score: number | null;
  value: number;
}
interface SignalsThatMatter {
  coverage: number;
  dimensions: SignalDimension[];
  leading: SignalDimension;
  exemplars: SignalExemplar[];
}
interface TopMatch {
  match_score: number;
  reasoning: string | null;
  why_you_match: string[];
  startup: { name: string; tagline: string; sectors: string[]; total_god_score: number } | null;
  investor: { name: string; firm_name?: string; firm?: string; sectors: string[] } | null;
}
interface MoneyMove {
  company: string;
  amount: string;
  stage: string | null;
  investors: string[];
  url: string | null;
  source: string;
}
interface NewsItem {
  title: string;
  url: string;
  source: string;
  company: string | null;
  funding: string | null;
}
interface BriefData {
  date: string;
  generated_at: string;
  editorial?: { text: string; source: string } | string;
  hottestStartups?: HottestStartup[];
  signalsThatMatter?: SignalsThatMatter | null;
  topMatches?: TopMatch[];
  moneyMoves?: MoneyMove[];
  vcNews?: NewsItem[];
  radarNews?: NewsItem[];
}

// ─── Small components ─────────────────────────────────────────────────────────

function SectorChip({ sector }: { sector: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px]"
      style={{ backgroundColor: "oklch(0.18 0.01 264)", color: MUTED }}
    >
      {sector}
    </span>
  );
}

function Panel({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-xs font-bold tracking-[0.18em]" style={{ color: MUTED }}>
          {label.toUpperCase()}
        </span>
        <div className="h-px flex-1 ml-2" style={{ backgroundColor: BORDER }} />
      </div>
      {children}
    </section>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: BORDER }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Daily Brief (live data) ──────────────────────────────────────────────────

function DailyBrief() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let tries = 0;
    const load = () => {
      fetch("/api/newsletter/today")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => {
          // one retry to ride out a cold backend
          if (tries++ < 1) {
            setTimeout(load, 1500);
          } else {
            setError(true);
            setLoading(false);
          }
        });
    };
    load();
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 flex items-center justify-center min-h-[140px]"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
      >
        <span className="text-sm animate-pulse" style={{ color: DIM }}>
          Compiling today&rsquo;s brief&hellip;
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
      >
        <p className="text-sm" style={{ color: DIM }}>
          Brief unavailable &mdash; check back in a moment.
        </p>
      </div>
    );
  }

  const editorialText =
    typeof data.editorial === "string" ? data.editorial : data.editorial?.text;
  const hottest = data.hottestStartups ?? [];
  const signals = data.signalsThatMatter ?? null;
  const matches = (data.topMatches ?? []).filter((m) => m.startup && m.investor);
  const money = data.moneyMoves ?? [];
  const vcNews = data.vcNews ?? [];
  const radarNews = data.radarNews ?? [];

  return (
    <div>
      {/* Edition header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.4)" }} />
        <span className="text-xs font-bold tracking-[0.2em]" style={{ color: GOLD }}>
          THE DAILY BRIEF &middot; {data.date ?? "LIVE"}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.4)" }} />
      </div>

      {/* PYTHIA's Take — editorial */}
      {editorialText && (
        <div
          className="mb-8 rounded-r-xl p-5"
          style={{ borderLeft: `3px solid ${GOLD}`, backgroundColor: "oklch(0.13 0.01 264)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} style={{ color: GOLD }} />
            <span className="text-xs font-bold tracking-[0.18em]" style={{ color: GOLD }}>
              PYTHIA&rsquo;S TAKE
            </span>
          </div>
          <p
            className="leading-relaxed"
            style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", color: TEXT }}
          >
            {editorialText}
          </p>
        </div>
      )}

      {/* Hottest startups */}
      {hottest.length > 0 && (
        <Panel icon={<Zap size={14} />} label="Hottest Startups" accent={G}>
          <div className="space-y-3">
            {hottest.slice(0, 5).map((s, i) => (
              <div
                key={s.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: DIM }}>
                        {i + 1}
                      </span>
                      <span className="font-display font-bold text-white truncate">{s.name}</span>
                    </div>
                    {s.tagline && (
                      <p className="text-xs mt-1 line-clamp-1" style={{ color: MUTED }}>
                        {s.tagline}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className="font-display font-extrabold tabular-nums"
                      style={{ fontSize: "1.4rem", color: godScoreColor(s.total_god_score) }}
                    >
                      {s.total_god_score}
                    </span>
                    <div className="text-[9px] font-mono tracking-[0.15em]" style={{ color: DIM }}>
                      GOD
                    </div>
                  </div>
                </div>

                {/* Pillar mini bars */}
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {s.pillars.map((p) => (
                    <div key={p.label}>
                      <MiniBar value={p.value} color={godScoreColor(p.value)} />
                      <div className="text-[9px] mt-1 text-center" style={{ color: DIM }}>
                        {p.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Why */}
                <p className="text-xs mt-3 leading-relaxed" style={{ color: G }}>
                  <span style={{ color: DIM }}>Why &rarr; </span>
                  {s.why}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Signals that matter */}
      {signals && signals.dimensions.length > 0 && (
        <Panel icon={<Activity size={14} />} label="Signals That Matter" accent={CYAN}>
          <div className="rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm mb-4" style={{ color: MUTED }}>
              Dominant signal across {signals.coverage} tracked companies:{" "}
              <span style={{ color: G, fontWeight: 700 }}>{signals.leading.label}</span> &mdash;{" "}
              {signals.leading.blurb}.
            </p>
            <div className="space-y-2.5">
              {signals.dimensions.map((d) => {
                const lead = d.key === signals.leading.key;
                const col = lead ? G : CYAN;
                return (
                  <div key={d.key} className="flex items-center gap-3">
                    <span
                      className="text-xs w-36 shrink-0"
                      style={{ color: lead ? "white" : MUTED, fontWeight: lead ? 700 : 400 }}
                    >
                      {d.label}
                    </span>
                    <div className="flex-1">
                      <MiniBar value={d.pct} color={col} />
                    </div>
                    <span className="text-xs font-mono w-9 text-right" style={{ color: col }}>
                      {d.pct}%
                    </span>
                  </div>
                );
              })}
            </div>
            {signals.exemplars.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-bold tracking-[0.15em] mb-2" style={{ color: DIM }}>
                  LEADING ON THIS SIGNAL
                </p>
                <div className="flex flex-wrap gap-2">
                  {signals.exemplars.map((e) => (
                    <span
                      key={e.startup_id}
                      className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: G_SUBTLE, color: G, border: `1px solid ${G_BORDER}` }}
                    >
                      {e.name}
                      {e.total_god_score != null && (
                        <span style={{ color: MUTED }}> &middot; {e.total_god_score}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Most interesting matches */}
      {matches.length > 0 && (
        <Panel icon={<TrendingUp size={14} />} label="Most Interesting Matches" accent="#f97316">
          <div className="space-y-3">
            {matches.slice(0, 4).map((m, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-tight">
                    <span className="text-white">{m.startup?.name}</span>
                    <span style={{ color: DIM }}> &rarr; </span>
                    <span style={{ color: G }}>
                      {m.investor?.firm_name || m.investor?.firm || m.investor?.name}
                    </span>
                  </p>
                  <span
                    className="text-sm font-mono font-bold shrink-0"
                    style={{ color: "#f97316" }}
                  >
                    {m.match_score}%
                  </span>
                </div>
                {m.reasoning && (
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: MUTED }}>
                    {m.reasoning}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Money moves */}
      {money.length > 0 && (
        <Panel icon={<Banknote size={14} />} label="Money Moves · New Investments" accent={GOLD}>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            {money.slice(0, 6).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{
                  backgroundColor: CARD,
                  borderBottom: i < Math.min(money.length, 6) - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-white">{r.company}</span>
                  {r.investors.length > 0 && (
                    <p className="text-xs truncate" style={{ color: DIM }}>
                      {r.investors.slice(0, 4).join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-mono font-semibold" style={{ color: GOLD }}>
                    {r.amount}
                  </span>
                  {r.stage && (
                    <span className="text-xs ml-1" style={{ color: MUTED }}>
                      {r.stage}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* News: VC + Radar */}
      {(vcNews.length > 0 || radarNews.length > 0) && (
        <Panel icon={<Newspaper size={14} />} label="On the Wire" accent={MUTED}>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "VC & Capital News", items: vcNews },
              { title: "On PYTHIA\u2019s Radar", items: radarNews },
            ]
              .filter((c) => c.items.length > 0)
              .map((col) => (
                <div
                  key={col.title}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                >
                  <p className="text-[11px] font-bold tracking-[0.15em] mb-3" style={{ color: MUTED }}>
                    {col.title.toUpperCase()}
                  </p>
                  <div className="space-y-2.5">
                    {col.items.slice(0, 5).map((n, i) => (
                      <a
                        key={i}
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <p
                          className="text-xs leading-snug group-hover:text-white transition-colors flex items-start gap-1"
                          style={{ color: TEXT }}
                        >
                          <span className="line-clamp-2">{n.title}</span>
                          <ExternalLink size={10} className="mt-0.5 shrink-0" style={{ color: DIM }} />
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: DIM }}>
                          {n.source}
                          {n.company ? ` · ${n.company}` : ""}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      )}

      {/* CTA */}
      <div className="text-center pt-2">
        <StartupCTA href="/activate" size="sm" showArrow>
          Run PYTHIA on your startup
        </StartupCTA>
      </div>
    </div>
  );
}

// ─── What's in every issue ────────────────────────────────────────────────────

const WHAT_YOU_GET = [
  {
    label: "PYTHIA's Take",
    desc: "A sharp daily read on what the signals mean — where capital is rotating before it hits the headlines.",
  },
  {
    label: "Hottest startups, with the why",
    desc: "The top of the GOD board and exactly which pillars and live signals earned each score. No black box.",
  },
  {
    label: "Signals that matter",
    desc: "The dominant signal across every company we track — investor receptivity, capital convergence, execution velocity.",
  },
  {
    label: "Most interesting matches",
    desc: "The startup↔investor pairings PYTHIA rates highest right now, with the reasoning behind each one.",
  },
  {
    label: "Money moves & VC news",
    desc: "New rounds, who led them, and the partner and fund news shaping where the next checks go.",
  },
];

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
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>The Pythh Daily Brief — Signal Intelligence for Venture</title>
        <meta
          name="description"
          content="A daily intelligence brief for founders and VCs: the hottest startups and why they score, the signals PYTHIA is picking up, the sharpest investor matches, and where capital is moving."
        />
        <meta property="og:title" content="The Pythh Daily Brief" />
        <meta property="og:url" content="https://pythh.ai/newsletter" />
      </Helmet>

      <SharedNavbar activePath="/newsletter" />

      <div className="container pt-24 pb-20">
        {/* ── Hero ── */}
        <div className="max-w-2xl mb-10">
          <SectionLabel className="mb-4" color={GOLD}>
            The Daily Brief
          </SectionLabel>
          <h1
            className="font-display font-bold mb-4 leading-tight"
            style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: TEXT }}
          >
            Who&rsquo;s hot, why,
            <br />
            <span style={{ color: GOLD }}>and where capital is moving.</span>
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: MUTED }}>
            Every day, PYTHIA reads the entire venture signal field and writes the brief: the
            startups breaking out and the exact reasons behind their scores, the signals that
            matter, the sharpest investor matches, and the money moving right now.
          </p>

          {/* Subscribe form */}
          <div className="p-6 border mb-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            {submitted ? (
              <div
                className="flex items-center gap-3 py-4 px-5 border"
                style={{ backgroundColor: G_SUBTLE, borderColor: G_BORDER }}
              >
                <Zap size={16} style={{ color: G }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: G }}>
                    You&rsquo;re in.
                  </p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    Tomorrow&rsquo;s brief lands in your inbox. Today&rsquo;s is below.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div
                  className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ backgroundColor: "oklch(0.11 0.01 264)", border: "1px solid oklch(0.28 0.01 264)" }}
                >
                  <Mail size={15} style={{ color: DIM }} />
                  <input
                    type="email"
                    placeholder="founder@startup.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: TEXT }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap"
                  style={{ backgroundColor: GOLD, color: "oklch(0.1 0.01 70)", opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? (
                    "Subscribing…"
                  ) : (
                    <>
                      <span>Get the brief</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            )}
            <p className="text-xs mt-3" style={{ color: DIM }}>
              Free. Daily. Unsubscribe anytime.
            </p>
          </div>
        </div>

        {/* ── Today's brief (live) ── */}
        <section className="max-w-3xl mb-16">
          <SectionLabel className="mb-2">Live</SectionLabel>
          <h2 className="font-display font-semibold text-xl mb-6 text-white">Today&rsquo;s brief</h2>
          <DailyBrief />
        </section>

        {/* ── What you get ── */}
        <section className="mb-16 max-w-3xl">
          <SectionLabel className="mb-2">Contents</SectionLabel>
          <h2 className="font-display font-semibold text-xl mb-6 text-white">What&rsquo;s in every issue</h2>
          <div className="space-y-3">
            {WHAT_YOU_GET.map((item) => (
              <div
                key={item.label}
                className="flex gap-4 p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.14 0.01 264)", border: `1px solid ${BORDER}` }}
              >
                <div
                  className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full"
                  style={{ backgroundColor: GOLD }}
                />
                <div>
                  <p className="text-sm font-medium mb-0.5" style={{ color: "oklch(0.85 0.01 264)" }}>
                    {item.label}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Authority / social proof ── */}
        <div className="max-w-3xl p-6 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <p className="text-sm italic mb-3" style={{ color: MUTED }}>
            &ldquo;The brief flagged a capital-convergence signal on a company three weeks before the
            round was announced. That&rsquo;s the kind of edge you can&rsquo;t get from a deal
            database.&rdquo;
          </p>
          <p className="text-xs font-medium" style={{ color: G }}>
            &mdash; Partner, Seed Fund
          </p>
        </div>
      </div>

      <footer className="border-t py-8 mt-4" style={{ borderColor: BORDER, backgroundColor: CARD }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Rankings", href: "/rankings" },
            { label: "Investors", href: "/investors" },
            { label: "Portfolio", href: "/portfolio" },
            { label: "Platform", href: "/platform" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing", href: "/pricing" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span
                className="text-xs cursor-pointer hover:text-white transition-colors"
                style={{ color: DIM }}
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
