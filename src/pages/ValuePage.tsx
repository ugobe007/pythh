/**
 * ValuePage - "What you get" page
 * 
 * Signal-to-target navigation: shows founders how Pythh takes the confusion
 * out of fundraising by making signals visible and actionable.
 * 
 * 3 tiers: Free / Signal Map (Pro) / Navigator (Elite)
 * Route: /value
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  X,
  Sparkles,
  Target,
  Zap,
  Shield,
  Users,
  TrendingUp,
  Bell,
  FileText,
  Crown,
  Route,
  Crosshair,
  Calendar,
  Brain,
  Eye,
  Activity,
  Clock,
  MessageSquare,
} from 'lucide-react';
import PythhUnifiedNav from '../components/PythhUnifiedNav';

export default function ValuePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PythhUnifiedNav />
      
      {/* Hero */}
      <div className="border-b border-white/10 pt-14">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="text-xs text-cyan-400 uppercase tracking-[0.25em] mb-4 font-mono">
            SIGNAL-TO-TARGET NAVIGATION
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Fundraising is about <span className="text-cyan-400">signal alignment</span>.
            <br />
            <span className="text-white/60">Pythh makes that visible.</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Founders don't fail because they pitch badly — they fail because they can't see the signals
            that drive investor decisions. Pythh reveals those signals and shows you exactly what to do.
          </p>
        </div>
      </div>

      {/* The Signal Navigation System */}
      <div className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-2xl font-bold text-center mb-3">
          Three layers of <span className="text-cyan-400">signal intelligence</span>
        </h2>
        <p className="text-center text-gray-400 text-sm mb-12 max-w-xl mx-auto">
          Each layer builds on the last. Start free, upgrade when you need the full navigation system.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* FREE */}
          <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Always free</div>
            <h2 className="text-2xl font-bold mb-1">Free Scan</h2>
            <p className="text-sm text-gray-500 mb-6">See your signals</p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Unlimited URL scans</div>
                  <div className="text-sm text-gray-400">Scan any company, anytime</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Top 3 investor matches</div>
                  <div className="text-sm text-gray-400">See who aligns with your signals</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">GOD Score</div>
                  <div className="text-sm text-gray-400">Your market signal strength</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Match reasoning</div>
                  <div className="text-sm text-gray-400">"Why this match" for each investor</div>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-40">
                <X className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-500">Signal Playbook</div>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-40">
                <X className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-500">Pitch Signal Scan</div>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-40">
                <X className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-500">Timing Map</div>
                </div>
              </li>
            </ul>

            <Link
              to="/"
              className="block w-full text-center px-6 py-3 border border-white/20 hover:border-white/40 rounded-xl font-semibold transition-all"
            >
              Try free scan
            </Link>
          </div>

          {/* SIGNAL MAP (Pro) */}
          <div className="p-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 relative">
            <div className="absolute -top-3 left-6 px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-full">
              POPULAR
            </div>
            <div className="text-xs text-amber-400 uppercase tracking-wide mb-2">Enhanced visibility</div>
            <h2 className="text-2xl font-bold mb-1">Signal Map</h2>
            <p className="text-sm text-gray-500 mb-6">Understand your position</p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Everything in Free</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">50+ investor matches</div>
                  <div className="text-sm text-gray-400">Full identity + profiles unlocked</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Pitch Signal Scan</div>
                  <div className="text-sm text-gray-400">How investors perceive your signals</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Daily signal updates</div>
                  <div className="text-sm text-gray-400">Which investors are warming</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Saved matches + watchlist</div>
                  <div className="text-sm text-gray-400">Track and organize targets</div>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-40">
                <X className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-500">Signal Playbook</div>
                </div>
              </li>
              <li className="flex items-start gap-3 opacity-40">
                <X className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gray-500">Timing Map</div>
                </div>
              </li>
            </ul>

            <Link
              to="/signup"
              className="block w-full text-center px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl font-semibold transition-all"
            >
              Upgrade to Signal Map
            </Link>
          </div>

          {/* NAVIGATOR (Elite) */}
          <div className="p-8 rounded-2xl border border-violet-500/30 bg-violet-500/5 relative">
            <div className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-bold rounded-full">
              FULL NAVIGATION
            </div>
            <div className="text-xs text-violet-400 uppercase tracking-wide mb-2">Complete intelligence</div>
            <h2 className="text-2xl font-bold mb-1">Navigator</h2>
            <p className="text-sm text-gray-500 mb-6">Know exactly what to do</p>
            
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Everything in Signal Map</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Signal Playbook</div>
                  <div className="text-sm text-gray-400">Per-investor approach strategy: how to reach, what to say, when to act</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Fundraising Timing Map</div>
                  <div className="text-sm text-gray-400">Week-by-week roadmap, market signals, readiness tracking</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Real-time alerts</div>
                  <div className="text-sm text-gray-400">Get notified when investor signals shift</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Export + Share</div>
                  <div className="text-sm text-gray-400">CSV export, deal memos, shareable links</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Oracle coaching</div>
                  <div className="text-sm text-gray-400">AI-guided fundraising strategy sessions</div>
                </div>
              </li>
            </ul>

            <Link
              to="/signup"
              className="block w-full text-center px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 rounded-xl font-semibold transition-all"
            >
              Go Navigator
            </Link>
            <p className="text-xs text-gray-500 text-center mt-3">
              Free to start • Upgrade anytime
            </p>
          </div>
        </div>
      </div>

      {/* Signal Navigation Features Deep-dive */}
      <div className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-2xl font-bold text-center mb-3">
            The <span className="text-cyan-400">signal navigation</span> toolkit
          </h2>
          <p className="text-center text-gray-400 text-sm mb-12 max-w-xl mx-auto">
            Fundraising is chaos without a map. These tools make investor signals visible and actionable.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Signal Playbook */}
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-500/20 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition">
                <Route className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Signal Playbook</h3>
              <p className="text-sm text-gray-400 mb-4">
                Per-investor approach strategies generated from your signal alignment data.
                Shows exactly <em>how</em> to reach each investor, <em>what</em> to emphasize,
                and <em>when</em> the timing window opens.
              </p>
              <ul className="text-xs text-gray-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 text-cyan-400/60" />
                  Best channel + opening strategy per investor
                </li>
                <li className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-cyan-400/60" />
                  Conviction triggers + deal breakers
                </li>
                <li className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-cyan-400/60" />
                  Warm intro paths mapped
                </li>
                <li className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-cyan-400/60" />
                  Timing readiness: now / soon / build
                </li>
              </ul>
            </div>

            {/* Pitch Signal Scan */}
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:border-violet-500/20 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition">
                <Crosshair className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Pitch Signal Scan</h3>
              <p className="text-sm text-gray-400 mb-4">
                Shows how investors <em>perceive</em> your startup across 5 signal dimensions.
                Identifies exactly where your signals are strong, where they're weak,
                and what to fix before every pitch.
              </p>
              <ul className="text-xs text-gray-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-violet-400/60" />
                  Narrative coherence — is your story tight?
                </li>
                <li className="flex items-center gap-1.5">
                  <Crosshair className="w-3 h-3 text-violet-400/60" />
                  Obsession density — evidence of focus
                </li>
                <li className="flex items-center gap-1.5">
                  <Eye className="w-3 h-3 text-violet-400/60" />
                  Conviction vs evidence gap
                </li>
                <li className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-violet-400/60" />
                  Fragility index — investor hesitation points
                </li>
              </ul>
            </div>

            {/* Timing Map */}
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:border-emerald-500/20 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition">
                <Calendar className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Fundraising Timing Map</h3>
              <p className="text-sm text-gray-400 mb-4">
                Timing is the most controllable variable in fundraising outcomes.
                Your map shows market temperature, your readiness metrics,
                and a week-by-week action plan calibrated to investor deployment cycles.
              </p>
              <ul className="text-xs text-gray-500 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-emerald-400/60" />
                  4-phase timeline with action items
                </li>
                <li className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-emerald-400/60" />
                  Live market signals + temperature
                </li>
                <li className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-400/60" />
                  Readiness metrics vs target thresholds
                </li>
                <li className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-emerald-400/60" />
                  8-week cadence with milestones
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* The Problem / Solution */}
      <div className="border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Without Pythh */}
            <div>
              <h3 className="text-lg font-bold text-red-400/80 mb-4 flex items-center gap-2">
                <X className="w-5 h-5" />
                Without signal navigation
              </h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-400/60 mt-1">•</span>
                  Spray-and-pray 200 investors, hear back from 3
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400/60 mt-1">•</span>
                  No idea which investors are actually deploying right now
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400/60 mt-1">•</span>
                  Pitch the same way to every investor — miss thesis alignment
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400/60 mt-1">•</span>
                  Start outreach too early or too late — miss market windows
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400/60 mt-1">•</span>
                  Months of confusion, frustration, and wasted founder time
                </li>
              </ul>
            </div>

            {/* With Pythh */}
            <div>
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                With Pythh signal navigation
              </h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  Target 30 investors who already match your signals
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  Know which investors are in active deployment mode
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  Customize approach per investor — lead with what resonates
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  Launch outreach at the exact right moment based on market data
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  8-week structured cadence — no guessing, just execution
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="border-t border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-2xl font-bold text-center mb-12">
            Who uses <span className="text-cyan-400">Pythh</span>?
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Founders</h3>
              <p className="text-sm text-gray-400 mb-4">
                See your signals through investor eyes. Target the right VCs with the right message at the right time.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Pre-seed to Series A</li>
                <li>• First-raise or repeat founders</li>
                <li>• Signal alignment, not spray-and-pray</li>
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Investors</h3>
              <p className="text-sm text-gray-400 mb-4">
                Discover startups that match your thesis before they're on every VC's radar.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Pre-screened signal-matched deal flow</li>
                <li>• Thesis-aligned discovery</li>
                <li>• Market timing intelligence</li>
              </ul>
            </div>

            <div className="p-6 rounded-xl border border-white/10">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Scouts & Advisors</h3>
              <p className="text-sm text-gray-400 mb-4">
                Help portfolio companies fundraise smarter with shareable signal maps and timing data.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Batch analysis for portfolios</li>
                <li>• Shareable signal maps</li>
                <li>• Fundraise coaching toolkit</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">
            Stop guessing. Start navigating.
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            See your signals, understand your position, know exactly what to do. 
            Start with a free scan — no account required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold rounded-xl transition-all"
            >
              Try free scan
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-white/40 text-white font-semibold rounded-xl transition-all"
            >
              See full pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
