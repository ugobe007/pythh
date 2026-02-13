/**
 * PYTHH HOME PAGE — Contract v1.0
 * ================================
 * FRONTPAGE CONTRACT COMPLIANT
 * 
 * PURPOSE:
 * Make founders want to paste their URL.
 * 
 * NOT:
 * - explain the product
 * - teach how it works
 * - market features
 * - onboard users
 * - look like a SaaS homepage
 * 
 * SECTIONS:
 * 1. PRIMARY CTA SURFACE (dominant, centered)
 * 2. THIN PROOF STRIP (rotating, alive)
 * 3. CURIOSITY STRIP (rotating intrigue)
 * 4. SINGLE CREDIBILITY ANCHOR (one line)
 * 5. BACKGROUND INTELLIGENCE LAYER (visual only)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// ============================================
// PROOF STRIP DATA (rotates between startups)
// ============================================

const PROOF_EXAMPLES = [
  {
    startup: "Rovi Health",
    matches: [
      { name: "US Seed Operator Fund", score: 72 },
      { name: "Health Infra Partners", score: 69 },
      { name: "Seed Stage Capital", score: 66 },
    ],
    whys: [
      "Portfolio adjacency detected",
      "Market signals forming",
      "Execution cadence improving"
    ]
  },
  {
    startup: "Finch Labs",
    matches: [
      { name: "Enterprise FinTech Partners", score: 78 },
      { name: "B2B Infrastructure Fund", score: 71 },
      { name: "Operator Collective", score: 68 },
    ],
    whys: [
      "Thesis overlap with recent deals",
      "Category heat forming",
      "Technical credibility signals"
    ]
  },
  {
    startup: "Meridian AI",
    matches: [
      { name: "Technical Founders Fund", score: 81 },
      { name: "Deep Tech Ventures", score: 74 },
      { name: "AI Infrastructure Capital", score: 70 },
    ],
    whys: [
      "Team pattern match detected",
      "Emerging category recognition",
      "Infrastructure positioning aligned"
    ]
  }
];

// ============================================
// CURIOSITY LINES (rotating intrigue)
// ============================================

const CURIOSITY_LINES = [
  "Some startups are being discovered before they raise.",
  "Some investors are warming up to categories you don't expect.",
  "Your narrative is legible to some funds and invisible to others.",
  "Capital moves before founders notice.",
  "Your signals change your odds."
];

// ============================================
// PROOF STRIP COMPONENT
// ============================================

function ProofStrip() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % PROOF_EXAMPLES.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const current = PROOF_EXAMPLES[currentIndex];
  
  return (
    <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      <div className="text-center mb-4">
        <span className="text-white font-medium">{current.startup}</span>
      </div>
      
      <div className="space-y-2 mb-4">
        {current.matches.map((match, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">• {match.name}</span>
            <span className="text-gray-500">— {match.score}%</span>
          </div>
        ))}
      </div>
      
      <div className="pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-500 mb-2">Why:</div>
        <div className="space-y-1">
          {current.whys.map((why, i) => (
            <div key={i} className="text-xs text-gray-400">{why}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CURIOSITY STRIP COMPONENT
// ============================================

function CuriosityStrip() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % CURIOSITY_LINES.length);
        setIsTransitioning(false);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={`text-center transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      <p className="text-gray-500 italic">
        "{CURIOSITY_LINES[currentIndex]}"
      </p>
    </div>
  );
}

// ============================================
// BACKGROUND INTELLIGENCE LAYER
// ============================================

function BackgroundLayer() {
  const [nodes, setNodes] = useState<Array<{ x: number; y: number; opacity: number; text: string }>>([]);
  
  useEffect(() => {
    const investorNames = [
      "Sequoia", "a16z", "Founders Fund", "Greylock", "Benchmark",
      "Lightspeed", "Index", "Accel", "Bessemer", "NEA",
      "General Catalyst", "Kleiner", "IVP", "GGV", "Tiger"
    ];
    
    const categories = [
      "HealthTech", "FinTech", "AI/ML", "SaaS", "Enterprise",
      "Consumer", "Climate", "DeepTech", "Infra", "B2B"
    ];
    
    const allTexts = [...investorNames, ...categories];
    
    const generated = allTexts.map((text, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      opacity: 0.03 + Math.random() * 0.04,
      text
    }));
    
    setNodes(generated);
  }, []);
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none" style={{ zIndex: 0 }}>
      {nodes.map((node, i) => (
        <div
          key={i}
          className="absolute text-gray-700 text-xs whitespace-nowrap"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            opacity: node.opacity,
            transform: 'translate(-50%, -50%)',
            animation: `float ${20 + i % 10}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`
          }}
        >
          {node.text}
        </div>
      ))}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(20px); }
        }
      `}</style>
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

  const handleSubmit = useCallback((e: React.FormEvent) => {
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
    
    navigate(`/results?url=${encodeURIComponent(normalizedUrl)}`);
  }, [url, navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
      
      {/* SECTION 5: BACKGROUND INTELLIGENCE LAYER */}
      <BackgroundLayer />
      
      {/* Main content (above background) */}
      <div className="relative" style={{ zIndex: 1 }}>
        
        {/* ====================================
            SECTION 1: PRIMARY CTA SURFACE
            - Centered
            - Visually dominant
            - First thing the eye lands on
            ==================================== */}
        <section className="min-h-[60vh] flex items-center justify-center">
          <div className="max-w-xl mx-auto px-4 text-center">
            
            {/* Headline: "Find My Investors" (exact) */}
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Find My Investors
            </h1>
            
            {/* Subtext (one line max) */}
            <p className="text-gray-400 text-lg mb-8">
              Paste your startup website. We'll show you who recognizes you right now.
            </p>
            
            {/* Input + Button */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your website"
                autoComplete="off"
                className="w-full px-6 py-4 bg-[#111] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-lg text-center"
              />
              <button
                type="submit"
                disabled={isSubmitting || !url.trim()}
                className="w-full px-8 py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold text-lg rounded-xl transition-colors flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Find My Investors
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
            
          </div>
        </section>
        
        {/* ====================================
            SECTION 2: THIN PROOF STRIP
            - Rotating, live-looking
            - No "Example" or "Demo" labels
            - Feels like a leak from the engine
            ==================================== */}
        <section className="py-12">
          <div className="max-w-sm mx-auto px-4">
            <div className="p-5 bg-[#0f0f0f] border border-gray-800/50 rounded-xl">
              <ProofStrip />
            </div>
          </div>
        </section>
        
        {/* ====================================
            SECTION 3: CURIOSITY STRIP
            - Rotating intrigue
            - No explanation, no instruction
            ==================================== */}
        <section className="py-8">
          <div className="max-w-lg mx-auto px-4">
            <CuriosityStrip />
          </div>
        </section>
        
        {/* ====================================
            SECTION 4: SINGLE CREDIBILITY ANCHOR
            - One line only
            - No logos, no testimonials
            ==================================== */}
        <section className="py-8 pb-16">
          <div className="max-w-lg mx-auto px-4 text-center">
            <p className="text-gray-600 text-sm">
              Built from real investor behavior, not pitch decks.
            </p>
          </div>
        </section>
        
      </div>
    </div>
  );
}
