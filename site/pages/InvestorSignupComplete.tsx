/**
 * /signup/investor/complete — post-intake confirmation for investors.
 */

import { Link } from 'wouter';
import { ArrowRight, CheckCircle2, Database, Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import SharedNavbar from '@/components/SharedNavbar';

function getCompleteParams() {
  if (typeof window === 'undefined') {
    return { profileIncomplete: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    profileIncomplete: params.get('profile') === 'incomplete',
  };
}

export default function InvestorSignupComplete() {
  const { profileIncomplete } = getCompleteParams();

  return (
    <div className="min-h-screen bg-[#090909]">
      <Helmet>
        <title>Welcome — Pythh investor network</title>
      </Helmet>
      <SharedNavbar />

      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-6 pt-20 pb-16">
        <div className="w-full max-w-lg text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-semibold text-white mb-3">
            {profileIncomplete ? "You're in — one more step" : "You're on the list"}
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            {profileIncomplete
              ? 'Your email is saved. Add firm, sectors, and check size so Pythh can route thesis-fit dealflow and track your virtual portfolio picks.'
              : 'You\'re set up to automate dealflow with Pythh. Pick up to 10 startups — we track GOD signals, funding, and momentum on your virtual portfolio over time. Connect MCP for agent-native workflow; sync to Carta, Smartsheet, and Standard Metrics coming soon.'}
          </p>

          <div className="space-y-3 text-left mb-8">
            {[
              profileIncomplete
                ? 'Finish your investor profile (under a minute)'
                : 'Pick your first startups from Explore — up to 10 tracked picks',
              'Watch score and funding deltas on your virtual portfolio',
              'Connect Pythh MCP for agent-native dealflow automation',
            ].map((line) => (
              <div key={line} className="flex items-start gap-3 text-sm text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{line}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {profileIncomplete ? (
              <Link href="/signup/investor?resume=1">
                <a className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
                  Complete profile
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Link>
            ) : (
              <Link href="/explore">
                <a className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium">
                  <Search className="w-4 h-4" />
                  Pick your first startups
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Link>
            )}

            <Link href="/investor/portfolio">
              <a className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium">
                My portfolio
              </a>
            </Link>

            <Link href="/developers">
              <a className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium">
                <Database className="w-4 h-4" />
                Connect MCP
              </a>
            </Link>
          </div>

          {!profileIncomplete && (
            <p className="text-xs text-zinc-600 mt-8">
              Dealflow alerts go live once your profile is reviewed.{' '}
              <Link href="/investor/login"><a className="text-zinc-400 hover:text-white underline-offset-2 hover:underline">Sign in later</a></Link>{' '}
              to edit your thesis anytime.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
