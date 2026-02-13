import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import startupData from '../data/startupData';
import { getTrendingStartups, getTopVotedStartups, getRecentlyApprovedStartups } from '../utils/voteAnalytics';
import UserActivityStats from '../components/UserActivityStats';
import ActivationBanner from '../components/ActivationBanner';
import InviteButton from '../components/InviteButton';
import InviteModal from '../components/InviteModal';
import { useWatchlist } from '../hooks/useWatchlist';

interface ActivityEvent {
  id: string;
  type: 'new' | 'trending' | 'approved' | 'funding';
  icon: string;
  title: string;
  description: string;
  timestamp: Date;
  startupId?: number;
  startupName?: string;
}

const Feed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<'all' | 'new' | 'trending' | 'approved' | 'funding'>('all');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const { watchlistIds } = useWatchlist();

  useEffect(() => {
    generateActivities();
  }, []);

  const generateActivities = async () => {
    const events: ActivityEvent[] = [];
    const now = new Date();

    try {
      // Get real data from Supabase
      const [trendingStartups, topVotedStartups, approvedStartups] = await Promise.all([
        getTrendingStartups(10),
        getTopVotedStartups(10),
        getRecentlyApprovedStartups(10),
      ]);

      // Add trending events
      trendingStartups.forEach((item, index) => {
        const hoursAgo = index * 2;
        const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
        
        events.push({
          id: `trending-${item.startup.id}`,
          type: 'trending',
          icon: '🔥',
          title: 'Trending Now',
          description: `${item.startup.name} has ${item.stats.totalYesVotes} YES votes and climbing! (Trending score: ${item.stats.trendingScore})`,
          timestamp,
          startupId: item.startup.id,
          startupName: item.startup.name,
        });
      });

      // Add new vote events for highly voted startups
      topVotedStartups.forEach((item, index) => {
        if (item.stats.recentYesVotes > 0) {
          const hoursAgo = (index + 10) * 3;
          const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
          
          events.push({
            id: `new-votes-${item.startup.id}`,
            type: 'trending',
            icon: '⭐',
            title: 'Hot Votes',
            description: `${item.startup.name} got ${item.stats.recentYesVotes} new votes in the last 24 hours!`,
            timestamp,
            startupId: item.startup.id,
            startupName: item.startup.name,
          });
        }
      });

      // Add approved startup events
      approvedStartups.forEach((startup, index) => {
        const timestamp = new Date(startup.updated_at || startup.created_at);
        
        events.push({
          id: `approved-${startup.id}`,
          type: 'approved',
          icon: '✅',
          title: 'Admin Approved',
          description: `${startup.company_name} approved and now live for voting`,
          timestamp,
          startupId: startup.id,
          startupName: startup.company_name,
        });
      });

      // Add some "new startup" activities from recent data
      const recentStartups = startupData.slice(0, 10);
      recentStartups.forEach((startup, index) => {
        const daysAgo = index + 1;
        events.push({
          id: `new-${startup.id}`,
          type: 'new',
          icon: '🚀',
          title: 'New Startup Launched',
          description: `${startup.name} just joined the platform!`,
          timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          startupId: startup.id,
          startupName: startup.name,
        });
      });

      // Add some funding announcements (simulated for now)
      const fundingStartups = startupData.slice(10, 15);
      const fundingAmounts = ['$500K', '$1M', '$2M', '$5M', '$10M'];
      fundingStartups.forEach((startup, index) => {
        const daysAgo = (index + 2) * 2;
        const amount = fundingAmounts[index % fundingAmounts.length];
        events.push({
          id: `funding-${startup.id}`,
          type: 'funding',
          icon: '💰',
          title: 'Funding Announcement',
          description: `${startup.name} just raised ${amount} in seed funding!`,
          timestamp: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
          startupId: startup.id,
          startupName: startup.name,
        });
      });

      // Sort by timestamp (newest first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      console.log(`📡 Generated ${events.length} real-time feed events`);
      setActivities(events);

    } catch (error) {
      console.error('Error generating activities:', error);
      // Fallback to simulated data
      generateFallbackActivities();
    }
  };

  const generateFallbackActivities = () => {
    const events: ActivityEvent[] = [];
    const now = new Date();

    // Generate activities from startup data
    startupData.slice(0, 20).forEach((startup, index) => {
      // Simulate different types of events
      const daysAgo = index * 2;
      const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // New startup event
      if (index % 3 === 0) {
        events.push({
          id: `new-${startup.id}`,
          type: 'new',
          icon: '🚀',
          title: 'New Startup Launched',
          description: `${startup.name} just joined the platform!`,
          timestamp,
          startupId: startup.id,
          startupName: startup.name,
        });
      }

      // Trending event
      if (index % 4 === 1) {
        const votes = Math.floor(Math.random() * 200) + 50;
        events.push({
          id: `trending-${startup.id}`,
          type: 'trending',
          icon: '🔥',
          title: 'Trending Now',
          description: `${startup.name} has ${votes} YES votes and climbing!`,
          timestamp,
          startupId: startup.id,
          startupName: startup.name,
        });
      }

      // Approved event
      if (index % 5 === 2) {
        events.push({
          id: `approved-${startup.id}`,
          type: 'approved',
          icon: '✅',
          title: 'Admin Approved',
          description: `${startup.name} approved and now live for voting`,
          timestamp,
          startupId: startup.id,
          startupName: startup.name,
        });
      }

      // Funding event
      if (index % 6 === 3) {
        const amount = ['$500K', '$1M', '$2M', '$5M', '$10M'][Math.floor(Math.random() * 5)];
        events.push({
          id: `funding-${startup.id}`,
          type: 'funding',
          icon: '💰',
          title: 'Funding Announcement',
          description: `${startup.name} just raised ${amount} in seed funding!`,
          timestamp,
          startupId: startup.id,
          startupName: startup.name,
        });
      }
    });

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setActivities(events);
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'new': return 'from-blue-500 to-cyan-500';
      case 'trending': return 'from-cyan-600 to-blue-600';
      case 'approved': return 'from-green-500 to-emerald-500';
      case 'funding': return 'from-purple-500 to-pink-500';
      default: return 'from-purple-500 to-indigo-500';
    }
  };

  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 py-8 px-4">
      {/* Invite Modal */}
      <InviteModal isOpen={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
      
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-white">
            📡 Activity Feed
          </h1>
          <div className="flex items-center gap-3">
            <InviteButton onClick={() => setInviteModalOpen(true)} variant="nav" />
            <Link 
              to="/"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all border border-white/20"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap bg-white/10 backdrop-blur-md rounded-lg p-2 border border-white/20">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            All ({activities.length})
          </button>
          <button
            onClick={() => setFilter('new')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'new'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            🚀 New ({activities.filter(a => a.type === 'new').length})
          </button>
          <button
            onClick={() => setFilter('trending')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'trending'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            🔥 Trending ({activities.filter(a => a.type === 'trending').length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'approved'
                ? 'bg-green-500 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            ✅ Approved ({activities.filter(a => a.type === 'approved').length})
          </button>
          <button
            onClick={() => setFilter('funding')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'funding'
                ? 'bg-purple-500 text-white shadow-lg'
                : 'text-purple-200 hover:bg-white/10'
            }`}
          >
            💰 Funding ({activities.filter(a => a.type === 'funding').length})
          </button>
        </div>
      </div>

      {/* User Activity Stats - LIVE */}
      <div className="max-w-4xl mx-auto mb-8">
        <UserActivityStats />
      </div>

      {/* Activation Banner - shows until user watches their first startup */}
      <div className="max-w-4xl mx-auto">
        <ActivationBanner watchlistCount={watchlistIds.length} />
      </div>

      {/* Activity Timeline */}
      <div className="max-w-4xl mx-auto space-y-4" data-startup-list>
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-white text-xl">No activities yet in this category</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 hover:bg-white/15 transition-all group"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r ${getTypeColor(activity.type)} flex items-center justify-center text-2xl shadow-lg`}>
                  {activity.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-purple-200 transition-colors">
                      {activity.title}
                    </h3>
                    <span className="text-sm text-purple-300 whitespace-nowrap ml-4">
                      {getRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-purple-100 mb-3">
                    {activity.description}
                  </p>

                  {/* Action button */}
                  {activity.startupId && (
                    <Link
                      to={`/startup/${activity.startupId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all shadow-lg text-sm font-medium"
                    >
                      View Startup →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer CTA */}
      <div className="max-w-4xl mx-auto mt-12 text-center">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-8 border-2 border-purple-400/30 shadow-xl">
          <h3 className="text-2xl font-bold text-white mb-3">
            Want to be featured in the feed?
          </h3>
          <p className="text-purple-100 mb-6">
            Submit your startup and get discovered by investors
          </p>
          <Link
            to="/submit"
            className="inline-block px-8 py-3 bg-white text-purple-600 font-bold rounded-lg hover:bg-purple-50 transition-all shadow-lg"
          >
            🚀 Submit Your Startup
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Feed;
