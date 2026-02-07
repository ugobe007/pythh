// ============================================================================
// Pythh Oracle — Coaching Page
// ============================================================================
// Deep coaching prompts tailored to the founder's archetype, VC alignment,
// and signal gaps. The Oracle asks questions that force founders to think
// more clearly — like a great board advisor who does not pull punches.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  Lightbulb,
  Target,
  Zap,
  TrendingUp,
  Brain,
  Compass,
  MessageSquare,
  ChevronRight,
  Star,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  analyzeFounderDNA,
  calculateVCAlignments,
  generateCoachingPrompts,
  type CoachingPrompt,
  type FounderDNAProfile,
} from '../../services/oracle/intelligenceEngine';
import { getSessionSteps } from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

// Archetype display names
const ARCHETYPE_LABELS: Record<string, string> = {
  repeat_founder: 'Repeat Founder',
  technical_visionary: 'Technical Visionary',
  domain_insider: 'Domain Insider',
  corporate_spinout: 'Corporate Spinout',
  hot_startup_alumni: 'Hot Startup Alumni',
  research_commercializer: 'Research Commercializer',
  young_technical: 'Young Technical Prodigy',
  industry_transformer: 'Industry Transformer',
  marketplace_builder: 'Marketplace Builder',
  ai_native: 'AI-Native Builder',
  mission_driven: 'Mission-Driven',
  immigrant_founder: 'Immigrant Founder',
  serial_operator: 'Serial Operator',
  open_source_to_commercial: 'Open Source to Commercial',
};

export default function OracleCoachingPage() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [prompts, setPrompts] = useState<CoachingPrompt[]>([]);
  const [founderDNA, setFounderDNA] = useState<FounderDNAProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedPrompts, setSavedPrompts] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) {
      setLoading(false);
      return;
    }
    loadCoaching(startupId);
  }, [startupId]);

  async function loadCoaching(sid: string) {
    try {
      const { data: startup } = await supabase
        .from('startup_uploads')
        .select('team_score, traction_score, market_score, product_score, vision_score')
        .eq('id', sid)
        .single();

      const godScores = {
        team_score: startup?.team_score || 50,
        traction_score: startup?.traction_score || 50,
        market_score: startup?.market_score || 50,
        product_score: startup?.product_score || 50,
        vision_score: startup?.vision_score || 50,
      };

      const { data: sessions } = await supabase
        .from('oracle_sessions')
        .select('id')
        .eq('startup_id', sid)
        .order('created_at', { ascending: false })
        .limit(1);

      let wizardResponses: Record<string, Record<string, unknown>> = {};
      if (sessions && sessions.length > 0) {
        const steps = await getSessionSteps(sessions[0].id);
        for (const step of steps) {
          if (step.responses && Object.keys(step.responses).length > 0) {
            wizardResponses[step.step_key] = step.responses;
          }
        }
      }

      const dna = analyzeFounderDNA(wizardResponses);
      const vcAlignments = calculateVCAlignments(godScores, dna);
      const coaching = generateCoachingPrompts(dna, vcAlignments);

      setFounderDNA(dna);
      setPrompts(coaching);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleSave = (index: number) => {
    setSavedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-white/5 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate('/app/oracle')} className="text-white/60 hover:text-white underline text-sm">
            Back to Oracle
          </button>
        </div>
      </div>
    );
  }

  // No startup — show archetype overview
  if (!startupId && prompts.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-semibold text-white/90">Pythh Oracle</span>
              <span className="text-xs text-white/40">— Coaching</span>
            </div>
            <button onClick={() => navigate('/app/oracle')} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
              <span className="mr-1">←</span> Back to Oracle
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300/80">
            Submit your startup to get personalized coaching prompts. Below are the 14 founder archetypes the Oracle evaluates.
          </div>
          <h2 className="text-white/60 text-sm font-medium uppercase tracking-wide">Founder Archetypes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(ARCHETYPE_LABELS).map(([key, label]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white/90">{label}</h3>
                </div>
                <p className="text-[10px] text-white/30 font-mono">{key}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(prompts.map((p) => p.category)));
  const filtered = activeCategory ? prompts.filter((p) => p.category === activeCategory) : prompts;

  const categoryMeta: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    founder_dna: { label: 'Founder DNA', icon: <Brain className="w-4 h-4" />, color: 'text-purple-400' },
    vc_alignment: { label: 'VC Alignment', icon: <Target className="w-4 h-4" />, color: 'text-cyan-400' },
    strategy: { label: 'Strategy', icon: <Compass className="w-4 h-4" />, color: 'text-amber-400' },
    execution: { label: 'Execution', icon: <Zap className="w-4 h-4" />, color: 'text-emerald-400' },
    narrative: { label: 'Narrative', icon: <MessageSquare className="w-4 h-4" />, color: 'text-blue-400' },
  };

  // DNA dimensions for radar display
  const dnaDimensions = founderDNA
    ? [
        { label: 'Hypothesis', value: founderDNA.hypothesis_clarity },
        { label: 'Motivation', value: founderDNA.motivation_score },
        { label: 'Timing', value: founderDNA.timing_awareness },
        { label: 'Domain', value: founderDNA.domain_depth },
        { label: 'Technical', value: founderDNA.technical_capability },
        { label: 'Team', value: founderDNA.team_completeness },
        { label: 'Traction', value: founderDNA.early_traction_quality },
        { label: 'Narrative', value: founderDNA.narrative_power },
        { label: 'Network', value: founderDNA.network_leverage },
        { label: 'Resilience', value: founderDNA.resilience_evidence },
        { label: 'Co-founder', value: founderDNA.cofounder_dynamics },
      ]
    : [];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold text-white/90">Pythh Oracle</span>
            <span className="text-xs text-white/40">— Coaching</span>
          </div>
          <button
            onClick={() => navigate('/app/oracle')}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Founder DNA Card */}
        {founderDNA && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Your Founder DNA</h2>
                  <p className="text-sm text-purple-300">
                    {ARCHETYPE_LABELS[founderDNA.primary_archetype] || founderDNA.primary_archetype}
                    {founderDNA.secondary_archetype && (
                      <span className="text-white/40"> + {ARCHETYPE_LABELS[founderDNA.secondary_archetype] || founderDNA.secondary_archetype}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* DNA Dimension Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {dnaDimensions.map((dim) => (
                <div key={dim.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/50">{dim.label}</span>
                    <span className="text-xs font-semibold text-white/70">{dim.value.toFixed(1)}/10</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        dim.value >= 8 ? 'bg-emerald-500' : dim.value >= 6 ? 'bg-amber-500' : dim.value >= 4 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(dim.value / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-xl text-sm transition border ${
              !activeCategory ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            All ({prompts.length})
          </button>
          {categories.map((cat) => {
            const meta = categoryMeta[cat] || { label: cat, icon: null, color: 'text-white/60' };
            const count = prompts.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition border ${
                  activeCategory === cat ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                {meta.icon} {meta.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Coaching Prompts */}
        <div className="space-y-4">
          {filtered.map((prompt, i) => {
            const globalIndex = prompts.indexOf(prompt);
            const meta = categoryMeta[prompt.category] || { label: prompt.category, icon: null, color: 'text-white/60' };
            const isSaved = savedPrompts.has(globalIndex);

            return (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 hover:bg-white/[0.07] transition">
                {/* Category tag */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={meta.color}>{meta.icon}</span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                  </div>
                  <button onClick={() => toggleSave(globalIndex)} className="text-white/30 hover:text-amber-400 transition">
                    {isSaved ? <BookmarkCheck className="w-4 h-4 text-amber-400" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                </div>

                {/* The question */}
                <h3 className="text-base font-semibold text-white leading-relaxed">
                  {prompt.question}
                </h3>

                {/* Why it matters */}
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Why this matters</p>
                  <p className="text-sm text-white/60 leading-relaxed">{prompt.why_it_matters}</p>
                </div>

                {/* VC relevance */}
                {prompt.vc_relevance.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide">Relevant to:</span>
                    {prompt.vc_relevance.map((vc, j) => (
                      <span key={j} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/50">
                        {vc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Saved prompts summary */}
        {savedPrompts.size > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-300">
              <BookmarkCheck className="w-4 h-4 inline mr-1" />
              You have saved {savedPrompts.size} coaching prompt{savedPrompts.size > 1 ? 's' : ''} to revisit.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
          <NavButton to={'/app/oracle/vc-strategy'} label="VC Strategy" icon={<Target className="w-4 h-4" />} navigate={navigate} />
          <NavButton to={'/app/oracle/predictions'} label="Predictions" icon={<TrendingUp className="w-4 h-4" />} navigate={navigate} />
          <NavButton to={'/app/oracle/actions'} label="Actions" icon={<Zap className="w-4 h-4" />} navigate={navigate} />
        </div>
      </div>
    </div>
  );
}

function NavButton({ to, label, icon, navigate }: { to: string; label: string; icon: React.ReactNode; navigate: (to: string) => void }) {
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white transition"
    >
      {icon} {label}
    </button>
  );
}
