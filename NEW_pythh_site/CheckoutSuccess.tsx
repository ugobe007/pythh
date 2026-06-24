/*
 * PYTHH.AI — CHECKOUT SUCCESS PAGE
 * Design: Obsidian Terminal — Data Noir
 */
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { trackFunnelEvent, trackFunnelEventOnce } from "@/lib/matchEngagement";

export default function CheckoutSuccess() {
  useEffect(() => {
    window.scrollTo(0, 0);
    void trackFunnelEventOnce("pythh_checkout_completed", "checkout_completed", {
      plan: "oracle",
      path: "/checkout/success",
      session_id: new URLSearchParams(window.location.search).get("session_id") || undefined,
    });
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "oklch(0.09 0.01 264)" }}
    >
      <Helmet>
        <title>Trial Started — Pythh.ai</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)",
              border: "1px solid oklch(0.696 0.17 162.48 / 0.35)",
              boxShadow: "0 0 40px oklch(0.696 0.17 162.48 / 0.2)",
            }}
          >
            <CheckCircle2 size={36} style={{ color: "oklch(0.696 0.17 162.48)" }} />
          </div>
        </div>

        {/* Headline */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest mb-5"
          style={{
            backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
            color: "oklch(0.696 0.17 162.48)",
            border: "1px solid oklch(0.696 0.17 162.48 / 0.25)",
          }}
        >
          TRIAL STARTED
        </div>

        <h1
          className="font-display font-bold text-4xl mb-3 leading-tight"
          style={{ color: "oklch(0.97 0.005 264)" }}
        >
          Your 7-day trial<br />
          <span style={{ color: "oklch(0.696 0.17 162.48)" }}>has started.</span>
        </h1>

        <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.55 0.01 264)" }}>
          Welcome to the Oracle plan. PYTHIA will begin identifying and reaching
          out to investors on your behalf. You won't be charged until your
          7-day trial ends.
        </p>

        {/* Trial notice badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-8"
          style={{
            backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
            color: "oklch(0.696 0.17 162.48)",
            border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
          }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
          Cancel anytime before day 7 — no charge
        </div>

        {/* Steps */}
        <div
          className="rounded-2xl border p-5 mb-8 text-left space-y-4"
          style={{
            backgroundColor: "oklch(0.13 0.01 264)",
            borderColor: "oklch(0.22 0.01 264)",
          }}
        >
          {[
            { step: "01", title: "Check your inbox", desc: "A receipt and onboarding guide are on their way." },
            { step: "02", title: "Submit your startup URL", desc: "PYTHIA will analyse your pitch and map your investor targets." },
            { step: "03", title: "Approve & show up", desc: "Review the outreach brief, then let PYTHIA run the pipeline." },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <span
                className="font-mono text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ color: "oklch(0.696 0.17 162.48)" }}
              >
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.9 0.005 264)" }}>
                  {item.title}
                </p>
                <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/activate">
            <button
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                backgroundColor: "oklch(0.769 0.188 70.08)",
                color: "oklch(0.1 0.01 70)",
              }}
            >
              Activate PYTHIA
              <Zap size={14} />
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
