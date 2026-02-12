/**
 * GetMatchedPopup - Conversion popup to capture users
 * Shows after viewing matches to encourage signups
 */

import { useState } from 'react';
import { X, Sparkles, ArrowRight, Brain } from 'lucide-react';

type Brand = "pythh" | "hotmatch";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lastMatchScore?: number;
  lastStartupName?: string;
  brand?: Brand;
}

export default function GetMatchedPopup({ isOpen, onClose, lastMatchScore, lastStartupName, brand = "pythh" }: Props) {
  const badgeText = brand === "pythh" ? "PYTHH ALERT" : "HOT MATCH ALERT";
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsSubmitting(true);
    
    // Redirect to startup signup with URL pre-filled
    setTimeout(() => {
      window.location.href = `/startup/signup?url=${encodeURIComponent(url)}`;
    }, 500);
  };

  const handleSkip = () => {
    onClose();
  };

  const isHotMatch = lastMatchScore && lastMatchScore >= 95;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 rounded-2xl border border-violet-500/30 shadow-2xl shadow-violet-500/20 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Glow effects */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-500/30 rounded-full blur-3xl" />
        
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Content */}
        <div className="relative p-6 pt-8">
          {/* Flame icon */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img 
                src="/images/fire_icon_03.jpg" 
                alt="Fire" 
                className="w-20 h-20 object-contain animate-pulse drop-shadow-[0_0_20px_rgba(255,120,0,0.8)]"
              />
              {/* Glow effect behind flame */}
              <div className="absolute inset-0 w-20 h-20 bg-orange-500/40 rounded-full blur-xl -z-10" />
            </div>
          </div>
          
          {/* Brand Badge */}
          {isHotMatch && (
            <div className="flex justify-center mb-3">
              <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full text-xs font-bold text-white flex items-center gap-1 animate-pulse">
                <img src="/images/fire_icon_01.jpg" alt="" className="w-4 h-4 object-contain" /> {badgeText}
              </span>
            </div>
          )}
          
          {/* Headline */}
          <h2 className="text-2xl font-bold text-center mb-2">
            <span className="block bg-gradient-to-r from-purple-400 via-violet-300 to-cyan-300 bg-clip-text text-transparent">Perfect Matches</span>
            <span className="block bg-gradient-to-r from-violet-400 via-blue-300 to-cyan-200 bg-clip-text text-transparent">... in Seconds</span>
          </h2>
          
          {/* Subheadline */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-800 to-slate-900 rounded-full border border-violet-500/50">
              <img src="/images/fire_icon_01.jpg" alt="" className="w-4 h-4 object-contain" />
              <span className="text-sm text-gray-300">Powered by</span>
              <span className="text-sm font-bold bg-gradient-to-r from-orange-400 to-violet-400 bg-clip-text text-transparent">
                GOD Score™
              </span>
            </div>
          </div>
          
          {/* Algorithm explanation */}
          <div className="bg-black/30 rounded-xl p-3 mb-4 border border-violet-700/50">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-2">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-violet-300 font-semibold">Powered by Advanced AI</span>
            </div>
            <p className="text-[11px] text-gray-500 text-center">
              Our <span className="text-orange-400">GOD Score™</span> analyzes 50+ data points — team strength, traction, market fit, and more. 
              <span className="text-white"> No guesswork. Pure data science.</span>
            </p>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Enter your startup URL to get matched instantly
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourstartup.com"
                autoComplete="off"
                className="w-full px-4 py-3 bg-black/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-violet-500/50 hover:shadow-violet-500/70"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <img src="/images/fire_icon_02.jpg" alt="" className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" />
                  Find My Investor Matches
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          {/* Trust indicators */}
          <div className="mt-5 pt-4 border-t border-violet-700/30">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                Free to try
              </span>
              <span>•</span>
              <span>No credit card</span>
              <span>•</span>
              <span>Results in 30 sec</span>
            </div>
          </div>
          
          {/* GOD Score badge */}
          <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-900/50 to-slate-900/50 rounded-full border border-violet-500/30">
              <img src="/images/fire_icon_01.jpg" alt="" className="w-4 h-4 object-contain" />
              <span className="text-[10px] text-gray-300">Powered by</span>
              <span className="text-[10px] font-bold bg-gradient-to-r from-orange-400 to-violet-400 bg-clip-text text-transparent">
                GOD Score™
              </span>
            </div>
          </div>
          
          {/* Skip link */}
          <button
            onClick={handleSkip}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Keep watching matches →
          </button>
        </div>
      </div>
    </div>
  );
}
