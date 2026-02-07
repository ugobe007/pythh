/**
 * SIGNUP LANDING PAGE
 * ===================
 * Clean selection between Founder and Investor paths
 * Supabase-style: minimal, monochromatic with green accent
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PythhTopNav from '../components/PythhTopNav';

export default function SignupLanding() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Top Nav */}
      <PythhTopNav showSignup={false} />

      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-65px)]">
        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-white mb-2">
              Get started with Pythh
            </h1>
            <p className="text-zinc-500 text-sm">
              Choose how you'll use the platform
            </p>
          </div>

          {/* Selection Cards */}
          <div className="space-y-3">
            {/* Founder Card */}
            <Link
              to="/signup/founder"
              className="group flex items-center justify-between p-4 bg-[#111111] border border-zinc-800 rounded-lg hover:border-zinc-700 hover:bg-[#161616] transition-colors"
            >
              <div>
                <h2 className="text-sm font-medium text-white mb-0.5">
                  I'm a Founder
                </h2>
                <p className="text-xs text-zinc-500">
                  Track investor signals for your startup
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </Link>

            {/* Investor Card */}
            <Link
              to="/signup/investor"
              className="group flex items-center justify-between p-4 bg-[#111111] border border-zinc-800 rounded-lg hover:border-zinc-700 hover:bg-[#161616] transition-colors"
            >
              <div>
                <h2 className="text-sm font-medium text-white mb-0.5">
                  I'm an Investor
                </h2>
                <p className="text-xs text-zinc-500">
                  Surface patterns across the market
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </Link>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-zinc-800" />

          {/* Already have account */}
          <p className="text-center text-zinc-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
