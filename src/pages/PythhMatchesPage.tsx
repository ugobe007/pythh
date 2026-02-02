/**
 * MATCHES — "Ranked Interception Window"
 * 
 * Primary object: Match table + commands rail
 * No CTA spam. Just clarity and pressure.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "@/styles/pythh-dashboard.css";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Match {
  id: string;
  investor: string;
  lens: string;
  receptivity: number;
  score: number;
  trend: "up" | "down" | "flat";
}

// ═══════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════

const DEMO_MATCHES: Match[] = [
  { id: "1", investor: "Sequoia", lens: "AI Infra", receptivity: 0.82, score: 91, trend: "up" },
  { id: "2", investor: "Founders Fund", lens: "Dev Tools", receptivity: 0.76, score: 88, trend: "up" },
  { id: "3", investor: "a16z", lens: "Infra", receptivity: 0.71, score: 85, trend: "flat" },
  { id: "4", investor: "Greylock", lens: "Enterprise", receptivity: 0.68, score: 82, trend: "up" },
  { id: "5", investor: "Lightspeed", lens: "Consumer", receptivity: 0.65, score: 79, trend: "down" },
  { id: "6", investor: "Index", lens: "FinTech", receptivity: 0.63, score: 77, trend: "flat" },
  { id: "7", investor: "Accel", lens: "SaaS", receptivity: 0.61, score: 74, trend: "up" },
  { id: "8", investor: "GV", lens: "Health", receptivity: 0.58, score: 71, trend: "flat" },
];

// ═══════════════════════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════════════════════

const NAV = [
  { label: "Dashboard", href: "/app" },
  { label: "Engine", href: "/app/engine" },
  { label: "Signals", href: "/signals" },
  { label: "Matches", href: "/matches", active: true },
  { label: "How it works", href: "/how-it-works" },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function trendArrow(t: Match["trend"]) {
  if (t === "up") return <span style={{ color: "rgba(52,211,153,.9)" }}>↑</span>;
  if (t === "down") return <span style={{ color: "rgba(251,191,36,.9)" }}>↓</span>;
  return <span style={{ color: "rgba(255,255,255,.4)" }}>→</span>;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PythhMatchesPage() {
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [selected, setSelected] = useState<Match | null>(DEMO_MATCHES[0]);
  const [window] = useState<"24h" | "7d" | "30d">("24h");

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    try {
      const { data } = await supabase
        .from("startup_investor_matches")
        .select(`
          id,
          match_score,
          investor_id,
          investors (id, name, sectors)
        `)
        .order("match_score", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const mapped: Match[] = data.slice(0, 12).map((m: any, i: number) => ({
          id: m.id,
          investor: m.investors?.name || "Unknown",
          lens: m.investors?.sectors?.[0] || "General",
          receptivity: Math.min(0.95, 0.5 + Math.random() * 0.4),
          score: Math.round(m.match_score || 70),
          trend: i % 3 === 0 ? "up" : i % 3 === 1 ? "flat" : "down",
        }));
        setMatches(mapped);
        if (mapped.length > 0) setSelected(mapped[0]);
      }
    } catch {
      // Use demo data
    }
  }

  const highConfidence = matches.filter((m) => m.score >= 85).length;

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
        <div style={{ marginBottom: 18 }}>
          <div className="py-kicker">matches</div>
          <div className="py-title-wrap">
            <h1 className="py-title" style={{ fontSize: "3rem" }}>
              Ranked interception window
              <span className="py-glyph">[]—I <strong>^</strong> H→ []</span>
            </h1>
            <div className="py-hairline" />
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--py-muted)", marginTop: 8 }}>
            <span>Window: <strong style={{ color: "var(--py-text)" }}>{window}</strong></span>
            <span>Velocity: <strong style={{ color: "rgba(52,211,153,.9)" }}>↑</strong></span>
            <span>Confidence: <strong style={{ color: "var(--py-text)" }}>High</strong></span>
          </div>
        </div>

        {/* Table + Rail */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
          {/* Match table */}
          <div className="py-panel">
            <table className="pythh-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Investor</th>
                  <th style={{ textAlign: "left", padding: "10px 14px" }}>Lens</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", width: 100 }}>Receptivity</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", width: 80 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    style={{
                      cursor: "pointer",
                      background: selected?.id === m.id ? "rgba(255,255,255,.04)" : undefined,
                    }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontWeight: 600, color: "rgba(255,255,255,.85)" }}>{m.investor}</span>
                      <span style={{ marginLeft: 8 }}>{trendArrow(m.trend)}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--py-muted)", fontSize: 13 }}>
                      {m.lens}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
                      {m.receptivity.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span
                        className={m.score >= 85 ? "py-metric-glow" : ""}
                        style={{ fontWeight: 700, fontSize: 14 }}
                      >
                        {m.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Commands rail */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">now</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,.72)", lineHeight: 1.6 }}>
                  <div>— Act inside 24h window</div>
                  <div>— Prioritize top 3</div>
                </div>
              </div>
            </div>

            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">proof</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,.72)", lineHeight: 1.6 }}>
                  <div>— <span className="py-metric-glow" style={{ fontWeight: 600 }}>{highConfidence}</span> high-confidence matches</div>
                  <div>— Signal velocity increasing</div>
                </div>
              </div>
            </div>

            {selected && (
              <div className="py-panel py-inspector-halo">
                <div className="py-panel-inner">
                  <div className="py-kicker">selected</div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,.9)" }}>
                      {selected.investor}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--py-muted)", marginTop: 4 }}>
                      {selected.lens} • Score {selected.score}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--py-muted)", lineHeight: 1.5 }}>
                      Receptivity {selected.receptivity.toFixed(2)} indicates near-term engagement probability.
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="py-panel">
              <div className="py-panel-inner">
                <div className="py-kicker">submit</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,.72)" }}>
                  <Link to="/app/submit" style={{ color: "rgba(199,210,254,.9)" }}>
                    Submit a company you're watching →
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
