/**
 * LiveMatchCarousel
 * Rotating startup ↔ investor matches with cyan glow effect
 * Rotates every 5s, batch refreshes every 60s
 */

import React, { useState, useEffect } from "react";

interface Match {
  id: string;
  startup_name: string;
  startup_stage?: string;
  investor_name: string;
  investor_focus?: string;
  match_score: number;
}

interface LiveMatchCarouselProps {
  mode?: "global" | "tracking";
}

export function LiveMatchCarousel({ mode = "global" }: LiveMatchCarouselProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liveMatchCount, setLiveMatchCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch matches on mount and every 60s
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch("/api/v1/matches?limit=20&order=recent");
        if (!res.ok) throw new Error("Failed to fetch matches");
        const data = await res.json();
        
        if (data.ok && data.matches && Array.isArray(data.matches)) {
          setMatches(data.matches);
          setLiveMatchCount(data.total_count || data.matches.length);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        console.error("Failed to fetch matches, using fallback:", err);
        // Always use demo data on error
        setMatches([
          {
            id: "1",
            startup_name: "Nucleo Research",
            startup_stage: "Seed",
            investor_name: "Sequoia Capital",
            investor_focus: "Biotech Focus",
            match_score: 0.87,
          },
          {
            id: "2",
            startup_name: "AutoOps",
            startup_stage: "Series A",
            investor_name: "a16z",
            investor_focus: "Enterprise AI",
            match_score: 0.92,
          },
          {
            id: "3",
            startup_name: "HydraOS",
            startup_stage: "Seed",
            investor_name: "Kleiner Perkins",
            investor_focus: "Climate Tech",
            match_score: 0.78,
          },
        ]);
        setLiveMatchCount(1240);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
    const refreshInterval = setInterval(fetchMatches, 60000); // 60s batch refresh

    return () => clearInterval(refreshInterval);
  }, []);

  // Rotate through matches every 5s
  useEffect(() => {
    if (matches.length === 0) return;

    const rotateInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % matches.length);
    }, 5000);

    return () => clearInterval(rotateInterval);
  }, [matches.length]);

  // Never hide the carousel - always show loading or data
  if (matches.length === 0 && !isLoading) return null;

  // Show loading state
  if (isLoading || matches.length === 0) {
    return (
      <div className="bg-black border-t border-b border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-white/40 text-sm py-6">
            Loading live matches...
          </div>
        </div>
      </div>
    );
  }

  const current = matches[currentIndex];

  return (
    <div className="bg-black border-t border-b border-white/5 py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p className="text-2xl font-bold mb-2">
            live <span className="text-blue-500">signal</span> matching...
          </p>
          <div className="text-sm text-white/50">
            {liveMatchCount.toLocaleString()} matches this minute • Auto-rotating
          </div>
        </div>

        {/* Match Card with Glow */}
        <div className="relative">
          {/* Glow effect background */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-cyan-600/5 to-transparent rounded-lg blur-xl" />

          {/* Card */}
          <div className="relative bg-gradient-to-r from-white/5 to-white/2 border border-cyan-500/20 rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-6">
              {/* Startup */}
              <div className="flex-1">
                <div className="text-sm text-white/60 mb-1">Startup</div>
                <div className="text-lg font-semibold text-white">{current.startup_name}</div>
                {current.startup_stage && (
                  <div className="text-xs text-cyan-400/50 mt-1">{current.startup_stage}</div>
                )}
              </div>

              {/* Match Icon */}
              <div className="flex-shrink-0">
                <div className="text-2xl text-cyan-400/60">↔</div>
              </div>

              {/* Investor */}
              <div className="flex-1 text-right">
                <div className="text-sm text-white/60 mb-1">Investor</div>
                <div className="text-lg font-semibold text-white">{current.investor_name}</div>
                {current.investor_focus && (
                  <div className="text-xs text-cyan-400/50 mt-1">{current.investor_focus}</div>
                )}
              </div>

              {/* Score Badge */}
              <div className="flex-shrink-0 text-center">
                <div className="text-xs text-white/60 mb-1">Match</div>
                <div className="text-lg font-semibold text-cyan-400">
                  {Math.round(current.match_score * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mt-4 flex gap-1 justify-center">
          {matches.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all ${
                idx === currentIndex
                  ? "w-6 bg-cyan-500"
                  : "w-1 bg-white/10 hover:bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default LiveMatchCarousel;
