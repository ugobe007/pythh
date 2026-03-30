import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Radio, TrendingUp, DollarSign, Users, Building,
  ShoppingCart, AlertTriangle, Zap, Target, Clock, RefreshCw,
  ChevronRight, Eye, Filter, BarChart3, Globe, Activity,
  Briefcase, Rocket, Shield, Search, GitBranch, Layers,
  ArrowRight, Gauge, CheckCircle2, XCircle, Flame,
} from 'lucide-react';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// ─── Signal metadata maps (mirrors signalOntology.js for the frontend) ────────
const SIGNAL_LABELS: Record<string, string> = {
  fundraising_signal:        'Fundraising',
  acquisition_signal:        'Acquisition',
  exit_signal:               'Exit Prep',
  distress_signal:           'Distress',
  revenue_signal:            'Revenue',
  buyer_budget_signal:       'Budget Ready',
  buyer_signal:              'Buying',
  buyer_pain_signal:         'Pain Signal',
  investor_interest_signal:  'Investor Interest',
  investor_rejection_signal: 'Investor Pass',
  regulatory_signal:         'Regulatory',
  market_position_signal:    'Market Position',
  product_signal:            'Product',
  hiring_signal:             'Hiring',
  enterprise_signal:         'Enterprise Push',
  expansion_signal:          'Expansion',
  gtm_signal:                'GTM Build',
  demand_signal:             'Demand',
  growth_signal:             'Growth',
  partnership_signal:        'Partnership',
  efficiency_signal:         'Efficiency',
  exploratory_signal:        'Exploring',
  unclassified_signal:       'Unclassified',
};

const SIGNAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  fundraising_signal:        { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  acquisition_signal:        { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30'  },
  exit_signal:               { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30'  },
  distress_signal:           { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30'     },
  revenue_signal:            { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  buyer_budget_signal:       { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30'    },
  buyer_signal:              { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30'    },
  buyer_pain_signal:         { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30'  },
  investor_interest_signal:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30'   },
  investor_rejection_signal: { bg: 'bg-zinc-500/15',    text: 'text-zinc-400',    border: 'border-zinc-500/30'    },
  regulatory_signal:         { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30'    },
  market_position_signal:    { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30'   },
  product_signal:            { bg: 'bg-sky-500/15',     text: 'text-sky-400',     border: 'border-sky-500/30'     },
  hiring_signal:             { bg: 'bg-indigo-500/15',  text: 'text-indigo-400',  border: 'border-indigo-500/30'  },
  enterprise_signal:         { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30'   },
  expansion_signal:          { bg: 'bg-teal-500/15',    text: 'text-teal-400',    border: 'border-teal-500/30'    },
  gtm_signal:                { bg: 'bg-indigo-500/15',  text: 'text-indigo-400',  border: 'border-indigo-500/30'  },
  demand_signal:             { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  growth_signal:             { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  partnership_signal:        { bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/30'  },
  efficiency_signal:         { bg: 'bg-zinc-500/15',    text: 'text-zinc-400',    border: 'border-zinc-500/30'    },
  exploratory_signal:        { bg: 'bg-zinc-500/15',    text: 'text-zinc-400',    border: 'border-zinc-500/30'    },
};

const WHO_CARES_MAP: Record<string, { investors: boolean; vendors: boolean; acquirers: boolean; recruiters: boolean }> = {
  fundraising_signal:        { investors: true,  vendors: false, acquirers: false, recruiters: false },
  acquisition_signal:        { investors: true,  vendors: false, acquirers: true,  recruiters: false },
  exit_signal:               { investors: true,  vendors: false, acquirers: true,  recruiters: false },
  distress_signal:           { investors: true,  vendors: false, acquirers: true,  recruiters: false },
  revenue_signal:            { investors: true,  vendors: true,  acquirers: true,  recruiters: false },
  buyer_budget_signal:       { investors: false, vendors: true,  acquirers: false, recruiters: false },
  buyer_signal:              { investors: false, vendors: true,  acquirers: false, recruiters: false },
  buyer_pain_signal:         { investors: false, vendors: true,  acquirers: false, recruiters: false },
  investor_interest_signal:  { investors: true,  vendors: false, acquirers: false, recruiters: false },
  investor_rejection_signal: { investors: true,  vendors: false, acquirers: false, recruiters: false },
  regulatory_signal:         { investors: true,  vendors: true,  acquirers: true,  recruiters: false },
  market_position_signal:    { investors: true,  vendors: true,  acquirers: true,  recruiters: false },
  product_signal:            { investors: true,  vendors: true,  acquirers: false, recruiters: false },
  hiring_signal:             { investors: true,  vendors: true,  acquirers: false, recruiters: true  },
  enterprise_signal:         { investors: true,  vendors: true,  acquirers: false, recruiters: false },
  expansion_signal:          { investors: true,  vendors: true,  acquirers: false, recruiters: false },
  gtm_signal:                { investors: true,  vendors: true,  acquirers: false, recruiters: true  },
  demand_signal:             { investors: true,  vendors: true,  acquirers: false, recruiters: false },
  growth_signal:             { investors: true,  vendors: true,  acquirers: false, recruiters: false },
  partnership_signal:        { investors: false, vendors: true,  acquirers: false, recruiters: false },
  efficiency_signal:         { investors: true,  vendors: false, acquirers: true,  recruiters: false },
  exploratory_signal:        { investors: false, vendors: true,  acquirers: false, recruiters: false },
};

const INFERENCE_MAP: Record<string, { urgency: string; strategic_direction: string; likely_need: string[] }> = {
  fundraising_signal:        { urgency: 'high',     strategic_direction: 'growth',              likely_need: ['legal', 'accounting', 'CRM', 'investor relations'] },
  acquisition_signal:        { urgency: 'high',     strategic_direction: 'consolidation',       likely_need: ['M&A advisory', 'legal', 'integration tools'] },
  exit_signal:               { urgency: 'high',     strategic_direction: 'exit prep',           likely_need: ['M&A advisory', 'legal', 'accounting'] },
  distress_signal:           { urgency: 'critical', strategic_direction: 'survival',            likely_need: ['turnaround advisory', 'debt financing', 'cost reduction'] },
  revenue_signal:            { urgency: 'medium',   strategic_direction: 'scale',               likely_need: ['CRM', 'revenue ops', 'analytics'] },
  buyer_budget_signal:       { urgency: 'high',     strategic_direction: 'procurement',         likely_need: ['software', 'automation', 'implementation partner'] },
  buyer_signal:              { urgency: 'medium',   strategic_direction: 'technology adoption', likely_need: ['software', 'vendor', 'platform'] },
  buyer_pain_signal:         { urgency: 'high',     strategic_direction: 'pain-driven purchase',likely_need: ['automation', 'robotics', 'AI', 'analytics'] },
  investor_interest_signal:  { urgency: 'medium',   strategic_direction: 'fundraising',         likely_need: ['pitch deck', 'data room', 'CRM'] },
  investor_rejection_signal: { urgency: 'low',      strategic_direction: 'continue fundraising',likely_need: [] },
  regulatory_signal:         { urgency: 'medium',   strategic_direction: 'compliance milestone',likely_need: ['compliance tools', 'legal', 'QA'] },
  market_position_signal:    { urgency: 'low',      strategic_direction: 'market building',     likely_need: ['PR', 'marketing', 'analyst relations'] },
  product_signal:            { urgency: 'medium',   strategic_direction: 'product launch',      likely_need: ['cloud infra', 'dev tools', 'analytics'] },
  hiring_signal:             { urgency: 'high',     strategic_direction: 'team growth',         likely_need: ['ATS', 'recruiter', 'payroll', 'benefits'] },
  enterprise_signal:         { urgency: 'high',     strategic_direction: 'enterprise push',     likely_need: ['CRM', 'sales tools', 'security compliance'] },
  expansion_signal:          { urgency: 'medium',   strategic_direction: 'geographic expansion',likely_need: ['localization', 'legal', 'regional marketing'] },
  gtm_signal:                { urgency: 'high',     strategic_direction: 'go-to-market',        likely_need: ['CRM', 'marketing automation', 'lead gen'] },
  demand_signal:             { urgency: 'high',     strategic_direction: 'demand capture',      likely_need: ['infrastructure', 'cloud', 'ops'] },
  growth_signal:             { urgency: 'medium',   strategic_direction: 'growth',              likely_need: ['analytics', 'marketing', 'infra'] },
  partnership_signal:        { urgency: 'medium',   strategic_direction: 'ecosystem building',  likely_need: ['legal', 'partner portal'] },
  efficiency_signal:         { urgency: 'medium',   strategic_direction: 'efficiency focus',    likely_need: ['finance tools', 'ops software', 'analytics'] },
  exploratory_signal:        { urgency: 'low',      strategic_direction: 'exploration',         likely_need: [] },
};

const URGENCY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-zinc-500',
  unknown:  'text-zinc-600',
};

const SIGNAL_TYPE_ICONS: Record<string, React.ReactNode> = {
  event:          <Zap className="w-3 h-3" />,
  intent:         <Target className="w-3 h-3" />,
  posture:        <Activity className="w-3 h-3" />,
  demand:         <TrendingUp className="w-3 h-3" />,
  distress:       <AlertTriangle className="w-3 h-3" />,
  investor:       <DollarSign className="w-3 h-3" />,
  buyer:          <ShoppingCart className="w-3 h-3" />,
  talent:         <Users className="w-3 h-3" />,
  infrastructure: <Shield className="w-3 h-3" />,
  market:         <Globe className="w-3 h-3" />,
};

// ─── Evidence quality display ─────────────────────────────────────────────────
const EQ_CONFIG: Record<string, { label: string; color: string; dot: string; desc: string }> = {
  confirmed:        { label: 'Confirmed',    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', dot: 'bg-emerald-400', desc: 'Direct, explicit, high-confidence signal' },
  inferred:         { label: 'Inferred',     color: 'text-amber-400  border-amber-500/40  bg-amber-500/10',    dot: 'bg-amber-400',   desc: 'Reasonable interpretation with context support' },
  speculative:      { label: 'Speculative',  color: 'text-zinc-400   border-zinc-500/30   bg-zinc-500/10',     dot: 'bg-zinc-500',    desc: 'Weak, hedged, or insufficiently supported' },
  negated:          { label: 'Negated',      color: 'text-red-400    border-red-500/30     bg-red-500/10',      dot: 'bg-red-400',     desc: 'Signal was explicitly denied' },
  'low-information':{ label: 'Low Info',     color: 'text-zinc-600   border-zinc-700       bg-zinc-900',        dot: 'bg-zinc-700',    desc: 'Promotional or boilerplate content' },
};

const AMBIGUITY_LABELS: Record<string, string> = {
  hedged_language:         'hedged',
  vague_object:            'vague',
  unclear_actor:           'actor?',
  missing_time:            'no time',
  promotional_only:        'promo',
  multi_signal_sentence:   'multi-signal',
  conflicting_signals:     'tension',
  negated_signal:          'negated',
  reported_speech:         'reported',
  rumor_language:          'rumor',
  industry_term_ambiguous: 'ambiguous term',
  boilerplate_content:     'boilerplate',
  insufficient_context:    'needs context',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoredSignal {
  primary:           string;
  classes:           string[];
  confidence:        number;
  certainty?:        number;
  posture?:          string;
  actor?:            string;
  intent?:           string;
  meanings?:         string[];
  // Ambiguity layer
  evidence_quality?: string;
  ambiguity_flags?:  string[];
  signal_tension?:   boolean;
  negation_detected?:boolean;
  alternate_signals?: { class: string; confidence: number; meaning?: string }[];
}

interface StartupRow {
  id:            string;
  name:          string;
  article_title: string | null;
  article_url:   string | null;
  rss_source:    string | null;
  created_at:    string;
  sectors:       string[] | null;
  funding_amount:string | null;
  funding_stage: string | null;
  metadata:      { signals?: StoredSignal; [k: string]: unknown } | null;
}

interface SignalCard {
  id:              string;
  name:            string;
  headline:        string;
  source:          string;
  url:             string | null;
  date:            string;
  sectors:         string[];
  signal:          StoredSignal;
  signal_strength: number;
  who_cares:       { investors: boolean; vendors: boolean; acquirers: boolean; recruiters: boolean };
  inference:       { urgency: string; strategic_direction: string; likely_need: string[] };
}

type Perspective = 'all' | 'investors' | 'vendors' | 'acquirers' | 'recruiters';
type ActiveTab   = 'signals' | 'trajectories' | 'matches';

// ── Trajectory row from pythh_active_trajectories view ───────────────────────
interface TrajectoryRow {
  id:                       string;
  computed_at:              string;
  entity_name?:             string;
  entity_type?:             string;
  entity_stage?:            string;
  time_window_days?:        number;
  dominant_trajectory?:     string;
  trajectory_type?:         string;
  trajectory_label?:        string;
  trajectory_confidence?:   number;
  velocity_score?:          number;
  momentum?:                string;
  acceleration?:            string;
  consistency_score?:       number;
  current_stage?:           string;
  stage_transition_detected?: boolean;
  dominant_signal?:         string;
  predicted_next_moves?:    string[];
  prediction?:              unknown;
  anomalies?:               unknown[];
  total_signals?:           number;
  last_signal_date?:        string;
  // from join (not in view but added for backward compat)
  stage_from?:              string;
  stage_to?:                string;
  supporting_signals?:      string[];
}

// ── Match row from pythh_top_matches ──────────────────────────────────────────
interface MatchRow {
  id:                 string;
  entity_name?:       string;
  entity_stage?:      string;
  entity_sectors?:    string[];
  candidate_name?:    string;
  candidate_type?:    string;
  match_type:         string;
  match_score:        number;
  timing_score?:      number;
  confidence?:        number;
  urgency?:           string;
  trajectory_used?:   string;
  predicted_need?:    string[];
  supporting_signals?:string[];
  explanation?:       string[];
  recommended_action?:string;
  dimension_scores?:  Record<string, number>;
  matched_at:         string;
}

// ── Trajectory type label map ─────────────────────────────────────────────────
const TRAJ_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  fundraising_active:    { label: 'Fundraising',      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: <DollarSign className="w-4 h-4" /> },
  gtm_expansion:         { label: 'GTM Expansion',    color: 'text-amber-400   border-amber-500/30   bg-amber-500/10',   icon: <Rocket className="w-4 h-4" /> },
  product_maturation:    { label: 'Product Build',    color: 'text-sky-400     border-sky-500/30     bg-sky-500/10',     icon: <Zap className="w-4 h-4" /> },
  buyer_procurement:     { label: 'Buyer Intent',     color: 'text-cyan-400    border-cyan-500/30    bg-cyan-500/10',    icon: <ShoppingCart className="w-4 h-4" /> },
  distress_survival:     { label: 'Distress',         color: 'text-red-400     border-red-500/30     bg-red-500/10',     icon: <AlertTriangle className="w-4 h-4" /> },
  exit_preparation:      { label: 'Exit Prep',        color: 'text-violet-400  border-violet-500/30  bg-violet-500/10',  icon: <Target className="w-4 h-4" /> },
  repositioning:         { label: 'Repositioning',    color: 'text-orange-400  border-orange-500/30  bg-orange-500/10',  icon: <GitBranch className="w-4 h-4" /> },
  regulatory_enterprise: { label: 'Enterprise Push',  color: 'text-indigo-400  border-indigo-500/30  bg-indigo-500/10',  icon: <Shield className="w-4 h-4" /> },
  growth:                { label: 'Growth',           color: 'text-teal-400    border-teal-500/30    bg-teal-500/10',    icon: <TrendingUp className="w-4 h-4" /> },
  expansion:             { label: 'Expansion',        color: 'text-teal-400    border-teal-500/30    bg-teal-500/10',    icon: <Globe className="w-4 h-4" /> },
  unknown:               { label: 'Unknown',          color: 'text-zinc-400    border-zinc-600       bg-zinc-800',       icon: <Activity className="w-4 h-4" /> },
};

const MATCH_TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  capital_match:   { label: 'Investor Match',  color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', icon: <DollarSign className="w-3.5 h-3.5" /> },
  vendor_match:    { label: 'Vendor Match',    color: 'text-cyan-400    border-cyan-500/30    bg-cyan-500/10',    icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  partner_match:   { label: 'Partner Match',   color: 'text-purple-400  border-purple-500/30  bg-purple-500/10',  icon: <Layers className="w-3.5 h-3.5" /> },
  talent_match:    { label: 'Talent Match',    color: 'text-indigo-400  border-indigo-500/30  bg-indigo-500/10',  icon: <Users className="w-3.5 h-3.5" /> },
  acquirer_match:  { label: 'Acquirer Match',  color: 'text-violet-400  border-violet-500/30  bg-violet-500/10',  icon: <Building className="w-3.5 h-3.5" /> },
  advisor_match:   { label: 'Advisor Match',   color: 'text-amber-400   border-amber-500/30   bg-amber-500/10',   icon: <Briefcase className="w-3.5 h-3.5" /> },
  buyer_match:     { label: 'Buyer Match',     color: 'text-orange-400  border-orange-500/30  bg-orange-500/10',  icon: <Target className="w-3.5 h-3.5" /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toSignalCard(row: StartupRow): SignalCard | null {
  const sig = row.metadata?.signals;
  if (!sig || !sig.primary || sig.primary === 'unclassified_signal') return null;

  const primary  = sig.primary;
  const strength = sig.confidence ?? 0.5;

  return {
    id:              row.id,
    name:            row.name,
    headline:        row.article_title || '',
    source:          row.rss_source    || 'unknown',
    url:             row.article_url,
    date:            row.created_at,
    sectors:         Array.isArray(row.sectors) ? row.sectors : [],
    signal:          sig,
    signal_strength: strength,
    who_cares:       WHO_CARES_MAP[primary] ?? { investors: false, vendors: false, acquirers: false, recruiters: false },
    inference:       INFERENCE_MAP[primary] ?? { urgency: 'unknown', strategic_direction: 'unknown', likely_need: [] },
  };
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (hours < 1)  return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Components ───────────────────────────────────────────────────────────────
function SignalBadge({ primary }: { primary: string }) {
  const c = SIGNAL_COLORS[primary] ?? SIGNAL_COLORS.unclassified_signal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      {SIGNAL_LABELS[primary] ?? primary}
    </span>
  );
}

function StrengthBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-zinc-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

function WhoCaresDots({ wc }: { wc: { investors: boolean; vendors: boolean; acquirers: boolean; recruiters: boolean } }) {
  const items = [
    { key: 'investors',  label: 'Investors',  icon: <DollarSign className="w-3 h-3" />,  on: wc.investors  },
    { key: 'vendors',    label: 'Vendors',    icon: <ShoppingCart className="w-3 h-3" />, on: wc.vendors    },
    { key: 'acquirers',  label: 'Acquirers',  icon: <Building className="w-3 h-3" />,    on: wc.acquirers  },
    { key: 'recruiters', label: 'Recruiters', icon: <Users className="w-3 h-3" />,       on: wc.recruiters },
  ];
  return (
    <div className="flex gap-1.5">
      {items.map(({ key, label, icon, on }) => (
        <span
          key={key}
          title={label}
          className={`p-1.5 rounded-md border transition-colors ${
            on
              ? 'bg-white/10 border-white/20 text-white'
              : 'bg-transparent border-white/5 text-zinc-700'
          }`}
        >
          {icon}
        </span>
      ))}
    </div>
  );
}

function EvidenceBadge({ quality }: { quality: string }) {
  const cfg = EQ_CONFIG[quality] ?? EQ_CONFIG.speculative;
  return (
    <span title={cfg.desc} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AmbiguityFlags({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {flags.slice(0, 4).map(f => (
        <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
          {AMBIGUITY_LABELS[f] ?? f}
        </span>
      ))}
    </div>
  );
}

function AlternateSignals({ alts }: { alts: { class: string; confidence: number }[] }) {
  if (!alts || alts.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] text-zinc-600 uppercase tracking-wider">might be:</span>
      {alts.slice(0, 2).map(a => (
        <span key={a.class} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5">
          {SIGNAL_LABELS[a.class] ?? a.class} {Math.round(a.confidence * 100)}%
        </span>
      ))}
    </div>
  );
}

// ─── Trajectory Card ──────────────────────────────────────────────────────────
function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke="currentColor" strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${color}`}>{pct}</span>
      </div>
      <span className="text-[10px] text-zinc-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function TrajectoryCard({ row }: { row: TrajectoryRow }) {
  const ttype = row.trajectory_type || row.dominant_trajectory || 'unknown';
  const meta  = TRAJ_LABELS[ttype] ?? TRAJ_LABELS.unknown;
  const anomalyCount  = (row.anomalies || []).length;
  const nextMoves     = row.predicted_next_moves || [];
  const suppSignals   = row.supporting_signals   || [];
  const momentum      = row.momentum;
  const accel         = row.acceleration;

  return (
    <div className={`relative bg-white/[0.03] border rounded-xl p-5 hover:bg-white/[0.05] transition-all ${meta.color.split(' ')[1]}`}>
      <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full ${meta.color.split(' ')[0].replace('text-', 'bg-')}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 pl-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-white font-bold text-base">{row.entity_name || 'Unknown'}</span>
            {anomalyCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                ⚡ {anomalyCount} anomal{anomalyCount === 1 ? 'y' : 'ies'}
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </span>
        </div>
        <div className="text-right shrink-0">
          {momentum && <div className="text-[10px] text-zinc-500 capitalize">{momentum}</div>}
          {accel    && <div className="text-[10px] text-zinc-600 capitalize">{accel}</div>}
          <div className="text-[10px] text-zinc-600 mt-1">
            {row.total_signals ?? 0} signal{(row.total_signals ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Score rings */}
      <div className="pl-2 flex items-center gap-4 mb-4">
        <ScoreRing value={row.trajectory_confidence ?? 0} label="Confidence" color="text-amber-400" />
        <ScoreRing value={row.velocity_score ?? 0}        label="Velocity"   color="text-emerald-400" />
        <ScoreRing value={row.consistency_score ?? 0}     label="Consistency" color="text-cyan-400" />
        <div className="flex-1 ml-2">
          {row.current_stage && (
            <div className="text-[11px] text-zinc-400 mb-1">
              Stage: <span className="text-white font-medium">{row.current_stage.replace(/_/g, ' ')}</span>
            </div>
          )}
          {row.dominant_signal && (
            <div className="text-[11px] text-zinc-500 mt-1">
              Dominant: <span className="text-zinc-300">{SIGNAL_LABELS[row.dominant_signal] ?? row.dominant_signal.replace(/_/g,' ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Predicted next moves */}
      {nextMoves.length > 0 && (
        <div className="pl-2 mb-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Predicted Next</p>
          <div className="flex flex-wrap gap-1.5">
            {nextMoves.slice(0, 4).map(m => (
              <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                {m.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supporting signals */}
      {suppSignals.length > 0 && (
        <div className="pl-2 pt-3 border-t border-white/5 flex flex-wrap gap-1">
          {suppSignals.slice(0, 5).map(s => {
            const c = SIGNAL_COLORS[s] ?? SIGNAL_COLORS.unclassified_signal;
            return (
              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}>
                {SIGNAL_LABELS[s] ?? s.replace(/_/g,' ')}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ row }: { row: MatchRow }) {
  const mtype  = row.match_type || 'capital_match';
  const meta   = MATCH_TYPE_META[mtype] ?? MATCH_TYPE_META.capital_match;
  const urgColor = URGENCY_COLORS[row.urgency] ?? URGENCY_COLORS.unknown;
  const scorePct = Math.round((row.match_score || 0) * 100);
  const scoreColor = scorePct >= 75 ? 'bg-emerald-500' : scorePct >= 55 ? 'bg-amber-500' : 'bg-orange-500';

  return (
    <div className={`relative bg-white/[0.03] border rounded-xl p-5 hover:bg-white/[0.05] transition-all ${meta.color.split(' ')[1]}`}>
      <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full ${meta.color.split(' ')[0].replace('text-', 'bg-')}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 pl-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-zinc-600 mb-0.5">{row.entity_name || 'Unknown Company'}</div>
          <div className="text-white font-bold text-sm truncate">{row.candidate_name || 'Unknown Candidate'}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${meta.color}`}>
              {meta.icon} {meta.label}
            </span>
            <span className={`text-[11px] font-medium ${urgColor}`}>{row.urgency} urgency</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-white">{scorePct}<span className="text-sm text-zinc-500">%</span></div>
          <div className="text-[10px] text-zinc-600">match score</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="pl-2 mb-3">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${scoreColor} transition-all`} style={{ width: `${scorePct}%` }} />
        </div>
      </div>

      {/* Dimension scores */}
      {row.dimension_scores && Object.keys(row.dimension_scores).length > 0 && (
        <div className="pl-2 mb-3 grid grid-cols-3 gap-2">
          {Object.entries(row.dimension_scores).slice(0, 6).map(([key, val]) => (
            <div key={key} className="text-center">
              <div className="text-[11px] text-white font-medium">{Math.round((val as number) * 100)}%</div>
              <div className="text-[9px] text-zinc-600 capitalize">{key.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Explanation */}
      {(row.explanation || []).length > 0 && (
        <div className="pl-2 mb-3 space-y-1">
          {row.explanation.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
              <CheckCircle2 className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Predicted needs + action */}
      <div className="pl-2 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 min-w-0">
          {(row.predicted_need || []).slice(0, 3).map(n => (
            <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5">
              {n.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        {row.recommended_action && (
          <span className="text-[10px] text-amber-400 shrink-0 text-right">{row.recommended_action}</span>
        )}
      </div>
    </div>
  );
}

function SignalCard({ card }: { card: SignalCard }) {
  const primary    = card.signal.primary;
  const colors     = SIGNAL_COLORS[primary] ?? SIGNAL_COLORS.unclassified_signal;
  const sigType    = (card.signal as unknown as Record<string, string>)?.signal_type ?? 'event';
  const urgColor   = URGENCY_COLORS[card.inference.urgency] ?? URGENCY_COLORS.unknown;
  const meanings   = card.signal.meanings?.slice(0, 2) ?? [];
  const typeIcon   = SIGNAL_TYPE_ICONS[sigType];
  const eq         = card.signal.evidence_quality ?? 'inferred';
  const flags      = card.signal.ambiguity_flags  ?? [];
  const alts       = card.signal.alternate_signals ?? [];
  const hasTension = card.signal.signal_tension;

  // Cards that are negated or low-info get visually dimmed
  const isDimmed = eq === 'negated' || eq === 'low-information';

  return (
    <div className={`group relative bg-white/[0.03] border rounded-xl p-5 transition-all
      ${isDimmed ? 'opacity-40 hover:opacity-60' : 'hover:bg-white/[0.05]'}
      ${colors.border}`}>
      {/* Colored left accent */}
      <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full ${colors.text.replace('text-', 'bg-')}`} />

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3 pl-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-white font-bold text-base truncate">{card.name}</span>
            {card.sectors[0] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 hidden sm:inline">
                {card.sectors[0]}
              </span>
            )}
            {hasTension && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                ⚡ tension
              </span>
            )}
          </div>
          {card.headline && (
            <p className="text-zinc-500 text-xs leading-snug line-clamp-2">{card.headline}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <SignalBadge primary={primary} />
          <EvidenceBadge quality={eq} />
          <span className="text-[10px] text-zinc-600">{relativeDate(card.date)}</span>
        </div>
      </div>

      {/* Signal strength */}
      <div className="pl-2 mb-3">
        <StrengthBar value={card.signal_strength} />
      </div>

      {/* Middle row — type + urgency + direction */}
      <div className="pl-2 flex items-center gap-3 mb-2 flex-wrap">
        {typeIcon && (
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            {typeIcon}
            <span className="capitalize">{sigType}</span>
          </span>
        )}
        <span className={`text-[11px] font-medium ${urgColor}`}>
          {card.inference.urgency} urgency
        </span>
        <span className="text-[11px] text-zinc-500 truncate">
          → {card.inference.strategic_direction}
        </span>
      </div>

      {/* Alternate signals (might mean Y) */}
      {alts.length > 0 && (
        <div className="pl-2 mb-2">
          <AlternateSignals alts={alts} />
        </div>
      )}

      {/* Ambiguity flags */}
      {flags.length > 0 && (
        <div className="pl-2 mb-3">
          <AmbiguityFlags flags={flags} />
        </div>
      )}

      {/* Inferred meanings */}
      {meanings.length > 0 && !isDimmed && (
        <div className="pl-2 flex gap-1.5 flex-wrap mb-3">
          {meanings.map(m => (
            <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">
              {m.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row — who cares + likely need tags + source */}
      <div className="pl-2 flex items-center justify-between gap-3 pt-3 border-t border-white/5">
        <WhoCaresDots wc={card.who_cares} />
        <div className="flex items-center gap-2 min-w-0">
          {card.inference.likely_need.slice(0, 2).map(n => (
            <span key={n} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 hidden md:inline truncate">
              {n}
            </span>
          ))}
          {card.url && (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 p-1.5 rounded-md bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              title="View article"
            >
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────
function PillFilter<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            value === o.value
              ? 'bg-amber-500 text-black border-amber-500'
              : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-center">
      <div className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</div>
      <div className="text-zinc-500 text-xs mt-0.5">{label}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const SIGNAL_CLASS_OPTIONS = [
  { value: 'all',                    label: 'All Signals' },
  { value: 'fundraising_signal',     label: 'Fundraising' },
  { value: 'revenue_signal',         label: 'Revenue' },
  { value: 'buyer_signal',           label: 'Buying' },
  { value: 'buyer_pain_signal',      label: 'Pain' },
  { value: 'buyer_budget_signal',    label: 'Budget Ready' },
  { value: 'distress_signal',        label: 'Distress' },
  { value: 'hiring_signal',          label: 'Hiring' },
  { value: 'product_signal',         label: 'Product' },
  { value: 'expansion_signal',       label: 'Expansion' },
  { value: 'enterprise_signal',      label: 'Enterprise' },
  { value: 'exit_signal',            label: 'Exit Prep' },
  { value: 'investor_interest_signal', label: 'Investor Interest' },
];

const PERSPECTIVE_OPTIONS: { value: Perspective; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'investors', label: 'Investors' },
  { value: 'vendors',   label: 'Vendors' },
  { value: 'acquirers', label: 'Acquirers' },
  { value: 'recruiters',label: 'Recruiters' },
];

const SORT_OPTIONS = [
  { value: 'strength', label: 'Strongest first' },
  { value: 'newest',   label: 'Newest first' },
  { value: 'urgency',  label: 'Most urgent' },
];

const EQ_FILTER_OPTIONS = [
  { value: 'all',       label: 'All tiers' },
  { value: 'confirmed', label: '✅ Confirmed' },
  { value: 'inferred',  label: '🔶 Inferred' },
  { value: 'speculative',label: '⬜ Speculative' },
];

const URGENCY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

export default function SignalFeedPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab]     = useState<ActiveTab>('signals');
  const [allCards, setAllCards]       = useState<SignalCard[]>([]);
  const [trajectories, setTrajectories] = useState<TrajectoryRow[]>([]);
  const [matches, setMatches]         = useState<MatchRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [perspective, setPerspective] = useState<Perspective>('all');
  const [signalClass, setSignalClass] = useState('all');
  const [eqFilter, setEqFilter]       = useState('all');
  const [sort, setSort]               = useState('strength');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(0);
  const [trajSearch, setTrajSearch]   = useState('');
  const [matchType, setMatchType]     = useState('all');

  const PAGE_SIZE = 30;

  const loadSignals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await sb
        .from('discovered_startups')
        .select('id, name, article_title, article_url, rss_source, created_at, sectors, funding_amount, funding_stage, metadata')
        .not('metadata', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const cards = (data as StartupRow[])
        .map(toSignalCard)
        .filter((c): c is SignalCard => c !== null);

      setAllCards(cards);
    } catch (err) {
      console.error('Signal feed load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrajectories = useCallback(async () => {
    try {
      const { data, error } = await sb
        .from('pythh_active_trajectories')
        .select('*')
        .order('velocity_score', { ascending: false })
        .limit(200);
      if (error) throw error;
      setTrajectories((data || []) as TrajectoryRow[]);
    } catch (err) {
      console.error('Trajectory load error:', err);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const { data, error } = await sb
        .from('pythh_top_matches')
        .select('*')
        .limit(300);
      if (error) throw error;
      setMatches((data || []) as MatchRow[]);
    } catch (err) {
      console.error('Matches load error:', err);
    }
  }, []);

  useEffect(() => { loadSignals(); loadTrajectories(); loadMatches(); }, [loadSignals, loadTrajectories, loadMatches]);
  useEffect(() => { setPage(0); }, [perspective, signalClass, eqFilter, sort, search, activeTab]);

  // ── Filter & sort ──────────────────────────────────────────────────────────
  const filtered = allCards
    .filter(c => {
      if (perspective !== 'all' && !c.who_cares[perspective]) return false;
      if (signalClass !== 'all' && c.signal.primary !== signalClass) return false;
      if (eqFilter !== 'all' && (c.signal.evidence_quality ?? 'inferred') !== eqFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.headline.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'strength') return b.signal_strength - a.signal_strength;
      if (sort === 'newest')   return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sort === 'urgency')  return (URGENCY_RANK[b.inference.urgency] ?? 0) - (URGENCY_RANK[a.inference.urgency] ?? 0);
      return 0;
    });

  const pageSlice    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages   = Math.ceil(filtered.length / PAGE_SIZE);

  // ── Trajectory filter ──────────────────────────────────────────────────────
  const filteredTrajs = trajectories.filter(t =>
    !trajSearch || (t.entity_name || '').toLowerCase().includes(trajSearch.toLowerCase())
  );

  // ── Match filter ───────────────────────────────────────────────────────────
  const filteredMatches = matches.filter(m =>
    (matchType === 'all' || m.match_type === matchType) &&
    (!trajSearch || (m.entity_name || '').toLowerCase().includes(trajSearch.toLowerCase()) ||
      (m.candidate_name || '').toLowerCase().includes(trajSearch.toLowerCase()))
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSignals   = allCards.length;
  const highUrgency    = allCards.filter(c => c.inference.urgency === 'high' || c.inference.urgency === 'critical').length;
  const investorCards  = allCards.filter(c => c.who_cares.investors).length;
  const avgStrength    = totalSignals > 0
    ? Math.round(allCards.reduce((s, c) => s + c.signal_strength, 0) / totalSignals * 100)
    : 0;
  const highUrgencyMatches = matches.filter(m => m.urgency === 'high').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Radio className="w-8 h-8 text-amber-400 animate-pulse" />
          <span className="text-white text-xl">Loading Signal Intelligence…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <LogoDropdownMenu />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-20">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <span className="text-amber-400">[pyth]</span>
                <span className="text-cyan-400">signal</span>
                <span>Intelligence</span>
              </h1>
              <p className="text-zinc-500 mt-1 text-sm">
                Language → Intent → Action.
                <span className="text-zinc-600 ml-1">{totalSignals.toLocaleString()} signals · {trajectories.length} trajectories · {matches.length} matches</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => { loadSignals(); loadTrajectories(); loadMatches(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-zinc-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatPill label="Signals"           value={totalSignals.toLocaleString()}     color="text-amber-400" />
          <StatPill label="Active Trajectories" value={trajectories.length.toLocaleString()} color="text-cyan-400" />
          <StatPill label="Matches"           value={matches.length.toLocaleString()}   color="text-emerald-400" />
          <StatPill label="High-Urgency"      value={highUrgencyMatches.toLocaleString()} color="text-orange-400" />
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-1 w-fit">
          {([
            { id: 'signals',      label: 'Signals',      icon: <Radio className="w-3.5 h-3.5" />,      count: totalSignals },
            { id: 'trajectories', label: 'Trajectories', icon: <TrendingUp className="w-3.5 h-3.5" />, count: trajectories.length },
            { id: 'matches',      label: 'Matches',      icon: <Target className="w-3.5 h-3.5" />,     count: matches.length },
          ] as { id: ActiveTab; label: string; icon: React.ReactNode; count: number }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'bg-amber-500 text-black'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-black/20 text-black/70' : 'bg-white/10 text-zinc-500'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TRAJECTORIES TAB                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'trajectories' && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  value={trajSearch}
                  onChange={e => setTrajSearch(e.target.value)}
                  placeholder="Filter by company name…"
                  className="pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 w-full"
                />
              </div>
              <p className="text-sm text-zinc-500">
                <span className="text-white font-medium">{filteredTrajs.length}</span> trajectories (90-day window)
              </p>
            </div>
            {filteredTrajs.length === 0 ? (
              <div className="text-center py-24 text-zinc-600">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No trajectories yet.</p>
                <p className="text-sm mt-1">Run <code className="bg-white/5 px-1 rounded">node scripts/compute-trajectories.js --apply</code> to populate.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTrajs.map(t => <TrajectoryCard key={t.id} row={t} />)}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  MATCHES TAB                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'matches' && (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  value={trajSearch}
                  onChange={e => setTrajSearch(e.target.value)}
                  placeholder="Filter company or candidate…"
                  className="pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 w-full"
                />
              </div>
              <PillFilter
                value={matchType}
                onChange={setMatchType}
                options={[
                  { value: 'all',           label: 'All Types' },
                  { value: 'capital_match', label: '$ Investor' },
                  { value: 'vendor_match',  label: 'Vendor' },
                  { value: 'partner_match', label: 'Partner' },
                  { value: 'talent_match',  label: 'Talent' },
                  { value: 'advisor_match', label: 'Advisor' },
                  { value: 'acquirer_match',label: 'Acquirer' },
                ] as { value: string; label: string }[]}
              />
            </div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-500">
                <span className="text-white font-medium">{filteredMatches.length}</span> matches · sorted by score + urgency
              </p>
              <div className="flex gap-2 text-[11px] text-zinc-600">
                <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" /> High urgency: {highUrgencyMatches}</span>
              </div>
            </div>
            {filteredMatches.length === 0 ? (
              <div className="text-center py-24 text-zinc-600">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No matches found.</p>
                <p className="text-sm mt-1">Run <code className="bg-white/5 px-1 rounded">node scripts/compute-matches.js --apply</code> to populate.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMatches.slice(0, 60).map(m => <MatchCard key={m.id} row={m} />)}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  SIGNALS TAB                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'signals' && (<>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 mb-6 space-y-4">
          {/* Perspective */}
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Perspective
            </p>
            <PillFilter value={perspective} onChange={setPerspective} options={PERSPECTIVE_OPTIONS} />
          </div>
          {/* Signal class */}
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> Signal Class
            </p>
            <PillFilter value={signalClass} onChange={setSignalClass} options={SIGNAL_CLASS_OPTIONS as { value: string; label: string }[]} />
          </div>
          {/* Evidence quality tier */}
          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Evidence Tier
            </p>
            <PillFilter value={eqFilter} onChange={setEqFilter} options={EQ_FILTER_OPTIONS as { value: string; label: string }[]} />
          </div>
          {/* Sort + Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" /> Sort
              </p>
              <PillFilter value={sort} onChange={setSort} options={SORT_OPTIONS as { value: string; label: string }[]} />
            </div>
            <div className="sm:ml-auto flex flex-col justify-end">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search company or headline…"
                  className="pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 w-64"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Results count ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-zinc-500">
            <span className="text-white font-medium">{filtered.length.toLocaleString()}</span> signals matching current filters
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >←</button>
              <span>{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >→</button>
            </div>
          )}
        </div>

        {/* ── Signal cards grid ───────────────────────────────────────────── */}
        {pageSlice.length === 0 ? (
          <div className="text-center py-24 text-zinc-600">
            <Radio className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No signals match these filters.</p>
            <p className="text-sm mt-1">New signals populate as the RSS scraper runs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageSlice.map(card => <SignalCard key={card.id} card={card} />)}
          </div>
        )}

        {/* ── Footer pagination ────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-8 text-sm text-zinc-500">
            <button
              disabled={page === 0}
              onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >← Prev</button>
            <span className="text-zinc-600">{page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Next →</button>
          </div>
        )}

        {/* ── Legend ───────────────────────────────────────────────────────── */}
        <div className="mt-12 space-y-4">
          {/* Evidence tier legend */}
          <div className="p-5 bg-white/[0.02] border border-white/10 rounded-xl">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Evidence Quality Tiers
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {[
                { eq: 'confirmed',   desc: 'Direct, explicit, high certainty. "We closed our $12M Series A."' },
                { eq: 'inferred',    desc: 'Reasonable interpretation with context support. "We are scaling the team."' },
                { eq: 'speculative', desc: 'Weak, hedged, or insufficiently supported. "We may expand next year."' },
              ].map(({ eq, desc }) => {
                const cfg = EQ_CONFIG[eq];
                return (
                  <div key={eq} className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 mt-0.5 ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="text-zinc-600">{desc}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-zinc-700 text-xs mt-3 pt-3 border-t border-white/5">
              Core rule: Pythh never forces a sentence into a single hard meaning when language is hedged, vague, promotional, or negated.
              Every signal carries a primary interpretation, alternates, confidence, and ambiguity flags.
            </p>
          </div>
          {/* Who cares legend */}
          <div className="p-5 bg-white/[0.02] border border-white/10 rounded-xl">
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Briefcase className="w-3 h-3" /> Signal → Who Cares
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { icon: <DollarSign className="w-3.5 h-3.5 text-emerald-400" />, label: 'Investors',  desc: 'Fundraising, exit, distress, revenue' },
                { icon: <ShoppingCart className="w-3.5 h-3.5 text-cyan-400" />,  label: 'Vendors',    desc: 'Buyer pain, RFP, budget, product' },
                { icon: <Building className="w-3.5 h-3.5 text-violet-400" />,    label: 'Acquirers',  desc: 'Acquisition, exit, distress' },
                { icon: <Users className="w-3.5 h-3.5 text-indigo-400" />,       label: 'Recruiters', desc: 'Hiring, GTM build, team signals' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02]">
                  {icon}
                  <div>
                    <div className="text-zinc-300 font-medium">{label}</div>
                    <div className="text-zinc-600 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-zinc-700 text-xs mt-3 pt-3 border-t border-white/5">
              Signal strength = confidence × base certainty. Early intent signals (6–18 months pre-event) are equally weighted to confirmed events — ambiguous early data is often the most valuable data.
            </p>
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}
