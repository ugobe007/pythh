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

/** Always fill `size` rows by wrapping — never leave a short last page. */
export function fillTapePage<T>(items: T[], page: number, size: number): T[] {
  if (!items.length || size <= 0) return [];
  const count = Math.min(size, items.length);
  const pages = Math.max(1, Math.ceil(items.length / count));
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
}) {
  const visible = fillTapePage(matches, page, LIVEWIRE_PAGE_SIZE);

  return (
    <aside
      id={id}
      className="rounded-xl text-left flex flex-col h-full"
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
        <div className="flex-1 px-5 py-3 space-y-2" aria-hidden>
          {Array.from({ length: LIVEWIRE_PAGE_SIZE }, (_, i) => (
            <div key={i} className="h-14 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          ))}
        </div>
      ) : visible.length ? (
        <div className="flex-1" aria-live="polite">
          {visible.map((m, i) => (
            <Link
              key={`${m.match_id}-${i}`}
              href={m.startup_id ? `/startup/${encodeURIComponent(m.startup_id)}` : "/matches"}
              className="flex items-center justify-between gap-4 px-5 py-3"
              style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = PURPLE_SUBTLE;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div className="min-w-0">
                <p className="font-display font-bold text-[1.02rem] leading-tight truncate" style={{ color: TEXT }}>
                  {m.startup_name}
                  <span style={{ color: MUTED, fontWeight: 500 }}> -- </span>
                  {firmLabel(m)}
                </p>
                <p className="text-[12px] font-mono mt-0.5 truncate" style={{ color: DIM }}>
                  {livewireMeta(m)}
                </p>
              </div>
              <ScoreBadge score={Math.round(m.match_score)} />
            </Link>
          ))}
          {pageCount > 1 && onPage ? (
            <div className="flex items-center gap-1.5 px-5 pb-3 pt-2" role="tablist" aria-label="Rotate livewire matches">
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
