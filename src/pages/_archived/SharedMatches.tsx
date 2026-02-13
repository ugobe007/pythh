/**
 * SHARED MATCHES PAGE
 * ===================
 * Public read-only view of shared investor matches
 * Accessed via /share/matches/:token
 * Token expires after 7 days
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle, Clock, Building2, Target, ArrowRight } from 'lucide-react';
import { analytics } from '../analytics';

interface SharedMatch {
  investor_name: string;
  firm: string | null;
  type: string | null;
  match_score: number;
  confidence_level: string | null;
  reasoning: string | null;
}

interface SharedPayload {
  startup: {
    name: string;
    tagline: string | null;
    sectors: string[] | null;
    stage: string | null;
  };
  matches: SharedMatch[];
  generated_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

export default function SharedMatches() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedPayload | null>(null);
  
  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }
    
    fetchSharedData();
  }, [token]);
  
  const fetchSharedData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/share/matches/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Share link not found or invalid');
        } else if (response.status === 410) {
          setError('This share link has expired');
        } else {
          setError('Failed to load shared matches');
        }
        setLoading(false);
        return;
      }
      
      const payload = await response.json();
      setData(payload);
      
      // Track share opened
      analytics.shareOpened(token || 'unknown');
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load shared matches');
    } finally {
      setLoading(false);
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (score >= 80) return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    if (score >= 70) return 'text-violet-400 bg-violet-500/20 border-violet-500/30';
    return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading shared matches...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">{error}</h1>
          <p className="text-gray-400 mb-6">
            {error.includes('expired') 
              ? 'Share links are valid for 7 days. Ask the sender for a new link.'
              : 'This link may have been deleted or never existed.'}
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            Go to Hot Honey
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }
  
  if (!data) return null;
  
  const { startup, matches, generated_at } = data;
  const generatedDate = new Date(generated_at).toLocaleDateString();
  
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-gradient-to-b from-violet-900/20 to-transparent border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Shared badge */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Clock className="w-3.5 h-3.5" />
            <span>Shared on {generatedDate}</span>
            <span className="text-gray-600">•</span>
            <span>via Hot Honey</span>
          </div>
          
          {/* Startup info */}
          <h1 className="text-2xl font-bold text-white mb-2">{startup.name}</h1>
          {startup.tagline && (
            <p className="text-gray-400 mb-4">{startup.tagline}</p>
          )}
          
          <div className="flex flex-wrap gap-2">
            {startup.sectors?.map((sector, i) => (
              <span key={i} className="px-2 py-1 text-xs bg-violet-500/20 text-violet-400 rounded border border-violet-500/30">
                {sector}
              </span>
            ))}
            {startup.stage && (
              <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                {startup.stage}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Matches list */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">
            Top {matches.length} Investor Matches
          </h2>
        </div>
        
        <div className="grid gap-3">
          {matches.map((match, index) => (
            <div 
              key={index}
              className="p-4 bg-gradient-to-r from-[#0f0f0f] via-[#131313] to-[#0f0f0f] border border-gray-700/50 rounded-xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    index === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    index === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                    index === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/30' :
                    'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  }`}>
                    #{index + 1}
                  </div>
                  
                  {/* Investor info */}
                  <div>
                    <h3 className="text-white font-medium">{match.investor_name}</h3>
                    {match.firm && (
                      <div className="flex items-center gap-1 text-gray-400 text-sm mt-0.5">
                        <Building2 className="w-3 h-3" />
                        <span>{match.firm}</span>
                      </div>
                    )}
                    {match.type && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] bg-violet-500/20 text-violet-400 rounded border border-violet-500/30">
                        {match.type}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Score */}
                <div className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${getScoreColor(match.match_score)}`}>
                  {match.match_score}
                </div>
              </div>
              
              {/* Reasoning */}
              {match.reasoning && (
                <p className="mt-3 text-sm text-gray-400 pl-11">
                  {match.reasoning}
                </p>
              )}
              
              {/* Confidence */}
              {match.confidence_level && (
                <div className="mt-2 pl-11">
                  <span className="text-xs text-cyan-400">
                    Confidence: {match.confidence_level}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* CTA */}
        <div className="mt-8 p-6 bg-gradient-to-r from-violet-900/20 to-cyan-900/20 border border-violet-500/30 rounded-xl text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Want matches for your startup?</h3>
          <p className="text-gray-400 text-sm mb-4">
            Get instant investor matches with AI-powered compatibility scores.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg font-medium hover:from-violet-700 hover:to-cyan-700 transition-all"
          >
            Try Hot Honey Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-gray-500">
          Powered by <Link to="/" className="text-violet-400 hover:underline">Hot Honey</Link> — AI-powered investor matching
        </div>
      </div>
    </div>
  );
}
