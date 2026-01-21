/**
 * PRIMARY CTA COMPONENT — Front Page Contract
 * ============================================
 * 
 * INVARIANTS:
 * • No alternate CTA labels
 * • No right-hand widget
 * • No boxed form panel
 * • No SaaS styling
 * • No secondary CTAs
 * 
 * This is the ONLY allowed CTA on the front page.
 */

import { HOME_CONTENT } from "@/config/homeContent";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function PrimaryCTA() {
  const { headline, subtext, inputPlaceholder, buttonLabel } = HOME_CONTENT.cta;
  const [url, setUrl] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim()) return;
    navigate(`/results?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <section className="mb-8">
      <h1 className="text-5xl font-semibold tracking-tight mb-4">
        {headline}
      </h1>

      <p className="text-neutral-400 mb-6 max-w-xl mx-auto">
        {subtext}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
        <input
          className="w-80 bg-transparent border-b border-neutral-700 focus:border-neutral-400 outline-none text-lg text-center py-2"
          placeholder={inputPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <button
          type="submit"
          className="mt-2 px-8 py-3 rounded-full bg-neutral-100 text-neutral-900 font-medium hover:bg-neutral-200 transition"
        >
          {buttonLabel}
        </button>
      </form>
    </section>
  );
}
