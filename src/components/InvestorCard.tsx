import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InvestorComponent } from '../types';
import { 
  Star, 
  DollarSign, 
  MapPin, 
  Briefcase, 
  TrendingUp, 
  ChevronRight,
  Building2,
  Target,
  Globe,
  Award,
  Users,
  ExternalLink
} from 'lucide-react';
import FlameIcon from './FlameIcon';

interface InvestorCardProps {
  investor: InvestorComponent | any; // Support both SSOT type and legacy InvestorFirm
  onContact?: (investorId: number | string) => void;
  showEdit?: boolean;
  variant?: 'basic' | 'enhanced' | 'vc'; // Variant support
  matchScore?: number; // For enhanced variant
  compact?: boolean; // For enhanced variant
  onClick?: () => void; // For enhanced variant
}

export default function InvestorCard({ investor, onContact, showEdit = false, variant = 'basic', matchScore, compact, onClick }: InvestorCardProps) {
  // Route to appropriate variant component
  if (variant === 'enhanced') {
    return <EnhancedInvestorCardLocal investor={investor} matchScore={matchScore} compact={compact} onClick={onClick} />;
  }
  
  if (variant === 'vc') {
    return <VCInvestorCard investor={investor} onContact={onContact} showEdit={showEdit} />;
  }
  
  // Default to basic (same as vc for now)
  return <VCInvestorCard investor={investor} onContact={onContact} showEdit={showEdit} />;
}

// VC Firm Card (basic/vc variant - current implementation)
function VCInvestorCard({ investor, onContact, showEdit }: Omit<InvestorCardProps, 'variant' | 'matchScore' | 'compact' | 'onClick'>) {

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'vc_firm': 
      case 'VC Firm': return '💼 VC';
      case 'accelerator':
      case 'Accelerator': return '🚀 ACCEL';
      case 'angel_network':
      case 'Angel': return '👼 ANGEL';
      case 'corporate_vc':
      case 'Corporate VC': return '🏢 CVC';
      default: return '💰 VC';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return null;
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(0)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <Link 
      to={`/investor/${investor.id}`}
      className="block bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl shadow-xl overflow-hidden border-2 border-purple-400/60 hover:border-cyan-400 relative hover:scale-[1.02] transition-all duration-300 w-full max-w-[420px] hover:shadow-purple-500/30"
    >
      {/* Header Section - Purple gradient */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 border-b border-purple-400">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-2">
            <h2 className="text-xl font-black text-white leading-tight truncate">
              {investor.name}
            </h2>
            {investor.tagline && (
              <p className="text-xs text-purple-200 italic truncate mt-0.5">
                {investor.tagline}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <div className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-lg border border-white/30">
              <span className="text-[9px] font-black text-white">
                {getTypeLabel(investor.type)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Key Metrics Row - Silver/slate boxes */}
        <div className="grid grid-cols-3 gap-1.5">
          {(investor.activeFundSize || investor.fundSize || investor.aum) && (
            <div className="bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg p-2 border border-slate-500">
              <p className="text-cyan-300 text-[8px] font-black">💰 FUND</p>
              <p className="text-cyan-100 font-black text-xs">
                {formatCurrency(investor.activeFundSize) || investor.fundSize || investor.aum}
              </p>
            </div>
          )}
          {investor.checkSize && (
            <div className="bg-slate-100 rounded-lg p-2 border border-slate-300">
              <p className="text-slate-600 text-[8px] font-black">💵 CHECK</p>
              <p className="text-slate-800 font-bold text-xs truncate">{investor.checkSize}</p>
            </div>
          )}
          {investor.portfolioCount && (
            <div className="bg-slate-100 rounded-lg p-2 border border-slate-300">
              <p className="text-slate-600 text-[8px] font-black">🏢 PORT</p>
              <p className="text-slate-800 font-bold text-xs">{investor.portfolioCount}+</p>
            </div>
          )}
        </div>

        {/* Stage Focus - Purple chips */}
        {investor.stage && investor.stage.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {investor.stage.slice(0, 3).map((stage, idx) => (
              <span key={idx} className="bg-purple-100 border border-purple-300 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                {stage.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Sectors - Orange chips */}
        {investor.sectors && investor.sectors.length > 0 && investor.sectors[0] !== 'all' && (
          <div className="flex flex-wrap gap-1">
            {investor.sectors.slice(0, 4).map((sector, idx) => (
              <span key={idx} className="bg-slate-800 border border-slate-500 text-cyan-300 px-2 py-0.5 rounded-full text-[9px] font-semibold">
                {sector}
              </span>
            ))}
            {investor.sectors.length > 4 && (
              <span className="text-cyan-500 text-[9px] font-bold">+{investor.sectors.length - 4}</span>
            )}
          </div>
        )}

        {/* Notable Investments - Compact */}
        {investor.notableInvestments && investor.notableInvestments.length > 0 && (
          <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
            <p className="text-purple-600 text-[9px] font-black mb-1">⭐ NOTABLE</p>
            <p className="text-purple-800 text-xs font-medium truncate">
              {investor.notableInvestments.slice(0, 3).map(inv => 
                typeof inv === 'string' ? inv : (inv as any).name || (inv as any).company
              ).join(' • ')}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

// Enhanced Investor Card (dark indigo gradient design)
function EnhancedInvestorCardLocal({ investor, matchScore, compact, onClick }: Pick<InvestorCardProps, 'investor' | 'matchScore' | 'compact' | 'onClick'>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCheckSize = () => {
    if (investor.checkSize) return investor.checkSize;
    if (investor.check_size_min && investor.check_size_max) {
      const formatAmount = (amt: number) => {
        if (amt >= 1000000) return `${(amt / 1000000).toFixed(1)}M`;
        if (amt >= 1000) return `${(amt / 1000).toFixed(0)}K`;
        return `${amt}`;
      };
      return `${formatAmount(investor.check_size_min)} - ${formatAmount(investor.check_size_max)}`;
    }
    return 'Contact for details';
  };

  const getInvestorType = () => {
    return investor.type || 'Investor';
  };

  const getTypeBadgeColor = () => {
    return 'from-cyan-500 to-blue-500';
  };

  if (compact) {
    // Compact version for matching engine
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative p-4 rounded-2xl transition-all duration-300
          bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b]
          border-4 border-indigo-500/40
          ${isHovered ? 'shadow-2xl shadow-indigo-500/30 border-indigo-400/60' : 'shadow-lg shadow-indigo-900/50'}
          backdrop-blur-xl
          ${!isExpanded ? 'max-h-[450px]' : ''}
        `}
      >
        <div className={`${!isExpanded ? 'max-h-[370px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-slate-800' : ''}`}>
          <div onClick={onClick} className="cursor-pointer">
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-cyan-400 flex-1">
                    {investor.name}
                  </h3>
                  <div className="flex-shrink-0">
                    <FlameIcon variant={7} size="lg" />
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white bg-green-500/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  {getInvestorType()}
                </span>
              </div>
            </div>

            {/* Check size */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Check Size</span>
              </div>
              <div className="text-xl font-bold text-white">
                {formatCheckSize()}
              </div>
            </div>

            {/* Notable Investments */}
            {((investor.notableInvestments && investor.notableInvestments.length > 0) || 
              (investor.notable_investments && investor.notable_investments.length > 0)) && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notable Investments</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(investor.notableInvestments || investor.notable_investments || []).slice(0, 6).map((inv: any, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-medium">
                      {typeof inv === 'string' ? inv : inv?.name || inv?.company}
                    </span>
                  ))}
                  {(investor.notableInvestments || investor.notable_investments || []).length > 6 && (
                    <span className="px-2 py-0.5 text-slate-400 text-xs">
                      +{(investor.notableInvestments || investor.notable_investments).length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Investment Thesis or Bio - Use enriched description if available */}
            {((investor as any).firm_description_normalized || (investor as any).investment_firm_description || investor.investmentThesis || investor.bio) && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {investor.investmentThesis ? 'Investment Thesis' : 'About'}
                  </span>
                </div>
                <div className="text-white text-sm leading-relaxed">
                  {(() => {
                  const text = (investor as any).firm_description_normalized || (investor as any).investment_firm_description || investor.investmentThesis || investor.bio || "";
                  // Get first 2 sentences or 150 chars
                  const sentences = text.match(/[^.!?]*[.!?]/g) || [text];
                  const truncated = sentences.slice(0, 2).join(" ").substring(0, 150);
                  return truncated + (text.length > 150 ? "..." : "");
                })()}
                </div>
              </div>
            )}

            {/* Fund Details */}
            {(investor.fundSize || investor.portfolioCount || investor.exits || investor.aum) && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fund Details</span>
                </div>
                <div className="space-y-1">
                  {investor.fundSize && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Fund Size</span>
                      <span className="text-white text-sm font-bold">{investor.fundSize}</span>
                    </div>
                  )}
                  {investor.aum && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">AUM</span>
                      <span className="text-white text-sm font-bold">{investor.aum}</span>
                    </div>
                  )}
                  {investor.portfolioCount && investor.portfolioCount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Portfolio</span>
                      <span className="text-white text-sm font-bold">{investor.portfolioCount}</span>
                    </div>
                  )}
                  {investor.exits && investor.exits > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Exits</span>
                      <span className="text-white text-sm font-bold">{investor.exits}</span>
                    </div>
                  )}
                  {investor.unicorns && investor.unicorns > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 text-sm">Unicorns</span>
                      <span className="text-white text-sm font-bold">{investor.unicorns}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sectors */}
            {investor.sectors && investor.sectors.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Sectors</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {investor.sectors.slice(0, 3).map((sector: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-teal-300 text-xs font-medium"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stages */}
            {investor.stage && investor.stage.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Stage</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {investor.stage.map((stg: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded text-indigo-300 text-xs font-medium"
                    >
                      {stg}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer stats */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex items-center gap-4">
                {investor.portfolioCount && investor.portfolioCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{investor.portfolioCount} investments</span>
                  </div>
                )}
                {investor.geography && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">{investor.geography}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-400">Active Investor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expand/Collapse button */}
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#1e1b4b] to-transparent pointer-events-none" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full mt-3 py-2 text-center text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center justify-center gap-2"
        >
          {isExpanded ? (
            <>
              <ChevronRight className="w-4 h-4 rotate-[-90deg]" />
              Show Less
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4 rotate-90" />
              Show More
            </>
          )}
        </button>

        {/* Click hint */}
        <div className={`absolute bottom-16 right-4 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-1 text-purple-400">
            <span className="text-sm">View Profile</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  // Full card version for investor directory/profile
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative p-8 rounded-3xl cursor-pointer transition-all duration-300
        bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b]
        border-4 border-indigo-500/40 hover:border-indigo-400/60
        ${isHovered ? 'shadow-2xl shadow-indigo-500/30' : 'shadow-lg shadow-indigo-900/50'}
      `}
    >
      {/* Match score badge */}
      {matchScore && (
        <div className="absolute -top-3 -right-3">
          <div className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg">
            {matchScore}% Match
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex items-start gap-6 mb-6">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-3xl font-bold text-cyan-400">
              {investor.name}
            </h2>
            {(investor.linkedin || investor.linkedin_url || investor.twitter) && (
              <a 
                href={investor.linkedin || investor.linkedin_url || investor.twitter} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-white/10 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-5 h-5 text-gray-400 hover:text-white" />
              </a>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${getTypeBadgeColor()}`}>
              {getInvestorType()}
            </span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-green-400">Active</span>
            </div>
          </div>
          
          {investor.tagline && (
            <p className="mt-3 text-gray-400">
              {investor.tagline}
            </p>
          )}
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-white/5">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-lg font-bold text-white">{formatCheckSize()}</div>
          <div className="text-xs text-gray-500">Check Size</div>
        </div>
        <div className="text-center border-x border-white/10">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Briefcase className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white">{investor.portfolioCount || '—'}</div>
          <div className="text-xs text-gray-500">Portfolio</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Globe className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-white">{investor.geography || 'Global'}</div>
          <div className="text-xs text-gray-500">Geography</div>
        </div>
      </div>

      {/* Notable investments */}
      {investor.notableInvestments && investor.notableInvestments.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-white">Notable Investments</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {investor.notableInvestments.map((company: any, idx: number) => (
              <span
                key={idx}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 text-sm font-medium border border-cyan-400/50 shadow-sm shadow-cyan-500/20"
              >
                {typeof company === 'string' ? company : (company.name || company.company)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fund Details */}
      {(investor.fundSize || investor.portfolioCount || investor.exits || investor.aum) && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-white">Fund Details</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {investor.fundSize && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Fund Size:</span>
                <span className="text-white text-sm font-bold">{investor.fundSize}</span>
              </div>
            )}
            {investor.aum && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">AUM:</span>
                <span className="text-white text-sm font-bold">{investor.aum}</span>
              </div>
            )}
            {investor.portfolioCount && investor.portfolioCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Portfolio:</span>
                <span className="text-white text-sm font-bold">{investor.portfolioCount}</span>
              </div>
            )}
            {investor.exits && investor.exits > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Exits:</span>
                <span className="text-green-400 text-sm font-bold">{investor.exits}</span>
              </div>
            )}
            {investor.unicorns && investor.unicorns > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Unicorns:</span>
                <span className="text-white text-sm font-bold">{investor.unicorns}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investment focus */}
      <div className="grid grid-cols-2 gap-6">
        {/* Sectors */}
        {investor.sectors && investor.sectors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-semibold text-white">Focus Sectors</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {investor.sectors.map((sector: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm border border-cyan-500/30"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stages */}
        {investor.stage && investor.stage.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-semibold text-white">Investment Stages</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {investor.stage.map((stg: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 text-sm border border-purple-500/30"
                >
                  {stg}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
        <div className="text-gray-400 text-sm">
          Click to view full profile
        </div>
        <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/40 hover:to-indigo-600/40 text-white font-semibold transition-all border border-purple-500/30 hover:border-purple-400/50">
          Connect
        </button>
      </div>
    </div>
  );
}
