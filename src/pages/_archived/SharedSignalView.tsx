/**
 * SHARED SIGNAL VIEW
 * ==================
 * Read-only advisor/cofounder view of shared signals
 * 
 * From Spec - Recipient View:
 * - Read-only snapshot of signal data
 * - Shows: GOD Score, matches, reasoning
 * - Cannot: Export, reshare, contact investors
 * - Access: Time-limited (7 days), revocable
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ExternalLink, 
  Building2,
  Star,
  Clock,
  AlertCircle,
  Lock,
  Eye,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';

interface SharedSignalData {
  startupName: string;
  sharedBy: string;
  godScore: number;
  matches: Array<{
    investorName: string;
    firmName: string;
    matchScore: number;
    alignmentReasons: string[];
  }>;
  expiresAt: string;
  accessLevel: 'view' | 'comment';
}

export default function SharedSignalView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<SharedSignalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In production, this would fetch from Supabase using the token
    // For now, show a demo state
    const loadSharedData = async () => {
      setLoading(true);
      
      try {
        // Mock data for demo - in production fetch from shared_signals table
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (shareToken === 'demo' || shareToken) {
          setData({
            startupName: 'Demo Startup',
            sharedBy: 'founder@startup.com',
            godScore: 78,
            matches: [
              {
                investorName: 'Sarah Chen',
                firmName: 'Sequoia Capital',
                matchScore: 92,
                alignmentReasons: ['Stage fit', 'Sector focus', 'Thesis match']
              },
              {
                investorName: 'Michael Park',
                firmName: 'a16z',
                matchScore: 87,
                alignmentReasons: ['Previous investments', 'Market expertise']
              },
              {
                investorName: 'Lisa Wang',
                firmName: 'Accel',
                matchScore: 84,
                alignmentReasons: ['Geographic focus', 'Check size match']
              }
            ],
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            accessLevel: 'view'
          });
        } else {
          setError('Invalid or expired share link');
        }
      } catch (err) {
        setError('Failed to load shared signals');
      } finally {
        setLoading(false);
      }
    };

    loadSharedData();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading shared signals...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Link Invalid</h1>
          <p className="text-gray-500 mb-8">{error || 'This share link has expired or been revoked.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all"
          >
            Try Pythh Free
          </Link>
        </div>
      </div>
    );
  }

  const expiresIn = Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Brand Mark */}
      <div className="fixed top-5 left-5 z-40">
        <Link to="/">
          <BrandMark />
        </Link>
      </div>

      <div className="container mx-auto px-6 pt-24 pb-16 max-w-4xl">
        {/* Read-Only Banner */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-8 flex items-center gap-3">
          <Eye className="w-5 h-5 text-violet-400 flex-shrink-0" />
          <div>
            <p className="text-violet-300 text-sm font-medium">
              Shared Signal View • Read Only
            </p>
            <p className="text-gray-500 text-xs">
              Shared by {data.sharedBy} • Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">{data.startupName}</h1>
          <p className="text-gray-500">Investor signal analysis</p>
        </div>

        {/* GOD Score Card */}
        <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400 text-sm uppercase tracking-wide">GOD Score</span>
            <span className="text-gray-600 text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Snapshot from share date
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-amber-500">{data.godScore}</span>
            <span className="text-gray-600">/100</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {data.godScore >= 80 ? 'Strong signals detected' :
             data.godScore >= 60 ? 'Moderate signals present' :
             'Early stage signals'}
          </p>
        </div>

        {/* Match List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Top Investor Matches ({data.matches.length})
          </h2>
          <div className="space-y-4">
            {data.matches.map((match, idx) => (
              <div 
                key={idx}
                className="bg-[#111111] border border-gray-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{match.investorName}</h3>
                      <p className="text-gray-500 text-sm">{match.firmName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-400 font-bold">{match.matchScore}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {match.alignmentReasons.map((reason, i) => (
                    <span 
                      key={i}
                      className="px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded-md"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Restrictions Notice */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 mb-8">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            Read-Only Access
          </h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex items-center gap-2">
              <span className="text-red-500">✕</span>
              Cannot export or download data
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-500">✕</span>
              Cannot reshare this link
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-500">✕</span>
              Cannot contact investors directly
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Can view signal analysis
            </li>
            {data.accessLevel === 'comment' && (
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Can add comments (Team plan)
              </li>
            )}
          </ul>
        </div>

        {/* CTA for Viewers */}
        <div className="text-center p-8 bg-gradient-to-r from-amber-500/5 via-[#0a0a0a] to-violet-500/5 border border-gray-800 rounded-2xl">
          <h3 className="text-xl font-bold text-white mb-2">
            Want your own signal analysis?
          </h3>
          <p className="text-gray-500 mb-6">
            Pythh helps founders find aligned investors before the pitch.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all"
          >
            Try Pythh Free
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
