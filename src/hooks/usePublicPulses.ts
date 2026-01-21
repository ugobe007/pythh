import { useEffect, useMemo, useState } from "react";
import type { PublicPulseQuery, PublicSignalPulse } from "../types/publicPulse";
import { fetchPublicPulses } from "../services/publicPulse/client";

/**
 * Single source of truth for public alignment feed.
 * Production-safe + demo-stable.
 */
export function usePublicPulses(query: PublicPulseQuery) {
  const key = useMemo(() => JSON.stringify(query), [query]);

  const [data, setData] = useState<PublicSignalPulse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchPublicPulses(query, { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;

        // Normal case: data returned
        if (rows && rows.length > 0) {
          setData(rows);
          setLoading(false);
          return;
        }

        // Dev-only fallback: prevent empty homepage demos
        if (import.meta.env.DEV) {
          console.warn("[usePublicPulses] Empty result set — using demo fallback pulses");
          const fallback = buildDemoFallback(query);
          setData(fallback);
          setLoading(false);
          return;
        }

        // Prod empty state (legitimate)
        setData([]);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;

        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        setLoading(false);

        // Dev fallback on error as well (demo stability)
        if (import.meta.env.DEV) {
          console.warn("[usePublicPulses] Error fetching pulses, using demo fallback:", msg);
          const fallback = buildDemoFallback(query);
          setData(fallback);
        }
      });

    return () => {
      controller.abort();
    };
  }, [key]);

  return { pulses: data, loading, error };
}

/* ------------------------------------------------------------------ */
/* Demo fallback pulses — deterministic, philosophy-aligned            */
/* Only used in DEV when backend returns empty or errors               */
/* ------------------------------------------------------------------ */

function buildDemoFallback(query: PublicPulseQuery): PublicSignalPulse[] {
  const base: PublicSignalPulse[] = [
    {
      pulseId: "demo-1",
      computedAt: new Date().toISOString(),
      isAnonymized: true,
      category: "AI DevTools",
      stageBand: "Seed",
      momentum: "Surge",
      timingWindow: "Active",
      alignmentBefore: 62,
      alignmentAfter: 78,
      readinessBefore: 55,
      readinessAfter: 71,
      triggerSignals: ["Product Velocity ↑", "Customer Proof ↑"],
      unlockedInvestorsCount: 9,
      investorClass: "Seed",
      recommendedAction: {
        title: "Strengthen customer proof narrative",
        probabilityDeltaPct: 14,
      },
    },
    {
      pulseId: "demo-2",
      computedAt: new Date().toISOString(),
      isAnonymized: true,
      category: "Infrastructure",
      stageBand: "Early A",
      momentum: "Warming",
      timingWindow: "Opening",
      alignmentBefore: 70,
      alignmentAfter: 82,
      readinessBefore: 64,
      readinessAfter: 76,
      triggerSignals: ["Narrative Shift → Platform", "Technical Depth ↑"],
      unlockedInvestorsCount: 6,
      investorClass: "Early A",
      recommendedAction: {
        title: "Reframe pitch as infrastructure platform",
        probabilityDeltaPct: 11,
      },
    },
    {
      pulseId: "demo-3",
      computedAt: new Date().toISOString(),
      isAnonymized: true,
      category: "Climate",
      stageBand: "Series A",
      momentum: "Stable",
      timingWindow: "Closing",
      alignmentBefore: 74,
      alignmentAfter: 80,
      readinessBefore: 69,
      readinessAfter: 73,
      triggerSignals: ["Category Tailwinds ↑"],
      unlockedInvestorsCount: 4,
      investorClass: "Series A",
    },
  ];

  // Apply light filtering so the demo still respects filters
  return base.filter((p) => {
    if (query.category && query.category !== "All" && p.category !== query.category) return false;
    if (query.stageBand && p.stageBand !== query.stageBand) return false;
    if (query.momentum && p.momentum !== query.momentum) return false;
    return true;
  });
}
