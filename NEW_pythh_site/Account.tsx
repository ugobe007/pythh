/**
 * PYTHH.AI — ACCOUNT / SUBSCRIBER DASHBOARD
 * Design: Obsidian Terminal — Data Noir
 *
 * Shows the user's Oracle plan status, billing details, and a link to the
 * Stripe Customer Portal for self-serve subscription management.
 *
 * Access rules:
 *   - Unauthenticated → redirect to login
 *   - Authenticated admin, no subscription → admin console links (no paywall)
 *   - Authenticated, no subscription → prompt to upgrade
 *   - Authenticated, active subscription → full dashboard
 */

import { Helmet } from "react-helmet-async";
import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  Zap,
  CreditCard,
  CalendarDays,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Loader2,
  LogOut,
  Send,
  User,
  ArrowRight,
  FileText,
  Download,
  Receipt,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import CancelConfirmModal from "@/components/CancelConfirmModal";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  clearOAuthHandoff,
  isOAuthHandoffActive,
  markOAuthHandoffFromRedirect,
  readPostLoginPath,
} from "@/lib/supabaseOAuth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusLabel(status: string): { label: string; color: string; bg: string; border: string } {
  switch (status) {
    case "active":
      return {
        label: "Active",
        color: "oklch(0.696 0.17 162.48)",
        bg: "oklch(0.696 0.17 162.48 / 0.1)",
        border: "oklch(0.696 0.17 162.48 / 0.3)",
      };
    case "trialing":
      return {
        label: "Trial",
        color: "oklch(0.769 0.188 70.08)",
        bg: "oklch(0.769 0.188 70.08 / 0.1)",
        border: "oklch(0.769 0.188 70.08 / 0.3)",
      };
    case "past_due":
      return {
        label: "Past Due",
        color: "oklch(0.65 0.22 25)",
        bg: "oklch(0.65 0.22 25 / 0.1)",
        border: "oklch(0.65 0.22 25 / 0.3)",
      };
    case "paused":
      return {
        label: "Paused",
        color: "oklch(0.769 0.188 70.08)",
        bg: "oklch(0.769 0.188 70.08 / 0.1)",
        border: "oklch(0.769 0.188 70.08 / 0.3)",
      };
    case "canceled":
      return {
        label: "Canceled",
        color: "oklch(0.5 0.01 264)",
        bg: "oklch(0.5 0.01 264 / 0.1)",
        border: "oklch(0.5 0.01 264 / 0.3)",
      };
    default:
      return {
        label: status,
        color: "oklch(0.5 0.01 264)",
        bg: "oklch(0.5 0.01 264 / 0.1)",
        border: "oklch(0.5 0.01 264 / 0.3)",
      };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5 border flex items-start gap-4"
      style={{
        backgroundColor: accent ? "oklch(0.696 0.17 162.48 / 0.06)" : "oklch(0.14 0.01 264)",
        borderColor: accent ? "oklch(0.696 0.17 162.48 / 0.25)" : "oklch(0.22 0.01 264)",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: accent ? "oklch(0.696 0.17 162.48 / 0.15)" : "oklch(0.19 0.01 264)",
          color: accent ? "oklch(0.696 0.17 162.48)" : "oklch(0.55 0.01 264)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-widest mb-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          {label}
        </p>
        <div className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 264)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Invoice History ─────────────────────────────────────────────────────────

type Invoice = {
  id: string;
  number: string;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number;
  invoicePdf: string | null | undefined;
  hostedInvoiceUrl: string | null | undefined;
};

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

function InvoiceStatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const colors: Record<string, { color: string; bg: string; border: string }> = {
    paid: { color: "oklch(0.696 0.17 162.48)", bg: "oklch(0.696 0.17 162.48 / 0.1)", border: "oklch(0.696 0.17 162.48 / 0.3)" },
    open: { color: "oklch(0.769 0.188 70.08)", bg: "oklch(0.769 0.188 70.08 / 0.1)", border: "oklch(0.769 0.188 70.08 / 0.3)" },
    void: { color: "oklch(0.5 0.01 264)", bg: "oklch(0.5 0.01 264 / 0.1)", border: "oklch(0.5 0.01 264 / 0.3)" },
    uncollectible: { color: "oklch(0.65 0.22 25)", bg: "oklch(0.65 0.22 25 / 0.1)", border: "oklch(0.65 0.22 25 / 0.3)" },
  };
  const c = colors[s] ?? colors.void;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
      style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      {s}
    </span>
  );
}

function InvoiceHistory({ customerId }: { customerId: string }) {
  const { data: invoices, isLoading, isError } = trpc.stripe.getInvoices.useQuery(undefined, {
    enabled: !!customerId,
    retry: 1,
  });

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "oklch(0.22 0.01 264)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b"
        style={{ backgroundColor: "oklch(0.14 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
      >
        <Receipt size={16} style={{ color: "oklch(0.696 0.17 162.48)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 264)" }}>
          Invoice History
        </h3>
        <span className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
          Last 10 invoices
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10" style={{ backgroundColor: "oklch(0.12 0.01 264)" }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "oklch(0.45 0.01 264)" }} />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ backgroundColor: "oklch(0.12 0.01 264)" }}>
          <AlertTriangle size={22} style={{ color: "oklch(0.65 0.22 25)" }} />
          <p className="text-sm font-medium" style={{ color: "oklch(0.65 0.22 25)" }}>Could not load invoices</p>
          <p className="text-xs text-center max-w-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
            There was a problem retrieving your billing history. Please refresh the page or use the Manage Billing button to view invoices in the Stripe portal.
          </p>
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ backgroundColor: "oklch(0.12 0.01 264)" }}>
          <FileText size={24} style={{ color: "oklch(0.3 0.01 264)" }} />
          <p className="text-sm" style={{ color: "oklch(0.45 0.01 264)" }}>No invoices yet</p>
        </div>
      ) : (
        <div style={{ backgroundColor: "oklch(0.12 0.01 264)" }}>
          {invoices.map((inv: Invoice, i: number) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-4 px-6 py-4 border-b last:border-b-0"
              style={{ borderColor: "oklch(0.18 0.01 264)" }}
            >
              {/* Left: number + date */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "oklch(0.85 0.005 264)" }}>
                  {inv.number}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.01 264)" }}>
                  {new Date(inv.created).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
              {/* Middle: amount + status */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-semibold tabular-nums" style={{ color: "oklch(0.9 0.005 264)" }}>
                  {formatCurrency(inv.amountPaid, inv.currency)}
                </span>
                <InvoiceStatusBadge status={inv.status} />
              </div>
              {/* Right: download links */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {inv.invoicePdf && (
                  <a
                    href={inv.invoicePdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
                    style={{ borderColor: "oklch(0.25 0.01 264)", color: "oklch(0.55 0.01 264)", backgroundColor: "transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.696 0.17 162.48)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "oklch(0.696 0.17 162.48 / 0.4)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.55 0.01 264)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "oklch(0.25 0.01 264)"; }}
                  >
                    <Download size={11} />
                    PDF
                  </a>
                )}
                {inv.hostedInvoiceUrl && (
                  <a
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
                    style={{ borderColor: "oklch(0.25 0.01 264)", color: "oklch(0.55 0.01 264)", backgroundColor: "transparent" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.769 0.188 70.08)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "oklch(0.769 0.188 70.08 / 0.4)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.55 0.01 264)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "oklch(0.25 0.01 264)"; }}
                  >
                    <ExternalLink size={11} />
                    View
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PYTHIA run history (persisted pipeline runs) ─────────────────────────────

function PipelineRunHistoryCard() {
  const { data, isLoading } = trpc.pipeline.getRunHistory.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl p-6 border flex items-center gap-2 text-sm" style={{ borderColor: "oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)" }}>
        <Loader2 size={16} className="animate-spin" />
        Loading run history…
      </div>
    );
  }

  if (!data?.length) return null;

  return (
    <div className="rounded-xl p-6 border" style={{ backgroundColor: "oklch(0.12 0.01 264)", borderColor: "oklch(0.2 0.01 264)" }}>
      <h3 className="font-semibold text-sm mb-3" style={{ color: "oklch(0.9 0.005 264)" }}>
        PYTHIA run history
      </h3>
      <ul className="space-y-2">
        {data.map((r) => (
          <li key={r.runId} className="text-xs flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-0" style={{ borderColor: "oklch(0.18 0.01 264)", color: "oklch(0.65 0.01 264)" }}>
            <span className="font-mono truncate max-w-[200px]" title={r.startupUrl}>
              {r.startupUrl}
            </span>
            <span>{r.matchCount} matches</span>
            <Link href={`/activate?run=${encodeURIComponent(r.runId)}`} className="text-emerald-400 shrink-0">
              Open
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Admin without Stripe subscription ──────────────────────────────────────

function AdminAccountPanel({ userName }: { userName: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto text-center py-16"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)" }}
      >
        <ShieldCheck size={28} style={{ color: "oklch(0.696 0.17 162.48)" }} />
      </div>
      <h2 className="font-display font-bold text-2xl mb-3" style={{ color: "oklch(0.97 0.005 264)" }}>
        Admin access{userName ? `, ${userName.split(" ")[0]}` : ""}
      </h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "oklch(0.55 0.01 264)" }}>
        Platform admin — outreach, scoring, and campaigns do not require an Oracle subscription.
        Use the admin console to generate drafts, review emails, and run campaigns.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/admin/outreach">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ backgroundColor: "oklch(0.55 0.2 25)", color: "#fff", border: "1px solid oklch(0.65 0.2 25)" }}
          >
            <Send size={15} />
            Outreach
          </button>
        </Link>
        <Link href="/admin">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all border"
            style={{ borderColor: "oklch(0.696 0.17 162.48 / 0.35)", color: "oklch(0.696 0.17 162.48)", backgroundColor: "transparent" }}
          >
            <ShieldCheck size={15} />
            Admin console
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── No-subscription state ────────────────────────────────────────────────────

function NoSubscription({ userName }: { userName: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto text-center py-20"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.1)", border: "1px solid oklch(0.769 0.188 70.08 / 0.25)" }}
      >
        <Zap size={28} style={{ color: "oklch(0.769 0.188 70.08)" }} />
      </div>
      <h2 className="font-display font-bold text-2xl mb-3" style={{ color: "oklch(0.97 0.005 264)" }}>
        No active plan{userName ? `, ${userName.split(" ")[0]}` : ""}
      </h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "oklch(0.55 0.01 264)" }}>
        You don't have an Oracle plan yet. Activate PYTHIA to start automating your fundraising pipeline — investor matching, outreach, follow-ups, and meeting booking on autopilot.
      </p>
      <Link href="/pricing">
        <button
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px oklch(0.769 0.188 70.08 / 0.4)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          View Plans
          <ArrowRight size={15} />
        </button>
      </Link>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Account() {
  const [, navigate] = useLocation();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(
    () =>
      (typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("code")) ||
      isOAuthHandoffActive(),
  );
  const [oauthError, setOauthError] = useState<string | null>(() => {
    if (typeof sessionStorage === "undefined") return null;
    const msg = sessionStorage.getItem("pythh_oauth_error");
    if (msg) {
      sessionStorage.removeItem("pythh_oauth_error");
      return msg;
    }
    return null;
  });
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    markOAuthHandoffFromRedirect();
  }, []);

  useEffect(() => {
    const onOAuthError = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      if (typeof msg === "string" && msg) {
        setOauthError(msg);
        setOauthBusy(false);
      }
    };
    window.addEventListener("pythh-oauth-error", onOAuthError);
    return () => window.removeEventListener("pythh-oauth-error", onOAuthError);
  }, []);

  useEffect(() => {
    if (!oauthBusy) return;
    const poll = window.setInterval(() => {
      const msg = sessionStorage.getItem("pythh_oauth_error");
      if (msg) {
        sessionStorage.removeItem("pythh_oauth_error");
        setOauthError(msg);
        setOauthBusy(false);
      }
    }, 400);
    return () => window.clearInterval(poll);
  }, [oauthBusy]);

  useEffect(() => {
    if (isAuthenticated) {
      wasAuthenticated.current = true;
      setOauthBusy(false);
      clearOAuthHandoff();
      const next = readPostLoginPath();
      if (next && next !== "/account") navigate(next);
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!oauthBusy) return;
    const watchdog = window.setTimeout(() => {
      if (wasAuthenticated.current) return;
      const stored = sessionStorage.getItem("pythh_oauth_error");
      setOauthBusy(false);
      setOauthError(
        stored ||
          "Sign-in is taking too long. Please try again or use email sign-in.",
      );
      sessionStorage.removeItem("pythh_oauth_error");
    }, 45_000);
    return () => window.clearTimeout(watchdog);
  }, [oauthBusy]);

  useEffect(() => {
    if (oauthBusy || oauthError) return;
    if (authLoading || isAuthenticated) return;
    if (isOAuthHandoffActive()) return;

    const delay = wasAuthenticated.current ? 0 : 12_000;
    const timer = window.setTimeout(() => {
      if (isOAuthHandoffActive()) return;
      void utils.auth.me.fetch().then((me) => {
        if (me) return;
        if (wasAuthenticated.current) {
          setOauthError("Your session expired. Please sign in again.");
          return;
        }
        window.location.href = getLoginUrl("/account");
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [authLoading, isAuthenticated, oauthBusy, oauthError, utils.auth.me]);

  const { data: subscription, isLoading: subLoading, refetch: refetchSubscription } =
    trpc.stripe.getSubscriptionDetails.useQuery(undefined, {
      enabled: isAuthenticated,
      retry: false,
    });

  const portalMutation = trpc.stripe.createPortalSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error("Could not open billing portal", {
        description: err.message || "Please try again or contact support.",
        duration: 4000,
      });
    },
  });

  const resumeMutation = trpc.stripe.resumeSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription resumed", {
        description: "Your Oracle plan billing has been restored. Welcome back!",
        duration: 4000,
      });
      refetchSubscription();
    },
    onError: (err) => {
      toast.error("Could not resume subscription", {
        description: err.message || "Please try again or contact support.",
        duration: 4000,
      });
    },
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const handleOpenPortal = () => {
    portalMutation.mutate({ returnUrl: window.location.href });
  };
  // Opens the cancellation modal; only active/trialing subscribers see it.
  const handleManageBillingClick = () => {
    const isActiveSub = subscription?.status === "active" || subscription?.status === "trialing";
    if (isActiveSub) {
      setShowCancelModal(true);
    } else {
      // For paused/past_due/etc., go straight to portal.
      handleOpenPortal();
    }
  };

  const isLoading = authLoading || subLoading || oauthBusy;

  if (oauthError && !isAuthenticated && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
        <div className="text-center max-w-sm">
          <p className="text-sm mb-4" style={{ color: "oklch(0.75 0.15 27)" }}>{oauthError}</p>
          <a href="/login" className="text-sm font-medium" style={{ color: "#22d3ee" }}>Back to sign in</a>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: "oklch(0.696 0.17 162.48)" }} />
          <p className="text-sm" style={{ color: "oklch(0.45 0.01 264)" }}>
            {oauthBusy ? "Completing Google/GitHub sign-in…" : "Loading your account…"}
          </p>
          {oauthError && (
            <p className="text-xs text-center max-w-xs px-3" style={{ color: "oklch(0.75 0.15 27)" }}>
              {oauthError}{" "}
              <a href="/login" style={{ color: "#22d3ee" }}>Try again</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  const status = subscription ? statusLabel(subscription.status) : null;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>My Account — Pythh.ai</title>
        <meta name="description" content="Manage your Pythh.ai Oracle plan subscription, view billing history, and access the Stripe customer portal." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Nav */}
      <nav
        className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{
          backgroundColor: "oklch(0.09 0.01 264 / 0.95)",
          borderColor: "oklch(0.18 0.01 264)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link href="/" className="flex items-center gap-3 group">
          <ChevronLeft size={16} style={{ color: "oklch(0.5 0.01 264)" }} />
          <div>
            <span className="font-display font-bold text-lg" style={{ color: "oklch(0.97 0.005 264)" }}>
              pythh.ai
            </span>
            <span className="text-xs ml-2 font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>
              SIGNAL SCIENCE
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "oklch(0.22 0.01 264)", backgroundColor: "oklch(0.13 0.01 264)" }}>
              <User size={13} style={{ color: "oklch(0.5 0.01 264)" }} />
              <span className="text-xs" style={{ color: "oklch(0.65 0.01 264)" }}>
                {user.email ?? user.name ?? "Account"}
              </span>
            </div>
          )}
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
            style={{
              borderColor: "oklch(0.22 0.01 264)",
              color: "oklch(0.5 0.01 264)",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.75 0.01 264)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.5 0.01 264)"; }}
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-6" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.696 0.17 162.48)" }}>
              ACCOUNT
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl" style={{ color: "oklch(0.97 0.005 264)" }}>
            Your Plan
          </h1>
          <p className="text-sm mt-2" style={{ color: "oklch(0.5 0.01 264)" }}>
            Manage your Oracle subscription and billing details.
          </p>
        </motion.div>

        {/* No subscription */}
        {!subscription && user?.role === "admin" && (
          <AdminAccountPanel userName={user?.name ?? null} />
        )}
        {!subscription && user?.role !== "admin" && (
          <NoSubscription userName={user?.name ?? null} />
        )}

        {/* Active subscription dashboard */}
        {subscription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="space-y-6"
          >
            {/* Plan hero card */}
            <div
              className="rounded-2xl p-6 border relative overflow-hidden"
              style={{
                backgroundColor: "oklch(0.13 0.01 264)",
                borderColor: isActive ? "oklch(0.696 0.17 162.48 / 0.3)" : "oklch(0.22 0.01 264)",
              }}
            >
              {/* Top accent line */}
              {isActive && (
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{ background: "linear-gradient(90deg, transparent, oklch(0.696 0.17 162.48), transparent)" }}
                />
              )}

              {/* Subtle glow */}
              {isActive && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 opacity-10 blur-3xl pointer-events-none"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }}
                />
              )}

              <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)",
                      border: "1px solid oklch(0.696 0.17 162.48 / 0.25)",
                    }}
                  >
                    <Zap size={22} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="font-display font-bold text-xl" style={{ color: "oklch(0.97 0.005 264)" }}>
                        PYTHIA Oracle
                      </h2>
                      {status && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{
                            backgroundColor: status.bg,
                            color: status.color,
                            border: `1px solid ${status.border}`,
                          }}
                        >
                          {status.label}
                        </span>
                      )}
                      {subscription.cancelAtPeriodEnd === 1 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: "oklch(0.65 0.22 25 / 0.1)",
                            color: "oklch(0.65 0.22 25)",
                            border: "1px solid oklch(0.65 0.22 25 / 0.3)",
                          }}
                        >
                          Cancels {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "at period end"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                      Full pipeline automation — investor matching, outreach &amp; meeting booking
                    </p>
                  </div>
                </div>

                {/* Price display */}
                <div className="text-right flex-shrink-0">
                  <p className="font-display font-bold text-2xl" style={{ color: "oklch(0.97 0.005 264)" }}>
                    {subscription.billingCycle === "annual" ? "$249" : "$299"}
                    <span className="text-sm font-normal ml-1" style={{ color: "oklch(0.45 0.01 264)" }}>
                      /mo
                    </span>
                  </p>
                  <p className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
                    {subscription.billingCycle === "annual"
                      ? "Billed annually · $2,988/yr"
                      : "Billed monthly"}
                  </p>
                </div>
              </div>
            </div>

            {/* Billing details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard
                icon={<CreditCard size={18} />}
                label="BILLING CYCLE"
                value={subscription.billingCycle === "annual" ? "Annual (save 17%)" : "Monthly"}
                accent={subscription.billingCycle === "annual"}
              />
              <InfoCard
                icon={<CalendarDays size={18} />}
                label="NEXT RENEWAL"
                value={
                  subscription.status === "canceled"
                    ? "Plan ends " + formatDate(subscription.currentPeriodEnd)
                    : formatDate(subscription.currentPeriodEnd)
                }
              />
              <InfoCard
                icon={<ShieldCheck size={18} />}
                label="PLAN STATUS"
                value={
                  <span style={{ color: status?.color }}>
                    {status?.label ?? subscription.status}
                  </span>
                }
              />
              <InfoCard
                icon={<RefreshCcw size={18} />}
                label="MEMBER SINCE"
                value={formatDate(subscription.createdAt?.getTime())}
              />
            </div>

            {/* Past due warning */}
            {subscription.status === "past_due" && (
              <div
                className="rounded-xl p-4 border flex items-start gap-3"
                style={{
                  backgroundColor: "oklch(0.65 0.22 25 / 0.08)",
                  borderColor: "oklch(0.65 0.22 25 / 0.3)",
                }}
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "oklch(0.65 0.22 25)" }} />
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.65 0.22 25)" }}>
                    Payment past due
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>
                    Your last payment failed. Please update your payment method to keep PYTHIA running. Click "Manage Billing" below to resolve this.
                  </p>
                </div>
              </div>
            )}

            {/* Resume Subscription CTA — only shown when paused */}
            {subscription?.status === "paused" && (
              <div
                className="rounded-xl p-6 border"
                style={{
                  backgroundColor: "oklch(0.696 0.17 162.48 / 0.06)",
                  borderColor: "oklch(0.696 0.17 162.48 / 0.35)",
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCcw size={15} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                      <h3 className="font-semibold text-sm" style={{ color: "oklch(0.9 0.005 264)" }}>
                        Resume Your Subscription
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>
                      Your Oracle plan is currently paused — no charges are being made. Resume billing to restore full PYTHIA pipeline access immediately.
                    </p>
                  </div>
                  <button
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "oklch(0.696 0.17 162.48)",
                      color: "oklch(0.1 0.01 162)",
                    }}
                    onMouseEnter={(e) => {
                      if (!resumeMutation.isPending) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.75 0.17 162.48)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px oklch(0.696 0.17 162.48 / 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.696 0.17 162.48)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    {resumeMutation.isPending ? (
                      <><Loader2 size={14} className="animate-spin" /> Resuming…</>
                    ) : (
                      <><RefreshCcw size={14} /> Resume Billing</>
                    )}
                  </button>
                </div>
              </div>
            )}

            <PipelineRunHistoryCard />

            {/* Customer Portal CTA */}
            <div
              className="rounded-xl p-6 border"
              style={{ backgroundColor: "oklch(0.12 0.01 264)", borderColor: "oklch(0.2 0.01 264)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: "oklch(0.9 0.005 264)" }}>
                    Manage Billing
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>
                    Update your payment method, download invoices, switch billing cycle, or cancel your subscription — all through the secure Stripe portal.
                  </p>
                </div>
                <button
                  onClick={handleManageBillingClick}
                  disabled={portalMutation.isPending}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: "oklch(0.696 0.17 162.48)",
                    color: "oklch(0.1 0.01 162)",
                  }}
                  onMouseEnter={(e) => {
                    if (!portalMutation.isPending) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.75 0.17 162.48)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px oklch(0.696 0.17 162.48 / 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.696 0.17 162.48)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  {portalMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Opening portal…</>
                  ) : (
                    <><ExternalLink size={14} /> Manage Billing</>
                  )}
                </button>
              </div>
            </div>

            {/* Invoice History */}
            {subscription?.stripeCustomerId && (
              <InvoiceHistory customerId={subscription.stripeCustomerId} />
            )}

            {/* Quick links */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/profile">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border transition-all"
                  style={{
                    borderColor: "oklch(0.22 0.01 264)",
                    color: "oklch(0.55 0.01 264)",
                    backgroundColor: "transparent",
                  }}
                >
                  <User size={12} />
                  Founder profile
                </button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border transition-all"
                    style={{
                      borderColor: "oklch(0.696 0.17 162.48 / 0.35)",
                      color: "oklch(0.696 0.17 162.48)",
                      backgroundColor: "transparent",
                    }}
                  >
                    <ShieldCheck size={12} />
                    Admin
                  </button>
                </Link>
              )}
              <Link href="/activate">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border transition-all"
                  style={{
                    borderColor: "oklch(0.22 0.01 264)",
                    color: "oklch(0.55 0.01 264)",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.769 0.188 70.08)"; (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.769 0.188 70.08 / 0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.01 264)"; (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.01 264)"; }}
                >
                  <Zap size={12} />
                  Launch PYTHIA
                </button>
              </Link>
              <Link href="/">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border transition-all"
                  style={{
                    borderColor: "oklch(0.22 0.01 264)",
                    color: "oklch(0.55 0.01 264)",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.75 0.01 264)"; (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.35 0.01 264)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.01 264)"; (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.01 264)"; }}
                >
                  Back to Home
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>

      {/* Cancellation confirmation modal */}
      <CancelConfirmModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onPaused={() => { void refetchSubscription(); }}
        onDowngraded={() => { void refetchSubscription(); }}
        onConfirmCancel={handleOpenPortal}
        renewalDate={subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : undefined}
      />
    </div>
  );
}
