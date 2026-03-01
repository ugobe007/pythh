import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StartupComponent } from '../types';
import { useReactions } from '../hooks/useReactions';
import { useAuth } from '../hooks/useAuth';
import FlameIcon from './FlameIcon';
import FundingCountdown from './FundingCountdown';
import { useFundingPrediction } from '../hooks/useFundingPrediction';

interface Props {
  startup: StartupComponent;
  onVote?: (startupId: string | number, vote: 'yes' | 'no') => void;
  onSwipeAway?: () => void;
  variant?: 'simple' | 'detailed'; // 'simple' = default voting card, 'detailed' = with GOD scores
}

export default function StartupCard({ startup, onVote, onSwipeAway, variant = 'simple' }: Props) {
  // If variant is 'detailed', render the detailed card
  if (variant === 'detailed') {
    return <DetailedStartupCard startup={startup} onVote={onVote} onSwipeAway={onSwipeAway} />;
  }

  // Otherwise render the simple voting card
  return <SimpleStartupCard startup={startup} onVote={onVote} onSwipeAway={onSwipeAway} />;
}

// Simple voting card (original implementation)
function SimpleStartupCard({ startup, onVote, onSwipeAway }: Omit<Props, 'variant'>) {
  const { userId, isLoading: authLoading } = useAuth();
  const { castReaction, hasReacted, removeReaction, getCounts, fetchUserReactions } = useReactions(startup.id.toString());

  // Load user's reactions on mount
  useEffect(() => {
    if (userId && !authLoading) {
      fetchUserReactions(userId);
    }
  }, [userId, authLoading]);

  const [showSecret, setShowSecret] = useState(false);

  // Check if user has reacted to this startup (social expression only)
  const userReaction = hasReacted(startup.id.toString());
  const counts = getCounts(startup.id.toString());

  const handleReaction = async (reactionType: 'thumbs_up' | 'thumbs_down') => {
    if (!userId || authLoading) {
      console.log('Auth not ready yet, userId:', userId);
      return;
    }

    console.log('Casting reaction:', reactionType, 'for startup:', startup.id, 'by user:', userId);

    try {
      // If user already reacted this way, remove the reaction (toggle off)
      if (userReaction === reactionType) {
        await removeReaction(userId, startup.id.toString());
        console.log('Reaction removed');
        return;
      }
      
      // Otherwise cast/change the reaction
      await castReaction(userId, startup.id.toString(), reactionType);
      console.log('Reaction cast successfully');
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const getVotesNeeded = (stage: number) => (stage === 4 ? 1 : 5);
  const votesNeeded = getVotesNeeded(startup.stage || 1);
  const currentVotes = startup.yesVotes || 0;
  const progress = Math.min((currentVotes / votesNeeded) * 100, 100);

  const getStageDescription = (stage: number) => {
    switch(stage) {
      case 1: return 'Anonymous voting • Need 5 votes to advance';
      case 2: return 'Review materials • Need 5 votes to advance';
      case 3: return 'Meet founder • Need 5 votes to advance';
      case 4: return 'Deal room access • Need 1 vote to close';
      default: return 'Voting stage';
    }
  };

  return (
    <div className="bg-gradient-to-br from-cyan-300 via-blue-400 to-violet-500 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] border-4 border-cyan-500 relative w-[360px] min-h-[400px] flex flex-col mb-8">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
      
      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
              {startup.name}
            </h2>
            <p className="text-blue-700 font-bold text-xs mt-0.5">
              stage #{startup.stage || 1}
            </p>
            <p className="text-[10px] text-gray-700 italic leading-tight mt-0.5">
              {getStageDescription(startup.stage || 1)}
            </p>
          </div>
          <button
            onClick={() => setShowSecret(!showSecret)}
            className="text-3xl hover:scale-110 transition-transform flex-shrink-0"
          >
            🍯
          </button>
        </div>

        {/* Secret */}
        {showSecret && (
          <div className="bg-yellow-200 border-2 border-yellow-400 rounded-lg p-1.5 mb-2">
            <p className="text-[10px] font-bold text-gray-900 leading-tight">
              🤫 YC-backed • Fortune 500 LOI
            </p>
          </div>
        )}

        {/* Pitch */}
        {startup.pitch && (
          <p className="text-sm font-black text-gray-900 leading-tight tracking-tight mb-1">
            "{startup.pitch}"
          </p>
        )}

        {/* Tagline */}
        {startup.tagline && (
          <p className="text-xs font-bold text-gray-800 leading-tight tracking-tight mb-2">
            {startup.tagline}
          </p>
        )}

        {/* Five Points */}
        <div className="mb-3 space-y-1">
          {(startup.fivePoints || []).map((point, i) => (
            <p 
              key={i} 
              className={`leading-tight tracking-tight ${
                i === 0
                  ? 'text-xs font-black text-gray-900'
                  : i === 1 || i === 2
                  ? 'text-sm font-black text-gray-900'
                  : 'text-xs font-bold text-gray-800'
              }`}
            >
              {point}
            </p>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-700 mb-1">
            <span className="font-bold">Stage {(startup.stage || 1) + 1}</span>
            <span className="font-black">{currentVotes}/{votesNeeded} votes</span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-1.5">
            <div 
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Vote Stats - Social Reactions Only */}
        <div className="flex gap-3 mb-2">
          <div className="flex items-center gap-1">
            <span className="text-base">👍</span>
            <span className="font-black text-gray-900 text-sm">{counts.thumbs_up_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-base">👎</span>
            <span className="font-black text-gray-900 text-sm">{counts.thumbs_down_count}</span>
          </div>
        </div>

        {/* Social Reaction Buttons (NOT VOTES) */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xl">�</div>
          <button
            onClick={() => handleReaction('thumbs_up')}
            className={`flex-1 font-black py-2 px-3 rounded-xl text-sm shadow-lg transition-all ${
              userReaction === 'thumbs_up' 
                ? 'bg-green-600 text-white scale-105' 
                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
            }`}
          >
            {userReaction === 'thumbs_up' ? '✓ like' : '👍 like'}
          </button>
          <button
            onClick={() => handleReaction('thumbs_down')}
            className={`flex-1 font-black py-2 px-3 rounded-xl text-sm shadow-lg transition-all ${
              userReaction === 'thumbs_down' 
                ? 'bg-gray-700 text-white opacity-50' 
                : 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-300 hover:from-gray-400 hover:via-gray-500 hover:to-gray-400 text-gray-800 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)]'
            }`}
          >
            {userReaction === 'thumbs_down' ? '✓ pass' : '👎 pass'}
          </button>
        </div>

        {/* Comments */}
        <button
          className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-2 px-4 rounded-xl text-xs transition-all"
        >
          comments ({startup.comments?.length || 0})
        </button>
      </div>
    </div>
  );
}

// Detailed card with GOD scores and metrics (from StartupCardOfficial)
function DetailedStartupCard({ startup, onVote, onSwipeAway }: Omit<Props, 'variant'>) {
  const [hasVoted, setHasVoted] = useState(false);
  const [voteType, setVoteType] = useState<'yes' | 'no' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [isSwipingAway, setIsSwipingAway] = useState(false);
  const [showVoteMessage, setShowVoteMessage] = useState(false);
  const [voteMessage, setVoteMessage] = useState<string>('');

  const { userId } = useAuth();
  const { castReaction, getCounts, hasReacted, fetchUserReactions } = useReactions(startup.id.toString());
  const supabaseReactionCounts = getCounts(startup.id.toString());
  const supabaseUserReaction = hasReacted(startup.id.toString());
  const { prediction: fundingPrediction } = useFundingPrediction(startup.id);

  useEffect(() => {
    if (userId && !userId.startsWith('anon_')) {
      fetchUserReactions(userId);
    }
  }, [userId]);

  const formatCurrency = (amount?: number) => {
    if (!amount || amount === 0) return null;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const formatGrowthRate = (rate?: number) => {
    if (!rate || rate === 0) return null;
    return `${rate > 0 ? '+' : ''}${rate}%`;
  };

  const getGODScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-cyan-400';
    return 'text-red-400';
  };

  const getGODScoreLabel = (score?: number) => {
    if (!score) return '⚪ UNSCORED';
    if (score >= 80) return '🟢 EXCELLENT';
    if (score >= 60) return '🟡 GOOD';
    if (score >= 40) return '🟠 FAIR';
    return '🔴 WEAK';
  };

  const handleVote = (vote: 'yes' | 'no') => {
    if (hasVoted || !onVote) return;
    
    setVoteType(vote);
    setHasVoted(true);

    if (vote === 'yes') {
      setVoteMessage(`✅ ${startup.name} added to your portfolio!`);
    } else {
      setVoteMessage(`❌ ${startup.name} removed from voting`);
    }

    setShowVoteMessage(true);
    setTimeout(() => setShowVoteMessage(false), 3000);

    onVote(startup.id, vote);

    setTimeout(() => {
      setIsSwipingAway(true);
      setTimeout(() => {
        if (onSwipeAway) onSwipeAway();
      }, 250);
    }, 500);
  };

  return (
    <div className={`relative transition-all duration-250 ease-out ${isSwipingAway ? 'transform -translate-x-full opacity-0' : ''}`}>
      {showVoteMessage && (
        <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-[60] bg-white border-4 border-cyan-500 px-6 py-3 rounded-2xl shadow-2xl animate-bounce">
          <p className="text-base font-black text-gray-900 whitespace-nowrap">{voteMessage}</p>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#1a0033] via-[#2d1b4e] to-[#0f0f23] rounded-3xl shadow-2xl overflow-hidden border border-purple-500/30 hover:border-cyan-400/60 relative hover:scale-[1.01] transition-all duration-300 w-full max-w-[420px] mx-auto">
        {/* Hero Header with Flame */}
        <div className="relative bg-gradient-to-r from-cyan-600 via-blue-500 to-violet-600 p-4">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative flex items-start gap-3">
            {/* Flame Icon */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <FlameIcon variant={Math.min(9, Math.max(1, Math.ceil((startup.total_god_score || 50) / 12))) as 1|2|3|4|5|6|7|8|9} size="xl" />
              </div>
            </div>
            {/* Name & Tagline */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-white truncate">
                {startup.name}
              </h2>
              {startup.tagline && (
                <p className="text-sm text-white/80 line-clamp-2 mt-0.5">
                  {startup.tagline}
                </p>
              )}
            </div>
            {/* Stage Badge */}
            {startup.stage && (
              <div className="flex-shrink-0">
                <div className="px-2.5 py-1 bg-black/30 backdrop-blur-sm rounded-lg border border-white/20">
                  <span className="text-[10px] font-bold text-white">STAGE {startup.stage}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* GOD Score Bar */}
          {startup.total_god_score && (
            <div className="mt-3 bg-black/30 backdrop-blur-sm rounded-xl p-2.5 border border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/80 text-xs font-semibold flex items-center gap-1.5">
                  <FlameIcon variant={5} size="xs" /> GOD SCORE
                </span>
                <div className="flex items-center gap-2">
                  <span className={`${getGODScoreColor(startup.total_god_score)} text-lg font-black`}>
                    {startup.total_god_score}
                  </span>
                  <span className="text-[10px] text-white/80">
                    {getGODScoreLabel(startup.total_god_score)}
                  </span>
                </div>
              </div>
              {/* Score Progress Bar */}
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    startup.total_god_score >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    startup.total_god_score >= 60 ? 'bg-gradient-to-r from-yellow-400 to-blue-500' :
                    startup.total_god_score >= 40 ? 'bg-gradient-to-r from-cyan-400 to-blue-500' :
                    'bg-gradient-to-r from-blue-400 to-violet-500'
                  }`}
                  style={{ width: `${startup.total_god_score}%` }}
                />
              </div>
            </div>
          )}

          {/* Benchmark Score & Match Count */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {startup.benchmark_score !== null && startup.benchmark_score !== undefined && (
              <div className="bg-blue-500/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-blue-500/20">
                <div className="text-blue-300 text-[10px] font-semibold mb-0.5">BENCHMARK</div>
                <div className="text-white font-bold text-sm">{startup.benchmark_score}</div>
              </div>
            )}
            {startup.match_count !== null && startup.match_count !== undefined && (
              <div className="bg-purple-500/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-purple-500/20">
                <div className="text-purple-300 text-[10px] font-semibold mb-0.5">MATCHES</div>
                <div className="text-white font-bold text-sm">{startup.match_count}</div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 pt-0 space-y-3">
          {/* Funding Prediction Countdown */}
          {fundingPrediction && <FundingCountdown prediction={fundingPrediction} compact />}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            {startup.team_size && startup.team_size > 0 && (
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <div className="text-gray-400 text-[10px] mb-0.5">TEAM SIZE</div>
                <div className="text-white font-bold text-sm">👥 {startup.team_size} people</div>
              </div>
            )}
            {formatCurrency(startup.revenue_annual) && (
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <div className="text-gray-400 text-[10px] mb-0.5">REVENUE</div>
                <div className="text-green-400 font-bold text-sm">💰 {formatCurrency(startup.revenue_annual)}/yr</div>
              </div>
            )}
            {formatCurrency(startup.mrr) && (
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <div className="text-gray-400 text-[10px] mb-0.5">MRR</div>
                <div className="text-green-400 font-bold text-sm">📊 {formatCurrency(startup.mrr)}</div>
              </div>
            )}
            {formatGrowthRate(startup.growth_rate_monthly) && (
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <div className="text-gray-400 text-[10px] mb-0.5">GROWTH</div>
                <div className="text-cyan-400 font-bold text-sm">📈 {formatGrowthRate(startup.growth_rate_monthly)}/mo</div>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex gap-2 flex-wrap">
            {startup.is_launched && (
              <span className="bg-green-500/20 border border-green-500/30 text-green-300 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                <FlameIcon variant={2} size="xs" /> LAUNCHED
              </span>
            )}
            {startup.has_technical_cofounder && (
              <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-2.5 py-1 rounded-full text-[10px] font-bold">
                💻 TECH COFOUNDER
              </span>
            )}
            {startup.location && (
              <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 px-2.5 py-1 rounded-full text-[10px] font-bold">
                📍 {startup.location}
              </span>
            )}
          </div>

          {/* Sectors */}
          {startup.sectors && startup.sectors.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {startup.sectors.slice(0, 4).map((sector, idx) => (
                  <span key={idx} className="bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-md text-[10px] font-medium">
                    {sector}
                  </span>
                ))}
                {startup.sectors.length > 4 && (
                  <span className="bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-md text-[10px] font-medium">
                    +{startup.sectors.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Key Insights / VIBE */}
          {(startup.value_proposition || startup.problem || startup.solution || startup.market_size || startup.team_companies || startup.raise_amount) && (
            <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-3 border border-purple-500/20">
              {/* Value Prop */}
              {(startup.value_proposition || startup.problem) && (
                <p className="text-white font-semibold text-sm mb-1">
                  {startup.value_proposition || startup.problem}
                </p>
              )}
              
              {/* Market Size */}
              {startup.market_size && (
                <p className="text-purple-300 text-xs">
                  📊 {startup.market_size}
                </p>
              )}
              
              {/* Solution */}
              {startup.solution && (
                <p className="text-gray-300 text-xs mt-1">
                  {startup.solution}
                </p>
              )}
              
              {/* Team Companies */}
              {startup.team_companies && startup.team_companies.length > 0 && (
                <p className="text-blue-300 text-xs mt-1">
                  🏢 Team from: {startup.team_companies.join(', ')}
                </p>
              )}
              
              {/* Investment Amount */}
              {startup.raise_amount && (
                <p className="text-green-400 font-bold text-sm mt-2">
                  💰 Raising {startup.raise_amount}
                  {startup.raise_type && ` • ${startup.raise_type}`}
                </p>
              )}
            </div>
          )}

          {/* Pitch/Description - Collapsible */}
          {(startup.pitch || startup.description) && (
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-gray-300 font-semibold text-xs hover:text-white transition-colors flex items-center gap-1 w-full"
              >
                <span className="text-cyan-400">{showDetails ? '▼' : '▶'}</span>
                <span>📋 ABOUT</span>
              </button>
              {showDetails && (
                <p className="text-gray-400 text-xs leading-relaxed mt-2">
                  {startup.pitch || startup.description}
                </p>
              )}
            </div>
          )}

          {/* Five Points - Collapsible */}
          {startup.fivePoints && startup.fivePoints.length > 0 && (
            <div className="bg-cyan-600/10 rounded-xl p-3 border border-cyan-500/20">
              <button
                onClick={() => setShowKeyPoints(!showKeyPoints)}
                className="text-cyan-300 font-semibold text-xs hover:text-cyan-200 transition-colors flex items-center gap-1 w-full"
              >
                <span>{showKeyPoints ? '▼' : '▶'}</span>
                <FlameIcon variant={4} size="xs" />
                <span>KEY POINTS ({startup.fivePoints.length})</span>
              </button>
              {showKeyPoints && (
                <div className="space-y-1.5 mt-2">
                  {startup.fivePoints.slice(0, 5).map((point, idx) => (
                    <div key={idx} className="text-gray-300 text-xs flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* View Profile */}
            <Link
              to={`/startup/${startup.id}`}
              className="w-full block bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-center transition-all text-sm border border-purple-400/50"
            >
              <FlameIcon variant={9} size="xs" className="inline mr-1.5" />
              VIEW FULL PROFILE
            </Link>

            {/* Social Links */}
            {(startup.website || startup.linkedin) && (
              <div className="grid grid-cols-2 gap-2">
                {startup.website && (
                  <a
                    href={startup.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-3 rounded-lg text-center transition-all text-xs border border-white/20"
                  >
                    🌐 Website
                  </a>
                )}
                {startup.linkedin && (
                  <a
                    href={startup.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold py-2 px-3 rounded-lg text-center transition-all text-xs border border-blue-500/30"
                  >
                    💼 LinkedIn
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Vote Buttons */}
          {!hasVoted && onVote && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleVote('yes')}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-cyan-500/30 border border-cyan-400/50 text-sm flex items-center justify-center gap-2"
              >
                <FlameIcon variant={1} size="sm" />
                HOT!
              </button>
              <button
                onClick={() => handleVote('no')}
                className="bg-white/10 hover:bg-white/20 text-gray-300 font-bold py-3 px-4 rounded-xl transition-all border border-white/20 text-sm"
              >
                👋 PASS
              </button>
            </div>
          )}

          {hasVoted && (
            <div className={`text-center py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
              voteType === 'yes' 
                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              {voteType === 'yes' ? (
                <>
                  <FlameIcon variant={2} size="sm" />
                  ADDED TO PORTFOLIO
                </>
              ) : '❌ PASSED'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}