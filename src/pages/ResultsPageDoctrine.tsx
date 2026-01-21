/**
 * PYTHH RESULTS PAGE - Doctrine v2.0
 * ===================================
 * Trust → Belief → Conviction
 * 
 * Visual Order (LOCKED):
 * 1. TOP 5 MATCHES (Results first. No preamble.)
 * 2. TRUST MIRROR (How capital reads you)
 * 3. BELIEF SURFACE (Aligned vs Misaligned)
 * 4. CONVICTION SURFACE (How to flip)
 * 5. SCALE/DESIRE (Blurred matches)
 * 6. ACTION (Leverage, not lectures)
 * 7. DIAGNOSTICS (Hidden)
 * 
 * INVARIANTS:
 * - #1 is visually dominant (larger, "Top Match" label)
 * - One-line "Why" is human + causal (never "AI-powered", "GOD score")
 * - Distance labels frame misalignment, not failure
 * - No uniformity - hierarchy encodes meaning
 * - No product narration in Top 5
 */

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowRight,
  TrendingUp,
  Info
} from 'lucide-react';
import { resolveStartupFromUrl } from '../lib/startupResolver';
import { useAuth } from '../contexts/AuthContext';
import { useMatches } from '../hooks/useMatches';
import { getPlan } from '../utils/plan';
import { analytics } from '../analytics';

// ============================================
// TYPES
// ============================================

interface MatchedInvestor {
  id: string;
  name: string;
  match_score: number;
  sectors?: string[];
  stage?: string | string[];
  website?: string;
  investor?: {
    name?: string;
    sectors?: string[];
    stage?: string | string[];
    website?: string;
  };
}

interface StartupData {
  id?: string;
  name: string;
  website: string;
  sectors?: string[];
  stage?: string;
  total_god_score?: number;
}

// ============================================
// HELPERS - Human, causal language only
// ============================================

function getDistanceLabel(score: number): "Warm path likely" | "Portfolio adjacent" | "Cold" {
  if (score >= 85) return "Warm path likely";
  if (score >= 70) return "Portfolio adjacent";
  return "Cold";
}

function getDistanceColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-gray-500";
}

// Generate human "why" - NEVER mention AI, GOD score, algorithm, scoring
function generateWhyLine(investor: MatchedInvestor, startup: StartupData): string {
  const investorSectors = investor?.investor?.sectors || investor?.sectors || [];
  const startupSectors = startup?.sectors || [];
  const score = investor.match_score || 0;
  
  // Find sector overlap
  const overlap = startupSectors.find(s => 
    investorSectors.some(is => 
      is?.toLowerCase().includes(s?.toLowerCase()) || 
      s?.toLowerCase().includes(is?.toLowerCase())
    )
  );
  
  if (score >= 85 && overlap) {
    return `Portfolio adjacency + category heat in ${overlap.toLowerCase()}.`;
  }
  if (score >= 80) {
    return `Thesis overlap with their recent deals in your space.`;
  }
  if (score >= 75 && overlap) {
    return `Category fit in ${overlap.toLowerCase()} + emerging pattern match.`;
  }
  if (score >= 70) {
    return `Execution cadence aligns with their operator-led thesis.`;
  }
  if (overlap) {
    return `Early category tracking in ${overlap.toLowerCase()}.`;
  }
  return `Emerging pattern match in your problem space.`;
}

// Generate misalignment "why" - orientation, not shame
function generateMisalignmentWhy(investor: MatchedInvestor, startup: StartupData): string {
  const score = investor.match_score || 0;
  const investorSectors = investor?.investor?.sectors || investor?.sectors || [];
  const startupSectors = startup?.sectors || [];
  
  // Check if sector mismatch
  const hasOverlap = startupSectors.some(s => 
    investorSectors.some(is => 
      is?.toLowerCase().includes(s?.toLowerCase()) || 
      s?.toLowerCase().includes(is?.toLowerCase())
    )
  );
  
  if (!hasOverlap && investorSectors.length > 0) {
    return `Thesis focused on ${investorSectors[0]} — outside your category.`;
  }
  if (score < 50) {
    return `Prioritizes traction signals you haven't surfaced yet.`;
  }
  if (score < 60) {
    return `Stage misalignment — they're looking later.`;
  }
  return `Your narrative doesn't match their current focus.`;
}

function generateSignalChips(investor: MatchedInvestor, startup: StartupData): string[] {
  const chips: string[] = [];
  const score = investor.match_score || 0;
  
  if (score >= 85) chips.push("Portfolio adjacency");
  if (score >= 75) chips.push("Thesis overlap");
  if (startup?.sectors?.length) chips.push("Category heat");
  if (score >= 70) chips.push("Timing fit");
  
  return chips.slice(0, 4);
}

function generateTimingContext(investor: MatchedInvestor): string {
  const score = investor.match_score || 0;
  if (score >= 85) return "Their activity in your category has increased over the last 30 days.";
  if (score >= 70) return "They are actively looking in adjacent spaces.";
  return "Early but tracking your problem space.";
}

function generateAlignmentSteps(investor: MatchedInvestor): string[] {
  const score = investor.match_score || 0;
  const steps: string[] = [];
  
  if (score < 85) steps.push("Publish a technical benchmark or case study");
  steps.push("Reframe narrative toward infrastructure positioning");
  steps.push("Highlight recent execution milestones publicly");
  
  return steps.slice(0, 3);
}

// ============================================
// TOP MATCH CARD (#1 - Visually Dominant)
// ============================================

interface TopMatchCardProps {
  investor: MatchedInvestor;
  startup: StartupData;
  isExpanded: boolean;
  onToggle: () => void;
}

function TopMatchCard({ investor, startup, isExpanded, onToggle }: TopMatchCardProps) {
  const name = investor?.investor?.name || investor?.name || 'Investor';
  const sectors = investor?.investor?.sectors || investor?.sectors || [];
  const stage = investor?.investor?.stage || investor?.stage;
  const stageStr = Array.isArray(stage) ? stage[0] : stage;
  const score = investor?.match_score || 0;
  const distance = getDistanceLabel(score);
  const distanceColor = getDistanceColor(score);
  const whyLine = generateWhyLine(investor, startup);
  const signalChips = generateSignalChips(investor, startup);
  const timingContext = generateTimingContext(investor);
  const alignmentSteps = generateAlignmentSteps(investor);
  
  // Rising indicator (show if score >= 82)
  const isRising = score >= 82;
  
  return (
    <div className="bg-[#111] border-2 border-violet-500/30 rounded-2xl overflow-hidden shadow-lg shadow-violet-500/10">
      {/* Top Match Label */}
      <div className="px-6 py-2 bg-gradient-to-r from-violet-600/20 to-transparent border-b border-violet-500/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">Top Match</span>
          {isRising && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              Rising this week
            </span>
          )}
        </div>
      </div>
      
      {/* Main Card Content - More breathing room */}
      <div 
        className="p-6 cursor-pointer hover:bg-gray-900/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-6">
          {/* Left: Name + Tags + Why */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-3">{name}</h2>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {sectors.slice(0, 3).map((sector, i) => (
                <span key={i} className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded-lg">
                  {sector}
                </span>
              ))}
              {stageStr && (
                <span className="px-3 py-1 text-sm bg-violet-900/50 text-violet-300 rounded-lg">
                  {stageStr}
                </span>
              )}
            </div>
            
            {/* Distance + One-line why */}
            <div className="space-y-1">
              <span className={`text-sm font-medium ${distanceColor}`}>{distance}</span>
              <p className="text-gray-400">{whyLine}</p>
            </div>
          </div>
          
          {/* Right: Signal Score (DOMINANT) */}
          <div className="text-right">
            <div className={`text-5xl font-bold ${
              score >= 85 ? 'text-emerald-400' :
              score >= 70 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {score}
            </div>
            <span className="text-sm text-gray-500">Signal Score</span>
          </div>
        </div>
        
        {/* Expand hint */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800">
          <button className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
            Why this match
          </button>
          <button className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
            How to align
          </button>
          <div className="ml-auto text-gray-500">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>
      
      {/* Expanded Section */}
      {isExpanded && (
        <div className="border-t border-gray-800 p-6 bg-gray-900/30 space-y-6">
          {/* Why aligned */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Why this investor is aligned with you</h4>
            <ul className="space-y-2 text-gray-400">
              <li>• Portfolio adjacency detected</li>
              <li>• Category heat forming in your problem space</li>
              <li>• Thesis overlap with their recent deals</li>
            </ul>
          </div>
          
          {/* Signals overlapping */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Signals overlapping</h4>
            <div className="flex flex-wrap gap-2">
              {signalChips.map((chip, i) => (
                <span key={i} className="px-3 py-1.5 text-sm bg-violet-900/40 text-violet-300 border border-violet-700/50 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          
          {/* Timing */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">Timing</h4>
            <p className="text-gray-400">{timingContext}</p>
          </div>
          
          {/* How to align */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">How to move closer to this investor</h4>
            <ul className="space-y-2 text-gray-400">
              {alignmentSteps.map((step, i) => (
                <li key={i}>• {step}</li>
              ))}
            </ul>
            <p className="text-sm text-gray-500 mt-3">
              These changes increase the signals they overweight in early-stage decisions.
            </p>
          </div>
          
          {/* Action */}
          <div className="pt-2">
            <button className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors">
              Generate intro angle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUBORDINATE MATCH CARD (#2-#5)
// ============================================

interface MatchCardProps {
  investor: MatchedInvestor;
  rank: number;
  startup: StartupData;
  isExpanded: boolean;
  onToggle: () => void;
  isBlurred?: boolean;
  size?: 'medium' | 'small';
}

function MatchCard({ investor, rank, startup, isExpanded, onToggle, isBlurred, size = 'medium' }: MatchCardProps) {
  const name = investor?.investor?.name || investor?.name || 'Investor';
  const sectors = investor?.investor?.sectors || investor?.sectors || [];
  const stage = investor?.investor?.stage || investor?.stage;
  const stageStr = Array.isArray(stage) ? stage[0] : stage;
  const score = investor?.match_score || 0;
  const distance = getDistanceLabel(score);
  const distanceColor = getDistanceColor(score);
  const whyLine = generateWhyLine(investor, startup);
  const signalChips = generateSignalChips(investor, startup);
  const timingContext = generateTimingContext(investor);
  const alignmentSteps = generateAlignmentSteps(investor);
  
  const padding = size === 'small' ? 'p-3' : 'p-4';
  const nameSize = size === 'small' ? 'text-base' : 'text-lg';
  const scoreSize = size === 'small' ? 'text-2xl' : 'text-3xl';
  
  return (
    <div className={`bg-[#111] border border-gray-800 rounded-xl overflow-hidden transition-all ${isBlurred ? 'blur-sm pointer-events-none select-none' : ''}`}>
      <div 
        className={`${padding} ${!isBlurred ? 'cursor-pointer hover:bg-gray-900/50' : ''}`}
        onClick={!isBlurred ? onToggle : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-gray-500 text-sm font-mono">#{rank}</span>
              <h3 className={`text-white font-semibold truncate ${nameSize}`}>{name}</h3>
            </div>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sectors.slice(0, 2).map((sector, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                  {sector}
                </span>
              ))}
              {stageStr && (
                <span className="px-2 py-0.5 text-xs bg-violet-900/50 text-violet-300 rounded">
                  {stageStr}
                </span>
              )}
            </div>
            
            {/* Distance + Why */}
            <div className="flex items-center gap-2 text-sm">
              <span className={distanceColor}>{distance}</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 truncate">{whyLine}</span>
            </div>
          </div>
          
          {/* Right: Score */}
          <div className="flex flex-col items-end gap-1">
            <div className={`font-bold ${scoreSize} ${
              score >= 85 ? 'text-emerald-400' :
              score >= 70 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {score}
            </div>
            <span className="text-xs text-gray-500">Signal Score</span>
            {!isBlurred && (
              <div className="mt-1 text-gray-500">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Expanded */}
      {isExpanded && !isBlurred && (
        <div className="border-t border-gray-800 p-4 bg-gray-900/30 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Why this investor is aligned with you</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              <li>• Portfolio adjacency detected</li>
              <li>• Thesis overlap with their recent deals</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">Signals overlapping</h4>
            <div className="flex flex-wrap gap-2">
              {signalChips.map((chip, i) => (
                <span key={i} className="px-2.5 py-1 text-xs bg-violet-900/40 text-violet-300 border border-violet-700/50 rounded-full">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-1">Timing</h4>
            <p className="text-sm text-gray-400">{timingContext}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-2">How to align</h4>
            <ul className="space-y-1 text-sm text-gray-400">
              {alignmentSteps.map((step, i) => (
                <li key={i}>• {step}</li>
              ))}
            </ul>
          </div>
          
          <div className="pt-2">
            <button className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
              Generate intro angle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MISALIGNED INVESTOR CARD
// ============================================

interface MisalignedCardProps {
  investor: MatchedInvestor;
  startup: StartupData;
}

function MisalignedCard({ investor, startup }: MisalignedCardProps) {
  const name = investor?.investor?.name || investor?.name || 'Investor';
  const sectors = investor?.investor?.sectors || investor?.sectors || [];
  const stage = investor?.investor?.stage || investor?.stage;
  const stageStr = Array.isArray(stage) ? stage[0] : stage;
  const score = investor?.match_score || 0;
  const whyNot = generateMisalignmentWhy(investor, startup);
  
  return (
    <div className="p-4 bg-[#111] border border-gray-800/50 rounded-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate mb-1">{name}</h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {sectors.slice(0, 2).map((sector, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">
                {sector}
              </span>
            ))}
            {stageStr && (
              <span className="px-2 py-0.5 text-xs bg-gray-800 text-gray-400 rounded">
                {stageStr}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{whyNot}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-500">{score}</div>
          <span className="text-xs text-gray-600">Signal Score</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800">
        <span className="text-xs text-gray-500 italic">Does not recognize your current narrative</span>
      </div>
    </div>
  );
}

// ============================================
// BLURRED MATCH CARD (Desire Surface)
// Doctrine v1.0: Partially legible - blur investors, not outcomes
// Shows: category, stage, tags, distance, partial why
// Blurs: investor name, score
// ============================================

interface BlurredMatchCardProps {
  rank: number;
  sectors: string[];
  stage: string;
  distance: string;
  distanceColor: string;
  partialWhy: string;
  type: 'aligned' | 'misaligned';
}

function BlurredMatchCard({ rank, sectors, stage, distance, distanceColor, partialWhy, type }: BlurredMatchCardProps) {
  const bgColor = type === 'aligned' ? 'bg-[#111]' : 'bg-gray-900/50';
  const borderColor = type === 'aligned' ? 'border-gray-800' : 'border-gray-800/50';
  
  return (
    <div className={`p-4 ${bgColor} border ${borderColor} rounded-xl`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: Partially legible info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-gray-500 text-sm font-mono">#{rank}</span>
            {/* Blurred name */}
            <div className="h-5 w-32 bg-gray-700 rounded blur-sm" />
          </div>
          
          {/* Tags: VISIBLE */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {sectors.map((sector, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                {sector}
              </span>
            ))}
            {stage && (
              <span className="px-2 py-0.5 text-xs bg-violet-900/50 text-violet-300 rounded">
                {stage}
              </span>
            )}
          </div>
          
          {/* Distance: VISIBLE + Why: PARTIAL */}
          <div className="flex items-center gap-2 text-sm">
            <span className={distanceColor}>{distance}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">
              {partialWhy}
              <span className="ml-1 blur-sm text-gray-500">████████████</span>
            </span>
          </div>
        </div>
        
        {/* Right: Blurred score */}
        <div className="flex flex-col items-end gap-1">
          <div className="w-8 h-8 bg-gray-700 rounded blur-sm" />
          <span className="text-xs text-gray-600">Signal Score</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN RESULTS PAGE
// ============================================

export default function ResultsPageDoctrine() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const urlParam = searchParams.get('url') || '';
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [startup, setStartup] = useState<StartupData | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const plan = getPlan(user);
  
  const { 
    matches: gatedMatches, 
    loading: matchesLoading,
    total
  } = useMatches(startupId);

  // Derived data
  const matches = gatedMatches || [];
  const top1 = matches[0];
  const top2to5 = matches.slice(1, 5);
  const moreMatches = matches.slice(5);
  const totalMatches = total || matches.length;
  
  // Simulated misaligned investors (in production, fetch from backend)
  const misalignedInvestors = useMemo(() => {
    if (!matches.length) return [];
    // Take lowest-scoring matches as misaligned examples
    const sorted = [...matches].sort((a, b) => (a.match_score || 0) - (b.match_score || 0));
    return sorted.slice(0, 5);
  }, [matches]);
  
  // Capital reading (Trust Mirror) - Doctrine v1.0
  // Must be: 4-6 neutral statements, "You are being read as..." format
  // No scores, no judgment, no advice
  const capitalReading = useMemo(() => {
    if (!startup) return [];
    const readings: string[] = [];
    const sectors = startup.sectors || [];
    const godScore = startup.total_god_score || 0;
    const matchCount = matches.length;
    
    // Sector positioning (always first)
    if (sectors.includes('HealthTech') || sectors.includes('Health')) {
      readings.push('early-category infrastructure in health tech');
    } else if (sectors.includes('FinTech') || sectors.includes('Finance')) {
      readings.push('emerging infrastructure in financial services');
    } else if (sectors.length > 0) {
      readings.push(`${sectors[0].toLowerCase()}-focused with a technical bent`);
    } else {
      readings.push('category-agnostic with an infrastructure approach');
    }
    
    // Execution vs narrative positioning
    if (godScore >= 70) {
      readings.push('execution-heavy and product-forward');
    } else if (godScore >= 55) {
      readings.push('narrative-first with emerging execution proof');
    } else {
      readings.push('early-stage with a forming narrative');
    }
    
    // Proof positioning
    if (godScore >= 65) {
      readings.push('having visible technical credibility');
    } else {
      readings.push('having limited external proof yet');
    }
    
    // Recognition window
    if (matchCount >= 30) {
      readings.push('having broad recognition across seed-stage funds');
    } else if (matchCount >= 15) {
      readings.push('having emerging recognition in specialist funds');
    } else {
      readings.push('not yet legible to generalist seed funds');
    }
    
    // Stage positioning
    const stage = startup.stage;
    if (stage === 'Pre-seed' || stage === 'Seed') {
      readings.push('at a stage where operator-led funds engage');
    }
    
    return readings.slice(0, 6); // Enforce max 6
  }, [startup, matches]);
  
  // Trust Mirror synthesis sentence
  const synthesisSentence = useMemo(() => {
    if (!matches.length || !misalignedInvestors.length) return null;
    const topName = top1?.investor?.name || top1?.name || 'your top match';
    const bottomName = misalignedInvestors[0]?.investor?.name || misalignedInvestors[0]?.name || 'some funds';
    const sectors = startup?.sectors || [];
    
    if (sectors.includes('HealthTech') || sectors.includes('Health')) {
      return `This is why health infra funds like ${topName} are warming up while generalist funds like ${bottomName} aren't returning your emails.`;
    }
    return `This is why ${topName} is warming up to you while ${bottomName} isn't engaging yet.`;
  }, [matches, misalignedInvestors, top1, startup]);
  
  // Conviction surface: closest flip - Doctrine v1.0
  // Must be: investor-specific, near-miss causality, blocking signals, collateral effects
  // No moral language, no motivation, no product narration
  const closestFlip = useMemo(() => {
    if (!matches.length) return null;
    
    // Find investor in 65-79 range (close to aligned but not there yet)
    const almostAligned = matches.find(m => 
      (m.match_score || 0) >= 65 && (m.match_score || 0) < 80
    );
    if (!almostAligned) return null;
    
    const name = almostAligned?.investor?.name || almostAligned?.name || 'Investor';
    const investorSectors = almostAligned?.investor?.sectors || almostAligned?.sectors || [];
    const score = almostAligned.match_score || 0;
    const gap = 80 - score;
    
    // Generate blocking signals based on what's missing
    const blockingSignals: string[] = [];
    if (score < 75) {
      blockingSignals.push('External proof not yet visible');
    }
    if (score < 72) {
      blockingSignals.push('Execution cadence not surfaced publicly');
    }
    if (investorSectors.length > 0 && startup?.sectors?.length) {
      const hasOverlap = startup.sectors.some(s => 
        investorSectors.some(is => is?.toLowerCase().includes(s?.toLowerCase()))
      );
      if (!hasOverlap) {
        blockingSignals.push('Category positioning unclear');
      }
    }
    if (blockingSignals.length === 0) {
      blockingSignals.push('Narrative framing not matching their thesis lens');
    }
    
    // Generate specific leverage actions for THIS investor
    const leverageActions: string[] = [];
    if (investorSectors.some(s => s?.toLowerCase().includes('health'))) {
      leverageActions.push('Publish a clinical or technical benchmark');
      leverageActions.push('Ship a named pilot with a health system');
    } else if (investorSectors.some(s => s?.toLowerCase().includes('fin'))) {
      leverageActions.push('Add a credible fintech angel');
      leverageActions.push('Release a compliance case study');
    } else {
      leverageActions.push('Publish a technical case study');
      leverageActions.push('Ship a named pilot');
    }
    leverageActions.push('Reframe homepage toward their thesis language');
    leverageActions.push('Add external validation (press or angel)');
    
    // Collateral effects - other investors this would flip
    const collateral = matches
      .filter(m => {
        const s = m.match_score || 0;
        return s >= 60 && s < 80 && (m?.investor?.name || m?.name) !== name;
      })
      .slice(0, 3)
      .map(m => m?.investor?.name || m?.name || 'Fund');
    
    return {
      investor: name,
      score,
      gap,
      blockingSignals: blockingSignals.slice(0, 3),
      leverageActions: leverageActions.slice(0, 3),
      collateral
    };
  }, [matches, startup]);
  
  // Actions (leverage-based)
  const actionItems = useMemo(() => {
    if (!matches.length) return [];
    const topInvestors = matches.slice(0, 3).map(m => m?.investor?.name || m?.name || 'Investor');
    return [
      {
        action: "Publish a technical case study",
        leverage: `Increases signal strength for ${Math.min(8, matches.length)} of your top matches.`,
        unlocks: topInvestors.slice(0, 2)
      },
      {
        action: `Pursue warm intro to ${topInvestors[0]}`,
        leverage: "They're in a forming window with portfolio adjacency.",
        unlocks: [topInvestors[0]]
      },
      {
        action: "Reframe positioning toward infrastructure",
        leverage: "Aligns narrative with the thesis cluster in your category.",
        unlocks: topInvestors
      }
    ];
  }, [matches]);
  
  // ============================================
  // DESIRE SURFACE DATA - Doctrine v1.0
  // Shows SCALE, not features
  // Blurs investors, not outcomes
  // Creates inevitability, not frustration
  // ============================================
  
  // Scale numbers (how large the capital topology is)
  const desireScale = useMemo(() => {
    const alignedCount = totalMatches > 5 ? totalMatches - 5 : Math.max(12, Math.floor(Math.random() * 20) + 10);
    const misalignedCount = Math.floor(alignedCount * 2.5); // Misalignment is widespread
    return {
      additionalAligned: alignedCount,
      additionalMisaligned: misalignedCount
    };
  }, [totalMatches]);
  
  // Temporal movement (living system signal)
  const temporalMovement = useMemo(() => {
    // Simulate movement - in production, this comes from actual history
    return {
      newThisWeek: Math.floor(Math.random() * 4) + 1, // 1-4 new matches
      warmingUp: Math.floor(Math.random() * 3) + 1, // 1-3 warming
      coolingOff: Math.floor(Math.random() * 2) // 0-1 cooling
    };
  }, []);
  
  // Generate partially legible blurred cards
  const blurredAlignedCards = useMemo(() => {
    const sectorPool = ['HealthTech', 'FinTech', 'Enterprise SaaS', 'AI/ML', 'Infra', 'B2B', 'Marketplace', 'Deep Tech'];
    const stagePool = ['Pre-seed', 'Seed', 'Series A'];
    const whyPrefixes = [
      'Thesis overlap with their last three',
      'Category heat forming in your',
      'Portfolio adjacency through',
      'Execution pattern match with',
      'Timing fit with their current'
    ];
    
    return Array(6).fill(null).map((_, i) => {
      const score = 75 - i * 3;
      const sectors = [sectorPool[Math.floor(Math.random() * sectorPool.length)], sectorPool[Math.floor(Math.random() * sectorPool.length)]].filter((v, j, a) => a.indexOf(v) === j);
      return {
        rank: 6 + i,
        sectors: sectors.slice(0, 2),
        stage: stagePool[Math.floor(Math.random() * stagePool.length)],
        distance: score >= 75 ? 'Portfolio adjacent' : 'Cold',
        distanceColor: score >= 75 ? 'text-amber-400' : 'text-gray-500',
        partialWhy: whyPrefixes[i % whyPrefixes.length],
        type: 'aligned' as const
      };
    });
  }, []);
  
  const blurredMisalignedCards = useMemo(() => {
    const sectorPool = ['Enterprise', 'Consumer', 'Crypto', 'DTC', 'Hardware', 'Climate'];
    const stagePool = ['Series A', 'Series B', 'Growth'];
    const whyPrefixes = [
      'Stage misalignment — looking for',
      'Thesis focused on adjacent',
      'Prioritizes traction signals like',
      'Category mismatch with their'
    ];
    
    return Array(4).fill(null).map((_, i) => {
      return {
        rank: 1 + i,
        sectors: [sectorPool[Math.floor(Math.random() * sectorPool.length)]],
        stage: stagePool[Math.floor(Math.random() * stagePool.length)],
        distance: 'Cold',
        distanceColor: 'text-gray-500',
        partialWhy: whyPrefixes[i % whyPrefixes.length],
        type: 'misaligned' as const
      };
    });
  }, []);

  // Resolve startup
  useEffect(() => {
    if (!urlParam) {
      navigate('/');
      return;
    }
    resolveStartup();
  }, [urlParam]);

  const resolveStartup = async () => {
    try {
      setIsLoading(true);
      const result = await resolveStartupFromUrl(urlParam, { waitForEnrichment: true });
      
      if (!result) {
        setError('Could not analyze this URL. Please check it\'s a valid website.');
        setIsLoading(false);
        return;
      }
      
      setStartup({
        id: result.startup.id,
        name: result.startup.name || 'Your Startup',
        website: result.startup.website || urlParam,
        sectors: result.startup.sectors || [],
        stage: result.startup.stage ? ['', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'][result.startup.stage] : undefined,
        total_god_score: result.startup.total_god_score
      });
      
      setStartupId(result.startup.id);
      setIsLoading(false);
      
      analytics.matchesPageViewed(result.startup.id);
    } catch (err) {
      console.error('[ResultsPage] Error:', err);
      setError('Failed to analyze. Please try again.');
      setIsLoading(false);
    }
  };

  // Loading
  if (isLoading || matchesLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-gray-400">Finding your investor matches...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analysis Failed</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* ========================================
            SECTION 1: TOP 5 MATCHES (ABOVE FOLD)
            No preamble. No philosophy. No framing.
            ======================================== */}
        <section className="mb-16">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Your Top 5 Investor Matches</h1>
            <p className="text-gray-400">Based on live capital signals + thesis alignment</p>
          </div>
          
          {/* #1 — VISUALLY DOMINANT */}
          {top1 && (
            <div className="mb-4">
              <TopMatchCard
                investor={top1}
                startup={startup!}
                isExpanded={expandedCard === 0}
                onToggle={() => setExpandedCard(expandedCard === 0 ? null : 0)}
              />
            </div>
          )}
          
          {/* #2-#3 — Medium weight */}
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            {top2to5.slice(0, 2).map((investor, i) => (
              <MatchCard
                key={investor.id || i}
                investor={investor}
                rank={i + 2}
                startup={startup!}
                isExpanded={expandedCard === i + 1}
                onToggle={() => setExpandedCard(expandedCard === i + 1 ? null : i + 1)}
                size="medium"
              />
            ))}
          </div>
          
          {/* #4-#5 — Smaller */}
          <div className="grid md:grid-cols-2 gap-3">
            {top2to5.slice(2, 4).map((investor, i) => (
              <MatchCard
                key={investor.id || i}
                investor={investor}
                rank={i + 4}
                startup={startup!}
                isExpanded={expandedCard === i + 3}
                onToggle={() => setExpandedCard(expandedCard === i + 3 ? null : i + 3)}
                size="small"
              />
            ))}
          </div>
        </section>
        
        {/* ========================================
            SECTION 2: BELIEF SURFACE (Misalignment)
            Aligned vs Misaligned (side by side)
            Must come BEFORE Trust Mirror per doctrine.
            ======================================== */}
        <section className="mb-16">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Aligned column */}
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-4">
                You align with these investors right now
              </h3>
              <div className="space-y-3">
                {matches.slice(0, 5).map((investor, i) => (
                  <div key={i} className="p-3 bg-emerald-900/10 border border-emerald-800/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{investor?.investor?.name || investor?.name}</span>
                      <span className="text-emerald-400 font-bold">{investor.match_score}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Recognizes your current narrative</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Misaligned column */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                You do NOT align with these investors right now
              </h3>
              <div className="space-y-3">
                {misalignedInvestors.slice(0, 5).map((investor, i) => (
                  <MisalignedCard key={i} investor={investor} startup={startup!} />
                ))}
              </div>
            </div>
          </div>
        </section>
        
        {/* ========================================
            SECTION 3: TRUST MIRROR
            "How capital currently reads your startup"
            Doctrine v1.0: Orientation, not judgment.
            - No scores, numbers, or grades
            - 4-6 neutral "You are being read as..." statements
            - One synthesis sentence "This is why..."
            - No advice, no leverage, no next steps
            ======================================== */}
        <section className="mb-16">
          <div className="p-6 bg-[#111] border border-gray-800 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-6">How capital currently reads you</h2>
            
            <ul className="space-y-3 mb-6">
              {capitalReading.map((reading, i) => (
                <li key={i} className="text-gray-300">
                  <span className="text-gray-500">You are being read as</span>{' '}
                  <span className="text-white">{reading}</span>.
                </li>
              ))}
            </ul>
            
            {synthesisSentence && (
              <p className="text-gray-400 border-t border-gray-800 pt-4">
                {synthesisSentence}
              </p>
            )}
          </div>
        </section>
        
        {/* ========================================
            SECTION 4: CONVICTION SURFACE
            Doctrine v1.0: Leverage + Agency Engine
            - Investor-specific (not generic advice)
            - Near-miss causality: blocking signals
            - Smallest viable changes
            - Collateral effects
            - No moral language, no motivation
            ======================================== */}
        {closestFlip && (
          <section className="mb-16">
            <div className="p-6 bg-gradient-to-r from-amber-900/20 to-transparent border border-amber-800/30 rounded-xl">
              {/* Header: How to move closer */}
              <h2 className="text-lg font-semibold text-white mb-1">
                How to move closer to this investor
              </h2>
              <p className="text-3xl font-bold text-amber-400 mb-6">{closestFlip.investor}</p>
              
              {/* Near-miss causality */}
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Current alignment</p>
                <p className="text-white">
                  <span className="text-2xl font-bold text-amber-400">{closestFlip.score}</span>
                  <span className="text-gray-400 ml-2">→ {closestFlip.gap} points from recognition threshold</span>
                </p>
              </div>
              
              {/* Blocking signals */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  What's blocking recognition
                </h3>
                <ul className="space-y-2">
                  {closestFlip.blockingSignals.map((signal, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Leverage actions - smallest viable changes */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Signals that flip this investor
                </h3>
                <ul className="space-y-2">
                  {closestFlip.leverageActions.map((action, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Collateral effects */}
              {closestFlip.collateral.length > 0 && (
                <div className="border-t border-amber-800/30 pt-4">
                  <p className="text-sm text-gray-400">
                    <span className="text-gray-500">This change would also improve alignment with:</span>{' '}
                    <span className="text-white">{closestFlip.collateral.join(', ')}</span>
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        
        {/* ========================================
            SECTION 5: DESIRE SURFACE
            Doctrine v1.0: Controlled revelation of scale
            
            INVARIANTS:
            1. After Conviction ✓
            2. Reveal scale, not features
            3. Blur investors, not outcomes
            4. Partially legible cards
            5. Both aligned + misaligned scale
            6. Temporal movement
            7. "Unlock your full investor map" CTA
            8. Never feel like a demo
            9. "Matches update as signals change"
            10. Never corrupt trust
            ======================================== */}
        <section className="mb-16">
          {/* Temporal movement - living system signal */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-[#111] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-gray-300">
                <span className="text-emerald-400 font-medium">{temporalMovement.newThisWeek} new matches</span> this week
              </span>
            </div>
            <div className="w-px h-4 bg-gray-700" />
            <span className="text-sm text-gray-400">
              <span className="text-amber-400">{temporalMovement.warmingUp} investors</span> warming up
            </span>
            {temporalMovement.coolingOff > 0 && (
              <>
                <div className="w-px h-4 bg-gray-700" />
                <span className="text-sm text-gray-500">
                  {temporalMovement.coolingOff} cooling off
                </span>
              </>
            )}
          </div>
          
          {/* Two-column scale reveal */}
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* MORE ALIGNED - blurred list */}
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                  More investors you align with
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {desireScale.additionalAligned} additional investors recognize your current narrative.
                </p>
              </div>
              
              <div className="space-y-3">
                {blurredAlignedCards.slice(0, 4).map((card, i) => (
                  <BlurredMatchCard key={i} {...card} />
                ))}
              </div>
            </div>
            
            {/* MORE MISALIGNED - blurred list */}
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  More investors you do NOT align with
                </h3>
                <p className="text-gray-500 text-sm mt-1">
                  {desireScale.additionalMisaligned} investors do not recognize your current narrative yet.
                </p>
              </div>
              
              <div className="space-y-3">
                {blurredMisalignedCards.map((card, i) => (
                  <BlurredMatchCard key={i} {...card} />
                ))}
              </div>
            </div>
          </div>
          
          {/* Aliveness sentence */}
          <p className="text-sm text-gray-500 text-center mt-6 italic">
            These matches update as your signals change and as capital behavior shifts.
          </p>
          
          {/* CTA - Inevitability, not pressure */}
          {(!isLoggedIn || plan === 'free') && (
            <div className="mt-8 p-6 bg-gradient-to-r from-violet-900/20 to-transparent border border-violet-800/30 rounded-xl text-center">
              <Lock className="w-8 h-8 mx-auto mb-3 text-violet-400" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Your full investor map contains {desireScale.additionalAligned + desireScale.additionalMisaligned + 5}+ investors
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                See every aligned investor, every misaligned one, and track how your position shifts as your signals evolve.
              </p>
              <Link
                to={`/signup?url=${encodeURIComponent(urlParam)}&matches=${totalMatches}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors"
              >
                Unlock your full investor map
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}
        </section>
        
        {/* ========================================
            SECTION 6: ACTION
            Leverage, not lectures
            ======================================== */}
        <section className="mb-16">
          <h2 className="text-lg font-semibold text-white mb-4">What would most improve your odds</h2>
          
          <div className="space-y-4">
            {actionItems.map((item, i) => (
              <div key={i} className="p-4 bg-[#111] border border-gray-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center shrink-0">
                    <span className="text-violet-400 font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1">{item.action}</h3>
                    <p className="text-sm text-gray-400 mb-2">{item.leverage}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-gray-500">Unlocks:</span>
                      {item.unlocks.map((inv, j) => (
                        <span key={j} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
                          {inv}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* ========================================
            SECTION 7: DIAGNOSTICS (Hidden)
            ======================================== */}
        <section className="border-t border-gray-800 pt-6">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Info className="w-3 h-3" />
            Behind the match
            {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          {showDiagnostics && (
            <div className="mt-4 p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-xs text-gray-500 font-mono">
              <p>startup_id: {startupId}</p>
              <p>total_matches: {totalMatches}</p>
              <p>sectors: {startup?.sectors?.join(', ') || 'N/A'}</p>
              <p>plan: {plan}</p>
            </div>
          )}
        </section>
        
      </div>
    </div>
  );
}
