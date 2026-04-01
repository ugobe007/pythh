/**
 * InvestorSignalAlertStrip
 *
 * Shows investors 3-5 high-velocity startups matching their thesis — RIGHT NOW.
 * Placed at the top of the investor feed to create urgency and surface deal flow
 * before it becomes obvious.
 *
 * Mechanics:
 *   - Filters pythh_signal_events from the last 7 days by matching startup sectors
 *   - Ranks by signal count (velocity) in that window
 *   - Awards "First Look" badge when total signal count is low (early-stage signal profile)
 *   - Awards "Accelerating" badge when last-7d count > prev-7d count
 *
 * Usage:
 *   <InvestorSignalAlertStrip
 *     sectors={['AI/ML', 'SaaS']}
 *     stages={['Seed', 'Series A']}
 *     onSelectStartup={(id) => navigate(`/lookup/startup/${id}`)}
 *   />
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AlertStartup {
  startupId: string;
  name: string;
  sector: string | null;
  stage: string | null;
  signalCountLast7d: number;
  signalCountPrev7d: number;
  topSignalClass: string | null;
  signalClasses: string[];
  isFirstLook: boolean;      // total signal profile is still sparse — seen by few investors
  isAccelerating: boolean;   // last 7d > prev 7d by 50%+
  godScore: number | null;
}

interface Props {
  sectors?: string[];
  stages?: string[];
  onSelectStartup?: (startupId: string) => void;
  maxAlerts?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_NUM: Record<string, number> = {
  'Pre-Seed': 1, 'Seed': 2, 'Series A': 3, 'Series B': 4, 'Series C+': 5,
};

const STAGE_LABELS: Record<number, string> = {
  1: 'Pre-Seed', 2: 'Seed', 3: 'Series A', 4: 'Series B', 5: 'Series C+',
};

const SIGNAL_SHORT: Record<string, string> = {
  fundraising_signal:     'Raise',
  growth_signal:          'Growth',
  revenue_signal:         'Revenue',
  product_signal:         'Product',
  hiring_signal:          'Hiring',
  buyer_pain_signal:      'Demand',
  expansion_signal:       'Expansion',
  market_position_signal: 'Market',
};

function shortLabel(cls: string): string {
  return SIGNAL_SHORT[cls] ?? cls.replace('_signal', '').replace(/_/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function InvestorSignalAlertStrip({
  sectors = [],
  stages = [],
  onSelectStartup,
  maxAlerts = 4,
}: Props) {
  const [alerts, setAlerts] = useState<AlertStartup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const now = Date.now();
      const ms7d  = 7  * 24 * 60 * 60 * 1000;
      const ms14d = 14 * 24 * 60 * 60 * 1000;

      // Step 1: Resolve sector-matching startup IDs
      let uploadsQuery = supabase
        .from('startup_uploads')
        .select('id, name, sectors, stage, total_god_score')
        .limit(2000);

      if (sectors.length > 0) {
        // Each sector must overlap — use .overlaps() for array columns
        uploadsQuery = uploadsQuery.overlaps('sectors', sectors);
      }
      if (stages.length > 0) {
        const stageNums = stages.map((s) => STAGE_NUM[s]).filter(Boolean);
        if (stageNums.length > 0) uploadsQuery = uploadsQuery.in('stage', stageNums);
      }

      const { data: uploads } = await uploadsQuery;
      if (cancelled) return;

      const uploadMap: Record<string, { name: string; sector: string | null; stage: string | null; godScore: number | null }> = {};
      for (const u of uploads ?? []) {
        uploadMap[u.id] = {
          name: u.name ?? 'Unknown',
          sector: Array.isArray(u.sectors) ? u.sectors[0] : null,
          stage: u.stage !== null ? (STAGE_LABELS[u.stage] ?? null) : null,
          godScore: u.total_god_score ?? null,
        };
      }

      const uploadIds = Object.keys(uploadMap);
      if (uploadIds.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Step 2: Resolve startup_upload_id → entity_id
      const entityMap: Record<string, string> = {}; // startupId → entityId
      const CHUNK = 50;
      for (let i = 0; i < uploadIds.length; i += CHUNK) {
        const { data: entities } = await supabase
          .from('pythh_entities')
          .select('id, startup_upload_id')
          .in('startup_upload_id', uploadIds.slice(i, i + CHUNK));
        for (const e of entities ?? []) {
          if (e.startup_upload_id) entityMap[e.startup_upload_id] = e.id;
        }
      }

      const entityIds = Object.values(entityMap);
      if (entityIds.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Step 3: Fetch signal events for last 14 days
      const since14d = new Date(now - ms14d).toISOString();
      const { data: signals } = await supabase
        .from('pythh_signal_events')
        .select('entity_id, primary_signal, detected_at')
        .in('entity_id', entityIds)
        .gte('detected_at', since14d)
        .limit(5000);

      if (cancelled) return;

      // Step 4: Aggregate per entity
      type Agg = { last7: number; prev7: number; classes: Set<string> };
      const agg: Record<string, Agg> = {};

      for (const s of signals ?? []) {
        if (!agg[s.entity_id]) agg[s.entity_id] = { last7: 0, prev7: 0, classes: new Set() };
        const age = now - new Date(s.detected_at).getTime();
        if (age <= ms7d) {
          agg[s.entity_id].last7++;
          if (s.primary_signal) agg[s.entity_id].classes.add(s.primary_signal);
        } else {
          agg[s.entity_id].prev7++;
        }
      }

      // Step 5: Build alert list — only entities with activity last 7d
      // Reverse map: entityId → startupId
      const entityToStartup: Record<string, string> = {};
      for (const [startupId, entityId] of Object.entries(entityMap)) {
        entityToStartup[entityId] = startupId;
      }

      const results: AlertStartup[] = [];

      for (const [entityId, data] of Object.entries(agg)) {
        if (data.last7 === 0) continue;
        const startupId = entityToStartup[entityId];
        if (!startupId) continue;
        const meta = uploadMap[startupId];
        if (!meta || !meta.name || meta.name === 'Unknown') continue;

        const classes = Array.from(data.classes);
        const total = data.last7 + data.prev7;
        const isFirstLook = total <= 5;
        const isAccelerating = data.prev7 === 0
          ? data.last7 > 0
          : data.last7 / data.prev7 >= 1.5;

        results.push({
          startupId,
          name: meta.name,
          sector: meta.sector,
          stage: meta.stage,
          signalCountLast7d: data.last7,
          signalCountPrev7d: data.prev7,
          topSignalClass: classes[0] ?? null,
          signalClasses: classes.slice(0, 3),
          isFirstLook,
          isAccelerating,
          godScore: meta.godScore,
        });
      }

      // Rank: First Look and Accelerating get boosted; then by signal count
      results.sort((a, b) => {
        const aScore = a.signalCountLast7d + (a.isAccelerating ? 5 : 0) + (a.isFirstLook ? 2 : 0);
        const bScore = b.signalCountLast7d + (b.isAccelerating ? 5 : 0) + (b.isFirstLook ? 2 : 0);
        return bScore - aScore;
      });

      setAlerts(results.slice(0, maxAlerts));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [sectors.join(','), stages.join(','), maxAlerts]);

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
      }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            minWidth: 220, height: 100,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            animation: 'pulse 1.8s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.85} }`}</style>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 13,
        color: 'rgba(255,255,255,0.35)',
      }}>
        No high-velocity startups detected in your thesis this week.
        {sectors.length === 0 && ' Set your sector focus above to narrow the signal feed.'}
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 10,
      }}>
        ⚡ Signal alerts — high velocity startups in your thesis
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {alerts.map((a) => (
          <div
            key={a.startupId}
            onClick={() => onSelectStartup?.(a.startupId)}
            style={{
              minWidth: 220,
              maxWidth: 260,
              flexShrink: 0,
              padding: '14px 16px',
              borderRadius: 12,
              background: a.isFirstLook
                ? 'rgba(251,191,36,0.05)'
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${a.isFirstLook ? 'rgba(251,191,36,0.20)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {/* Badges */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {a.isFirstLook && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  background: 'rgba(251,191,36,0.15)',
                  color: 'rgba(251,191,36,0.90)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  borderRadius: 4, padding: '2px 6px',
                  textTransform: 'uppercase',
                }}>
                  First Look
                </span>
              )}
              {a.isAccelerating && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  background: 'rgba(52,211,153,0.12)',
                  color: 'rgba(52,211,153,0.90)',
                  border: '1px solid rgba(52,211,153,0.22)',
                  borderRadius: 4, padding: '2px 6px',
                  textTransform: 'uppercase',
                }}>
                  ↑ Accelerating
                </span>
              )}
            </div>

            {/* Name */}
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: 'rgba(255,255,255,0.90)',
              marginBottom: 5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {a.name}
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {a.sector && (
                <span style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.40)',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 4, padding: '1px 6px',
                }}>
                  {a.sector}
                </span>
              )}
              {a.stage && (
                <span style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.40)',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 4, padding: '1px 6px',
                }}>
                  {a.stage}
                </span>
              )}
            </div>

            {/* Signal classes */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {a.signalClasses.map((cls) => (
                <span key={cls} style={{
                  fontSize: 10,
                  color: 'rgba(219,234,254,0.60)',
                  background: 'rgba(219,234,254,0.06)',
                  border: '1px solid rgba(219,234,254,0.10)',
                  borderRadius: 4, padding: '1px 6px',
                }}>
                  {shortLabel(cls)}
                </span>
              ))}
            </div>

            {/* Velocity stat */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 12, color: 'rgba(255,255,255,0.50)',
            }}>
              <span>
                <span style={{ fontWeight: 700, color: 'rgba(52,211,153,0.90)', fontSize: 14 }}>
                  {a.signalCountLast7d}
                </span>
                {' '}signals / 7d
              </span>
              {a.godScore !== null && (
                <span style={{ color: 'rgba(255,255,255,0.30)' }}>
                  GOD {a.godScore.toFixed(0)}
                </span>
              )}
            </div>

            {/* CTA link */}
            <Link
              to={`/lookup/startup/${a.startupId}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'block',
                marginTop: 10,
                fontSize: 11,
                color: 'rgba(219,234,254,0.65)',
                textDecoration: 'none',
              }}
            >
              View signal profile →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default InvestorSignalAlertStrip;
