/**
 * PYTHH HOME PAGE - Doctrine v1.0
 * ================================
 * The Proof of Intelligence Surface
 * 
 * Purpose:
 * - Prove Pythh already knows where capital is leaning
 * - Make founders immediately want to paste their URL
 * 
 * NOT:
 * - Explain Pythh
 * - Sell Pythh
 * - Narrate Pythh
 * 
 * INVARIANTS:
 * - Must show actual matches, not copy
 * - Must feel alive
 * - Must not explain fundraising
 * - Must not explain philosophy
 * - Must not gate results
 * - Must not replace revelation with narrative
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Sparkles } from 'lucide-react';

// ============================================
// LIVE PREVIEW DATA (feels alive)
// ============================================

const EXAMPLE_INVESTORS = [
  {
    rank: 1,
    name: "US Seed Operator Fund",
    score: 87,
    tags: ["HealthTech", "Pre-seed", "Operator-led"],
    distance: "Warm path likely",
    why: "Portfolio adjacency + early-category pattern match",
    badge: "Rising this week"
  },
  {
    rank: 2,
    name: "Enterprise Health Ventures",
    score: 82,
    tags: ["Digital Health", "Seed", "B2B"],
    distance: "Portfolio adjacent",
    why: "Thesis overlap with recent infrastructure deals",
    badge: null
  },
  {
    rank: 3,
    name: "Seed Stage Capital",
    score: 79,
    tags: ["HealthTech", "Pre-seed", "Technical"],
    distance: "Warm path likely",
    why: "Category heat + execution cadence signals",
    badge: "New match"
  },
  {
    rank: 4,
    name: "Health Infra Partners",
    score: 76,
    tags: ["Healthcare", "Seed", "Infrastructure"],
    distance: "Cold",
    why: "Emerging thesis alignment in health infrastructure",
    badge: null
  },
  {
    rank: 5,
    name: "Technical Founders Fund",
    score: 74,
    tags: ["B2B", "Pre-seed", "Deep Tech"],
    distance: "Portfolio adjacent",
    why: "Technical credibility + team pattern match",
    badge: null
  }
];

// ============================================
// LIVE PREVIEW COMPONENT
// ============================================

function LivePreview() {
  const [lastUpdated, setLastUpdated] = useState(42);
  
  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(prev => (prev + 1) % 120 || 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 mb-1">Example startup</div>
          <div className="text-white font-semibold">Rovi Health</div>
        </div>
        <div className="text-xs text-gray-600">
          Updated {lastUpdated}s ago
        </div>
      </div>
      
      {/* Scrolling investor list */}
      <div className="max-h-[400px] overflow-y-auto">
        {EXAMPLE_INVESTORS.map((investor, i) => (
          <div 
            key={i} 
            className={`p-4 border-b border-gray-800/50 ${i === 0 ? 'bg-violet-900/10' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-500 text-xs">#{investor.rank}</span>
                  <span className="text-white font-medium text-sm truncate">{investor.name}</span>
                  {investor.badge && (
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                      investor.badge === 'Rising this week' 
                        ? 'bg-emerald-900/50 text-emerald-400' 
                        : 'bg-violet-900/50 text-violet-400'
                    }`}>
                      {investor.badge}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {investor.tags.slice(0, 2).map((tag, j) => (
                    <span key={j} className="px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 truncate">{investor.why}</div>
              </div>
              <div className={`text-xl font-bold ${
                investor.score >= 85 ? 'text-emerald-400' :
                investor.score >= 75 ? 'text-amber-400' :
                'text-gray-400'
              }`}>
                {investor.score}
              </div>
            </div>
          </div>
        ))}
        
        {/* More matches teaser */}
        <div className="p-4 text-center">
          <div className="text-gray-600 text-xs">+47 more investor matches</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MINI RESULT SECTION
// ============================================

function MiniResult() {
  return (
    <div className="space-y-3">
      {EXAMPLE_INVESTORS.map((investor, i) => (
        <div key={i} className="p-4 bg-[#111] border border-gray-800 rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gray-500 text-sm font-mono">#{investor.rank}</span>
                <h3 className="text-white font-semibold">{investor.name}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {investor.tags.map((tag, j) => (
                  <span key={j} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={investor.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                  {investor.distance}
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">{investor.why}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className={`text-3xl font-bold ${
                investor.score >= 85 ? 'text-emerald-400' :
                investor.score >= 75 ? 'text-amber-400' :
                'text-gray-400'
              }`}>
                {investor.score}
              </div>
              <span className="text-xs text-gray-500">Signal Score</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// MAIN HOME PAGE
// ============================================

export default function HomePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    
    setIsSubmitting(true);
    
    // Normalize URL
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let normalizedUrl: string | null = null;
    
    try {
      const parsed = new URL(withScheme);
      if (parsed.hostname && parsed.hostname.includes('.')) {
        parsed.hash = '';
        normalizedUrl = parsed.toString();
      }
    } catch {
      // Invalid URL
    }
    
    if (!normalizedUrl) {
      setIsSubmitting(false);
      return;
    }
    
    navigate(`/match?url=${encodeURIComponent(normalizedUrl)}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      
      {/* ====================================
          ABOVE THE FOLD
          ==================================== */}
      <section className="min-h-[85vh] flex items-center">
        <div className="max-w-7xl mx-auto px-4 py-12 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* LEFT: URL Input */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                Paste your website.<br />
                <span className="text-gray-400">See your top investor matches instantly.</span>
              </h1>
              
              <p className="text-gray-500 mb-8">
                Ranked by live capital signals and thesis alignment.
              </p>
              
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="yourcompany.com"
                    className="flex-1 px-4 py-4 bg-[#111] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !url.trim()}
                    className="px-8 py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Get my investor matches
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
              
              <Link 
                to="/demo" 
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                See a live demo →
              </Link>
            </div>
            
            {/* RIGHT: Live Preview */}
            <div className="hidden lg:block">
              <LivePreview />
            </div>
          </div>
        </div>
      </section>
      
      {/* ====================================
          BELOW FOLD: MINI RESULT
          ==================================== */}
      <section className="py-16 border-t border-gray-900">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">
              Example investor matches for a HealthTech startup
            </h2>
          </div>
          
          <MiniResult />
          
          <p className="text-center text-sm text-gray-600 mt-6">
            This is what founders see when they paste their website.
          </p>
        </div>
      </section>
      
      {/* ====================================
          CURIOSITY HOOK
          ==================================== */}
      <section className="py-16 border-t border-gray-900">
        <div className="max-w-2xl mx-auto px-4">
          <div className="p-6 bg-[#111] border border-gray-800 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              What is this actually doing?
            </h3>
            <ul className="space-y-2 text-gray-400">
              <li>• We fingerprint your startup signals</li>
              <li>• We fingerprint investor theses</li>
              <li>• We track capital momentum</li>
              <li>• We detect portfolio adjacency</li>
              <li>• We rank matches by live alignment</li>
            </ul>
          </div>
        </div>
      </section>
      
      {/* ====================================
          FINAL CTA
          ==================================== */}
      <section className="py-16 border-t border-gray-900">
        <div className="max-w-xl mx-auto px-4 text-center">
          <p className="text-gray-400 mb-6">
            Paste your website to see your matches.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourcompany.com"
              className="flex-1 px-4 py-3 bg-[#111] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
            >
              Get matches
            </button>
          </form>
        </div>
      </section>
      
    </div>
  );
}
