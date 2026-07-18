/**
 * ACT 3 — Round automation
 * Readiness gate → outreach unlock → PYTHIA pipeline activation
 */

import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import OutreachPackage from "@/components/wizard/OutreachPackage";
import { allowWizardUnlockFlow } from "@/lib/founderSignupGate";

const API = "/api/wizard";

interface Requirement {
  id: string;
  label: string;
  met: boolean;
  hint?: string | null;
}

interface RoundGate {
  readiness_score: number;
  status: string;
  headline: string;
  subline: string;
  outreach_ready: boolean;
  pipeline_ready: boolean;
  pipeline_active: boolean;
  round_activated_at?: string | null;
  requirements: Requirement[];
  points_to_outreach: number;
  points_to_pipeline: number;
  thresholds: { outreach: number; pipeline: number; god_floor: number };
  stats: {
    god_score: number;
    acknowledged_unlocks: number;
    proved_unlocks: number;
    has_readiness_doc: boolean;
    match_count: number;
  };
}

interface OutreachData {
  startup_name?: string;
  investors?: Parameters<typeof OutreachPackage>[0]["investors"];
  email_drafts?: Parameters<typeof OutreachPackage>[0]["emailDrafts"];
  memo_markdown?: string | null;
  is_provisional?: boolean;
  locked?: boolean;
  message?: string;
  gate?: RoundGate;
}

interface RoundAutomationProps {
  startupId: string;
  startupName?: string;
  /** Switches wizard to gap_cards without a dead client-side navigate on the same route. */
  onBeginUnlocks?: () => void | Promise<void>;
}

function ReadinessMeter({ score, outreachAt, pipelineAt }: { score: number; outreachAt: number; pipelineAt: number }) {
  const color = score >= pipelineAt ? "#22c55e" : score >= outreachAt ? "#eab308" : "#22d3ee";
  return (
    <div className="mb-6">
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold tracking-widest" style={{ color: "oklch(0.42 0.01 264)" }}>ROUND READINESS</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.01 264)" }}>
            Outreach at {outreachAt} · PYTHIA at {pipelineAt}
          </p>
        </div>
        <span className="font-display font-bold text-3xl" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }} />
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${outreachAt}%`, backgroundColor: "oklch(0.35 0.01 264)" }} />
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${pipelineAt}%`, backgroundColor: "oklch(0.35 0.01 264)" }} />
      </div>
    </div>
  );
}

export default function RoundAutomation({ startupId, startupName, onBeginUnlocks }: RoundAutomationProps) {
  const [, navigate] = useLocation();
  const [gate, setGate] = useState<RoundGate | null>(null);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [unlockNavigating, setUnlockNavigating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusRes, outreachRes] = await Promise.all([
        fetch(`${API}/${startupId}/round-status`),
        fetch(`${API}/${startupId}/outreach-package`),
      ]);
      if (statusRes.ok) setGate(await statusRes.json());
      if (outreachRes.ok) setOutreach(await outreachRes.json());
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGoBackToUnlocks = async () => {
    setUnlockNavigating(true);
    try {
      allowWizardUnlockFlow();
      if (onBeginUnlocks) {
        await onBeginUnlocks();
        return;
      }
      window.location.assign(`/wizard/${startupId}?force_wizard=1&start_unlocks=1`);
    } catch {
      window.location.assign(`/wizard/${startupId}?force_wizard=1&start_unlocks=1`);
    } finally {
      setUnlockNavigating(false);
    }
  };

  const handleActivateRound = async () => {
    setActivating(true);
    setActivateError(null);
    try {
      const res = await fetch(`${API}/${startupId}/activate-round`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActivateError(data.message || data.error || "Could not activate round");
        return;
      }
      const url = data.activate_url || `/activate?sid=${startupId}`;
      navigate(url);
    } catch {
      setActivateError("Activation failed — try again");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <Loader2 size={20} className="animate-spin" style={{ color: "#22d3ee" }} />
        <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>Checking round readiness…</p>
      </div>
    );
  }

  if (!gate) {
    return (
      <p className="text-sm text-center py-12" style={{ color: "oklch(0.55 0.01 264)" }}>
        Could not load round status.
      </p>
    );
  }

  const displayName = startupName || outreach?.startup_name || "your startup";

  return (
    <div className="space-y-6">
      {/* Act 3 header */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest mb-2" style={{ color: "#22d3ee" }}>ACT 3 · AUTOMATE YOUR ROUND</p>
        <h2 className="text-lg font-bold mb-1" style={{ color: "oklch(0.94 0.005 264)" }}>{gate.headline}</h2>
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{gate.subline}</p>
      </div>

      <ReadinessMeter
        score={gate.readiness_score}
        outreachAt={gate.thresholds.outreach}
        pipelineAt={gate.thresholds.pipeline}
      />

      {/* Requirements checklist */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
      >
        <p className="text-[10px] font-semibold tracking-widest" style={{ color: "oklch(0.42 0.01 264)" }}>READINESS CHECKLIST</p>
        {gate.requirements.map((req) => (
          <div key={req.id} className="flex items-start gap-2.5">
            {req.met ? (
              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
            ) : (
              <Circle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "oklch(0.35 0.01 264)" }} />
            )}
            <div>
              <p className="text-xs" style={{ color: req.met ? "oklch(0.75 0.01 264)" : "oklch(0.5 0.01 264)" }}>{req.label}</p>
              {!req.met && req.hint && (
                <p className="text-[10px] mt-0.5" style={{ color: "oklch(0.38 0.01 264)" }}>{req.hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Locked outreach preview */}
      {outreach?.locked && (
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.04)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}
        >
          <div className="flex items-start gap-3 mb-4">
            <Lock size={16} className="flex-shrink-0 mt-0.5" style={{ color: "oklch(0.696 0.17 162.48)" }} />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.005 264)" }}>Outreach package locked</p>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>
                {outreach.message || `Cross readiness ${gate.thresholds.outreach}+ to unlock personalized emails and your investment memo.`}
              </p>
            </div>
          </div>
          {(outreach.investors || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
                {gate.stats.match_count} MATCHES WAITING
              </p>
              {outreach.investors!.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 blur-[2px] select-none"
                  style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                >
                  <span className="text-xs" style={{ color: "oklch(0.6 0.01 264)" }}>{inv.name} · {inv.firm}</span>
                  <span className="text-xs font-mono" style={{ color: "#eab308" }}>{inv.match_score}</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={unlockNavigating}
            onClick={() => void handleGoBackToUnlocks()}
            className="w-full mt-4 py-2.5 rounded-lg text-xs font-semibold border disabled:opacity-60"
            style={{ color: "#22c55e", borderColor: "#22c55e40" }}
          >
            {unlockNavigating ? "Opening unlocks…" : "Go back to unlocks →"}
          </button>
        </div>
      )}

      {/* Unlocked outreach */}
      {outreach && !outreach.locked && outreach.investors && outreach.investors.length > 0 && (
        <OutreachPackage
          startupName={displayName}
          investors={outreach.investors}
          emailDrafts={outreach.email_drafts || []}
          memoMarkdown={outreach.memo_markdown || null}
          isProvisional={outreach.is_provisional ?? true}
        />
      )}

      {/* PYTHIA activation */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: gate.pipeline_ready || gate.pipeline_active ? "oklch(0.696 0.17 162.48 / 0.06)" : "oklch(0.12 0.01 264)",
          border: `1px solid ${gate.pipeline_ready || gate.pipeline_active ? "oklch(0.696 0.17 162.48 / 0.25)" : "oklch(0.2 0.01 264)"}`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} style={{ color: "oklch(0.696 0.17 162.48)" }} />
          <p className="text-sm font-semibold" style={{ color: "oklch(0.94 0.005 264)" }}>PYTHIA round automation</p>
        </div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "oklch(0.55 0.01 264)" }}>
          {gate.pipeline_active
            ? "Your round is live. PYTHIA is running outreach to top matches with your readiness doc."
            : gate.pipeline_ready
              ? "Activate to let PYTHIA send personalized outreach, track responses, and prep meeting briefs."
              : `Reach readiness ${gate.thresholds.pipeline}+ with at least one proved unlock to enable automation.`}
        </p>

        {activateError && (
          <p className="text-xs text-red-400 mb-3">{activateError}</p>
        )}

        {gate.pipeline_active ? (
          <button
            type="button"
            onClick={() => navigate(`/activate?sid=${startupId}&pipeline=1`)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "#22c55e", color: "#0a0a0a" }}
          >
            <Sparkles size={14} />
            Track pipeline in Activate
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleActivateRound}
            disabled={!gate.pipeline_ready || activating}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: gate.pipeline_ready ? "#22c55e" : "oklch(0.18 0.01 264)",
              color: gate.pipeline_ready ? "#0a0a0a" : "oklch(0.45 0.01 264)",
              border: gate.pipeline_ready ? "none" : "1px solid oklch(0.22 0.01 264)",
            }}
          >
            {activating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {activating ? "Activating…" : "Activate PYTHIA round"}
          </button>
        )}
      </div>
    </div>
  );
}
