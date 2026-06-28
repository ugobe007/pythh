/*
 * PythiaRadarFeed — Hero right panel live signal animation
 * Design: Obsidian Terminal — Data Noir
 *
 * Animation sequence:
 *   Phase 1 — RADAR (1.2s): Circular radar pulses outward, sweep arm rotates
 *   Phase 2 — MATERIALIZE (staggered): 4 investor leads slide up from bottom, 200ms apart
 *   Phase 3 — LIVE FEED: Every 3s, top card exits upward, new card enters from bottom
 *   Radar mini-pulse fires briefly each time a new card enters
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { TrendingUp, Zap, Building2, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Lead {
  id: number;
  name: string;
  firm: string;
  role: string;
  score: number;
  signal: string;
  type: "bullish" | "meeting" | "hot";
  age: string;
}

// Short fallback list — only used if the DB fetch fails
const FALLBACK_LEADS: Lead[] = [
  { id: 1, name: "Josh Kopelman",  firm: "First Round Capital", role: "Managing Partner", score: 89, signal: "Stage alignment",   type: "bullish", age: "2m" },
  { id: 2, name: "Michael Seibel", firm: "Y Combinator",        role: "Partner",          score: 81, signal: "Fund cycle: early", type: "meeting", age: "5m" },
  { id: 3, name: "Roelof Botha",   firm: "Sequoia Capital",     role: "Partner",          score: 77, signal: "Thesis match",      type: "bullish", age: "9m" },
  { id: 4, name: "Bill Gurley",    firm: "Benchmark",           role: "General Partner",  score: 82, signal: "New fund deploy",   type: "hot",     age: "13m" },
];

const SIGNAL_LABELS = [
  "New fund deploy", "Thesis match", "Portfolio gap", "Stage alignment",
  "Fund cycle: early", "LP update signal", "New vertical focus", "Recent co-invest",
  "Optics: strong fit", "Thesis update",
];

/** Map real DB investors → Lead cards.
 * `investorScore` from the main investors table is already on a 0–100 scale.
 */
function mapInvestorsToLeads(investors: { name: string; firm: string; investorScore: number; recentActivity?: string | null }[]): Lead[] {
  return investors.map((inv, i) => {
    const score = Math.max(50, Math.min(99, inv.investorScore || 70));
    const type: Lead["type"] = score >= 85 ? "hot" : score >= 75 ? "bullish" : "meeting";
    const signal = inv.recentActivity
      ? inv.recentActivity.slice(0, 40)
      : SIGNAL_LABELS[i % SIGNAL_LABELS.length];
    const ageMinutes = 2 + i * 3;
    const age = ageMinutes < 60 ? `${ageMinutes}m` : `${Math.round(ageMinutes / 60)}h`;
    return { id: i + 1, name: inv.name, firm: inv.firm, role: "Partner", score, signal, type, age };
  });
}

type FeedPhase = "radar" | "materialize" | "live";

interface VisibleLead extends Lead {
  key: string; // unique render key
  state: "entering" | "visible" | "exiting";
}

const VISIBLE_COUNT = 4;

export default function PythiaRadarFeed() {
  const [, navigate] = useLocation();
  const [feedPhase, setFeedPhase] = useState<FeedPhase>("radar");
  const [radarPulse, setRadarPulse] = useState(true);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [visibleLeads, setVisibleLeads] = useState<VisibleLead[]>([]);
  const [leadPoolIdx, setLeadPoolIdx] = useState(VISIBLE_COUNT);
  const sweepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Fetch a random cohort from the full 6000+ investor pool each load
  const { data: investorData } = trpc.investors.getAnimationFeed.useQuery(
    { limit: 20 },
    { staleTime: 5 * 60 * 1000 }
  );
  const allLeads: Lead[] = investorData?.investors?.length
    ? mapInvestorsToLeads(investorData.investors)
    : FALLBACK_LEADS;

  // Keep a ref so animation interval closures always read the latest leads pool
  const allLeadsRef = useRef<Lead[]>(allLeads);
  useEffect(() => { allLeadsRef.current = allLeads; }, [allLeads]);

  // Radar sweep rotation
  useEffect(() => {
    if (feedPhase !== "radar") {
      if (sweepRef.current) clearInterval(sweepRef.current);
      return;
    }
    sweepRef.current = setInterval(() => {
      setSweepAngle(a => (a + 4) % 360);
    }, 16);
    return () => { if (sweepRef.current) clearInterval(sweepRef.current); };
  }, [feedPhase]);

  // Main sequence
  useEffect(() => {
    mountedRef.current = true;

    // Phase 1: radar for 1.4s
    const t1 = setTimeout(() => {
      if (!mountedRef.current) return;
      setFeedPhase("materialize");
      setRadarPulse(false);

      // Materialize leads bottom-to-top, staggered 180ms
      const pool = allLeadsRef.current;
      const initial = pool.slice(0, VISIBLE_COUNT).map((l) => ({
        ...l,
        key: `lead-${l.id}`,
        state: "entering" as const,
      }));
      setVisibleLeads(initial);

      // Transition each to "visible"
      initial.forEach((_, i) => {
        setTimeout(() => {
          if (!mountedRef.current) return;
          setVisibleLeads(prev =>
            prev.map((l, idx) => idx === i ? { ...l, state: "visible" } : l)
          );
        }, i * 180 + 100);
      });

      // After all materialized, start live feed
      setTimeout(() => {
        if (!mountedRef.current) return;
        setFeedPhase("live");
      }, VISIBLE_COUNT * 180 + 600);
    }, 1400);

    return () => {
      mountedRef.current = false;
      clearTimeout(t1);
    };
  }, []);

  // Live feed: scroll top card out, new card in from bottom every 3s
  useEffect(() => {
    if (feedPhase !== "live") return;

    feedRef.current = setInterval(() => {
      if (!mountedRef.current) return;

      // Mini radar pulse
      setRadarPulse(true);
      setTimeout(() => { if (mountedRef.current) setRadarPulse(false); }, 600);

      setLeadPoolIdx(prev => {
        const pool = allLeadsRef.current;
        const nextIdx = prev % pool.length;
        const newLead: VisibleLead = {
          ...pool[nextIdx],
          key: `lead-${pool[nextIdx].id}-${Date.now()}`,
          state: "entering",
        };

        setVisibleLeads(current => {
          // Mark top card as exiting
          const updated = current.map((l, i) =>
            i === 0 ? { ...l, state: "exiting" as const } : l
          );
          // After exit animation, remove it and add new card
          setTimeout(() => {
            if (!mountedRef.current) return;
            setVisibleLeads(c => {
              const without = c.filter(l => l.state !== "exiting");
              const appended = [...without, newLead];
              // Transition new card to visible
              setTimeout(() => {
                if (!mountedRef.current) return;
                setVisibleLeads(cc =>
                  cc.map(l => l.key === newLead.key ? { ...l, state: "visible" } : l)
                );
              }, 80);
              return appended;
            });
          }, 350);
          return updated;
        });

        return (prev + 1) % allLeadsRef.current.length;
      });
    }, 3000);

    return () => { if (feedRef.current) clearInterval(feedRef.current); };
  }, [feedPhase]);

  // Detect if any visible lead is a meeting type (top card takes priority)
  const topLead = visibleLeads.find(l => l.state === "visible");
  const hasMeetingLead = topLead?.type === "meeting" || topLead?.type === "hot";

  const signalColor = (type: Lead["type"]) =>
    type === "hot" ? "oklch(0.769 0.188 70.08)" :
    type === "meeting" ? "oklch(0.769 0.188 70.08)" :
    "oklch(0.696 0.17 162.48)";

  const signalBg = (type: Lead["type"]) =>
    type === "hot" ? "oklch(0.769 0.188 70.08 / 0.1)" :
    type === "meeting" ? "oklch(0.769 0.188 70.08 / 0.1)" :
    "oklch(0.696 0.17 162.48 / 0.1)";

  const SignalIcon = ({ type }: { type: Lead["type"] }) =>
    type === "meeting" ? <Zap size={9} /> :
    type === "hot" ? <Star size={9} /> :
    <TrendingUp size={9} />;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "oklch(0.16 0.01 264 / 0.95)",
        border: "1px solid oklch(0.696 0.17 162.48 / 0.25)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 40px oklch(0.696 0.17 162.48 / 0.06)",
        width: 300,
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "oklch(0.22 0.01 264)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Radar avatar */}
          <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
            {/* Pulse rings */}
            {radarPulse && (
              <>
                <div className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.2)", animationDuration: "0.8s" }} />
                <div className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", animationDuration: "1.2s", animationDelay: "0.2s" }} />
              </>
            )}
            <img
              src="/manus-storage/pythia_icon_d0c03ccc.png"
              alt="PYTHIA"
              style={{
                width: 32, height: 32,
                objectFit: "contain",
                filter: "grayscale(1) brightness(0.9)",
                borderRadius: 6,
                border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
                position: "relative",
                zIndex: 1,
                backgroundColor: "oklch(0.13 0.01 264)",
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-semibold text-sm" style={{ color: "oklch(0.94 0.005 264)" }}>PYTHIA</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}>
                Active
              </span>
            </div>
            <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>AI Fundraising Oracle</p>
          </div>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
          <span className="text-xs font-mono" style={{ color: "oklch(0.696 0.17 162.48)" }}>LIVE</span>
        </div>
      </div>

      {/* ── Radar phase ── */}
      {feedPhase === "radar" && (
        <div className="flex flex-col items-center justify-center py-6 px-4">
          {/* Radar circle */}
          <div className="relative mb-4" style={{ width: 120, height: 120 }}>
            {/* Concentric rings */}
            {[1, 0.67, 0.33].map((scale, i) => (
              <div
                key={i}
                className="absolute rounded-full border"
                style={{
                  width: 120 * scale,
                  height: 120 * scale,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  borderColor: `oklch(0.696 0.17 162.48 / ${0.15 + i * 0.1})`,
                }}
              />
            ))}
            {/* Sweep arm */}
            <div
              className="absolute"
              style={{
                width: "50%",
                height: 1,
                top: "50%",
                left: "50%",
                transformOrigin: "0 50%",
                transform: `rotate(${sweepAngle}deg)`,
                background: "linear-gradient(to right, oklch(0.696 0.17 162.48 / 0.9), transparent)",
              }}
            />
            {/* Sweep trail (faded sector) */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from ${sweepAngle - 60}deg, oklch(0.696 0.17 162.48 / 0.12) 0deg, transparent 60deg)`,
              }}
            />
            {/* Center dot */}
            <div className="absolute rounded-full"
              style={{ width: 6, height: 6, top: "50%", left: "50%", transform: "translate(-50%,-50%)", backgroundColor: "oklch(0.696 0.17 162.48)" }} />
            {/* Blip dots */}
            {[
              { x: 65, y: 30, opacity: 0.9 },
              { x: 80, y: 70, opacity: 0.6 },
              { x: 35, y: 80, opacity: 0.75 },
              { x: 25, y: 45, opacity: 0.5 },
            ].map((blip, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 4, height: 4,
                  left: blip.x, top: blip.y,
                  backgroundColor: "oklch(0.696 0.17 162.48)",
                  opacity: blip.opacity,
                  boxShadow: "0 0 4px oklch(0.696 0.17 162.48)",
                }}
              />
            ))}
          </div>
          <p className="text-xs font-mono text-center" style={{ color: "oklch(0.696 0.17 162.48)" }}>
            Scanning 5,000+ investors…
          </p>
          <p className="text-xs text-center mt-1" style={{ color: "oklch(0.4 0.01 264)" }}>
            Matching thesis · fund cycle · signal
          </p>
        </div>
      )}

      {/* ── Lead feed (materialize + live) ── */}
      {(feedPhase === "materialize" || feedPhase === "live") && (
        <div className="px-3 py-2" style={{ overflow: "hidden", minHeight: 220 }}>
          {/* Column headers */}
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>INVESTOR</span>
            <span className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>MATCH</span>
          </div>

          {/* Lead cards */}
          <div className="space-y-1.5" style={{ position: "relative" }}>
            {visibleLeads.map((lead) => (
              <div
                key={lead.key}
                style={{
                  opacity: lead.state === "visible" ? 1 : lead.state === "exiting" ? 0 : 0,
                  transform:
                    lead.state === "visible" ? "translateY(0)" :
                    lead.state === "exiting" ? "translateY(-12px)" :
                    "translateY(16px)",
                  transition: lead.state === "exiting"
                    ? "opacity 0.3s ease-in, transform 0.3s ease-in"
                    : "opacity 0.35s ease-out, transform 0.35s ease-out",
                  borderRadius: 8,
                  padding: "8px 10px",
                  backgroundColor: "oklch(0.18 0.01 264)",
                  border: "1px solid oklch(0.25 0.01 264)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {/* Avatar initial */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg text-xs font-bold font-mono"
                  style={{
                    width: 30, height: 30,
                    backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)",
                    color: "oklch(0.696 0.17 162.48)",
                    border: "1px solid oklch(0.696 0.17 162.48 / 0.2)",
                    fontSize: 11,
                  }}
                >
                  {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>

                {/* Name + signal */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-xs leading-tight truncate"
                    style={{ color: "oklch(0.92 0.005 264)" }}>
                    {lead.name}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 size={9} style={{ color: "oklch(0.45 0.01 264)", flexShrink: 0 }} />
                    <span className="text-xs truncate" style={{ color: "oklch(0.5 0.01 264)", fontSize: 10 }}>
                      {lead.firm}
                    </span>
                  </div>
                  {/* Signal badge */}
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{
                        backgroundColor: signalBg(lead.type),
                        color: signalColor(lead.type),
                        border: `1px solid ${signalColor(lead.type)}33`,
                        fontSize: 9,
                      }}
                    >
                      <SignalIcon type={lead.type} />
                      {lead.signal}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  <span className="font-mono font-bold text-sm" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                    {lead.score}
                  </span>
                  <p className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)", fontSize: 9 }}>
                    {lead.age} ago
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer CTA ── */}
      <div className="px-3 pb-3 pt-1">
        {/* Meeting pending indicator */}
        {hasMeetingLead && (
          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg"
            style={{
              backgroundColor: "oklch(0.769 0.188 70.08 / 0.1)",
              border: "1px solid oklch(0.769 0.188 70.08 / 0.3)",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: "oklch(0.769 0.188 70.08)",
                boxShadow: "0 0 6px oklch(0.769 0.188 70.08)",
                animation: "pulse 1s ease-in-out infinite",
              }}
            />
            <span className="text-xs font-mono" style={{ color: "oklch(0.769 0.188 70.08)" }}>
              Meeting request pending — {topLead?.name}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            if (hasMeetingLead && topLead) {
              sessionStorage.setItem("pythia_url", `https://example.com`);
              sessionStorage.setItem("pythia_investor", JSON.stringify({ name: topLead.name, firm: topLead.firm, role: topLead.role, score: topLead.score }));
              navigate("/activate");
            }
          }}
          className="w-full py-2.5 rounded-lg text-xs font-bold transition-all duration-300 relative overflow-hidden"
          style={{
            backgroundColor: hasMeetingLead
              ? "oklch(0.769 0.188 70.08)"
              : "oklch(0.22 0.01 264)",
            color: hasMeetingLead
              ? "oklch(0.1 0.01 70)"
              : "oklch(0.5 0.01 264)",
            border: hasMeetingLead
              ? "1px solid oklch(0.769 0.188 70.08)"
              : "1px solid oklch(0.3 0.01 264)",
            boxShadow: hasMeetingLead
              ? "0 0 20px oklch(0.769 0.188 70.08 / 0.35), 0 0 40px oklch(0.769 0.188 70.08 / 0.15)"
              : "none",
            animation: hasMeetingLead ? "amberPulse 1.8s ease-in-out infinite" : "none",
          }}
          onMouseEnter={e => {
            if (hasMeetingLead) {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px oklch(0.769 0.188 70.08 / 0.6), 0 0 50px oklch(0.769 0.188 70.08 / 0.25)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            if (hasMeetingLead) {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px oklch(0.769 0.188 70.08 / 0.35), 0 0 40px oklch(0.769 0.188 70.08 / 0.15)";
            } else {
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }
          }}
        >
          {hasMeetingLead ? "Approve Meeting →" : "Waiting for meeting request…"}
        </button>
        {hasMeetingLead && (
          <p className="text-center text-xs mt-1.5" style={{ color: "oklch(0.4 0.01 264)" }}>
            {topLead?.firm} · {topLead?.role}
          </p>
        )}
      </div>
    </div>
  );
}
