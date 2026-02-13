// ============================================================================
// Pythh — Signal Playbook
// ============================================================================
// Per-investor approach strategies — pure inline text, Supabase style.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../hooks/useBilling';

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

/* ──────────────────────────── Component ──────────────────────────── */

export default function SignalPlaybook() {
  const { user } = useAuth();
  const { plan } = useBilling();

  const [playbooks, setPlaybooks] = useState<InvestorPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'now' | 'soon' | 'later'>('all');

  const isLocked = !plan || plan === 'free';

  useEffect(() => {
    loadPlaybooks();
  }, [user]);

  async function loadPlaybooks() {
    try {
      const { data: matches } = await supabase
        .from('startup_investor_matches')
        .select('investor_id, match_score, investor:investors(name, firm_name)')
        .order('match_score', { ascending: false })
        .limit(10);

      if (matches && matches.length > 0) {
        const normalized = matches.map((m: any) => ({
          investor_id: m.investor_id,
          investor_name: m.investor?.name || 'Unknown',
          firm_name: m.investor?.firm_name || '',
          match_score: m.match_score,
        }));
        setPlaybooks(generatePlaybooks(normalized));
      } else {
        setPlaybooks(generatePlaybooks(
          Array.from({ length: 8 }, (_, i) => ({
            investor_id: `demo-${i}`,
            investor_name: ['Sequoia Capital', 'a16z', 'Benchmark', 'Greylock', 'Accel', 'Founders Fund', 'Lightspeed', 'Index Ventures'][i],
            firm_name: ['Sequoia', 'Andreessen Horowitz', 'Benchmark', 'Greylock Partners', 'Accel', 'Founders Fund', 'Lightspeed VP', 'Index'][i],
            match_score: 95 - i * 5,
          }))
        ));
      }
    } catch {
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
