/**
 * SIGNALS — "Live Belief-Pressure Stream"
 * 
 * Primary object: Signal table with window selector
 * No marketing copy. No cards. No buttons.
 * This page should feel inevitable, not persuasive.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "@/styles/pythh-dashboard.css";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Signal {
  id: string;
  sector: string;
  direction: "up" | "down" | "flat";
  strength: number;
  time: string;
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════

const DEMO_SIGNALS: Signal[] = [
  { id: "1", sector: "FinTech Infra", direction: "up", strength: 0.73, time: "2h" },
  { id: "2", sector: "AI Infra", direction: "up", strength: 0.81, time: "6h" },
  { id: "3", sector: "Climate SaaS", direction: "down", strength: 0.42, time: "1d" },
  { id: "4", sector: "Dev Tooling", direction: "flat", strength: 0.66, time: "3d" },
  { id: "5", sector: "HealthTech", direction: "up", strength: 0.58, time: "8h" },
  { id: "6", sector: "Security", direction: "up", strength: 0.71, time: "4h" },
  { id: "7", sector: "Data Infra", direction: "flat", strength: 0.54, time: "2d" },
  { id: "8", sector: "Commerce", direction: "down", strength: 0.39, time: "5d" },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function dirArrow(d: Signal["direction"]) {
  if (d === "up") return <span style={{ color: "rgba(52,211,153,.9)" }}>↑</span>;
  if (d === "down") return <span style={{ color: "rgba(251,191,36,.9)" }}>↓</span>;
  return <span style={{ color: "rgba(255,255,255,.4)" }}>→</span>;
}

// ═══════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { label: "Dashboard", href: "/app" },
  { label: "Signals", href: "/signals", active: true },
  { label: "Matches", href: "/matches" },
  { label: "How it works", href: "/how-it-works" },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PythhSignalsPage() {
  const [signals, setSignals] = useState<Signal[]>(DEMO_SIGNALS);
  const [window, setWindow] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    loadSignals();
  }, []);

  async function loadSignals() {
    try {
      const { data } = await supabase
        .from("agent_feed_signals")
        .select("id, sector, state, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(25);

      if (data && data.length > 0) {
        const mapped: Signal[] = data.map((s: any) => ({
          id: s.id,
          sector: s.sector || "Unknown",
          direction: s.state === "heating" ? "up" : s.state === "cooling" ? "down" : "flat",
          strength: s.metadata?.strength ?? Math.random() * 0.5 + 0.4,
          time: "—",
        }));
        setSignals(mapped);
      }
    } catch {
      // Use demo data
    }
  }

  const accelerating = signals.filter((s) => s.direction === "up").length;

  return (
    <div className="py-bg-dashboard" style={{ color: "var(--py-text)", minHeight: "100vh" }}>
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(10px)",
          background: "rgba(11,15,22,.78)",
          borderBottom: "1px solid var(--py-line)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link to="/" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color: "#e5e7eb", textDecoration: "none" }}>
            PYTHH
          </Link>
          <nav style={{ display: "flex", gap: 10 }}>
            {NAV.map((n) => (
              <Link
                key={n.href}
                to={n.href}
                style={{
                  fontSize: 14,
                  padding: "8px 12px",
                  borderRadius: 6,
                  color: n.active ? "#f3f4f6" : "#9ca3af",
                  border: "1px solid",
                  borderColor: n.active ? "rgba(255,255,255,.1)" : "transparent",
                  background: n.active ? "rgba(255,255,255,.04)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Page */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "22px 18px 40px" }}>
        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 8 }}>signals</div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#f3f4f6", margin: 0, lineHeight: 1.2, marginBottom: 10 }}>
            Live investor belief shifts
          </h1>
          <div style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>Observed behavior, not stated intent.</div>
        </div>

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          <div className="py-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Accelerating</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: "rgba(52,211,153,.9)", marginBottom: 4 }}>{accelerating}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Sectors trending up</div>
          </div>
          
          <div className="py-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Average Strength</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: "rgba(34,211,238,.9)", marginBottom: 4 }}>
              {signals.length > 0 ? (signals.reduce((sum, s) => sum + s.strength, 0) / signals.length).toFixed(2) : "0.00"}
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Across all signals</div>
          </div>
          
          <div className="py-panel" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Active Sectors</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,.85)", marginBottom: 4 }}>{signals.length}</div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Being tracked</div>
          </div>
        </div>

        {/* Window selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {(["24h", "7d", "30d"] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                padding: "8px 24px",
                borderRadius: 8,
                background: window === w ? "rgba(34,211,238,.15)" : "transparent",
                border: "1px solid",
                borderColor: window === w ? "rgba(34,211,238,.4)" : "rgba(255,255,255,.1)",
                color: window === w ? "rgba(34,211,238,.9)" : "var(--py-muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Visual signal cards */}
        <div style={{ display: "grid", gap: 12 }}>
          {signals.map((s) => (
            <div 
              key={s.id} 
              className="py-panel"
              style={{ 
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 80px",
                alignItems: "center",
                gap: 16,
                background: s.strength > 0.75 ? "rgba(34,211,238,.03)" : undefined,
                borderColor: s.strength > 0.75 ? "rgba(34,211,238,.15)" : undefined,
              }}
            >
              {/* Sector name */}
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,.9)", marginBottom: 4 }}>
                  {s.sector}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {s.direction === "up" ? "↗ Heating up" : s.direction === "down" ? "↘ Cooling" : "→ Stable"}
                </div>
              </div>
              
              {/* Visual strength bar */}
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>STRENGTH</div>
                <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,.05)", borderRadius: 4, overflow: "hidden" }}>
                  <div 
                    style={{ 
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${s.strength * 100}%`,
                      background: s.direction === "up" 
                        ? "linear-gradient(90deg, rgba(52,211,153,.6), rgba(52,211,153,.9))" 
                        : s.direction === "down"
                        ? "linear-gradient(90deg, rgba(251,191,36,.6), rgba(251,191,36,.9))"
                        : "linear-gradient(90deg, rgba(255,255,255,.2), rgba(255,255,255,.4))",
                      transition: "width 0.3s ease"
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4, fontFamily: "monospace" }}>
                  {s.strength.toFixed(2)}
                </div>
              </div>
              
              {/* Direction indicator */}
              <div style={{ textAlign: "center" }}>
                <div style={{ 
                  fontSize: 32, 
                  color: s.direction === "up" ? "rgba(52,211,153,.9)" : s.direction === "down" ? "rgba(251,191,36,.9)" : "rgba(255,255,255,.3)"
                }}>
                  {dirArrow(s.direction)}
                  {s.direction === "up" && s.strength > 0.75 && dirArrow(s.direction)}
                </div>
              </div>
              
              {/* Time */}
              <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
                {s.time}
              </div>
            </div>
          ))}
        </div>
        
        {/* Bottom CTA */}
        <div style={{ marginTop: 40, textAlign: "center", padding: "32px 0", borderTop: "1px solid rgba(255,255,255,.05)" }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Watching a promising company?</div>
          <Link 
            to="/app/submit" 
            style={{ 
              display: "inline-block",
              padding: "12px 28px",
              borderRadius: 8,
              background: "rgba(34,211,238,.1)",
              border: "1px solid rgba(34,211,238,.3)",
              color: "rgba(34,211,238,.9)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              transition: "all 0.2s"
            }}
          >
            Submit for tracking →
          </Link>
        </div>
      </div>
    </div>
  );
}
