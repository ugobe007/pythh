/**
 * SignalHealthHexagon
 *
 * Renders a pentagon radar chart of the 5 signal dimensions from StartupContext.signals,
 * plus a Fundraising Readiness Score gauge.
 *
 * Data source: get_startup_context RPC → context.signals
 * Weights from SIGNAL_WEIGHTS in pythh-types.ts
 */

import type { StartupContext } from '@/lib/pythh-types';

// ── Constants ─────────────────────────────────────────────────────────────────

// The 5 axes and their max possible contribution
const AXES: Array<{
  key: keyof StartupContext['signals'];
  label: string;
  shortLabel: string;
  max: number;
  description: string;
}> = [
  {
    key:         'founder_language_shift',
    label:       'Founder Language',
    shortLabel:  'Language',
    max:         2.0,
    description: 'How your language reflects investor-ready intent and conviction',
  },
  {
    key:         'investor_receptivity',
    label:       'Investor Receptivity',
    shortLabel:  'Receptivity',
    max:         2.5,
    description: 'Degree to which your signals match current investor appetite patterns',
  },
  {
    key:         'news_momentum',
    label:       'News Momentum',
    shortLabel:  'Momentum',
    max:         1.5,
    description: 'Volume and recency of coverage that creates external validation',
  },
  {
    key:         'capital_convergence',
    label:       'Capital Convergence',
    shortLabel:  'Capital',
    max:         2.0,
    description: 'Alignment between your trajectory and where capital is currently moving',
  },
  {
    key:         'execution_velocity',
    label:       'Execution Velocity',
    shortLabel:  'Velocity',
    max:         2.0,
    description: 'Rate and consistency of shipped milestones inferred from signals',
  },
];

const TOTAL_MAX = 10.0;

// ── Readiness interpretation ──────────────────────────────────────────────────

function interpretReadiness(total: number): {
  label: string;
  sublabel: string;
  color: string;
} {
  const pct = (total / TOTAL_MAX) * 100;
  if (pct >= 75) return { label: 'Raise-Ready',       sublabel: 'Strong signal mix — favorable timing',    color: '#34d399' };
  if (pct >= 55) return { label: 'Approaching Ready', sublabel: 'Good foundation — close the gaps',         color: '#fbbf24' };
  if (pct >= 35) return { label: 'Building Signals',  sublabel: 'Signals need strengthening before pitching', color: '#fb923c' };
  return               { label: 'Early Stage',        sublabel: 'More signal data needed',                   color: '#f87171' };
}

// ── SVG Pentagon math ─────────────────────────────────────────────────────────

const CX = 100;
const CY = 100;
const RADIUS = 72;

function pentagonPoints(r: number): [number, number][] {
  return AXES.map((_, i) => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)] as [number, number];
  });
}

function toSvgPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function axisLabelPos(i: number): [number, number] {
  const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
  const r = RADIUS + 18;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

// ── Gauge arc ─────────────────────────────────────────────────────────────────

function gaugeArc(pct: number, r = 42, cx = 50, cy = 55): string {
  const start = { x: cx + r * Math.cos(Math.PI), y: cy + r * Math.sin(Math.PI) };
  const angle  = Math.PI + Math.PI * Math.min(pct / 100, 1);
  const end    = { x: cx + r * Math.cos(angle),  y: cy + r * Math.sin(angle) };
  const large  = pct > 50 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  signals: StartupContext['signals'] | null | undefined;
  loading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignalHealthHexagon({ signals, loading }: Props) {
  if (loading) {
    return (
      <section className="mt-8">
        <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
          Signal Health
        </div>
        <div className="border border-zinc-800 rounded-lg bg-zinc-900/20 p-6 flex items-center justify-center h-48">
          <div className="text-zinc-700 text-xs animate-pulse">Analyzing signals…</div>
        </div>
      </section>
    );
  }

  if (!signals) return null;

  const total    = signals.total ?? 0;
  const readiness = interpretReadiness(total);
  const pct       = Math.round((total / TOTAL_MAX) * 100);

  // Radar data points (each axis normalized 0–1 based on its max)
  const dataPoints: [number, number][] = AXES.map((ax, i) => {
    const raw = (signals[ax.key] as number) ?? 0;
    const norm = Math.min(raw / ax.max, 1);
    const r    = norm * RADIUS;
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
  });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <section className="mt-8">
      <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
        Signal Health
      </div>

      <div className="border border-zinc-800 rounded-lg bg-zinc-900/20 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60">

          {/* LEFT: Pentagon radar */}
          <div className="p-4 flex flex-col items-center">
            <svg viewBox="0 0 200 200" className="w-48 h-48 sm:w-56 sm:h-56" aria-label="Signal health radar">
              {/* Grid rings */}
              {gridLevels.map(level => (
                <polygon
                  key={level}
                  points={toSvgPoints(pentagonPoints(RADIUS * level))}
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="0.8"
                />
              ))}
              {/* Axis lines from center */}
              {pentagonPoints(RADIUS).map(([x, y], i) => (
                <line
                  key={i}
                  x1={CX} y1={CY}
                  x2={x.toFixed(2)} y2={y.toFixed(2)}
                  stroke="#27272a"
                  strokeWidth="0.8"
                />
              ))}
              {/* Data area */}
              <polygon
                points={toSvgPoints(dataPoints)}
                fill="rgba(6,182,212,0.10)"
                stroke="rgba(6,182,212,0.70)"
                strokeWidth="1.5"
              />
              {/* Data point dots */}
              {dataPoints.map(([x, y], i) => {
                const raw  = (signals[AXES[i].key] as number) ?? 0;
                const norm = raw / AXES[i].max;
                const color = norm >= 0.6 ? '#34d399' : norm >= 0.3 ? '#fbbf24' : '#f87171';
                return (
                  <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="3" fill={color} />
                );
              })}
              {/* Axis labels */}
              {AXES.map((ax, i) => {
                const [lx, ly] = axisLabelPos(i);
                const anchor = lx < CX - 5 ? 'end' : lx > CX + 5 ? 'start' : 'middle';
                return (
                  <text
                    key={i}
                    x={lx.toFixed(2)}
                    y={ly.toFixed(2)}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize="7"
                    fill="#71717a"
                  >
                    {ax.shortLabel}
                  </text>
                );
              })}
            </svg>

            {/* Axis breakdown table */}
            <div className="w-full space-y-1 mt-2">
              {AXES.map((ax) => {
                const raw  = (signals[ax.key] as number) ?? 0;
                const norm = Math.min(raw / ax.max, 1);
                const barColor = norm >= 0.6 ? 'bg-emerald-500' : norm >= 0.3 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={ax.key} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-20 shrink-0 truncate">{ax.shortLabel}</span>
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.round(norm * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 w-8 text-right tabular-nums">
                      {raw.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Readiness gauge + score */}
          <div className="p-6 flex flex-col items-center justify-center gap-4">
            {/* Gauge arc */}
            <div className="relative">
              <svg viewBox="0 0 100 62" className="w-44 h-28" aria-label="Fundraising readiness gauge">
                {/* Background arc */}
                <path
                  d={gaugeArc(100)}
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Value arc */}
                <path
                  d={gaugeArc(pct)}
                  fill="none"
                  stroke={readiness.color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                {/* Center text */}
                <text x="50" y="52" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">
                  {pct}
                </text>
                <text x="50" y="60" textAnchor="middle" fontSize="5" fill="#71717a">
                  / 100
                </text>
              </svg>
            </div>

            {/* Label */}
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: readiness.color }}>
                {readiness.label}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 max-w-[180px]">
                {readiness.sublabel}
              </div>
            </div>

            {/* Total score */}
            <div className="text-center">
              <span className="text-2xl font-bold tabular-nums" style={{ color: readiness.color }}>
                {total.toFixed(1)}
              </span>
              <span className="text-zinc-600 text-sm ml-1">/ {TOTAL_MAX}</span>
              <div className="text-[10px] text-zinc-600 mt-0.5">signal score</div>
            </div>

            {/* What it means */}
            <div className="text-[10px] text-zinc-600 text-center max-w-[200px] leading-relaxed">
              Signal score reflects how your language, news coverage, and execution patterns align with current investor behavior — not your fundamentals.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
