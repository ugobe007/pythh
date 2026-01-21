/**
 * INTELLIGENCE LEAK — Leaking Map Layout
 * =======================================
 * 
 * Leaked telemetry, not a demo card.
 * Right-weighted. Alive. Partial revelation.
 * 
 * INVARIANTS:
 * • Startup name
 * • 3 top investors
 * • Signal scores
 * • One causal "Why" block
 * 
 * MUST FEEL LIKE:
 * • live telemetry
 * • partial revelation
 * • leaked intelligence
 * 
 * FORBIDDEN:
 * • Cards
 * • Panels
 * • Shadows
 * • "Example" labels
 * • "Demo" framing
 * • Click interactions
 * • Full result lists
 * • Expand/collapse UI
 */

import { useEffect, useState } from "react";

const LEAKS = [
  {
    startup: "Rovi Health",
    matches: [
      { name: "US Seed Operator Fund", score: 72 },
      { name: "Health Infra Partners", score: 69 },
      { name: "Seed Stage Capital", score: 66 },
    ],
    why: [
      "Portfolio adjacency detected",
      "Market signals forming",
      "Execution cadence improving",
    ],
  },
  {
    startup: "Atlas Robotics",
    matches: [
      { name: "DeepTech Ventures", score: 74 },
      { name: "Industrial AI Fund", score: 71 },
      { name: "Future Mobility Capital", score: 68 },
    ],
    why: [
      "Category convergence emerging",
      "Technical credibility increasing",
      "Customer proof forming",
    ],
  },
];

export function IntelligenceLeak() {
  const [index, setIndex] = useState(0);
  const current = LEAKS[index];

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % LEAKS.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full">

      <div className="text-neutral-500 text-sm mb-3">
        {current.startup}
      </div>

      <div className="space-y-2 mb-4">
        {current.matches.map((m) => (
          <div key={m.name} className="flex justify-between">
            <span>{m.name}</span>
            <span className="text-neutral-400">{m.score}%</span>
          </div>
        ))}
      </div>

      <div className="text-neutral-400 text-sm">
        Why:
        {current.why.map((w) => (
          <div key={w} className="ml-2">
            {w}
          </div>
        ))}
      </div>

    </div>
  );
}
