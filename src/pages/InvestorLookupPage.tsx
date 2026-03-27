/**
 * /lookup — TOP 10 INVESTORS BY INDUSTRY (Founder teaser)
 *
 * Founders can generate Top 10 "most active" investors for one selected industry.
 * Free users: 2 industry queries per browser session. Then signup gate.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { trackEvent } from '../lib/analytics';

const SESSION_QUERY_KEY = 'pythh_top10_industry_queries_v1';
const FREE_QUERY_LIMIT = 2;
const LOOKUP_AB_VARIANT_KEY = 'pythh_lookup_ab_variant_v1';
const LOOKUP_SIGNUP_CLICK_KEY = 'pythh_lookup_signup_clicked_v1';
const LOOKUP_SAVED_KEY = 'pythh_lookup_saved_investors_v1';
const LOOKUP_PIPELINE_KEY = 'pythh_lookup_pipeline_v1';
const LOOKUP_FEEDBACK_KEY = 'pythh_lookup_feedback_v1';

const INDUSTRIES = [
  'AI/ML',
  'Fintech',
  'HealthTech',
  'Robotics',
  'SpaceTech',
  'DeepTech',
  'Defense',
  'Developer Tools',
  'SaaS',
  'Cybersecurity',
] as const;

const STAGES = ['Any', 'Pre-Seed', 'Seed', 'Series A', 'Series B+'] as const;
const PIPELINE_STATES = ['Target', 'Contacted', 'Replied', 'Meeting'] as const;

type InvestorRow = {
  id: string;
  name: string;
  firm: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  investor_score: number | null;
  investment_pace_per_year: number | null;
  total_investments: number | null;
  linkedin_url: string | null;
  investment_thesis: string | null;
  updated_at?: string | null;
};

type PipelineState = (typeof PIPELINE_STATES)[number];
type PipelineEntry = {
  state: PipelineState;
  note: string;
  reminderAt: string | null;
};

function getSessionQueryCount(): number {
  try {
    return Number(localStorage.getItem(SESSION_QUERY_KEY) || '0');
  } catch {
    return 0;
  }
}

function incrementSessionQueryCount(): number {
  const next = getSessionQueryCount() + 1;
  try {
    localStorage.setItem(SESSION_QUERY_KEY, String(next));
  } catch {}
  return next;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getAbVariant(): 'A' | 'B' {
  try {
    const existing = localStorage.getItem(LOOKUP_AB_VARIANT_KEY);
    if (existing === 'A' || existing === 'B') return existing;
    const assigned = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(LOOKUP_AB_VARIANT_KEY, assigned);
    return assigned;
  } catch {
    return 'A';
  }
}

const LOOKUP_QUERY_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Try again or pick another industry.`));
    }, ms);
    promise
      .then((v) => {
        window.clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(id);
        reject(e);
      });
  });
}

function freshnessLabel(updatedAt?: string | null): { label: string; stale: boolean } {
  if (!updatedAt) return { label: 'Unknown freshness', stale: true };
  const updatedTs = Date.parse(updatedAt);
  if (Number.isNaN(updatedTs)) return { label: 'Unknown freshness', stale: true };
  const ageDays = Math.floor((Date.now() - updatedTs) / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) return { label: 'Updated this week', stale: false };
  if (ageDays <= 30) return { label: `${ageDays} days old`, stale: false };
  return { label: `${ageDays} days old`, stale: true };
}

export default function InvestorLookupPage() {
  const { isLoggedIn, user } = useAuth();
  const [selectedIndustry, setSelectedIndustry] = useState<string>('SpaceTech');
  const [selectedStage, setSelectedStage] = useState<string>('Any');
  const [results, setResults] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sessionQueriesUsed, setSessionQueriesUsed] = useState<number>(() => getSessionQueryCount());
  const [savedIds, setSavedIds] = useState<Record<string, true>>(() => readJson(LOOKUP_SAVED_KEY, {}));
  const [pipeline, setPipeline] = useState<Record<string, PipelineEntry>>(() => readJson(LOOKUP_PIPELINE_KEY, {}));
  const [feedback, setFeedback] = useState<Record<string, 'useful' | 'not_useful'>>(() => readJson(LOOKUP_FEEDBACK_KEY, {}));
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [reminderDraft, setReminderDraft] = useState<Record<string, string>>({});
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null);
  const [abVariant] = useState<'A' | 'B'>(() => getAbVariant());

  const queriesRemaining = Math.max(0, FREE_QUERY_LIMIT - sessionQueriesUsed);
  const isBlocked = !isLoggedIn && sessionQueriesUsed >= FREE_QUERY_LIMIT;

  useEffect(() => {
    if (isLoggedIn && localStorage.getItem(LOOKUP_SIGNUP_CLICK_KEY) === '1') {
      trackEvent('lookup_signup_completed', { surface: 'lookup' });
      localStorage.removeItem(LOOKUP_SIGNUP_CLICK_KEY);
    }
  }, [isLoggedIn]);

  const ctaCopy = useMemo(() => {
    if (abVariant === 'A') {
      return {
        gate: 'Sign up to unlock unlimited industries, deeper matching, and outreach timing playbooks.',
        footer: 'Sign up to unlock the full Pythh engine.',
      };
    }
    return {
      gate: 'Create your account to unlock full investor targeting, outreach templates, and match timing intelligence.',
      footer: 'Create your account to move from teaser lists to investor-ready execution.',
    };
  }, [abVariant]);

  function setPipelineEntry(id: string, patch: Partial<PipelineEntry>) {
    const next: Record<string, PipelineEntry> = {
      ...pipeline,
      [id]: {
        state: pipeline[id]?.state || 'Target',
        note: pipeline[id]?.note || '',
        reminderAt: pipeline[id]?.reminderAt || null,
        ...patch,
      },
    };
    setPipeline(next);
    writeJson(LOOKUP_PIPELINE_KEY, next);
    if (isLoggedIn && user?.id) {
      const entry = next[id];
      void supabase.from('founder_investor_pipeline').upsert({
        user_id: user.id,
        investor_id: id,
        state: entry.state,
        note: entry.note || null,
        reminder_at: entry.reminderAt || null,
        updated_at: new Date().toISOString(),
      });
    }
  }

  function saveInvestor(id: string) {
    const next = { ...savedIds, [id]: true as const };
    setSavedIds(next);
    writeJson(LOOKUP_SAVED_KEY, next);
    trackEvent('lookup_save_list_clicked', { investor_id: id, industry: selectedIndustry });
  }

  async function startOutreach(row: InvestorRow) {
    const emailTemplate = `Subject: ${row.name} x ${selectedIndustry} fit\n\nHi ${row.name},\n\nI am a founder building in ${selectedIndustry}. Based on your investment activity and thesis, I think there may be a strong fit.\n\nWould you be open to a quick intro call next week?\n\nBest,\n[Your Name]`;
    try {
      await navigator.clipboard.writeText(emailTemplate);
      setOutreachMessage(`Copied outreach template for ${row.name}.`);
    } catch {
      setOutreachMessage(`Outreach template ready for ${row.name}.`);
    }
    trackEvent('lookup_first_outreach_started', {
      investor_id: row.id,
      industry: selectedIndustry,
      channel: 'email_template',
    });
  }

  function submitFeedback(id: string, value: 'useful' | 'not_useful') {
    const next = { ...feedback, [id]: value };
    setFeedback(next);
    writeJson(LOOKUP_FEEDBACK_KEY, next);
    trackEvent('lookup_feedback_submitted', { investor_id: id, value });
    if (isLoggedIn && user?.id) {
      void supabase.from('founder_investor_feedback').upsert({
        user_id: user.id,
        investor_id: id,
        feedback: value,
        context_sector: selectedIndustry,
      });
    }
  }

  function getReasons(row: InvestorRow): string[] {
    const reasons: string[] = [];
    if ((row.sectors || []).includes(selectedIndustry)) reasons.push('Sector fit');
    if (selectedStage !== 'Any' && (row.stage || []).some((s) => s.toLowerCase().includes(selectedStage.toLowerCase())))
      reasons.push('Stage fit');
    if (row.investment_pace_per_year != null && row.investment_pace_per_year >= 5) reasons.push('High activity recency');
    if (row.investment_thesis?.toLowerCase().includes(selectedIndustry.toLowerCase())) reasons.push('Thesis overlap');
    if (reasons.length === 0) reasons.push('General activity signal');
    return reasons.slice(0, 3);
  }

  function getWhyNow(row: InvestorRow): string {
    if (row.investment_pace_per_year != null && row.investment_pace_per_year >= 8) return 'Why now: currently deploying fast.';
    if (row.total_investments != null && row.total_investments >= 50) return 'Why now: high historical deployment volume.';
    return 'Why now: active profile with current signal strength.';
  }

  async function generateTop10() {
    if (!selectedIndustry) return;
    if (!isLoggedIn && isBlocked) return;

    setLoading(true);
    setSearchError(null);
    try {
      let data: InvestorRow[] | null = null;

      const rpcPromise = supabase.rpc('get_lookup_top_investors', {
        p_sector: selectedIndustry,
        p_limit: 10,
      });

      const rpcResult = await withTimeout(Promise.resolve(rpcPromise), LOOKUP_QUERY_MS, 'Investor lookup');

      const rpcRows = rpcResult.data;
      const rpcOk =
        !rpcResult.error &&
        Array.isArray(rpcRows) &&
        rpcRows.length > 0;

      if (rpcOk) {
        data = rpcRows as InvestorRow[];
      } else {
        // RPC missing in DB, error, OR success with [] (sector tag mismatch) — use PostgREST overlap.
        const fallback = await withTimeout(
          supabase
            .from('investors')
            .select(
              'id, name, firm, sectors, stage, investor_score, investment_pace_per_year, total_investments, linkedin_url, investment_thesis, updated_at'
            )
            .overlaps('sectors', [selectedIndustry])
            .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
            .limit(10),
          LOOKUP_QUERY_MS,
          'Investor lookup (fallback)'
        );
        if (fallback.error) throw fallback.error;
        let rows = (fallback.data || []) as InvestorRow[];
        // Still empty: loose ilike on thesis/name/firm (sector tags in DB often != UI chip strings).
        if (rows.length === 0) {
          const safe = selectedIndustry.replace(/[%_]/g, '').trim();
          if (safe.length >= 2) {
            try {
              const loose = await withTimeout(
                supabase
                  .from('investors')
                  .select(
                    'id, name, firm, sectors, stage, investor_score, investment_pace_per_year, total_investments, linkedin_url, investment_thesis, updated_at'
                  )
                  .or(
                    `investment_thesis.ilike.%${safe}%,name.ilike.%${safe}%,firm.ilike.%${safe}%`
                  )
                  .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
                  .limit(10),
                LOOKUP_QUERY_MS,
                'Investor lookup (loose)'
              );
              if (!loose.error && loose.data?.length) {
                rows = loose.data as InvestorRow[];
              }
            } catch (e) {
              console.warn('[lookup] loose investor search skipped:', e);
            }
          }
        }
        data = rows;
      }

      const rows = ((data || []) as InvestorRow[]).map((r) => {
        const boost = feedback[r.id] === 'useful' ? 0.25 : feedback[r.id] === 'not_useful' ? -0.25 : 0;
        return {
          ...r,
          investor_score: r.investor_score != null ? r.investor_score + boost : r.investor_score,
        };
      });
      setResults(rows);
      trackEvent('lookup_top10_generated', {
        industry: selectedIndustry,
        stage: selectedStage,
        result_count: rows.length,
      });

      if (!isLoggedIn) {
        const used = incrementSessionQueryCount();
        setSessionQueriesUsed(used);
      }
    } catch (e) {
      setResults([]);
      setSearchError(e instanceof Error ? e.message : 'Could not generate list');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function hydrateLoggedInWorkflow() {
      if (!isLoggedIn || !user?.id) return;
      const [pipelineRes, feedbackRes] = await Promise.all([
        supabase
          .from('founder_investor_pipeline')
          .select('investor_id,state,note,reminder_at')
          .eq('user_id', user.id),
        supabase
          .from('founder_investor_feedback')
          .select('investor_id,feedback')
          .eq('user_id', user.id),
      ]);
      if (!pipelineRes.error && pipelineRes.data) {
        const mapped: Record<string, PipelineEntry> = {};
        for (const row of pipelineRes.data) {
          mapped[row.investor_id] = {
            state: (row.state as PipelineState) || 'Target',
            note: row.note || '',
            reminderAt: row.reminder_at ? String(row.reminder_at).slice(0, 10) : null,
          };
        }
        setPipeline(mapped);
      }
      if (!feedbackRes.error && feedbackRes.data) {
        const mapped: Record<string, 'useful' | 'not_useful'> = {};
        for (const row of feedbackRes.data) {
          if (row.feedback === 'useful' || row.feedback === 'not_useful') mapped[row.investor_id] = row.feedback;
        }
        setFeedback(mapped);
      }
    }
    void hydrateLoggedInWorkflow();
  }, [isLoggedIn, user?.id]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <PythhUnifiedNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            founder investor lookup
          </div>
          <h1 className="text-[32px] font-semibold leading-tight mb-2">
            <span className="text-white">Top 10 investors by industry. </span>
            <span className="text-cyan-400" style={{ textShadow: '0 0 30px rgba(34,211,238,0.3)' }}>
              Instant.
            </span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-3xl">
            Pick your industry and we will generate a straightforward Top 10 list of the most active investors.
            This is a teaser list, not personalized matching.
          </p>
        </div>

        <div className="mb-6 p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Choose industry</div>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((industry) => (
              <button
                key={industry}
                onClick={() => {
                  setSelectedIndustry(industry);
                  trackEvent('lookup_industry_selected', { industry });
                }}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  selectedIndustry === industry
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {industry}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <button
              onClick={generateTop10}
              disabled={loading || (!isLoggedIn && isBlocked)}
              className="px-4 py-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : `Generate Top 10 — ${selectedIndustry}`}
            </button>
            {!isLoggedIn && (
              <span className="text-xs text-zinc-500">
                Free queries this session: <span className="text-zinc-300">{queriesRemaining}</span> / {FREE_QUERY_LIMIT}
              </span>
            )}
            {isLoggedIn && (
              <span className="text-xs text-emerald-400/80">Signed in: unlimited lookups</span>
            )}
          </div>
        </div>

        {!isLoggedIn && isBlocked && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            You used your 2 free Top 10 queries for this session.
            <Link
              to="/signup"
              className="ml-1 text-amber-200 underline hover:text-white"
              onClick={() => {
                localStorage.setItem(LOOKUP_SIGNUP_CLICK_KEY, '1');
                trackEvent('lookup_signup_cta_clicked', { variant: abVariant, placement: 'block_gate' });
              }}
            >
              {ctaCopy.gate}
            </Link>
          </div>
        )}
        {outreachMessage && (
          <div className="mb-4 px-4 py-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            {outreachMessage}
          </div>
        )}

        {searchError && (
          <div className="mb-4 px-4 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {searchError}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-zinc-500">
            {results.length > 0
              ? `Top 10 most active investors in ${selectedIndustry}`
              : 'Generate a list to begin'}
          </span>
        </div>

        <div
          className="bg-zinc-900/30 rounded-lg border border-cyan-800/20 overflow-hidden"
          style={{ boxShadow: '0 0 15px rgba(34,211,238,0.05)' }}
        >
          <div className="grid grid-cols-[40px_1fr_120px_100px_80px_140px_180px] gap-3 px-4 py-3 border-b border-zinc-800/60 text-[10px] font-medium uppercase tracking-wider text-white/40">
            <div>#</div>
            <div>Investor</div>
            <div>Firm</div>
            <div>Activity</div>
            <div className="text-cyan-400">Score</div>
            <div>Freshness</div>
            <div className="text-right">Action</div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Generating Top 10...</div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500 text-sm">
                No list generated yet.
              </div>
            ) : (
              results.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[40px_1fr_120px_100px_80px_140px_180px] gap-3 px-4 py-3 border-b border-zinc-800/30 hover:bg-zinc-800/20 items-center"
                >
                  <div className="text-sm text-zinc-600">{idx + 1}</div>
                  <div className="min-w-0">
                    <Link to={`/investor/${row.id}`} className="text-sm text-white truncate block hover:text-cyan-400">
                      {row.name || '—'}
                    </Link>
                    {row.investment_thesis && (
                      <div className="text-[11px] text-zinc-600 truncate">{row.investment_thesis}</div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {getReasons(row).map((r) => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {r}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">{getWhyNow(row)}</div>
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{row.firm || '—'}</div>
                  <div className="text-xs text-zinc-500">
                    {row.investment_pace_per_year != null
                      ? `${row.investment_pace_per_year}/yr`
                      : row.total_investments != null
                        ? `${row.total_investments} total`
                        : 'active'}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-cyan-400">
                    {typeof row.investor_score === 'number' ? row.investor_score.toFixed(1) : '—'}
                  </div>
                  <div className="text-xs">
                    {(() => {
                      const f = freshnessLabel(row.updated_at);
                      return (
                        <span className={f.stale ? 'text-amber-300' : 'text-zinc-400'}>
                          {f.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/investor/${row.id}`}
                      className="px-2 py-1 rounded text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    >
                      View
                    </Link>
                    {row.linkedin_url && (
                      <a
                        href={row.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25"
                      >
                        LinkedIn
                      </a>
                    )}
                    <button
                      onClick={() => saveInvestor(row.id)}
                      className="px-2 py-1 rounded text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                    >
                      {savedIds[row.id] ? 'Saved' : 'Save'}
                    </button>
                    <button
                      onClick={() => startOutreach(row)}
                      className="px-2 py-1 rounded text-xs bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25"
                    >
                      Outreach
                    </button>
                  </div>
                  <div className="col-span-7 mt-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      value={pipeline[row.id]?.state || 'Target'}
                      onChange={(e) => setPipelineEntry(row.id, { state: e.target.value as PipelineState })}
                      className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
                    >
                      {PIPELINE_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                    <input
                      value={noteDraft[row.id] ?? pipeline[row.id]?.note ?? ''}
                      onChange={(e) => setNoteDraft((p) => ({ ...p, [row.id]: e.target.value }))}
                      placeholder="Notes"
                      className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
                    />
                    <input
                      type="date"
                      value={reminderDraft[row.id] ?? pipeline[row.id]?.reminderAt ?? ''}
                      onChange={(e) => setReminderDraft((p) => ({ ...p, [row.id]: e.target.value }))}
                      className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs"
                    />
                    <button
                      onClick={() =>
                        setPipelineEntry(row.id, {
                          note: noteDraft[row.id] ?? pipeline[row.id]?.note ?? '',
                          reminderAt: reminderDraft[row.id] ?? pipeline[row.id]?.reminderAt ?? null,
                        })
                      }
                      className="px-2 py-1.5 rounded text-xs bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    >
                      Save pipeline
                    </button>
                  </div>
                  <div className="col-span-7 mt-1 flex gap-2">
                    <button
                      onClick={() => submitFeedback(row.id, 'useful')}
                      className={`px-2 py-1 rounded text-xs border ${
                        feedback[row.id] === 'useful'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      Useful
                    </button>
                    <button
                      onClick={() => submitFeedback(row.id, 'not_useful')}
                      className={`px-2 py-1 rounded text-xs border ${
                        feedback[row.id] === 'not_useful'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      Not useful
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 p-4 rounded-lg border border-zinc-800 bg-zinc-900/20">
          <p className="text-sm text-zinc-400">
            Want personalized investor matching, more than Top 10, and timing + outreach guidance?
            <Link
              to="/signup"
              className="ml-1 text-cyan-400 hover:text-cyan-300 underline"
              onClick={() => {
                localStorage.setItem(LOOKUP_SIGNUP_CLICK_KEY, '1');
                trackEvent('lookup_signup_cta_clicked', { variant: abVariant, placement: 'footer' });
              }}
            >
              {ctaCopy.footer}
            </Link>
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            Unlocks include: unlimited Top10 generations, personalized ranking reasons, pipeline tracking, and outreach timing guidance.
          </p>
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-4 border-t border-zinc-800/30 mt-8">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>pythh.ai — founder investor lookup</span>
        </div>
      </footer>
    </div>
  );
}
