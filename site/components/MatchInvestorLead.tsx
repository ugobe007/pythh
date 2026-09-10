import { useState } from 'react';
import { ChevronDown, ChevronUp, Lock, Mail, Loader2, Send } from 'lucide-react';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';
import { normalizeWhyYouMatch } from '@/lib/normalizeWhyYouMatch';
import { parseExplainBullets } from '@/components/MatchExplainBlock';
import InlineMeta from '@/components/design/InlineMeta';
import { sendLeadEmail, unlockMatchLead } from '@/lib/matchLeadRelay';
import { G, G_HOVER, AMBER, DIM, MUTED, TEXT, BORDER, CARD } from '@/lib/designTokens';

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
  unlocked: boolean;
  replyTo?: string | null;
  onUnlocked: (investorId: string, contactable: boolean) => void;
  onNeedSignup: (investorId: string, name: string, firm?: string | null) => void;
};

export default function MatchInvestorLead({
  match,
  rank,
  startupId,
  startupName,
  defaultOpen = false,
  isAuthenticated,
  unlocked,
  replyTo,
  onUnlocked,
  onNeedSignup,
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

  const handleUnlock = async () => {
    if (!investorId) return;
    setError(null);
    if (!isAuthenticated) {
      onNeedSignup(investorId, inv?.name || label, inv?.firm);
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
      setError(err instanceof Error ? err.message : 'Could not send through Pythh');
    } finally {
      setSending(false);
    }
  };

  return (
    <li className="py-3" style={{ borderColor: BORDER }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium truncate min-w-0" style={{ color: TEXT }}>
            <span className="font-mono text-xs mr-2" style={{ color: DIM }}>#{rank + 1}</span>
            {label}
          </p>
          <span className="inline-flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono" style={{ color: G }}>{fitness}/100</span>
            {open ? <ChevronUp className="w-3.5 h-3.5" style={{ color: DIM }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: DIM }} />}
          </span>
        </div>
        <InlineMeta
          items={[
            ...(match.investor_class ? [{ text: match.investor_class === 'angel' ? 'Angel' : 'VC', color: MUTED }] : []),
            ...(stage ? [{ text: stage, color: MUTED }] : []),
            ...(check ? [{ text: check, color: MUTED }] : []),
            ...(dealCount != null && dealCount > 0 ? [{ text: `${dealCount.toLocaleString()} deals`, color: DIM }] : []),
          ]}
        />
      </button>

      {open && (
        <div className="mt-3 pl-6 space-y-4">
          {(bullets.length || why) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>
                Why this investor
              </p>
              <ul className="space-y-1 border-l pl-3" style={{ borderColor: BORDER }}>
                {(bullets.length ? bullets : [why]).map((line) => (
                  <li key={line} className="text-xs leading-relaxed" style={{ color: DIM }}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>
              Numbers
            </p>
            <InlineMeta
              items={[
                { text: `Fit ${fitness}/100`, color: G },
                ...(score(components.alignment) != null ? [{ text: `Alignment ${score(components.alignment)}/100`, color: MUTED }] : []),
                ...(score(components.lifecycle) != null ? [{ text: `Stage ${score(components.lifecycle)}/100`, color: MUTED }] : []),
                ...(check ? [{ text: `Check ${check}`, color: MUTED }] : []),
                ...(dealCount != null && dealCount > 0 ? [{ text: `${dealCount.toLocaleString()} recorded deals`, color: MUTED }] : []),
                ...(lastYear ? [{ text: `Last deal ${lastYear}`, color: MUTED }] : []),
              ]}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>
              Recent deals
            </p>
            {deals.length ? (
              <ul className="space-y-1">
                {deals.map((line) => (
                  <li key={line} className="text-xs font-mono" style={{ color: TEXT }}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: DIM }}>No recent deals on record yet.</p>
            )}
          </div>

          {!unlocked ? (
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
                Unlock to email through Pythh
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
    </li>
  );
}
