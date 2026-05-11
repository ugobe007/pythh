/**
 * PYTHH.AI — INVESTOR DETAIL SLIDE-OVER MODAL
 * Design: Obsidian Terminal — Data Noir
 *
 * Shows the full investor profile in a right-side slide-over panel.
 * Public investors are accessible to all; private profiles require Oracle.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  X,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  DollarSign,
  Layers,
  Activity,
  Lock,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt1(n: number | null | undefined): string {
  if (n == null) return "—";
  return (Math.round(n) / 10).toFixed(1);
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return <span style={{ color: "oklch(0.45 0.01 264)" }}>—</span>;
  const v = delta / 10;
  if (v > 0)
    return (
      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
        <TrendingUp size={12} />+{v.toFixed(1)}
      </span>
    );
  if (v < 0)
    return (
      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "oklch(0.65 0.22 25)" }}>
        <TrendingDown size={12} />{v.toFixed(1)}
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "oklch(0.45 0.01 264)" }}>
      <Minus size={12} />0.0
    </span>
  );
}

function SignalMeter({ value, max = 100 }: { value: number | null | undefined; max?: number }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "oklch(0.22 0.01 264)" }}>
      <div
        className="h-1.5 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: "oklch(0.696 0.17 162.48)" }}
      />
    </div>
  );
}

function SectorChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
        color: "oklch(0.696 0.17 162.48)",
        border: "1px solid oklch(0.696 0.17 162.48 / 0.25)",
      }}
    >
      {label}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
      <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 264)" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface InvestorDetailModalProps {
  investorId: number | null;
  onClose: () => void;
  isOracle: boolean;
}

export default function InvestorDetailModal({ investorId, onClose, isOracle }: InvestorDetailModalProps) {
  const isOpen = investorId !== null;

  const { data: investor, isLoading, isError, error } = trpc.investors.getById.useQuery(
    { id: investorId! },
    { enabled: isOpen, retry: 1 }
  );

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const isForbidden = isError && (error as { data?: { code?: string } })?.data?.code === "FORBIDDEN";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "oklch(0.05 0.01 264 / 0.7)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col overflow-hidden"
            style={{
              backgroundColor: "oklch(0.11 0.01 264)",
              borderLeft: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
              style={{ borderColor: "oklch(0.18 0.01 264)" }}
            >
              <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                INVESTOR PROFILE
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "oklch(0.45 0.01 264)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.9 0.005 264)"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "oklch(0.18 0.01 264)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.45 0.01 264)"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 size={24} className="animate-spin" style={{ color: "oklch(0.45 0.01 264)" }} />
                </div>
              ) : isForbidden ? (
                /* Oracle gate */
                <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center gap-5">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.1)", border: "1px solid oklch(0.769 0.188 70.08 / 0.3)" }}
                  >
                    <Lock size={24} style={{ color: "oklch(0.769 0.188 70.08)" }} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl mb-2" style={{ color: "oklch(0.97 0.005 264)" }}>
                      Oracle plan required
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>
                      Full investor profiles — including thesis details, portfolio velocity, and contact signals — are exclusively available to Oracle plan subscribers.
                    </p>
                  </div>
                  <Link href="/pricing">
                    <button
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                      style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}
                    >
                      Start 7-day free trial
                      <Zap size={14} />
                    </button>
                  </Link>
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
                  <AlertTriangle size={24} style={{ color: "oklch(0.65 0.22 25)" }} />
                  <p className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>
                    Could not load investor profile. Please try again.
                  </p>
                </div>
              ) : investor ? (
                <div className="px-6 py-6 space-y-6">
                  {/* Identity */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h2 className="font-display font-bold text-2xl leading-tight" style={{ color: "oklch(0.97 0.005 264)" }}>
                          {investor.name}
                        </h2>
                        <p className="text-sm font-medium mt-0.5" style={{ color: "oklch(0.55 0.01 264)" }}>
                          {investor.firm}
                        </p>
                      </div>
                      {/* Signal score badge */}
                      <div
                        className="flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center"
                        style={{
                          backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
                          border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
                        }}
                      >
                        <span className="font-mono font-bold text-xl leading-none" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                          {fmt1(investor.signal)}
                        </span>
                        <span className="text-xs font-bold tracking-widest mt-0.5" style={{ color: "oklch(0.45 0.01 264)" }}>
                          SIG
                        </span>
                      </div>
                    </div>

                    {/* Sectors */}
                    <div className="flex flex-wrap gap-2">
                      {investor.sector && <SectorChip label={investor.sector} />}
                      {investor.sector2 && <SectorChip label={investor.sector2} />}
                    </div>
                  </div>

                  {/* Signal meter */}
                  <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: "oklch(0.14 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
                        SIGNAL STRENGTH
                      </span>
                      <DeltaBadge delta={investor.delta} />
                    </div>
                    <SignalMeter value={investor.signal} max={100} />
                    <div className="flex justify-between mt-2">
                      <span className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>0</span>
                      <span className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>100</span>
                    </div>
                  </div>

                  {/* Oracle-gated scores */}
                  {isOracle ? (
                    <div
                      className="rounded-xl border overflow-hidden"
                      style={{ borderColor: "oklch(0.22 0.01 264)" }}
                    >
                      <div
                        className="px-4 py-3 border-b flex items-center gap-2"
                        style={{ backgroundColor: "oklch(0.14 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
                      >
                        <Activity size={13} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                        <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
                          INTELLIGENCE SCORES
                        </span>
                      </div>
                      <div className="px-4" style={{ backgroundColor: "oklch(0.12 0.01 264)" }}>
                        <StatRow label="GOD SCORE" value={investor.god != null ? investor.god : "—"} />
                        <StatRow label="VCPP SCORE" value={investor.vcpp != null ? investor.vcpp : "—"} />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-xl border p-4 flex items-center gap-3"
                      style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.05)", borderColor: "oklch(0.769 0.188 70.08 / 0.2)" }}
                    >
                      <Lock size={14} style={{ color: "oklch(0.769 0.188 70.08)" }} />
                      <p className="text-xs" style={{ color: "oklch(0.6 0.01 264)" }}>
                        GOD score and VCPP are available on the Oracle plan.
                      </p>
                    </div>
                  )}

                  {/* Profile details */}
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: "oklch(0.22 0.01 264)" }}
                  >
                    <div
                      className="px-4 py-3 border-b"
                      style={{ backgroundColor: "oklch(0.14 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
                    >
                      <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
                        PROFILE DETAILS
                      </span>
                    </div>
                    <div className="px-4" style={{ backgroundColor: "oklch(0.12 0.01 264)" }}>
                      <StatRow
                        label="CHECK SIZE"
                        value={
                          <span className="flex items-center gap-1">
                            <DollarSign size={12} style={{ color: "oklch(0.45 0.01 264)" }} />
                            {investor.checkSize ?? "—"}
                          </span>
                        }
                      />
                      <StatRow
                        label="STAGE"
                        value={
                          <span className="flex items-center gap-1">
                            <Layers size={12} style={{ color: "oklch(0.45 0.01 264)" }} />
                            {investor.stage ?? "—"}
                          </span>
                        }
                      />
                      <StatRow
                        label="GEOGRAPHY"
                        value={
                          <span className="flex items-center gap-1">
                            <MapPin size={12} style={{ color: "oklch(0.45 0.01 264)" }} />
                            {investor.geo ?? "—"}
                          </span>
                        }
                      />
                    </div>
                  </div>

                  {/* Recent activity */}
                  {investor.recentActivity && (
                    <div
                      className="rounded-xl border p-4"
                      style={{ backgroundColor: "oklch(0.14 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
                        </span>
                        <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
                          RECENT SIGNAL
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "oklch(0.7 0.01 264)" }}>
                        {investor.recentActivity}
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="pb-6">
                    {isOracle ? (
                      <Link href="/activate">
                        <button
                          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all"
                          style={{
                            backgroundColor: "oklch(0.769 0.188 70.08)",
                            color: "oklch(0.1 0.01 70)",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "oklch(0.82 0.188 70.08)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "oklch(0.769 0.188 70.08)"; }}
                        >
                          Request intro via PYTHIA
                          <ExternalLink size={14} />
                        </button>
                      </Link>
                    ) : (
                      <Link href="/pricing">
                        <button
                          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all"
                          style={{
                            backgroundColor: "oklch(0.696 0.17 162.48)",
                            color: "oklch(0.1 0.01 162)",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "oklch(0.75 0.17 162.48)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "oklch(0.696 0.17 162.48)"; }}
                        >
                          Unlock with Oracle plan
                          <Zap size={14} />
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
