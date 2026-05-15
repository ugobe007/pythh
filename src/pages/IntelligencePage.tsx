/**
 * Intelligence Dashboard — /intelligence
 *
 * The "analyst terminal" — Pythh's market intelligence layer:
 *   - Hot startup discovery feed (real-time from web scraping)
 *   - VC thesis profiles (FBI-style dossiers)
 *   - Deal positioning stats
 *   - Market signal summary
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame, Brain, Target, Zap, TrendingUp, RefreshCw,
  ExternalLink, ChevronRight, Globe, Search, AlertCircle,
  BookOpen, Layers, ArrowUpRight, Radio,
} from 'lucide-react';
import { apiUrl } from '../lib/apiConfig';

// ── Types ────────────────────────────────────────────────────────────────────
interface Discovery {
  id: string;
  source: string;
  headline: string;
  company_url?: string;
  company_name?: string;
  summary?: string;
  signals?: string[];
  sector_guess?: string;
  heat_score: number;
  vc_mentioned?: string[];
  discovered_at: string;
  status: string;
}

interface VCProfile {
  id: string;
  investor_id: string;
  firm_name: string;
  firm_url?: string;
  thesis_summary?: string;
  sector_preferences?: string[];
  stage_preferences?: string[];
  personality_profile?: string;
  communication_style?: string;
  key_themes?: string[];
  best_outreach_hook?: string;
  confidence: number;
  source_count: number;
  profiled_at?: string;
}

interface IntelStats {
  vc_profiles: { total: number; profiled: number };
  discoveries: { total: number; high_heat: number; submitted: number };
  positioning_pairs: { total: number; avg_alignment: number };
}

// ── Source badge ─────────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  producthunt:    { label: 'ProductHunt',     color: 'text-orange-400 border-orange-400/30' },
  hackernews:     { label: 'Hacker News',     color: 'text-amber-400  border-amber-400/30'  },
  techcrunch:     { label: 'TechCrunch',      color: 'text-green-400  border-green-400/30'  },
  crunchbase:     { label: 'Crunchbase',      color: 'text-blue-400   border-blue-400/30'   },
  vc_rss:         { label: 'VC Blog',         color: 'text-purple-400 border-purple-400/30' },
  yc:             { label: 'Y Combinator',    color: 'text-orange-300 border-orange-300/30' },
  venturebeat:    { label: 'VentureBeat',     color: 'text-cyan-400   border-cyan-400/30'   },
  theinformation: { label: 'The Information', color: 'text-white/60   border-white/20'       },
  rss:            { label: 'RSS',             color: 'text-white/50   border-white/15'       },
};

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_LABELS[source] || { label: source, color: 'text-white/40 border-white/15' };
  return <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>;
}

function HeatBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-red-500' : score >= 70 ? 'bg-orange-500' : score >= 55 ? 'bg-amber-500' : 'bg-white/20';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold ${score >= 75 ? 'text-orange-400' : 'text-white/50'}`}>{score}</span>
    </div>
  );
}

function PersonalityBadge({ style }: { style?: string }) {
  const map: Record<string, string> = {
    analytical:       'bg-blue-400/10   text-blue-400   border-blue-400/30',
    storyteller:      'bg-purple-400/10 text-purple-400 border-purple-400/30',
    contrarian:       'bg-red-400/10    text-red-400    border-red-400/30',
    operator:         'bg-amber-400/10  text-amber-400  border-amber-400/30',
    'thesis-driven':  'bg-cyan-400/10   text-cyan-400   border-cyan-400/30',
    'community-builder': 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };
  if (!style) return null;
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${map[style] || 'text-white/50 border-white/20'}`}>{style}</span>;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const [tab, setTab] = useState<'discoveries' | 'profiles' | 'positioning'>('discoveries');
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [profiles, setProfiles]       = useState<VCProfile[]>([]);
  const [stats, setStats]             = useState<IntelStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [profileSearch, setProfileSearch] = useState('');
  const [minHeat, setMinHeat]         = useState(60);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl(`/api/intelligence/discoveries?limit=100&min_heat=${minHeat}`)).then(r => r.json()).catch(() => ({ discoveries: [] })),
      fetch(apiUrl('/api/intelligence/vc-profiles?limit=100&sort=confidence')).then(r => r.json()).catch(() => ({ profiles: [] })),
      fetch(apiUrl('/api/intelligence/stats')).then(r => r.json()).catch(() => null),
    ]).then(([d, p, s]) => {
      setDiscoveries(d.discoveries || []);
      setProfiles(p.profiles || []);
      setStats(s);
      setLoading(false);
    });
  }, [minHeat]);

  const filteredProfiles = profiles.filter(p =>
    !profileSearch || p.firm_name.toLowerCase().includes(profileSearch.toLowerCase()) ||
    (p.thesis_summary || '').toLowerCase().includes(profileSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={20} className="text-cyan-400" />
              <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
            </div>
            <p className="text-sm text-white/50">
              Automated discovery · VC thesis profiling · Deal positioning · FBI-style investor dossiers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/portfolio" className="text-sm text-white/50 hover:text-cyan-400 flex items-center gap-1 transition-colors">
              Portfolio <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* ── Stats bar ─────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: BookOpen, label: 'VC Profiles', value: stats.vc_profiles.profiled, sub: `of ${stats.vc_profiles.total} scraped`, color: 'text-cyan-400' },
              { icon: Flame,    label: 'Hot Discoveries', value: stats.discoveries.high_heat, sub: `${stats.discoveries.total} total in queue`, color: 'text-orange-400' },
              { icon: Globe,    label: 'Submitted', value: stats.discoveries.submitted, sub: 'auto-fed to pipeline', color: 'text-emerald-400' },
              { icon: Target,   label: 'Avg Thesis Fit', value: stats.positioning_pairs.total ? `${stats.positioning_pairs.avg_alignment}%` : '—', sub: `${stats.positioning_pairs.total} pairs positioned`, color: 'text-purple-400' },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2"><Icon size={12} />{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-white/30 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Agent status banner ───────────────────────────────────── */}
        <div className="flex items-center gap-3 bg-cyan-500/5 border border-cyan-400/20 rounded-xl px-5 py-3 text-sm">
          <Radio size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-white/70">
            Intelligence agent active — runs daily discovery scan + weekly VC profile refresh.
            To trigger now: <code className="text-cyan-400 text-xs">npm run intel:run-all</code>
          </span>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-white/10">
          {([
            { id: 'discoveries', label: '🔥 Hot Discoveries', count: discoveries.length },
            { id: 'profiles',    label: '🧠 VC Profiles',     count: filteredProfiles.length },
            { id: 'positioning', label: '🎯 Deal Positioning', count: stats?.positioning_pairs.total },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id ? 'border-cyan-400 text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
              {t.count != null && <span className="ml-1.5 text-xs text-white/30">{t.count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/40 py-12 justify-center">
            <RefreshCw size={16} className="animate-spin" /> Loading intelligence data...
          </div>
        ) : (
          <>
            {/* ── DISCOVERIES TAB ────────────────────────────────────── */}
            {tab === 'discoveries' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-sm text-white/50">
                    Startups surfaced from {Object.keys(SOURCE_LABELS).length}+ web sources. Heat ≥75 = high signal.
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Min heat:</label>
                    <select
                      value={minHeat}
                      onChange={e => setMinHeat(Number(e.target.value))}
                      className="text-xs bg-white/10 border border-white/20 rounded px-2 py-1 text-white"
                    >
                      {[40, 55, 65, 70, 75, 85].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                {discoveries.length === 0 ? (
                  <div className="text-center py-16 text-white/40 space-y-3">
                    <Flame size={32} className="mx-auto opacity-30" />
                    <p>No discoveries yet.</p>
                    <p className="text-sm">Run <code className="text-cyan-400">npm run intel:discover</code> to start scanning.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {discoveries.map(d => (
                      <div key={d.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-white/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <SourceBadge source={d.source} />
                              {d.sector_guess && (
                                <span className="text-xs text-cyan-400/70">{d.sector_guess}</span>
                              )}
                              {(d.signals || []).map(s => (
                                <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/50">{s}</span>
                              ))}
                            </div>
                            <p className="text-sm font-medium text-white/90 leading-snug">{d.headline}</p>
                            {d.summary && (
                              <p className="text-xs text-white/40 mt-1 line-clamp-2">{d.summary}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                              {d.company_url && (
                                <a href={d.company_url} target="_blank" rel="noopener noreferrer"
                                   className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
                                  <ExternalLink size={10} /> {d.company_url.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                              {(d.vc_mentioned || []).length > 0 && (
                                <span>VCs: {(d.vc_mentioned || []).slice(0, 3).join(', ')}</span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <HeatBar score={d.heat_score} />
                            {d.company_url && (
                              <Link
                                to={`/signal-matches?url=${encodeURIComponent(d.company_url)}`}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                              >
                                Analyze <ArrowUpRight size={10} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── VC PROFILES TAB ────────────────────────────────────── */}
            {tab === 'profiles' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    value={profileSearch}
                    onChange={e => setProfileSearch(e.target.value)}
                    placeholder="Search firms, thesis keywords..."
                    className="w-full pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>

                {filteredProfiles.length === 0 ? (
                  <div className="text-center py-16 text-white/40 space-y-3">
                    <Brain size={32} className="mx-auto opacity-30" />
                    <p>No VC profiles yet.</p>
                    <p className="text-sm">Run <code className="text-cyan-400">npm run intel:scrape-vc && npm run intel:profile-vc</code></p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProfiles.map(p => (
                      <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-cyan-400/20 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{p.firm_name}</h3>
                              <PersonalityBadge style={p.personality_profile} />
                              {p.communication_style && (
                                <span className="text-xs text-white/30">{p.communication_style}</span>
                              )}
                            </div>
                            {p.firm_url && (
                              <a href={p.firm_url} target="_blank" rel="noopener noreferrer"
                                 className="text-xs text-white/30 hover:text-cyan-400 flex items-center gap-1 mt-0.5">
                                <ExternalLink size={9} /> {p.firm_url.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-lg font-bold ${p.confidence >= 0.7 ? 'text-emerald-400' : p.confidence >= 0.4 ? 'text-amber-400' : 'text-white/40'}`}>
                              {Math.round(p.confidence * 100)}%
                            </div>
                            <div className="text-xs text-white/30">confidence</div>
                          </div>
                        </div>

                        {p.thesis_summary && (
                          <p className="text-sm text-white/70 italic mb-3 leading-relaxed">
                            "{p.thesis_summary}"
                          </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(p.sector_preferences || []).length > 0 && (
                            <div>
                              <div className="text-xs text-white/30 mb-1.5">Sectors</div>
                              <div className="flex flex-wrap gap-1">
                                {(p.sector_preferences || []).map(s => (
                                  <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400/80">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(p.stage_preferences || []).length > 0 && (
                            <div>
                              <div className="text-xs text-white/30 mb-1.5">Stages</div>
                              <div className="flex flex-wrap gap-1">
                                {(p.stage_preferences || []).map(s => (
                                  <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/60">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {p.best_outreach_hook && (
                          <div className="mt-3 border-l-2 border-cyan-400/30 pl-3">
                            <div className="text-xs text-white/30 mb-0.5">Best outreach hook</div>
                            <p className="text-xs text-cyan-300/80">{p.best_outreach_hook}</p>
                          </div>
                        )}

                        {(p.key_themes || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {(p.key_themes || []).map(t => (
                              <span key={t} className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-white/20 mt-3">
                          {p.source_count} sources · profiled {p.profiled_at ? new Date(p.profiled_at).toLocaleDateString() : 'pending'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── DEAL POSITIONING TAB ─────────────────────────────── */}
            {tab === 'positioning' && (
              <div className="space-y-6">
                <div className="text-sm text-white/50 space-y-2">
                  <p>Deal positioning pairs are generated automatically when a startup × investor match exists and the investor has a VC thesis profile.</p>
                  <p>
                    To generate positioning for a startup:{' '}
                    <code className="text-cyan-400 text-xs">npm run intel:position -- --startup=&lt;startup_id&gt;</code>
                  </p>
                </div>

                {stats && stats.positioning_pairs.total > 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Target size={16} className="text-purple-400" />
                      {stats.positioning_pairs.total} startup-investor pairs positioned
                    </div>
                    <p className="text-sm text-white/60">
                      Average thesis alignment across all pairs: <span className="text-purple-400 font-semibold">{stats.positioning_pairs.avg_alignment}%</span>
                    </p>
                    <p className="text-xs text-white/40">
                      View positioning on an individual startup's portfolio detail page, or trigger batch positioning via the CLI.
                    </p>
                    <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:underline">
                      View portfolio picks <ChevronRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-16 text-white/40 space-y-3">
                    <Target size={32} className="mx-auto opacity-30" />
                    <p>No deal positioning generated yet.</p>
                    <p className="text-sm">
                      First build VC profiles, then run:<br />
                      <code className="text-cyan-400 text-xs">npm run intel:position</code>
                    </p>
                  </div>
                )}

                {/* Playbook */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Layers size={16} className="text-cyan-400" /> Intelligence Playbook</h3>
                  <ol className="space-y-2 text-sm text-white/60 list-decimal list-inside">
                    <li><code className="text-cyan-400 text-xs">npm run intel:scrape-vc</code> — Scrape VC blogs, RSS, news (runs hourly on server)</li>
                    <li><code className="text-cyan-400 text-xs">npm run intel:profile-vc</code> — LLM extracts thesis profiles from raw content</li>
                    <li><code className="text-cyan-400 text-xs">npm run intel:discover</code> — Discover hot startups from 16+ sources</li>
                    <li><code className="text-cyan-400 text-xs">npm run intel:position</code> — Generate deal positioning for all startup × investor pairs</li>
                    <li>Review discoveries → submit URLs → Pythh scores and matches → outreach with positioning</li>
                  </ol>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
