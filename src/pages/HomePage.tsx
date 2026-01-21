/**
 * PYTHH HOMEPAGE — CANONICAL SURFACE (FROZEN)
 * ============================================
 * Authority: Founder-declared immutable
 * Status: Product surface, not design
 * See: PYTHH_HOMEPAGE_CANONICAL_SURFACE.md
 * 
 * This is an intelligence aperture into a living capital system.
 * Replica from founder-provided HTML/CSS.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

// Mock live activity data
const LIVE_ACTIVITY = [
  {
    text: "AI infra startup flagged for agent-first adoption",
    godScore: 88,
    timeAgo: "just now",
  },
  {
    text: "Clean energy startup actively appearing in discovery",
    godScore: 85,
    timeAgo: "2m ago",
  },
  {
    text: "EdTech platform showing consistent forward motion",
    godScore: 71,
    timeAgo: "5m ago",
  },
];

const TICKER_ITEMS = [
  { icon: "🟢", text: "LIVE joia active in developer tools — 2h ago", highlight: "LIVE" },
  { icon: "🟡", text: "Greylock Series B activity in B2B SaaS — just now", highlight: "Greylock" },
  { icon: "🔥", text: "Khosla thesis convergence in climate — today", highlight: "Khosla" },
  { icon: "🟣", text: "Sequoia deep tech partner mention — 1h ago", highlight: "Sequoia" },
  { icon: "🔵", text: "Accel seed velocity spike — 20m ago", highlight: "Accel" },
  { icon: "🟡", text: "Greylock Series B activity in B2B SaaS — just now", highlight: "Greylock" },
];

export default function HomePage() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      navigate(`/results?url=${encodeURIComponent(url)}`);
    }
  };

  return (
    <div className="landing-bg">
      <div className="landing-grain"></div>

      {/* Top ticker */}
      <div className="landing-ticker" aria-hidden="true">
        <div className="landing-tickerTrack">
          {TICKER_ITEMS.map((item, i) => (
            <span key={i}>
              {item.icon === "🟢" && <span className="landing-dot"></span>}
              {item.icon !== "🟢" && `${item.icon} `}
              <b>{item.highlight}</b> {item.text.replace(item.highlight, "").trim()}
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="landing-nav">
        <div className="landing-brand">
          <div className="landing-name">pythh.ai</div>
          <div className="landing-tag">SIGNAL SCIENCE</div>
        </div>
        <div className="landing-navRight">
          <button className="landing-btnGhost" type="button">Sign in</button>
          <button className="landing-btnIcon" type="button" aria-label="Menu">
            <span className="landing-hamburger"><i></i></span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="landing-wrap">
        <section className="landing-hero">
          <h1 className="landing-h1">Find my investors.</h1>

          <div className="landing-subhead">
            Investor signals that matter to you.<br />
            No guessing. Just alignment.
          </div>

          <div className="landing-label">Enter your startup URL</div>

          <form className="landing-searchRow" onSubmit={handleSubmit}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourstartup.com"
              aria-label="Startup URL"
              autoComplete="url"
              spellCheck={false}
            />
            <button className="landing-cta" type="submit">Find my investors</button>
          </form>

          <div className="landing-pills">
            <button className="landing-pill" type="button">See a live match →</button>
            <button className="landing-pill landing-primary" type="button">See how signals flow →</button>
          </div>

          <div className="landing-microTrust">No pitch deck · No warm intro · No brokers · Just signals and timing</div>

          {/* MATCH PREVIEW PANEL - Static example showing navigation output */}
          <div className="landing-matchPreview">
            <div className="landing-previewTitle">Example Output:</div>
            <div className="landing-previewCard">
              <div className="landing-previewHeader">Your Capital Navigation Snapshot</div>
              
              <div className="landing-previewMetrics">
                <div className="landing-metric">
                  <span className="landing-metricLabel">GOD Score:</span>
                  <span className="landing-metricValue">81</span>
                  <span className="landing-metricDelta">↑ +6 in 14 days</span>
                </div>
                <div className="landing-metric">
                  <span className="landing-metricLabel">Velocity:</span>
                  <span className="landing-metricValue">Accelerating</span>
                </div>
                <div className="landing-metric">
                  <span className="landing-metricLabel">FOMO State:</span>
                  <span className="landing-metricValue">Warming</span>
                </div>
                <div className="landing-metric">
                  <span className="landing-metricLabel">Phase Change:</span>
                  <span className="landing-metricValue">Product → Market Fit</span>
                </div>
              </div>

              <div className="landing-previewSection">
                <div className="landing-sectionTitle">Aligned Investor Signals</div>
                <ul className="landing-signalList">
                  <li>Accel — seed velocity spike</li>
                  <li>Greylock — thesis convergence in infra</li>
                  <li>Khosla — climate deep tech alignment</li>
                  <li>Sequoia — partner mention in agent tooling</li>
                </ul>
              </div>

              <div className="landing-previewAction">
                <div className="landing-actionTitle">Recommended Action:</div>
                <ul className="landing-actionList">
                  <li>→ Do not raise yet</li>
                  <li>→ Introduce narrative positioning</li>
                  <li>→ Surface traction proof</li>
                  <li>→ Target 3 thesis-aligned funds</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-feed">
            <div className="landing-feedTitle">INVESTOR MATCHING HAPPENING NOW</div>

            {LIVE_ACTIVITY.map((item, i) => (
              <div key={i} className="landing-item">
                <div className="landing-bullet"></div>
                <div>
                  {item.text} <span className="landing-god">(GOD: {item.godScore})</span>
                  <span className="landing-time">{item.timeAgo}</span>
                </div>
              </div>
            ))}

            <div className="landing-footerLine">This is how discovery happens before pitch decks.</div>
          </div>
        </section>
      </main>
    </div>
  );
}
