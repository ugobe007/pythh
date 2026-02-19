/**
 * Paywall Modal - Freemium Gate
 * Shows after user has exhausted their free analysis quota (5 analyses)
 */

import React from 'react';
import { X, Zap, Crown, TrendingUp, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisCount: number;
  analysisLimit: number;
}

const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  analysisCount,
  analysisLimit,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-8 relative shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-3">
              You've Used All {analysisLimit} Free Analyses
            </h2>
            
            <p className="text-lg text-slate-300">
              Upgrade to Pro for unlimited analyses, investor contact info, and match tracking.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white mb-1">{analysisCount}</div>
              <div className="text-xs text-slate-400">Analyses Used</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-cyan-400 mb-1">∞</div>
              <div className="text-xs text-slate-400">With Pro</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">841K+</div>
              <div className="text-xs text-slate-400">Live Matches</div>
            </div>
          </div>

          {/* What You Get with Pro */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-cyan-400" />
              Unlock Pro Features
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-medium">Unlimited Startup Analyses</div>
                  <div className="text-sm text-slate-400">No more limits. Analyze as many startups as you want.</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-medium">Full Investor Contact Info</div>
                  <div className="text-sm text-slate-400">Get emails, LinkedIn profiles, and intro paths to 4,300+ investors.</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-medium">Match History & Tracking</div>
                  <div className="text-sm text-slate-400">Save up to 50 matches, get email alerts for hot matches.</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/pricing?source=analysis_limit"
              className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-semibold text-center hover:from-cyan-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
              onClick={onClose}
            >
              Upgrade to Pro - $49/month
            </Link>
            
            <button
              onClick={onClose}
              className="py-4 px-6 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition"
            >
              Maybe Later
            </button>
          </div>

          {/* Fine Print */}
          <p className="text-center text-xs text-slate-500 mt-4">
            14-day free trial · Cancel anytime · Money-back guarantee
          </p>
        </div>
      </div>
    </>
  );
};

export default PaywallModal;
