/**
 * SIGNAL CONFIRMATION PAGE (Screen C)
 * ====================================
 * Psychological win after signup
 * - Confirms signal tracking is enabled
 * - Shows what's being monitored
 * - Links to full signal snapshot
 * - Creates closure + momentum
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Activity, TrendingUp, Zap, ArrowRight, Brain } from 'lucide-react';
import BrandMark from '../components/BrandMark';

export default function SignalConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showContent, setShowContent] = useState(false);
  
  const startupUrl = searchParams.get('url') || '';
  const matchCount = searchParams.get('matches') || '53';

  // Animate in after mount
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Build redirect URL back to matches
  const viewSignalsUrl = startupUrl 
    ? `/instant-matches?url=${encodeURIComponent(startupUrl)}`
    : '/saved-matches';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* Brand mark */}
      <div className="fixed top-5 left-5 z-40">
        <BrandMark />
      </div>

      <div className={`w-full max-w-lg relative z-10 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Success Card */}
        <div className="bg-[#111111] rounded-2xl p-8 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-emerald-500/30 animate-ping" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">
              ✓ Signal tracking enabled
            </h1>
            <p className="text-gray-400 text-sm">
              Your startup is now monitored for:
            </p>
          </div>

          {/* What's being tracked */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-gray-800 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Activity className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-white font-medium">Investor readiness</p>
                <p className="text-gray-500 text-xs">Active status, recent activity, response patterns</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-gray-800 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Brain className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-white font-medium">Thesis convergence</p>
                <p className="text-gray-500 text-xs">How closely investors align with your space</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-gray-800 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Capital velocity shifts</p>
                <p className="text-gray-500 text-xs">Market timing and deployment signals</p>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <Link
            to={viewSignalsUrl}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            View My Signal Snapshot
            <ArrowRight className="w-5 h-5" />
          </Link>

          {/* Secondary info */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-xs flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-500" />
              Signals update daily — check back for changes
            </p>
          </div>
        </div>

        {/* Quiet system message */}
        <div className="mt-6 text-center">
          <p className="text-gray-700 text-xs font-mono">
            system: signal_tracking_enabled
          </p>
        </div>
      </div>
    </div>
  );
}
