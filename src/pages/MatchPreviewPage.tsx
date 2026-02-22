/**
 * /matches/preview/:startupId
 * ═══════════════════════════════════════════════════════════════
 * Public shareable investor match preview — no auth required.
 * Used for outbound marketing: X/LinkedIn posts link here.
 *
 * Shows top 5 matches in full, remaining blurred behind CTA.
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

const SITE_URL = 'https://pythh.ai';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Investor {
  id: string;
  name: string;
  firm: string;
  title?: string;
  sectors?: string[] | string;
  stage?: string[] | string;
  check_size_min?: number;
  check_size_max?: number;
  investor_tier?: string;
  twitter_url?: string;
  linkedin_url?: string;
  photo_url?: string;
}

interface Match {
  match_score: number;
  why_you_match?: string;
  investor: Investor;
}

interface StartupData {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  website?: string;
  sectors?: string[] | string;
  stage?: string;
  god_score: number;
  score_components: {
    team: number;
    traction: number;
    market: number;
    product: number;
    vision: number;
  };
  percentile: number;
}

interface PreviewData {
  startup: StartupData;
  total_matches: number;
  matches: Match[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 55) return 'text-cyan-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-zinc-400';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 55) return 'bg-cyan-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-zinc-600';
}

function formatSectors(sectors: string[] | string | undefined): string[] {
  if (!sectors) return [];
  if (Array.isArray(sectors)) return sectors.slice(0, 3);
  if (typeof sectors === 'string') {
    try { return JSON.parse(sectors).slice(0, 3); } catch { return [sectors]; }
  }
  return [];
}

function formatCheckSize(min?: number, max?: number): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return '';
}

function buildXShareText(startup: StartupData, totalMatches: number, previewUrl: string): string {
  const tag = startup.name.replace(/\s+/g, '');
  const score = startup.god_score;
  const pct = startup.percentile;
  return encodeURIComponent(
    `🔥 @${tag} just got matched with ${totalMatches} investors on @pythhai\n\n` +
    `Pythh GOD Score: ${score}/100 (top ${100 - pct}%)\n\n` +
    `See their top investor matches 👇\n${previewUrl}\n\n` +
    `#startups #venturecapital #fundraising`
  );
}

function buildLinkedInShareUrl(previewUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(previewUrl)}`;
}

// ─── Investor Card ────────────────────────────────────────────────────────────

function InvestorCard({ match, rank, blurred }: { match: Match; rank: number; blurred?: boolean }) {
  const { investor, match_score } = match;
  const sectors = formatSectors(investor.sectors);
  const checkSize = formatCheckSize(investor.check_size_min, investor.check_size_max);
  const tierBadge = investor.investor_tier === 'tier_1' ? 'Tier 1' :
    investor.investor_tier === 'tier_2' ? 'Tier 2' : null;

  return (
    <div className={`relative rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-5 transition-all ${blurred ? 'blur-sm select-none pointer-events-none' : 'hover:border-zinc-600'}`}>
      {/* Rank badge */}
      <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-xs font-bold text-zinc-300">
        {rank}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {investor.photo_url ? (
            <img
              src={investor.photo_url}
              alt={investor.name}
              className="w-10 h-10 rounded-full object-cover border border-zinc-700 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-zinc-300">
              {(investor.firm || investor.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm truncate">{investor.firm || investor.name}</div>
            {investor.firm && investor.name && (
              <div className="text-xs text-zinc-400 truncate">{investor.name}{investor.title ? ` · ${investor.title}` : ''}</div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`text-lg font-bold ${scoreColor(match_score)}`}>{match_score}%</div>
          <div className="text-xs text-zinc-500">match</div>
        </div>
      </div>

      {/* Match score bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full mb-3">
        <div
          className={`h-1.5 rounded-full ${scoreBarColor(match_score)} transition-all`}
          style={{ width: `${match_score}%` }}
        />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {tierBadge && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {tierBadge}
          </span>
        )}
        {sectors.map(s => (
          <span key={s} className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
            {s}
          </span>
        ))}
        {checkSize && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {checkSize}
          </span>
        )}
      </div>

      {/* Why match snippet */}
      {match.why_you_match && !blurred && (
        <p className="mt-3 text-xs text-zinc-500 leading-relaxed line-clamp-2">
          "{match.why_you_match}"
        </p>
      )}
    </div>
  );
}

// ─── Score Component Bar ──────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className={scoreColor(value)}>{value}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-full">
        <div
          className={`h-1.5 rounded-full ${scoreBarColor(value)}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MatchPreviewPage() {
  const { startupId } = useParams<{ startupId: string }>();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) return;
    fetch(`${API_BASE}/api/preview/${startupId}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : 'error');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [startupId]);

  const previewUrl = `${SITE_URL}/matches/preview/${startupId}`;
  const signupUrl = `/signup?ref=preview&startup=${startupId}`;

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 text-sm">Loading investor matches…</p>
        </div>
      </div>
    );
  }

  // ── Error / Not Found ──
  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-semibold text-white mb-2">
            {error === 'not_found' ? 'Startup not found' : 'Something went wrong'}
          </h1>
          <p className="text-zinc-400 mb-6 text-sm">
            {error === 'not_found'
              ? 'This startup isn\'t in our database yet. Submit a URL to get matched.'
              : 'We couldn\'t load this page. Try again or submit a new startup.'}
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            Find your matches →
          </Link>
        </div>
      </div>
    );
  }

  const { startup, total_matches, matches } = data;
  const visibleMatches = matches.slice(0, 5);
  const blurredMatches = matches.slice(5, 10);
  const hiddenCount = Math.max(0, total_matches - 5);

  const xShareUrl = `https://twitter.com/intent/tweet?text=${buildXShareText(startup, total_matches, previewUrl)}`;
  const liShareUrl = buildLinkedInShareUrl(previewUrl);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* ── Top nav bar ── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              pythh
            </span>
            <span className="text-xs text-zinc-500 hidden sm:block">· AI investor matching</span>
          </Link>
          <Link
            to={signupUrl}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors"
          >
            Claim your matches
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* ── Startup header ── */}
        <div className="text-center space-y-4">
          {startup.website && (
            <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {startup.website.replace(/^https?:\/\//, '')}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {startup.name}
          </h1>
          {startup.tagline && (
            <p className="text-zinc-400 text-base max-w-xl mx-auto">{startup.tagline}</p>
          )}

          {/* GOD Score badge */}
          <div className="inline-flex items-center gap-4 bg-zinc-900 border border-zinc-700 rounded-2xl px-6 py-4 mt-2">
            <div className="text-center">
              <div className={`text-4xl font-bold ${scoreColor(startup.god_score)}`}>
                {startup.god_score}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">GOD Score</div>
            </div>
            <div className="w-px h-10 bg-zinc-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">Top {100 - startup.percentile}%</div>
              <div className="text-xs text-zinc-500 mt-0.5">of all startups</div>
            </div>
            <div className="w-px h-10 bg-zinc-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{total_matches.toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-0.5">investors matched</div>
            </div>
          </div>
        </div>

        {/* ── Score breakdown ── */}
        {startup.score_components && Object.values(startup.score_components).some(v => v > 0) && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Score Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ScoreBar label="Team" value={startup.score_components.team ?? 0} />
              <ScoreBar label="Traction" value={startup.score_components.traction ?? 0} />
              <ScoreBar label="Market" value={startup.score_components.market ?? 0} />
              <ScoreBar label="Product" value={startup.score_components.product ?? 0} />
              <ScoreBar label="Vision" value={startup.score_components.vision ?? 0} />
            </div>
          </div>
        )}

        {/* ── Matches section ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold">Top Investor Matches</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Showing 5 of {total_matches.toLocaleString()} matched investors
              </p>
            </div>
            <div className="text-xs text-zinc-500 hidden sm:block">Ranked by match score</div>
          </div>

          {/* Visible matches */}
          <div className="space-y-3">
            {visibleMatches.map((match, i) => (
              <InvestorCard key={match.investor.id} match={match} rank={i + 1} />
            ))}
          </div>

          {/* Blurred matches with overlay CTA */}
          {blurredMatches.length > 0 && (
            <div className="relative mt-3">
              <div className="space-y-3">
                {blurredMatches.map((match, i) => (
                  <InvestorCard key={match.investor.id} match={match} rank={i + 6} blurred />
                ))}
              </div>
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/70 to-zinc-950 rounded-xl" />
              {/* CTA overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <div className="bg-zinc-900/95 border border-zinc-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full">
                  <div className="text-2xl mb-2">🔓</div>
                  <h3 className="font-bold text-white text-lg mb-1">
                    +{hiddenCount.toLocaleString()} more investors
                  </h3>
                  <p className="text-zinc-400 text-sm mb-4">
                    Claim your free profile to see all your matches, investors' contact info, and intro templates.
                  </p>
                  <Link
                    to={signupUrl}
                    className="block w-full py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors text-center"
                  >
                    See all {total_matches.toLocaleString()} matches →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Share section ── */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-white mb-1">Share your matches</h2>
          <p className="text-zinc-400 text-sm mb-5">
            Let your network know you've been matched with {total_matches.toLocaleString()} investors
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={xShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on X
            </a>
            <a
              href={liShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600/20 border border-blue-600/30 text-sm font-medium text-blue-400 hover:bg-blue-600/30 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              Share on LinkedIn
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(previewUrl); }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy link
            </button>
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="text-center pb-8">
          <div className="inline-block bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 max-w-md w-full">
            <div className="text-3xl mb-3">🍯</div>
            <h2 className="text-xl font-bold mb-2">Raise from the right investors</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Pythh matched {startup.name} with {total_matches.toLocaleString()} investors using the GOD Algorithm.
              Claim your profile to unlock intro templates, investor contacts, and fundraising intelligence.
            </p>
            <Link
              to={signupUrl}
              className="block w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors"
            >
              Claim your free profile →
            </Link>
            <p className="text-xs text-zinc-600 mt-3">Free to start · No credit card required</p>
          </div>
        </div>

      </div>
    </div>
  );
}
