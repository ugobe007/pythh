// ============================================================================
// SignalTicker - Stock-price style signal reading
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { StartupContext, SIGNAL_WEIGHTS } from '@/lib/pythh-types';

interface SignalTickerProps {
  signals: StartupContext['signals'];
  className?: string;
}

interface TickerItem {
  id: string;
  label: string;
  value: number;
  max: number;
  trend: 'up' | 'down' | 'flat';
}

const SIGNAL_LABELS: Record<string, string> = {
  founder_language_shift: 'Language',
  investor_receptivity: 'Receptivity',
  news_momentum: 'News',
  capital_convergence: 'Capital',
  execution_velocity: 'Velocity',
};

export function SignalTicker({ signals, className = '' }: SignalTickerProps) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isNew, setIsNew] = useState(false);
  const prevTotal = useRef(signals.total);

  useEffect(() => {
    const newItems: TickerItem[] = Object.entries(SIGNAL_WEIGHTS).map(([key, config]) => {
      const value = signals[key as keyof typeof signals] as number;
      return {
        id: key,
        label: SIGNAL_LABELS[key] || key,
        value,
        max: config.max,
        trend: value > config.max * 0.6 ? 'up' : value < config.max * 0.3 ? 'down' : 'flat',
      };
    });
    setItems(newItems);

    // Pulse animation on change
    if (signals.total !== prevTotal.current) {
      setIsNew(true);
      prevTotal.current = signals.total;
      const timer = setTimeout(() => setIsNew(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [signals]);

  const totalTrend = signals.total >= 6 ? 'up' : signals.total <= 4 ? 'down' : 'flat';

  return (
    <div className={`flex items-center gap-4 overflow-x-auto py-2 ${className}`}>
      {/* Total signal score */}
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold
          transition-all duration-300
          ${isNew ? 'scale-105 ring-2 ring-blue-400' : ''}
          ${totalTrend === 'up' ? 'bg-emerald-900/20 text-emerald-400' : 
            totalTrend === 'down' ? 'bg-red-900/20 text-red-400' : 
            'bg-gray-800/50 text-gray-300'}
        `}
      >
        <span className="text-xs opacity-70 uppercase tracking-wider">SIGNAL</span>
        <span className={totalTrend === 'up' ? 'text-emerald-400' : totalTrend === 'down' ? 'text-red-400' : ''}>
          {signals.total.toFixed(1)}
        </span>
        <span className="text-sm">
          {totalTrend === 'up' ? '▲' : totalTrend === 'down' ? '▼' : '■'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-700" />

      {/* Individual signals */}
      <div className="flex items-center gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1.5 text-sm"
            title={`${item.label}: ${item.value.toFixed(1)} / ${item.max.toFixed(1)}`}
          >
            <span className="text-gray-500">{item.label}</span>
            <span
              className={`font-mono ${
                item.trend === 'up' ? 'text-emerald-400' :
                item.trend === 'down' ? 'text-red-400' :
                'text-gray-400'
              }`}
            >
              {item.value.toFixed(1)}
            </span>
            <span className="text-xs opacity-50">
              {item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
