// ============================================================================
// Pythh Oracle — Predictions Page
// ============================================================================
// Shows the Oracle's predictions: fundraise probability, time-to-close,
// founder-market fit, narrative gaps, team gaps, and non-obvious signal
// detection. Powered by the intelligence engine.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  TrendingUp,
  Clock,
  Users,
  Target,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Zap,
  Lightbulb,
  Activity,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  analyzeFounderDNA,
  generatePredictions,
  detectNonObviousSignals,
  calculateVCAlignments,
  type OraclePrediction,
  type DetectedSignal,
} from '../../services/oracle/intelligenceEngine';
import { getSessionSteps } from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';
import { NON_OBVIOUS_SIGNALS } from '../../services/oracle/vcThesisKnowledge';

export default function OraclePredictionsPage() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [predictions, setPredictions] = useState<OraclePrediction[]>([]);
  const [signals, setSignals] = useState<DetectedSignal[]>([]);
  const [readinessScore, setReadinessScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) {
      setLoading(false);
      return;
    }
    loadPredictions(startupId);
  }, [startupId]);

  async function loadPredictions(sid: string) {
    try {
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

      const { data: signalData } = await supabase
        .from('startup_signal_scores')
        .select('signals_total')
        .eq('startup_id', sid)
        .single();
      const signalScore = signalData?.signals_total || 5.0;

      // Get wizard responses
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
      const vcAlignments = calculateVCAlignments(godScores, founderDNA);
      const preds = generatePredictions(founderDNA, godScores, signalScore, vcAlignments);
      const nonObvious = detectNonObviousSignals(founderDNA, wizardResponses);

      setPredictions(preds);
      setSignals(nonObvious);

      // Compute readiness
      const avgGOD = (godScores.team_score + godScores.traction_score + godScores.market_score + godScores.product_score + godScores.vision_score) / 5;
      const topAlignment = vcAlignments[0]?.alignment_score || 0;
      const dnaComposite = (founderDNA.hypothesis_clarity + founderDNA.motivation_score + founderDNA.timing_awareness +
        founderDNA.domain_depth + founderDNA.technical_capability + founderDNA.narrative_power) / 6;
      setReadinessScore(Math.round(avgGOD * 0.3 + (signalScore / 10) * 100 * 0.2 + topAlignment * 0.25 + (dnaComposite / 10) * 100 * 0.25));
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

  // No startup — show educational content about non-obvious signals
  if (!startupId && predictions.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-semibold text-white/90">Pythh Oracle</span>
              <span className="text-xs text-white/40">— Predictions</span>
            </div>
            <button onClick={() => navigate('/app/oracle')} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
              <ArrowLeft className="w-3 h-3" /> Back to Oracle
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300/80">
            Submit your startup to get personalized predictions. Below are the non-obvious signals the Oracle detects.
          </div>
          <h2 className="text-white/60 text-sm font-medium uppercase tracking-wide">Non-Obvious Signals We Detect</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(NON_OBVIOUS_SIGNALS).map((signal) => (
              <div key={signal.id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white/90">{signal.name}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{signal.description}</p>
                <p className="text-[10px] text-emerald-400/60">Weight: {Math.round(signal.weight_in_prediction * 100)}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const detectedSignals = signals.filter((s) => s.detected);
  const readinessLabel = readinessScore > 75 ? 'Investor Ready' : readinessScore > 55 ? 'Getting Close' : readinessScore > 35 ? 'Building Foundation' : 'Early Stage';
  const readinessColor = readinessScore > 75 ? 'text-emerald-400' : readinessScore > 55 ? 'text-amber-400' : readinessScore > 35 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold text-white/90">Pythh Oracle</span>
            <span className="text-xs text-white/40">— Predictions</span>
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
        {/* Readiness Hero */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 mx-auto flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fundraising Readiness</h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className={`text-4xl font-bold ${readinessColor}`}>{readinessScore}</span>
              <span className="text-white/40 text-lg">/100</span>
            </div>
            <p className={`text-sm mt-1 ${readinessColor}`}>{readinessLabel}</p>
          </div>
          {/* Progress bar */}
          <div className="max-w-md mx-auto">
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  readinessScore > 75 ? 'bg-emerald-500' : readinessScore > 55 ? 'bg-amber-500' : readinessScore > 35 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Predictions Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" /> Oracle Predictions
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {predictions.map((pred, i) => (
              <PredictionCard key={i} prediction={pred} />
            ))}
          </div>
        </div>

        {/* Non-Obvious Signals */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" /> Non-Obvious Signals
          </h2>
          <p className="text-white/40 text-sm">
            The Oracle detects subtle signals most founders and investors miss. These can be decisive in fundraising outcomes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {signals.map((s) => (
              <SignalCard key={s.signal_id} signal={s} />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
          <NavButton to={'/app/oracle/vc-strategy'} label="VC Strategy" icon={<Target className="w-4 h-4" />} navigate={navigate} />
          <NavButton to={'/app/oracle/coaching'} label="Coaching" icon={<Lightbulb className="w-4 h-4" />} navigate={navigate} />
          <NavButton to={'/app/oracle/actions'} label="Actions" icon={<Zap className="w-4 h-4" />} navigate={navigate} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function PredictionCard({ prediction }: { prediction: OraclePrediction }) {
  const [expanded, setExpanded] = useState(false);

  const typeIcon: Record<string, React.ReactNode> = {
    fundraise_probability: <TrendingUp className="w-5 h-5 text-emerald-400" />,
    time_to_close: <Clock className="w-5 h-5 text-blue-400" />,
    founder_market_fit: <Users className="w-5 h-5 text-purple-400" />,
    narrative_gap: <AlertTriangle className="w-5 h-5 text-red-400" />,
    team_gap: <AlertTriangle className="w-5 h-5 text-orange-400" />,
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{typeIcon[prediction.type] || <Activity className="w-5 h-5 text-amber-400" />}</div>
          <div>
            <h3 className="text-sm font-semibold text-white">{prediction.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${prediction.confidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-white/30">{Math.round(prediction.confidence * 100)}% confidence</span>
            </div>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60">
          {expanded ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      <p className="text-sm text-white/60 leading-relaxed">{prediction.body}</p>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          {/* Contributing signals */}
          <div>
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">Contributing Signals</h4>
            <div className="space-y-1">
              {prediction.signals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                  <Activity className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
          {/* Recommended actions */}
          <div>
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">Recommended Actions</h4>
            <div className="space-y-1">
              {prediction.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                  <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: DetectedSignal }) {
  const detected = signal.detected;
  const strengthPct = Math.round(signal.strength * 100);

  return (
    <div className={`p-4 rounded-xl border transition ${detected ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-white/[0.02] border-white/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={`text-xs font-semibold ${detected ? 'text-cyan-300' : 'text-white/30'}`}>
          {signal.signal_name}
        </h4>
        {detected ? (
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 text-white/20" />
        )}
      </div>
      {detected && (
        <>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${strengthPct}%` }} />
          </div>
          <p className="text-[11px] text-white/50 leading-relaxed">{signal.evidence}</p>
        </>
      )}
      {!detected && (
        <p className="text-[11px] text-white/20 leading-relaxed">{signal.evidence}</p>
      )}
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
