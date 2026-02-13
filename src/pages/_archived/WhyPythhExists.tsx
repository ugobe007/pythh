/**
 * WHY PYTHH EXISTS PAGE
 * =====================
 * VC-Safe positioning (does not antagonize VCs)
 * Frames Pythh as infrastructure, not critique
 * Category: Signal Intelligence for Fundraising
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Brain, Target, Zap, TrendingUp } from 'lucide-react';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

export default function WhyPythhExists() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <LogoDropdownMenu />

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-20">
        {/* Back */}
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
          Why Pythh Exists
        </h1>

        {/* Article content */}
        <article className="prose prose-invert prose-lg max-w-none">
          {/* Opening */}
          <p className="text-xl text-gray-300 leading-relaxed mb-8">
            Fundraising outcomes are not random — but the signals that drive them are often invisible.
          </p>

          {/* Body */}
          <div className="space-y-6 text-gray-400 leading-relaxed">
            <p>
              Investors develop patterns over time: what they fund, when they lean in, how they size checks, and which signals prompt action. Founders, meanwhile, are forced to guess — often relying on warm intros, outdated lists, or generic advice.
            </p>

            <p className="text-white font-medium">
              Pythh exists to reduce that guesswork.
            </p>

            <p>
              We analyze live market signals, investor behavior, and historical funding patterns to surface which investors are most likely to engage with a startup <em>right now</em> — based on real alignment, not reputation or keyword overlap.
            </p>

            <div className="my-10 p-6 bg-[#111111] border border-gray-800 rounded-xl">
              <p className="text-gray-300 text-base italic m-0">
                Pythh does not replace human judgment.<br />
                It gives founders better information before conversations begin.
              </p>
            </div>

            <p className="text-amber-400 font-semibold">
              Not certainty. Probability.
            </p>

            <p>
              Our <span className="text-violet-400 font-medium">GOD Algorithm</span> evaluates hundreds of signals across timing, traction, market dynamics, and investor behavior to help founders focus their energy where it has the highest chance of compounding.
            </p>

            <div className="my-10 p-6 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 rounded-xl">
              <p className="text-white text-lg font-medium m-0">
                We don't promise funding.<br />
                We promise clarity.
              </p>
            </div>

            <p className="text-gray-500 text-lg pt-4 border-t border-gray-800">
              Fundraising is hard enough. Guessing shouldn't be part of it.
            </p>
          </div>
        </article>

        {/* Divider */}
        <div className="my-12 border-t border-gray-800" />

        {/* What Pythh Is / Is Not */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* What Pythh Is NOT */}
          <div className="p-6 bg-[#111111] border border-gray-800 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-400 mb-4">What Pythh Is Not</h3>
            <ul className="space-y-2 text-gray-500">
              <li className="flex items-center gap-2">
                <span className="text-red-500">✕</span>
                A pitch platform
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500">✕</span>
                An intro network
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500">✕</span>
                A CRM
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-500">✕</span>
                A scoring vanity tool
              </li>
            </ul>
          </div>

          {/* What Pythh IS */}
          <div className="p-6 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/30 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">What Pythh Is</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-center gap-3">
                <Target className="w-5 h-5 text-violet-400 flex-shrink-0" />
                A probability lens
              </li>
              <li className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                A timing engine
              </li>
              <li className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                A signal interpreter
              </li>
              <li className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-400 flex-shrink-0" />
                A fundraising force-multiplier
              </li>
            </ul>
          </div>
        </div>

        {/* Category definition */}
        <div className="p-6 bg-[#111111] border border-amber-500/30 rounded-xl mb-12">
          <div className="text-xs text-amber-500 uppercase tracking-wider mb-2">Category</div>
          <h3 className="text-2xl font-bold text-white mb-2">Signal Intelligence for Fundraising</h3>
          <p className="text-gray-500 text-sm">
            Not matching. Not marketplaces. Not CRM. Not pitch tools.
          </p>
        </div>

        {/* Canon statement */}
        <div className="text-center p-8 bg-gradient-to-r from-amber-500/10 via-[#0a0a0a] to-violet-500/10 border border-gray-800 rounded-xl">
          <p className="text-2xl font-semibold text-white leading-relaxed">
            Pythh reads investor signals so founders don't have to guess.
          </p>
          <p className="text-gray-600 text-xs mt-4 uppercase tracking-wider">
            One-Line Canon
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20"
          >
            Find my investors
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 text-xs mt-4">
            Free scan. No account required.
          </p>
        </div>
      </div>
    </div>
  );
}
