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
      <div className="grid gap-3 sm:grid-cols-2">
        {peers.map((peer) => {
          const amount = formatRaiseAmount(peer.amount_usd);
          const when = formatRaiseWhen(peer.announced_at);
          const round = formatRaiseRound(peer.round_type);
          const detail = [peer.funder, round, when].filter(Boolean).join(' · ');
          return (
            <article
              key={`${peer.name}-${peer.announced_at}-${peer.funder}`}
              className="rounded-2xl px-4 py-4"
              style={{
                background: 'linear-gradient(145deg, oklch(0.24 0.07 305) 0%, oklch(0.13 0.02 280) 58%)',
                border: '1px solid oklch(0.62 0.14 305 / 0.7)',
                boxShadow: '0 0 28px oklch(0.62 0.14 305 / 0.16)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className="truncate text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: PURPLE_ACCENT, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  {peer.sector || 'Raise'}
                </p>
                {amount ? (
                  <p className="shrink-0 text-right">
                    <span
                      className="block text-3xl font-bold leading-none tabular-nums"
                      style={{ color: G, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                    >
                      {amount}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: DIM }}>
                      Raised
                    </span>
                  </p>
                ) : null}
              </div>
              <p className="mt-3 truncate font-display text-xl font-semibold" style={{ color: TEXT }}>
                {peer.name}
              </p>
              {detail ? (
                <p className="mt-1 truncate text-sm" style={{ color: MUTED }}>
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
