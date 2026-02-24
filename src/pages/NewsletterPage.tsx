import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import PythhUnifiedNav from '../components/PythhUnifiedNav';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

interface HotMatch {
  match_score: number;
  startup:  { name: string; tagline: string; sectors: string[]; total_god_score: number } | null;
  investor: { name: string; firm_name: string; sectors: string[] } | null;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  tagline: string;
  total_god_score: number;
  traction_score: number;
  team_score: number;
  sectors: string[];
}

interface SectorTrend {
  sector: string;
  count: number;
  avg_score: number;
}

interface DarkHorse {
  name: string;
  tagline: string;
  total_god_score: number;
  momentum_score: number;
  sectors: string[];
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string | null;
  company: string | null;
  funding: string | null;
  investors: string[];
}

interface InvestorOfWeek {
  id: string;
  name: string;
  firm_name: string;
  sectors: string[];
  stage: string;
  investment_thesis: string | null;
  match_count: number;
  avg_match_score: number;
}

interface FundingRound {
  company: string;
  amount: string;
  stage: string | null;
  investors: string[];
  url: string | null;
  source: string;
  date: string | null;
}

interface ScoreMover {
  id: string;
  name: string;
  tagline: string;
  sectors: string[];
  total_god_score: number;
  old_score: number;
  new_score: number;
  delta: number;
}

interface NewsletterData {
  date: string;
  generated_at: string;
  hotMatches: HotMatch[];
  leaderboard: LeaderboardEntry[];
  sectorTrends: SectorTrend[];
  darkHorse: DarkHorse | null;
  newArrivals: { name: string; tagline: string; sectors: string[]; total_god_score: number }[];
  news: NewsItem[];
  investorOfWeek: InvestorOfWeek | null;
  fundingRounds: FundingRound[];
  scoreMovers: ScoreMover[];
}

const ScorePill = ({ score, dim }: { score: number; dim?: boolean }) => {
  const color = score >= 80 ? 'text-emerald-400 border-emerald-500/40'
    : score >= 65     ? 'text-cyan-400 border-cyan-500/40'
    : score >= 50     ? 'text-yellow-400 border-yellow-500/40'
    :                   'text-zinc-400 border-zinc-700';
  return (
    <span className={`inline-block border rounded px-1.5 py-0.5 text-xs font-mono ${color} ${dim ? 'opacity-60' : ''}`}>
      {score}
    </span>
  );
};

const SectorTag = ({ sector }: { sector: string }) => (
  <span className="inline-block bg-zinc-800 text-zinc-400 rounded px-2 py-0.5 text-xs">
    {sector}
  </span>
);

export default function NewsletterPage() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const [data, setData]       = useState<NewsletterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [subEmail, setSubEmail] = useState('');
  const [subState, setSubState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    const url = dateParam
      ? `${API_BASE}/api/newsletter/${dateParam}`
      : `${API_BASE}/api/newsletter/today`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [dateParam]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail.includes('@')) return;
    setSubState('loading');
    try {
      const res = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail }),
      });
      setSubState(res.ok ? 'done' : 'error');
    } catch {
      setSubState('error');
    }
  };

  const shareOnTwitter = () => {
    if (!data) return;
    const top = data.hotMatches[0];
    const text = top
      ? `This week's hottest match: ${top.startup?.name} × ${top.investor?.firm_name || top.investor?.name} — ${top.match_score}% signal. Full digest: pythh.ai/newsletter`
      : `This week's investor signals are live. Read the digest: pythh.ai/newsletter`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const formattedDate = data?.date
    ? new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-[#0a0e13]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <SEO
        title="The Daily Signal | pythh.ai — Startup-Investor Intelligence Digest"
        description="Hot matches, GOD score leaderboard, sector trends, and dark horse startups. Updated weekly."
        canonical="/newsletter"
      />

      {/* Background glow */}
      <div className="fixed top-0 left-1/3 w-[700px] h-[500px] bg-cyan-500/4 rounded-full blur-[140px] pointer-events-none" />

      <PythhUnifiedNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 pt-20 pb-24">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-cyan-500/60 mb-2">pythh.ai</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-3"
            style={{ textShadow: '0 0 20px rgba(0,210,255,0.15)' }}>
            The Daily Signal
          </h1>
          {formattedDate && (
            <p className="text-zinc-500 text-sm">{formattedDate}</p>
          )}
          <p className="text-zinc-400 mt-3 max-w-xl">
            Hot matches, sector heat, and the startups flying under the radar.
            No guessing. Just math.
          </p>
          <button
            onClick={shareOnTwitter}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.892-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
        </div>

        {/* ── Subscribe strip ──────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubscribe}
          className="mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4"
        >
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Get the digest in your inbox</p>
            <p className="text-zinc-500 text-xs mt-0.5">Weekly. No spam. Unsubscribe any time.</p>
          </div>
          {subState === 'done' ? (
            <p className="text-emerald-400 text-sm font-medium">You're subscribed ✓</p>
          ) : (
            <>
              <input
                type="email"
                value={subEmail}
                onChange={e => setSubEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={subState === 'loading'}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition"
              >
                {subState === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
              {subState === 'error' && <p className="text-red-400 text-xs">Something went wrong.</p>}
            </>
          )}
        </form>

        {/* ── Loading / Error ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-3 text-zinc-500 py-16 justify-center">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            Loading signals…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-6 text-red-400 text-sm">
            Could not load digest. Try refreshing.
          </div>
        )}

        {data && !loading && (
          <div className="space-y-12">

            {/* ── Section 1: Hot Matches ─────────────────────────────────── */}
            {data.hotMatches.length > 0 && (
              <section>
                <SectionHeading icon="🔥" label="Hot Matches" sub="Highest-signal startup × investor pairs this week" />
                <div className="space-y-3">
                  {data.hotMatches.map((m, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-white font-semibold truncate">{m.startup?.name}</span>
                          <span className="text-zinc-600">×</span>
                          <span className="text-cyan-400 font-medium truncate">{m.investor?.firm_name || m.investor?.name}</span>
                        </div>
                        {m.startup?.tagline && (
                          <p className="text-zinc-500 text-xs truncate">{m.startup.tagline}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(m.startup?.sectors || []).slice(0, 2).map(s => <SectorTag key={s} sector={s} />)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {m.startup?.total_god_score != null && (
                          <div className="text-center">
                            <ScorePill score={m.startup.total_god_score} />
                            <p className="text-zinc-600 text-[10px] mt-0.5">GOD</p>
                          </div>
                        )}
                        <div className="text-center">
                          <span className="block text-emerald-400 font-bold text-lg font-mono">{m.match_score}%</span>
                          <p className="text-zinc-600 text-[10px]">match</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 2: GOD Score Leaderboard ──────────────────────── */}
            {data.leaderboard.length > 0 && (
              <section>
                <SectionHeading icon="⚡" label="GOD Score Leaderboard" sub="Top ranked startups by the GOD Algorithm this week" />
                <div className="rounded-xl border border-zinc-800/60 overflow-hidden">
                  {data.leaderboard.map((s, i) => (
                    <div key={s.id} className={`flex items-center gap-4 px-4 py-3.5 ${i < data.leaderboard.length - 1 ? 'border-b border-zinc-800/40' : ''} hover:bg-zinc-800/20 transition`}>
                      <span className="text-zinc-700 font-mono text-sm w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate">{s.name}</span>
                          {(s.sectors || []).slice(0, 1).map(sec => <SectorTag key={sec} sector={sec} />)}
                        </div>
                        {s.tagline && <p className="text-zinc-500 text-xs mt-0.5 truncate">{s.tagline}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-center">
                        <div>
                          <ScorePill score={s.total_god_score} />
                          <p className="text-zinc-600 text-[10px] mt-0.5">GOD</p>
                        </div>
                        {s.traction_score != null && (
                          <div className="hidden sm:block">
                            <ScorePill score={s.traction_score} dim />
                            <p className="text-zinc-600 text-[10px] mt-0.5">traction</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 3: Sector Trends ───────────────────────────────── */}
            {data.sectorTrends.length > 0 && (
              <section>
                <SectionHeading icon="📈" label="Sector Heat" sub="Where the capital is pointing right now" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.sectorTrends.map((t, i) => (
                    <div key={t.sector} className={`rounded-xl border p-4 ${i === 0 ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-zinc-800/60 bg-zinc-900/40'}`}>
                      <p className="text-white font-medium text-sm truncate">{t.sector}</p>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-zinc-500 text-xs">{t.count} startups</span>
                        <span className="text-xs font-mono text-cyan-400">avg {t.avg_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 4: Dark Horse ──────────────────────────────────── */}
            {data.darkHorse && (
              <section>
                <SectionHeading icon="🌑" label="Dark Horse" sub="High momentum, flying under the radar — watch this one" />
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-semibold text-lg">{data.darkHorse.name}</p>
                      {data.darkHorse.tagline && <p className="text-zinc-400 mt-1 text-sm">{data.darkHorse.tagline}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(data.darkHorse.sectors || []).map(s => <SectorTag key={s} sector={s} />)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-1.5">
                      <div>
                        <ScorePill score={data.darkHorse.total_god_score} />
                        <p className="text-zinc-600 text-[10px] mt-0.5">GOD</p>
                      </div>
                      <div>
                        <span className="inline-block border border-violet-500/40 rounded px-1.5 py-0.5 text-xs font-mono text-violet-400">
                          {data.darkHorse.momentum_score}
                        </span>
                        <p className="text-zinc-600 text-[10px] mt-0.5">momentum</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Section 5: New Arrivals ─────────────────────────────────── */}
            {data.newArrivals.length > 0 && (
              <section>
                <SectionHeading icon="🚀" label="New Arrivals" sub="Startups that cleared the algorithm this week" />
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.newArrivals.map((s, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{s.name}</p>
                          {s.tagline && <p className="text-zinc-500 text-xs mt-0.5 line-clamp-2">{s.tagline}</p>}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(s.sectors || []).slice(0, 2).map(sec => <SectorTag key={sec} sector={sec} />)}
                          </div>
                        </div>
                        <ScorePill score={s.total_god_score} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 6: Market Intelligence ─────────────────────────── */}
            {data.news.length > 0 && (
              <section>
                <SectionHeading icon="📰" label="Market Intelligence" sub="Signals captured from the web in the last 24 hours" />
                <div className="space-y-2">
                  {data.news.map((n, i) => (
                    <a
                      key={i}
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-800/40 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-200 text-sm group-hover:text-white transition line-clamp-2">{n.title}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {n.company && <span className="text-cyan-500 text-xs">{n.company}</span>}
                            {n.funding && <span className="text-emerald-400 text-xs font-mono">{n.funding}</span>}
                            {n.investors.slice(0, 2).map(inv => (
                              <span key={inv} className="text-zinc-500 text-xs">{inv}</span>
                            ))}
                            <span className="text-zinc-700 text-xs">{n.source}</span>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 7: Investor of the Week ───────────────────────── */}
            {data.investorOfWeek && (
              <section>
                <SectionHeading icon="🏆" label="Investor of the Week" sub="Most active by match volume this week" />
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-lg">{data.investorOfWeek.firm_name || data.investorOfWeek.name}</p>
                      {data.investorOfWeek.name && data.investorOfWeek.firm_name && (
                        <p className="text-zinc-400 text-sm">{data.investorOfWeek.name}</p>
                      )}
                      {data.investorOfWeek.investment_thesis && (
                        <p className="text-zinc-500 text-xs mt-2 line-clamp-2">{data.investorOfWeek.investment_thesis}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(data.investorOfWeek.sectors || []).slice(0, 3).map(s => <SectorTag key={s} sector={s} />)}
                        {data.investorOfWeek.stage && <SectorTag sector={data.investorOfWeek.stage} />}
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-1.5">
                      <div>
                        <span className="block text-amber-400 font-bold text-2xl font-mono">{data.investorOfWeek.match_count}</span>
                        <p className="text-zinc-600 text-[10px]">matches</p>
                      </div>
                      <div>
                        <span className="block text-amber-300 font-mono text-sm">{data.investorOfWeek.avg_match_score}%</span>
                        <p className="text-zinc-600 text-[10px]">avg score</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Section 8: Funding Rounds ──────────────────────────────── */}
            {data.fundingRounds?.length > 0 && (
              <section>
                <SectionHeading icon="💰" label="Funding Rounds" sub="Capital raised by startups in the ecosystem this week" />
                <div className="space-y-2">
                  {data.fundingRounds.map((r, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-medium">{r.company}</span>
                          {r.stage && <span className="text-zinc-500 text-xs border border-zinc-700 rounded px-1.5 py-0.5">{r.stage}</span>}
                        </div>
                        {r.investors?.length > 0 && (
                          <p className="text-zinc-500 text-xs mt-1">Led by {r.investors.slice(0, 3).join(', ')}</p>
                        )}
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-zinc-600 text-xs hover:text-zinc-400 transition mt-0.5 inline-block">{r.source} ↗</a>
                        )}
                      </div>
                      <span className="shrink-0 text-emerald-400 font-mono font-semibold text-sm">{r.amount}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Section 9: GOD Score Movers ────────────────────────────── */}
            {data.scoreMovers?.length > 0 && (
              <section>
                <SectionHeading icon="📊" label="GOD Score Movers" sub="Startups with the biggest score swings this week" />
                <div className="space-y-2">
                  {data.scoreMovers.map((m, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{m.name}</p>
                        {m.tagline && <p className="text-zinc-500 text-xs mt-0.5 truncate">{m.tagline}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(m.sectors || []).slice(0, 2).map(s => <SectorTag key={s} sector={s} />)}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3 text-center">
                        <div>
                          <span className="text-zinc-500 font-mono text-sm line-through">{m.old_score}</span>
                          <span className="text-zinc-600 mx-1">→</span>
                          <ScorePill score={m.new_score} />
                        </div>
                        <span className={`font-bold font-mono text-sm ${m.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.delta > 0 ? '+' : ''}{m.delta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {data.hotMatches.length === 0 && data.leaderboard.length === 0 && data.news.length === 0 && (
              <div className="text-center py-20 text-zinc-500">
                <p className="text-lg">No signals today.</p>
                <p className="text-sm mt-1">Check back Wednesday.</p>
              </div>
            )}

          </div>
        )}

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-zinc-800/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <Link to="/" className="hover:text-zinc-300 transition">← Back to pythh.ai</Link>
          <p>Updated {formattedDate || 'weekly'}. No guessing. Just math.</p>
        </div>
      </main>
    </div>
  );
}

function SectionHeading({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-white font-semibold text-lg flex items-center gap-2">
        <span>{icon}</span> {label}
      </h2>
      <p className="text-zinc-500 text-sm mt-0.5">{sub}</p>
    </div>
  );
}
