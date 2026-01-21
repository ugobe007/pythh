/**
 * PYTHH DEMO PAGE - Doctrine v1.0
 * ================================
 * The Perfect Revelation Surface
 * 
 * Purpose:
 * - Answer "What happens if I paste my URL?"
 * - Show the exact experience without asking for effort
 * 
 * This is literally the Results page contract but with:
 * - A perfect example startup
 * - Perfect signal scores
 * - Perfect top 5 matches
 * - No form required
 * 
 * INVARIANTS:
 * - Must feel identical to real results
 * - Must not require signup
 * - Must not gate anything
 * - Must not explain theory
 * - Must not show diagnostics
 * - Must not coach or sermonize
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Lock, ArrowRight, Info } from 'lucide-react';

// ============================================
// CANNED DEMO DATA (Perfect revelation)
// ============================================

const DEMO_STARTUP = {
  name: "Rovi Health",
  sectors: ["HealthTech", "B2B", "Infrastructure"],
  stage: "Pre-seed"
};

const DEMO_MATCHES = [
  {
    id: "demo-1",
    rank: 1,
    name: "US Seed Operator Fund",
    score: 87,
    tags: ["HealthTech", "Pre-seed", "Operator-led"],
    distance: "Warm path likely",
    why: "Portfolio adjacency + early-category pattern match in health infrastructure",
    signals: ["Portfolio adjacency", "Category heat", "Thesis overlap", "Timing fit"],
    timing: "Their activity in your category has increased over the last 30 days.",
    alignSteps: [
      "Publish technical benchmarks or case study",
      "Reframe narrative toward infrastructure positioning",
      "Find portfolio founder for warm intro"
    ]
  },
  {
    id: "demo-2",
    rank: 2,
    name: "Enterprise Health Ventures",
    score: 82,
    tags: ["Digital Health", "Seed", "B2B"],
    distance: "Portfolio adjacent",
    why: "Thesis overlap with recent infrastructure deals in digital health",
    signals: ["Thesis overlap", "Category heat", "Execution cadence"],
    timing: "They are warming toward startups like yours.",
    alignSteps: [
      "Highlight B2B traction metrics",
      "Emphasize enterprise readiness",
      "Prepare technical architecture overview"
    ]
  },
  {
    id: "demo-3",
    rank: 3,
    name: "Seed Stage Capital",
    score: 79,
    tags: ["HealthTech", "Pre-seed", "Technical"],
    distance: "Warm path likely",
    why: "Category heat + execution cadence signals match their recent pattern",
    signals: ["Category heat", "Technical credibility", "Execution cadence"],
    timing: "Their portfolio shows increasing concentration in your space.",
    alignSteps: [
      "Publish technical deep-dive content",
      "Showcase engineering team credentials",
      "Demonstrate rapid iteration velocity"
    ]
  },
  {
    id: "demo-4",
    rank: 4,
    name: "Health Infra Partners",
    score: 76,
    tags: ["Healthcare", "Seed", "Infrastructure"],
    distance: "Cold",
    why: "Emerging thesis alignment in health infrastructure space",
    signals: ["Thesis overlap", "Category heat"],
    timing: "They are early but tracking this space.",
    alignSteps: [
      "Build thought leadership in health infra",
      "Get featured in relevant industry publications",
      "Network at healthcare infrastructure events"
    ]
  },
  {
    id: "demo-5",
    rank: 5,
    name: "Technical Founders Fund",
    score: 74,
    tags: ["B2B", "Pre-seed", "Deep Tech"],
    distance: "Portfolio adjacent",
    why: "Technical credibility + team pattern match with their portfolio",
    signals: ["Technical credibility", "Execution cadence", "Narrative fit"],
    timing: "They recently increased activity in technical founder-led companies.",
    alignSteps: [
      "Highlight technical founder backgrounds",
      "Publish engineering blog posts",
      "Demonstrate technical moat clearly"
    ]
  }
];

const DEMO_BLURRED = [
  { rank: 6, name: "Vertical Health Fund", score: 72, tags: ["HealthTech", "Seed"] },
  { rank: 7, name: "Pre-seed Specialists", score: 70, tags: ["Pre-seed", "B2B"] },
  { rank: 8, name: "Digital Health Angels", score: 68, tags: ["Digital Health", "Angel"] },
  { rank: 9, name: "Infrastructure Capital", score: 67, tags: ["Infrastructure", "Seed"] },
  { rank: 10, name: "Health Innovation Fund", score: 65, tags: ["Healthcare", "Seed"] },
];

const DEMO_STRONG_SIGNALS = ["Category fit", "Technical credibility"];
const DEMO_WEAK_SIGNALS = ["Traction proof", "Narrative clarity"];
const DEMO_CHANGING_SIGNALS = ["Hiring velocity", "Product momentum"];

const DEMO_ACTIONS = [
  {
    action: "Publish a case study",
    why: "Increases technical credibility signal for 8 of your top 15 investors.",
    unlocks: ["US Seed Operator Fund", "Enterprise Health Ventures"]
  },
  {
    action: "Warm intro to US Seed Operator Fund",
    why: "They're in a forming window and have portfolio adjacency to you.",
    unlocks: ["US Seed Operator Fund"]
  },
  {
    action: "Reframe homepage positioning",
    why: "Aligns your narrative with the dominant thesis cluster in your category.",
    unlocks: ["US Seed Operator Fund", "Seed Stage Capital", "Health Infra Partners"]
  }
];

// ============================================
// INVESTOR CARD COMPONENT
// ============================================

interface DemoInvestorCardProps {
  investor: typeof DEMO_MATCHES[0];
  isExpanded: boolean;
  onToggle: () => void;
}

function DemoInvestorCard({ investor, isExpanded, onToggle }: DemoInvestorCardProps) {
  return (
    <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden">
      {/* Main Card */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-900/50"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-gray-500 text-sm font-mono">#{investor.rank}</span>
              <h3 className="text-white font-semibold truncate">{investor.name}</h3>
            </div>
            
            <div className="flex flex-wrap gap-1.5 mb-2">
              {investor.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className={investor.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                {investor.distance}
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 truncate">{investor.why}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <div className={`text-3xl font-bold ${
              investor.score >= 85 ? 'text-emerald-400' :
              investor.score >= 70 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {investor.score}
            </div>
            <span className="text-xs text-gray-500">Signal Score</span>
            <div className="mt-2 text-gray-500">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </div>
      
      {/* Expanded Section */}
      {isExpanded && (
        <div className="border-t border-gray-800 p-4 bg-gray-900/30 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Why this investor is aligned with you</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>• Portfolio adjacency detected</li>
              <li>• Category heat forming in your problem space</li>
              <li>• Thesis overlap with their recent deals</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Signals they are paying attention to</h4>
            <div className="flex flex-wrap gap-2">
              {investor.signals.map((chip, i) => (
                <span key={i} className="px-2.5 py-1 text-xs bg-violet-900/40 text-violet-300 border border-violet-700/50 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-1">Timing</h4>
            <p className="text-sm text-gray-400">{investor.timing}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">How to align with this investor</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              {investor.alignSteps.map((step, i) => (
                <li key={i}>• {step}</li>
              ))}
            </ul>
          </div>
          
          <div className="pt-2">
            <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
              Generate intro angle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN DEMO PAGE
// ============================================

export default function DemoPageDoctrine() {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Banner */}
        <div className="mb-6 p-3 bg-violet-900/20 border border-violet-700/30 rounded-lg text-center">
          <p className="text-sm text-violet-300">
            This is a live example for a HealthTech startup.
          </p>
        </div>
        
        {/* ====================================
            SECTION 1: TOP 5 MATCHES
            ==================================== */}
        <section className="mb-12">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Your Top Investor Matches</h1>
            <p className="text-gray-400">Based on live capital signals + thesis alignment</p>
          </div>
          
          <div className="space-y-3">
            {DEMO_MATCHES.map((investor, i) => (
              <DemoInvestorCard
                key={investor.id}
                investor={investor}
                isExpanded={expandedCard === i}
                onToggle={() => setExpandedCard(expandedCard === i ? null : i)}
              />
            ))}
          </div>
        </section>
        
        {/* ====================================
            SECTION 3: MORE MATCHES (BLURRED)
            ==================================== */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">More Investor Matches</h2>
            <p className="text-sm text-gray-500">Ranked by the same live capital signals • 52+ total</p>
          </div>
          
          <div className="relative">
            <div className="space-y-3 blur-sm pointer-events-none select-none">
              {DEMO_BLURRED.map((investor, i) => (
                <div key={i} className="p-4 bg-[#111] border border-gray-800 rounded-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-gray-500 text-sm font-mono">#{investor.rank}</span>
                        <span className="text-white font-semibold">{investor.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {investor.tags.map((tag, j) => (
                          <span key={j} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{investor.score}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Unlock overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent">
              <div className="text-center px-6">
                <Lock className="w-8 h-8 mx-auto mb-3 text-amber-400" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  52+ more investors matched
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Paste your website to get your own matches
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Get my matches
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
        
        {/* ====================================
            SECTION 4: SIGNAL MIRROR
            ==================================== */}
        <section className="mb-12 p-6 bg-[#111] border border-gray-800 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-4">How capital currently sees this startup</h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-emerald-400 mb-2">Strong signals</h3>
              <ul className="space-y-1">
                {DEMO_STRONG_SIGNALS.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-2">Weak signals</h3>
              <ul className="space-y-1">
                {DEMO_WEAK_SIGNALS.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-amber-400 mb-2">Changing signals</h3>
              <ul className="space-y-1">
                {DEMO_CHANGING_SIGNALS.map((s, i) => (
                  <li key={i} className="text-sm text-gray-300">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <p className="text-gray-400 text-sm border-t border-gray-800 pt-4">
            Your strongest driver right now is category fit. Your weakest is traction proof. This is why US Seed Operator Fund is rising while Health Infra Partners is flat.
          </p>
        </section>
        
        {/* ====================================
            SECTION 5: WHAT TO DO NEXT
            ==================================== */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">What to do next</h2>
          
          <div className="space-y-4">
            {DEMO_ACTIONS.map((item, i) => (
              <div key={i} className="p-4 bg-[#111] border border-gray-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center shrink-0">
                    <span className="text-violet-400 font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{item.action}</h3>
                    <p className="text-sm text-gray-400 mb-2">{item.why}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-gray-500">Unlocks:</span>
                      {item.unlocks.map((inv, j) => (
                        <span key={j} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                          {inv}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* ====================================
            HOW IT WORKS (optional)
            ==================================== */}
        <section className="mb-8">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Info className="w-4 h-4" />
            How does this work?
            {showHowItWorks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showHowItWorks && (
            <div className="mt-4 p-4 bg-[#111] border border-gray-800 rounded-lg">
              <h3 className="font-medium text-white mb-3">How Pythh generates your matches</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• We fingerprint your startup signals</li>
                <li>• We fingerprint investor theses</li>
                <li>• We track capital momentum</li>
                <li>• We detect portfolio adjacency</li>
                <li>• We rank matches by live alignment</li>
              </ul>
            </div>
          )}
        </section>
        
        {/* ====================================
            FINAL CTA
            ==================================== */}
        <section className="py-12 border-t border-gray-800 text-center">
          <p className="text-gray-400 mb-6">
            Paste your website to see your matches.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
          >
            Get my investor matches
            <ArrowRight className="w-5 h-5" />
          </Link>
        </section>
        
      </div>
    </div>
  );
}
