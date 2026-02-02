/**
 * COHORTS — "Founder Communities"
 * 
 * Primary object: Cohort ledger + Notes inspector
 * Small groups around signal themes (AI infra founders, fintech infra, etc.)
 */

import React, { useState } from "react";
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
  { label: "Submit", href: "/app/submit" },
  { label: "Cohorts", href: "/app/cohorts", active: true },
  { label: "Portfolios", href: "/app/portfolios" },
];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Cohort {
  id: string;
  name: string;
  signal: string;
  members: number;
  lastActivity: string;
  notes: string[];
  suggestedInvestors: string[];
  tags: string[];
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════

const DEMO_COHORTS: Cohort[] = [
  {
    id: "c1",
    name: "AI Infra Founders",
    signal: "AI Infra",
    members: 12,
    lastActivity: "2h ago",
    notes: [
      "Compute costs are the main blocker right now",
      "a]6z raised $4M from Andreessen",
      "Multi-modal inference is heating up",
    ],
    suggestedInvestors: ["Greylock", "a16z", "Sequoia"],
    tags: ["what worked: technical deep-dive decks", "timing: Q1 closes faster"],
  },
  {
    id: "c2",
    name: "FinTech Infra",
    signal: "FinTech API",
    members: 8,
    lastActivity: "1d ago",
    notes: [
      "Compliance automation is the wedge",
      "Banks are slow but enterprise deals are bigger",
    ],
    suggestedInvestors: ["Ribbit", "QED", "Index"],
    tags: ["what worked: regulatory expertise", "timing: post-earnings"],
  },
  {
    id: "c3",
    name: "Climate SaaS",
    signal: "Climate SaaS",
    members: 6,
    lastActivity: "3d ago",
    notes: [
      "Carbon accounting mandates driving urgency",
      "Longer sales cycles but sticky customers",
    ],
    suggestedInvestors: ["Lowercarbon", "Congruent", "DCVC"],
    tags: ["what worked: regulatory tailwinds pitch"],
  },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CohortsPage() {
  const [cohorts] = useState<Cohort[]>(DEMO_COHORTS);
  const [selected, setSelected] = useState<Cohort | null>(DEMO_COHORTS[0]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <AppLayout brand="PYTHH" nav={NAV}>
      {/* Page Header */}
      <div className="pythh-page-header">
        <div className="pythh-kicker">app / cohorts</div>
        <div className="py-title-wrap">
          <h1 className="pythh-title">
            Cohorts
            <span className="py-glyph">[]—I <strong>^</strong> (+) → []</span>
          </h1>
          <div className="py-hairline" />
        </div>
        <p className="pythh-subtitle">Small founder groups around signal themes. Share notes, not noise.</p>
      </div>

      {/* Layout */}
      <div className="pythh-layout">
        <main className="pythh-main">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
            {/* Cohort Table */}
            <div className="pythh-panel" style={{ marginBottom: 0 }}>
              <div className="pythh-panel-header">
                <span className="pythh-panel-title">Your Cohorts</span>
              </div>
              <table className="pythh-table">
                <thead>
                  <tr>
                    <th>Cohort</th>
                    <th>Signal</th>
                    <th>Members</th>
                    <th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr
                      key={c.id}
                      className={selected?.id === c.id ? "selected" : ""}
                      onClick={() => setSelected(c)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontWeight: 600, color: "rgba(255,255,255,.85)" }}>{c.name}</td>
                      <td style={{ color: "rgba(255,255,255,.6)" }}>{c.signal}</td>
                      <td>
                        <span className="py-metric-glow" style={{ fontWeight: 600 }}>{c.members}</span>
                      </td>
                      <td style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>{c.lastActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cohort Inspector */}
            {selected && (
              <div className="pythh-inspector">
                <div className="pythh-inspector-title">{selected.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 14 }}>
                  {selected.members} members · {selected.signal}
                </div>

                <div className="pythh-inspector-section">
                  <div className="pythh-inspector-label">Notes</div>
                  <div className="pythh-inspector-text">
                    {selected.notes.map((n, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>— {n}</div>
                    ))}
                  </div>
                </div>

                <div className="pythh-inspector-section">
                  <div className="pythh-inspector-label">Suggested Investors</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.suggestedInvestors.map((inv) => (
                      <span
                        key={inv}
                        style={{
                          padding: "3px 8px",
                          background: "rgba(96,165,250,.1)",
                          border: "1px solid rgba(96,165,250,.2)",
                          borderRadius: 3,
                          fontSize: 11,
                          color: "rgba(96,165,250,.9)",
                        }}
                      >
                        {inv}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pythh-inspector-section">
                  <div className="pythh-inspector-label">What Worked</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                    {selected.tags.map((t, i) => (
                      <div key={i}>— {t}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Rail */}
        <aside className="pythh-rail">
          <div className="pythh-rail-block">
            <div className="pythh-rail-label">What are cohorts</div>
            <p className="pythh-rail-item">
              Small groups of founders tracking the same signal theme. Share tactical notes, not general chat.
            </p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">How to use</div>
            <p className="pythh-rail-item">— Join cohorts matching your sector</p>
            <p className="pythh-rail-item">— Add notes when you learn something</p>
            <p className="pythh-rail-item">— Check suggested investors</p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Coming soon</div>
            <p className="pythh-rail-item">Create your own cohort</p>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
