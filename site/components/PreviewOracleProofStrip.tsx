/**
 * Oracle fund proof strip — verified funded picks on match preview.
 */

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Trophy } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';

type OracleProof = {
  headline?: string;
  verified_funded_picks?: number;
  verified_funded_rate_pct?: number | null;
  featured_pick?: {
    name?: string;
    entry_god_score?: number;
    sector?: string | null;
  } | null;
};

export default function PreviewOracleProofStrip() {
  const [proof, setProof] = useState<OracleProof | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/preview/oracle-proof'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.proof) setProof(data.proof);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!proof?.headline) return null;

  const featured = proof.featured_pick;

  return (
    <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-200">{proof.headline}</p>
          {proof.verified_funded_rate_pct != null && proof.verified_funded_picks > 0 && (
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {proof.verified_funded_rate_pct}% verified funded rate · public Oracle scoreboard
            </p>
          )}
          {featured?.name && featured.entry_god_score != null && (
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              e.g. {featured.name} — GOD {featured.entry_god_score} at entry
              {featured.sector ? ` · ${featured.sector}` : ''}
            </p>
          )}
        </div>
      </div>
      <Link
        href="/portfolio"
        className="text-[11px] font-semibold text-amber-400/90 hover:text-amber-300 whitespace-nowrap shrink-0"
      >
        View Oracle fund →
      </Link>
    </div>
  );
}
