/**
 * FIND MY INVESTORS - Home Page
 * ==============================
 * Matches screenshot design with LIVE energy
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageShell from '../components/layout/PageShell';
import TopBar, { TopBarBrand } from '../components/layout/TopBar';
import LiveMatchingStrip from '../components/LiveMatchingStrip';

const TICKER_ITEMS = [
  "→ia active in developer tools — 2h ago",
  "🔒 Greylock Series B activity in B2B SaaS — just now",
  "🔥 Khosla thesis convergence in climate — today",
  "💡 Sequoia partner interest spike in agent infrastructure — 1h ago",
  "🎯 a16z published new investment thesis: AI agents — 30m ago",
  "⚡ Founder Fund following vertical SaaS plays — 3h ago",
];

export default function FindMyInvestors() {
  const [url, setUrl] = useState('');
  const navigate = useNavigate();
  const tickerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputUrl = url.trim();
    if (!inputUrl) return;

    // Navigate to canonical signal-matches page — unified submitStartup() handles resolution + matching
    console.log('[FindMyInvestors] Navigating to signal-matches for:', inputUrl);
    navigate(`/signal-matches?url=${encodeURIComponent(inputUrl)}`);
  };

  // Auto-scroll ticker
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;

    let scrollPos = 0;
    const scroll = () => {
      scrollPos += 0.5;
      if (scrollPos >= ticker.scrollWidth / 2) {
        scrollPos = 0;
      }
      ticker.scrollLeft = scrollPos;
    };

    const interval = setInterval(scroll, 20);
    return () => clearInterval(interval);
  }, []);

  return (
    <PageShell variant="standard">
      {/* Animated ticker */}
      <div className="border-b border-white/10 bg-black/60 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />
        <div 
          ref={tickerRef}
          className="py-2 px-6 flex items-center gap-8 text-[11px] text-white/50 font-mono overflow-x-auto scrollbar-hide whitespace-nowrap"
          style={{ scrollBehavior: 'auto' }}
        >
          <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            LIVE
          </span>
          {/* Duplicate for seamless loop */}
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
            <span key={idx} className="hover:text-white/70 transition-colors">{item}</span>
          ))}
        </div>
      </div>

      {/* Header */}
      <TopBar 
        leftContent={<TopBarBrand />}
        rightLinks={[
          { to: "/", label: "Home" },
          { to: "/live", label: "Live" },
          { to: "/signals", label: "How It Works" },
        ]}
        rightContent={
          <Link to="/login" className="text-sm text-white/70 hover:text-white transition ml-4">
            Sign in
          </Link>
        }
      />

      {/* Hero */}
      <main className="px-6 pt-16 pb-12 relative">
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-2 h-2 bg-cyan-400/30 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
          <div className="absolute top-40 right-1/3 w-1.5 h-1.5 bg-orange-400/30 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
          <div className="absolute top-60 left-1/3 w-2.5 h-2.5 bg-cyan-300/20 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
        </div>
        
        <div className="max-w-6xl mx-auto relative">
          <div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight relative">
              <span className="inline-block hover:text-cyan-400 transition-colors duration-300">Find</span>{' '}
              <span className="inline-block hover:text-cyan-400 transition-colors duration-300">my</span>{' '}
              <span className="inline-block hover:text-cyan-400 transition-colors duration-300">investors.</span>
              {/* Glow effect behind text */}
              <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-cyan-500/10 -z-10 animate-pulse" style={{ animationDuration: '4s' }} />
            </h1>
            <div className="mt-6">
              <p className="text-xl text-white/70">
                investor <span className="text-cyan-400 font-semibold" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.6)' }}>[signals]</span> aligned with your startup
              </p>
            </div>

            {/* Search - Single unified capsule for perfect symmetry */}
            <div className="mt-10 relative group">
              <div className="relative text-sm text-white/60 mb-2">
                Your startup URL
              </div>
              
              {/* Glow effect */}
              <div className="absolute inset-0 top-8 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/20 to-orange-500/15 blur-2xl opacity-60" />
              
              <form onSubmit={handleSubmit} className="relative">
                {/* Single capsule container - one background, one border, one height */}
                <div className="flex items-stretch h-[60px] rounded-2xl bg-black/40 backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_0_50px_rgba(34,211,238,0.12)] overflow-hidden">
                  {/* Input zone - transparent, fills available space */}
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="yourstartup.com"
                    className="flex-1 bg-transparent text-white outline-none px-6 placeholder:text-white/35 focus:ring-1 focus:ring-cyan-400/25 rounded-l-2xl"
                    autoComplete="off"
                    inputMode="url"
                  />
                  
                  {/* Vertical divider */}
                  <div className="w-px bg-white/10 self-stretch" />
                  
                  {/* Button - same height as container */}
                  <button
                    type="submit"
                    className="min-w-[200px] px-8 font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black transition rounded-r-2xl"
                  >
                    get matches
                  </button>
                </div>
              </form>
            </div>

            {/* Inline nav links (fonts only — no pill/button chrome) */}
            <div className="mt-5 flex items-center gap-3">
              <Link to="/what-are-signals" className="text-sm text-white/70 hover:text-white transition">
                Signals
              </Link>
              <span className="text-white/30">·</span>
              <Link to="/live" className="text-sm text-white/70 hover:text-white transition">
                Live
              </Link>
              <span className="text-white/30">·</span>
              <Link to="/how-it-works" className="text-sm text-white/70 hover:text-white transition">
                Science
              </Link>
            </div>

            {/* Tagline */}
            <div className="mt-3 text-sm text-white/45">
              No pitch deck · No brokers · Just signals and timing
            </div>
          </div>
        </div>
      </main>

      {/* LIVE MATCHING STRIP - max-width container for symmetry */}
      <div className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          <LiveMatchingStrip />
        </div>
      </div>
    </PageShell>
  );
}
