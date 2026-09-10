import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useRecentMatches, type RecentMatch } from "@/components/RecentMatchesFeed";
import { AMBER, BORDER, CARD, DIM, G, G_BORDER, MUTED, TEXT } from "@/lib/designTokens";

export const FEATURED_MATCH_POOL = 8;
export const FEATURED_MATCH_ROTATE_MS = 8000;

function firmLabel(m: RecentMatch) {
  if (m.investor_firm && m.investor_firm !== "-" && m.investor_firm !== m.investor_name) {
    return m.investor_firm;
  }
  return m.investor_name;
}

function formatStageLabel(stage: string | number | null | undefined): string | null {
  if (stage == null || stage === "") return null;
  const n = typeof stage === "number" ? stage : Number.parseInt(String(stage).trim(), 10);
  const map: Record<number, string> = {
    0: "Pre-seed",
    1: "Pre-seed",
    2: "Seed",
    3: "Series A",
    4: "Series B",
    5: "Series C+",
  };
  if (Number.isFinite(n) && map[n]) return map[n];
  const s = String(stage).trim();
  return s && !/^\d+$/.test(s) ? s : null;
}

function isInternalReason(r: string): boolean {
  return /investor tier|signal:\s*emerging|stage:\s*\d+\b/i.test(r);
}

function humanizeReason(r: string): string {
  const stageMatch = r.match(/^Stage:\s*(.+)$/i);
  if (!stageMatch) return r;
  const label = formatStageLabel(stageMatch[1]);
  return label ? `Stage: ${label}` : r;
}

export function matchReasons(m: RecentMatch): string[] {
  const reasons: string[] = [];
  const why = m.why_you_match;
  if (Array.isArray(why)) {
    for (const item of why) {
      const t = String(item || "").trim();
      if (t) reasons.push(t);
    }
  } else if (typeof why === "string" && why.trim()) {
    for (const part of why.split(/\s*[·•|\n]+\s*/)) {
      if (part.trim()) reasons.push(part.trim());
    }
  }
  const stageLabel = formatStageLabel(m.startup_stage);
  if (stageLabel) reasons.push(`Stage: ${stageLabel}`);
  const sector = m.startup_sectors?.find(Boolean);
  if (sector) reasons.push(`Sector: ${sector}`);
  if (m.reasoning) {
    const first = String(m.reasoning).split(/[.!\n]/)[0]?.trim();
    if (first && first.length > 12 && first.length < 140) reasons.push(first);
  }
  const seen = new Set<string>();
  return reasons
    .map(humanizeReason)
    .filter((r) => r && !isInternalReason(r))
    .filter((r) => {
      const key = r.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export default function HomeFeaturedMatch() {
  const { matches, loading } = useRecentMatches(FEATURED_MATCH_POOL);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (matches.length < 2) {
      setIndex(0);
      return;
    }
    setIndex(Math.floor(Date.now() / FEATURED_MATCH_ROTATE_MS) % matches.length);
  }, [matches]);

  useEffect(() => {
    if (matches.length < 2 || paused) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % matches.length);
    }, FEATURED_MATCH_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [matches.length, paused]);

  const match = matches[index] ?? matches[0] ?? null;
  const reasons = match ? matchReasons(match) : [];
  const fit = match ? Math.min(100, Math.max(0, Math.round(match.match_score))) : null;

  return (
    <aside
      id="featured-match"
      className="rounded-xl text-left flex flex-col"
      style={{ backgroundColor: CARD, border: `1px solid ${G_BORDER}`, minHeight: 280 }}
      aria-label="Rotating live investor match"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p className="text-[11px] font-medium tracking-wide" style={{ color: MUTED }}>
          Live example
        </p>
        <span className="text-[12px] font-mono" style={{ color: DIM }}>
          {matches.length > 1
            ? `${index + 1} of ${matches.length}`
            : match?.time_ago
              ? `Updated ${match.time_ago}`
              : "Live network"}
        </span>
      </div>

      {loading && !match ? (
        <div className="flex-1 px-5 py-6" aria-hidden>
          <div className="h-6 w-2/3 rounded mb-3 animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-4 w-1/3 rounded mb-6 animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-3 w-full rounded mb-2 animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-3 w-5/6 rounded mb-2 animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-3 w-2/3 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
        </div>
      ) : match ? (
        <div className="px-5 py-5 flex-1" aria-live="polite">
          <p className="text-[13px] mb-1" style={{ color: MUTED }}>{match.startup_name}</p>
          <p className="font-display font-bold text-xl leading-tight mb-3" style={{ color: TEXT }}>
            {firmLabel(match)}
          </p>
          <p className="text-[15px] font-medium mb-1" style={{ color: G }}>
            Investor fit: {fit}/100
          </p>
          <p className="text-[13px] mb-4" style={{ color: MUTED }}>
            Startup GOD {match.startup_god_score ?? "—"}
            {" · "}
            <a href="/methodology" className="underline underline-offset-2" style={{ color: MUTED }}>
              How scoring works
            </a>
          </p>
          <p className="text-[11px] font-medium tracking-wide uppercase mb-2" style={{ color: DIM }}>
            Why this match
          </p>
          {reasons.length ? (
            <ul className="space-y-1.5 mb-4">
              {reasons.map((r) => (
                <li key={r} className="text-[14px] leading-snug" style={{ color: TEXT }}>
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] leading-snug mb-4" style={{ color: MUTED }}>
              Ranked by thesis, stage, and observed investor behavior.
            </p>
          )}
          {matches.length > 1 ? (
            <div className="flex items-center gap-1.5 mt-1" role="tablist" aria-label="Rotate featured match">
              {matches.map((m, i) => (
                <button
                  key={m.match_id || i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show match ${i + 1} of ${matches.length}`}
                  onClick={() => setIndex(i)}
                  className="rounded-full"
                  style={{
                    width: i === index ? 14 : 6,
                    height: 6,
                    backgroundColor: i === index ? AMBER : BORDER,
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
        href="/matches"
        className="flex items-center justify-between px-5 py-3 text-[14px]"
        style={{ borderTop: `1px solid ${BORDER}`, color: G }}
      >
        See all live matches <ArrowRight size={14} />
      </Link>
    </aside>
  );
}
