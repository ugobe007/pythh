/**
 * SIGNUP LANDING PAGE
 * ===================
 * Supabase-style split layout: selection left, instructive content right
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Activity, Eye, Zap, Shield, BarChart3, Users } from 'lucide-react';
import PythhTopNav from '../components/PythhTopNav';
import { useAuth } from '../contexts/AuthContext';

export default function SignupLanding() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (isLoggedIn && user) {
      navigate('/dashboard');
    }
  }, [isLoggedIn, user, navigate]);

  return (
    <div className="min-h-screen bg-[#090909]">
      <PythhTopNav showSignup={false} />

      <div className="min-h-[calc(100vh-65px)] flex">
        {/* LEFT — Selection */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold text-white mb-1">
              Get started
            </h1>
            <p className="text-sm text-zinc-500 mb-8">
              Choose your path to begin.
            </p>

            {/* Founder Card */}
            <Link
              to="/signup/founder"
              className="group block p-5 bg-[#111] border border-zinc-800/80 rounded-lg hover:border-zinc-700 transition-all mb-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <h2 className="text-sm font-medium text-white">Founder</h2>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    See which investors are aligned with your startup right now. Get signal-based matches, GOD scoring, and outreach intelligence.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0 ml-4" />
              </div>
            </Link>

            {/* Investor Card */}
            <Link
              to="/signup/investor"
              className="group block p-5 bg-[#111] border border-zinc-800/80 rounded-lg hover:border-zinc-700 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    </span>
                    <h2 className="text-sm font-medium text-white">Investor</h2>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Surface high-signal startups before they hit your inbox. Behavioral pattern matching across the entire market.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0 ml-4" />
              </div>
            </Link>

            <div className="my-6 border-t border-zinc-800/60" />

            <p className="text-center text-zinc-600 text-xs">
              Already have an account?{' '}
              <Link to="/login" className="text-zinc-400 hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* RIGHT — Instructive content */}
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#0c0c0c] border-l border-zinc-800/40 p-12">
          <div className="max-w-sm space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                How Pythh works
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Pythh analyzes real-time investor behavior, market signals, and startup positioning to generate high-confidence matches. No spray-and-pray — just precision.
              </p>
            </div>

            <div className="space-y-4">
              <InfoRow
                icon={<Activity className="w-4 h-4 text-emerald-400" />}
                title="Signal scoring"
                detail="Real-time market attention analysis across 5 signal dimensions."
              />
              <InfoRow
                icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
                title="GOD algorithm"
                detail="22+ weighted models score your startup 0-100. Continuously recalibrated."
              />
              <InfoRow
                icon={<Users className="w-4 h-4 text-violet-400" />}
                title="Investor matching"
                detail="Signal strength x thesis alignment x timing window = actionable matches."
              />
              <InfoRow
                icon={<Shield className="w-4 h-4 text-zinc-400" />}
                title="Private by default"
                detail="Your data is never shared with investors unless you initiate contact."
              />
            </div>

            <div className="pt-4 border-t border-zinc-800/40">
              <p className="text-xs text-zinc-600">
                Over 2,400 startups and 1,200 investors on the platform. Matches update every 10 seconds as signals shift.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-zinc-300">{title}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}
