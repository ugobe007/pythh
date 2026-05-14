'use strict';

/**
 * NAME ENTITY ONTOLOGY
 *
 * Inspired by ontological classification principles: instead of maintaining
 * ad-hoc lists of individual bad names, we define SEMANTIC WORD CATEGORIES
 * (ontology classes) and classify name strings by what word-types they contain.
 *
 * Ontological hierarchy:
 *   Entity
 *   ├── GeographicEntity   (continent, territory, city, region)
 *   ├── PersonEntity       (public figures — broader coverage than startupNameValidator)
 *   ├── BrandEntity        (Fortune 500 / legacy consumer brands — clearly not startups)
 *   ├── MediaEntity        (news outlets, publications, broadcast networks)
 *   └── GovernmentEntity   (federal agencies, regulatory bodies, international orgs)
 *
 * For each class we define:
 *   - TOKEN_SET   — individual words that belong to this category
 *   - PATTERN_SET — structural regex patterns (word-order / positional)
 *
 * Usage:
 *   const { classifyEntityType, isNonStartupEntity } = require('./nameEntityOntology');
 *   classifyEntityType('Lululemon')       → 'brand'
 *   classifyEntityType('Antarctica')      → 'geographic'
 *   classifyEntityType('Garry Tan')       → 'person'
 *   isNonStartupEntity('Lululemon')       → true
 */

// ─────────────────────────────────────────────────────────────────────────────
// GEOGRAPHIC CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Continents and major geographic regions — never startup names.
 * Note: countries are handled by COUNTRY_SINGLE_WORDS in startupNameValidator.js.
 */
const GEO_CONTINENTS = new Set([
  'africa', 'antarctica', 'arctic', 'asia', 'australasia', 'europe',
  'eurasia', 'oceania', 'latin america', 'middle east', 'north america',
  'south america', 'sub-saharan africa', 'southeast asia', 'central asia',
  'central europe', 'eastern europe', 'western europe', 'south asia',
  'east asia', 'west africa', 'east africa', 'southern africa', 'north africa',
  'the caribbean', 'caribbean', 'micronesia', 'melanesia', 'polynesia',
]);

/**
 * De-facto territories, disputed regions, and autonomous areas —
 * often scraped as entity names from geopolitical news.
 */
const GEO_TERRITORIES = new Set([
  'greenland', 'hong kong', 'macau', 'macao', 'taiwan', 'puerto rico',
  'guam', 'fiji', 'bali', 'borneo', 'sumatra', 'java', 'mindanao',
  'palestine', 'gaza', 'west bank', 'golan', 'kashmir', 'xinjiang',
  'tibet', 'crimea', 'donbas', 'kurdistan', 'catalonia', 'flanders',
  'somaliland', 'transnistria', 'abkhazia', 'nagorno-karabakh',
  'faroe islands', 'isle of man', 'jersey', 'guernsey', 'gibraltar',
  'reunion', 'martinique', 'guadeloupe', 'french guiana', 'new caledonia',
  'french polynesia', 'wallis futuna', 'mayotte', 'saint martin',
]);

/**
 * Geographic suffix words — when these appear at the END of a name string,
 * the string is likely a location descriptor, not a company.
 * e.g. "Woodruff Place Indianapolis" → ends with city name → geographic
 */
const GEO_SUFFIX_WORDS = new Set([
  'county', 'township', 'parish', 'borough', 'district', 'precinct',
  'municipality', 'prefecture', 'province', 'territory', 'region',
  'village', 'hamlet', 'settlement', 'suburb', 'quarter', 'neighborhood',
  'heights', 'hills', 'ridge', 'creek', 'springs', 'hollow', 'canyon',
  'bluff', 'bay', 'inlet', 'cove', 'cape', 'peninsula', 'strait', 'delta',
  'plateau', 'basin', 'basin', 'plain', 'prairie', 'savanna', 'tundra',
  'glacier', 'volcano', 'crater', 'archipelago', 'atoll',
  // "Place" is a geographic suffix in addresses ("Woodruff Place")
  // but "Place" can also be a company name — only flag if combined with a city
  'place', 'crossing', 'junction', 'corridor', 'gateway', 'hub',
]);

/**
 * Major US cities not covered by COUNTRY_SINGLE_WORDS in startupNameValidator.
 * Appear in names like "Woodruff Place Indianapolis" or "Accelerate Indianapolis".
 */
const MAJOR_US_CITIES = new Set([
  'indianapolis', 'minneapolis', 'jacksonville', 'charlotte', 'columbus',
  'memphis', 'nashville', 'baltimore', 'milwaukee', 'albuquerque',
  'tucson', 'fresno', 'sacramento', 'mesa', 'omaha', 'raleigh',
  'long beach', 'virginia beach', 'atlanta', 'colorado springs',
  'tampa', 'new orleans', 'cleveland', 'anaheim', 'lexington',
  'henderson', 'stockton', 'riverside', 'corpus christi',
  'irvine', 'st louis', 'pittsburgh', 'anchorage', 'cincinnati',
  'greensboro', 'plano', 'newark', 'toledo', 'orlando',
  'wichita', 'bakersfield', 'laredo', 'madison', 'lubbock',
  'durham', 'spokane', 'baton rouge', 'des moines', 'winston-salem',
  'dayton', 'columbia', 'akron', 'tulsa', 'rochester', 'kansas city',
  'brooklyn', 'queens', 'bronx', 'manhattan', 'staten island',
  'east bay', 'bay area', 'silicon valley', 'research triangle',
  'greater boston', 'greater chicago', 'greater la', 'greater nyc',
]);

/** Major international cities frequently scraped from global business news */
const MAJOR_INTL_CITIES = new Set([
  'dubai', 'abu dhabi', 'shenzhen', 'shanghai', 'beijing', 'guangzhou',
  'chengdu', 'hangzhou', 'wuhan', 'nanjing', 'tianjin', 'xi an',
  'seoul', 'busan', 'osaka', 'kyoto', 'tokyo', 'yokohama',
  'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune',
  'kolkata', 'ahmedabad', 'jaipur', 'surat', 'noida', 'gurgaon',
  'jakarta', 'manila', 'kuala lumpur', 'ho chi minh', 'hanoi',
  'bangkok', 'yangon', 'dhaka', 'karachi', 'lahore', 'islamabad',
  'cairo', 'casablanca', 'lagos', 'nairobi', 'johannesburg',
  'cape town', 'accra', 'addis ababa', 'kampala', 'dar es salaam',
  'mexico city', 'sao paulo', 'buenos aires', 'bogota', 'lima',
  'santiago', 'caracas', 'quito', 'montevideo',
  'moscow', 'st. petersburg', 'kyiv', 'warsaw', 'prague', 'budapest',
  'bucharest', 'sofia', 'belgrade', 'zagreb', 'bratislava', 'vilnius',
  'riga', 'tallinn', 'helsinki', 'oslo', 'copenhagen', 'zurich',
  'geneva', 'brussels', 'vienna', 'rotterdam', 'antwerp',
]);

// ─────────────────────────────────────────────────────────────────────────────
// BRAND CLASS — Fortune 500 / legacy consumer brands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Established brands that unambiguously are NOT startups.
 * Organized by vertical for easy maintenance and review.
 * Rule: only add if the brand is at least 10+ years old and publicly traded
 * OR is a household name with >$1B revenue.
 */
const ESTABLISHED_BRANDS = new Set([
  // ── Apparel / athletic wear
  'lululemon', 'gap', 'old navy', 'banana republic', 'nordstrom',
  'bloomingdales', 'macys', 'jcpenney', 'sears', 'kmart',
  'patagonia', 'the north face', 'columbia sportswear',
  'under armour', 'vans', 'converse', 'reebok', 'puma',
  'levi strauss', 'levis', 'wrangler', 'dockers', 'tommy hilfiger',
  'calvin klein', 'ralph lauren', 'lacoste', 'burberry', 'gucci',
  'louis vuitton', 'hermes', 'chanel', 'prada', 'versace',
  'armani', 'zara', 'h&m', 'uniqlo', 'forever 21', 'express',
  // ── Food / beverage / CPG
  'mcdonalds', 'starbucks', 'subway', 'burger king', 'wendys',
  'taco bell', 'chipotle', 'panera', 'dunkin', 'kfc', 'pizza hut',
  'dominos', 'papa johns', 'little caesars', 'chick-fil-a',
  'nestle', 'unilever', 'kraft heinz', 'mondelez', 'pepsico',
  'coca-cola', 'dr pepper', 'red bull', 'monster energy',
  'general mills', 'kellogg', 'campbells', 'conagra', 'hershey',
  // ── Retail
  'walmart', 'target', 'costco', 'sams club', 'bjs', 'aldi',
  'kroger', 'whole foods', 'trader joes', 'publix', 'safeway',
  'walgreens', 'cvs', 'rite aid', 'dollar general', 'dollar tree',
  'best buy', 'home depot', 'lowes', 'ace hardware', 'bed bath beyond',
  'macys', 'nordstrom', 'neiman marcus', 'saks fifth avenue',
  // ── Automotive
  'toyota', 'honda', 'ford', 'chevrolet', 'general motors',
  'bmw', 'mercedes-benz', 'volkswagen', 'audi', 'porsche',
  'lexus', 'hyundai', 'kia', 'nissan', 'subaru', 'mazda', 'volvo',
  'ferrari', 'lamborghini', 'bentley', 'rolls-royce', 'maserati',
  'jeep', 'dodge', 'chrysler', 'ram', 'gmc', 'buick', 'cadillac',
  'lincoln', 'acura', 'infiniti', 'genesis', 'mitsubishi',
  // ── Established tech (not startups)
  'microsoft', 'apple', 'google', 'amazon', 'meta', 'netflix',
  'oracle', 'sap', 'ibm', 'intel', 'qualcomm', 'cisco',
  'dell', 'hp', 'lenovo', 'asus', 'acer', 'toshiba',
  'samsung', 'sony', 'lg', 'panasonic', 'philips', 'siemens',
  'bosch', 'hitachi', 'fujitsu', 'nec', 'sharp',
  // ── Finance / banking
  'jpmorgan', 'chase', 'wells fargo', 'citibank', 'bank of america',
  'barclays', 'hsbc', 'ubs', 'credit suisse', 'deutsche bank',
  'bnp paribas', 'societe generale', 'santander', 'ing',
  'visa', 'mastercard', 'american express', 'discover',
  'fidelity', 'vanguard', 'blackrock', 'state street', 'pimco',
  'charles schwab', 'td ameritrade', 'etrade', 'robinhood',
  // ── Healthcare / pharma
  'johnson & johnson', 'pfizer', 'merck', 'abbvie', 'eli lilly',
  'bristol-myers squibb', 'gilead', 'amgen', 'biogen', 'regeneron',
  'unitedhealth', 'anthem', 'cigna', 'humana', 'aetna', 'centene',
  // ── Insurance
  'state farm', 'allstate', 'geico', 'progressive', 'liberty mutual',
  'usaa', 'farmers', 'nationwide', 'travelers', 'chubb', 'aig',
  // ── Telecom / cable
  'at&t', 'verizon', 'tmobile', 't-mobile', 'sprint',
  'comcast', 'xfinity', 'cox', 'charter', 'spectrum',
  'centurylink', 'lumen', 'dish', 'directv',
  // ── Airlines / travel
  'american airlines', 'delta', 'united airlines', 'southwest',
  'jetblue', 'alaska airlines', 'spirit', 'frontier',
  'lufthansa', 'british airways', 'air france', 'klm', 'emirates',
  'qantas', 'singapore airlines', 'cathay pacific',
  'marriott', 'hilton', 'hyatt', 'ihg', 'wyndham', 'accor',
  'expedia', 'booking', 'trivago', 'priceline',
  // ── Energy
  'exxonmobil', 'chevron', 'shell', 'bp', 'totalenergies',
  'conocophillips', 'valero', 'marathon', 'phillips 66',
  'duke energy', 'nextera', 'southern company', 'dominion',
  'pg&e', 'con edison', 'firstenergy', 'exelon',
  // ── Entertainment / media brands (not media outlets — see below)
  'disney', 'comcast', 'nbcuniversal', 'viacom', 'cbs', 'abc',
  'nbc', 'fox', 'warner bros', 'sony pictures', 'mgm', 'paramount',
  'nickelodeon', 'discovery', 'hbo', 'showtime', 'hulu',
  'spotify', 'pandora', 'sirius xm',
]);

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA CLASS — News outlets & publications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * News outlets and publications that the RSS scraper frequently surfaces as
 * fake "startup names." These are media entities, not companies seeking funding.
 */
const MEDIA_OUTLETS = new Set([
  // Tech / startup press
  'techcrunch', 'venturebeat', 'the information', 'wired', 'engadget',
  'ars technica', 'the verge', 'mashable', 'recode', 'protocol',
  'sifted', 'crunchbase news', 'pitchbook', 'product hunt',
  // Business press
  'bloomberg', 'reuters', 'associated press', 'dow jones',
  'wsj', 'wall street journal', 'new york times', 'nyt',
  'washington post', 'wapo', 'financial times', 'ft',
  'the economist', 'fortune', 'forbes', 'inc', 'fast company',
  'harvard business review', 'hbr', 'mit technology review',
  'business insider', 'axios', 'politico', 'semafor', 'the atlantic',
  // Broadcast
  'cnbc', 'cnn', 'bbc', 'msnbc', 'fox news', 'abc news', 'nbc news',
  'cbs news', 'pbs', 'npr', 'al jazeera', 'sky news',
  // Tech aggregators
  'hacker news', 'ycombinator news', 'reddit', 'slashdot',
  'techmeme', 'digg', 'dzone', 'dev.to', 'medium',
]);

// ─────────────────────────────────────────────────────────────────────────────
// PERSON CLASS — International name coverage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * International given names not covered by COMMON_GIVEN_NAMES in startupNameValidator.
 * Organized by region. Used in conjunction with INTL_SURNAMES to detect
 * "[FirstName] [LastName]" patterns that are people, not startups.
 *
 * Note: "Garry Tan", "Demis Hassabis", "Ilya Sutskever" etc. are
 * well-known individuals but their first names aren't in COMMON_GIVEN_NAMES.
 */
const INTL_GIVEN_NAMES = new Set([
  // South Asian
  'aarav', 'abhishek', 'aditya', 'ajay', 'akash', 'akshay', 'amit',
  'anil', 'anita', 'arjun', 'aryan', 'ashish', 'ashok', 'atul',
  'deepak', 'deepika', 'divya', 'gaurav', 'gopal', 'hemant', 'kamal',
  'kapil', 'kiran', 'kunal', 'lalit', 'manoj', 'mihir', 'mohan',
  'mukesh', 'naveen', 'neeraj', 'neha', 'nikhil', 'nitin', 'pankaj',
  'pooja', 'pradeep', 'pranav', 'prashant', 'prateek', 'priyanka',
  'rajesh', 'rakesh', 'ramesh', 'rohit', 'sachin', 'sahil', 'sanjay',
  'saurabh', 'shruti', 'sumit', 'suresh', 'vijay', 'vikas', 'vinay',
  'vishal', 'vivek', 'aarti', 'anjali', 'anupam',
  // East Asian
  'wei', 'lei', 'hao', 'jun', 'kai', 'ming', 'peng', 'rui', 'tao',
  'xiao', 'xin', 'yan', 'yi', 'ying', 'zhen', 'zhi', 'zhong',
  'jing', 'ling', 'long', 'nan', 'qiang', 'shu', 'tian', 'tong',
  'wen', 'zhen', 'liang', 'shao', 'sheng', 'ren', 'bo',
  // Notable tech founders / frequently seen in startup news
  'garry', 'demis', 'ilya', 'dario', 'amodei', 'hassabis',
  'yann', 'yoshua', 'geoff', 'hinton', 'lecun', 'bengio',
  'yandex', 'yuri', 'Pavel', 'Pavel',
  // MENA
  'ahmed', 'ali', 'amr', 'faisal', 'hassan', 'hussain', 'khalid',
  'mahmoud', 'mariam', 'mohammad', 'mohammed', 'mostafa', 'mustafa',
  'omar', 'samir', 'sana', 'sara', 'tariq', 'yasir', 'yusuf',
  'abdel', 'adel', 'amira', 'amir', 'bilal', 'fatima', 'habib',
  'hamza', 'ibrahim', 'ismail', 'jamil', 'kareem', 'layla',
  'nadia', 'nour', 'rania', 'salma', 'yasmine', 'zainab',
  // African
  'kwame', 'kofi', 'ama', 'abena', 'esi', 'yaw', 'kojo',
  'chisom', 'chidi', 'emeka', 'ngozi', 'amara', 'adaeze',
  'chukwu', 'ifeanyi', 'kelechi', 'obiora', 'obinna', 'uche',
  'olumide', 'adebayo', 'adewale', 'afolabi', 'ayodele', 'babatunde',
  // Latin American
  'alejandro', 'alejandra', 'guadalupe', 'rodrigo', 'camila',
  'valentina', 'luciana', 'mariana', 'sebastian', 'mateo', 'matias',
  'nicolás', 'nicolas', 'nicolas', 'santiago', 'catalina', 'isabella',
]);

/**
 * International surnames used to detect "FirstName LastName" person patterns.
 * Combined with INTL_GIVEN_NAMES or COMMON_GIVEN_NAMES (from startupNameValidator).
 */
const INTL_SURNAMES = new Set([
  // South Asian
  'agarwal', 'aggarwal', 'ahuja', 'arora', 'bhat', 'bhatt', 'bose',
  'chandra', 'chaudhary', 'chawla', 'chopra', 'desai', 'dey', 'dhillon',
  'dubey', 'dutt', 'gandhi', 'ghosh', 'gupta', 'jain', 'kapoor', 'kaur',
  'khanna', 'kohli', 'kumar', 'lal', 'malhotra', 'mehta', 'mishra',
  'mistry', 'naidu', 'nair', 'pandey', 'patel', 'pillai', 'rao',
  'reddy', 'roy', 'sahni', 'sen', 'seth', 'sethi', 'shah', 'sharma',
  'shukla', 'singh', 'sinha', 'soni', 'srivastava', 'talwar', 'thakur',
  'trivedi', 'tiwari', 'upadhyay', 'varma', 'yadav',
  // East Asian
  'chen', 'cheng', 'cho', 'choi', 'chong', 'chu', 'deng', 'gao',
  'han', 'he', 'hong', 'huang', 'jung', 'kim', 'kuo', 'kwon',
  'liang', 'lin', 'liu', 'lu', 'luo', 'ma', 'ng', 'oh', 'pak',
  'park', 'peng', 'qi', 'qian', 'qin', 'sun', 'tan', 'tang',
  'tian', 'tsai', 'wan', 'wang', 'wu', 'xia', 'xiao', 'xie', 'xu',
  'yan', 'yang', 'ye', 'yin', 'yu', 'yuan', 'zhang', 'zhao',
  'zheng', 'zhou', 'zhu', 'lee', 'min',
  // MENA / South Asian Muslim
  'abbasi', 'abdallah', 'abu', 'amin', 'ansari', 'ashraf', 'aziz',
  'baig', 'bajwa', 'bukhari', 'chaudhry', 'cheema', 'dar', 'farooq',
  'gilani', 'hasan', 'hashmi', 'hussain', 'iqbal', 'jahangir',
  'javed', 'kabir', 'khan', 'malik', 'mansoor', 'mirza', 'mughal',
  'nadeem', 'naqvi', 'nawaz', 'niazi', 'qadir', 'qureshi', 'rana',
  'raza', 'rehman', 'rizvi', 'sadiq', 'saleem', 'sheikh', 'siddiqui',
  'sultan', 'syed', 'usman', 'waqar', 'yousaf', 'zaidi', 'zaman',
  // African
  'okafor', 'okonkwo', 'adeyemi', 'adesanya', 'adesola', 'adenike',
  'oduola', 'olawale', 'ibrahim', 'diallo', 'traore', 'coulibaly',
  'ndiaye', 'fall', 'sarr', 'mbaye', 'toure', 'camara', 'conde',
  'keita', 'bah', 'barry', 'diallo',
]);

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNMENT CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structural patterns that identify government / regulatory / international bodies.
 * These complement the exact-match list in startupNameValidator.js.
 */
const GOV_STRUCTURAL_PATTERNS = [
  // "Department of X", "Bureau of X", "Office of X"
  /^(Department|Bureau|Office|Division|Board|Committee|Commission|Agency|Authority)\s+of\b/i,
  // "US [Agency]", "UK [Agency]", "EU [Body]"
  /^(US|U\.S\.|UK|U\.K\.|EU|E\.U\.|UN|U\.N\.)\s+(Department|Agency|Commission|Senate|Congress|Parliament|Treasury|Ministry|Court|Army|Navy|Air Force|Marine|Coast Guard)/i,
  // "Federal [Agency]"
  /^Federal\s+(Agency|Bureau|Commission|Reserve|Court|Government|District)/i,
  // National / international bodies
  /^(World|International|Global|National|Regional)\s+(Health|Trade|Labor|Finance|Security|Development|Bank|Fund|Court|Union|Organization|Council|Committee|Agency|Program|Programme)\b/i,
  // Parliamentary / legislative terms
  /^(Senate|Congress|Parliament|Assembly|Legislature|Council|Cabinet|Ministry)\s+of\b/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a name to lowercase for Set lookups.
 * Strips extra whitespace and common punctuation variations.
 */
function normalize(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, "'")  // smart quotes → apostrophe
    .replace(/\s+/g, ' ');
}

/**
 * Check if a name is a known major city (exact full-string match).
 */
function isStandaloneCity(lower) {
  return MAJOR_US_CITIES.has(lower) || MAJOR_INTL_CITIES.has(lower);
}

/**
 * Check if a multi-word name ENDS with a known major city name.
 * e.g. "Woodruff Place Indianapolis" → ends with "indianapolis" → geographic
 * Only applies to 3+ word names to avoid "Indianapolis App" → startup.
 */
function endsWithMajorCity(words, lower) {
  if (words.length < 2) return false;
  const lastWord = words[words.length - 1];
  const lastTwo = words.slice(-2).join(' ');
  return (
    MAJOR_US_CITIES.has(lastWord) ||
    MAJOR_INTL_CITIES.has(lastWord) ||
    MAJOR_US_CITIES.has(lastTwo) ||
    MAJOR_INTL_CITIES.has(lastTwo)
  );
}

/**
 * Check if a two-word Title Case name is an international person name
 * (i.e., first word in INTL_GIVEN_NAMES, second word in INTL_SURNAMES or vice versa).
 * Only fires when the name has exactly two words, both Title Case.
 */
function isIntlPersonName(trimmed) {
  const TITLE_TWO = /^[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,25}$/;
  if (!TITLE_TWO.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 2) return false;
  const a = parts[0].toLowerCase();
  const b = parts[1].toLowerCase();
  // Need at least one word from international name sets
  const aIsGiven = INTL_GIVEN_NAMES.has(a);
  const bIsSurname = INTL_SURNAMES.has(b);
  const bIsGiven = INTL_GIVEN_NAMES.has(b);
  const aIsSurname = INTL_SURNAMES.has(a);
  return (aIsGiven && bIsSurname) || (bIsGiven && aIsSurname);
}

/**
 * Classify a startup name string into an entity type.
 *
 * Returns one of:
 *   'geographic'   — continent, territory, city, city-suffix compound
 *   'person'       — international person name pattern
 *   'brand'        — established Fortune 500 / legacy consumer brand
 *   'media'        — news outlet / publication
 *   'government'   — government body / regulatory agency
 *   null           — not classified (does not mean it's a valid startup)
 *
 * @param {string} name
 * @returns {'geographic'|'person'|'brand'|'media'|'government'|null}
 */
function classifyEntityType(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;

  const lower = normalize(trimmed);
  const words = lower.split(/\s+/).filter(Boolean);

  // ── Geographic ──────────────────────────────────────────────────────────────
  if (GEO_CONTINENTS.has(lower)) return 'geographic';
  if (GEO_TERRITORIES.has(lower)) return 'geographic';
  if (isStandaloneCity(lower)) return 'geographic';
  // Multi-word name ending in a known major city (e.g. "Accelerate AI Indianapolis")
  if (words.length >= 2 && endsWithMajorCity(words, lower)) return 'geographic';
  // Name ends with geographic suffix AND has multiple words
  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    if (GEO_SUFFIX_WORDS.has(lastWord)) {
      // Extra evidence: first word or second-to-last is also a location indicator
      const secondLast = words.length >= 3 ? words[words.length - 2] : null;
      if (secondLast && (GEO_SUFFIX_WORDS.has(secondLast) || MAJOR_US_CITIES.has(words.slice(0, -1).join(' ')))) {
        return 'geographic';
      }
    }
  }

  // ── Brand ────────────────────────────────────────────────────────────────────
  if (ESTABLISHED_BRANDS.has(lower)) return 'brand';
  // "Lululemon Q4" / "Lululemon CEO" — name starts with a known brand
  if (words.length >= 2 && ESTABLISHED_BRANDS.has(words[0])) return 'brand';
  // "CEO of [Brand]", "President of [Brand]" — brand appears after "of"
  const ofIdx = words.indexOf('of');
  if (ofIdx >= 0 && ofIdx < words.length - 1) {
    const remainder = words.slice(ofIdx + 1).join(' ');
    if (ESTABLISHED_BRANDS.has(remainder)) return 'brand';
  }

  // ── Media ────────────────────────────────────────────────────────────────────
  if (MEDIA_OUTLETS.has(lower)) return 'media';
  // e.g. "TechCrunch Reports", "Bloomberg Analysis"
  if (words.length >= 2 && MEDIA_OUTLETS.has(words[0])) return 'media';

  // ── Government ───────────────────────────────────────────────────────────────
  for (const pat of GOV_STRUCTURAL_PATTERNS) {
    if (pat.test(trimmed)) return 'government';
  }

  // ── Person (international) ───────────────────────────────────────────────────
  if (isIntlPersonName(trimmed)) return 'person';

  return null;
}

/**
 * Returns true if the name is classified as a non-startup entity.
 * This is the primary export for integration with reclassify-zero-signal-junk.js.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isNonStartupEntity(name) {
  return classifyEntityType(name) !== null;
}

/**
 * Returns a human-readable reason string for logging / audit.
 *
 * @param {string} name
 * @returns {string|null}
 */
function entityJunkReason(name) {
  const type = classifyEntityType(name);
  if (!type) return null;
  return `entity_ontology/${type}`;
}

module.exports = {
  classifyEntityType,
  isNonStartupEntity,
  entityJunkReason,
  // Export sets for reuse in other validators
  GEO_CONTINENTS,
  GEO_TERRITORIES,
  GEO_SUFFIX_WORDS,
  MAJOR_US_CITIES,
  MAJOR_INTL_CITIES,
  ESTABLISHED_BRANDS,
  MEDIA_OUTLETS,
  INTL_GIVEN_NAMES,
  INTL_SURNAMES,
};
