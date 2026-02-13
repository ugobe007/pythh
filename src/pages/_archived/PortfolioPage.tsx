import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import StartupCard from '../components/StartupCard';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { NotificationBell } from '../components/NotificationBell';
import { useAuth } from '../hooks/useAuth';
import { useVotes } from '../hooks/useVotes';
import { supabase } from '../lib/supabase';
import { adaptStartupForComponent } from '../utils/startupAdapters';
import { StartupComponent } from '../types';

export default function PortfolioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, isLoading: authLoading } = useAuth();
  const { votes, isLoading: votesLoading, getYesVotes, removeVote } = useVotes(userId);
  const [myYesVotes, setMyYesVotes] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper functions for stage information
  const getStageInfo = (stage: number) => {
    switch(stage) {
      case 1: return { name: 'Stage 1', description: 'Anonymous voting', color: 'bg-slate-300', icon: '📊' };
      case 2: return { name: 'Stage 2', description: 'Review materials', color: 'bg-cyan-400', icon: '📄' };
      case 3: return { name: 'Stage 3', description: 'Meet founder', color: 'bg-slate-300', icon: '🤝' };
      case 4: return { name: 'Stage 4', description: 'Deal room access', color: 'bg-slate-300', icon: '💼' };
      default: return { name: 'Stage 1', description: 'Voting stage', color: 'bg-slate-300', icon: '🗳️' };
    }
  };

  const getVotingNotification = (startup: any) => {
    const stage = startup.stage || 1;
    const currentVotes = startup.yesVotes || 0;
    const votesNeeded = stage === 4 ? 1 : 5;
    const votesRemaining = Math.max(0, votesNeeded - currentVotes);

    if (currentVotes >= votesNeeded) {
      if (stage === 4) {
        return { message: '🎉 FUNDED! Deal closed!', color: 'bg-green-100 border-green-500 text-green-800' };
      } else {
        return { message: `✅ Advanced to Stage ${stage + 1}!`, color: 'bg-blue-100 border-blue-500 text-blue-800' };
      }
    } else {
      return { 
        message: `🔔 Needs ${votesRemaining} more vote${votesRemaining !== 1 ? 's' : ''} to advance`, 
        color: 'bg-cyan-100 border-cyan-500 text-cyan-800' 
      };
    }
  };

  useEffect(() => {
    if (authLoading || votesLoading) return;

    const loadPortfolio = async () => {
      try {
        const isAnonymous = !userId || userId.startsWith('anon_');
        
        if (isAnonymous) {
          // For anonymous users, load from localStorage
          const myYesVotesStr = localStorage.getItem('myYesVotes');
          if (myYesVotesStr) {
            try {
              const yesVotesArray = JSON.parse(myYesVotesStr);
              
              // Deduplicate by ID
              const uniqueVotesMap = new Map();
              yesVotesArray.forEach((vote: any) => {
                if (vote && vote.id !== undefined) {
                  uniqueVotesMap.set(vote.id, vote);
                }
              });
              
              setMyYesVotes(Array.from(uniqueVotesMap.values()));
            } catch (e) {
              console.error('Error loading votes from localStorage:', e);
              setMyYesVotes([]);
            }
          } else {
            setMyYesVotes([]);
          }
        } else {
          // For authenticated users, get YES vote startup IDs from Supabase
          const yesVoteIds = getYesVotes();
          
          if (yesVoteIds.length === 0) {
            setMyYesVotes([]);
            return;
          }
          
          // SSOT: Fetch full startup data from Supabase
          const enrichedVotes = await Promise.all(
            yesVoteIds.map(async (id) => {
              try {
                const { data, error } = await supabase
                  .from('startup_uploads')
                  .select('*')
                  .eq('id', id)
                  .single();
                
                if (error || !data) {
                  console.warn(`Startup ${id} not found in database`);
                  return null;
                }
                
                const componentStartup = adaptStartupForComponent(data);
                return {
                  ...componentStartup,
                  votedAt: votes.find(v => v.startup_id === id)?.created_at || new Date().toISOString(),
                };
              } catch (error) {
                console.error(`Error fetching startup ${id}:`, error);
                return null;
              }
            })
          );
          
          setMyYesVotes(enrichedVotes.filter(Boolean) as StartupComponent[]);
        }
      } catch (error) {
        console.error('Error loading portfolio:', error);
        setMyYesVotes([]);
      }
    };

    loadPortfolio();

    // Check admin status
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      const profile = JSON.parse(userProfile);
      setIsAdmin(profile.email === 'admin@hotmoneyhoney.com' || profile.isAdmin);
    }
  }, [authLoading, votesLoading, votes, userId]); // Removed getYesVotes from dependencies (it's a function)

  const handleVote = (vote: 'yes' | 'no', startup?: any) => {
    if (vote === 'no' && startup) {
      // Remove from state immediately for instant UI update
      setMyYesVotes(prev => prev.filter(v => v.id !== startup.id));
      
      // For anonymous users, remove from localStorage
      const isAnonymous = !userId || userId.startsWith('anon_');
      if (isAnonymous) {
        const myYesVotesStr = localStorage.getItem('myYesVotes');
        if (myYesVotesStr) {
          try {
            const yesVotesArray = JSON.parse(myYesVotesStr);
            const updatedVotes = yesVotesArray.filter((v: any) => v.id !== startup.id);
            localStorage.setItem('myYesVotes', JSON.stringify(updatedVotes));
          } catch (e) {
            console.error('Error updating myYesVotes:', e);
          }
        }
        
        const votedStartupsStr = localStorage.getItem('votedStartups');
        if (votedStartupsStr) {
          try {
            const votedStartups = JSON.parse(votedStartupsStr);
            const updatedVoted = votedStartups.filter((id: number) => id !== startup.id);
            localStorage.setItem('votedStartups', JSON.stringify(updatedVoted));
          } catch (e) {
            console.error('Error updating votedStartups:', e);
          }
        }
      } else {
        // For authenticated users, remove from Supabase
        removeVote(startup.id.toString());
      }
    }
  };

  const handleRemoveFavorite = async (startupId: number) => {
    const success = await removeVote(startupId.toString());
    if (success) {
      setMyYesVotes(prev => prev.filter(v => v.id !== startupId));
    } else {
      alert('❌ Failed to remove favorite. Please try again.');
    }
  };

  if (authLoading || votesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading portfolio...</div>
      </div>
    );
  }

  const isActive = (path: string) => location.pathname === path;
  const getButtonSize = (path: string) => {
    if (isActive(path)) return 'text-lg py-3 px-6';
    return 'text-sm py-2 px-4';
  };

  return (
    <>
      {/* Main content container */}
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-8">
        {/* Logo Dropdown Menu */}
        <LogoDropdownMenu />

        {/* Current Page Button */}
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-full bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 text-slate-800 font-medium text-sm flex items-center gap-2 shadow-lg hover:from-slate-400 hover:via-slate-300 hover:to-slate-500 transition-all cursor-pointer"
            style={{
              boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.2)',
              textShadow: '0 1px 1px rgba(255,255,255,0.8)'
            }}>
            <span>🏠</span>
            <span>Home</span>
          </button>
        </div>

        <div className="max-w-7xl mx-auto pt-20 sm:pt-24 px-2">{/* Reduced padding */}
        
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🍯</div>
            <h1 className="text-3xl sm:text-4xl font-bold text-cyan-600 mb-2">
              Your Portfolio
            </h1>
            <p className="text-base sm:text-lg text-slate-700 font-semibold">
              Startups you've voted YES on
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-4 py-2 rounded-full bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 text-slate-800 hover:from-slate-400 hover:via-slate-300 hover:to-slate-500 transition-all font-medium text-sm shadow-lg"
              style={{
                boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.2)',
                textShadow: '0 1px 1px rgba(255,255,255,0.8)'
              }}
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Portfolio Content */}
          {myYesVotes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">No picks yet!</h2>
            <p className="text-lg text-gray-600 mb-8">
              Start voting YES on startups to build your portfolio
            </p>
            <button
              onClick={() => navigate('/vote')}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all text-lg"
            >
              🗳️ Go to Voting
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 border-2 border-cyan-400">
              <h2 className="text-lg font-bold text-slate-800 mb-1">
                ✨ {myYesVotes.length} Startup{myYesVotes.length !== 1 ? 's' : ''} in Your Portfolio
              </h2>
              <p className="text-sm text-slate-700">
                These are the startups you've voted YES on!
              </p>
            </div>

            {/* Startup Cards in Horizontal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
              {myYesVotes.map((startup) => {
                const stageInfo = getStageInfo(startup.stage || 1);
                const notification = getVotingNotification(startup);
                
                return (
                  <div key={startup.id} className="relative flex flex-col items-center w-full max-w-md">
                    {/* Stage Badge */}
                    <div className="mb-3 w-full">
                      <div className={`${stageInfo.color} ${startup.stage === 2 ? 'text-white' : 'text-slate-800'} px-4 py-2 rounded-xl text-center font-bold shadow-lg flex items-center justify-center gap-2`}>
                        <span>{stageInfo.icon}</span>
                        <span>{stageInfo.name}: {stageInfo.description}</span>
                      </div>
                    </div>

                    {/* Voting Progress Notification */}
                    <div className={`mb-3 w-full border-2 rounded-xl px-4 py-2 text-center font-semibold ${notification.color}`}>
                      {notification.message}
                    </div>

                    <StartupCard
                      startup={startup}
                      variant="detailed"
                      onVote={(startupId, vote) => handleVote(startup, vote)}
                    />
                    
                    {/* Action Buttons */}
                    <div className="mt-4 flex gap-3 justify-center w-full items-center">
                      <button
                        onClick={() => navigate('/vote')}
                        className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex items-center gap-2 text-base"
                      >
                        <span>🗳️</span>
                        <span>Vote Again</span>
                      </button>
                      <button
                        onClick={() => handleRemoveFavorite(startup.id)}
                        className="bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-all shadow-md flex items-center gap-1 text-sm"
                      >
                        <span>❌</span>
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center mt-8">
              <button
                onClick={() => navigate('/vote')}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transition-all"
              >
                🗳️ Continue Voting
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transition-all"
              >
                📊 Back to Dashboard
              </button>
            </div>
          </div>
        )}
        </div>{/* Close max-w-7xl container */}
      </div>{/* Close page */}
    </>
  );
}