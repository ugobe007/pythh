import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Brain, Zap, Target, TrendingUp, Users, Shield, Flame, ChevronRight, Clock, CheckCircle2, BarChart3, Cpu, Globe, Layers, ArrowRight, Play, Rocket, Briefcase } from 'lucide-react';
import GODScoreDemo from './GODScoreDemo';

type Brand = "pythh" | "hotmatch";

const COPY: Record<Brand, { engineName: string; productName: string; badgeName?: string }> = {
  pythh: {
    productName: "Pythh",
    engineName: "Intelligence Engine",
    badgeName: "Pythh Badge",
  },
  hotmatch: {
    productName: "Hot Match",
    engineName: "GOD Algorithm",
    badgeName: "Hot Match Badge",
  },
};

interface HotMatchPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onGetMatched?: () => void;
  brand?: Brand;
}

export default function HotMatchPopup({ isOpen, onClose, onGetMatched, brand = "pythh" }: HotMatchPopupProps) {
  const copy = COPY[brand];
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'problem' | 'solution' | 'how' | 'why'>('problem');
  const [showDemo, setShowDemo] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartupSignup = () => {
    onClose();
    navigate('/get-matched?type=startup');
    // Navigate directly to pricing page for startups (skip type selection)
  };

  const handleInvestorSignup = () => {
    onClose();
    navigate('/investor/signup');
    // Don't call onGetMatched - we're handling navigation directly
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/20 shadow-2xl shadow-cyan-500/10">
        
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-110"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Content */}
        <div className="relative z-10 overflow-y-auto max-h-[90vh]">
          
          {/* Hero Header */}
          <div className="text-center pt-12 pb-8 px-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
              <Flame className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-cyan-300 text-sm font-bold tracking-wide">THE FUTURE OF FUNDRAISING</span>
              <Flame className="w-4 h-4 text-cyan-400 animate-pulse" />
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-cyan-400">
                [pyth]
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-300 to-violet-400">
                ai
              </span>
            </h1>
            
            <p className="text-2xl md:text-3xl text-white font-light max-w-3xl mx-auto leading-relaxed mb-2">
              Get matched with <span className="text-cyan-400 font-semibold">perfect-fit investors</span> in 
              <span className="text-cyan-400 font-bold"> under 2 seconds</span>
            </p>
            
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              AI-powered scoring from <span className="text-white font-medium">20+ top VC frameworks</span> including 
              Y Combinator, Sequoia, First Round Capital, and more.
            </p>
          </div>

          {/* The Problem - Brutal Reality */}
          <div className="px-8 pb-8">
            <div className="bg-gradient-to-r from-red-500/10 to-red-900/10 border border-red-500/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                <X className="w-6 h-6" />
                Fundraising Is Broken
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-semibold mb-3">For Startups:</h3>
                  <div className="space-y-2">
                    {[
                      { stat: "3-6 months", text: "wasted chasing wrong investors" },
                      { stat: "97%", text: "of cold emails get ignored" },
                      { stat: "Zero", text: "visibility into what investors actually want" },
                      { stat: "Generic", text: "pitches sent to everyone" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-red-400 font-bold text-sm w-20">{item.stat}</span>
                        <span className="text-gray-400">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-white font-semibold mb-3">For Investors:</h3>
                  <div className="space-y-2">
                    {[
                      { stat: "Flooded", text: "with irrelevant deal flow" },
                      { stat: "Missing", text: "perfect deals outside their network" },
                      { stat: "Hours", text: "spent manually screening startups" },
                      { stat: "No system", text: "for consistent scoring" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-red-400 font-bold text-sm w-20">{item.stat}</span>
                        <span className="text-gray-400">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The Solution - Three Pillars */}
          <div className="px-8 pb-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Three Pillars of <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-cyan-400">[pyth]</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">ai</span>
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {/* Pillar 1: Intelligence Engine */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-sm opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-5 h-full hover:border-cyan-500/60 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Intelligence Engine</h3>
                  <p className="text-gray-400 text-sm mb-3">Auto-discovers and enriches startup data from 100+ sources in real-time</p>
                  <div className="space-y-1.5">
                    {["RSS scraping (100+ sources)", "AI-powered document scanning", "Real-time enrichment", "Investor activity tracking"].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pillar 2: GOD Algorithm */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl blur-sm opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-5 h-full hover:border-cyan-500/60 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{copy.engineName}™</h3>
                  <p className="text-cyan-400 text-xs font-semibold mb-2">{brand === "hotmatch" ? "Grit · Opportunity · Determination" : "Precision · Insight · Speed"}</p>
                  <p className="text-gray-400 text-sm mb-3">Proprietary scoring combining 20+ VC frameworks</p>
                  <div className="space-y-1.5">
                    {["Y Combinator criteria", "Sequoia Capital principles", "First Round methodology", "+17 more top VC models"].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pillar 3: Machine Learning */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-sm opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-slate-800/80 border border-purple-500/30 rounded-2xl p-5 h-full hover:border-purple-500/60 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4">
                    <Cpu className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Machine Learning</h3>
                  <p className="text-gray-400 text-sm mb-3">Self-improving system that learns from real outcomes</p>
                  <div className="space-y-1.5">
                    {["Pattern recognition", "Weight optimization", "Success prediction", "+15% improvement/quarter"].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GOD Score Breakdown */}
          <div className="px-8 pb-8">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">The GOD Score™ (0-100)</h3>
                  <p className="text-gray-400 text-sm">8 dimensions that predict startup success</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: "Team", weight: "3.0", color: "from-blue-500 to-cyan-500", desc: "Founders, experience, technical depth" },
                  { name: "Traction", weight: "3.0", color: "from-green-500 to-emerald-500", desc: "Revenue, users, growth rate" },
                  { name: "Market", weight: "2.0", color: "from-purple-500 to-indigo-500", desc: "TAM, opportunity, timing" },
                  { name: "Product", weight: "2.0", color: "from-cyan-600 to-blue-600", desc: "Demo, launch, defensibility" },
                  { name: "Vision", weight: "2.0", color: "from-pink-500 to-rose-500", desc: "Clarity, ambition, potential" },
                  { name: "Ecosystem", weight: "1.5", color: "from-teal-500 to-cyan-500", desc: "Backers, advisors, partners" },
                  { name: "Grit", weight: "1.5", color: "from-blue-500 to-yellow-500", desc: "Persistence, pivots, execution" },
                  { name: "Problem", weight: "2.0", color: "from-blue-500 to-violet-500", desc: "Pain point, willingness to pay" },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-900/50 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold text-sm">{item.name}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${item.color} text-white`}>
                        {item.weight}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How It Works - Pipeline */}
          <div className="px-8 pb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              How [pyth] ai Works
            </h2>
            
            <div className="relative">
              {/* Connection line */}
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 -translate-y-1/2 z-0" />
              
              <div className="grid md:grid-cols-6 gap-3 relative z-10">
                {[
                  { step: 1, icon: "📡", title: "Discover", desc: "100+ RSS sources scraped", time: "Every 30 min" },
                  { step: 2, icon: "🤖", title: "Extract", desc: "AI scans documents", time: "<5 sec/startup" },
                  { step: 3, icon: "✨", title: "Enrich", desc: "Fill data gaps", time: "Real-time" },
                  { step: 4, icon: "⚡", title: "Score", desc: `${copy.engineName}™`, time: "Instant" },
                  { step: 5, icon: "🔥", title: "Match", desc: "Find perfect investors", time: "<2 seconds" },
                  { step: 6, icon: "🧠", title: "Learn", desc: "ML improves", time: "+15%/quarter" },
                ].map((item) => (
                  <div key={item.step} className="bg-slate-800/80 rounded-xl p-3 border border-white/10 text-center">
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="text-white font-bold text-sm">{item.title}</div>
                    <div className="text-gray-500 text-xs mb-1">{item.desc}</div>
                    <div className="text-cyan-400 text-xs font-medium">{item.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="px-8 pb-8">
            <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 border border-cyan-500/20 rounded-2xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {[
                  { value: "3,400+", label: "Startups", icon: "🚀" },
                  { value: "3,200+", label: "Investors", icon: "💼" },
                  { value: "100+", label: "Data Sources", icon: "📡" },
                  { value: "<2 sec", label: "Match Speed", icon: "⚡" },
                  { value: "89%", label: "Accuracy", icon: "🎯" },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div className="text-2xl mb-1">{stat.icon}</div>
                    <div className="text-2xl md:text-3xl font-black text-white">{stat.value}</div>
                    <div className="text-gray-400 text-sm">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Why [pyth] ai - Competitive Advantages */}
          <div className="px-8 pb-8">
            <h2 className="text-xl font-bold text-white mb-4">Why [pyth] ai Wins</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  icon: <Shield className="w-5 h-5" />,
                  title: "No More Cold Outreach",
                  desc: "Every match is pre-qualified. Investors see startups that fit their thesis. Startups reach investors who actually invest in their sector and stage.",
                  color: "green"
                },
                {
                  icon: <Zap className="w-5 h-5" />,
                  title: "Speed That Matters",
                  desc: "Get matches in under 2 seconds. Not days. Not weeks. Seconds. While you're still on the call, you have your investor list.",
                  color: "orange"
                },
                {
                  icon: <Brain className="w-5 h-5" />,
                  title: "VC-Grade Intelligence",
                  desc: `We don't guess. Our ${copy.engineName}™ combines 20+ frameworks from Y Combinator, Sequoia, First Round, and the world's best VCs.`,
                  color: "purple"
                },
                {
                  icon: <TrendingUp className="w-5 h-5" />,
                  title: "Gets Smarter Every Day",
                  desc: "Our ML learns from real outcomes—investments, meetings, passes. The algorithm improves 15% every quarter. Your matches get better over time.",
                  color: "cyan"
                },
              ].map((item, idx) => (
                <div key={idx} className={`bg-${item.color}-500/10 border border-${item.color}-500/20 rounded-xl p-4 hover:border-${item.color}-500/40 transition-all`}
                  style={{
                    backgroundColor: item.color === 'green' ? 'rgba(34, 197, 94, 0.1)' :
                                    item.color === 'orange' ? 'rgba(249, 115, 22, 0.1)' :
                                    item.color === 'purple' ? 'rgba(168, 85, 247, 0.1)' :
                                    'rgba(6, 182, 212, 0.1)',
                    borderColor: item.color === 'green' ? 'rgba(34, 197, 94, 0.2)' :
                                 item.color === 'orange' ? 'rgba(249, 115, 22, 0.2)' :
                                 item.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                                 'rgba(6, 182, 212, 0.2)'
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg"
                      style={{
                        backgroundColor: item.color === 'green' ? 'rgba(34, 197, 94, 0.2)' :
                                        item.color === 'orange' ? 'rgba(249, 115, 22, 0.2)' :
                                        item.color === 'purple' ? 'rgba(168, 85, 247, 0.2)' :
                                        'rgba(6, 182, 212, 0.2)',
                        color: item.color === 'green' ? '#22c55e' :
                               item.color === 'orange' ? '#f97316' :
                               item.color === 'purple' ? '#a855f7' :
                               '#06b6d4'
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-white font-bold mb-1">{item.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final Statement */}
          <div className="px-8 pb-6">
            <div className="text-center py-6 border-t border-white/10">
              <p className="text-xl text-gray-300 italic mb-2">
                "This is not a novelty. This is the <span className="text-white font-semibold">future of fundraising</span>."
              </p>
              <p className="text-cyan-400 font-bold">
                [pyth] ai: Signal intelligence for fundraising. 🔥
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="px-8 pb-10">
            <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-6 text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Ready to Get Matched?</h3>
              <p className="text-gray-400 mb-6">Join 3,400+ startups and 3,200+ investors using [pyth] ai</p>
              
              {/* Two Primary CTAs */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {/* Startup CTA */}
                <button
                  onClick={handleStartupSignup}
                  className="group relative overflow-hidden px-6 py-5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white font-bold text-lg hover:from-cyan-600 hover:via-blue-600 hover:to-violet-600 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <Rocket className="w-5 h-5" />
                    <span>I'm a Startup</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                
                {/* Investor CTA */}
                <button
                  onClick={handleInvestorSignup}
                  className="group relative overflow-hidden px-6 py-5 rounded-xl bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white font-bold text-lg hover:from-purple-600 hover:via-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <Briefcase className="w-5 h-5" />
                    <span>I'm an Investor</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-white/20" />
                <span className="text-gray-500 text-sm">or</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/20 to-white/20" />
              </div>

              {/* Secondary CTA */}
              <button
                onClick={() => setShowDemo(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
              >
                <Play className="w-4 h-4" />
                Watch Demo
              </button>
              
              <p className="text-gray-500 text-sm mt-4">
                Free to explore · No credit card required · Matches in under 2 seconds
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-500 italic text-center max-w-xl mx-auto">
            Pythh reads investor signals so founders don't have to guess.
          </p>
        </div>
      </div>

      {/* GOD Score Demo Modal */}
      <GODScoreDemo 
        isOpen={showDemo} 
        onClose={() => setShowDemo(false)} 
      />
    </div>
  );
}

