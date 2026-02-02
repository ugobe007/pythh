// ============================================================================
// InvestorRevealPage - Full investor profile after unlock
// ============================================================================
// Route: /app/investors/:investorId
// 
// Behavior:
//   1. Call get_investor_reveal(startupId, investorId)
//   2. If unlock_required: true → show unlock prompt (shouldn't happen normally)
//   3. Otherwise: render full profile
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  Linkedin,
  Twitter,
  Building2,
  MapPin,
  DollarSign,
  Target,
  Briefcase,
  Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '@/store';
import { useInvestorReveal, useUnlock, invalidateInvestorReveal } from '@/services/pythh-rpc';
import { FIT_DISPLAY } from '@/lib/pythh-types';

export default function InvestorRevealPage() {
  const { investorId } = useParams<{ investorId: string }>();
  const navigate = useNavigate();

  // Get startup ID from store
  const startups = useStore((state) => state.startups);
  const [startupId, setStartupId] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId && startups.length > 0) {
      const approved = startups.find(s => s.status === 'approved');
      if (approved) {
        setStartupId(approved.id);
      }
    }
  }, [startups, startupId]);

  // Data hook
  const { reveal, loading, error, refresh } = useInvestorReveal(startupId, investorId || null);
  const { unlock, isPending } = useUnlock(startupId);

  // Handle inline unlock
  const handleUnlock = useCallback(async () => {
    if (!investorId) return;
    const result = await unlock(investorId);
    if (result.success) {
      invalidateInvestorReveal(startupId!, investorId);
      refresh();
    }
  }, [unlock, investorId, startupId, refresh]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-gray-400">Loading investor profile...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !reveal) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-lg font-medium">Failed to load investor</p>
          <p className="text-sm text-gray-500 mt-1">{error?.message || 'Unknown error'}</p>
          <button
            onClick={() => navigate('/app/signals')}
            className="mt-4 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700"
          >
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  // Unlock required (shouldn't happen if navigating from table)
  if (reveal.unlock_required) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <header className="border-b border-gray-800 bg-gray-900/50">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link
              to="/app/signals"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Matches
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border-2 border-gray-600 flex items-center justify-center">
              <Lock className="w-10 h-10 text-gray-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Investor Locked</h1>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Unlock this investor to reveal their identity, contact information, and detailed match analysis.
            </p>
            <button
              onClick={handleUnlock}
              disabled={isPending(investorId!)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isPending(investorId!) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Unlock Investor
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Full reveal
  const { investor, match, fit } = reveal;
  if (!investor) return null;

  const fitLabel = fit?.bucket ? FIT_DISPLAY[fit.bucket] : 'Good';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link
            to="/app/signals"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Matches
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="flex items-start gap-6 mb-8">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {investor.photo_url ? (
              <img
                src={investor.photo_url}
                alt={investor.name}
                className="w-24 h-24 rounded-xl object-cover bg-gray-800"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-1">{investor.name}</h1>
            {investor.firm && (
              <p className="text-lg text-gray-400 mb-3">
                {investor.title ? `${investor.title} at ` : ''}{investor.firm}
              </p>
            )}

            {/* Badges */}
            <div className="flex items-center gap-3">
              {fit?.bucket && (
                <span className="px-3 py-1 bg-blue-900/40 text-blue-400 rounded-full text-sm font-medium">
                  {fitLabel} Fit
                </span>
              )}
              {match?.score && (
                <span className="px-3 py-1 bg-emerald-900/40 text-emerald-400 rounded-full text-sm font-medium">
                  {match.score.toFixed(0)}% Match
                </span>
              )}
              {match?.confidence && (
                <span className="px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-sm">
                  {match.confidence} confidence
                </span>
              )}
            </div>
          </div>

          {/* Contact Actions */}
          <div className="flex flex-col gap-2">
            {investor.email && (
              <a
                href={`mailto:${investor.email}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            )}
            {investor.linkedin_url && (
              <a
                href={investor.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
            )}
            {investor.twitter_url && (
              <a
                href={investor.twitter_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </a>
            )}
          </div>
        </div>

        {/* Match Reasoning */}
        {match?.reasoning && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-800/50 rounded-xl">
            <h2 className="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2">
              Why This Match
            </h2>
            <p className="text-gray-200">{match.reasoning}</p>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Investment Criteria */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-gray-400" />
              Investment Criteria
            </h3>
            
            <div className="space-y-4">
              {investor.stage && investor.stage.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Stage</p>
                  <div className="flex flex-wrap gap-2">
                    {investor.stage.map((s) => (
                      <span key={s} className="px-2 py-1 bg-gray-800 rounded text-sm">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {investor.sectors && investor.sectors.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sectors</p>
                  <div className="flex flex-wrap gap-2">
                    {investor.sectors.slice(0, 8).map((s) => (
                      <span key={s} className="px-2 py-1 bg-gray-800 rounded text-sm">
                        {s}
                      </span>
                    ))}
                    {investor.sectors.length > 8 && (
                      <span className="px-2 py-1 text-gray-500 text-sm">
                        +{investor.sectors.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {(investor.check_size_min || investor.check_size_max) && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Check Size</p>
                  <p className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    {formatMoney(investor.check_size_min)} - {formatMoney(investor.check_size_max)}
                  </p>
                </div>
              )}

              {investor.geography_focus && investor.geography_focus.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Geography</p>
                  <p className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    {investor.geography_focus.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Portfolio */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-gray-400" />
              Portfolio
            </h3>

            {investor.notable_investments && Array.isArray(investor.notable_investments) && investor.notable_investments.length > 0 ? (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Notable Investments</p>
                <div className="flex flex-wrap gap-2">
                  {(investor.notable_investments as string[]).map((inv) => (
                    <span key={inv} className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-sm">
                      {inv}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {investor.portfolio_companies && investor.portfolio_companies.length > 0 ? (
              <div>
                <p className="text-sm text-gray-500 mb-2">Portfolio Companies</p>
                <div className="flex flex-wrap gap-2">
                  {investor.portfolio_companies.slice(0, 10).map((co) => (
                    <span key={co} className="px-2 py-1 bg-gray-800 rounded text-sm">
                      {co}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No portfolio data available</p>
            )}
          </div>
        </div>

        {/* Investment Thesis */}
        {investor.investment_thesis && (
          <div className="mb-8 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-medium mb-3">Investment Thesis</h3>
            <p className="text-gray-300">{investor.investment_thesis}</p>
          </div>
        )}

        {/* Bio */}
        {investor.bio && (
          <div className="mb-8 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-medium mb-3">About</h3>
            <p className="text-gray-300 whitespace-pre-wrap">{investor.bio}</p>
          </div>
        )}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatMoney(amount: number | null): string {
  if (!amount) return '?';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}
