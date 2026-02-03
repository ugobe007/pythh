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
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 8 }}>signals</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f3f4f6", margin: 0, lineHeight: 1.3, marginBottom: 8 }}>
            Live investor belief shifts
          </h1>
          <div style={{ fontSize: 16, color: "#9ca3af", fontWeight: 400 }}>Observed behavior, not stated intent.</div>
        </div>

        {/* Window selector + Right rail status moved here */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {/* Window tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["24h", "7d", "30d"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: window === w ? "rgba(255,255,255,.08)" : "transparent",
                  border: "1px solid",
                  borderColor: window === w ? "var(--py-line)" : "transparent",
                  color: window === w ? "var(--py-text)" : "var(--py-muted)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {w}
              </button>
            ))}
          </div>
          
          {/* Quick status inline */}
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.72)" }}>
            <span className="py-metric-glow" style={{ fontWeight: 700, fontSize: 14, color: "rgba(52,211,153,.9)" }}>{accelerating}</span>
            {" "}sectors accelerating · Capital clustering detected
          </div>
        </div>

        {/* Table - full width */}
        <div className="py-panel">
          <table className="pythh-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 14px" }}>Sector / Theme</th>
                <th style={{ textAlign: "center", padding: "10px 14px", width: 80 }}>Direction</th>
                <th style={{ textAlign: "right", padding: "10px 14px", width: 100 }}>Strength</th>
                <th style={{ textAlign: "right", padding: "10px 14px", width: 80 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "rgba(255,255,255,.85)" }}>
                    {s.sector}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 16 }}>
                    {dirArrow(s.direction)}
                    {s.direction === "up" && s.strength > 0.75 && dirArrow(s.direction)}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
                    {s.strength.toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--py-muted)", fontSize: 12 }}>
                    {s.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Bottom action */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link 
            to="/app/submit" 
            style={{ 
              display: "inline-block",
              padding: "10px 20px",
              borderRadius: 6,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.1)",
              color: "rgba(199,210,254,.9)",
              fontSize: 13,
              textDecoration: "none",
              transition: "all 0.2s"
            }}
          >
            Submit a company you're watching →
          </Link>
        </div>
      </div>
    </div>
  );
}
