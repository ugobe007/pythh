import React, { useEffect, useState } from 'react';
import { getRecentUserVotes, getRecentVoteStats } from '../lib/activityLogger';
import startupData from '../data/startupData';

interface UserVoteActivity {
  user_name: string;
  vote: 'yes' | 'no';
  created_at: string;
  metadata: any;
}

const UserActivityStats: React.FC = () => {
  const [recentVotes, setRecentVotes] = useState<UserVoteActivity[]>([]);
  const [voteStats, setVoteStats] = useState({ totalVotes: 0, yesVotes: 0, noVotes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    // Refresh every 30 seconds
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActivities = async () => {
    try {
      const [votes, stats] = await Promise.all([
        getRecentUserVotes(10),
        getRecentVoteStats(),
      ]);
      
      setRecentVotes(votes);
      setVoteStats(stats);
      setLoading(false);
    } catch (error) {
      console.error('Error loading activities:', error);
      setLoading(false);
    }
  };

  const getStartupName = (startupId: string): string => {
    const startup = startupData.find(s => s.id.toString() === startupId);
    return startup?.name || 'Unknown Startup';
  };

  const getRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/20 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-white/10 rounded"></div>
            <div className="h-3 bg-white/10 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Banner */}
      {voteStats.totalVotes > 0 && (
        <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 backdrop-blur-md rounded-xl border border-purple-400/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <div className="text-white font-bold text-lg">
                  {voteStats.totalVotes} {voteStats.totalVotes === 1 ? 'vote' : 'votes'} in the last hour
                </div>
                <div className="text-purple-200 text-sm">
                  {voteStats.yesVotes} YES · {voteStats.noVotes} NO
                </div>
              </div>
            </div>
            <div className="text-green-400 text-2xl animate-pulse">
              🔴 LIVE
            </div>
          </div>
        </div>
      )}

      {/* Recent User Votes */}
      {recentVotes.length > 0 && (
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>👥</span>
            Recent Activity
          </h3>
          
          <div className="space-y-3">
            {recentVotes.map((vote, index) => {
              const startupName = vote.metadata?.startupName || 'Unknown Startup';
              
              return (
                <div 
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {vote.vote === 'yes' ? '👍' : '👎'}
                    </span>
                    <div>
                      <div className="text-white text-sm">
                        <span className="font-semibold text-purple-300">{vote.user_name}</span>
                        {' '}voted{' '}
                        <span className={`font-bold ${vote.vote === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                          {vote.vote.toUpperCase()}
                        </span>
                        {' '}on{' '}
                        <span className="font-medium">{startupName}</span>
                      </div>
                      <div className="text-purple-300 text-xs">
                        {getRelativeTime(vote.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentVotes.length === 0 && voteStats.totalVotes === 0 && (
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/20 p-6 text-center">
          <div className="text-4xl mb-2">🌟</div>
          <div className="text-white font-medium mb-1">No recent activity</div>
          <div className="text-purple-200 text-sm">Be the first to vote!</div>
        </div>
      )}
    </div>
  );
};

export default UserActivityStats;
