/**
 * PlatformPage — /platform
 *
 * THE unified "learn about Pythh" page.
 * Merges content from: /signals, /matches, /how-it-works, /signals-significance
 * into a single cohesive scrollable experience.
 *
 * Sections (scroll journey):
 * 1. Hero — "See what investors can't hide"
 * 2. What are Signals? — Live signal bars + explanation
 * 3. How the Engine Works — GOD scoring + matching pipeline
 * 4. The Playbook — 4 actionable timing strategies
 * 5. Old Way vs New Way — Why Pythh exists
 * 6. CTA — Submit URL or explore rankings
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import PythhUnifiedNav from "../components/PythhUnifiedNav";
import SignalFlowBars from "../components/SignalFlowBars";
import { supabase } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════

const SIGNAL_TYPES = [
  { name: "Funding Activity", desc: "Tracking new deals, fund raises, portfolio moves in real time." },
  { name: "Hiring Velocity", desc: "Investor firms expanding teams = deploying capital." },
  { name: "Market Momentum", desc: "Sector-level capital flow and competitive heat." },
  { name: "Social Proof", desc: "Media mentions, conference talks, thesis blog posts." },
  { name: "Revenue Signals", desc: "Traction indicators from your startup's public footprint." },
  { name: "Product Velocity", desc: "Shipping speed, feature launches, user growth." },
  { name: "Competition Heat", desc: "Competitor funding rounds and market positioning." },
];

const PLAYBOOK = [
  {
    id: "momentum",
    name: "Ride the Momentum",
    trigger: "Δ is +0.3 or higher",
    action: "Reach out within 48 hours. They're actively deploying.",
    why: "Investors in deployment mode are 3x more likely to take meetings.",
  },
  {
    id: "thesis",
    name: "Thesis Match",
    trigger: "Signal > 8.0 + sector aligns",
    action: "Lead with their recent investment as context.",
    why: "Pattern-matching to recent deals signals you've done your homework.",
  },
  {
    id: "timing",
    name: "Pre-Partner Meeting",
    trigger: "Sunday night or Monday morning",
    action: "Send materials before their weekly partner meeting.",
    why: "Partners discuss new deals Monday. Be on the agenda.",
  },
  {
    id: "follow",
    name: "Follow the Check",
    trigger: "2-3 weeks after adjacent deal",
    action: "Reference their portfolio company. Ask for intro.",
    why: "They're thinking about the space. Your timing looks intentional.",
  },
];

const PIPELINE_STEPS = [
  { step: "1", label: "Submit URL", desc: "Paste your website — we scan it in seconds." },
  { step: "2", label: "GOD Scoring", desc: "AI evaluates 20+ factors: team, traction, market, product, vision." },
  { step: "3", label: "Signal Matching", desc: "ML aligns you with 4,000+ investors by behavior, not stated preferences." },
  { step: "4", label: "Investor Map", desc: "Ranked matches with timing intel, psychology, and outreach playbook." },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PlatformPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });

  // Fetch platform stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await supabase.rpc("get_platform_stats");
        const p = res.data || { startups: 0, investors: 0, matches: 0 };
        setStats({
          startups: p.startups || 0,
          investors: p.investors || 0,
          matches: p.matches || 0,
        });
      } catch {}
    }
    fetchStats();
  }, []);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    navigate(`/signal-matches?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <PythhUnifiedNav />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: HERO
      ═══════════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 sm:pt-14 pb-6">
        <div className="text-center">
          <p className="text-sm text-cyan-400 tracking-widest uppercase mb-4">The Platform</p>
          <h1
            className="text-3xl sm:text-5xl font-bold text-white mb-4"
            style={{
              textShadow: "0 0 12px rgba(0, 200, 255, 0.3), 0 0 24px rgba(0, 200, 255, 0.15)",
            }}
          >
            See what investors can't hide.
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-5">
            Pythh tracks real investor behavior — portfolio moves, thesis shifts, check-size changes — 
            and matches you with the ones actively looking for companies like yours. No guessing. Just math.
          </p>

          {/* Platform stats */}
          <div className="flex items-center justify-center gap-8 sm:gap-12 text-sm mb-6">
            <div>
              <span className="text-2xl font-bold text-white">{stats.startups.toLocaleString()}</span>
              <span className="text-zinc-500 ml-2">startups</span>
            </div>
            <div className="w-px h-6 bg-zinc-800" />
            <div>
              <span className="text-2xl font-bold text-white">{stats.investors.toLocaleString()}</span>
              <span className="text-zinc-500 ml-2">investors</span>
            </div>
            <div className="w-px h-6 bg-zinc-800" />
            <div>
              <span className="text-2xl font-bold text-white">{stats.matches.toLocaleString()}</span>
              <span className="text-zinc-500 ml-2">matches</span>
            </div>
          </div>

          {/* Quick links to sections */}
          <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
            <a href="#signals" className="hover:text-cyan-400 transition">Signals ↓</a>
            <span>·</span>
            <a href="#engine" className="hover:text-cyan-400 transition">Engine ↓</a>
            <span>·</span>
            <a href="#playbook" className="hover:text-cyan-400 transition">Playbook ↓</a>
            <span>·</span>
            <a href="#why" className="hover:text-cyan-400 transition">Why Pythh ↓</a>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        <div className="border-t border-zinc-800/50" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: WHAT ARE SIGNALS?
      ═══════════════════════════════════════════════════════════════ */}
      <section id="signals" className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[2px] text-zinc-500 mb-3">Signals</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            Live investor belief shifts
          </h2>
          <p className="text-base text-zinc-400 max-w-2xl">
            Signals are real-time indicators of investor behavior — not stated intent. 
            We observe <span className="text-cyan-400">what investors do</span>, not what they say.
          </p>
        </div>

        {/* Signal Flow Bars (animated) */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Signal Flow</span>
              <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                Live
              </span>
            </div>
            <span className="text-xs text-zinc-600">Updates every 3s</span>
          </div>
          <SignalFlowBars />
        </div>

        {/* Signal types grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SIGNAL_TYPES.map((signal, i) => (
            <div
              key={i}
              className="px-4 py-3 border border-zinc-800/50 rounded-lg bg-zinc-900/20 hover:border-cyan-500/20 transition"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-cyan-400 font-mono text-xs">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-white text-sm font-medium">{signal.name}</span>
              </div>
              <p className="text-xs text-zinc-500">{signal.desc}</p>
            </div>
          ))}
        </div>

        {/* Strong vs Weak signal examples */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div className="p-5 border border-emerald-500/20 rounded-lg bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs font-mono text-emerald-400 uppercase">Strong Signal</span>
            </div>
            <p className="text-white text-sm font-medium mb-1">a16z funded 3 AI startups in 30 days</p>
            <p className="text-xs text-zinc-500">→ They're actively deploying. Your timing is perfect.</p>
          </div>
          <div className="p-5 border border-red-500/20 rounded-lg bg-red-500/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-red-400 rounded-full" />
              <span className="text-xs font-mono text-red-400 uppercase">Weak Signal</span>
            </div>
            <p className="text-white text-sm font-medium mb-1">Sequoia hasn't invested in crypto for 180 days</p>
            <p className="text-xs text-zinc-500">→ They're pausing. Wait or find another firm.</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        <div className="border-t border-zinc-800/50" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3: HOW THE ENGINE WORKS
      ═══════════════════════════════════════════════════════════════ */}
      <section id="engine" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[2px] text-zinc-500 mb-3">Engine</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            From URL to investor map in 60 seconds
          </h2>
          <p className="text-base text-zinc-400 max-w-2xl">
            Submit your startup URL. Our engine scores you on 20+ factors, then matches you 
            with investors whose <em className="text-zinc-300 not-italic">behavior</em> aligns with your profile.
          </p>
        </div>

        {/* Pipeline steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {PIPELINE_STEPS.map((step, i) => (
            <div
              key={i}
              className="relative p-5 border border-zinc-800/50 rounded-lg bg-zinc-900/20"
            >
              <span className="text-3xl font-bold text-cyan-400/30 absolute top-3 right-4">
                {step.step}
              </span>
              <h3 className="text-white font-medium mb-2">{step.label}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="hidden lg:block absolute top-1/2 -right-3 text-zinc-700 -translate-y-1/2">
                  →
                </span>
              )}
            </div>
          ))}
        </div>

        {/* GOD Score breakdown */}
        <div className="border border-zinc-800/50 rounded-lg bg-zinc-900/20 p-6">
          <h3 className="text-xs text-zinc-500 uppercase tracking-widest mb-4">GOD Score Components</h3>
          <p className="text-sm text-zinc-400 mb-5">
            Your <span className="text-cyan-400">GOD Score</span> (0-100) is the math behind investor alignment.
            It's not a vanity metric — it's what determines your rank relative to every other startup in the database.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Team", icon: "👥", desc: "Founder track record, team completeness" },
              { label: "Traction", icon: "📈", desc: "Revenue, growth rate, users" },
              { label: "Market", icon: "🎯", desc: "TAM, timing, competition" },
              { label: "Product", icon: "⚡", desc: "Product quality, differentiation" },
              { label: "Vision", icon: "🔭", desc: "Narrative coherence, ambition" },
            ].map((c) => (
              <div
                key={c.label}
                className="text-center p-3 border border-zinc-800/30 rounded-lg"
              >
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="text-white text-sm font-medium">{c.label}</div>
                <div className="text-[10px] text-zinc-600 mt-1">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Column legend */}
        <div className="mt-6 text-center text-xs text-zinc-600">
          Signal = timing · GOD = position · VC++ = investor optics
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        <div className="border-t border-zinc-800/50" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4: THE PLAYBOOK
      ═══════════════════════════════════════════════════════════════ */}
      <section id="playbook" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[2px] text-zinc-500 mb-3">Timing</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            Stop pitching. <span className="text-cyan-400">Start timing.</span>
          </h2>
          <p className="text-base text-zinc-400 max-w-2xl">
            <span className="text-white font-medium">90% of pitches are rejected</span> because of
            timing. Not your product. Not your team. These four patterns consistently convert to meetings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLAYBOOK.map((strategy, i) => (
            <div
              key={strategy.id}
              className="p-5 border border-zinc-800/50 rounded-lg bg-zinc-900/20 hover:border-cyan-500/20 transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-cyan-500 font-mono text-xs">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-white font-medium">{strategy.name}</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-zinc-500">Trigger:</span>{" "}
                  <span className="text-emerald-400">{strategy.trigger}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Action:</span>{" "}
                  <span className="text-zinc-300">{strategy.action}</span>
                </div>
                <div className="text-zinc-600 italic pt-1">{strategy.why}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        <div className="border-t border-zinc-800/50" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5: OLD WAY vs NEW WAY
      ═══════════════════════════════════════════════════════════════ */}
      <section id="why" className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[2px] text-zinc-500 mb-3">Why Pythh</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            Fundraising is broken. We fixed the math.
          </h2>
          <p className="text-base text-zinc-400 max-w-2xl mx-auto">
            Founders don't fail because they pitch badly — they fail because they can't see the
            signals that drive investor decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Old Way */}
          <div className="p-6 border border-zinc-800/50 rounded-lg bg-zinc-900/20">
            <div className="text-red-400 text-2xl mb-3">✕</div>
            <h3 className="text-white font-semibold mb-3">Old way</h3>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                Cold email 100 investors
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                2% response rate
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                6 months of guessing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                No idea if they're even investing
              </li>
            </ul>
          </div>

          {/* New Way */}
          <div className="p-6 border border-emerald-500/20 rounded-lg bg-emerald-500/5">
            <div className="text-emerald-400 text-2xl mb-3">✓</div>
            <h3 className="text-white font-semibold mb-3">Pythh way</h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                See who's actively deploying capital
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                73% average match score
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                Get matched in 60 seconds
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                Know investor psychology & timing
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        <div className="border-t border-zinc-800/50" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6: CTA
      ═══════════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            Ready to see your signals?
          </h2>
          <p className="text-base text-zinc-400">
            Submit your URL. Get scored. See your investor map.
          </p>
        </div>

        {/* URL Submit bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div
            className="flex flex-col sm:flex-row"
            style={{ boxShadow: "0 0 40px rgba(34, 211, 238, 0.1)" }}
          >
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="yourstartup.com"
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-900 border border-cyan-500/50 rounded-t sm:rounded-l sm:rounded-tr-none text-white text-sm placeholder-zinc-500 outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              />
            </div>
            <button
              onClick={handleSubmit}
              className="px-8 py-3.5 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-b sm:rounded-r sm:rounded-bl-none hover:bg-cyan-500/10 transition whitespace-nowrap"
            >
              Find Signals →
            </button>
          </div>
        </div>

        {/* Or explore */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <span className="text-zinc-600">or</span>
          <Link
            to="/rankings"
            className="text-cyan-400 hover:text-cyan-300 transition"
          >
            See live rankings →
          </Link>
          <Link
            to="/explore"
            className="text-zinc-400 hover:text-white transition"
          >
            Browse startups →
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-zinc-800/30 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© 2026 Pythh · Signal Science</span>
          <div className="flex items-center gap-6">
            <Link to="/about" className="hover:text-zinc-400 transition">About</Link>
            <Link to="/pricing" className="hover:text-zinc-400 transition">Pricing</Link>
            <Link to="/support" className="hover:text-zinc-400 transition">Support</Link>
            <Link to="/admin-login" className="hover:text-zinc-500 transition">admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
