import { useState } from 'react';
import { ChevronDown, ChevronUp, Lock, Mail, Loader2, Send } from 'lucide-react';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';
import { normalizeWhyYouMatch } from '@/lib/normalizeWhyYouMatch';
import { parseExplainBullets } from '@/components/MatchExplainBlock';
import { sendLeadEmail, unlockMatchLead } from '@/lib/matchLeadRelay';
import { G, G_BORDER, G_HOVER, AMBER, DIM, MUTED, PURPLE_ACCENT, TEXT, BORDER, CARD } from '@/lib/designTokens';
import { matchExpiryLine } from '@/lib/matchFreshness';

export type LeadDeal = {
  company?: string;
  year?: number | null;
  round?: string | null;
  amount?: number | null;
};

export type LeadMatch = {
  investor_id?: string;
  match_score?: number;
  why_you_match?: string | null;
  fitness_score?: number;
  fitness_components?: {
    alignment?: number;
    lifecycle?: number;
    reachability?: number;
    profile?: number;
    behavior?: number | null;
  };
  investor_class?: 'angel' | 'vc';
  expires_at?: string | null;
  match_days_left?: number | null;
  match_stale?: boolean;
  investor?: {
    id?: string;
    name?: string;
    firm?: string | null;
    sectors?: string[] | null;
    stage?: string | string[] | null;
    check_size_min?: number | null;
    check_size_max?: number | null;
    contactable?: boolean;
    total_investments?: number | null;
    last_investment_date?: string | null;
    recent_deals?: LeadDeal[];
  };
};

function formatMoney(value?: number | null): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const amount = Number(value);
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000).toLocaleString()}K`;
  return `$${amount.toLocaleString()}`;
}

function stageLabel(match: LeadMatch): string | null {
  const stage = match.investor?.stage;
  const text = Array.isArray(stage) ? stage.filter(Boolean).join(', ') : String(stage || '');
  return text.trim() || null;
}

function checkLabel(match: LeadMatch): string | null {
  const min = formatMoney(match.investor?.check_size_min);
  const max = formatMoney(match.investor?.check_size_max);
  if (min && max) return `${min}–${max}`;
  return min || max || null;
}

function Pill({ text, tone }: { text: string; tone: 'fit' | 'plain' | 'warn' }) {
  const toneStyle = tone === 'fit'
    ? { color: G, background: 'oklch(0.696 0.17 162.48 / 0.14)', border: `1px solid ${G_BORDER}` }
    : tone === 'warn'
      ? { color: AMBER, background: 'oklch(0.78 0.14 65 / 0.12)', border: '1px solid oklch(0.78 0.14 65 / 0.4)' }
      : { color: TEXT, background: 'oklch(0.18 0.012 264)', border: `1px solid ${BORDER}` };
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={toneStyle}>
      {text}
    </span>
  );
}

function score(value?: number | null): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value));
}

function dealLine(deal: LeadDeal): string | null {
  const company = String(deal.company || '').trim();
  if (!company) return null;
  const bits = [company];
  if (deal.round) bits.push(String(deal.round));
  if (deal.year) bits.push(String(deal.year));
  const amount = formatMoney(deal.amount);
  if (amount) bits.push(amount);
  return bits.join(' · ');
}

function lastDealYear(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

type Props = {
  match: LeadMatch;
  rank: number;
  startupId: string;
  startupName: string;
  defaultOpen?: boolean;
  isAuthenticated: boolean;
  isPaid: boolean;
  unlocked: boolean;
  replyTo?: string | null;
  onUnlocked: (investorId: string, contactable: boolean) => void;
  onNeedSignup: (investorId: string, name: string, firm?: string | null) => void;
  onNeedPlan: () => void;
};

export default function MatchInvestorLead({
  match,
  rank,
  startupId,
  startupName,
  defaultOpen = false,
  isAuthenticated,
  isPaid,
  unlocked,
  replyTo,
  onUnlocked,
  onNeedSignup,
  onNeedPlan,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [unlocking, setUnlocking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState(`${startupName} — intro via Pythh`);
  const [body, setBody] = useState('');

  const inv = match.investor;
  const investorId = match.investor_id || inv?.id || '';
  const label = formatInvestorDisplayLabel(inv?.name, inv?.firm);
  const fitness = score(match.fitness_score ?? match.match_score) ?? 0;
  const why = normalizeWhyYouMatch(match.why_you_match);
  const bullets = parseExplainBullets(match.why_you_match);
  const deals = (inv?.recent_deals || []).map(dealLine).filter(Boolean) as string[];
  const check = checkLabel(match);
  const stage = stageLabel(match);
  const dealCount = inv?.total_investments != null ? Math.round(Number(inv.total_investments)) : null;
  const lastYear = lastDealYear(inv?.last_investment_date);
  const components = match.fitness_components || {};
  const contactable = inv?.contactable !== false;
  const expiry = matchExpiryLine(match);
  const whyLine = (bullets[0] || why || '').trim();
  const latestDeal = deals[0] || '';

  const handleUnlock = async () => {
    if (!investorId) return;
    setError(null);
    if (!isAuthenticated) {
      onNeedSignup(investorId, inv?.name || label, inv?.firm);
      return;
    }
    if (!isPaid) {
      onNeedPlan();
      return;
    }
    setUnlocking(true);
    try {
      const result = await unlockMatchLead(startupId, investorId);
      onUnlocked(investorId, result.contactable);
    } catch (err) {
      if (err instanceof Error && err.message === 'sign_in_required') {
        onNeedSignup(investorId, inv?.name || label, inv?.firm);
        return;
      }
      if (err instanceof Error && err.message === 'plan_required') {
        onNeedPlan();
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not unlock');
    } finally {
      setUnlocking(false);
    }
  };

  const handleSend = async () => {
    if (!investorId) return;
    setError(null);
    setSending(true);
    try {
      const result = await sendLeadEmail({
        startupId,
        investorId,
        subject,
        body,
        replyTo: replyTo || undefined,
      });
      if (!result.sent) {
        setError(result.error || 'Could not send through Pythh');
        return;
      }
      setSent(true);
    } catch (err) {
      if (err instanceof Error && err.message === 'sign_in_required') {
        onNeedSignup(investorId, inv?.name || label, inv?.firm);
        return;
      }
      if (err instanceof Error && err.message === 'plan_required') {
        onNeedPlan();
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not send through Pythh');
    } finally {
      setSending(false);
    }
  };

  const lead = rank === 0;

  return (
    <li>
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: lead
            ? 'linear-gradient(115deg, oklch(0.24 0.07 162) 0%, oklch(0.13 0.016 264) 52%)'
            : 'oklch(0.15 0.014 264)',
          border: lead ? `1px solid ${G}` : '1px solid oklch(0.3 0.015 264)',
          boxShadow: lead ? '0 0 36px oklch(0.696 0.17 162.48 / 0.22)' : undefined,
        }}
      >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-4 py-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-start gap-4">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl font-bold tabular-nums"
            style={{
              background: lead ? G : 'oklch(0.22 0.015 264)',
              color: lead ? 'oklch(0.12 0.02 162)' : TEXT,
              boxShadow: lead ? '0 0 18px oklch(0.696 0.17 162.48 / 0.45)' : undefined,
            }}
          >
            {rank + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold leading-tight sm:text-xl" style={{ color: TEXT }}>
              {label}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.investor_class ? <Pill text={match.investor_class === 'angel' ? 'Angel' : 'VC'} tone="fit" /> : null}
              {stage ? <Pill text={stage} tone="plain" /> : null}
              {check ? <Pill text={check} tone="plain" /> : null}
              {dealCount != null && dealCount > 0 ? <Pill text={`${dealCount.toLocaleString()} deals`} tone="plain" /> : null}
              {expiry ? <Pill text={expiry} tone={match.match_stale ? 'warn' : 'plain'} /> : null}
            </div>
            {whyLine ? (
              <p className="mt-2 line-clamp-2 text-sm leading-snug" style={{ color: MUTED }}>
                {whyLine}
              </p>
            ) : null}
            {latestDeal ? (
              <p className="mt-2 truncate text-xs" style={{ color: TEXT }}>
                <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: PURPLE_ACCENT }}>
                  Backed
                </span>
                {latestDeal}
              </p>
            ) : null}
          </div>
          <span className="inline-flex shrink-0 items-start gap-2">
            <span className="text-right">
              <span
                className="block text-3xl font-bold leading-none tabular-nums"
                style={{ color: G, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
              >
                {fitness}
              </span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: DIM }}>
                Fit
              </span>
            </span>
            {open ? <ChevronUp className="w-4 h-4" style={{ color: DIM }} /> : <ChevronDown className="w-4 h-4" style={{ color: DIM }} />}
          </span>
        </div>
        <span className="mt-4 block h-2 overflow-hidden rounded-full" style={{ background: 'oklch(0.22 0.012 264)' }}>
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.max(8, Math.min(100, fitness))}%`,
              background: lead ? `linear-gradient(90deg, ${G}, oklch(0.86 0.17 162))` : G,
              boxShadow: '0 0 12px oklch(0.696 0.17 162.48 / 0.55)',
            }}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: BORDER }}>
          {(bullets.length || why) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: MUTED }}>
                Why this investor
              </p>
              <ul className="space-y-1.5">
                {(bullets.length ? bullets : [why]).map((line) => (
                  <li key={line} className="rounded-lg px-3 py-2 text-sm leading-relaxed" style={{ color: TEXT, background: 'oklch(0.12 0.012 264)' }}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: MUTED }}>
              Numbers
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { label: 'Fit', value: `${fitness}/100`, color: G },
                ...(score(components.alignment) != null ? [{ label: 'Alignment', value: `${score(components.alignment)}/100`, color: TEXT }] : []),
                ...(score(components.lifecycle) != null ? [{ label: 'Stage', value: `${score(components.lifecycle)}/100`, color: TEXT }] : []),
                ...(check ? [{ label: 'Check', value: check, color: TEXT }] : []),
                ...(dealCount != null && dealCount > 0 ? [{ label: 'Deals', value: dealCount.toLocaleString(), color: TEXT }] : []),
                ...(lastYear ? [{ label: 'Last deal', value: lastYear, color: TEXT }] : []),
              ].map((tile) => (
                <div key={tile.label} className="rounded-xl px-3 py-2" style={{ background: 'oklch(0.12 0.012 264)', border: `1px solid ${BORDER}` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: DIM }}>{tile.label}</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: tile.color }}>{tile.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: MUTED }}>
              Recent deals
            </p>
            {deals.length ? (
              <ul className="space-y-1.5">
                {deals.map((line) => (
                  <li key={line} className="rounded-lg px-3 py-2 text-xs font-mono" style={{ color: TEXT, background: 'oklch(0.12 0.012 264)', border: `1px solid ${BORDER}` }}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: DIM }}>No recent deals on record yet.</p>
            )}
          </div>

          {!isPaid ? (
            <p className="text-xs leading-relaxed" style={{ color: DIM }}>
              Email, calls, and the deck outline are on Scout. Sending this intro comes after positioning, and nothing goes out until you approve it.
            </p>
          ) : !unlocked ? (
            <div>
              <button
                type="button"
                onClick={handleUnlock}
                disabled={unlocking}
                className="inline-flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: G,
                  border: `1px solid ${G}`,
                  color: 'oklch(0.1 0.02 162.48)',
                  minHeight: 42,
                  opacity: unlocking ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = G_HOVER;
                  e.currentTarget.style.borderColor = G_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = G;
                  e.currentTarget.style.borderColor = G;
                }}
              >
                {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Unlock email
              </button>
              <p className="mt-2 text-xs" style={{ color: DIM }}>
                We send from pythh.ai. Their address stays private.
              </p>
            </div>
          ) : sent ? (
            <p className="text-sm" style={{ color: G }}>Sent through Pythh. Replies come to you.</p>
          ) : !contactable ? (
            <p className="text-xs" style={{ color: AMBER }}>
              Unlocked. No deliverable address on file yet — we will not expose a guess.
            </p>
          ) : (
            <div
              className="rounded-lg p-3 space-y-3"
              style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
            >
              <p className="text-xs inline-flex items-center gap-1.5" style={{ color: TEXT }}>
                <Mail className="w-3.5 h-3.5" style={{ color: G }} />
                Email through Pythh — their address stays private
              </p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Email subject"
                className="w-full bg-transparent text-sm outline-none px-0 py-1"
                style={{ color: TEXT, borderBottom: `1px solid ${BORDER}` }}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label="Email body"
                rows={5}
                placeholder={`Short note to ${label}. Replies come to you.`}
                className="w-full bg-transparent text-sm outline-none resize-y min-h-[96px]"
                style={{ color: TEXT }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || body.trim().length < 20}
                className="inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: sending || body.trim().length < 20 ? DIM : G }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send via Pythh
              </button>
            </div>
          )}
          {error && <p className="text-xs" style={{ color: AMBER }}>{error}</p>}
        </div>
      )}
      </div>
    </li>
  );
}
