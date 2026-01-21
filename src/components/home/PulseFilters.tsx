import type { PublicMomentum, StageBand } from "../../types/publicPulse";

const STAGE_OPTIONS: Array<StageBand | "All"> = [
  "All",
  "Pre-Seed",
  "Seed",
  "Early A",
  "Series A",
  "Growth",
  "Unknown",
];

const MOMENTUM_OPTIONS: Array<PublicMomentum | "All"> = [
  "All",
  "Cooling",
  "Stable",
  "Warming",
  "Surge",
];

function isStageBand(v: string): v is StageBand {
  return (
    v === "Pre-Seed" ||
    v === "Seed" ||
    v === "Early A" ||
    v === "Series A" ||
    v === "Growth" ||
    v === "Unknown"
  );
}

function isMomentum(v: string): v is PublicMomentum {
  return v === "Cooling" || v === "Stable" || v === "Warming" || v === "Surge";
}

export default function PulseFilters({
  category,
  stageBand,
  momentum,
  categories,
  onChange,
}: {
  category: string;
  stageBand: StageBand | "All";
  momentum: PublicMomentum | "All";
  categories: string[];
  onChange: (next: { category: string; stageBand: StageBand | "All"; momentum: PublicMomentum | "All" }) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Show me startups like:</div>

        <button
          type="button"
          onClick={() => onChange({ category: "All", stageBand: "All", momentum: "All" })}
          className="text-xs text-white/50 hover:text-white/70 underline underline-offset-4"
        >
          reset
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-3">
        <select
          className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white"
          value={category}
          onChange={(e) => onChange({ category: e.target.value, stageBand, momentum })}
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white"
          value={stageBand}
          onChange={(e) => {
            const v = e.target.value;
            const next = v === "All" ? "All" : isStageBand(v) ? v : "All";
            onChange({ category, stageBand: next, momentum });
          }}
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Stages" : s}
            </option>
          ))}
        </select>

        <select
          className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white"
          value={momentum}
          onChange={(e) => {
            const v = e.target.value;
            const next = v === "All" ? "All" : isMomentum(v) ? v : "All";
            onChange({ category, stageBand, momentum: next });
          }}
        >
          {MOMENTUM_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === "All" ? "All Momentum" : m}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-white/40 mt-3">
        Filtered feed updates as signals change. Some startups are anonymized by default.
      </div>
    </div>
  );
}
