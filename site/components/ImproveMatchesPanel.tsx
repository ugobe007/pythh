import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { trackFunnelEvent } from '@/lib/matchEngagement';

type FounderInput = { name: string; linkedin_url: string };

type ImproveProfile = {
  founders: FounderInput[];
  company_linkedin: string;
  funding_raised: number | '';
  target_raise: number | '';
  funding_stage: string;
  team_size: number | '';
  customer_count: number | '';
  mrr: number | '';
  description: string;
  has_technical_cofounder: boolean | null;
  deck_filename: string | null;
};

type ImprovePayload = {
  startup_name: string;
  completeness?: {
    percentage?: number;
    missing?: Array<{ field: string; label: string; weight: number }>;
  };
  profile: ImproveProfile;
};

type Props = {
  startupId: string;
  startupUrl: string;
  currentGodScore?: number;
  onClose: () => void;
};

const EMPTY_PROFILE: ImproveProfile = {
  founders: [{ name: '', linkedin_url: '' }],
  company_linkedin: '',
  funding_raised: '',
  target_raise: '',
  funding_stage: '',
  team_size: '',
  customer_count: '',
  mrr: '',
  description: '',
  has_technical_cofounder: null,
  deck_filename: null,
};

function NumberField({
  label,
  value,
  onChange,
  prefix,
  hint,
}: {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  prefix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-300 mb-2">{label}</span>
      <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 focus-within:border-emerald-500/60">
        {prefix && <span className="pl-3 text-sm text-zinc-500">{prefix}</span>}
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none"
        />
      </div>
      {hint && <span className="block text-[10px] text-zinc-500 mt-1.5">{hint}</span>}
    </label>
  );
}

export default function ImproveMatchesPanel({
  startupId,
  startupUrl,
  currentGodScore,
  onClose,
}: Props) {
  const [payload, setPayload] = useState<ImprovePayload | null>(null);
  const [profile, setProfile] = useState<ImproveProfile>(EMPTY_PROFILE);
  const [deck, setDeck] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ godScore?: number; matchCount?: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/instant/improve?startup_id=${encodeURIComponent(startupId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load missing data');
        if (cancelled) return;
        const next = data as ImprovePayload;
        setPayload(next);
        setProfile({
          ...EMPTY_PROFILE,
          ...next.profile,
          founders: next.profile.founders?.length
            ? next.profile.founders
            : [{ name: '', linkedin_url: '' }],
        });
        void trackFunnelEvent('improve_matches_viewed', {
          startup_id: startupId,
          completeness: next.completeness?.percentage,
          missing_count: next.completeness?.missing?.length ?? 0,
        });
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load missing data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startupId]);

  const missing = useMemo(
    () => new Set((payload?.completeness?.missing || []).map((item) => item.field)),
    [payload],
  );
  const needsFounders = missing.has('founders') || profile.founders.some((founder) => !founder.linkedin_url);
  const needsDescription = missing.has('description') || !profile.description;
  const needsFunding = profile.funding_raised === '';
  const needsTeamSize = profile.team_size === '';
  const needsCustomers = profile.customer_count === '';
  const needsMrr = profile.mrr === '';

  const updateFounder = (index: number, field: keyof FounderInput, value: string) => {
    setProfile((previous) => ({
      ...previous,
      founders: previous.founders.map((founder, founderIndex) =>
        founderIndex === index ? { ...founder, [field]: value } : founder,
      ),
    }));
  };

  const runAgain = async () => {
    setSaving(true);
    setError('');
    try {
      const linkedinValues = [
        profile.company_linkedin,
        ...profile.founders.map((founder) => founder.linkedin_url),
      ].filter(Boolean);
      if (linkedinValues.some((value) => !/linkedin\.com\//i.test(value))) {
        throw new Error('LinkedIn links must be valid linkedin.com profile or company URLs.');
      }
      const saveResponse = await fetch('/api/instant/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startup_id: startupId, ...profile }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saveData.error || 'Could not save your updates');

      if (deck) {
        const form = new FormData();
        form.append('startup_id', startupId);
        form.append('deck', deck);
        const deckResponse = await fetch('/api/deck/upload', { method: 'POST', body: form });
        const deckData = await deckResponse.json();
        if (!deckResponse.ok) throw new Error(deckData.error || 'Could not process the deck');
      }

      const rescoreResponse = await fetch('/api/instant/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startup_id: startupId }),
      });
      const rescore = await rescoreResponse.json();
      if (!rescoreResponse.ok) throw new Error(rescore.error || 'Could not rerun matching');

      setResult({
        godScore: Number(rescore.god_score) || undefined,
        matchCount: Number(rescore.match_count) || undefined,
      });
      void trackFunnelEvent('improve_matches_completed', {
        startup_id: startupId,
        previous_god_score: currentGodScore,
        new_god_score: rescore.god_score,
        match_count: rescore.match_count,
        deck_added: Boolean(deck),
        founder_count: profile.founders.filter((founder) => founder.name).length,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not improve matches');
    } finally {
      setSaving(false);
    }
  };

  const viewRefreshedMatches = () => {
    const target = `/matches?url=${encodeURIComponent(startupUrl)}&refreshed=1`;
    window.location.assign(target);
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/25 bg-zinc-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-emerald-400">Optional · Improve matches</p>
            <h2 className="mt-1 text-xl font-bold text-white">Add what Pythh could not find</h2>
            <p className="mt-1 text-xs text-zinc-400">
              We will save this evidence and rerun the same match engine against your startup.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-white" aria-label="Close improve matches">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-400">
              <Loader2 className="animate-spin text-emerald-400" size={18} />
              Checking your startup profile…
            </div>
          ) : result ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto mb-4 text-emerald-400" size={42} />
              <p className="text-[10px] uppercase tracking-[2px] text-emerald-400">Match engine complete</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Your refreshed shortlist is ready</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                Pythh rescored your startup with the new evidence
                {result.matchCount ? ` and evaluated ${result.matchCount.toLocaleString()} qualified matches` : ''}.
              </p>
              {currentGodScore != null && result.godScore != null && (
                <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <span className="font-mono text-zinc-500">GOD {Math.round(currentGodScore)}</span>
                  <ArrowRight size={14} className="text-emerald-400" />
                  <span className="font-mono font-semibold text-emerald-400">GOD {Math.round(result.godScore)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={viewRefreshedMatches}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-zinc-950 sm:w-auto"
              >
                View my refreshed five matches <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Profile completeness</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      We only ask for information that was missing or incomplete.
                    </p>
                  </div>
                  <span className="font-mono text-lg text-emerald-400">{payload?.completeness?.percentage ?? 0}%</span>
                </div>
              </div>

              {needsFounders && (
                <section>
                  <h3 className="text-sm font-semibold text-white">Founders</h3>
                  <p className="mt-1 text-xs text-zinc-500">Names and LinkedIn profiles improve team and thesis matching.</p>
                  <div className="mt-3 space-y-3">
                    {profile.founders.map((founder, index) => (
                      <div key={index} className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={founder.name}
                          onChange={(event) => updateFounder(index, 'name', event.target.value)}
                          placeholder="Founder name"
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                        />
                        <input
                          value={founder.linkedin_url}
                          onChange={(event) => updateFounder(index, 'linkedin_url', event.target.value)}
                          placeholder="linkedin.com/in/..."
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                        />
                      </div>
                    ))}
                  </div>
                  {profile.founders.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setProfile((previous) => ({ ...previous, founders: [...previous.founders, { name: '', linkedin_url: '' }] }))}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400"
                    >
                      <Plus size={13} /> Add another founder
                    </button>
                  )}
                </section>
              )}

              <section className="grid gap-4 sm:grid-cols-2">
                {!profile.company_linkedin && (
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-zinc-300 mb-2">Company LinkedIn</span>
                    <input
                      value={profile.company_linkedin}
                      onChange={(event) => setProfile((previous) => ({ ...previous, company_linkedin: event.target.value }))}
                      placeholder="linkedin.com/company/..."
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                    />
                  </label>
                )}
                {needsFunding && <NumberField label="Raised to date" prefix="$" value={profile.funding_raised} onChange={(value) => setProfile((previous) => ({ ...previous, funding_raised: value }))} />}
                {profile.target_raise === '' && <NumberField label="Current target raise" prefix="$" value={profile.target_raise} onChange={(value) => setProfile((previous) => ({ ...previous, target_raise: value }))} />}
                {!profile.funding_stage && (
                  <label className="block">
                    <span className="block text-xs font-medium text-zinc-300 mb-2">Current fundraising stage</span>
                    <select
                      value={profile.funding_stage}
                      onChange={(event) => setProfile((previous) => ({ ...previous, funding_stage: event.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none"
                    >
                      <option value="">Select stage</option>
                      <option value="pre-seed">Pre-seed</option>
                      <option value="seed">Seed</option>
                      <option value="series-a">Series A</option>
                      <option value="series-b">Series B</option>
                      <option value="series-c-plus">Series C+</option>
                    </select>
                  </label>
                )}
                {needsTeamSize && <NumberField label="Current team size" value={profile.team_size} onChange={(value) => setProfile((previous) => ({ ...previous, team_size: value }))} />}
                {needsCustomers && <NumberField label="Customers or paying organizations" value={profile.customer_count} onChange={(value) => setProfile((previous) => ({ ...previous, customer_count: value }))} />}
                {needsMrr && <NumberField label="Monthly recurring revenue" prefix="$" value={profile.mrr} onChange={(value) => setProfile((previous) => ({ ...previous, mrr: value }))} hint="Enter 0 if pre-revenue." />}
                {profile.has_technical_cofounder == null && (
                  <label className="block">
                    <span className="block text-xs font-medium text-zinc-300 mb-2">Technical co-founder?</span>
                    <select
                      value=""
                      onChange={(event) => setProfile((previous) => ({ ...previous, has_technical_cofounder: event.target.value === 'yes' }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none"
                    >
                      <option value="" disabled>Select one</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                )}
              </section>

              {needsDescription && (
                <label className="block">
                  <span className="block text-xs font-medium text-zinc-300 mb-2">What does the company do?</span>
                  <textarea
                    rows={4}
                    value={profile.description}
                    onChange={(event) => setProfile((previous) => ({ ...previous, description: event.target.value }))}
                    placeholder="Describe the customer, problem, product, and why now."
                    className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500/60"
                  />
                </label>
              )}

              {!profile.deck_filename && (
                <label className="block rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-4">
                  <span className="flex items-center gap-2 text-sm font-medium text-white"><FileText size={16} className="text-emerald-400" /> Company deck (optional)</span>
                  <span className="mt-1 block text-xs text-zinc-500">Upload a PDF up to 10 MB. Pythh extracts evidence; it is not sent to investors.</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && file.size > 10 * 1024 * 1024) {
                        setError('Deck must be 10 MB or smaller.');
                        setDeck(null);
                        return;
                      }
                      setError('');
                      setDeck(file);
                    }}
                    className="mt-3 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:font-semibold file:text-zinc-950"
                  />
                </label>
              )}

              {error && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">{error}</p>}

              <button
                type="button"
                onClick={() => void runAgain()}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {saving ? 'Rerunning the match engine…' : 'Save data & rerun match engine'}
              </button>
              <p className="text-center text-[10px] text-zinc-600">Optional · Your existing five matches remain saved</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
