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
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SCOUT_PLAN, ORACLE_PLAN } from "@/lib/pricingPlans";
import OutreachPackage from "@/components/wizard/OutreachPackage";
import CampaignQuotaBanner, { type CampaignQuota } from "@/components/wizard/CampaignQuotaBanner";
import { allowWizardUnlockFlow } from "@/lib/founderSignupGate";
import { useAuth } from "@/_core/hooks/useAuth";
import { trackFunnelEvent } from "@/lib/matchEngagement";

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

interface RoundStatusResponse extends RoundGate {
  campaign_quota?: CampaignQuota;
  startup_name?: string;
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

function readinessBarColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 52) return "#22d3ee";
  if (score >= 40) return "#facc15";
  return "#fb923c";
}

function readinessPitch(score: number, pointsToPipeline: number): { headline: string; body: string } {
  if (score >= 60) {
    return {
      headline: "You're ready for automated PYTHIA sends",
      body: "Your story is strong enough to attach to every auto-sequence. Activate below when you're ready to scale beyond manual copy & send.",
    };
  }
  if (score >= 52) {
    return {
      headline: "Almost there — one more push unlocks full automation",
      body: `At 60+, PYTHIA runs follow-ups and meeting prep with your readiness doc attached. You're ${pointsToPipeline} pts away.`,
    };
  }
  return {
    headline: "Investors reply to proof, not promises",
    body: "Closing a few gaps in your story makes cold emails land harder — and unlocks PYTHIA auto-sends with your readiness doc attached at 52+.",
  };
}

export default function RoundAutomation({ startupId, startupName, startupWebsite, onBeginUnlocks }: RoundAutomationProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const founderEmail = user?.email ?? undefined;
  const [status, setStatus] = useState<RoundStatusResponse | null>(null);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [unlockNavigating, setUnlockNavigating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [showReadinessDetails, setShowReadinessDetails] = useState(false);

  const load = useCallback(async () => {
    try {
      const emailQs = founderEmail ? `?founder_email=${encodeURIComponent(founderEmail)}` : "";
      const [statusRes, outreachRes] = await Promise.all([
        fetch(`${API}/${startupId}/round-status${emailQs}`),
        fetch(`${API}/${startupId}/outreach-package`),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (outreachRes.ok) setOutreach(await outreachRes.json());
    } finally {
      setLoading(false);
    }
  }, [startupId, founderEmail]);

  useEffect(() => {
    load();
  }, [load]);

  const gate = status;
  const quota = status?.campaign_quota ?? null;

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
      const res = await fetch(`${API}/${startupId}/activate-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founder_email: founderEmail }),
      });
      const data = await res.json();
      if (data.campaign_quota) {
        setStatus((prev) => (prev ? { ...prev, campaign_quota: data.campaign_quota } : prev));
      }
      if (!res.ok) {
        setActivateError(data.message || data.error || "Could not activate round");
        if (res.status === 402 || res.status === 403) {
          void trackFunnelEvent("campaign_limit_hit", {
            startup_id: startupId,
            plan: data.campaign_quota?.plan,
            active_count: data.campaign_quota?.active_count,
            upgrade_plan: data.campaign_quota?.upgrade_plan,
          });
        }
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
  const readinessScore = gate.readiness_score;
  const readinessColor = readinessBarColor(readinessScore);
  const readinessCopy = readinessPitch(readinessScore, gate.points_to_pipeline);
  const unmetCount = gate.requirements.filter((r) => !r.met).length;
  const pipelineThreshold = gate.thresholds.pipeline;
  const outreachThreshold = gate.thresholds.outreach;

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

      {/* Optional readiness — sell the upside, not a checklist chore */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, oklch(0.14 0.02 280) 0%, oklch(0.12 0.01 264) 100%)`,
          border: `1px solid ${readinessScore >= outreachThreshold ? "oklch(0.696 0.17 162.48 / 0.35)" : "oklch(0.22 0.02 280 / 0.5)"}`,
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-widest mb-1.5" style={{ color: "#a855f7" }}>
                OPTIONAL · BOOST REPLY RATE
              </p>
              <p className="text-sm font-semibold leading-snug mb-1.5" style={{ color: "oklch(0.94 0.005 264)" }}>
                {readinessCopy.headline}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.58 0.01 264)" }}>
                {readinessCopy.body}
              </p>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-mono text-lg font-bold"
                style={{
                  color: readinessColor,
                  border: `2px solid ${readinessColor}55`,
                  background: `${readinessColor}12`,
                }}
              >
                {readinessScore}
              </div>
              <span className="text-[9px] mt-1 tracking-wide" style={{ color: "oklch(0.42 0.01 264)" }}>
                READINESS
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "oklch(0.45 0.01 264)" }}>
              <span>Manual emails work now</span>
              <span>
                {readinessScore >= pipelineThreshold
                  ? "PYTHIA automation unlocked"
                  : readinessScore >= outreachThreshold
                    ? `${gate.points_to_pipeline} pts to full automation`
                    : `${gate.points_to_outreach} pts to attach readiness doc`}
              </span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{ width: `${readinessScore}%`, backgroundColor: readinessColor }}
              />
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${outreachThreshold}%`, backgroundColor: "oklch(0.55 0.01 264)" }}
                title={`${outreachThreshold} — readiness doc on auto-sends`}
              />
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${pipelineThreshold}%`, backgroundColor: "oklch(0.696 0.17 162.48)" }}
                title={`${pipelineThreshold} — full PYTHIA automation`}
              />
            </div>
            <div className="relative mt-1 h-3">
              <span className="absolute left-0 text-[9px]" style={{ color: "oklch(0.38 0.01 264)" }}>0</span>
              <span
                className="absolute text-[9px] -translate-x-1/2"
                style={{ left: `${outreachThreshold}%`, color: "oklch(0.48 0.01 264)" }}
              >
                {outreachThreshold} doc
              </span>
              <span
                className="absolute text-[9px] -translate-x-1/2"
                style={{ left: `${pipelineThreshold}%`, color: "oklch(0.696 0.17 162.48)" }}
              >
                {pipelineThreshold} auto
              </span>
              <span className="absolute right-0 text-[9px]" style={{ color: "oklch(0.38 0.01 264)" }}>100</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            {[
              { icon: Target, label: "Proof beats pitch", detail: "Proved unlocks = credibility in every email" },
              { icon: TrendingUp, label: "Higher reply rate", detail: "Gaps closed → investors see a fundable story" },
              { icon: Sparkles, label: "PYTHIA at 52+", detail: "Readiness doc auto-attached to sequences" },
            ].map(({ icon: Icon, label, detail }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2.5"
                style={{ backgroundColor: "oklch(0.11 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} style={{ color: "#a855f7" }} />
                  <span className="text-[10px] font-semibold" style={{ color: "oklch(0.78 0.01 264)" }}>{label}</span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: "oklch(0.48 0.01 264)" }}>{detail}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowReadinessDetails((v) => !v)}
            className="w-full flex items-center justify-between py-2 text-left"
          >
            <span className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>
              {unmetCount > 0
                ? `${unmetCount} gap${unmetCount === 1 ? "" : "s"} to close · up to +${gate.points_to_outreach} pts`
                : "All readiness checks passed"}
            </span>
            {showReadinessDetails ? (
              <ChevronUp size={14} style={{ color: "oklch(0.45 0.01 264)" }} />
            ) : (
              <ChevronDown size={14} style={{ color: "oklch(0.45 0.01 264)" }} />
            )}
          </button>
        </div>

        {showReadinessDetails && (
          <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid oklch(0.18 0.01 264)" }}>
            {gate.requirements.map((req) => (
              <div key={req.id} className="flex items-start gap-2.5 pt-3 first:pt-3">
                {req.met ? (
                  <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
                ) : (
                  <Circle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#a855f7" }} />
                )}
                <div>
                  <p className="text-xs font-medium" style={{ color: req.met ? "oklch(0.75 0.01 264)" : "oklch(0.82 0.01 264)" }}>
                    {req.label}
                  </p>
                  {!req.met && req.hint && (
                    <p className="text-[10px] mt-0.5" style={{ color: "oklch(0.48 0.01 264)" }}>{req.hint}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!gate.pipeline_ready && (
          <div className="px-5 pb-5">
            <button
              type="button"
              disabled={unlockNavigating}
              onClick={() => void handleGoBackToUnlocks()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-60"
              style={{
                color: "#a855f7",
                border: "1px solid #a855f740",
                background: "oklch(0.696 0.17 280 / 0.08)",
              }}
            >
              {unlockNavigating ? "Opening…" : "Close gaps → strengthen my story"}
              <ArrowRight size={14} />
            </button>
            <p className="text-[10px] text-center mt-2" style={{ color: "oklch(0.4 0.01 264)" }}>
              Free · not required to copy & send emails above
            </p>
          </div>
        )}
      </div>

      {/* Campaign quota + upgrade path */}
      <CampaignQuotaBanner
        quota={quota}
        onUpgradeClick={() => {
          void trackFunnelEvent("pricing_cta_clicked", {
            source: "outreach_campaign_quota",
            startup_id: startupId,
            plan: quota?.plan,
          });
        }}
      />

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
              : quota?.plan === "none"
                ? `Copy & send above is free. Scout automates ${SCOUT_PLAN.outreachCampaigns} campaigns (~${SCOUT_PLAN.outreachCampaigns! * (SCOUT_PLAN.investorsPerCampaign as number)} touches/mo) with follow-ups and reply tracking.`
                : "Manual copy & send is free above. Scout or Oracle automates outreach, follow-ups, and meeting prep."}
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
        ) : gate.pipeline_ready && quota?.can_activate !== false ? (
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
        ) : gate.pipeline_ready && quota?.at_limit ? (
          <Link href="/pricing">
            <span
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "oklch(0.769 0.188 70.08)", color: "#0a0a0a" }}
            >
              <Sparkles size={14} />
              Upgrade to Oracle — {ORACLE_PLAN.outreachCampaigns} campaigns
              <ArrowRight size={14} />
            </span>
          </Link>
        ) : gate.pipeline_ready && quota?.plan === "none" ? (
          <Link href="/pricing">
            <span
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#22c55e", color: "#0a0a0a" }}
            >
              <Sparkles size={14} />
              Subscribe to activate PYTHIA
              <ArrowRight size={14} />
            </span>
          </Link>
        ) : (
          <div className="space-y-2">
            <Link href="/pricing">
              <span
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "oklch(0.696 0.17 162.48)", color: "#0a0a0a" }}
              >
                <Sparkles size={14} />
                Start Scout trial — $19/mo · {SCOUT_PLAN.outreachCampaigns} campaigns
                <ArrowRight size={14} />
              </span>
            </Link>
            <p className="text-[10px] text-center" style={{ color: "oklch(0.42 0.01 264)" }}>
              14-day trial ·{" "}
              <Link href="/pricing" className="underline" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Oracle $49/mo · {ORACLE_PLAN.outreachCampaigns} campaigns
              </Link>
              {" "}· manual copy above stays free
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
