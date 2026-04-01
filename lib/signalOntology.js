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

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL PAST — must come first AND declare gates to suppress competing patterns.
  // "had planned to raise" fires exploratory_signal AND gates fundraising_signal.
  // "was hoping to launch" fires exploratory_signal AND gates product_signal.
  //
  // The `gates` array lists which signal_classes should be suppressed from
  // the same sentence when this pattern matches. detectActions() in signalParser.js
  // reads these and removes gated classes before returning results.
  // ══════════════════════════════════════════════════════════════════════════
  ['(had (planned|intended|hoped|expected|aimed) to (raise|launch|expand|hire|acquire|close|build))',
    { signal_class: 'exploratory_signal', base_certainty: 0.30, action_tag: 'action_exploring',
      meaning: 'modal past: intent stated but not confirmed — likely abandoned or deferred',
      gates: ['fundraising_signal', 'hiring_signal', 'acquisition_signal', 'expansion_signal', 'product_signal'] }],
  ['(was (hoping|planning|intending|expecting) to (raise|launch|expand|hire|close))',
    { signal_class: 'exploratory_signal', base_certainty: 0.30, action_tag: 'action_exploring',
      meaning: 'modal past: past-tense intent — not confirmed',
      gates: ['fundraising_signal', 'hiring_signal', 'product_signal', 'expansion_signal'] }],
  ['(never (made it to|got to|reached) (the )?(series [a-e]|launch|market|profitability))',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',         meaning: 'explicitly never reached milestone — failure signal' }],

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
  ['acquir(es|ing|ed)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.95, action_tag: 'action_acquiring',         meaning: 'acquisition event' }],
  ['merg(es|ing|ed)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.95, action_tag: 'action_acquiring',         meaning: 'merger event' }],
  ['strategic alternatives',
    { signal_class: 'exit_signal',               base_certainty: 0.85, action_tag: 'action_exit_prep',         meaning: 'exploring sale or exit' }],
  ['(prepar(ing|ed)?|position(ing|ed)?) (for |to )?(ipo|listing|go(ing)? public|public offering)',
    { signal_class: 'exit_signal',               base_certainty: 0.85, action_tag: 'action_exit_prep',         meaning: 'IPO preparation' }],

  // ── Distress / survival ───────────────────────────────────────────────────
  ['lay(off|ing off|s off|ed off|offs?|s off)',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_layoffs',           meaning: 'confirmed layoffs' }],
  ['laid off',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_layoffs',           meaning: 'confirmed layoffs' }],
  ['restructur(ing|ed)',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_restructuring',     meaning: 'cost or operational restructure' }],
  ['extend(s|ing|ed) (the |our )?runway',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_survival',          meaning: 'runway pressure' }],
  ['reduc(ing|ed) (the |our )?(burn|cash burn|spend)',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_survival',          meaning: 'burn reduction' }],
  ['rightsiz(ing|ed)',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_restructuring',     meaning: 'headcount reduction (euphemism)' }],
  ['conserv(ing|e) (cash|capital|runway)',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',          meaning: 'cash conservation' }],
  ['(exploring?|considering?) (strategic )?alternatives',
    { signal_class: 'distress_signal',           base_certainty: 0.80, action_tag: 'action_survival',          meaning: 'potential distress sale' }],

  // ── Distress euphemisms — corporate doublespeak for layoffs / cuts ────────
  // "Workforce optimization" is not product signal — it is a layoff euphemism.
  ['workforce (optimization|reduction|adjustment|rebalancing|realignment)',
    { signal_class: 'distress_signal',           base_certainty: 0.92, action_tag: 'action_layoffs',           meaning: 'workforce optimization = layoff euphemism' }],
  ['(rationaliz(ing|ed|e) (the )?(business|operations?|structure|costs?|spend))',
    { signal_class: 'distress_signal',           base_certainty: 0.88, action_tag: 'action_restructuring',     meaning: 'rationalizing the business = cost cuts' }],
  ['(simplif(y|ying|ied) (our|the) (organization|structure|ops|team|headcount|layers?))',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_restructuring',     meaning: 'simplifying org structure = cuts' }],
  ['(optimiz(ing|ed) (our|the) (headcount|staffing|workforce|team size|cost structure))',
    { signal_class: 'distress_signal',           base_certainty: 0.88, action_tag: 'action_layoffs',           meaning: 'optimizing headcount = layoffs' }],
  ['(cost (optimization|reduction|rationalization|containment) (program|initiative|effort))',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',          meaning: 'formal cost program = pressure' }],
  ['(talent (rationalization|rebalancing|restructuring|optimization))',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_layoffs',           meaning: 'talent rationalization = layoffs' }],
  ['(operational (efficiency|simplification|transformation) (program|initiative))',
    { signal_class: 'distress_signal',           base_certainty: 0.75, action_tag: 'action_restructuring',     meaning: 'efficiency program = restructure' }],
  ['(wind(ing)? down|wind-down|unwinding) (operations?|the business|activities)',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_layoffs',           meaning: 'winding down operations = shutdown' }],

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
  ['launch(es|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',         meaning: 'product launch' }],
  ['ship(s|ped|ping)',
    { signal_class: 'product_signal',            base_certainty: 0.90, action_tag: 'action_launching',         meaning: 'product shipped' }],
  ['releas(es|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',         meaning: 'product release' }],
  ['introduc(es|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',         meaning: 'new product introduced' }],
  ['announc(es|ed|ing)',
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
  ['hir(es|ing|ed|e)',
    { signal_class: 'hiring_signal',             base_certainty: 0.80, action_tag: 'action_hiring',           meaning: 'team growth' }],
  ['recruit(s|ing|ed)',
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
  ['scal(es|ing|ed|e)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_scaling',          meaning: 'scaling' }],
  ['accelerat(es|ing|ed)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'accelerating growth' }],
  ['doub(ling|les|led) down',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_scaling',          meaning: 'strong conviction reinvestment' }],
  ['grow(s|ing|n)',
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

  // ── Fundraising — amount-first patterns (e.g., "raises $12M Series A") ──────
  // Critical: RSS headlines put the $ amount between the verb and round type.
  ['rais(ed|ing|es|e)\\s+\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_raising',          meaning: 'fundraise with stated amount' }],
  ['secures?\\s+\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',    meaning: 'secured funding with amount' }],
  ['close[sd]?\\s+\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',    meaning: 'closed round with amount' }],
  ['bags?\\s+\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'funding secured (colloquial)' }],
  ['lands?\\s+\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'funding landed' }],
  ['nets?\\s+\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'funding netted' }],
  ['\\$[\\d.,]+[KkMmBb]\\s+(seed|series [a-f]|round|in funding|investment)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'dollar amount with round type' }],
  ['series [a-f] (round|funding|investment|raise|financing)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_raising',          meaning: 'named series round' }],
  ['(pre-?seed|seed) (round|funding|investment|raise|financing)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_raising',          meaning: 'seed or pre-seed round' }],
  ['(vc|venture capital|angel) (backed?|funded|investment|round)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'VC or angel backed' }],
  ['(total|cumulative) (raised|funding) (of |: ?)?\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'total funding milestone' }],
  ['(led by|co-led by|backed by) .{0,30}(capital|ventures?|partners?|fund)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_closing_round',    meaning: 'VC-led round' }],
  ['(funding|investment) (announcement|round|news)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.80, action_tag: 'action_raising',          meaning: 'funding event announced' }],
  ['valuation (of |at )?\\$[\\d.,]+[KkMmBb]',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'valuation stated' }],
  ['unicorn',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',    meaning: 'unicorn valuation milestone' }],
  ['(decacorn|soonicorn|centaur)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_raising',          meaning: 'high-value startup milestone' }],
  ['(y combinator|ycombinator|yc batch|techstars|500 startups)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_closing_round',    meaning: 'top-tier accelerator backing' }],
  ['(a16z|andreessen horowitz|sequoia|accel|lightspeed|khosla|benchmark|greylock|bessemer)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'top-tier VC investor named' }],
  ['(bridge|extension|tranche) (round|financing|funding)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_raising',          meaning: 'bridge or extension financing' }],
  ['(convertible note|safe agreement|revenue.?based financing|debt financing)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_raising',          meaning: 'alternative financing instrument' }],
  ['\\b(initial public offering|ipo|direct listing|spac)\\b',
    { signal_class: 'exit_signal',               base_certainty: 0.90, action_tag: 'action_exit_prep',        meaning: 'public market entry' }],

  // ── Revenue / traction signals ────────────────────────────────────────────
  ['\\$[\\d.,]+[KkMmBb]\\s*(in )?(arr|mrr|revenue|sales|bookings?)',
    { signal_class: 'revenue_signal',            base_certainty: 0.95, action_tag: 'action_revenue',          meaning: 'revenue metric stated' }],
  ['cross(ed|ing) \\$[\\d.,]+[KkMmBb] (arr|mrr|revenue|in revenue)',
    { signal_class: 'revenue_signal',            base_certainty: 1.00, action_tag: 'action_revenue',          meaning: 'revenue milestone crossed' }],
  ['(annualized?|annual|monthly) recurring revenue',
    { signal_class: 'revenue_signal',            base_certainty: 0.80, action_tag: 'action_revenue',          meaning: 'recurring revenue metric' }],
  ['(profitable|profitability|break.?even|cash.?flow positive)',
    { signal_class: 'revenue_signal',            base_certainty: 0.90, action_tag: 'action_profitability',    meaning: 'profitability milestone' }],
  ['(net revenue retention|nrr|gross retention|logo retention)',
    { signal_class: 'revenue_signal',            base_certainty: 0.85, action_tag: 'action_revenue',          meaning: 'retention metric stated' }],
  ['(sign(ed|ing)|won|land(ed|ing)?|onboard(ed|ing)?) .{0,25}(enterprise |fortune |global )(customer|client|account)',
    { signal_class: 'revenue_signal',            base_certainty: 0.90, action_tag: 'action_customer_win',     meaning: 'enterprise customer win' }],
  ['[\\d,]+ (paying )?(customers?|clients?|enterprises?|accounts?)',
    { signal_class: 'revenue_signal',            base_certainty: 0.80, action_tag: 'action_customer_growth',  meaning: 'customer count stated' }],
  ['(triple|double|3x|2x|10x|5x).{0,25}(revenue|arr|mrr|growth)',
    { signal_class: 'revenue_signal',            base_certainty: 0.90, action_tag: 'action_revenue',          meaning: 'strong revenue growth multiplier' }],
  ['(revenue|arr|mrr) (growth|growing|grew).{0,20}\\d+%',
    { signal_class: 'revenue_signal',            base_certainty: 0.85, action_tag: 'action_revenue',          meaning: 'revenue growth percentage stated' }],
  ['\\d+% (growth|increase|yoy|year.?over.?year|qoq|month.?over.?month)',
    { signal_class: 'revenue_signal',            base_certainty: 0.80, action_tag: 'action_revenue',          meaning: 'growth rate stated' }],
  ['(land.?and.?expand|upsell|expansion revenue|net expansion)',
    { signal_class: 'revenue_signal',            base_certainty: 0.80, action_tag: 'action_customer_win',     meaning: 'expansion revenue signal' }],
  ['(waitlist|waiting list).{0,20}(\\d+|thousand|million)',
    { signal_class: 'demand_signal',             base_certainty: 0.90, action_tag: 'action_demand',           meaning: 'large waitlist — demand exceeds supply' }],
  ['(\\d+|million|thousands of) (monthly |daily |weekly )?active (users?|customers?)',
    { signal_class: 'revenue_signal',            base_certainty: 0.85, action_tag: 'action_customer_growth',  meaning: 'active user count stated' }],

  // ── Regulatory / IP signals ───────────────────────────────────────────────
  ['(fda|ce mark|ema|fcc|ftc|sec|cdc|nih) (approv(al|ed)|clear(ance|ed)|authoriz(ation|ed))',
    { signal_class: 'regulatory_signal',         base_certainty: 1.00, action_tag: 'action_regulatory',       meaning: 'regulatory approval received' }],
  ['(granted|received|filed|secured|issued) (a |the )?(patent|ip|license)',
    { signal_class: 'regulatory_signal',         base_certainty: 0.90, action_tag: 'action_ip',               meaning: 'patent or IP milestone' }],
  ['(soc 2|iso 27001|hipaa|gdpr|pci.?dss|fedramp|sox) (compli(ant|ance)|certif(ied|ication)|approved)',
    { signal_class: 'regulatory_signal',         base_certainty: 0.95, action_tag: 'action_regulatory',       meaning: 'compliance certification achieved' }],

  // ── Market position / recognition signals ─────────────────────────────────
  ['(market|category|industry|segment) leader',
    { signal_class: 'market_position_signal',    base_certainty: 0.80, action_tag: 'action_market_position',  meaning: 'market leadership claim' }],
  ['(gartner|forrester|idc|g2 crowd|cb insights|redpoint|pitchbook).{0,30}(magic quadrant|wave|named|ranked|listed)',
    { signal_class: 'market_position_signal',    base_certainty: 0.90, action_tag: 'action_market_position',  meaning: 'analyst recognition' }],
  ['(named|selected|recognized|ranked|listed) (as|among|in|on).{0,30}(top|best|leading|fastest|most|forbes|inc |wired|fast company)',
    { signal_class: 'market_position_signal',    base_certainty: 0.80, action_tag: 'action_market_position',  meaning: 'external recognition or ranking' }],
  ['(forbes|inc magazine|fast company|time magazine|wired|techcrunch|business insider).{0,30}(list|50|100|500|named|ranked|featured)',
    { signal_class: 'market_position_signal',    base_certainty: 0.80, action_tag: 'action_market_position',  meaning: 'media recognition or list' }],
  ['(won|wins?|winning).{0,30}(award|prize|competition|challenge|grant)',
    { signal_class: 'market_position_signal',    base_certainty: 0.80, action_tag: 'action_market_position',  meaning: 'award or competition win' }],
  ['(best.?in.?class|world.?class|industry.?leading|state.?of.?the.?art)',
    { signal_class: 'market_position_signal',    base_certainty: 0.60, action_tag: 'action_market_position',  meaning: 'quality claim' }],

  // ── Leadership / team changes ─────────────────────────────────────────────
  ['(ceo|founder|cto|coo|cpo|cmo).{0,20}(steps? down|step(ped|ping) down|resign(ed|s|ing)?|depart(ed|ure|ing|s)?|leav(ing|es?))',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_leadership_change', meaning: 'C-suite departure' }],
  ['(new|joins?|onboard(ed|ing)?).{0,15}as (ceo|cto|coo|cpo|cmo|president|chairman)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_leadership_hire',  meaning: 'C-suite appointment confirmed' }],
  ['(board (member|director|seat|advisor|expansion|changes?))',
    { signal_class: 'hiring_signal',             base_certainty: 0.75, action_tag: 'action_governance',       meaning: 'board composition change' }],
  ['(named|appointed|elected|promoted).{0,20}(to the board|as (chair|director))',
    { signal_class: 'hiring_signal',             base_certainty: 0.90, action_tag: 'action_governance',       meaning: 'board-level appointment' }],
  ['(head(count)?|workforce|team).{0,20}(grew|growing|growth|expanded|expansion|doubled)',
    { signal_class: 'hiring_signal',             base_certainty: 0.80, action_tag: 'action_hiring',           meaning: 'team size growth' }],
  ['(open(ed|ing)?|creat(ed|ing)?|list(ed|ing)?).{0,20}(role|position|job|opening)',
    { signal_class: 'hiring_signal',             base_certainty: 0.70, action_tag: 'action_hiring',           meaning: 'new role opened' }],

  // ── Geographic / market expansion ─────────────────────────────────────────
  ['expand(ed|ing|s)?.{0,15}(to |into )(europe|uk|apac|asia|latam|africa|india|china|middle east|mena|sea|emea)',
    { signal_class: 'expansion_signal',          base_certainty: 0.85, action_tag: 'action_geo_expansion',    meaning: 'geographic expansion confirmed' }],
  ['launch(ed|ing)?.{0,15}(in|across) (europe|uk|apac|india|china|brazil|mena|africa|latam|sea)',
    { signal_class: 'expansion_signal',          base_certainty: 0.85, action_tag: 'action_geo_expansion',    meaning: 'product launch in new geography' }],
  ['open(ed|ing)?.{0,15}(office|hub|centre|center|hq|headquarters).{0,15}(in|at)',
    { signal_class: 'expansion_signal',          base_certainty: 0.90, action_tag: 'action_geo_expansion',    meaning: 'new office opened' }],
  ['(international|global) (expansion|launch|rollout|presence)',
    { signal_class: 'expansion_signal',          base_certainty: 0.80, action_tag: 'action_expanding',        meaning: 'international expansion' }],
  ['(enters?|enter(ing|ed)?|penetrat(ing|e|ed)) .{0,30}market',
    { signal_class: 'expansion_signal',          base_certainty: 0.80, action_tag: 'action_expanding',        meaning: 'new market entry' }],

  // ── Enterprise / upmarket GTM ─────────────────────────────────────────────
  ['(enterprise|mid.?market|upmarket).{0,20}(customer|client|sales|contract|deal)',
    { signal_class: 'enterprise_signal',         base_certainty: 0.80, action_tag: 'action_gtm',              meaning: 'enterprise customer or deal signal' }],
  ['(government|federal|public sector|dod|department of defense|nato|military).{0,20}(contract|deal|award|customer)',
    { signal_class: 'enterprise_signal',         base_certainty: 0.90, action_tag: 'action_gtm',              meaning: 'government contract or award' }],
  ['(channel|reseller|var|oem|distribution).{0,20}(partner|agreement|program)',
    { signal_class: 'gtm_signal',               base_certainty: 0.80, action_tag: 'action_gtm',              meaning: 'channel partnership' }],

  // ── Product & technology signals ──────────────────────────────────────────
  ['(version|v|release) [2-9](\\.\\d+)?',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',        meaning: 'major product version release' }],
  ['(open.?sour(ced?|ing)|open.?source(d|ing)?)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',        meaning: 'open source release' }],
  ['(api|sdk|cli|library).{0,15}(launch|release|introduc|announc)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',        meaning: 'developer tooling launch' }],
  ['(ai|machine learning|llm|large language model|generative ai|foundation model).{0,20}(tool|platform|product|feature|model)',
    { signal_class: 'product_signal',            base_certainty: 0.75, action_tag: 'action_launching',        meaning: 'AI product or feature' }],
  ['(breakthrough|milestone|record.?breaking|first.?of.?its.?kind|industry.?first)',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',        meaning: 'technical milestone claim' }],
  ['(waitlist|early access|private beta|invite.?only)',
    { signal_class: 'product_signal',            base_certainty: 0.70, action_tag: 'action_piloting',         meaning: 'pre-launch gating' }],

  // ── Partnership / ecosystem signals ───────────────────────────────────────
  ['(strategic|global|exclusive|preferred).{0,15}(partner|partnership|alliance)',
    { signal_class: 'partnership_signal',        base_certainty: 0.85, action_tag: 'action_partnering',       meaning: 'strategic partnership' }],
  ['(resell(er|ing)?|white.?label|oem|embedded|powered by)',
    { signal_class: 'partnership_signal',        base_certainty: 0.80, action_tag: 'action_partnering',       meaning: 'distribution or OEM partnership' }],
  ['(microsoft|google|amazon|aws|salesforce|sap|oracle|ibm|servicenow).{0,20}(partner|integration|marketplace|certified)',
    { signal_class: 'partnership_signal',        base_certainty: 0.90, action_tag: 'action_partnering',       meaning: 'big-tech platform partnership' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTICLE HEADLINE PATTERNS — 3RD-PERSON PRESENT TENSE
  // These are the most common verbs in tech/startup news headlines that the
  // base action map misses because it's tuned to first-person / gerund forms.
  // Key insight: article titles are the highest-signal text we have.
  // Pattern: "[Company] [Verb]s [Object]"
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Headline: Product / launch verbs ─────────────────────────────────────
  ['unveil(s|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',        meaning: 'product unveiled' }],
  ['roll(s|ed|ing) out',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',        meaning: 'product rollout' }],
  ['debut(s|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',        meaning: 'product debut' }],
  ['(goes|went|going) live',
    { signal_class: 'product_signal',            base_certainty: 0.90, action_tag: 'action_launching',        meaning: 'product went live' }],
  ['(goes|went|going) public',
    { signal_class: 'exit_signal',               base_certainty: 0.90, action_tag: 'action_exit_prep',        meaning: 'IPO or direct listing' }],
  ['(reveals?|reveals|reveal(s|ing|ed))',
    { signal_class: 'product_signal',            base_certainty: 0.75, action_tag: 'action_launching',        meaning: 'product reveal' }],
  ['pioneer(s|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.70, action_tag: 'action_launching',        meaning: 'product or market pioneering' }],

  // ── Headline: Fundraising verbs ───────────────────────────────────────────
  ['attract(s|ed|ing) (\\$[\\d.,]+[KkMmBb]|investment|funding|capital)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding attracted' }],
  ['receive(s|d|ing) (\\$[\\d.,]+[KkMmBb]|investment|funding|capital|grant)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding received' }],
  ['secures? (\\$[\\d.,]+[KkMmBb]|investment|funding|capital|grant|contract)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'deal or funding secured' }],
  ['garner(s|ed|ing) (\\$[\\d.,]+[KkMmBb]|investment|funding|support)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding garnered' }],
  ['pull(s|ed|ing) in (\\$[\\d.,]+[KkMmBb])',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding pulled in (headline slang)' }],
  ['snag(s|ged|ging) (\\$[\\d.,]+[KkMmBb]|investment|funding)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding snagged (headline slang)' }],
  ['score(s|d|ing) (\\$[\\d.,]+[KkMmBb]|investment|funding)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding scored (headline slang)' }],
  ['pocket(s|ed|ing) (\\$[\\d.,]+[KkMmBb])',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding pocketed (headline slang)' }],
  ['(wins?|wins|won|winning).{0,30}(\\$[\\d.,]+[KkMmBb]|grant|award|contract|deal)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_closing_round',    meaning: 'contract or grant won' }],
  ['(completes?|complete[sd]?).{0,20}(\\$[\\d.,]+[KkMmBb]|funding|round|raise)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'round completed' }],

  // ── Headline: Hiring / leadership ─────────────────────────────────────────
  ['tap(s|ped|ping) .{0,30}as (ceo|cto|coo|cpo|cmo|vp|president|chief|head)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_leadership_hire',  meaning: 'executive appointment (taps X as Y)' }],
  ['onboard(s|ed|ing) .{0,30}(ceo|cto|coo|cpo|cmo|vp|president|chief|head)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_leadership_hire',  meaning: 'executive onboarded' }],
  ['elevat(es|ed|ing) .{0,30}to (ceo|cto|coo|cpo|cmo|vp|president|chief)',
    { signal_class: 'hiring_signal',             base_certainty: 0.90, action_tag: 'action_leadership_hire',  meaning: 'internal executive promotion' }],
  ['promot(es|ed|ing) .{0,30}to (ceo|cto|coo|cpo|cmo|vp|president|chief)',
    { signal_class: 'hiring_signal',             base_certainty: 0.90, action_tag: 'action_leadership_hire',  meaning: 'internal promotion to C-suite' }],
  ['add(s|ed|ing) .{0,20}(to the team|to its team|to their team)',
    { signal_class: 'hiring_signal',             base_certainty: 0.75, action_tag: 'action_hiring',           meaning: 'team expansion' }],
  ['bring(s|ing) (on|aboard) .{0,20}(ceo|cto|coo|vp|president|chief|head)',
    { signal_class: 'hiring_signal',             base_certainty: 0.90, action_tag: 'action_leadership_hire',  meaning: 'executive brought on board' }],

  // ── Headline: Expansion / growth ─────────────────────────────────────────
  ['enter(s|ed|ing) (the |a )?market',
    { signal_class: 'expansion_signal',          base_certainty: 0.80, action_tag: 'action_expanding',        meaning: 'new market entry' }],
  ['break(s|ing) into',
    { signal_class: 'expansion_signal',          base_certainty: 0.80, action_tag: 'action_expanding',        meaning: 'entering new market' }],
  ['(eye|eyes|targeting|targets?) (expansion|growth|new market)',
    { signal_class: 'expansion_signal',          base_certainty: 0.70, action_tag: 'action_expanding',        meaning: 'expansion intent' }],
  ['team(s|ing|ed) up with',
    { signal_class: 'partnership_signal',        base_certainty: 0.85, action_tag: 'action_partnering',       meaning: 'new partnership formed (teams up)' }],
  ['join(s|ed|ing) (forces|hands) with',
    { signal_class: 'partnership_signal',        base_certainty: 0.85, action_tag: 'action_partnering',       meaning: 'joint venture or collaboration' }],
  ['ink(s|ed|ing) (a |the |an? )?(deal|agreement|contract|partnership)',
    { signal_class: 'partnership_signal',        base_certainty: 0.90, action_tag: 'action_partnering',       meaning: 'deal signed (inks deal)' }],

  // ── Headline: Acquisition ─────────────────────────────────────────────────
  ['snaps? up',
    { signal_class: 'acquisition_signal',        base_certainty: 0.90, action_tag: 'action_acquiring',        meaning: 'acquisition (snaps up)' }],
  ['gobbles? up',
    { signal_class: 'acquisition_signal',        base_certainty: 0.90, action_tag: 'action_acquiring',        meaning: 'acquisition (gobbles up)' }],
  ['scoops? up',
    { signal_class: 'acquisition_signal',        base_certainty: 0.85, action_tag: 'action_acquiring',        meaning: 'acquisition (scoops up)' }],
  ['pick(s|ed|ing) up .{0,30}(startup|company|firm|team)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.85, action_tag: 'action_acquiring',        meaning: 'acquisition (picks up)' }],
  ['(buys?|buy|bought|buying) .{0,30}(startup|company|firm|rival)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.95, action_tag: 'action_acquiring',        meaning: 'direct acquisition' }],
  ['(takes? over|took over)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.85, action_tag: 'action_acquiring',        meaning: 'takeover' }],
  ['(is acquired|gets acquired|gets? bought)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.95, action_tag: 'action_acquiring',        meaning: 'startup is acquired' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDER / STARTUP COLLOQUIAL LANGUAGE
  // Real phrases founders use — not press-release formal, but how they actually talk.
  // These appear 6–18 months BEFORE major events. That's the early signal advantage.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Founder: Growth ───────────────────────────────────────────────────────
  ['we.?re (hiring|growing the team|adding to the team)',
    { signal_class: 'hiring_signal',             base_certainty: 0.70, action_tag: 'action_hiring',           meaning: 'founder announces hiring' }],
  ['aggressively (hiring|recruiting|building)',
    { signal_class: 'hiring_signal',             base_certainty: 0.90, action_tag: 'action_hiring',           meaning: 'hypergrowth hiring posture' }],
  ['building out (the |our )?(team|sales|eng|engineering|product)',
    { signal_class: 'hiring_signal',             base_certainty: 0.75, action_tag: 'action_hiring',           meaning: 'team buildout underway' }],
  ['scaling (the |our )?team',
    { signal_class: 'hiring_signal',             base_certainty: 0.75, action_tag: 'action_hiring',           meaning: 'team scaling' }],
  ['(growing|scaling) (fast|quickly|rapidly|aggressively)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'strong growth posture' }],
  ['(demand is|inbound is) (strong|picking up|surging|incredible|wild|off the charts)',
    { signal_class: 'demand_signal',             base_certainty: 0.80, action_tag: 'action_demand',           meaning: 'founder confirms strong demand' }],
  ['inbound (is |has been )?(picking up|surging|going crazy|spiking)',
    { signal_class: 'demand_signal',             base_certainty: 0.85, action_tag: 'action_demand',           meaning: 'inbound demand surge' }],
  ['moving upmarket',
    { signal_class: 'enterprise_signal',         base_certainty: 0.85, action_tag: 'action_gtm',              meaning: 'upmarket enterprise motion' }],
  ['(investing in|building) (our |the )?(enterprise )?sales',
    { signal_class: 'gtm_signal',               base_certainty: 0.80, action_tag: 'action_gtm',              meaning: 'GTM / sales investment' }],
  ['opening (new )?(locations?|offices?|markets?)',
    { signal_class: 'expansion_signal',          base_certainty: 0.85, action_tag: 'action_geo_expansion',    meaning: 'new location opening' }],
  ['ramping (production|output|manufacturing|capacity)',
    { signal_class: 'demand_signal',             base_certainty: 0.85, action_tag: 'action_demand',           meaning: 'production ramp signal' }],
  ['increasing (capacity|throughput|output|production)',
    { signal_class: 'demand_signal',             base_certainty: 0.80, action_tag: 'action_demand',           meaning: 'capacity increase signal' }],

  // ── Founder: Fundraising (colloquial) ─────────────────────────────────────
  ['we.?re (raising|in the market|fundraising)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.75, action_tag: 'action_raising',          meaning: 'founder confirms active raise' }],
  ['(opening|launching|starting) (a |our |the )?round',
    { signal_class: 'fundraising_signal',        base_certainty: 0.75, action_tag: 'action_raising',          meaning: 'round opening' }],
  ['in (the )?market (now|currently|today)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_raising',          meaning: 'actively fundraising right now' }],
  ['clos(ing|ed) (the |our )?round',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'round closing imminently' }],
  ['(strategic|impact|family office) investor',
    { signal_class: 'fundraising_signal',        base_certainty: 0.70, action_tag: 'action_raising',          meaning: 'strategic investor involved' }],
  ['extending (the |our )?round',
    { signal_class: 'distress_signal',           base_certainty: 0.75, action_tag: 'action_survival',          meaning: 'round extension — possible difficulty' }],
  ['(bridge|insider|internal) round',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',          meaning: 'bridge/insider round — distress indicator' }],
  ['need (more )?runway',
    { signal_class: 'distress_signal',           base_certainty: 0.90, action_tag: 'action_survival',          meaning: 'runway pressure explicit' }],

  // ── Founder: Caution / Efficiency ─────────────────────────────────────────
  ['focus(ed|ing)? on profitab(ility|le)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.80, action_tag: 'action_efficiency',        meaning: 'profitability focus' }],
  ['improving (our |the )?(margins?|unit economics)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.80, action_tag: 'action_efficiency',        meaning: 'margin improvement' }],
  ['reduc(ing|ed) (the |our )?burn',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',          meaning: 'burn reduction' }],

  // ── Founder: Exit (colloquial) ────────────────────────────────────────────
  ['(talking|working) (to|with) bankers',
    { signal_class: 'exit_signal',               base_certainty: 0.95, action_tag: 'action_exit_prep',         meaning: 'investment banker engaged — sale or IPO imminent' }],
  ['position(ed|ing) (for|ourselves for) (acquisition|an exit|sale)',
    { signal_class: 'exit_signal',               base_certainty: 0.90, action_tag: 'action_exit_prep',         meaning: 'acquisition positioning' }],
  ['partner(ing|ed) with (an |our )?(advisor|M&A advisor|banker)',
    { signal_class: 'exit_signal',               base_certainty: 0.85, action_tag: 'action_exit_prep',         meaning: 'M&A advisor engaged' }],
  ['exploring (our )?options',
    { signal_class: 'exit_signal',               base_certainty: 0.80, action_tag: 'action_exit_prep',         meaning: 'exploring exit options' }],

  // ── Founder: Product (colloquial) ─────────────────────────────────────────
  ['rolling out',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',         meaning: 'product rollout' }],
  ['(ga|general availability) (release|launch)',
    { signal_class: 'product_signal',            base_certainty: 0.95, action_tag: 'action_launching',         meaning: 'GA launch confirmed' }],
  ['(new|big|major) (platform|product) (launch|release|update)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',         meaning: 'major product event' }],
  ['on the roadmap',
    { signal_class: 'product_signal',            base_certainty: 0.45, action_tag: 'action_exploring',         meaning: 'future product — roadmap intent' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTOR LANGUAGE DICTIONARY
  // Investors speak in code. Each phrase has a real meaning behind it.
  // These are the most important signals in the platform for investor matching.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Investor: Interest signals (low → max) ────────────────────────────────
  ['we.?re (intrigued|excited about|bullish on) (this|it|the)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.65, action_tag: 'action_investor_interest', meaning: 'investor signals genuine interest' }],
  ['we like (this |the )?(space|sector|category|theme)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.40, action_tag: 'action_investor_interest', meaning: 'thematic interest only — not company-specific' }],
  ['we like (this |your )?(team|founder|founding team)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.65, action_tag: 'action_investor_interest', meaning: 'team-level conviction' }],
  ['we want to (learn more|know more|dig in|dig deeper)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.60, action_tag: 'action_investor_interest', meaning: 'investor requests deeper look' }],
  ['(let.?s|we.?d like to) (continue|keep) (the )?conversation',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.65, action_tag: 'action_investor_interest', meaning: 'continuation — positive signal' }],
  ['send (us |me |over )?(the |your )?(deck|pitch deck|presentation)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.65, action_tag: 'action_investor_interest', meaning: 'deck requested — early interest' }],
  ['send (us |me |over )?(the |your )?(financials?|numbers|model|p&l)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.80, action_tag: 'action_investor_diligence', meaning: 'financials requested — serious interest' }],
  ['send (over |us )?(the |your )?data.?room',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_investor_diligence', meaning: 'data room requested — very serious' }],
  ['(going to|taking it to|bringing it to) (the )?partners?',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.85, action_tag: 'action_investor_diligence', meaning: 'partner-level review initiated' }],
  ['moving (this |it )?(to|into) (the )?IC',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.90, action_tag: 'action_investor_diligence', meaning: 'investment committee — very serious' }],
  ['(we.?re|we are) (in|doing|starting) (full |active )?diligence',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.95, action_tag: 'action_investor_diligence', meaning: 'diligence in progress — near-deal' }],
  ['preparing (a |the )?(term sheet|termsheet|offer)',
    { signal_class: 'fundraising_signal',        base_certainty: 1.00, action_tag: 'action_closing_round',     meaning: 'term sheet being prepared — deal imminent' }],
  ['(customer|market|reference|technical|financial) (calls?|work|check|diligence)',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.85, action_tag: 'action_investor_diligence', meaning: 'active diligence underway' }],
  ['discussed (this |it )?internally',
    { signal_class: 'investor_interest_signal',  base_certainty: 0.70, action_tag: 'action_investor_diligence', meaning: 'internal review happened' }],

  // ── Investor: Rejection signals ────────────────────────────────────────────
  ['not (a )?(fit|right fit) (for us|right now|at this time)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.95, action_tag: 'action_investor_rejection', meaning: 'pass — not a fit' }],
  ['timing (is|isn.?t) (not )?right',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.85, action_tag: 'action_investor_rejection', meaning: 'timing pass' }],
  ['too (early|late|small|big) for us',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.90, action_tag: 'action_investor_rejection', meaning: 'stage or size mismatch' }],
  ['(keep us|stay in) (updated?|touch)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.70, action_tag: 'action_investor_rejection', meaning: 'soft pass — keep us posted' }],
  ['(circle|come) back (to us )?(later|when|after)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.75, action_tag: 'action_investor_rejection', meaning: 'deferred — soft no' }],
  ['(we.?ll |going to )pass( for now)?',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.95, action_tag: 'action_investor_rejection', meaning: 'explicit pass' }],
  ['(don.?t|we don.?t) (have|see) (the )?(conviction|enough traction|fit)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.90, action_tag: 'action_investor_rejection', meaning: 'no conviction — pass' }],
  ['need (more |to see more )?(traction|revenue|customers|proof)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.85, action_tag: 'action_investor_rejection', meaning: 'milestone gap — conditional no' }],
  ['come back (after|once|when) (you|you.?ve|you have)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.80, action_tag: 'action_investor_rejection', meaning: 'deferred with conditions' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // BUYER / CUSTOMER INTENT DICTIONARY
  // How companies signal they are about to buy software, robots, automation, AI.
  // These are gold for Ready For Robots, Pythh, and Merlin.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Buyer: Active purchase signals ────────────────────────────────────────
  ['looking (for|to find|to buy|to procure|to source) (a |an |the )?(solution|platform|tool|vendor|system)',
    { signal_class: 'buyer_signal',              base_certainty: 0.80, action_tag: 'action_evaluating',        meaning: 'active vendor search' }],
  ['evaluating (vendors?|platforms?|solutions?|providers?|tools?)',
    { signal_class: 'buyer_signal',              base_certainty: 0.85, action_tag: 'action_evaluating',        meaning: 'formal vendor evaluation underway' }],
  ['(running|doing|conducting|starting) (a |our )?(pilot|poc|proof of concept)',
    { signal_class: 'buyer_signal',              base_certainty: 0.90, action_tag: 'action_evaluating',        meaning: 'vendor pilot or POC running' }],
  ['\\b(rfp|rfq|rfx|request for proposal|request for quotation)\\b',
    { signal_class: 'buyer_signal',              base_certainty: 0.95, action_tag: 'action_evaluating',        meaning: 'formal procurement process — RFP/RFQ issued' }],
  ['(looking for|need|hiring|working with) (an? )?(implementation partner|systems integrator|SI)',
    { signal_class: 'buyer_signal',              base_certainty: 0.90, action_tag: 'action_evaluating',        meaning: 'procurement — integration partner needed' }],
  ['(replacing|replacing our|switching from|moving away from|migrating from)',
    { signal_class: 'buyer_signal',              base_certainty: 0.90, action_tag: 'action_evaluating',        meaning: 'replacement purchase intent' }],
  ['(upgrading|modernizing|overhauling) (our|the) (system|platform|tools?|stack|infrastructure)',
    { signal_class: 'buyer_signal',              base_certainty: 0.85, action_tag: 'action_evaluating',        meaning: 'upgrade or modernization initiative' }],
  ['(automating|digitizing|digitising) (our|the|key) (process(es)?|workflow|operations?|tasks?)',
    { signal_class: 'buyer_signal',              base_certainty: 0.85, action_tag: 'action_evaluating',        meaning: 'automation or digital transformation initiative' }],
  ['deploy(ing|ed)? (a |the |our )?(new |ai |ml |automation |robotics |software )?system',
    { signal_class: 'buyer_signal',              base_certainty: 0.80, action_tag: 'action_evaluating',        meaning: 'system deployment in progress' }],

  // ── Buyer: Pain signals (BEST sales signals — precede purchases) ──────────
  ['struggling (with|to) ',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.85, action_tag: 'action_pain',             meaning: 'explicit operational pain' }],
  ['manual (process|workflow|work|labor|effort|steps?)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.80, action_tag: 'action_pain',             meaning: 'manual process = automation opportunity' }],
  ['(too expensive|costs? (too much|too high)|cost overrun)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.80, action_tag: 'action_pain',             meaning: 'cost pain signal' }],
  ['(too slow|speed (issue|problem)|slow (process|turnaround|cycle))',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.80, action_tag: 'action_pain',             meaning: 'efficiency pain signal' }],
  ['(labor shortage|labor (crunch|costs?|gap)|workforce (shortage|gap|crunch))',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.85, action_tag: 'action_pain',             meaning: 'labor scarcity = automation trigger' }],
  ["(can.?t|cannot|struggling to) (find|hire|recruit|retain) (workers?|employees?|talent|staff)",
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.90, action_tag: 'action_pain',             meaning: 'hiring pain = automation/robotics trigger' }],
  ['(unplanned |unexpected |costly )?(downtime|outage)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.85, action_tag: 'action_pain',             meaning: 'reliability pain' }],
  ['(supply chain|logistics|fulfillment) (issue|disruption|problem|challenge|delay)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.80, action_tag: 'action_pain',             meaning: 'supply chain pain' }],
  ['(lack of|no|limited) (visibility|reporting|analytics|data|insight)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.80, action_tag: 'action_pain',             meaning: 'analytics or visibility gap' }],
  ['(compliance|regulatory|safety) (issue|risk|problem|concern|violation)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.85, action_tag: 'action_pain',             meaning: 'compliance or safety pain' }],
  ['(capacity|throughput) (constraint|issue|limitation|bottleneck)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.85, action_tag: 'action_pain',             meaning: 'capacity constraint = expansion or automation need' }],
  ['(customer|patient|wait) (wait times?|delays?|backlogs?)',
    { signal_class: 'buyer_pain_signal',         base_certainty: 0.80, action_tag: 'action_pain',             meaning: 'customer experience pain' }],

  // ── Buyer: Budget / Timing signals ────────────────────────────────────────
  ['(this year|current year|fy\d*) (initiative|project|program|rollout|priority)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.85, action_tag: 'action_budget',           meaning: 'current year budget allocated' }],
  ['(next year|next fy|fy\d+) (initiative|project|budget|priority)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.70, action_tag: 'action_budget',           meaning: 'future year budget planning' }],
  ['(budget (approved|allocated|secured|confirmed)|budget is (approved|set|confirmed))',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.95, action_tag: 'action_budget',           meaning: 'budget confirmed — ready to buy' }],
  ['(pilot|poc|proof of concept) this (quarter|month|year)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.90, action_tag: 'action_budget',           meaning: 'near-term pilot — very close to purchase' }],
  ['rolling out (next year|in \d+)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.75, action_tag: 'action_budget',           meaning: 'planned rollout — near-term purchase' }],
  ['(corporate|strategic|company.?wide|enterprise.?wide) (initiative|program|project|transformation)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.80, action_tag: 'action_budget',           meaning: 'company-wide initiative — large budget' }],
  ['(digital transformation|DX|DT) (initiative|program|journey|effort)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.85, action_tag: 'action_budget',           meaning: 'digital transformation — large budget project' }],
  ['(cost reduction|cost savings?|efficiency) (initiative|program|project|drive)',
    { signal_class: 'buyer_budget_signal',       base_certainty: 0.85, action_tag: 'action_budget',           meaning: 'cost reduction initiative — ROI-driven purchase' }],

  // ── Exploratory / low-certainty ───────────────────────────────────────────
  ['explor(ing|e)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.40, action_tag: 'action_exploring',        meaning: 'early exploration — low certainty' }],
  ['evaluat(ing|e)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.40, action_tag: 'action_evaluating',       meaning: 'evaluation phase' }],
  ['consider(s|ing|ed)?(?=\\b)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.35, action_tag: 'action_evaluating',
      meaning: 'under consideration',
      gates: ['fundraising_signal', 'hiring_signal', 'acquisition_signal', 'expansion_signal', 'product_signal'] }],
  ['look(ing|ed)? (to|into|at|for)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.45, action_tag: 'action_exploring',        meaning: 'seeking / exploring' }],
  ['investigat(ing|ed)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.40, action_tag: 'action_evaluating',       meaning: 'investigating' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING VERB CONJUGATIONS — 3rd-person present, irregular forms
  // Headline-dominant forms that prior regex missed.
  // ═══════════════════════════════════════════════════════════════════════════

  ['unveil(s|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.90, action_tag: 'action_launching',        meaning: 'product unveiled' }],
  ['debut(s|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.88, action_tag: 'action_launching',        meaning: 'product debut' }],
  ['roll(s|ed|ing) out',
    { signal_class: 'product_signal',            base_certainty: 0.82, action_tag: 'action_launching',        meaning: 'gradual product rollout' }],
  ['ink(s|ed|ing) (a |the |an )?(deal|agreement|partnership|contract)',
    { signal_class: 'partnership_signal',        base_certainty: 0.92, action_tag: 'action_partnering',       meaning: 'deal or partnership finalized' }],
  ['sign(s|ed|ing) (a |the |an )?(deal|agreement|partnership|contract|mou)',
    { signal_class: 'partnership_signal',        base_certainty: 0.90, action_tag: 'action_partnering',       meaning: 'agreement signed' }],
  ['team(s|ed|ing) up (with)?',
    { signal_class: 'partnership_signal',        base_certainty: 0.85, action_tag: 'action_partnering',       meaning: 'teaming up — partnership colloquial' }],
  ['partner(s|ed|ing) with',
    { signal_class: 'partnership_signal',        base_certainty: 0.85, action_tag: 'action_partnering',       meaning: 'partnership formed' }],
  ['tap(s|ped|ping) (into|on)',
    { signal_class: 'expansion_signal',          base_certainty: 0.72, action_tag: 'action_geo_expansion',    meaning: 'tapping into new market or talent' }],
  ['name(s|d) .{0,40} (as|to) (ceo|cto|coo|cpo|cmo|vp|chief|president|head of)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_executive_hire',   meaning: 'named executive — C-suite or VP hire' }],
  ['appoint(s|ed|ing) .{0,40} (as|to) (ceo|cto|coo|cpo|cmo|vp|chief|president|head of)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_executive_hire',   meaning: 'executive appointment' }],
  ['promot(es|ed|ing) .{0,40} (to|as)',
    { signal_class: 'hiring_signal',             base_certainty: 0.85, action_tag: 'action_executive_hire',   meaning: 'internal promotion — leadership deepening' }],
  ['win(s|ning) .{0,40} (contract|deal|customer|client|award)',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_customer_win',     meaning: 'customer or contract win' }],
  ['land(s|ed|ing) .{0,40} (deal|customer|client|contract|account)',
    { signal_class: 'growth_signal',             base_certainty: 0.88, action_tag: 'action_customer_win',     meaning: 'customer/deal landed — GTM traction' }],
  ['secure(s|d)? .{0,40} (contract|deal|partnership)',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_customer_win',     meaning: 'secures deal or contract' }],
  ['secure(s|d)? .{0,40} (funding|investment|capital)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'secures funding (press form)' }],
  ['join(s|ed|ing) .{0,25}(ycombinator|y combinator|techstars|a16z|sequoia|andreessen|500 startups|plug and play|gener8tor|entrepreneurs)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_raising',          meaning: 'joined top accelerator or program' }],
  ['(selected for|accepted (into|to|by)|chosen for) .{0,30}(accelerator|cohort|program|batch|fellowship)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_raising',          meaning: 'accelerator or program acceptance' }],
  ['attract(s|ed|ing) .{0,40}(investment|funding|capital|backing)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.88, action_tag: 'action_raising',          meaning: 'attracting investment — headline form' }],
  ['back(s|ed|ing) .{0,40}(startup|company|venture|round)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.88, action_tag: 'action_raising',          meaning: 'VC backing a startup' }],
  ['(value(d|s) at|valuation of) \\$',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: 'valuation disclosed — round announced' }],
  ['unicorn (status|valuation)?',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: '$1B+ valuation milestone' }],
  ['decacorn',
    { signal_class: 'fundraising_signal',        base_certainty: 0.95, action_tag: 'action_closing_round',    meaning: '$10B+ valuation milestone' }],
  ['(expand(s|ed|ing)?|grow(s|ing)?) (into|to) (new )?(market|region|country|vertical)',
    { signal_class: 'expansion_signal',          base_certainty: 0.85, action_tag: 'action_geo_expansion',    meaning: 'geographic or vertical expansion' }],
  ['enter(s|ed|ing) .{0,30}(market|region|country|vertical)',
    { signal_class: 'expansion_signal',          base_certainty: 0.85, action_tag: 'action_geo_expansion',    meaning: 'entering new market' }],
  ['pivot(s|ed|ing)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.80, action_tag: 'action_exploring',        meaning: 'pivoting — directional change' }],
  ['rebrand(s|ed|ing)',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',        meaning: 'rebranding — strategic repositioning' }],
  ['spin(s|ning).?(off|out)',
    { signal_class: 'expansion_signal',          base_certainty: 0.85, action_tag: 'action_geo_expansion',    meaning: 'spin-out from parent entity' }],
  ['go(es|ing)? (public|to market)',
    { signal_class: 'exit_signal',               base_certainty: 0.90, action_tag: 'action_exit_prep',        meaning: 'going public — IPO signal' }],
  ['file(s|d|ing)? (for |an |the )?(ipo|s-1|s1|f-1|listing)',
    { signal_class: 'exit_signal',               base_certainty: 0.98, action_tag: 'action_exit_prep',        meaning: 'IPO filing confirmed' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLOQUIALISMS — How founders, operators, and press actually speak
  // Informal, idiomatic, and social-media-native phrases.
  // These are early signals — they show up 3–12 months before formal events.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Hypergrowth / PMF colloquials ─────────────────────────────────────────
  ['(absolutely |literally )?(crushing it|killing it|nailing it)',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_growing',          meaning: 'hypergrowth colloquial — very strong performance' }],
  ['(totally |absolutely )?(on fire|blowing up)',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_growing',          meaning: 'explosive growth idiom' }],
  ['going (absolutely )?(nuts|crazy|bananas|wild)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'explosive informal growth signal' }],
  ['hockey.?stick (growth|moment|curve)',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'hockey stick growth — inflection confirmed' }],
  ['off the charts',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_growing',          meaning: 'off-the-charts growth — informal' }],
  ['(found|hit|reached) (our |product.?market )?fit',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'product-market fit confirmed' }],
  ['product.?market fit',
    { signal_class: 'growth_signal',             base_certainty: 0.85, action_tag: 'action_growing',          meaning: 'PMF language' }],
  ['customers (love|can.?t stop using|keep coming back)',
    { signal_class: 'growth_signal',             base_certainty: 0.85, action_tag: 'action_growing',          meaning: 'retention and love signal — PMF indicator' }],
  ['(getting |seeing )(real |serious |strong )?traction',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_growing',          meaning: 'early traction confirmed' }],
  ['(printing (money|revenue)|revenue is (flying|exploding|going crazy))',
    { signal_class: 'revenue_signal',            base_certainty: 0.85, action_tag: 'action_growing',          meaning: 'strong revenue colloquial — informal' }],
  ['(first paying customer|first customer)',
    { signal_class: 'revenue_signal',            base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'first revenue milestone' }],
  ['(hit|reached|crossed) (our )?(\\$\\d+[mk]?|\\d+[mk]) (arr|mrr|in revenue)',
    { signal_class: 'revenue_signal',            base_certainty: 0.95, action_tag: 'action_growing',          meaning: 'ARR / MRR milestone hit' }],
  ['(went |gone )viral',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'viral distribution event' }],
  ['(top of|#1 on|number one on) (hacker news|product hunt|app store)',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'viral product launch — platform chart-topper' }],
  ['(dogfood(ing)?|eating our own cooking|using it ourselves)',
    { signal_class: 'product_signal',            base_certainty: 0.70, action_tag: 'action_launching',        meaning: 'internal validation — dogfooding' }],
  ['(zero to one|0 to 1)',
    { signal_class: 'product_signal',            base_certainty: 0.70, action_tag: 'action_launching',        meaning: 'early zero-to-one stage language' }],
  ['(found|identified|discovered) (our |the )?(wedge|beachhead)',
    { signal_class: 'growth_signal',             base_certainty: 0.85, action_tag: 'action_growing',          meaning: 'found the wedge — GTM breakthrough' }],
  ['default (alive|dead)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.85, action_tag: 'action_efficiency',       meaning: 'Ramen-profitable or survival mode language' }],
  ['ramen profitable',
    { signal_class: 'efficiency_signal',         base_certainty: 0.90, action_tag: 'action_efficiency',       meaning: 'ramen profitability — capital efficient' }],
  ['(profitable (as of|since)|turned profitable)',
    { signal_class: 'efficiency_signal',         base_certainty: 0.95, action_tag: 'action_efficiency',       meaning: 'profitability milestone' }],
  ['(raised our|closed our) (seed|[abcde] round|series [abcde])',
    { signal_class: 'fundraising_signal',        base_certainty: 0.98, action_tag: 'action_closing_round',    meaning: 'round closed — casual founder announcement' }],
  ['(locked in|nailed down) .{0,30}(investors?|lead|check|commitment)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.85, action_tag: 'action_closing_round',    meaning: 'funding secured — colloquial' }],
  ['(had to|needed to|decided to) (let (people|someone|folks|team) go|make cuts)',
    { signal_class: 'distress_signal',           base_certainty: 0.95, action_tag: 'action_layoffs',          meaning: 'layoffs — informal founder framing' }],
  ['(running out of|dangerously low on) (cash|runway|money)',
    { signal_class: 'distress_signal',           base_certainty: 0.95, action_tag: 'action_survival',         meaning: 'critical cash pressure — informal' }],
  ['months? of runway',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',         meaning: 'runway explicitly disclosed' }],
  ['(sunsetting|winding down|shutting down)',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_layoffs',          meaning: 'confirmed shutdown' }],
  ['not a fit (for us|right now|at this stage)',
    { signal_class: 'investor_rejection_signal', base_certainty: 0.92, action_tag: 'action_investor_rejection', meaning: 'VC pass — colloquial' }],
  ['(building in public|learning in public)',
    { signal_class: 'product_signal',            base_certainty: 0.65, action_tag: 'action_launching',        meaning: 'transparency signal — build-in-public culture' }],

  // ── Headline slang (press / media shorthand) ──────────────────────────────
  ['pull(s|ed|ing) in .{0,30}(million|billion|\\$)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding pulled in (headline slang)' }],
  ['snag(s|ged|ging) .{0,30}(million|billion|\\$|funding|round)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding snagged (headline slang)' }],
  ['score(s|d|ing) .{0,40}(million|billion|\\$|funding|round|series [a-e]|seed|pre.?seed)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding scored (headline slang)' }],
  ['pocket(s|ed|ing) .{0,30}(million|billion|\\$)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.90, action_tag: 'action_closing_round',    meaning: 'funding pocketed (headline slang)' }],
  ['bag(s|ged|ging) .{0,40}(million|billion|\\$|funding|series [a-e]|seed)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.88, action_tag: 'action_closing_round',    meaning: 'funding bagged (headline slang)' }],
  ['notch(es|ed|ing) .{0,30}(million|billion|win|deal|contract)',
    { signal_class: 'growth_signal',             base_certainty: 0.85, action_tag: 'action_customer_win',     meaning: 'notching wins — informal win language' }],
  ['(taps?|poach(es|ed|ing)) .{0,30}(from |ex-)(google|meta|amazon|apple|microsoft|stripe|openai|anthropic)',
    { signal_class: 'hiring_signal',             base_certainty: 0.92, action_tag: 'action_executive_hire',   meaning: 'poaching elite talent — strong signal' }],
  ['lure(s|d|ing) .{0,30}(from |away from)',
    { signal_class: 'hiring_signal',             base_certainty: 0.85, action_tag: 'action_executive_hire',   meaning: 'luring talent — competitive recruiting' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDER PSYCHOLOGY — Ported from signal-ontology.js anchor library
  // Linguistic patterns that correlate with specific lifecycle events.
  // These appear on LinkedIn, X, and email updates — not formal press releases.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Positive momentum / confidence ────────────────────────────────────────
  ['(couldn.?t be|can.?t be) more (excited|proud|thrilled)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'peak enthusiasm — often pre-fundraise or post-launch' }],
  ['(incredibly|so|truly) (excited|proud|grateful|humbled) to (announce|share|tell)',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_growing',          meaning: 'announcement preamble — positive milestone' }],
  ['this is just the beginning',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'momentum language — start of scaling chapter' }],
  ['(after|following) (months|years) of (hard work|building|development)',
    { signal_class: 'product_signal',            base_certainty: 0.80, action_tag: 'action_launching',        meaning: 'pre-launch preamble — product or milestone' }],
  ['we are (just )?getting started',
    { signal_class: 'growth_signal',             base_certainty: 0.72, action_tag: 'action_growing',          meaning: 'early chapter momentum language' }],
  ['big things (coming|ahead)',
    { signal_class: 'growth_signal',             base_certainty: 0.70, action_tag: 'action_growing',          meaning: 'upcoming announcements teased' }],
  ['(proud|excited) to (welcome|introduce|announce)',
    { signal_class: 'hiring_signal',             base_certainty: 0.85, action_tag: 'action_executive_hire',   meaning: 'new team member or investor announced' }],
  ['(humbled|grateful) (by|for) (the |our |their )?(support|response|backing|investors)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.80, action_tag: 'action_closing_round',    meaning: 'gratitude language = fundraise announcement' }],
  ['thrilled to welcome .{0,40}(to our|as our|as (a |an )?)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.80, action_tag: 'action_closing_round',    meaning: 'welcoming investor or executive — announcement' }],

  // ── Pivot / recalibration signals ─────────────────────────────────────────
  ['(i.?ve been|we.?ve been) (thinking a lot about|reflecting on|reconsidering)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.75, action_tag: 'action_exploring',        meaning: 'founder reconsidering direction — pivot may follow' }],
  ['(revisiting|rethinking|reconsidering) (our )?(roadmap|strategy|direction|model)',
    { signal_class: 'exploratory_signal',        base_certainty: 0.80, action_tag: 'action_exploring',        meaning: 'roadmap reconsideration — pivot signal' }],
  ['(customers|users) kept (asking|telling us|wanting)',
    { signal_class: 'product_signal',            base_certainty: 0.85, action_tag: 'action_launching',        meaning: 'customer-pulled feature or pivot — strong PMF signal' }],
  ['(challenging ourselves|pushing ourselves) to',
    { signal_class: 'exploratory_signal',        base_certainty: 0.65, action_tag: 'action_exploring',        meaning: 'self-challenge language — reinvention posture' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSIVE VOICE PATTERNS — headline and press-release dominant forms
  // Many strong signals arrive in passive voice: "was acquired", "was delisted"
  // Active-voice patterns miss these. Passive forms carry same certainty.
  // ═══════════════════════════════════════════════════════════════════════════

  ['(was|were|has been|have been) (acquired|purchased|bought) (by|from)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.97, action_tag: 'action_acquiring',        meaning: 'passive: company acquired' }],
  ['(was|were|has been) (merged|combined) (with|into)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.97, action_tag: 'action_acquiring',        meaning: 'passive: merger completed' }],
  ['(was|were|has been) (delisted|removed) (from )?(the )?(nasdaq|nyse|lse|tsx|asx|exchange|stock market)',
    { signal_class: 'exit_signal',               base_certainty: 0.97, action_tag: 'action_exit_prep',        meaning: 'passive: delisted from exchange — exit or distress' }],
  ['(deal|agreement|partnership|contract) was (signed|executed|finalized|inked)',
    { signal_class: 'partnership_signal',        base_certainty: 0.92, action_tag: 'action_partnering',       meaning: 'passive: deal signed' }],
  ['(funding|investment|capital|round) (was|has been) (secured|raised|closed|completed)',
    { signal_class: 'fundraising_signal',        base_certainty: 0.97, action_tag: 'action_closing_round',    meaning: 'passive: funding secured or closed' }],
  ['(was|has been) (appointed|named|selected|chosen|hired) (as|to be) (the )?(ceo|cto|coo|cpo|cmo|vp|chief|president|head of)',
    { signal_class: 'hiring_signal',             base_certainty: 0.95, action_tag: 'action_executive_hire',   meaning: 'passive: executive appointed' }],
  ['(was|has been) (acquired by|taken private|taken over)',
    { signal_class: 'acquisition_signal',        base_certainty: 0.97, action_tag: 'action_acquiring',        meaning: 'passive: taken private or acquired' }],
  ['(has been|was) (shut down|wound down|dissolved|liquidated|shuttered)',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_layoffs',          meaning: 'passive: company shut down' }],
  ['(chapter 11|chapter 7|bankruptcy) (was filed|has been filed|filing)',
    { signal_class: 'distress_signal',           base_certainty: 1.00, action_tag: 'action_survival',         meaning: 'passive: bankruptcy filed' }],
  ['(was|were) (laid off|let go|made redundant|terminated)',
    { signal_class: 'distress_signal',           base_certainty: 0.98, action_tag: 'action_layoffs',          meaning: 'passive: employees laid off' }],
  ['(was|has been) (listed|admitted) (on|to) (the )?(nasdaq|nyse|exchange|lse|tsx)',
    { signal_class: 'exit_signal',               base_certainty: 0.98, action_tag: 'action_exit_prep',        meaning: 'passive: listed on exchange — IPO complete' }],
  ['(product|platform|service|feature) (was|has been) (launched|released|shipped|deployed)',
    { signal_class: 'product_signal',            base_certainty: 0.90, action_tag: 'action_launching',        meaning: 'passive: product launched or released' }],

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPARATIVE / OUTPERFORMANCE PATTERNS
  // "Ahead of plan" is a strong growth signal — more confident than "growing".
  // "Exceeding targets" is near-confirmed — the company is reporting results.
  // ═══════════════════════════════════════════════════════════════════════════

  ['(ahead of (plan|target|schedule|forecast|expectations?|guidance))',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'ahead of plan — outperforming guidance' }],
  ['(exceed(s|ing|ed) (all )?(target|plan|forecast|expectation|guidance|goal))',
    { signal_class: 'growth_signal',             base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'exceeding targets — confirmed outperformance' }],
  ['(beat(s|ing)?|surpass(es|ed|ing)?) (our |the )?(arr|mrr|revenue|growth|target)',
    { signal_class: 'revenue_signal',            base_certainty: 0.90, action_tag: 'action_growing',          meaning: 'beating revenue targets — strong signal' }],
  ['(better than expected|stronger than expected|ahead of expectations)',
    { signal_class: 'growth_signal',             base_certainty: 0.85, action_tag: 'action_growing',          meaning: 'better than expected — positive surprise' }],
  ['(outperform(s|ed|ing)?|outpac(ed|ing)?) (the market|sector|competition|peers|industry)',
    { signal_class: 'growth_signal',             base_certainty: 0.85, action_tag: 'action_growing',          meaning: 'outperforming peers — competitive leadership' }],
  ['(record (revenue|arr|mrr|growth|quarter|month|year))',
    { signal_class: 'revenue_signal',            base_certainty: 0.92, action_tag: 'action_growing',          meaning: 'record performance — milestone' }],
  ['(fastest growing|fastest-growing) (company|startup|platform|product)',
    { signal_class: 'growth_signal',             base_certainty: 0.80, action_tag: 'action_growing',          meaning: 'fastest growing claim — strong growth signal' }],
  ['(on track (to|for) (our )?)',
    { signal_class: 'growth_signal',             base_certainty: 0.75, action_tag: 'action_growing',          meaning: 'on track — planned milestones being met' }],

  // ── Distress / shutdown / failure signals ─────────────────────────────────
  ['(bittersweet|mixed emotions|emotional day)',
    { signal_class: 'distress_signal',           base_certainty: 0.80, action_tag: 'action_survival',         meaning: 'emotional transition — shutdown or exit' }],
  ['on to (the )?next (adventure|chapter|thing)',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',         meaning: 'departure language — winding down or leaving' }],
  ['(stepping back|stepping down|moving on)',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',         meaning: 'founder exiting or stepping back' }],
  ['(this was not an easy|not an easy) decision',
    { signal_class: 'distress_signal',           base_certainty: 0.85, action_tag: 'action_survival',         meaning: 'difficult decision language — shutdown or pivot' }],
  ['after (much |a lot of )?(reflection|soul.?searching)',
    { signal_class: 'distress_signal',           base_certainty: 0.80, action_tag: 'action_survival',         meaning: 'post-failure reflection — often precedes announcement' }],
  ['(we learned a lot|incredibly valuable lessons|this has been a (crazy|wild|tough) journey)',
    { signal_class: 'distress_signal',           base_certainty: 0.75, action_tag: 'action_survival',         meaning: 'implicit failure acknowledgment — farewell phrasing' }],
  ['(it (has|hasn.?t) been easy|not been easy)',
    { signal_class: 'distress_signal',           base_certainty: 0.78, action_tag: 'action_survival',         meaning: 'struggle acknowledgment — difficulty admitted' }],
  ['the honest truth (is|about)',
    { signal_class: 'distress_signal',           base_certainty: 0.75, action_tag: 'action_survival',         meaning: 'transparency opener — often precedes hard news' }],
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
  aggressively:    { weight: +0.30, tag: 'intensity_aggressive'   },
  dramatically:    { weight: +0.25, tag: 'intensity_dramatic'     },
  rapidly:         { weight: +0.25, tag: 'intensity_rapid'        },
  massively:       { weight: +0.25, tag: 'intensity_massive'      },
  explosively:     { weight: +0.30, tag: 'intensity_explosive'    },
  exponentially:   { weight: +0.28, tag: 'intensity_exponential'  },
  significantly:   { weight: +0.20, tag: 'intensity_significant'  },
  heavily:         { weight: +0.20, tag: 'intensity_heavy'        },
  substantially:   { weight: +0.20, tag: 'intensity_substantial'  },
  strongly:        { weight: +0.20, tag: 'intensity_strong'       },
  boldly:          { weight: +0.20, tag: 'intensity_bold'         },
  deeply:          { weight: +0.15, tag: 'intensity_deep'         },
  actively:        { weight: +0.15, tag: 'intensity_active'       },
  increasingly:    { weight: +0.15, tag: 'intensity_growing'      },
  urgently:        { weight: +0.20, tag: 'intensity_urgent'       },
  relentlessly:    { weight: +0.25, tag: 'intensity_relentless'   },
  ruthlessly:      { weight: +0.22, tag: 'intensity_ruthless'     },
  ferociously:     { weight: +0.22, tag: 'intensity_ferocious'    },
  fiercely:        { weight: +0.20, tag: 'intensity_fierce'       },
  passionately:    { weight: +0.15, tag: 'intensity_passionate'   },
  obsessively:     { weight: +0.18, tag: 'intensity_obsessive'    },
  overnight:       { weight: +0.20, tag: 'intensity_sudden'       },
  instantly:       { weight: +0.18, tag: 'intensity_instant'      },
  immediately:     { weight: +0.15, tag: 'intensity_immediate'    },
  // Emotional amplifiers (founder voice)
  incredibly:      { weight: +0.18, tag: 'intensity_emotional_high' },
  absolutely:      { weight: +0.15, tag: 'intensity_emotional_high' },
  truly:           { weight: +0.12, tag: 'intensity_emotional_high' },
  genuinely:       { weight: +0.12, tag: 'intensity_genuine'      },
  // Dampeners (cautious / measured language)
  selectively:     { weight: -0.10, tag: 'intensity_selective'    },
  carefully:       { weight: -0.15, tag: 'intensity_careful'      },
  cautiously:      { weight: -0.20, tag: 'intensity_cautious'     },
  quietly:         { weight: -0.20, tag: 'intensity_quiet'        },
  slowly:          { weight: -0.20, tag: 'intensity_slow'         },
  narrowly:        { weight: -0.25, tag: 'intensity_narrow'       },
  prudently:       { weight: -0.15, tag: 'intensity_prudent'      },
  deliberately:    { weight: -0.15, tag: 'intensity_deliberate'   },
  methodically:    { weight: -0.10, tag: 'intensity_methodical'   },
  conservatively:  { weight: -0.20, tag: 'intensity_conservative' },
  modestly:        { weight: -0.15, tag: 'intensity_modest'       },
  reluctantly:     { weight: -0.18, tag: 'intensity_reluctant'    },
  unfortunately:   { weight: -0.25, tag: 'intensity_unfortunate'  },
  hesitantly:      { weight: -0.20, tag: 'intensity_hesitant'     },
};

// ─── POSTURE MAP ──────────────────────────────────────────────────────────────
// Strategic posture — HOW they are framing the move (not WHAT they are doing)
// Also encodes emotional tone and behavioral cues from founder/operator language.
const POSTURE_MAP = [
  // ── Confidence / hypergrowth ──────────────────────────────────────────────
  [/\b(aggressiv(e|ely)|bold(ly)?|ambitious(ly)?|excited? (about|to)|doubling down|thrilled|very bullish|leaning in)\b/i,
    { posture: 'posture_confident',       meaning: 'high conviction, positive momentum' }],
  // ── Euphoric / peak excitement (social-media intensity) ──────────────────
  [/\b(absolutely (pumped|stoked|fired up|thrilled)|couldn.?t be more (excited|proud)|over the moon|blown away|on cloud nine|pinch me moment)\b/i,
    { posture: 'posture_euphoric',        meaning: 'peak excitement — often marks major milestone announcement' }],
  // ── Disciplined / controlled growth ──────────────────────────────────────
  [/\b(disciplined|selective(ly)?|capital.?efficient|measured|deliberate(ly)?|rigorous(ly)?|focused|prudent(ly)?|methodical(ly)?)\b/i,
    { posture: 'posture_disciplined',     meaning: 'controlled growth, efficiency-minded' }],
  // ── Urgent ────────────────────────────────────────────────────────────────
  [/\b(urgent(ly)?|immediately?|as soon as (possible)?|critical|must.?have|need to (act|move) now|right away|time.?sensitive)\b/i,
    { posture: 'posture_urgent',          meaning: 'time-sensitive, high urgency' }],
  // ── Distressed ────────────────────────────────────────────────────────────
  [/\b(forced to|unfortunately|difficult (period|time|environment)|challenging (times?|conditions?|environment)|under (pressure|strain|stress)|survival mode)\b/i,
    { posture: 'posture_distressed',      meaning: 'under pressure / distress language' }],
  // ── Frustrated / resigned ─────────────────────────────────────────────────
  [/\b(frustrated (with|by|at)|fed up (with)?|it.?s (been )?exhausting|this is (really )?hard|can.?t keep (doing|going)|burned out|at our limit)\b/i,
    { posture: 'posture_frustrated',      meaning: 'frustration or resignation — often precedes pivot or departure' }],
  // ── Defensive ─────────────────────────────────────────────────────────────
  [/\b(despite|even (though|as)|hold(ing)? (steady|firm)|not (affected|impacted)|weathering|resilient|bucking (the )?trend)\b/i,
    { posture: 'posture_defensive',       meaning: 'defending position, resilience framing' }],
  // ── Combative / competitive ───────────────────────────────────────────────
  [/\b(taking (on|down)|going head.?to.?head|competing (directly|hard)|fight(ing)? for|not backing down|outcompet(ing|e)|win(ning)? the market)\b/i,
    { posture: 'posture_combative',       meaning: 'competitive aggression — attacking incumbents or rivals' }],
  // ── Cautiously optimistic ─────────────────────────────────────────────────
  [/\b(cautiously optimistic|guardedly positive|hopeful but|encouraged by|promising (signs|signals|early results)|early signs (are|look))\b/i,
    { posture: 'posture_cautious_optimism', meaning: 'hedged positive — optimism with caveats' }],
  // ── Curious / experimental ────────────────────────────────────────────────
  [/\b(experimenting (with|on)|testing (out|new)|learning (a lot|fast|quickly)|iterating (quickly|fast|on)|trying (out|a new))\b/i,
    { posture: 'posture_experimental',    meaning: 'experimentation posture — early discovery or pivoting' }],
  // ── Speed / bias for action ───────────────────────────────────────────────
  [/\b(moving (fast|quickly|at speed|at pace)|bias (for|toward) action|ship(ping)? fast|execution speed|(first|fast) mover)\b/i,
    { posture: 'posture_speed',           meaning: 'speed bias — high-tempo execution culture' }],
  // ── Grateful / humble (often precedes fundraise or milestone) ────────────
  [/\b(humbled (by|to)|grateful (for|to)|so (thankful|appreciative)|couldn.?t have done it without|blessed to|honored to)\b/i,
    { posture: 'posture_grateful',        meaning: 'gratitude posture — often accompanies fundraise or major milestone' }],
  // ── Ambiguous / hedging ───────────────────────────────────────────────────
  [/\b(it depends|time will tell|remains? to be seen|uncertain|unclear|not yet decided|to be determined|tbd|watching closely)\b/i,
    { posture: 'posture_ambiguous',       meaning: 'hedging / uncertainty' }],
  // ── Reflective (end-of-cycle or milestone) ────────────────────────────────
  [/\b(proud of what (we |they )?(built|created|accomplished)|look(ing)? back|grateful|incredible journey|what a (ride|journey|chapter))\b/i,
    { posture: 'posture_reflective',      meaning: 'milestone or possible plateau / wind-down language' }],
  // ── Transparent / vulnerable ──────────────────────────────────────────────
  [/\b(being (honest|transparent|real|candid|vulnerable)|the (honest|real|hard) truth|let.?s be (honest|real|transparent)|i.?ll be honest)\b/i,
    { posture: 'posture_transparent',     meaning: 'vulnerability or honesty signal — often precedes difficult news' }],
  // ── Mission-driven / values language ─────────────────────────────────────
  [/\b(mission.?driven|purpose.?driven|impact.?first|doing (well|good) (and|by) doing (good|right)|values.?aligned|not (just )?for profit)\b/i,
    { posture: 'posture_mission',         meaning: 'mission or purpose framing — values-aligned narrative' }],
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
  // ── Sectors ───────────────────────────────────────────────────────────────
  fintech:                    ['context_sector_fintech'],
  'financial technology':     ['context_sector_fintech'],
  'payments':                 ['context_sector_fintech'],
  insurtech:                  ['context_sector_fintech'],
  'wealth management':        ['context_sector_fintech'],
  wealthtech:                 ['context_sector_fintech'],
  healthtech:                 ['context_sector_healthcare'],
  healthcare:                 ['context_sector_healthcare'],
  'health tech':              ['context_sector_healthcare'],
  medtech:                    ['context_sector_healthcare'],
  'digital health':           ['context_sector_healthcare'],
  telehealth:                 ['context_sector_healthcare'],
  biotech:                    ['context_sector_biotech'],
  'life sciences':            ['context_sector_biotech'],
  biopharma:                  ['context_sector_biotech'],
  genomics:                   ['context_sector_biotech'],
  'drug discovery':           ['context_sector_biotech'],
  'artificial intelligence':  ['context_sector_ai'],
  'machine learning':         ['context_sector_ai'],
  'generative ai':            ['context_sector_ai'],
  'large language model':     ['context_sector_ai'],
  llm:                        ['context_sector_ai'],
  'foundation model':         ['context_sector_ai'],
  ai:                         ['context_sector_ai'],
  robotics:                   ['context_sector_robotics'],
  automation:                 ['context_sector_robotics'],
  autonomous:                 ['context_sector_autonomous'],
  'self-driving':             ['context_sector_autonomous'],
  'deep tech':                ['context_sector_deeptech'],
  deeptech:                   ['context_sector_deeptech'],
  quantum:                    ['context_sector_deeptech'],
  semiconductor:              ['context_sector_deeptech'],
  climate:                    ['context_sector_climate'],
  cleantech:                  ['context_sector_climate'],
  'climate tech':             ['context_sector_climate'],
  'renewable energy':         ['context_sector_climate'],
  'carbon capture':           ['context_sector_climate'],
  'clean energy':             ['context_sector_climate'],
  edtech:                     ['context_sector_edtech'],
  education:                  ['context_sector_edtech'],
  'learning platform':        ['context_sector_edtech'],
  logistics:                  ['context_sector_logistics'],
  'supply chain':             ['context_sector_logistics'],
  'freight tech':             ['context_sector_logistics'],
  'last mile':                ['context_sector_logistics'],
  crypto:                     ['context_sector_crypto'],
  blockchain:                 ['context_sector_crypto'],
  defi:                       ['context_sector_crypto'],
  web3:                       ['context_sector_crypto'],
  nft:                        ['context_sector_crypto'],
  cybersecurity:              ['context_sector_security'],
  security:                   ['context_sector_security'],
  'zero trust':               ['context_sector_security'],
  defense:                    ['context_sector_defense'],
  'dual use':                 ['context_sector_defense'],
  proptech:                   ['context_sector_proptech'],
  'real estate':              ['context_sector_proptech'],
  legaltech:                  ['context_sector_legal'],
  hrtech:                     ['context_sector_hr'],
  'future of work':           ['context_sector_hr'],
  'hr tech':                  ['context_sector_hr'],
  agritech:                   ['context_sector_agri'],
  agriculture:                ['context_sector_agri'],
  foodtech:                   ['context_sector_food'],
  'food tech':                ['context_sector_food'],
  ecommerce:                  ['context_sector_ecommerce'],
  'e-commerce':               ['context_sector_ecommerce'],
  retail:                     ['context_sector_ecommerce'],
  'martech':                  ['context_sector_martech'],
  adtech:                     ['context_sector_martech'],
  analytics:                  ['context_sector_data'],
  'data platform':            ['context_sector_data'],
  'data infrastructure':      ['context_sector_data'],
  mobility:                   ['context_sector_mobility'],
  transportation:             ['context_sector_mobility'],
  space:                      ['context_sector_space'],
  'space tech':               ['context_sector_space'],
  aerospace:                  ['context_sector_space'],
  // ── Product type ─────────────────────────────────────────────────────────
  saas:                       ['context_product_saas'],
  'open source':              ['context_product_open_source'],
  infrastructure:             ['context_product_infrastructure'],
  'developer tools':          ['context_company_developer_tools'],
  devtools:                   ['context_company_developer_tools'],
  'developer platform':       ['context_company_developer_tools'],
  api:                        ['context_product_api'],
  platform:                   ['context_product_platform'],
  marketplace:                ['context_product_marketplace'],
  // ── Company type ─────────────────────────────────────────────────────────
  enterprise:                 ['context_company_enterprise'],
  'mid-market':               ['context_company_midmarket'],
  smb:                        ['context_company_smb'],
  b2b:                        ['context_company_b2b'],
  b2c:                        ['context_company_b2c'],
  consumer:                   ['context_company_b2c'],
  // ── Geographies ──────────────────────────────────────────────────────────
  europe:                     ['context_geo_europe'],
  european:                   ['context_geo_europe'],
  uk:                         ['context_geo_uk'],
  'united kingdom':           ['context_geo_uk'],
  germany:                    ['context_geo_europe'],
  france:                     ['context_geo_europe'],
  netherlands:                ['context_geo_europe'],
  emea:                       ['context_geo_emea'],
  'united states':            ['context_geo_us'],
  'north america':            ['context_geo_north_america'],
  canada:                     ['context_geo_north_america'],
  apac:                       ['context_geo_apac'],
  asia:                       ['context_geo_apac'],
  india:                      ['context_geo_india'],
  singapore:                  ['context_geo_sea'],
  indonesia:                  ['context_geo_sea'],
  southeast:                  ['context_geo_sea'],
  'middle east':              ['context_geo_mena'],
  mena:                       ['context_geo_mena'],
  dubai:                      ['context_geo_mena'],
  israel:                     ['context_geo_mena'],
  'latin america':            ['context_geo_latam'],
  latam:                      ['context_geo_latam'],
  brazil:                     ['context_geo_latam'],
  africa:                     ['context_geo_africa'],
  nigeria:                    ['context_geo_africa'],
  'south africa':             ['context_geo_africa'],
  kenya:                      ['context_geo_africa'],
  // ── Stage ────────────────────────────────────────────────────────────────
  'pre-seed':                 ['context_stage_pre_seed'],
  preseed:                    ['context_stage_pre_seed'],
  seed:                       ['context_stage_seed'],
  'series a':                 ['context_stage_series_a'],
  'series b':                 ['context_stage_series_b'],
  'series c':                 ['context_stage_series_c'],
  'series d':                 ['context_stage_series_d'],
  'late stage':               ['context_stage_growth'],
  growth:                     ['context_stage_growth'],
  'growth stage':             ['context_stage_growth'],
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
// Priority order: highest-confidence, most-specific signal class wins when multiple patterns match.
// exploratory_signal sits ABOVE fundraising_signal so that modal-past patterns
// ("had planned to raise", "had intended to hire") are never overridden by generic raise/hire patterns.
const SIGNAL_CLASS_PRIORITY = [
  'acquisition_signal',
  'exit_signal',
  'distress_signal',
  'exploratory_signal',       // modal-past / deferred intent — must outrank active counterparts
  'fundraising_signal',
  'revenue_signal',
  'buyer_budget_signal',
  'buyer_signal',
  'buyer_pain_signal',
  'investor_interest_signal',
  'investor_rejection_signal',
  'regulatory_signal',
  'market_position_signal',
  'product_signal',
  'hiring_signal',
  'enterprise_signal',
  'expansion_signal',
  'gtm_signal',
  'demand_signal',
  'growth_signal',
  'partnership_signal',
  'efficiency_signal',
  'infrastructure_signal',
];

// ─── WHO CARES MAP ────────────────────────────────────────────────────────────
// For each signal class, which audience cares?
// Used by the matching engine and the Signal Feed UI filters.
const WHO_CARES_MAP = {
  fundraising_signal:        { investors: true,  vendors: false, acquirers: false, recruiters: false, partners: false },
  acquisition_signal:        { investors: true,  vendors: false, acquirers: true,  recruiters: false, partners: false },
  exit_signal:               { investors: true,  vendors: false, acquirers: true,  recruiters: false, partners: false },
  distress_signal:           { investors: true,  vendors: false, acquirers: true,  recruiters: false, partners: false },
  revenue_signal:            { investors: true,  vendors: true,  acquirers: true,  recruiters: false, partners: true  },
  buyer_budget_signal:       { investors: false, vendors: true,  acquirers: false, recruiters: false, partners: true  },
  buyer_signal:              { investors: false, vendors: true,  acquirers: false, recruiters: false, partners: true  },
  buyer_pain_signal:         { investors: false, vendors: true,  acquirers: false, recruiters: false, partners: true  },
  investor_interest_signal:  { investors: true,  vendors: false, acquirers: false, recruiters: false, partners: false },
  investor_rejection_signal: { investors: true,  vendors: false, acquirers: false, recruiters: false, partners: false },
  regulatory_signal:         { investors: true,  vendors: true,  acquirers: true,  recruiters: false, partners: true  },
  market_position_signal:    { investors: true,  vendors: true,  acquirers: true,  recruiters: false, partners: true  },
  product_signal:            { investors: true,  vendors: true,  acquirers: false, recruiters: false, partners: true  },
  hiring_signal:             { investors: true,  vendors: true,  acquirers: false, recruiters: true,  partners: false },
  enterprise_signal:         { investors: true,  vendors: true,  acquirers: false, recruiters: false, partners: true  },
  expansion_signal:          { investors: true,  vendors: true,  acquirers: false, recruiters: false, partners: true  },
  gtm_signal:                { investors: true,  vendors: true,  acquirers: false, recruiters: true,  partners: true  },
  demand_signal:             { investors: true,  vendors: true,  acquirers: false, recruiters: false, partners: false },
  growth_signal:             { investors: true,  vendors: true,  acquirers: false, recruiters: false, partners: false },
  partnership_signal:        { investors: false, vendors: true,  acquirers: false, recruiters: false, partners: true  },
  efficiency_signal:         { investors: true,  vendors: false, acquirers: true,  recruiters: false, partners: false },
  infrastructure_signal:     { investors: false, vendors: true,  acquirers: false, recruiters: false, partners: true  },
  exploratory_signal:        { investors: false, vendors: true,  acquirers: false, recruiters: false, partners: false },
  unclassified_signal:       { investors: false, vendors: false, acquirers: false, recruiters: false, partners: false },
};

// ─── SIGNAL TYPE MAP ─────────────────────────────────────────────────────────
// What TYPE of signal is this? Tells you if it's an intent, event, posture, etc.
// Type: intent | event | posture | demand | distress | investor | buyer | talent | infrastructure | market
const SIGNAL_TYPE_MAP = {
  fundraising_signal:        'event',
  acquisition_signal:        'event',
  exit_signal:               'intent',
  distress_signal:           'posture',
  revenue_signal:            'event',
  buyer_budget_signal:       'intent',
  buyer_signal:              'intent',
  buyer_pain_signal:         'demand',
  investor_interest_signal:  'investor',
  investor_rejection_signal: 'investor',
  regulatory_signal:         'event',
  market_position_signal:    'event',
  product_signal:            'event',
  hiring_signal:             'talent',
  enterprise_signal:         'intent',
  expansion_signal:          'intent',
  gtm_signal:                'intent',
  demand_signal:             'demand',
  growth_signal:             'event',
  partnership_signal:        'event',
  efficiency_signal:         'posture',
  infrastructure_signal:     'infrastructure',
  exploratory_signal:        'intent',
  unclassified_signal:       'unknown',
};

// ─── INFERENCE MAP ────────────────────────────────────────────────────────────
// Strategic inference from signal class.
// What does this signal MEAN at the company level?
// Maps signal_class → { likely_stage, likely_need[], likely_budget, urgency, strategic_direction }
const INFERENCE_MAP = {
  fundraising_signal: {
    likely_stage:        'seed–series_b',
    likely_need:         ['legal', 'accounting', 'cap_table_management', 'CRM', 'investor_relations'],
    likely_budget:       'medium',
    urgency:             'high',
    strategic_direction: 'growth',
  },
  acquisition_signal: {
    likely_stage:        'growth–late',
    likely_need:         ['M&A_advisory', 'legal', 'integration_tools', 'HR'],
    likely_budget:       'high',
    urgency:             'high',
    strategic_direction: 'consolidation',
  },
  exit_signal: {
    likely_stage:        'late–exit',
    likely_need:         ['M&A_advisory', 'legal', 'accounting', 'investor_relations'],
    likely_budget:       'high',
    urgency:             'high',
    strategic_direction: 'exit_prep',
  },
  distress_signal: {
    likely_stage:        'any',
    likely_need:         ['turnaround_advisory', 'restructuring', 'debt_financing', 'cost_reduction_tools'],
    likely_budget:       'low',
    urgency:             'critical',
    strategic_direction: 'survival',
  },
  revenue_signal: {
    likely_stage:        'series_a–growth',
    likely_need:         ['CRM', 'revenue_ops', 'finance_tools', 'analytics'],
    likely_budget:       'medium–high',
    urgency:             'medium',
    strategic_direction: 'scale',
  },
  buyer_budget_signal: {
    likely_stage:        'corporate',
    likely_need:         ['software', 'automation', 'implementation_partner'],
    likely_budget:       'approved',
    urgency:             'high',
    strategic_direction: 'procurement',
  },
  buyer_signal: {
    likely_stage:        'corporate',
    likely_need:         ['software', 'vendor', 'platform', 'implementation'],
    likely_budget:       'medium–high',
    urgency:             'medium–high',
    strategic_direction: 'technology_adoption',
  },
  buyer_pain_signal: {
    likely_stage:        'corporate',
    likely_need:         ['automation', 'robotics', 'software', 'analytics', 'AI'],
    likely_budget:       'medium–high',
    urgency:             'high',
    strategic_direction: 'pain_driven_purchase',
  },
  investor_interest_signal: {
    likely_stage:        'any',
    likely_need:         ['pitch_deck_tools', 'data_room', 'CRM'],
    likely_budget:       'low',
    urgency:             'medium',
    strategic_direction: 'fundraising',
  },
  investor_rejection_signal: {
    likely_stage:        'any',
    likely_need:         [],
    likely_budget:       'n/a',
    urgency:             'low',
    strategic_direction: 'continue_fundraising',
  },
  regulatory_signal: {
    likely_stage:        'series_a–growth',
    likely_need:         ['compliance_tools', 'legal', 'QA', 'regulatory_consultant'],
    likely_budget:       'medium',
    urgency:             'medium',
    strategic_direction: 'compliance_milestone',
  },
  market_position_signal: {
    likely_stage:        'series_a–growth',
    likely_need:         ['PR', 'marketing', 'analyst_relations', 'branding'],
    likely_budget:       'medium',
    urgency:             'low',
    strategic_direction: 'market_building',
  },
  product_signal: {
    likely_stage:        'seed–series_b',
    likely_need:         ['developer_tools', 'cloud_infrastructure', 'QA', 'analytics', 'user_research'],
    likely_budget:       'medium',
    urgency:             'medium',
    strategic_direction: 'product_launch',
  },
  hiring_signal: {
    likely_stage:        'seed–series_b',
    likely_need:         ['HR_tools', 'ATS', 'payroll', 'recruiter', 'benefits', 'equity_management'],
    likely_budget:       'medium',
    urgency:             'high',
    strategic_direction: 'team_growth',
  },
  enterprise_signal: {
    likely_stage:        'series_a–series_b',
    likely_need:         ['CRM', 'sales_tools', 'security_compliance', 'enterprise_support'],
    likely_budget:       'medium–high',
    urgency:             'high',
    strategic_direction: 'enterprise_push',
  },
  expansion_signal: {
    likely_stage:        'series_a–growth',
    likely_need:         ['localization', 'legal', 'HR', 'office_space', 'regional_marketing'],
    likely_budget:       'medium–high',
    urgency:             'medium',
    strategic_direction: 'geographic_expansion',
  },
  gtm_signal: {
    likely_stage:        'series_a–series_b',
    likely_need:         ['CRM', 'sales_tools', 'marketing_automation', 'lead_gen', 'sales_training'],
    likely_budget:       'medium',
    urgency:             'high',
    strategic_direction: 'go_to_market',
  },
  demand_signal: {
    likely_stage:        'seed–series_a',
    likely_need:         ['infrastructure', 'cloud', 'support_tools', 'operations'],
    likely_budget:       'medium',
    urgency:             'high',
    strategic_direction: 'demand_capture',
  },
  growth_signal: {
    likely_stage:        'seed–series_b',
    likely_need:         ['analytics', 'marketing', 'infrastructure', 'operations'],
    likely_budget:       'medium',
    urgency:             'medium',
    strategic_direction: 'growth',
  },
  partnership_signal: {
    likely_stage:        'series_a–growth',
    likely_need:         ['legal', 'integration_tools', 'partner_portal'],
    likely_budget:       'low–medium',
    urgency:             'medium',
    strategic_direction: 'ecosystem_building',
  },
  efficiency_signal: {
    likely_stage:        'series_b–growth',
    likely_need:         ['finance_tools', 'operations_software', 'analytics', 'cost_management'],
    likely_budget:       'medium',
    urgency:             'medium',
    strategic_direction: 'efficiency_focus',
  },
  exploratory_signal: {
    likely_stage:        'any',
    likely_need:         [],
    likely_budget:       'unknown',
    urgency:             'low',
    strategic_direction: 'exploration',
  },
  unclassified_signal: {
    likely_stage:        'unknown',
    likely_need:         [],
    likely_budget:       'unknown',
    urgency:             'unknown',
    strategic_direction: 'unknown',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AMBIGUITY LAYER — Version 1
//
// Core principle: Pythh should almost never force a sentence into a single hard
// meaning when the language is weak, mixed, hedged, promotional, or incomplete.
// Every output includes a primary interpretation, alternates, confidence, and
// ambiguity flags. The system thinks "probably X, might be Y, 0.54 confident."
// ═══════════════════════════════════════════════════════════════════════════════

// ─── NEGATION PATTERNS ────────────────────────────────────────────────────────
// Negation window around key signal verbs. When these fire, the signal should
// be suppressed, inverted to a reversal_signal, or flagged negated_signal.
// "not hiring" ≠ hiring signal. "no longer raising" may be a slowdown signal.
const NEGATION_PATTERNS = [
  // Explicit not + action (optional adverb between negation and verb: "definitely not considering")
  /\b(not|never|no longer|aren.?t|don.?t|won.?t|can.?t|isn.?t|didn.?t)\s+(\w+\s+){0,2}(currently\s+)?(hiring|raising|fundraising|expanding|launching|acquiring|growing|scaling|recruiting|building|considering|pursuing|planning|exploring)\b/i,
  // "no plans to" constructions
  /\bno (plans?|intention|interest|timeline) (to|for|of)\s+(hiring|raising|expanding|launching|acquiring)\b/i,
  // Passive/formal negations
  /\b(ruled out|off the table|shelved|not pursuing|no longer pursuing|abandoned|terminated|cancelled|paused)\b/i,
  // "not actively" softeners
  /\bnot (actively|currently|yet)\s+(hiring|raising|fundraising|expanding|looking)\b/i,
  // "we have no" constructions
  /\bwe (have no|see no|found no) (plans?|intention|need) (to|for)\b/i,
  // Explicit denial of specific signals
  /\b(we are not|this is not|that is not|it is not) (a )?(sale|selling|fundraising|fundraise|an acquisition|acquisition|hiring spree|round)\b/i,
  // Temporal cancellation — future intent cancelled
  /\b(no longer (plan(ning)?|intend(ing)?|consider(ing)?|pursu(ing)?)) (to )?(raise|launch|expand|hire|acquire|build)\b/i,
  // Suspension language — "put [something] on hold"
  /\bputt?ing? .{0,40} (on hold|on pause|on ice)\b/i,
  /\bput .{0,40} (on hold|on pause|on ice)\b/i,
  /\bindefinitely (postponed|delayed|suspended)\b/i,
];

// ─── DOUBLE NEGATIVE PATTERNS ─────────────────────────────────────────────
// Double negatives are NOT negations — they confirm the positive but weakly.
// "not without challenges" = HAS challenges (distress, low confidence).
// "not entirely unsuccessful" = some success (growth, dampened confidence).
// "not unconvincing" = somewhat convincing (investor interest, hedged).
// These should: set is_ambiguous=true, dampen confidence by 0.20–0.30, keep signal.
const DOUBLE_NEGATIVE_PATTERNS = [
  // "not without X" — covers "not without", "not been without", "not gone without"
  /\bnot (\w+ ){0,3}without (its |their |the )?(challenges?|difficulties|difficulty|problems?|issues?|struggles?|setbacks?)\b/i,
  // "not entirely unsuccessful/unprofitable" — weakly positive
  /\bnot (entirely|completely|wholly|exactly) (un)(successful|profitable|promis(ing)?|convincing|interesting|impres+ive)\b/i,
  // "can't say we're not X" — confirming X indirectly
  /\bcan.?t (say|deny|claim) (we.?re|it.?s|they.?re|this is) not\b/i,
  // "it's not like we're not X" — informal double negative
  /\bit.?s not (like|as if|as though) (we.?re|they.?re) not\b/i,
  // "not a bad X" — weak positive
  /\bnot (a |an )?(bad|terrible|poor|weak) (result|quarter|outcome|performance|number)\b/i,
];

// ─── HEDGING VOCABULARY ───────────────────────────────────────────────────────
// Words and phrases that weaken modality. When found near action verbs,
// they shift signal type from event → intent and lower confidence.
// "we launched" ≠ "we may launch" — this distinction is critical.
const HEDGING_VOCAB = [
  'may', 'might', 'could', 'possibly', 'perhaps', 'potentially',
  'considering', 'thinking about', 'thinking of', 'exploring',
  'evaluating', 'looking at', 'looking into', 'if all goes well',
  'eventually', 'at some point', 'when the time is right',
  'subject to', 'pending', 'not sure', 'unsure', 'undecided',
  'to be determined', 'tbd', 'open to', 'if opportunity arises',
  'would like to', 'hope to', 'aspire to', 'aim to eventually',
  'down the road', 'in the future someday', 'depending on',
  'contingent on', 'if everything goes according to plan',
];

// ─── PROMOTIONAL / FLUFF PHRASES ──────────────────────────────────────────────
// Generic excitement with no operational meaning. High ambiguity, low signal.
// These should produce posture_only_signal or be downranked unless supported
// by real actions nearby. "Big things coming" alone ≠ useful signal.
const PROMOTIONAL_PHRASES = [
  'big things coming', 'exciting times ahead', 'incredible journey',
  'transforming the industry', 'huge momentum', 'changing the game',
  'disrupting the space', 'revolutionizing', 'excited about the future',
  'building the future', 'incredible team', 'best is yet to come',
  'just getting started', 'the future is bright', 'watch this space',
  'stay tuned', 'more to come', 'groundbreaking', 'game-changing',
  'world-class team', 'best-in-class', 'world class', 'next level',
  'amazing things', 'thrilled to share', 'humbled by', 'blessed to',
  'beyond excited', 'super excited', 'incredibly excited',
  'so grateful', 'incredible milestone', 'proud to announce',
];

// ─── BOILERPLATE CONTENT PHRASES ─────────────────────────────────────────────
// Evergreen marketing copy that generates fake hiring/growth signals.
// "We're always looking for great people" is NOT a hiring event.
const BOILERPLATE_PHRASES = [
  "we're always looking for great people",
  "we are always looking for exceptional",
  "always looking for talented",
  "join our mission",
  "join us on our mission",
  "we are building the future",
  "passionate about our mission",
  "we believe in",
  "our culture is",
  "we value diversity",
  "we are committed to",
  "committed to our mission",
  "driven by our values",
  "our people are our",
  "if you're passionate about",
  "love what you do",
  "do your best work",
  "make an impact",
  "make a difference",
];

// ─── REPORTED SPEECH PATTERNS ─────────────────────────────────────────────────
// Second-hand attribution — someone else is making the claim, not the company.
// Reduces certainty. attribution_type = 'reported'.
// Press release from company = direct. Journalist quoting = reported.
const REPORTED_SPEECH_PATTERNS = [
  /\b(said|says|stated|noted|mentioned|commented|revealed|disclosed)\s+that\b/i,
  /\b(according to|per|as per|as stated by|as noted by)\b/i,
  /\bthe\s+(ceo|founder|cto|coo|spokesperson|company|firm|startup)\s+(said|says|noted|revealed|told|shared)\b/i,
  /\b(told|speaking to|in an interview with|in a statement to|in a filing)\b/i,
  /\b(claims?|alleged(ly)?|purportedly|reportedly|believed to)\b/i,
];

// ─── RUMOR PATTERNS ───────────────────────────────────────────────────────────
// Speculative journalism or second-hand chatter. High ambiguity.
// evidence_quality = 'speculative'. requires_corroboration = true.
const RUMOR_PATTERNS = [
  /\b(sources|insiders?|people familiar with the matter|sources close to)\s+(indicate|suggest|say|believe|report|claim)\b/i,
  /\b(is said to be|reportedly|rumored to|is rumored|market chatter|speculation suggests)\b/i,
  /\b(we hear|we understand that|we.?re told|word is that)\b/i,
  /\b(could be|might be)\s+(preparing|planning|considering|looking at|exploring|in talks)\b/i,
  /\b(in talks|in discussions?) (with|about|to|regarding)\b/i,
  /\b(anonymous source|source familiar|person with knowledge)\b/i,
];

// ─── AMBIGUITY FLAG TAXONOMY ─────────────────────────────────────────────────
// Finite, ordered list of ambiguity flags. Used in output and UI display.
const AMBIGUITY_FLAGS = Object.freeze([
  'hedged_language',          // may, might, considering, exploring
  'vague_object',             // action present but target unknown
  'unclear_actor',            // who is acting is not specified
  'missing_time',             // no temporal reference
  'promotional_only',         // PR fluff with no operational action
  'multi_signal_sentence',    // 3+ distinct signal classes in one sentence
  'conflicting_signals',      // opposing signals in tension
  'negated_signal',           // action was explicitly negated
  'reported_speech',          // second-hand attribution
  'rumor_language',           // anonymous or speculative sourcing
  'industry_term_ambiguous',  // word has sector-specific meaning
  'boilerplate_content',      // evergreen marketing copy
  'insufficient_context',     // sentence cannot be interpreted alone
]);

// ─── EVIDENCE QUALITY TIERS ───────────────────────────────────────────────────
// Maps signal output to one of three user-facing confidence tiers.
// Drives UI display: confirmed (green) / inferred (amber) / speculative (gray)
const EVIDENCE_QUALITY = Object.freeze({
  CONFIRMED:    'confirmed',    // Direct, explicit, high certainty
  INFERRED:     'inferred',     // Reasonable interpretation with support
  SPECULATIVE:  'speculative',  // Weak, hedged, or insufficiently supported
  NEGATED:      'negated',      // Signal was explicitly denied
  LOW_INFO:     'low-information', // Promotional/boilerplate — no real signal
});

// ─── CONFLICTING SIGNAL PAIRS ─────────────────────────────────────────────────
// Pairs of signal classes that represent genuine tension.
// "reducing burn but aggressively hiring sales" = real strategic pattern.
// Do not collapse contradiction — preserve it. signal_tension = true.
const CONFLICT_PAIRS = [
  ['distress_signal',   'hiring_signal'],
  ['distress_signal',   'expansion_signal'],
  ['distress_signal',   'growth_signal'],
  ['distress_signal',   'gtm_signal'],
  ['efficiency_signal', 'hiring_signal'],
  ['efficiency_signal', 'expansion_signal'],
  ['fundraising_signal','distress_signal'],
  ['exit_signal',       'hiring_signal'],
  ['exit_signal',       'expansion_signal'],
];

// ─── COSTLY ACTIONS (Rule Category — Confidence Upgrade) ─────────────────────
// When a company does something that costs real money or real commitment,
// the signal confidence gets a +0.15 bonus. Companies don't casually spend.
// "Opening an office" is a $1M commitment. "Issuing an RFP" means budget is approved.
// Matched against the full sentence text.
const COSTLY_ACTIONS = [
  // Named / leadership hiring
  /\bhiring (a |for (the )?)?(new |senior |first )?(head of|vp of|director of|chief|ceo|cto|coo|cpo|cmo)\b/i,
  // Physical location
  /\bopening (a |an |the |our )?(new )?(office|location|hub|headquarters|hq|facility|site|warehouse|plant)\b/i,
  // Active pilot or POC (real budget)
  /\b(running|doing|conducting|completing|launching|starting) (a |an )?(pilot|poc|proof of concept|trial deployment|live trial)\b/i,
  // Formal procurement
  /\b(issuing|releasing?|posting|launching) (an? )?(rfp|rfq|request for proposal|request for quotation|tender)\b/i,
  // Data room — investor seriousness
  /\b(requesting?|sending?|accessing?|granting access to|open(ing|ed)?) (the |a )?data.?room\b/i,
  // Equipment / hardware purchase
  /\b(purchasing|procuring|buying|ordering|deploying|installing) (equipment|machinery|hardware|infrastructure|robots?|servers?|systems?)\b/i,
  // Production / manufacturing ramp
  /\b(expanding|ramping up|scaling up) (manufacturing|production|capacity|facilities|output|throughput)\b/i,
  // System migration (real cost, real commitment)
  /\b(migrating|moving|transitioning|switching) (from|off|away from) (legacy|old|existing|current|outdated) (systems?|platform|software|infrastructure|erp|crm)\b/i,
  // Enterprise-wide deployment
  /\b(rolling out|deploying?) (across|to|company.?wide|enterprise.?wide|all (sites|locations|offices|regions))\b/i,
  // Signed contract / deal
  /\b(signed?|signing|executed?) (a |an? )?(new |multi.?year|long.?term|major |enterprise |strategic )?(deal|contract|agreement|partnership)\b/i,
  // Executive advisor / banker engaged (exit signal strength)
  /\b(engaged?|retained?|hired?|working with) (an? )?(investment banker|advisor|m&a advisor|financial advisor)\b/i,
];

// ─── SOURCE RELIABILITY MAP (Rule Category G) ─────────────────────────────────
// Maps source_type → reliability score [0.0–1.0].
// When source_type is known, this is blended with linguistic source detection
// to produce a more accurate confidence score.
// Pass source_type as options.source_type to parseSignal().
const SOURCE_RELIABILITY = {
  // ── External structured / legal sources ─────────────────────────────────
  sec_filing:          1.00,   // SEC filing — must be true
  earnings_call:       0.95,   // Official earnings call — highly reliable
  press_release:       0.90,   // Company-issued press release
  official_statement:  0.90,   // CEO/C-suite official statement
  company_blog:        0.85,   // Company blog post (first-party)
  job_posting:         0.85,   // Job posting = hiring signal with real intent
  founder_linkedin:    0.80,   // Founder LinkedIn — direct, first-person
  founder_twitter:     0.75,   // Twitter/X — direct but informal
  employee_linkedin:   0.70,   // Employee — one step removed
  news_article:        0.70,   // Journalism — usually attributed reporting
  podcast:             0.65,   // Interview — direct but informal, editable
  interview:           0.65,
  blog_post:           0.60,   // Third-party blog — may be biased
  rss_scrape:          0.65,   // RSS feed — typically news article
  rss_article:         0.65,   // Alias used by ingest-discovered-signals
  website:             0.75,   // Company's own website copy
  rumor_site:          0.40,   // Rumor/gossip source
  anonymous_post:      0.30,   // Anonymous or unverified
  unknown:             0.55,   // Default when source is not specified

  // ── Internal Pythh ingestion source types ────────────────────────────────
  // These map to the `source_type` values set by ingest-pythh-signals.js.
  // Reliability reflects how curated and first-party the text is.
  execution_signals:   0.88,   // Founder-reported milestones in submission form
  grit_signals:        0.82,   // Founder-authored grit / persistence narrative
  team_signals:        0.80,   // Founder-authored team composition description
  credential_signals:  0.78,   // Founder-authored credentials / background
  market_signals:      0.72,   // Market context authored by founder
  description:         0.75,   // Startup description (founder-written or scraped)
  pitch:               0.80,   // Pitch deck summary — intentional, curated
  value_proposition:   0.77,   // Value prop copy — typically polished
  problem:             0.72,   // Problem description — contextual
  solution:            0.72,   // Solution description — contextual
  tagline:             0.65,   // Tagline — marketing, may be vague
  // Metrics-derived signals (numbers → signals, highest reliability)
  structured_metrics:  0.95,   // Directly from ARR/MRR/customer_count fields
  crunchbase:          0.92,   // Crunchbase API data
  linkedin_api:        0.88,   // LinkedIn API data
  clearbit:            0.85,   // Clearbit enrichment
};

// ─── MULTI-SIGNAL TRIGGER PATTERNS ───────────────────────────────────────────
// Conjunctions / adverbs that indicate multiple distinct actions in one sentence.
// When found between action verb phrases, the sentence should be split into
// separate signal objects.
// "After closing our seed, we're hiring and evaluating vendors" → 3 signals
const MULTI_SIGNAL_TRIGGERS = [
  /\band\s+(?:also|now|then|we're|we are|the company)\b/i,
  /\bafter\s+(?:closing|raising|launching|hiring|signing|securing)\b/i,
  /\bwhile\s+(?:also|simultaneously|at the same time)\b/i,
  /\bin\s+addition(?:\s+to)?\b/i,
  /\bfollowing\s+(?:the|a|our|its)\s+\w+/i,
  /\bat\s+the\s+same\s+time\b/i,
  /\badditionally[,\s]/i,
  /\bwe're\s+also\b/i,
  /\bwe\s+are\s+also\b/i,
  /\bthey're\s+also\b/i,
  /\bthey\s+are\s+also\b/i,
  /\bsimultaneously\b/i,
  /\bconcurrently\b/i,

];

// ─── TIME BUCKET NORMALIZATION ────────────────────────────────────────────────
// Normalize fuzzy time phrases into discrete buckets.
// "soon" → near-term (low precision). "this quarter" → near-term (high precision).
// Always keep raw_time_phrase alongside time_bucket.
const TIME_BUCKET = Object.freeze({
  IMMEDIATE:   'immediate',    // now, today, this week — proximity 0.9+
  NEAR_TERM:   'near-term',    // next month, this quarter, soon — proximity 0.6–0.9
  MEDIUM_TERM: 'medium-term',  // this year, H2, in 6 months — proximity 0.4–0.6
  RECENT_PAST: 'recent-past',  // recently, last quarter — proximity 0.3–0.5 (past)
  LONG_HORIZON:'long-horizon', // next year, 2027 — proximity < 0.4
  UNKNOWN:     'unknown',      // no time phrase detected
});

module.exports = {
  ACTOR_PATTERNS,
  ACTION_MAP,
  WHO_CARES_MAP,
  SIGNAL_TYPE_MAP,
  INFERENCE_MAP,
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
  // ── Ambiguity layer ──────────────────────────────────────────
  NEGATION_PATTERNS,
  DOUBLE_NEGATIVE_PATTERNS,
  HEDGING_VOCAB,
  PROMOTIONAL_PHRASES,
  BOILERPLATE_PHRASES,
  REPORTED_SPEECH_PATTERNS,
  RUMOR_PATTERNS,
  AMBIGUITY_FLAGS,
  EVIDENCE_QUALITY,
  CONFLICT_PAIRS,
  TIME_BUCKET,
  // ── Rules Engine additions ────────────────────────────────────
  COSTLY_ACTIONS,
  SOURCE_RELIABILITY,
  MULTI_SIGNAL_TRIGGERS,
};
