import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useRecentMatches, type RecentMatch } from "@/components/RecentMatchesFeed";
import { AMBER, BORDER, CARD, DIM, G, GOLD, MUTED, TEXT } from "@/lib/designTokens";
import { useEffect, useState } from "react";
import { safeExternalUrl } from "@/lib/safeUrl";

function investorLabel(m: RecentMatch) {
  if (m.investor_firm && m.investor_firm !== m.investor_name && m.investor_firm !== "-") {
    return m.investor_firm;
  }
  return m.investor_name;
}

function formatAmount(raw: string | null | undefined) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/[$£€]/.test(s) && /[kmb]\b/i.test(s)) return s;
  if (/\bmillion\b/i.test(s) || /\mbillion\b/i.test(s)) return s;
  if (/\d+[kmb]\b/i.test(s)) return s;
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return s;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

export function HomeLiveMatches({ limit = 6 }: { limit?: number }) {
  const { matches, loading } = useRecentMatches(limit);

  return (
    <aside
      id="live-matches"
      className="rounded-xl overflow-hidden text-left"
      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
      aria-label="Live matches"
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p className="text-[10px] font-mono font-semibold tracking-widest uppercase flex items-center gap-1.5" style={{ color: G }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: G }} />
          Live matches
        </p>
        <span className="text-[10px] font-mono" style={{ color: DIM }}>
          {loading ? "…" : `${matches.length} just now`}
        </span>
      </div>
      <div>
        {loading && (
          <div className="px-4 py-8 text-sm font-mono" style={{ color: DIM }}>
            Loading the match network…
          </div>
        )}
        {!loading && matches.length === 0 && (
          <p className="px-4 py-6 text-sm" style={{ color: MUTED }}>
            New pairings will land here as PYTHIA ranks startups against investors.
          </p>
        )}
        {!loading && matches.map((m) => (
          <Link
            key={m.match_id}
            href={m.startup_id ? `/startup/${encodeURIComponent(m.startup_id)}` : "/matches"}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
                {m.startup_name}
                <span style={{ color: MUTED, fontWeight: 500 }}> → </span>
                {investorLabel(m)}
              </p>
              <p className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                {m.time_ago}
                {m.startup_god_score != null ? ` · GOD ${m.startup_god_score}` : ""}
              </p>
            </div>
            <span
              className="text-xs font-mono font-bold px-2 py-0.5 rounded flex-shrink-0"
              style={{ color: AMBER, background: "oklch(0.769 0.188 70.08 / 0.12)", border: "1px solid oklch(0.769 0.188 70.08 / 0.25)" }}
            >
              {m.match_score}
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/matches"
        className="flex items-center justify-between px-4 py-3 text-[11px] font-mono"
        style={{ borderTop: `1px solid ${BORDER}`, color: G }}
      >
        Inspect the network <ArrowRight size={12} />
      </Link>
    </aside>
  );
}

interface MoneyMove {
  company?: string;
  amount?: string;
  stage?: string | null;
  investors?: string[];
  url?: string | null;
  source?: string;
}

interface HottestStartup {
  name?: string;
  total_god_score?: number;
  why?: string;
}

interface LiveBrief {
  date?: string;
  moneyMoves?: MoneyMove[];
  fundingRounds?: MoneyMove[];
  hottestStartups?: HottestStartup[];
}

export function HomeLiveResults({
  pairRate,
  pairHits,
  pairStartups,
}: {
  pairRate?: number | null;
  pairHits?: number;
  pairStartups?: number;
}) {
  const [brief, setBrief] = useState<LiveBrief | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/newsletter/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setBrief(d);
      })
      .catch(() => {
        if (!cancelled) setBrief(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const moves = (brief?.moneyMoves || brief?.fundingRounds || [])
    .filter((m) => m?.company)
    .slice(0, 6);
  const hottest = (brief?.hottestStartups || []).filter((s) => s?.name).slice(0, 3);

  return (
    <section
      id="live-results"
      className="border-t"
      style={{ borderColor: BORDER, backgroundColor: "oklch(0.085 0.01 264)" }}
      aria-label="Live results"
    >
      <div className="container max-w-6xl mx-auto px-6 py-12 lg:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <p className="text-[10px] font-mono font-semibold tracking-widest uppercase flex items-center gap-1.5 mb-2" style={{ color: GOLD }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: GOLD }} />
              Live results
            </p>
            <h2 className="font-display font-bold text-2xl" style={{ color: TEXT, letterSpacing: "-0.03em" }}>
              Who just got funded.
            </h2>
            <p className="text-sm mt-1 max-w-xl" style={{ color: MUTED }}>
              The same raises that land in the Daily Brief. Subscribe with your URL and we add your ranked investors next to this tape.
            </p>
          </div>
          {pairRate != null && Number.isFinite(pairRate) ? (
            <p className="text-[11px] font-mono" style={{ color: DIM }}>
              <span style={{ color: G }}>{pairRate}%</span>
              {" "}matches later funded
              {pairHits && pairStartups ? ` · ${pairHits} of ${pairStartups}` : ""}
            </p>
          ) : null}
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-px rounded-xl overflow-hidden" style={{ backgroundColor: BORDER }}>
          <div style={{ backgroundColor: "oklch(0.085 0.01 264)" }}>
            <p className="px-4 py-3 text-[10px] font-mono tracking-widest uppercase" style={{ color: DIM, borderBottom: `1px solid ${BORDER}` }}>
              Money moves {brief?.date ? `· ${brief.date}` : ""}
            </p>
            {!ready && (
              <p className="px-4 py-8 text-sm font-mono" style={{ color: DIM }}>Loading today&rsquo;s raises…</p>
            )}
            {ready && moves.length === 0 && (
              <p className="px-4 py-8 text-sm" style={{ color: MUTED }}>Today&rsquo;s funding tape is still compiling.</p>
            )}
            {moves.map((m) => {
              const amount = formatAmount(m.amount);
              const firms = (m.investors || []).slice(0, 3).join(", ");
              const safeUrl = safeExternalUrl(m.url);
              const inner = (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{m.company}</p>
                    <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: DIM }}>
                      {m.stage && m.stage !== "Unknown" ? m.stage : "Raise"}
                      {firms ? ` · ${firms}` : m.source ? ` · ${m.source}` : ""}
                    </p>
                  </div>
                  {amount ? (
                    <span className="text-sm font-mono font-bold flex-shrink-0" style={{ color: GOLD }}>{amount}</span>
                  ) : null}
                </>
              );
              return safeUrl ? (
                <a
                  key={`${m.company}-${m.amount}-${m.url}`}
                  href={safeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderBottom: `1px solid ${BORDER}` }}
                >
                  {inner}
                </a>
              ) : (
                <div
                  key={`${m.company}-${m.amount}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderBottom: `1px solid ${BORDER}` }}
                >
                  {inner}
                </div>
              );
            })}
          </div>

          <div style={{ backgroundColor: "oklch(0.085 0.01 264)" }}>
            <p className="px-4 py-3 text-[10px] font-mono tracking-widest uppercase" style={{ color: DIM, borderBottom: `1px solid ${BORDER}` }}>
              Hottest on the board
            </p>
            {!ready && (
              <p className="px-4 py-8 text-sm font-mono" style={{ color: DIM }}>Reading GOD board…</p>
            )}
            {ready && hottest.length === 0 && (
              <p className="px-4 py-8 text-sm" style={{ color: MUTED }}>Hottest startups land here with the daily brief.</p>
            )}
            {hottest.map((s) => (
              <div key={s.name} className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{s.name}</p>
                  {s.total_god_score != null ? (
                    <span className="text-sm font-mono font-bold" style={{ color: G }}>{s.total_god_score}</span>
                  ) : null}
                </div>
                {s.why ? (
                  <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: MUTED }}>{s.why}</p>
                ) : null}
              </div>
            ))}
            <Link
              href="/newsletter"
              className="flex items-center justify-between px-4 py-3 text-[11px] font-mono"
              style={{ color: G }}
            >
              Read today&rsquo;s brief <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
