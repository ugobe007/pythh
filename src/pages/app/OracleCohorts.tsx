// ============================================================================
// Pythh Oracle — Cohorts Page
// ============================================================================
// Browse available cohorts or view your current cohort with members.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Calendar,
  UserPlus,
  Crown,
  Star,
} from 'lucide-react';
import {
  getAvailableCohorts,
  getCohortMembers,
  joinCohort,
  getOracleDashboard,
  type OracleCohort,
  type CohortMember,
} from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

export default function OracleCohortsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startupId = useOracleStartupId();
  const cohortId = searchParams.get('cohort');

  // If cohortId is present, show detail view; otherwise show browse
  if (cohortId && startupId) {
    return <CohortDetail cohortId={cohortId} startupId={startupId} />;
  }

  return <CohortBrowser startupId={startupId} />;
}

// ---------------------------------------------------------------------------
// Cohort Browser — browse & join
// ---------------------------------------------------------------------------

function CohortBrowser({ startupId }: { startupId: string | null }) {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<OracleCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState('seed');

  const stages = ['pre-seed', 'seed', 'series-a', 'series-b', 'growth'];

  useEffect(() => {
    setLoading(true);
    getAvailableCohorts(selectedStage)
      .then(setCohorts)
      .catch(() => setCohorts([]))
      .finally(() => setLoading(false));
  }, [selectedStage]);

  const handleJoin = async (cohortId: string) => {
    if (!startupId) return;
    setJoining(cohortId);
    try {
      const dashboard = await getOracleDashboard(startupId);
      await joinCohort(cohortId, startupId, dashboard.signal_score);
      navigate(`/app/oracle/cohort?cohort=${cohortId}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/app/oracle')}
            className="text-white/40 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-white/90">Oracle Cohorts</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">Find Your Cohort</h1>
          <p className="text-white/50 text-sm max-w-lg mx-auto">
            Join a group of 6-8 founders at your stage. Weekly coaching sessions,
            peer feedback, and shared accountability to amplify your signals together.
          </p>
        </div>

        {/* Stage Filter */}
        <div className="flex justify-center gap-2 flex-wrap">
          {stages.map((stage) => (
            <button
              key={stage}
              onClick={() => setSelectedStage(stage)}
              className={`px-4 py-2 rounded-xl text-sm capitalize transition border ${
                selectedStage === stage
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>

        {/* Cohort List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : cohorts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="w-12 h-12 text-white/20 mx-auto" />
            <p className="text-white/40 text-sm">
              No cohorts forming for {selectedStage} right now.
            </p>
            <p className="text-white/30 text-xs">
              New cohorts open weekly. Check back soon or try a different stage.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cohorts.map((cohort) => (
              <div
                key={cohort.cohort_id}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 hover:border-purple-500/30 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{cohort.name}</h3>
                    <p className="text-xs text-purple-400/60 capitalize mt-1">
                      {cohort.stage} · {cohort.total_weeks} weeks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white/70">
                      {cohort.member_count}/8
                    </p>
                    <p className="text-xs text-white/40">members</p>
                  </div>
                </div>

                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-purple-500/60"
                    style={{ width: `${(cohort.member_count / 8) * 100}%` }}
                  />
                </div>

                <button
                  onClick={() => handleJoin(cohort.cohort_id)}
                  disabled={joining === cohort.cohort_id || cohort.member_count >= 8}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-40"
                >
                  {joining === cohort.cohort_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cohort.member_count >= 8 ? (
                    'Full'
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Join Cohort
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cohort Detail — view members & progress
// ---------------------------------------------------------------------------

function CohortDetail({ cohortId, startupId }: { cohortId: string; startupId: string }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<CohortMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCohortMembers(cohortId)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [cohortId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/app/oracle')}
            className="text-white/40 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-sm font-semibold text-white/90">Cohort Members</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-white/40 text-center py-16 text-sm">No members yet.</p>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white">Your Cohort ({members.length} members)</h2>

            {/* Leaderboard */}
            <div className="space-y-3">
              {[...members]
                .sort((a, b) => (b.signal_current || 0) - (a.signal_current || 0))
                .map((member, idx) => {
                  const delta =
                    member.signal_current != null && member.signal_at_join != null
                      ? member.signal_current - member.signal_at_join
                      : null;
                  const isYou = member.startup_id === startupId;

                  return (
                    <div
                      key={member.startup_id}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition ${
                        isYou
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {/* Rank */}
                      <div className="w-8 text-center">
                        {idx === 0 ? (
                          <Crown className="w-5 h-5 text-amber-400 mx-auto" />
                        ) : (
                          <span className="text-sm text-white/40 font-mono">{idx + 1}</span>
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">
                          {member.startup_name}
                          {isYou && (
                            <span className="text-amber-400 text-xs ml-2">(You)</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-white/40">
                            {member.role === 'mentor' && '🎓 Mentor'}
                            {member.role === 'lead' && '⭐ Lead'}
                          </span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="w-20">
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-purple-500"
                            style={{ width: `${member.progress_pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-white/30 text-center mt-1">
                          {member.progress_pct}%
                        </p>
                      </div>

                      {/* Signal */}
                      <div className="text-right w-16">
                        <p className="text-sm font-mono text-white/70">
                          {member.signal_current?.toFixed(1) || '—'}
                        </p>
                        {delta != null && (
                          <p
                            className={`text-[10px] ${
                              delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white/30'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Cohort tips */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Cohort Playbook
              </h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">1.</span>
                  Complete your Oracle wizard steps to generate personalized actions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">2.</span>
                  Share progress with cohort peers for feedback and accountability
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">3.</span>
                  Practice investor pitches together — the best prep is live reps
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">4.</span>
                  Track signal improvements weekly and celebrate wins
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
