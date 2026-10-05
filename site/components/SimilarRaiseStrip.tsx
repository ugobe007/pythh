/**
 * Snapshot cards of similar startups and the raises they closed.
 * Shown on the matches page once the shortlist is ready.
 */

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiConfig';
import { DIM, G, MUTED, PURPLE_ACCENT, TEXT } from '@/lib/designTokens';
import {
  formatRaiseAmount,
  formatRaiseRound,
  formatRaiseWhen,
  similarRaisesPath,
  type SimilarRaise,
} from '@/lib/similarRaises';

export default function SimilarRaiseStrip({ url }: { url: string }) {
  const [peers, setPeers] = useState<SimilarRaise[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(apiUrl(similarRaisesPath(url)));
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (cancelled || !Array.isArray(json.peers)) return;
        setPeers(json.peers.filter((row: SimilarRaise) => row?.name && row?.funder && row?.amount_usd).slice(0, 4));
      } catch {
        /* the shortlist still stands without peers */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!peers.length) return null;

  return (
    <section className="mb-8" aria-label="Similar raises">
      <p
        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: PURPLE_ACCENT }}
      >
        Similar companies that raised
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {peers.map((peer) => {
          const amount = formatRaiseAmount(peer.amount_usd);
          const when = formatRaiseWhen(peer.announced_at);
          const round = formatRaiseRound(peer.round_type);
          const detail = [peer.funder, round, when].filter(Boolean).join(' · ');
          return (
            <article
              key={`${peer.name}-${peer.announced_at}-${peer.funder}`}
              className="rounded-xl px-3.5 py-3"
              style={{
                background: 'linear-gradient(135deg, oklch(0.18 0.045 305) 0%, oklch(0.12 0.012 264) 62%)',
                border: '1px solid oklch(0.52 0.10 305 / 0.55)',
                boxShadow: 'inset 3px 0 0 oklch(0.72 0.16 305)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className="truncate text-[10px] uppercase tracking-[0.14em]"
                  style={{ color: DIM, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  {peer.sector || 'Raise'}
                </p>
                {amount ? (
                  <p
                    className="shrink-0 text-xl font-bold leading-none tabular-nums"
                    style={{ color: G, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                  >
                    {amount}
                  </p>
                ) : null}
              </div>
              <p className="mt-2 truncate text-base font-semibold" style={{ color: TEXT }}>
                {peer.name}
              </p>
              {detail ? (
                <p className="mt-0.5 truncate text-xs" style={{ color: MUTED }}>
                  {detail}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
