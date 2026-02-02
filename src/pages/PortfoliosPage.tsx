/**
 * PORTFOLIOS — "Investor Workspace"
 * 
 * Primary object: Portfolio table + inspector
 * Named lists of startups with sharing capabilities.
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
  { label: "Cohorts", href: "/app/cohorts" },
  { label: "Portfolios", href: "/app/portfolios", active: true },
];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Startup {
  id: string;
  name: string;
  godScore: number;
  sector: string;
}

interface Portfolio {
  id: string;
  name: string;
  count: number;
  lastActivity: string;
  startups: Startup[];
  watchTags: string[];
  shareLink?: string;
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════

const DEMO_PORTFOLIOS: Portfolio[] = [
  {
    id: "p1",
    name: "AI Infra Pipeline",
    count: 8,
    lastActivity: "4h ago",
    startups: [
      { id: "s1", name: "Karumi", godScore: 87, sector: "AI Infra" },
      { id: "s2", name: "Nexus AI", godScore: 82, sector: "AI Infra" },
      { id: "s3", name: "DataForge", godScore: 79, sector: "AI Infra" },
    ],
    watchTags: ["compute costs", "inference speed", "multi-modal"],
    shareLink: "https://pythh.ai/share/p1abc",
  },
  {
    id: "p2",
    name: "FinTech Watchlist",
    count: 5,
    lastActivity: "1d ago",
    startups: [
      { id: "s4", name: "PayStack", godScore: 84, sector: "FinTech" },
      { id: "s5", name: "LedgerX", godScore: 76, sector: "FinTech" },
    ],
    watchTags: ["compliance", "banking API"],
  },
  {
    id: "p3",
    name: "Climate Tech",
    count: 3,
    lastActivity: "5d ago",
    startups: [
      { id: "s6", name: "CarbonTrack", godScore: 71, sector: "Climate" },
    ],
    watchTags: ["carbon credits", "ESG reporting"],
  },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PortfoliosPage() {
  const [portfolios] = useState<Portfolio[]>(DEMO_PORTFOLIOS);
  const [selected, setSelected] = useState<Portfolio | null>(DEMO_PORTFOLIOS[0]);
  const [newName, setNewName] = useState("");

  function handleCreatePortfolio() {
    if (!newName.trim()) return;
    // TODO: POST /api/portfolios
    setNewName("");
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <AppLayout brand="PYTHH" nav={NAV}>
      {/* Page Header */}
      <div className="pythh-page-header">
        <div className="pythh-kicker">app / portfolios</div>
        <div className="py-title-wrap">
          <h1 className="pythh-title">
            Portfolios
            <span className="py-glyph">[]—I <strong>H→</strong> [] 0.00</span>
          </h1>
          <div className="py-hairline" />
        </div>
        <p className="pythh-subtitle">Named lists of startups. Track, organize, share.</p>
      </div>

      {/* Layout */}
      <div className="pythh-layout">
        <main className="pythh-main">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            {/* Portfolio Table */}
            <div>
              {/* Create new */}
              <div className="pythh-panel" style={{ marginBottom: 12 }}>
                <div className="pythh-panel-inner" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New portfolio name..."
                    className="pythh-input"
                    style={{ flex: 1 }}
                  />
                  <button className="pythh-btn primary" onClick={handleCreatePortfolio}>
                    Create
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="pythh-panel" style={{ marginBottom: 0 }}>
                <table className="pythh-table">
                  <thead>
                    <tr>
                      <th>Portfolio</th>
                      <th>Count</th>
                      <th>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolios.map((p) => (
                      <tr
                        key={p.id}
                        className={selected?.id === p.id ? "selected" : ""}
                        onClick={() => setSelected(p)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 600, color: "rgba(255,255,255,.85)" }}>{p.name}</td>
                        <td>
                          <span className="py-metric-glow" style={{ fontWeight: 600 }}>{p.count}</span>
                        </td>
                        <td style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>{p.lastActivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Portfolio Inspector */}
            {selected && (
              <div className="pythh-inspector">
                <div className="pythh-inspector-title">{selected.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 14 }}>
                  {selected.count} startups
                </div>

                <div className="pythh-inspector-section">
                  <div className="pythh-inspector-label">Startups</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selected.startups.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 10px",
                          background: "rgba(0,0,0,.2)",
                          borderRadius: 4,
                          border: "1px solid rgba(255,255,255,.06)",
                        }}
                      >
                        <span style={{ fontWeight: 500, color: "rgba(255,255,255,.8)" }}>{s.name}</span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>
                          GOD {s.godScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pythh-inspector-section">
                  <div className="pythh-inspector-label">Watch Tags</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.watchTags.map((t) => (
                      <span
                        key={t}
                        style={{
                          padding: "3px 8px",
                          background: "rgba(255,255,255,.06)",
                          border: "1px solid rgba(255,255,255,.1)",
                          borderRadius: 3,
                          fontSize: 11,
                          color: "rgba(255,255,255,.6)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {selected.shareLink && (
                  <div className="pythh-inspector-section">
                    <div className="pythh-inspector-label">Share Link</div>
                    <div
                      style={{
                        padding: "8px 10px",
                        background: "rgba(0,0,0,.2)",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "rgba(96,165,250,.8)",
                        wordBreak: "break-all",
                      }}
                    >
                      {selected.shareLink}
                    </div>
                  </div>
                )}

                <button className="pythh-btn" style={{ width: "100%", marginTop: 12 }}>
                  Generate Share Link
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Rail */}
        <aside className="pythh-rail">
          <div className="pythh-rail-block">
            <div className="pythh-rail-label">What are portfolios</div>
            <p className="pythh-rail-item">
              Named lists of startups you're tracking. Add startups from Matches or Submit.
            </p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Sharing</div>
            <p className="pythh-rail-item">
              Generate a view-only link to share with partners or LPs. They see the list, not your notes.
            </p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Coming soon</div>
            <p className="pythh-rail-item">— Bulk add from CSV</p>
            <p className="pythh-rail-item">— Portfolio performance tracking</p>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
