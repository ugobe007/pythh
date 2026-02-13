// ============================================================================
// Pythh — Pitch Signal Scan
// ============================================================================
// 5-dimension signal analysis — pure inline text, Supabase style.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../hooks/useBilling';

/* ──────────────────────────── Types ──────────────────────────── */

interface DimensionScore {
  key: string;
  label: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  color: string;
  insight: string;
  signals: { label: string; strength: 'strong' | 'moderate' | 'weak' | 'missing' }[];
  actions: string[];
}

interface ScanResult {
  overall_score: number;
  overall_grade: string;
  dimensions: DimensionScore[];
  investor_perception: string;
  top_strength: string;
  biggest_gap: string;
  estimated_lift: string;
}

/* ──────────────────────────── Mock analysis ──────────────────────────── */

function runSignalScan(): ScanResult {
  const dimensions: DimensionScore[] = [
    {
      key: 'narrative',
      label: 'Narrative Coherence',
      score: 72,
      grade: 'B',
      color: 'text-violet-400',
      insight: 'Your story has strong elements but the problem-solution bridge needs tightening. Investors need to see the "aha" within 30 seconds.',
      signals: [
        { label: 'Problem clarity', strength: 'strong' },
        { label: 'Solution framing', strength: 'moderate' },
        { label: 'Why now narrative', strength: 'strong' },
        { label: 'Founder-market fit story', strength: 'weak' },
        { label: 'Competitive positioning', strength: 'moderate' },
      ],
      actions: [
        'Lead with the specific pain point your biggest customer articulated — use their words',
        'Add a "before vs after" frame that makes the ROI undeniable in one slide',
        'Strengthen founder-market fit — why YOU are inevitable for THIS problem',
      ],
    },
    {
      key: 'obsession',
      label: 'Obsession Density',
      score: 85,
      grade: 'A',
      color: 'text-cyan-400',
      insight: 'High signal of deep domain focus. Your iteration velocity and depth of understanding read clearly. This is a key strength — lean into it heavily.',
      signals: [
        { label: 'Domain depth indicators', strength: 'strong' },
        { label: 'Iteration velocity', strength: 'strong' },
        { label: 'Customer intimacy evidence', strength: 'strong' },
        { label: 'Technical depth signals', strength: 'moderate' },
        { label: 'Competitive awareness', strength: 'strong' },
      ],
      actions: [
        'Surface your iteration history — show 3 pivots that each made the product sharper',
        'Include a customer story that shows you understand their workflow better than they do',
      ],
    },
    {
      key: 'conviction',
      label: 'Conviction-Evidence Ratio',
      score: 58,
      grade: 'C',
      color: 'text-amber-400',
      insight: "Gap between claims and proof. You're making strong assertions about market size and growth potential but the evidence trail is thin. Investors will probe here.",
      signals: [
        { label: 'Revenue claims backed by data', strength: 'moderate' },
        { label: 'Market size substantiation', strength: 'weak' },
        { label: 'Growth trajectory proof', strength: 'moderate' },
        { label: 'Customer testimonials', strength: 'missing' },
        { label: 'Competitive win evidence', strength: 'weak' },
      ],
      actions: [
        'Add 2-3 named customer quotes (anonymized if needed) showing real outcomes',
        'Replace TAM/SAM/SOM with bottom-up market sizing from your actual data',
        'Show a cohort analysis that proves retention, not just acquisition',
        'Include a specific competitive win story — name the competitor, show why you won',
      ],
    },
    {
      key: 'fragility',
      label: 'Fragility Index',
      score: 64,
      grade: 'C',
      color: 'text-red-400',
      insight: 'Moderate fragility detected. Key concern areas: single-channel dependency for growth and unclear path from current traction to Series A metrics.',
      signals: [
        { label: 'Key person dependency', strength: 'moderate' },
        { label: 'Revenue concentration risk', strength: 'weak' },
        { label: 'Growth channel diversity', strength: 'weak' },
        { label: 'Burn sustainability', strength: 'moderate' },
        { label: 'Regulatory risk exposure', strength: 'strong' },
      ],
      actions: [
        'Address the "what if your top channel dies" question proactively in your deck',
        'Show diversity of revenue sources or a credible plan for channel expansion',
        'Frame burn rate as investment, not cost — show what each $100K buys in metric improvement',
      ],
    },
    {
      key: 'trajectory',
      label: 'Trajectory Momentum',
      score: 78,
      grade: 'B',
      color: 'text-emerald-400',
      insight: "Good momentum signals. Growth rate is above median for your stage, and press/social signals are building. The key is converting momentum into FOMO — make investors feel they're late.",
      signals: [
        { label: 'MoM growth rate', strength: 'strong' },
        { label: 'Press/social momentum', strength: 'moderate' },
        { label: 'Hiring velocity', strength: 'moderate' },
        { label: 'Partnership signals', strength: 'strong' },
        { label: 'Inbound investor interest', strength: 'moderate' },
      ],
      actions: [
        'Create a "momentum page" — a live dashboard showing key metrics growing in real-time',
        'Reference recent press or social traction in your first sentence to any investor',
        "Use phrases like 'we are seeing acceleration' with specific numbers to back it up",
      ],
    },
  ];

  const avgScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
  const best = dimensions.reduce((a, b) => a.score > b.score ? a : b);
  const worst = dimensions.reduce((a, b) => a.score < b.score ? a : b);

  return {
    overall_score: avgScore,
    overall_grade: avgScore >= 80 ? 'A' : avgScore >= 65 ? 'B' : avgScore >= 50 ? 'C' : 'D',
    dimensions,
    investor_perception: 'Investors will see a company with strong domain conviction and building momentum, but will probe on the evidence gap between narrative claims and hard data. The fundraise is winnable if you close the conviction-evidence gap before meetings.',
    top_strength: best.label,
    biggest_gap: worst.label,
    estimated_lift: '+18% close rate with recommended improvements',
  };
}

/* ──────────────────────────── Component ──────────────────────────── */

export default function PitchSignalScan() {
  const { user } = useAuth();
  const { plan } = useBilling();

  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isLocked = !plan || plan === 'free';

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(runSignalScan());
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-emerald-400' : score >= 65 ? 'text-cyan-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';

  const strengthColor = (s: string) =>
    s === 'strong' ? 'text-emerald-400' : s === 'moderate' ? 'text-amber-400' : s === 'weak' ? 'text-red-400/70' : 'text-zinc-500';

  return (
    <div>

        {/* Intro */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-3xl">
          Your pitch generates <span className="text-cyan-400">signals</span> that investors read before they read your deck.
          This scan measures five dimensions of signal strength — where you are credible, where you are exposed,
          and exactly what to fix. Click any dimension to see the breakdown.
        </p>

        {loading ? (
          <div className="text-sm text-zinc-500 py-12">Scanning your signal surface...</div>
        ) : result ? (
          <div className="space-y-8">

            {/* Overall score line */}
            <div className="flex items-center gap-6 text-sm border-b border-zinc-800/50 pb-6">
              <div>
                <span className={`text-3xl font-bold font-mono ${scoreColor(result.overall_score)}`}>{result.overall_score}</span>
                <span className="text-zinc-500 ml-2 text-xs">/ 100</span>
              </div>
              <div className="text-zinc-600">·</div>
              <div>
                <span className="text-zinc-500 text-xs">Best:</span>
                <span className="text-emerald-400 ml-1 text-xs">{result.top_strength}</span>
              </div>
              <div className="text-zinc-600">·</div>
              <div>
                <span className="text-zinc-500 text-xs">Gap:</span>
                <span className="text-red-400 ml-1 text-xs">{result.biggest_gap}</span>
              </div>
              <div className="text-zinc-600">·</div>
              <div>
                <span className="text-cyan-400 text-xs">{result.estimated_lift}</span>
              </div>
            </div>

            {/* Investor perception */}
            <p className="text-sm text-zinc-400 leading-relaxed">
              {result.investor_perception}
            </p>

            {/* Dimensions header */}
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">5 Signal Dimensions</div>

            {/* Dimension table header */}
            <div className="hidden sm:grid grid-cols-[1fr_60px_40px] gap-2 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
              <span>Dimension</span>
              <span className="text-right">Score</span>
              <span className="text-right">Grade</span>
            </div>

            {/* Dimensions */}
            {result.dimensions.map((dim, idx) => {
              const isOpen = expanded === dim.key;
              const isBlurred = isLocked && idx >= 2;

              return (
                <div key={dim.key} className={isBlurred ? 'relative' : ''}>
                  {isBlurred && (
                    <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex items-center justify-center">
                      <span className="text-xs text-zinc-500">
                        <Link to="/pricing?source=pitch-scan" className="text-cyan-400 hover:text-cyan-300">Upgrade</Link> to see full analysis
                      </span>
                    </div>
                  )}

                  {/* Row */}
                  <div
                    onClick={() => !isBlurred && setExpanded(isOpen ? null : dim.key)}
                    className="grid grid-cols-[1fr_60px_40px] gap-2 px-2 py-3 items-center border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-900/40 transition text-sm"
                  >
                    <span className={`font-medium ${dim.color}`}>{dim.label}</span>
                    <span className={`text-right font-mono text-xs ${scoreColor(dim.score)}`}>{dim.score}</span>
                    <span className={`text-right font-mono text-xs ${scoreColor(dim.score)}`}>{dim.grade}</span>
                  </div>

                  {/* Expanded */}
                  {isOpen && !isBlurred && (
                    <div className="px-2 py-4 border-b border-zinc-800/30 bg-zinc-900/20 space-y-4 text-sm">
                      <p className="text-zinc-400 leading-relaxed">{dim.insight}</p>

                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Signal breakdown</span>
                        <div className="mt-2 space-y-1.5">
                          {dim.signals.map((sig, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <span className="text-zinc-400 flex-1">{sig.label}</span>
                              <span className={`text-xs font-mono ${strengthColor(sig.strength)}`}>
                                {sig.strength}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">What to do</span>
                        <div className="mt-2 space-y-1.5">
                          {dim.actions.map((action, i) => (
                            <p key={i} className="text-zinc-400">
                              <span className="text-cyan-400 mr-2">{'\u2192'}</span>{action}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-xs text-zinc-600 mt-6 text-center">
              Signal analysis based on your pitch surface · Re-scan after changes to track improvement
            </p>
          </div>
        ) : null}
    </div>
  );
}
