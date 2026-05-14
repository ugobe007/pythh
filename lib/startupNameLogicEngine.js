'use strict';

/**
 * STARTUP NAME LOGIC ENGINE — Structural Template Classifier
 *
 * Core insight: the same word changes its semantic meaning based on its
 * POSITION and STRUCTURAL ROLE within a name — exactly as verbs conjugate
 * differently based on person, tense, and context.
 *
 * "Capital" at the END  → investor type marker  ("Meritech Capital")
 * "Capital" at the START → potential brand modifier ("Capital Factory")
 * "General" at the END   → adjective descriptor ("in general")
 * "General" at the START + VC suffix at END → investor ("General Catalyst")
 *
 * The engine resolves each name to a STRUCTURAL TEMPLATE, then classifies
 * the template — not the individual tokens.
 *
 * Structural templates:
 *   [Brand]                      → startup  (Stripe, Notion)
 *   [Modifier] + [Brand-suffix]  → startup  (Conduit Health, Lattice AI)
 *   [Any] + [VC-type-suffix]     → investor (Meritech Capital, Index Ventures)
 *   [Adj/Noun] + [Adj/Noun]...   → startup if brand-like, descriptor if generic
 *   [Function-word] + [...]      → headline (Just Earmarked, Tariffs BitGo)
 *   [Entity] + [Entity]          → compound/descriptor (Wiz Google, OpenAI AWS)
 *   [Verb-chain]                 → headline (AI Security Spending Accelerates)
 *
 * Flow (see lib/entityResolutionGate.js):
 *   Logic Engine → Ontology / inference confirmation → Legacy safety net → URL gate → Enrichment
 */

// ─── Slot vocabularies ────────────────────────────────────────────────────────
// Each vocabulary fills a SLOT in a structural template.
// The same word may appear in multiple slots — its meaning is resolved
// by which slot it fills (first, last, middle, or standalone).

/**
 * LAST-WORD slot: investor-type suffixes.
 * When ANY name ends with one of these words (and has 2+ words total),
 * the structural template is [Any...] + [VC-type], which = investor.
 *
 * This is positional — "fund" at the end means investor;
 * "fund" in the middle ("fund your startup") is a verb and caught elsewhere.
 */
const SLOT_LAST_INVESTOR = new Set([
  'capital', 'capitals',
  'ventures', 'venture',
  'partners', 'partner',
  'management', 'managers',
  'associates', 'associate',
  'fund', 'funds',
  'equity', 'equities',
  'investments', 'investment',
  'holdings', 'holding',
  'advisors', 'advisory',
  'asset', 'assets',
  'vc',
  // "SoftBank Group" — 'group' only signals investor when the first word is a known VC brand
  // Handled separately to avoid blocking "Group Buying" startups
]);

/**
 * FIRST-WORD slot: unambiguous VC brand tokens.
 * These words are so strongly associated with known VC firms that their
 * presence as first word + multi-word name reliably signals an investor.
 * Deliberately narrow — excludes common English words like "general", "first".
 */
const SLOT_FIRST_VC_BRAND = new Set([
  'sequoia', 'andreessen', 'horowitz', 'kleiner', 'perkins',
  'greylock', 'bessemer', 'felicis',
  'coatue', 'softbank',
  'tiger',   // "Tiger Global", "Tiger Management"
  'warburg', 'pincus', 'kkr', 'blackstone', 'carlyle', 'apax',
  'francisco', 'thoma', 'bravo', 'vista',
  'dcvc', 'capitalg', 'base10',
  'peak',    // "Peak XV" — Roman numeral suffix is the conjugating context
]);

/**
 * LAST-WORD slot: strong startup brand suffixes.
 * When a name ends here (1–3 words), the template is [Brand] + [Startup-type],
 * which = startup regardless of what the first words are.
 */
const SLOT_LAST_STARTUP = new Set([
  'ai', 'labs', 'lab', 'tech', 'io', 'hq', 'base', 'stack',
  'hub', 'cloud', 'works', 'ware', 'soft', 'app', 'api', 'bot',
  'kit', 'flow', 'pro', 'plus', 'go',
  'health', 'care', 'med', 'bio', 'gen', 'net', 'link', 'sync',
  'forge', 'core', 'shield', 'vault', 'node', 'edge', 'beam',
  'bridge', 'path', 'verse', 'mind', 'sense', 'sight', 'watch',
  'mark', 'craft', 'space', 'gate', 'grid', 'port', 'peak',
  'spark', 'pulse', 'wave', 'tide', 'dash', 'drop', 'shift',
  'spot', 'desk', 'front', 'side', 'point', 'field', 'force',
  'line', 'wire', 'chain', 'pass', 'key', 'lock', 'sign', 'seal',
  'run', 'fly', 'lift', 'launch', 'rise', 'reach',
]);

/**
 * FIRST-WORD slot: structural function words.
 * When a name OPENS with one of these words, it reveals the name is a
 * phrase (headline, descriptor) rather than a brand, because real brands
 * do not start with adverbs, determiners, or policy nouns.
 *
 * Context-sensitivity: month names are scoped separately (see classifier).
 */
const SLOT_FIRST_FUNCTION = new Set([
  // Adverbs / discourse markers
  'just', 'already', 'still', 'yet', 'now', 'soon', 'later',
  // Demonstrative pronouns as openers = noun phrase, not a brand
  'this', 'these', 'those',
  // Determiners
  'new', 'latest', 'recent', 'upcoming', 'current', 'former', 'future',
  // Interrogatives
  'why', 'how', 'what', 'when', 'where', 'who', 'which',
  // Superlatives / comparatives
  'top', 'best', 'worst', 'most', 'least', 'more', 'less',
  'key', 'major', 'biggest', 'largest', 'fastest',
  // Ordinals (2nd+ only — "first" is ambiguous as startup name opener)
  'second', 'third', 'last', 'next', 'previous',
  // Policy / economic nouns as openers = news headline
  'tariffs', 'taxes', 'rates', 'fees', 'prices', 'costs', 'inflation',
  'sanctions', 'regulations', 'rules', 'laws', 'policies',
  // Operational nouns as openers (not brand starters)
  'management', 'operations', 'administration',
  // Fiscal periods
  'q1', 'q2', 'q3', 'q4', 'h1', 'h2',
  // Past-participle adjectives as openers — "Experienced AI", "Advanced AI", "Proposed Transaction"
  // These describe properties of a category, not a brand name
  'experienced', 'advanced', 'integrated', 'automated', 'enhanced',
  'optimized', 'unified', 'simplified', 'accelerated', 'extended',
  'specialized', 'dedicated', 'distributed', 'embedded', 'federated',
  'generalized', 'personalized', 'standardized', 'structured', 'connected',
  'inclusive', 'exclusive', 'comprehensive', 'enterprise-grade',
  'proposed', 'planned', 'expected', 'anticipated', 'projected',
  'announced', 'approved', 'pending', 'completed', 'rejected',
  // Governance / regulatory topic openers — "Governance Platform", "Compliance Framework"
  'governance', 'compliance', 'regulation', 'oversight', 'transparency',
  'accountability', 'enforcement', 'supervision', 'audit', 'review',
  // Medical / health category openers — "Disease ADPKD", "Disorder [x]"
  'disease', 'disorder', 'syndrome', 'condition', 'infection',
  // Geographic-language prefix — "Francophone", "Digital" as generic market descriptor
  'francophone', 'anglophone',
  // Imperative action verbs as openers — "Accelerate Quantum Computing" = action phrase
  'accelerate', 'automate', 'transform', 'disrupt', 'leverage', 'optimize',
  'revolutionize', 'reimagine', 'rethink', 'reinvent', 'reshape', 'modernize',
  'redefine', 'reconnect', 'rethink', 'rebuild', 'reimagine', 'revamp', 'redesign',
  // Modal verbs — "STAT+ Could" = incomplete headline sentence
  'could', 'should', 'would', 'might', 'may', 'must', 'can',
  // Comparative / ranking openers
  'versus', 'vs', 'against', 'compared',
  // Standard / specification openers
  'standard', 'standards',
  // Temporal / contextual adjectives as openers  — "Modern AI", "After Harvey"
  'modern', 'traditional', 'conventional', 'historical', 'contemporary',
  'after', 'before', 'during', 'despite', 'beyond', 'behind', 'above', 'below',
  'within', 'across', 'through', 'around', 'since', 'until', 'unless',
  // Language / ethnic qualifiers as openers — "Francophone West Africa"
  'francophone', 'anglophone', 'hispanophone',
  // Descriptive adjectives as openers often seen in scraped market phrases
  'independent', 'sustainable', 'responsible', 'ethical', 'affordable',
  'accessible', 'scalable', 'reliable', 'robust', 'resilient',
  // Note: do NOT add single-word generic prefixes like 'digital' or 'core' here —
  // they are legitimately used in startup names (CoreOS, Digital Ocean, CoreDNA).
  // Instead, block them via SLOT_LAST_DESCRIPTOR when combined with known category nouns.
  // Category-level quality adjectives that open descriptor phrases
  'real', 'fake', 'true', 'false', 'genuine', 'authentic', 'synthetic',
  // Title abbreviations — "Dr Smith" = person; "Sen Elizabeth Warren" = politician
  'dr', 'mr', 'ms', 'mrs', 'prof', 'rev', 'hon', 'sir',
  'sen', 'rep', 'gov', 'pres', 'amb', 'sgt', 'cpl', 'pvt',
  'gen', 'col', 'maj', 'capt', 'lt', 'adm', 'cmdr',
  // Valuation / financial metric openers  — "Valuation Just Weeks"
  'valuation', 'revenue', 'profit', 'loss', 'ebitda', 'arpu', 'mrr', 'arr',
  // Imperative "Watch" as first word = product demo / teaser phrase, not a brand name
  // ("Watch Starcloud" = "Watch [the startup called] Starcloud" = article fragment)
  'watch',
  // Prepositions / determiners opening a scraped noun phrase — not brand starters
  // (omit "via" — real companies use "Via …"; omit "every"/"please"/"always" — common brand openers)
  'with', 'without', 'from', 'for', 'into', 'onto', 'during',
  // "each" opens listicle fragments ("Each Way", "Each Step") — not brand starters
  'each',
  // Negation opener (headlines, UI strings)
  'never',
]);

/**
 * LAST-WORD slot: category / topic descriptor nouns.
 * When a multi-word name ENDS with one of these, the structural template
 * is [Topic-modifier...] + [Category-noun] — a news topic, not a brand.
 *
 * "Supply Chain Attack" → attack is not a brand suffix
 * "Cancer Drug" → drug is a category, not a startup product name
 */
const SLOT_LAST_DESCRIPTOR = new Set([
  // Security / threat vocabulary
  'attack', 'breach', 'hack', 'exploit', 'threat', 'risk', 'vulnerability',
  // Medical / pharma category nouns
  'drug', 'drugs', 'therapy', 'treatment', 'cure', 'vaccine',
  // Crisis / event nouns
  'shortage', 'crisis', 'decline', 'collapse', 'failure', 'default',
  'boom', 'bubble', 'burst', 'crash', 'correction',
  // Conflict
  'race', 'war', 'battle', 'fight', 'conflict', 'rivalry',
  // Research / media outputs
  'report', 'study', 'survey', 'research', 'analysis',
  'outlook', 'forecast', 'projection', 'estimate', 'prediction',
  // Social / group nouns (not brands)
  'teammates', 'colleagues', 'peers', 'rivals', 'competitors',
  // State descriptors
  'lost', 'gone', 'dead', 'killed', 'shut', 'closed', 'failed',
  'darling', 'unicorn',
  // Nationality adjectives as last word = demographic descriptor
  'chinese', 'american', 'european', 'asian', 'african', 'russian',
  'british', 'french', 'german', 'indian', 'japanese', 'korean',
  'australian', 'canadian', 'israeli', 'iranian', 'ukrainian',
  'turkish', 'brazilian', 'mexican',
  // Policy / social statement endings — "inclusive HR policy", "transgender rights"
  'policy', 'policies', 'rights', 'privilege', 'reform',
  'inclusion', 'diversity', 'equity', 'belonging',
  'mandate', 'legislation', 'ruling', 'verdict', 'judgment',
  'preference', 'stance', 'position', 'statement',
  // Legal and conflict endings
  'lawsuit', 'lawsuits', 'litigation', 'settlement', 'injunction',
  'indictment', 'charges', 'allegation', 'allegations',
  // Awareness / readiness / preparedness → category phrase, not brand
  'readiness', 'awareness', 'preparedness', 'literacy', 'fluency',
  'capability', 'maturity', 'proficiency',
  // Academic / institutional endings — not startup brand names
  'university', 'college', 'institute', 'academy', 'school',
  'department', 'division', 'bureau', 'authority', 'commission',
  'foundation', 'association', 'federation', 'alliance', 'coalition',
  'consortium', 'cooperative', 'cooperative', 'guild', 'union',
  // Financial institution divisions
  'banking', 'brokerage', 'insurance', 'lending', 'leasing',
  // Credential / title plurals
  'phds', 'mds', 'mbas', 'jds', 'ldms',
  // Governance / regulatory topic nouns — also in SLOT_ANY_TOPIC_NOUN for 4+ words,
  // but here they serve as LAST-WORD signal for 2–3-word phrases
  // e.g. "Security Compliance", "Tax Regulation", "Board Governance"
  'compliance', 'regulation', 'legislation', 'governance', 'oversight',
  'transparency', 'accountability', 'enforcement', 'supervision',
  // Market / analysis topic nouns as last word
  'spending', 'trends', 'outlook', 'forecast', 'survey', 'adoption',
  'growth', 'expansion', 'decline', 'contraction', 'disruption',
  'landscape', 'ecosystem', 'agenda', 'roadmap', 'initiative', 'effort',
  'challenge', 'opportunity',
  // Deal / transaction vocabulary as last word
  'deal', 'merger', 'acquisition', 'ipo', 'spac', 'listing',
  'exit', 'liquidation', 'transaction', 'transactions', 'divestiture',
  // Financial metric COMPOUND terms as last word — clearly not brand names
  'run-rate', 'cap-table', 'price-to-earnings', 'market-cap',
  // Academic / research vocabulary as last word
  'iclr', 'neurips', 'icml', 'cvpr', 'aaai', 'arxiv',
  'representations', 'embeddings', 'transformers', 'preprint',
  // Generic category plurals as last word — "Aviv Startups" = location + category noun
  // These are plurals of entity-types, not company name suffixes
  'startups', 'companies', 'firms', 'organizations', 'enterprises',
  'investors', 'founders', 'executives', 'leaders', 'experts',
  // Geographic category nouns as last word — "Six Continents", "Three Regions"
  'continents', 'countries', 'nations', 'territories', 'regions',
  // Modal verbs as last word signal sentence fragment / headline
  'could', 'should', 'would', 'might', 'may', 'must',
  // Medical / pharma category nouns as last word
  'disease', 'disorder', 'syndrome', 'condition', 'diagnosis',
  'pipeline', 'trial', 'trials', 'study',
  // Technology / descriptor endings — "Threat Intelligence", "Plant Deployment"
  // Note: 'analytics' intentionally excluded — many real startups use it as a suffix
  // (Dune Analytics, Heap Analytics, Amplitude). 'analytics' is in SLOT_ANY_TOPIC_NOUN
  // which fires only for 4+ word phrases where it signals a market-analysis phrase.
  'intelligence', 'deployment', 'migration', 'implementation', 'integration',
  'optimization', 'automation', 'transformation', 'modernization',
  // Value / financial indicators as last word — "Property Tycoon", "Worth Bags"
  'tycoon', 'mogul', 'billionaire', 'millionaire',
  // "Rejection", "Attention", etc. used as concept labels  
  'rejection', 'attention', 'permission', 'limitation', 'restriction',
  'supervision', 'verification', 'authentication', 'authorization',
  // Plural category nouns as last word
  'reports', 'records', 'files', 'logs', 'feeds', 'updates', 'entries',
  // Note: 'analytics' removed from this set — it's a common legitimate startup suffix
  // (Dune Analytics, Heap Analytics). It remains in SLOT_ANY_TOPIC_NOUN for 4+ word phrases.
  'insights', 'metrics', 'benchmarks', 'results', 'findings',
  // Aerospace / industrial divisions as last word
  'aerospace', 'defense', 'marine', 'space', 'aviation', 'propulsion',
  // Software category modifier as last word
  'devops', 'devsecops', 'gitops', 'dataops', 'mlops',
  // "Realty" = real estate category, not a startup suffix
  'realty',
  // Innovation / corporate-speak abstract nouns as last word  
  'innovation', 'innovations', 'initiative', 'initiatives',
  'transformation', 'collaboration', 'engagement', 'outreach', 'awareness',
  // Trade-show / finance scrape tails ("Canton Fair Phase", "… Trading Segment")
  'phase', 'segment', 'fair', 'support',
  // Legal/civic category nouns as last word
  'exchange', 'coalition', 'alliance', 'association', 'federation', 'committee',
  'division', 'bureau', 'agency', 'authority', 'council', 'commission',
  // Sports / performance metrics as last word — "Whoop Scores", "Team Rankings"
  'scores', 'rankings', 'standings', 'ratings', 'stats', 'statistics',
]);

/**
 * ANY-POSITION slot: content words that, when present in a multi-word name,
 * signal a news topic rather than an entity name.
 * Only fires when the name has 4+ words (avoids false-positives on 2-word brands).
 */
const SLOT_ANY_TOPIC_NOUN = new Set([
  'spending', 'trends', 'outlook', 'forecast', 'report', 'survey',
  'adoption', 'growth', 'expansion', 'decline', 'contraction',
  'crisis', 'shortage', 'disruption', 'transformation',
  'race', 'war', 'battle', 'competition',
  'era', 'age', 'wave', 'boom', 'bubble', 'bust', 'cycle',
  'landscape', 'ecosystem', 'sector', 'market', 'markets', 'industry',
  'agenda', 'roadmap', 'strategy', 'initiative', 'effort',
  'challenge', 'problem', 'opportunity', 'risk',
  'regulation', 'compliance', 'policy', 'legislation',
  'deal', 'merger', 'acquisition', 'ipo', 'spac', 'listing',
  'round', 'raise', 'close', 'exit', 'liquidation',
  'stock', 'stocks', 'trading', 'segment',
  // Policy / social statements
  'rights', 'privilege', 'discrimination', 'inclusion', 'diversity',
  'equity', 'belonging', 'accessibility', 'sustainability',
  'transparency', 'accountability', 'governance',
]);

/**
 * LAST-WORD slot: function words / connectors.
 * When a multi-word name ENDS with one of these, the phrase is an incomplete
 * sentence or a scraped fragment, not a brand name.
 *
 * "Context Why"   → 'why' at end = interrogative clause fragment
 * "Images As"     → 'as' at end = incomplete comparison
 * "India Even"    → 'even' at end = sentence adverb at end = scraped headline fragment
 * "Scaleops Just" → 'just' at end = adverb at end = headline fragment
 * "Pms Already"   → 'already' at end = adverb at end
 */
const SLOT_LAST_FUNCTION = new Set([
  // Interrogatives at end = clause fragments
  'why', 'how', 'what', 'when', 'where', 'who', 'which', 'whether',
  // Sentence-final adverbs = scraped headline fragments
  'just', 'already', 'still', 'yet', 'even', 'now', 'soon', 'too', 'also',
  'indeed', 'anyway', 'however', 'though', 'though', 'although',
  // Conjunctions at end = cut-off sentence
  'as', 'if', 'but', 'and', 'or', 'nor', 'so', 'because', 'since', 'while',
  // Prepositions at end = cut-off prepositional phrase
  'with', 'without', 'from', 'into', 'onto', 'upon', 'amid',
  // Infinitive marker at end = cut-off action phrase ("Companies To", "Things To")
  'to',
]);

/**
 * ANY-POSITION slot: subordinating relative pronouns.
 * When "that", "which", "who", "whose", "whom" appear as internal words
 * (not first or last), they reveal a relative clause embedded in the name —
 * this is a sentence fragment, not a brand name.
 *
 * "Jack Frost that_____"       → relative clause → headline
 * "Airbnb investment which..."  → relative clause → headline
 * "A policy that favors..."     → relative clause → headline
 */
const SLOT_INTERNAL_RELATIVE_PRONOUN = new Set([
  'that', 'which', 'who', 'whose', 'whom', 'where', 'when', 'whereby',
]);

/**
 * Verbs that appear in multi-word scraped fragments to indicate an action
 * sentence (actor did something to object). These are NEWS PREDICATES, not
 * parts of company names.
 *
 * "Airbnb first invested in Yardstick" → 'invested' = verb → headline
 * "Google just launched an HR policy"  → 'launched' = verb (already caught by
 *    SLOT_FIRST_FUNCTION 'just', but 'launched' strengthens it)
 * "Sequoia focuses on infra"           → 'focuses' = verb → headline
 */
const SLOT_ANY_NEWS_VERB = new Set([
  // Investment / deal verbs
  'invested', 'invests', 'invest', 'backed', 'backs', 'funded', 'funds',
  'acquired', 'acquires', 'merged', 'merges', 'divested', 'divests',
  'raised', 'raises', 'closed', 'closes', 'exited', 'exits',
  // Product / announcement verbs
  'launched', 'launches', 'released', 'releases', 'announced', 'announces',
  'introduced', 'introduces', 'unveiled', 'unveils', 'deployed', 'deploys',
  // Corporate action verbs
  'hired', 'hires', 'fired', 'fires', 'laid', 'expanded', 'expands',
  'partnered', 'partners', 'secured', 'secures', 'won', 'wins',
  'filed', 'files', 'settled', 'settles', 'sued', 'sues',
  // Analytical verbs (appear in market commentary scraped as entity names)
  'focuses', 'focus', 'targets', 'target', 'sees', 'saw', 'believes',
  'reported', 'reports', 'showed', 'shows', 'revealed', 'reveals',
  'resulted', 'results', 'favors', 'favour', 'favours',
  // Giving / providing verbs common in policy and CSR headlines
  'gives', 'give', 'provides', 'provide', 'offers', 'offer',
  'supports', 'support', 'enables', 'enable', 'empowers', 'empower',
  // Predicate verbs in SVO headline fragments ("Universe Makes European")
  'makes', 'make', 'made', 'takes', 'take', 'took', 'breaks', 'broke',
  'uploads', 'upload',
]);

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC REASONING VOCABULARY
// These sets power the final "What Is This?" inference pass — not lookup tables,
// but semantic categories that the reasoner uses to make inferences about
// whether a word or phrase can plausibly be a startup/company name.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Personal pronouns. Their presence ANYWHERE in a name reveals it is a sentence
 * fragment (the speaker is addressing or referring to a person/group), not a brand.
 * "Benchmarks We"  → 'we' = first person plural embedded in phrase
 * "Ownership People" → 'people' treated as second-person reference
 */
const SLOT_PERSONAL_PRONOUN = new Set([
  'i', 'me', 'my', 'mine', 'myself',
  'you', 'your', 'yours', 'yourself',
  'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself',
]);

/**
 * Institutional / financial / government acronyms that are well-known
 * collective entities, NOT startups.  Single-token only — must be the
 * ENTIRE name (not a prefix like "REIT Platform").
 */
const SLOT_INSTITUTIONAL_ACRONYM = new Set([
  // Finance & markets
  'reit', 'etf', 'etfs', 'adr', 'adrs', 'spac', 'spacs',
  'ipo', 'ipos', 'vc', 'pe', 'lbo', 'm&a',
  'gdp', 'cpi', 'fed', 'fomc', 'sec', 'finra', 'cftc',
  // Wireless / tech standards (standalone)
  'wi-fi', 'wifi', '5g', '4g', 'lte', 'gsm', 'nfc', 'rfid',
  'usb', 'hdmi', 'bluetooth', 'gps',
  // HR / corporate departments
  'hr', 'it', 'rd', 'r&d', 'pr', 'ir', 'esg',
  // Government bodies / political groups
  'g7', 'g8', 'g20', 'nato', 'un', 'eu', 'imf', 'wto', 'who',
  'fbi', 'cia', 'nsa', 'doj', 'sec', 'irs', 'fda', 'epa',
  // International financial institution abbreviations (well-known collective bodies)
  'ifc', 'idb', 'ifc',
]);

/**
 * Profession and demographic plural nouns.  A single word that is the plural
 * of a job title, social group, or demographic category = a label for a group
 * of people, not a company brand.
 * "Prosecutors" = legal professionals; "Men" = gender demographic.
 */
const SLOT_PROFESSION_PLURAL = new Set([
  // Legal
  'prosecutors', 'defendants', 'plaintiffs', 'attorneys', 'lawyers',
  'judges', 'jurors', 'witnesses', 'investigators',
  // Corporate
  'contractors', 'consultants', 'freelancers', 'advisors', 'executives',
  'managers', 'directors', 'officers', 'employees', 'workers', 'staff',
  'developers', 'engineers', 'designers', 'analysts', 'researchers',
  // Demographic
  'men', 'women', 'girls', 'boys', 'children', 'adults', 'seniors',
  'veterans', 'immigrants', 'migrants', 'refugees', 'citizens',
  'voters', 'consumers', 'users', 'subscribers', 'members',
  // Academic
  'students', 'professors', 'graduates', 'alumni', 'scholars',
  // Health
  'patients', 'doctors', 'nurses', 'surgeons', 'physicians', 'caregivers',
  // Generic plural "people" (also catches "[Person] People" = descriptor)
  'people', 'folks', 'individuals', 'humans', 'persons',
  // Animals / non-human plurals used as standalone category names
  'bees', 'ants', 'bears', 'wolves', 'sharks', 'dolphins', 'pandas',
  'hawks', 'eagles', 'lions', 'tigers', 'bulls', 'bears',
  // Generic plural nouns (common things, not brand names)
  'cameras', 'sensors', 'routers', 'servers', 'nodes', 'ports',
  'slicers', 'scanners', 'printers', 'drivers', 'plugins', 'modules',
  'subscriptions', 'licenses', 'contracts', 'grants', 'permits', 'claims',
  'errors', 'warnings', 'alerts', 'logs', 'events', 'signals', 'triggers',
  // Hero / villain / character archetypes used as category labels
  'heroes', 'villains', 'champions', 'legends', 'icons', 'pioneers',
  // Content creators / internet culture roles
  'influencers', 'bloggers', 'streamers', 'creators', 'vloggers', 'podcasters',
  'moderators', 'admins', 'operators',
]);

/**
 * Common English verb gerunds (present-participle form) used as standalone names.
 * A gerund alone is a state or activity description, not a brand.
 * Startups using gerunds as names typically pair them with a qualifier (Sharing Economy,
 * Building Tomorrow) — but a bare gerund like "Moving" or "Speaking" is just a verb.
 */
const SLOT_BARE_GERUND = new Set([
  'moving', 'speaking', 'flying', 'selling', 'buying', 'trading',
  'sharing', 'giving', 'taking', 'making', 'doing', 'going', 'coming',
  'winning', 'losing', 'growing', 'changing', 'learning', 'teaching',
  'working', 'living', 'eating', 'sleeping', 'thinking', 'writing',
  'reading', 'helping', 'leading', 'following', 'watching', 'listening',
  'saving', 'spending', 'earning', 'hiring', 'firing', 'voting',
  'coding', 'hacking', 'mining', 'farming', 'hunting', 'fishing',
  // Cognitive / administrative gerunds — "Keeping [records]", "Solving [problems]"
  'keeping', 'solving', 'managing', 'tracking', 'monitoring', 'reporting',
  'reviewing', 'verifying', 'auditing', 'approving', 'rejecting', 'processing',
  'scheduling', 'planning', 'organizing', 'coordinating', 'facilitating',
]);

/**
 * AI / ML model version string patterns.
 * "Llama-3.1-8B", "GPT-4o", "Claude-3-Sonnet" = model identifiers, not company names.
 */
// Requires at least one digit after the model name to avoid catching brand names like Qwen.ai
const AI_MODEL_VERSION_RE = /^(llama|gpt|claude|gemini|falcon|vicuna|alpaca|bloom|dolly|orca|phi|qwen|deepseek|yi|baichuan|internlm)[-_\s]?\d[\d.a-z]*/i;

/**
 * Tech protocols, standards, and OS names that are NOT startup names.
 * Used to detect compound pairs like "OAuth SAML", "REST GraphQL", "Linux Windows".
 */
const SLOT_TECH_PROTOCOL = new Set([
  'oauth', 'saml', 'ldap', 'kerberos', 'jwt', 'ssl', 'tls', 'https',
  'smtp', 'imap', 'ftp', 'sftp', 'ssh', 'dns', 'dhcp', 'http',
  'rest', 'soap', 'graphql', 'grpc', 'xml', 'json', 'yaml', 'toml',
  'linux', 'unix', 'macos', 'windows', 'android', 'ios', 'ubuntu',
  'python', 'java', 'javascript', 'typescript', 'golang', 'ruby',
  // Note: 'rust' excluded — Rust (game company by Facepunch) is a real startup/brand
  'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins',
  // JS/web frameworks — when combined with "Standard" etc. = tech topic phrase
  'react', 'vue', 'angular', 'svelte', 'next', 'webpack', 'babel', 'npm',
  // Build tools / dependency managers
  'gradle', 'maven', 'ant', 'cmake', 'make', 'bazel', 'buck', 'pants',
  // Data science / ML libraries
  'pandas', 'numpy', 'scipy', 'sklearn', 'pytorch', 'tensorflow', 'keras',
  'hugging', 'langchain', 'llamaindex', 'langsmith',
  // Observability / monitoring tools
  'grafana', 'prometheus', 'datadog', 'splunk', 'newrelic', 'dynatrace',
  // Web servers / reverse proxies
  'nginx', 'apache', 'caddy', 'traefik', 'haproxy', 'envoy', 'istio',
  // Search / database engines
  'elasticsearch', 'opensearch', 'solr', 'lucene', 'pinecone', 'weaviate',
  // AI model family names without version = still model identifiers
  'llama', 'gpt', 'claude', 'gemini', 'mistral', 'falcon', 'vicuna',
  // Hardware / connectivity standards
  'usb-c', 'hdmi', 'displayport', 'thunderbolt', 'pcie', 'nvme', 'sata',
  'vram', 'dram', 'sram', 'bios', 'uefi', 'acpi',
]);

/**
 * Known major tech/VC entities used for COMPOUND DETECTION.
 * "OpenAI AWS" = two entities concatenated = headline fragment.
 * "Wiz Google" = startup + acquirer = M&A headline.
 * "Databricks Snowflake" = two known data companies = comparison headline.
 */
const SLOT_KNOWN_MAJOR_ENTITY = new Set([
  // Big tech
  'openai', 'google', 'alphabet', 'amazon', 'microsoft', 'apple', 'meta', 'aws',
  'azure', 'gcp', 'anthropic', 'deepmind', 'nvidia', 'intel', 'amd', 'qualcomm',
  'tesla', 'spacex', 'uber', 'lyft', 'airbnb', 'stripe', 'tiktok', 'bytedance',
  'salesforce', 'oracle', 'sap', 'ibm', 'cisco', 'vmware', 'adobe', 'workday',
  'servicenow', 'palantir', 'snowflake', 'databricks', 'confluent', 'mongodb',
  'datadog', 'crowdstrike', 'paloalto', 'cloudflare', 'fastly', 'splunk',
  // AI companies
  'mistral', 'cohere', 'stability', 'inflection', 'xai', 'perplexity',
  'huggingface', 'runway', 'midjourney', 'eleven', 'synthesia',
  // Crypto / fintech platforms
  'coinbase', 'binance', 'ripple', 'solana', 'ethereum', 'bitcoin',
  'robinhood', 'affirm', 'klarna', 'chime', 'plaid', 'brex', 'ramp',
  // Major VC brands (as any-position compound detection)
  'sequoia', 'andreessen', 'softbank', 'tiger', 'lightspeed', 'accel',
  'coatue', 'dragoneer', 'insight', 'general', // 'general' = "General Catalyst"
  // World capitals / major cities appearing in compound headlines
  'paris', 'london', 'berlin', 'tokyo', 'beijing', 'shanghai', 'dubai',
  'singapore', 'amsterdam', 'sydney', 'toronto', 'chicago', 'seattle',
  'detroit', 'boston', 'austin', 'atlanta', 'miami', 'denver', 'dallas',
  'houston', 'phoenix', 'portland', 'nashville', 'pittsburgh', 'minneapolis',
  // Social media platforms
  'instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin',
  'pinterest', 'snapchat', 'reddit', 'discord', 'telegram', 'whatsapp',
  // Media / news platforms that appear as compound entity prefixes
  'crunchbase', 'techcrunch', 'globenewswire', 'reuters', 'bloomberg', 'stat',
  'wsj', 'nyt', 'bbc', 'cnbc', 'cnn', 'forbes', 'wired', 'verge',
  // Known VC funds (for compound detection)
  'm13', 'zetta', 'lux', 'founders', 'greylock', 'kleiner', 'nea', 'idc',
  'bessemer', 'benchmark', 'felicis', 'general', 'khosla',
  // Major established tech companies that appear in compound headlines
  'slack', 'github', 'zoom', 'postman', 'figma', 'notion', 'airtable',
  'linear', 'vercel', 'netlify', 'supabase', 'firebase', 'heroku',
  'elasticsearch', 'elastic', 'mongodb', 'redis', 'kafka', 'spark',
  'honeywell', 'siemens', 'ge', 'boeing', 'lockheed', 'raytheon',
  'blackrock', 'vanguard', 'fidelity', 'jpmorgan', 'goldman', 'morgan',
  'klarna', 'adyen', 'checkout', 'wise', 'revolut', 'monzo', 'nubank',
  'coinbase', 'binance', 'kraken',
  // Asian tech conglomerates that appear as compound prefixes
  'tencent', 'alibaba', 'baidu', 'bytedance', 'huawei', 'samsung', 'lg',
  'softbank', 'rakuten', 'naver', 'kakao',
  // Canadian/global banks
  'cibc', 'rbc', 'bmo', 'td', 'scotiabank',
  // Automotive that appear in compound phrases
  'ford', 'gm', 'bmw', 'mercedes', 'volkswagen', 'toyota', 'honda', 'hyundai',
  'tesla', 'rivian', 'lucid', 'stellantis', 'stellantis',
  // Automotive brands often mentioned alongside startups
  'chevy', 'chevrolet', 'ford', 'gm', 'toyota', 'volkswagen', 'bmw',
  // Consumer brands mentioned in VC/startup context
  'pokemon', 'nintendo', 'sony', 'samsung', 'huawei',
  // Geographic entities that appear in compound entity names
  'europe', 'china', 'india', 'asia', 'africa', 'latin', 'america',
]);

// ─── Structural template classifier ──────────────────────────────────────────

/**
 * @typedef {{ track: 'startup'|'investor'|'descriptor'|'headline', confidence: 'high'|'medium'|'low', reason: string }} EngineResult
 */

/**
 * Classify a name by resolving it to a structural template, then classifying
 * the template. Context (position, surrounding tokens) determines meaning.
 *
 * @param {string} name
 * @returns {EngineResult}
 */
function classifyEntityTrack(name) {
  if (!name || typeof name !== 'string') {
    return { track: 'descriptor', confidence: 'low', reason: 'empty_name' };
  }

  // Normalize Unicode punctuation (mirrors startupNameValidator normalization).
  name = name
    .replace(/[\u2018\u2019\u02BC\u02B9]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  const trimmed    = name.trim();
  const lower      = trimmed.toLowerCase();
  const words      = trimmed.split(/\s+/).filter(Boolean);
  const lowerWords = words.map(w => w.toLowerCase());
  const wc         = words.length;
  const first      = lowerWords[0] || '';
  const last       = lowerWords[wc - 1] || '';
  const middle     = lowerWords.slice(1, -1); // words between first and last

  // ── Template: [Any...] + [VC-type-suffix] ─────────────────────────────────
  // The last word conjugates the whole name into "investor" regardless of
  // what precedes it. "Index Ventures" = investor; "Tiger Ventures" = investor;
  // even "Startup Ventures" = investor (they chose a fund-type suffix).
  if (SLOT_LAST_INVESTOR.has(last) && wc >= 2) {
    // Exception: "[Startup name] + 'group'" is ambiguous. Only flag "group"
    // when first word is a known VC brand token.
    if (last === 'group' && !SLOT_FIRST_VC_BRAND.has(first)) {
      // Fall through to startup checks — "Tailwind Group" could be a startup
    } else {
      return { track: 'investor', confidence: 'high', reason: `[any]+[${last}]→investor` };
    }
  }

  // Template: [Known-VC-brand] + [anything] (multi-word)
  // The first word, in the context of a multi-word name, reveals VC identity
  if (SLOT_FIRST_VC_BRAND.has(first) && wc >= 2) {
    return { track: 'investor', confidence: 'high', reason: `[${first}:vc-brand]+[...]→investor` };
  }

  // Template: [Word] + [Roman-numeral] → VC fund series ("Peak XV", "Fund III")
  if (wc === 2 && /^(I{1,3}|IV|V|VI{0,3}|IX|X{1,3}|XI{1,3}|XIV|XV|XVI|XIX|XX{1,3})$/i.test(words[1])) {
    return { track: 'investor', confidence: 'high', reason: `[word]+[roman-numeral]→fund-series` };
  }

  // ── Template: [Actor]'s [Object] → possessive phrase → headline ───────────
  // "Stripe's new MCP services", "Sequoia's portfolio company", "Google's HR policy"
  // Possessive apostrophes reveal an actor + object relationship — not a brand name.
  // Singular possessive: "Stripe's new …", "India's Bacancy Systems"
  // Plural possessive:   "Klarna Vets' Galdera" (apostrophe AFTER s)
  if (
    /'\s*s\s+\w/i.test(trimmed) ||   // singular 's + word after
    /\w+'\s*s$/i.test(trimmed) ||     // ends with 's
    /\ws'\s+\w/i.test(trimmed)        // plural s' + word after
  ) {
    return { track: 'headline', confidence: 'high', reason: `[actor]'s[object]→possessive-headline` };
  }

  // ── Template: [...] + [Function-word-at-end] → sentence fragment ───────────
  // A name ending with an interrogative, adverb, or conjunction is a cut-off
  // scraped phrase, not a brand name.
  // "Context Why"  = headline question fragment
  // "Images As"    = comparison start
  // "Scaleops Just"  = headline adverb dangling at end
  if (wc >= 2 && SLOT_LAST_FUNCTION.has(last)) {
    return { track: 'headline', confidence: 'high', reason: `[...]+[${last}:function-word-at-end]→sentence-fragment` };
  }

  // ── Template: [...] [relative-pronoun] [...] → subordinate clause ──────────
  // "Jack Frost that [clause]", "policy which [clause]", "company whose [x]"
  // A relative pronoun appearing as an internal word reveals sentence structure.
  // Only fires for 3+ words to avoid blocking e.g. a startup named "Who" (unlikely
  // but 1-word "that" is already caught as single generic word elsewhere).
  if (wc >= 3) {
    const relPronoun = middle.find(w => SLOT_INTERNAL_RELATIVE_PRONOUN.has(w));
    if (relPronoun) {
      return { track: 'headline', confidence: 'high', reason: `[phrase]+[${relPronoun}:relative-pronoun]→subordinate-clause` };
    }
  }

  // ── Template: [Any] [news-verb] [Any] → action sentence → headline ─────────
  // "Airbnb first invested in Yardstick", "Google launched an HR policy",
  // "Sequoia focuses on infra investments"
  // A news predicate verb anywhere in a multi-word name reveals a sentence, not
  // a brand. Fires for 3+ words to avoid blocking "Invest" as a 2-word name.
  if (wc >= 3) {
    const newsVerb = lowerWords.find(w => SLOT_ANY_NEWS_VERB.has(w));
    if (newsVerb) {
      return { track: 'headline', confidence: 'high', reason: `[sentence]+[${newsVerb}:news-verb]→action-headline` };
    }
  }

  // "A Hundred Hands", "A Few Good" — article + quantifier opens a common noun phrase, not a brand
  const ARTICLE_FIRST = new Set(['a', 'an']);
  const QUANT_AFTER_ARTICLE = new Set([
    'hundred', 'thousand', 'million', 'billion', 'dozen', 'few', 'couple', 'pair', 'myriad', 'litany',
  ]);
  if (wc >= 3 && ARTICLE_FIRST.has(first) && QUANT_AFTER_ARTICLE.has(lowerWords[1])) {
    return { track: 'headline', confidence: 'high', reason: `[article]+[${lowerWords[1]}:quantifier]→noun-phrase` };
  }

  // ── Template: [Function-word] + [...] → headline ──────────────────────────
  // The first word, as a function/adverb/policy-noun, reveals this is a phrase
  // not a brand name. Brands do not open with "just", "tariffs", "management".
  const MONTH_NAMES = new Set([
    'january', 'february', 'march', 'april', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
  ]);
  const firstIsMonth = MONTH_NAMES.has(first);

  if (SLOT_FIRST_FUNCTION.has(first) && wc >= 2) {
    return { track: 'headline', confidence: 'high', reason: `[${first}:function-word]+[...]→headline` };
  }

  // Month as first word: only flag as headline when 3+ words OR last word is
  // a known VC brand (month + VC = fund-date reference, not a startup)
  const UNAMBIGUOUS_VC_LAST = new Set([
    'coatue', 'sequoia', 'andreessen', 'greylock', 'bessemer', 'felicis',
    'softbank', 'warburg', 'carlyle', 'blackstone', 'kkr', 'dcvc',
  ]);
  if (firstIsMonth) {
    if (wc >= 3) {
      return { track: 'headline', confidence: 'high', reason: `[month]+[...3+words]→date-prefixed-headline` };
    }
    if (wc === 2 && UNAMBIGUOUS_VC_LAST.has(last)) {
      return { track: 'investor', confidence: 'high', reason: `[month]+[${last}:vc]→fund-date-reference` };
    }
    // wc === 2, last is not a VC brand: "March Health" = plausible startup
  }

  // ── Template: [...] + [Descriptor-noun] → descriptor ─────────────────────
  // The last word, as a category/topic noun, reveals the name is a news topic.
  // "Supply Chain Attack" → attack conjugates the whole name into a threat topic
  if (SLOT_LAST_DESCRIPTOR.has(last) && wc >= 2) {
    return { track: 'descriptor', confidence: 'high', reason: `[...]+[${last}:descriptor]→topic-phrase` };
  }

  // ── Template: [Protocol] + [Protocol] compound ────────────────────────────
  // Two or more tech protocol/OS tokens concatenated = standards comparison, not a brand.
  // "OAuth SAML" = two auth standards; "REST GraphQL" = two API protocols.
  const protocolCount = lowerWords.filter(w => SLOT_TECH_PROTOCOL.has(w)).length;
  if (protocolCount >= 2) {
    return { track: 'descriptor', confidence: 'high', reason: `[protocol]+[protocol]→tech-standards-compound` };
  }
  // Single protocol token as the ENTIRE name = tech standard, not startup brand
  if (wc === 1 && SLOT_TECH_PROTOCOL.has(first)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${first}:protocol]→tech-standard` };
  }

  // ── Template: [Entity] + [Entity] compound ────────────────────────────────
  // Two or more recognized major-entity tokens concatenated = headline fragment.
  // "OpenAI AWS" = two entities; "Wiz Google" = startup + acquirer.
  const majorEntityCount = lowerWords.filter(w => SLOT_KNOWN_MAJOR_ENTITY.has(w)).length;
  if (majorEntityCount >= 2) {
    return { track: 'descriptor', confidence: 'high', reason: `[entity]+[entity]→compound-headline` };
  }
  // [Word] + [BigTech] as last word = M&A/partnership headline ("Wiz Google")
  if (majorEntityCount === 1 && SLOT_KNOWN_MAJOR_ENTITY.has(last) && wc === 2) {
    return { track: 'descriptor', confidence: 'high', reason: `[brand]+[${last}:major-entity]→acquisition-headline` };
  }
  // [BigTech/geographic] as first word + demographic filler as last = descriptor
  if (majorEntityCount === 1 && SLOT_KNOWN_MAJOR_ENTITY.has(first) && wc === 2) {
    const DEMOGRAPHIC_LAST = new Set([
      'she', 'he', 'they', 'it', 'we', 'us',
      'chinese', 'american', 'european', 'asian', 'global', 'local',
      'tariffs', 'taxes', 'fees', 'rates', 'costs',
    ]);
    if (DEMOGRAPHIC_LAST.has(last)) {
      return { track: 'descriptor', confidence: 'high', reason: `[entity]+[${last}:filler]→descriptor` };
    }
    // Media / news wire services as first word = scrape artifact compound
    // "Globenewswire Code27" = news service + product identifier
    // "Reuters AI" = news wire + AI topic (not a startup named "Reuters AI")
    const MEDIA_FIRST_ENTITIES = new Set([
      'crunchbase', 'techcrunch', 'globenewswire', 'reuters', 'bloomberg',
      'businesswire', 'prnewswire', 'stat', 'accesswire',
    ]);
    if (MEDIA_FIRST_ENTITIES.has(first)) {
      return { track: 'descriptor', confidence: 'high', reason: `[${first}:media-entity]+[word]→news-service-compound` };
    }
  }

  // ── Template: 4+ word phrase with topic noun anywhere ─────────────────────
  // "AI Security Spending Accelerates" — 'spending' in middle conjugates this
  // into a market-trend topic rather than a brand name.
  if (wc >= 4) {
    const topicWord = lowerWords.find(w => SLOT_ANY_TOPIC_NOUN.has(w));
    if (topicWord) {
      return { track: 'descriptor', confidence: 'medium', reason: `[4+words]+[${topicWord}:topic-noun]→market-phrase` };
    }
    // 4+ words with no topic signal and no startup suffix = likely a phrase
    if (!SLOT_LAST_STARTUP.has(last)) {
      return { track: 'descriptor', confidence: 'low', reason: `[4+words-no-startup-signal]→phrase` };
    }
  }

  // 3-word phrase: topic noun in any position signals descriptor
  if (wc === 3) {
    const topicWord = lowerWords.find(w => SLOT_ANY_TOPIC_NOUN.has(w));
    if (topicWord) {
      return { track: 'descriptor', confidence: 'medium', reason: `[3words]+[${topicWord}:topic-noun]→topic-phrase` };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── "WHAT IS THIS?" SEMANTIC REASONING GATE ───────────────────────────────
  //
  // At this point the structural templates have not yet resolved the name.
  // Before we declare it a startup, we apply semantic inference:
  // ask "what kind of thing IS this?" — not by looking it up in a table,
  // but by reasoning about the intrinsic properties of the words.
  //
  // A legitimate startup name has at least ONE of:
  //   • An invented / non-dictionary element (unusual letter combination)
  //   • A branded compound that doesn't exist in plain English
  //   • A domain-style suffix (.ai, .io) or startup-typed suffix (Labs, Health…)
  //
  // Names that consist ONLY of common English words arranged in common patterns
  // are almost never real startup names — they are phrases, labels, or concepts.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Reasoning Test 1: Personal pronoun anywhere → sentence fragment ────────
  // A real brand never contains a personal pronoun ("we", "our", "they", etc.)
  // Their presence means the phrase is addressed to or refers to a person/group.
  // "Benchmarks We"  → reader/author self-reference
  // "Ownership People" → refers to a group of people
  const pronounFound = lowerWords.find(w => SLOT_PERSONAL_PRONOUN.has(w));
  if (pronounFound) {
    return { track: 'descriptor', confidence: 'high', reason: `[${pronounFound}:personal-pronoun]→sentence-fragment` };
  }

  // ── Reasoning Test 2: Institutional acronym as entire name ─────────────────
  // Single-token well-known acronyms are collective entities, not startups.
  // "HR" = Human Resources dept; "REIT" = Real Estate Investment Trust;
  // "G7" = political summit; "Wi-Fi" = wireless standard; "M&A" = investment activity.
  if (wc === 1 && SLOT_INSTITUTIONAL_ACRONYM.has(lower)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${lower}:institutional-acronym]→collective-entity` };
  }
  // Two-word name ending in a known institutional acronym suffix
  if (wc === 2 && SLOT_INSTITUTIONAL_ACRONYM.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[...]+[${last}:institutional-acronym]→category-phrase` };
  }

  // ── Reasoning Test 3: Bare profession/demographic plural → category label ──
  // A word that is the plural of a job title or demographic group names a
  // CATEGORY of people, not a company. "Prosecutors", "Men", "Contractors".
  // This is a semantic inference: plurals of human roles are not brand names.
  if (wc === 1 && SLOT_PROFESSION_PLURAL.has(lower)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${lower}:profession-plural]→demographic-category` };
  }
  // Multi-word ending in a profession plural = "Independent Contractors" etc.
  if (wc >= 2 && SLOT_PROFESSION_PLURAL.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[...]+[${last}:profession-plural]→category-phrase` };
  }

  // ── Reasoning Test 4: Bare gerund → ongoing action, not a brand ────────────
  // A present-participle verb used alone is a description of an activity.
  // "Moving" = in motion; "Speaking" = giving speech; "Flying" = in flight.
  // Real startups named with gerunds add a qualifier: "Moving Tomorrow", "FlyingCar".
  // A lone gerund has no brand identity — it is the action itself.
  if (wc === 1 && SLOT_BARE_GERUND.has(lower)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${lower}:bare-gerund]→activity-description` };
  }
  // ── Reasoning Test 4b: 2-word name ending in a bare gerund ─────────────────
  // "Memory Solving", "Problem Solving", "Data Keeping", "System Monitoring"
  // A noun + gerund without brand morphology = a capability description, not a brand.
  if (wc === 2 && SLOT_BARE_GERUND.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[noun]+[${last}:gerund-last]→capability-description` };
  }

  // ── Reasoning Test 5: AI model version string ──────────────────────────────
  // "Llama-3.1-8B", "GPT-4o", "Claude-3-Sonnet" are model identifiers.
  // They always start with a known model family name followed by version digits.
  if (AI_MODEL_VERSION_RE.test(lower)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${lower}:ai-model-version]→model-identifier` };
  }

  // ── Reasoning Test 6: All words are common function/generic English words ──
  // A 2–3 word phrase where EVERY word is a common English word with no unusual
  // combination, no startup morphology, and no known brand element is very likely
  // a descriptor or scraped phrase fragment.
  //
  // Logic: we maintain a set of common "non-brand" English words.  If ALL words
  // in the name match this set, there is no invented element → not a startup brand.
  //
  // This is semantic inference: if you can fully decode the phrase with plain
  // English vocabulary and it forms a common concept, it isn't a brand name.
  const COMMON_ENGLISH_NONBRAND = new Set([
    // Everyday nouns (abstract)
    'food', 'home', 'money', 'time', 'life', 'work', 'space', 'world',
    'care', 'help', 'way', 'place', 'game', 'story', 'town', 'city',
    'land', 'farm', 'park', 'road', 'path', 'bridge', 'door', 'window',
    'media', 'news', 'press', 'data', 'cloud', 'base', 'hub', 'net',
    'web', 'app', 'bot', 'code', 'tech', 'lab', 'box', 'core', 'edge',
    'flow', 'link', 'node', 'point', 'site', 'source', 'port', 'gate',
    // Everyday verbs (base form, not gerunds)
    'make', 'build', 'create', 'connect', 'serve', 'solve', 'run',
    'save', 'find', 'get', 'give', 'send', 'pay', 'buy', 'sell',
    'open', 'close', 'go', 'move', 'grow', 'drive', 'track', 'share',
    // Everyday adjectives
    'new', 'good', 'fast', 'smart', 'clean', 'clear', 'open', 'free',
    'safe', 'simple', 'easy', 'direct', 'live', 'real', 'true', 'pure',
    'bright', 'bold', 'big', 'small', 'high', 'low', 'deep', 'wide',
    // Domain/industry modifiers (generic when alone)
    'digital', 'cyber', 'virtual', 'mobile', 'social', 'global', 'local',
    'quantum', 'bio', 'nano', 'micro', 'macro', 'multi', 'cross', 'inter',
    'auto', 'self', 'semi', 'super', 'ultra', 'hyper', 'infra',
    // Activity nouns
    'delivery', 'service', 'solution', 'platform', 'system', 'network',
    'market', 'exchange', 'trade', 'compute', 'compute', 'process',
    'manage', 'operate', 'perform', 'execute', 'deploy', 'scale',
    // Motion/state adjectives
    'alone', 'away', 'back', 'down', 'up', 'out', 'off', 'on', 'in',
    'over', 'under', 'around', 'between', 'within', 'beyond', 'across',
    // People/group nouns
    'people', 'person', 'team', 'group', 'community', 'network', 'family',
    'public', 'private', 'corporate', 'enterprise', 'business', 'company',
    // Numeric / size words
    'one', 'two', 'three', 'six', 'ten', 'hundred', 'first', 'second',
          // Continent / geographic qualifiers used as modifiers
          'northern', 'southern', 'eastern', 'western', 'central',
          'north', 'south', 'east', 'west',
          // National adjectives as phrase starters — "American Exchange" = geography + category
          'american', 'european', 'asian', 'african', 'global', 'international',
          'national', 'regional', 'local', 'domestic', 'foreign',
          // Country names that appear as first word of common phrases
          'taiwan', 'india', 'china', 'japan', 'korea', 'france', 'germany',
    // Common tech category words
    'computing', 'intelligence', 'learning', 'analytics', 'security',
    'privacy', 'identity', 'access', 'storage', 'performance',
    'fitness', 'health', 'wellness', 'beauty', 'fashion', 'sport',
    'finance', 'credit', 'payment', 'banking', 'insurance', 'wealth',
    'support', 'vehicle', 'vehicles', 'hand', 'hands', 'tool', 'tools',
    'stocks', 'stock', 'trading', 'segment',
          // Common spoken / cultural words that aren't brand names alone
          'voice', 'vibe', 'mood', 'tone', 'style', 'culture', 'content',
          'scene', 'moment', 'movement', 'trend', 'wave', 'shift', 'change',
          // Entertainment / media industry nouns
          'music', 'entertainment', 'media', 'film', 'video', 'audio',
          'gaming', 'sports', 'fashion', 'travel', 'retail', 'hospitality',
          // Note: animal names intentionally excluded — many real startups use animal names
          // (Panda, Bear, Fox, Eagle). They are blocked as PLURALS via SLOT_PROFESSION_PLURAL.
    // Ownership / organizational concepts
    'ownership', 'equity', 'control', 'governance', 'authority', 'power',
          // Common programming / tech cultural terms
          'coding', 'hacking', 'scripting', 'testing', 'debugging', 'shipping',
  'polling', 'scrolling', 'swiping', 'clicking', 'typing', 'browsing',
          // Food / everyday physical objects used as phrase nouns
          'burger', 'sandwich', 'pizza', 'coffee', 'beer', 'wine', 'cake',
          'bag', 'bags', 'box', 'boxes', 'tray', 'bin', 'crate',
          // Adjective + object combinations
          'worth', 'worthy', 'worthy',
          // Color / appearance
          'secret', 'hidden', 'silent', 'blind', 'dark', 'light',
          // Generic single nouns used as descriptors
          'dashboard', 'portal', 'console', 'panel', 'screen', 'display',
          'berry', 'cherry', 'apple', 'orange', 'lime', 'grape',
    // Clearly generic single words that lack startup brand identity
    'corp', 'corps', 'succeed', 'success', 'resource', 'resources',
    'graph', 'graphs', 'command', 'commands', 'view', 'views',
    'locator', 'finder', 'checker', 'monitor', 'tracker',
    'bot', 'bots', 'agent', 'daemon',
  ]);
  const allNonBrand = lowerWords.every(w => COMMON_ENGLISH_NONBRAND.has(w));
  if (allNonBrand && wc >= 2) {
    return { track: 'descriptor', confidence: 'medium', reason: `[all-common-words:${lowerWords.join('+')}]→plain-english-phrase` };
  }
  // Single-word common English words with no brand morphology are not startup names.
  // We distinguish two cases:
  //   (a) All-lowercase submission = clearly not branded (pass through to GENERIC_SINGLE_WORDS
  //       in validator, or catch here)
  //   (b) Title-case single word = potentially branded (e.g. "Save", "Notion") — only block
  //       if the word is in the DEFINITELY_NOT_BRAND subset (abbrevs, junk words)
  const hasCamelCase = /[A-Z][a-z]+[A-Z]/.test(trimmed);
  const DEFINITELY_NOT_BRAND = new Set([
    // Abbreviations and junk labels that are never startup names
    'corp', 'corps', 'llc', 'inc', 'ltd', 'plc', 'co',
    // Pure generic nouns used only as category labels in startup context
    'succeed', 'success',
    'locator', 'finder', 'checker', 'daemon',
    // "bot" / "agent" alone = too generic; real startups use compounds (ChatBot, HelpBot)
    'bot', 'bots', 'agent', 'agents',
    // Pronoun / adjective tokens RSS uses as standalone "entities"
    'each', 'bold',
    // Generic abstract nouns commonly scraped
    'graph', 'graphs', 'resource', 'resources',
    // Single-word topic labels
    'command', 'commands', 'view', 'views',
  ]);

  /**
   * Single-token Title Case strings that RSS/headline scrapers store as `name` but are
   * almost never standalone company brands (UI debris, common English, or news labels).
   * Kept separate from DEFINITELY_NOT_BRAND so we can expand without conflating abbrev rules.
   */
  const SINGLE_TOKEN_HEADLINE_SCRAPE = new Set([
    // Dev / doc debris
    'todo', 'readme', 'readmes', 'urls', 'url', 'cli', 'clis', 'gddr', 'json-ld', 'jsonld',
    // Common English / grammar scraped as entities (Title Case from RSS)
    'percentage', 'failed', 'compared', 'started', 'rename', 'renamed', 'validate', 'validates',
    'judgment', 'judgement', 'attraction', 'responsibilities', 'mainstream', 'equipment',
    'insiders', 'outsider', 'outsiders', 'optics', 'dentistry', 'bronchoscopy', 'stakeholder',
    'stakeholders', 'diversify', 'burgum', 'waits', 'greatness', 'morale', 'shack',
    'jain', 'polit', 'amharic', 'pairs', 'peoples',
    // Reference / media words mistaken for companies
    'wikipedia', 'encyclopedia', 'statnews',
    // Headline topic nouns (rarely a one-word legal name in isolation)
    'planets', 'storms', 'internals', 'ticketing', 'militaries', 'caution', 'lightbulbs', 'bulbs',
    'paragraph', 'purely', 'trenches', 'relevance', 'unreleased', 'exceptions', 'convenience',
    'flowers', 'sending', 'exploration', 'explorations', 'roast', 'compared',
  ]);

  if (wc === 1 && !hasCamelCase) {
    // Block if all-lowercase AND in COMMON_ENGLISH_NONBRAND
    if (trimmed === lower && COMMON_ENGLISH_NONBRAND.has(lower)) {
      return { track: 'descriptor', confidence: 'medium', reason: `[${lower}:lowercase-common-word]→plain-label` };
    }
    // Block title-case words only if they're in the DEFINITELY_NOT_BRAND set
    if (DEFINITELY_NOT_BRAND.has(lower)) {
      return { track: 'descriptor', confidence: 'high', reason: `[${lower}:non-brand-abbreviation]→category-label` };
    }
    if (SINGLE_TOKEN_HEADLINE_SCRAPE.has(lower)) {
      return { track: 'descriptor', confidence: 'high', reason: `[${lower}:headline-scrape-token]→rss-fragment` };
    }
  }

  // ── Reasoning Test 7: Geographic + qualifier compound = location phrase ─────
  // "Northern California Based" — starts with a directional geographic word,
  // ends with "based" or a geographic suffix.  This is a location description.
  const GEO_DIRECTION_FIRST = new Set(['northern', 'southern', 'eastern', 'western', 'central', 'greater', 'lower', 'upper']);
  const GEO_TERMINAL = new Set(['based', 'region', 'area', 'valley', 'coast', 'bay', 'corridor', 'hub', 'metro', 'district']);
  if (wc >= 2 && GEO_DIRECTION_FIRST.has(first) && GEO_TERMINAL.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[geo-direction]+[...]+[geo-terminal]→location-description` };
  }
  if (wc >= 3 && GEO_DIRECTION_FIRST.has(first)) {
    return { track: 'descriptor', confidence: 'medium', reason: `[geo-direction:${first}]+[3+words]→location-phrase` };
  }

  // ── Reasoning Test 8: [Entity] + [Entity] from expanded major-entity set ────
  // "General Catalyst YC" → General (VC) + Catalyst + YC (known accelerator)
  // "SC Ventures Ripple" → SC Ventures (VC fund) + Ripple (crypto entity)
  const SLOT_KNOWN_ACCELERATOR = new Set(['yc', 'ycombinator', 'techstars', 'antler', 'founder', 'founders']);
  const hasAccelerator = lowerWords.some(w => SLOT_KNOWN_ACCELERATOR.has(w));
  if (hasAccelerator && wc >= 2) {
    return { track: 'investor', confidence: 'high', reason: `[...]+[accelerator-brand]→investor-compound` };
  }
  // [VC-part in middle] + [known entity as last word] = VC fund + portfolio entity headline
  // "SC Ventures Ripple" → 'ventures' in middle, 'ripple' in SLOT_KNOWN_MAJOR_ENTITY
  const venturesInMiddle = middle.includes('ventures') || middle.includes('capital') || middle.includes('partners');
  if (venturesInMiddle && majorEntityCount >= 1) {
    return { track: 'investor', confidence: 'high', reason: `[vc-part-in-middle]+[entity]→fund-entity-compound` };
  }

  // ── Reasoning Test 9: Repeated identical word = duplicate scraped token ─────
  // "LVMH LVMH" — same token twice in a row. Never a real company name.
  if (wc >= 2 && lowerWords[0] === lowerWords[1]) {
    return { track: 'descriptor', confidence: 'high', reason: `[${lowerWords[0]}:repeated-token]→duplicate-scrape-artifact` };
  }

  // ── Reasoning Test 10: Roman numeral suffix on VC/fund-adjacent word ────────
  // "NGT HealthCare II" — ends with Roman numeral = fund series.
  // Only fires when first word is NOT a known startup brand (avoids blocking Pokémon Go II).
  const ROMAN_NUMERAL_RE = /^(I{1,3}|IV|V|VI{0,3}|IX|X)$/i;
  if (ROMAN_NUMERAL_RE.test(last) && wc >= 2) {
    return { track: 'investor', confidence: 'high', reason: `[...]+[${last}:roman-numeral]→fund-series` };
  }

  // ── Reasoning Test 11: European surname prefixes as first word of 3-word name
  // "Van Der Beek", "De La Cruz", "Von Braun", "Du Pont" → Dutch/French/German surname patterns
  // These are person names, not brands. Real companies named "Van der X" are rare and
  // typically would have a URL; they won't be in the needs_url pool.
  const EURO_NAME_PREFIX = new Set(['van', 'der', 'de', 'von', 'du', 'di', 'la', 'le', 'den', 'da']);
  if (wc === 3 && EURO_NAME_PREFIX.has(first) && EURO_NAME_PREFIX.has(lowerWords[1])) {
    return { track: 'descriptor', confidence: 'high', reason: `[${first}:euro-surname-prefix]+[...]→person-name` };
  }
  if (wc === 2 && EURO_NAME_PREFIX.has(first)) {
    // "De Silva" "Van Beek" etc. — ambiguous but likely surname
    return { track: 'descriptor', confidence: 'medium', reason: `[${first}:euro-surname-prefix]+[word]→probable-person-name` };
  }

  // ── Reasoning Test 12b: Known major entity + generic category words = division/product ─
  // "Tencent Music Entertainment" → Tencent (known) + common words → product division
  // "Food Panda Taiwan" → 'panda' in profession_plural (animal), 'taiwan' = country
  // If the first OR last word is a known major entity and ALL OTHER words are in
  // COMMON_ENGLISH_NONBRAND or SLOT_KNOWN_MAJOR_ENTITY → this is a headline/division, not a startup
  if (wc === 3) {
    const [w0, w1, w2] = lowerWords;
    const othersAreCommon = (a, b) =>
      (COMMON_ENGLISH_NONBRAND.has(a) || SLOT_KNOWN_MAJOR_ENTITY.has(a)) &&
      (COMMON_ENGLISH_NONBRAND.has(b) || SLOT_KNOWN_MAJOR_ENTITY.has(b));
    if (SLOT_KNOWN_MAJOR_ENTITY.has(w0) && othersAreCommon(w1, w2)) {
      return { track: 'descriptor', confidence: 'medium', reason: `[${w0}:entity]+[common+common]→known-entity-division` };
    }
    if (SLOT_KNOWN_MAJOR_ENTITY.has(w2) && othersAreCommon(w0, w1)) {
      return { track: 'descriptor', confidence: 'medium', reason: `[common+common]+[${w2}:entity]→known-entity-division` };
    }
  }

  // ── Reasoning Test 12a: Known-entity + adverb/conjunction = compound headline ─
  // "India Even" → SLOT_KNOWN_MAJOR_ENTITY('india') + adverb('even')
  // "Coinbase Prime" → known entity + qualifier
  // "Slack Channel" → major entity + channel (too generic a combo to be a new startup)
  const ENTITY_COMPANION_WORDS = new Set([
    'even', 'still', 'yet', 'too', 'also', 'indeed', 'only', 'barely', 'nearly',
    'prime', 'plus', 'pro', 'lite', 'mini', 'max', 'ultra', 'enterprise',
    'channel', 'account', 'app', 'platform', 'tool', 'suite', 'hub',
    'managed', 'powered', 'backed', 'owned', 'funded', 'led',
  ]);
  if (wc === 2 && majorEntityCount === 1 && SLOT_KNOWN_MAJOR_ENTITY.has(first) && ENTITY_COMPANION_WORDS.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${first}:entity]+[${last}:companion]→known-entity-product-or-fragment` };
  }
  // If last word is a known major entity + first word is generic = reversed compound
  if (wc === 2 && majorEntityCount === 1 && SLOT_KNOWN_MAJOR_ENTITY.has(last)) {
    const GENERIC_FIRST = new Set(['mobile', 'enterprise', 'cloud', 'digital', 'smart', 'neo', 'meta', 'hyper', 'open', 'new', 'core']);
    if (GENERIC_FIRST.has(first)) {
      return { track: 'descriptor', confidence: 'medium', reason: `[${first}:generic]+[${last}:entity]→generic-entity-compound` };
    }
  }

  // ── Reasoning Test 12: Three-word phrase with known person-name signal ───────
  // "David Foster Wallace" = 3-word famous person name pattern
  // "Steven Bartlett" = 2-word, caught by TITLE_CASE_TWO_WORDS in startupNameValidator
  // Here we catch 3-word names: [First] [Middle] [Last] where all are title-case common words
  // Heuristic: 3-word all-title-case name where no word is a startup suffix
  //   AND no word is an invented word (i.e., all words look like English words)
  //   AND the first or last word is a known common given/surname signal
  const COMMON_GIVEN_NAMES_ENGINE = new Set([
    'david', 'james', 'john', 'robert', 'michael', 'william', 'richard', 'thomas',
    'charles', 'christopher', 'daniel', 'matthew', 'andrew', 'joseph', 'mark',
    'mary', 'jennifer', 'linda', 'barbara', 'patricia', 'elizabeth', 'susan',
    'jessica', 'sarah', 'karen', 'lisa', 'margaret', 'betty', 'dorothy',
    'steven', 'stephen', 'peter', 'paul', 'george', 'henry', 'edward',
    'sean', 'ryan', 'kevin', 'brian', 'scott', 'eric', 'adam', 'jason',
    'victor', 'allen', 'steven', 'raymond', 'dennis', 'martin', 'aaron',
    'vitaly', 'dmitri', 'sergei', 'nikolai', 'ivan', 'alexander', 'alexei',
    'manuel', 'carlos', 'francisco', 'juan', 'luis', 'miguel', 'jose',
  ]);
  const COMMON_SURNAMES_ENGINE = new Set([
    'smith', 'johnson', 'williams', 'jones', 'brown', 'davis', 'miller',
    'wilson', 'moore', 'taylor', 'anderson', 'thomas', 'jackson', 'white',
    'harris', 'martin', 'thompson', 'garcia', 'martinez', 'robinson',
    'clark', 'rodriguez', 'lewis', 'lee', 'walker', 'hall', 'allen',
    'young', 'hernandez', 'king', 'wright', 'lopez', 'hill', 'scott',
    'green', 'adams', 'baker', 'gonzalez', 'nelson', 'carter', 'mitchell',
    'perez', 'roberts', 'turner', 'phillips', 'campbell', 'parker', 'evans',
    // Known person surnames that appear in the logs
    'bartlett', 'penn', 'ryan', 'agarwal', 'sacks', 'markkula',
    'wallace', 'foster', 'beek', 'bartlett',
    // Investor/exec surnames
    'dalio', 'ackman', 'buffett', 'munger', 'simons', 'griffin',
  ]);
  if (wc === 3) {
    const [fa, fb, fc] = lowerWords;
    const isPersonName = (
      (COMMON_GIVEN_NAMES_ENGINE.has(fa) && (COMMON_SURNAMES_ENGINE.has(fb) || COMMON_SURNAMES_ENGINE.has(fc))) ||
      (COMMON_GIVEN_NAMES_ENGINE.has(fb) && COMMON_SURNAMES_ENGINE.has(fc))
    );
    if (isPersonName) {
      return { track: 'descriptor', confidence: 'high', reason: `[${fa}:given]+[middle]+[${fc}:surname]→3-word-person-name` };
    }
  }
  if (wc === 2 && COMMON_GIVEN_NAMES_ENGINE.has(first) && COMMON_SURNAMES_ENGINE.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[${first}:given]+[${last}:surname]→person-name` };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // END OF "WHAT IS THIS?" GATE
  // ──────────────────────────────────────────────────────────────────────────

  // ── Template: Startup morphology ──────────────────────────────────────────

  // CamelCase single word = very strong startup signal (HubSpot, DoorDash)
  // EXCEPTION: Irish/Scottish Mc/Mac surname prefix (McCabe, MacDonald, McGregor)
  // and GitHub-style known company names — these are people names / known entities,
  // not invented startup brand words.
  const MC_MAC_SURNAME_RE = /^M[ac][A-Z][a-z]+$/;
  const isMcMacSurname = MC_MAC_SURNAME_RE.test(trimmed);
  if (wc === 1 && /^[A-Z][a-z]+[A-Z][a-zA-Z0-9]*$/.test(trimmed) && !isMcMacSurname) {
    return { track: 'startup', confidence: 'high', reason: `[CamelCase]→startup-brand` };
  }
  // Mc/Mac surname = person name, not startup brand
  if (isMcMacSurname) {
    return { track: 'descriptor', confidence: 'high', reason: `[${lower}:mc-mac-surname]→person-name` };
  }

  // Multi-word name where last word is explicitly a non-brand abbreviation or generic label
  // e.g. "GitLab Duo Agent" → 'agent' is in DEFINITELY_NOT_BRAND
  if (wc >= 2 && DEFINITELY_NOT_BRAND.has(last)) {
    return { track: 'descriptor', confidence: 'high', reason: `[...]+[${last}:non-brand-last-word]→category-phrase` };
  }

  // [Brand] + [Startup-suffix]: last word positively identifies as startup type
  if (SLOT_LAST_STARTUP.has(last) && wc <= 3) {
    return { track: 'startup', confidence: 'high', reason: `[brand]+[${last}:startup-suffix]→startup` };
  }

  // Single word — passed all blocklists and pattern checks → plausible startup
  if (wc === 1) {
    return { track: 'startup', confidence: 'medium', reason: `[single-word]→plausible-startup` };
  }

  // Two-word name with no red flags from any slot → reasonable startup candidate
  if (wc === 2) {
    return { track: 'startup', confidence: 'medium', reason: `[word]+[word]→two-word-brand` };
  }

  // Three-word name, no pattern matches — lower confidence but still plausible
  if (wc === 3) {
    return { track: 'startup', confidence: 'low', reason: `[3words-unresolved]→possible-startup` };
  }

  // Should not reach here (4+ words handled above) — default to descriptor
  return { track: 'descriptor', confidence: 'low', reason: `[unresolved-long-phrase]→descriptor` };
}

/**
 * Simplified boolean gate for integration with entityResolutionGate.js
 *
 * @param {string} name
 * @returns {{ isStartup: boolean, track: string, confidence: string, reason: string }}
 */
function isPlausibleStartupName(name) {
  const result = classifyEntityTrack(name);
  return {
    isStartup:  result.track === 'startup',
    track:      result.track,
    confidence: result.confidence,
    reason:     result.reason,
  };
}

module.exports = { classifyEntityTrack, isPlausibleStartupName };
