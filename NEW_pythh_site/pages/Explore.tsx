/**
 * /explore — PYTHH STARTUP EXPLORER (Production)
 *
 * Search the Pythh database by name, sector, or stage.
 * Results ranked by GOD score with live filtering.
 * Design: Data-noir terminal style consistent with Rankings.
 */
import { Helmet } from "react-helmet-async";
import { useState, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Search, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

import SharedNavbar from "@/components/SharedNavbar";
// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = [
  "AI/ML", "SaaS", "FinTech", "HealthTech", "CleanTech",
  "Cybersecurity", "EdTech", "Developer Tools", "Consumer", "Marketplace",
  "DeepTech", "BioTech",
];

const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C+"];

type SortBy = "total_god_score" | "created_at" | "name";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "total_god_score", label: "GOD Score" },
  { value: "created_at", label: "Newest" },
  { value: "name", label: "A → Z" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSectors(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: "oklch(0.35 0.01 264)" }}>—</span>;
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

function SectorChip({ sector, active, onClick }: { sector: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? "oklch(0.696 0.17 162.48 / 0.15)" : "oklch(0.14 0.01 264)",
        color: active ? "oklch(0.696 0.17 162.48)" : "oklch(0.55 0.01 264)",
        border: active
          ? "1px solid oklch(0.696 0.17 162.48 / 0.4)"
          : "1px solid oklch(0.22 0.01 264)",
      }}
    >
      {sector}
    </button>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────



// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function Explore() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("total_god_score");
  const [page, setPage] = useState(0);

  // Debounce search input
  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    setPage(0);
    clearTimeout((window as unknown as Record<string, unknown>)._exploreTimer as ReturnType<typeof setTimeout>);
    (window as unknown as Record<string, unknown>)._exploreTimer = setTimeout(() => setDebouncedQuery(val), 320);
  }, []);

  const handleSector = (s: string) => {
    setSector((prev) => (prev === s ? "" : s));
    setPage(0);
  };

  const { data, isLoading, isError, refetch } = trpc.startups.search.useQuery(
    {
      query: debouncedQuery || undefined,
      sector: sector || undefined,
      stage: stage || undefined,
      sortBy,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { staleTime: 60_000 }
  );

  const startups = data?.startups ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>Explore Startups — Pythh.ai</title>
        <meta
          name="description"
          content="Search and explore startups in the Pythh database. Filter by sector, stage, and GOD score to find companies worth watching."
        />
        <meta property="og:title" content="Explore Startups — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/explore" />
      </Helmet>

      <SharedNavbar activePath="/explore" />

      <main className="container pt-24 pb-16">

        {/* Header */}
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[1.5px] mb-2 flex items-center gap-2"
            style={{ color: "oklch(0.55 0.01 264)" }}>
            <span className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
            startup database
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-2">
            Explore{" "}
            <span style={{ color: "oklch(0.696 0.17 162.48)" }}>Startups</span>
          </h1>
          <p className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>
            Search {total > 0 ? total.toLocaleString() : "…"} startups ranked by GOD signal score
          </p>
        </div>

        {/* Search Bar */}
        <div
          className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl"
          style={{
            backgroundColor: "oklch(0.12 0.01 264)",
            border: "1px solid oklch(0.22 0.01 264)",
          }}
        >
          <Search size={16} style={{ color: "oklch(0.45 0.01 264)", flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by startup name…"
            className="flex-1 bg-transparent text-sm text-white outline-none"
            style={{ caretColor: "oklch(0.696 0.17 162.48)" }}
          />
          {query && (
            <button onClick={() => { setQuery(""); setDebouncedQuery(""); setPage(0); }}>
              <X size={14} style={{ color: "oklch(0.45 0.01 264)" }} />
            </button>
          )}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Stage dropdown */}
          <select
            value={stage}
            onChange={(e) => { setStage(e.target.value); setPage(0); }}
            className="text-sm rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer"
            style={{
              backgroundColor: "oklch(0.12 0.01 264)",
              border: "1px solid oklch(0.22 0.01 264)",
              color: stage ? "oklch(0.85 0.01 264)" : "oklch(0.45 0.01 264)",
            }}
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(0); }}
            className="text-sm rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer"
            style={{
              backgroundColor: "oklch(0.12 0.01 264)",
              border: "1px solid oklch(0.22 0.01 264)",
              color: "oklch(0.65 0.01 264)",
            }}
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Active filter summary */}
          {(sector || stage) && (
            <button
              onClick={() => { setSector(""); setStage(""); setPage(0); }}
              className="text-xs flex items-center gap-1"
              style={{ color: "oklch(0.65 0.18 25)" }}
            >
              <X size={11} /> Clear filters
            </button>
          )}
        </div>

        {/* Sector Chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SECTORS.map((s) => (
            <SectorChip key={s} sector={s} active={sector === s} onClick={() => handleSector(s)} />
          ))}
        </div>

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid oklch(0.2 0.01 264)" }}
        >
          {/* Table Header */}
          <div
            className="grid gap-4 px-4 py-3 border-b text-xs font-bold tracking-widest"
            style={{
              gridTemplateColumns: "1fr 160px 100px 80px",
              color: "oklch(0.45 0.01 264)",
              borderColor: "oklch(0.18 0.01 264)",
              backgroundColor: "oklch(0.115 0.01 264)",
            }}
          >
            <div>Startup</div>
            <div>Sector</div>
            <div>Stage</div>
            <div className="text-center" style={{ color: "oklch(0.696 0.17 162.48)" }}>GOD</div>
          </div>

          {/* Rows */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <span className="text-sm animate-pulse" style={{ color: "oklch(0.45 0.01 264)" }}>
                  Searching…
                </span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="text-sm" style={{ color: "oklch(0.65 0.18 25)" }}>Failed to load</span>
                <button
                  onClick={() => refetch()}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{ border: "1px solid oklch(0.3 0.01 264)", color: "oklch(0.55 0.01 264)" }}
                >
                  Retry
                </button>
              </div>
            ) : startups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <span className="text-sm" style={{ color: "oklch(0.45 0.01 264)" }}>
                  No startups found
                </span>
                {(query || sector || stage) && (
                  <button
                    onClick={() => { setQuery(""); setDebouncedQuery(""); setSector(""); setStage(""); setPage(0); }}
                    className="text-xs"
                    style={{ color: "oklch(0.696 0.17 162.48)" }}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              startups.map((s) => {
                const sectors = parseSectors(s.sectors);
                return (
                  <div
                    key={s.id}
                    className="grid gap-4 px-4 py-3 border-b hover:bg-white/[0.02] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 160px 100px 80px",
                      borderColor: "oklch(0.16 0.01 264)",
                    }}
                  >
                    {/* Name + tagline */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{s.name}</span>
                        {s.website && (
                          <a
                            href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={11} style={{ color: "oklch(0.4 0.01 264)", flexShrink: 0 }} />
                          </a>
                        )}
                      </div>
                      {s.tagline && (
                        <p className="text-xs truncate mt-0.5" style={{ color: "oklch(0.45 0.01 264)" }}>
                          {s.tagline}
                        </p>
                      )}
                    </div>

                    {/* Sectors */}
                    <div className="flex flex-wrap gap-1 items-center">
                      {sectors.slice(0, 2).map((sec) => (
                        <span
                          key={sec}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "oklch(0.16 0.01 264)", color: "oklch(0.5 0.01 264)" }}
                        >
                          {sec}
                        </span>
                      ))}
                    </div>

                    {/* Stage */}
                    <div className="text-xs self-center" style={{ color: "oklch(0.5 0.01 264)" }}>
                      {s.stage ?? "—"}
                    </div>

                    {/* GOD Score */}
                    <div className="text-center self-center">
                      <ScorePill score={s.total_god_score} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {startups.length > 0 && (
            <div
              className="px-4 py-3 border-t flex items-center justify-between"
              style={{ borderColor: "oklch(0.18 0.01 264)", backgroundColor: "oklch(0.115 0.01 264)" }}
            >
              <span className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{" "}
                <span className="text-white font-medium">{total.toLocaleString()}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded transition-colors disabled:opacity-30"
                  style={{ color: "oklch(0.55 0.01 264)" }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
                  {page + 1} / {Math.max(1, totalPages)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded transition-colors disabled:opacity-30"
                  style={{ color: "oklch(0.55 0.01 264)" }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div
          className="mt-8 p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
        >
          <div>
            <p className="text-sm font-medium text-white mb-1">See how you rank</p>
            <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
              Submit your startup URL to get your GOD score and investor matches.
            </p>
          </div>
          <a
            href={getLoginUrl()}
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)",
              color: "oklch(0.696 0.17 162.48)",
              border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
            }}
          >
            Analyze my startup
          </a>
        </div>
      </main>
    </div>
  );
}
