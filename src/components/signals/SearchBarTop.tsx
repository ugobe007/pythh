/**
 * SearchBarTop
 * Thin, minimal URL input bar for signal injection
 */

import React, { useState } from "react";

interface SearchBarTopProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

export function SearchBarTop({ onSubmit, isLoading }: SearchBarTopProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl("");
    }
  };

  return (
    <div className="bg-black border-b border-white/5 py-8 px-6">
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 99999, background: 'hotpink', color: 'black', padding: 8, fontWeight: 800 }}>
        SIGNALS-RADAR TRIPWIRE 123
      </div>
      <div className="max-w-7xl mx-auto">
        {/* Headline with purple accent */}
        <p className="text-3xl font-bold mb-6">
          your <span className="text-blue-500">signals</span>...
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="SUBMIT URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-6 py-3 rounded-xl bg-transparent border-2 border-white/30 text-white placeholder-white/60 text-base font-semibold focus:outline-none focus:border-white/60 focus:ring-0 transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="px-8 py-3 rounded-lg bg-transparent border border-cyan-500 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {isLoading ? "Analyzing…" : "Find Signals →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SearchBarTop;
