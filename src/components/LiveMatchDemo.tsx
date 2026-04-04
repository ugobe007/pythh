import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Brain, Rocket, Briefcase, ArrowRight, Sparkles } from 'lucide-react';

interface LiveMatchDemoProps {
  isOpen: boolean;
  onClose: () => void;
  showSignupButton?: boolean;
}

// Sample match data - cycles through these
const SAMPLE_MATCHES = [
  {
    startup: { name: 'NeuralFlow AI', sector: 'AI/ML', stage: 'Series A', ask: '$8M' },
    investor: { name: 'Sequoia Capital', focus: 'Enterprise AI', checkSize: '$5-20M' },
    score: 94
  },
  {
    startup: { name: 'GreenTech Solar', sector: 'CleanTech', stage: 'Seed', ask: '$2M' },
    investor: { name: 'Khosla Ventures', focus: 'Climate Tech', checkSize: '$1-5M' },
    score: 87
  },
  {
    startup: { name: 'HealthPulse', sector: 'HealthTech', stage: 'Series B', ask: '$15M' },
    investor: { name: 'a]6z Bio', focus: 'Digital Health', checkSize: '$10-50M' },
    score: 91
  },
  {
    startup: { name: 'FinanceBot', sector: 'FinTech', stage: 'Series A', ask: '$6M' },
    investor: { name: 'Ribbit Capital', focus: 'Financial Services', checkSize: '$5-15M' },
    score: 89
  },
  {
    startup: { name: 'DataMesh Pro', sector: 'Data Infra', stage: 'Seed', ask: '$3M' },
    investor: { name: 'Y Combinator', focus: 'Dev Tools', checkSize: '$500K-2M' },
    score: 96
  }
];

const LiveMatchDemo: React.FC<LiveMatchDemoProps> = ({ isOpen, onClose, showSignupButton = true }) => {
  const navigate = useNavigate();
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState(0); // 0=reset, 1=cards fly in, 2=match, 3=score, 4=celebration
  const [displayScore, setDisplayScore] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const currentMatch = SAMPLE_MATCHES[currentMatchIndex];

  // Animation cycle
  const runMatchAnimation = useCallback(() => {
    // Phase 0: Reset
    setAnimationPhase(0);
    setDisplayScore(0);
    
    // Phase 1: Cards fly in (300ms)
    setTimeout(() => setAnimationPhase(1), 100);
    
    // Phase 2: Match indicator appears (800ms)
    setTimeout(() => setAnimationPhase(2), 800);
    
    // Phase 3: Score animates (1200ms)
    setTimeout(() => {
      setAnimationPhase(3);
      // Animate score counting up
      const targetScore = SAMPLE_MATCHES[currentMatchIndex].score;
      let current = 0;
      const interval = setInterval(() => {
        current += 5;
        if (current >= targetScore) {
          current = targetScore;
          clearInterval(interval);
        }
        setDisplayScore(current);
      }, 30);
    }, 1200);
    
    // Phase 4: Celebration (2000ms)
    setTimeout(() => setAnimationPhase(4), 2000);
    
    // Next match (4000ms)
    setTimeout(() => {
      setCurrentMatchIndex((prev) => (prev + 1) % SAMPLE_MATCHES.length);
      setMatchCount((prev) => prev + 1);
    }, 4000);
  }, [currentMatchIndex]);

  // Start animation loop when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset state
    setCurrentMatchIndex(0);
    setAnimationPhase(0);
    setDisplayScore(0);
    setMatchCount(0);
    
    // Start first animation
    const startTimer = setTimeout(() => runMatchAnimation(), 500);
    
    return () => clearTimeout(startTimer);
  }, [isOpen]);

  // Continue animation loop
  useEffect(() => {
    if (!isOpen || matchCount === 0) return;
    runMatchAnimation();
  }, [currentMatchIndex, isOpen, matchCount]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartupSignup = () => {
    onClose();
    navigate('/get-matched?type=startup');
  };

  const handleInvestorSignup = () => {
    onClose();
    navigate('/investor/signup');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 rounded-3xl border border-violet-500/30 shadow-2xl shadow-violet-500/20 overflow-hidden">
        
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Content */}
        <div className="relative z-10 p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-violet-500/20 border border-orange-500/30 mb-4">
              <img src="/images/fire_icon_01.png" alt="" className="w-5 h-5 object-contain" />
              <span className="text-orange-300 text-sm font-bold">LIVE MATCHING DEMO</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
              <span className="block bg-gradient-to-r from-purple-500 via-violet-400 to-cyan-400 bg-clip-text text-transparent">Perfect Matches</span>
              <span className="block bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-300 bg-clip-text text-transparent">... in Seconds</span>
            </h2>
            <p className="text-gray-400">
              Watch how <span className="text-orange-400 font-semibold">GOD Score™</span> finds perfect investor matches
            </p>
          </div>

          {/* Live Match Animation Area */}
          <div className="relative bg-black/40 rounded-2xl border border-white/10 p-6 mb-8 min-h-[280px] flex items-center justify-center overflow-hidden">
            
            {/* Match counter */}
            <div className="absolute top-3 right-3 px-3 py-1 bg-white/10 rounded-full">
              <span className="text-xs text-gray-400">Match #{matchCount + 1}</span>
            </div>

            {/* Matching Animation */}
            <div className="flex items-center justify-center gap-4 md:gap-8 w-full">
              
              {/* Startup Card */}
              <div 
                className={`relative w-32 md:w-44 transition-all duration-700 ease-out ${
                  animationPhase >= 1 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 -translate-x-32'
                }`}
              >
                <div className={`bg-gradient-to-br from-emerald-900/90 to-emerald-950/90 rounded-2xl p-4 border-2 transition-all duration-300 ${
                  animationPhase >= 4 ? 'border-orange-500 shadow-lg shadow-orange-500/30' : 'border-emerald-500/60 shadow-lg shadow-emerald-500/30'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                      <Rocket className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{currentMatch.startup.name}</p>
                      <p className="text-emerald-300 text-xs">{currentMatch.startup.sector}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{currentMatch.startup.stage}</span>
                    <span className="text-emerald-400 font-semibold">{currentMatch.startup.ask}</span>
                  </div>
                </div>
              </div>

              {/* Center Match Indicator */}
              <div 
                className={`relative flex flex-col items-center transition-all duration-500 ${
                  animationPhase >= 2 
                    ? 'opacity-100 scale-100' 
                    : 'opacity-0 scale-50'
                }`}
              >
                {/* Fire icon with glow */}
                <div className="relative mb-2">
                  <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${
                    animationPhase >= 4 ? 'bg-orange-500/60 scale-150' : 'bg-orange-500/30'
                  }`} />
                  <img 
                    src="/images/fire_icon_01.png" 
                    alt="Match" 
                    className={`relative w-14 h-14 md:w-16 md:h-16 object-contain transition-all duration-300 ${
                      animationPhase >= 4 ? 'scale-125' : 'animate-pulse'
                    }`}
                  />
                </div>
                
                {/* GOD Score Badge */}
                <div 
                  className={`bg-gradient-to-r from-slate-800 to-slate-900 rounded-full px-4 py-2 border border-violet-500/50 transition-all duration-300 ${
                    animationPhase >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-400" />
                    <span className={`font-bold text-lg transition-colors duration-300 ${
                      displayScore >= 90 ? 'text-orange-400' : displayScore >= 80 ? 'text-green-400' : 'text-white'
                    }`}>
                      {displayScore}
                    </span>
                    <span className="text-gray-400 text-sm">%</span>
                  </div>
                </div>
                
                {/* Match text */}
                <p className={`text-center mt-2 font-bold transition-all duration-500 ${
                  animationPhase >= 4 
                    ? 'opacity-100 scale-110 text-orange-400' 
                    : 'opacity-0 scale-90 text-orange-400'
                }`}>
                  🔥 IT'S A MATCH!
                </p>
              </div>

              {/* Investor Card */}
              <div 
                className={`relative w-32 md:w-44 transition-all duration-700 ease-out ${
                  animationPhase >= 1 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 translate-x-32'
                }`}
              >
                <div className={`bg-gradient-to-br from-violet-900/90 to-purple-950/90 rounded-2xl p-4 border-2 transition-all duration-300 ${
                  animationPhase >= 4 ? 'border-orange-500 shadow-lg shadow-orange-500/30' : 'border-violet-500/60 shadow-lg shadow-violet-500/30'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold truncate">{currentMatch.investor.name}</p>
                      <p className="text-violet-300 text-xs">{currentMatch.investor.focus}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Check size</span>
                    <span className="text-violet-400 font-semibold">{currentMatch.investor.checkSize}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection particles (animated dots) */}
            {animationPhase >= 2 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping"
                    style={{
                      left: `${30 + Math.random() * 40}%`,
                      top: `${30 + Math.random() * 40}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1.5s'
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex justify-center gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-white font-bold">4,080</span>
              <span className="text-gray-400">Startups</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <Briefcase className="w-4 h-4 text-violet-400" />
              <span className="text-white font-bold">3,181</span>
              <span className="text-gray-400">Investors</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <img src="/images/fire_icon_01.png" alt="" className="w-4 h-4 object-contain" />
              <span className="text-white font-bold">399K</span>
              <span className="text-gray-400">Matches</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleStartupSignup}
              className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-lg hover:from-emerald-600 hover:to-green-600 transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
            >
              <div className="flex items-center justify-center gap-2">
                <Rocket className="w-5 h-5" />
                <span>I'm a Startup</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
            
            <button
              onClick={handleInvestorSignup}
              className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold text-lg hover:from-violet-600 hover:to-purple-600 transition-all shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105"
            >
              <div className="flex items-center justify-center gap-2">
                <Briefcase className="w-5 h-5" />
                <span>I'm an Investor</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>

          {/* Trust text */}
          <p className="text-center text-gray-500 text-xs mt-6">
            Free to explore · No credit card required · Matches in under 2 seconds
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveMatchDemo;
