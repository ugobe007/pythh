/**
 * CancelConfirmModal
 *
 * Shown when a subscriber clicks "Manage Billing" on the /account page.
 * Presents three choices before the user reaches the Stripe portal:
 *   1. Pause — suspend billing for up to 3 months, keep access
 *   2. Downgrade — switch to Scout (free) at period end
 *   3. Cancel — open the Stripe Customer Portal to cancel
 *
 * The modal uses loss-aversion copy to surface what the user will lose,
 * reducing involuntary churn before escalating to the portal.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  PauseCircle,
  ArrowDownCircle,
  ExternalLink,
  X,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Target,
  Activity,
  Shield,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalStep = "choice" | "pause_confirm" | "downgrade_confirm" | "cancel_confirm";

interface CancelConfirmModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the modal should close (no action taken) */
  onClose: () => void;
  /** Called after a successful pause — parent should refetch subscription */
  onPaused: () => void;
  /** Called after a successful downgrade — parent should refetch subscription */
  onDowngraded: () => void;
  /** Called when the user confirms they want to open the Stripe portal */
  onConfirmCancel: () => void;
  /** Renewal date string for loss-aversion copy */
  renewalDate?: string;
}

// ─── Loss-aversion feature list ───────────────────────────────────────────────

const ORACLE_FEATURES = [
  { icon: <Zap size={14} />, label: "PYTHIA pipeline automation" },
  { icon: <Target size={14} />, label: "5,000+ investor thesis matches" },
  { icon: <Activity size={14} />, label: "Real-time signal intelligence" },
  { icon: <Shield size={14} />, label: "Personalised outreach sequences" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CancelConfirmModal({
  open,
  onClose,
  onPaused,
  onDowngraded,
  onConfirmCancel,
  renewalDate,
}: CancelConfirmModalProps) {
  const [step, setStep] = useState<ModalStep>("choice");

  const pauseMutation = trpc.stripe.pauseSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription paused", {
        description: "No charges will be made until you resume. You keep full access until your current period ends.",
      });
      onPaused();
      handleClose();
    },
    onError: (err) => {
      toast.error("Could not pause subscription", { description: err.message });
    },
  });

  const downgradeMutation = trpc.stripe.downgradeToScout.useMutation({
    onSuccess: () => {
      toast.success("Downgraded to Scout", {
        description: `You'll keep Oracle access until ${renewalDate ?? "your next renewal date"}, then move to the free Scout plan.`,
      });
      onDowngraded();
      handleClose();
    },
    onError: (err) => {
      toast.error("Could not downgrade plan", { description: err.message });
    },
  });

  function handleClose() {
    setStep("choice");
    onClose();
  }

  if (!open) return null;

  // ── Shared styles ───────────────────────────────────────────────────────────
  const bg = "oklch(0.13 0.01 264)";
  const border = "oklch(0.25 0.01 264)";
  const textMuted = "oklch(0.55 0.01 264)";
  const textDim = "oklch(0.4 0.01 264)";
  const emerald = "oklch(0.696 0.17 162.48)";
  const amber = "oklch(0.769 0.188 70.08)";
  const red = "oklch(0.65 0.22 25)";

  // ── Step: initial choice ────────────────────────────────────────────────────
  if (step === "choice") {
    return (
      <Overlay onClose={handleClose}>
        <ModalCard onClose={handleClose} title="Before you go…">
          {/* Loss-aversion header */}
          <p className="text-sm leading-relaxed mb-4" style={{ color: textMuted }}>
            Cancelling means losing access to everything PYTHIA is doing for your
            fundraise right now:
          </p>
          <ul className="space-y-2 mb-6">
            {ORACLE_FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-2.5 text-sm" style={{ color: "oklch(0.8 0.005 264)" }}>
                <span style={{ color: emerald }}>{f.icon}</span>
                {f.label}
              </li>
            ))}
          </ul>

          <p className="text-xs mb-6" style={{ color: textDim }}>
            Instead of cancelling, consider one of these options:
          </p>

          {/* Option 1 — Pause */}
          <button
            onClick={() => setStep("pause_confirm")}
            className="w-full flex items-start gap-4 p-4 rounded-xl border mb-3 text-left transition-all duration-150"
            style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: border }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${emerald}`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = border; }}
          >
            <PauseCircle size={20} style={{ color: emerald, flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.9 0.005 264)" }}>
                Pause my subscription
              </p>
              <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                Suspend billing for up to 3 months. Keep full Oracle access until your current period ends — no charges until you resume.
              </p>
            </div>
          </button>

          {/* Option 2 — Downgrade */}
          <button
            onClick={() => setStep("downgrade_confirm")}
            className="w-full flex items-start gap-4 p-4 rounded-xl border mb-5 text-left transition-all duration-150"
            style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: border }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = amber; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = border; }}
          >
            <ArrowDownCircle size={20} style={{ color: amber, flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.9 0.005 264)" }}>
                Downgrade to Scout (free)
              </p>
              <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                Move to the free Scout plan at the end of your current billing period. You keep Oracle access until then.
              </p>
            </div>
          </button>

          {/* Option 3 — Cancel (escalate to portal) */}
          <button
            onClick={() => setStep("cancel_confirm")}
            className="w-full text-center text-xs py-2 transition-colors duration-150"
            style={{ color: textDim }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = red; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = textDim; }}
          >
            I still want to cancel my subscription
          </button>
        </ModalCard>
      </Overlay>
    );
  }

  // ── Step: pause confirmation ────────────────────────────────────────────────
  if (step === "pause_confirm") {
    return (
      <Overlay onClose={handleClose}>
        <ModalCard onClose={handleClose} title="Pause your subscription?" onBack={() => setStep("choice")}>
          <div className="flex items-center gap-3 p-4 rounded-xl border mb-5"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.08)", borderColor: "oklch(0.696 0.17 162.48 / 0.25)" }}>
            <CheckCircle2 size={18} style={{ color: emerald, flexShrink: 0 }} />
            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.005 264)" }}>
              Pausing stops all future charges. You keep full Oracle access until your current period ends. You can resume anytime from this page.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("choice")}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors duration-150"
              style={{ borderColor: border, color: textMuted }}
            >
              Go back
            </button>
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{ backgroundColor: emerald, color: "oklch(0.1 0.01 162)", opacity: pauseMutation.isPending ? 0.7 : 1 }}
            >
              {pauseMutation.isPending ? "Pausing…" : "Pause subscription"}
            </button>
          </div>
        </ModalCard>
      </Overlay>
    );
  }

  // ── Step: downgrade confirmation ────────────────────────────────────────────
  if (step === "downgrade_confirm") {
    return (
      <Overlay onClose={handleClose}>
        <ModalCard onClose={handleClose} title="Downgrade to Scout?" onBack={() => setStep("choice")}>
          <div className="flex items-start gap-3 p-4 rounded-xl border mb-4"
            style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.08)", borderColor: "oklch(0.769 0.188 70.08 / 0.25)" }}>
            <AlertTriangle size={18} style={{ color: amber, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.85 0.005 264)" }}>
                You'll lose Oracle features at the end of your billing period
                {renewalDate ? ` (${renewalDate})` : ""}.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
                After that, PYTHIA pipeline automation, investor matching, and outreach sequences will be disabled. You can upgrade again at any time.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("choice")}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors duration-150"
              style={{ borderColor: border, color: textMuted }}
            >
              Go back
            </button>
            <button
              onClick={() => downgradeMutation.mutate()}
              disabled={downgradeMutation.isPending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{ backgroundColor: amber, color: "oklch(0.1 0.01 70)", opacity: downgradeMutation.isPending ? 0.7 : 1 }}
            >
              {downgradeMutation.isPending ? "Downgrading…" : "Downgrade to Scout"}
            </button>
          </div>
        </ModalCard>
      </Overlay>
    );
  }

  // ── Step: cancel confirmation (portal redirect) ─────────────────────────────
  return (
    <Overlay onClose={handleClose}>
      <ModalCard onClose={handleClose} title="Cancel your subscription?" onBack={() => setStep("choice")}>
        <div className="flex items-start gap-3 p-4 rounded-xl border mb-5"
          style={{ backgroundColor: "oklch(0.65 0.22 25 / 0.08)", borderColor: "oklch(0.65 0.22 25 / 0.3)" }}>
          <AlertTriangle size={18} style={{ color: red, flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.005 264)" }}>
            You'll be taken to the Stripe portal to complete cancellation. Your access will end at the close of your current billing period.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("choice")}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors duration-150"
            style={{ borderColor: border, color: textMuted }}
          >
            Go back
          </button>
          <button
            onClick={() => { onConfirmCancel(); handleClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{ backgroundColor: "oklch(0.65 0.22 25)", color: "oklch(0.97 0.005 264)" }}
          >
            Open Stripe portal
            <ExternalLink size={13} />
          </button>
        </div>
      </ModalCard>
    </Overlay>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "oklch(0 0 0 / 0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function ModalCard({
  children,
  onClose,
  onBack,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
  title: string;
}) {
  return (
    <div
      className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
      style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs px-2 py-1 rounded-md transition-colors duration-150"
              style={{ color: "oklch(0.5 0.01 264)", backgroundColor: "oklch(0.18 0.01 264)" }}
            >
              ← Back
            </button>
          )}
          <h2 className="font-display font-semibold text-base" style={{ color: "oklch(0.95 0.005 264)" }}>
            {title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors duration-150"
          style={{ color: "oklch(0.5 0.01 264)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.8 0.005 264)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.5 0.01 264)"; }}
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}
