/**
 * PYTHH INVESTOR PROFILE — LIFEFORM (CANONICAL)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Investor profiles answer ONE question:
 * "How does this investor behave over time, and when do they engage?"
 * 
 * They are NOT:
 * - resumes
 * - logos + portfolio porn
 * - contact cards
 * - promises of access
 * 
 * If a founder leaves thinking "I should email them", the page failed.
 * If they leave thinking "I should watch them", it worked.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import SaveToSignalCard from '../components/SaveToSignalCard';
import ShareButton from '../components/ShareButton';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type AlignmentState = 'Monitoring' | 'Warming' | 'Cooling' | 'Dormant';

interface InvestorData {
  name: string;
  focus: string;
  stage: string;
  observedSince: string;
  // Behavioral Summary (3 bullets max)
  behavioralPattern: string[];
  // Recent Behavior (≤30 days)
  recentBehavior: string[];
  // Alignment & Timing
  alignmentState: AlignmentState;
  lensScore: number;
  timing: 'Cooling' | 'Warming' | 'Active' | 'Dormant';
  // Competitive Context
  relativeBehavior: string[];
  // Signals they respond to
  signalsTheyRespondTo: string[];
  // Quiet guidance
  quietGuidance: string;
}

// ═══════════════════════════════════════════════════════════════
// INVESTOR DATA (would come from API)
// ═══════════════════════════════════════════════════════════════

const investorData: Record<string, InvestorData> = {
  'sequoia': {
    name: 'Sequoia Capital',
    focus: 'Enterprise, Infra, SaaS',
    stage: 'Seed → Series B',
    observedSince: '2016',
    behavioralPattern: [
      'Engages after sustained momentum, not spikes',
      'Prefers category clarity over early experimentation',
      'Historically avoids crowded entry points',
    ],
    recentBehavior: [
      'Increased activity in AI Infra',
      'Quiet in FinTech APIs',
      'Last engagement window: ~3 weeks ago',
    ],
    alignmentState: 'Cooling',
    lensScore: 84.1,
    timing: 'Cooling',
    relativeBehavior: [
      'Often engages later than a16z in this category',
      'Moves earlier than Greylock during infrastructure cycles',
    ],
    signalsTheyRespondTo: [
      'Hiring acceleration',
      'Enterprise keyword emergence',
      'Sustained category leadership signals',
    ],
    quietGuidance: 'Most founders monitor this investor before engaging.',
  },
  'general-catalyst': {
    name: 'General Catalyst',
    focus: 'FinTech, Enterprise, Growth',
    stage: 'Seed → Series B',
    observedSince: '2018',
    behavioralPattern: [
      'Moves quickly when thesis aligns',
      'Prefers warm intros but responds cold',
      'Engages during expansion phases, not contraction',
    ],
    recentBehavior: [
      'Active FinTech API scanning',
      'Stable in AI Infrastructure',
      'Quiet in B2B SaaS',
    ],
    alignmentState: 'Warming',
    lensScore: 82.4,
    timing: 'Active',
    relativeBehavior: [
      'Moves faster than Sequoia in fintech',
      'Often co-invests with QED in this category',
    ],
    signalsTheyRespondTo: [
      'Revenue acceleration',
      'Partnership announcements',
      'Category momentum indicators',
    ],
    quietGuidance: 'This investor typically engages after momentum stabilizes.',
  },
  'a16z': {
    name: 'a16z Fintech',
    focus: 'FinTech, Crypto, Infra',
    stage: 'Seed → Series C',
    observedSince: '2019',
    behavioralPattern: [
      'Engages early in category formation',
      'Favors technical founders with infrastructure background',
      'Moves aggressively once conviction forms',
    ],
    recentBehavior: [
      'Increased activity in payments infrastructure',
      'Active in AI-adjacent fintech',
      'Last deployment: ~2 weeks ago',
    ],
    alignmentState: 'Warming',
    lensScore: 80.2,
    timing: 'Active',
    relativeBehavior: [
      'Moves earlier than Sequoia in emerging categories',
      'Often leads rounds that Index follows',
    ],
    signalsTheyRespondTo: [
      'Technical talent concentration',
      'API/infrastructure positioning',
      'Category creation signals',
    ],
    quietGuidance: 'This investor typically engages after momentum stabilizes.',
  },
  'ribbit': {
    name: 'Ribbit Capital',
    focus: 'FinTech (pure play)',
    stage: 'Seed → Series B',
    observedSince: '2017',
    behavioralPattern: [
      'Deep fintech expertise drives faster diligence',
      'Prefers founders with financial services background',
      'Patient with regulatory complexity',
    ],
    recentBehavior: [
      'Active in embedded finance',
      'Increased scanning of payments APIs',
      'Quiet in crypto-adjacent fintech',
    ],
    alignmentState: 'Warming',
    lensScore: 78.9,
    timing: 'Active',
    relativeBehavior: [
      'Moves faster than generalists in fintech',
      'Often competes with QED for sector deals',
    ],
    signalsTheyRespondTo: [
      'Regulatory moat signals',
      'Partnership with banks/FIs',
      'Payment volume growth',
    ],
    quietGuidance: 'Founders with fintech-native positioning see stronger engagement.',
  },
  'index': {
    name: 'Index Ventures',
    focus: 'Consumer, Enterprise, FinTech',
    stage: 'Seed → Series C',
    observedSince: '2015',
    behavioralPattern: [
      'Engages steadily across market cycles',
      'Prefers product-led growth narratives',
      'European origin means broader geo coverage',
    ],
    recentBehavior: [
      'Warming in FinTech APIs',
      'Stable across enterprise categories',
      'Last engagement window: ~1 week ago',
    ],
    alignmentState: 'Monitoring',
    lensScore: 79.1,
    timing: 'Warming',
    relativeBehavior: [
      'More patient than US-only funds',
      'Often follows conviction from European signals',
    ],
    signalsTheyRespondTo: [
      'Product-led growth metrics',
      'European expansion signals',
      'Developer adoption indicators',
    ],
    quietGuidance: 'Many founders monitor this investor before engaging.',
  },
  'qed': {
    name: 'QED Investors',
    focus: 'FinTech (pure play)',
    stage: 'Seed → Series A',
    observedSince: '2016',
    behavioralPattern: [
      'Capital One heritage = deep credit/lending expertise',
      'Prefers data-driven founders',
      'Patient with unit economics validation',
    ],
    recentBehavior: [
      'Active in embedded lending',
      'Stable in payments infrastructure',
      'Quiet in B2B neobanking',
    ],
    alignmentState: 'Monitoring',
    lensScore: 75.4,
    timing: 'Warming',
    relativeBehavior: [
      'Often co-invests with Ribbit',
      'Moves slower than generalists but with higher conviction',
    ],
    signalsTheyRespondTo: [
      'Unit economics clarity',
      'Data infrastructure signals',
      'Lending/credit market positioning',
    ],
    quietGuidance: 'Many founders monitor this investor before engaging.',
  },
};

// Default for unknown IDs
const defaultInvestor: InvestorData = {
  name: 'Unknown Investor',
  focus: 'Unknown',
  stage: 'Unknown',
  observedSince: '—',
  behavioralPattern: [
    'Insufficient data for pattern analysis',
  ],
  recentBehavior: [
    'No recent activity detected',
  ],
  alignmentState: 'Dormant',
  lensScore: 0,
  timing: 'Dormant',
  relativeBehavior: [],
  signalsTheyRespondTo: [],
  quietGuidance: 'Insufficient data to provide guidance.',
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function InvestorProfile() {
  const { id } = useParams();
  const investor = investorData[id || ''] || defaultInvestor;
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Demo: Check if startup is claimed
  const startupClaimed = true;
  const startup = {
    name: 'FinTech API',
    stage: 'Seed',
  };

  // Lifeform breathing
  useEffect(() => {
    const interval = setInterval(() => {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 1200);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Style helpers
  const alignmentColor = (state: AlignmentState): string => {
    switch (state) {
      case 'Warming': return 'text-[#3ECF8E]';
      case 'Monitoring': return 'text-[#8f8f8f]';
      case 'Cooling': return 'text-amber-400';
      case 'Dormant': return 'text-[#5f5f5f]';
    }
  };

  const timingColor = (t: string): string => {
    if (t === 'Active') return 'text-[#3ECF8E]';
    if (t === 'Warming') return 'text-[#8f8f8f]';
    if (t === 'Cooling') return 'text-amber-400';
    return 'text-[#5f5f5f]';
  };

  // Score click → Score Drawer (lens locked)
  const handleScoreClick = () => {
    console.log('Open score drawer for', investor.name);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Lifeform animations */}
      <style>{`
        @keyframes profileFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes updateFade {
          0%, 100% { opacity: 0; }
          20%, 80% { opacity: 1; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <header className="border-b border-[#2e2e2e]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app" className="text-white font-medium">pythh</Link>
            <span className="text-[#5f5f5f]">/</span>
            <Link to="/app/matches" className="text-[#8f8f8f] hover:text-white transition-colors">matches</Link>
            <span className="text-[#5f5f5f]">/</span>
            <span className="text-[#8f8f8f]">{id}</span>
          </div>
          <span className="text-xs text-[#5f5f5f]">
            {isUpdating ? (
              <span style={{ animation: 'updateFade 1.2s ease-in-out' }}>updating…</span>
            ) : (
              'Live'
            )}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        
        {/* ═══════════════════════════════════════════════════════════════
            1️⃣ IDENTITY STRIP — Minimal, human + Save/Share
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-xl text-white font-medium">{investor.name}</h1>
            <div className="flex items-center gap-3">
              <SaveToSignalCard
                entityType="investor"
                entityId={id || ''}
                entityName={investor.name}
                scoreValue={investor.lensScore}
                context="from profile header"
                size="sm"
              />
              <ShareButton
                payload={{
                  type: 'investor_brief',
                  investorName: investor.name,
                  behavioralPattern: investor.behavioralPattern,
                  timing: investor.timing,
                  signalsTheyRespondTo: investor.signalsTheyRespondTo,
                }}
                expandable
                linkPayload={{
                  share_type: 'investor_brief',
                  investor_id: id,
                  investor_name: investor.name,
                  timing_state: investor.timing || 'stable',
                  behavioral_pattern: investor.behavioralPattern?.slice(0, 3) || [],
                  signals_respond_to: investor.signalsTheyRespondTo?.slice(0, 5) || [],
                  recent_behavior: investor.recentBehavior?.slice(0, 3) || [],
                  competitive_context: investor.relativeBehavior?.slice(0, 2) || [],
                  snapshot: {
                    investor_name: investor.name,
                    focus: investor.focus,
                    stage: investor.stage,
                    timing_state: investor.timing || 'stable',
                    behavioral_pattern: investor.behavioralPattern?.slice(0, 3) || [],
                    signals_respond_to: investor.signalsTheyRespondTo?.slice(0, 5) || [],
                    recent_behavior: investor.recentBehavior?.slice(0, 3) || [],
                    competitive_context: investor.relativeBehavior?.slice(0, 2) || [],
                  },
                  redaction_level: 'public',
                }}
                size="sm"
              />
            </div>
          </div>
          <div className="text-sm text-[#8f8f8f] space-y-1">
            <p>Focus: {investor.focus}</p>
            <p>Stage: {investor.stage}</p>
            <p className="text-[#5f5f5f] text-xs mt-2">Observed since: {investor.observedSince}</p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            2️⃣ BEHAVIORAL SUMMARY — This is the soul (3 bullets max)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="text-[#5f5f5f] text-sm mb-3">Behavioral pattern</div>
          <div className="space-y-2">
            {investor.behavioralPattern.map((pattern, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[#5f5f5f] mt-0.5">•</span>
                <span className="text-[#c0c0c0]">{pattern}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            3️⃣ RECENT BEHAVIOR — Lifeform core (≤30 days)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="text-[#5f5f5f] text-sm mb-3">Recent behavior</div>
          <div className="space-y-2">
            {investor.recentBehavior.map((item, i) => (
              <div 
                key={i} 
                className="flex items-start gap-2 text-sm"
                style={{ animation: `profileFadeIn 0.2s ease-out ${i * 0.05}s both` }}
              >
                <span className="text-[#5f5f5f] mt-0.5">•</span>
                <span className="text-[#8f8f8f]">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            4️⃣ ALIGNMENT & TIMING — This is discipline
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10 bg-[#232323] rounded-lg border border-[#2e2e2e] p-5">
          {startupClaimed ? (
            <>
              <div className="text-[#5f5f5f] text-sm mb-4">Your alignment</div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-[#5f5f5f] block mb-1">Current state</span>
                  <span className={alignmentColor(investor.alignmentState)}>
                    {investor.alignmentState}
                  </span>
                </div>
                <div>
                  <span className="text-[#5f5f5f] block mb-1">Lens score</span>
                  <span 
                    className="text-white font-mono cursor-pointer hover:text-[#3ECF8E] transition-colors"
                    onClick={handleScoreClick}
                  >
                    {investor.lensScore} <span className="text-[#5f5f5f] text-xs">(GOD)</span>
                  </span>
                </div>
                <div>
                  <span className="text-[#5f5f5f] block mb-1">Timing</span>
                  <span className={timingColor(investor.timing)}>
                    {investor.timing}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-[#8f8f8f] text-sm">
              Claim your startup to see alignment and timing.
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            5️⃣ COMPETITIVE CONTEXT — Relative, not flattering
        ═══════════════════════════════════════════════════════════════ */}
        {investor.relativeBehavior.length > 0 && (
          <section className="mb-10">
            <div className="text-[#5f5f5f] text-sm mb-3">Relative behavior</div>
            <div className="space-y-2">
              {investor.relativeBehavior.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[#5f5f5f] mt-0.5">•</span>
                  <span className="text-[#8f8f8f]">{item}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            6️⃣ SIGNALS THEY RESPOND TO — Historical correlations
        ═══════════════════════════════════════════════════════════════ */}
        {investor.signalsTheyRespondTo.length > 0 && (
          <section className="mb-10">
            <div className="text-[#5f5f5f] text-sm mb-3">Signals this investor responds to</div>
            <div className="space-y-2">
              {investor.signalsTheyRespondTo.map((signal, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[#5f5f5f] mt-0.5">•</span>
                  <span className="text-[#8f8f8f]">{signal}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            7️⃣ QUIET GUIDANCE — One line, no emphasis
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10 pl-4 border-l border-[#2e2e2e]">
          <p className="text-sm text-[#5f5f5f]">{investor.quietGuidance}</p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            QUIET EXIT
        ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-4">
          <Link 
            to="/app/matches"
            className="text-[#8f8f8f] hover:text-[#c0c0c0] text-sm transition-colors"
          >
            ← Back to matches
          </Link>
        </div>
        
      </main>
    </div>
  );
}
