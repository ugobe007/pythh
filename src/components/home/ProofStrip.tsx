/**
 * THIN PROOF STRIP — Front Page Contract
 * =======================================
 * 
 * INVARIANTS:
 * • Not clickable
 * • No "demo" label
 * • No explanation text
 * • No CTA
 * • No interaction
 * 
 * Rotates between proof examples. Feels alive. Does not explain.
 */

import { HOME_CONTENT } from "@/config/homeContent";
import { useEffect, useState } from "react";

export function ProofStrip() {
  const [index, setIndex] = useState(0);
  const items = HOME_CONTENT.proofStrip;
  const current = items[index];

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => clearInterval(id);
  }, [items.length]);

  return (
    <section className="mt-6 text-sm text-neutral-300">
      <div className="mb-1 text-neutral-500">{current.startup}</div>

      <div className="mb-1">
        Top Matches:
        {current.matches.map((m) => (
          <div key={m.name}>
            • {m.name} — {m.score}%
          </div>
        ))}
      </div>

      <div className="text-neutral-400">
        Why:
        {current.why.map((w) => (
          <div key={w}>• {w}</div>
        ))}
      </div>
    </section>
  );
}
