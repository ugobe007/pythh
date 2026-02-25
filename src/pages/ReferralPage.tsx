/**
 * /referral — Referral / invite program page
 * ════════════════════════════════════════════
 * Drives invites + shows reward progress.
 * Uses existing ReferralCard + useReferrals hook.
 */

import { Link } from 'react-router-dom';
import { Gift, Users, Star, ArrowRight, CheckCircle } from 'lucide-react';
import ReferralCard from '../components/ReferralCard';
import { useAuth } from '../contexts/AuthContext';

const HOW_IT_WORKS = [
  { icon: Users, label: 'Invite 3 investors or founders', desc: 'Share your personal invite link via Slack, LinkedIn, or email.' },
  { icon: CheckCircle, label: 'They sign up & activate', desc: 'A friend "activates" once they complete onboarding — takes 2 minutes.' },
  { icon: Star, label: 'You get Signal Navigator free', desc: 'Unlock our $29.99/mo tier (Bloomberg-level deal intelligence) for 30 days.' },
];

export default function ReferralPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="max-w-2xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Invite Friends,<br />Unlock Signal Navigator Free
          </h1>
          <p className="text-zinc-400 text-base max-w-md mx-auto">
            Refer 3 active users and get 30 days of our Signal Navigator tier
            ($29.99/mo) absolutely free. No credit card needed.
          </p>
        </div>

        {/* How it works */}
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-5 text-center font-medium">How it works</h2>
          <div className="space-y-4">
            {HOW_IT_WORKS.map(({ icon: Icon, label, desc }, i) => (
              <div key={label} className="flex items-start gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-400">
                  {i + 1}
                </div>
                <div>
                  <div className="text-white font-medium text-sm">{label}</div>
                  <div className="text-zinc-500 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ReferralCard (handles invite creation + progress) */}
        {user ? (
          <ReferralCard />
        ) : (
          <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center">
            <p className="text-zinc-400 text-sm mb-4">Sign in to get your invite link and track your progress.</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition text-sm"
            >
              Sign In to Start
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Fine print */}
        <p className="text-zinc-700 text-xs text-center mt-8">
          Reward is a 30-day Signal Navigator entitlement, non-transferable, applied once per 90-day period.
          Friends must complete onboarding to count as activated.
        </p>
      </div>
    </div>
  );
}
