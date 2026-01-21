/**
 * PYTHH HOMEPAGE v1.0 — HUMAN-SMART SURFACE
 * ==========================================
 * DESIGN: Dark theme, centered hero, live activity feed
 * LANGUAGE: Human-smart (per PYTHH_DESIGN_LANGUAGE_CONTRACT.md)
 * 
 * See: PYTHH_HOMEPAGE_HUMANSPEC.md
 * See: PYTHH_DESIGN_LANGUAGE_CONTRACT.md
 * 
 * VISUAL STRUCTURE:
 * • Top: Header with logo + sign in
 * • Hero: Centered headline + subhead + input
 * • Micro-trust line below input
 * • Live activity feed (investor matching happening now)
 * • Bottom: Social proof examples
 * 
 * INVARIANTS:
 * • Dark theme (black background)
 * • No async input behavior (submit only)
 * • Human-smart language (no mysticism)
 * • Activity feed shows real-time matching
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HOME_CONTENT } from "@/config/homeContent";

// Mock live activity data (replace with real data later)
const LIVE_ACTIVITY = [
  {
    text: "AI infrastructure startup matched with operator-focused seed funds",
    godScore: 88,
    timeAgo: "just now",
  },
  {
    text: "Clean energy startup gaining traction with climate tech investors",
    godScore: 85,
    timeAgo: "2m ago",
  },
  {
    text: "EdTech platform matched with education-focused seed funds",
    godScore: 71,
    timeAgo: "5m ago",
  },
];

export default function HomePage() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      navigate(`/results?url=${encodeURIComponent(url)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">pythh.ai</span>
        </div>
        <button className="text-sm text-neutral-400 hover:text-white transition-colors">
          Sign in
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-8 py-16">
        
        {/* HERO SECTION */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-6 leading-tight">
            {HOME_CONTENT.hero.headline}
          </h1>
          <p className="text-xl text-neutral-400 mb-3">
            {HOME_CONTENT.hero.subheadline.split('—')[0].trim()}.
          </p>
          <p className="text-xl text-neutral-400">
            {HOME_CONTENT.hero.subheadline.split('—')[1].trim()}.
          </p>
        </div>

        {/* INPUT SECTION */}
        <div className="mb-6">
          <form onSubmit={handleSubmit}>
            <label className="block text-sm text-neutral-400 mb-3">
              {HOME_CONTENT.input.label}
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={HOME_CONTENT.input.placeholder}
                className="flex-1 px-6 py-4 bg-neutral-900 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
              <button
                type="submit"
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded transition-colors"
              >
                {HOME_CONTENT.input.buttonLabel}
              </button>
            </div>
          </form>
        </div>

        {/* MICRO-TRUST LINE */}
        <div className="text-center mb-3">
          <p className="text-sm text-neutral-500">
            No pitch deck · No warm intro · Just signals
          </p>
        </div>

        {/* SECONDARY ACTION (SUBTLE) */}
        <div className="flex justify-center gap-4 mb-16">
          <button className="text-sm text-neutral-400 hover:text-white transition-colors px-4 py-2 border border-neutral-700 rounded">
            What you get
          </button>
        </div>

        {/* LIVE ACTIVITY FEED */}
        <div className="mb-12">
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
            Investor Matching Happening Now
          </h2>
          <div className="space-y-3">
            {LIVE_ACTIVITY.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded"
              >
                <div className="flex-1">
                  <p className="text-neutral-300 text-sm">
                    • {item.text}{" "}
                    <span className="text-orange-400 font-mono">
                      (GOD: {item.godScore})
                    </span>
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">{item.timeAgo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SOCIAL PROOF (BOTTOM) */}
        <div className="text-center">
          <p className="text-sm text-neutral-500 mb-2">
            {HOME_CONTENT.socialProof.label}
          </p>
          <div className="flex justify-center gap-8 text-sm text-neutral-400">
            {HOME_CONTENT.socialProof.examples.map((example, i) => (
              <span key={i}>
                {example.startup} → {example.investor}
              </span>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
