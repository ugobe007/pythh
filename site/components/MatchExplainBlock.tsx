/**
 * Expandable "why this investor" evidence block — picky explain loop (match_explain).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Send } from 'lucide-react';
import { trackFunnelEventOnce } from '@/lib/matchEngagement';

type Props = {
  startupId: string;
  investorId?: string;
  investorName?: string;
  whyYouMatch?: string | string[] | null;
  matchScore?: number;
  rank: number;
  source?: string;
  /** When provided, an intro CTA renders at the end of the evidence — the match_explain loop's next action. */
  onIntro?: () => void;
  introLabel?: string;
};

/** DB stores why_you_match as string[]; preview/API may return string or array. */
export function normalizeWhyYouMatch(raw: string | string[] | null | undefined): string {
  if (raw == null) return '';
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean).join(' · ');
  }
  return String(raw).trim();
}

export function parseExplainBullets(text: string | string[] | null | undefined): string[] {
  const normalized = normalizeWhyYouMatch(text);
  if (!normalized) return [];
  const byBullet = normalized.split(/\s*[·•]\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  if (byBullet.length >= 2) return byBullet.slice(0, 3);
  const sentences = normalized.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return sentences.slice(0, 3);
}

export default function MatchExplainBlock({
  startupId,
  investorId,
  investorName,
  whyYouMatch,
  matchScore,
  rank,
  source = 'instant_match_preview',
  onIntro,
  introLabel,
}: Props) {
  const [open, setOpen] = useState(rank === 0);
  const whyText = normalizeWhyYouMatch(whyYouMatch);
  const bullets = parseExplainBullets(whyYouMatch);
  const viewedRef = useRef(false);

  const handleExplainIntro = () => {
    if (!onIntro) return;
    void trackFunnelEventOnce(
      `match_explain_intro:${startupId}:${investorId ?? 'top'}`,
      'match_explain_intro_clicked',
      {
        startup_id: startupId,
        investor_id: investorId,
        investor_name: investorName,
        rank,
        match_score: matchScore,
        source,
      },
    );
    onIntro();
  };

  const trackExplainViewed = () => {
    if (!investorId || viewedRef.current) return;
    if (!bullets.length && !whyText) return;
    viewedRef.current = true;
    void trackFunnelEventOnce(
      `match_explain:${startupId}:${investorId}`,
      'match_explain_viewed',
      {
        startup_id: startupId,
        investor_id: investorId,
        investor_name: investorName,
        rank,
        match_score: matchScore,
        source,
        bullet_count: bullets.length,
      },
    );
  };

  useEffect(() => {
    if (open) trackExplainViewed();
  }, [open, investorId, startupId]);

  const toggle = () => {
    setOpen((prev) => !prev);
  };

  if (!bullets.length && !whyText) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400/90 hover:text-cyan-300"
      >
        Why this investor
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-3 border-l border-zinc-700/80">
          {(bullets.length ? bullets : [whyText]).map((line, i) => (
            <li key={i} className="text-xs text-zinc-400 leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      )}
      {open && onIntro && (
        <div className="mt-2 pl-3">
          <button
            type="button"
            onClick={handleExplainIntro}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <Send className="w-3 h-3" />
            {introLabel || 'Ask for a warm intro →'}
          </button>
          <p className="mt-1 text-[10px] text-zinc-500">Free — Peter drafts it from the evidence above.</p>
        </div>
      )}
    </div>
  );
}
