/**
 * SUBMIT A STARTUP — "URL Intake"
 * 
 * Primary object: Input bar + submissions ledger
 * Founders and investors can submit startup URLs for PYTHH to scan.
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
  { label: "Engine", href: "/app/engine" },
  { label: "Signals", href: "/signals" },
  { label: "Matches", href: "/matches" },
  { label: "Submit", href: "/app/submit", active: true },
  { label: "Cohorts", href: "/app/cohorts" },
  { label: "Portfolios", href: "/app/portfolios" },
];

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Submission {
  id: string;
  url: string;
  name?: string;
  submittedBy: string;
  role: "founder" | "investor";
  status: "queued" | "scanned" | "rejected";
  note?: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════

const DEMO: Submission[] = [
  { id: "s1", url: "https://karumi.ai", name: "Karumi", submittedBy: "Founder", role: "founder", status: "scanned", note: "Strong traction narrative", createdAt: "2026-01-30" },
  { id: "s2", url: "https://example.com", submittedBy: "Investor", role: "investor", status: "queued", createdAt: "2026-01-31" },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SubmitStartupPage() {
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<Submission[]>(DEMO);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    
    // Add to local state immediately
    const newSubmission: Submission = {
      id: `s_${Date.now()}`,
      url: trimmed,
      submittedBy: "You",
      role: "founder",
      status: "queued",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setRows((prev) => [newSubmission, ...prev]);
    setUrl("");

    // TODO: POST to /api/submissions
    // try {
    //   await fetch("/api/submissions", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ url: trimmed, role: "founder" }),
    //   });
    // } catch (err) {
    //   console.error("Submit error:", err);
    // }

    setSubmitting(false);
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <AppLayout brand="PYTHH" nav={NAV}>
      {/* Page Header */}
      <div className="pythh-page-header">
        <div className="pythh-header-row">
          <div>
            <div className="pythh-kicker">app / submit</div>
            <div className="py-title-wrap">
              <h1 className="pythh-title">
                Submit a startup
                <span className="py-glyph">[]—I <strong>+</strong> URL → H→ []</span>
              </h1>
              <div className="py-hairline" />
            </div>
            <p className="pythh-subtitle">Recommend a startup URL to scan. PYTHH turns it into signals + matches.</p>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="pythh-layout">
        <main className="pythh-main">
          {/* Input Panel */}
          <div className="pythh-panel" style={{ marginBottom: 16 }}>
            <div className="pythh-panel-inner" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Paste startup URL (website, product page, demo, deck link)…"
                className="pythh-input"
                style={{ flex: "1 1 400px" }}
              />
              <button
                className="pythh-btn primary"
                onClick={handleSubmit}
                disabled={submitting || !url.trim()}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="pythh-panel">
            <div className="pythh-panel-header">
              <span className="pythh-panel-title">Submissions</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>{rows.length} total</span>
            </div>
            <table className="pythh-table">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>URL</th>
                  <th style={{ width: "15%" }}>Name</th>
                  <th style={{ width: "15%" }}>Submitted by</th>
                  <th style={{ width: "10%" }}>Role</th>
                  <th style={{ width: "12%" }}>Status</th>
                  <th style={{ width: "13%" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: "rgba(255,255,255,.85)" }}>{r.url}</span>
                    </td>
                    <td style={{ color: "rgba(255,255,255,.6)" }}>{r.name || "—"}</td>
                    <td style={{ color: "rgba(255,255,255,.6)" }}>{r.submittedBy}</td>
                    <td style={{ color: "rgba(255,255,255,.5)", fontSize: 12 }}>{r.role}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 3,
                          fontSize: 11,
                          background:
                            r.status === "scanned"
                              ? "rgba(52,211,153,.12)"
                              : r.status === "rejected"
                              ? "rgba(239,68,68,.12)"
                              : "rgba(255,255,255,.06)",
                          color:
                            r.status === "scanned"
                              ? "rgba(52,211,153,.9)"
                              : r.status === "rejected"
                              ? "rgba(239,68,68,.9)"
                              : "rgba(255,255,255,.6)",
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>{r.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        {/* Right Rail */}
        <aside className="pythh-rail">
          <div className="pythh-rail-block">
            <div className="pythh-rail-label">What happens next</div>
            <p className="pythh-rail-item">
              PYTHH queues the URL, extracts identifiers, and generates a first-pass profile. If it clears quality gates, it enters the Signals + Matches pipeline.
            </p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Quality gates</div>
            <p className="pythh-rail-item">
              Clear website + team + what you do. If it's spammy or empty, it's rejected automatically.
            </p>
          </div>

          <div className="pythh-rail-block">
            <div className="pythh-rail-label">Who can submit</div>
            <p className="pythh-rail-item">— Founders (your own startup)</p>
            <p className="pythh-rail-item">— Investors (startups you're tracking)</p>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}
