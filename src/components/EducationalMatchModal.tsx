import React from 'react';
import { X, TrendingUp, Users, Target, Zap, Lightbulb, MapPin, DollarSign, Briefcase, Award } from 'lucide-react';

type Brand = "pythh" | "hotmatch";

interface EducationalMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand?: Brand;
  matchScore?: number;
  startupName?: string;
  investorName?: string;
  investorFirm?: string;
  godScores?: {
    total: number;
    team: number;
    traction: number;
    market: number;
    product: number;
    vision: number;
  };
  breakdown?: {
    industryMatch: number;
    stageMatch: number;
    geographyMatch: number;
    checkSizeMatch: number;
    thesisAlignment: number;
  };
  reasoning?: string[];
}

const EducationalMatchModal: React.FC<EducationalMatchModalProps> = ({
  isOpen,
  onClose,
  matchScore,
  startupName,
  investorName,
  investorFirm,
  godScores,
  breakdown,
  reasoning = [],
  brand = "pythh"
}) => {
  const engineName = brand === "pythh" ? "Intelligence Engine" : "GOD Algorithm™";
  
  if (!isOpen) return null;

  const ProgressBar = ({ 
    label, 
    value, 
    color, 
    icon: Icon, 
    explanation 
  }: { 
    label: string; 
    value: number; 
    color: string; 
    icon: any;
    explanation?: string;
  }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-white font-medium text-sm">{label}</span>
        </div>
        <span className={`text-lg font-bold ${color}`}>{value}%</span>
      </div>
      <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color.replace('text-', 'bg-gradient-to-r from-')}`}
          style={{ 
            width: `${Math.min(100, value)}%`,
            background: value >= 80 ? 'linear-gradient(to right, #10b981, #059669)' :
                        value >= 60 ? 'linear-gradient(to right, #06b6d4, #0891b2)' :
                        value >= 40 ? 'linear-gradient(to right, #f59e0b, #d97706)' :
                        'linear-gradient(to right, #ef4444, #dc2626)'
          }}
        />
      </div>
      {explanation && (
        <p className="text-xs text-gray-400 mt-1">{explanation}</p>
      )}
    </div>
  );

  const getMatchQuality = (score: number) => {
    if (score >= 90) return { label: 'Exceptional Match', color: 'text-green-400', emoji: '🎯' };
    if (score >= 80) return { label: 'Strong Match', color: 'text-cyan-400', emoji: '✨' };
    if (score >= 70) return { label: 'Good Match', color: 'text-blue-400', emoji: '👍' };
    return { label: 'Potential Match', color: 'text-yellow-400', emoji: '💡' };
  };

  const quality = getMatchQuality(matchScore);

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-[#1a1a1a] via-[#252525] to-[#2a2a2a] rounded-3xl p-6 sm:p-8 max-w-3xl w-full border-2 border-orange-500/50 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🔥</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Why This Match Works</h2>
            </div>
            <p className="text-gray-300 text-sm">
              <span className="text-orange-400 font-semibold">{startupName}</span> ×{' '}
              <span className="text-cyan-400 font-semibold">{investorName}</span>
              {investorFirm && <span className="text-gray-400"> @ {investorFirm}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors ml-4"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Overall Match Score */}
        <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl p-6 mb-6 border border-orange-500/30">
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
              {matchScore}%
            </div>
            <div className={`text-xl font-semibold ${quality.color} mb-2`}>
              {quality.emoji} {quality.label}
            </div>
            <p className="text-gray-400 text-xs sm:text-sm">
              AI-calculated compatibility score based on {engineName} and investor preferences
            </p>
          </div>
        </div>

        {/* GOD Score Breakdown */}
        {godScores && (
          <div className="bg-black/30 rounded-2xl p-5 mb-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-400" />
              GOD Score Breakdown
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              The startup's overall quality score (0-100) calculated from 5 core dimensions:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <ProgressBar
                label="Team Score"
                value={godScores.team}
                color="text-blue-400"
                icon={Users}
                explanation="Founder experience, technical cofounder, domain expertise"
              />
              <ProgressBar
                label="Traction Score"
                value={godScores.traction}
                color="text-green-400"
                icon={TrendingUp}
                explanation="Revenue (MRR/ARR), growth rate, customer count"
              />
              <ProgressBar
                label="Market Score"
                value={godScores.market}
                color="text-purple-400"
                icon={Target}
                explanation="TAM size, market growth, industry trends"
              />
              <ProgressBar
                label="Product Score"
                value={godScores.product}
                color="text-cyan-400"
                icon={Zap}
                explanation="Launched product, demo availability, unique IP"
              />
              <ProgressBar
                label="Vision Score"
                value={godScores.vision}
                color="text-amber-400"
                icon={Lightbulb}
                explanation="Clarity of vision, ambition, market disruption"
              />
            </div>

            <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-xl p-4 border border-orange-500/30">
              <div className="flex items-center justify-between">
                <span className="text-orange-300 font-semibold">Total GOD Score</span>
                <span className="text-2xl font-bold text-white">{godScores.total}</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${godScores.total}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                This score forms 55% of the match calculation - higher GOD scores indicate stronger startups
              </p>
            </div>
          </div>
        )}

        {/* Match Components */}
        {breakdown && (
          <div className="bg-black/30 rounded-2xl p-5 mb-6 border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Match Score Components
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Additional factors that boost the match score beyond the GOD score:
            </p>

            <div className="space-y-2">
              <ProgressBar
                label="Industry Alignment"
                value={breakdown.industryMatch}
                color="text-cyan-400"
                icon={Target}
                explanation="Investor actively seeks deals in this sector"
              />
              <ProgressBar
                label="Stage Fit"
                value={breakdown.stageMatch}
                color="text-purple-400"
                icon={TrendingUp}
                explanation="Startup stage aligns with investor's focus"
              />
              <ProgressBar
                label="Geography Match"
                value={breakdown.geographyMatch}
                color="text-emerald-400"
                icon={MapPin}
                explanation="Geographic compatibility and network access"
              />
              <ProgressBar
                label="Check Size Compatibility"
                value={breakdown.checkSizeMatch}
                color="text-green-400"
                icon={DollarSign}
                explanation="Funding ask fits investor's typical range"
              />
              <ProgressBar
                label="Thesis Alignment"
                value={breakdown.thesisAlignment}
                color="text-cyan-400"
                icon={Briefcase}
                explanation="Company fits investor's strategic focus"
              />
            </div>
          </div>
        )}

        {/* Match Calculation Formula */}
        <div className="bg-gradient-to-r from-orange-500/20 to-cyan-500/20 rounded-xl p-5 border border-orange-500/30 mb-6">
          <h4 className="text-white font-bold mb-3 flex items-center gap-2">
            <span className="text-xl">🧮</span>
            How We Calculate This Match
          </h4>
          <div className="space-y-2 text-gray-300 text-sm font-mono">
            <p className="text-orange-300">Match Score =</p>
            <p className="ml-4">(GOD Score × 0.55) +</p>
            <p className="ml-4">(Industry Match × 0.15) +</p>
            <p className="ml-4">(Stage Match × 0.10) +</p>
            <p className="ml-4">(Geography × 0.05) +</p>
            <p className="ml-4">(Check Size × 0.05) +</p>
            <p className="ml-4">(Thesis Alignment × 0.10)</p>
            <p className="text-xs text-gray-400 mt-2">
              The algorithm weights GOD score most heavily, then factors in investor preferences
            </p>
          </div>
        </div>

        {/* Why This Matters */}
        {reasoning.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl p-5 border border-purple-500/30 mb-6">
            <h4 className="text-white font-bold mb-3 flex items-center gap-2">
              <span className="text-xl">💡</span>
              Key Match Factors
            </h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              {reasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all"
          >
            Got It
          </button>
          <button
            onClick={() => {
              onClose();
              // Could trigger "Connect" action here
            }}
            className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/30"
          >
            View Full Details
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default EducationalMatchModal;

