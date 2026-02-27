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
  Copy,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
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

  // Outreach template state
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyEmail = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

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
        {/* Match Score Visual Bar */}
        {match?.score && (
          <div className="mb-6 p-5 bg-gray-900/50 border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-300">Match Score</span>
              <span className={`text-2xl font-bold ${
                match.score >= 80 ? 'text-emerald-400' : match.score >= 65 ? 'text-cyan-400' : 'text-amber-400'
              }`}>{match.score.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${
                  match.score >= 80 ? 'bg-emerald-500' : match.score >= 65 ? 'bg-cyan-500' : 'bg-amber-500'
                }`}
                style={{ width: `${match.score}%`, filter: match.score >= 80 ? 'drop-shadow(0 0 4px rgba(52,211,153,0.5))' : 'drop-shadow(0 0 4px rgba(34,211,238,0.4))' }}
              />
            </div>
            {match.reasoning && (
              <div className="border-t border-gray-800 pt-3 mt-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Why This Match</p>
                <ul className="space-y-1">
                  {match.reasoning.split(/\.\s+/).filter(s => s.trim().length > 4).slice(0, 4).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-emerald-400 mt-0.5 flex-shrink-0">›</span>
                      <span>{s.replace(/\.$/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

        {/* Outreach Email Template */}
        <div className="mb-8 bg-gray-900/50 border border-emerald-800/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTemplate(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Outreach Email Template</p>
                <p className="text-xs text-gray-500">Personalized to this investor's thesis and your match signals</p>
              </div>
            </div>
            {showTemplate ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>

          {showTemplate && (
            <div className="px-6 pb-6">
              <div className="relative bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                {generateOutreachEmail(investor, match)}
                <button
                  onClick={() => copyEmail(generateOutreachEmail(investor, match))}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-600">Customize the [brackets] before sending. Keep it under 150 words.</p>
            </div>
          )}
        </div>
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

function generateOutreachEmail(
  investor: NonNullable<import('@/lib/pythh-types').InvestorReveal['investor']>,
  match: import('@/lib/pythh-types').InvestorReveal['match']
): string {
  const firstName = investor.name?.split(' ')[0] ?? 'Hi';
  const firm = investor.firm ?? 'your fund';
  const sectors = investor.sectors?.slice(0, 2).join(' and ') ?? 'your focus areas';
  const thesisSnippet = investor.investment_thesis
    ? investor.investment_thesis.slice(0, 90).replace(/\s\w+$/, '') + '…'
    : null;
  const reason = match?.reasoning
    ? match.reasoning.split(/\.\s/)[0].replace(/\s+/g, ' ').trim()
    : `strong sector and stage alignment`;

  return [
    `Hi ${firstName},`,
    ``,
    `I'm [Your Name], founder of [Startup Name] — [one sentence on what you do].`,
    ``,
    `I've been following ${firm}'s work in ${sectors}${thesisSnippet ? ` and appreciated your thesis: "${thesisSnippet}"` : ''}.`,
    ``,
    `We matched because: ${reason}.`,
    ``,
    `We're currently [stage, e.g. pre-seed / raising $Xm] and would love a 20-minute call to share traction and see if there's a fit.`,
    ``,
    `Would you have time next week?`,
    ``,
    `Best,`,
    `[Your Name]`,
  ].join('\n');
}
