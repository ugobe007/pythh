/**
 * SIGNAL CARD (V2.1 — BULLETPROOF / NO BLANK PAGE)
 * ===============================================
 * Defensive rendering: never assume optional fields exist.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import type { SignalResult } from "../../types/signals";
import {
  getSignalStrength,
  formatTimeAgo,
  formatPercentage,
  getInitials,
} from "../../utils/signalHelpers";

interface SignalCardProps {
  signal: SignalResult;
  index: number;
}

type Tone = "good" | "neutral" | "caution";

function clamp0to100(n: number) {
  return Math.max(0, Math.min(100, n));
}

function safeText(x: any, fallback = "—") {
  const s = String(x ?? "").trim();
  return s ? s : fallback;
}

function safeNum(x: any, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safePct(x: any) {
  // formatPercentage may throw if it doesn't like undefined/null
  try {
    return formatPercentage(safeNum(x, 0));
  } catch {
    return "—";
  }
}

function statusToneFromScore(score0to100: number): Tone {
  if (score0to100 >= 80) return "good";
  if (score0to100 >= 55) return "neutral";
  return "caution";
}

/**
 * Optional evidence fields (safe to omit)
 * signal.evidence?: {
 *   portfolio?: string[];
 *   stage?: string[];
 *   velocity?: string[];
 *   geo?: string[];
 *   sources?: string[];
 *   confidence?: number; // 0-1
 *   percentile?: number; // 0-100
 * }
 */
function getEvidence(signal: any) {
  return (signal as any)?.evidence || {};
}

function confidenceLabel(conf?: number) {
  if (typeof conf !== "number") return null;
  if (conf >= 0.8) return "High confidence";
  if (conf >= 0.55) return "Medium confidence";
  return "Low confidence";
}

export default function SignalCard({ signal, index }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const score = clamp0to100(safeNum((signal as any)?.signalStrength, 0));
  const tone = statusToneFromScore(score);

  // These can be missing in real data — guard everything:
  const investor = (signal as any)?.investor ?? {};
  const match = (signal as any)?.matchBreakdown ?? {};
  const comp = (signal as any)?.composition ?? {};
  const pred = (signal as any)?.prediction ?? {};
  const lookingFor: string[] = Array.isArray((signal as any)?.lookingFor) ? (signal as any).lookingFor : [];
  const recentContext: any[] = Array.isArray((signal as any)?.recentContext) ? (signal as any).recentContext : [];

  const strength = getSignalStrength(score);
  const initials = investor.initials || getInitials(investor.name || "");

  const evidence = useMemo(() => getEvidence(signal), [signal]);
  const conf = typeof evidence.confidence === "number" ? evidence.confidence : undefined;
  const confText = confidenceLabel(conf);

  const sources: string[] = Array.isArray(evidence.sources) ? evidence.sources : [];
  const hasSources = sources.length > 0;

  const percentile =
    typeof evidence.percentile === "number" ? clamp0to100(evidence.percentile) : null;

  const meaning = useMemo(() => {
    if (score >= 85) return "Strong alignment. Priority outreach target.";
    if (score >= 70) return "Good alignment. Convert with the right angle + proof.";
    if (score >= 55) return "Moderate alignment. Tighten narrative or strengthen proof first.";
    return "Early/weak alignment. Improve signals or target a different investor profile.";
  }, [score]);

  const latestTrace = useMemo(() => {
    // formatTimeAgo may expect Date; your data might be string/undefined.
    try {
      const ts = (signal as any)?.timestamp;
      if (!ts) return "—";
      // If it's already a Date, pass it through; otherwise try Date parsing.
      const d = ts instanceof Date ? ts : new Date(ts);
      if (isNaN(d.getTime())) return "—";
      return formatTimeAgo(d);
    } catch {
      return "—";
    }
  }, [signal]);

  return (
    <div
      className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 hover:translate-y-[-4px] hover:shadow-lg transition-all duration-300"
      style={{ animation: `slideInRight 0.3s ease-out ${2500 + index * 200}ms both` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{strength.emoji}</span>
          <div>
            <div className={`text-sm font-bold ${strength.color} tracking-wider`}>
              {strength.label}
            </div>

            <div className="text-xs text-white/50 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Latest trace: {latestTrace}</span>
              {confText && (
                <>
                  <span className="text-white/30">•</span>
                  <span>{confText}</span>
                </>
              )}
              {percentile !== null && (
                <>
                  <span className="text-white/30">•</span>
                  <span>Percentile: {percentile}%</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-white/50 flex items-center gap-2">
          <Info className="w-4 h-4 text-white/40" />
          <span>{hasSources ? `${sources.length} sources` : "sources: —"}</span>
        </div>
      </div>

      {/* Investor */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
          {initials}
        </div>
        <div>
          <div className="font-semibold text-white">{safeText(investor.firm)}</div>
          <div className="text-sm text-white/70">
            {safeText(investor.name)} • {safeText(investor.title)}
          </div>
          {investor.practice && (
            <div className="text-xs text-white/50 mt-1">{investor.practice}</div>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 my-4" />

      {/* Meaning */}
      <div className="mb-4 p-3 rounded-md bg-black/20 border border-white/10">
        <div className="text-xs text-white/50 uppercase tracking-wider">What this means</div>
        <div className="text-sm text-white/80 mt-1">{meaning}</div>

        {hasSources && (
          <div className="text-xs text-white/50 mt-2">
            Built from:{" "}
            <span className="text-white/70">
              {sources.slice(0, 3).join(" • ")}
              {sources.length > 3 ? " • …" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Strength Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/70">Signal strength: {score}</span>
          {percentile !== null ? (
            <span className="text-xs text-white/50">({percentile}th percentile)</span>
          ) : (
            <span className="text-xs text-white/50">(relative strength)</span>
          )}
        </div>

        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${strength.color.replace("text-", "bg-")} transition-all duration-1000`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* COLLAPSED */}
      {!expanded && (
        <>
          <div className="border-t border-white/10 my-4" />

          <div className="mb-4">
            <div className="text-sm font-medium text-white/90 mb-2">Signaling interest in</div>
            <ul className="space-y-1">
              {lookingFor.slice(0, 3).map((item, i) => (
                <li key={i} className="text-sm text-white/70">
                  • {item}
                </li>
              ))}
              {lookingFor.length === 0 && (
                <li className="text-sm text-white/50">—</li>
              )}
            </ul>
          </div>

          <div className="border-t border-white/10 my-4" />

          <div className="space-y-2 mb-4">
            <Row label="Portfolio fit" value={safePct(match.portfolioFit)} />
            <Row label="Stage match" value={safePct(match.stageMatch)} />
            <Row label="Sector velocity" value={safePct(match.sectorVelocity)} />
            {/* geoFit might not exist; still render safely */}
            <Row label="Geographic fit" value={safePct(match.geoFit)} />
          </div>
        </>
      )}

      {/* EXPANDED */}
      {expanded && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="border-t border-white/10 my-4" />

          <div>
            <div className="text-sm font-medium text-white/90 mb-2">Signaling interest in</div>
            <ul className="space-y-1">
              {lookingFor.map((item, i) => (
                <li key={i} className="text-sm text-white/70">
                  • {item}
                </li>
              ))}
              {lookingFor.length === 0 && (
                <li className="text-sm text-white/50">—</li>
              )}
            </ul>
          </div>

          <div className="border-t border-white/10 my-4" />

          <div>
            <div className="text-sm font-medium text-white/90 mb-3">Why you align</div>

            <WhyBlock
              label="Portfolio fit"
              value={safePct(match.portfolioFit)}
              explanation="Overlap with their invested patterns and adjacent companies."
              evidence={Array.isArray(evidence.portfolio) ? evidence.portfolio : []}
            />

            <WhyBlock
              label="Stage match"
              value={safePct(match.stageMatch)}
              explanation="Your stage aligns with where they tend to write checks."
              evidence={Array.isArray(evidence.stage) ? evidence.stage : []}
            />

            <WhyBlock
              label="Sector velocity"
              value={safePct(match.sectorVelocity)}
              explanation="Their activity suggests increased attention to your sector."
              evidence={Array.isArray(evidence.velocity) ? evidence.velocity : []}
            />

            <WhyBlock
              label="Geographic fit"
              value={safePct(match.geoFit)}
              explanation="Location, networks, or portfolio footprint increases fit."
              evidence={Array.isArray(evidence.geo) ? evidence.geo : []}
            />
          </div>

          <div className="border-t border-white/10 my-4" />

          <div>
            <div className="text-sm font-medium text-white/90 mb-2">📊 How the signal was formed</div>
            <div className="text-xs text-white/60 mb-3">
              These are weighted contributors (not "truth"): higher values mean more evidence.
            </div>

            <div className="space-y-2">
              {[
                { label: "Recent activity (40%)", value: safeNum(comp.recentActivity, 0) },
                { label: "Portfolio adjacency (30%)", value: safeNum(comp.portfolioAdjacency, 0) },
                { label: "Thesis alignment (20%)", value: safeNum(comp.thesisAlignment, 0) },
                { label: "Stage match (10%)", value: safeNum(comp.stageMatch, 0) },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/70">{item.label}</span>
                    <span className="text-xs text-white/70">{item.value}/10</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-pink-500"
                      style={{ width: `${(clamp0to100((item.value / 10) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 my-4" />

          <div>
            <div className="text-sm font-medium text-white/90 mb-2">🎯 Estimated next move</div>
            <div className="text-xs text-white/60 mb-2">
              This is an estimate derived from similar patterns — not a promise.
            </div>
            <div className="space-y-1">
              <div className="text-sm text-white/70">
                Outreach probability:{" "}
                <span className="text-white font-medium">
                  {safePct(pred.outreachProbability)}
                </span>
              </div>
              <div className="text-sm text-white/70">
                Likely timeframe:{" "}
                <span className="text-white font-medium">{safeText(pred.likelyTimeframe)}</span>
              </div>
              {pred.trigger && (
                <div className="text-sm text-white/70">
                  Trigger: <span className="text-white font-medium">{pred.trigger}</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 my-4" />

          <div>
            <div className="text-sm font-medium text-white/90 mb-2">Recent context</div>
            <ul className="space-y-1">
              {recentContext.map((ctx: any, i: number) => (
                <li key={i} className="text-sm text-white/70">
                  • {safeText(ctx?.date)}: {safeText(ctx?.event)}
                </li>
              ))}
              {recentContext.length === 0 && (
                <li className="text-sm text-white/50">—</li>
              )}
            </ul>
          </div>

          <div className="border-t border-white/10 my-4" />

          <div className="flex flex-wrap gap-3">
            <button className="text-sm text-white/80 hover:text-white transition">
              View investor profile →
            </button>
            <button className="text-sm text-white/80 hover:text-white transition">
              See portfolio overlap
            </button>
            <button className="text-sm text-white/80 hover:text-white transition">
              Suggested intro paths
            </button>
          </div>
        </div>
      )}

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-4 py-2 text-sm text-white/70 hover:text-white flex items-center justify-center gap-2 border-t border-white/10 transition"
      >
        {expanded ? (
          <>
            Collapse <ChevronUp className="w-4 h-4" />
          </>
        ) : (
          <>
            View signal details <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm text-white/90 flex items-center justify-between">
      <span className="text-white/80">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function WhyBlock({
  label,
  value,
  explanation,
  evidence,
}: {
  label: string;
  value: string;
  explanation: string;
  evidence: string[];
}) {
  return (
    <div className="mb-3">
      <div className="text-sm text-white/90">
        <span className="text-green-400">✓</span> {label}: {value}
      </div>

      <div className="text-xs text-white/60 pl-5 mt-1">{explanation}</div>

      {Array.isArray(evidence) && evidence.length > 0 && (
        <ul className="pl-5 mt-2 space-y-1">
          {evidence.slice(0, 4).map((e, i) => (
            <li key={i} className="text-xs text-white/65">
              • {e}
            </li>
          ))}
          {evidence.length > 4 && <li className="text-xs text-white/45">• …</li>}
        </ul>
      )}
    </div>
  );
}
