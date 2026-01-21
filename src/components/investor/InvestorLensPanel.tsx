/**
 * INVESTOR LENS PANEL — v1.1
 * ==========================
 * The crown jewel of Pythh's moat layer.
 * 
 * This shows HOW an investor decides — not bio, not portfolio, not contact info.
 * 
 * Sections:
 * 1. Header - Context, not marketing
 * 2. Signals this investor responds to
 * 3. Why you are aligned
 * 4. How founders usually reach this investor
 * 5. Timing & Preparation
 * 6. NEW: Investor Prep Mode (Action Layer)
 * 7. Soft action footer
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, Bell, ChevronRight, Compass } from 'lucide-react';
import { InvestorPrepMode, InvestorPrepModeMini } from './InvestorPrepMode';
import type { InvestorPrepProfile } from '../../lib/database.types';

// Types
export interface InvestorSignal {
  name: string;
  observation: string;
}

export interface InvestorFingerprint {
  id: string;
  name: string;
  focus: string; // e.g., "Seed / Series A — Infra, AI"
  typicalEntry: string; // e.g., "Pre-seed → Series A"
  dominantSignals: InvestorSignal[];
  engagementPatterns: string[];
  timingPatterns: string[];
  responseTriggers: string[];
}

export interface AlignmentExplanation {
  bullets: string[]; // Exactly 3
}

export interface InvestorLensData {
  fingerprint: InvestorFingerprint;
  alignment: AlignmentExplanation;
  isAligned: boolean;
  prepProfile?: InvestorPrepProfile; // NEW: Action Layer
}

interface InvestorLensPanelProps {
  data: InvestorLensData;
  startupId?: string;
  startupData?: Record<string, unknown>; // NEW: For prep mode assessment
  onTrackAlignment?: () => void;
  isTracking?: boolean;
}

export default function InvestorLensPanel({
  data,
  startupId,
  startupData,
  onTrackAlignment,
  isTracking = false
}: InvestorLensPanelProps) {
  const { fingerprint, alignment, isAligned, prepProfile } = data;
  const [showPrepMode, setShowPrepMode] = useState(false);

  return (
    <div className="space-y-10">
      
      {/* ============================================ */}
      {/* HEADER BLOCK — Context, not marketing */}
      {/* ============================================ */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">
            {fingerprint.name}
          </h1>
          <p className="text-gray-400 mb-1">
            Focus: {fingerprint.focus}
          </p>
          <p className="text-sm text-gray-500">
            Typical entry: {fingerprint.typicalEntry}
          </p>
        </div>
        
        {/* Aligned badge */}
        {isAligned && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <Check className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">
              Aligned with your current signals
            </span>
          </div>
        )}
      </header>

      {/* ============================================ */}
      {/* SECTION 1 — Signals this investor responds to */}
      {/* ============================================ */}
      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Signals this investor responds to
          </h2>
          <p className="text-sm text-gray-500">
            Based on patterns across prior investments and screening behavior.
          </p>
        </div>

        <div className="space-y-4">
          {fingerprint.dominantSignals.slice(0, 7).map((signal, i) => (
            <div 
              key={i}
              className="p-5 bg-[#111111] border border-gray-800 rounded-xl"
            >
              <p className="font-medium text-white mb-1">{signal.name}</p>
              <p className="text-sm text-gray-400">{signal.observation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2 — Why you are aligned */}
      {/* ============================================ */}
      {isAligned && alignment.bullets.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              Why you appear in their discovery flow
            </h2>
          </div>

          <div className="p-6 bg-[#111111] border border-amber-500/20 rounded-xl">
            <ul className="space-y-3">
              {alignment.bullets.slice(0, 3).map((bullet, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-300">
                  <span className="text-amber-500/60 mt-0.5">•</span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* SECTION 3 — How founders usually reach this investor */}
      {/* ============================================ */}
      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            How founders usually reach this investor
          </h2>
        </div>

        <div className="p-6 bg-[#111111] border border-gray-800 rounded-xl">
          <ul className="space-y-3">
            {fingerprint.engagementPatterns.slice(0, 6).map((pattern, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-400">
                <span className="text-gray-600 mt-0.5">{i + 1}.</span>
                {pattern}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 4 — Timing & Preparation */}
      {/* ============================================ */}
      <section className="grid md:grid-cols-2 gap-6">
        {/* Block A: Best timing */}
        <div className="p-6 bg-[#111111] border border-gray-800 rounded-xl">
          <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">
            Best timing to reach out
          </h3>
          <ul className="space-y-2">
            {fingerprint.timingPatterns.slice(0, 5).map((timing, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="text-amber-500/60 mt-1">→</span>
                {timing}
              </li>
            ))}
          </ul>
        </div>

        {/* Block B: What triggers responses */}
        <div className="p-6 bg-[#111111] border border-gray-800 rounded-xl">
          <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">
            What typically triggers a response
          </h3>
          <ul className="space-y-2">
            {fingerprint.responseTriggers.slice(0, 5).map((trigger, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="text-amber-500/60 mt-1">→</span>
                {trigger}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 5 — Investor Prep Mode (Action Layer) */}
      {/* ============================================ */}
      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            Are you ready to enter their flow?
          </h2>
          <p className="text-sm text-gray-500">
            Assess your current readiness and discover the best path forward.
          </p>
        </div>

        {showPrepMode ? (
          <InvestorPrepMode
            investor={{
              id: fingerprint.id,
              name: fingerprint.name,
              sectors: fingerprint.focus.split(',').map(s => s.trim()),
              stage: fingerprint.typicalEntry,
              prep_profile: prepProfile
            }}
            startupData={startupData}
            onClose={() => setShowPrepMode(false)}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Mini Prep Mode card */}
            <InvestorPrepModeMini
              investor={{
                id: fingerprint.id,
                name: fingerprint.name,
                sectors: fingerprint.focus.split(',').map(s => s.trim()),
                stage: fingerprint.typicalEntry,
                prep_profile: prepProfile
              }}
              startupData={startupData}
              onExpand={() => setShowPrepMode(true)}
            />
            
            {/* CTA card */}
            <button
              onClick={() => setShowPrepMode(true)}
              className="p-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 hover:border-amber-500/40 rounded-xl transition-all group text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <Compass className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-white">
                  Full Preparation Analysis
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                See signal gaps, timing assessment, entry paths, and recommended next steps.
              </p>
              <span className="text-xs text-amber-400 group-hover:text-amber-300 transition-colors">
                Open full prep mode →
              </span>
            </button>
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* SECTION 6 — Soft Action Footer */}
      {/* ============================================ */}
      <footer className="pt-8 border-t border-gray-800">
        {/* Strategic positioning statement */}
        <p className="text-sm text-gray-500 mb-6 text-center">
          Pythh doesn't introduce founders.<br />
          It shows you how to enter the flow correctly.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Primary: View similar founders */}
          <Link
            to={`/gallery?investor=${encodeURIComponent(fingerprint.focus)}&investorName=${encodeURIComponent(fingerprint.name)}`}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">View similar founders who aligned</span>
            <ChevronRight className="w-4 h-4" />
          </Link>

          {/* Secondary: Track alignment */}
          {onTrackAlignment && (
            <button
              onClick={onTrackAlignment}
              disabled={isTracking}
              className={`flex items-center gap-2 px-6 py-3 rounded-full transition-colors ${
                isTracking 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-500/10 border border-slate-500/30 text-slate-300 hover:bg-slate-500/15'
              }`}
            >
              {isTracking ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Tracking alignment</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span className="text-sm font-medium">Track alignment with this investor</span>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
