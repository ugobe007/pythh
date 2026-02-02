/**
 * RECOMMENDATION CARD
 * ===================
 * Actionable item to strengthen signals
 */

import { ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { Recommendation } from '../../types/signals';

interface RecommendationCardProps {
  recommendation: Recommendation;
  index: number;
}

export default function RecommendationCard({ recommendation, index }: RecommendationCardProps) {
  const impactColor = {
    GOD: 'text-purple-400',
    sector: 'text-blue-400',
    alignment: 'text-green-400',
    adjacency: 'text-orange-400'
  }[recommendation.impactCategory];

  const timeframeLabel = recommendation.timeframe === 'immediate' 
    ? '⚡ THIS WEEK' 
    : '🎯 30 DAYS';

  return (
    <div 
      className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-white/20 transition-all"
      style={{
        animation: `slideInUp 0.4s ease-out ${4500 + index * 150}ms both`
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-2">
            {timeframeLabel}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {recommendation.title}
          </h3>
        </div>
        <div className={`text-right ${impactColor}`}>
          <div className="text-2xl font-bold">{recommendation.impact}</div>
          <div className="text-xs opacity-70">to {recommendation.impactCategory}</div>
        </div>
      </div>

      {/* Current State */}
      <div className="mb-4">
        <div className="text-sm font-medium text-white/70 mb-2">Current state:</div>
        <ul className="space-y-1">
          {recommendation.currentState.map((item, i) => (
            <li key={i} className="text-sm text-white/60">• {item}</li>
          ))}
        </ul>
      </div>

      {/* Impact */}
      <div className="mb-4 bg-white/5 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-white">Impact</span>
        </div>
        <div className="text-sm text-white/70 mb-3">{recommendation.benefit}</div>
        <div className="text-xs text-white/50">
          Affects {recommendation.affectedInvestors} investors
          {recommendation.topInvestors.length > 0 && (
            <> including {recommendation.topInvestors.join(', ')}</>
          )}
        </div>
      </div>

      {/* Action Items */}
      <div className="mb-4">
        <div className="text-sm font-medium text-white/70 mb-2">What to do:</div>
        <ul className="space-y-1.5">
          {recommendation.actionItems.map((item, i) => (
            <li key={i} className="text-sm text-white/60 flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Time Investment */}
      {recommendation.timeInvestment && (
        <div className="flex items-center gap-2 mb-4 text-sm text-white/50">
          <Clock className="w-4 h-4" />
          <span>Time investment: {recommendation.timeInvestment}</span>
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-3 pt-4 border-t border-white/10">
        {recommendation.ctas.map((cta, i) => (
          <button 
            key={i}
            className="text-sm text-white/70 hover:text-white flex items-center gap-2 transition"
          >
            {cta.label} <ArrowRight className="w-3 h-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
