// ============================================================================
// Pythh Oracle — Dashboard (Hub Page)
// ============================================================================
// The main Oracle landing page showing:
//   - Current signal score + progress
//   - Wizard status / resume
//   - Active signal actions (tasks)
//   - AI insights
//   - Cohort status
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  ArrowRight,
  Zap,
  Target,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Activity,
  Shield,
  Lightbulb,
  Flame,
  BarChart3,
  Brain,
  Compass,
  BookOpen,
} from 'lucide-react';
import {
  getOracleDashboard,
  updateActionStatus,
  type OracleDashboard,
  type OracleAction,
  type OracleInsight,
  ORACLE_STEPS,
} from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

export default function OracleDashboardPage() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [dashboard, setDashboard] = useState<OracleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) {
      // No startup — show exploration landing (not an error)
      setLoading(false);
      return;
    }
    getOracleDashboard(startupId)
      .then(setDashboard)
      .catch((e) => {
        console.warn('Oracle dashboard load failed, showing landing:', e.message);
        // Don't set error — show landing instead
      })
      .finally(() => setLoading(false));
  }, [startupId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // No startup or failed to load → show the Oracle landing / exploration mode
  if (!dashboard) {
    return <OracleLanding navigate={navigate} />;
  }

  const hasSession = !!dashboard.session;
  const sessionComplete = dashboard.session?.status === 'completed';
  const wizardProgress = dashboard.session?.steps
    ? Math.round(
        (dashboard.session.steps.filter((s) => s.status === 'completed').length / ORACLE_STEPS.length) * 100,
      )
    : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Pythh Oracle</h1>
                <p className="text-xs text-white/40">Signal coaching & investor alignment</p>
              </div>
            </div>
            <SignalScoreBadge score={dashboard.signal_score} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Signal Score Hero */}
        <SignalScoreHero score={dashboard.signal_score} />

        {/* Wizard CTA */}
        <WizardCard
          hasSession={hasSession}
          sessionComplete={sessionComplete}
          wizardProgress={wizardProgress}
          currentStep={dashboard.session?.current_step || 1}
          startupId={startupId || ''}
          navigate={navigate}
        />

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Signal Actions */}
          <ActionsCard
            actions={dashboard.actions}
            startupId={startupId || ''}
            onUpdate={async (id, status) => {
              await updateActionStatus(id, status);
              if (startupId) {
                const updated = await getOracleDashboard(startupId);
                setDashboard(updated);
              }
            }}
          />

          {/* AI Insights */}
          <InsightsCard insights={dashboard.insights} />
        </div>

        {/* Cohort */}
        {dashboard.cohort && <CohortCard cohort={dashboard.cohort} startupId={startupId || ''} />}

        {/* No cohort — join CTA */}
        {!dashboard.cohort && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Join a Cohort</h3>
                  <p className="text-white/40 text-sm">
                    Work alongside founders at your stage. Weekly coaching, peer accountability, signal amplification.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/app/oracle/cohorts')}
                className="flex items-center gap-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 px-4 py-2 rounded-xl text-sm transition"
              >
                Browse Cohorts
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Deep Oracle Intelligence */}
        <DeepOracleCards navigate={navigate} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function SignalScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-amber-400' : score >= 4 ? 'text-orange-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-2">
      <Activity className={`w-4 h-4 ${color}`} />
      <span className={`text-lg font-bold ${color}`}>{score.toFixed(1)}</span>
      <span className="text-xs text-white/40">/10</span>
    </div>
  );
}

function SignalScoreHero({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const label =
    score >= 8 ? 'Strong Signals' : score >= 6 ? 'Emerging Signals' : score >= 4 ? 'Building' : 'Needs Work';
  const color =
    score >= 8 ? 'from-emerald-500 to-emerald-400' : score >= 6 ? 'from-amber-500 to-amber-400' : score >= 4 ? 'from-orange-500 to-orange-400' : 'from-red-500 to-red-400';

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white/60 text-sm font-medium">Your Signal Score</h2>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-bold text-white">{score.toFixed(1)}</span>
            <span className="text-white/40 text-sm">/10 — {label}</span>
          </div>
        </div>
        <div className="w-16 h-16 rounded-full border-4 border-white/10 flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-amber-400" />
        </div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className={`h-2 rounded-full bg-gradient-to-r ${color} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-white/40">
        Complete the Oracle wizard and action items to boost your signals. Higher signal scores = better investor matches.
      </p>
    </div>
  );
}

function WizardCard({
  hasSession,
  sessionComplete,
  wizardProgress,
  currentStep,
  startupId,
  navigate,
}: {
  hasSession: boolean;
  sessionComplete: boolean;
  wizardProgress: number;
  currentStep: number;
  startupId: string;
  navigate: (path: string) => void;
}) {
  if (sessionComplete) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <div>
              <h3 className="text-emerald-300 font-semibold">Wizard Complete</h3>
              <p className="text-emerald-400/60 text-sm">
                All 6 steps done. Focus on your action items below to keep boosting signals.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/oracle/wizard')}
            className="text-emerald-400/60 hover:text-emerald-300 text-xs underline"
          >
            Review answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Flame className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">
              {hasSession ? `Continue Wizard — Step ${currentStep} of 6` : 'Start the Signal Wizard'}
            </h3>
            <p className="text-white/50 text-sm">
              {hasSession
                ? `${wizardProgress}% complete. Pick up where you left off.`
                : '6 guided steps to fine-tune your signals and align with investor needs.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/app/oracle/wizard')}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-3 rounded-xl transition text-sm"
        >
          {hasSession ? 'Continue' : 'Start Wizard'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {hasSession && (
        <div className="mt-4 w-full bg-white/10 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-amber-500 transition-all"
            style={{ width: `${wizardProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ActionsCard({
  actions,
  startupId,
  onUpdate,
}: {
  actions: OracleAction[];
  startupId: string;
  onUpdate: (id: string, status: 'in_progress' | 'completed' | 'dismissed') => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  const handleUpdate = async (id: string, status: 'in_progress' | 'completed' | 'dismissed') => {
    setUpdating(id);
    try {
      await onUpdate(id, status);
    } finally {
      setUpdating(null);
    }
  };

  const priorityIcon = (p: string) => {
    switch (p) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high': return <Zap className="w-4 h-4 text-orange-400" />;
      case 'medium': return <Target className="w-4 h-4 text-amber-400" />;
      default: return <Circle className="w-4 h-4 text-white/30" />;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          Signal Actions
        </h3>
        <span className="text-xs text-white/40">{actions.length} pending</span>
      </div>

      {actions.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">
          Complete the wizard to get personalized action items.
        </p>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {priorityIcon(action.priority)}
                  <div>
                    <p className="text-sm font-medium text-white/90">{action.title}</p>
                    {action.estimated_lift > 0 && (
                      <span className="text-xs text-emerald-400/70">
                        +{action.estimated_lift.toFixed(1)} signal lift
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {updating === action.id ? (
                    <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleUpdate(action.id, 'completed')}
                        className="p-1.5 rounded-lg hover:bg-emerald-500/20 transition"
                        title="Mark complete"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400/60 hover:text-emerald-400" />
                      </button>
                      <button
                        onClick={() => handleUpdate(action.id, 'dismissed')}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition"
                        title="Dismiss"
                      >
                        <span className="text-white/30 hover:text-white/60 text-xs">✕</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsCard({ insights }: { insights: OracleInsight[] }) {
  const severityIcon = (s: string) => {
    switch (s) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'positive': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      default: return <Lightbulb className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-blue-400" />
        Oracle Insights
      </h3>

      {insights.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">
          Insights will appear as you progress through the wizard and complete actions.
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                {severityIcon(insight.severity)}
                <div>
                  <p className="text-sm font-medium text-white/90">{insight.title}</p>
                  <p className="text-xs text-white/50 mt-1 line-clamp-2">{insight.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CohortCard({
  cohort,
  startupId,
}: {
  cohort: NonNullable<OracleDashboard['cohort']>;
  startupId: string;
}) {
  const signalDelta =
    cohort.signal_current != null && cohort.signal_at_join != null
      ? cohort.signal_current - cohort.signal_at_join
      : null;

  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          Your Cohort: {cohort.name}
        </h3>
        <span className="text-xs text-purple-400/60">
          Week {cohort.week} of {cohort.total_weeks}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{cohort.member_count}</p>
          <p className="text-xs text-white/40">Members</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{cohort.my_progress}%</p>
          <p className="text-xs text-white/40">Your Progress</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className={`text-2xl font-bold ${signalDelta && signalDelta > 0 ? 'text-emerald-400' : 'text-white'}`}>
            {signalDelta != null ? `${signalDelta > 0 ? '+' : ''}${signalDelta.toFixed(1)}` : '—'}
          </p>
          <p className="text-xs text-white/40">Signal Change</p>
        </div>
      </div>

      <Link
        to={`/app/oracle/cohort?cohort=${cohort.cohort_id}`}
        className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm transition"
      >
        View cohort details
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deep Oracle Cards — reusable navigation grid
// ---------------------------------------------------------------------------

function DeepOracleCards({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-white/60 text-sm font-medium uppercase tracking-wide">Deep Oracle Intelligence</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/app/oracle/vc-strategy')}
          className="bg-white/5 border border-white/10 hover:bg-white/[0.08] rounded-2xl p-5 text-left transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">VC Strategy</h3>
          <p className="text-white/40 text-xs mt-1 leading-relaxed">
            Per-VC alignment scores, approach playbooks, conviction triggers, and deal breaker warnings.
          </p>
          <div className="flex items-center gap-1 mt-3 text-cyan-400 text-xs group-hover:translate-x-1 transition-transform">
            Explore <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        <button
          onClick={() => navigate('/app/oracle/predictions')}
          className="bg-white/5 border border-white/10 hover:bg-white/[0.08] rounded-2xl p-5 text-left transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">Predictions</h3>
          <p className="text-white/40 text-xs mt-1 leading-relaxed">
            Fundraise probability, time-to-close, founder-market fit, and non-obvious signal detection.
          </p>
          <div className="flex items-center gap-1 mt-3 text-emerald-400 text-xs group-hover:translate-x-1 transition-transform">
            Explore <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        <button
          onClick={() => navigate('/app/oracle/coaching')}
          className="bg-white/5 border border-white/10 hover:bg-white/[0.08] rounded-2xl p-5 text-left transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-white font-semibold text-sm">Coaching</h3>
          <p className="text-white/40 text-xs mt-1 leading-relaxed">
            Founder DNA analysis, archetype-specific coaching, and the hard questions great advisors ask.
          </p>
          <div className="flex items-center gap-1 mt-3 text-amber-400 text-xs group-hover:translate-x-1 transition-transform">
            Explore <ArrowRight className="w-3 h-3" />
          </div>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Oracle Landing — shown when no startup is connected
// ---------------------------------------------------------------------------

function OracleLanding({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Pythh Oracle</h1>
              <p className="text-xs text-white/40">Signal coaching & investor alignment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome Hero */}
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to the Oracle</h2>
          <p className="text-white/60 max-w-lg mx-auto leading-relaxed">
            The Oracle is your signal coaching engine. It analyzes your startup, aligns you with
            the right VCs, and generates actionable coaching to boost your fundraising signals.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/app/oracle/wizard')}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-3 rounded-xl transition text-sm"
            >
              <Flame className="w-4 h-4" />
              Start the Wizard
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/80 px-6 py-3 rounded-xl transition text-sm"
            >
              Submit your startup first
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* What the Oracle Does — 8 steps preview */}
        <div className="space-y-3">
          <h2 className="text-white/60 text-sm font-medium uppercase tracking-wide">8-Step Signal Wizard</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ORACLE_STEPS.map((step) => (
              <div key={step.key} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-xs text-white/30 font-mono">Step {step.number}</span>
                </div>
                <h3 className="text-sm font-semibold text-white/90">{step.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{step.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Deep Oracle Intelligence */}
        <DeepOracleCards navigate={navigate} />

        {/* Cohort CTA */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Join a Cohort</h3>
                <p className="text-white/40 text-sm">
                  Work alongside founders at your stage. Weekly coaching, peer accountability, signal amplification.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/app/oracle/cohorts')}
              className="flex items-center gap-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 px-4 py-2 rounded-xl text-sm transition"
            >
              Browse Cohorts
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
