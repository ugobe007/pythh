/**
 * HOW IT WORKS — PYTHH STANDARD v1 CANONICAL
 * 
 * Purpose: Answer "Why should I trust PYTHH to tell me who to talk to, and when?"
 * Not philosophy. Mechanism + proof + control.
 */

import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════
// LIVE SIGNAL DATA (rotates)
// ═══════════════════════════════════════════════════════════════

const SIGNAL_TEMPLATES = [
  { sector: "AI Infra", event: "Momentum spike", cluster: "Accel cluster" },
  { sector: "Climate SaaS", event: "Window opening", cluster: "Seed → A" },
  { sector: "DevTools", event: "Signal decay", cluster: "window closing" },
  { sector: "Fintech API", event: "Attention clustering", cluster: "a]6z portfolio" },
  { sector: "Health AI", event: "Belief convergence", cluster: "Sequoia + GV" },
  { sector: "Cybersecurity", event: "Velocity spike", cluster: "+47% in 48h" },
];

// ═══════════════════════════════════════════════════════════════
// FLOW STAGES
// ═══════════════════════════════════════════════════════════════

const FLOW_STAGES = [
  {
    icon: "↓",
    title: "Submit your startup",
    copy: "We ingest your landing page, product, team, and market. No pitch decks. No forms.",
    example: "→ Parsed: AI Infra / Seed / SF",
  },
  {
    icon: "◉",
    title: "Investor behavior",
    copy: "Portfolio changes. New investments. Attention clustering.",
    example: "→ 14 AI investors added similar companies in 72h",
  },
  {
    icon: "⚡",
    title: "Belief pressure",
    copy: "We compute momentum, decay, and convergence. Signals rise. Windows open. Then close.",
    example: "→ Signal velocity: +38%",
  },
  {
    icon: "→",
    title: "Ranked investors",
    copy: "Time-bound matches based on real behavior. You choose when to engage.",
    example: "→ 3 high-intent matches (48h window)",
  },
];

const STAGE_LABELS = ["INPUT", "OBSERVE", "ENGINE", "MATCH"];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function HowPythhWorksPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ startups: 0, investors: 0 });
  const [liveSignals, setLiveSignals] = useState<typeof SIGNAL_TEMPLATES>([]);
  const [signalIndex, setSignalIndex] = useState(0);
  const signalRef = useRef<HTMLDivElement>(null);

  // Load stats
  useEffect(() => {
    loadStats();
  }, []);

  // Rotate signals every 5s
  useEffect(() => {
    const shuffled = [...SIGNAL_TEMPLATES].sort(() => Math.random() - 0.5);
    setLiveSignals(shuffled);

    const interval = setInterval(() => {
      setSignalIndex((i) => (i + 1) % SIGNAL_TEMPLATES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      const [startupsRes, investorsRes] = await Promise.all([
        supabase.from("startup_uploads").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("investors").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        startups: startupsRes.count ?? 0,
        investors: investorsRes.count ?? 0,
      });
    } catch {
      setStats({ startups: 4583, investors: 3174 });
    }
  }

  // Get 3 visible signals
  const visibleSignals = liveSignals.length > 0
    ? [
        liveSignals[signalIndex % liveSignals.length],
        liveSignals[(signalIndex + 1) % liveSignals.length],
        liveSignals[(signalIndex + 2) % liveSignals.length],
      ]
    : SIGNAL_TEMPLATES.slice(0, 3);

  return (
    <div style={{ background: "#0a0c10", color: "#e5e7eb", minHeight: "100vh" }}>
      {/* ─────────────────────────────────────────────────────────── */}
      {/* HERO / OPERATOR HEADER */}
      {/* ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 24px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 24,
        }}
      >
        {/* Left */}
        <div>
          <Link to="/" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color: "#e5e7eb", marginBottom: 4 }}>
              PYTHH
            </div>
          </Link>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 16 }}>
            Investor Signal Engine
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f3f4f6", margin: 0, lineHeight: 1.3 }}>
            We track investor behavior in real time.
          </h1>
          <p style={{ fontSize: 16, color: "#9ca3af", margin: "8px 0 0", fontWeight: 400 }}>
            When belief shifts, you see it.
          </p>
        </div>

        {/* Right: LIVE BADGE */}
        <div
          style={{
            background: "rgba(255,255,255,.03)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 8,
            padding: "16px 20px",
            minWidth: 180,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: 1 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.8 }}>
            <div>
              <span style={{ color: "#e5e7eb", fontWeight: 500 }}>{stats.startups.toLocaleString()}</span> startups
            </div>
            <div>
              <span style={{ color: "#e5e7eb", fontWeight: 500 }}>{stats.investors.toLocaleString()}</span> investors
            </div>
            <div>
              <span style={{ color: "#e5e7eb", fontWeight: 500 }}>48h</span> signal window
            </div>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* FLOW: 4-STAGE SIGNAL FLOW GRID */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {FLOW_STAGES.map((stage, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,.02)",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 8,
                padding: "20px 16px",
                position: "relative",
              }}
            >
              {/* Stage label */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  color: "#6b7280",
                  marginBottom: 12,
                }}
              >
                {STAGE_LABELS[i]}
              </div>

              {/* Icon */}
              <div
                style={{
                  fontSize: 20,
                  marginBottom: 12,
                  color: "#10b981",
                }}
              >
                {stage.icon}
              </div>

              {/* Title */}
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb", marginBottom: 8 }}>
                {stage.title}
              </div>

              {/* Copy */}
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5, marginBottom: 12 }}>
                {stage.copy}
              </div>

              {/* Example tag */}
              <div
                style={{
                  fontSize: 11,
                  color: "#10b981",
                  fontFamily: "monospace",
                  background: "rgba(16,185,129,.08)",
                  padding: "6px 10px",
                  borderRadius: 4,
                  display: "inline-block",
                }}
              >
                {stage.example}
              </div>

              {/* Arrow connector (except last) */}
              {i < 3 && (
                <div
                  style={{
                    position: "absolute",
                    right: -12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#374151",
                    fontSize: 16,
                    zIndex: 1,
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* LIVE SIGNAL PROOF */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 48px",
        }}
      >
        <div
          style={{
            background: "rgba(16,185,129,.04)",
            border: "1px solid rgba(16,185,129,.15)",
            borderRadius: 8,
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10b981",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: "#10b981" }}>LIVE SIGNALS</span>
          </div>

          <div
            ref={signalRef}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transition: "opacity 0.3s ease",
            }}
          >
            {visibleSignals.map((signal, i) => (
              <div
                key={`${signal.sector}-${signalIndex}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 13,
                  color: "#d1d5db",
                  opacity: i === 0 ? 1 : 0.6,
                  transition: "opacity 0.5s ease",
                }}
              >
                <span style={{ color: "#6b7280" }}>•</span>
                <span style={{ fontWeight: 500 }}>{signal.sector}</span>
                <span style={{ color: "#6b7280" }}>→</span>
                <span style={{ color: "#10b981" }}>{signal.event}</span>
                <span style={{ color: "#4b5563", fontSize: 12 }}>({signal.cluster})</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* CONTROL & AGENCY */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>
        <div
          style={{
            background: "rgba(255,255,255,.02)",
            border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 8,
            padding: "24px",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb", marginBottom: 16 }}>
            You control the action
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              "Signals update automatically",
              "You decide when to engage",
              "No outbound without your consent",
            ].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#9ca3af" }}>
                <span style={{ color: "#10b981" }}>✓</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* CTA */}
      {/* ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 64px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <button
          onClick={() => navigate("/submit")}
          style={{
            background: "#10b981",
            color: "#0a0c10",
            border: "none",
            borderRadius: 6,
            padding: "14px 28px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Analyze my startup
        </button>
        <Link
          to="/signals"
          style={{
            fontSize: 13,
            color: "#6b7280",
            textDecoration: "none",
          }}
        >
          See a live example →
        </Link>
      </section>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* FOOTER NAV (minimal) */}
      {/* ─────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,.06)",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {[
          { label: "Dashboard", href: "/app" },
          { label: "Signals", href: "/signals" },
          { label: "Matches", href: "/matches" },
        ].map((link) => (
          <Link
            key={link.href}
            to={link.href}
            style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}
          >
            {link.label}
          </Link>
        ))}
      </footer>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 768px) {
          section > div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          section > div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
