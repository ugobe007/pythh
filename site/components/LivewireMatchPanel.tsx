import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import type { RecentMatch } from "@/components/RecentMatchesFeed";
import { BORDER, CARD, DIM, GOLD, MUTED, PURPLE_ACCENT, PURPLE_BORDER, PURPLE_SUBTLE, TEXT } from "@/lib/designTokens";

export const LIVEWIRE_PAGE_SIZE = 6;

export function firmLabel(m: RecentMatch) {
  if (m.investor_firm && m.investor_firm !== "-" && m.investor_firm !== m.investor_name) {
    return m.investor_firm;
  }
  return m.investor_name;
}

/** Collapse hourly freshness to "today" so the tape reads like the livewire mock. */
export function livewireTimeLabel(timeAgo: string | null | undefined) {
  const raw = String(timeAgo || "").trim().toLowerCase();
  if (!raw || raw === "just now" || raw === "recent" || /m ago$/.test(raw) || /h ago$/.test(raw)) {
    return "today";
  }
  return String(timeAgo).trim();
}

export function livewireMeta(m: Pick<RecentMatch, "time_ago" | "startup_god_score">) {
  const time = livewireTimeLabel(m.time_ago);
  const god = m.startup_god_score != null && Number.isFinite(Number(m.startup_god_score))
    ? Math.round(Number(m.startup_god_score))
    : null;
  return god != null ? `${time} -- ${god}` : time;
}

export function livewireHeaderStatus(loading: boolean, visibleCount: number, page: number, pageCount: number) {
  if (loading && visibleCount === 0) return "Refreshing";
  if (pageCount > 1) return `${page + 1} of ${pageCount}`;
  return "Live network";
}

/** Full pages only — leftover rows stay off the tape so two panels never overlap. */
export function livewirePageCount(itemCount: number, size = LIVEWIRE_PAGE_SIZE, minPages = 1) {
  if (itemCount <= 0) return 1;
  const full = Math.floor(itemCount / size);
  return Math.max(minPages, full || 1);
}

/** Always fill `size` rows. Uses full pages; wraps only when the pool is shorter than one page. */
export function fillTapePage<T>(items: T[], page: number, size: number): T[] {
  if (!items.length || size <= 0) return [];
  const count = Math.min(size, items.length);
  const pages = Math.max(1, Math.floor(items.length / count) || 1);
  const start = (page % pages) * count;
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length]);
}

function ScoreBadge({ score }: { score: number }) {
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
      aria-label={`Match score ${score}`}
    >
      {score}
    </span>
  );
}

function MatchCell({
  match,
  index,
  stacked,
}: {
  match: RecentMatch;
  index: number;
  stacked: boolean;
}) {
  return (
    <Link
      href={match.startup_id ? `/startup/${encodeURIComponent(match.startup_id)}` : "/matches"}
      className="flex items-center justify-between gap-4 px-5 py-3 min-w-0"
      style={{ borderTop: stacked && index === 0 ? undefined : `1px solid ${BORDER}` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = PURPLE_SUBTLE;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <div className="min-w-0">
        <p className="font-display font-bold text-[1.02rem] leading-tight truncate" style={{ color: TEXT }}>
          {match.startup_name}
          <span style={{ color: MUTED, fontWeight: 500 }}> -- </span>
          {firmLabel(match)}
        </p>
        <p className="text-[12px] font-mono mt-0.5 truncate" style={{ color: DIM }}>
          {livewireMeta(match)}
        </p>
      </div>
      <ScoreBadge score={Math.round(match.match_score)} />
    </Link>
  );
}

export function LivewireMatchPanel({
  id,
  matches,
  loading,
  page,
  pageCount,
  onPage,
  onPause,
  footerHref = "/matches",
  footerLabel = "Inspect the network",
  orientation = "vertical",
}: {
  id: string;
  matches: RecentMatch[];
  loading: boolean;
  page: number;
  pageCount: number;
  onPage?: (page: number) => void;
  onPause?: (paused: boolean) => void;
  footerHref?: string;
  footerLabel?: string;
  orientation?: "vertical" | "horizontal";
}) {
  const visible = fillTapePage(matches, page, LIVEWIRE_PAGE_SIZE);
  const horizontal = orientation === "horizontal";

  return (
    <aside
      id={id}
      className={`rounded-xl text-left ${horizontal ? "" : "flex flex-col h-full"}`}
      style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}` }}
      aria-label="Livewire investor matches"
      onMouseEnter={() => onPause?.(true)}
      onMouseLeave={() => onPause?.(false)}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p
          className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase flex items-center gap-2"
          style={{ color: PURPLE_ACCENT }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
            style={{ backgroundColor: PURPLE_ACCENT }}
            aria-hidden
          />
          Livewire matches
        </p>
        <span className="text-[12px] font-mono" style={{ color: DIM }}>
          {livewireHeaderStatus(loading, visible.length, page, pageCount)}
        </span>
      </div>

      {loading && visible.length === 0 ? (
        <div
          className={horizontal ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "flex-1 px-5 py-3 space-y-2"}
          aria-hidden
        >
          {Array.from({ length: LIVEWIRE_PAGE_SIZE }, (_, i) => (
            <div
              key={i}
              className={horizontal ? "h-16 m-3 rounded animate-pulse" : "h-14 rounded animate-pulse"}
              style={{ backgroundColor: BORDER }}
            />
          ))}
        </div>
      ) : visible.length ? (
        <div className={horizontal ? "" : "flex-1"} aria-live="polite">
          <div className={horizontal ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : undefined}>
            {visible.map((m, i) => (
              <MatchCell key={`${m.match_id}-${i}`} match={m} index={i} stacked={!horizontal} />
            ))}
          </div>
          {pageCount > 1 && onPage ? (
            <div
              className={`flex items-center gap-1.5 px-5 pb-3 ${horizontal ? "justify-center pt-3" : "pt-2"}`}
              role="tablist"
              aria-label="Rotate livewire matches"
            >
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === page}
                  aria-label={`Show matches page ${i + 1} of ${pageCount}`}
                  onClick={() => onPage(i)}
                  className="rounded-full"
                  style={{
                    width: i === page ? 14 : 6,
                    height: 6,
                    backgroundColor: i === page ? PURPLE_ACCENT : BORDER,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-5 py-8 text-[15px] leading-relaxed" style={{ color: MUTED }}>
          Ranked investor matches appear here from the live network. Paste a URL to preview yours.
        </p>
      )}

      <Link
        href={footerHref}
        className="flex items-center justify-between px-5 py-3 text-[14px]"
        style={{ borderTop: `1px solid ${BORDER}`, color: PURPLE_ACCENT }}
      >
        {footerLabel} <ArrowRight size={14} />
      </Link>
    </aside>
  );
}
