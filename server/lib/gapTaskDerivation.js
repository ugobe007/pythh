'use strict';

/**
 * GOD gap task catalog + derivation — shared by wizard API and preview Oracle teaser.
 */

const TASK_CATALOG = {
  add_technical_cofounder: {
    component: 'team',
    title: 'Add a technical co-founder',
    description:
      'Investors consistently flag solo non-technical founders as the biggest team risk. A technical co-founder with relevant domain experience is the single highest-impact team signal you can add.',
    impact_points: 18,
    proof_type: 'names_list',
    proof_label: 'Enter their name(s) and LinkedIn URL',
    priority: 1,
  },
  grow_team_to_3: {
    component: 'team',
    title: 'Grow your team to 3+ people',
    description:
      'Teams of 3 or more demonstrate execution capacity. Each additional team member with a relevant background signals commitment and reduces single-point-of-failure risk.',
    impact_points: 8,
    proof_type: 'count',
    proof_label: 'How many people are on your team now?',
    priority: 2,
  },
  add_advisors: {
    component: 'team',
    title: 'Add 2+ domain advisors',
    description:
      'Advisors with credibility in your sector signal that respected people have evaluated and bet on you. Aim for at least one with direct operator experience.',
    impact_points: 6,
    proof_type: 'names_list',
    proof_label: 'Enter advisor names and their background',
    priority: 3,
  },
  document_founder_backgrounds: {
    component: 'team',
    title: 'Document founder backgrounds',
    description:
      'Prior company names, universities, and domain experience are used to compute founder pedigree. Update your profile with all relevant experience.',
    impact_points: 5,
    proof_type: 'text',
    proof_label: "Describe your founding team's relevant experience",
    priority: 4,
  },
  secure_first_customer: {
    component: 'traction',
    title: 'Sign your first paying customer',
    description:
      'A single paying customer is a 14-point GOD score signal. It eliminates the "zero to one" risk that kills most pre-revenue deals. Any dollar amount counts.',
    impact_points: 14,
    proof_type: 'names_list',
    proof_label: 'Company name and what they pay (or letter of intent)',
    priority: 1,
  },
  reach_10_users: {
    component: 'traction',
    title: 'Get 10+ active users or sign-ups',
    description:
      'User count is a proxy for product-market fit signal. Even 10 active users changes how investors read your traction story.',
    impact_points: 10,
    proof_type: 'count',
    proof_label: 'Current active user / sign-up count',
    priority: 2,
  },
  confirm_mrr: {
    component: 'traction',
    title: 'Confirm your monthly recurring revenue',
    description:
      'MRR is the cleanest traction signal in investor due diligence. Even $500/month matters — it proves the transaction is real.',
    impact_points: 12,
    proof_type: 'text',
    proof_label: 'Current MRR (monthly recurring revenue)',
    priority: 3,
  },
  confirm_growth_rate: {
    component: 'traction',
    title: 'Record your month-over-month growth rate',
    description:
      'Growth rate is more important than absolute numbers for early-stage investors. A 20% MoM growth trajectory at $1K MRR beats $10K flat.',
    impact_points: 8,
    proof_type: 'text',
    proof_label: 'Your MoM growth rate (e.g. 15%)',
    priority: 4,
  },
  launch_product: {
    component: 'traction',
    title: 'Launch your product publicly',
    description:
      "A publicly available product signals that you've shipped and are learning from real users. Even a beta launch counts.",
    impact_points: 9,
    proof_type: 'url',
    proof_label: 'Link to your live product or beta sign-up',
    priority: 5,
  },
  define_market_size: {
    component: 'market',
    title: 'State your TAM with a credible source',
    description:
      'Market size framing without a source is ignored. A bottom-up or third-party TAM statement with a citation unlocks market score credit.',
    impact_points: 8,
    proof_type: 'text',
    proof_label: 'Your TAM statement + source (e.g. "Gartner: $12B logistics software market by 2026")',
    priority: 1,
  },
  write_why_now: {
    component: 'market',
    title: 'Write your "Why Now" in 2 sentences',
    description:
      "The timing thesis is the most underwritten part of most pitch decks. Investors back trends, not just products. Why is this problem solvable now that it wasn't 3 years ago?",
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'Your "Why Now" statement (2 sentences max)',
    priority: 2,
  },
  define_contrarian_view: {
    component: 'market',
    title: 'State your contrarian market insight',
    description:
      'A non-obvious belief about your market — something most people are wrong about — signals deep founder-market fit and differentiated thinking.',
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'What do you believe that most people in your industry don\'t?',
    priority: 3,
  },
  clarify_problem_solution: {
    component: 'market',
    title: 'Sharpen your problem and solution statements',
    description:
      'Problem and solution clarity (100+ characters each) is a direct scoring input. Precise language scores higher than vague positioning.',
    impact_points: 5,
    proof_type: 'text',
    proof_label: 'Problem: [1-2 sentences]. Solution: [1-2 sentences].',
    priority: 4,
  },
  record_demo: {
    component: 'product',
    title: 'Record a product demo',
    description:
      'A live or recorded demo eliminates the "is this real?" question instantly. Even a 2-minute Loom of your product working changes the conversation.',
    impact_points: 8,
    proof_type: 'url',
    proof_label: 'Link to your product demo (Loom, YouTube, or live URL)',
    priority: 1,
  },
  document_defensibility: {
    component: 'product',
    title: 'Document your defensibility / moat',
    description:
      'What makes your product hard to replicate? Proprietary data, network effects, switching costs, or patents. Name the mechanism specifically.',
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'Your core defensibility mechanism in 1-2 sentences',
    priority: 2,
  },
  describe_solution_depth: {
    component: 'product',
    title: 'Write a detailed solution description',
    description:
      'A solution description with technical depth (50+ characters) signals you have built something real. Describe how it works, not just what it does.',
    impact_points: 6,
    proof_type: 'text',
    proof_label: 'How does your product work? (technical detail encouraged)',
    priority: 3,
  },
  write_founder_pitch: {
    component: 'vision',
    title: 'Write a 200-word founder pitch',
    description:
      "A clear, personal narrative — your origin story, the problem you're obsessed with, and where this goes in 10 years — is the vision signal investors weight most.",
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'Your founder pitch (200+ words)',
    priority: 1,
  },
  articulate_vision_statement: {
    component: 'vision',
    title: 'Write your 10-year vision statement',
    description:
      'Where does your company stand in 10 years if everything goes right? The biggest vision statements — "organize the world\'s information" — score highest.',
    impact_points: 6,
    proof_type: 'text',
    proof_label: 'Your 10-year vision (1-3 sentences)',
    priority: 2,
  },
  describe_fundraising_plan: {
    component: 'vision',
    title: 'Define your fundraising plan',
    description:
      "Raise amount, use of funds, and runway duration. Investors need to know you've thought through capital deployment before they can evaluate fit.",
    impact_points: 5,
    proof_type: 'text',
    proof_label: 'How much are you raising, what for, and how many months of runway?',
    priority: 3,
  },
};

const TASK_THRESHOLD = 65;
const MAX_TASKS_PER_COMPONENT = 3;

function deriveGapTasks(startup) {
  const components = [
    { key: 'team', score: startup.team_score ?? 0 },
    { key: 'traction', score: startup.traction_score ?? 0 },
    { key: 'market', score: startup.market_score ?? 0 },
    { key: 'product', score: startup.product_score ?? 0 },
    { key: 'vision', score: startup.vision_score ?? 0 },
  ];

  const gapComponents = components
    .filter((c) => c.score < TASK_THRESHOLD)
    .sort((a, b) => a.score - b.score);

  const tasks = [];
  for (const comp of gapComponents) {
    const compTasks = Object.entries(TASK_CATALOG)
      .filter(([, t]) => t.component === comp.key)
      .sort(([, a], [, b]) => a.priority - b.priority)
      .slice(0, MAX_TASKS_PER_COMPONENT)
      .map(([task_key, t]) => ({
        task_key,
        component: comp.key,
        component_score: comp.score,
        title: t.title,
        description: t.description,
        impact_points: t.impact_points,
        proof_type: t.proof_type,
        proof_label: t.proof_label,
        priority: t.priority,
      }));
    tasks.push(...compTasks);
  }

  return tasks;
}

module.exports = {
  TASK_CATALOG,
  TASK_THRESHOLD,
  MAX_TASKS_PER_COMPONENT,
  deriveGapTasks,
};
