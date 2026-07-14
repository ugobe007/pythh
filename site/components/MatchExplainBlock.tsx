/**
 * Expandable "why this investor" evidence block — picky explain loop (match_explain).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { trackFunnelEventOnce } from '@/lib/matchEngagement';

type Props = {
  startupId: string;
  investorId?: string;
  investorName?: string;
  whyYouMatch?: string | null;
  matchScore?: number;
  rank: number;
  source?: string;
};

export function parseExplainBullets(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const byBullet = text.split(/\s*[·•]\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  if (byBullet.length >= 2) return byBullet.slice(0, 3);
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
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
}: Props) {
  const [open, setOpen] = useState(rank === 0);
  const bullets = parseExplainBullets(whyYouMatch);
  const viewedRef = useRef(false);

  const trackExplainViewed = () => {
    if (!investorId || viewedRef.current) return;
    if (!bullets.length && !whyYouMatch?.trim()) return;
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

  if (!bullets.length && !whyYouMatch) return null;

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
          {(bullets.length ? bullets : [whyYouMatch!]).map((line, i) => (
            <li key={i} className="text-xs text-zinc-400 leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
