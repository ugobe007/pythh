// ============================================================================
// Pythh Oracle — VC Strategy Page
// ============================================================================
// Shows per-VC alignment scores, approach strategies, conviction triggers,
// deal breaker warnings, and tailored coaching for each target VC.
// Powered by the Oracle intelligence engine.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Target,
  AlertTriangle,
  CheckCircle2,
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
  Star,
  XCircle,
  Crosshair,
  Clock,
  MessageSquare,
  Lightbulb,
  Route,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  calculateVCAlignments,
  analyzeFounderDNA,
  type VCAlignmentResult,
} from '../../services/oracle/intelligenceEngine';
import { getSessionSteps } from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';
import { VC_THESIS_PROFILES } from '../../services/oracle/vcThesisKnowledge';

export default function OracleVCStrategyPage() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [alignments, setAlignments] = useState<VCAlignmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVC, setExpandedVC] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) {
      // Show VC profiles in read-only mode
      setLoading(false);
      return;
    }
    loadAlignments(startupId);
  }, [startupId]);

  async function loadAlignments(sid: string) {
    try {
      // Get GOD scores
      const { data: startup } = await supabase
        .from('startup_uploads')
        .select('team_score, traction_score, market_score, product_score, vision_score')
        .eq('id', sid)
        .single();

      const godScores = {
        team_score: startup?.team_score || 50,
        traction_score: startup?.traction_score || 50,
        market_score: startup?.market_score || 50,
        product_score: startup?.product_score || 50,
        vision_score: startup?.vision_score || 50,
      };

      // Get wizard responses to compute founder DNA
      const { data: sessions } = await supabase
        .from('oracle_sessions')
        .select('id')
        .eq('startup_id', sid)
        .order('created_at', { ascending: false })
        .limit(1);

      let wizardResponses: Record<string, Record<string, unknown>> = {};
      if (sessions && sessions.length > 0) {
        const steps = await getSessionSteps(sessions[0].id);
        for (const step of steps) {
          if (step.responses && Object.keys(step.responses).length > 0) {
            wizardResponses[step.step_key] = step.responses;
          }
        }
      }

      const founderDNA = analyzeFounderDNA(wizardResponses);
      const results = calculateVCAlignments(godScores, founderDNA);
      setAlignments(results);
      setExpandedVC(results[0]?.vc_id || null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-white/5 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate('/app/oracle')} className="text-white/60 hover:text-white underline text-sm">
            Back to Oracle
          </button>
        </div>
      </div>
    );
  }

  // No startup — show VC profiles in read-only educational mode
  if (alignments.length === 0 && !startupId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-semibold text-white/90">Pythh Oracle</span>
              <span className="text-xs text-white/40">— VC Thesis Profiles</span>
            </div>
            <button onClick={() => navigate('/app/oracle')} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
              <ArrowLeft className="w-3 h-3" /> Back to Oracle
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300/80">
            Submit your startup to see personalized VC alignment scores. Below is a preview of the VC thesis profiles the Oracle evaluates.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(VC_THESIS_PROFILES).map((vc) => (
              <div key={vc.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{vc.name}</h3>
                    <p className="text-xs text-white/40">{vc.focus_areas?.join(' • ') || 'Multi-sector'}</p>
                  </div>
                </div>
                {vc.thesis_summary && (
                  <p className="text-xs text-white/50 leading-relaxed">{vc.thesis_summary}</p>
                )}
                {vc.conviction_triggers && vc.conviction_triggers.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Conviction Triggers</p>
                    <div className="flex flex-wrap gap-1">
                      {vc.conviction_triggers.slice(0, 4).map((t: string) => (
                        <span key={t} className="text-[10px] bg-emerald-500/10 text-emerald-400/70 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold text-white/90">Pythh Oracle</span>
            <span className="text-xs text-white/40">— VC Strategy</span>
          </div>
          <button
            onClick={() => navigate('/app/oracle')}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 mx-auto flex items-center justify-center">
            <Crosshair className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold">VC Alignment Strategy</h1>
          <p className="text-white/50 text-sm max-w-xl mx-auto">
            The Oracle scores your alignment with top-tier VCs and builds a tailored approach strategy for each.
            Higher alignment means better odds — but the approach strategy matters just as much.
          </p>
        </div>

        {/* Alignment Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {alignments.map((a) => (
            <button
              key={a.vc_id}
              onClick={() => setExpandedVC(expandedVC === a.vc_id ? null : a.vc_id)}
              className={`
                p-4 rounded-xl border transition-all text-center
                ${expandedVC === a.vc_id
                  ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'}
              `}
            >
              <div className={`text-2xl font-bold ${getScoreColor(a.alignment_score)}`}>
                {a.alignment_score}%
              </div>
              <div className="text-xs text-white/60 mt-1 truncate">{a.vc_short_name}</div>
            </button>
          ))}
        </div>

        {/* Expanded VC Detail */}
        {alignments.map((a) => {
          if (a.vc_id !== expandedVC) return null;
          return <VCDetailCard key={a.vc_id} alignment={a} />;
        })}

        {/* Navigation to other Oracle pages */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
          <NavButton to={'/app/oracle/predictions'} label="Predictions" icon={<TrendingUp className="w-4 h-4" />} navigate={navigate} />
          <NavButton to={'/app/oracle/coaching'} label="Coaching" icon={<Lightbulb className="w-4 h-4" />} navigate={navigate} />
          <NavButton to={'/app/oracle/actions'} label="Actions" icon={<Zap className="w-4 h-4" />} navigate={navigate} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VC Detail Card
// ---------------------------------------------------------------------------

function VCDetailCard({ alignment }: { alignment: VCAlignmentResult }) {
  const a = alignment;
  const hasBreakers = a.deal_breakers_flagged.length > 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{a.vc_name}</h2>
            <p className="text-white/40 text-sm mt-1">
              Alignment Score: <span className={`font-bold ${getScoreColor(a.alignment_score)}`}>{a.alignment_score}%</span>
            </p>
          </div>
          <AlignmentGauge score={a.alignment_score} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {/* Left: Strengths & Gaps */}
        <div className="p-6 space-y-6">
          {/* Strengths */}
          <div>
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" /> Your Strengths for {a.vc_short_name}
            </h3>
            <div className="space-y-2">
              {a.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <Star className="w-3 h-3 text-emerald-400 mt-1 flex-shrink-0" />
                  {s}
                </div>
              ))}
              {a.strengths.length === 0 && (
                <p className="text-white/30 text-sm">Complete more wizard steps to reveal strengths.</p>
              )}
            </div>
          </div>

          {/* Gaps */}
          <div>
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" /> Gaps to Address
            </h3>
            <div className="space-y-2">
              {a.gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <AlertTriangle className="w-3 h-3 text-amber-400 mt-1 flex-shrink-0" />
                  {g}
                </div>
              ))}
              {a.gaps.length === 0 && (
                <p className="text-emerald-400/60 text-sm">No significant gaps detected.</p>
              )}
            </div>
          </div>

          {/* Conviction Triggers Met */}
          {a.conviction_triggers_met.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" /> Conviction Triggers Met
              </h3>
              <div className="flex flex-wrap gap-2">
                {a.conviction_triggers_met.map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-xs text-cyan-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Deal Breakers */}
          {hasBreakers && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4" /> Deal Breaker Warnings
              </h3>
              <div className="space-y-2">
                {a.deal_breakers_flagged.map((b, i) => (
                  <p key={i} className="text-sm text-red-300/80">{b}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Approach Strategy */}
        <div className="p-6 space-y-6">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Route className="w-4 h-4 text-amber-400" /> Approach Playbook
          </h3>

          {/* Best Paths */}
          <StrategySection
            icon={<Target className="w-4 h-4 text-purple-400" />}
            title="Best Introduction Paths"
            items={a.approach_strategy.best_paths}
          />

          {/* Pitch Style */}
          <StrategyItem
            icon={<MessageSquare className="w-4 h-4 text-blue-400" />}
            title="Pitch Style"
            content={a.approach_strategy.pitch_style}
          />

          {/* Meeting Style */}
          <StrategyItem
            icon={<Lightbulb className="w-4 h-4 text-amber-400" />}
            title="Meeting Style"
            content={a.approach_strategy.meeting_notes}
          />

          {/* Decision Speed */}
          <StrategyItem
            icon={<Clock className="w-4 h-4 text-cyan-400" />}
            title="Decision Speed"
            content={a.approach_strategy.decision_speed}
          />

          {/* Timing */}
          <StrategyItem
            icon={<Shield className="w-4 h-4 text-emerald-400" />}
            title="Timing Intel"
            content={a.approach_strategy.timing}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function AlignmentGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 24;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle
          cx="28" cy="28" r="24" fill="none"
          stroke={score > 70 ? '#10b981' : score > 50 ? '#f59e0b' : score > 30 ? '#f97316' : '#ef4444'}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
      </div>
    </div>
  );
}

function StrategySection({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wide">{title}</h4>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-white/60">
            <ArrowRight className="w-3 h-3 text-white/30 mt-1 flex-shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyItem({ icon, title, content }: { icon: React.ReactNode; title: string; content: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wide">{title}</h4>
      </div>
      <p className="text-sm text-white/60 ml-6">{content}</p>
    </div>
  );
}

function NavButton({ to, label, icon, navigate }: { to: string; label: string; icon: React.ReactNode; navigate: (to: string) => void }) {
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white transition"
    >
      {icon} {label}
    </button>
  );
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}
