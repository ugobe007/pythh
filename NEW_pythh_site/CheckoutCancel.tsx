/*
 * PYTHH.AI — CHECKOUT CANCEL PAGE
 * Design: Obsidian Terminal — Data Noir
 */
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { trackFunnelEventOnce } from "@/lib/matchEngagement";

export default function CheckoutCancel() {
  useEffect(() => {
    void trackFunnelEventOnce("pythh_checkout_cancelled", "checkout_cancelled", {
      plan: "oracle",
      path: "/checkout/cancel",
    });
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "oklch(0.09 0.01 264)" }}
    >
      <Helmet>
        <title>Checkout Cancelled — Pythh.ai</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Subtle radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-8 blur-3xl pointer-events-none"
        style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "oklch(0.769 0.188 70.08 / 0.1)",
              border: "1px solid oklch(0.769 0.188 70.08 / 0.3)",
            }}
          >
            <ArrowLeft size={28} style={{ color: "oklch(0.769 0.188 70.08)" }} />
          </div>
        </div>

        {/* Label */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest mb-5"
          style={{
            backgroundColor: "oklch(0.769 0.188 70.08 / 0.08)",
            color: "oklch(0.769 0.188 70.08)",
            border: "1px solid oklch(0.769 0.188 70.08 / 0.2)",
          }}
        >
          CHECKOUT CANCELLED
        </div>

        <h1
          className="font-display font-bold text-4xl mb-3 leading-tight"
          style={{ color: "oklch(0.97 0.005 264)" }}
        >
          No worries —<br />
          <span style={{ color: "oklch(0.769 0.188 70.08)" }}>come back anytime.</span>
        </h1>

        <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.55 0.01 264)" }}>
          Your checkout was cancelled and you have not been charged. The Oracle
          plan will be here whenever you're ready to activate PYTHIA.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/pricing">
            <button
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                backgroundColor: "oklch(0.769 0.188 70.08)",
                color: "oklch(0.1 0.01 70)",
              }}
            >
              Back to Pricing
              <ArrowRight size={14} />
            </button>
          </Link>
          <Link href="/">
            <button
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                backgroundColor: "transparent",
                color: "oklch(0.6 0.01 264)",
                border: "1.5px solid oklch(0.25 0.01 264)",
              }}
            >
              Back to home
              <ArrowRight size={14} />
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
