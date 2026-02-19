import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSavedMatches, type SavedMatch } from '../lib/savedMatchesService';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import SEO from '../components/SEO';
import { Sparkles, BookmarkIcon, TrendingUp, User, LogOut, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/dashboard');
      return;
    }
    
    // Load saved matches from localStorage
    const matches = getSavedMatches();
    setSavedMatches(matches);
    setLoading(false);
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isPro = profile?.plan !== 'free';

  return (
    <>
      <SEO 
        title="Dashboard - Hot Honey"
        description="View your saved matches and Pro account details"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <PythhUnifiedNav />
        
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
                <p className="text-slate-400">Welcome back, {user?.name || user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Account Tier */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                {isPro && (
                  <span className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-cyan-400 text-xs font-medium">
                    PRO
                  </span>
                )}
              </div>
              <h3 className="text-slate-400 text-sm mb-1">Plan</h3>
              <p className="text-2xl font-bold text-white">
                {isPro ? 'Pro' : 'Free'}
              </p>
              {!isPro && (
                <Link 
                  to="/pricing" 
                  className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Upgrade to Pro
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            {/* Saved Matches */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                <BookmarkIcon className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-slate-400 text-sm mb-1">Saved Matches</h3>
              <p className="text-2xl font-bold text-white">{savedMatches.length}</p>
            </div>

            {/* Account Info */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-slate-400 text-sm mb-1">Email</h3>
              <p className="text-base font-medium text-white truncate">{user?.email}</p>
            </div>
          </div>

          {/* Saved Matches Section */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Your Saved Matches</h2>
              <Link 
                to="/" 
                className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
              >
                Find More Matches
              </Link>
            </div>

            {savedMatches.length === 0 ? (
              <div className="text-center py-16">
                <BookmarkIcon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-300 mb-2">No saved matches yet</h3>
                <p className="text-slate-400 mb-6">
                  Start analyzing startups to find and save your best investor matches
                </p>
                <Link 
                  to="/" 
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all"
                >
                  <TrendingUp className="w-5 h-5" />
                  Analyze Your First Startup
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {savedMatches.map((match) => (
                  <div 
                    key={match.id}
                    className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{match.startupName}</h3>
                        <span className="text-slate-500">×</span>
                        <h4 className="text-lg font-medium text-cyan-400">{match.investorName}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>Match Score: <span className="text-emerald-400 font-medium">{match.matchScore}%</span></span>
                        <span>•</span>
                        <span>Saved {new Date(match.savedAt).toLocaleDateString()}</span>
                        {match.status && match.status !== 'saved' && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-400 capitalize">{match.status.replace('_', ' ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all text-sm">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pro Features Preview (Free users only) */}
          {!isPro && (
            <div className="mt-8 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 backdrop-blur-xl rounded-xl p-8 border border-cyan-500/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">Unlock Pro Features</h3>
                  <p className="text-slate-300 mb-4">
                    Get unlimited analyses, email alerts for hot matches, and priority support
                  </p>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                      Unlimited startup analyses (no 5-analysis limit)
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                      Real-time email alerts for hot matches
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                      Advanced filtering and search
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                      Priority support
                    </li>
                  </ul>
                  <Link 
                    to="/pricing" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all"
                  >
                    Upgrade to Pro - $49/month
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
