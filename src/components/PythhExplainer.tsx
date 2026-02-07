/**
 * PYTHH EXPLAINER MODAL
 * =====================
 * Clean Supabase-dark themed explainer popup
 * Ported from HotMatchPopup but with Pythh branding and minimal styling
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Zap, 
  Brain, 
  Target, 
  TrendingUp, 
  Rocket, 
  Briefcase, 
  ArrowRight, 
  CheckCircle2,
  Globe,
  BarChart3,
  Layers,
  Activity
} from 'lucide-react';

interface PythhExplainerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PythhExplainer({ isOpen, onClose }: PythhExplainerProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'founders' | 'investors'>('founders');
  
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

  const handleFounderCTA = () => {
    onClose();
    navigate('/signup/founder');
  };

  const handleInvestorCTA = () => {
    onClose();
    navigate('/signup/investor');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#0a0a0a] border border-zinc-800 shadow-2xl">
        
        {/* Subtle background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 transition-all"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>

        {/* Content */}
        <div className="relative z-10 overflow-y-auto max-h-[90vh]">
          
          {/* Header */}
          <div className="text-center pt-10 pb-6 px-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 text-xs font-medium">Signal Intelligence</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                Pythh
              </span>
            </h1>
            
            <p className="text-lg text-zinc-400 max-w-xl mx-auto">
              Real-time investor signals. Know who's looking.
            </p>
          </div>

          {/* The Problem */}
          <div className="px-8 pb-6">
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <X className="w-4 h-4" />
                Fundraising is broken
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">For Founders:</h3>
                  <div className="space-y-1.5">
                    {[
                      { stat: "3-6 mo", text: "chasing wrong investors" },
                      { stat: "97%", text: "of cold emails ignored" },
                      { stat: "Zero", text: "visibility into timing" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-red-400 font-semibold w-12">{item.stat}</span>
                        <span className="text-zinc-500">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">For Investors:</h3>
                  <div className="space-y-1.5">
                    {[
                      { stat: "Flooded", text: "with irrelevant deal flow" },
                      { stat: "Missing", text: "deals outside network" },
                      { stat: "Hours", text: "manually screening" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-red-400 font-semibold w-12">{item.stat}</span>
                        <span className="text-zinc-500">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works - Pipeline */}
          <div className="px-8 pb-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              How Pythh Works
            </h2>
            
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { step: 1, icon: "📡", title: "Discover", desc: "100+ sources" },
                { step: 2, icon: "🤖", title: "Extract", desc: "AI scanning" },
                { step: 3, icon: "✨", title: "Enrich", desc: "Fill gaps" },
                { step: 4, icon: "⚡", title: "Score", desc: "Fit analysis" },
                { step: 5, icon: "🎯", title: "Match", desc: "<2 seconds" },
                { step: 6, icon: "🧠", title: "Learn", desc: "Improves daily" },
              ].map((item) => (
                <div key={item.step} className="bg-[#111111] rounded-lg p-3 border border-zinc-800 text-center">
                  <div className="text-xl mb-1">{item.icon}</div>
                  <div className="text-white font-medium text-xs">{item.title}</div>
                  <div className="text-zinc-600 text-[10px]">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs: Founders vs Investors */}
          <div className="px-8 pb-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('founders')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'founders'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:text-zinc-400'
                }`}
              >
                <Rocket className="w-4 h-4 inline mr-2" />
                For Founders
              </button>
              <button
                onClick={() => setActiveTab('investors')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'investors'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-800 hover:text-zinc-400'
                }`}
              >
                <Briefcase className="w-4 h-4 inline mr-2" />
                For Investors
              </button>
            </div>

            {activeTab === 'founders' && (
              <div className="bg-[#111111] border border-zinc-800 rounded-xl p-5">
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      icon: <Target className="w-5 h-5" />,
                      title: 'Live Match Table',
                      desc: 'See investors ranked by fit + timing. No guessing.',
                    },
                    {
                      icon: <TrendingUp className="w-5 h-5" />,
                      title: 'Signal Momentum',
                      desc: 'Track when investor interest is rising in your sector.',
                    },
                    {
                      icon: <Zap className="w-5 h-5" />,
                      title: 'Timing Intelligence',
                      desc: 'Know when to reach out. Window opens, window closes.',
                    },
                    {
                      icon: <Brain className="w-5 h-5" />,
                      title: 'Why You Match',
                      desc: 'Understand the fit. Tailor your outreach.',
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">{item.title}</h4>
                        <p className="text-zinc-500 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'investors' && (
              <div className="bg-[#111111] border border-zinc-800 rounded-xl p-5">
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      icon: <Globe className="w-5 h-5" />,
                      title: 'Pattern Recognition',
                      desc: 'See signals forming across sectors before they\'re obvious.',
                    },
                    {
                      icon: <BarChart3 className="w-5 h-5" />,
                      title: 'Thesis-Aligned Discovery',
                      desc: 'Matches tuned to your specific mandate.',
                    },
                    {
                      icon: <Activity className="w-5 h-5" />,
                      title: 'Signal Layer',
                      desc: 'Track formation trends. Know what\'s heating up.',
                    },
                    {
                      icon: <Brain className="w-5 h-5" />,
                      title: 'Intelligence Without Noise',
                      desc: 'Trends and patterns, not pitch spam.',
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">{item.title}</h4>
                        <p className="text-zinc-500 text-xs">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="px-8 pb-6">
            <div className="bg-gradient-to-r from-cyan-500/5 to-emerald-500/5 border border-cyan-500/10 rounded-xl p-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { value: '3,400+', label: 'Startups', icon: '🚀' },
                  { value: '3,200+', label: 'Investors', icon: '💼' },
                  { value: '100+', label: 'Data Sources', icon: '📡' },
                  { value: '<2 sec', label: 'Match Speed', icon: '⚡' },
                  { value: '89%', label: 'Accuracy', icon: '🎯' },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div className="text-lg mb-0.5">{stat.icon}</div>
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                    <div className="text-zinc-600 text-xs">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-8 pb-8">
            <div className="bg-[#111111] border border-zinc-800 rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Ready to see your signals?</h3>
              <p className="text-zinc-500 text-sm mb-5">
                Join thousands using Pythh for fundraising intelligence.
              </p>
              
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <button
                  onClick={handleFounderCTA}
                  className="group py-3 px-5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold hover:from-cyan-400 hover:to-cyan-500 transition-all flex items-center justify-center gap-2"
                >
                  <Rocket className="w-4 h-4" />
                  I'm a Founder
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                
                <button
                  onClick={handleInvestorCTA}
                  className="group py-3 px-5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-400 hover:to-emerald-500 transition-all flex items-center justify-center gap-2"
                >
                  <Briefcase className="w-4 h-4" />
                  I'm an Investor
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <p className="text-zinc-600 text-xs">
                Free to explore · No credit card · Matches in seconds
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
