import React, { useEffect, useMemo, useState } from 'react';
import { supabase, hasValidSupabaseCredentials } from '../../lib/supabase';
import { Search, ShieldCheck, Zap, Flame, Link as LinkIcon, TrendingUp, AlertCircle } from 'lucide-react';

interface StartupRow { id: string; name: string; tagline?: string; sectors?: string[]; industries?: string[]; total_god_score?: number; }
interface FaithMatch { investor_id: string; faith_alignment_score: number; confidence: number; rationale: any; matched_at?: string; }
interface InvestorRow { id: string; name: string; website?: string; linkedin_url?: string; sectors?: string[]; }
interface FaithSignal { id: string; investor_id: string; signal_type: string; signal_text: string; confidence: number; conviction: number; source_url?: string; published_at?: string; }
interface PortfolioExhaust { id: string; investor_id: string; startup_name?: string; source_type: string; source_url?: string; filing_date?: string; round?: string; amount?: number; }

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="text-xs uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

export default function SignalsExplorer() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StartupRow[]>([]);
  const [selected, setSelected] = useState<StartupRow | null>(null);
  const [matches, setMatches] = useState<FaithMatch[]>([]);
  const [investors, setInvestors] = useState<Record<string, InvestorRow>>({});
  const [signals, setSignals] = useState<Record<string, FaithSignal[]>>({});
  const [exhaust, setExhaust] = useState<Record<string, PortfolioExhaust[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load last selection on mount (Patch B #1)
  useEffect(() => {
    const raw = localStorage.getItem('signals:selected');
    if (raw) {
      try { setSelected(JSON.parse(raw)); } catch {}
    }
  }, []);

  // Auto-select first result when exactly 1 found (Patch B #2)
  useEffect(() => {
    if (!selected && results?.length === 1) {
      handleSelect(results[0]);
    }
  }, [results, selected]);

  // Selection handler with persistence (Patch B #3)
  async function handleSelect(s: StartupRow) {
    setSelected(s);
    localStorage.setItem('signals:selected', JSON.stringify(s));
    await loadForStartup(s);
  }

  // Search startups
  useEffect(() => {
    const run = async () => {
      setError(null);
      if (!query || query.length < 2) { setResults([]); return; }
      try {
        const { data, error } = await supabase
          .from('startup_uploads')
          .select('id, name, tagline, sectors, total_god_score')
          .ilike('name', `%${query}%`)
          .limit(10);
        if (error) throw error;
        setResults((data || []) as StartupRow[]);
      } catch (e: any) {
        setError(e.message || 'Search failed');
      }
    };
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [query]);

  const agg = useMemo(() => {
    if (!matches.length) return { count: 0, top: 0, avg: 0, high90Count: 0 };
    const top = Math.max(...matches.map(m => m.faith_alignment_score || 0));
    const avg = matches.reduce((s,m)=> s + (m.faith_alignment_score||0), 0) / matches.length;
    const high90 = matches.filter(m => (m.faith_alignment_score||0) >= 90).length;
    return { count: matches.length, top, avg, high90Count: high90 };
  }, [matches]);

  async function loadForStartup(s: StartupRow) {
    if (!hasValidSupabaseCredentials) { setError('Missing Supabase credentials'); return; }
    setSelected(s);
    setLoading(true);
    setError(null);
    try {
      // Load matches
      const { data: m, error: me } = await (supabase as any)
        .from('faith_alignment_matches')
        .select('investor_id, faith_alignment_score, confidence, rationale, matched_at')
        .eq('startup_id', s.id)
        .order('faith_alignment_score', { ascending: false })
        .limit(50);
      if (me) throw me;
      setMatches((m || []) as FaithMatch[]);
      const investorIds: string[] = [...new Set(((m||[]) as any[]).map((x:any)=> String(x.investor_id)))];

      // Load investors
      if (investorIds.length) {
        const { data: inv, error: ie } = await supabase
          .from('investors')
          .select('id, name, website, linkedin_url, sectors')
          .in('id', investorIds);
        if (ie) throw ie;
        const invMap: Record<string, InvestorRow> = {};
        (inv||[]).forEach((i:any)=> invMap[i.id] = i);
        setInvestors(invMap);
      } else {
        setInvestors({});
      }

      // Load signals per investor (sample)
      const sigMap: Record<string, FaithSignal[]> = {};
      for (const invId of (Object.keys(investors).length ? Object.keys(investors) : investorIds) as string[]) {
        const { data: sig } = await (supabase as any)
          .from('vc_faith_signals')
          .select('id, investor_id, signal_type, signal_text, confidence, conviction, source_url, published_at')
          .eq('investor_id', invId)
          .order('published_at', { ascending: false })
          .limit(5);
        sigMap[String(invId)] = (sig || []) as FaithSignal[];
      }
      setSignals(sigMap);

      // Load portfolio exhaust per investor (sample)
      const exMap: Record<string, PortfolioExhaust[]> = {};
      for (const invId of (Object.keys(investors).length ? Object.keys(investors) : investorIds) as string[]) {
        const { data: ex } = await (supabase as any)
          .from('vc_portfolio_exhaust')
          .select('id, investor_id, startup_name, source_type, source_url, filing_date, round, amount')
          .eq('investor_id', invId)
          .order('filing_date', { ascending: false })
          .limit(5);
        exMap[String(invId)] = (ex || []) as PortfolioExhaust[];
      }
      setExhaust(exMap);
    } catch (e: any) {
      setError(e.message || 'Failed to load signals');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* SECTION 1 — HERO (Ultra-Minimal) */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-cyan-500/10 p-8">
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 8 }}>signals explorer</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f3f4f6", margin: 0, lineHeight: 1.3, marginBottom: 8 }}>
          Signals show where capital is going next.
        </h1>
        <p style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400, marginBottom: 24 }}>
          We decode investor belief shifts before deal flow follows.
        </p>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 transition text-sm font-semibold">
            View live signals →
          </button>
          <button className="px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition text-sm">
            How this predicts funding
          </button>
        </div>
      </div>

      {/* SECTION 2 — LIVE SIGNAL DASHBOARD (Core Surface) */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Market Belief Shifts</h2>
        <p className="text-xs text-white/60">Where investor beliefs are converging right now.</p>
        
        {/* Panel A — Market Belief Shifts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { sector: 'Vertical AI', status: 'Accelerating', god: 82, align: 87, momentum: '↑', window: 'Opening', insight: 'Funds converging faster than deal flow filling.' },
            { sector: 'Biotech', status: 'Peak window', god: 76, align: 91, momentum: '↑', window: 'Peaking', insight: 'Capital concentration highest. Thesis alignment widening.' },
            { sector: 'Climate Tech', status: 'Emerging', god: 71, align: 78, momentum: '→', window: 'Early', insight: 'Belief formation early. Watch for convergence Q2-Q3.' }
          ].map((card, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition group cursor-help">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{card.sector}</div>
                  <div className="text-xs text-white/60 mt-0.5">{card.status}</div>
                </div>
                <div className="text-lg text-cyan-400">{card.momentum}</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div title="Execution + Opportunity + Traction Quality">
                  <div className="text-white/50">GOD</div>
                  <div className="text-white font-semibold">{card.god}</div>
                </div>
                <div title="Match to current investor theses">
                  <div className="text-white/50">Align</div>
                  <div className="text-white font-semibold">{card.align}%</div>
                </div>
                <div title="Receptivity increasing">
                  <div className="text-white/50">Window</div>
                  <div className="text-white font-semibold text-cyan-300">{card.window}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-white/70 opacity-0 group-hover:opacity-100 transition">
                {card.insight}
              </div>
            </div>
          ))}
        </div>

        {/* Panel B — Investor Receptivity Index */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 cursor-help" title="Receptivity = belief convergence + thesis alignment + recent activity">
          <h3 className="text-sm uppercase tracking-wider text-white/50 font-semibold">Investor Receptivity</h3>
          <div className="mt-4 text-5xl font-bold text-cyan-400">73%</div>
          <p className="mt-2 text-sm text-white/80">
            Funds currently warming up to new deals.
          </p>
        </div>

        {/* Panel C — Capital Convergence Radar */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6" title="Clusters form when multiple funds shift beliefs toward the same thesis">
          <h3 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-4">Capital Convergence</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-white">342</div>
              <div className="text-xs text-white/60 mt-1">signal events</div>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-white">18</div>
              <div className="text-xs text-white/60 mt-1">belief clusters</div>
            </div>
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <div className="text-2xl font-bold text-cyan-400">4</div>
              <div className="text-xs text-cyan-300 mt-1">entering threshold</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/60">
            When clusters cross threshold, funding accelerates.
          </p>
        </div>
      </div>

      {/* SECTION 3 — HOW SIGNALS WORK (Above the Fold, Icon + One Line) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h2 className="text-2xl font-bold text-white mb-6">How Signals Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: '🔍', title: 'Detect', desc: 'Investor actions' },
            { icon: '⚡', title: 'Decode', desc: 'Belief shifts' },
            { icon: '🎯', title: 'Match', desc: 'Your alignment' },
            { icon: '💰', title: 'Win', desc: 'Capital flow' }
          ].map((step, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
              <div className="text-3xl mb-2">{step.icon}</div>
              <div className="text-sm font-bold text-white">{step.title}</div>
              <div className="text-xs text-white/70 mt-1">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4 — WHY THIS PREDICTS FUNDING (Below Fold) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h2 className="text-2xl font-bold text-white mb-4">Why signals lead funding</h2>
        <ul className="space-y-3">
          {[
            'Beliefs shift before capital moves',
            'Thesis convergence precedes deal flow',
            'Receptivity windows open and close',
            'Funds fill pipelines after convergence'
          ].map((bullet, i) => (
            <li key={i} className="flex items-start gap-3 text-white/80 text-sm">
              <span className="text-cyan-400 mt-0.5 flex-shrink-0">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-cyan-300 font-semibold">
          Signals = early warnings of capital motion.
        </p>
      </div>

      {/* SECTION 5 — HOW FOUNDERS USE THIS (Below Fold) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <h2 className="text-2xl font-bold text-white mb-4">How founders use signals</h2>
        <ul className="space-y-3">
          {[
            'Time outreach into receptivity windows',
            'Align pitch language to emerging theses',
            'Target funds before pipelines fill',
            'Avoid cold outreach during low alignment',
            'Accelerate when convergence peaks'
          ].map((tactic, i) => (
            <li key={i} className="flex items-start gap-3 text-white/80 text-sm">
              <TrendingUp className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <span>{tactic}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-white/70 italic">
          Signals amplify execution at the right moment.
        </p>
      </div>

      {/* SECTION 6 — DEEP TELEMETRY (Below Fold, Your Existing Widgets) */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Deep Telemetry</h2>
        
        {/* Search + Selection Interface */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-sm uppercase tracking-wider text-white/50 font-semibold mb-3">Find a startup to view signals</h3>
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-5 h-5 text-white/60" />
            <input
              value={query}
              onChange={(e)=> setQuery(e.target.value)}
              placeholder="Search your startup by name"
              className="flex-1 bg-transparent text-white placeholder-white/40 outline-none"
            />
          </div>
          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {results.map((r)=> (
                <button key={r.id} onClick={()=> handleSelect(r)} className="p-3 rounded-lg bg-white/5 text-left hover:bg-white/10 transition">
                  <div className="text-sm font-semibold text-white">{r.name}</div>
                  <div className="text-xs text-white/50">GOD: {Math.round((r.total_god_score||0))}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Startup Detail & Signals */}
        {selected ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-2xl font-bold text-white">{selected.name}</div>
                  <div className="mt-1 text-xs text-white/50">{selected.id}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric label="Matches" value={agg.count} hint="investors aligned" />
                <Metric label="Top Alignment" value={`${Math.round(agg.top)}%`} hint={agg.high90Count>0 ? `${agg.high90Count} at ≥90%` : undefined} />
                <Metric label="Avg Alignment" value={`${Math.round(agg.avg)}%`} />
                <Metric label="GOD Score" value={Math.round(selected.total_god_score||0)} />
              </div>
            </div>

          {/* Investor Matches List */}
          {matches.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-semibold text-white mb-3">Aligned Investors</div>
              <div className="space-y-3">
                {matches.map((m, idx)=> {
                  const inv = investors[m.investor_id];
                  return (
                    <div key={idx} className="p-3 rounded-lg bg-white/5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">{inv?.name || m.investor_id}</div>
                          <div className="mt-0.5 text-xs text-white/50">Alignment: {Math.round(m.faith_alignment_score)}% · Confidence: {Math.round((m.confidence||0)*100)}%</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={inv?.website || inv?.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" /> Profile
                          </a>
                        </div>
                      </div>
                      {/* Rationale */}
                      {m.rationale?.reasons && Array.isArray(m.rationale.reasons) && (
                        <ul className="mt-2 text-xs text-white/70 list-disc list-inside space-y-1">
                          {m.rationale.reasons.slice(0,4).map((r:string,i:number)=> (<li key={i}>{r}</li>))}
                        </ul>
                      )}

                      {/* Signals & Exhaust samples */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2 rounded bg-white/5">
                          <div className="text-xs font-semibold text-white/80 mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Faith Signals</div>
                          <div className="space-y-1">
                            {(signals[m.investor_id]||[]).map((s)=> (
                              <div key={s.id} className="text-xs text-white/60">
                                <span className="text-white/80">[{s.signal_type}]</span> {s.signal_text.slice(0,80)}{s.signal_text.length>80?'…':''}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-white/5">
                          <div className="text-xs font-semibold text-white/80 mb-1 flex items-center gap-1"><Flame className="w-3 h-3" />Portfolio Exhaust</div>
                          <div className="space-y-1">
                            {(exhaust[m.investor_id]||[]).map((e)=> (
                              <div key={e.id} className="text-xs text-white/60">
                                <span className="text-white/80">[{e.source_type}]</span> {e.startup_name || 'Unknown'}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {matches.length === 0 && !loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>No alignment matches yet. Try running regeneration or check your sectors.</div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
          <div className="text-lg font-semibold">Select a startup above to view deep telemetry</div>
          <div className="text-sm text-white/60 mt-1">
            Search or pick from recent results to see investor alignment, signals, and portfolio activity.
          </div>
        </div>
      )}
      </div>

      {/* Footer note */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-xs text-white/60">
        Signals are how founders exploit timing in capital markets. When beliefs converge, momentum accelerates.
      </div>
    </div>
  );
}
