/**
 * ACT 3 — Outreach first: copy emails now, automate later (Oracle / PYTHIA).
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Lock,
  Mail,
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
  website?: string | null;
  investors?: Parameters<typeof OutreachPackage>[0]["investors"];
  email_drafts?: Parameters<typeof OutreachPackage>[0]["emailDrafts"];
  memo_markdown?: string | null;
  is_provisional?: boolean;
  locked?: boolean;
  send_locked?: boolean;
  preview_mode?: "full" | "provisional" | "none";
  message?: string;
  gate?: RoundGate;
}

interface RoundAutomationProps {
  startupId: string;
  startupName?: string;
  startupWebsite?: string | null;
  onBeginUnlocks?: () => void | Promise<void>;
}

function scrollToDrafts() {
  document.getElementById("outreach-drafts")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function RoundAutomation({ startupId, startupName, startupWebsite, onBeginUnlocks }: RoundAutomationProps) {
  const [, navigate] = useLocation();
  const [gate, setGate] = useState<RoundGate | null>(null);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [unlockNavigating, setUnlockNavigating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [showReadinessDetails, setShowReadinessDetails] = useState(false);

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
      navigate(data.activate_url || `/activate?sid=${startupId}&pipeline=1`);
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
        <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>Loading your outreach drafts…</p>
      </div>
    );
  }

  if (!gate) {
    return (
      <p className="text-sm text-center py-12" style={{ color: "oklch(0.55 0.01 264)" }}>
        Could not load outreach.{" "}
        <Link href={`/activate?startup_id=${encodeURIComponent(startupId)}`} className="underline" style={{ color: "#22d3ee" }}>
          Return to matches
        </Link>
      </p>
    );
  }

  const displayName = outreach?.startup_name || startupName || "your startup";
  const displayWebsite = outreach?.website || startupWebsite || null;
  const hasDrafts = Boolean(outreach && !outreach.locked && (outreach.email_drafts?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* Clear workflow — what to do NOW */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.08)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
      >
        <p className="text-[10px] font-semibold tracking-widest mb-3" style={{ color: "#22c55e" }}>
          WHAT TO DO NOW
        </p>
        <ol className="space-y-2.5 text-sm mb-4" style={{ color: "oklch(0.75 0.01 264)" }}>
          <li className="flex gap-2">
            <span className="font-mono text-emerald-400 shrink-0">1.</span>
            <span><strong>Copy</strong> the first email draft below (already open)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-emerald-400 shrink-0">2.</span>
            <span><strong>Send</strong> from your email — Gmail, Outlook, whatever you use</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-emerald-400 shrink-0">3.</span>
            <span><strong>Repeat</strong> for your next matches — or automate with Oracle (paid, optional)</span>
          </li>
        </ol>
        {hasDrafts ? (
          <button
            type="button"
            onClick={scrollToDrafts}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-black"
            style={{ background: "#22c55e" }}
          >
            <Mail size={16} />
            Go to email drafts
            <ArrowRight size={16} />
          </button>
        ) : (
          <Link href={`/activate?startup_id=${encodeURIComponent(startupId)}`}>
            <span className="block w-full text-center py-3 rounded-xl text-sm font-semibold" style={{ background: "#22c55e", color: "#0a0a0a" }}>
              View investor matches first →
            </span>
          </Link>
        )}
        <p className="text-[11px] text-center mt-3" style={{ color: "oklch(0.45 0.01 264)" }}>
          Free to copy & send · No subscription required for manual outreach
        </p>
      </div>

      {/* Locked / no matches */}
      {outreach?.locked && (
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
        >
          <div className="flex items-start gap-3">
            <Lock size={16} className="flex-shrink-0 mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }} />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.005 264)" }}>No drafts yet</p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "oklch(0.55 0.01 264)" }}>
                {outreach.message || "Run a match scan first, then drafts appear here."}
              </p>
              <Link href={`/activate?startup_id=${encodeURIComponent(startupId)}`} className="text-xs font-semibold underline" style={{ color: "#22d3ee" }}>
                Go to match results →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Email drafts FIRST — the actual work */}
      {hasDrafts && outreach && (
        <OutreachPackage
          startupId={startupId}
          startupName={displayName}
          startupWebsite={displayWebsite}
          investors={outreach.investors!}
          emailDrafts={outreach.email_drafts || []}
          memoMarkdown={outreach.memo_markdown || null}
          isProvisional={outreach.is_provisional ?? true}
        />
      )}

      {/* Optional readiness — collapsed by default */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
      >
        <button
          type="button"
          onClick={() => setShowReadinessDetails((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <p className="text-xs font-semibold" style={{ color: "oklch(0.65 0.01 264)" }}>
              Optional · Improve readiness ({gate.readiness_score}/100)
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "oklch(0.42 0.01 264)" }}>
              Not required to send emails manually · helps automated PYTHIA later
            </p>
          </div>
          {showReadinessDetails ? (
            <ChevronUp size={16} style={{ color: "oklch(0.45 0.01 264)" }} />
          ) : (
            <ChevronDown size={16} style={{ color: "oklch(0.45 0.01 264)" }} />
          )}
        </button>
        {showReadinessDetails && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid oklch(0.18 0.01 264)" }}>
            {gate.requirements.map((req) => (
              <div key={req.id} className="flex items-start gap-2.5 pt-3 first:pt-3">
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
            <button
              type="button"
              disabled={unlockNavigating}
              onClick={() => void handleGoBackToUnlocks()}
              className="text-xs underline disabled:opacity-60"
              style={{ color: "oklch(0.696 0.17 162.48)" }}
            >
              {unlockNavigating ? "Opening…" : "Review optional readiness suggestions →"}
            </button>
          </div>
        )}
      </div>

      {/* Step 4 — Automate (paid) */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: gate.pipeline_ready || gate.pipeline_active ? "oklch(0.696 0.17 162.48 / 0.06)" : "oklch(0.12 0.01 264)",
          border: `1px solid ${gate.pipeline_ready || gate.pipeline_active ? "oklch(0.696 0.17 162.48 / 0.25)" : "oklch(0.2 0.01 264)"}`,
        }}
      >
        <p className="text-[10px] font-semibold tracking-widest mb-2" style={{ color: "#a855f7" }}>
          STEP 4 · AUTOMATE (OPTIONAL)
        </p>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} style={{ color: "oklch(0.696 0.17 162.48)" }} />
          <p className="text-sm font-semibold" style={{ color: "oklch(0.94 0.005 264)" }}>PYTHIA — automated outreach</p>
        </div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "oklch(0.55 0.01 264)" }}>
          {gate.pipeline_active
            ? "Your round is live. PYTHIA tracks responses and preps meeting briefs."
            : gate.pipeline_ready
              ? "You're ready — activate to send sequences automatically and track replies."
              : "Manual copy & send is free above. Oracle plan automates outreach, follow-ups, and meeting prep."}
        </p>

        {activateError && <p className="text-xs text-red-400 mb-3">{activateError}</p>}

        {gate.pipeline_active ? (
          <button
            type="button"
            onClick={() => navigate(`/activate?sid=${startupId}&pipeline=1`)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "#22c55e", color: "#0a0a0a" }}
          >
            <Sparkles size={14} />
            Track pipeline
            <ArrowRight size={14} />
          </button>
        ) : gate.pipeline_ready ? (
          <button
            type="button"
            onClick={handleActivateRound}
            disabled={activating}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-black disabled:opacity-60"
            style={{ background: "#22c55e" }}
          >
            {activating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {activating ? "Activating…" : "Activate PYTHIA round"}
          </button>
        ) : (
          <div className="space-y-2">
            <Link href="/pricing">
              <span
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "oklch(0.696 0.17 162.48)", color: "#0a0a0a" }}
              >
                <Sparkles size={14} />
                Start Scout trial — $19/mo · 1 campaign
                <ArrowRight size={14} />
              </span>
            </Link>
            <p className="text-[10px] text-center" style={{ color: "oklch(0.42 0.01 264)" }}>
              7-day trial ·{" "}
              <Link href="/pricing" className="underline" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Oracle $49/mo · 5 campaigns
              </Link>
              {" "}· manual copy above stays free
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
