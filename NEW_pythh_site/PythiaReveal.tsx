/*
 * PythiaReveal — Pixel mosaic dissolve animation
 * Design: Obsidian Terminal — Data Noir
 *
 * Animation sequence:
 *   0.0s  Icon fades in — pure white on black, no color tinting
 *   1.8s  Icon pixelates into a grid of white/grey blocks
 *   3.2s  Pixel blocks scatter and fade out in a staggered wave
 *   4.5s  Signal card rises up through the cleared space
 *   5.0s  Signal card fully visible
 *   5.0s+ Cycles through 3 live signals every 4s
 *
 * Icon rendering: grayscale only — no hue-rotate, no color filter
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, Zap, Building2, Clock, ArrowRight, Activity } from "lucide-react";

/** Served from repo `public/` (vite publicDir). */
const PYTHIA_ICON_URL = "/images/pythh_oracle.png";

// Grid dimensions for the pixel mosaic
const COLS = 12;
const ROWS = 12;
const TOTAL_PIXELS = COLS * ROWS;

interface Signal {
  investor: string;
  firm: string;
  action: string;
  detail: string;
  score: number;
  time: string;
  type: "bullish" | "neutral" | "meeting";
}

const LIVE_SIGNALS: Signal[] = [
  {
    investor: "Sarah Chen",
    firm: "Sequoia Capital",
    action: "New position signal",
    detail: "Closed $12M Series A in AI observability — portfolio gap identified in your vertical",
    score: 94,
    time: "2m ago",
    type: "bullish",
  },
  {
    investor: "Niko Bonatsos",
    firm: "General Catalyst",
    action: "Thesis alignment detected",
    detail: "Published essay on AI-native workflows — 3 LP updates reference your exact market",
    score: 91,
    time: "6m ago",
    type: "bullish",
  },
  {
    investor: "Tomasz Tunguz",
    firm: "Theory Ventures",
    action: "Fund cycle: early deploy",
    detail: "New $700M fund — 12% deployed. Composable AI thesis matches your architecture",
    score: 88,
    time: "8m ago",
    type: "meeting",
  },
];

type AnimPhase = "hidden" | "entering" | "scanning" | "pixelating" | "scattering" | "revealed";

// Shuffle array for staggered pixel scatter order
function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function PythiaReveal({ autoPlay = true }: { autoPlay?: boolean }) {
  const [phase, setPhase] = useState<AnimPhase>("hidden");
  const [signalIdx, setSignalIdx] = useState(0);
  const [signalVisible, setSignalVisible] = useState(false);
  // Which pixels are currently "scattered" (hidden)
  const [scatteredPixels, setScatteredPixels] = useState<Set<number>>(new Set());
  const [scatterOrder] = useState(() => shuffleIndices(TOTAL_PIXELS));
  // Scan line: 0 = top, 1 = bottom (as a fraction of icon height)
  const [scanProgress, setScanProgress] = useState(0);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scatterRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    scatterRef.current.forEach(clearTimeout);
    scatterRef.current = [];
    if (cycleRef.current) clearInterval(cycleRef.current);
  }, []);

  const runSequence = useCallback(() => {
    clearTimers();
    setPhase("entering");
    setScatteredPixels(new Set());
    setSignalVisible(false);
    setScanProgress(0);

    // Phase: scan line sweeps top → bottom over 900ms
    const t1 = setTimeout(() => {
      setPhase("scanning");
      setScanProgress(0);
      // Animate scan progress from 0 → 1 over 900ms using rAF-style steps
      const SCAN_DURATION = 900;
      const SCAN_STEPS = 60;
      const stepTime = SCAN_DURATION / SCAN_STEPS;
      for (let s = 0; s <= SCAN_STEPS; s++) {
        const t = setTimeout(() => {
          setScanProgress(s / SCAN_STEPS);
        }, s * stepTime);
        scatterRef.current.push(t);
      }
    }, 1800);

    // Phase: pixelate (show grid overlay) — after scan completes
    const t2 = setTimeout(() => setPhase("pixelating"), 2800);

    // Phase: scatter pixels one by one
    const t3 = setTimeout(() => {
      setPhase("scattering");
      scatterOrder.forEach((pixelIdx, order) => {
        const t = setTimeout(() => {
          setScatteredPixels(prev => {
            const next = new Set(prev);
            next.add(pixelIdx);
            return next;
          });
        }, order * 18); // 18ms per pixel × 144 pixels = ~2.6s total scatter
        scatterRef.current.push(t);
      });
    }, 3200);

    // Phase: reveal signal card
    const t4 = setTimeout(() => {
      setPhase("revealed");
      setSignalVisible(true);
    }, 6200);

    scatterRef.current.push(t1, t2, t3, t4);
  }, [scatterOrder, clearTimers]);

  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(runSequence, 500);
    return () => { clearTimeout(t); clearTimers(); };
  }, [autoPlay, runSequence, clearTimers]);

  // Cycle signals after reveal
  useEffect(() => {
    if (phase !== "revealed") return;
    cycleRef.current = setInterval(() => {
      setSignalVisible(false);
      const t = setTimeout(() => {
        setSignalIdx(i => (i + 1) % LIVE_SIGNALS.length);
        setSignalVisible(true);
      }, 400);
      scatterRef.current.push(t);
    }, 4500);
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, [phase]);

  const signal = LIVE_SIGNALS[signalIdx];
  const isPixelPhase = phase === "pixelating" || phase === "scattering";
  const iconVisible = phase === "entering" || phase === "scanning" || phase === "pixelating" || phase === "scattering";
  const showScanLine = phase === "scanning";

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 320, height: 320 }}>

      {/* ── PYTHIA Icon — pure white/black, no color filter ── */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: iconVisible ? 1 : 0,
          transform: phase === "hidden" ? "scale(0.88)" : "scale(1)",
          transition: phase === "entering"
            ? "opacity 0.9s ease-out, transform 0.9s ease-out"
            : "opacity 0.3s ease-in, transform 0.3s ease-in",
          // Pure grayscale — no hue-rotate, no color tinting
          filter: "grayscale(1) contrast(1.1) brightness(1.0)",
        }}
      >
        <img
          src={PYTHIA_ICON_URL}
          alt="PYTHIA Oracle"
          draggable={false}
          style={{ width: 240, height: 240, objectFit: "contain" }}
        />
      </div>

      {/* ── Scan line ── */}
      {showScanLine && (
        <div
          className="absolute overflow-hidden"
          style={{
            width: 240,
            height: 240,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          {/* Scanned region: brightened area above the line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${scanProgress * 100}%`,
              background: "linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
              transition: "height 0.016s linear",
            }}
          />
          {/* The scan line itself */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `calc(${scanProgress * 100}% - 1px)`,
              height: 2,
              background: "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.9) 20%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 80%, transparent 100%)",
              boxShadow: "0 0 8px 2px rgba(255,255,255,0.6), 0 0 20px 4px rgba(255,255,255,0.2)",
              transition: "top 0.016s linear",
            }}
          />
          {/* Trailing glow below the line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanProgress * 100}%`,
              height: 24,
              background: "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 100%)",
              transition: "top 0.016s linear",
            }}
          />
        </div>
      )}

      {/* ── Pixel mosaic overlay ── */}
      {isPixelPhase && (
        <div
          className="absolute"
          style={{
            width: 240,
            height: 240,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            pointerEvents: "none",
          }}
        >
          {Array.from({ length: TOTAL_PIXELS }, (_, i) => {
            const isScattered = scatteredPixels.has(i);
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            // Scatter direction: outward from center
            const dx = (col - COLS / 2) * 8;
            const dy = (row - ROWS / 2) * 8;
            return (
              <div
                key={i}
                style={{
                  backgroundColor: isScattered
                    ? "transparent"
                    : `rgba(255,255,255,${0.05 + Math.random() * 0.12})`,
                  transform: isScattered
                    ? `translate(${dx}px, ${dy}px) scale(0)`
                    : "translate(0,0) scale(1)",
                  opacity: isScattered ? 0 : 1,
                  transition: isScattered
                    ? "transform 0.35s ease-in, opacity 0.25s ease-in"
                    : "none",
                  border: isScattered ? "none" : "0.5px solid rgba(255,255,255,0.06)",
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Signal Card ── */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: signalVisible ? 1 : 0,
          transform: signalVisible ? "translateY(0) scale(1)" : "translateY(18px) scale(0.96)",
          transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
          pointerEvents: phase === "revealed" ? "auto" : "none",
        }}
      >
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "oklch(0.16 0.01 264)",
            border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
            boxShadow: "0 0 40px oklch(0.696 0.17 162.48 / 0.12), 0 8px 32px oklch(0 0 0 / 0.4)",
            width: 290,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-xs font-mono tracking-widest" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                LIVE SIGNAL
              </span>
            </div>
            <span className="text-xs font-mono flex items-center gap-1" style={{ color: "oklch(0.4 0.01 264)" }}>
              <Clock size={10} />
              {signal.time}
            </span>
          </div>

          {/* Investor row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-display font-bold text-base leading-tight" style={{ color: "oklch(0.97 0.005 264)" }}>
                {signal.investor}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={11} style={{ color: "oklch(0.5 0.01 264)" }} />
                <span className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>{signal.firm}</span>
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-3 py-2"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)" }}>
              <span className="font-mono font-bold text-lg leading-none" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                {signal.score}
              </span>
              <span className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>match</span>
            </div>
          </div>

          {/* Action label */}
          <div className="flex items-center gap-2 mb-2">
            {signal.type === "bullish" ? (
              <TrendingUp size={12} style={{ color: "oklch(0.769 0.188 70.08)" }} />
            ) : signal.type === "meeting" ? (
              <Zap size={12} style={{ color: "oklch(0.769 0.188 70.08)" }} />
            ) : (
              <Activity size={12} style={{ color: "oklch(0.769 0.188 70.08)" }} />
            )}
            <span className="text-xs font-semibold" style={{ color: "oklch(0.769 0.188 70.08)" }}>
              {signal.action}
            </span>
          </div>

          {/* Detail */}
          <p className="text-xs leading-relaxed mb-4" style={{ color: "oklch(0.55 0.01 264)" }}>
            {signal.detail}
          </p>

          {/* CTA */}
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-200"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px oklch(0.696 0.17 162.48 / 0.5)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            View Full Signal
            <ArrowRight size={12} />
          </button>

          {/* Pagination dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {LIVE_SIGNALS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === signalIdx ? 16 : 6,
                  height: 6,
                  backgroundColor: i === signalIdx
                    ? "oklch(0.696 0.17 162.48)"
                    : "oklch(0.3 0.01 264)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Replay button ── */}
      {phase === "revealed" && (
        <button
          className="absolute bottom-0 right-0 text-xs font-mono px-2 py-1 rounded opacity-30 hover:opacity-70 transition-opacity"
          style={{ color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}
          onClick={() => {
            clearTimers();
            setPhase("hidden");
            setSignalVisible(false);
            setScatteredPixels(new Set());
            setTimeout(runSequence, 300);
          }}
        >
          ↺ replay
        </button>
      )}
    </div>
  );
}
