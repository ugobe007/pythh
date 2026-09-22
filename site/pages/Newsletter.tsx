import { useState, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  Zap,
  TrendingUp,
  Activity,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import NewsletterJoinForm, { NEWSLETTER_JOIN_CTA } from "@/components/NewsletterJoinForm";
import { formatAmount, isPublicFundingMove } from "@/components/HomeLiveNetwork";
import {
  G,
  GOLD,
  G_BORDER,
  G_SUBTLE,
  PAGE,
  BORDER,
  CARD,
  MUTED,
  DIM,
  TEXT,
  PURPLE_ACCENT,
  PURPLE_BORDER,
  PURPLE_WASH,
  godScoreColor,
} from "@/lib/designTokens";

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
interface TrendDriver {
  key: string;
  label: string;
  finding: string;
  why_it_matters: string;
}
interface TrendReport {
  headline: string;
  thesis: string;
  drivers?: TrendDriver[];
  shifts?: { label: string; detail: string }[];
}
interface BriefData {
  date: string;
  generated_at: string;
  editorial?: { text: string; source: string } | string;
  trendReport?: TrendReport | null;
  hottestStartups?: HottestStartup[];
  signalsThatMatter?: SignalsThatMatter | null;
  topMatches?: TopMatch[];
  moneyMoves?: MoneyMove[];
  vcNews?: NewsItem[];
  radarNews?: NewsItem[];
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

function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-[12px] font-mono font-semibold tabular-nums"
      style={{
        width: 36,
        height: 36,
        color: GOLD,
        border: "1px solid oklch(0.769 0.188 70.08 / 0.45)",
        background: "oklch(0.769 0.188 70.08 / 0.08)",
      }}
      aria-label={`${label} ${score}`}
    >
      {score}
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
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase" style={{ color: accent }}>
          {label}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: BORDER }} />
      </div>
      {children}
    </section>
  );
}

function editionPath(date?: string | null): string {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `/api/newsletter/${date}`
    : "/api/newsletter/today";
}

function DailySignalEdition({ date }: { date?: string | null }) {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let tries = 0;
    const load = () => {
      fetch(editionPath(date))
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => {
          if (tries++ < 1) {
            setTimeout(load, 1500);
          } else {
            setError(true);
            setLoading(false);
          }
        });
    };
    load();
  }, [date]);

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 flex items-center justify-center min-h-[160px]"
        style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
      >
        <span className="text-sm animate-pulse" style={{ color: DIM }}>
          Compiling today&rsquo;s signal&hellip;
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
      >
        <p className="text-sm" style={{ color: DIM }}>
          Today&rsquo;s edition is still compiling. Check back in a moment.
        </p>
      </div>
    );
  }

  const editorialText =
    typeof data.editorial === "string" ? data.editorial : data.editorial?.text;
  const trends = data.trendReport ?? null;
  const hottest = data.hottestStartups ?? [];
  const signals = data.signalsThatMatter ?? null;
  const matches = (data.topMatches ?? []).filter((m) => m.startup && m.investor);
  const money = (data.moneyMoves ?? []).filter(isPublicFundingMove);
  const vcNews = data.vcNews ?? [];
  const radarNews = data.radarNews ?? [];

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase mb-1" style={{ color: PURPLE_ACCENT }}>
            Today&rsquo;s edition
          </p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl" style={{ color: TEXT, letterSpacing: "-0.03em" }}>
            Daily Signal
          </h1>
        </div>
        <span className="text-xs font-mono" style={{ color: MUTED }}>
          {data.date ?? "TODAY"} · LIVE
        </span>
      </div>

      {editorialText && (
        <div
          className="rounded-xl p-5 sm:p-6"
          style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
        >
          <p className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase mb-2" style={{ color: PURPLE_ACCENT }}>
            Today&rsquo;s read
          </p>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: TEXT }}>
            {editorialText}
          </p>
        </div>
      )}

      {trends?.headline && (
        <div
          className="rounded-xl p-5 sm:p-6"
          style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
        >
          <p className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase mb-2" style={{ color: PURPLE_ACCENT }}>
            What&rsquo;s shaping capital
          </p>
          <h2 className="font-display font-bold text-xl sm:text-2xl mb-3" style={{ color: TEXT, letterSpacing: "-0.03em" }}>
            {trends.headline}
          </h2>
          {trends.thesis && (
            <p className="text-[15px] leading-relaxed mb-5" style={{ color: MUTED }}>
              {trends.thesis}
            </p>
          )}
          {trends.drivers && trends.drivers.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {trends.drivers.map((d) => (
                <div key={d.key + d.label} className="rounded-lg p-3" style={{ border: `1px solid ${BORDER}` }}>
                  <p className="text-[11px] font-mono font-semibold tracking-widest uppercase mb-1" style={{ color: G }}>
                    {d.label}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{d.finding}</p>
                  {d.why_it_matters && (
                    <p className="text-xs leading-relaxed mt-1.5" style={{ color: DIM }}>{d.why_it_matters}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {trends.shifts && trends.shifts.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
              {trends.shifts.map((s) => (
                <p key={s.label} className="text-xs leading-relaxed" style={{ color: MUTED }}>
                  <span style={{ color: PURPLE_ACCENT }}>{s.label}</span>
                  {" — "}
                  {s.detail}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {hottest.length > 0 && (
          <Panel icon={<Zap size={14} />} label="Hottest startups" accent={G}>
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              {hottest.slice(0, 5).map((s, i) => (
                <div
                  key={s.id}
                  className="p-4"
                  style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
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
                        style={{ fontSize: "1.35rem", color: godScoreColor(s.total_god_score) }}
                      >
                        {s.total_god_score}
                      </span>
                      <div className="text-[9px] font-mono tracking-[0.15em]" style={{ color: DIM }}>
                        GOD
                      </div>
                    </div>
                  </div>
                  {s.pillars.length > 0 && (
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
                  )}
                  {s.why && (
                    <p className="text-xs mt-3 leading-relaxed" style={{ color: MUTED }}>
                      <span style={{ color: DIM }}>Why — </span>
                      {s.why}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {money.length > 0 && (
          <Panel icon={<TrendingUp size={14} />} label="Who just got funded" accent={PURPLE_ACCENT}>
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}>
              {money.slice(0, 6).map((r, i) => {
                const amount = formatAmount(r.amount) || r.amount;
                const firms = (r.investors || []).slice(0, 3).join(", ");
                return (
                  <div
                    key={`${r.company}-${r.amount}-${i}`}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                    style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
                  >
                    <div className="min-w-0">
                      <p className="font-display font-bold text-[1.02rem] leading-tight truncate" style={{ color: TEXT }}>
                        {r.company}
                      </p>
                      <p className="text-[12px] font-mono mt-1 truncate" style={{ color: DIM }}>
                        {r.stage && r.stage !== "Unknown" ? r.stage : "Raise"}
                        {firms ? ` — ${firms}` : ""}
                      </p>
                    </div>
                    {amount ? (
                      <span
                        className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-mono font-semibold tabular-nums px-2.5"
                        style={{
                          minWidth: 36,
                          height: 36,
                          color: GOLD,
                          border: "1px solid oklch(0.769 0.188 70.08 / 0.45)",
                          background: "oklch(0.769 0.188 70.08 / 0.08)",
                        }}
                      >
                        {amount}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </div>

      {matches.length > 0 && (
        <Panel icon={<Activity size={14} />} label="Most interesting matches" accent={PURPLE_ACCENT}>
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}>
            {matches.slice(0, 6).map((m, i) => (
              <div
                key={`${m.startup?.name}-${m.investor?.name}-${i}`}
                className="flex items-start justify-between gap-4 px-4 py-3.5"
                style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
              >
                <div className="min-w-0">
                  <p className="font-display font-bold leading-tight">
                    <span style={{ color: TEXT }}>{m.startup?.name}</span>
                    <span style={{ color: DIM }}> → </span>
                    <span style={{ color: G }}>
                      {m.investor?.firm_name || m.investor?.firm || m.investor?.name}
                    </span>
                  </p>
                  {m.reasoning && (
                    <p className="text-xs mt-1.5 leading-relaxed line-clamp-2" style={{ color: MUTED }}>
                      {m.reasoning}
                    </p>
                  )}
                </div>
                <ScoreBadge score={Math.round(m.match_score)} label="Match score" />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {signals && signals.dimensions.length > 0 && (
        <Panel icon={<Activity size={14} />} label="Signals that matter" accent={G}>
          <div className="rounded-xl p-5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm mb-4" style={{ color: MUTED }}>
              Dominant signal across {signals.coverage} tracked companies:{" "}
              <span style={{ color: G, fontWeight: 700 }}>{signals.leading.label}</span>
              {signals.leading.blurb ? ` — ${signals.leading.blurb}` : "."}
            </p>
            <div className="space-y-2.5">
              {signals.dimensions.map((d) => {
                const lead = d.key === signals.leading.key;
                return (
                  <div key={d.key} className="flex items-center gap-3">
                    <span
                      className="text-xs w-36 shrink-0"
                      style={{ color: lead ? TEXT : MUTED, fontWeight: lead ? 700 : 400 }}
                    >
                      {d.label}
                    </span>
                    <div className="flex-1">
                      <MiniBar value={d.pct} color={lead ? G : DIM} />
                    </div>
                    <span className="text-xs font-mono w-9 text-right" style={{ color: lead ? G : DIM }}>
                      {d.pct}%
                    </span>
                  </div>
                );
              })}
            </div>
            {signals.exemplars.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-mono tracking-[0.15em] uppercase mb-2" style={{ color: DIM }}>
                  Leading on this signal
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
                        <span style={{ color: MUTED }}> · {e.total_god_score}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {(vcNews.length > 0 || radarNews.length > 0) && (
        <Panel icon={<Newspaper size={14} />} label="On the wire" accent={MUTED}>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Capital news", items: vcNews },
              { title: "Worth watching", items: radarNews },
            ]
              .filter((c) => c.items.length > 0)
              .map((col) => (
                <div
                  key={col.title}
                  className="rounded-xl p-4"
                  style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
                >
                  <p className="text-[11px] font-mono font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: DIM }}>
                    {col.title}
                  </p>
                  <div className="space-y-2.5">
                    {col.items.slice(0, 5).map((n, i) => (
                      <a
                        key={`${n.url}-${i}`}
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
    </div>
  );
}

const WHAT_YOU_GET = [
  {
    n: "1",
    label: "Your ranked shortlist",
    desc: "If you leave a startup URL, every issue opens with the investors ranked for that company and a link to inspect them on pythh.ai.",
  },
  {
    n: "2",
    label: "Today’s funding tape",
    desc: "Public raises of $1M+ with the firms on the roster — the same tape as the homepage live board.",
  },
  {
    n: "3",
    label: "Why the scores exist",
    desc: "Hottest companies on the GOD board, the dominant market signal, and the pairings with the strongest current fit.",
  },
];

function SiteFooter() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Product",
      links: [
        { label: "Matches", href: "/matches" },
        { label: "Daily Signal", href: "/newsletter" },
        { label: "Pricing", href: "/pricing" },
        { label: "Portfolio", href: "/portfolio" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Methodology", href: "/methodology" },
        { label: "About", href: "/about" },
        { label: "Support", href: "/support" },
        { label: "Pythiam Ventures", href: "/pythiam" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="border-t" style={{ backgroundColor: "oklch(0.11 0.01 264)", borderColor: BORDER }}>
      <div className="container max-w-[1200px] py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          <div>
            <p className="font-display font-bold text-lg text-white tracking-tight mb-2">pythh.ai</p>
            <p className="text-[14px] leading-relaxed" style={{ color: MUTED }}>
              Pythh aligns startups with the investors who later fund them.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h2 className="font-display font-semibold text-[15px] mb-4" style={{ color: TEXT }}>{col.title}</h2>
              <ul className="space-y-2.5">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href}>
                      <span className="text-[14px] cursor-pointer" style={{ color: MUTED }}>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t" style={{ borderColor: BORDER }}>
          <p className="text-[14px] leading-relaxed" style={{ color: MUTED }}>
            © 2026 Pythh Capital. Signals reflect observed investor behavior. No guarantees.
            {" "}
            <a href="/privacy" className="underline underline-offset-2" style={{ color: MUTED }}>Privacy</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Newsletter() {
  const [isDated, datedParams] = useRoute("/newsletter/:date");
  const editionDate =
    isDated && datedParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(datedParams.date)
      ? datedParams.date
      : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>Daily Signal — ranked matches and today&rsquo;s funding tape</title>
        <meta
          name="description"
          content="Today’s Daily Signal: hottest startups, public funding tape, and ranked investor matches. Leave a URL to get the shortlist in your inbox."
        />
        <meta property="og:title" content="Daily Signal — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/newsletter" />
      </Helmet>

      <SharedNavbar activePath="/newsletter" hidePrimaryCta />

      <section className="pt-20 pb-14 lg:pb-16" style={{ backgroundColor: PAGE }}>
        <div className="container max-w-[1200px] mx-auto px-6">
          <DailySignalEdition date={editionDate} />
        </div>
      </section>

      <section className="py-14 border-t" style={{ borderColor: BORDER, backgroundColor: PURPLE_WASH }}>
        <div className="container max-w-[720px] mx-auto px-6">
          <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: PURPLE_ACCENT }}>
            Daily Signal
          </p>
          <h2
            className="font-display font-bold mb-3"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: TEXT, letterSpacing: "-0.03em" }}
          >
            Get the daily brief.
          </h2>
          <p className="text-[17px] leading-relaxed mb-8" style={{ color: MUTED }}>
            Leave your website and email. Tomorrow&rsquo;s issue includes your ranked shortlist and the funding tape.
          </p>
          <NewsletterJoinForm
            source="newsletter_page"
            cta={NEWSLETTER_JOIN_CTA}
            className="mx-auto"
          />
          <p className="text-[14px] mt-4" style={{ color: MUTED }}>
            Free · unsubscribe anytime.
          </p>
        </div>
      </section>

      <section className="py-14 border-t" style={{ borderColor: BORDER, backgroundColor: PAGE }}>
        <div className="container max-w-[1200px] mx-auto px-6">
          <p className="text-[12px] font-medium tracking-wide uppercase mb-2" style={{ color: PURPLE_ACCENT }}>
            Contents
          </p>
          <h2
            className="font-display font-bold mb-8"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: TEXT, letterSpacing: "-0.03em" }}
          >
            What&rsquo;s in every issue
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {WHAT_YOU_GET.map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-5"
                style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
              >
                <p className="text-[13px] font-mono mb-2" style={{ color: PURPLE_ACCENT }}>{item.n}</p>
                <p className="font-display font-bold text-xl mb-2" style={{ color: TEXT }}>{item.label}</p>
                <p className="text-[15px] leading-relaxed" style={{ color: MUTED }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
