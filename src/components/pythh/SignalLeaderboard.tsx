/**
 * SignalLeaderboard
 *
 * "Top signaling startups this week" — ranked by signal velocity (count in last 7 days).
 *
 * Purpose:
 *   - Founders: creates FOMO — am I on this list? What do I need to do to appear?
 *   - Investors: curated deal flow — highest-signal companies right now
 *   - Platform: trains the "signal = visibility" loop for both audiences
 *
 * Fetches directly from Supabase. Designed to embed anywhere:
 *   - Dashboard right rail
 *   - /signal-activity public page
 *   - Investor feeds
 *
 * Usage:
 *   <SignalLeaderboard limit={10} hoursAgo={168} showViewAll />
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LeaderboardRow {
  rank: number;
  entityId: string;
  startupId: string | null;
  name: string;
  sector: string | null;
  stage: string | null;
  signalCount: number;
  topSignalClass: string | null;
  signalClasses: string[];           // unique classes detected this period
  godScore: number | null;
  isNew: boolean;                    // in top 10 for first time (future: compare prev period)
}

interface Props {
  limit?: number;
  hoursAgo?: number;        // look-back window (default 168 = 7 days)
  showViewAll?: boolean;
  compact?: boolean;        // condensed single-line rows for sidebar
  highlightStartupId?: string;  // highlight a specific startup (for founders)
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  1: 'Pre-Seed', 2: 'Seed', 3: 'Series A', 4: 'Series B', 5: 'Series C+',
};

const SIGNAL_SHORT: Record<string, string> = {
  fundraising_signal:       'Raise',
  growth_signal:            'Growth',
  revenue_signal:           'Revenue',
  product_signal:           'Product',
  hiring_signal:            'Hiring',
  buyer_pain_signal:        'Demand',
  expansion_signal:         'Expansion',
  market_position_signal:   'Market',
  efficiency_signal:        'Efficiency',
  distress_signal:          'Distress',
  acquisition_signal:       'M&A',
  investor_interest_signal: 'Investor',
  partnership_signal:       'Partnership',
  enterprise_signal:        'Enterprise',
  gtm_signal:               'GTM',
};

function shortLabel(cls: string): string {
  return SIGNAL_SHORT[cls] ?? cls.replace('_signal', '').replace(/_/g, ' ');
}

function rankColor(rank: number): string {
  if (rank === 1) return 'rgba(255,215,0,0.90)';   // gold
  if (rank === 2) return 'rgba(192,192,192,0.85)';  // silver
  if (rank === 3) return 'rgba(205,127,50,0.85)';   // bronze
  return 'rgba(255,255,255,0.35)';
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SignalLeaderboard({
  limit = 10,
  hoursAgo = 168,
  showViewAll = false,
  compact = false,
  highlightStartupId,
}: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // Step 1: Fetch recent signals with entity_id
      const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
      const { data: signals } = await supabase
        .from('pythh_signal_events')
        .select('entity_id, primary_signal, detected_at')
        .gte('detected_at', since)
        .not('entity_id', 'is', null)
        .limit(5000);

      if (cancelled) return;

      if (!signals || signals.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Step 2: Aggregate by entity
      const entityMap: Record<string, { count: number; classes: Set<string> }> = {};
      for (const s of signals) {
        if (!entityMap[s.entity_id]) {
          entityMap[s.entity_id] = { count: 0, classes: new Set() };
        }
        entityMap[s.entity_id].count++;
        if (s.primary_signal) entityMap[s.entity_id].classes.add(s.primary_signal);
      }

      // Step 3: Rank by signal count
      const ranked = Object.entries(entityMap)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit + 10); // fetch a few extra to allow for joins dropping rows

      const entityIds = ranked.map(([id]) => id);

      // Step 4: Resolve entity → startup metadata
      const { data: entities } = await supabase
        .from('pythh_entities')
        .select('id, startup_upload_id, name')
        .in('id', entityIds);

      if (cancelled) return;

      const entityToUpload: Record<string, { uploadId: string | null; name: string }> = {};
      for (const e of entities ?? []) {
        entityToUpload[e.id] = { uploadId: e.startup_upload_id, name: e.name ?? '' };
      }

      // Step 5: Fetch startup metadata for those with upload IDs
      const uploadIds = (entities ?? [])
        .map((e) => e.startup_upload_id)
        .filter((id): id is string => !!id);

      const startupMeta: Record<string, { name: string; sectors: string[] | null; stage: number | null; total_god_score: number | null }> = {};

      if (uploadIds.length > 0) {
        // Chunk to avoid URL length limits
        const CHUNK = 50;
        for (let i = 0; i < uploadIds.length; i += CHUNK) {
          const { data: uploads } = await supabase
            .from('startup_uploads')
            .select('id, name, sectors, stage, total_god_score')
            .in('id', uploadIds.slice(i, i + CHUNK));
          for (const u of uploads ?? []) {
            startupMeta[u.id] = u;
          }
        }
      }

      if (cancelled) return;

      // Step 6: Build leaderboard rows
      const leaderboard: LeaderboardRow[] = [];
      let rank = 1;
      for (const [entityId, agg] of ranked) {
        if (leaderboard.length >= limit) break;

        const entity = entityToUpload[entityId];
        if (!entity) continue;

        const meta = entity.uploadId ? startupMeta[entity.uploadId] : null;
        const name = meta?.name ?? entity.name ?? 'Unknown startup';
        if (!name || name === 'Unknown startup') continue; // skip unresolved entities

        const classes = Array.from(agg.classes);
        const topClass = classes[0] ?? null;
        const sector =
          (Array.isArray(meta?.sectors) && meta!.sectors[0]) || null;
        const stageNum = meta?.stage ?? null;
        const stageStr = stageNum !== null ? (STAGE_LABELS[stageNum] ?? null) : null;

        leaderboard.push({
          rank,
          entityId,
          startupId: entity.uploadId,
          name,
          sector,
          stage: stageStr,
          signalCount: agg.count,
          topSignalClass: topClass,
          signalClasses: classes.slice(0, 3),
          godScore: meta?.total_god_score ?? null,
          isNew: rank <= 3,
        });
        rank++;
      }

      // Find where highlighted startup ranks
      let foundUserRank: number | null = null;
      if (highlightStartupId) {
        const idx = leaderboard.findIndex((r) => r.startupId === highlightStartupId);
        if (idx !== -1) foundUserRank = leaderboard[idx].rank;
      }

      setRows(leaderboard);
      setUserRank(foundUserRank);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [limit, hoursAgo, highlightStartupId]);

  // ── COMPACT MODE (sidebar) ──────────────────────────────────────────────
  if (compact) {
    return (
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 8,
        }}>
          🔥 Top signal velocity this week
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>No data yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((r) => (
              <div
                key={r.entityId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  padding: '5px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: r.startupId === highlightStartupId
                    ? 'rgba(52,211,153,0.05)'
                    : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                  <span style={{ color: rankColor(r.rank), fontWeight: 700, minWidth: 18, fontSize: 11 }}>
                    {r.rank}
                  </span>
                  <span style={{
                    color: r.startupId === highlightStartupId
                      ? 'rgba(52,211,153,0.95)'
                      : 'rgba(255,255,255,0.75)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 130,
                    fontWeight: r.startupId === highlightStartupId ? 700 : 400,
                  }}>
                    {r.name}
                    {r.startupId === highlightStartupId && ' ←'}
                  </span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap' }}>
                  {r.signalCount} signals
                </span>
              </div>
            ))}
          </div>
        )}

        {showViewAll && (
          <Link
            to="/signal-activity"
            style={{ fontSize: 12, color: 'rgba(219,234,254,0.7)', display: 'block', marginTop: 10 }}
          >
            View full leaderboard →
          </Link>
        )}
      </div>
    );
  }

  // ── FULL MODE ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 4,
          }}>
            signal velocity leaderboard
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            Most Active Startups This Week
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', margin: '4px 0 0' }}>
            Ranked by signal output in the last {hoursAgo >= 168 ? '7 days' : `${hoursAgo}h`}.
            Investors see this ranking in real time.
          </p>
        </div>
        {lastUpdated && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
            Updated {lastUpdated}
          </div>
        )}
      </div>

      {/* User rank callout */}
      {highlightStartupId && !loading && (
        <div style={{
          background: userRank !== null
            ? 'rgba(52,211,153,0.07)'
            : 'rgba(239,68,68,0.06)',
          border: `1px solid ${userRank !== null ? 'rgba(52,211,153,0.20)' : 'rgba(239,68,68,0.18)'}`,
          borderRadius: 10,
          padding: '10px 16px',
          fontSize: 13,
          color: userRank !== null ? 'rgba(52,211,153,0.90)' : 'rgba(239,68,68,0.80)',
          marginBottom: 14,
        }}>
          {userRank !== null
            ? `Your startup is ranked #${userRank} this week — you're visible to active investors.`
            : 'Your startup is not in the top leaderboard this week. Generate more signals to appear in investor feeds.'}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              height: 60,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              animation: 'pulse 1.8s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 14,
        }}>
          No signal activity detected in the last {hoursAgo >= 168 ? '7 days' : `${hoursAgo}h`}.
          <br />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            Run the pipeline to populate signal data.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r) => {
            const isUser = r.startupId === highlightStartupId;
            return (
              <div
                key={r.entityId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: isUser
                    ? 'rgba(52,211,153,0.06)'
                    : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${isUser ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'background 0.15s',
                }}
              >
                {/* Rank */}
                <div style={{
                  fontSize: r.rank <= 3 ? 16 : 13,
                  fontWeight: 800,
                  color: rankColor(r.rank),
                  textAlign: 'center',
                }}>
                  {r.rank}
                </div>

                {/* Name + meta */}
                <div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: isUser ? 700 : 600,
                    color: isUser ? 'rgba(52,211,153,0.95)' : 'rgba(255,255,255,0.88)',
                    marginBottom: 4,
                  }}>
                    {r.name}
                    {isUser && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'rgba(52,211,153,0.15)',
                        color: 'rgba(52,211,153,0.90)',
                        border: '1px solid rgba(52,211,153,0.25)',
                        borderRadius: 4,
                        padding: '1px 6px',
                        verticalAlign: 'middle',
                      }}>
                        You
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {r.sector && (
                      <span style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.40)',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}>
                        {r.sector}
                      </span>
                    )}
                    {r.stage && (
                      <span style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.40)',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}>
                        {r.stage}
                      </span>
                    )}
                    {r.signalClasses.map((cls) => (
                      <span key={cls} style={{
                        fontSize: 10,
                        color: 'rgba(219,234,254,0.55)',
                        background: 'rgba(219,234,254,0.06)',
                        border: '1px solid rgba(219,234,254,0.10)',
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}>
                        {shortLabel(cls)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Signal count + GOD score */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: r.rank <= 3 ? rankColor(r.rank) : 'rgba(255,255,255,0.75)',
                  }}>
                    {r.signalCount}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>signals</div>
                  {r.godScore !== null && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      GOD {r.godScore.toFixed(0)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showViewAll && rows.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            to="/signal-activity"
            style={{
              fontSize: 13,
              color: 'rgba(219,234,254,0.7)',
              textDecoration: 'none',
            }}
          >
            View full leaderboard →
          </Link>
        </div>
      )}
    </div>
  );
}

export default SignalLeaderboard;
