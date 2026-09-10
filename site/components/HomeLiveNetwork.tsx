import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { uniqueMatchPairs, useRecentMatches, type RecentMatch } from "@/components/RecentMatchesFeed";
import { BORDER, CARD, DIM, G, GOLD, MUTED, PURPLE_ACCENT, PURPLE_BORDER, TEXT } from "@/lib/designTokens";
import { useEffect, useMemo, useState } from "react";
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

const LIVE_TAPE_POOL = 9;
const LIVE_TAPE_FETCH = 20;
const LIVE_TAPE_ROTATE_MS = 8000;

export function HomeLiveMatches({ limit = 3 }: { limit?: number }) {
  const { matches: raw, loading } = useRecentMatches(LIVE_TAPE_FETCH);
  const matches = useMemo(() => uniqueMatchPairs(raw, LIVE_TAPE_POOL), [raw]);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const pageCount = matches.length > limit ? Math.ceil(matches.length / limit) : 1;
  const visible = matches.length
    ? Array.from({ length: Math.min(limit, matches.length) }, (_, i) => (
      matches[(offset * limit + i) % matches.length]
    ))
    : [];

  useEffect(() => {
    if (pageCount < 2 || paused) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setOffset((n) => (n + 1) % pageCount);
    }, LIVE_TAPE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pageCount, paused]);

  return (
    <aside
      id="live-matches"
      className="rounded-xl overflow-hidden text-left"
      style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}`, minHeight: 220 }}
      aria-label="Rotating live matches"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p className="text-[13px] font-medium" style={{ color: PURPLE_ACCENT }}>
          Live market signal
        </p>
        <span className="text-[12px] font-mono" style={{ color: DIM }}>
          {loading
            ? "Refreshing"
            : pageCount > 1
              ? `${offset + 1} of ${pageCount}`
              : "Updated continuously"}
        </span>
      </div>
      <div>
        {loading && (
          <div className="px-4 py-5 space-y-3" aria-hidden>
            <div className="h-10 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
            <div className="h-10 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
            <div className="h-10 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          </div>
        )}
        {!loading && matches.length === 0 && (
          <p className="px-4 py-6 text-[15px]" style={{ color: MUTED }}>
            New pairings will land here as PYTHIA ranks startups against investors.
          </p>
        )}
        {!loading && visible.map((m, i) => (
          <Link
            key={`${m.match_id}-${i}`}
            href={m.startup_id ? `/startup/${encodeURIComponent(m.startup_id)}` : "/matches"}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            <div className="min-w-0">
              <p className="text-[15px] font-semibold truncate" style={{ color: TEXT }}>
                {m.startup_name}
                <span style={{ color: MUTED, fontWeight: 500 }}> → </span>
                {investorLabel(m)}
              </p>
              <p className="text-[13px] mt-0.5" style={{ color: DIM }}>
                {m.time_ago}
              </p>
            </div>
            <span className="text-[13px] font-medium flex-shrink-0" style={{ color: G }}>
              {Math.round(m.match_score)}/100
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/matches"
        className="flex items-center justify-between px-4 py-3 text-[14px]"
        style={{ borderTop: `1px solid ${BORDER}`, color: G }}
      >
        See all live matches <ArrowRight size={14} />
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

interface LiveBrief {
  date?: string;
  moneyMoves?: MoneyMove[];
  fundingRounds?: MoneyMove[];
}

export function HomeLiveResults() {
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

  return (
    <aside
      id="live-results"
      className="rounded-xl overflow-hidden text-left"
      style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}`, minHeight: 220 }}
      aria-label="Who just got funded"
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p className="text-[13px] font-medium" style={{ color: PURPLE_ACCENT }}>
          Who just got funded
        </p>
        <span className="text-[12px] font-mono" style={{ color: DIM }}>
          {brief?.date ? brief.date : ready ? "Daily brief" : "Refreshing"}
        </span>
      </div>
      {!ready && (
        <div className="px-4 py-5 space-y-3" aria-hidden>
          <div className="h-10 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-10 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-10 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
        </div>
      )}
      {ready && moves.length === 0 && (
        <p className="px-4 py-6 text-[15px]" style={{ color: MUTED }}>
          Today&rsquo;s funding tape is still compiling.
        </p>
      )}
      {moves.map((m) => {
        const amount = formatAmount(m.amount);
        const firms = (m.investors || []).slice(0, 3).join(", ");
        const safeUrl = safeExternalUrl(m.url);
        const inner = (
          <>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold truncate" style={{ color: TEXT }}>{m.company}</p>
              <p className="text-[13px] mt-0.5 truncate" style={{ color: DIM }}>
                {m.stage && m.stage !== "Unknown" ? m.stage : "Raise"}
                {firms ? ` · ${firms}` : m.source ? ` · ${m.source}` : ""}
              </p>
            </div>
            {amount ? (
              <span className="text-[14px] font-medium flex-shrink-0" style={{ color: GOLD }}>{amount}</span>
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
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            {inner}
          </a>
        ) : (
          <div
            key={`${m.company}-${m.amount}`}
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ borderTop: `1px solid ${BORDER}` }}
          >
            {inner}
          </div>
        );
      })}
      <Link
        href="/newsletter"
        className="flex items-center justify-between px-4 py-3 text-[14px]"
        style={{ borderTop: `1px solid ${BORDER}`, color: G }}
      >
        Read today&rsquo;s brief <ArrowRight size={14} />
      </Link>
    </aside>
  );
}
