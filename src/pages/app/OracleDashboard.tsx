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
  Trophy,
} from 'lucide-react';
import {
  getOrCreateActiveSession,
  listActions,
  listInsights,
  updateActionStatus,
  generateDemoActions,
  generateDemoInsights,
  generateAIInsights,
  type OracleSession,
  type OracleAction,
  type OracleInsight,
} from '../../services/oracleApiService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';
import { OracleScoreHistoryChart } from '../../components/OracleScoreHistoryChart';
import {
  MilestoneCelebrationModal,
  MilestoneProgressCard,
  AchievementBadgeGrid,
} from '../../components/OracleMilestones';
import { OracleScribe } from '../../components/OracleScribe';
import { supabase } from '../../lib/supabase';

interface Milestone {
  id: string;
  milestone_type: string;
  title: string;
  description: string | null;
  icon: string | null;
  reward_text: string | null;
  reward_action_url: string | null;
  achieved_at: string | null;
  is_celebrated: boolean;
}

export default function OracleDashboardPage() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [session, setSession] = useState<OracleSession | null>(null);
  const [actions, setActions] = useState<OracleAction[]>([]);
  const [insights, setInsights] = useState<OracleInsight[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [celebratingMilestone, setCelebratingMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scribe'>('dashboard');

  useEffect(() => {
    if (!startupId) {
      // No startup — show exploration landing (not an error)
      setLoading(false);
      return;
    }
    
    // Load session, actions, insights, and milestones in parallel
    Promise.all([
      getOrCreateActiveSession(startupId).catch(() => null),
      listActions({ startup_id: startupId }).catch(() => []),
      listInsights({ startup_id: startupId }).catch(() => []),
      fetchMilestones().catch(() => []),
    ])
      .then(([sessionData, actionsData, insightsData, milestonesData]) => {
        setSession(sessionData);
        setActions(actionsData);
        setInsights(insightsData);
        setMilestones(milestonesData);
      })
      .catch((e) => {
        console.warn('Oracle dashboard load failed, showing landing:', e.message);
        // Don't set error — show landing instead
      })
      .finally(() => setLoading(false));
  }, [startupId]);

  // Check for new milestones after session completes
  useEffect(() => {
    if (session?.status === 'completed') {
      checkForNewMilestones();
    }
  }, [session?.status]);

  const fetchMilestones = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return [];

      const response = await fetch('/api/oracle/milestones?achieved_only=true', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch milestones');

      const data = await response.json();
      return data.milestones || [];
    } catch (err) {
      console.error('Failed to fetch milestones:', err);
      return [];
    }
  };

  const checkForNewMilestones = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      const response = await fetch('/api/oracle/milestones/check', {
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to check milestones');

      const data = await response.json();
      
      if (data.newMilestones && data.newMilestones.length > 0) {
        // Show celebration for first uncelebrated milestone
        const uncelebrated = data.newMilestones.find((m: Milestone) => !m.is_celebrated);
        if (uncelebrated) {
          setCelebratingMilestone(uncelebrated);
        }
        
        // Refresh milestones list
        const updated = await fetchMilestones();
        setMilestones(updated);
      }
    } catch (err) {
      console.error('Failed to check milestones:', err);
    }
  };

  const handleMilestoneCelebrated = async () => {
    if (!celebratingMilestone) return;

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      await fetch(`/api/oracle/milestones/${celebratingMilestone.id}/celebrate`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
        },
      });

      setCelebratingMilestone(null);
      
      // Refresh milestones
      const updated = await fetchMilestones();
      setMilestones(updated);
    } catch (err) {
      console.error('Failed to mark milestone celebrated:', err);
    }
  };

  // Generate demo data
  const handleGenerateDemo = async () => {
    if (!session || generatingDemo) return;
    
    setGeneratingDemo(true);
    try {
      // Generate demo actions and insights in parallel
      await Promise.all([
        generateDemoActions(session.id),
        generateDemoInsights(session.id),
      ]);
      
      // Refresh data
      const [newActions, newInsights] = await Promise.all([
        listActions({ startup_id: startupId }),
        listInsights({ startup_id: startupId }),
      ]);
      
      setActions(newActions);
      setInsights(newInsights);
    } catch (e: any) {
      console.error('Failed to generate demo data:', e);
      setError(e.message);
    } finally {
      setGeneratingDemo(false);
    }
  };

  // Generate AI insights
  const handleGenerateAI = async () => {
    if (!session || !startupId || generatingAI) return;
    
    setGeneratingAI(true);
    try {
      const newInsights = await generateAIInsights(session.id, startupId);
      
      // Refresh insights list
      const allInsights = await listInsights({ startup_id: startupId });
      setInsights(allInsights);
      
      console.log('✅ Generated', newInsights.length, 'AI insights');
    } catch (e: any) {
      console.error('Failed to generate AI insights:', e);
      setError(e.message);
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  // No startup or failed to load → show the Oracle landing / exploration mode
  if (!session) {
    return <OracleLanding navigate={navigate} />;
  }

  const sessionComplete = session.status === 'completed';
  const wizardProgress = session.progress_percentage || 0;

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
            <div className="flex items-center gap-4">
              {/* Demo Data Button */}
              {actions.length === 0 && insights.length === 0 && (
                <button
                  onClick={handleGenerateDemo}
                  disabled={generatingDemo}
                  className="flex items-center gap-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 px-4 py-2 rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingDemo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Generate Demo Data
                    </>
                  )}
                </button>
              )}
              
              {/* AI Insights Button - show when session exists */}
              {session && session.progress_percentage > 0 && (
                <button
                  onClick={handleGenerateAI}
                  disabled={generatingAI}
                  className="flex items-center gap-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-4 py-2 rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Generate AI Insights
                    </>
                  )}
                </button>
              )}
              
              <SignalScoreBadge score={session.signal_score || 0} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
              activeTab === 'dashboard'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('scribe')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
              activeTab === 'scribe'
                ? 'border-purple-400 text-white'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Scribe Journal
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Dashboard Tab Content */}
        {activeTab === 'dashboard' && (
          <>
        {/* Signal Score Hero */}
        <SignalScoreHero score={session.signal_score || 0} />

        {/* Wizard CTA */}
        <WizardCard
          hasSession={true}
          sessionComplete={sessionComplete}
          wizardProgress={wizardProgress}
          currentStep={session.current_step || 1}
          startupId={startupId || ''}
          navigate={navigate}
        />

        {/* Score History Chart */}
        <OracleScoreHistoryChart
          userId={session.user_id}
          startupId={startupId || undefined}
          showBreakdown={true}
        />

        {/* Milestone Progress (next milestone to unlock) */}
        {sessionComplete && (
          <MilestoneProgressCard
            currentMilestones={milestones}
            nextMilestone={getNextMilestone(milestones, actions.length, session.signal_score || 0)}
          />
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Signal Actions */}
          <ActionsCard
            actions={actions}
            startupId={startupId || ''}
            onUpdate={async (id, status) => {
              await updateActionStatus(id, status);
              // Refresh actions list
              const updated = await listActions({ startup_id: startupId });
              setActions(updated);
            }}
          />

          {/* AI Insights */}
          <InsightsCard insights={insights} />
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

        {/* Achievement Badges (if any milestones unlocked) */}
        {milestones.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Achievements ({milestones.length})
            </h3>
            <AchievementBadgeGrid
              milestones={milestones}
              onClick={(milestone) => {
                if (!milestone.is_celebrated) {
                  setCelebratingMilestone(milestone);
                }
              }}
            />
          </div>
        )}
          </>
        )}

        {/* Scribe Journal Tab Content */}
        {activeTab === 'scribe' && (
          <OracleScribe startupId={startupId || undefined} />
        )}
      </div>

      {/* Milestone Celebration Modal */}
      {celebratingMilestone && (
        <MilestoneCelebrationModal
          milestone={celebratingMilestone}
          onClose={() => {
            handleMilestoneCelebrated();
          }}
          onContinue={() => {
            handleMilestoneCelebrated();
            if (celebratingMilestone.reward_action_url) {
              navigate(celebratingMilestone.reward_action_url);
            }
          }}
        />
      )}
    </div>
  );
}

// Helper function to determine next milestone
function getNextMilestone(
  currentMilestones: Milestone[],
  completedActionsCount: number,
  currentScore: number
) {
  const achievedTypes = new Set(currentMilestones.map(m => m.milestone_type));

  // Check wizard complete
  if (!achievedTypes.has('wizard_complete')) {
    return {
      type: 'wizard_complete',
      title: 'Complete Oracle Wizard',
      description: 'Finish all 8 steps of the Oracle assessment',
      progress: 0,
      target: 1,
      current: 0,
      icon: '🏆',
    };
  }

  // Check 5 actions
  if (!achievedTypes.has('5_actions_done')) {
    return {
      type: '5_actions_done',
      title: 'Complete 5 Actions',
      description: 'Complete 5 recommended signal actions',
      progress: Math.min((completedActionsCount / 5) * 100, 100),
      target: 5,
      current: completedActionsCount,
      icon: '🎯',
    };
  }

  // Check score 70+
  if (!achievedTypes.has('score_70_plus')) {
    return {
      type: 'score_70_plus',
      title: 'Reach Fundable Score',
      description: 'Achieve a score of 70 or higher',
      progress: Math.min((currentScore / 70) * 100, 100),
      target: 70,
      current: Math.round(currentScore),
      icon: '⭐',
    };
  }

  // Check score 80+
  if (!achievedTypes.has('score_80_plus')) {
    return {
      type: 'score_80_plus',
      title: 'High Performer Status',
      description: 'Achieve a score of 80 or higher',
      progress: Math.min((currentScore / 80) * 100, 100),
      target: 80,
      current: Math.round(currentScore),
      icon: '🌟',
    };
  }

  // Check score 90+
  if (!achievedTypes.has('score_90_plus')) {
    return {
      type: 'score_90_plus',
      title: 'Elite Startup Status',
      description: 'Achieve a score of 90 or higher',
      progress: Math.min((currentScore / 90) * 100, 100),
      target: 90,
      current: Math.round(currentScore),
      icon: '⚡',
    };
  }

  // All milestones unlocked
  return null;
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
