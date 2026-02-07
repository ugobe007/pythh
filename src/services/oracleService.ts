// ============================================================================
// Pythh Oracle Service
// ============================================================================
// Backend integration for the Oracle wizard, cohorts, signal actions, insights.
// All data fetched via Supabase RPCs and direct table queries.
// ============================================================================

import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OracleSession {
  session_id: string;
  current_step: number;
  status: 'created' | 'resumed' | 'active' | 'completed';
  total_steps: number;
  signal_score?: number;
}

export interface OracleStepData {
  step_number: number;
  step_key: OracleStepKey;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  signal_before: number | null;
  signal_after: number | null;
  responses: Record<string, unknown>;
  recommendations: OracleRecommendation[];
}

export type OracleStepKey =
  | 'deck_review'
  | 'value_proposition'
  | 'fundraising_strategy'
  | 'investor_alignment'
  | 'support_materials'
  | 'signal_boost'
  | 'founder_dna'
  | 'vc_targeting';

export interface OracleRecommendation {
  id: string;
  title: string;
  body: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action_type?: string;
}

export interface OracleAction {
  id: string;
  action_type: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  signal_dimension: string | null;
  estimated_lift: number;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  due_date?: string;
}

export interface OracleInsight {
  id: string;
  insight_type: 'strength' | 'gap' | 'opportunity' | 'risk' | 'milestone' | 'comparison';
  dimension: string | null;
  title: string;
  body: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
}

export interface OracleCohort {
  cohort_id: string;
  name: string;
  stage: string;
  week: number;
  total_weeks: number;
  member_count: number;
  my_progress: number;
  signal_at_join: number | null;
  signal_current: number | null;
}

export interface CohortMember {
  startup_id: string;
  startup_name: string;
  role: 'member' | 'lead' | 'mentor';
  signal_at_join: number | null;
  signal_current: number | null;
  progress_pct: number;
}

export interface OracleDashboard {
  signal_score: number;
  session: {
    session_id: string;
    current_step: number;
    status: string;
    started_at: string;
    completed_at: string | null;
    steps: OracleStepData[];
  } | null;
  actions: OracleAction[];
  insights: OracleInsight[];
  cohort: OracleCohort | null;
}

// ---------------------------------------------------------------------------
// STEP DEFINITIONS (UI metadata)
// ---------------------------------------------------------------------------

export interface StepDefinition {
  key: OracleStepKey;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  prompts: StepPrompt[];
}

export interface StepPrompt {
  id: string;
  label: string;
  hint: string;
  type: 'textarea' | 'select' | 'multi-select' | 'rating' | 'checklist';
  options?: string[];
  required?: boolean;
}

export const ORACLE_STEPS: StepDefinition[] = [
  {
    key: 'deck_review',
    number: 1,
    title: 'Deck Review',
    subtitle: 'Sharpen your pitch deck for investor conversations',
    icon: '📊',
    prompts: [
      {
        id: 'deck_link',
        label: 'Link to your current pitch deck',
        hint: 'Google Slides, Docsend, PDF link — whatever you have right now',
        type: 'textarea',
      },
      {
        id: 'deck_biggest_concern',
        label: 'What part of your deck are you least confident about?',
        hint: 'e.g., "Our market size slide feels weak" or "Team slide is missing advisors"',
        type: 'textarea',
        required: true,
      },
      {
        id: 'deck_investor_feedback',
        label: 'What feedback have investors given on your deck?',
        hint: 'Any comments, objections, or confusion investors have expressed',
        type: 'textarea',
      },
      {
        id: 'deck_slides_count',
        label: 'How many slides in your deck?',
        hint: 'Optimal is 10-15 for a seed-stage pitch',
        type: 'select',
        options: ['Under 10', '10-15', '16-20', '20+'],
      },
    ],
  },
  {
    key: 'value_proposition',
    number: 2,
    title: 'Value Proposition',
    subtitle: 'Nail the story that makes investors lean in',
    icon: '💎',
    prompts: [
      {
        id: 'one_liner',
        label: 'Your one-liner pitch (≤ 15 words)',
        hint: '"We help [who] do [what] by [how], unlike [alternatives]"',
        type: 'textarea',
        required: true,
      },
      {
        id: 'problem_statement',
        label: 'What specific problem are you solving?',
        hint: 'Be concrete — dollars lost, hours wasted, pain points',
        type: 'textarea',
        required: true,
      },
      {
        id: 'why_now',
        label: 'Why is NOW the right time for this?',
        hint: 'Market shift, regulation change, technology inflection, cultural trend',
        type: 'textarea',
        required: true,
      },
      {
        id: 'differentiation',
        label: 'What makes you different from every other solution?',
        hint: 'Proprietary tech, unique insight, unfair advantage, 10x better UX',
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    key: 'fundraising_strategy',
    number: 3,
    title: 'Fundraising Strategy',
    subtitle: 'Align your raise with the right investors at the right time',
    icon: '🎯',
    prompts: [
      {
        id: 'raise_target',
        label: 'How much are you raising?',
        hint: 'Target amount in your current round',
        type: 'select',
        options: ['< $500K', '$500K - $1M', '$1M - $3M', '$3M - $5M', '$5M - $10M', '$10M+'],
        required: true,
      },
      {
        id: 'stage',
        label: 'What stage are you at?',
        hint: 'Current fundraising stage',
        type: 'select',
        options: ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth'],
        required: true,
      },
      {
        id: 'timeline',
        label: 'When do you need to close?',
        hint: 'Runway determines urgency and leverage',
        type: 'select',
        options: ['ASAP (< 1 month)', '1-3 months', '3-6 months', '6+ months', 'Exploring / no rush'],
        required: true,
      },
      {
        id: 'investor_conversations',
        label: 'How many investor conversations have you had?',
        hint: 'Gives us a sense of where you are in the funnel',
        type: 'select',
        options: ['None yet', '1-5', '5-15', '15-30', '30+'],
      },
      {
        id: 'biggest_fundraising_challenge',
        label: "What's your biggest fundraising challenge right now?",
        hint: 'Getting meetings? Converting interest? Negotiating terms?',
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    key: 'investor_alignment',
    number: 4,
    title: 'Investor Alignment',
    subtitle: 'Target investors who actually fit your startup',
    icon: '🔗',
    prompts: [
      {
        id: 'ideal_investor_type',
        label: 'What type of investor are you looking for?',
        hint: 'VC, Angel, Family Office, Strategic, etc.',
        type: 'multi-select',
        options: ['VC Fund', 'Angel Investor', 'Family Office', 'Strategic/Corporate', 'Accelerator', 'Syndicate'],
        required: true,
      },
      {
        id: 'sector_focus',
        label: 'What sectors should your investors understand?',
        hint: 'Pick the sectors where domain expertise matters',
        type: 'multi-select',
        options: ['AI/ML', 'SaaS', 'Fintech', 'Healthcare', 'Consumer', 'Climate/Energy', 'Enterprise', 'Web3/Crypto', 'Biotech', 'Hardware', 'Marketplace', 'EdTech'],
      },
      {
        id: 'geography_preference',
        label: 'Geographic preference for investors?',
        hint: 'Where should your investors be based?',
        type: 'multi-select',
        options: ['US - Bay Area', 'US - NYC', 'US - Other', 'Europe', 'Asia', 'Global / No preference'],
      },
      {
        id: 'value_beyond_capital',
        label: 'What do you need beyond capital?',
        hint: 'Intros, hiring, domain expertise, go-to-market help',
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    key: 'support_materials',
    number: 5,
    title: 'Support Materials',
    subtitle: 'Prepare the artifacts that close deals',
    icon: '📋',
    prompts: [
      {
        id: 'materials_checklist',
        label: 'Which materials do you have ready?',
        hint: "Check everything that's prepared and investor-ready",
        type: 'checklist',
        options: [
          'Pitch Deck',
          'Financial Model',
          'Cap Table',
          'One-Pager / Executive Summary',
          'Product Demo / Video',
          'Data Room',
          'Customer References',
          'Technical Architecture Doc',
          'Team Bios / LinkedIn Profiles',
          'Press Kit / Media Coverage',
        ],
      },
      {
        id: 'missing_critical',
        label: 'What material gaps are investors asking about?',
        hint: '"They keep asking for a financial model" or "Need customer references"',
        type: 'textarea',
      },
      {
        id: 'traction_proof',
        label: "What's your strongest traction proof point?",
        hint: 'Revenue, users, partnerships, waitlist, LOIs — your best number',
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    key: 'signal_boost',
    number: 6,
    title: 'Signal Boost',
    subtitle: 'Amplify your signals to attract the right investors',
    icon: '📡',
    prompts: [
      {
        id: 'current_visibility',
        label: 'How visible is your startup right now?',
        hint: 'Press, social media, community presence',
        type: 'select',
        options: ['Stealth / very low', 'Some presence', 'Moderate - known in our niche', 'High - press coverage & recognition'],
      },
      {
        id: 'recent_wins',
        label: 'List your 3 most impressive recent wins',
        hint: 'Big customer signed, milestone hit, award won, revenue milestone',
        type: 'textarea',
        required: true,
      },
      {
        id: 'narrative_shift',
        label: 'Has your narrative or positioning changed recently?',
        hint: 'Pivots, new messaging, market repositioning',
        type: 'textarea',
      },
      {
        id: 'signal_priority',
        label: 'Which signal dimension do you most want to improve?',
        hint: 'Choose the signal you think will move the needle most',
        type: 'select',
        options: [
          'Founder Language (how you pitch)',
          'Investor Receptivity (inbound interest)',
          'News Momentum (press & buzz)',
          'Capital Convergence (funding signals)',
          'Execution Velocity (shipping speed)',
        ],
        required: true,
      },
    ],
  },
  // ------- NEW DEEP-ORACLE STEPS -------
  {
    key: 'founder_dna',
    number: 7,
    title: 'Founder DNA',
    subtitle: 'The Oracle maps who you are to who investors fund',
    icon: '🧬',
    prompts: [
      {
        id: 'archetype',
        label: 'Which founder archetype fits you best?',
        hint: 'Pick the one that resonates most — there is no wrong answer',
        type: 'select',
        options: [
          'Repeat Founder (built and exited before)',
          'Technical Visionary (deep technical insight)',
          'Domain Insider (10,000 hours in this industry)',
          'Corporate Spinout (left BigCo with an insight)',
          'Hot Startup Alumni (learned at a rocketship)',
          'Research Commercializer (PhD/lab to company)',
          'Young Technical Prodigy (under 25, exceptional)',
          'Industry Transformer (reimagining a legacy sector)',
          'Marketplace Builder (two-sided network expert)',
          'AI-Native Builder (AI is core, not a feature)',
          'Mission-Driven (personal stake in the problem)',
          'Immigrant Founder (cross-border perspective)',
          'Serial Operator (multiple companies, scaling expert)',
          'Open Source to Commercial (community-first)',
        ],
        required: true,
      },
      {
        id: 'hypothesis',
        label: 'What is the uncomfortable truth about your market that most people do not see?',
        hint: 'The Thiel question: "What important truth do very few people agree with you on?"',
        type: 'textarea',
        required: true,
      },
      {
        id: 'motivation',
        label: 'Why are YOU the person to solve this? What is the personal story?',
        hint: 'Investors fund founders, not ideas. The deeper and more specific your answer, the better.',
        type: 'textarea',
        required: true,
      },
      {
        id: 'prior_company_type',
        label: 'Where did you work before starting this?',
        hint: 'Your background signals matter to specific VCs',
        type: 'select',
        options: [
          'FAANG / Big Tech',
          'Hot Startup / Unicorn',
          'Previous Startup (founded)',
          'Research Lab / PhD',
          'Consulting / Finance',
          'Industry / Corporate',
          'Non-traditional / Self-taught',
        ],
      },
      {
        id: 'cofounders_count',
        label: 'How many co-founders do you have?',
        hint: 'Team composition is one of the strongest signals for VCs',
        type: 'select',
        options: ['Solo founder', '1 co-founder', '2 co-founders', '3+ co-founders'],
      },
      {
        id: 'technical_founder',
        label: 'Do you have a technical co-founder or are you technical yourself?',
        hint: 'Most top VCs require strong technical talent on the founding team',
        type: 'select',
        options: ['Yes - I am deeply technical', 'Yes - my co-founder is technical', 'No - hiring for it', 'Partially - can build but not deeply'],
      },
      {
        id: 'beta_customers',
        label: 'Describe your best early customer or user. Who are they and why do they love you?',
        hint: 'Quality > quantity. One amazing customer reference beats 1000 signups.',
        type: 'textarea',
      },
    ],
  },
  {
    key: 'vc_targeting',
    number: 8,
    title: 'VC Strategy',
    subtitle: 'The Oracle builds your investor approach playbook',
    icon: '🏛️',
    prompts: [
      {
        id: 'target_vcs',
        label: 'Which tier-1 VCs are you most excited about?',
        hint: 'Pick the firms you dream of partnering with',
        type: 'multi-select',
        options: [
          'Y Combinator',
          'a16z (Andreessen Horowitz)',
          'Sequoia Capital',
          'Benchmark',
          'Founders Fund',
          'Lightspeed Venture Partners',
        ],
      },
      {
        id: 'warm_intros',
        label: 'How many warm intros to tier-1 VCs can you generate right now?',
        hint: 'A warm intro is from someone the partner knows and respects',
        type: 'select',
        options: ['0 - starting from cold', '1-3 warm intros', '4-10 warm intros', '10+ warm intros'],
        required: true,
      },
      {
        id: 'vc_rejection_feedback',
        label: 'If any VCs have passed, what reasons did they give?',
        hint: 'Rejection feedback is gold. Write it all down, even what was between the lines.',
        type: 'textarea',
      },
      {
        id: 'pitch_style',
        label: 'How do you prefer to pitch?',
        hint: 'Different VCs respond to different styles — know yours',
        type: 'select',
        options: [
          'Data-driven (metrics, charts, projections)',
          'Narrative-driven (story, vision, mission)',
          'Demo-driven (show the product, then talk)',
          'Conversation-driven (explore together)',
        ],
        required: true,
      },
      {
        id: 'competitive_advantage_depth',
        label: 'What would it take for a well-funded competitor to replicate your product? How long?',
        hint: 'VCs think about moats. Be honest — "2 weeks" is a problem, "2 years" is a signal.',
        type: 'textarea',
        required: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Start or resume an Oracle session for a startup */
export async function startOracleSession(startupId: string): Promise<OracleSession> {
  const { data, error } = await supabase.rpc('oracle_start_session', {
    p_startup_id: startupId,
  });
  if (error) throw new Error(`Failed to start Oracle session: ${error.message}`);
  return data as OracleSession;
}

/** Get the full Oracle dashboard for a startup */
export async function getOracleDashboard(startupId: string): Promise<OracleDashboard> {
  const { data, error } = await supabase.rpc('oracle_get_dashboard', {
    p_startup_id: startupId,
  });
  if (error) throw new Error(`Failed to load Oracle dashboard: ${error.message}`);
  return data as OracleDashboard;
}

/** Get all steps for a session */
export async function getSessionSteps(sessionId: string): Promise<OracleStepData[]> {
  const { data, error } = await supabase
    .from('oracle_steps')
    .select('*')
    .eq('session_id', sessionId)
    .order('step_number');
  if (error) throw new Error(`Failed to load steps: ${error.message}`);
  return (data || []) as OracleStepData[];
}

/** Save step responses and mark step complete */
export async function completeStep(
  sessionId: string,
  stepNumber: number,
  responses: Record<string, unknown>,
  recommendations: OracleRecommendation[] = [],
): Promise<void> {
  const { error: stepError } = await supabase
    .from('oracle_steps')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      responses,
      recommendations,
    })
    .eq('session_id', sessionId)
    .eq('step_number', stepNumber);
  if (stepError) throw new Error(`Failed to save step: ${stepError.message}`);

  // Advance session to next step
  const nextStep = stepNumber + 1;
  const totalSteps = ORACLE_STEPS.length;
  if (nextStep <= totalSteps) {
    await supabase
      .from('oracle_sessions')
      .update({ current_step: nextStep })
      .eq('id', sessionId);

    await supabase
      .from('oracle_steps')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('step_number', nextStep);
  } else {
    // Session complete
    await supabase
      .from('oracle_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId);
  }
}

/** Generate signal actions from wizard responses */
export async function generateSignalActions(
  startupId: string,
  sessionId: string,
  stepKey: OracleStepKey,
  responses: Record<string, unknown>,
): Promise<OracleAction[]> {
  const actions = buildActionsFromResponses(stepKey, responses);

  if (actions.length === 0) return [];

  const rows = actions.map((a) => ({
    startup_id: startupId,
    session_id: sessionId,
    action_type: a.action_type,
    title: a.title,
    description: a.description,
    priority: a.priority,
    signal_dimension: a.signal_dimension,
    estimated_signal_lift: a.estimated_lift,
    status: 'pending',
  }));

  const { data, error } = await supabase
    .from('oracle_signal_actions')
    .insert(rows)
    .select();
  if (error) throw new Error(`Failed to create actions: ${error.message}`);
  return (data || []) as OracleAction[];
}

/** Update action status */
export async function updateActionStatus(
  actionId: string,
  status: 'in_progress' | 'completed' | 'dismissed',
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === 'completed') update.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('oracle_signal_actions')
    .update(update)
    .eq('id', actionId);
  if (error) throw new Error(`Failed to update action: ${error.message}`);
}

/** Get all actions for a startup */
export async function getStartupActions(startupId: string): Promise<OracleAction[]> {
  const { data, error } = await supabase
    .from('oracle_signal_actions')
    .select('*')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load actions: ${error.message}`);
  return (data || []) as OracleAction[];
}

/** Get available cohorts for a stage */
export async function getAvailableCohorts(stage: string): Promise<OracleCohort[]> {
  const { data, error } = await supabase
    .from('oracle_cohorts')
    .select(`
      id,
      name,
      description,
      stage,
      max_members,
      status,
      cohort_week,
      total_weeks
    `)
    .eq('status', 'forming')
    .eq('stage', stage);
  if (error) throw new Error(`Failed to load cohorts: ${error.message}`);

  // Enrich with member counts
  return await Promise.all(
    (data || []).map(async (c) => {
      const { count } = await supabase
        .from('oracle_cohort_members')
        .select('*', { count: 'exact', head: true })
        .eq('cohort_id', c.id)
        .eq('status', 'active');
      return {
        cohort_id: c.id,
        name: c.name,
        stage: c.stage,
        week: c.cohort_week,
        total_weeks: c.total_weeks,
        member_count: count || 0,
        my_progress: 0,
        signal_at_join: null,
        signal_current: null,
      } as OracleCohort;
    }),
  );
}

/** Join a cohort */
export async function joinCohort(
  cohortId: string,
  startupId: string,
  signalScore: number,
): Promise<void> {
  const { error } = await supabase.from('oracle_cohort_members').insert({
    cohort_id: cohortId,
    startup_id: startupId,
    signal_at_join: signalScore,
    signal_current: signalScore,
  });
  if (error) throw new Error(`Failed to join cohort: ${error.message}`);
}

/** Get cohort members */
export async function getCohortMembers(cohortId: string): Promise<CohortMember[]> {
  const { data, error } = await supabase
    .from('oracle_cohort_members')
    .select(`
      startup_id,
      role,
      signal_at_join,
      signal_current,
      progress_pct,
      startup_uploads!inner(name)
    `)
    .eq('cohort_id', cohortId)
    .eq('status', 'active');
  if (error) throw new Error(`Failed to load members: ${error.message}`);
  return (data || []).map((m: any) => ({
    startup_id: m.startup_id,
    startup_name: m.startup_uploads?.name || 'Unknown',
    role: m.role,
    signal_at_join: m.signal_at_join,
    signal_current: m.signal_current,
    progress_pct: m.progress_pct,
  }));
}

// ---------------------------------------------------------------------------
// Action Generation Logic (rule-based, runs client-side)
// ---------------------------------------------------------------------------

function buildActionsFromResponses(
  stepKey: OracleStepKey,
  responses: Record<string, unknown>,
): Omit<OracleAction, 'id' | 'status' | 'due_date'>[] {
  const actions: Omit<OracleAction, 'id' | 'status' | 'due_date'>[] = [];

  switch (stepKey) {
    case 'deck_review': {
      const slideCount = responses.deck_slides_count as string;
      if (slideCount === '20+') {
        actions.push({
          action_type: 'deck_fix',
          title: 'Trim your deck to 12-15 slides',
          description: 'Decks over 20 slides lose investor attention. Cut to the essentials: problem, solution, market, traction, team, ask.',
          priority: 'high',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.3,
        });
      }
      if (responses.deck_biggest_concern) {
        actions.push({
          action_type: 'deck_fix',
          title: 'Address your weakest deck section',
          description: `You identified a concern: "${String(responses.deck_biggest_concern).slice(0, 100)}". Strengthen this slide with data, visuals, or a clearer narrative.`,
          priority: 'high',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.4,
        });
      }
      break;
    }
    case 'value_proposition': {
      const oneLiner = String(responses.one_liner || '');
      if (oneLiner.split(' ').length > 20) {
        actions.push({
          action_type: 'narrative_rewrite',
          title: 'Tighten your one-liner to ≤ 15 words',
          description: 'Your one-liner is too long. Investors decide in seconds — make every word count.',
          priority: 'critical',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.5,
        });
      }
      if (!responses.why_now || String(responses.why_now).length < 20) {
        actions.push({
          action_type: 'narrative_rewrite',
          title: 'Strengthen your "Why Now?" narrative',
          description: 'The "Why Now?" is one of the most important signals for investors. Link to a concrete market shift.',
          priority: 'high',
          signal_dimension: 'investor_receptivity',
          estimated_lift: 0.4,
        });
      }
      break;
    }
    case 'fundraising_strategy': {
      const conversations = responses.investor_conversations as string;
      if (conversations === 'None yet' || conversations === '1-5') {
        actions.push({
          action_type: 'outreach_template',
          title: 'Build your investor outreach pipeline',
          description: 'You need more at-bats. Create a target list of 50+ investors and craft personalized outreach templates.',
          priority: 'critical',
          signal_dimension: 'capital_convergence',
          estimated_lift: 0.6,
        });
      }
      const timeline = responses.timeline as string;
      if (timeline?.includes('ASAP')) {
        actions.push({
          action_type: 'investor_targeting',
          title: 'Prioritize quick-decision investors',
          description: 'With tight timelines, target angels and pre-seed funds known for fast decisions (< 2 weeks).',
          priority: 'critical',
          signal_dimension: 'capital_convergence',
          estimated_lift: 0.4,
        });
      }
      break;
    }
    case 'investor_alignment': {
      if (responses.value_beyond_capital) {
        actions.push({
          action_type: 'investor_targeting',
          title: 'Match investors by value-add, not just check size',
          description: `You want: "${String(responses.value_beyond_capital).slice(0, 80)}". Filter your target list for investors who bring this specific value.`,
          priority: 'medium',
          signal_dimension: 'investor_receptivity',
          estimated_lift: 0.3,
        });
      }
      break;
    }
    case 'support_materials': {
      const checklist = (responses.materials_checklist as string[]) || [];
      const critical = ['Financial Model', 'Cap Table', 'Data Room'];
      const missing = critical.filter((c) => !checklist.includes(c));
      if (missing.length > 0) {
        actions.push({
          action_type: 'metrics_update',
          title: `Prepare missing materials: ${missing.join(', ')}`,
          description: `Investors often request ${missing.join(', ')} during diligence. Having these ready shortens your close time.`,
          priority: missing.length >= 2 ? 'high' : 'medium',
          signal_dimension: 'execution_velocity',
          estimated_lift: 0.3 * missing.length,
        });
      }
      break;
    }
    case 'signal_boost': {
      const visibility = responses.current_visibility as string;
      if (visibility?.includes('Stealth') || visibility?.includes('very low')) {
        actions.push({
          action_type: 'social_proof',
          title: 'Increase public visibility',
          description: 'Low visibility starves your signals. Post weekly updates, engage in communities, build a public narrative.',
          priority: 'high',
          signal_dimension: 'news_momentum',
          estimated_lift: 0.5,
        });
      }
      const priority = responses.signal_priority as string;
      if (priority) {
        const dimensionMap: Record<string, string> = {
          'Founder Language': 'founder_language_shift',
          'Investor Receptivity': 'investor_receptivity',
          'News Momentum': 'news_momentum',
          'Capital Convergence': 'capital_convergence',
          'Execution Velocity': 'execution_velocity',
        };
        const dim = Object.entries(dimensionMap).find(([k]) => priority.includes(k));
        if (dim) {
          actions.push({
            action_type: 'pitch_practice',
            title: `Focus signal boost: ${dim[0]}`,
            description: `You chose to prioritize ${dim[0]}. We'll generate weekly micro-tasks to move this signal dimension.`,
            priority: 'medium',
            signal_dimension: dim[1],
            estimated_lift: 0.3,
          });
        }
      }
      break;
    }
    case 'founder_dna': {
      const archetype = responses.archetype as string;
      if (!responses.hypothesis || String(responses.hypothesis).length < 50) {
        actions.push({
          action_type: 'narrative_rewrite',
          title: 'Deepen your contrarian insight',
          description: 'The Oracle needs a sharper hypothesis. "What important truth do few people agree with you on?" Write at least 3 sentences explaining WHY the market is wrong.',
          priority: 'critical',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.6,
        });
      }
      if (!responses.motivation || String(responses.motivation).length < 50) {
        actions.push({
          action_type: 'narrative_rewrite',
          title: 'Tell your founder origin story',
          description: 'VCs invest in founders with deep personal connection to the problem. Write the specific moment you decided to build this company.',
          priority: 'high',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.5,
        });
      }
      const cofounderCount = responses.cofounders_count as string;
      if (cofounderCount === 'Solo founder') {
        actions.push({
          action_type: 'team_building',
          title: 'Solo founder risk — build your support network',
          description: 'Most top VCs prefer co-founding teams. If solo, build an exceptional advisory board and document why your situation is an advantage, not a risk.',
          priority: 'high',
          signal_dimension: 'investor_receptivity',
          estimated_lift: 0.4,
        });
      }
      const technical = responses.technical_founder as string;
      if (technical === 'No - hiring for it') {
        actions.push({
          action_type: 'team_building',
          title: 'Secure a technical co-founder or CTO',
          description: 'A16z, YC, and Founders Fund strongly prefer teams with technical co-founders. This is your highest-priority team gap.',
          priority: 'critical',
          signal_dimension: 'investor_receptivity',
          estimated_lift: 0.7,
        });
      }
      break;
    }
    case 'vc_targeting': {
      const warmIntros = responses.warm_intros as string;
      if (warmIntros === '0 - starting from cold') {
        actions.push({
          action_type: 'investor_targeting',
          title: 'Build warm intro pipeline — you need at least 3',
          description: 'Cold outreach to tier-1 VCs rarely works. Identify 2nd-degree connections on LinkedIn, angel investors who can bridge, or attend events where partners speak.',
          priority: 'critical',
          signal_dimension: 'capital_convergence',
          estimated_lift: 0.8,
        });
      }
      const targetVCs = (responses.target_vcs as string[]) || [];
      if (targetVCs.length > 4) {
        actions.push({
          action_type: 'investor_targeting',
          title: 'Narrow your VC target list',
          description: 'Focus on 2-3 dream VCs and prepare deeply for those. Spray-and-pray signals desperation.',
          priority: 'medium',
          signal_dimension: 'investor_receptivity',
          estimated_lift: 0.3,
        });
      }
      if (responses.vc_rejection_feedback && String(responses.vc_rejection_feedback).length > 20) {
        actions.push({
          action_type: 'narrative_rewrite',
          title: 'Turn rejections into ammunition',
          description: `You have VC feedback to learn from: "${String(responses.vc_rejection_feedback).slice(0, 100)}...". Rewrite the specific part of your pitch that triggered this concern.`,
          priority: 'high',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.5,
        });
      }
      const moat = String(responses.competitive_advantage_depth || '');
      if (moat.length < 50) {
        actions.push({
          action_type: 'narrative_rewrite',
          title: 'Articulate your moat more clearly',
          description: 'VCs need to understand defensibility. Write a detailed explanation of why a well-funded competitor cannot easily replicate your business.',
          priority: 'high',
          signal_dimension: 'founder_language_shift',
          estimated_lift: 0.4,
        });
      }
      break;
    }
  }

  return actions;
}
