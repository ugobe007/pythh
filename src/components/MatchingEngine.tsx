/**
 * MATCHING ENGINE DEMO — Live Match Showcase
 *
 * PURPOSE: Public-facing demo that shows live startup↔investor matches
 * in real-time. Proof that the Pythh matching engine works. This is the
 * SURFACE-LEVEL visualization — the actual matching engine runs server-side.
 *
 * This component READS pre-calculated matches from startup_investor_matches.
 * It does NOT compute matches client-side.
 *
 * Design: Supabase-inspired — flat, minimal, dark, data-dense.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Zap, RefreshCw, Search } from "lucide-react";
import { supabase } from "../lib/supabase";

// ────────────────────────────────────────
// TYPES
// ────────────────────────────────────────

interface MatchRow {
  id: string;
  match_score: number;
  startup_id: string;
  investor_id: string;
  reasoning: string[] | string | null;
  startup: {
    id: string;
    name: string;
    tagline: string | null;
    sectors: string[] | null;
    stage: string | null;
    total_god_score: number | null;
    website: string | null;
    enhanced_god_score?: number | null;
    psychological_multiplier?: number | null;
    is_oversubscribed?: boolean | null;
    has_followon?: boolean | null;
    is_competitive?: boolean | null;
    is_bridge_round?: boolean | null;
    has_sector_pivot?: boolean | null;
    has_social_proof_cascade?: boolean | null;
    is_repeat_founder?: boolean | null;
    has_cofounder_exit?: boolean | null;
  };
  investor: {
    id: string;
    name: string;
    firm: string | null;
    sectors: string[] | null;
    stage: string[] | null;
    check_size_min: number | null;
    check_size_max: number | null;
    type: string | null;
  };
}

// ────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────

function fmtCheck(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  const f = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  };
  return `${min ? f(min) : "$0"} – ${max ? f(max) : "$10M+"}`;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-cyan-400";
  if (score >= 30) return "text-amber-400";
  return "text-zinc-400";
}

function scoreBg(score: number): string {
  if (score >= 75) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 50) return "bg-cyan-500/10 border-cyan-500/20";
  if (score >= 30) return "bg-amber-500/10 border-amber-500/20";
  return "bg-zinc-500/10 border-zinc-500/20";
}

function parseReasoning(r: string[] | string | null): string[] {
  if (!r) return [];
  if (Array.isArray(r)) return r.filter((s) => typeof s === "string" && s.trim());
  if (typeof r === "string") {
    try {
      const parsed = JSON.parse(r);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [r.trim()];
    }
  }
  return [];
}

// ────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────

export default function MatchingEngine() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState({ total: 0, startups: 0, investors: 0 });
  const [searchUrl, setSearchUrl] = useState("");

  // —— Fetch matches ——————————————————————————————————————

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: matchData, error: matchErr } = await supabase
        .from("startup_investor_matches")
        .select("id, match_score, startup_id, investor_id, reasoning")
        .eq("status", "suggested")
        .gte("match_score", 20)
        .order("match_score", { ascending: false })
        .limit(80);

      if (matchErr) throw matchErr;
      if (!matchData?.length) {
        setError("Engine offline — no matches available.");
        setLoading(false);
        return;
      }

      const seen = new Map<string, (typeof matchData)[0]>();
      for (const m of matchData) {
        const key = `${m.startup_id}-${m.investor_id}`;
        const existing = seen.get(key);
        if (!existing || m.match_score > existing.match_score) seen.set(key, m);
      }
      const unique = Array.from(seen.values());

      const sIds = [...new Set(unique.map((m) => m.startup_id).filter(Boolean))];
      const iIds = [...new Set(unique.map((m) => m.investor_id).filter(Boolean))];

      // Parallelize ALL remaining queries: startup details, investor details, AND fast stats RPC
      const [sRes, iRes, platformRes] = await Promise.all([
        supabase
          .from("startup_uploads")
          .select("id, name, tagline, sectors, stage, total_god_score, website, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon, is_competitive, is_bridge_round, has_sector_pivot, has_social_proof_cascade, is_repeat_founder, has_cofounder_exit")
          .in("id", sIds),
        supabase
          .from("investors")
          .select("id, name, firm, sectors, stage, check_size_min, check_size_max, type")
          .in("id", iIds),
        supabase.rpc("get_platform_stats"),
      ]);

      const sMap = new Map((sRes.data || []).map((s: any) => [s.id, s]));
      const iMap = new Map((iRes.data || []).map((i: any) => [i.id, i]));

      const usedS = new Set<string>();
      const usedI = new Set<string>();
      const rows: MatchRow[] = [];

      for (const m of unique) {
        const s = sMap.get(m.startup_id);
        const i = iMap.get(m.investor_id);
        if (!s || !i) continue;
        if (usedS.has(m.startup_id) || usedI.has(m.investor_id)) continue;
        usedS.add(m.startup_id);
        usedI.add(m.investor_id);
        rows.push({ ...m, startup: s, investor: i } as MatchRow);
      }

      for (let x = rows.length - 1; x > 0; x--) {
        const j = Math.floor(Math.random() * (x + 1));
        [rows[x], rows[j]] = [rows[j], rows[x]];
      }

      setMatches(rows);
      const p = platformRes.data || { startups: 0, investors: 0, matches: 0 };
      setStats({
        total: p.matches || 0,
        startups: p.startups || 0,
        investors: p.investors || 0,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    if (matches.length === 0 || isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % matches.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [matches.length, isPaused]);

  const active = matches[activeIndex] || null;
  const reasons = useMemo(() => (active ? parseReasoning(active.reasoning) : []), [active]);

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ——— HEADER ———————————————————————————————————————— */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-white font-semibold hover:text-white/80 transition">
              pythh<span className="text-cyan-400">.ai</span>
            </Link>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 text-sm">Matching Engine</span>
            <span className="flex items-center gap-1.5 ml-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  matches.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                }`}
              />
              <span className={`text-xs ${matches.length > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {matches.length > 0 ? "Live" : "Offline"}
              </span>
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/signals" className="text-zinc-400 hover:text-white transition">
              Signals
            </Link>
            <Link to="/how-it-works" className="text-zinc-400 hover:text-white transition">
              How it works
            </Link>
            <Link
              to="/"
              className="px-3 py-1.5 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition"
            >
              Get matched
            </Link>
          </nav>
        </div>
      </header>

      {/* ——— HERO ————————————————————————————————————————— */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <div className="flex items-start justify-between">
          <div className="max-w-2xl">
            <p className="text-xs text-cyan-400 uppercase tracking-widest mb-3 font-medium">
              Live Engine Output
            </p>
            <h1 className="text-3xl font-bold text-white mb-3">
              Startup ↔ Investor Matching
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed">
              The Pythh engine continuously matches startups with investors using GOD scores,
              signal analysis, and ML-driven alignment. Below is a live feed of real matches
              being generated right now.
            </p>
          </div>
          <div className="flex gap-6 text-right pt-2">
            <div>
              <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Matches</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.startups.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Startups</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.investors.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Investors</p>
            </div>
          </div>
        </div>
      </section>

      {/* ——— ACTIVE MATCH CARD —————————————————————————————— */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        {loading ? (
          <div className="border border-zinc-800 rounded-lg p-12 text-center">
            <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin mx-auto mb-3" />
            <p className="text-zinc-400">Loading engine output...</p>
          </div>
        ) : error ? (
          <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-8 text-center">
            <Zap className="w-6 h-6 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 font-medium mb-2">Engine Offline</p>
            <p className="text-zinc-400 text-sm mb-4">{error}</p>
            <p className="text-zinc-500 text-xs">
              The matching server is down. Matches resume automatically when the server restarts.
            </p>
            <button
              onClick={fetchMatches}
              className="mt-4 px-4 py-2 text-sm border border-zinc-700 rounded hover:border-zinc-600 text-zinc-300 transition"
            >
              Retry
            </button>
          </div>
        ) : active ? (
          <div
            className="border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="px-6 py-3 bg-zinc-900/50 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">
                  Match #{ activeIndex + 1 } of { matches.length }
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-mono font-bold ${scoreColor(active.match_score)}`}>
                  {active.match_score}%
                </span>
                <div className="flex gap-1">
                  {matches.slice(0, 12).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition ${
                        i === activeIndex ? "bg-cyan-400" : "bg-zinc-700 hover:bg-zinc-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-zinc-800/50">
              <div className="p-6">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Startup</p>
                <h3 className="text-lg font-semibold text-white mb-1">{active.startup.name}</h3>
                {active.startup.tagline && (
                  <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{active.startup.tagline}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(active.startup.sectors || []).slice(0, 3).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded">
                      {s}
                    </span>
                  ))}
                  {active.startup.stage && (
                    <span className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                      {active.startup.stage}
                    </span>
                  )}
                </div>
                {active.startup.total_god_score != null && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">GOD Score</span>
                      {active.startup.enhanced_god_score && active.startup.enhanced_god_score > (active.startup.total_god_score || 0) ? (
                        <>
                          <span className="text-sm font-mono font-bold text-zinc-500 line-through">{active.startup.total_god_score}</span>
                          <ArrowRight size={14} className="text-zinc-600" />
                          <span className={`text-sm font-mono font-bold ${scoreColor(active.startup.enhanced_god_score)}`}>
                            {active.startup.enhanced_god_score}
                          </span>
                          {active.startup.psychological_multiplier && (
                            <span className="text-xs text-emerald-400 font-semibold">
                              +{Math.round((active.startup.psychological_multiplier - 1) * 100)}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={`text-sm font-mono font-bold ${scoreColor(active.startup.total_god_score)}`}>
                          {active.startup.total_god_score}
                        </span>
                      )}
                    </div>
                    
                    {/* Psychological Signals */}
                    {(active.startup.is_oversubscribed || active.startup.has_followon || active.startup.has_social_proof_cascade || active.startup.is_repeat_founder) && (
                      <div className="flex flex-wrap gap-1.5">
                        {active.startup.is_oversubscribed && (
                          <span className="px-2 py-0.5 text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded" title="Oversubscribed">
                            🚀 Oversubscribed
                          </span>
                        )}
                        {active.startup.has_followon && (
                          <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded" title="Follow-on">
                            💎 Follow-on
                          </span>
                        )}
                        {active.startup.is_competitive && (
                          <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded" title="Competitive">
                            ⚡ Competitive
                          </span>
                        )}
                        {active.startup.has_social_proof_cascade && (
                          <span className="px-2 py-0.5 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded" title="Social Proof">
                            🌊 Social Proof
                          </span>
                        )}
                        {active.startup.is_repeat_founder && (
                          <span className="px-2 py-0.5 text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded" title="Repeat Founder">
                            🔁 Repeat Founder
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Investor</p>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {active.investor.name}
                  {active.investor.firm && (
                    <span className="text-zinc-500 font-normal"> · {active.investor.firm}</span>
                  )}
                </h3>
                {active.investor.type && (
                  <p className="text-sm text-zinc-400 mb-3">{active.investor.type}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(active.investor.sectors || []).slice(0, 3).map((s, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded">
                      {s}
                    </span>
                  ))}
                  {(active.investor.stage || []).slice(0, 2).map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Check size</span>
                  <span className="text-sm text-zinc-300 font-mono">
                    {fmtCheck(active.investor.check_size_min, active.investor.check_size_max)}
                  </span>
                </div>
              </div>
            </div>

            <div className={`px-6 py-4 border-t border-zinc-800/50 ${scoreBg(active.match_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500 uppercase tracking-wider mr-3">Match Score</span>
                  <span className={`text-xl font-bold font-mono ${scoreColor(active.match_score)}`}>
                    {active.match_score}%
                  </span>
                </div>
                {reasons.length > 0 && (
                  <div className="flex-1 ml-6 max-w-md">
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {reasons[0]}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 text-sm text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition flex items-center gap-2"
                >
                  Get your matches <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ——— MATCH TABLE —————————————————————————————————— */}
      {matches.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
            <div className="px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/50 flex items-center justify-between">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Recent Engine Output</span>
              <button
                onClick={fetchMatches}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1fr_100px_80px] gap-4 px-6 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
              <span>Startup</span>
              <span>Investor</span>
              <span className="text-right">Score</span>
              <span className="text-right">GOD</span>
            </div>

            {matches.slice(0, 20).map((m, i) => (
              <div
                key={m.id}
                onClick={() => setActiveIndex(i)}
                className={`grid grid-cols-[1fr_1fr_100px_80px] gap-4 px-6 py-3 border-b border-zinc-800/20 cursor-pointer transition ${i === activeIndex ? "bg-cyan-500/5 border-l-2 border-l-cyan-400" : "hover:bg-zinc-800/20"}`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{m.startup.name}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {(m.startup.sectors || []).slice(0, 2).join(", ") || "—"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {m.investor.name}
                    {m.investor.firm && (<span className="text-zinc-500"> · {m.investor.firm}</span>)}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {m.investor.type || "Investor"} · {fmtCheck(m.investor.check_size_min, m.investor.check_size_max)}
                  </p>
                </div>
                <div className="text-right self-center">
                  <span className={`text-sm font-mono font-bold ${scoreColor(m.match_score)}`}>
                    {m.match_score}%
                  </span>
                </div>
                <div className="text-right self-center">
                  <span className={`text-sm font-mono ${scoreColor(m.startup.total_god_score || 0)}`}>
                    {m.startup.total_god_score ?? "—"}
                  </span>
                </div>
              </div>
            ))}

            <div className="px-6 py-3 text-center">
              <p className="text-xs text-zinc-600">
                Showing {Math.min(20, matches.length)} of {stats.total.toLocaleString()} total matches ·
                Engine output updates every 60s
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ——— HOW THE ENGINE WORKS ————————————————————————— */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-xs text-zinc-500 uppercase tracking-widest mb-6">How the Engine Works</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              step: "01",
              title: "Continuous Matching",
              desc: "The engine runs ML models to match every startup with every investor, recalculating as new data arrives.",
            },
            {
              step: "02",
              title: "URL Resolution",
              desc: "When a founder submits their URL, the engine scrapes, scores, and matches them with investors in seconds.",
            },
            {
              step: "03",
              title: "GOD Score Integration",
              desc: "New startups are immediately scored by the 23-algorithm GOD system and matched with aligned investors.",
            },
          ].map((item) => (
            <div key={item.step} className="border border-zinc-800/50 rounded-lg p-5 bg-zinc-900/20">
              <span className="text-xs text-cyan-400 font-mono font-bold">{item.step}</span>
              <h3 className="text-sm font-semibold text-white mt-2 mb-2">{item.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ——— FLOATING URL BAR — matches the Matches page design ———— */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/98 backdrop-blur-lg border-t-2 border-cyan-500/60 shadow-[0_-4px_20px_rgba(6,182,212,0.15)]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
              <input
                type="text"
                value={searchUrl}
                onChange={e => setSearchUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchUrl.trim()) {
                    navigate(`/signal-matches?url=${encodeURIComponent(searchUrl.trim())}`);
                  }
                }}
                placeholder="yourstartup.com"
                className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-cyan-500/50 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              />
            </div>
            <button
              onClick={() => {
                if (searchUrl.trim()) {
                  navigate(`/signal-matches?url=${encodeURIComponent(searchUrl.trim())}`);
                }
              }}
              className="px-8 py-3.5 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 transition-all text-base whitespace-nowrap"
            >
              Find Signals →
            </button>
          </div>
        </div>
      </div>

      {/* ——— FOOTER ————————————————————————————————————— */}
      <footer className="border-t border-zinc-800/30 pb-20">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <p className="text-xs text-zinc-600 text-center">
            Matches are generated by the Pythh engine using GOD scores, signal analysis, and ML alignment.
            No guessing. Just math.
          </p>
        </div>
      </footer>
    </div>
  );
}
