/**
 * SignalEventTimeline
 *
 * Renders a chronological feed of pythh_signal_events for a given entity.
 * Resolves entity_id from startup_upload_id, then fetches the latest events.
 *
 * Props:
 *   startupId — the startup_uploads.id (UUID) — used to look up pythh_entities
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface SignalEvent {
  id: string;
  primary_signal: string | null;
  raw_sentence: string | null;
  confidence: number | null;
  signal_strength: number | null;
  source_type: string | null;
  detected_at: string | null;
  urgency: string | null;
  likely_needs: string[] | null;
  is_ambiguous: boolean | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  fundraising_signal:    'Fundraising',
  acquisition_signal:    'Acquisition',
  exit_signal:           'Exit Prep',
  distress_signal:       'Distress',
  revenue_signal:        'Revenue',
  hiring_signal:         'Hiring',
  enterprise_signal:     'Enterprise',
  expansion_signal:      'Expansion',
  gtm_signal:            'GTM Build',
  demand_signal:         'Demand',
  growth_signal:         'Growth',
  product_signal:        'Product',
  partnership_signal:    'Partnership',
  buyer_signal:          'Buying Intent',
  market_position_signal:'Market Position',
  exploratory_signal:    'Exploratory',
  negated_signal:        'Negated',
  regulatory_signal:     'Regulatory',
  buyer_pain_signal:     'Buyer Pain',
  efficiency_signal:     'Efficiency',
};

const SIGNAL_COLORS: Record<string, string> = {
  fundraising_signal:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  hiring_signal:         'bg-sky-500/10 text-sky-400 border-sky-500/30',
  growth_signal:         'bg-teal-500/10 text-teal-400 border-teal-500/30',
  revenue_signal:        'bg-teal-500/10 text-teal-400 border-teal-500/30',
  enterprise_signal:     'bg-violet-500/10 text-violet-400 border-violet-500/30',
  expansion_signal:      'bg-teal-500/10 text-teal-400 border-teal-500/30',
  distress_signal:       'bg-red-500/10 text-red-400 border-red-500/30',
  exit_signal:           'bg-orange-500/10 text-orange-400 border-orange-500/30',
  acquisition_signal:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  product_signal:        'bg-blue-500/10 text-blue-400 border-blue-500/30',
  partnership_signal:    'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  exploratory_signal:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  negated_signal:        'bg-zinc-700/30 text-zinc-500 border-zinc-700/50',
  demand_signal:         'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  buyer_pain_signal:     'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const SOURCE_LABELS: Record<string, string> = {
  rss_scrape:          'RSS',
  llm_enrichment:      'AI',
  structured_metrics:  'Metrics',
  sec_edgar:           'SEC',
  social_signal:       'Social',
  founder_upload:      'Founder',
  realtime_api:        'Live',
};

function signalBadge(cls: string | null) {
  return SIGNAL_COLORS[cls ?? ''] ?? 'bg-white/5 text-zinc-400 border-white/10';
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return '<1h ago';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  startupId: string;
  limit?: number;
}

export default function SignalEventTimeline({ startupId, limit = 12 }: Props) {
  const [events, setEvents]   = useState<SignalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityId, setEntityId] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Step 1: resolve entity
        const { data: entities } = await supabase
          .from('pythh_entities')
          .select('id')
          .eq('startup_upload_id', startupId)
          .limit(1);

        const eid = entities?.[0]?.id;
        if (!eid || cancelled) { setLoading(false); return; }
        setEntityId(eid);

        // Step 2: fetch signal events
        const { data } = await supabase
          .from('pythh_signal_events')
          .select(
            'id, primary_signal, raw_sentence, confidence, signal_strength, ' +
            'source_type, detected_at, urgency, likely_needs, is_ambiguous'
          )
          .eq('entity_id', eid)
          .not('primary_signal', 'is', null)
          .neq('primary_signal', 'negated_signal')
          .order('detected_at', { ascending: false })
          .limit(limit);

        if (!cancelled) setEvents((data || []) as SignalEvent[]);
      } catch {
        // signal data is non-blocking
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [startupId, limit]);

  // Don't render if no entity / no events after load
  if (!loading && !entityId) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
          Signal Timeline
        </h3>
        {events.length > 0 && (
          <span className="text-[10px] text-zinc-600">{events.length} signals detected</span>
        )}
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/20">
        {/* Loading skeleton */}
        {loading && (
          <div className="divide-y divide-zinc-800/60">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-zinc-800 rounded w-4/5 animate-pulse" />
                  <div className="h-3 bg-zinc-800 rounded w-2/3 animate-pulse" />
                </div>
                <div className="h-3 w-8 bg-zinc-800 rounded animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Events */}
        {!loading && events.length > 0 && (
          <div className="divide-y divide-zinc-800/60">
            {events.map((ev) => (
              <div key={ev.id} className="px-4 py-3 hover:bg-zinc-900/40 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Signal badge */}
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium leading-tight mt-0.5 ${signalBadge(ev.primary_signal)}`}>
                    {SIGNAL_LABELS[ev.primary_signal ?? ''] ?? (ev.primary_signal ?? '—').replace(/_/g, ' ')}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-xs leading-relaxed line-clamp-2">
                      {ev.raw_sentence ?? '—'}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {ev.confidence != null && (
                        <span className="text-[9px] text-zinc-500 font-mono tabular-nums">
                          {Math.round(ev.confidence * 100)}% conf
                        </span>
                      )}
                      {ev.urgency && ev.urgency !== 'low' && (
                        <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                          ev.urgency === 'high'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {ev.urgency} urgency
                        </span>
                      )}
                      {ev.source_type && (
                        <span className="text-[9px] text-zinc-600">
                          via {SOURCE_LABELS[ev.source_type] ?? ev.source_type}
                        </span>
                      )}
                      {ev.is_ambiguous && (
                        <span className="text-[9px] text-zinc-600 italic">ambiguous</span>
                      )}
                      {ev.likely_needs && ev.likely_needs.length > 0 && (
                        <div className="flex gap-1">
                          {ev.likely_needs.slice(0, 3).map(n => (
                            <span key={n} className="text-[9px] px-1 py-0.5 bg-cyan-500/10 text-cyan-500 rounded border border-cyan-500/20">
                              {n.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-[10px] text-zinc-600 tabular-nums">
                    {relativeTime(ev.detected_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-zinc-600 text-xs">No signals detected yet for this startup.</p>
            <p className="text-zinc-700 text-[10px] mt-1">Signal processing runs every few hours.</p>
          </div>
        )}
      </div>
    </section>
  );
}
