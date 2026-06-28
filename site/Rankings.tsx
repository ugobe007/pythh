/*
 * PYTHH.AI — RANKINGS PAGE
 * Design: Obsidian Terminal — Data Noir
 * Live investor signal table with search, sector filters, column sort, and Oracle gate.
 */
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Lock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import StartupCTA from "@/components/design/StartupCTA";
import { toast } from "sonner";
import InvestorDetailModal from "@/components/InvestorDetailModal";
import SharedNavbar from "@/components/SharedNavbar";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = "signal" | "god" | "vcpp" | "delta" | "name" | "firm";
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = ["All", "AI/ML", "SaaS", "FinTech", "DeepTech", "BioTech", "Robotics", "SpaceTech", "Climate", "Consumer", "Enterprise"];

const SECTOR_COLORS: Record<string, string> = {
  "AI/ML":       "oklch(0.696 0.17 162.48)",
  "SaaS":        "oklch(0.769 0.188 70.08)",
  "FinTech":     "oklch(0.72 0.15 250)",
  "DeepTech":    "oklch(0.65 0.18 300)",
  "BioTech":     "oklch(0.72 0.18 145)",
  "Robotics":    "oklch(0.75 0.16 195)",
  "SpaceTech":   "oklch(0.65 0.15 220)",
  "Climate":     "oklch(0.70 0.17 160)",
  "Consumer":    "oklch(0.75 0.15 50)",
  "Enterprise":  "oklch(0.68 0.12 240)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(intX10: number, decimals = 1) {
  return (intX10 / 10).toFixed(decimals);
}

function SignalBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 100) * 100);
  return (
    <div className="h-1 w-16 rounded-full" style={{ backgroundColor: "oklch(0.22 0.01 264)" }}>
      <div
        className="h-1 rounded-full"
        style={{ width: `${pct}%`, backgroundColor: "oklch(0.696 0.17 162.48)" }}
      />
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
      <TrendingUp size={11} />+{fmt(delta)}
    </span>
  );
  if (delta < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: "oklch(0.65 0.18 25)" }}>
      <TrendingDown size={11} />{fmt(delta)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
      <Minus size={11} />0.0
    </span>
  );
}

function SectorChip({ sector }: { sector: string }) {
  const color = SECTOR_COLORS[sector] ?? "oklch(0.55 0.01 264)";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {sector}
    </span>
  );
}

function SortIcon({ field, sortBy, sortDir }: { field: SortField; sortBy: SortField; sortDir: SortDir }) {
  if (sortBy !== field) return <ChevronsUpDown size={12} style={{ color: "oklch(0.4 0.01 264)" }} />;
  return sortDir === "asc"
    ? <ChevronUp size={12} style={{ color: "oklch(0.696 0.17 162.48)" }} />
    : <ChevronDown size={12} style={{ color: "oklch(0.696 0.17 162.48)" }} />;
}

// ─── Locked Row Overlay ───────────────────────────────────────────────────────

function LockedRow({ rank }: { rank: number }) {
  return (
    <tr style={{ borderBottom: "1px solid oklch(0.18 0.01 264)" }}>
      <td className="py-3 px-4 text-center">
        <span className="font-mono text-sm" style={{ color: "oklch(0.35 0.01 264)" }}>#{rank}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "oklch(0.2 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
            <Lock size={12} style={{ color: "oklch(0.35 0.01 264)" }} />
          </div>
          <div>
            <div className="h-3 w-28 rounded" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
            <div className="h-2 w-20 rounded mt-1.5" style={{ backgroundColor: "oklch(0.18 0.01 264)" }} />
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="h-3 w-16 rounded" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
      </td>
      {["", "", "", "", ""].map((_, i) => (
        <td key={i} className="py-3 px-4 text-center">
          <div className="h-3 w-10 rounded mx-auto" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Rankings() {
  const { user, isAuthenticated } = useAuth();

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All");
  const [sortBy, setSortBy] = useState<SortField>("signal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedInvestorId, setSelectedInvestorId] = useState<number | null>(null);

  // Debounce search to avoid hammering the server
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._rankingSearchTimer);
    (window as any)._rankingSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const { data, isLoading, isError, refetch } = trpc.investors.getRankings.useQuery({
    search: debouncedSearch || undefined,
    sector: sector !== "All" ? sector : undefined,
    sortBy,
    sortDir,
    limit: 50,
    offset: 0,
  });

  const investors = data?.investors ?? [];
  const isOracle = data?.isOracle ?? false;
  const total = data?.total ?? 0;
  const publicCount = investors.length;

  // Number of locked rows to show (simulate full dataset for non-Oracle users)
  const lockedCount = isOracle ? 0 : Math.max(0, 44 - investors.length);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  const colHeader = (label: string, field: SortField, align: "left" | "center" = "center") => (
    <th
      className={`py-3 px-4 text-${align} cursor-pointer select-none`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1 text-xs font-bold tracking-widest"
        style={{ color: sortBy === field ? "oklch(0.696 0.17 162.48)" : "oklch(0.45 0.01 264)" }}>
        {label}
        <SortIcon field={field} sortBy={sortBy} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>Investor Rankings — Pythh.ai</title>
        <meta name="description" content="Live investor signal rankings. Filter by sector, sort by GOD score or VCPP, and discover which VCs are most likely to fund your startup right now." />
        <meta property="og:title" content="Investor Rankings — Pythh.ai" />
        <meta property="og:description" content="Real-time investor signal intelligence. 44+ top VCs ranked by thesis alignment, portfolio velocity, and check-writing probability." />
        <meta property="og:url" content="https://pythh.ai/investors" />
      </Helmet>
      <SharedNavbar activePath="/investors" />

      <div className="container pt-24 pb-20">
        {/* ── Header (2-panel) ── */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 mb-10 items-start pt-4">

          {/* Left: headline + copy */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Investor Intelligence
              </span>
            </div>
            <h1
              className="font-display font-bold mb-5 leading-tight"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", color: "oklch(0.97 0.005 264)" }}
            >
              The investors who are<br />
              <span style={{ color: "oklch(0.696 0.17 162.48)" }}>funding right now.</span>
            </h1>
            <p className="text-base leading-relaxed mb-3" style={{ color: "oklch(0.62 0.01 264)" }}>
              Pythh's investor intelligence database isn't a contact list. Every record is entity-verified,
              GOD-scored, and ranked by deployment readiness — updated weekly by PYTHIA's composite
              activity model.
            </p>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.52 0.01 264)" }}>
              Signal scores reflect thesis alignment, fund velocity, portfolio cadence, and timing signals.
              The investors surfacing at the top aren't just active — they're active in your space,
              at your stage, right now.
            </p>
            {!isAuthenticated && (
              <StartupCTA href="/matches" showArrow>
                Preview my matches
              </StartupCTA>
            )}
          </div>

          {/* Right: live stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: isOracle ? (total > 0 ? total.toLocaleString() : "4,007") : "4,007", label: "Qualified investors", color: "oklch(0.696 0.17 162.48)" },
              { value: "6,250+",   label: "Investors tracked",       color: "#22d3ee" },
              { value: "91,950",   label: "Active matches",          color: "#a855f7" },
              { value: "Weekly",   label: "Signal score cadence",    color: "#f97316" },
            ].map(({ value, label, color }) => (
              <div
                key={label}
                className="p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
              >
                <div className="text-2xl font-bold mb-0.5" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{label}</div>
              </div>
            ))}
            <div
              className="col-span-2 px-4 py-3 rounded-xl text-xs leading-relaxed"
              style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)", color: "oklch(0.5 0.01 264)" }}
            >
              {isOracle
                ? <span style={{ color: "oklch(0.696 0.17 162.48)" }}>Full Oracle access — all signal data, GOD scores, and VCPP visible.</span>
                : <>Showing {publicCount > 0 ? publicCount : "public"} profiles. <Link href="/pricing"><span className="underline cursor-pointer" style={{ color: "oklch(0.696 0.17 162.48)" }}>Upgrade to Oracle</span></Link> to unlock all 44+ records with full scoring data.</>
              }
            </div>
          </div>
        </div>

        {/* ── Search + Filters ── */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.01 264)" }} />
            <input
              type="text"
              placeholder="Search investor or firm…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                backgroundColor: "oklch(0.14 0.01 264)",
                border: "1px solid oklch(0.22 0.01 264)",
                color: "oklch(0.9 0.005 264)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "oklch(0.696 0.17 162.48 / 0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "oklch(0.22 0.01 264)")}
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.55 0.01 264)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "oklch(0.696 0.17 162.48 / 0.4)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.01 264)")}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* ── Sector Filter Chips ── */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SECTORS.map((s) => {
            const active = sector === s;
            const color = SECTOR_COLORS[s] ?? "oklch(0.696 0.17 162.48)";
            return (
              <button
                key={s}
                onClick={() => setSector(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: active ? (s === "All" ? "oklch(0.696 0.17 162.48)" : color) : "oklch(0.14 0.01 264)",
                  color: active ? (s === "All" ? "oklch(0.1 0.01 162)" : "oklch(0.1 0.01 264)") : "oklch(0.55 0.01 264)",
                  border: `1px solid ${active ? (s === "All" ? "oklch(0.696 0.17 162.48)" : color) : "oklch(0.22 0.01 264)"}`,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* ── Table ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: "1px solid oklch(0.2 0.01 264)", backgroundColor: "oklch(0.13 0.01 264)" }}>
                  <th className="py-3 px-4 text-center w-12">
                    <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.45 0.01 264)" }}>#</span>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <span className="inline-flex items-center gap-1 text-xs font-bold tracking-widest cursor-pointer select-none"
                      style={{ color: sortBy === "name" ? "oklch(0.696 0.17 162.48)" : "oklch(0.45 0.01 264)" }}
                      onClick={() => handleSort("name")}>
                      INVESTOR <SortIcon field="name" sortBy={sortBy} sortDir={sortDir} />
                    </span>
                  </th>
                  <th className="py-3 px-4 text-left">
                    <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.45 0.01 264)" }}>SECTOR</span>
                  </th>
                  {colHeader("SIGNAL", "signal")}
                  {colHeader("Δ WoW", "delta")}
                  {isOracle && colHeader("GOD", "god")}
                  {isOracle && colHeader("VCPP", "vcpp")}
                  <th className="py-3 px-4 text-left">
                    <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.45 0.01 264)" }}>ACTIVITY</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isError ? (
                  <tr>
                    <td colSpan={isOracle ? 8 : 6} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.65 0.18 25)" }}>
                          Failed to load investor data.
                        </p>
                        <p className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
                          Please check your connection and try again.
                        </p>
                        <button
                          onClick={() => refetch()}
                          className="mt-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid oklch(0.15 0.01 264)" }}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="py-4 px-4">
                          <div className="h-3 rounded animate-pulse" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: j === 1 ? "80%" : "60%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : investors.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={isOracle ? 8 : 6} className="py-16 text-center">
                      <p className="text-sm" style={{ color: "oklch(0.45 0.01 264)" }}>
                        No investors match your search. Try a different term or sector.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {investors.map((inv, idx) => (
                      <tr
                        key={inv.id}
                        style={{ borderBottom: "1px solid oklch(0.15 0.01 264)", cursor: "pointer" }}
                        className="transition-colors"
                        onClick={() => setSelectedInvestorId(inv.id)}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.13 0.01 264)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono text-sm font-bold" style={{ color: idx < 3 ? "oklch(0.769 0.188 70.08)" : "oklch(0.4 0.01 264)" }}>
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Investor */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs"
                              style={{
                                backgroundColor: `${SECTOR_COLORS[inv.sector] ?? "oklch(0.696 0.17 162.48)"}20`,
                                color: SECTOR_COLORS[inv.sector] ?? "oklch(0.696 0.17 162.48)",
                                border: `1px solid ${SECTOR_COLORS[inv.sector] ?? "oklch(0.696 0.17 162.48)"}40`,
                              }}
                            >
                              {inv.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                            </div>
                            <div>
                              <p className="text-sm font-semibold leading-tight" style={{ color: "oklch(0.92 0.005 264)" }}>
                                {inv.name}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>
                                {inv.firm}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Sector */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <SectorChip sector={inv.sector} />
                            {inv.sector2 && <SectorChip sector={inv.sector2} />}
                          </div>
                        </td>

                        {/* Signal */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono font-bold text-sm" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                              {fmt(inv.signal)}
                            </span>
                            <SignalBar value={inv.signal} />
                          </div>
                        </td>

                        {/* Delta */}
                        <td className="py-3.5 px-4 text-center">
                          <DeltaBadge delta={inv.delta} />
                        </td>

                        {/* GOD — Oracle only */}
                        {isOracle && (
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono text-sm font-semibold" style={{ color: "oklch(0.769 0.188 70.08)" }}>
                              {inv.god}
                            </span>
                          </td>
                        )}

                        {/* VCPP — Oracle only */}
                        {isOracle && (
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-mono text-sm font-semibold" style={{ color: "oklch(0.72 0.15 250)" }}>
                              {inv.vcpp}
                            </span>
                          </td>
                        )}

                        {/* Activity */}
                        <td className="py-3.5 px-4">
                          {inv.recentActivity ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                              style={{ backgroundColor: "oklch(0.15 0.01 264)", color: "oklch(0.55 0.01 264)" }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
                              {inv.recentActivity}
                            </span>
                          ) : (
                            <span style={{ color: "oklch(0.35 0.01 264)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Locked rows for non-Oracle users */}
                    {!isOracle && lockedCount > 0 &&
                      Array.from({ length: Math.min(lockedCount, 34) }).map((_, i) => (
                        <LockedRow key={`locked-${i}`} rank={investors.length + i + 1} />
                      ))
                    }
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Oracle Upsell Banner (non-subscribers) ── */}
          {!isOracle && (
            <div
              className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                borderTop: "1px solid oklch(0.2 0.01 264)",
                background: "linear-gradient(to right, oklch(0.13 0.01 264), oklch(0.15 0.015 264))",
              }}
            >
              <div className="flex items-center gap-3">
                <Lock size={16} style={{ color: "oklch(0.769 0.188 70.08)", flexShrink: 0 }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 264)" }}>
                    {lockedCount} more investors locked
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>
                    Upgrade to Oracle to unlock GOD scores, VCPP scores, and the full ranked list.
                  </p>
                </div>
              </div>
              <Link href="/pricing">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                  style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.82 0.188 70.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.769 0.188 70.08)"; }}
                >
                  Start 7-day free trial
                  <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* ── Footer note ── */}
        <p className="text-xs mt-6 text-center" style={{ color: "oklch(0.35 0.01 264)" }}>
          Signal scores are updated weekly by PYTHIA's composite activity model.
          {isOracle ? " GOD = Growth, Opportunity, Deployment. VCPP = VC Pattern Proximity." : ""}
        </p>
      </div>

      {/* Investor detail slide-over modal */}
      <InvestorDetailModal
        investorId={selectedInvestorId}
        onClose={() => setSelectedInvestorId(null)}
        isOracle={isOracle}
      />
    </div>
  );
}
