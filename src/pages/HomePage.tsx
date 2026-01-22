/**
 * PYTHH HOMEPAGE — CANONICAL SURFACE (Phase A)
 * ============================================
 * Minimal chrome, CTA-first, live intrigue below fold
 * Fixed: controlled input, URL normalization, submit handler
 */

import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, url: "", reason: "empty" };

  // allow domain-only input
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const u = new URL(withProto);
    // require host at minimum
    if (!u.hostname || u.hostname.length < 3) {
      return { ok: false, url: "", reason: "bad_host" };
    }
    return { ok: true, url: u.toString(), reason: "" };
  } catch {
    return { ok: false, url: "", reason: "invalid" };
  }
}

export default function Home() {
  const navigate = useNavigate();
  const [rawUrl, setRawUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const parsed = useMemo(() => normalizeUrl(rawUrl), [rawUrl]);
  const showError = touched && !parsed.ok && rawUrl.trim().length > 0;

  function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!parsed.ok) return;

    // Phase A: route to a placeholder startup page (Phase B: call API)
    const encoded = encodeURIComponent(parsed.url);
    navigate(`/app/startup/new?url=${encoded}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="text-5xl md:text-7xl font-semibold tracking-tight">
        Find my investors.
      </h1>

      <div className="mt-4 text-xl text-white/70">
        We show you who matters and why.
      </div>

      <form className="mt-10" onSubmit={onSubmit}>
        <label className="block text-sm text-white/60 mb-2">Enter your startup URL</label>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              value={rawUrl}
              onChange={(e) => setRawUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="yourstartup.com"
              className={[
                "w-full rounded-xl border px-5 py-4 bg-black/40 text-white outline-none",
                showError ? "border-rose-400/60" : "border-white/10",
                "focus:border-white/25",
              ].join(" ")}
              autoComplete="off"
              inputMode="url"
            />
            {showError && (
              <div className="mt-2 text-sm text-rose-300/90">
                Enter a valid URL (example: yourstartup.com)
              </div>
            )}
          </div>

          <button
            type="submit"
            className="md:min-w-[260px] rounded-xl px-6 py-4 font-semibold bg-[#f2b300] text-black hover:brightness-110 transition"
          >
            Find my investors
          </button>
        </div>
      </form>

      {/* Secondary links (keep, but visually subordinate) */}
      <div className="mt-6 flex gap-3">
        <Link
          to="/live"
          className="text-sm px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20 transition"
        >
          See live signals →
        </Link>
        <Link
          to="/signals"
          className="text-sm px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-white/20 transition"
        >
          See how signals flow →
        </Link>
      </div>

      <div className="mt-4 text-sm text-white/45">
        No pitch deck · No warm intro · No brokers · Just signals and timing
      </div>

      {/* Below the fold seed: keep light for now */}
      <div className="mt-10 text-sm text-white/60">
        <span className="text-white/80 font-semibold">Live signals</span> (sample)
      </div>

      <div className="mt-3 space-y-3 text-sm text-white/70">
        <div className="flex items-baseline justify-between gap-4">
          <div><span className="text-white/85 font-semibold">Sequoia</span> · Partner mention: agent infrastructure</div>
          <div className="text-white/40 whitespace-nowrap">1h ago</div>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <div><span className="text-white/85 font-semibold">Accel</span> · Seed velocity spike in agent tooling</div>
          <div className="text-white/40 whitespace-nowrap">20m ago</div>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <div><span className="text-white/85 font-semibold">Greylock</span> · Thesis published: developer automation</div>
          <div className="text-white/40 whitespace-nowrap">today</div>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <div><span className="text-white/85 font-semibold">Khosla</span> · Thesis convergence: compute efficiency</div>
          <div className="text-white/40 whitespace-nowrap">today</div>
        </div>
      </div>
    </div>
  );
}
