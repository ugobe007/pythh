'use strict';

/**
 * Act 2 — Unlock catalog
 * Psychology-safe framing: advantage discovery, not remediation.
 * Each task maps to partner objection + what changes after proof.
 */

const UNLOCK_META = {
  add_technical_cofounder: {
    unlock_title: 'Unlock: technical co-founder signal',
    unlock_description:
      'Partners at thesis-aligned firms already like your market read. Surfacing a technical co-founder removes the #1 silent objection in Monday meetings — without changing your product.',
    partner_objection: '"Strong market, but can this team actually build it?"',
    objection_removed: 'Partner can advocate: credible build team in place',
  },
  grow_team_to_3: {
    unlock_title: 'Unlock: execution capacity',
    unlock_description:
      'A team of three signals you can ship in parallel. Associates stop tagging you as single-point-of-failure risk.',
    partner_objection: '"Feels like a one-person science project."',
    objection_removed: 'Execution bandwidth reads real on your profile',
  },
  add_advisors: {
    unlock_title: 'Unlock: credibility by association',
    unlock_description:
      'Two domain advisors tell partners someone respected already vetted you — social proof investors use when they can\'t meet you yet.',
    partner_objection: '"Who else believes in this?"',
    objection_removed: 'Named operators vouch for the bet',
  },
  document_founder_backgrounds: {
    unlock_title: 'Unlock: founder pedigree signal',
    unlock_description:
      'Your backgrounds are an edge once they\'re visible. Public founder pedigree changes how quickly partners take the first meeting.',
    partner_objection: '"Can\'t verify team credibility from the site."',
    objection_removed: 'Founder track record is scannable in 30 seconds',
  },
  secure_first_customer: {
    unlock_title: 'Unlock: zero-to-one proof',
    unlock_description:
      'One paying customer ends the pre-revenue debate. It\'s the fastest way to turn associate passes into partner advocates — any dollar amount counts.',
    partner_objection: '"Love the vision, but is anyone paying?"',
    objection_removed: 'Revenue proof — falsifiable traction on the record',
  },
  reach_10_users: {
    unlock_title: 'Unlock: product-market signal',
    unlock_description:
      'Ten active users is enough for partners to stop treating traction as theoretical. It signals learning velocity, not just a landing page.',
    partner_objection: '"Is anyone actually using this?"',
    objection_removed: 'Real usage signal beyond waitlist theater',
  },
  confirm_mrr: {
    unlock_title: 'Unlock: recurring revenue signal',
    unlock_description:
      'MRR is the cleanest due-diligence shortcut. Even $500/month tells partners the transaction loop is real — not pipeline fiction.',
    partner_objection: '"Pipeline is big, but show me the number."',
    objection_removed: 'Monthly recurring revenue on record',
  },
  confirm_growth_rate: {
    unlock_title: 'Unlock: momentum signal',
    unlock_description:
      'Growth rate beats absolute MRR at seed. A clear MoM trajectory gives partners a story they can repeat internally.',
    partner_objection: '"Revenue is flat — why now?"',
    objection_removed: 'Momentum narrative partners can defend',
  },
  launch_product: {
    unlock_title: 'Unlock: shipped product signal',
    unlock_description:
      'A public launch moves you from "building" to "learning." Partners stop asking if the product exists.',
    partner_objection: '"Still in stealth / beta forever?"',
    objection_removed: 'Live product — judgment phase has started',
  },
  define_market_size: {
    unlock_title: 'Unlock: market credibility',
    unlock_description:
      'A sourced TAM isn\'t homework — it\'s ammunition. Partners need a number they can cite when they fight for you in the room.',
    partner_objection: '"Market sounds big but where\'s the source?"',
    objection_removed: 'Defensible market framing with citation',
  },
  write_why_now: {
    unlock_title: 'Unlock: timing thesis',
    unlock_description:
      'Why-now is what separates hot companies from good ones. Two crisp sentences give partners the inflection narrative they crave.',
    partner_objection: '"Why couldn\'t this have been built 3 years ago?"',
    objection_removed: 'Timing story partners can repeat verbatim',
  },
  define_contrarian_view: {
    unlock_title: 'Unlock: non-obvious insight',
    unlock_description:
      'A contrarian market belief signals you read signals before others. That\'s founder-market fit partners bet on, not just checkboxes.',
    partner_objection: '"Sounds like everyone else in the space."',
    objection_removed: 'Differentiated insight — you see what incumbents miss',
  },
  clarify_problem_solution: {
    unlock_title: 'Unlock: narrative clarity',
    unlock_description:
      'Sharp problem/solution language scores higher and reads faster. Associates forward deals they can explain in one breath.',
    partner_objection: '"I still don\'t know what they do."',
    objection_removed: 'One-breath problem/solution clarity',
  },
  record_demo: {
    unlock_title: 'Unlock: "is this real?" proof',
    unlock_description:
      'A 2-minute demo ends the biggest silent killer in first meetings. Partners stop wondering and start evaluating.',
    partner_objection: '"Deck looks good — but does it work?"',
    objection_removed: 'Visual proof product works today',
  },
  document_defensibility: {
    unlock_title: 'Unlock: moat signal',
    unlock_description:
      'Naming your defensibility mechanism tells partners you think like an owner, not a feature factory.',
    partner_objection: '"What stops Google from doing this?"',
    objection_removed: 'Articulated moat — data, network, or switching costs',
  },
  describe_solution_depth: {
    unlock_title: 'Unlock: technical depth signal',
    unlock_description:
      'How-it-works detail signals you built something real. Technical partners weight this heavily in partner meetings.',
    partner_objection: '"Sounds like a wrapper — what\'s under the hood?"',
    objection_removed: 'Technical depth visible in public narrative',
  },
  write_founder_pitch: {
    unlock_title: 'Unlock: partner-repeatable story',
    unlock_description:
      'A personal 200-word pitch is what partners pitch to each other after you leave the room. Write it once, leverage it everywhere.',
    partner_objection: '"Founder story doesn\'t stick."',
    objection_removed: 'Memorable founder narrative for internal advocacy',
  },
  articulate_vision_statement: {
    unlock_title: 'Unlock: 10-year ambition signal',
    unlock_description:
      'Big vision isn\'t fluff — it\'s how partners justify ownership size. A crisp 10-year arc signals missionary, not mercenary.',
    partner_objection: '"Feels like a feature, not a company."',
    objection_removed: 'Category-defining ambition on record',
  },
  describe_fundraising_plan: {
    unlock_title: 'Unlock: capital discipline signal',
    unlock_description:
      'Raise amount + use of funds tells partners you\'ve thought like a CFO, not just a builder. Stage-appropriate asks get faster yeses.',
    partner_objection: '"Raise doesn\'t match stage / no plan for the money."',
    objection_removed: 'Credible raise + runway plan partners can underwrite',
  },
};

/**
 * Estimate how many investors move from filtered/associate-pass → matchable.
 */
function estimateInvestorsUnlocked(startup, task, matchCount = 0) {
  const god = startup.total_god_score || 0;
  const impact = task.impact_points || 5;
  const priority = task.priority || 2;

  let base = Math.max(6, Math.round(impact * 1.15));
  if (god < 45) base = Math.round(base * 1.35);
  else if (god < 58) base = Math.round(base * 1.15);
  else if (god >= 70) base = Math.round(base * 0.85);

  const matchBonus = matchCount > 0 ? Math.min(12, Math.round(matchCount * 0.25)) : 6;
  const priorityDiv = priority <= 1 ? 1 : priority === 2 ? 1.15 : 1.3;

  return Math.min(48, Math.max(5, Math.round((base + matchBonus) / priorityDiv)));
}

/**
 * Apply unlock framing to a derived gap task.
 */
function enrichGapTask(task, startup, matchCount) {
  const meta = UNLOCK_META[task.task_key] || {};
  const investors_unlocked_estimate = estimateInvestorsUnlocked(startup, task, matchCount);

  return {
    ...task,
    title: meta.unlock_title || task.title,
    description: meta.unlock_description || task.description,
    partner_objection: meta.partner_objection || 'Associate-level concern on this dimension',
    objection_removed: meta.objection_removed || 'Partner can advocate with proof on record',
    investors_unlocked_estimate,
    projected_god_score: Math.min(100, (startup.total_god_score || 0) + task.impact_points),
    projected_component_score: Math.min(100, task.component_score + task.impact_points),
  };
}

function enrichGapTasks(tasks, startup, matchCount = 0) {
  return tasks.map((t) => enrichGapTask(t, startup, matchCount));
}

function buildUnlockSummary(tasks, startup) {
  const total_potential_gain = tasks.reduce((s, t) => s + (t.impact_points || 0), 0);
  const total_investors_unlocked = tasks.reduce((s, t) => s + (t.investors_unlocked_estimate || 0), 0);
  const god = startup.total_god_score || 0;

  return {
    total_tasks: tasks.length,
    total_potential_gain,
    total_investors_unlocked: Math.min(120, total_investors_unlocked),
    current_god_score: god,
    projected_god_score: Math.min(100, god + total_potential_gain),
    headline:
      tasks.length > 0
        ? `${tasks.length} unlock${tasks.length > 1 ? 's' : ''} surfaced — choose what to commit to`
        : 'No major unlocks needed — you\'re in strong shape',
    subline:
      'Each commitment is recorded in your readiness doc. Proof upgrades it to an investment memo.',
  };
}

module.exports = {
  UNLOCK_META,
  estimateInvestorsUnlocked,
  enrichGapTask,
  enrichGapTasks,
  buildUnlockSummary,
};
