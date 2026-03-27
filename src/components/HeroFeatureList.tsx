/**
 * HeroFeatureList — High-level "What you get" for founders
 * Rule of 3: Only 3 points — more causes confusion.
 */

import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Signal scores",
    desc: "Real-time investor timing. See when VCs are heating up in your sector — pitch when they're looking.",
  },
  {
    title: "Top 50 matches",
    desc: "Ranked by fit, thesis alignment, and stage. No spray-and-pray.",
  },
  {
    title: "Intro lines",
    desc: "Copy-paste outreach for each investor. Get the meeting.",
  },
];

export default function HeroFeatureList() {
  return (
    <div className="space-y-6">
      <p className="text-xs uppercase tracking-widest text-cyan-400/80 font-semibold">
        What you get
      </p>
      <ul className="space-y-4">
        {FEATURES.map((f, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded border border-cyan-500/50 flex items-center justify-center text-cyan-400/90 text-xs font-bold">
              {i + 1}
            </span>
            <div>
              <span className="text-white/90 font-medium text-sm">{f.title}</span>
              <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <Link
        to="/about#how-pythh-works"
        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 rounded-md px-3 py-2 hover:border-cyan-400/60 transition-colors"
      >
        How it works
        <span className="text-cyan-500">→</span>
      </Link>
    </div>
  );
}
