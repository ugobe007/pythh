/**
 * PYTHH RESULTS PAGE — CAPITAL DESK READOUT
 * ==========================================
 * Frozen Layout v1.0
 * 
 * This is the ONLY allowed results page shape.
 * 
 * SPATIAL CONTRACT:
 * • Left-weighted hierarchy
 * • Across-the-page flow (wide, not portrait)
 * • Thin dividers, restrained boxes
 * • No card grids as primary structure
 * • No dashboard widgets above fold
 * 
 * SECTION ORDER (IMMUTABLE):
 * 0. Identity Header (thin, calm)
 * 1. Top 5 Matches (dominant)
 * 2. Misalignment (honesty block)
 * 3. Signal Mirror (orientation)
 * 4. This Week (leverage actions)
 * 5. Desire (blurred matches)
 * 6. Diagnostics (hidden toggle)
 * 
 * PHILOSOPHY:
 * /results is a ranked capital readout with causal whys and leverage—nothing else.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IdentityHeader,
  Top5Readout,
  MisalignmentReadout,
  SignalMirror,
  ThisWeekReadout,
  DesireBlurList,
  DiagnosticsToggle,
} from "@/components/results";

export default function ResultsPageSpatial() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");
  const [isLoading, setIsLoading] = useState(true);

  // TODO: Replace with real data fetching
  useEffect(() => {
    // Simulate data load
    setTimeout(() => setIsLoading(false), 500);
  }, [url]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-neutral-500">Loading capital readout...</div>
      </div>
    );
  }

  // MOCK DATA (replace with real API)
  const mockData = {
    identity: {
      startupName: "Rovi Health",
      domain: "rovi.health",
      posture: "Forming" as const,
      confidence: "High" as const,
    },
    top5: [
      {
        rank: 1,
        name: "US Seed Operator Fund",
        score: 72,
        distance: "warm" as const,
        why: "Portfolio adjacency + operator bias",
        align: "Publish benchmark → triggers infra thesis",
        causalReasons: [
          "3 portfolio companies in adjacent infrastructure",
          "Operator-led thesis matches your team profile",
          "Recent investments show category convergence",
        ],
        leverageActions: [
          "Publish technical benchmark (triggers pattern match)",
          "Add 1 named reference customer (flips proof signal)",
          "Tighten narrative to infrastructure positioning",
        ],
      },
      {
        rank: 2,
        name: "Health Infra Partners",
        score: 69,
        distance: "adjacent" as const,
        why: "Category convergence detected",
        align: "Add 1 named pilot → flips recognition",
      },
      {
        rank: 3,
        name: "Seed Stage Capital",
        score: 66,
        distance: "adjacent" as const,
        why: "Similar winners in portfolio",
        align: "Tighten narrative → reduces category blur",
      },
      {
        rank: 4,
        name: "Early Stage Ventures",
        score: 63,
        distance: "adjacent" as const,
        why: "Thesis alignment emerging",
        align: "Ship v2 feature → strengthens product signal",
      },
      {
        rank: 5,
        name: "Catalyst Fund",
        score: 60,
        distance: "cold" as const,
        why: "Market timing aligns with thesis refresh",
        align: "Publish case study → creates proof artifact",
      },
    ],
    misaligned: [
      {
        name: "Consumer Tech Fund",
        whyNot: "Portfolio focused on B2C, you're B2B infrastructure",
        missingSignals: ["consumer traction", "viral growth"],
      },
      {
        name: "Late Stage Capital",
        whyNot: "Stage mismatch (Series B+ only)",
        missingSignals: ["$10M+ ARR", "proven unit economics"],
      },
      {
        name: "AI-First Ventures",
        whyNot: "Not positioned as AI-native (orthogonal narrative)",
        missingSignals: ["ML differentiation", "AI research team"],
      },
    ],
    mirror: [
      "You're being read as infrastructure, not application.",
      "Your proof is inferred, not explicit.",
      "Your category is legible to operators, less legible to thesis funds.",
      "Team signals are stronger than traction signals.",
    ],
    thisWeek: [
      {
        action: "Publish technical benchmark",
        whyItMoves: "Triggers infrastructure pattern match across 8 portfolios",
      },
      {
        action: "Add 1 named reference customer",
        whyItMoves: "Flips proof signal from inferred to explicit",
      },
      {
        action: "Tighten narrative to infrastructure",
        whyItMoves: "Reduces category ambiguity (orthogonal → adjacent)",
      },
    ],
    desire: {
      moreAlignedCount: 23,
      moreMisalignedCount: 47,
      warmingCount: 12,
      partialMatches: [
        { whyPartial: "Portfolio adjacency forming", score: 58 },
        { whyPartial: "Thesis overlap emerging", score: 56 },
        { whyPartial: "Stage alignment detected", score: 54 },
        { whyPartial: "Category convergence starting", score: 52 },
        { whyPartial: "Market timing aligned", score: 50 },
      ],
    },
    diagnostics: {
      readinessScore: 67,
      gaps: [
        "No named reference customers",
        "Weak social proof signals",
        "Category positioning ambiguous",
      ],
      strengths: [
        "Strong team credentials",
        "Clear technical differentiation",
        "Operator network present",
      ],
    },
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="max-w-5xl mx-auto px-10 py-12">
        
        {/* SECTION 0 — IDENTITY HEADER */}
        <IdentityHeader {...mockData.identity} />

        {/* SECTION 1 — TOP 5 MATCHES (DOMINANT) */}
        <Top5Readout matches={mockData.top5} />

        {/* SECTION 2 — MISALIGNMENT (HONESTY BLOCK) */}
        <MisalignmentReadout investors={mockData.misaligned} />

        {/* SECTION 3 — SIGNAL MIRROR (ORIENTATION) */}
        <SignalMirror statements={mockData.mirror} />

        {/* SECTION 4 — THIS WEEK (LEVERAGE ACTIONS) */}
        <ThisWeekReadout actions={mockData.thisWeek} />

        {/* SECTION 5 — DESIRE (BLURRED MATCHES) */}
        <DesireBlurList {...mockData.desire} />

        {/* SECTION 6 — DIAGNOSTICS (HIDDEN) */}
        <DiagnosticsToggle diagnostics={mockData.diagnostics} />

      </main>
    </div>
  );
}
