/**
 * Founder Community Page
 * 
 * Where founders discover other founders, share collections,
 * and build a network of signal intelligence.
 * 
 * Features:
 * - Discover founders by stage/sector
 * - View public collections
 * - Follow founders
 * - Community activity feed
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  FolderOpen, 
  UserPlus, 
  UserMinus,
  ExternalLink,
  Filter,
  Search,
  Sparkles
} from 'lucide-react';
import { 
  discoverFounders, 
  followFounder, 
  unfollowFounder,
  type FounderProfile,
  type SignalCardCollection
} from '../services/signalCardSharingService';
import VCQuoteCard from '../components/VCQuoteCard';

// Stage options
const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth'];

// Sector options
const SECTORS = [
  'FinTech', 'HealthTech', 'AI/ML', 'SaaS', 'Consumer', 
  'Enterprise', 'Crypto/Web3', 'Climate', 'DevTools', 'E-commerce'
];

export default function FounderCommunityPage() {
  const [founders, setFounders] = useState<FounderProfile[]>([]);
  const [collections, setCollections] = useState<SignalCardCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'founders' | 'collections'>('founders');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [selectedStage, selectedSector]);

  const loadData = async () => {
    setIsLoading(true);
    
    const result = await discoverFounders({
      stage: selectedStage || undefined,
      sectors: selectedSector ? [selectedSector] : undefined,
      limit: 50,
    });
    
    setFounders(result.founders);
    setIsLoading(false);
  };

  const handleFollow = async (founderId: string) => {
    if (followingIds.has(founderId)) {
      await unfollowFounder(founderId);
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(founderId);
        return next;
      });
    } else {
      await followFounder(founderId);
      setFollowingIds(prev => new Set(prev).add(founderId));
    }
  };

  // Filter founders by search
  const filteredFounders = founders.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.display_name?.toLowerCase().includes(q) ||
      f.company_name?.toLowerCase().includes(q) ||
      f.bio?.toLowerCase().includes(q)
    );
  });

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* Header */}
      <header className="border-b border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <nav className="flex items-center justify-between mb-4">
            <Link to="/" className="text-white font-semibold text-lg tracking-tight">
              pythh
            </Link>
            <div className="flex items-center gap-8 text-sm">
              <Link to="/signals" className="text-zinc-400 hover:text-white transition-colors">
                Signals
              </Link>
              <Link to="/matches" className="text-zinc-400 hover:text-white transition-colors">
                Matches
              </Link>
              <Link to="/trends" className="text-zinc-400 hover:text-white transition-colors">
                Trends
              </Link>
              <span className="text-white">Community</span>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <h1 
              className="text-3xl font-bold text-white tracking-tight"
              style={{
                textShadow: '0 0 40px rgba(139, 92, 246, 0.2), 0 0 80px rgba(139, 92, 246, 0.1)',
              }}
            >
              Founder Community
            </h1>
          </div>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Connect with founders who think like you. Share signals, compare notes, 
            and build collective intelligence about the market.
          </p>
        </div>

        {/* Tabs + Filters */}
        <div className="flex items-center justify-between mb-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('founders')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'founders' 
                  ? 'bg-zinc-800 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Founders
              </span>
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'collections' 
                  ? 'bg-zinc-800 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Collections
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search founders..."
                className="w-64 bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-8">
          <Filter className="w-4 h-4 text-zinc-500" />
          
          <select
            value={selectedStage || ''}
            onChange={(e) => setSelectedStage(e.target.value || null)}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="">All stages</option>
            {STAGES.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>

          <select
            value={selectedSector || ''}
            onChange={(e) => setSelectedSector(e.target.value || null)}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="">All sectors</option>
            {SECTORS.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>

          {(selectedStage || selectedSector) && (
            <button
              onClick={() => {
                setSelectedStage(null);
                setSelectedSector(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'founders' && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-12 text-zinc-500">Loading founders...</div>
                ) : filteredFounders.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <div className="text-zinc-500 mb-2">No founders found</div>
                    <div className="text-zinc-600 text-sm">
                      Be the first to make your profile public!
                    </div>
                  </div>
                ) : (
                  filteredFounders.map(founder => (
                    <FounderCard
                      key={founder.id}
                      founder={founder}
                      isFollowing={followingIds.has(founder.user_id)}
                      onFollow={() => handleFollow(founder.user_id)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'collections' && (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <div className="text-zinc-500 mb-2">Public collections coming soon</div>
                <div className="text-zinc-600 text-sm">
                  Create a collection and make it public to share with the community
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Community Stats */}
            <div className="bg-zinc-900/30 rounded-lg border border-zinc-800/60 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">
                Community
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-sm">Public founders</span>
                  <span className="text-white font-mono">{founders.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-sm">Public collections</span>
                  <span className="text-white font-mono">0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-sm">You follow</span>
                  <span className="text-white font-mono">{followingIds.size}</span>
                </div>
              </div>
            </div>

            {/* Make Profile Public CTA */}
            <div className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 rounded-lg border border-violet-500/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-white font-medium text-sm">Go public</span>
              </div>
              <p className="text-zinc-400 text-sm mb-4">
                Make your profile visible to connect with other founders tracking similar signals.
              </p>
              <Link
                to="/app/signal-card"
                className="block w-full py-2 bg-violet-600 hover:bg-violet-500 text-white text-center rounded-lg text-sm font-medium transition-colors"
              >
                Edit Profile
              </Link>
            </div>

            {/* VC Wisdom */}
            <VCQuoteCard variant="default" topic="founder" allowRefresh={true} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-zinc-600 text-sm">
            Great founders don't guess. They move with the market.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOUNDER CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

interface FounderCardProps {
  founder: FounderProfile;
  isFollowing: boolean;
  onFollow: () => void;
}

function FounderCard({ founder, isFollowing, onFollow }: FounderCardProps) {
  return (
    <div className="bg-zinc-900/30 rounded-lg border border-zinc-800/60 p-5 hover:bg-zinc-900/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {founder.avatar_url ? (
            <img 
              src={founder.avatar_url} 
              alt={founder.display_name || ''} 
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            (founder.display_name || 'F')[0].toUpperCase()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium truncate">
              {founder.display_name || 'Anonymous Founder'}
            </h3>
            {founder.company_stage && (
              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded">
                {founder.company_stage}
              </span>
            )}
          </div>

          {founder.company_name && (
            <p className="text-cyan-400 text-sm mb-2">{founder.company_name}</p>
          )}

          {founder.bio && (
            <p className="text-zinc-500 text-sm line-clamp-2 mb-3">{founder.bio}</p>
          )}

          {/* Sectors */}
          {founder.sectors && founder.sectors.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {founder.sectors.slice(0, 3).map(sector => (
                <span 
                  key={sector}
                  className="px-2 py-0.5 bg-zinc-800/50 text-zinc-500 text-xs rounded"
                >
                  {sector}
                </span>
              ))}
              {founder.sectors.length > 3 && (
                <span className="text-zinc-600 text-xs">+{founder.sectors.length - 3}</span>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            {founder.show_saved_count && founder.saved_count > 0 && (
              <span>{founder.saved_count} signals saved</span>
            )}
            {founder.collection_count > 0 && (
              <span>{founder.collection_count} collections</span>
            )}
            {founder.follower_count > 0 && (
              <span>{founder.follower_count} followers</span>
            )}
          </div>
        </div>

        {/* Follow button */}
        <button
          onClick={onFollow}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isFollowing
              ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              : 'bg-violet-600 text-white hover:bg-violet-500'
          }`}
        >
          {isFollowing ? (
            <>
              <UserMinus className="w-4 h-4" />
              Following
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Follow
            </>
          )}
        </button>
      </div>

      {/* Social links */}
      {(founder.twitter_handle || founder.linkedin_url) && (
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800/40">
          {founder.twitter_handle && (
            <a
              href={`https://twitter.com/${founder.twitter_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-sm flex items-center gap-1 transition-colors"
            >
              @{founder.twitter_handle}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {founder.linkedin_url && (
            <a
              href={founder.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-sm flex items-center gap-1 transition-colors"
            >
              LinkedIn
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
