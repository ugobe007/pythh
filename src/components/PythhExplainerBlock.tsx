/**
 * PythhExplainerBlock — Supabase-style "What Pythh does" feature cards
 * Used on homepage to explain the platform before the Live teaser.
 */

import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: "🔗",
    title: "Drop your URL",
    description: "Paste your startup URL. We scan signals, news, and investor activity to build your profile.",
    to: "/signal-matches",
  },
  {
    icon: "📊",
    title: "GOD Score",
    description: "Get a single score (0–100) that predicts investor appeal based on traction, fit, and timing.",
    to: "/platform",
  },
  {
    icon: "🎯",
    title: "Ranked matches",
    description: "See your best investor fits ranked by signal strength—who’s active, who’s a fit, who’s ready.",
    to: "/signal-matches",
  },
  {
    icon: "⏱",
    title: "Signal timing",
    description: "Know when investors are most receptive. Fundraising is about who and when.",
    to: "/platform",
  },
  {
    icon: "📝",
    title: "Pitch scan",
    description: "Upload your deck or one-pager for AI-powered signal alignment and feedback.",
    to: "/submit",
  },
  {
    icon: "🔥",
    title: "Live feed",
    description: "Watch real founder–investor matches as they happen. See the market move.",
    to: "/hot-matches",
  },
];

export default function PythhExplainerBlock() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
        What Pythh does
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURES.map((f) => (
          <Link
            key={f.title}
            to={f.to}
            className="group block p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-800/30 transition-all"
          >
            <span className="text-lg">{f.icon}</span>
            <h3 className="mt-2 text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
              {f.title}
            </h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              {f.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
