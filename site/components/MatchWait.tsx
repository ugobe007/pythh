/**
 * Wait state for /matches?url= while the matching engine runs (~1 minute).
 * Pulses the brain mark and rotates a thin panel of similar funded startups.
 */

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/apiConfig';
import { BORDER, CARD, DIM, G, MUTED, TEXT } from '@/lib/designTokens';
import {
  formatRaiseAmount,
  formatRaiseRound,
  formatRaiseWhen,
  similarRaisesPath,
  type SimilarRaise,
} from '@/lib/similarRaises';

const STATUS_LINES = [
  'Reading the site',
  'Scoring investors',
  'Building your shortlist',
];

export default function MatchWait({ url }: { url: string }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [peers, setPeers] = useState<SimilarRaise[]>([]);
  const [peerIndex, setPeerIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPeers() {
      try {
        const res = await fetch(apiUrl(similarRaisesPath(url)));
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (cancelled || !Array.isArray(json.peers)) return;
        setPeers(json.peers.filter((row: SimilarRaise) => row?.name && row?.funder && row?.amount_usd));
      } catch {
        /* panel stays empty; the brain keeps pulsing */
      }
    }

    void loadPeers();
    const id = window.setInterval(loadPeers, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [url]);

  useEffect(() => {
    setPeerIndex(0);
  }, [peers.length, url]);

  useEffect(() => {
    if (peers.length < 2) return undefined;
    const id = window.setInterval(() => {
      setPeerIndex((i) => (i + 1) % peers.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [peers.length]);

  const peer = peers[peerIndex] || peers[0] || null;
  const amount = peer ? formatRaiseAmount(peer.amount_usd) : '';
  const when = peer ? formatRaiseWhen(peer.announced_at) : '';
  const round = peer ? formatRaiseRound(peer.round_type) : '';
  const fundedLine = [peer?.funder, round, when].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 py-10 text-center">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <span className="pythh-brain-halo absolute inset-2 rounded-full" aria-hidden="true" />
        <img
          src="/images/pythh-brain.png"
          alt=""
          width={112}
          height={112}
          className="pythh-brain-pulse relative h-28 w-28 object-contain"
        />
      </div>

      <div aria-live="polite">
        <p className="text-sm font-medium" style={{ color: TEXT }}>
          {STATUS_LINES[statusIndex]}
        </p>
        <p className="mt-1 text-xs" style={{ color: DIM }}>
          This usually takes about a minute.
        </p>
      </div>

      {peer ? (
        <div
          key={`${peer.name}-${peer.announced_at}-${peer.funder}`}
          className="pythh-peer-in w-full rounded-md px-3 py-2.5 text-left"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p
              className="truncate text-[10px] uppercase tracking-[0.14em]"
              style={{ color: DIM, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
            >
              Similar{peer.sector ? ` · ${peer.sector}` : ''}
            </p>
            {peers.length > 1 ? (
              <p className="shrink-0 text-[10px] tabular-nums" style={{ color: DIM }}>
                {peerIndex + 1}/{peers.length}
              </p>
            ) : null}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium" style={{ color: TEXT }}>
              {peer.name}
            </p>
            {amount ? (
              <p
                className="shrink-0 text-sm font-semibold tabular-nums"
                style={{ color: G, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
              >
                {amount}
              </p>
            ) : null}
          </div>
          {fundedLine ? (
            <p className="mt-0.5 truncate text-xs" style={{ color: MUTED }}>
              {fundedLine}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className="flex h-[72px] w-full items-center rounded-md px-3 text-left text-xs"
          style={{ color: DIM, border: `1px solid ${BORDER}` }}
        >
          Looking for a similar raise…
        </div>
      )}
    </div>
  );
}
