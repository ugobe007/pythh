// ============================================================================
// Pythh — Signal Playbook
// ============================================================================
// Per-investor approach strategies — pure inline text, Supabase style.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../hooks/useBilling';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';
import { withErrorMonitoring } from '../../lib/dbErrorMonitor';

/* ──────────────────────────── Types ──────────────────────────── */

interface InvestorPlaybook {
  investor_id: string;
  investor_name: string;
  firm: string;
  match_score: number;
  alignment_grade: 'A' | 'B' | 'C' | 'D';
  timing: {
    readiness: 'now' | 'soon' | 'later';
    reason: string;
    window: string;
  };
  approach: {
    channel: string;
    opener: string;
    key_signals: string[];
    avoid: string[];
  };
  talking_points: string[];
  conviction_triggers: string[];
  deal_breakers: string[];
  warm_paths: string[];
}

/* ──────────────────────────── Mock data generator ──────────────────────────── */

function generatePlaybooks(matches: any[]): InvestorPlaybook[] {
  const channels = ['Cold email', 'Warm intro via portfolio founder', 'Conference / event', 'Twitter DM', 'LinkedIn'];
  const timings: Array<'now' | 'soon' | 'later'> = ['now', 'soon', 'later'];
  const grades: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'A', 'B', 'B', 'C'];

  return matches.slice(0, 10).map((m, i) => {
    const grade = grades[Math.min(i, grades.length - 1)];
    const timing = timings[Math.min(Math.floor(i / 3), 2)];

    return {
      investor_id: m.investor_id || `inv-${i}`,
      investor_name: m.investor_name || `Investor ${i + 1}`,
      firm: m.firm_name || m.investor_name || `Fund ${i + 1}`,
      match_score: m.match_score || (95 - i * 5),
      alignment_grade: grade,
      timing: {
        readiness: timing,
        reason: timing === 'now'
          ? 'Active deployment cycle — fund recently closed new round'
          : timing === 'soon'
            ? 'Currently evaluating sector — approach in 2-4 weeks'
            : 'Thesis shift likely next quarter — build relationship now',
        window: timing === 'now' ? '1-2 weeks' : timing === 'soon' ? '2-6 weeks' : '2-3 months',
      },
      approach: {
        channel: channels[i % channels.length],
        opener: `Lead with your ${['traction metrics', 'team background', 'market thesis', 'product differentiation', 'vision alignment'][i % 5]} — this is what resonates with their portfolio pattern.`,
        key_signals: [
          'Market momentum in your sector is trending up',
          `Their recent investment in ${['AI infrastructure', 'developer tools', 'fintech rails', 'health tech', 'climate'][i % 5]} signals thesis fit`,
          'Your growth metrics match their portfolio median at same stage',
        ],
        avoid: [
          "Don't lead with competitive positioning against their portfolio companies",
          'Avoid discussing valuation before establishing conviction',
        ],
      },
      talking_points: [
        `Reference their portfolio company ${['Stripe', 'Figma', 'Notion', 'Linear', 'Vercel'][i % 5]} — similar GTM motion`,
        'Lead with your "aha" metric — the one that proves PMF',
        'Frame the ask as partnership, not capital injection',
      ],
      conviction_triggers: [
        'Show month-over-month retention above 85%',
        'Reference named enterprise prospects in pipeline',
        'Demonstrate technical moat with specific architecture choices',
      ],
      deal_breakers: [
        'Red flag: cap table complexity from prior rounds',
        'Concern: burn rate relative to revenue trajectory',
      ],
      warm_paths: [
        `Mutual connection: ${['Alex Chen', 'Sarah Kim', 'James Liu'][i % 3]} at ${['Y Combinator', 'Techstars', 'First Round'][i % 3]}`,
        `Portfolio founder: speak to CEO of ${['Luma', 'Runway', 'Glean'][i % 3]}`,
      ],
    };
  });
}

/* ──────────────────────────── Signal Needs Types ──────────────────────────── */

interface EntityNeed {
  id: string;
  need_class: string;
  label: string | null;
  category: string | null;
  description: string | null;
  confidence: number | null;
  urgency: string | null;
  who_provides: string[] | null;
  signal_sources: string[] | null;
  trajectory_boost: boolean | null;
  evidence_count: number | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  capital:    '💰',
  gtm:        '🚀',
  product:    '🔧',
  buying:     '🛒',
  strategic:  '♟',
  talent:     '👥',
};

const CATEGORY_HOW_TO: Record<string, string> = {
  capital:   'Share ARR, MRR, or burn-rate milestones. Announce rounds closed. Publish traction metrics.',
  gtm:       'Announce partnerships, customer logos, and pipeline wins. Reference revenue growth in press.',
  product:   'Publish product launches, feature announcements, and technical blog posts.',
  buying:    'Publish case studies, enterprise customer wins, and procurement milestones.',
  strategic: 'Announce board additions, strategic partnerships, and market positioning moves.',
  talent:    'Post job openings, announce executive hires, and highlight team growth milestones.',
};

/* ──────────────────────────── Signal Needs Panel ──────────────────────────── */

function SignalNeedsPanel({ startupId }: { startupId: string | null }) {
  const [needs, setNeeds]         = useState<EntityNeed[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedNeed, setExpandedNeed] = useState<string | null>(null);

  React.useEffect(() => {
    if (!startupId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        // Resolve entity
        const { data: entities } = await supabase
          .from('pythh_entities')
          .select('id')
          .eq('startup_upload_id', startupId)
          .limit(1);

        const entityId = entities?.[0]?.id;
        if (!entityId || cancelled) { setLoading(false); return; }

        // Fetch needs ordered by urgency then confidence
        const { data } = await supabase
          .from('pythh_entity_needs')
          .select('id, need_class, label, category, description, confidence, urgency, who_provides, signal_sources, trajectory_boost, evidence_count')
          .eq('entity_id', entityId)
          .order('urgency', { ascending: false })
          .order('confidence', { ascending: false })
          .limit(6);

        if (!cancelled) setNeeds((data || []) as EntityNeed[]);
      } catch { /* non-blocking */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [startupId]);

  if (!loading && needs.length === 0) return null;

  return (
    <div className="mb-8 p-4 rounded-lg border border-zinc-800 bg-zinc-900/20">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
        <h3 className="text-[11px] uppercase tracking-[1.5px] text-zinc-400">Signal Gaps — What Investors Are Looking For</h3>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {needs.map(need => {
            const isOpen = expandedNeed === need.id;
            const icon = CATEGORY_ICONS[need.category ?? ''] ?? '◇';
            const howTo = CATEGORY_HOW_TO[need.category ?? ''] ?? 'Publish relevant milestones and announcements publicly.';
            const urgencyStyle =
              need.urgency === 'high'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : need.urgency === 'medium'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-zinc-700/30 text-zinc-500 border-zinc-700/40';

            return (
              <div
                key={need.id}
                className="border border-zinc-800/60 rounded-lg overflow-hidden cursor-pointer hover:border-zinc-700/60 transition-colors"
                onClick={() => setExpandedNeed(isOpen ? null : need.id)}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-base shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-zinc-200">
                        {need.label ?? need.need_class.replace(/_/g, ' ')}
                      </span>
                      {need.urgency && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${urgencyStyle}`}>
                          {need.urgency}
                        </span>
                      )}
                      {need.trajectory_boost && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          trajectory signal
                        </span>
                      )}
                    </div>
                    {!isOpen && need.description && (
                      <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{need.description}</p>
                    )}
                  </div>
                  {need.confidence != null && (
                    <span className="shrink-0 text-[10px] text-zinc-600 font-mono tabular-nums">
                      {Math.round(need.confidence * 100)}%
                    </span>
                  )}
                  <span className="shrink-0 text-zinc-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50 bg-zinc-900/30 space-y-2.5">
                    {need.description && (
                      <p className="text-xs text-zinc-400 leading-relaxed">{need.description}</p>
                    )}
                    <div className="rounded bg-cyan-950/30 border border-cyan-900/30 px-3 py-2">
                      <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">How to generate this signal</div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{howTo}</p>
                    </div>
                    {need.who_provides && need.who_provides.length > 0 && (
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Relevant investor types</div>
                        <div className="flex flex-wrap gap-1">
                          {need.who_provides.map(w => (
                            <span key={w} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                              {w.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {need.signal_sources && need.signal_sources.length > 0 && (
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1">Evidence from</div>
                        <div className="flex flex-wrap gap-1">
                          {need.signal_sources.map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── Component ──────────────────────────── */

export default function SignalPlaybook() {
  const { user } = useAuth();
  const { plan } = useBilling();
  const startupId = useOracleStartupId();

  const [playbooks, setPlaybooks] = useState<InvestorPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'now' | 'soon' | 'later'>('all');

  const isLocked = !plan || plan === 'free';

  useEffect(() => {
    loadPlaybooks();
  }, [user, startupId]);

  async function loadPlaybooks() {
    try {
      setLoading(true);
      
      // Use startupId from hook (URL param or localStorage) or fallback to user's startup
      let targetStartupId: string | null = startupId;
      
      if (!targetStartupId && user) {
        const { data: userStartup } = await supabase
          .from('startup_uploads')
          .select('id')
          .eq('created_by', user.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (userStartup) {
          targetStartupId = userStartup.id;
        }
      }

      // Fetch matches with full investor details
      let query = supabase
        .from('startup_investor_matches')
        .select(`
          investor_id,
          match_score,
          reasoning,
          why_you_match,
          fit_analysis,
          investors!inner(
            id,
            name,
            firm,
            sectors,
            stage,
            investment_thesis,
            notable_investments,
            portfolio_companies,
            check_size_min,
            check_size_max,
            last_investment_date,
            investment_pace_per_year,
            preferred_intro_method
          )
        `)
        .order('match_score', { ascending: false })
        .limit(10);

      if (targetStartupId) {
        query = query.eq('startup_id', targetStartupId);
      }

      const { data: matches, error } = await withErrorMonitoring(
        'SignalPlaybook',
        'fetch_matches',
        () => query,
        { startupId: targetStartupId }
      );

      if (error) {
        console.error('Failed to load playbooks:', error);
        throw error;
      }

      if (matches && matches.length > 0) {
        // Transform database data to playbook format
        const playbooks: InvestorPlaybook[] = matches.map((m: any, i: number) => {
          const investor = m.investors;
          const matchScore = Math.round(m.match_score || 0);
          
          // Determine alignment grade from match score
          const alignmentGrade: 'A' | 'B' | 'C' | 'D' = 
            matchScore >= 85 ? 'A' : 
            matchScore >= 70 ? 'B' : 
            matchScore >= 55 ? 'C' : 'D';

          // Determine timing based on last investment and pace
          const lastInvestment = investor.last_investment_date 
            ? new Date(investor.last_investment_date)
            : null;
          const daysSinceLastInvestment = lastInvestment
            ? Math.floor((Date.now() - lastInvestment.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          
          const investmentPace = investor.investment_pace_per_year || 12; // defaults to 12 per year
          const avgDaysBetweenInvestments = 365 / investmentPace;
          
          let timing: 'now' | 'soon' | 'later' = 'later';
          let timingReason = 'Building relationship for future opportunity';
          let timingWindow = '2-3 months';
          
          if (daysSinceLastInvestment !== null && daysSinceLastInvestment < avgDaysBetweenInvestments * 0.5) {
            timing = 'now';
            timingReason = 'Active deployment cycle — recent investments indicate active fund';
            timingWindow = '1-2 weeks';
          } else if (daysSinceLastInvestment !== null && daysSinceLastInvestment < avgDaysBetweenInvestments) {
            timing = 'soon';
            timingReason = 'Currently evaluating sector — approach in 2-4 weeks';
            timingWindow = '2-6 weeks';
          }

          // Extract key signals from reasoning or fit_analysis
          const reasoningText = m.reasoning || m.why_you_match || m.fit_analysis || '';
          const keySignals = reasoningText
            ? reasoningText.split(/[.!?]\s+/).filter(s => s.length > 20).slice(0, 3)
            : [
                'Strong alignment with portfolio companies',
                'Stage and sector match',
                'Geographic fit'
              ];

          // Get portfolio companies for talking points
          const portfolioCompanies = (investor.portfolio_companies || []).slice(0, 3);
          const talkingPoints = portfolioCompanies.length > 0
            ? [
                `Reference their portfolio company ${portfolioCompanies[0]} — similar GTM motion`,
                'Lead with your "aha" metric — the one that proves PMF',
                'Frame the ask as partnership, not capital injection'
              ]
            : [
                'Lead with your "aha" metric — the one that proves PMF',
                'Frame the ask as partnership, not capital injection',
                'Emphasize alignment with their investment thesis'
              ];

          // Get sectors for approach
          const sectors = investor.sectors || [];
          const primarySector = sectors[0] || 'your sector';
          
          return {
            investor_id: investor.id,
            investor_name: investor.name || 'Unknown',
            firm: investor.firm || 'Unknown Firm',
            match_score: matchScore,
            alignment_grade: alignmentGrade,
            timing: {
              readiness: timing,
              reason: timingReason,
              window: timingWindow
            },
            approach: {
              channel: investor.preferred_intro_method || 'Warm intro via portfolio founder',
              opener: `Lead with your traction metrics and ${primarySector} focus — this aligns with their portfolio pattern.`,
              key_signals: keySignals,
              avoid: [
                "Don't lead with competitive positioning against their portfolio companies",
                'Avoid discussing valuation before establishing conviction'
              ]
            },
            talking_points: talkingPoints,
            conviction_triggers: [
              'Show month-over-month retention above 85%',
              'Reference named enterprise prospects in pipeline',
              'Demonstrate technical moat with specific architecture choices'
            ],
            deal_breakers: [
              'Red flag: cap table complexity from prior rounds',
              'Concern: burn rate relative to revenue trajectory'
            ],
            warm_paths: portfolioCompanies.length > 0
              ? [
                  `Portfolio founder: speak to CEO of ${portfolioCompanies[0]}`,
                  portfolioCompanies[1] ? `Mutual connection: ${portfolioCompanies[1]} founder` : 'Warm intro via accelerator network'
                ]
              : [
                  'Warm intro via accelerator network',
                  'Mutual connection through advisor network'
                ]
          };
        });

        setPlaybooks(playbooks);
      } else {
        // Fallback to demo data if no matches
        setPlaybooks(generatePlaybooks(
          Array.from({ length: 8 }, (_, i) => ({
            investor_id: `demo-${i}`,
            investor_name: ['Sequoia Capital', 'a16z', 'Benchmark', 'Greylock', 'Accel', 'Founders Fund', 'Lightspeed', 'Index Ventures'][i],
            firm_name: ['Sequoia', 'Andreessen Horowitz', 'Benchmark', 'Greylock Partners', 'Accel', 'Founders Fund', 'Lightspeed VP', 'Index'][i],
            match_score: 95 - i * 5,
          }))
        ));
      }
    } catch (err) {
      console.error('Failed to load playbooks:', err);
      // Fallback to demo data on error
      setPlaybooks(generatePlaybooks(
        Array.from({ length: 5 }, (_, i) => ({
          investor_id: `demo-${i}`,
          investor_name: `Investor ${i + 1}`,
          match_score: 90 - i * 8,
        }))
      ));
    } finally {
      setLoading(false);
    }
  }

  const filtered = playbooks.filter(p =>
    filter === 'all' ? true : p.timing.readiness === filter
  );

  const timingColor = (t: string) =>
    t === 'now' ? 'text-emerald-400' : t === 'soon' ? 'text-amber-400' : 'text-zinc-500';

  const gradeColor = (g: string) =>
    g === 'A' ? 'text-emerald-400' : g === 'B' ? 'text-cyan-400' : g === 'C' ? 'text-amber-400' : 'text-zinc-500';

  const nowCount = playbooks.filter(p => p.timing.readiness === 'now').length;
  const soonCount = playbooks.filter(p => p.timing.readiness === 'soon').length;
  const aGradeCount = playbooks.filter(p => p.alignment_grade === 'A').length;

  return (
    <div>

        {/* Signal Needs Panel — real data from pythh_entity_needs */}
        <SignalNeedsPanel startupId={startupId} />

        {/* Intro */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-8">
          Each investor below has a unique <span className="text-cyan-400">signal profile</span> — a combination of timing,
          thesis alignment, and approach window. The playbook turns raw match data into a sequence:
          who to talk to, when to reach out, and what to say. Click any row to expand the full approach strategy.
        </p>

        {/* Stats line */}
        <div className="flex items-center gap-6 text-sm mb-6">
          <span className="text-zinc-500">{playbooks.length} investors tracked</span>
          <span className="text-zinc-700">·</span>
          <span className="text-emerald-400">{nowCount} ready now</span>
          <span className="text-zinc-700">·</span>
          <span className="text-amber-400">{soonCount} approach soon</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-400">{aGradeCount} A-grade fits</span>
        </div>

        {/* Filter line */}
        <div className="flex items-center gap-4 text-xs mb-6 border-b border-zinc-800/50 pb-3">
          {(['all', 'now', 'soon', 'later'] as const).map(f => (
            <span
              key={f}
              onClick={() => setFilter(f)}
              className={`cursor-pointer transition ${
                filter === f ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f === 'all' ? 'All' : f === 'now' ? 'Act now' : f === 'soon' ? 'Soon' : 'Build rel.'}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-zinc-500 py-12">Loading playbook data...</div>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_50px_60px_80px] gap-2 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
              <span>Investor / Firm</span>
              <span className="text-center">Timing</span>
              <span className="text-center">Grade</span>
              <span className="text-right">Match</span>
              <span className="text-right">Window</span>
            </div>

            {filtered.map((pb, idx) => {
              const isOpen = expanded === pb.investor_id;
              const isBlurred = isLocked && idx >= 5;

              return (
                <div key={pb.investor_id} className={isBlurred ? 'relative' : ''}>
                  {isBlurred && (
                    <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex items-center justify-center">
                      <span className="text-xs text-zinc-500">
                        <Link to="/pricing?source=playbook" className="text-cyan-400 hover:text-cyan-300">Upgrade</Link> to see full playbook
                      </span>
                    </div>
                  )}

                  <div
                    onClick={() => !isBlurred && setExpanded(isOpen ? null : pb.investor_id)}
                    className="grid grid-cols-[1fr_80px_50px_60px_80px] gap-2 px-2 py-3 items-center border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-900/40 transition text-sm"
                  >
                    <div>
                      <span className="text-cyan-400 font-medium">{pb.investor_name}</span>
                      <span className="text-zinc-600 ml-2 text-xs">{pb.firm !== pb.investor_name ? pb.firm : ''}</span>
                    </div>
                    <span className={`text-center text-xs ${timingColor(pb.timing.readiness)}`}>
                      {pb.timing.readiness === 'now' ? '⚡ Now' : pb.timing.readiness === 'soon' ? 'Soon' : 'Later'}
                    </span>
                    <span className={`text-center text-xs font-mono ${gradeColor(pb.alignment_grade)}`}>
                      {pb.alignment_grade}
                    </span>
                    <span className="text-right text-xs font-mono text-white">{pb.match_score}</span>
                    <span className="text-right text-xs text-zinc-500">{pb.timing.window}</span>
                  </div>

                  {isOpen && !isBlurred && (
                    <div className="px-2 py-4 border-b border-zinc-800/30 bg-zinc-900/20 space-y-4 text-sm">
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Timing</span>
                        <p className="text-zinc-400 mt-1">
                          <span className={timingColor(pb.timing.readiness)}>{pb.timing.window}</span>
                          <span className="text-zinc-600 mx-2">—</span>
                          {pb.timing.reason}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">How to approach</span>
                        <p className="text-zinc-400 mt-1">
                          <span className="text-cyan-400">{pb.approach.channel}</span>
                          <span className="text-zinc-600 mx-2">—</span>
                          {pb.approach.opener}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Signals to emphasize</span>
                        <div className="mt-1 space-y-1">
                          {pb.approach.key_signals.map((s, i) => (
                            <p key={i} className="text-zinc-400"><span className="text-emerald-400 mr-2">+</span>{s}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Talking points</span>
                        <div className="mt-1 space-y-1">
                          {pb.talking_points.map((tp, i) => (
                            <p key={i} className="text-zinc-400"><span className="text-cyan-400 mr-2">→</span>{tp}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Conviction triggers</span>
                        <div className="mt-1 space-y-1">
                          {pb.conviction_triggers.map((ct, i) => (
                            <p key={i} className="text-zinc-400"><span className="text-violet-400 mr-2">↑</span>{ct}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Watch out</span>
                        <div className="mt-1 space-y-1">
                          {pb.deal_breakers.map((db, i) => (
                            <p key={i} className="text-red-400/70"><span className="mr-2">!</span>{db}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Warm paths</span>
                        <div className="mt-1 space-y-1">
                          {pb.warm_paths.map((wp, i) => (
                            <p key={i} className="text-zinc-400"><span className="text-amber-400 mr-2">~</span>{wp}</p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Avoid</span>
                        <div className="mt-1 space-y-1">
                          {pb.approach.avoid.map((a, i) => (
                            <p key={i} className="text-zinc-500 italic">{a}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-zinc-600 mt-6 text-center">
          Playbook strategies generated from signal alignment data · Updated in real time
        </p>
    </div>
  );
}
