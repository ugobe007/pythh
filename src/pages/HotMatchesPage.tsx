/**
 * HotMatchesPage — Dedicated full feed of live founder–investor matches
 */

import PythhUnifiedNav from "../components/PythhUnifiedNav";
import HotMatchesFeed from "../components/HotMatchesFeed";
import SEO from "../components/SEO";

export default function HotMatchesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SEO
        title="Hot Matches — Live founder–investor matches | pythh.ai"
        description="Watch real founder–investor matches as they happen. See the market move in real time."
      />
      <PythhUnifiedNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Hot Matches
          </h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Live founder–investor matches from our signal engine. Click any row for details.
          </p>
        </div>
        <HotMatchesFeed
          limit={10}
          hoursAgo={720}
          showHeader={false}
          autoRefresh={true}
        />
      </main>
    </div>
  );
}
