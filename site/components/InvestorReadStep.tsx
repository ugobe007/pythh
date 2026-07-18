/**
 * ACT 1 — Investor Read reveal
 * Post-submit mirror: what partners see before the commitment wizard.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { allowWizardUnlockFlow } from "@/lib/founderSignupGate";
import {
  ArrowRight,
  Sparkles,
  Users,
  TrendingUp,
  BarChart2,
  Zap,
  Lightbulb,
  Eye,
  Target,
  ChevronRight,
  Loader2,
  Unlock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreComponents {
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
}

interface FounderProxy {
  label: string;
  score: number;
  max: number;
  note: string;
}

interface ConsensusInvestor {
  name: string;
  firm: string;
  match_score: number;
  verdict: "partner_advocate" | "associate_pass" | "borderline" | "filtered";
  verdict_label: string;
  reason: string;
  is_super?: boolean;
}

interface InvestorReadData {
  startup_id: string;
  startup_name: string;
  god_score: number;
  score_components: ScoreComponents;
  founder_read: {
    archetype_label: string;
    proxies: FounderProxy[];
    composite: number;
    summary: string;
  };
  consensus_map: {
    investors: ConsensusInvestor[];
    partner_advocates: number;
    associate_passes: number;
    borderline: number;
    explanation: string;
  };
  hot_company_gap: {
    headline: string;
    gap_line: string;
    weakest_component: string;
    top_unlock: {
      task_key: string;
      title: string;
      impact_points: number;
      investors_unlocked_estimate: number;
    } | null;
  };
  hidden_advantages: { title: string; body: string }[];
  funding_path: { label: string; note: string };
}

interface InvestorReadStepProps {
  startupId: string;
  startupName: string;
  onSeeMatches: () => void;
}

// ─── Style tokens (match Activate.tsx) ────────────────────────────────────────

const BG = "oklch(0.13 0.01 264)";
const CARD = "oklch(0.14 0.01 264)";
const BORDER = "oklch(0.2 0.01 264)";
const TEXT = "oklch(0.88 0.005 264)";
const MUTED = "oklch(0.55 0.01 264)";
const DIM = "oklch(0.42 0.01 264)";
const GREEN = "#22c55e";
const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const AMBER = "#eab308";

const COMPONENT_META: Record<
  keyof ScoreComponents,
  { label: string; icon: typeof Users; color: string }
> = {
  team: { label: "Team", icon: Users, color: PURPLE },
  traction: { label: "Traction", icon: TrendingUp, color: GREEN },
  market: { label: "Market", icon: BarChart2, color: AMBER },
  product: { label: "Product", icon: Zap, color: CYAN },
  vision: { label: "Vision", icon: Lightbulb, color: "#f472b6" },
};

const VERDICT_STYLES: Record<string, { color: string; border: string }> = {
  partner_advocate: { color: GREEN, border: "#22c55e40" },
  associate_pass: { color: AMBER, border: "#eab30840" },
  borderline: { color: CYAN, border: "#22d3ee40" },
  filtered: { color: DIM, border: "oklch(0.25 0.01 264)" },
};

function scoreColor(s: number) {
  if (s >= 65) return GREEN;
  if (s >= 45) return AMBER;
  return MUTED;
}

function GodBar({ label, score, color, Icon }: { label: string; score: number; color: string; Icon: typeof Users }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={12} style={{ color }} />
          <span className="text-xs font-medium" style={{ color: TEXT }}>{label}</span>
        </div>
        <span className="text-xs font-mono font-semibold" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, score)}%`, backgroundColor: color, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

function ProxyBar({ proxy }: { proxy: FounderProxy }) {
  const pct = (proxy.score / proxy.max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: MUTED }}>{proxy.label}</span>
        <span className="text-xs font-mono" style={{ color: TEXT }}>{proxy.score}/{proxy.max}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CYAN, opacity: 0.7 }} />
      </div>
      <p className="text-[10px] leading-snug" style={{ color: DIM }}>{proxy.note}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InvestorReadStep({ startupId, startupName, onSeeMatches }: InvestorReadStepProps) {
  const [, navigate] = useLocation();
  const [data, setData] = useState<InvestorReadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wizard/${startupId}/investor-read`);
        if (!res.ok) throw new Error("Could not load investor read");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startupId]);

  const godScore = data?.god_score ?? 0;
  const godColor = scoreColor(godScore);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: BG }}>
        <Loader2 size={24} className="animate-spin" style={{ color: CYAN }} />
        <p className="text-sm font-mono" style={{ color: MUTED }}>Building your investor read…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: BG }}>
        <p className="text-sm" style={{ color: MUTED }}>{error || "Investor read unavailable"}</p>
        <button
          type="button"
          onClick={onSeeMatches}
          className="text-xs font-semibold px-4 py-2 rounded-lg border"
          style={{ color: CYAN, borderColor: "#22d3ee40" }}
        >
          See investor matches →
        </button>
      </div>
    );
  }

  const components = data.score_components;

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b" style={{ backgroundColor: `${BG}f7`, borderColor: BORDER, backdropFilter: "blur(12px)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <a href="/" className="text-xs font-bold" style={{ color: "oklch(0.696 0.17 162.48)" }}>← pythh.ai</a>
          <div className="flex items-center gap-2">
            <Eye size={14} style={{ color: CYAN }} />
            <span className="text-xs font-semibold" style={{ color: TEXT }}>Investor Read</span>
          </div>
          <span className="text-xs font-mono" style={{ color: DIM }}>Act 1</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        {/* Hero */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-semibold tracking-widest mb-3" style={{ color: CYAN }}>
            BEFORE YOU PITCH ANYONE
          </p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl mb-2" style={{ color: TEXT, letterSpacing: "-0.03em" }}>
            Here&apos;s what investors see
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: MUTED }}>
            A mirror for <span style={{ color: TEXT }}>{data.startup_name || startupName}</span> — company checkboxes, founder read, and where partners disagree.
          </p>
        </div>

        {/* GOD + Founder read grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* GOD breakdown */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest mb-1" style={{ color: DIM }}>COMPANY READ</p>
                <p className="text-xs" style={{ color: MUTED }}>GOD breakdown · investment readiness</p>
              </div>
              <div className="text-right">
                <span className="font-display font-bold text-3xl" style={{ color: godColor }}>{Math.round(godScore)}</span>
                <p className="text-[10px]" style={{ color: DIM }}>GOD / 100</p>
              </div>
            </div>
            <div className="space-y-3">
              {(Object.keys(COMPONENT_META) as (keyof ScoreComponents)[]).map((key) => {
                const meta = COMPONENT_META[key];
                return (
                  <GodBar
                    key={key}
                    label={meta.label}
                    score={components[key] ?? 0}
                    color={meta.color}
                    Icon={meta.icon}
                  />
                );
              })}
            </div>
          </div>

          {/* Founder read */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: CARD, borderColor: "#a855f728" }}>
            <p className="text-[10px] font-semibold tracking-widest mb-1" style={{ color: PURPLE }}>FOUNDER READ</p>
            <p className="text-xs mb-3" style={{ color: MUTED }}>
              Archetype: <span style={{ color: TEXT }}>{data.founder_read.archetype_label}</span>
              <span style={{ color: DIM }}> · {data.founder_read.composite}/100</span>
            </p>
            <div className="space-y-3 mb-4">
              {data.founder_read.proxies.map((p) => (
                <ProxyBar key={p.label} proxy={p} />
              ))}
            </div>
            <div className="rounded-lg p-3" style={{ backgroundColor: "oklch(0.11 0.01 264)", border: `1px solid ${BORDER}` }}>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{data.founder_read.summary}</p>
            </div>
          </div>
        </div>

        {/* Hot company gap */}
        <div
          className="rounded-xl border p-5 mb-4"
          style={{
            backgroundColor: "oklch(0.696 0.17 162.48 / 0.04)",
            borderColor: "oklch(0.696 0.17 162.48 / 0.25)",
          }}
        >
          <div className="flex items-start gap-3">
            <Sparkles size={16} className="flex-shrink-0 mt-0.5" style={{ color: "oklch(0.696 0.17 162.48)" }} />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>{data.hot_company_gap.headline}</p>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{data.hot_company_gap.gap_line}</p>
              {data.hot_company_gap.top_unlock && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-[10px] px-2 py-1 rounded font-medium flex items-center gap-1" style={{ color: GREEN, border: `1px solid ${GREEN}40` }}>
                    <Unlock size={10} />
                    Top unlock: {data.hot_company_gap.top_unlock.title}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: DIM }}>
                    +{data.hot_company_gap.top_unlock.impact_points} pts · ~{data.hot_company_gap.top_unlock.investors_unlocked_estimate} investors
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden advantages */}
        {data.hidden_advantages.length > 0 && (
          <div className="rounded-xl border p-5 mb-4" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <p className="text-[10px] font-semibold tracking-widest mb-3" style={{ color: CYAN }}>HIDDEN ADVANTAGES</p>
            <div className="space-y-3">
              {data.hidden_advantages.map((adv) => (
                <div key={adv.title}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: TEXT }}>{adv.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{adv.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Consensus map */}
        <div className="rounded-xl border p-5 mb-4" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-widest mb-1" style={{ color: DIM }}>PARTNER CONSENSUS MAP</p>
              <p className="text-xs" style={{ color: MUTED }}>Top matches · who advances vs who passes</p>
            </div>
            <div className="flex gap-3 text-center">
              <div>
                <div className="text-lg font-bold font-mono" style={{ color: GREEN }}>{data.consensus_map.partner_advocates}</div>
                <div className="text-[9px] tracking-widest" style={{ color: DIM }}>ADVANCE</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono" style={{ color: AMBER }}>{data.consensus_map.associate_passes}</div>
                <div className="text-[9px] tracking-widest" style={{ color: DIM }}>PASS</div>
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={{ color: MUTED }}>{data.consensus_map.explanation}</p>
          <div className="space-y-2">
            {data.consensus_map.investors.map((inv, i) => {
              const vs = VERDICT_STYLES[inv.verdict] || VERDICT_STYLES.filtered;
              return (
                <div
                  key={`${inv.firm}-${i}`}
                  className="flex items-start gap-3 rounded-lg p-3 border"
                  style={{ backgroundColor: "oklch(0.12 0.01 264)", borderColor: BORDER }}
                >
                  <span className="font-mono text-[10px] w-4 pt-0.5" style={{ color: DIM }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: TEXT }}>{inv.name}</span>
                      <span className="text-[10px]" style={{ color: DIM }}>{inv.firm}</span>
                      {inv.is_super && (
                        <span className="text-[10px] px-1.5 rounded" style={{ color: PURPLE, border: `1px solid ${PURPLE}50` }}>✦ SUPER</span>
                      )}
                    </div>
                    <p className="text-[10px] mt-1 leading-snug" style={{ color: DIM }}>{inv.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-mono font-semibold" style={{ color: AMBER }}>{inv.match_score}</span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded text-center max-w-[100px] leading-tight"
                      style={{ color: vs.color, border: `1px solid ${vs.border}` }}
                    >
                      {inv.verdict === "partner_advocate" ? "Partner +" : inv.verdict === "associate_pass" ? "Assoc. pass" : inv.verdict === "borderline" ? "Split" : "Low fit"}
                    </span>
                  </div>
                </div>
              );
            })}
            {data.consensus_map.investors.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: DIM }}>Matches still generating — check full results shortly.</p>
            )}
          </div>
        </div>

        {/* Funding path */}
        <div className="rounded-xl border p-4 mb-8" style={{ backgroundColor: "oklch(0.11 0.01 264)", borderColor: BORDER }}>
          <div className="flex items-start gap-2">
            <Target size={13} className="mt-0.5 flex-shrink-0" style={{ color: MUTED }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: TEXT }}>{data.funding_path.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: DIM }}>{data.funding_path.note}</p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => {
              allowWizardUnlockFlow();
              navigate(`/wizard/${startupId}?force_wizard=1&start_unlocks=1`);
            }}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: GREEN, color: "#0a0a0a" }}
          >
            <Sparkles size={14} />
            Choose your unlocks
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={onSeeMatches}
            className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium border transition-all"
            style={{ color: MUTED, borderColor: BORDER, backgroundColor: "transparent" }}
          >
            See all investor matches
            <ChevronRight size={14} />
          </button>
        </div>
        <p className="text-center text-[10px] mt-4" style={{ color: DIM }}>
          Checkbox completion ≠ term sheet. Partner psychology matters — the wizard surfaces your unlocks.
        </p>
      </div>
    </div>
  );
}
