/**
 * /lookup/startup/:id — Review a startup and save to virtual portfolio.
 * Augmented with Pythh Signal Intelligence: detected signals, trajectory, predicted needs.
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { apiUrl } from '../lib/apiConfig';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'pythh_investor_session';

function getHeaders(): HeadersInit {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return { 'Content-Type': 'application/json', 'X-Investor-Session': id };
}

type Activity = { type: string; date: string; description: string };
type StartupDetail = {
  id: string;
  name: string;
  tagline: string | null;
  website: string | null;
  pitch: string | null;
  description: string | null;
  sectors: string[];
  stage_estimate: string | null;
  total_god_score: number | null;
  updated_at: string | null;
  recent_activity: Activity[];
};

type SignalEvent = {
  id: string;
  primary_signal: string | null;
  signal_strength: number | null;
  confidence: number | null;
  raw_sentence: string | null;
  detected_at: string | null;
  urgency: string | null;
  likely_needs: string[] | null;
};

type TrajectoryRow = {
  dominant_trajectory: string | null;
  trajectory_confidence: number | null;
  velocity_score: number | null;
  consistency_score: number | null;
  predicted_next_moves: string[] | null;
};

const SIGNAL_LABELS: Record<string, string> = {
  fundraising_signal: 'Fundraising', acquisition_signal: 'Acquisition',
  exit_signal: 'Exit Prep', distress_signal: 'Distress', revenue_signal: 'Revenue',
  hiring_signal: 'Hiring', enterprise_signal: 'Enterprise', expansion_signal: 'Expansion',
  gtm_signal: 'GTM Build', demand_signal: 'Demand', growth_signal: 'Growth',
  product_signal: 'Product', partnership_signal: 'Partnership',
  buyer_signal: 'Buying', market_position_signal: 'Market Position',
  regulatory_signal: 'Regulatory',
};

const SIGNAL_COLORS: Record<string, string> = {
  fundraising_signal: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  hiring_signal: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  growth_signal: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  enterprise_signal: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  expansion_signal: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  distress_signal: 'bg-red-500/10 text-red-400 border-red-500/30',
  exit_signal: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  acquisition_signal: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  product_signal: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  partnership_signal: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
};

function signalBadgeClass(cls: string | null): string {
  return SIGNAL_COLORS[cls ?? ''] ?? 'bg-white/5 text-zinc-400 border-white/10';
}

const TRAJ_LABELS: Record<string, string> = {
  fundraising_active: '📈 Fundraising',   gtm_expansion: '🚀 GTM Expansion',
  growth: '⬆ Growth',                     product_maturation: '🔧 Product Build',
  exit_preparation: '🏁 Exit Prep',        distress_survival: '⚠ Distress',
  repositioning: '↔ Repositioning',       expansion: '🌍 Expansion',
};

export default function InvestorStartupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [startup, setStartup]       = useState<StartupDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saved, setSaved]           = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [signals, setSignals]       = useState<SignalEvent[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryRow | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // Fetch startup detail from API
    fetch(apiUrl(`/api/investor-lookup/startup/${id}`))
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok && json.data) setStartup(json.data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Fetch Pythh Signal Intelligence in parallel (non-blocking)
    (async () => {
      try {
        // Find the pythh_entity for this startup
        const { data: entities } = await supabase
          .from('pythh_entities')
          .select('id')
          .eq('startup_upload_id', id)
          .limit(1);
        const entityId = entities?.[0]?.id;
        if (!entityId || cancelled) return;

        // Fetch latest signals
        const { data: sigData } = await supabase
          .from('pythh_signal_events')
          .select('id, primary_signal, signal_strength, confidence, raw_sentence, detected_at, urgency, likely_needs')
          .eq('entity_id', entityId)
          .order('detected_at', { ascending: false })
          .limit(6);
        if (!cancelled) setSignals((sigData || []) as SignalEvent[]);

        // Fetch trajectory
        const { data: trajData } = await supabase
          .from('pythh_trajectories')
          .select('dominant_trajectory, trajectory_confidence, velocity_score, consistency_score, predicted_next_moves')
          .eq('entity_id', entityId)
          .order('computed_at', { ascending: false })
          .limit(1);
        if (!cancelled && trajData?.[0]) setTrajectory(trajData[0] as TrajectoryRow);
      } catch (_) { /* signal data is optional — never block page load */ }
    })();

    return () => { cancelled = true; };
  }, [id]);

  const saveToPortfolio = async () => {
    if (!id) return;
    setSaveError(null);
    const res = await fetch(apiUrl('/api/investor-lookup/portfolio/items'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ startup_id: id }),
    });
    const json = await res.json();
    if (res.ok) setSaved(true);
    else setSaveError(json.error || 'Failed to save');
  };

  if (loading || !startup) {
    return (
      <div className="min-h-screen bg-[#0a0e13]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <PythhUnifiedNav />
        <main className="max-w-3xl mx-auto px-4 py-12">
          {loading ? <p className="text-zinc-500">Loading...</p> : <p className="text-zinc-500">Startup not found.</p>}
          <Link to="/lookup" className="text-amber-400 hover:underline mt-4 inline-block">← Back to search</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e13]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <PythhUnifiedNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/lookup" className="text-sm text-amber-400/90 hover:text-amber-400 mb-6 inline-block">← Back to search</Link>

        <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">{startup.name}</h1>
              {startup.tagline && <p className="text-zinc-400 mt-1">{startup.tagline}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {(startup.sectors || []).map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">{s}</span>
                ))}
                {startup.stage_estimate && (
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400">{startup.stage_estimate}</span>
                )}
                <span className="text-sm font-semibold text-cyan-400">GOD {startup.total_god_score ?? '—'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={saveToPortfolio}
                disabled={saved}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  saved
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-default'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                }`}
              >
                {saved ? 'Saved to portfolio' : 'Save to virtual portfolio'}
              </button>
              <Link to="/lookup/portfolio" className="text-center text-xs text-zinc-500 hover:text-zinc-400">View my portfolio</Link>
            </div>
          </div>

          {startup.website && (
            <a
              href={startup.website.startsWith('http') ? startup.website : `https://${startup.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/90 hover:text-amber-400 text-sm mt-3 inline-block"
            >
              {startup.website.replace(/^https?:\/\//, '')} →
            </a>
          )}

          {(startup.pitch || startup.description) && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">About</h2>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {startup.pitch || startup.description}
              </p>
            </div>
          )}

          {startup.recent_activity && startup.recent_activity.length > 0 && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Recent activity</h2>
              <ul className="space-y-2">
                {startup.recent_activity.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-zinc-600 shrink-0">
                      {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                    </span>
                    <span className="text-zinc-400">{a.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Pythh Signal Intelligence ─────────────────────────────────── */}
          {(signals.length > 0 || trajectory) && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pythh Signal Intelligence
              </h2>

              {/* Trajectory */}
              {trajectory?.dominant_trajectory && (
                <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/8">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-xs font-semibold text-white">
                        {TRAJ_LABELS[trajectory.dominant_trajectory] ?? trajectory.dominant_trajectory.replace(/_/g, ' ')}
                      </span>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Company trajectory</p>
                    </div>
                    <div className="flex gap-3 text-center">
                      {trajectory.trajectory_confidence != null && (
                        <div>
                          <div className="text-xs font-bold text-amber-400">{Math.round(trajectory.trajectory_confidence * 100)}%</div>
                          <div className="text-[9px] text-zinc-600">confidence</div>
                        </div>
                      )}
                      {trajectory.velocity_score != null && (
                        <div>
                          <div className="text-xs font-bold text-cyan-400">{Math.round(trajectory.velocity_score * 100)}%</div>
                          <div className="text-[9px] text-zinc-600">velocity</div>
                        </div>
                      )}
                    </div>
                  </div>
                  {trajectory.predicted_next_moves && trajectory.predicted_next_moves.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] text-zinc-600">Predicted next: </span>
                      <span className="text-[10px] text-zinc-400">
                        {trajectory.predicted_next_moves.slice(0, 3).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Signal events */}
              {signals.length > 0 && (
                <div className="space-y-2.5">
                  {signals.map((sig) => (
                    <div key={sig.id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-1.5">
                      {/* Row 1: badge + strength + urgency dot */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${signalBadgeClass(sig.primary_signal)}`}>
                          {SIGNAL_LABELS[sig.primary_signal ?? ''] ?? (sig.primary_signal ?? '—').replace(/_/g, ' ')}
                        </span>
                        {sig.urgency && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            sig.urgency === 'high'
                              ? 'bg-red-500/15 text-red-400'
                              : sig.urgency === 'medium'
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-zinc-500/15 text-zinc-500'
                          }`}>
                            {sig.urgency}
                          </span>
                        )}
                        <div className="flex-1" />
                        {sig.confidence != null && (
                          <span className="text-[10px] text-zinc-500 font-mono tabular-nums" title="Signal confidence">
                            {Math.round(sig.confidence * 100)}% conf
                          </span>
                        )}
                        {sig.signal_strength != null && (
                          <span className="text-[10px] text-zinc-600 font-mono tabular-nums" title="Signal strength">
                            {Math.round(sig.signal_strength * 100)}% str
                          </span>
                        )}
                      </div>
                      {/* Row 2: raw sentence */}
                      <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">
                        {sig.raw_sentence ?? '—'}
                      </p>
                      {/* Row 3: likely_needs chips */}
                      {sig.likely_needs && sig.likely_needs.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {sig.likely_needs.slice(0, 4).map((need) => (
                            <span key={need} className="text-[9px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 rounded border border-cyan-500/20">
                              {need.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {saveError && (
          <p className="mt-4 text-rose-400 text-sm">{saveError}</p>
        )}
      </main>
    </div>
  );
}
