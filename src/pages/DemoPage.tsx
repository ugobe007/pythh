/**
 * DEMO PAGE (Doctrine-Aligned)
 * ============================
 * Renders a canned InstantMatches result with:
 * - Power Score: 74 (Forming window)
 * - Top 3 investors with fit + reason
 * - This Week plan
 * - "Why we matched" toggle (diagnostic behind it)
 * 
 * INVARIANT: /demo must immediately show "WOW" — no scan, no redirect.
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Globe,
  Building2,
  Target,
  TrendingUp,
  Zap,
  Brain,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Star,
  ArrowRight,
  HelpCircle,
  Crown,
  CheckCircle,
} from "lucide-react";

// Canned demo data - a realistic startup result
const DEMO_DATA = {
  startup: {
    name: "AutoOps AI",
    website: "https://autoops.ai",
    tagline: "AI-powered DevOps automation platform",
    sectors: ["AI/ML", "Developer Tools", "Enterprise SaaS"],
    stage: "Seed",
    total_god_score: 72,
  },
  powerScore: 74,
  signalStrength: 78,
  readiness: 72,
  fundraisingWindow: {
    label: "Forming",
    tone: "warming" as const,
    guidance: "Investors are starting to notice startups like yours. This is the ideal time for warm outreach and building relationships.",
  },
  topInvestors: [
    {
      id: "inv-1",
      name: "US Seed Operator Fund",
      firm: "Operator Partners",
      fit: 72,
      reason: "Portfolio adjacency + category heat",
      sectors: ["AI/ML", "Developer Tools"],
      stage: "Seed",
    },
    {
      id: "inv-2", 
      name: "Enterprise SaaS Seed",
      firm: "Enterprise Ventures",
      fit: 75,
      reason: "Execution cadence + benchmarks",
      sectors: ["Enterprise SaaS", "B2B"],
      stage: "Seed",
    },
    {
      id: "inv-3",
      name: "EU Infra Specialist",
      firm: "Infra Capital",
      fit: 68,
      reason: "Market signal formation",
      sectors: ["Infrastructure", "Developer Tools"],
      stage: "Seed, Series A",
    },
  ],
  actionsThisWeek: [
    { text: "Publish technical proof (benchmarks or case study)", priority: "high" },
    { text: "Warm intro to US Seed Operator Fund", priority: "high" },
    { text: "Do NOT broad outreach yet — window is forming, not prime", priority: "medium" },
  ],
};

// Color helper for Power Score
function getPowerScoreColor(score: number) {
  if (score >= 65) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

// Color helper for fundraising window
function getWindowColor(tone: string) {
  switch (tone) {
    case "prime": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "warming": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "cooling": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export default function DemoPage() {
  const [whyExpanded, setWhyExpanded] = useState(false);
  
  const demo = useMemo(() => DEMO_DATA, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0f0f0f]">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                ← Back
              </Link>
              <div className="w-px h-6 bg-gray-700" />
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  Your top investors — ranked by timing + fit
                </h1>
                <p className="text-sm text-gray-400">
                  Know who to target, when to raise, and how close you are.
                </p>
              </div>
            </div>
            {/* Demo badge */}
            <span className="px-3 py-1 text-xs bg-violet-500/20 text-violet-400 rounded-full border border-violet-500/30 flex items-center gap-1">
              <Star className="w-3 h-3" /> Demo Mode
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* STARTUP CARD */}
        <div className="mb-6 p-5 bg-gradient-to-r from-[#0f0f0f] via-[#131313] to-[#0f0f0f] border border-violet-500/30 rounded-xl shadow-lg shadow-violet-500/10">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-600/30 border border-violet-500/30 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white">{demo.startup.name}</h2>
                <a href={demo.startup.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 text-sm flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
                  <Globe className="w-4 h-4" />
                  <span>{demo.startup.website.replace("https://", "")}</span>
                </a>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {demo.startup.sectors.map((sector, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded-full border border-violet-500/30">
                      {sector}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                    {demo.startup.stage}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-400 italic">
              {demo.startup.tagline}
            </div>
          </div>
        </div>

        {/* RESULTS FIRST (3-column grid) */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Power Score (HERO) */}
          <div className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${getPowerScoreColor(demo.powerScore)}`} />
                <h3 className="text-sm font-bold text-white">Power Score</h3>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className={`text-4xl font-extrabold ${getPowerScoreColor(demo.powerScore)}`}>
                {demo.powerScore}
              </div>
              <div className="text-xs text-emerald-400">+4 today</div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Signal Strength ({demo.signalStrength}) × Readiness ({demo.readiness})
            </div>
            <div className="mt-3 text-sm text-gray-300 leading-relaxed">
              You're close. Warm outreach now; your best window is forming.
            </div>
          </div>

          {/* Fundraising Window */}
          <div className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white">Fundraising Window</h3>
            </div>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getWindowColor(demo.fundraisingWindow.tone)}`}>
              {demo.fundraisingWindow.label}
            </div>
            <div className="mt-3 text-sm text-gray-300 leading-relaxed">
              {demo.fundraisingWindow.guidance}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              This is timing. It changes as signals + readiness change.
            </div>
          </div>

          {/* Top Targets This Week */}
          <div className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Top Targets This Week</h3>
            </div>
            <div className="space-y-2">
              {demo.topInvestors.slice(0, 3).map((inv, idx) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 truncate mr-2">{inv.firm}</span>
                  <span className="text-gray-200 font-semibold">{inv.fit}%</span>
                </div>
              ))}
              <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-800">
                Pick 3. Reach out with precision. Don't spray-and-pray.
              </div>
            </div>
          </div>
        </div>

        {/* WHAT TO DO THIS WEEK (Plan) */}
        <div className="mb-6 p-4 bg-gradient-to-r from-violet-500/5 via-[#0f0f0f] to-cyan-500/5 border border-violet-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-3">What to do this week</h3>
              <ul className="space-y-2">
                {demo.actionsThisWeek.map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                      action.priority === "high" ? "text-emerald-400" : "text-gray-500"
                    }`} />
                    <span className="text-sm text-gray-300">{action.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* RANKED INVESTORS LIST */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Star className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Top 3 Matches</h3>
            <span className="px-2 py-0.5 text-[10px] rounded-full border uppercase bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              Demo Preview
            </span>
          </div>

          <div className="grid gap-3">
            {demo.topInvestors.map((inv, index) => (
              <div
                key={inv.id}
                className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-400">
                      #{index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{inv.name}</h4>
                      <p className="text-sm text-gray-400">{inv.firm}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {inv.sectors.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">
                            {s}
                          </span>
                        ))}
                        <span className="px-2 py-0.5 text-xs bg-cyan-500/10 text-cyan-400 rounded">
                          {inv.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      inv.fit >= 70 ? "text-emerald-400" : inv.fit >= 50 ? "text-amber-400" : "text-gray-400"
                    }`}>
                      {inv.fit}%
                    </div>
                    <div className="text-xs text-gray-500">fit</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-sm text-gray-400 italic">{inv.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WHY WE MATCHED TOGGLE */}
        <div className="mb-6">
          <button
            onClick={() => setWhyExpanded(!whyExpanded)}
            className="w-full p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                  Why we matched you
                </span>
              </div>
              {whyExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500 group-hover:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-400" />
              )}
            </div>
          </button>
          
          {whyExpanded && (
            <div className="mt-3 p-4 bg-[#0a0a0a] border border-gray-800 rounded-xl">
              <p className="text-sm text-gray-400 mb-4">
                We analyzed your startup against <strong className="text-white">{demo.topInvestors.length * 50}+ investors</strong> based on:
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Sector alignment</strong> — Do they invest in your space?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Stage fit</strong> — Are they writing checks at your stage?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Signal strength</strong> — Are they actively looking at similar deals?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Readiness (GOD Score)</strong> — Is your startup ready for their attention?
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-8 p-6 bg-gradient-to-r from-violet-600/10 via-[#0f0f0f] to-cyan-600/10 border border-violet-500/20 rounded-xl text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Ready to find your investors?</h3>
          <p className="text-gray-400 text-sm mb-4">
            Enter your startup URL and get your personalized investor matches in seconds.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all"
          >
            Try with your startup
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
