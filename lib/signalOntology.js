'use strict';

/**
 * Pythh Signal Ontology — Version 1
 *
 * The canonical lexicon for startup / investor / founder signal extraction.
 * Maps words and phrases to functional signal roles, signal classes, and scores.
 *
 * Architecture note:
 *   This file is pure data — no logic, no side effects.
 *   signalParser.js consumes it to extract structured signals from raw text.
 *
 * Three layers:
 *   Layer 1 — Lexical:   words and phrases mapped to functional roles
 *   Layer 2 — Grammar:   actor / action / object / modality / time / posture / intent
 *   Layer 3 — Inference: signal classes + strategic meaning + confidence score
 */

// ─── ACTOR PATTERNS ──────────────────────────────────────────────────────────
// Who owns the signal?
const ACTOR_PATTERNS = [
  [/\b(we|our team|the founders?|the (ceo|cto|coo|cpo|cmo|board)|i('m| am))\b/i, 'actor_founder'],
  [/\b(the (company|startup|firm|business|organization|venture))\b/i,             'actor_startup'],
  [/\b(the (fund|vc|firm|investor|lp|general partner|managing (director|partner)))\b/i, 'actor_investor'],
  [/\b(the (customer|client|buyer|user|enterprise))\b/i,                          'actor_buyer'],
  [/\b(the (market|industry|sector|space|ecosystem|landscape))\b/i,               'actor_market'],
  [/\b(a (competitor|rival)|competitors?|rivals?)\b/i,                            'actor_competitor'],
  [/\b(the (partner|channel|reseller|distributor))\b/i,                           'actor_partner'],
];

// ─── ACTION → SIGNAL CLASS MAPPING ───────────────────────────────────────────
// [ regex_string, { signal_class, base_certainty, action_tag, meaning } ]
// Ordered: most specific / highest-signal first.
const ACTION_MAP = [

  // ── Investor diligence (strongest investor signals) ────────────────────────
  ['requested? (the )?data.?room',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_investor_diligence', meaning: 'investor advanced to data room — serious interest' }],
  ['(asked?|request(ing|ed)?) (for |to see )?(the )?deck',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.75, action_tag: 'action_investor_diligence', meaning: 'investor requested pitch deck' }],
  ['advanc(ing|ed) internally',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.80, action_tag: 'action_investor_diligence', meaning: 'deal advanced past screening' }],
  ['discuss(ing|ed)? with (the )?partners?',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.80, action_tag: 'action_investor_diligence', meaning: 'partner-level review' }],

  // ── Fundraising ────────────────────────────────────────────────────────────
  ['clos(ed|ing) (the |a |our )?(seed|series [a-e]|bridge|pre-seed|round|financing|fundraise)',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',     meaning: 'financing secured or closing' }],
  ['clos(ed|ing) (the )?round',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',     meaning: 'round closing' }],
  ['oversubscribed',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',     meaning: 'very high investor demand' }],
  ['rais(ed|ing|e) (a |the )?(round|capital|funding|money|investment|series [a-e]|seed)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_raising',           meaning: 'fundraising' }],
  ['(in|entering?|open(ing)?|starting?) (the )?market( for (capital|investment))?',
    { signal_class: 'fundraising_signal',        base_certainty: 0.75, action_tag: 'action_raising',           meaning: 'starting fundraise' }],
  ['open(ing)? (a |the |our )?round',
    { signal_class: 'fundraising_signal',        base_certainty: 0.80, action_tag: 'action_raising',           meaning: 'beginning fundraise' }],
  ['speak(ing)? with investors',
    { signal_class: 'fundraising_signal',        base_certainty: 0.65, action_tag: 'action_raising',           meaning: 'early fundraising conversations' }],
  ['strategic financ(ing|e)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.70, action_tag: 'action_raising',           meaning: 'non-standard financing' }],

  // ── Investor interest / posture ────────────────────────────────────────────
  ['lean(ing|ed)? in',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.65, action_tag: 'action_investor_interest', meaning: 'investor internally positive' }],
  ['tak(ing|e|en) a (closer |deeper )?look',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.60, action_tag: 'action_investor_interest', meaning: 'investor evaluating' }],
  ['pass(ed|ing)?( on (the |this |a )?deal)?',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.95, action_tag: 'action_investor_rejection', meaning: 'investor passed' }],

  // ── M&A / exit ────────────────────────────────────────────────────────────
  ['acquir(ing|ed)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.95, action_tag: 'action_acquiring',         meaning: 'acquisition event' }],
  ['merg(ing|ed)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.95, action_tag: 'action_acquiring',         meaning: 'merger event' }],
  ['strategic alternatives',
    { signal_class: 'exit_signal',               base_certainty: 0.85, action_tag: 'action_exit_prep',         meaning: 'exploring sale or exit' }],
  ['(prepar(ing|ed)?|position(ing|ed)?) (for |to )?(ipo|listing|go(ing)? public|public offering)',
    { signal_class: 'exit_signal',               base_certainty: 0.85, action_tag: 'action_exit_prep',         meaning: 'IPO preparation' }],

  // ── Distress / survival ───────────────────────────────────────────────────
  ['lay(ing)? off|laid off',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_layoffs',           meaning: 'confirmed layoffs' }],
  ['restructur(ing|ed)',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_restructuring',     meaning: 'cost or operational restructure' }],
  ['extend(ing|ed) (the |our )?runway',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_survival',          meaning: 'runway pressure' }],
  ['reduc(ing|ed) (the |our )?(burn|cash burn|spend)',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_survival',          meaning: 'burn reduction' }],
  ['rightsiz(ing|ed)',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_restructuring',     meaning: 'headcount reduction (euphemism)' }],
  ['conserv(ing|e) (cash|capital|runway)',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',          meaning: 'cash conservation' }],
  ['(exploring?|considering?) (strategic )?alternatives',
    { signal_class: 'distress_signal',           base_certainty: 0.80, action_tag: 'action_survival',          meaning: 'potential distress sale' }],

  // ── Efficiency (not distress — discipline) ────────────────────────────────
  ['focus(ing|ed)? on (profitab|unit economics|margins?|efficiency)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.80, action_tag: 'action_efficiency',        meaning: 'margin / efficiency focus' }],
  ['capital.?efficient',
    { signal_class: 'efficiency_signal',         base_certainty: 0.70, action_tag: 'action_efficiency',        meaning: 'capital efficiency posture' }],
  ['streamlin(ing|ed)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.70, action_tag: 'action_restructuring',     meaning: 'operational streamlining' }],

  // ── Product launch ────────────────────────────────────────────────────────
  ['(generally? )?availab(ility|le)( (now|today))?',
    { signal_class: 'product_signal',            base_certainty: 0.90, action_tag: 'action_launching',         meaning: 'product generally available' }],
  ['launch(ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',         meaning: 'product launch' }],
  ['ship(ped|ping)',
    { signal_class: 'product_signal',            base_certainty: 0.90, action_tag: 'action_launching',         meaning: 'product shipped' }],
  ['releas(ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',         meaning: 'product release' }],
  ['introduc(ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',         meaning: 'new product introduced' }],
  ['announc(ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.75, action_tag: 'action_launching',         meaning: 'product announcement' }],
  ['debut(ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',         meaning: 'product debut' }],
  ['pilot(ing|ed)',
    { signal_class: 'product_signal',            base_certainty: 0.65, action_tag: 'action_piloting',          meaning: 'market validation pilot' }],
  ['in (public |private |open )?beta',
    { signal_class: 'product_signal',            base_certainty: 0.65, action_tag: 'action_piloting',          meaning: 'beta stage' }],

  // ── Hiring / team ─────────────────────────────────────────────────────────
  ['appoint(ed|ing)',
    { signal_class: 'hiring_signal',             base_certainty: 0.90, action_tag: 'action_leadership_hire',  meaning: 'leadership appointment' }],
  ['named? .{0,25}(ceo|cto|coo|cpo|cmo|vp |president|head of)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_leadership_hire',  meaning: 'executive hire confirmed' }],
  ['hir(ing|ed|e)',
    { signal_class: 'hiring_signal',             base_certainty: 0.80, action_tag: 'action_hiring',           meaning: 'team growth' }],
  ['recruit(ing|ed)',
    { signal_class: 'hiring_signal',             base_certainty: 0.80, action_tag: 'action_hiring',           meaning: 'active recruiting' }],
  ['bring(ing)? (on|aboard)',
    { signal_class: 'hiring_signal',             base_certainty: 0.75, action_tag: 'action_hiring',           meaning: 'onboarding new hires' }],
  ['build(ing|t)? (out |up )?(the |our |an? )(team|org|workforce)',
    { signal_class: 'hiring_signal',             base_certainty: 0.75, action_tag: 'action_hiring',           meaning: 'team buildout' }],

  // ── Expansion / growth ────────────────────────────────────────────────────
  ['expand(ed|ing|s)? (in)?to',
    { signal_class: 'expansion_signal',          base_certainty: 0.75, action_tag: 'action_expanding',        meaning: 'geographic or segment expansion' }],
  ['enter(ed|ing|s)? (the |a )?(new )?market',
    { signal_class: 'expansion_signal',          base_certainty: 0.80, action_tag: 'action_expanding',        meaning: 'market entry' }],
  ['mov(ing|e) (up.?market|to enterprise|upmarket)',
    { signal_class: 'enterprise_signal',         base_certainty: 0.80, action_tag: 'action_gtm',              meaning: 'upmarket motion' }],
  ['scal(ing|ed|e)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_scaling',          meaning: 'scaling' }],
  ['accelerat(ing|ed)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'accelerating growth' }],
  ['doub(ling|led) down',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_scaling',          meaning: 'strong conviction reinvestment' }],
  ['grow(ing|n)',
    { signal_class: 'growth_signal',             base_certainty: 0.70, action_tag: 'action_growing',          meaning: 'growth' }],

  // ── GTM / sales build ─────────────────────────────────────────────────────
  ['build(ing|t)? (out |up )?(the |our |an? )?(sales|go.?to.?market|gtm|revenue|commercial|enterprise)',
    { signal_class: 'gtm_signal',               base_certainty: 0.75, action_tag: 'action_gtm',              meaning: 'sales / GTM buildout' }],

  // ── Demand / traction ─────────────────────────────────────────────────────
  ['strong (inbound|demand|pipeline|traction|pull)',
    { signal_class: 'demand_signal',             base_certainty: 0.80, action_tag: 'action_demand',           meaning: 'strong demand signal' }],
  ['growing (demand|pipeline|interest|inbound)',
    { signal_class: 'demand_signal',             base_certainty: 0.70, action_tag: 'action_demand',           meaning: 'growing demand' }],
  ['(oversubscribed|waitlist|waiting list)',
    { signal_class: 'demand_signal',             base_certainty: 0.90, action_tag: 'action_demand',           meaning: 'demand exceeds supply' }],

  // ── Partnership / distribution ────────────────────────────────────────────
  ['sign(ed|ing)? (a |an? )?(strategic )?(agreement|contract|deal|mou|partnership)',
    { signal_class: 'partnership_signal',        base_certainty: 0.90, action_tag: 'action_partnering',       meaning: 'deal or agreement signed' }],
  ['partner(ing|ed|ship)',
    { signal_class: 'partnership_signal',        base_certainty: 0.75, action_tag: 'action_partnering',       meaning: 'partnership' }],
  ['integrat(ing|ed) with',
    { signal_class: 'partnership_signal',        base_certainty: 0.80, action_tag: 'action_partnering',       meaning: 'technical integration' }],
  ['collaborat(ing|ed)',
    { signal_class: 'partnership_signal',        base_certainty: 0.70, action_tag: 'action_partnering',       meaning: 'collaboration' }],

  // ── Fundraising (conversational forms) ───────────────────────────────────
  ['(having|opening|starting|in) (discussions?|conversations?) with investors',
    { signal_class: 'fundraising_signal',        base_certainty: 0.60, action_tag: 'action_raising', meaning: 'early fundraising conversations' }],
  ['(talking|speaking|meeting) with (potential )?investors',
    { signal_class: 'fundraising_signal',        base_certainty: 0.65, action_tag: 'action_raising', meaning: 'investor conversations' }],

  // ── Efficiency / posture (standalone — no distress implied) ──────────────
  ['focus(ing|ed)? on (capital.?efficiency|growth efficiency|efficient growth)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.75, action_tag: 'action_efficiency', meaning: 'capital efficiency focus (disciplined, not distress)' }],
  ['being disciplined (about|with)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.70, action_tag: 'action_efficiency', meaning: 'disciplined growth posture' }],
  ['disciplined (about|with|approach)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.70, action_tag: 'action_efficiency', meaning: 'disciplined approach' }],

  // ── Exploratory / low-certainty ───────────────────────────────────────────
  ['explor(ing|e)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.40, action_tag: 'action_exploring',        meaning: 'early exploration — low certainty' }],
  ['evaluat(ing|e)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.40, action_tag: 'action_evaluating',       meaning: 'evaluation phase' }],
  ['consider(ing|ed)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.35, action_tag: 'action_evaluating',       meaning: 'under consideration' }],
  ['look(ing|ed)? (to|into|at|for)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.45, action_tag: 'action_exploring',        meaning: 'seeking / exploring' }],
  ['investigat(ing|ed)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.40, action_tag: 'action_evaluating',       meaning: 'investigating' }],
];

// ─── MODALITY MAP ─────────────────────────────────────────────────────────────
// Certainty scale: 0.0 (pure speculation) → 1.0 (confirmed event)
// Ordered most → least certain so first match wins.
const MODALITY_MAP = [
  // Actual confirmed events — 1.0
  [/\b(closed|launched|hired|signed|acquired|merged|shipped|secured|raised|announced|completed|finalized|won|appointed|released)\b/i,
    { class: 'modality_actual',      certainty: 1.00 }],
  // Active present ongoing — 0.85
  [/\b(is|are) (currently |now |actively )?(hiring|raising|launching|expanding|scaling|building|partnering|growing|restructuring|exploring)\b/i,
    { class: 'modality_active',      certainty: 0.85 }],
  [/\b(actively|currently|now) (hiring|raising|launching|building|expanding)\b/i,
    { class: 'modality_active',      certainty: 0.85 }],
  // Committed / imminent — 0.80
  [/\b(will|going to|about to|set to|on track to|on the verge of)\b/i,
    { class: 'modality_committed',   certainty: 0.80 }],
  // Planned — 0.65
  [/\b(plan(s|ning|ned)? to|intend(s|ing|ed)? to|aim(s|ing|ed)? to|scheduled? to|expect(s|ing|ed)? to)\b/i,
    { class: 'modality_planned',     certainty: 0.65 }],
  // Probable — 0.60
  [/\b(likely (to|will)|anticipate(s)? (to|that)|expect(s)? (to|that))\b/i,
    { class: 'modality_probable',    certainty: 0.60 }],
  // Exploratory — 0.40
  [/\b(exploring?|evaluating?|considering?|looking (to|into|at|for)|thinking (about|of)|interested in)\b/i,
    { class: 'modality_exploratory', certainty: 0.40 }],
  // Speculative — 0.25
  [/\b(may|might|could|possibly|potentially|if all goes well|hope(s|ful)? to)\b/i,
    { class: 'modality_speculative', certainty: 0.25 }],
  // Conditional — 0.20
  [/\b(if|assuming|provided (that)?|subject to|pending|contingent on|depending on)\b/i,
    { class: 'modality_conditional', certainty: 0.20 }],
];

// ─── INTENSITY / AMPLIFIER MAP ────────────────────────────────────────────────
// weight: positive = stronger signal, negative = dampened signal
const INTENSITY_MAP = {
  // Strong positive amplifiers
  aggressively:    { weight: +0.30, tag: 'intensity_aggressive' },
  dramatically:    { weight: +0.25, tag: 'intensity_dramatic'   },
  rapidly:         { weight: +0.25, tag: 'intensity_rapid'      },
  massively:       { weight: +0.25, tag: 'intensity_massive'    },
  significantly:   { weight: +0.20, tag: 'intensity_significant'},
  heavily:         { weight: +0.20, tag: 'intensity_heavy'      },
  substantially:   { weight: +0.20, tag: 'intensity_substantial'},
  strongly:        { weight: +0.20, tag: 'intensity_strong'     },
  boldly:          { weight: +0.20, tag: 'intensity_bold'       },
  deeply:          { weight: +0.15, tag: 'intensity_deep'       },
  actively:        { weight: +0.15, tag: 'intensity_active'     },
  increasingly:    { weight: +0.15, tag: 'intensity_growing'    },
  urgently:        { weight: +0.20, tag: 'intensity_urgent'     },
  // Dampeners (cautious / measured language)
  selectively:     { weight: -0.10, tag: 'intensity_selective'  },
  carefully:       { weight: -0.15, tag: 'intensity_careful'    },
  cautiously:      { weight: -0.20, tag: 'intensity_cautious'   },
  quietly:         { weight: -0.20, tag: 'intensity_quiet'      },
  slowly:          { weight: -0.20, tag: 'intensity_slow'       },
  narrowly:        { weight: -0.25, tag: 'intensity_narrow'     },
  prudently:       { weight: -0.15, tag: 'intensity_prudent'    },
  deliberately:    { weight: -0.15, tag: 'intensity_deliberate' },
  methodically:    { weight: -0.10, tag: 'intensity_methodical' },
  conservatively:  { weight: -0.20, tag: 'intensity_conservative'},
  modestly:        { weight: -0.15, tag: 'intensity_modest'     },
};

// ─── POSTURE MAP ──────────────────────────────────────────────────────────────
// Strategic posture — HOW they are framing the move (not WHAT they are doing)
const POSTURE_MAP = [
  // Confidence / hypergrowth
  [/\b(aggressiv(e|ely)|bold(ly)?|ambitious(ly)?|excited? (about|to)|doubling down|thrilled|very bullish)\b/i,
    { posture: 'posture_confident',    meaning: 'high conviction, positive momentum' }],
  // Disciplined / controlled growth
  [/\b(disciplined|selective(ly)?|capital.?efficient|measured|deliberate(ly)?|rigorous(ly)?|focused|prudent(ly)?)\b/i,
    { posture: 'posture_disciplined',  meaning: 'controlled growth, efficiency-minded' }],
  // Urgent
  [/\b(urgent(ly)?|immediately?|as soon as|critical|must|need to now|right away)\b/i,
    { posture: 'posture_urgent',       meaning: 'time-sensitive, high urgency' }],
  // Distressed
  [/\b(forced to|unfortunately|difficult (period|time|environment)|challenging (times?|conditions?)|under pressure)\b/i,
    { posture: 'posture_distressed',   meaning: 'under pressure / distress language' }],
  // Defensive
  [/\b(despite|even (though|as)|hold(ing)? (steady|firm)|not (affected|impacted)|weathering)\b/i,
    { posture: 'posture_defensive',    meaning: 'defending position, resilience framing' }],
  // Ambiguous / hedging
  [/\b(it depends|time will tell|remains? to be seen|uncertain|unclear|not yet decided|to be determined)\b/i,
    { posture: 'posture_ambiguous',    meaning: 'hedging / uncertainty' }],
  // Reflective (often end-of-cycle language — milestone or wind-down)
  [/\b(proud of what (we |they )?(built|created|accomplished)|look(ing)? back|grateful|incredible journey)\b/i,
    { posture: 'posture_reflective',   meaning: 'milestone or possible plateau / wind-down language' }],
];

// ─── MODALITY CERTAINTY SCORES ────────────────────────────────────────────────
// Standalone lookup for scoring only
const CERTAINTY_WEIGHTS = {
  modality_actual:      1.00,
  modality_active:      0.85,
  modality_committed:   0.80,
  modality_planned:     0.65,
  modality_probable:    0.60,
  modality_exploratory: 0.40,
  modality_speculative: 0.25,
  modality_conditional: 0.20,
  modality_unknown:     0.50,
};

// ─── TIME MAP ─────────────────────────────────────────────────────────────────
// Temporal framing — WHEN the signal is happening
const TIME_MAP = [
  [/\b(right now|currently|today|this (morning|week|sprint)|immediately?)\b/i,
    { tag: 'time_now',           proximity: 1.0 }],
  [/\b(last (month|quarter|year)|recently|in (the past|recent) (few )?(months?|weeks?|days?))\b/i,
    { tag: 'time_recent',        proximity: 0.9 }],
  [/\b(this (month|quarter)|in (q[1-4]|the next (few )?weeks?|the next (few )?months?))\b/i,
    { tag: 'time_this_quarter',  proximity: 0.8 }],
  [/\b(this year|in (20\d\d)|by end of year|before year.?end)\b/i,
    { tag: 'time_this_year',     proximity: 0.6 }],
  [/\b(next (month|quarter)|in the (coming|near) (weeks?|months?)|soon)\b/i,
    { tag: 'time_near_term',     proximity: 0.7 }],
  [/\b(next year|in [12] years?|over the next (year|two years)|long.?term|longer.?term)\b/i,
    { tag: 'time_long_horizon',  proximity: 0.3 }],
  [/\b(after (the )?(close|round|launch|hire|partnership|announcement))\b/i,
    { tag: 'time_post_event',    proximity: 0.5 }],
];

// ─── CONTEXT MAP ──────────────────────────────────────────────────────────────
// Where does the signal live? Sector / geography / stage / company type.
// Multiple tags per term are supported.
const CONTEXT_MAP = {
  // Sectors
  fintech:              ['context_sector_fintech'],
  'financial technology':['context_sector_fintech'],
  healthtech:           ['context_sector_healthcare'],
  healthcare:           ['context_sector_healthcare'],
  'health tech':        ['context_sector_healthcare'],
  medtech:              ['context_sector_healthcare'],
  biotech:              ['context_sector_biotech'],
  'life sciences':      ['context_sector_biotech'],
  'biopharma':          ['context_sector_biotech'],
  'artificial intelligence': ['context_sector_ai'],
  'machine learning':   ['context_sector_ai'],
  ai:                   ['context_sector_ai'],
  robotics:             ['context_sector_robotics'],
  autonomous:           ['context_sector_autonomous'],
  'deep tech':          ['context_sector_deeptech'],
  deeptech:             ['context_sector_deeptech'],
  climate:              ['context_sector_climate'],
  cleantech:            ['context_sector_climate'],
  edtech:               ['context_sector_edtech'],
  education:            ['context_sector_edtech'],
  logistics:            ['context_sector_logistics'],
  'supply chain':       ['context_sector_logistics'],
  crypto:               ['context_sector_crypto'],
  blockchain:           ['context_sector_crypto'],
  defi:                 ['context_sector_crypto'],
  cybersecurity:        ['context_sector_security'],
  security:             ['context_sector_security'],
  defense:              ['context_sector_defense'],
  // Product type
  saas:                 ['context_product_saas'],
  'open source':        ['context_product_open_source'],
  infrastructure:       ['context_product_infrastructure'],
  'developer tools':    ['context_company_developer_tools'],
  api:                  ['context_product_api'],
  // Company type
  enterprise:           ['context_company_enterprise'],
  'mid-market':         ['context_company_midmarket'],
  smb:                  ['context_company_smb'],
  b2b:                  ['context_company_b2b'],
  b2c:                  ['context_company_b2c'],
  consumer:             ['context_company_b2c'],
  // Geographies
  europe:               ['context_geo_europe'],
  european:             ['context_geo_europe'],
  emea:                 ['context_geo_emea'],
  'united states':      ['context_geo_us'],
  'north america':      ['context_geo_north_america'],
  apac:                 ['context_geo_apac'],
  asia:                 ['context_geo_apac'],
  'latin america':      ['context_geo_latam'],
  latam:                ['context_geo_latam'],
  africa:               ['context_geo_africa'],
  // Stage
  'pre-seed':           ['context_stage_pre_seed'],
  seed:                 ['context_stage_seed'],
  'series a':           ['context_stage_series_a'],
  'series b':           ['context_stage_series_b'],
  'series c':           ['context_stage_series_c'],
  growth:               ['context_stage_growth'],
};

// ─── INTENT MAP ───────────────────────────────────────────────────────────────
// WHY the action is happening — inferred from "to [verb]" clauses
const INTENT_MAP = [
  [/\bto (expand|enter|penetrate|break into|grow into)\b/i,                'intent_expansion'],
  [/\bto (support|accelerate|enable|fuel|drive) (growth|expansion)\b/i,    'intent_growth'],
  [/\bto (reach|achieve|get to) profitab(ility|le)\b/i,                    'intent_efficiency'],
  [/\bto (reduce|cut|lower|minimize) (costs?|burn|spend|expenses?)\b/i,    'intent_efficiency'],
  [/\bto (extend|preserve|protect|maximize) (the |our )?runway\b/i,        'intent_survival'],
  [/\bto (raise|close|secure|access) (funding|capital|the round)\b/i,      'intent_fundraising'],
  [/\bto (serve|support|win|target|capture) (enterprise|mid.?market)\b/i,  'intent_enterprise_push'],
  [/\bto (build|grow|scale|expand|double) (the |our )?team\b/i,            'intent_team_growth'],
  [/\bto (launch|release|ship|deliver) (the |our )?(product|platform|api|v\d)\b/i, 'intent_product_launch'],
  [/\bto (acquire|grow|expand|build) (our |the )?(customer.?base|clients?|users?)\b/i, 'intent_customer_growth'],
  [/\bto (validate|test|prove|demonstrate) (the |our )?(market|model|hypothesis|fit)\b/i, 'intent_validation'],
  [/\bfor (sale|acquisition|strategic acqui(sition)?|a strategic (buyer|partner))\b/i,    'intent_exit_prep'],
  [/\bto (partner|collaborate|integrate) with\b/i,                         'intent_partnership'],
  [/\bto (streamline|optimize|automate|improve) (operations?|processes?|efficiency)\b/i,  'intent_operational_efficiency'],
];

// ─── OBJECT KEYWORDS ─────────────────────────────────────────────────────────
// What does the action target? (ordered multi-word first)
const OBJECT_KEYWORDS = [
  ['data room',           'object_data_room'],
  ['sales leaders',       'object_team'],
  ['engineering team',    'object_team'],
  ['customer base',       'object_customer_base'],
  ['go-to-market',        'object_gtm'],
  ['sales motion',        'object_gtm'],
  ['distribution channel','object_channel'],
  ['strategic partner',   'object_partnership'],
  ['enterprise market',   'object_market'],
  ['new market',          'object_market'],
  ['new geography',       'object_market'],
  ['seed round',          'object_round'],
  ['series a',            'object_round'],
  ['series b',            'object_round'],
  ['series c',            'object_round'],
  // single-word objects
  ['team',                'object_team'],
  ['engineers',           'object_team'],
  ['developers',          'object_team'],
  ['talent',              'object_team'],
  ['headcount',           'object_team'],
  ['staff',               'object_team'],
  ['operators',           'object_team'],
  ['round',               'object_round'],
  ['capital',             'object_round'],
  ['funding',             'object_round'],
  ['product',             'object_product'],
  ['platform',            'object_product'],
  ['api',                 'object_product'],
  ['feature',             'object_product'],
  ['infrastructure',      'object_infrastructure'],
  ['operations',          'object_operations'],
  ['pricing',             'object_pricing'],
  ['partnership',         'object_partnership'],
  ['market',              'object_market'],
  ['customers',           'object_customer_base'],
  ['users',               'object_customer_base'],
];

// ─── DESCRIPTOR KEYWORDS ─────────────────────────────────────────────────────
// Adjective / noun modifiers that sharpen the signal
const DESCRIPTOR_KEYWORDS = [
  // Role / seniority
  'senior', 'junior', 'experienced', 'seasoned', 'executive', 'c-suite',
  'world-class', 'top-tier', 'best-in-class', 'fractional',
  // Company tier / segment
  'enterprise', 'mid-market', 'upmarket', 'smb', 'consumer',
  'strategic', 'technical', 'commercial', 'operational',
  // Functional area
  'sales', 'product', 'engineering', 'design', 'marketing', 'revenue',
  'go-to-market', 'customer success', 'finance', 'legal',
  // Stage / posture descriptors
  'disciplined', 'capital-efficient', 'focused', 'deliberate',
  'aggressive', 'rapid', 'measured', 'selective',
  // Market descriptors
  'new', 'emerging', 'underserved', 'global', 'domestic', 'international', 'regional',
];

// ─── SIGNAL CLASS PRIORITY ────────────────────────────────────────────────────
// When multiple signals fire, rank by business importance
const SIGNAL_CLASS_PRIORITY = [
  'fundraising_signal',
  'acquisition_signal',
  'exit_signal',
  'distress_signal',
  'investor_interest_signal',
  'investor_rejection_signal',
  'product_signal',
  'hiring_signal',
  'expansion_signal',
  'enterprise_signal',
  'gtm_signal',
  'demand_signal',
  'growth_signal',
  'partnership_signal',
  'efficiency_signal',
  'infrastructure_signal',
  'exploratory_signal',
];

module.exports = {
  ACTOR_PATTERNS,
  ACTION_MAP,
  MODALITY_MAP,
  INTENSITY_MAP,
  POSTURE_MAP,
  TIME_MAP,
  CONTEXT_MAP,
  INTENT_MAP,
  OBJECT_KEYWORDS,
  DESCRIPTOR_KEYWORDS,
  SIGNAL_CLASS_PRIORITY,
  CERTAINTY_WEIGHTS,
};
