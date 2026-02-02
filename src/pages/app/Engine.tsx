/**
 * ENGINE — "Pipeline View"
 * 
 * Horizontal flow diagram showing how PYTHH works.
 * No cards. No buttons. No marketing.
 * This page is for trust, not conversion.
 */

import React from "react";
import { Link } from "react-router-dom";
import "@/styles/pythh-dashboard.css";

// ═══════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { label: "Dashboard", href: "/app" },
  { label: "Engine", href: "/app/engine", active: true },
  { label: "Signals", href: "/signals" },
  { label: "Matches", href: "/matches" },
  { label: "How it works", href: "/how-it-works" },
];

// ═══════════════════════════════════════════════════════════════
// PIPELINE STAGES
// ═══════════════════════════════════════════════════════════════

interface PipelineStage {
  title: string;
  items: { label: string; desc: string }[];
}

const PIPELINE: PipelineStage[] = [
  {
    title: "Inputs",
    items: [
      { label: "Website", desc: "Landing, team, product pages" },
      { label: "Deck", desc: "Pitch materials if provided" },
      { label: "Press", desc: "Public announcements, coverage" },
    ],
  },
  {
    title: "Normalization",
    items: [
      { label: "Entity parsing", desc: "Extract sector, stage, model" },
      { label: "Time weighting", desc: "Recency decay applied" },
      { label: "Confidence map", desc: "Certainty per data point" },
    ],
  },
  {
    title: "Signal Layer",
    items: [
      { label: "Belief vectors", desc: "Investor intent signals" },
      { label: "Momentum score", desc: "Velocity of attention" },
      { label: "Decay curves", desc: "Window-based relevance" },
    ],
  },
  {
    title: "Outputs",
    items: [
      { label: "Matches", desc: "Ranked investor targets" },
      { label: "Windows", desc: "Time-bound opportunities" },
      { label: "Alerts", desc: "Threshold notifications" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Engine() {
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
          <Link to="/" style={{ fontWeight: 750, letterSpacing: ".3px", color: "var(--py-text)" }}>
            PYTHH
          </Link>
          <nav style={{ display: "flex", gap: 10 }}>
            {NAV.map((n) => (
              <Link
                key={n.href}
                to={n.href}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  color: n.active ? "var(--py-text)" : "var(--py-muted)",
                  border: "1px solid",
                  borderColor: n.active ? "var(--py-line)" : "transparent",
                  background: n.active ? "rgba(255,255,255,.04)" : "transparent",
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
        <div style={{ marginBottom: 24 }}>
          <div className="py-kicker">engine</div>
          <div className="py-title-wrap">
            <h1 className="py-title">
              Signal processing pipeline
              <span className="py-glyph">[]—I <strong>→</strong> H→ []</span>
            </h1>
            <div className="py-hairline" />
          </div>
          <div className="py-subtitle">How noisy founder data becomes actionable intelligence.</div>
        </div>

        {/* Pipeline Flow */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            position: "relative",
          }}
        >
          {PIPELINE.map((stage, i) => (
            <div key={stage.title} style={{ position: "relative" }}>
              {/* Column */}
              <div
                className="py-panel"
                style={{
                  borderRadius: i === 0 ? "12px 0 0 12px" : i === 3 ? "0 12px 12px 0" : 0,
                  borderRight: i < 3 ? "none" : undefined,
                  height: "100%",
                }}
              >
                <div className="py-panel-inner" style={{ padding: 16 }}>
                  {/* Stage title */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "rgba(199,210,254,.7)",
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {stage.title}
                    {i < 3 && (
                      <span style={{ color: "rgba(255,255,255,.2)", fontSize: 14, marginLeft: "auto" }}>→</span>
                    )}
                  </div>

                  {/* Items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {stage.items.map((item) => (
                      <div key={item.label}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.85)", marginBottom: 2 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--py-muted)", lineHeight: 1.4 }}>
                          {item.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Explanation strip */}
        <div className="py-panel" style={{ marginTop: 16 }}>
          <div className="py-panel-inner" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 13, color: "var(--py-muted)", lineHeight: 1.5 }}>
              <strong style={{ color: "rgba(255,255,255,.7)" }}>Normalization</strong> converts noisy founder data into comparable signals across time.{" "}
              <strong style={{ color: "rgba(255,255,255,.7)" }}>Signal Layer</strong> computes belief pressure and momentum.{" "}
              <strong style={{ color: "rgba(255,255,255,.7)" }}>Outputs</strong> rank opportunities by time + alignment.
            </div>
          </div>
        </div>

        {/* Status row */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Startups indexed", value: "2,847" },
            { label: "Investors tracked", value: "1,203" },
            { label: "Signals processed", value: "48h window" },
            { label: "Match confidence", value: ">70%" },
          ].map((stat) => (
            <div key={stat.label} className="py-panel">
              <div className="py-panel-inner" style={{ padding: 12, textAlign: "center" }}>
                <div className="py-kicker">{stat.label}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
