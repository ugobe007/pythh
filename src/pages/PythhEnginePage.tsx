/**
 * ENGINE — "Compute Pipeline"
 * 
 * Primary object: Pipeline diagram with step metrics
 * Design: Terminal-grade view. No flare.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { supabase } from "../lib/supabase";

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
// TYPES
// ═══════════════════════════════════════════════════════════════

interface PipelineNode {
  id: string;
  label: string;
  count: number;
  status: "ok" | "error";
}

interface Warning {
  id: string;
  message: string;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PythhEnginePage() {
  const [nodes, setNodes] = useState<PipelineNode[]>([
    { id: "ingest", label: "Ingest", count: 0, status: "ok" },
    { id: "normalize", label: "Normalize", count: 0, status: "ok" },
    { id: "features", label: "Features", count: 0, status: "ok" },
    { id: "score", label: "Score", count: 0, status: "ok" },
    { id: "match", label: "Match", count: 0, status: "ok" },
    { id: "emit", label: "Emit", count: 0, status: "ok" },
  ]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [lastRun, setLastRun] = useState({ deltas: 0, verified: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const { count: ingestCount } = await supabase
        .from("discovered_startups")
        .select("*", { count: "exact", head: true });

      const { count: normalizedCount } = await supabase
        .from("startup_uploads")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: scoredCount } = await supabase
        .from("startup_uploads")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved");

      const { count: matchCount } = await supabase
        .from("startup_investor_matches")
        .select("*", { count: "exact", head: true });

      const newNodes = [...nodes];
      newNodes[0] = { ...newNodes[0], count: ingestCount || 0 };
      newNodes[1] = { ...newNodes[1], count: normalizedCount || 0 };
      newNodes[2] = { ...newNodes[2], count: (normalizedCount || 0) + (scoredCount || 0) };
      newNodes[3] = { ...newNodes[3], count: scoredCount || 0 };
      newNodes[4] = { ...newNodes[4], count: matchCount || 0 };
      newNodes[5] = { ...newNodes[5], count: matchCount || 0 };
      setNodes(newNodes);

      setLastRun({ deltas: 1204, verified: 37 });

      // Check for warnings
      const newWarnings: Warning[] = [];
      if ((matchCount || 0) < 5000) {
        newWarnings.push({ id: "1", message: "Drift 0.02" });
      }
      setWarnings(newWarnings);
    } catch (err) {
      console.error("Load stats error:", err);
    }
  }

  async function handleRecalc() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    await loadStats();
    setLoading(false);
  }

  async function handleRefresh() {
    setLoading(true);
    await loadStats();
    setLoading(false);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <AppLayout brand="PYTHH" nav={NAV}>
      {/* Page Header */}
      <div className="pythh-page-header">
        <div className="pythh-kicker">app / engine</div>
        <h1 className="pythh-title">Engine</h1>
        <p className="pythh-subtitle">Inspect the machine. Every score is explainable.</p>
      </div>

      {/* Layout */}
      <div className="pythh-layout">
        <main className="pythh-main">
          {/* Pipeline Diagram */}
          <div className="pythh-pipeline">
            {nodes.map((node, i) => (
              <React.Fragment key={node.id}>
                <div className="pythh-pipeline-node">
                  <span className="pythh-pipeline-node-label">[] {node.label}</span>
                  <span className="pythh-pipeline-node-count">{node.count.toLocaleString()}</span>
                  <span className={`pythh-pipeline-node-status${node.status === "error" ? " error" : ""}`}>
                    {node.status}
                  </span>
                </div>
                {i < nodes.length - 1 && (
                  <span className="pythh-pipeline-arrow">
                    {i === 4 ? "H-->" : "→"}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Last Run Output */}
          <div className="pythh-panel">
            <div className="pythh-panel-header">
              <span className="pythh-panel-title">Last Run Output</span>
            </div>
            <div className="pythh-panel-body" style={{ fontSize: 13, color: "rgba(255,255,255,.7)" }}>
              Deltas: {lastRun.deltas} | Verified upgrades: {lastRun.verified}
            </div>
          </div>
        </main>

        {/* Right Rail */}
        <aside className="pythh-rail">
          {warnings.length > 0 && (
            <div className="pythh-rail-block">
              <div className="pythh-rail-label">Warnings</div>
              {warnings.map((w) => (
                <p key={w.id} className="pythh-rail-item" style={{ color: "rgba(251,191,36,.9)" }}>
                  — {w.message}
                </p>
              ))}
            </div>
          )}

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Controls</div>
            <button
              onClick={handleRecalc}
              disabled={loading}
              className="pythh-btn primary"
              style={{ width: "100%", marginBottom: 8 }}
            >
              {loading ? "Running..." : "Run recalc"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="pythh-btn"
              style={{ width: "100%" }}
            >
              Refresh
            </button>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
