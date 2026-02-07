/**
 * MatchHeatMap — Horizontal sector boxes showing match density
 * 
 * Design:
 * - Clean boxes with horizontal progress bars
 * - ALL CYAN color scheme (light → dark for hot → cold)
 * - Animated progress bars
 * - Clear sector labels at bottom
 * - ALWAYS shows data (live when available, demo fallback)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SectorMatch {
  id: string;
  sector: string;
  count: number;
  maxCount: number; // for normalization
  trend: 'up' | 'down' | 'flat';
  quality: 'hot' | 'warm' | 'cold'; // based on avg match score
}

interface MatchHeatMapProps {
  sectors?: SectorMatch[];
  onSectorClick?: (sector: string) => void;
  isDemo?: boolean;
}

// Demo data - shown only when database fails
const DEMO_SECTORS: SectorMatch[] = [
  { id: '1', sector: 'AI/ML', count: 437, maxCount: 500, trend: 'up', quality: 'hot' },
  { id: '2', sector: 'Fintech', count: 218, maxCount: 500, trend: 'up', quality: 'warm' },
  { id: '3', sector: 'SaaS', count: 1250, maxCount: 1500, trend: 'flat', quality: 'hot' },
  { id: '4', sector: 'Security', count: 11, maxCount: 500, trend: 'up', quality: 'cold' },
  { id: '5', sector: 'HealthTech', count: 158, maxCount: 500, trend: 'down', quality: 'warm' },
  { id: '6', sector: 'Climate', count: 76, maxCount: 500, trend: 'flat', quality: 'cold' },
  { id: '7', sector: 'DevTools', count: 26, maxCount: 500, trend: 'up', quality: 'cold' },
];

// Canonical sector categories
const SECTOR_CATEGORIES = ['AI/ML', 'Fintech', 'SaaS', 'Security', 'HealthTech', 'Climate', 'DevTools'];

// Normalize sector names to canonical list
function normalizeSector(s: string): string {
  const lower = s?.toLowerCase() || '';
  if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine learning') || lower.includes('artificial')) return 'AI/ML';
  if (lower.includes('fintech') || lower.includes('financial') || lower.includes('payments') || lower.includes('banking') || lower.includes('insurance')) return 'Fintech';
  if (lower.includes('saas') || lower.includes('software') || lower.includes('enterprise') || lower.includes('b2b')) return 'SaaS';
  if (lower.includes('security') || lower.includes('cyber') || lower.includes('privacy') || lower.includes('identity')) return 'Security';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('biotech') || lower.includes('pharma') || lower.includes('wellness')) return 'HealthTech';
  if (lower.includes('climate') || lower.includes('clean') || lower.includes('energy') || lower.includes('sustainability') || lower.includes('green')) return 'Climate';
  if (lower.includes('dev') || lower.includes('developer') || lower.includes('tools') || lower.includes('infrastructure') || lower.includes('api')) return 'DevTools';
  return 'SaaS'; // Default category
}

export default function MatchHeatMap({ sectors: propSectors, onSectorClick, isDemo = false }: MatchHeatMapProps) {
  const [sectors, setSectors] = useState<SectorMatch[]>(DEMO_SECTORS);
  const [animatedPercent, setAnimatedPercent] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Use prop sectors if provided and has data, otherwise load from database
  useEffect(() => {
    if (propSectors && propSectors.some(s => s.count > 0)) {
      setSectors(propSectors);
      setIsLoading(false);
    } else {
      loadLiveSectorData();
    }
  }, [propSectors]);

  // Load LIVE sector distribution from database
  async function loadLiveSectorData() {
    try {
      setIsLoading(true);
      
      // Get sector counts from investors table (sectors is an array column)
      const { data: investorData } = await supabase
        .from('investors')
        .select('sectors')
        .eq('status', 'active');

      if (investorData && investorData.length > 0) {
        // Count sectors across all investors
        const sectorCounts: Record<string, number> = {};
        SECTOR_CATEGORIES.forEach(cat => { sectorCounts[cat] = 0; });
        
        investorData.forEach((inv: any) => {
          const investorSectors = inv.sectors || [];
          investorSectors.forEach((s: string) => {
            const normalized = normalizeSector(s);
            sectorCounts[normalized] = (sectorCounts[normalized] || 0) + 1;
          });
        });

        // Convert to SectorMatch format
        const maxCount = Math.max(...Object.values(sectorCounts), 50);
        const liveSectors: SectorMatch[] = SECTOR_CATEGORIES.map((cat, idx) => {
          const count = sectorCounts[cat] || 0;
          const ratio = count / maxCount;
          return {
            id: String(idx + 1),
            sector: cat,
            count,
            maxCount,
            trend: ratio > 0.5 ? 'up' : ratio > 0.2 ? 'flat' : 'down',
            quality: ratio > 0.6 ? 'hot' : ratio > 0.3 ? 'warm' : 'cold',
          };
        });

        setSectors(liveSectors);
      }
    } catch (err) {
      console.error('Failed to load live sector data:', err);
      // Keep demo data on error
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate max across all sectors for relative sizing
  const globalMax = Math.max(...sectors.map(s => s.count), 1);

  // Animate on mount
  useEffect(() => {
    // Start at 0
    const initial: Record<string, number> = {};
    sectors.forEach(s => { initial[s.id] = 0; });
    setAnimatedPercent(initial);

    // Animate to real values
    const timer = setTimeout(() => {
      const target: Record<string, number> = {};
      sectors.forEach(s => {
        // Use relative to global max so bars are proportional
        target[s.id] = Math.min(100, (s.count / globalMax) * 100);
      });
      setAnimatedPercent(target);
    }, 100);

    return () => clearTimeout(timer);
  }, [sectors, globalMax]);

  // Subtle live animation (small fluctuations)
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedPercent(prev => {
        const next = { ...prev };
        sectors.forEach(s => {
          const base = (s.count / globalMax) * 100;
          // Small random fluctuation (±2%)
          const fluctuation = (Math.random() - 0.5) * 4;
          next[s.id] = Math.max(5, Math.min(100, base + fluctuation));
        });
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [sectors, globalMax]);

  return (
    <div className="flex justify-center gap-3 pb-2">
      {sectors.map(sector => (
        <SectorBox 
          key={sector.id} 
          sector={sector} 
          percent={animatedPercent[sector.id] || 0}
          onClick={() => onSectorClick?.(sector.sector)}
        />
      ))}
    </div>
  );
}

interface SectorBoxProps {
  sector: SectorMatch;
  percent: number;
  onClick?: () => void;
}

function SectorBox({ sector, percent, onClick }: SectorBoxProps) {
  const { sector: name, count, quality } = sector;
  const [showTooltip, setShowTooltip] = useState(false);

  // ALL CYAN color scheme - varying intensity
  const barColor = quality === 'hot'
    ? 'bg-cyan-400'
    : quality === 'warm'
      ? 'bg-cyan-600'
      : 'bg-cyan-800';

  const borderColor = quality === 'hot'
    ? 'border-cyan-500/50 hover:border-cyan-400/70'
    : quality === 'warm'
      ? 'border-cyan-700/40 hover:border-cyan-600/60'
      : 'border-cyan-900/40 hover:border-cyan-800/50';

  const countColor = quality === 'hot'
    ? 'text-cyan-300'
    : quality === 'warm'
      ? 'text-cyan-500'
      : 'text-cyan-700';

  // Glow effect for hot sectors with high counts
  const glowClass = quality === 'hot' && percent > 60
    ? 'shadow-[0_0_15px_rgba(6,182,212,0.3)]'
    : quality === 'warm' && percent > 70
      ? 'shadow-[0_0_10px_rgba(6,182,212,0.15)]'
      : '';

  // Tooltip explanation
  const qualityLabel = quality === 'hot' ? 'High activity' : quality === 'warm' ? 'Moderate activity' : 'Low activity';
  const tooltipText = `${count} investors actively investing in ${name}. ${qualityLabel} in this sector.`;

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          relative flex-shrink-0 w-28 h-24
          border rounded-lg overflow-hidden
          transition-all duration-300 cursor-pointer
          bg-zinc-900/60 hover:bg-zinc-900/80
          ${borderColor} ${glowClass}
        `}
      >
        {/* Content */}
        <div className="h-full flex flex-col items-center justify-center p-2">
          {/* Count - LARGER and colored */}
          <div className={`text-3xl font-bold tabular-nums ${countColor}`}>
            {count}
          </div>
          
          {/* Horizontal progress bar */}
          <div className="w-full mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          
          {/* Sector label - LARGER and clearer */}
          <div className="text-xs text-zinc-300 mt-2 truncate max-w-full font-semibold">
            {name}
          </div>
        </div>
      </button>
      
      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-50 whitespace-nowrap">
          <p className="text-xs text-zinc-200">{tooltipText}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-zinc-700"></div>
          </div>
        </div>
      )}
    </div>
  );
}
