/**
 * SIGNAL TAPE
 * 
 * Signals page = market tape. Not a dashboard.
 * A table-card feed of detected investor movement.
 * 
 * Columns: ENTITY | CONTEXT | STATUS | TIME
 * 
 * Glow behavior:
 * - New items: cyan glow for 3-5s, then fades
 * - HIGH signal: stronger cyan glow
 * - MID: normal glow
 * - No green/orange here (keep Signals page pure cyan)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  TableCardContainer,
  TableCardRow,
  ColumnHeaderRow,
  Cell,
  EntityCell,
  StatusPill,
  TimeCell,
  GlowIntent,
} from '@/components/ui/TableCard';
import { supabase } from '@/lib/supabase';
import { Building2 } from 'lucide-react';

interface SignalEvent {
  id: string;
  firmName: string;
  context: string;
  status: 'high' | 'mid' | 'low';
  timestamp: Date;
  isNew: boolean; // For glow animation
}

// Mock signal events (in production, these come from RSS/scraping)
const MOCK_SIGNALS: Omit<SignalEvent, 'id' | 'isNew'>[] = [
  { firmName: 'Sequoia', context: 'Partner mention: agent infrastructure', status: 'high', timestamp: new Date(Date.now() - 1000 * 60 * 20) },
  { firmName: 'Accel', context: 'Seed velocity spike in B2B SaaS', status: 'high', timestamp: new Date(Date.now() - 1000 * 60 * 45) },
  { firmName: 'Greylock', context: 'Thesis published: automation tools', status: 'mid', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { firmName: 'a16z', context: 'Portfolio activity: AI infrastructure', status: 'high', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  { firmName: 'Ribbit Capital', context: 'Velocity rising in FinTech', status: 'mid', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
  { firmName: 'Benchmark', context: 'Stage readiness shift in consumer', status: 'mid', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8) },
  { firmName: 'Founders Fund', context: 'Deep tech thesis expansion', status: 'high', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12) },
  { firmName: 'Lightspeed', context: 'Enterprise SaaS deployment signal', status: 'mid', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18) },
  { firmName: 'Index Ventures', context: 'European expansion focus', status: 'mid', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  { firmName: 'Khosla Ventures', context: 'Climate tech thesis convergence', status: 'high', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36) },
];

export default function SignalTape() {
  const [signals, setSignals] = useState<SignalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const newSignalIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadSignals();
    
    // Poll for new signals every 30 seconds
    const interval = setInterval(loadSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  // Clear "new" status after 5 seconds
  useEffect(() => {
    if (signals.some(s => s.isNew)) {
      const timeout = setTimeout(() => {
        setSignals(prev => prev.map(s => ({ ...s, isNew: false })));
        newSignalIdsRef.current.clear();
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [signals]);

  async function loadSignals() {
    try {
      // Try to get real signals from RSS/discovered_startups or investor activity
      const { data: investorData } = await supabase
        .from('investors')
        .select('id, name, sectors, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

      let realSignals: SignalEvent[] = [];
      
      if (investorData && investorData.length > 0) {
        // Convert investor updates to signal events
        realSignals = investorData.map((inv: any, idx) => {
          const sectors = Array.isArray(inv.sectors) ? inv.sectors.slice(0, 2).join(', ') : 'General';
          const hoursSince = (Date.now() - new Date(inv.updated_at).getTime()) / (1000 * 60 * 60);
          
          // Determine status based on recency
          let status: 'high' | 'mid' | 'low' = 'mid';
          if (hoursSince < 2) status = 'high';
          else if (hoursSince > 24) status = 'low';
          
          // Check if this is a new signal
          const isNew = !newSignalIdsRef.current.has(inv.id) && hoursSince < 1;
          if (isNew) newSignalIdsRef.current.add(inv.id);
          
          return {
            id: inv.id,
            firmName: inv.name || `Investor ${idx + 1}`,
            context: `Activity detected in ${sectors}`,
            status,
            timestamp: new Date(inv.updated_at),
            isNew,
          };
        });
      }

      // Merge with mock signals if we don't have enough real data
      if (realSignals.length < 5) {
        const mockSignals: SignalEvent[] = MOCK_SIGNALS.map((s, idx) => ({
          ...s,
          id: `mock-${idx}`,
          isNew: false,
        }));
        realSignals = [...realSignals, ...mockSignals.slice(0, 10 - realSignals.length)];
      }

      // Sort by timestamp
      realSignals.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setSignals(realSignals);
    } catch (error) {
      console.error('Error loading signals:', error);
      // Fallback to mock data
      setSignals(MOCK_SIGNALS.map((s, idx) => ({
        ...s,
        id: `mock-${idx}`,
        isNew: false,
      })));
    } finally {
      setLoading(false);
    }
  }

  function getRowGlow(signal: SignalEvent): GlowIntent {
    if (signal.isNew) return 'signal';
    if (signal.status === 'high') return 'signal';
    return 'neutral';
  }

  if (loading) {
    return (
      <div className="w-full py-8">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 bg-zinc-900/60 rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TableCardContainer
      title="Signal Tape"
      liveCount={signals.filter(s => s.status === 'high').length}
      className="w-full"
    >
      {/* Column Headers */}
      <ColumnHeaderRow sticky>
        <Cell className="flex-1">Firm</Cell>
        <Cell className="flex-[2]">Signal Event</Cell>
        <Cell width="80px" align="center">Status</Cell>
        <Cell width="80px" align="right">Time</Cell>
      </ColumnHeaderRow>

      {/* Signal Rows */}
      {signals.map((signal) => (
        <TableCardRow
          key={signal.id}
          glow={getRowGlow(signal)}
          glowOnHover="signal"
          pulse={signal.isNew}
        >
          <Cell className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm text-zinc-100 truncate">
                {signal.firmName}
              </span>
            </div>
          </Cell>
          
          <Cell className="flex-[2]">
            <span className="text-sm text-zinc-400 truncate">
              {signal.context}
            </span>
          </Cell>
          
          <Cell width="80px" align="center">
            <StatusPill status={signal.status} />
          </Cell>
          
          <Cell width="80px" align="right">
            <TimeCell timestamp={signal.timestamp} />
          </Cell>
        </TableCardRow>
      ))}

      {signals.length === 0 && (
        <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">
          No signals detected yet
        </div>
      )}
    </TableCardContainer>
  );
}
