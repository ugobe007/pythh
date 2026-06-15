/**
 * COMMITMENT WIZARD PAGE
 * /app/wizard/:startupId
 *
 * Full founder gap-closing loop:
 *   gaps → acknowledge → [provisional doc] → prove → [investment memo] → outreach package
 *
 * Tabs once gaps are done:
 *   - Commitments (track tasks + proof submission)
 *   - Readiness Doc (commitment document viewer)
 *   - Outreach (email drafts + investment memo)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, Send, Sparkles } from 'lucide-react';
import PythhUnifiedNav from '../../components/PythhUnifiedNav';
import GapCard, { type GapTask } from '../../components/wizard/GapCard';
import AcknowledgeModal from '../../components/wizard/AcknowledgeModal';
import ProofSubmitCard from '../../components/wizard/ProofSubmitCard';
import CommitmentDocument from '../../components/wizard/CommitmentDocument';
import OutreachPackage from '../../components/wizard/OutreachPackage';

// ── Types ─────────────────────────────────────────────────────────────────

interface DbTask {
  id: string;
  task_key: string;
  component: string;
  title: string;
  description: string;
  impact_points: number;
  proof_type: 'text' | 'names_list' | 'count' | 'url';
  status: string;
  acknowledged_at: string | null;
  deadline: string | null;
  completed_at: string | null;
  proof_data: Record<string, unknown> | null;
}

type WizardPhase = 'loading' | 'gap_cards' | 'tabs' | 'error';
type ActiveTab = 'commitments' | 'document' | 'outreach';

const API_BASE = '/api/wizard';

// ── Loading view ──────────────────────────────────────────────────────────

function WizardLoading({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mb-4" />
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{message}</p>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function CommitmentWizardPage() {
  const { startupId } = useParams<{ startupId: string }>();

  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Gap analysis state
  const [gapTasks, setGapTasks] = useState<GapTask[]>([]);
  const [currentGapIndex, setCurrentGapIndex] = useState(0);
  const [acknowledgeTask, setAcknowledgeTask] = useState<GapTask | null>(null);
  const [godScore, setGodScore] = useState<number | null>(null);
  const [startupName, setStartupName] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('commitments');

  // DB tasks (for commitments tab)
  const [dbTasks, setDbTasks] = useState<DbTask[]>([]);
  const [proofTask, setProofTask] = useState<DbTask | null>(null);

  // Document state
  const [commitmentDoc, setCommitmentDoc] = useState<unknown>(null);
  const [docLoading, setDocLoading] = useState(false);

  // Outreach state
  const [outreachData, setOutreachData] = useState<unknown>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);

  // ── Initial load ────────────────────────────────────────────────────────

  const loadGaps = useCallback(async () => {
    if (!startupId) return;
    try {
      const res = await fetch(`${API_BASE}/${startupId}/gaps`);
      if (!res.ok) throw new Error('Failed to load gaps');
      const data = await res.json();

      setGodScore(data.god_score);
      setStartupName(data.startup_name || '');

      if (!data.gap_tasks || data.gap_tasks.length === 0) {
        // No gaps — go straight to tabs
        await loadDbTasks();
        setPhase('tabs');
        return;
      }

      // Filter out tasks already acknowledged/completed
      const pending = data.gap_tasks.filter(
        (t: GapTask & { existing_status?: string | null }) =>
          !t.existing_status || t.existing_status === 'pending'
      );

      if (pending.length === 0) {
        await loadDbTasks();
        setPhase('tabs');
        return;
      }

      setGapTasks(pending);
      setCurrentGapIndex(0);
      setPhase('gap_cards');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setPhase('error');
    }
  }, [startupId]);

  const loadDbTasks = useCallback(async () => {
    if (!startupId) return;
    const res = await fetch(`${API_BASE}/${startupId}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setDbTasks(data.tasks || []);
    }
  }, [startupId]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  // ── Gap card actions ────────────────────────────────────────────────────

  const handleAcknowledge = (task: GapTask) => {
    setAcknowledgeTask(task);
  };

  const handleAcknowledgeConfirm = async (deadline: string) => {
    if (!acknowledgeTask || !startupId) return;

    // Create task in DB (upsert), then acknowledge it
    const createRes = await fetch(`${API_BASE}/${startupId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: [acknowledgeTask] }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      const taskId = (created.tasks || [])[0]?.id;
      if (taskId) {
        await fetch(`${API_BASE}/tasks/${taskId}/acknowledge`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deadline }),
        });
      }
    }

    setAcknowledgeTask(null);
    advanceGap();
  };

  const handleSkip = async (task: GapTask) => {
    if (!startupId) return;

    // Create then skip
    const createRes = await fetch(`${API_BASE}/${startupId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: [task] }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      const taskId = (created.tasks || [])[0]?.id;
      if (taskId) {
        await fetch(`${API_BASE}/tasks/${taskId}/skip`, { method: 'PUT' });
      }
    }

    advanceGap();
  };

  const advanceGap = async () => {
    const next = currentGapIndex + 1;
    if (next >= gapTasks.length) {
      // All gaps handled — generate doc and move to tabs
      await loadDbTasks();
      await generateDocument();
      setPhase('tabs');
    } else {
      setCurrentGapIndex(next);
    }
  };

  // ── Document ────────────────────────────────────────────────────────────

  const generateDocument = async () => {
    if (!startupId) return;
    setDocLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${startupId}/document`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCommitmentDoc(data.document);
      }
    } finally {
      setDocLoading(false);
    }
  };

  const loadDocument = useCallback(async () => {
    if (!startupId) return;
    setDocLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${startupId}/document`);
      if (res.ok) {
        const data = await res.json();
        setCommitmentDoc(data.document);
      } else if (res.status === 404) {
        await generateDocument();
      }
    } finally {
      setDocLoading(false);
    }
  }, [startupId]);

  // ── Outreach ────────────────────────────────────────────────────────────

  const loadOutreach = useCallback(async () => {
    if (!startupId) return;
    setOutreachLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${startupId}/outreach-package`);
      if (res.ok) {
        const data = await res.json();
        setOutreachData(data);
      }
    } finally {
      setOutreachLoading(false);
    }
  }, [startupId]);

  // Load data when tab changes
  useEffect(() => {
    if (phase !== 'tabs') return;
    if (activeTab === 'document' && !commitmentDoc) loadDocument();
    if (activeTab === 'outreach' && !outreachData) loadOutreach();
  }, [phase, activeTab, commitmentDoc, outreachData, loadDocument, loadOutreach]);

  // ── Proof submission ────────────────────────────────────────────────────

  const handleProofSubmit = async (taskId: string, proofData: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof_data: proofData }),
    });
    if (!res.ok) throw new Error('Failed to submit proof');
    setProofTask(null);
    await loadDbTasks();
    // Regenerate doc
    await generateDocument();
  };

  // ── Render: loading ─────────────────────────────────────────────────────
  if (phase === 'loading') return <WizardLoading message="Analyzing your investor readiness..." />;

  // ── Render: error ───────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4">
        <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
        <Link to="/submit" className="text-xs text-zinc-500 underline">Back to submit</Link>
      </div>
    );
  }

  // ── Render: gap cards ───────────────────────────────────────────────────
  if (phase === 'gap_cards') {
    const currentTask = gapTasks[currentGapIndex];
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: '#080808',
          backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(62,207,142,0.05) 0%, transparent 55%)',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5">
          <Link
            to="/submit"
            className="flex items-center gap-1.5 text-xs transition"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <ArrowLeft className="w-3 h-3" /> Back to report
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-white">Readiness Wizard</span>
          </div>
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
            GOD {godScore ?? '—'}/100
          </span>
        </div>

        {/* Progress */}
        <div className="px-6 mb-10">
          <ProgressBar current={currentGapIndex} total={gapTasks.length} />
        </div>

        {/* Title */}
        <div className="text-center px-6 mb-10">
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Close your investor readiness gaps
          </p>
          <h1
            className="text-2xl font-black text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.03em' }}
          >
            What will move the needle?
          </h1>
        </div>

        {/* Gap card */}
        <div className="flex-1 flex items-start justify-center px-4 pb-12">
          <GapCard
            task={currentTask}
            taskIndex={currentGapIndex}
            totalTasks={gapTasks.length}
            onAcknowledge={() => handleAcknowledge(currentTask)}
            onSkip={() => handleSkip(currentTask)}
            isLast={currentGapIndex === gapTasks.length - 1}
          />
        </div>

        {/* Acknowledge modal */}
        {acknowledgeTask && (
          <AcknowledgeModal
            taskTitle={acknowledgeTask.title}
            onConfirm={handleAcknowledgeConfirm}
            onCancel={() => setAcknowledgeTask(null)}
          />
        )}
      </div>
    );
  }

  // ── Render: tabs (commitments / doc / outreach) ─────────────────────────

  const tabConfig: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'commitments', label: 'Commitments', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'document', label: 'Readiness Doc', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'outreach', label: 'Outreach', icon: <Send className="w-3.5 h-3.5" /> },
  ];

  const activeTasks = dbTasks.filter(t => t.status !== 'skipped');
  const completedCount = dbTasks.filter(t => t.status === 'completed').length;
  const acknowledgedCount = dbTasks.filter(t => t.status === 'acknowledged').length;

  const outreach = outreachData as {
    startup_name?: string;
    investors?: unknown[];
    email_drafts?: unknown[];
    memo_markdown?: string;
    is_provisional?: boolean;
  } | null;

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col">
      <PythhUnifiedNav />

      <div className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h1
              className="text-lg font-bold text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {startupName ? `${startupName} — ` : ''}Readiness Wizard
            </h1>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {completedCount}/{activeTasks.length} tasks complete
            {acknowledgedCount > 0 ? ` · ${acknowledgedCount} in progress` : ''}
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-0.5 mb-6 rounded-xl p-1"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {tabConfig.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: activeTab === tab.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── COMMITMENTS TAB ────────────────────────────────────────────── */}
        {activeTab === 'commitments' && (
          <div className="space-y-4">
            {activeTasks.length === 0 && (
              <div
                className="text-center py-12 rounded-xl"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No commitments yet. Complete the gap analysis to get started.
                </p>
                <button
                  onClick={() => { setPhase('gap_cards'); setCurrentGapIndex(0); }}
                  className="mt-4 text-xs text-emerald-400 underline"
                >
                  Start gap analysis
                </button>
              </div>
            )}

            {activeTasks.map(task => (
              <div key={task.id}>
                {proofTask?.id === task.id ? (
                  <ProofSubmitCard
                    taskId={task.id}
                    taskTitle={task.title}
                    proofType={task.proof_type}
                    proofLabel="Provide proof of completion"
                    onSubmit={handleProofSubmit}
                    onCancel={() => setProofTask(null)}
                  />
                ) : (
                  <div
                    className="flex items-start gap-3 rounded-xl px-4 py-3.5 cursor-default"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${task.status === 'completed' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {/* Status indicator */}
                    <div
                      className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background:
                          task.status === 'completed' ? '#34d399' :
                          task.status === 'acknowledged' ? '#facc15' :
                          'rgba(255,255,255,0.15)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white leading-tight">{task.title}</p>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded shrink-0"
                          style={{
                            background:
                              task.status === 'completed' ? 'rgba(52,211,153,0.1)' :
                              task.status === 'acknowledged' ? 'rgba(250,204,21,0.1)' :
                              'rgba(255,255,255,0.04)',
                            color:
                              task.status === 'completed' ? '#34d399' :
                              task.status === 'acknowledged' ? '#facc15' :
                              'rgba(255,255,255,0.35)',
                          }}
                        >
                          {task.status === 'completed' ? 'Done' :
                           task.status === 'acknowledged' ? 'Committed' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 mt-1">
                        <span className="text-[11px] text-emerald-500">+{task.impact_points} pts</span>
                        {task.deadline && (
                          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            By {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.completed_at && (
                          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            Completed {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {task.status === 'acknowledged' && (
                      <button
                        onClick={() => setProofTask(task)}
                        className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg transition"
                        style={{
                          background: 'rgba(52,211,153,0.08)',
                          color: '#34d399',
                          border: '1px solid rgba(52,211,153,0.2)',
                        }}
                      >
                        + Proof
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Regenerate doc button */}
            {activeTasks.length > 0 && (
              <button
                onClick={async () => {
                  await generateDocument();
                  setActiveTab('document');
                }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-black transition-all duration-200 mt-2"
                style={{ background: '#34d399' }}
              >
                Update Readiness Doc
              </button>
            )}
          </div>
        )}

        {/* ── DOCUMENT TAB ───────────────────────────────────────────────── */}
        {activeTab === 'document' && (
          <div>
            {docLoading && <WizardLoading message="Generating your commitment doc..." />}
            {!docLoading && commitmentDoc && (
              <CommitmentDocument
                document={commitmentDoc as Parameters<typeof CommitmentDocument>[0]['document']}
                onProveTask={cm => {
                  const dbTask = dbTasks.find(t => t.task_key === (cm as { task_key: string }).task_key);
                  if (dbTask) { setProofTask(dbTask); setActiveTab('commitments'); }
                }}
              />
            )}
            {!docLoading && !commitmentDoc && (
              <div className="text-center py-12">
                <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No document generated yet.
                </p>
                <button
                  onClick={generateDocument}
                  className="text-xs text-emerald-400 underline"
                >
                  Generate now
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── OUTREACH TAB ───────────────────────────────────────────────── */}
        {activeTab === 'outreach' && (
          <div>
            {outreachLoading && <WizardLoading message="Building your outreach package..." />}
            {!outreachLoading && outreach && (
              <OutreachPackage
                startupName={outreach.startup_name || startupName}
                investors={(outreach.investors as Parameters<typeof OutreachPackage>[0]['investors']) || []}
                emailDrafts={(outreach.email_drafts as Parameters<typeof OutreachPackage>[0]['emailDrafts']) || []}
                memoMarkdown={outreach.memo_markdown || null}
                isProvisional={outreach.is_provisional ?? true}
              />
            )}
            {!outreachLoading && !outreach && (
              <div className="text-center py-12">
                <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Your outreach package will be ready once matches are generated.
                </p>
                <button onClick={loadOutreach} className="text-xs text-emerald-400 underline">
                  Load outreach
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
