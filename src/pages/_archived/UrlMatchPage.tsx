/**
 * URL MATCH PAGE
 * ==============
 * The core matching experience:
 * 1. User pastes URL → resolves to startup
 * 2. Shows startup identity + confidence
 * 3. Displays ranked investor matches with reasons
 * 4. Optional filters (stage, sector, check size)
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  Building2,
  Globe,
  TrendingUp,
  Target,
  Filter,
  ChevronDown,
  ExternalLink,
  Lock,
  Star,
  Zap,
  CheckCircle,
  AlertCircle,
  Search,
  DollarSign,
  MapPin,
  Users,
  Briefcase,
} from 'lucide-react';
import { resolveStartupFromUrl, ResolveResult } from '../lib/startupResolver';
import { getInvestorMatchesForStartup, InvestorMatch } from '../lib/investorMatchService';

// Analysis steps for loading animation
const ANALYSIS_STEPS = [
  { icon: Globe, text: 'Resolving URL...', duration: 800 },
  { icon: Building2, text: 'Identifying company...', duration: 1000 },
  { icon: Target, text: 'Analyzing fit criteria...', duration: 1200 },
  { icon: TrendingUp, text: 'Scoring investors...', duration: 1000 },
  { icon: Sparkles, text: 'Ranking matches...', duration: 800 },
];

// Confidence display mapping
const CONFIDENCE_DISPLAY: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  exact_domain: { label: 'Exact match', color: 'text-emerald-400', icon: CheckCircle },
  linkedin_match: { label: 'LinkedIn match', color: 'text-blue-400', icon: CheckCircle },
  crunchbase_match: { label: 'Crunchbase match', color: 'text-orange-400', icon: CheckCircle },
  contains_domain: { label: 'Domain match', color: 'text-cyan-400', icon: CheckCircle },
  created_provisional: { label: 'New submission', color: 'text-amber-400', icon: AlertCircle },
};

export default function UrlMatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawUrl = searchParams.get('url') || '';

  const [loading, setLoading] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [matches, setMatches] = useState<InvestorMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterSector, setFilterSector] = useState<string>('');

  // Run analysis on mount
  useEffect(() => {
    if (!rawUrl) {
      navigate('/match');
      return;
    }
    runAnalysis();
  }, [rawUrl]);

  // Animate through steps
  useEffect(() => {
    if (!loading) return;

    let currentStep = 0;
    const advanceStep = () => {
      if (currentStep < ANALYSIS_STEPS.length - 1) {
        currentStep++;
        setAnalysisStep(currentStep);
        setTimeout(advanceStep, ANALYSIS_STEPS[currentStep].duration);
      }
    };

    setTimeout(advanceStep, ANALYSIS_STEPS[0].duration);
  }, [loading]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Resolve URL to startup
      console.log('[UrlMatchPage] Resolving URL:', rawUrl);
      const result = await resolveStartupFromUrl(rawUrl);

      if (!result) {
        console.error('[UrlMatchPage] Failed to resolve URL:', rawUrl);
        setError(`Could not resolve this URL: "${rawUrl}". Please check it's a valid website, LinkedIn, or Crunchbase URL.`);
        setLoading(false);
        return;
      }
      console.log('[UrlMatchPage] Resolved startup:', result);

      setResolved(result);

      // Step 2: Get investor matches
      const investorMatches = await getInvestorMatchesForStartup(
        result.startup.id,
        result.startup,
        { limit: 50, minScore: 20 }
      );

      setMatches(investorMatches);

      // Brief delay for animation to complete
      await new Promise((r) => setTimeout(r, 500));
      setLoading(false);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Filter matches
  const filteredMatches = useMemo(() => {
    let result = [...matches];

    if (filterStage) {
      result = result.filter((m) =>
        m.stage?.some((s) => s.toLowerCase().includes(filterStage.toLowerCase()))
      );
    }

    if (filterSector) {
      result = result.filter((m) =>
        m.sectors?.some((s) => s.toLowerCase().includes(filterSector.toLowerCase()))
      );
    }

    return result;
  }, [matches, filterStage, filterSector]);

  // Get unique sectors/stages for filters
  const availableSectors = useMemo(() => {
    const sectors = new Set<string>();
    matches.forEach((m) => m.sectors?.forEach((s) => sectors.add(s)));
    return Array.from(sectors).slice(0, 10);
  }, [matches]);

  const availableStages = useMemo(() => {
    const stages = new Set<string>();
    matches.forEach((m) => m.stage?.forEach((s) => stages.add(s)));
    return Array.from(stages);
  }, [matches]);

  const formatCheckSize = (min?: number, max?: number) => {
    if (!min && !max) return null;
    const minStr = min ? `$${(min / 1000000).toFixed(0)}M` : '$0';
    const maxStr = max ? `$${(max / 1000000).toFixed(0)}M` : '$50M+';
    return `${minStr} - ${maxStr}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'from-emerald-500 to-green-500 text-emerald-400';
    if (score >= 70) return 'from-cyan-500 to-blue-500 text-cyan-400';
    if (score >= 55) return 'from-violet-500 to-purple-500 text-violet-400';
    return 'from-gray-500 to-slate-500 text-gray-400';
  };

  // Loading state
  if (loading) {
    const CurrentIcon = ANALYSIS_STEPS[analysisStep].icon;
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          {/* Animated icon */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-gray-900 to-gray-800 rounded-full flex items-center justify-center border border-cyan-500/30">
              <CurrentIcon className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
          </div>

          {/* Step indicator */}
          <div className="text-xl font-semibold text-white mb-4">
            {ANALYSIS_STEPS[analysisStep].text}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {ANALYSIS_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= analysisStep ? 'bg-cyan-400' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* URL being analyzed */}
          <div className="text-sm text-gray-500">
            Analyzing: <span className="text-gray-400">{rawUrl}</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <div className="text-xl font-semibold text-white mb-2">Analysis Failed</div>
          <div className="text-gray-400 mb-6">{error}</div>
          <button
            onClick={() => navigate('/match')}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold rounded-xl"
          >
            Try Another URL
          </button>
        </div>
      </div>
    );
  }

  const conf = CONFIDENCE_DISPLAY[resolved?.confidence || 'created_provisional'];
  const ConfIcon = conf.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/match')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-white">Your Investor Matches</span>
          </div>

          <Link
            to="/match"
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-sm font-semibold rounded-lg"
          >
            ✨ Match
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Startup Card */}
        {resolved && (
          <div className="mb-8 p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
                  <Building2 className="w-8 h-8 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {resolved.startup.name || 'Unknown Startup'}
                  </h1>
                  <div className="flex items-center gap-2 text-gray-400 mt-1">
                    <Globe className="w-4 h-4" />
                    <span>{resolved.startup.website}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-2 ${conf.color}`}>
                    <ConfIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{conf.label}</span>
                  </div>
                </div>
              </div>

              {/* GOD Score */}
              <div className="text-right">
                <div className="text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  {resolved.startup.total_god_score || 60}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">GOD Score™</div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {resolved.startup.sectors?.map((sector) => (
                <span
                  key={sector}
                  className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-sm rounded-lg border border-cyan-500/20"
                >
                  {sector}
                </span>
              ))}
              {resolved.startup.stage && (
                <span className="px-3 py-1 bg-violet-500/10 text-violet-400 text-sm rounded-lg border border-violet-500/20">
                  {['', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'][resolved.startup.stage] || 'Early Stage'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Matches Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              Top {filteredMatches.length} Investor Matches
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Ranked by fit score • Sector, stage & thesis alignment
            </p>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800 flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Stage</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 text-sm"
              >
                <option value="">All Stages</option>
                {availableStages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-1 block">Sector</label>
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 text-sm"
              >
                <option value="">All Sectors</option>
                {availableSectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {(filterStage || filterSector) && (
              <button
                onClick={() => { setFilterStage(''); setFilterSector(''); }}
                className="self-end px-3 py-2 text-sm text-cyan-400 hover:text-cyan-300"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Matches Grid */}
        <div className="grid gap-4">
          {filteredMatches.map((match, index) => (
            <div
              key={match.investor_id}
              className="group p-5 bg-gradient-to-br from-gray-900 via-gray-800/50 to-gray-900 rounded-xl border border-gray-700 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Investor info */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="relative">
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-700">
                      {index + 1}
                    </div>
                    {match.photo_url ? (
                      <img
                        src={match.photo_url}
                        alt={match.investor_name}
                        className="w-14 h-14 rounded-xl object-cover border border-gray-700"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl flex items-center justify-center border border-gray-700">
                        <Briefcase className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white truncate">
                        {match.investor_name}
                      </h3>
                      {match.linkedin_url && (
                        <a
                          href={match.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-cyan-400"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    {match.firm && (
                      <div className="text-sm text-gray-400">{match.firm}</div>
                    )}

                    {/* Reasons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {match.reasons.slice(0, 3).map((reason, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-800/50 text-gray-300 text-xs rounded-lg"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {match.sectors?.slice(0, 3).map((sector) => (
                        <span
                          key={sector}
                          className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded"
                        >
                          {sector}
                        </span>
                      ))}
                      {formatCheckSize(match.check_size_min, match.check_size_max) && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCheckSize(match.check_size_min, match.check_size_max)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Score */}
                <div className="text-right shrink-0">
                  <div
                    className={`text-3xl font-black bg-gradient-to-r ${getScoreColor(match.score)} bg-clip-text text-transparent`}
                  >
                    {Math.round(match.score)}
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Match</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No matches */}
        {filteredMatches.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <div className="text-lg text-gray-400">No matches found</div>
            <div className="text-sm text-gray-600 mt-1">
              {matches.length > 0
                ? 'Try adjusting your filters'
                : 'We\'re still processing matches for this startup'}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 p-8 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-cyan-500/10 rounded-2xl border border-cyan-500/20 text-center">
          <Lock className="w-10 h-10 text-cyan-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Unlock Full Access</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Get intro requests, investor contact info, and personalized outreach templates.
          </p>
          <Link
            to="/get-matched"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
          >
            <Zap className="w-5 h-5" />
            Sign Up Free
          </Link>
        </div>
      </main>
    </div>
  );
}
