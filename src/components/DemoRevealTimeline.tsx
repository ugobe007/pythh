import { useEffect, useState } from 'react';

interface DemoRevealTimelineProps {
  observers: number;
  heartbeat: string;
  direction: string;
  onComplete?: () => void;
}

export default function DemoRevealTimeline({
  observers,
  heartbeat,
  direction,
  onComplete,
}: DemoRevealTimelineProps) {
  const [beat, setBeat] = useState(0);
  const [observerCount, setObserverCount] = useState(0);

  useEffect(() => {
    // Beat 1: Orientation (instant)
    setBeat(1);

    // Beat 2: Heartbeat (600ms)
    const timer2 = setTimeout(() => setBeat(2), 600);

    // Beat 3: Observer count-up (900ms start, 1500ms animation)
    const timer3 = setTimeout(() => {
      setBeat(3);
      // Animate count-up
      let current = 0;
      const increment = observers / 30; // 30 frames
      const countInterval = setInterval(() => {
        current += increment;
        if (current >= observers) {
          setObserverCount(observers);
          clearInterval(countInterval);
        } else {
          setObserverCount(Math.floor(current));
        }
      }, 50); // 50ms per frame = 1.5s total
    }, 900);

    // Beat 4: Direction (2400ms)
    const timer4 = setTimeout(() => {
      setBeat(4);
      // Call onComplete after direction fade-in
      setTimeout(() => onComplete?.(), 1000);
    }, 2400);

    return () => {
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [observers, onComplete]);

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
      {/* Beat 1: Orientation */}
      <div
        className={`transition-opacity duration-300 ${
          beat >= 1 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 text-sm text-white/70">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="font-medium">Capital Navigation initializing…</span>
        </div>
      </div>

      {/* Beat 2: Heartbeat */}
      <div
        className={`transition-all duration-500 ${
          beat >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/50">Latest intent trace:</span>
          <span className="font-semibold text-green-400">{heartbeat}</span>
        </div>
      </div>

      {/* Beat 3: Aha number */}
      <div
        className={`transition-all duration-700 ${
          beat >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="py-3">
          <div className="text-4xl font-bold text-white mb-2">
            {observerCount > 0 ? (
              <span className="tabular-nums">{observerCount}</span>
            ) : (
              <span className="text-white/30">—</span>
            )}{' '}
            <span className="text-xl text-white/60">observers (7d)</span>
          </div>
          <p className="text-sm text-white/60 max-w-2xl">
            These are investors leaving{' '}
            <span className="font-semibold text-white/90">discovery traces</span> around your
            startup — <span className="italic">before outreach</span>.
          </p>
        </div>
      </div>

      {/* Beat 4: Direction */}
      <div
        className={`transition-all duration-1000 ${
          beat >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-sm text-white/50">Direction:</span>
            <span className="text-2xl font-bold text-purple-400">{direction}</span>
          </div>
          <p className="text-sm text-purple-400 italic animate-pulse">
            Projected capital movement detected.
          </p>
        </div>
      </div>
    </div>
  );
}
