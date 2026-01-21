/**
 * PYTHH HOMEPAGE v1.0 — HUMAN-SMART SURFACE
 * ==========================================
 * See: PYTHH_HOMEPAGE_HUMANSPEC.md
 * See: PYTHH_DESIGN_LANGUAGE_CONTRACT.md
 * 
 * THIS IS NOT:
 * • A marketing page
 * • A demo page
 * • An onboarding page
 * 
 * THIS IS:
 * • A decision surface
 * 
 * THE JOB:
 * Make a serious founder think:
 * "This might actually give me an edge. I should try this right now."
 * 
 * GRID STRUCTURE (12-column):
 * • Left (6 cols) = Hero + Input + Social Proof
 * • Right (6 cols) = Intelligence Teaser + Live Preview
 * • Bottom (12 cols) = Value Props + Final CTA
 * 
 * INVARIANTS:
 * • Left-weighted, no center stack
 * • No SaaS hero
 * • No marketing gradients
 * • No mystical language
 * • No async input behavior
 * 
 * VISUAL WEIGHTS:
 * • Headline: 30%
 * • Input Panel: 25%
 * • Live Preview: 20%
 * • Intelligence Teaser: 15%
 * • Value Props: 8%
 * • Social Proof: 2%
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HOME_CONTENT } from "@/config/homeContent";

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
    <div className="min-h-screen bg-white">
      <main className="grid min-h-screen grid-cols-12 gap-8 px-8 py-12 max-w-7xl mx-auto">

        {/* LEFT — HERO + INPUT + SOCIAL PROOF */}
        <section className="col-span-12 md:col-span-6 space-y-8">
          {/* 1. HERO BLOCK */}
          <div>
            <h1 className="text-6xl font-bold text-neutral-900 mb-4 leading-tight">
              {HOME_CONTENT.hero.headline}
            </h1>
            <p className="text-xl text-neutral-600 leading-relaxed">
              {HOME_CONTENT.hero.subheadline}
            </p>
          </div>

          {/* 2. INPUT PANEL */}
          <div className="bg-neutral-50 p-8 rounded-lg border border-neutral-200">
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                {HOME_CONTENT.input.label}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={HOME_CONTENT.input.placeholder}
                className="w-full px-4 py-3 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                required
              />
              <button
                type="submit"
                className="mt-4 w-full bg-neutral-900 text-white py-3 rounded font-medium hover:bg-neutral-800 transition-colors"
              >
                {HOME_CONTENT.input.buttonLabel}
              </button>
            </form>
          </div>

          {/* 3. SOCIAL PROOF */}
          <div className="text-sm text-neutral-600">
            <p className="font-medium mb-2">{HOME_CONTENT.socialProof.label}</p>
            <ul className="space-y-1">
              {HOME_CONTENT.socialProof.examples.map((example, i) => (
                <li key={i}>
                  {example.startup} → {example.investor}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* RIGHT — INTELLIGENCE TEASER + LIVE PREVIEW */}
        <section className="col-span-12 md:col-span-6 space-y-6">
          {/* 4. INTELLIGENCE TEASER */}
          <div className="bg-neutral-900 text-white p-8 rounded-lg">
            {HOME_CONTENT.intelligenceTeaser.paragraphs.map((para, i) => (
              <p key={i} className={`text-lg leading-relaxed ${i > 0 ? "mt-4" : ""}`}>
                {para}
              </p>
            ))}
          </div>

          {/* 5. LIVE PREVIEW STRIP */}
          <div className="space-y-4">
            {HOME_CONTENT.livePreview.map((match, i) => (
              <div key={i} className="border-l-4 border-neutral-300 pl-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium text-neutral-900">{match.name}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-500">{match.score}%</span>
                    <span className="text-xs text-neutral-400">{match.state}</span>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 mt-1">
                  Why: {match.why}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM — VALUE PROPS + FINAL CTA */}
        <section className="col-span-12 mt-12 space-y-8">
          {/* 6. WHAT YOU ACTUALLY GET */}
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">
              {HOME_CONTENT.valueProps.heading}
            </h2>
            <ul className="space-y-3 text-lg text-neutral-700">
              {HOME_CONTENT.valueProps.bullets.map((bullet, i) => (
                <li key={i}>• {bullet}</li>
              ))}
            </ul>
          </div>

          {/* 7. FINAL CTA */}
          <button
            onClick={() => document.querySelector("input")?.focus()}
            className="bg-neutral-900 text-white px-8 py-4 rounded text-lg font-medium hover:bg-neutral-800 transition-colors"
          >
            {HOME_CONTENT.input.buttonLabel}
          </button>
        </section>

      </main>
    </div>
  );
}
