/**
 * Account hub — startup profile, saved matches, and pending intro opportunities.
 * Scout / Oracle is the paid hop to actually connect.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, ArrowRight, Bell, Target, Users } from 'lucide-react';
import { trackFunnelEvent } from '@/lib/matchEngagement';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { apiUrl } from '@/lib/apiConfig';
import {
  getPinnedStartupId,
  getPinnedStartupName,
  getPinnedStartupUrl,
  pinActiveStartup,
} from '@/lib/activeStartupContext';
import { matchesPathForUrl } from '@/lib/founderSignupGate';
import {
  listSectors,
  readStartupDescription,
  readStartupTeam,
  truncateWhy,
} from '@/lib/founderAccountProfile';
import { SCOUT_PLAN, ORACLE_PLAN } from '@/lib/pricingPlans';
import { G, GOLD, MUTED, TEXT, DIM, BORDER, CARD } from '@/lib/designTokens';

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

type PreviewStartup = {
  id?: string;
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  website?: string | null;
  sectors?: unknown;
  stage?: string | null;
  god_score?: number | null;
  score_components?: {
    team?: number | null;
    traction?: number | null;
    market?: number | null;
    product?: number | null;
    vision?: number | null;
  } | null;
  extracted_data?: Record<string, unknown> | null;
};

type SavedMatch = {
  match_score?: number;
  why_you_match?: string | null;
  investor?: { name?: string | null; firm?: string | null } | null;
};

type PreviewPayload = {
  startup?: PreviewStartup | null;
  matches?: SavedMatch[];
  total_matches?: number;
};

type Props = {
  userName?: string | null;
  welcome?: boolean;
  saved?: boolean;
  showUpgrade?: boolean;
};

function hostLabel(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || null;
  }
}

export default function FounderOnboardingHub({ userName, welcome, saved, showUpgrade = true }: Props) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [localPinned] = useState(() => ({
    id: getPinnedStartupId(),
    url: getPinnedStartupUrl(),
    name: getPinnedStartupName(),
  }));
  const pinned = {
    id: localPinned.id || profile?.startupId || preview?.startup?.id || null,
    url: localPinned.url || profile?.companyUrl || preview?.startup?.website || null,
    name: localPinned.name || profile?.companyName || preview?.startup?.name || null,
  };
  const hasPinnedStartup = Boolean(pinned.id);

  useEffect(() => {
    if (!localPinned.id && profile?.startupId) {
      pinActiveStartup(profile.startupId, profile.companyUrl || undefined, profile.companyName || undefined);
    }
  }, [localPinned.id, profile?.startupId, profile?.companyUrl, profile?.companyName]);

  useEffect(() => {
    const id = localPinned.id || profile?.startupId;
    if (!id) return;
    let cancelled = false;
    void fetch(apiUrl(`/api/preview/${id}?source=account_saved`))
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PreviewPayload | null) => {
        if (!cancelled && data) setPreview(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [localPinned.id, profile?.startupId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(true);
      return;
    }
    setError(false);
    sessionStorage.setItem('pythia_url', normalized);
    void trackFunnelEvent('url_submitted', {
      url: normalized,
      source: 'account_onboarding',
    });
    navigate(matchesPathForUrl(normalized));
  };

  const firstName = userName?.split(' ')[0];
  const startup = preview?.startup || null;
  const companyLabel = startup?.name || pinned.name || 'your startup';
  const description = readStartupDescription(startup);
  const team = readStartupTeam(startup?.extracted_data);
  const sectors = listSectors(startup?.sectors);
  const savedMatches = (preview?.matches || []).slice(0, 8);
  const pendingMatches = savedMatches.slice(0, 5);
  const godScore = typeof startup?.god_score === 'number' ? Math.round(startup.god_score) : null;
  const stage = String(startup?.stage || '').replace(/-/g, ' ').trim();
  const website = startup?.website || pinned.url;
  const siteHost = hostLabel(website);
  const previewPath = matchesPathForUrl(startup?.website);
  const findMatchesHref = previewPath !== '/matches'
    ? previewPath
    : pinned.id
      ? `/matches/preview/${encodeURIComponent(pinned.id)}`
      : '/matches';

  return (
    <div className="w-full space-y-8">
      {(welcome || saved) && (
        <div
          className="px-4 py-3 rounded-xl text-sm text-center"
          style={{
            backgroundColor: 'oklch(0.696 0.17 162.48 / 0.1)',
            border: '1px solid oklch(0.696 0.17 162.48 / 0.25)',
            color: 'oklch(0.85 0.05 162.48)',
          }}
        >
          {saved
            ? `These matches are saved to your account${firstName ? `, ${firstName}` : ''}. Review them here — we also emailed the ranked list.`
            : `Account created${firstName ? `, ${firstName}` : ''}${
                hasPinnedStartup
                  ? ` — ${companyLabel} is saved. Review the shortlist below.`
                  : ' — investor tracking is on. Paste your URL to load your shortlist.'
              }`}
        </div>
      )}

      {!hasPinnedStartup && (
        <>
          <div className="text-center mb-2">
            <h2 className="font-display font-bold text-2xl mb-2" style={{ color: TEXT }}>
              Track your investor matches
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
              Paste your startup URL to see ranked investors, then save the shortlist to this account.
            </p>
          </div>
          <form
            onSubmit={submit}
            className="rounded-xl p-5 border"
            style={{
              backgroundColor: 'oklch(0.14 0.01 264)',
              borderColor: error ? 'oklch(0.65 0.2 27 / 0.5)' : 'oklch(0.696 0.17 162.48 / 0.3)',
            }}
          >
            <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: 'oklch(0.45 0.01 264)' }}>
              YOUR STARTUP URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="yourstartup.com"
                className="flex-1 px-4 py-3 rounded-lg text-sm outline-none border"
                style={{
                  backgroundColor: 'oklch(0.11 0.01 264)',
                  borderColor: 'oklch(0.25 0.01 264)',
                  color: 'oklch(0.94 0.005 264)',
                }}
                autoFocus
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold shrink-0"
                style={{ backgroundColor: G, color: 'oklch(0.13 0.01 264)' }}
              >
                Find matches
                <ArrowRight size={15} />
              </button>
            </div>
            {error && (
              <p className="text-xs mt-2" style={{ color: 'oklch(0.65 0.2 27)' }}>
                Enter a valid startup URL.
              </p>
            )}
          </form>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { icon: Target, label: 'Ranked shortlist', detail: 'Thesis-fit investors with scores' },
              { icon: Bell, label: 'Movement alerts', detail: 'Watch when matches shift' },
              { icon: Activity, label: 'Intro pipeline', detail: 'Connect after Scout or Oracle' },
            ].map(({ icon: Icon, label, detail }) => (
              <div
                key={label}
                className="p-3 rounded-lg border text-left"
                style={{ backgroundColor: 'oklch(0.12 0.01 264)', borderColor: 'oklch(0.2 0.01 264)' }}
              >
                <Icon size={14} className="mb-1.5" style={{ color: G }} />
                <p className="text-xs font-semibold" style={{ color: TEXT }}>{label}</p>
                <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: DIM }}>{detail}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {hasPinnedStartup && (
        <>
          <section className="rounded-xl border p-5" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <p className="text-[10px] uppercase tracking-[1.5px] mb-3" style={{ color: G }}>Startup profile</p>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="font-display font-bold text-2xl" style={{ color: TEXT }}>{companyLabel}</h2>
                {siteHost && website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                    style={{ color: MUTED }}
                  >
                    {siteHost}
                  </a>
                )}
              </div>
              {godScore != null && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: DIM }}>GOD</p>
                  <p className="font-mono text-xl" style={{ color: G }}>{godScore}</p>
                </div>
              )}
            </div>
            {description && (
              <p className="text-sm leading-relaxed mb-4" style={{ color: MUTED }}>{description}</p>
            )}
            <div className="flex flex-wrap gap-2 mb-4">
              {stage && (
                <span className="text-[11px] px-2 py-1 rounded-md border" style={{ borderColor: BORDER, color: TEXT }}>
                  {stage}
                </span>
              )}
              {sectors.map((sector) => (
                <span key={sector} className="text-[11px] px-2 py-1 rounded-md border" style={{ borderColor: BORDER, color: DIM }}>
                  {sector}
                </span>
              ))}
            </div>
            {startup?.score_components && (
              <div className="grid grid-cols-5 gap-2 mb-5">
                {([
                  ['Team', startup.score_components.team],
                  ['Traction', startup.score_components.traction],
                  ['Market', startup.score_components.market],
                  ['Product', startup.score_components.product],
                  ['Vision', startup.score_components.vision],
                ] as const).map(([label, value]) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px]" style={{ color: DIM }}>{label}</p>
                    <p className="text-xs font-mono" style={{ color: TEXT }}>
                      {typeof value === 'number' ? Math.round(value) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} style={{ color: G }} />
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>Team</p>
              </div>
              {team.length ? (
                <ul className="space-y-2">
                  {team.map((member) => (
                    <li key={member.name} className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm" style={{ color: TEXT }}>{member.name}</p>
                        {member.role && <p className="text-[11px]" style={{ color: DIM }}>{member.role}</p>}
                      </div>
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] underline shrink-0"
                          style={{ color: MUTED }}
                        >
                          LinkedIn
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: DIM }}>
                  Team names appear here when the scan has founders on file. We do not invent them.
                </p>
              )}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <h3 className="font-display font-bold text-lg" style={{ color: TEXT }}>
                Your saved matches — {companyLabel}
              </h3>
              <Link
                href={findMatchesHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: G }}
              >
                Find matches
                <ArrowRight size={14} />
              </Link>
            </div>
            <p className="text-sm mb-4" style={{ color: MUTED }}>
              {savedMatches.length
                ? 'These investors stay on your account. Intros below are pending until Scout or Oracle is on.'
                : 'Matches will land here once the shortlist finishes loading.'}
            </p>
            {savedMatches.length > 0 && (
              <ol className="divide-y rounded-xl border" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                {savedMatches.map((match, index) => {
                  const name = match.investor?.name || match.investor?.firm || `Match ${index + 1}`;
                  const firm = match.investor?.firm && match.investor.firm !== name ? match.investor.firm : null;
                  const score = typeof match.match_score === 'number' ? Math.round(match.match_score) : null;
                  const why = truncateWhy(match.why_you_match);
                  return (
                    <li key={`${name}-${index}`} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: TEXT }}>
                            {index + 1}. {name}
                          </p>
                          {firm && <p className="text-[11px]" style={{ color: DIM }}>{firm}</p>}
                          {why && <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{why}</p>}
                        </div>
                        {score != null && (
                          <span className="text-xs font-mono shrink-0" style={{ color: G }}>{score}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}

      {showUpgrade && (
        <section className="rounded-xl border p-5" style={{ borderColor: 'oklch(0.769 0.188 70.08 / 0.28)', backgroundColor: CARD }}>
          <p className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: GOLD }}>Pending opportunities</p>
          <h3 className="font-display font-bold text-lg mb-2" style={{ color: TEXT }}>
            {pendingMatches.length
              ? `${pendingMatches.length} investor${pendingMatches.length === 1 ? '' : 's'} ready to connect`
              : 'Connect these matches when you are ready'}
          </h3>
          <p className="text-sm leading-relaxed mb-4" style={{ color: MUTED }}>
            Intros stay pending until a raise plan is on. Scout runs three campaigns. Oracle runs ten in parallel with meeting prep.
          </p>
          {pendingMatches.length > 0 && (
            <ul className="mb-5 space-y-1.5">
              {pendingMatches.map((match, index) => {
                const name = match.investor?.name || match.investor?.firm || `Match ${index + 1}`;
                return (
                  <li key={`pending-${name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <span style={{ color: TEXT }}>{name}</span>
                    <span className="text-[11px] shrink-0" style={{ color: GOLD }}>Intro pending</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href={`/pricing?plan=scout&source=account_connect`}>
              <div
                className="rounded-xl border p-4 h-full"
                style={{ borderColor: 'oklch(0.696 0.17 162.48 / 0.35)', backgroundColor: 'oklch(0.14 0.02 162)' }}
              >
                <p className="text-sm font-semibold" style={{ color: TEXT }}>{SCOUT_PLAN.name} · ${SCOUT_PLAN.monthlyPrice}/mo</p>
                <p className="text-xs mt-1 mb-3" style={{ color: MUTED }}>{SCOUT_PLAN.headline}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: G }}>
                  Start Scout
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
            <Link href={`/pricing?plan=oracle&source=account_connect`}>
              <div
                className="rounded-xl border p-4 h-full"
                style={{ borderColor: 'oklch(0.769 0.188 70.08 / 0.4)', backgroundColor: 'oklch(0.16 0.03 70)' }}
              >
                <p className="text-sm font-semibold" style={{ color: TEXT }}>{ORACLE_PLAN.name} · ${ORACLE_PLAN.monthlyPrice}/mo</p>
                <p className="text-xs mt-1 mb-3" style={{ color: MUTED }}>{ORACLE_PLAN.headline}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: GOLD }}>
                  Upgrade to Oracle
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
