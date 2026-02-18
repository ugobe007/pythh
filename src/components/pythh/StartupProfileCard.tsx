// ============================================================================
// StartupProfileCard — The startup's identity at a glance
// ============================================================================
// Replaces the thin "name · sector · signal" line with a proper profile card
// showing the startup's name, tagline, description, GOD score, signal score,
// percentile, sectors, stage, and website link.
//
// All data sourced from StartupContext (get_startup_context RPC).
// ============================================================================

import type { StartupContext } from '@/lib/pythh-types';

// Stage label mapping
const STAGE_LABELS: Record<number, string> = {
  1: 'Pre-Seed',
  2: 'Seed',
  3: 'Series A',
  4: 'Series B',
  5: 'Series C+',
};

// GOD score color thresholds
function godScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 65) return 'text-cyan-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-zinc-400';
}

function godScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 65) return 'stroke-cyan-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-zinc-500';
}

// Circular progress ring (GOD Score)
function ScoreRing({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 100, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${godScoreRingColor(score)} transition-all duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold ${godScoreColor(score)}`}>{score}</span>
        <span className="text-[9px] text-zinc-500 -mt-0.5">GOD</span>
      </div>
    </div>
  );
}

// Mini GOD component bar (inline)
function GODBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-12 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-500 font-mono w-5 text-right">{value}</span>
    </div>
  );
}

// Percentile badge
function PercentileBadge({ percentile }: { percentile: number }) {
  let color = 'bg-zinc-800 text-zinc-400';
  let label = `${percentile}th percentile`;
  if (percentile >= 90) {
    color = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    label = `Top ${100 - percentile}%`;
  } else if (percentile >= 75) {
    color = 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
    label = `Top ${100 - percentile}%`;
  } else if (percentile >= 50) {
    color = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
      {label}
    </span>
  );
}

// External link icon
function ExternalLinkIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface StartupProfileCardProps {
  context: StartupContext | null;
  displayName: string;
  loading?: boolean;
  unlockedCount: number;
  totalMatches: number;
}

export default function StartupProfileCard({
  context,
  displayName,
  loading = false,
  unlockedCount,
  totalMatches,
}: StartupProfileCardProps) {
  // Show skeleton while loading
  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-6 mb-8 animate-pulse">
        <div className="flex items-start gap-6">
          <div className="w-[72px] h-[72px] rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-3">
            <div className="h-6 bg-zinc-800 rounded w-48" />
            <div className="h-4 bg-zinc-800/60 rounded w-72" />
            <div className="h-3 bg-zinc-800/40 rounded w-96" />
          </div>
        </div>
      </div>
    );
  }

  // If no context after loading, show error/fallback with basic info
  if (!context) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Placeholder GOD Score Ring */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <ScoreRing score={50} />
            <span className="text-[10px] text-zinc-500">Loading...</span>
          </div>

          {/* Basic Identity */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{displayName}</h2>
            <p className="text-sm text-zinc-500 mt-2">Profile data loading...</p>
            <p className="text-xs text-zinc-600 mt-1">If this persists, the startup may not be in our database yet.</p>
          </div>

          {/* Basic Stats */}
          <div className="flex-shrink-0 w-full sm:w-56">
            <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Matches</p>
              <p className="text-lg font-semibold text-zinc-300">{totalMatches}</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">{unlockedCount} unlocked</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const startup = context.startup;
  const god = context.god;
  const signals = context.signals;
  const comparison = context.comparison;

  const name = startup?.name || displayName;
  const tagline = startup?.tagline;
  const description = startup?.description;
  const website = startup?.website;
  const stage = startup?.stage;
  const sectors = startup?.sectors || comparison?.sectors || [];
  const percentile = comparison?.percentile;
  const extractedData = startup?.extracted_data;

  // Build comprehensive business summary from available sources
  const businessSummary = description || 
    extractedData?.description ||
    extractedData?.value_proposition || 
    extractedData?.product_description ||
    (extractedData?.problem && extractedData?.solution 
      ? `${extractedData.problem} ${extractedData.solution}` 
      : null) ||
    (tagline && tagline !== `Startup at ${website?.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')}` 
      ? tagline 
      : null);

  // Get execution signals for fallback display
  const executionSignals = extractedData?.execution_signals || [];
  const customerCount = extractedData?.customer_count;
  
  // Debug log
  console.log('[StartupProfileCard] Debug:', {
    name,
    businessSummary,
    executionSignals,
    customerCount,
    tagline,
    website
  });
  
  // Build fallback description from traction/execution if no narrative available
  const fallbackSummary = !businessSummary && (executionSignals.length > 0 || customerCount)
    ? (() => {
        const parts: string[] = [];
        if (customerCount) parts.push(`${customerCount}+ customers`);
        if (executionSignals.some((s: string) => s.toLowerCase().includes('revenue'))) {
          parts.push('generating revenue');
        }
        if (executionSignals.some((s: string) => s.toLowerCase().includes('demo'))) {
          parts.push('live product demo');
        }
        const sectorName = sectors[0] || 'Startup';
        return parts.length > 0 
          ? `${sectorName} company with ${parts.join(', ')}.`
          : null;
      })()
    : null;

  // Extract traction metrics if available
  const traction = extractedData
    ? {
        revenue: extractedData.revenue || extractedData.arr || extractedData.mrr,
        users: extractedData.active_users || extractedData.customers,
        growth: extractedData.growth_rate,
      }
    : null;

  // Clean website for display
  const websiteDisplay = website
    ? website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
    : null;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT: GOD Score Ring */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <ScoreRing score={god.total} />
          {percentile !== undefined && percentile !== null && (
            <PercentileBadge percentile={percentile} />
          )}
        </div>

        {/* MIDDLE: Identity + Description */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + Website */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white truncate">{name}</h2>
                {websiteDisplay && (
                  <a
                    href={website!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
                  >
                    {websiteDisplay}
                    <ExternalLinkIcon />
                  </a>
                )}
              </div>

              {/* Tagline - only if distinct from description */}
              {tagline && tagline !== businessSummary && tagline !== `Startup at ${websiteDisplay}` && (
                <p className="text-xs text-cyan-400/80 mt-0.5 font-medium line-clamp-1">{tagline}</p>
              )}
            </div>
          </div>

          {/* Business Summary - show whichever is available */}
          {(businessSummary || fallbackSummary) && (
            <div className="bg-zinc-800/30 rounded-lg p-2.5">
              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">
                {businessSummary || fallbackSummary}
              </p>
              {!businessSummary && fallbackSummary && (
                <p className="text-[10px] text-zinc-500 mt-1 italic">
                  Limited description available
                </p>
              )}
            </div>
          )}

          {/* Metadata row: Stage + Sectors */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {stage && STAGE_LABELS[stage] && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-cyan-500/10 text-[10px] text-cyan-400 font-medium border border-cyan-500/20">
                {STAGE_LABELS[stage]}
              </span>
            )}
            {sectors.slice(0, 3).map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-800/80 text-[10px] text-zinc-300 font-medium"
              >
                {s}
              </span>
            ))}
            {sectors.length > 3 && (
              <span className="text-[10px] text-zinc-500">+{sectors.length - 3}</span>
            )}
          </div>

          {/* Traction metrics if available */}
          {traction && (traction.revenue || traction.users || traction.growth) && (
            <div className="flex items-center gap-3 text-[10px]">
              {traction.revenue && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Revenue:</span>
                  <span className="text-zinc-300 font-semibold">
                    {typeof traction.revenue === 'number' && traction.revenue >= 1000000
                      ? `$${(traction.revenue / 1000000).toFixed(1)}M`
                      : typeof traction.revenue === 'number'
                      ? `$${(traction.revenue / 1000).toFixed(0)}K`
                      : traction.revenue}
                  </span>
                </div>
              )}
              {traction.users && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Users:</span>
                  <span className="text-zinc-300 font-semibold">
                    {typeof traction.users === 'number' && traction.users >= 1000000
                      ? `${(traction.users / 1000000).toFixed(1)}M`
                      : typeof traction.users === 'number' && traction.users >= 1000
                      ? `${(traction.users / 1000).toFixed(0)}K`
                      : traction.users}
                  </span>
                </div>
              )}
              {traction.growth && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Growth:</span>
                  <span className="text-emerald-400 font-semibold">
                    {typeof traction.growth === 'number' 
                      ? `${(traction.growth * 100).toFixed(0)}%`
                      : traction.growth}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Stats + GOD Breakdown */}
        <div className="flex-shrink-0 w-full lg:w-64 space-y-3">
          {/* Signal Score + Matches */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-800/40 rounded-lg px-3 py-2">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Signal Score</p>
              <p className="text-2xl font-bold text-white">{signals.total.toFixed(1)}</p>
              <p className="text-[9px] text-zinc-500">/10</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg px-3 py-2">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">Matches</p>
              <p className="text-2xl font-bold text-white">{totalMatches}</p>
              <p className="text-[9px] text-emerald-400">{unlockedCount} unlocked</p>
            </div>
          </div>

          {/* GOD Breakdown - Compact */}
          <div className="bg-zinc-800/20 rounded-lg px-3 py-2 space-y-1.5">
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">GOD Breakdown</p>
            <GODBar label="Team" value={god.team} max={25} color="bg-blue-500" />
            <GODBar label="Traction" value={god.traction} max={25} color="bg-emerald-500" />
            <GODBar label="Market" value={god.market} max={20} color="bg-purple-500" />
            <GODBar label="Product" value={god.product} max={15} color="bg-amber-500" />
            <GODBar label="Vision" value={god.vision} max={15} color="bg-cyan-500" />
          </div>

          {/* Industry Comparison - Compact */}
          {comparison && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">vs industry avg</span>
              <span className="text-zinc-300 font-semibold">{comparison.industry_avg}</span>
              <span className="text-zinc-500">top quartile</span>
              <span className="text-zinc-300 font-semibold">{comparison.top_quartile}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
