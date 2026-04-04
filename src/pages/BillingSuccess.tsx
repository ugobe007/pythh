/**
 * Billing Success Page
 * Shown after Stripe checkout completes.
 * Refreshes the user's plan from Supabase and celebrates the upgrade.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const PLAN_LABELS: Record<string, { name: string; color: string; tagline: string }> = {
  pro:     { name: 'Pro',            color: 'from-blue-500 to-cyan-500',    tagline: 'Full signal access unlocked.' },
  proplus: { name: 'Pro+',           color: 'from-violet-500 to-blue-500',  tagline: 'Signal intelligence + playbook exports.' },
  elite:   { name: 'Signal Navigator', color: 'from-amber-500 to-rose-500', tagline: 'Full intelligence layer. No limits.' },
};

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const { refreshProfile, profile } = useAuth();
  const [loading, setLoading]       = useState(true);
  const [planKey, setPlanKey]       = useState<string>('pro');

  useEffect(() => {
    async function activate() {
      // Give Stripe webhook ~2s to fire and update profiles.plan
      await new Promise(r => setTimeout(r, 2000));
      await refreshProfile();
      setLoading(false);

      // Detect plan from refreshed profile or session param
      const sessionPlan = searchParams.get('plan') || profile?.plan || 'pro';
      setPlanKey(sessionPlan);
    }
    activate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = PLAN_LABELS[planKey] || PLAN_LABELS.pro;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">

        {loading ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mx-auto" />
            <p className="text-zinc-400">Activating your plan…</p>
          </>
        ) : (
          <>
            {/* Success icon */}
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${plan.color} shadow-2xl mx-auto`}>
              <CheckCircle className="w-10 h-10 text-white" />
            </div>

            <div>
              <h1 className="text-4xl font-bold text-white mb-2">You're in.</h1>
              <p className="text-xl text-zinc-300">
                Welcome to <span className={`font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>{plan.name}</span>
              </p>
              <p className="text-zinc-400 mt-2">{plan.tagline}</p>
            </div>

            {/* What's unlocked */}
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 text-left space-y-3">
              <p className="text-zinc-300 font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                What just unlocked
              </p>
              {planKey === 'elite' && (
                <>
                  <Pill>50 investor matches with full confidence scores</Pill>
                  <Pill>Investor names, firms & contact hints</Pill>
                  <Pill>Signal reasoning — why each investor fits</Pill>
                  <Pill>Export matches to CSV</Pill>
                  <Pill>Full signal dimension breakdown</Pill>
                </>
              )}
              {(planKey === 'proplus') && (
                <>
                  <Pill>10 investor matches with names</Pill>
                  <Pill>Signal playbook exports</Pill>
                  <Pill>Trending sector analysis</Pill>
                  <Pill>Saved startup analyses</Pill>
                </>
              )}
              {planKey === 'pro' && (
                <>
                  <Pill>10 investor matches with names</Pill>
                  <Pill>Check size and portfolio data</Pill>
                  <Pill>Unlimited startup analyses</Pill>
                  <Pill>Signal alerts (coming soon)</Pill>
                </>
              )}
            </div>

            <button
              onClick={() => navigate('/')}
              className={`w-full py-4 px-6 rounded-xl bg-gradient-to-r ${plan.color} text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg`}
            >
              Start Analyzing
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-xs text-zinc-600">
              Billing questions? Email <a href="mailto:billing@pythh.com" className="underline hover:text-zinc-400">billing@pythh.com</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-300">
      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      {children}
    </div>
  );
}
