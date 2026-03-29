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
  ['(initial public offering|ipo|direct listing|spac)',
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
const SIGNAL_CLASS_PRIORITY = [
  'fundraising_signal',
  'acquisition_signal',
  'exit_signal',
  'distress_signal',
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
  'exploratory_signal',
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
};
