/**
 * LIVE MATCHING STREAM
 * 
 * Replaces panel cards on home page with Table Card rows.
 * Shows "the engine is alive" and creates trust.
 * 
 * Columns: ENTITY | CONTEXT | SIGNAL | FIT | STATUS
 * 
 * Glow behavior:
 * - LIVE: cyan glow with subtle pulse
 * - High FIT: green accent (secondary)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TableCardContainer,
  TableCardRow,
  ColumnHeaderRow,
  Cell,
  EntityCell,
  ScoreCell,
  FitBars,
  StatusPill,
  GlowIntent,
} from '@/components/ui/TableCard';
import { supabase } from '@/lib/supabase';
import { User } from 'lucide-react';

interface LiveMatch {
  id: string;
  entityName: string;
  entityType: 'startup' | 'investor';
  context: string;
  signal: number;
  fit: number;
  status: 'live' | 'high' | 'mid';
  updatedAt: Date;
}

export default function LiveMatchingStream() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    loadLiveMatches();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadLiveMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadLiveMatches() {
    try {
      // Get recent high-quality matches
      const { data, error } = await supabase
        .from('startup_investor_matches')
        .select(`
          id,
          match_score,
          signal_score,
          fit_bucket,
          created_at,
          startup_uploads!inner(id, name, sectors, stage),
          investors!inner(id, name, sectors, stage)
        `)
        .gte('match_score', 60)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data && data.length > 0) {
        const liveMatches: LiveMatch[] = data.map((m: any, idx) => {
          const startup = m.startup_uploads;
          const investor = m.investors;
          
          // Alternate between showing startup and investor
          const showStartup = idx % 2 === 0;
          const entity = showStartup ? startup : investor;
          const entityType = showStartup ? 'startup' as const : 'investor' as const;
          
          // Build context string
          const sectors = entity?.sectors?.slice(0, 2).join(', ') || 'General';
          const stage = Array.isArray(entity?.stage) ? entity.stage[0] : entity?.stage || 'Seed';
          const context = `${sectors} · ${stage}`;
          
          // Convert signal from 0-10 to display
          const signal = m.signal_score || (m.match_score / 10);
          
          // Fit from bucket (1-5)
          const fit = m.fit_bucket || Math.min(5, Math.ceil(m.match_score / 20));
          
          // Status based on recency and score
          const hoursSinceUpdate = (Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60);
          let status: 'live' | 'high' | 'mid' = 'mid';
          if (hoursSinceUpdate < 1 && m.match_score >= 75) {
            status = 'live';
          } else if (m.match_score >= 70) {
            status = 'high';
          }
          
          return {
            id: m.id,
            entityName: entity?.name || 'Unknown',
            entityType,
            context,
            signal,
            fit,
            status,
            updatedAt: new Date(m.created_at),
          };
        });

        setMatches(liveMatches);
        setActiveCount(liveMatches.filter(m => m.status === 'live').length || liveMatches.length);
      }
    } catch (error) {
      console.error('Error loading live matches:', error);
    } finally {
      setLoading(false);
    }
  }

  function getRowGlow(match: LiveMatch): GlowIntent {
    if (match.status === 'live') return 'signal';
    if (match.fit >= 4) return 'good';
    return 'neutral';
  }

  function handleRowClick(match: LiveMatch) {
    if (match.entityType === 'startup') {
      navigate('/app/radar');
    } else {
      navigate('/app/signals');
    }
  }

  if (loading) {
    return (
      <div className="w-full py-8">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-zinc-900/60 rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TableCardContainer
      title="Live Signal Matching"
      liveCount={activeCount}
      className="w-full"
    >
      {/* Column Headers */}
      <ColumnHeaderRow>
        <Cell className="flex-1">Entity</Cell>
        <Cell width="100px" align="center">Signal</Cell>
        <Cell width="80px" align="center">Fit</Cell>
        <Cell width="80px" align="center">Status</Cell>
      </ColumnHeaderRow>

      {/* Match Rows */}
      {matches.map((match) => (
        <TableCardRow
          key={match.id}
          glow={getRowGlow(match)}
          pulse={match.status === 'live'}
          onClick={() => handleRowClick(match)}
        >
          <EntityCell
            name={match.entityName}
            context={match.context}
            icon={<User className="w-4 h-4" />}
          />
          
          <Cell width="100px" align="center">
            <ScoreCell value={match.signal} type="signal" showArrow />
          </Cell>
          
          <Cell width="80px" align="center">
            <FitBars level={match.fit} />
          </Cell>
          
          <Cell width="80px" align="center">
            <StatusPill status={match.status} />
          </Cell>
        </TableCardRow>
      ))}

      {matches.length === 0 && (
        <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">
          No live matches at the moment
        </div>
      )}
    </TableCardContainer>
  );
}
