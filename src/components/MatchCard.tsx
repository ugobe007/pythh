/**
 * MATCH CARD COMPONENT (LIFEFORM)
 * ================================
 * Beautiful card showing startup-investor match
 * Color scheme: Light blue to violet (NO rose/pink/fuchsia)
 * 
 * Lifeform additions:
 * - Freshness decay words (strong now · cooling · stale)
 * - Social proof hints (Most founders monitor before engaging)
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Linkedin, 
  Globe, 
  ChevronDown, 
  ChevronUp,
  Zap,
  Target,
  TrendingUp,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Sparkles,
  Star,
  Building2,
  Share2,
  Mail,
  BookmarkPlus,
  Bookmark
} from 'lucide-react';
import { 
  MatchResult, 
  getInvestorTypeIcon, 
  getDecisionSpeedColor,
  formatCheckSize 
} from '../lib/matchingService';

interface MatchCardProps {
  match: MatchResult;
  rank?: number;
  onViewDetails?: () => void;
  onSave?: (investorId: string) => void;
  onShare?: (match: MatchResult) => void;
  onRequestIntro?: (investorId: string) => void;
  isSaved?: boolean;
  showBreakdown?: boolean;
  compact?: boolean;
  isPaid?: boolean; // Hide match advice/guidance for free users
  lastActive?: string; // ISO timestamp for freshness calculation (Lifeform)
  viewCount?: number; // For social proof hints (Lifeform)
}

// LIFEFORM: Calculate freshness decay
const getFreshnessState = (lastActive?: string): { label: string; class: string } => {
  if (!lastActive) return { label: 'strong now', class: 'text-emerald-400' };
  const hours = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return { label: 'strong now', class: 'text-emerald-400' };
  if (hours < 72) return { label: 'cooling', class: 'text-amber-400' };
  return { label: 'stale', class: 'text-zinc-500' };
};

// LIFEFORM: Social proof hint
const getSocialProofHint = (viewCount?: number): string | null => {
  if (!viewCount || viewCount < 5) return null;
  if (viewCount >= 50) return 'Frequently reviewed';
  if (viewCount >= 20) return 'Most founders monitor before engaging';
  return 'Others are watching this match';
};

export default function MatchCard({ 
  match, 
  rank,
  onViewDetails,
  onSave,
  onShare,
  onRequestIntro,
  isSaved = false,
  showBreakdown = false,
  compact = false,
  isPaid = false,
  lastActive,
  viewCount
}: MatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(showBreakdown);
  const [saved, setSaved] = useState(isSaved);
  const { investor, score, reasons, breakdown, investorType, decisionSpeed } = match;

  // LIFEFORM: Get freshness state and social proof
  const freshness = getFreshnessState(lastActive);
  const socialHint = getSocialProofHint(viewCount);

  // Score color based on value - BLUE TO VIOLET ONLY
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'from-emerald-500 to-cyan-500';
    if (s >= 60) return 'from-cyan-500 to-blue-500';
    if (s >= 40) return 'from-blue-500 to-violet-500';
    return 'from-violet-500 to-purple-500';
  };

  const getScoreBg = (s: number) => {
    if (s >= 80) return 'bg-emerald-500/20 border-emerald-500/50';
    if (s >= 60) return 'bg-cyan-500/20 border-cyan-500/50';
    if (s >= 40) return 'bg-blue-500/20 border-blue-500/50';
    return 'bg-violet-500/20 border-violet-500/50';
  };

  const handleSave = () => {
    setSaved(!saved);
    onSave?.(investor.id);
  };

  // Parse notable investments
  const notableInvestments = (() => {
    if (!investor.notable_investments) return [];
    if (Array.isArray(investor.notable_investments)) return investor.notable_investments.slice(0, 5);
    if (typeof investor.notable_investments === 'string') {
      try {
        return JSON.parse(investor.notable_investments).slice(0, 5);
      } catch {
        return [];
      }
    }
    return [];
  })();

  if (compact) {
    return (
      <div 
        className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-cyan-500/50 transition-all cursor-pointer"
        onClick={onViewDetails}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {rank && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                {rank}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-white">{investor.name}</h3>
              <p className="text-sm text-slate-400">{investor.firm || investorType}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* LIFEFORM: Compact freshness indicator */}
            <span className={`text-xs ${freshness.class}`}>{freshness.label}</span>
            <div className={`px-3 py-1 rounded-full font-bold text-lg bg-gradient-to-r ${getScoreColor(score)} text-white`}>
              {score}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl overflow-hidden border border-slate-700 hover:border-cyan-500/50 transition-all shadow-xl">
      {/* Header with Score */}
      <div className="relative p-4 bg-gradient-to-r from-slate-800 to-slate-900/50">
        {/* Rank Badge */}
        {rank && (
          <div className="absolute -top-2 -left-2 w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-black text-lg shadow-lg border-2 border-slate-800">
            #{rank}
          </div>
        )}
        
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{getInvestorTypeIcon(investorType)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDecisionSpeedColor(decisionSpeed)}`}>
                <Clock className="w-3 h-3 inline mr-1" />
                {decisionSpeed} decision
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {investor.name}
            </h2>
            {investor.firm && investor.firm !== investor.name && (
              <p className="text-sm text-cyan-300 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {investor.firm}
              </p>
            )}
          </div>
          
          {/* Match Score Circle */}
          <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-4 ${getScoreBg(score)}`}>
            <div className="text-center">
              <div className={`text-2xl font-black bg-gradient-to-r ${getScoreColor(score)} bg-clip-text text-transparent`}>
                {score}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">MATCH</div>
            </div>
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-blue-400" />
          </div>
        </div>
        
        {/* LIFEFORM: Freshness + Social Proof Strip */}
        <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-slate-700/50">
          <span className={freshness.class}>
            {freshness.label}
          </span>
          {socialHint && (
            <span className="text-zinc-500 italic">
              {socialHint}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Investment Thesis */}
        {(investor.investment_thesis || investor.bio) && (
          <p className="text-sm text-slate-300 line-clamp-2">
            {investor.investment_thesis || investor.bio}
          </p>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-700/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
              <DollarSign className="w-3 h-3" />
              Check Size
            </div>
            <div className="text-white font-semibold text-sm">
              {formatCheckSize(investor.check_size_min, investor.check_size_max)}
            </div>
          </div>
          
          <div className="bg-slate-700/50 rounded-lg p-2">
            <div className="flex items-center gap-1 text-slate-400 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Stage
            </div>
            <div className="text-white font-semibold text-sm truncate">
              {investor.stage?.slice(0, 2).join(', ') || 'All Stages'}
            </div>
          </div>
        </div>

        {/* Sectors */}
        {investor.sectors && investor.sectors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {investor.sectors.slice(0, 4).map((sector, i) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs"
              >
                {sector}
              </span>
            ))}
            {investor.sectors.length > 4 && (
              <span className="px-2 py-0.5 bg-slate-600/50 text-slate-400 rounded-full text-xs">
                +{investor.sectors.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Match Reasons - Only show for paid users */}
        {isPaid && reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reasons.map((reason, i) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* Notable Investments */}
        {notableInvestments.length > 0 && (
          <div>
            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
              <Star className="w-3 h-3" />
              Notable Investments
            </div>
            <div className="flex flex-wrap gap-1">
              {notableInvestments.map((company: string, i: number) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs"
                >
                  {company}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Breakdown - Only show for paid users */}
        {isPaid && breakdown && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide Match Breakdown
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show Match Breakdown
              </>
            )}
          </button>
        )}

        {isPaid && isExpanded && breakdown && (
          <div className="space-y-3 pt-2 border-t border-slate-700">
            <BreakdownBar label="Industry Match" value={breakdown.industryMatch} icon={Briefcase} />
            <BreakdownBar label="Stage Alignment" value={breakdown.stageMatch} icon={TrendingUp} />
            <BreakdownBar label="Geography Fit" value={breakdown.geographyMatch} icon={MapPin} />
            <BreakdownBar label="Check Size Match" value={breakdown.checkSizeMatch} icon={DollarSign} />
            <BreakdownBar label="Thesis Alignment" value={breakdown.thesisAlignment} icon={Target} />
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            className={`p-2 rounded-lg transition-colors ${
              saved 
                ? 'bg-cyan-500/20 text-blue-400' 
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
            title={saved ? 'Saved' : 'Save match'}
          >
            {saved ? <Bookmark className="w-5 h-5 fill-current" /> : <BookmarkPlus className="w-5 h-5" />}
          </button>

          <button
            onClick={() => onShare?.(match)}
            className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
            title="Share match"
          >
            <Share2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => onRequestIntro?.(investor.id)}
            className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
            title="Request introduction"
          >
            <Mail className="w-5 h-5" />
          </button>

          <Link
            to={`/investor/${investor.id}`}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2 px-4 rounded-lg font-medium text-center hover:from-cyan-500 hover:to-blue-500 transition-all text-sm"
          >
            View Profile
          </Link>
          
          {investor.blog_url && (
            <a
              href={investor.blog_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Globe className="w-5 h-5" />
            </a>
          )}
          
          {investor.linkedin_url && (
            <a
              href={investor.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownBar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const getBarColor = (v: number) => {
    if (v >= 80) return 'bg-gradient-to-r from-emerald-500 to-cyan-500';
    if (v >= 60) return 'bg-gradient-to-r from-cyan-500 to-blue-500';
    if (v >= 40) return 'bg-gradient-to-r from-blue-500 to-indigo-500';
    return 'bg-gradient-to-r from-indigo-500 to-violet-500';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-slate-300 text-sm">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <span className="text-white font-semibold text-sm">{value}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
