/**
 * Commitment Wizard — /wizard/:startupId
 * Act 2: gap acknowledgment → readiness doc
 * Act 3: round automation (gated outreach + PYTHIA)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, BookOpen, FileText, Sparkles, Zap } from "lucide-react";
import GapCard, { type GapTask } from "@/components/wizard/GapCard";
import AcknowledgeModal from "@/components/wizard/AcknowledgeModal";
import ProofSubmitCard from "@/components/wizard/ProofSubmitCard";
import CommitmentDocument from "@/components/wizard/CommitmentDocument";
import RoundAutomation from "@/components/wizard/RoundAutomation";
import WizardActivationBanner from "@/components/wizard/WizardActivationBanner";
import GodScoreExplainer from "@/components/wizard/GodScoreExplainer";
import { allowWizardUnlockFlow } from "@/lib/founderSignupGate";
import {
  domainsMatch,
  extractDomain,
  getPinnedStartupUrl,
  pinActiveStartup,
  resolveStartupIdForUrl,
} from "@/lib/activeStartupContext";
import { trackFunnelEvent } from "@/lib/matchEngagement";

interface DbTask {
  id: string;
  task_key: string;
  component: string;
  title: string;
  description: string;
  impact_points: number;
  proof_type: "text" | "names_list" | "count" | "url";
  status: string;
  acknowledged_at: string | null;
  deadline: string | null;
  completed_at: string | null;
  proof_data: Record<string, unknown> | null;
}

type WizardPhase = "loading" | "unlock_intro" | "gap_cards" | "tabs" | "error";
type ActiveTab = "commitments" | "document" | "round";

function initialTabFromUrl(): ActiveTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "round") return "round";
  if (tab === "document") return "document";
  return "commitments";
}

interface UnlockSummary {
  total_tasks: number;
  total_potential_gain: number;
  total_investors_unlocked: number;
  current_god_score: number;
  projected_god_score: number;
  headline: string;
  subline: string;
}

const API_BASE = "/api/wizard";
/** Max optional readiness cards per session — rest are backlog, not a gate. */
const MAX_UNLOCK_FLOW = 3;

type GapTaskWithStatus = GapTask & { existing_status?: string | null };

function filterPendingGapTasks(tasks: GapTaskWithStatus[]): GapTask[] {
  return tasks.filter((t) => {
    const s = t.existing_status;
    return !s || s === "pending";
  });
}

async function persistGapTaskAction(
  startupId: string,
  task: GapTask,
  action: "skip" | "acknowledge",
  deadline?: string,
): Promise<boolean> {
  const createRes = await fetch(`${API_BASE}/${startupId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: [task] }),
  });
  if (!createRes.ok) return false;

  const created = await createRes.json();
  let taskId = (created.tasks || [])[0]?.id as string | undefined;
  if (!taskId) return false;

  if (action === "skip") {
    const skipRes = await fetch(`${API_BASE}/tasks/${taskId}/skip`, { method: "PUT" });
    return skipRes.ok;
  }

  const ackRes = await fetch(`${API_BASE}/tasks/${taskId}/acknowledge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deadline }),
  });
  return ackRes.ok;
}

function WizardLoading({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mb-4" />
      <p className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>{message}</p>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Wizard() {
  const [, params] = useRoute("/wizard/:startupId");
  const startupId = params?.startupId;
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<WizardPhase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [gapTasks, setGapTasks] = useState<GapTask[]>([]);
  const [gapFlowTotal, setGapFlowTotal] = useState(0);
  const [gapFlowResolved, setGapFlowResolved] = useState(0);
  const [gapTotalAvailable, setGapTotalAvailable] = useState(0);
  const [acknowledgeTask, setAcknowledgeTask] = useState<GapTask | null>(null);
  const [godScore, setGodScore] = useState<number | null>(null);
  const [startupName, setStartupName] = useState("");
  const [startupWebsite, setStartupWebsite] = useState<string | null>(null);
  const [startupMismatch, setStartupMismatch] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTabFromUrl);
  const [dbTasks, setDbTasks] = useState<DbTask[]>([]);
  const [proofTask, setProofTask] = useState<DbTask | null>(null);
  const [commitmentDoc, setCommitmentDoc] = useState<unknown>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [unlockSummary, setUnlockSummary] = useState<UnlockSummary | null>(null);
  const [gapActionError, setGapActionError] = useState("");
  const [showWelcome, setShowWelcome] = useState(
    () => new URLSearchParams(window.location.search).get("welcome") === "1",
  );
  const outreachPreviewTrackedRef = useRef(false);

  const loadDbTasks = useCallback(async () => {
    if (!startupId) return;
    const res = await fetch(`${API_BASE}/${startupId}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setDbTasks(data.tasks || []);
    }
  }, [startupId]);

  const generateDocument = useCallback(async () => {
    if (!startupId) return;
    setDocLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${startupId}/document`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCommitmentDoc(data.document);
      }
    } finally {
      setDocLoading(false);
    }
  }, [startupId]);

  useEffect(() => {
    if (!startupId) return;
    const searchParams = new URLSearchParams(window.location.search);
    const explicitWizard =
      searchParams.get('tab') === 'round' ||
      searchParams.get('force_wizard') === '1' ||
      searchParams.get('start_unlocks') === '1' ||
      searchParams.get('skip_unlocks') === '0';
    if (sessionStorage.getItem('pythia_skip_wizard_unlocks') === '1' && !explicitWizard) {
      navigate(`/activate?startup_id=${encodeURIComponent(startupId)}`);
    }
  }, [startupId, navigate]);

  const finishGapFlow = useCallback(async () => {
    await loadDbTasks();
    await generateDocument();
    setPhase("tabs");
    setActiveTab("round");
  }, [loadDbTasks, generateDocument]);

  const skipToOutreach = useCallback(async () => {
    allowWizardUnlockFlow();
    await loadDbTasks();
    setPhase("tabs");
    setActiveTab("round");
  }, [loadDbTasks]);

  const fetchPendingGaps = useCallback(async () => {
    if (!startupId) return null;
    const res = await fetch(`${API_BASE}/${startupId}/gaps`);
    if (!res.ok) throw new Error("Failed to load gaps");
    const data = await res.json();
    const pending = filterPendingGapTasks(data.gap_tasks || []);
    return {
      pending,
      godScore: data.god_score as number,
      startupName: (data.startup_name as string) || "",
      unlockSummary: (data.unlock_summary as UnlockSummary | null) ?? null,
    };
  }, [startupId]);

  const enterGapCards = useCallback((pending: GapTask[], totalAvailable?: number) => {
    const capped = pending.slice(0, MAX_UNLOCK_FLOW);
    setGapTasks(capped);
    setGapFlowTotal(capped.length);
    setGapFlowResolved(0);
    setGapTotalAvailable(totalAvailable ?? pending.length);
    setPhase("gap_cards");
  }, []);

  const loadGaps = useCallback(async () => {
    if (!startupId) return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const forceWizard = searchParams.get("force_wizard") === "1";
      const startUnlocks = searchParams.get("start_unlocks") === "1";
      const skipUnlockFlow =
        !forceWizard &&
        (sessionStorage.getItem("pythia_skip_wizard_unlocks") === "1" ||
          searchParams.get("skip_unlocks") === "1" ||
          searchParams.get("welcome") === "1" ||
          searchParams.get("tab") === "round");

      const res = await fetch(`${API_BASE}/${startupId}/gaps`);
      if (!res.ok) throw new Error("Failed to load gaps");
      const data = await res.json();

      setGodScore(data.god_score);
      setStartupName(data.startup_name || "");
      setStartupWebsite((data.website as string) || null);
      if (data.unlock_summary) setUnlockSummary(data.unlock_summary);

      if (!data.gap_tasks?.length) {
        await loadDbTasks();
        setPhase("tabs");
        return;
      }

      const pending = filterPendingGapTasks(data.gap_tasks || []);

      if (!pending.length) {
        await loadDbTasks();
        setPhase("tabs");
        return;
      }

      setGapTasks(pending);
      setGapFlowTotal(pending.length);
      setGapFlowResolved(0);

      if (forceWizard && searchParams.get("tab") === "round") {
        void loadDbTasks();
        setActiveTab("round");
        setPhase("tabs");
        return;
      }

      if (skipUnlockFlow) {
        void loadDbTasks();
        if (searchParams.get("tab") === "round") setActiveTab("round");
        setPhase("tabs");
        return;
      }

      if (startUnlocks) {
        enterGapCards(pending, pending.length);
        return;
      }

      // Default: investor outreach first — readiness cards are opt-in only
      void loadDbTasks();
      setActiveTab(
        searchParams.get("tab") === "commitments" || searchParams.get("tab") === "document"
          ? initialTabFromUrl()
          : "round",
      );
      setPhase("tabs");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }, [startupId, loadDbTasks, enterGapCards]);

  /** In-app unlock entry — always refetch pending gaps (never reuse stale cache after ack/skip). */
  const beginUnlockFlow = useCallback(async () => {
    allowWizardUnlockFlow();
    void trackFunnelEvent("wizard_unlock_flow_started", {
      startup_id: startupId,
      source: activeTab === "round" ? "round_locked" : "commitments_empty",
    });

    if (!startupId) return;
    setPhase("loading");
    try {
      const result = await fetchPendingGaps();
      if (!result) return;

      setGodScore(result.godScore);
      setStartupName(result.startupName);
      if (result.unlockSummary) setUnlockSummary(result.unlockSummary);

      if (!result.pending.length) {
        await loadDbTasks();
        setPhase("tabs");
        setActiveTab(activeTab === "round" ? "commitments" : activeTab);
        return;
      }

      enterGapCards(result.pending, result.pending.length);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }, [startupId, loadDbTasks, activeTab, fetchPendingGaps, enterGapCards]);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  /** Redirect if wizard startup_id doesn't match the URL the founder scanned. */
  useEffect(() => {
    if (!startupId || !startupWebsite) return;
    const pinnedUrl = getPinnedStartupUrl();
    if (!pinnedUrl || domainsMatch(startupWebsite, pinnedUrl)) {
      setStartupMismatch(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const correctId = await resolveStartupIdForUrl(pinnedUrl);
      if (cancelled) return;
      const pinnedDomain = extractDomain(pinnedUrl);
      const loadedDomain = extractDomain(startupWebsite);
      setStartupMismatch(
        `Outreach was loaded for ${startupName || loadedDomain} (${loadedDomain}), but your scan is ${pinnedDomain}.`,
      );
      if (correctId && correctId !== startupId) {
        navigate(`/wizard/${correctId}?tab=round&force_wizard=1`);
      }
    })();
    return () => { cancelled = true; };
  }, [startupId, startupWebsite, startupName, navigate]);

  useEffect(() => {
    if (activeTab === "round" && startupId && !outreachPreviewTrackedRef.current) {
      outreachPreviewTrackedRef.current = true;
      void trackFunnelEvent("wizard_outreach_preview_viewed", {
        startup_id: startupId,
        source: showWelcome ? "activation_welcome" : "wizard_tab",
      });
    }
  }, [activeTab, startupId, showWelcome]);

  const resolveGapTask = useCallback(
    (taskKey: string) => {
      setGapActionError("");
      setGapTasks((prev) => {
        const remaining = prev.filter((t) => t.task_key !== taskKey);
        if (remaining.length === 0) {
          setPhase("loading");
          void finishGapFlow();
        }
        return remaining;
      });
      setGapFlowResolved((n) => n + 1);
    },
    [finishGapFlow],
  );

  const handleAcknowledgeConfirm = async (deadline: string) => {
    if (!acknowledgeTask || !startupId) return;
    setGapActionError("");
    const taskKey = acknowledgeTask.task_key;
    const ok = await persistGapTaskAction(startupId, acknowledgeTask, "acknowledge", deadline);
    if (!ok) {
      setGapActionError("Could not save this unlock — please try again.");
      return;
    }
    setAcknowledgeTask(null);
    resolveGapTask(taskKey);
  };

  const handleSkip = async (task: GapTask) => {
    if (!startupId) return;
    setGapActionError("");
    const ok = await persistGapTaskAction(startupId, task, "skip");
    if (!ok) {
      setGapActionError("Could not save — your progress was not recorded. Try again.");
      return;
    }
    resolveGapTask(task.task_key);
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
  }, [startupId, generateDocument]);

  useEffect(() => {
    if (phase !== "tabs") return;
    if (activeTab === "document" && !commitmentDoc) loadDocument();
  }, [phase, activeTab, commitmentDoc, loadDocument]);

  const handleProofSubmit = async (taskId: string, proofData: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof_data: proofData }),
    });
    if (!res.ok) throw new Error("Failed to submit proof");
    setProofTask(null);
    await loadDbTasks();
    await generateDocument();
  };

  if (phase === "loading") return <WizardLoading message="Analyzing your investor readiness..." />;

  if (phase === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
        <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
        <Link href="/activate" className="text-xs underline" style={{ color: "oklch(0.55 0.01 264)" }}>Back to activate</Link>
      </div>
    );
  }

  if (phase === "unlock_intro" && unlockSummary) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
          <Link href="/" className="text-xs font-bold" style={{ color: "oklch(0.696 0.17 162.48)" }}>← pythh.ai</Link>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full text-center">
          {showWelcome && (
            <div
              className="w-full mb-6 px-4 py-3 rounded-xl text-left"
              style={{
                backgroundColor: 'oklch(0.696 0.17 162.48 / 0.1)',
                border: '1px solid oklch(0.696 0.17 162.48 / 0.25)',
              }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: 'oklch(0.696 0.17 162.48)' }}>
                ✓ Account created — investor tracking is on
              </p>
              <p className="text-xs" style={{ color: 'oklch(0.55 0.01 264)' }}>
                Your shortlist is saved. Complete unlocks below to raise your GOD score and open intro requests.
              </p>
            </div>
          )}
          <p className="text-[10px] font-semibold tracking-widest mb-4" style={{ color: "#22d3ee" }}>ACT 2 · CHOOSE YOUR UNLOCKS</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "oklch(0.94 0.005 264)", letterSpacing: "-0.03em" }}>
            {unlockSummary.headline}
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "oklch(0.55 0.01 264)" }}>
            {unlockSummary.subline}
          </p>
          <div
            className="w-full grid grid-cols-3 gap-3 mb-8 rounded-xl p-4"
            style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
          >
            <div>
              <p className="text-xl font-bold font-mono" style={{ color: "#22c55e" }}>{unlockSummary.total_tasks}</p>
              <p className="text-[9px] tracking-widest mt-1" style={{ color: "oklch(0.4 0.01 264)" }}>UNLOCKS</p>
            </div>
            <div>
              <p className="text-xl font-bold font-mono" style={{ color: "#eab308" }}>+{unlockSummary.total_potential_gain}</p>
              <p className="text-[9px] tracking-widest mt-1" style={{ color: "oklch(0.4 0.01 264)" }}>GOD PTS</p>
            </div>
            <div>
              <p className="text-xl font-bold font-mono" style={{ color: "#22d3ee" }}>~{unlockSummary.total_investors_unlocked}</p>
              <p className="text-[9px] tracking-widest mt-1" style={{ color: "oklch(0.4 0.01 264)" }}>INVESTORS</p>
            </div>
          </div>
          <p className="text-xs mb-6 font-mono" style={{ color: "oklch(0.45 0.01 264)" }}>
            GOD {unlockSummary.current_god_score} → {unlockSummary.projected_god_score} if all unlocked
          </p>
          <p className="text-xs mb-6 px-3 py-2 rounded-lg" style={{ color: "oklch(0.55 0.01 264)", backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}>
            Free with your account — no subscription required to review and commit to unlocks.
            A paid plan is only needed later if you want PYTHIA to send outreach automatically.
          </p>
          <button
            type="button"
            onClick={() => {
              allowWizardUnlockFlow();
              void beginUnlockFlow();
            }}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-black mb-3"
            style={{ background: "#22c55e" }}
          >
            Start unlocks →
          </button>
          <button
            type="button"
            onClick={() => {
              void loadDbTasks();
              setActiveTab("round");
              setPhase("tabs");
            }}
            className="w-full py-3 rounded-xl text-sm font-medium mb-3"
            style={{ color: "oklch(0.55 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
          >
            Skip to pipeline preview
          </button>
          <button
            type="button"
            onClick={() => navigate(`/activate?startup_id=${encodeURIComponent(startupId || "")}`)}
            className="w-full py-2.5 rounded-xl text-xs font-medium"
            style={{ color: "oklch(0.45 0.01 264)" }}
          >
            Back to my full match list
          </button>
          <p className="text-[10px] mt-4" style={{ color: "oklch(0.35 0.01 264)" }}>
            Skip any unlock — only commit to what you&apos;ll actually prove
          </p>
        </div>
      </div>
    );
  }

  if (phase === "gap_cards") {
    const currentTask = gapTasks[0];
    if (!currentTask) {
      return <WizardLoading message="Saving your unlocks…" />;
    }
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
        <div className="flex items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() => {
              setPhase("tabs");
              setActiveTab("round");
            }}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "oklch(0.45 0.01 264)" }}
          >
            <ArrowLeft className="w-3 h-3" /> Back to round
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold" style={{ color: "oklch(0.88 0.005 264)" }}>Readiness Wizard</span>
          </div>
          <span className="text-xs font-mono" style={{ color: "oklch(0.38 0.01 264)" }}>GOD {godScore ?? "—"}/100</span>
        </div>
        <div className="px-6 mb-10">
          <ProgressBar current={gapFlowResolved} total={gapFlowTotal || gapTasks.length} />
        </div>
        <div className="text-center px-6 mb-6">
          <GodScoreExplainer score={godScore} />
          <p className="text-xs mb-2" style={{ color: "oklch(0.45 0.01 264)" }}>Optional readiness — skip anytime</p>
          <h1 className="text-2xl font-bold" style={{ color: "oklch(0.94 0.005 264)", letterSpacing: "-0.03em" }}>
            Suggested improvements before outreach
          </h1>
        </div>
        <div className="flex-1 flex items-start justify-center px-4 pb-12">
          <div className="w-full max-w-md">
            {gapActionError && (
              <p className="text-xs text-red-400 text-center mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "oklch(0.16 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
                {gapActionError}
              </p>
            )}
            <GapCard
            task={currentTask}
            taskIndex={gapFlowResolved}
            totalTasks={gapFlowTotal || gapTasks.length}
            totalAvailable={gapTotalAvailable || undefined}
            godScore={godScore}
            onAcknowledge={() => setAcknowledgeTask(currentTask)}
            onSkip={() => handleSkip(currentTask)}
            onSkipToOutreach={() => void skipToOutreach()}
            isLast={gapTasks.length === 1}
          />
          </div>
        </div>
        {acknowledgeTask && (
          <AcknowledgeModal
            taskTitle={acknowledgeTask.title}
            impactPoints={acknowledgeTask.impact_points}
            investorsUnlocked={acknowledgeTask.investors_unlocked_estimate}
            objectionRemoved={acknowledgeTask.objection_removed}
            onConfirm={handleAcknowledgeConfirm}
            onCancel={() => setAcknowledgeTask(null)}
          />
        )}
      </div>
    );
  }

  const tabConfig: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "round", label: "Outreach", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "commitments", label: "Readiness", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "document", label: "Readiness Doc", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  const activeTasks = dbTasks.filter((t) => t.status !== "skipped");
  const completedCount = dbTasks.filter((t) => t.status === "completed").length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
        <Link href="/" className="text-xs font-bold" style={{ color: "oklch(0.696 0.17 162.48)" }}>← pythh.ai</Link>
      </div>
      <div className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <GodScoreExplainer score={godScore} compact />
          <div className="flex items-center gap-2 mb-1 mt-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h1 className="text-lg font-bold" style={{ color: "oklch(0.94 0.005 264)" }}>
              {startupName ? `${startupName} — ` : ""}Investor outreach
            </h1>
          </div>
          <p className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
            Copy & send emails below · readiness & automation are optional
            {unlockSummary ? ` · GOD ${unlockSummary.current_god_score}/100` : ""}
          </p>
        </div>

        {startupMismatch && (
          <div className="mb-4 rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "oklch(0.16 0.01 264)", border: "1px solid #f9731640", color: "oklch(0.65 0.01 264)" }}>
            {startupMismatch}{' '}
            <Link href="/activate" className="underline" style={{ color: "#22d3ee" }}>Return to your match list</Link>
          </div>
        )}

        {showWelcome && (
          <WizardActivationBanner
            startupName={startupName}
            gapCount={unlockSummary?.total_tasks ?? gapTasks.length}
            onOpenRound={() => {
              setActiveTab("round");
              setShowWelcome(false);
            }}
            onDismiss={() => setShowWelcome(false)}
          />
        )}

        <div
          className="flex gap-0.5 mb-6 rounded-xl p-1"
          style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
        >
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "oklch(0.18 0.01 264)" : "transparent",
                color: activeTab === tab.id ? "oklch(0.94 0.005 264)" : "oklch(0.45 0.01 264)",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "commitments" && (
          <div className="space-y-4">
            {activeTasks.length === 0 && (
              <div className="text-center py-12 rounded-xl" style={{ border: "1px solid oklch(0.2 0.01 264)" }}>
                <p className="text-sm mb-2" style={{ color: "oklch(0.55 0.01 264)" }}>
                  No unlock cards left — you&apos;ve reviewed everything Oracle flagged.
                </p>
                <p className="text-xs mb-4 px-4" style={{ color: "oklch(0.42 0.01 264)" }}>
                  Open Outreach to copy email drafts to your top matches. No subscription required.
                </p>
                <button type="button" onClick={() => setActiveTab("round")} className="text-xs text-emerald-400 underline">
                  Go to Outreach tab →
                </button>
              </div>
            )}
            {activeTasks.map((task) => (
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
                    className="flex items-start gap-3 rounded-xl px-4 py-3.5"
                    style={{
                      background: "oklch(0.14 0.01 264)",
                      border: `1px solid ${task.status === "completed" ? "rgba(52,211,153,0.2)" : "oklch(0.2 0.01 264)"}`,
                    }}
                  >
                    <div
                      className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: task.status === "completed" ? "#34d399" : task.status === "acknowledged" ? "#facc15" : "oklch(0.3 0.01 264)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "oklch(0.94 0.005 264)" }}>{task.title}</p>
                      <span className="text-[11px] text-emerald-500">+{task.impact_points} pts unlock</span>
                    </div>
                    {task.status === "acknowledged" && (
                      <button
                        type="button"
                        onClick={() => setProofTask(task)}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}
                      >
                        + Proof
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {activeTasks.length > 0 && (
              <button
                type="button"
                onClick={async () => { await generateDocument(); setActiveTab("document"); }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-black"
                style={{ background: "#34d399" }}
              >
                Update Readiness Doc
              </button>
            )}
          </div>
        )}

        {activeTab === "document" && (
          <div>
            {docLoading && <WizardLoading message="Generating your commitment doc..." />}
            {!docLoading && commitmentDoc && (
              <CommitmentDocument
                document={commitmentDoc as Parameters<typeof CommitmentDocument>[0]["document"]}
                onProveTask={(cm) => {
                  const dbTask = dbTasks.find((t) => t.task_key === (cm as { task_key: string }).task_key);
                  if (dbTask) { setProofTask(dbTask); setActiveTab("commitments"); }
                }}
              />
            )}
          </div>
        )}

        {activeTab === "round" && startupId && (
          <RoundAutomation
            startupId={startupId}
            startupName={startupName}
            startupWebsite={startupWebsite}
            onBeginUnlocks={beginUnlockFlow}
          />
        )}
      </div>
    </div>
  );
}
