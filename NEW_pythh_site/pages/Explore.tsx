/**
 * /explore — PYTHH STARTUP EXPLORER (Production)
 *
 * Search the Pythh database by name, sector, or stage.
 * Results ranked by GOD score with live filtering.
 * Design: Data-noir terminal style consistent with Rankings.
 */
import { Helmet } from "react-helmet-async";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import FilterTabs from "@/components/design/FilterTabs";
import InlineMeta from "@/components/design/InlineMeta";
import SectionLabel from "@/components/design/SectionLabel";
import StartupCTA from "@/components/design/StartupCTA";
import {
  G, CYAN, AMBER, MUTED, DIM, BORDER, CARD, PAGE, TEXT,
  godScoreColor,
} from "@/lib/designTokens";

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

function parseSectors(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function GodScore({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: DIM }}>—</span>;
  return (
    <span className="font-mono font-semibold tabular-nums text-sm" style={{ color: godScoreColor(score) }}>
      {score}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function Explore() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("total_god_score");
  const [page, setPage] = useState(0);

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
    <div className="min-h-screen" style={{ backgroundColor: PAGE, color: TEXT }}>
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

      <main className="container max-w-5xl pt-24 pb-16 px-4 sm:px-6">
        <header className="mb-8 pb-8 border-b" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Startup database</SectionLabel>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-2">
            Explore <span style={{ color: G }}>Startups</span>
          </h1>
          <p className="text-sm" style={{ color: MUTED }}>
            Search {total > 0 ? total.toLocaleString() : "…"} startups ranked by GOD signal score
          </p>
        </header>

        <div
          className="flex items-center gap-3 mb-6 px-4 py-3 border"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <Search size={16} style={{ color: DIM, flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by startup name…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ caretColor: G }}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); setDebouncedQuery(""); setPage(0); }}>
              <X size={14} style={{ color: DIM }} />
            </button>
          )}
        </div>

        <div className="space-y-4 mb-6 pb-6 border-b" style={{ borderColor: BORDER }}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest shrink-0 w-14" style={{ color: DIM }}>
              Stage
            </span>
            <select
              value={stage}
              onChange={(e) => { setStage(e.target.value); setPage(0); }}
              className="text-sm bg-transparent border-0 outline-none cursor-pointer font-mono"
              style={{ color: stage ? TEXT : MUTED }}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ color: DIM }}>|</span>
            <span className="text-[10px] font-mono uppercase tracking-widest shrink-0" style={{ color: DIM }}>
              Sort
            </span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(0); }}
              className="text-sm bg-transparent border-0 outline-none cursor-pointer font-mono"
              style={{ color: MUTED }}
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {(sector || stage) && (
              <>
                <span style={{ color: DIM }}>|</span>
                <button
                  type="button"
                  onClick={() => { setSector(""); setStage(""); setPage(0); }}
                  className="text-xs font-mono bg-transparent border-0 p-0 cursor-pointer"
                  style={{ color: AMBER }}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>

          <FilterTabs
            label="Sector"
            value={sector || "all"}
            onChange={(id) => handleSector(id === "all" ? "" : id)}
            labelWidth="w-14"
            options={[
              { id: "all", label: "All" },
              ...SECTORS.map((s) => ({ id: s, label: s })),
            ]}
          />
        </div>

        <div className="border overflow-hidden" style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <div
            className="grid gap-4 px-4 py-3 border-b text-[10px] font-mono uppercase tracking-widest"
            style={{
              gridTemplateColumns: "1fr 160px 100px 80px",
              color: DIM,
              borderColor: BORDER,
            }}
          >
            <div>Startup</div>
            <div>Sector</div>
            <div>Stage</div>
            <div className="text-center" style={{ color: G }}>GOD</div>
          </div>

          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <span className="text-sm font-mono animate-pulse" style={{ color: DIM }}>Searching…</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="text-sm font-mono" style={{ color: AMBER }}>Failed to load</span>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs font-mono bg-transparent border-0 cursor-pointer"
                  style={{ color: G }}
                >
                  Retry
                </button>
              </div>
            ) : startups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <span className="text-sm" style={{ color: MUTED }}>No startups found</span>
                {(query || sector || stage) && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setDebouncedQuery(""); setSector(""); setStage(""); setPage(0); }}
                    className="text-xs font-mono bg-transparent border-0 cursor-pointer"
                    style={{ color: G }}
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
                    className="grid gap-4 px-4 py-4 border-b last:border-b-0 hover:bg-white/[0.02] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 160px 100px 80px",
                      borderColor: BORDER,
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        {s.website && (
                          <a
                            href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={11} style={{ color: DIM, flexShrink: 0 }} />
                          </a>
                        )}
                      </div>
                      {s.tagline && (
                        <p className="text-xs truncate mt-0.5" style={{ color: MUTED }}>{s.tagline}</p>
                      )}
                    </div>

                    <div className="self-center">
                      <InlineMeta items={sectors.slice(0, 2).map((sec) => ({ text: sec, color: CYAN }))} />
                    </div>

                    <div className="text-xs font-mono self-center" style={{ color: MUTED }}>
                      {s.stage ?? "—"}
                    </div>

                    <div className="text-center self-center">
                      <GodScore score={s.total_god_score} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {startups.length > 0 && (
            <div
              className="px-4 py-3 border-t flex items-center justify-between"
              style={{ borderColor: BORDER }}
            >
              <span className="text-xs font-mono" style={{ color: DIM }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 bg-transparent border-0 cursor-pointer disabled:opacity-30"
                  style={{ color: MUTED }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-mono" style={{ color: DIM }}>
                  {page + 1} / {Math.max(1, totalPages)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 bg-transparent border-0 cursor-pointer disabled:opacity-30"
                  style={{ color: MUTED }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="mt-8 p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <div>
            <p className="text-sm font-medium mb-1">See how you rank</p>
            <p className="text-xs" style={{ color: MUTED }}>
              Submit your startup URL to get your GOD score and investor matches.
            </p>
          </div>
          <StartupCTA href="/activate" showArrow>
            Analyze my startup
          </StartupCTA>
        </div>
      </main>
    </div>
  );
}
