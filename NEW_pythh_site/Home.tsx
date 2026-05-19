/*
 * PYTHH.AI — HOME PAGE (v2)
 * Design: Obsidian Terminal — Data Noir
 * AI Agent: PYTHIA (Predictive Yield & Thesis Heuristic Intelligence Agent)
 * Sections: Nav → Hero → Agent Intro → Live Signals → Science → Testimonials → Newsletter → Footer
 */

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
const PythiaReveal = lazy(() => import("@/components/PythiaReveal"));
import PythiaRadarFeed from "@/components/PythiaRadarFeed";
import {
  ArrowRight,
  ExternalLink,
  Menu,
  X,
  Mail,
  Activity,
  Eye,
  Target,
  CheckCircle2,
  Zap,
  Shield,
  ChevronRight,
  Database,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvestorSignal {
  name: string;
  firm: string;
  signal: number;
  delta: number;
  god: number;
  vcpp: number;
  sector: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const INVESTOR_SIGNALS: InvestorSignal[] = [
  { name: "Niko Bonatsos", firm: "General Catalyst", signal: 8.6, delta: -0.2, god: 79, vcpp: 90, sector: "AI/ML" },
  { name: "Rebecca Kaden", firm: "Union Square Ventures", signal: 7.9, delta: -0.1, god: 73, vcpp: 83, sector: "SaaS" },
  { name: "Kirsten Green", firm: "Forerunner Ventures", signal: 7.9, delta: 0.3, god: 73, vcpp: 83, sector: "FinTech" },
  { name: "Michael Chen", firm: "Andreessen Horowitz", signal: 7.7, delta: -0.1, god: 71, vcpp: 81, sector: "AI/ML" },
  { name: "Tomasz Tunguz", firm: "Theory Ventures", signal: 7.5, delta: 0.5, god: 69, vcpp: 79, sector: "SaaS" },
  { name: "Stephanie Zhan", firm: "Sequoia Capital", signal: 7.4, delta: -0.2, god: 68, vcpp: 78, sector: "DeepTech" },
  { name: "Sarah Guo", firm: "Conviction Partners", signal: 7.3, delta: 0.4, god: 67, vcpp: 77, sector: "AI/ML" },
  { name: "Elad Gil", firm: "Color Capital", signal: 7.1, delta: 0.1, god: 65, vcpp: 75, sector: "BioTech" },
];

const SECTORS = ["All", "AI/ML", "SaaS", "FinTech", "BioTech", "SpaceTech", "DeepTech", "Climate"];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useIntersectionObserver(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

function useCountUp(target: number, duration = 1500, isVisible = false, decimals = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(parseFloat(start.toFixed(decimals)));
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, target, duration, decimals]);
  return count;
}

// ─── Shared Components ───────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
      </span>
      <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>LIVE</span>
    </span>
  );
}

function SignalBar({ value, max = 10, color = "emerald" }: { value: number; max?: number; color?: "emerald" | "amber" }) {
  const pct = (value / max) * 100;
  const barColor = color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)";
  return (
    <div className="h-1 w-16 rounded-full" style={{ backgroundColor: "oklch(0.25 0.01 264)" }}>
      <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "oklch(0.13 0.01 264 / 0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid oklch(0.25 0.01 264)" : "1px solid transparent",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex flex-col leading-none">
            <span className="font-display font-bold text-lg text-white tracking-tight">pythh.ai</span>
            <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>SIGNAL SCIENCE</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Oracle", href: "/oracle", accent: "oklch(0.696 0.17 162.48)" },
              { label: "Rankings", href: "/rankings", accent: "#22d3ee" },
              { label: "Matches", href: "/matches", accent: "#22c55e" },
              { label: "Investors", href: "/investors", accent: "oklch(0.696 0.17 162.48)" },
              { label: "Portfolio", href: "/portfolio", accent: "oklch(0.696 0.17 162.48)" },
              { label: "Platform", href: "/platform", accent: "oklch(0.94 0.005 264)" },
            ].map(({ label, href, accent }) => (
              <a key={href} href={href}
                className="text-sm font-medium transition-colors duration-200"
                style={{ color: "oklch(0.65 0.01 264)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
              >{label}</a>
            ))}
            <a href="/pricing" className="text-sm font-medium transition-colors duration-200"
              style={{ color: "oklch(0.65 0.01 264)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.769 0.188 70.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
            >Pricing</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/account">
                  <button
                    className="text-sm font-medium px-4 py-2 rounded-md transition-colors duration-200"
                    style={{ color: "oklch(0.65 0.01 264)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.94 0.005 264)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
                  >
                    {user?.name?.split(" ")[0] ?? "Account"}
                  </button>
                </Link>
                <button
                  onClick={() => logoutMutation.mutate()}
                  className="text-sm font-medium px-4 py-2 rounded-md transition-colors duration-200"
                  style={{ color: "oklch(0.65 0.01 264)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.94 0.005 264)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
                >Sign out</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  className="text-sm font-medium px-4 py-2 rounded-md transition-colors duration-200"
                  style={{ color: "oklch(0.65 0.01 264)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.94 0.005 264)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
                >Sign in</button>
                <button
                  onClick={() => { const el = document.getElementById("hero-cta"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                  className="text-sm font-semibold px-4 py-2 rounded-md transition-all duration-200"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.75 0.17 162.48)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px oklch(0.696 0.17 162.48 / 0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.696 0.17 162.48)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >Get Started</button>
              </>
            )}
          </div>
          <button className="md:hidden p-2 rounded-md" style={{ color: "oklch(0.65 0.01 264)" }} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden py-4 border-t" style={{ borderColor: "oklch(0.25 0.01 264)" }}>
            <div className="flex flex-col gap-4">
              {[
                { label: "Oracle", href: "/oracle", color: "oklch(0.696 0.17 162.48)" },
                { label: "Rankings", href: "/rankings", color: "#22d3ee" },
                { label: "Matches", href: "/matches", color: "#22c55e" },
                { label: "Investors", href: "/investors", color: "oklch(0.696 0.17 162.48)" },
                { label: "Portfolio", href: "/portfolio", color: "oklch(0.696 0.17 162.48)" },
                { label: "Platform", href: "/platform", color: "oklch(0.65 0.01 264)" },
                { label: "Methodology", href: "/methodology", color: "oklch(0.65 0.01 264)" },
                { label: "Pricing", href: "/pricing", color: "oklch(0.769 0.188 70.08)" },
              ].map(({ label, href, color }) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-sm font-medium" style={{ color }}>{label}</a>
              ))}
              <div className="flex gap-3 pt-2">
                {isAuthenticated ? (
                  <>
                    <Link href="/account" onClick={() => setMenuOpen(false)}>
                      <button className="text-sm font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                        {user?.name?.split(" ")[0] ?? "Account"}
                      </button>
                    </Link>
                    <button onClick={() => { setMenuOpen(false); logoutMutation.mutate(); }} className="text-sm font-medium" style={{ color: "oklch(0.65 0.01 264)" }}>Sign out</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setMenuOpen(false); window.location.href = getLoginUrl(); }} className="text-sm font-medium" style={{ color: "oklch(0.65 0.01 264)" }}>Sign in</button>
                    <button onClick={() => { const el = document.getElementById("hero-cta"); if (el) { setMenuOpen(false); setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100); } }} className="text-sm font-semibold px-4 py-2 rounded-md" style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}>Get Started</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection() {
  const [url, setUrl] = useState("");
  const [, navigate] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      const normalized = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
      sessionStorage.setItem("pythia_url", normalized);
      navigate("/activate");
    }
  };

  return (
    <section
      className="relative min-h-screen flex items-center pt-16 overflow-hidden"
      style={{ backgroundColor: "oklch(0.09 0.01 264)" }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(oklch(0.6 0.01 264) 1px, transparent 1px), linear-gradient(90deg, oklch(0.6 0.01 264) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Violet ambient — top left */}
      <div
        className="absolute -top-32 -left-32 w-[700px] h-[700px] opacity-[0.07] pointer-events-none"
        style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 65%)" }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: "linear-gradient(to top, oklch(0.09 0.01 264), transparent)" }} />

      <div className="container relative z-10 py-24">

        {/* ── Brand mark — standalone, not inside any pill or button ── */}
        <div className="mb-10">
          {/* Icon — stroke only, no fills */}
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-label="Pythh Connect">
            {/* Hexagon outer shell */}
            <polygon
              points="26,4 46,15 46,37 26,48 6,37 6,15"
              stroke="#a78bfa"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* Inner triangle connecting nodes */}
            <line x1="26" y1="17" x2="16" y2="33" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="26" y1="17" x2="36" y2="33" stroke="#22d3ee" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="16" y1="33" x2="36" y2="33" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
            {/* Three nodes — stroke only */}
            <circle cx="26" cy="17" r="2.5" stroke="#a78bfa" strokeWidth="1.2" />
            <circle cx="16" cy="33" r="2.5" stroke="#22d3ee" strokeWidth="1.2" />
            <circle cx="36" cy="33" r="2.5" stroke="#22c55e" strokeWidth="1.2" />
          </svg>
          {/* Label — plain text, no pill, no button */}
          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: "#c4b5fd" }}>
              Pythh Connect
            </span>
            <span className="text-xs" style={{ color: "#22c55e" }}>· MCP live</span>
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-28">

          {/* ── Left: pitch ── */}
          <div className="flex-1 max-w-[580px]">

            <h1
              className="font-display font-bold leading-[1.04] mb-4"
              style={{ fontSize: "clamp(3rem, 6vw, 5rem)", color: "oklch(0.97 0.005 264)", letterSpacing: "-0.025em" }}
            >
              Pythh's Signal
              <br />
              Intelligence.
            </h1>

            <p
              className="font-display font-medium mb-8"
              style={{ fontSize: "clamp(1.3rem, 2.8vw, 1.9rem)", color: "#a78bfa", letterSpacing: "-0.01em", lineHeight: 1.2 }}
            >
              Now queryable from Claude or Cursor.
            </p>

            <p className="text-base leading-relaxed mb-10 max-w-[480px]" style={{ color: "oklch(0.58 0.01 264)" }}>
              33,000+ startups scored. 6,250+ investors qualified. 91,950 active matches.
              Point any MCP-compatible AI at Pythh's live deal network and query it in plain English —
              refreshed every 24 hours from continuous market scraping.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <a
                href="/developers"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200"
                style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
              >
                <Database size={14} />
                Get API access — free
                <ArrowRight size={14} />
              </a>
              <a
                href="/oracle"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200"
                style={{ border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.48 0.01 264)" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.32 0.01 264)"; el.style.color = "oklch(0.65 0.01 264)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.22 0.01 264)"; el.style.color = "oklch(0.48 0.01 264)"; }}
              >
                How it works
              </a>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: "oklch(0.38 0.01 264)" }}>Works with</span>
              {["Claude", "Cursor", "ChatGPT", "Copilot"].map((t) => (
                <span
                  key={t}
                  className="text-[11px]"
                  style={{ color: "oklch(0.5 0.01 264)" }}
                >
                  {t}
                </span>
              ))}
              <span className="text-xs" style={{ color: "oklch(0.3 0.01 264)" }}>+ any MCP client</span>
            </div>
          </div>

          {/* ── Right: See Pythh in Action ── */}
          <div className="hidden lg:block flex-shrink-0" style={{ width: 360 }}>
            {/* Section label — plain, not a pill */}
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "oklch(0.45 0.01 264)" }}>
              See Pythh in Action
            </p>

            {/* Card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: "oklch(0.115 0.01 264)",
                border: "1px solid oklch(0.21 0.01 264)",
              }}
            >
              {/* Card top bar */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid oklch(0.17 0.01 264)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#22c55e" }} />
                  <span className="text-xs" style={{ color: "oklch(0.65 0.01 264)" }}>PYTHIA · live engine</span>
                </div>
                <span className="text-[10px]" style={{ color: "oklch(0.35 0.01 264)" }}>~20 sec</span>
              </div>

              <div className="p-5">
                <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.55 0.01 264)" }}>
                  Submit your startup URL. PYTHIA reads your signals, scores you across 7 dimensions,
                  and surfaces the investors most likely to fund you — ranked by sector fit and timing.
                </p>

                {/* Output preview — what you'll receive */}
                <div className="flex gap-3 mb-5">
                  <div className="flex-1 py-3 rounded-lg text-center" style={{ border: "1px solid oklch(0.19 0.01 264)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#22d3ee" }}>74</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.42 0.01 264)" }}>GOD score</div>
                  </div>
                  <div className="flex-1 py-3 rounded-lg text-center" style={{ border: "1px solid oklch(0.19 0.01 264)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#22c55e" }}>18</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "oklch(0.42 0.01 264)" }}>matched investors</div>
                  </div>
                </div>

                {/* URL form */}
                <form id="hero-cta" onSubmit={handleSubmit}>
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-3 transition-all"
                    style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.24 0.01 264)" }}
                    onFocusCapture={(e) => (e.currentTarget.style.borderColor = "oklch(0.696 0.17 162.48 / 0.45)")}
                    onBlurCapture={(e) => (e.currentTarget.style.borderColor = "oklch(0.24 0.01 264)")}
                  >
                    <ExternalLink size={13} className="flex-shrink-0" style={{ color: "oklch(0.4 0.01 264)" }} />
                    <input
                      type="text"
                      placeholder="your-startup.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "oklch(0.88 0.005 264)" }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all"
                    style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
                  >
                    Activate PYTHIA <ArrowRight size={14} />
                  </button>
                  <p className="text-[10px] text-center mt-2.5" style={{ color: "oklch(0.36 0.01 264)" }}>
                    No credit card · No signup required
                  </p>
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Track Record Strip ─────────────────────────────────────────────────────
function TrackRecordStrip() {
  const { ref, isVisible } = useIntersectionObserver();
  const startups = useCountUp(33241, 1600, isVisible);
  const investors = useCountUp(6250, 1800, isVisible);
  const matches = useCountUp(91950, 2000, isVisible);
  const tools = useCountUp(9, 800, isVisible);

  const stats = [
    { value: startups.toLocaleString(), suffix: "+", label: "Startups Scored", sublabel: "in the Pythh network, updated daily", color: "#22d3ee" },
    { value: investors.toLocaleString(), suffix: "+", label: "Investors Qualified", sublabel: "entity-resolved, thesis-mapped", color: "#7c3aed" },
    { value: matches.toLocaleString(), suffix: "", label: "Active Matches", sublabel: "live startup-investor pairings", color: "#22c55e" },
    { value: String(tools), suffix: " MCP tools", label: "API Tools", sublabel: "free · pro · enterprise tiers", color: "#f97316" },
  ];

  return (
    <div ref={ref} className="relative py-12 overflow-hidden"
      style={{ borderTop: "1px solid oklch(0.22 0.01 264)", borderBottom: "1px solid oklch(0.22 0.01 264)", backgroundColor: "oklch(0.145 0.01 264)" }}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(oklch(0.696 0.17 162.48) 1px, transparent 1px), linear-gradient(90deg, oklch(0.696 0.17 162.48) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y-0 md:divide-x divide-white/10">
          {stats.map((stat, i) => (
            <div key={i} className={`flex flex-col items-center text-center px-8 py-6 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`} style={{ transitionDelay: `${i * 150}ms` }}>
              <div className="font-display font-bold mb-1 tabular-nums"
                style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", color: stat.color, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {stat.value}{stat.suffix}
              </div>
              <div className="font-semibold text-sm mb-1" style={{ color: "oklch(0.85 0.005 264)" }}>
                {stat.label}
              </div>
              <div className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
                {stat.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Agent Intro Section ──────────────────────────────────────────────────────
function AgentIntroSection() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section className="py-24 border-t" style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: PYTHIA Animated Reveal */}
          <div ref={ref} className={`relative flex items-center justify-center ${isVisible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationFillMode: "forwards", minHeight: 360 }}>
            {/* Radial dark backdrop */}
            <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at center, oklch(0.18 0.015 162) 0%, oklch(0.13 0.01 264) 70%)", border: "1px solid oklch(0.696 0.17 162.48 / 0.12)" }} />
            {/* Corner accent lines */}
            <div className="absolute top-4 left-4 w-8 h-8" style={{ borderTop: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderLeft: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            <div className="absolute top-4 right-4 w-8 h-8" style={{ borderTop: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderRight: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            <div className="absolute bottom-4 left-4 w-8 h-8" style={{ borderBottom: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderLeft: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            <div className="absolute bottom-4 right-4 w-8 h-8" style={{ borderBottom: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderRight: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            {/* Label */}
            <div className="absolute top-5 left-0 right-0 flex justify-center">
              <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48 / 0.5)" }}>PYTHIA SEES THE SIGNAL</span>
            </div>
            <Suspense
              fallback={
                <div
                  className="relative flex items-center justify-center rounded-2xl"
                  style={{ width: 320, height: 320, backgroundColor: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
                  aria-hidden
                />
              }
            >
              <PythiaReveal autoPlay={isVisible} />
            </Suspense>
          </div>

          {/* Right: Copy */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
              <span className="section-label">MEET YOUR ORACLE</span>
            </div>
            <h2 className="font-display font-bold mb-2" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "oklch(0.97 0.005 264)" }}>
              Meet PYTHIA.
            </h2>
            <p className="text-lg font-medium mb-6" style={{ color: "oklch(0.769 0.188 70.08)" }}>
              The Oracle of your fundraise.
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.6 0.01 264)" }}>
              PYTHIA is the oracle at the core of Pythh — named for the high priestess of Delphi who saw the future before anyone else. She runs your entire fundraising pipeline — from identifying the right investors to booking confirmed meetings — without you lifting a finger.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.6 0.01 264)" }}>
              She reads your startup, maps your thesis against 5,000+ investors, drafts personalized outreach, follows up intelligently, and only surfaces a meeting request when an investor says yes. Your one job: approve and show up.
            </p>

            {/* Capability pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Investor Matching", color: "emerald" },
                { label: "Pitch Prep", color: "amber" },
                { label: "Outreach Automation", color: "emerald" },
                { label: "Follow-up Sequences", color: "amber" },
                { label: "Meeting Scheduling", color: "emerald" },
                { label: "Conversation Briefings", color: "amber" },
              ].map((cap) => (
                <span key={cap.label} className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{
                    backgroundColor: cap.color === "emerald" ? "oklch(0.696 0.17 162.48 / 0.1)" : "oklch(0.769 0.188 70.08 / 0.1)",
                    color: cap.color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)",
                    border: `1px solid ${cap.color === "emerald" ? "oklch(0.696 0.17 162.48 / 0.25)" : "oklch(0.769 0.188 70.08 / 0.25)"}`,
                  }}>
                  {cap.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Live Signals ─────────────────────────────────────────────────────────────

function LiveSignalsSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const [activeSector, setActiveSector] = useState("All");
  const filtered = activeSector === "All" ? INVESTOR_SIGNALS : INVESTOR_SIGNALS.filter((s) => s.sector === activeSector);

  return (
    <section className="py-24 border-t" style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
      <div className="container">
        <div ref={ref} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="section-label">INVESTOR SIGNALS</span>
              <LiveDot />
            </div>
            <h2 className="font-display font-bold mb-3" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "oklch(0.97 0.005 264)" }}>
              Real-time signal intelligence.
            </h2>
            <p className="text-base max-w-lg" style={{ color: "oklch(0.6 0.01 264)" }}>
              PYTHIA monitors 40+ behavioral dimensions — from LP updates to check-size changes — 6 to 18 months before major funding events.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => (
              <button key={sector} onClick={() => setActiveSector(sector)}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150"
                style={{ backgroundColor: activeSector === sector ? "oklch(0.696 0.17 162.48 / 0.15)" : "oklch(0.19 0.012 264)", color: activeSector === sector ? "oklch(0.696 0.17 162.48)" : "oklch(0.55 0.01 264)", border: `1px solid ${activeSector === sector ? "oklch(0.696 0.17 162.48 / 0.3)" : "oklch(0.25 0.01 264)"}` }}>
                {sector}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.25 0.01 264)" }}>
          <div className="grid gap-4 px-6 py-3 border-b"
            style={{ gridTemplateColumns: "1fr 100px 60px 60px 60px 80px", backgroundColor: "oklch(0.17 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
            {["INVESTOR / FIRM", "SIGNAL", "Δ", "GOD", "VC++", ""].map((h) => (
              <span key={h} className="section-label">{h}</span>
            ))}
          </div>
          {filtered.map((inv, i) => (
            <div key={inv.name}
              className={`grid gap-4 px-6 py-4 border-b transition-colors duration-150 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ gridTemplateColumns: "1fr 100px 60px 60px 60px 80px", borderColor: "oklch(0.22 0.01 264)", animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.17 0.01 264)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "oklch(0.9 0.005 264)" }}>{inv.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>{inv.firm}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-data font-semibold text-sm" style={{ color: inv.signal >= 8 ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>{inv.signal}</span>
                <SignalBar value={inv.signal} max={10} color={inv.signal >= 8 ? "emerald" : "amber"} />
              </div>
              <span className="font-mono-data text-xs self-center" style={{ color: inv.delta > 0 ? "oklch(0.696 0.17 162.48)" : inv.delta < 0 ? "oklch(0.65 0.22 25)" : "oklch(0.5 0.01 264)" }}>
                {inv.delta > 0 ? "+" : ""}{inv.delta}
              </span>
              <span className="font-mono-data text-xs self-center" style={{ color: "oklch(0.65 0.01 264)" }}>{inv.god}</span>
              <span className="font-mono-data text-xs self-center" style={{ color: "oklch(0.65 0.01 264)" }}>{inv.vcpp}</span>
              <div className="self-center">
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}>{inv.sector}</span>
              </div>
            </div>
          ))}
          <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "oklch(0.17 0.01 264)" }}>
            <p className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>Signal = timing · GOD = investment readiness · VC++ = investor optics</p>
            <a href="/investors" className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
              See full rankings <ChevronRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Science Section ──────────────────────────────────────────────────────────

function ScienceSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const timing = useCountUp(8.7, 1500, isVisible, 1);
  const fit = useCountUp(94, 1500, isVisible, 0);
  const optics = useCountUp(88, 1500, isVisible, 0);

  const metrics = [
    { icon: <Activity size={20} />, label: "TIMING", value: timing, suffix: "/10", sublabel: "SIGNAL SCORE", description: "We track when VCs are actively deploying — portfolio velocity, LP updates, fund cycle position. PYTHIA pitches when the window is open.", color: "emerald" as const },
    { icon: <Target size={20} />, label: "FIT", value: fit, suffix: "%", sublabel: "THESIS MATCH", description: "Every investor thesis is mapped across 40+ dimensions. Your startup is scored against each one — sector, stage, check size, geography.", color: "amber" as const },
    { icon: <Eye size={20} />, label: "OPTICS", value: optics, suffix: "pts", sublabel: "VC++ SCORE", description: "How an investor is perceived by other VCs — co-investment history, portfolio reputation, founder NPS. Signal quality, not just quantity.", color: "emerald" as const },
  ];

  return (
    <section className="py-24" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div ref={ref}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="section-label">THE SCIENCE BEHIND THE ORACLE</span>
            </div>
            <h2 className="font-display font-bold mb-4" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "oklch(0.97 0.005 264)" }}>
              Math, not magic.
            </h2>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "oklch(0.6 0.01 264)" }}>
              A single data point is noise. A sequence of signals is a pattern. PYTHIA detects patterns across 40+ behavioral dimensions — 6 to 18 months before major funding events.
            </p>
            <p className="text-base leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>
              Her scoring engine combines timing intelligence, thesis alignment, and peer-weighted optics into a single, actionable signal — so she knows exactly who to approach and when.
            </p>
            <div className="mt-8">
              <a href="/methodology" className="flex items-center gap-2 text-sm font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Read the methodology <ArrowRight size={14} />
              </a>
            </div>
          </div>
          <div className="space-y-4">
            {metrics.map((m, i) => (
              <div key={m.label}
                className={`rounded-xl p-5 border flex items-center gap-6 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)", animationDelay: `${i * 0.15}s`, animationFillMode: "forwards" }}>
                <div className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: m.color === "emerald" ? "oklch(0.696 0.17 162.48 / 0.1)" : "oklch(0.769 0.188 70.08 / 0.1)", border: `1px solid ${m.color === "emerald" ? "oklch(0.696 0.17 162.48 / 0.2)" : "oklch(0.769 0.188 70.08 / 0.2)"}`, color: m.color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-mono-data font-bold text-3xl" style={{ color: m.color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>{m.value}</span>
                    <span className="font-mono-data text-lg" style={{ color: "oklch(0.5 0.01 264)" }}>{m.suffix}</span>
                  </div>
                  <p className="section-label mb-1">{m.sublabel}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      quote: "I submitted my URL on a Monday. By Wednesday, PYTHIA had already booked two investor calls. I didn't write a single email.",
      author: "Sarah M.",
      role: "Founder, Series A — AI Infrastructure",
    },
    {
      quote: "The meeting brief PYTHIA sent before my Sequoia call was better than anything I'd prepared myself. She knew their portfolio gaps before I did.",
      author: "James K.",
      role: "Co-founder, Seed — Climate Tech",
    },
    {
      quote: "I used to spend 40% of my time on investor research and outreach. PYTHIA does all of it. I just show up to meetings now.",
      author: "Priya R.",
      role: "CEO, Pre-seed — FinTech",
    },
  ];

  return (
    <section className="py-24 border-t" style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
      <div className="container">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
          <span className="section-label">FOUNDER SIGNAL</span>
        </div>
        <h2 className="font-display font-bold mb-12" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "oklch(0.97 0.005 264)" }}>
          Founders who let PYTHIA run the pipeline.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-xl p-6 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
              <div className="mb-4">{[...Array(5)].map((_, j) => <span key={j} style={{ color: "oklch(0.769 0.188 70.08)" }}>★</span>)}</div>
              <blockquote className="text-sm leading-relaxed mb-6 italic" style={{ color: "oklch(0.75 0.005 264)" }}>"{t.quote}"</blockquote>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-data"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
                  {t.author.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "oklch(0.85 0.005 264)" }}>{t.author}</p>
                  <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section className="py-24 relative overflow-hidden" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
      <div className="container relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
            <span className="section-label">THE DAILY SIGNAL</span>
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
          </div>
          <h2 className="font-display font-bold mb-4" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "oklch(0.97 0.005 264)" }}>
            Get the signal<br />
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>before the noise.</span>
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.6 0.01 264)" }}>
            Join 12,000+ founders receiving our weekly breakdown of VC thesis shifts, hidden capital flows, and the investors PYTHIA is watching right now.
          </p>
          {submitted ? (
            <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl border"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", borderColor: "oklch(0.696 0.17 162.48 / 0.3)" }}>
              <Zap size={16} style={{ color: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-sm font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>You're in. First signal drops this week.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.3 0.01 264)" }}>
                <Mail size={16} style={{ color: "oklch(0.5 0.01 264)" }} />
                <input type="email" placeholder="founder@startup.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none" style={{ color: "oklch(0.94 0.005 264)" }} required />
              </div>
              <button type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 whitespace-nowrap"
                style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px oklch(0.769 0.188 70.08 / 0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                Subscribe <ArrowRight size={16} />
              </button>
            </form>
          )}
          <p className="text-xs mt-4" style={{ color: "oklch(0.45 0.01 264)" }}>No spam. Unsubscribe anytime.</p>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const cols: { title: string; links: { label: string; href: string | null }[] }[] = [
    { title: "Product", links: [
      { label: "Oracle", href: "/oracle" },
      { label: "Activate PYTHIA", href: "/activate" },
      { label: "Matches", href: "/matches" },
      { label: "Rankings", href: "/rankings" },
      { label: "Investors", href: "/investors" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Platform", href: "/platform" },
      { label: "Pricing", href: "/pricing" },
    ]},
    { title: "Resources", links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Newsletter", href: "/newsletter" },
      { label: "About", href: "/about" },
      { label: "Support", href: "/support" },
    ]},
    { title: "Company", links: [
      { label: "About", href: null },
      { label: "Blog", href: null },
      { label: "Careers", href: null },
      { label: "Press", href: null },
    ]},
    { title: "Legal", links: [
      { label: "Privacy Policy", href: null },
      { label: "Terms of Service", href: null },
      { label: "Cookie Policy", href: null },
    ]},
  ];

  return (
    <footer className="border-t" style={{ backgroundColor: "oklch(0.11 0.01 264)", borderColor: "oklch(0.2 0.01 264)" }}>
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col mb-4">
              <span className="font-display font-bold text-lg text-white tracking-tight">pythh.ai</span>
              <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>SIGNAL SCIENCE</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "oklch(0.45 0.01 264)" }}>
              PYTHIA sees the investors you should be talking to — before you even know to ask. You approve. You show up.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="font-display font-semibold text-sm mb-4" style={{ color: "oklch(0.7 0.01 264)" }}>{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        className="text-xs transition-colors duration-150"
                        style={{ color: "oklch(0.45 0.01 264)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.7 0.01 264)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.45 0.01 264)")}
                      >{label}</a>
                    ) : (
                      <span className="text-xs" style={{ color: "oklch(0.3 0.01 264)" }}>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
          <p className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>
            © 2026 Pythh Capital. All rights reserved. Signals reflect investor intent and timing based on observed behavior. No guarantees. Just math.
          </p>
          <div className="flex items-center gap-1">
            <Shield size={12} style={{ color: "oklch(0.35 0.01 264)" }} />
            <span className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>SOC 2 Type II Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <Navbar />
      <HeroSection />
      <TrackRecordStrip />
      <AgentIntroSection />
      <LiveSignalsSection />
      <ScienceSection />
      <TestimonialsSection />
      <NewsletterSection />
      <Footer />
    </div>
  );
}
