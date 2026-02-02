/**
 * HOW IT WORKS — "One Diagram Page"
 * 
 * Primary object: Single workflow diagram; minimal bullets
 * Design: Reads like documentation, not marketing. No flare.
 */

import React from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";

// ═══════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { label: "Dashboard", href: "/app" },
  { label: "Engine", href: "/app/engine" },
  { label: "Signals", href: "/signals" },
  { label: "Matches", href: "/matches" },
  { label: "How it works", href: "/how-it-works", active: true },
];

// ═══════════════════════════════════════════════════════════════
// WORKFLOW STEPS
// ═══════════════════════════════════════════════════════════════

const STEPS = [
  { id: "detect", label: "Detect", icon: "[]" },
  { id: "compute", label: "Compute", icon: "[]" },
  { id: "match", label: "Match", icon: "H-->" },
  { id: "prove", label: "Prove", icon: "(+)" },
];

const BULLETS = [
  "Actions create provisional deltas",
  "Proof upgrades lift and unlocks detail",
  "Movers & blockers explain every change",
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function HowItWorksPage() {
  return (
    <AppLayout brand="PYTHH" nav={NAV}>
      {/* Page Header */}
      <div className="pythh-page-header">
        <div className="pythh-kicker">app / how it works</div>
        <h1 className="pythh-title">How it works</h1>
        <p className="pythh-subtitle">Signals → Matches → Action → Proof.</p>
      </div>

      {/* Layout */}
      <div className="pythh-layout">
        <main className="pythh-main">
          {/* Workflow Diagram */}
          <div className="pythh-workflow">
            {STEPS.map((step, i) => (
              <React.Fragment key={step.id}>
                <div className="pythh-workflow-step">
                  <div className="pythh-workflow-icon">{step.icon}</div>
                  <div className="pythh-workflow-label">{step.label}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <span className="pythh-workflow-arrow">→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* 3-6 bullets max (mechanism → outcome) */}
          <div className="pythh-panel">
            <div className="pythh-panel-body">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {BULLETS.map((b, i) => (
                  <li
                    key={i}
                    style={{
                      color: "rgba(255,255,255,.7)",
                      fontSize: 13,
                      lineHeight: 1.7,
                      marginBottom: 4,
                    }}
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>

        {/* Right Rail */}
        <aside className="pythh-rail">
          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Definitions</div>
            <p className="pythh-rail-item" style={{ fontSize: 12 }}>
              <strong>Signals:</strong> pressure shifts
            </p>
            <p className="pythh-rail-item" style={{ fontSize: 12 }}>
              <strong>Proof:</strong> verification tier
            </p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Get Started</div>
            <Link to="/app" className="pythh-btn primary" style={{ width: "100%" }}>
              Go to Dashboard
            </Link>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
