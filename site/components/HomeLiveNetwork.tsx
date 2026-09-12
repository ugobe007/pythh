import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { uniqueMatchPairs, useRecentMatches } from "@/components/RecentMatchesFeed";
import { BORDER, CARD, DIM, GOLD, MUTED, PURPLE_ACCENT, PURPLE_BORDER, TEXT } from "@/lib/designTokens";
import { LIVEWIRE_PAGE_SIZE, LivewireMatchPanel, livewirePageCount } from "@/components/LivewireMatchPanel";
import { useEffect, useMemo, useState } from "react";
import { safeExternalUrl } from "@/lib/safeUrl";

function parseAmountUsd(raw: string | null | undefined) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/[.]/.test(s) && /b/i.test(s)) return Math.round(n * 1_000_000_000);
  if (/b/i.test(s) && n < 1000) return Math.round(n * 1_000_000_000);
  if (/m/i.test(s) && n < 100_000) return Math.round(n * 1_000_000);
  if (/k/i.test(s) && n < 100_000) return Math.round(n * 1_000);
  return Math.round(n);
}

function formatAmount(raw: string | null | undefined) {
  const n = parseAmountUsd(raw);
  if (!(n > 0)) return "";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

interface MoneyMove {
  company?: string;
  amount?: string;
  stage?: string | null;
  investors?: string[];
  url?: string | null;
  source?: string;
}

const JUNK_SOURCE_RE = /dev\.to|reddit\.com|substack\.com|medium\.com/i;
const JUNK_COMPANY_RE = /^(word art|sophie davies|goodspeed studio|wireframer|qz\.com|financialcontent|ciccone|needham massachusetts)/i;

export function isPublicFundingMove(m: MoneyMove | null | undefined) {
  if (!m?.company) return false;
  if (JUNK_COMPANY_RE.test(m.company.trim())) return false;
  const origin = `${m.source || ""} ${m.url || ""}`;
  if (JUNK_SOURCE_RE.test(origin)) return false;
  const usd = parseAmountUsd(m.amount);
  return usd != null && usd >= 1_000_000;
}

const LIVE_TAPE_POOL = 18;
const LIVE_TAPE_FETCH = 20;
const LIVE_TAPE_ROTATE_MS = 8000;

export function HomeLiveMatches({ limit = LIVEWIRE_PAGE_SIZE }: { limit?: number }) {
  const { matches: raw, loading } = useRecentMatches(LIVE_TAPE_FETCH);
  const matches = useMemo(() => uniqueMatchPairs(raw, LIVE_TAPE_POOL), [raw]);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const size = Math.max(limit, LIVEWIRE_PAGE_SIZE);
  const pageCount = livewirePageCount(matches.length, size);

  useEffect(() => {
    if (pageCount < 2 || paused) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setPage((n) => (n + 1) % pageCount);
    }, LIVE_TAPE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pageCount, paused]);

  return (
    <LivewireMatchPanel
      id="live-matches"
      matches={matches}
      loading={loading}
      page={page}
      pageCount={pageCount}
      onPage={setPage}
      onPause={setPaused}
    />
  );
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
    .filter(isPublicFundingMove)
    .slice(0, 6);

  return (
    <aside
      id="live-results"
      className="rounded-xl overflow-hidden text-left flex flex-col"
      style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}`, minHeight: 480 }}
      aria-label="Who just got funded"
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p
          className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase flex items-center gap-2"
          style={{ color: PURPLE_ACCENT }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PURPLE_ACCENT }} aria-hidden />
          Who just got funded
        </p>
        <span className="text-[12px] font-mono" style={{ color: DIM }}>
          {brief?.date ? brief.date : ready ? "Daily brief" : "Refreshing"}
        </span>
      </div>
      {!ready && (
        <div className="flex-1 px-5 py-4 space-y-3" aria-hidden>
          <div className="h-12 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-12 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-12 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
        </div>
      )}
      {ready && moves.length === 0 && (
        <p className="flex-1 px-5 py-8 text-[15px] leading-relaxed" style={{ color: MUTED }}>
          Today&rsquo;s funding tape is still compiling.
        </p>
      )}
      {moves.map((m, i) => {
        const amount = formatAmount(m.amount);
        const firms = (m.investors || []).slice(0, 3).join(", ");
        const safeUrl = safeExternalUrl(m.url);
        const inner = (
          <>
            <div className="min-w-0">
              <p className="font-display font-bold text-[1.02rem] leading-tight truncate" style={{ color: TEXT }}>
                {m.company}
              </p>
              <p className="text-[12px] font-mono mt-1 truncate" style={{ color: DIM }}>
                {m.stage && m.stage !== "Unknown" ? m.stage : "Raise"}
                {firms ? ` -- ${firms}` : ""}
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
          </>
        );
        return safeUrl ? (
          <a
            key={`${m.company}-${m.amount}-${m.url}`}
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-4 px-5 py-3.5"
            style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
          >
            {inner}
          </a>
        ) : (
          <div
            key={`${m.company}-${m.amount}`}
            className="flex items-center justify-between gap-4 px-5 py-3.5"
            style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
          >
            {inner}
          </div>
        );
      })}
      <Link
        href="/newsletter"
        className="mt-auto flex items-center justify-between px-5 py-3 text-[14px]"
        style={{ borderTop: `1px solid ${BORDER}`, color: PURPLE_ACCENT }}
      >
        Read today&rsquo;s brief <ArrowRight size={14} />
      </Link>
    </aside>
  );
}

export function HomeLiveTape() {
  const { matches: raw, loading } = useRecentMatches(LIVE_TAPE_FETCH);
  const matches = useMemo(() => uniqueMatchPairs(raw, LIVE_TAPE_POOL), [raw]);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const pageCount = livewirePageCount(matches.length, LIVEWIRE_PAGE_SIZE);
  const showSecond = pageCount >= 2;
  const nextPage = showSecond ? (page + 1) % pageCount : 0;

  useEffect(() => {
    if (pageCount < 2 || paused) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setPage((n) => (n + 1) % pageCount);
    }, LIVE_TAPE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pageCount, paused]);

  return (
    <div className={showSecond ? "grid lg:grid-cols-2 gap-8 items-stretch" : ""}>
      <LivewireMatchPanel
        id="live-matches"
        matches={matches}
        loading={loading}
        page={page}
        pageCount={pageCount}
        onPage={setPage}
        onPause={setPaused}
      />
      {showSecond ? (
        <LivewireMatchPanel
          id="live-matches-next"
          matches={matches}
          loading={loading}
          page={nextPage}
          pageCount={pageCount}
          onPage={(n) => setPage((n + pageCount - 1) % pageCount)}
          onPause={setPaused}
        />
      ) : null}
    </div>
  );
}
