/**
 * LiveWhisperLine — Subtle typing reveal for latest feed item
 * 
 * Lifeform compliance:
 *   - No toast, no spinner, no "loading…"
 *   - Silent failure
 *   - Tiny cursor block only while typing
 *   - Only re-types when content actually changes
 * 
 * Usage:
 *   <LiveWhisperLine />
 *   <LiveWhisperLine endpoint="/api/v1/whisper?kind=movement" />
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Whisper = { id: string; text: string; created_at?: string };

interface LiveWhisperLineProps {
  /** API endpoint to fetch whisper from */
  endpoint?: string;
  /** Polling interval in milliseconds (default: 60s) */
  intervalMs?: number;
  /** Typing speed in ms per character (default: 18ms) */
  typingMs?: number;
  /** Optional className for styling */
  className?: string;
}

export default function LiveWhisperLine({
  endpoint = '/api/v1/whisper',
  intervalMs = 60000,
  typingMs = 18,
  className,
}: LiveWhisperLineProps) {
  const [full, setFull] = useState<string>('');
  const [shown, setShown] = useState<string>('');
  const [lastId, setLastId] = useState<string>('');
  const timerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  async function load() {
    try {
      const res = await fetch(endpoint, { credentials: 'include' });
      const json = await res.json();
      const w: Whisper | null = json?.data ?? null;
      if (!w?.text || !w?.id) return;

      // Avoid retyping the same item
      if (w.id === lastId) return;

      setLastId(w.id);
      setFull(w.text);
    } catch {
      // Silent failure (Lifeform rule)
    }
  }

  // Fetch loop
  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, intervalMs) as unknown as number;
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, intervalMs, lastId]);

  // Typing animation (subtle)
  useEffect(() => {
    if (!full) return;
    setShown('');

    let i = 0;
    if (tickRef.current) window.clearInterval(tickRef.current);

    tickRef.current = window.setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) {
        if (tickRef.current) window.clearInterval(tickRef.current);
      }
    }, typingMs) as unknown as number;

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [full, typingMs]);

  const aria = useMemo(() => (shown ? `Update: ${shown}` : 'Update'), [shown]);

  return (
    <div
      aria-label={aria}
      className={className}
      style={{
        fontSize: 12,
        opacity: 0.8,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        letterSpacing: '0.01em',
        minHeight: '1.2em',
      }}
    >
      <span style={{ opacity: 0.9 }}>{shown || '\u00A0'}</span>
      <span style={{ opacity: 0.35 }}>{shown.length < full.length ? '▍' : ''}</span>
    </div>
  );
}
