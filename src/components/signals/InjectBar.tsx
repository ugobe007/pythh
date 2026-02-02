import React, { useMemo, useState } from "react";
import { SurfaceMode } from "@/types/signals";

function normalizeUrlInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, url: "", reason: "empty" as const };
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname || u.hostname.length < 3) return { ok: false, url: "", reason: "bad_host" as const };
    u.hash = "";
    return { ok: true, url: u.toString(), reason: "" as const };
  } catch {
    return { ok: false, url: "", reason: "invalid" as const };
  }
}

export default function InjectBar({
  mode,
  onSubmitUrl,
}: {
  mode: SurfaceMode;
  onSubmitUrl: (url: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const parsed = useMemo(() => normalizeUrlInput(raw), [raw]);

  const cta =
    mode === "tracking" ? "Track my signals" :
    mode === "reveal" ? "Start tracking" :
    mode === "injecting" ? "Injecting…" :
    "Inject into live feed";

  const disabled = mode === "injecting" || !parsed.ok;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6">
      <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-white/80 font-semibold">
              Inject your startup
            </div>
            <div className="text-xs text-white/60">
              Overlay your company on the live market signal feed — window, alignment, next moves.
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-[560px]">
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="autoops.ai"
              className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 text-white placeholder:text-white/35"
            />
            <button
              disabled={disabled}
              onClick={() => parsed.ok && onSubmitUrl(parsed.url)}
              className={[
                "px-5 py-3 rounded-xl font-semibold transition-all",
                disabled
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:from-cyan-300 hover:to-blue-400",
              ].join(" ")}
            >
              {cta} →
            </button>
          </div>
        </div>

        {!parsed.ok && raw.trim().length > 0 && (
          <div className="mt-2 text-xs text-red-300">
            {parsed.reason === "invalid" && "That doesn't look like a valid domain."}
            {parsed.reason === "bad_host" && "Please enter a real domain (e.g., autoops.ai)."}
          </div>
        )}
      </div>
    </div>
  );
}
