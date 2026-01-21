/**
 * INVOCATION PANEL — Leaking Map Layout
 * ======================================
 * 
 * Submit bar inside a panel.
 * Left-weighted. Instrument-like. Quiet.
 * 
 * INVARIANTS:
 * • No big CTA button
 * • No SaaS styling
 * • No boxed form feel
 * • No onboarding language
 * • Submit bar embedded in panel
 * 
 * FORBIDDEN:
 * • Center alignment
 * • Bulky rounded input
 * • "Submit URL"
 * • "Get started"
 * • "Try it now"
 */

import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function InvocationPanel() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();

  function handleSubmit() {
    if (!url.trim()) return;
    navigate(`/results?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <div className="border border-neutral-800 rounded-xl p-6 bg-neutral-950/60 backdrop-blur-sm">

      <h1 className="text-3xl font-medium tracking-tight mb-6">
        Find My Investors
      </h1>

      <div className="border border-neutral-700 rounded-md p-4">
        <div className="text-neutral-500 text-sm mb-2">
          Paste your startup website
        </div>

        <input
          className="w-full bg-transparent outline-none text-lg tracking-wide"
          placeholder="rovi.health"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </div>

    </div>
  );
}
