/**
 * Startup Name Validator (shared lib)
 * Used by both server and client to reject garbage names.
 */

const { isKnownGoodStartupName } = require('./knownGoodStartupNames');

/** Normalize for exact blocklist lookup (lowercase, collapse whitespace) */
function normalizeForBlocklist(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // "Paris A.I", "Open A.I" → treat as "paris ai" for blocklist keys
    .replace(/\ba\.i\b/g, 'ai');
}

/**
 * Exact-match names that are people, institutions, or headlines — not companies.
 * RSS/entity extraction often emits "Elizabeth Warren", "Jerome Powell", etc.
 */
const NON_COMPANY_EXACT_NAMES = new Set(
  [
    // US politicians (high false-positive rate in news-derived data)
    'alexandria ocasio-cortez',
    'bernie sanders',
    'bill clinton',
    'chuck schumer',
    'donald trump',
    'elizabeth warren',
    'eric adams',
    'gavin newsom',
    'george w bush',
    'hillary clinton',
    'james comer',
    'jamie raskin',
    'jeb bush',
    'jd vance',
    'j d vance',
    'j.d vance',
    'j.d. vance',
    'james david vance',
    'senator jd vance',
    'vice president jd vance',
    'usha vance',
    'joe biden',
    'john fetterman',
    'john thune',
    'josh hawley',
    'kamala harris',
    'kevin mccarthy',
    'lindsey graham',
    'marco rubio',
    'marjorie taylor greene',
    'mike johnson',
    'mike pence',
    'mitch mcconnell',
    'nancy pelosi',
    'nikki haley',
    'pete buttigieg',
    'rand paul',
    'ron desantis',
    'ron johnson',
    'sarah huckabee sanders',
    'ted cruz',
    'tim scott',
    'tom cotton',
    'rick scott',
    'ivanka trump',
    'jared kushner',
    'barack obama',
    'michelle obama',
    'adam schiff',
    'alex padilla',
    'amy klobuchar',
    'andrew cuomo',
    'angus king',
    'ben cardin',
    'bill cassidy',
    'bob casey',
    'bob menendez',
    'brian kemp',
    'catherine cortez masto',
    'chris coons',
    'chris murphy',
    'chris sununu',
    'chuck grassley',
    'cindy hyde-smith',
    'cory booker',
    'dan crenshaw',
    'dan sullivan',
    'debbie stabenow',
    'dean phillips',
    'dianne feinstein',
    'dick durbin',
    'elise stefanik',
    'eric schmitt',
    'gary peters',
    'greg abbott',
    'greg gianforte',
    'hakeem jeffries',
    'henry mcmaster',
    'jack reed',
    'james lankford',
    'jeanne shaheen',
    'jeff merkley',
    'jim jordan',
    'jim justice',
    'jim risch',
    'john barrasso',
    'john bel edwards',
    'john boozman',
    'john cornyn',
    'john kennedy',
    'jon ossoff',
    'jon tester',
    'joni ernst',
    'josh gottheimer',
    'katie porter',
    'kirsten gillibrand',
    'kyrsten sinema',
    'lisa murkowski',
    'liz cheney',
    'maria cantwell',
    'mark kelly',
    'mark warner',
    'marsha blackburn',
    'martin heinrich',
    'mazie hirono',
    'michael bennet',
    'mitt romney',
    'pat toomey',
    'patty murray',
    'raphael warnock',
    'richard blumenthal',
    'rob portman',
    'roger wicker',
    'ron wyden',
    'roy blunt',
    'sheldon whitehouse',
    'steve daines',
    'susan collins',
    'tammy baldwin',
    'ted budd',
    'tim kaine',
    'tim sheehy',
    'tom carper',
    'tommy tuberville',
    'todd young',
    'trey gowdy',
    'val demings',
    'vivek ramaswamy',
    'warren davidson',
    'gretchen whitmer',
    'kathy hochul',
    'brad little',
    'kim reynolds',
    'laura kelly',
    'andy beshear',
    'roy cooper',
    'dan mckee',
    'bill lee',
    // Pakistani / South Asian political figures (frequent in business news)
    'ishaq dar',
    'imran khan',
    'shehbaz sharif',
    'nawaz sharif',
    'asif ali zardari',
    'bilawal bhutto',
    'arvind kejriwal',
    'rahul gandhi',
    'sonia gandhi',
    'manmohan singh',
    'atal bihari vajpayee',
    'sheikh hasina',
    'khaleda zia',
    // World leaders / intl (common in tech/business headlines)
    'emmanuel macron',
    'ursula von der leyen',
    'rishi sunak',
    'keir starmer',
    'olaf scholz',
    'giorgia meloni',
    'pedro sanchez',
    'justin trudeau',
    'xi jinping',
    'vladimir putin',
    'volodymyr zelensky',
    'benjamin netanyahu',
    'narendra modi',
    'kim jong un',
    'fumio kishida',
    'yoon suk yeol',
    'alberto fernandez',
    'luiz inacio lula da silva',
    'javier milei',
    'andres manuel lopez obrador',
    // SCOTUS / DOJ / high-profile appointees
    'john roberts',
    'clarence thomas',
    'samuel alito',
    'sonia sotomayor',
    'elena kagan',
    'neil gorsuch',
    'brett kavanaugh',
    'amy coney barrett',
    'ketanji brown jackson',
    'merrick garland',
    'pam bondi',
    'ken paxton',
    // Media / pundits often mistaken for entities
    'jim cramer',
    'joe rogan',
    'tucker carlson',
    'rachel maddow',
    'anderson cooper',
    'sean hannity',
    'laura ingraham',
    'ben shapiro',
    'fareed zakaria',
    'andrew ross sorkin',
    'david faber',
    'sara eisen',
    'kayla tausche',
    // Regulators / Fed / policy (often pulled as "entities")
    'jerome powell',
    'janet yellen',
    'gary gensler',
    'christopher wray',
    'antony blinken',
    'lloyd austin',
    'paul volcker',
    'ben bernanke',
    'lael brainard',
    'philip jefferson',
    'michael barr',
    'rohit chopra',
    'lina khan',
    // Mega-cap / famous individuals mistaken for startups
    'elon musk',
    'jeff bezos',
    'bill gates',
    'warren buffett',
    'mark zuckerberg',
    'tim cook',
    'sundar pichai',
    'satya nadella',
    'jensen huang',
    'sam altman',
    'larry page',
    'sergey brin',
    'larry ellison',
    'jamie dimon',
    'david solomon',
    'mary barra',
    'reed hastings',
    'brian chesky',
    'patrick collison',
    'john collison',
    'peter thiel',
    'reid hoffman',
    'marc andreessen',
    'ben horowitz',
    'naval ravikant',
    'chamath palihapitiya',
    'charlie munger',
    'larry fink',
    'tim armstrong',
    'arianna huffington',
    'oprah winfrey',
    'kim kardashian',
    'kanye west',
    'melania trump',
    'taylor swift',
    'beyonce knowles',
    'jay z',
    // Institutions / venues mistaken for company names
    'the white house',
    'white house',
    'federal reserve',
    'the federal reserve',
    // Country and city abbreviations with periods (scraped from article metadata)
    'u.k', 'u.k.', 'u.s', 'u.s.', 'u.s.a', 'u.s.a.', 'u.a.e', 'u.a.e.',
    'd.c', 'd.c.', 'u.k.-based', 'u.s.-based',
    // Major cities scraped as standalone entity names
    'montreal', 'toronto', 'vancouver', 'calgary', 'ottawa',
    'paris', 'berlin', 'amsterdam', 'brussels', 'zurich', 'geneva',
    'singapore', 'hong kong', 'shanghai', 'beijing', 'tokyo', 'seoul',
    'sydney', 'melbourne', 'dubai', 'riyadh', 'cairo', 'nairobi',
    'sao paulo', 'buenos aires', 'bogota', 'lima', 'santiago',
    'moscow', 'kyiv', 'warsaw', 'prague', 'budapest', 'bucharest',
    // US airports and transit hubs (scraped as entities from travel/logistics news)
    'jfk airport', 'lax airport', 'ord airport', 'atl airport',
    'jfk', 'lax', 'ord', 'atl', 'sfo', 'dfw', 'den', 'sea',
    // Political / militant / ideological groups
    'houthi', 'houthis', 'taliban', 'hamas', 'hezbollah',
    'isis', 'isil', 'al qaeda', 'al-qaeda',
    // US capital and major compound geographic references
    'washington dc',
    'washington d.c.',
    'new york city',
    'new york',
    'los angeles',
    'san francisco',
    'silicon valley',
    'bay area',
    'research triangle',
    'latin america',
    'south america',
    'north america',
    'middle east',
    'southeast asia',
    'sub-saharan africa',
    'south florida',
    // Additional US cities / regions commonly scraped as entity names
    'grand rapids', 'salt lake city', 'kansas city', 'oklahoma city',
    'fort worth', 'san antonio', 'san diego', 'san jose', 'las vegas',
    'el paso', 'baton rouge', 'new orleans', 'grand forks', 'grand junction',
    'six continents',
    // Countries / territories scraped as entity names
    'el salvador', 'costa rica', 'puerto rico', 'dominican republic',
    // Common single-word person names that appear in the data unaccompanied
    'vitaly', 'allen', 'victor', 'belle', 'dean', 'abel', 'bell',
    // Person names from enrichment logs
    'lori greiner', 'caroline ingeborn', 'deepankar rustagi',
    'dalton caldwell', 'chief justice roberts', 'charles foley chairman',
    'mccabe', 'bauer', 'hewson', 'bartlett', 'zwillinger', 'berry', 'bell', 'moses',
    // Famous known people — full 2-word names
    'tom cruise', 'joey zwillinger', 'lori greiner', 'caroline ingeborn',
    'deepankar rustagi', 'dalton caldwell', 'chief justice roberts',
    'charles foley chairman', 'joey zwillinger', 'sen elizabeth warren',
    'abel', 'chamberlain', 'colton', 'dixon', 'fletcher', 'henderson',
    'hughes', 'ingram', 'jackson', 'kennedy', 'lawson', 'mason',
    'norton', 'parker', 'quinn', 'riley', 'simpson', 'tyler',
    'wilson', 'xavier', 'york', 'porter', 'foster', 'wells',
    // Also block 2-word person-pattern exact phrases found in enrichment
    'act one', // theatrical phrase, not startup
    'asia-pacific exa', // geographic + abbreviation
    // Known established company + geographic division phrases
    'food panda taiwan', 'food panda india', 'food panda germany',
    'tencent music entertainment', 'tencent music', 'tencent games',
    'cibc innovation', 'cibc capital markets', 'cibc wood gundy',
    // VC partners / investors appearing as entities — NOT startups
    'greylock', 'kleiner perkins', 'khosla ventures',
    // Known established tech companies appearing without URL = not a new startup
    'slack', 'github', 'zoom', 'postman', 'zoominfo',
    'gradle', 'pandas', 'nginx', 'elasticsearch', 'dockerfiles',
  // Known VC firms appearing as standalone entities
  'm13', 'greylock partners',

  // Indian and common surnames (high-frequency in news scraped entity names)
  'patel', 'agarwal', 'sharma', 'verma', 'gupta', 'singh', 'mehta', 'joshi',
  'viswanath', 'iyer', 'nair', 'reddy', 'rao', 'pillai', 'sacks', 'collins',
  // Known investor/executive surnames that appear as standalone scrape artifacts
  'markkula',          // Mike Markkula — Apple investor
  'phelps',            // common surname, no known startup
  // Eastern European given/surnames
  'boris cherny', 'dmitri', 'alexei', 'nikolai',
  // Known individual person names (investors, executives) that appear in scrape noise
  'doug leone',        // Sequoia General Partner
  'mike repole',       // energy drink entrepreneur
  'assaf rappaport',   // Wiz CEO — appears as entity in news scrapes
  'israel duanis',     // person name appearing in scrape noise
  // Western person names that appeared as enrichment entries
  'john mountain', 'guillermo treviño',

  // Corporate action phrases — not company names
  'stockholder approval',    // M&A/board action
  'aggressive hunt',         // news phrase

  // VC-name + generic noun compounds — scraped co-mention, not a startup name
  'accel box',               // Accel (VC) + box
  'wire jump', 'finance jump',  // [industry] + jump = junk phrase
  'black titan',             // junk phrase

  // Language + generic category — "Python Software Foundation" fragments
  'python software', 'model ai systems',

  // City + AI / tech = geographic brand, not a startup
  'detroit ai', 'austin ai', 'london ai', 'boston ai', 'chicago ai', 'paris ai',
  'australian ai',
  // RSS headline / media / sports / category junk (not fundable startups)
  'all-in podcast', 'real madrid', 'stan store', 'global manufacturing',
  'zero billion', 'co thriving', 'business city', 'stanford medicine',
  'accelerate commercial', 'accelerate commercialization',
  // Person names / pundits scraped as entities
  'hamel husain', 'adam raine', 'robert rose', 'johnny carson', 'chris re',
  'tiktoks',
  // Article titles / headline mashups from Peter outreach audit
  'chris ré', 'fal learned building', 'ai risk intelligence quantifind',
  'business_city', 'business city', 'wolters kluwer', 'pearl health lands',
  'royal assent', 'etas', 'jony', 'sarthak', 'agentic credit',
  'captcha', 'all-inclusive',
  // Generic category + plural device noun — "Quantum Computers" = field/topic, not a brand
  'quantum computers',
  // Generic adjective + tech noun — scraped script/tutorial phrases
  'simple scripts',
  // Alibaba AI model family + domain — product identifier, not a startup record
  'qwen', 'qwen.ai',
  // Indian VC fund acronym (Gujarat Venture Finance Ltd) — investor, not startup
  'gvfl',
  // News scrape: payment brand + person name (3-word headline fragment)
  'kpay davis chan',
  // Established collaboration product (miro.com) — not a net-new startup in sparse pipeline
  'miro',
  // Two-tool tech compounds
  'docker grafana', 'kubernetes helm', 'prometheus grafana',
  // Watch + brand = product headline
  'watch starcloud', 'whoop scores',
  // Indigenous group + US state
  'cherokee alabama', 'cherokee nation',
    // Financial / real estate categories
    'digital realty', 'coinbase prime', 'honeywell aerospace',
    // News wire services
    'globenewswire', 'businesswire', 'prnewswire', 'accesswire',
    // Major US cities (single-word entries go in COUNTRY_SINGLE_WORDS; multi-syllable cities here)
    'philadelphia',
    // Famous investors / founders / public figures scraped as startup names
    'ray dalio',
    'bill ackman',
    'carl icahn',
    'dan loeb',
    'david einhorn',
    'george soros',
    'paul tudor jones',
    'ken griffin',
    'stanley druckenmiller',
    'steve cohen',
    'warren buffett',
    'charlie munger',
    'jack ma',
    'masayoshi son',
    'masa son',
    // Famous people with non-standard name casing, three-word, or hyphenated-surname names
    'lebron james',
    'amy shack egan',
    'elizabeth cutler',
    'jack altman',
    'stacy brown-philpot',
    'stacy brown philpot',
    // Established businesses that appear in YC/pedigree signals but are not startups
    'soul cycle',
    'soulcycle',
    'night media',
    // Major US research universities (commonly scraped as entity names)
    'rutgers', 'mit', 'caltech', 'stanford', 'yale', 'harvard', 'cornell',
    'columbia', 'princeton', 'dartmouth', 'brown', 'duke', 'emory',
    'vanderbilt', 'rice', 'tufts', 'brandeis', 'usc', 'ucla', 'ucsd',
    'ucsb', 'ucb', 'uc berkeley', 'unc', 'purdue', 'penn state',
    'ohio state', 'michigan state', 'georgia tech', 'virginia tech',
    'carnegie mellon', 'cmu', 'northwestern', 'notre dame', 'georgetown',
    'johns hopkins', 'jhu', 'uc davis', 'uc irvine', 'uc santa barbara',
    'florida state', 'boston university', 'bu', 'nyu',
    // Major established defense / industrial companies
    'raytheon', 'lockheed', 'lockheed martin', 'northrop grumman',
    'general dynamics', 'boeing', 'halliburton', 'bae systems',
    // Tech news outlets and media companies scraped as startup names
    'geek wire',
    'geekwire',
    'afrotech',
    'afrotech.com',
    'venturebeat',
    'techcrunch',
    'the information',
    'axios pro',
    'axios',
    'wired',
    'the verge',
    'ars technica',
    'hacker news',
    'product hunt',
    // Entertainment and trade media
    'hollywood reporter',
    'variety',
    'deadline',
    'the hollywood reporter',
    'billboard',
    'rolling stone',
    'entertainment weekly',
    'the economist',
    'the atlantic',
    'new yorker',
    'the new yorker',
    // Military branches
    'marines',
    'navy',
    'air force',
    'army',
    'coast guard',
    'national guard',
    // Indian conglomerates commonly scraped
    'aditya birla',
    'tata group',
    'reliance industries',
    'mahindra',
    'infosys',
    'wipro',
    'hcl',
    'bajaj',
    'birla',
    // US geographic regions (direction + state/city = not a startup)
    'central florida', 'northern california', 'southern california',
    'greater boston', 'greater new york', 'greater chicago',
    'metro atlanta', 'metro detroit', 'metro phoenix',
    'central texas', 'east texas', 'west texas',
    'north carolina', 'south carolina', 'north dakota', 'south dakota',
    'new england', 'mid-atlantic', 'pacific northwest',
    'the fed',
    'us senate',
    'u.s. senate',
    'house of representatives',
    'supreme court',
    'us treasury',
    'u.s. treasury',
    'securities and exchange commission',
    'federal trade commission',
    'department of justice',
    'the pentagon',
    'pentagon',
    'european union',
    'european commission',
    'world bank',
    'international monetary fund',
    'united nations',
    'north atlantic treaty organization',
    'world health organization',
    'food and drug administration',
    'fda',
    'central intelligence agency',
    'cia',
    'federal bureau of investigation',
    'fbi',
    'internal revenue service',
    'irs',
    'us congress',
    'u.s. congress',
    'congress',
    'the administration',
    'oval office',
    'downing street',
    'the vatican',
    'wall street journal',
    'new york times',
    'washington post',
    'financial times',
    'associated press',
    'reuters',
    // Public-co / product names often scraped as "startups"
    'firebase',
    'datadog',
    'instacart',
    'codeforces',
    'headline',
    'competitor',
    'whilst',
    // Established Fortune 500 / legacy consumer brands (ontology: BrandEntity)
    // These appear in RSS headlines and get scraped as fake "startups"
    'lululemon', 'nordstrom', 'macys', 'jcpenney', 'bloomingdales',
    'patagonia', 'the north face', 'under armour', 'old navy', 'banana republic',
    'nike', 'adidas', 'puma', 'reebok', 'converse', 'vans', 'new balance',
    'walmart', 'target', 'costco', 'best buy', 'home depot', 'lowes',
    'dollar general', 'dollar tree', 'kroger', 'whole foods', 'trader joes',
    'mcdonalds', 'starbucks', 'chipotle', 'taco bell', 'burger king', 'wendys',
    'dunkin', 'kfc', 'pizza hut', 'dominos', 'papa johns', 'popeyes',
    'nestle', 'unilever', 'kraft heinz', 'mondelez', 'pepsico', 'coca-cola',
    'anheuser-busch', 'budweiser', 'heineken', 'corona', 'miller', 'coors',
    'toyota', 'honda', 'ford', 'chevrolet', 'chevy', 'gmc', 'dodge', 'chrysler', 'plymouth',
    'bmw', 'volkswagen', 'audi', 'lexus', 'hyundai', 'kia', 'nissan',
    'subaru', 'mazda', 'volvo', 'ferrari', 'lamborghini', 'bentley', 'rolls-royce', 'porsche',
    'mitsubishi', 'suzuki', 'isuzu', 'daihatsu', 'dacia', 'rivian', 'lucid',
    'samsung', 'sony', 'lg', 'panasonic', 'philips', 'siemens', 'bosch',
    'oracle', 'sap', 'ibm', 'intel', 'cisco', 'dell', 'hp', 'lenovo',
    'honeywell', 'ge', 'general electric', '3m', 'caterpillar', 'deere',
    'jpmorgan', 'wells fargo', 'citibank', 'bank of america', 'barclays',
    'hsbc', 'deutsche bank', 'ubs', 'credit suisse',
    'visa', 'mastercard', 'american express',
    'fidelity', 'vanguard', 'blackrock', 'charles schwab',
    'pfizer', 'merck', 'abbvie', 'eli lilly', 'bristol-myers squibb',
    'novartis', 'roche', 'astrazeneca', 'bayer', 'sanofi', 'gsk',
    'unitedhealth', 'anthem', 'cigna', 'humana', 'aetna',
    'state farm', 'allstate', 'geico', 'progressive', 'liberty mutual',
    'at&t', 'verizon', 'comcast', 'xfinity', 'charter', 'spectrum',
    'american airlines', 'delta', 'united airlines', 'southwest',
    'marriott', 'hilton', 'hyatt', 'ihg',
    'exxonmobil', 'chevron', 'shell', 'bp', 'totalenergies',
    'disney', 'nbcuniversal', 'viacom', 'warner bros', 'paramount',
    'hbo', 'hulu', 'spotify', 'pandora', 'tiktok', 'bytedance',
    'beiersdorf', 'l oreal', 'loreal', 'procter gamble', 'p&g',
    'johnson johnson', 'colgate', 'palmolive', 'kimberly-clark',
    // VC funds, accelerators (not startups — they invest in startups)
    'forerunner ventures', 'general catalyst', 'index ventures',
    'forerunner', 'lightspeed venture', 'crosspoint capital',
    'cedar hill capital', 'cvc capital', 'glasswing ventures',
    'meritech capital', 'ampli ventures', 'mantis vc',
    // Tech giants that also show up as "startup" entries via RSS
    'microsoft', 'apple', 'google', 'amazon', 'meta', 'netflix',
    // Single generic English words appearing as names
    'soul',
    'bar',
    'ear',
    'academic',
    'practical',
    'practical',
    'conservatives',
    'progressives',
    'kraft',
    'ellison',
    'sclater',
    'handala',
    // Common first names used as solo "startup names"
    'todd',
    'jeff',
    'mike',
    'paul',
    'james',
    'david',
    'robert',
    'john',
    'mark',
    'tom',
    'tim',
    // Tech tools / open-source projects not startups
    'ollama',
    'kafka',
    'sonarscanner',
    'sonarqube',
    'unleashclient',
    'airpods',
    'airtag',
    'captchas',
    'wechat',
    'alipay',
    // Consumer brands / film titles
    'chamberlain coffee',
    'apocalypse now',
    'wechat alipay',
    // Contraction fragments
    "it's",
    "let's",
  ].map((s) => s.toLowerCase())
);

/**
 * Second word in a two-token Title Case name: if it looks like a company descriptor,
 * skip the "likely person name" heuristic (e.g. "May Health", "Grace Robotics").
 */
const COMPANY_LIKE_SECOND_WORD = new Set(
  [
    'health', 'healthcare', 'medical', 'clinic', 'care', 'bio', 'biotech', 'pharma', 'therapeutics',
    'labs', 'lab', 'ai', 'io', 'hq', 'pay', 'bank', 'fi', 'fintech', 'insurtech', 'proptech',
    'edtech', 'cleantech', 'climate', 'energy', 'solar', 'grid', 'battery', 'robotics', 'automation',
    'security', 'cyber', 'data', 'cloud', 'software', 'saas', 'api', 'dev', 'ops', 'ml', 'llm',
    'analytics', 'intel', 'network', 'networks', 'mobile', 'commerce', 'retail', 'market',
    'markets', 'capital', 'ventures', 'partners', 'holdings', 'group', 'global', 'international',
    'solutions', 'systems', 'platform', 'technologies', 'technology', 'tech', 'studio', 'studios',
    'media', 'games', 'gaming', 'studios', 'foods', 'farm', 'farms', 'space', 'aerospace',
    'defense', 'logistics', 'freight', 'shipping', 'insurance', 'credit', 'wealth', 'asset',
    'assets', 'fund', 'funds', 'dao', 'nft', 'web3', 'crypto', 'chain', 'coin', 'mint', 'wallet',
    'robot', 'dynamics', 'motors', 'auto', 'mobility', 'drive', 'fleet', 'maps', 'os', 'works',
    'work', 'desk', 'stack', 'layer', 'bridge', 'gate', 'path', 'link', 'links', 'box', 'cube',
    'dot', 'dash', 'kit', 'kits', 'base', 'camp', 'school', 'learning', 'talent', 'hr', 'people',
    'legal', 'tax', 'accounting', 'design', 'build', 'builders', 'homes', 'home', 'house', 'realty',
    'properties', 'estate', 'trust', 'advisors', 'advisory', 'consulting', 'research', 'science',
    'engineering', 'materials', 'chemicals', 'steel', 'water', 'air', 'earth', 'stone', 'tree',
    'north', 'south', 'east', 'west', 'digital', 'online', 'electric', 'electronics', 'semiconductor',
    'chips', 'quantum', 'fusion', 'nuclear', 'hydrogen', 'carbon', 'mining', 'metal', 'metals',
  ]
);

/** Very common given names (lowercase) — paired with COMMON_SURNAMES for junk detection. */
const COMMON_GIVEN_NAMES = new Set(
  `james john robert michael william david richard joseph thomas charles christopher daniel matthew
  anthony mark donald steven paul andrew joshua kenneth kevin brian george timothy ronald edward
  jason jeffrey ryan jacob gary nicholas eric jonathan stephen larry justin scott brandon benjamin
  samuel frank gregory raymond alexander patrick jack dennis jerry tyler aaron henry adam douglas
  nathan peter kyle walter harold jeremy ethan carl keith roger arthur terry lawrence sean austin
  eugene joe albert beth mary patricia linda barbara elizabeth jennifer maria susan margaret dorothy
  lisa nancy karen betty helen sandra donna carol ruth sharon michelle laura emily kimberly deborah
  jessica amy melissa brenda virginia pamela emma martha debra rachel carolyn janet catherine
  heather diane julie joyce victoria kelly christina joan evelyn judith megan cheryl andrea hannah
  jacqueline sarah theresa gloria anne marie danielle brittany natalie samantha katie olivia ava
  grace alice amber rose doris lauren kathryn sonia sheila kayla alexis tammy ruby sophia isabella
  taylor jean hunter brooklyn nina diana julia angela stephanie rita lucy rebecca katherine mallory
  sydney morgan chris matt dave steve bob rob dan tom tim jim jon ben sam max leo evan ian juan
  will jamie jesse casey riley avery quinn reese drew lane blake dana
  luis carlos diego jose marco marc antonio marcus jordan derek travis brett clayton colin connor
  cody dylan grant harrison hayden jackson logan lucas mason nathaniel noah owen parker reid
  riley shane tanner trevor wayne zachary zoe chloe haley hailey paige skylar kim`
    .split(/\s+/)
    .filter(Boolean)
);

/** Very common US surnames (lowercase) — news entities are often "Firstname Surname". */
const COMMON_SURNAMES = new Set(
  `smith johnson williams brown jones garcia miller davis rodriguez martinez hernandez lopez
  gonzalez wilson anderson thomas taylor moore jackson martin lee perez thompson white harris
  sanchez clark ramirez lewis robinson walker young allen king wright scott torres nguyen hill
  flores green adams nelson baker hall rivera campbell mitchell carter roberts gomez phillips
  evans turner diaz parker cruz edwards collins reyes stewart morris morales murphy cook rogers
  gutierrez ortiz morgan cooper peterson bailey reed kelly howard ramos kim cox ward richardson
  watson brooks chavez wood james bennett gray mendoza ruiz hughes price alvarez castillo sanders
  patel myers long ross foster jimenez powell jenkins perry powell sullivan russell bell coleman
  butler henderson barnes gonzales fisher vasquez simmons romero jordan patterson alexander hamilton
  graham reynolds griffin wallace west cole hayes bryant herrera gibson ellis tran medina aguilar
  hopper swift lopez benioff zhang
  stevens murray ford castro marshall owens harrison fernandez mcdonald woods washington kennedy
  wells vargas henry freeman webb tucker simpson porter hicks crawford boyd mason morales warren
  mills nichols reid hunt black stone hawkins dunn perkins hudson spencer gardner stephens payne
  pierce berry matthews arnold wagner willis ray watkins olson carroll duncan snyder hart cunningham
  bradley lane andrews ruiz harper fox riley armstrong carpenter weaver greene lawrence stanford
  vance
  fleming barnett salazar hansen singleton wilkins bishop valdez day ramsey sharp bowman farrell
  casey singleton lucas holmes middleton potter bond walton goodman barker newman manning daniels
  barber bowers oconnor schneider mueller schmidt fischer weber wagner becker schulz hoffmann
  koch richter klein wolf schroeder neumann schwarz zimmermann braun kruger hartmann lange werner
  schmitz krause meier lehmann huber herrmann walter kaiser fuchs peters lang scholz moller weiss
  jung hahn schubert vogel friedrich keller gunther frank berger winkler roth beck lorenz baumann
  franke albrecht schuster simon ludwig bohm winter kraus martin stein jaeger otto sommer seidel
  heinrich brandt haas schreiber graf dietrich rudolph engel horn busch pohl sommer`
    .split(/\s+/)
    .filter(Boolean)
);

// Allows LeBron, DeShawn, McCarthy, O'Brien, Brown-Philpot (apostrophe or hyphen in name)
const TITLE_CASE_TWO_WORDS = /^[A-Z][a-zA-Z']{2,14}\s+[A-Z][a-zA-Z'-]{2,25}$/;

/**
 * International first names not in COMMON_GIVEN_NAMES.
 * South Asian, East Asian, MENA, African — extended coverage to catch
 * person names like "Garry Tan", "Demis Hassabis", "Arjun Sharma".
 */
const INTL_GIVEN_NAMES_INLINE = new Set(
  `garry demis ilya dario yann yoshua geoff hinton lecun bengio
   jan dmitri aleksei sergei mikhail nikolai andrei pavel yuri boris
   aarav abhishek aditya ajay akash akshay amit anil anita arjun aryan
   ashish ashok atul deepak deepika divya gaurav gopal hemant kamal kapil
   kiran kunal lalit manoj mihir mohan mukesh naveen neeraj neha nikhil
   nitin pankaj pooja pradeep pranav prashant prateek priyanka rajesh
   rakesh ramesh rohit sachin sahil sanjay saurabh shruti sumit suresh
   vijay vikas vinay vishal vivek anjali anupam
   ahmed ali amr faisal hassan hussain khalid mahmoud mariam mohammad
   mohammed mostafa mustafa omar samir sana tariq yasir yusuf abdel adel
   amira amir bilal fatima hamza ibrahim ismail jamil kareem layla
   nadia nour rania salma yasmine zainab
   kwame kofi ama abena esi yaw kojo chisom chidi emeka ngozi amara
   alejandro alejandra guadalupe rodrigo camila valentina luciana
   mariana sebastian mateo nicolas santiago catalina isabella
   lebron kobe shaquille dwyane kawhi serena venus lionel cristiano
   neymar mbappe erling luka rafael novak carlos tiger
   bruce barry darryl gareth graham lance lloyd mel nigel
   clifford clint clyde gilbert glen gordon hank leroy lester
   marvin melvin monty noel otis pierce vince virgil wade
   wendell wilbur willard winston lonnie
   vitaly vasily vladislav vladlen vitaliy slava volodymyr
   bogdan bohdan taras mykola yaroslav stepan roman oleksiy oleksandr
   svitlana oksana natasha natalia anya tanya sasha
   diogo filipe joao vasco pedro miguel
   rasmus magnus björn sven olof anders henrik
   allen victor moses bella oz`
    .split(/\s+/).filter(Boolean)
);

/**
 * International surnames — South Asian, East Asian, MENA, African.
 * Extended coverage to pair with INTL_GIVEN_NAMES_INLINE.
 */
const INTL_SURNAMES_INLINE = new Set(
  `agarwal aggarwal ahuja arora bhat bhatt bose chandra chaudhary chawla
   chopra desai dey dhillon dubey dutt gandhi ghosh gupta jain kapoor kaur
   khanna kohli kumar lal malhotra mehta mishra mistry naidu nair pandey
   patel pillai rao reddy roy sahni sen seth sethi shah sharma shukla
   singh sinha soni srivastava talwar thakur trivedi tiwari varma yadav
   chen cheng cho choi chong chu deng gao han he hong huang jung kim kuo
   kwon liang lin liu lu luo ma ng oh pak park peng qi qian qin sun
   tan tang tian tsai wan wang wu xia xiao xie xu yan yang ye yin yu
   yuan zhang zhao zheng zhou zhu lee min
   abbasi abdallah abu amin ansari ashraf aziz baig bajwa bukhari chaudhry
   cheema dar farooq gilani hasan hashmi hussain iqbal jahangir javed
   kabir khan malik mansoor mirza mughal nadeem naqvi nawaz niazi qadir
   qureshi rana raza rehman rizvi sadiq saleem sheikh siddiqui sultan
   syed usman waqar yousaf zaidi zaman
   okafor okonkwo adeyemi adesanya ibrahim diallo traore coulibaly
   ndiaye fall sarr mbaye toure camara conde keita bah barry
   ivanov petrov sidorov volkov sokolov popov lebedev kozlov novikov morozov
   dolgov leike altman repole kreitz hylak cutler shack rappaport
   james jordan wade bosh lebron durant curry james harden westbrook
   beckham messi ronaldo neymar mbappe kylian salah firmino`
    .split(/\s+/).filter(Boolean)
);

/** Title Case "Chris Murphy" / "Jennifer Lopez" — almost always a person in news-derived data, not a startup. */
function matchesLikelyPersonNameWithInitials(trimmed) {
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;
  const initials = parts[0].replace(/\./g, '').toLowerCase();
  const surname = parts[1].toLowerCase();
  if (!/^[a-z]{1,3}$/.test(initials)) return false;
  if (surname.length < 3) return false;
  if (COMPANY_LIKE_SECOND_WORD.has(surname)) return false;
  return COMMON_SURNAMES.has(surname);
}

function matchesLikelyPersonNameTwoWords(trimmed) {
  if (!TITLE_CASE_TWO_WORDS.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;
  const a = parts[0].toLowerCase();
  const b = parts[1].toLowerCase();
  if (a.length < 3 || b.length < 3) return false;
  if (COMPANY_LIKE_SECOND_WORD.has(b)) return false;
  // English name sets
  if (COMMON_GIVEN_NAMES.has(a) && COMMON_SURNAMES.has(b)) return true;
  // International name sets (South Asian, East Asian, MENA, African)
  if (
    (INTL_GIVEN_NAMES_INLINE.has(a) && (INTL_SURNAMES_INLINE.has(b) || COMMON_SURNAMES.has(b))) ||
    (INTL_GIVEN_NAMES_INLINE.has(b) && (INTL_SURNAMES_INLINE.has(a) || COMMON_SURNAMES.has(a)))
  ) return true;
  // Cross-match: known given name + international surname
  if (COMMON_GIVEN_NAMES.has(a) && INTL_SURNAMES_INLINE.has(b)) return true;
  // Hyphenated surnames: "Stacy Brown-Philpot" → check stem of "brown-philpot"
  if (b.includes('-')) {
    const bStem = b.split('-')[0];
    if (COMMON_GIVEN_NAMES.has(a) && COMMON_SURNAMES.has(bStem)) return true;
    if (INTL_GIVEN_NAMES_INLINE.has(a) && COMMON_SURNAMES.has(bStem)) return true;
  }
  return false;
}

/** Strip common political titles so "Senator Elizabeth Warren" hits the person blocklist. */
const LEADING_POLITICAL_TITLE_RE =
  /^(?:Senator|Representative|Rep\.|Governor|Gov\.|Secretary|Mayor|Vice\s+President|Prime\s+Minister|Foreign\s+Minister|Finance\s+Minister|Defense\s+Minister|Interior\s+Minister|Minister\s+of|Pakistani\s+|Indian\s+|Chinese\s+|Russian\s+|Iranian\s+|Israeli\s+|Turkish\s+|Saudi\s+|Egyptian\s+|Nigerian\s+|Brazilian\s+)\s*/i;

function blocklistLookupKeys(trimmed) {
  const keys = new Set();
  keys.add(normalizeForBlocklist(trimmed));
  let t = trimmed;
  for (let i = 0; i < 4; i++) {
    const next = t.replace(LEADING_POLITICAL_TITLE_RE, '').trim();
    if (next === t) break;
    t = next;
    keys.add(normalizeForBlocklist(t));
  }
  return keys;
}

/** RSS often appends "Announces" / "Announced" to the company token — salvage the stem when it validates. */
const ANNOUNCE_HEADLINE_TAIL_RE = /\s+(Announces?|Announced)\s*$/i;

function stripAnnounceHeadlineTail(s) {
  return String(s || '')
    .trim()
    .replace(ANNOUNCE_HEADLINE_TAIL_RE, '')
    .trim();
}

// ── Rules imported from ssot-rss-scraper.js inline validator ─────────────────
// These supplement the blocklist / person-name checks above with structural
// checks that catch junk at the word-level rather than exact-match level.

/** YC-style batch seasons — "W24", "S23", "Winter 2024" — never a company name */
const BATCH_SEASONS_RE = /\b(W|S|F|Winter|Summer|Fall|Spring)\s*\d{2,4}\b/i;

/**
 * Location-based prefix — "Boston-based", "NYC-based", "US-based"
 * These slip through because they look like title-case proper nouns.
 */
const LOCATION_BASED_RE = /\b\w[\w.\s]{0,30}?-based$/i;

/**
 * Every UN-recognised country + common territories, as standalone lower-case names.
 * Startups are almost never named after sovereign nations.
 * Two-word countries are handled by NON_COMPANY_EXACT_NAMES; this covers single-word ones.
 */
const COUNTRY_SINGLE_WORDS = new Set([
  // A
  'afghanistan','albania','algeria','andorra','angola','antigua','argentina','armenia',
  'australia','austria','azerbaijan',
  // B
  'bahamas','bahrain','bangladesh','barbados','belarus','belgium','belize','benin',
  'bhutan','bolivia','bosnia','botswana','brazil','brunei','bulgaria','burkina',
  'burundi',
  // C
  'cambodia','cameroon','canada','cabo','chad','chile','china','colombia','comoros',
  'congo','croatia','cuba','cyprus','czechia','czech',
  // D
  'denmark','djibouti','dominica',
  // E
  'ecuador','egypt','eritrea','estonia','eswatini','ethiopia',
  // F
  'fiji','finland','france',
  // G
  'gabon','gambia','georgia','germany','ghana','greece','grenada','guatemala',
  'guinea','guyana',
  // H
  'haiti','honduras','hungary',
  // I
  'iceland','india','indonesia','iran','iraq','ireland','israel','italy',
  // J
  'jamaica','japan','jordan',
  // K
  'kazakhstan','kenya','kiribati','kuwait','kyrgyzstan',
  // L
  'laos','latvia','lebanon','lesotho','liberia','libya','liechtenstein','lithuania',
  'luxembourg',
  // M
  'madagascar','malawi','malaysia','maldives','mali','malta','mauritania','mauritius',
  'mexico','micronesia','moldova','monaco','mongolia','montenegro','morocco',
  'mozambique','myanmar',
  // N
  'namibia','nauru','nepal','netherlands','nicaragua','niger','nigeria','norway',
  // O
  'oman',
  // P
  'pakistan','palau','panama','paraguay','peru','philippines','poland','portugal',
  // Q
  'qatar',
  // R
  'romania','russia','rwanda',
  // S
  'samoa','senegal','serbia','seychelles','sierra','singapore','slovakia','slovenia',
  'solomon','somalia','spain','sudan','suriname','sweden','switzerland','syria',
  // T
  'taiwan','tajikistan','tanzania','thailand','timor','togo','tonga','trinidad',
  'tunisia','turkey','turkmenistan','tuvalu',
  // U
  'uganda','ukraine','uruguay','uzbekistan',
  // V
  'vanuatu','venezuela','vietnam',
  // W–Z
  'yemen','zambia','zimbabwe',
  // Common US states (single-word)
  'idaho','utah','ohio','iowa','maine','texas','alaska','hawaii','nevada','kansas',
  'montana','wyoming','oregon','indiana','georgia','florida','arizona','colorado',
  'alabama','arkansas','kentucky','louisiana','maryland','michigan','minnesota',
  'missouri','nebraska','oklahoma','virginia','wisconsin',
  // Gulf / MENA city-states often scraped as entities
  'dhabi','riyadh','doha','kuwait','bahrain','muscat','amman','beirut','islamabad',
  'karachi','lahore','nairobi','accra','abuja','cairo','algiers','tunis','rabat',
  'addis','ababa','kigali','kampala','harare','lusaka','dakar','abidjan','bamako',
  // Baltic / Balkan single-words
  'latvia','estonia','lithuania','slovenia','croatia','serbia','albania','kosovo',
  'moldova','armenia','azerbaijan','georgia',
  // Continents and major geographic regions (ontology: GeographicEntity/Continent)
  'africa','antarctica','arctic','asia','australasia','europe','eurasia','oceania',
  'caribbean','micronesia','melanesia','polynesia',
  // Famous territories / regions not listed as sovereign countries
  'greenland','tibet','xinjiang','kashmir','crimea','catalonia','kurdistan',
  'somaliland','transnistria','flanders','gaza','donbas',
  // Greek / Mediterranean islands often scraped as entities
  'crete','sicily','sardinia','corsica','cyprus','malta','majorca','mallorca',
  'rhodes','corfu','mykonos','santorini','ibiza','capri','elba','bali','lombok',
  // Sacred / tourist cities scraped from travel/lifestyle news
  'vrindavan','varanasi','rishikesh','haridwar','tirupati','shirdi',
  'mecca','medina','jerusalem','bethlehem','nazareth','lourdes','fatima',
  'angkor','bagan','kathmandu','dharamsala','lhasa',
  // Major US metros not covered above
  'indianapolis','minneapolis','jacksonville','charlotte','columbus','memphis',
  'nashville','baltimore','milwaukee','albuquerque','tucson','fresno','sacramento',
  'omaha','raleigh','tampa','cleveland','irvine','pittsburgh','cincinnati',
  'greensboro','newark','toledo','wichita','bakersfield','madison','lubbock',
  // Universities often scraped as entities
  'tulane', 'vanderbilt', 'carnegie mellon', 'northwestern', 'georgetown',
  'notre dame', 'duke', 'emory', 'tufts', 'brandeis', 'georgetown',
  // Other geographic descriptors
  'countries','nations','regions','provinces','territories','districts',
]);

/**
 * Residual geographic descriptors not covered by COUNTRY_SINGLE_WORDS.
 * Kept as a small alias so existing references still resolve.
 */
const GEO_SINGLE_WORDS = new Set([
  'cambodian','singaporean','indonesian','vietnamese','malaysian','taiwanese',
  'countries','nations','regions','provinces','territories','districts',
]);

/**
 * English adverbs (words ending -ly that are never company names).
 * Applied only when the name is a single word.
 */
const ADVERB_RE = /^(ridiculously|painfully|ironically|enormously|culturally|preferably|particularly|normally|dramatically|rapidly|reportedly|historically|increasingly|strategically|collectively|essentially|fundamentally|commercially|operationally|significantly|continuously|exclusively|particularly|consistently|subsequently)$/i;

/**
 * Hyphenated descriptor phrases — tech jargon, not company names.
 * "Cloud-native", "Text-to-video", "Go-to-market", "Llm-based", "End-to-end"
 */
const HYPHENATED_DESCRIPTOR_RE = /^(cloud|text|llm|ai|ml|open|gpu|cpu|end|to|low|high|full|real|near|long|short|first|next|gen|state|data|self|zero|cross|multi|edge|on|off|in|out|re|pre|co|sub|mid|non|semi|micro|macro|hyper|ultra|super|cyber|auto|eco|bio|geo|agri|agro|fintech|healthtech|edtech|cleantech|proptech|insurtech|regtech|legtech|martech|govtech|adtech|contech|femtech|medtech|deeptech|legaltech|foodtech|retailtech|hrtech|devops|no-code|low-code|b2b|b2c|d2c|saas|paas|iaas|open-source|go-to|end-to|peer-to|business-to|one-time|record-setting|community-powered|decision-making|best-seller|single-platform|purpose-built|industry-specific|gpu-accelerated|blockchain-based|ai-powered|ai-driven|ai-native|api-first|developer-first|mobile-first|cloud-first)-[\w-]*$/i;

/**
 * Hyphenated adjective suffix patterns — "Google-backed", "Sora-generated",
 * "Dubai-headquartered", "AI-powered", "VC-backed", "Tiger-led".
 * These are adjective descriptors in news headlines, not startup names.
 */
const HYPHENATED_ADJECTIVE_SUFFIX_RE =
  /^[\w.']+-(backed|funded|led|powered|generated|headquartered|based|owned|driven|focused|first|native|centric|only|friendly|ready|enabled|built|certified|licensed|regulated|listed|traded|acquired|owned)$/i;

/**
 * Generic single words that are industry descriptors, not company names.
 * Only applied when the candidate is exactly this single word (no spaces).
 * "Pharma" → reject; "35Pharma" or "Pharma Inc" → allowed.
 */
const GENERIC_SINGLE_WORDS = new Set([
  'refinance','refinancing','nutrition','natural','organic','renewable','sustainable',
  'digital','virtual','mobile','wireless','broadband','cloud','cyber','smart',
  'banking','insurance','lending','mortgage','investing','trading','crypto','bitcoin',
  'healthcare','wellness','fitness','therapy','medical','pharma',
  'logistics','transport','shipping','delivery','commerce','retail','marketing',
  'analytics','automation','optimization','infrastructure','platform','solution',
  'enterprise','startup','venture','capital','equity','fund','portfolio',
  'innovation','disruption','transformation','acceleration',
  'software','hardware','firmware','semiconductor','microchip',
  'engineering','manufacturing','processing',
  'education','learning','training','coaching',
  'media','content','streaming','broadcasting','publishing',
  'energy','solar','wind','nuclear','hydrogen','battery',
  'agriculture','farming','livestock','aquaculture',
  'construction','architecture',
  'cybersecurity','blockchain','metaverse','nft','defi','dao',
  // Common English nouns that appear as extracted names
  'drugs','classrooms','countries','sectors','protections','observations',
  'initiatives','schemes','disruptions','discoveries','crossovers','transfers',
  'buses','trucks','gyms','resorts','joints','parties','feeds','suits',
  'reservations','improvements','announcements','partnerships','collaborations',
  'investments','developments','technologies','solutions','services','products',
  // Generic adjectives / verbs scraped as startup names from news inference
  'dancing','dumb','bad','boring','exciting','interesting','amazing','incredible',
  'crazy','weird','strange','funny','silly','stupid','dangerous','risky',
  'staff','workers','employees','workforce','personnel','headcount','hiring',
  'doctors','nurses','patients','students','teachers','lawyers','judges',
  'sport','sports','athletic','fitness','recreation','leisure','hobby',
  'robotic','autonomous','electric','quantum','nuclear',
  'conference','summit','forum','panel','seminar','workshop','webinar',
  'devops','scrum','kanban','lean','waterfall',
  'perks','benefits','compensation','salary','wages','bonus','equity',
  'checking','savings','payment','transfer','deposit','withdrawal',
  'single','double','triple','multiple','dual','hybrid','integrated',
  'attract','retain','engage','onboard','offboard','manage','track',
  'unlock','accelerate','simplify','automate','streamline','optimize',
  'strengthening','selling',
  'graveyard','cemetery','archive','legacy','deprecated','abandoned',
  'extinction','collapse','bankruptcy','default','insolvency','failure',
  // Headline verbs appearing as single-word names
  'ignoring','avoiding','embracing','adopting','rejecting','replacing',
  'disrupting','transforming','reshaping','reinventing','reimagining',
  // Academic credentials used as standalone entity names
  'phd','phds','mba','mbas','md','mds','jd','jds','llm','llms','cpa','cpas',
  // System and error strings used as startup names
  'error','errors','exception','warning','undefined','null','none','unknown',
  'test123','example','placeholder','lorem','ipsum',
  // Gerund / present-participle verbs as standalone "startup names"
  'fueling','powering','enabling','driving','building','making','doing',
  'growing','scaling','shipping','deploying','launching','closing',
  // Generic financial and banking terms as standalone names
  'deposits','withdrawals','settlements','clearinghouse','custodian',
  'remittance','disbursement','receivables','payables','collateral',
  // Temporal / recency adjectives used as standalone names
  'recent','current','upcoming','previous','existing','legacy',
  'modern','traditional','conventional','standard',
  // Present-tense verbs / gerunds that appear as scraped "startup names"
  'adding','removing','building','defining','define','creating','connecting',
  'scaling','deploying','managing','monitoring','tracking','reporting',
  // Software category plurals (not startup names)
  'crms','erps','hrms','cmss','idps','saas','paas','iaas',
  'apis','sdks','ides','orms','cdns','vpns','ldaps',
  // Generic team/product nouns often appearing from Microsoft/Google product names
  'teams','channels','meetings','workspaces','instances','tenants',
  // Cybersecurity attack/threat vocabulary (not startup names)
  'exfiltration','ransomware','phishing','malware','spyware','adware',
  'botnet','rootkit','backdoor','keylogger','trojan','worm','virus',
  // Generic adjectives (past-participle / tech descriptor words)
  'driverless','autonomous','automated','serverless',
  'composable','observable','programmable','configurable','extensible',
  // Generic nouns that appear as standalone "startup names" from RSS scraping
  'certification','certifications','accreditation','licensing',
  'bands','tracks','artists','musicians','performers','entertainers',
  'tasks','assignments','projects','deliverables','milestones',
  // Singular and plural demonyms not caught by the extended demonym regex
  'iranian','iraqis','iraqi','turkish','turks',
  'russian','russians','american','americans','european','europeans',
  'asian','asians','african','africans','australian','australians',
  'cuban','cubans','canadian','canadians','israeli','israelis','brazilians',
  'jordans','nikes','adidases', // plural brand names scraped as entities
  // Days of week and months as standalone entries
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
  'january','february','march','april','may','june',
  'july','august','september','october','november','december',
  // Operating systems and platform software (not startups)
  'unix','linux','macos','windows','android','ios','ubuntu','debian','fedora',
  'centos','redhat','archlinux','gentoo','freebsd','openbsd',
  // Authentication and security protocols (not startup names)
  'oauth','saml','ldap','kerberos','jwt','ssl','tls','https','smtp','imap',
  'ftp','sftp','ssh','dns','dhcp','http','rest','soap','graphql','grpc',
  // Blockchain / crypto infrastructure terms
  'mainnet','testnet','devnet','blockchain','defi','dao','nft','dex','cex',
  // Generic adjectives used as standalone "company names"
  // Note: 'contextual' excluded — Contextual is a real AI startup
  'interactive','conversational','generative','composable',
  'immersive','modular','scalable','resilient','observable','deterministic',
  // Software license identifiers (standalone word only; "Apache AI" is a startup)
  'gpl','proprietary',
  // Geographic / event singletons
  'davos','davos2024','davos2025','davos2026',
  'capitol','parliament','congress','senate','whitehall',
  // Media / publication types
  'newsletter','podcast','magazine','journal','gazette','tribune','herald',
  // Single common English words that are not startup brands
  // (Title-cased versions also blocked since these have no brand identity alone)
  'secret','burger','burger king','tycoon','mogul','dashboard','decoder',
  'heavy','brief','digest','bulletin','memo','report','update',
  // Generic English nouns with no brand identity
  'apartment','documentation','consumer','combination','jury','polling',
  'vinyl','record','resource','resources','transcript',
  'resiliency','initiative','resiliency initiative',
  // New single-word blocks from this batch
  'hello','husband','elite','compaction','revamp','valentine',
  'informatics','notepad','shorts','keeping','terminal',
  // Generic single-word common nouns that appear as startup names from scrape noise
  'anatomy', 'components', 'independent',
  // Famous journal / magazine titles mistaken for company names
  'nature',
  // Abstract nouns / common words (not brands when alone)
  'dilemma',
  // Very short (2-letter) ambiguous person names — not startup brand names
  'bo',
  // RSS headline / grammar tokens mistaken for company names
  'each', 'bold', 'claims',
  // Tech abbreviations / storage units (TBs = Terabytes)
  'tbs', 'gbs', 'pbs',
  // Common Italian/Spanish first names that appear as scrape artifacts
  'bella',
  // Plural days of week
  'saturdays','sundays','mondays','tuesdays','wednesdays','thursdays','fridays',
  // Programming languages / computer science notation
  'c#','c++','c','f#','f1',
  // Person names appearing in enrichment logs
  'moses',
  // Title abbreviations used as standalone names
  'dr','jr','sr','mr','ms','mrs','prof','rev','hon','esq',
  // Plural job/role acronyms (CSOs, CISOs, CTOs, etc. as standalone plural)
  'cisos','ctos','cfos','coos','cmos','cpos','caos','ceos',
  'vps','avps','evps','svps','gms','hrbps','chros',
  // Hardware / memory acronyms used as standalone names
  'vram','dram','sram','bios','uefi','acpi','nvme','sata','pcie',
  // Indian / Asian financial sector acronym
  'bfsi','nbfi',
  // Web server and build tools as standalone names
  'nginx','gradle','maven','cmake','webpack','babel',
  // Data science libs as standalone names
  'pandas','numpy','scipy','sklearn','pytorch','tensorflow',
  // AI model family name alone (without version number)
  'llama',
  // Docker plural configuration files (not a company)
  'dockerfiles', 'dockerfile',
  // Medical equipment / standards used as standalone names
  'x-ray', 'x ray', 'ct scan', 'mri',
  // USB/hardware connector standards
  'usb-c', 'usb-a', 'usb-b', 'usb3', 'usb2', 'hdmi', 'displayport',
  // Common quality/methodology adjectives used as standalone names
  'agile','scrum','lean','kanban',
  // Property/possession terms
  'tycoon','mogul',
  // Common abbreviation fragments
  'o','li','qi','tpa','tba',
]);

/**
 * Article verb chains: names that contain action verbs are headline fragments,
 * not company names. Only applied to 3+ word candidates to avoid false
 * positives on legitimate 2-word names like "Drive Health", "Launch Pad".
 */
const ARTICLE_VERB_CHAIN_RE =
  /\b(raises?|raised|drive|drives|drove|acquires?|acquired|launches?|launched|partnered|secures?|secured|announces?|announced|expands?|expanded|closes?|closed|wins?|won|names?|named|hires?|hired|cuts?|cut|lays?\s+off|layoffs?|files?\s+for|ipo|spac|goes?\s+public)\b/i;

/**
 * Crypto slang prefixes / ticker-noun compound terms.
 * "TGE Pump", "FDV Crypto", "ZEC How", "Ethereum Steak", "Crypto Saylor"
 * These appear when scrapers hit crypto news and extract price/event language.
 * Includes both short tickers (ETH, BTC) and full-name coins (Ethereum, Bitcoin).
 */
const CRYPTO_SLANG_RE =
  /^(TGE|FDV|TVL|APY|APR|DEX|CEX|AMM|DAO|NFT|DeFi|ZEC|XMR|SOL|ETH|BTC|AVAX|DOT|MATIC|ADA|LINK|UNI|AAVE|COMP|MKR|SNX|CRV|BAL|YFI|SUSHI|CAKE|BNB|USDT|USDC|DAI|WBTC|WETH|SHIB|DOGE|PEPE|FLOKI|Crypto|Ethereum|Bitcoin|Solana|Cardano|Polkadot|Chainlink|Avalanche|Polygon|Ripple|Litecoin|Dogecoin|Shiba|Binance|Tether|Uniswap|Aave|Compound|Saylor|Sharplink)\s+\w/i;

/**
 * Slash-separated attribution strings — "Mario Tama/Getty Images", "AP/Reuters".
 * Photo credits and wire attributions always contain a forward slash.
 */
const SLASH_ATTRIBUTION_RE = /^[A-Za-z][\w\s.'-]{0,40}\/[A-Za-z][\w\s.'-]{1,40}$/;

/**
 * "X and Y alum" — resume-style descriptor fragments, not company names.
 * "Microsoft and Uber alum", "YC and a16z alum"
 * Exception: accelerator stamp + company ("YC alum Mendel") — allowed.
 */
function matchesAlumDescriptorJunk(trimmed) {
  if (!/\balum\b/i.test(trimmed)) return false;
  if (
    /^(YC|Y\s+Combinator|YCombinator|Techstars|a16z|500\s+Startups|Plug\s+and\s+Play)\s+alum\s+\S+/i.test(
      trimmed
    )
  ) {
    return false;
  }
  return true;
}

/**
 * Opening quote — headline fragments copied verbatim including the quote mark.
 * "'Leverage the local'", ""We are building...""
 */
const LEADING_QUOTE_RE = /^['"""'']/;

/**
 * Two-word multi-country compound scraped as a name — "Egypt Saudi Arabia",
 * "Pakistan India", "US China". Flag when BOTH words are countries/regions.
 */
const MULTI_COUNTRY_RE = /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/;

/** Common city names used to reject "city-suffix" concatenation artifacts */
const COMMON_CITIES = new Set([
  'san francisco','new york','london','berlin','tokyo','paris','boston',
  'seattle','austin','chicago','los angeles','miami','denver','toronto',
  'singapore','bangalore','tel aviv','amsterdam','stockholm','dublin',
  'mountain view','palo alto','menlo park','redwood city','sunnyvale',
  // Additional US cities and geographic areas that appear in scraped data
  'grand rapids','salt lake city','kansas city','oklahoma city','el paso',
  'fort worth','san antonio','san diego','san jose','las vegas','phoenix',
  'portland','memphis','louisville','baltimore','nashville','charlotte',
  'indianapolis','columbus','jacksonville','raleigh','hartford','richmond',
  'buffalo','rochester','albany','birmingham','jackson','little rock',
  'baton rouge','new orleans','tampa','orlando','atlanta','detroit',
  // Countries / territories appearing as names
  'el salvador','costa rica','puerto rico','dominican republic','panama',
  'trinidad','barbados','cayman islands','bermuda','bahamas','jamaica',
  'six continents', // old IHG hotel group name, also common phrase
]);
// ─────────────────────────────────────────────────────────────────────────────

const JUNK_PATTERNS = [
  // Names with commas = scraped phrase fragments, never real company names
  /,/,
  // English contractions ('re, 've, 'll, 'd, 'm, 't, 'n) = sentence fragment
  /'\s*(re|ve|ll|d|m|t|n)\b/i,
  // Possessive phrases: "Klarna Vets' Galdera", "India's Bacancy Systems"
  // Word + apostrophe-s (or plural possessive) + space + word = article fragment, not a brand
  // Matches both straight (') and curly (') apostrophes — note: Unicode is pre-normalized above
  /\w's\s+\w/i,       // India's Bacancy  →  word + 's + space + word
  /\ws'\s+\w/i,       // Vets' Galdera    →  s + ' + space + word (plural possessive)
  // Irish/Celtic surname prefix O' as entire name (O'Leary, O'Brien, O'Sullivan)
  // These are person surnames, not startup brands
  /^O'[A-Z][a-z]+$/,
  // Accented single-word given names (Nicolás, José, María, André, etc.)
  // These are first names with diacritics, never startup brands as standalone words
  /^[A-ZÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÑÇØÅÆŒ][a-záéíóúàèìòùäëïöüâêîôûãñçøåæœ]+[áéíóúàèìòùäëïöüâêîôûãñçøåæœ][a-z]*$/,
  // Names with repeated significant words = clearly scraped junk ("FinTech Global FinTech")
  /^(\w+)\s+\w+\s+\1$/i,
  // Two identical consecutive words ("LVMH LVMH", "AI AI") = duplicate scrape artifact
  /^(\S+)\s+\1$/i,
  // Colon separator = news article / category label, never a startup name
  // "RWA news: Midas", "Breaking: Company X", "Sector: FinTech"
  /:/,
  // Hyphenated French/European place names with lowercase connector words
  // "Bruyères-le-Châtel", "Aix-en-Provence", "Clermont-Ferrand"
  /^[A-Z][a-záéíóúàèìòùäëïöüâêîôûãñç]+-(?:le|la|les|de|du|des|sur|en|et|au|aux|sous|saint|sainte)-/i,
  // Programming language names with special chars: C#, C++, F#
  /^[A-Z][#+*]$/,
  // Crypto/political topic + "-related" suffix: "DOGE-related", "Bitcoin-related"
  /\b-related\s*$/i,
  // "[Company] is [verb]ing" = news sentence, not startup name
  /\b(is|are|was|were)\s+(selling|buying|raising|launching|acquiring|merging|closing|shutting|filing)\b/i,
  // Currency amounts ("US$75", "$50M", "€100") — never a startup name
  /[£€$¥₹]\s*\d/,
  /\bUS\$\d/,
  // Algorithmic complexity notation ("O(n", "O(log n)") — math, not brand
  /^O\s*[\(\[]/,
  // Location/entity-based compound adjective as ENTIRE name ("Dubai-headquartered Spiro", "mobile giant Airtel")
  // Catches "Dubai-headquartered Spiro" (location-adjective before company name)
  /^[A-Z][a-z]+-(?:headquartered|based|backed|managed|owned|funded|led|powered|driven|focused|oriented|centric)\s+/i,
  // Lowercase opener = scraped phrase fragment ("mobile giant Airtel")
  /^[a-z]+\s+[a-z]+\s+[A-Z]/,
  // Ends with location-based compound adjective (separate pattern)
  /\b(headquartered|backed|managed|owned|funded|led|powered|driven|focused|oriented)\s*$/i,
  // Geographic language qualifier as first word ("Francophone West Africa")
  /^(Francophone|Anglophone|Hispanophone|Lusophone)\s+/i,
  // State/city + abbreviation compound ("Bellevue Wash", "Springfield IL")
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Wash|Ore|Calif|Penn|Mich)$/,
  // Encryption / security standard identifiers: "AES-256", "RSA-2048", "SHA-512"
  /^(AES|RSA|SHA|MD|DES|3DES|ECDSA|ECDH|Ed|X|ChaCha|Poly|Salsa|HMAC)[-_]?\d+/i,
  // Software license version strings: "Apache-2.0", "GPL-3.0", "MIT-0", "CC-BY-4.0"
  /^(Apache|GPL|LGPL|AGPL|MIT|BSD|MPL|CC|CDDL|EPL|EUPL|ISC|OSL|Artistic|WTFPL|Unlicense|Zlib)[-\/][\d.]+/i,
  // Semantic version strings used as names: "v2.4.1", "1.0.0"
  /^v?\d+\.\d+(\.\d+)?(-[a-z0-9]+)?$/i,
  /^Weekly\s+/i,
  /^Daily\s+/i,
  /^Monthly\s+/i,
  /^Top\s+\d+/i,
  /^How\s+/i,
  /^Why\s+/i,
  /^What\s+/i,
  /^The\s+Best/i,
  /^Best\s+/i,
  /^Latest\s+/i,
  /^News\s+/i,
  /^Update\s+/i,
  /^Roundup/i,
  /^Digest/i,
  /^Summary/i,
  /^test/i,
  /^demo/i,
  /^sample/i,
  /^placeholder/i,
  /^untitled/i,
  /^new startup/i,
  /^temp/i,
  /^draft/i,
  /^pending/i,
  /^unknown/i,
  /^unnamed/i,
  /^n\/a$/i,
  /^tbd$/i,
  /^\d+$/,                 // pure numbers
  /^.{0,1}$/,
  /^.{100,}$/,
  // Newswire / SEO / broken paste
  /^(Breaking|Exclusive|Developing|ICYMI|Analysis|Editorial|Op-Ed|Opinion|Watch|Live):\s*/i,
  /^(UPDATE|UPDATED|LIVE|VIDEO)\s*[:\-]/i,
  /^\[+[^\]]+\]\s*/,      // [Video], [Podcast] prefixes
  /\b(according to|sources say|sources said|sources tell|people familiar|declined to comment|filing shows|sec filing)\b/i,
  /\b(has|have)\s+(raised|secured|closed|announced|filed|landed)\b/i,
  /\b(is|are|was|were)\s+(raising|seeking|planning|expected|set to)\b/i,
  /,\s*which\s+(is|was|uses)\b/i,
  /\bvs\.?\s+[A-Z][a-z]+\b/i,
  /\b(coupon|promo code|discount code)\b/i,
  /\b(click here|read more|subscribe|sign up)\b/i,
  /\b(article url|tool to|which uses)\b/i,
  /\b(raises?|raised|closes?|closed)\s+\$\d/i, // "$5M" inside name field
  /\b(ceo|cto|cfo|coo|cmo)\s+[A-Z][a-z]+\s*$/i,
  // "Acme CEO Marc Benioff", "OpenAI CEO Sam Altman" — headline / speaker, not a company trading name
  /^(ceo|cto|cfo|coo|cmo)\s+[A-Z][a-z]+\s+[A-Z][a-z]+$/i,
  /\b(ceo|cto|cfo|coo|cmo)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*$/i,
  /\b(former|ex-)\s+(ceo|cto|cfo|founder)\s+[A-Z]/i,
  /\b(LinkedIn|Twitter|X\.com|Substack)\s+[A-Z]/i,
  /\b(The)\s+(Economist|Atlantic|Information)\b/i,
  /^The\s+(White House|Fed|Pentagon|SEC|FTC|DOJ|Treasury)\b/i,
  /\b(article|post|blog|newsletter|email|digest|roundup|summary|highlights|update|announcement)\b/i,
  // Headline fragments (article titles mistaken for company names)
  /\bpleads?\s+guilty/i,
  /\bproves?\s+[a-z]/i,
  /^Understanding\s+/i,
  /^Find\s+Your\s+/i,
  /^Building\s+[A-Za-z]+\s+[A-Za-z]+/i,
  /\d+\s*(million|billion)?\s*[Ff]undraise\s+/i,
  /^By\s+[A-Z][a-z]+(?:\s|$)/i,
  /^Startups?\s+[Cc]apture/i,
  // Law firm / advisor phrases (e.g. "Goodwin Advises Shellworks On")
  /\b[A-Z][a-z]+\s+Advises\s+/i,
  /\bAdvises\s+[A-Z]/i,
  /\bWilson\s+Sonsini\b/i,
  /\bGoodwin\s+Procter\b/i,
  /\bCooley\s+(LLP)?\s+Advises\b/i,
  // Generic article-style phrases
  /\b(Capture|Proves|Understanding|Building)\s+(Record|AI|Personal|Inclusive)/i,
  /^(Man|Woman|CEO|Founder)\s+[A-Z]/i,
  // Sentence-starting verbs (headline fragments)
  /^(Can|Is|Are|Was|Were|Gets?|Got|Has|Have|Had|Will|Would|Could|Should|Might|Must|Shall|Do|Does|Did)\s+/i,
  /^(Runs?|Running|Raises?|Raised|Receives?|Received|Announces?|Announced|Says?|Said|Reports?|Reported)\s+/i,
  // Headline-style "X For Y" / "X Into Y"
  /\b(Money|Runs?)\s+(For|Into)\s+AI\b/i,
  /\bHuge\s+Money\s+For\b/i,
  // Instructional / "Your X"
  /\b(Red\s+)?Team\s+Your\s+/i,
  /\bYour\s+AI\b/i,
  // Event / livestream headlines
  /\bConclave\s+To\s+Bring\b/i,
  /^Join\s+Our\s+Next\s+/i,
  /\bLivestream\b/i,
  // M&A / deal headlines
  /^Majority\s+Stake\s+(In|In The)\b/i,
  /\bGets?\s+Prison\s+Time\b/i,
  // Market / finance headlines
  /\bDaily\s+Open\b/i,
  /^State\s+Of\s+(Venture|The)\b/i,
  // Descriptor-prefix headlines (Spanish/Mexican/US-backed = publication-style; YC-backed/YC alum are often legitimate)
  /^(Spanish|Mexican|US-backed)\s+(edtech|fintech|healthtech|AI)?\s*[A-Z]/i,
  /^Bladder\s+cancer\s+innovator\s+/i,
  /\binnovator\s+[A-Z][a-z]+\s*$/i,  // "X innovator Combat"
  // "X Executive" = person title, not company
  /^(Canva|Google|Meta|Apple|Microsoft|Amazon)\s+Executive\b/i,
  // "Ex-X" founder descriptor fragments
  /^Ex-[A-Z][a-z]+\s*$/i,  // "Ex-Shipt" alone = fragment
  // "Businessline X" = news publication prefix (Business Line newspaper)
  /^Businessline\s+[A-Z][a-z]+\s*$/i,
  // Possessive phrase fragments
  /\bNow\s+His\s+AI\b/i,
  // Past participle / passive voice
  /\b(Learnt|Seek)\s+Studying\b/i,
  /\b(Labs?|Ltd)\s+Awarded\b/i,
  /\bAwarded\s*$/i,
  // Generic single-word verbs (not company names)
  /^Opening$/i,
  /^Fastest\s+First\b/i,
  /^Wealthy\s+Runs\b/i,
  // Major financial institutions (not startups)
  /^Morgan Stanley$/i,
  /^Goldman Sachs$/i,
  /^J[.\s]?P\.?\s*Morgan$/i,
  /^CNBC\b/i,
  // Framework/library names (often mistaken)
  /^Next\.js$/i,
  /^President\s+(Biden|Trump|Obama|Bush|Clinton|Reagan|Carter|Ford|Nixon|Kennedy)\b/i,
  // Government official title fragments — "Foreign Minister X", "Finance Minister Y"
  /\b(Foreign|Finance|Defense|Interior|Prime|Justice|Health|Education|Commerce)\s+Minister\b/i,
  /\bMinister\s+of\s+[A-Z]/i,
  // Truncated headline tails (entity = speaker, not company)
  /\sSays?$/i,
  /\sSaid$/i,
  /\sAnnounces?$/i,
  /\sWarns?$/i,
  /\sSlams?$/i,
  /\sBlasts?$/i,
  /\sCalls\s+For\b/i,
  /\sSpeaks\s+Out\b/i,
  /\sTestifies\b/i,
  /\sFires\s+Back\b/i,
  // Comma-descriptor person headlines: "Jane Doe, Former CEO of..."
  /,\s*(Former|Ex-)\s+/i,
  /,\s*CEO\s+of\b/i,
  // OEM / megacorp + product-news tokens (RSS mistakes headlines for company names)
  /^Samsung\s+Shift\b/i,
  /^Samsung\s+(Galaxy\s+)?Unpacked\b/i,
  // Truncated / typo publication or domain artifacts
  /^techruplic$/i,
  // Date-shaped article titles mistaken for company names (e.g. "October 21, 2019")
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}$/i,
  /^(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},\s*\d{4}$/i,
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,
  // Headline / deck fragments (RSS entity extraction)
  /^Congratulations\b/i,
  /^Leaked\b/i,
  /headquartered$/i,
  /^FY\d{2}\b/i,
  /^Actually\s+Taught\b/i,
  /^Private\s+Aviation\b/i,
  /^Investor\s+[A-Z]/i,
  /^Expansion\s+[A-Z]/i,
  /\sWhat\s*$/i,
  /^Blackstone\s+Life\s+Sciences\b/i,
  /^Retail\s+Fintech\b/i,
  /^Wearable\s+Fitness\b/i,
  /^Advance\s+Universal\b/i,
  /^SLA-/i,
  /Booz Allen.*Cisco/i,
  /\bGE Vernova\b/i,
  // Day-of-week + word/place fragments ("Monday April", "Tuesday Baltimore", "Friday Iranian")
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\w/i,
  // "X Market(s)" — market research / industry category names
  /\s+Markets?\s*$/i,
  // Possessive person/brand fragment ("Mike Markkula's", "Norway's Unleash", "L'Oréal's")
  // Excludes single possessive word which could be brand (handled below)
  /^[A-Z][a-zA-Z\u00C0-\u024F]{2,20}'s?\s+[A-Z]/,
  // "X shares" / "X stock" / "X equity" — financial instrument fragments
  /\b(shares|stock|stocks|equity|bonds|notes|options|warrants)\s*$/i,
  // AI/LLM model version names — not startup companies
  /^Claude\s+(Opus|Sonnet|Haiku|Code|3|4|Instant)\b/i,
  /^(ChatGPT|GPT-[0-9]|Gemini\s+(Pro|Ultra|Flash|Nano)|Llama\s*[23]|Mistral\s+\w|Grok\s*\d)/i,
  // Algorithm / complexity notation — "Sort O(n", "NSGA-III"
  /[O]\s*\([a-z0-9\s\+\*\^]+\)/i,
  /≠/,
  // Markdown/code file fragments — "CONTRIBUTING.md Sponsor"
  /\.[a-z]{2,4}\s+\w/i,
  // Government/political role + name ("Rep Greg Steube R-Fla", "Senate Budget Chair Lindsey",
  //   "Minority Leader Hakeem Jeffries", "Governor Wes Moore", "Interior Secretary Doug Burgum")
  /^(Rep|Sen|Gov|Sec|Cong|Assembl)\.\s+[A-Z]/i,
  /^(Senate|House|Congressional|Minority\s+Leader|Majority\s+Leader|Governor|Interior\s+Secretary|Treasury\s+Secretary|Commerce\s+Secretary|Education\s+Secretary)\s+/i,
  // Colon-with-number fragments ("Cheque in: 9 startups")
  /:\s*\d+\s+\w/,
  // Product + irrelevant word tail ("DoorDash Rather", "Jenkins You", "Python It", "PDF Without",
  //   "Windsurf Knowing", "Atari Jobs", "Micron shares", "Claude Code Then")
  /\s+(Rather|You|It|Without|Knowing|Publicly|Than|Then|Here)\s*$/i,
  // Apple / consumer product names
  /^AirPods\b/i,
  /^AirTag\b/i,
  // Funding-source fragments ("funding - Wamda")
  /^funding\s*[-–]/i,
  // Contraction-only names ("It's", "Let's")
  /^(It's|Let's|I'm|We're|They're|There's|That's|Don't|Can't|Won't|Wouldn't|Couldn't)\s*$/i,
  // Long Japanese/CJK article titles (often > 80 chars but catch shorter ones too)
  /[、。「」【】《》]/,
  // R-state abbreviation pattern used in US political names ("R-Fla", "D-TX")
  /\b[RD]-[A-Z][a-z]{0,4}\b/,
  // Publisher/author + platform combos ("Upton Sinclair Amazon", "Marilynne Robinson Amazon Little")
  /\b(Amazon|Little Brown|Penguin|HarperCollins|Random House|Simon Schuster)\s*$/i,
  // "[Word] DRHP" — Indian IPO filing abbreviation
  /\bDRHP\s*$/i,
  // Political groupings ("Conservatives", "Progressives", "Republicans", "Democrats")
  /^(Conservatives|Progressives|Republicans|Democrats|Independents|Libertarians)\s*$/i,
  // "Tags Fine-grained", "Tags" as a GitHub/tech metadata prefix
  /^Tags\s+/i,
  // Financial quantity noun ("Billion Recapitalization", "Billion X")
  /^(Billion|Trillion|Million)\s+\w/i,
  // Consumer app pair ("WeChat Alipay", "WhatsApp Telegram")
  /^(WeChat|Alipay|WhatsApp|Telegram|TikTok|Snapchat|Pinterest)\s+\w/i,
  // "X Recapitalization" — corporate finance event, not a startup
  /\bRecapitalization\b/i,
  // "X CWO Jeff", "Tom Brady CWO" — athlete/celebrity + title fragment
  /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+(CWO|CDO|CPO|CBO|CAO|CLO|CCO|CSO)\b/,
  // Dev tool compound chains — not startup names
  /^(SonarQube|SonarScanner|CONTRIBUTING|UnleashClient|Bitbucket\s+SonarCloud|OWASP|SAST\s+Snyk|AWS\s+DevOps|Azure\s+DevOps|GitLab\s+Dedicated)/i,
  // "[Name] ARR" / "Agentforce ARR" — metric abbreviation tail
  /\b(ARR|MRR|EBITDA|DAU|MAU|LTV|CAC)\s*$/,
  // "[Day] [Month]" date fragments ("Monday April")
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i,
  // Podcast / sports / headline category junk
  /^ALL[- ]IN\s+Podcast$/i,
  /^Real\s+Madrid\b/i,
  /^Stan\s+Store\b/i,
  /^Global\s+Manufacturing\b/i,
  /^Accelerate\s+Commercial/i,
  /^Zero\s+Billion$/i,
  /^Co\s+Thriving$/i,
  /^TikToks$/i,
  /^Business\s+City$/i,
  /^Stanford\s+Medicine$/i,
  /\bStrengthening\s+(Leadership|Balance\s+Sheet|supply\s+chain|GitLab)/i,
  // SaaStr / news article titles mistaken for company names
  /\bLearned\s+Building\b/i,
  /^AI\s+Risk\s+Intelligence\b/i,
  /^Pearl\s+Health\s+Lands\b/i,
  /^Business[_ ]City$/i,
  /^Wolters\s+Kluwer$/i,
  /^Royal\s+Assent$/i,
  /^Chris\s+R[eé]$/i,
];

/** VC / fund names concatenated — not a single startup trading name */
const VC_FUND_PHRASES = [
  'sequoia capital',
  'andreessen horowitz',
  'index ventures',
  'insight partners',
  'lightspeed venture partners',
  'lightspeed venture',
  'kleiner perkins',
  'tiger global',
  'first round capital',
  'village global',
  'founders fund',
  'general catalyst',
  'coatue management',
];

function matchesVcFundSoup(trimmed) {
  const l = trimmed.toLowerCase();
  let phraseHits = 0;
  for (const p of VC_FUND_PHRASES) {
    if (l.includes(p)) phraseHits++;
  }
  if (phraseHits >= 2) return true;

  if (/\bsequoia\b/.test(l) && /\bandreessen\b/.test(l)) return true;
  if (/\bsequoia\b/.test(l) && /\ba16z\b/.test(l)) return true;
  if (/\bsequoia\b/.test(l) && /\bkleiner\b/.test(l)) return true;
  if (/\bbenchmark\b/.test(l) && /\bbessemer\b/.test(l)) return true;
  if (l.includes('index ventures') && l.includes('insight partners')) return true;
  if (/\bandreessen\b/.test(l) && /\bkleiner\b/.test(l)) return true;
  if (/\bstripe\b/.test(l) && /\bribbit\b/.test(l)) return true;

  const wc = trimmed.split(/\s+/).filter(Boolean).length;
  if (wc >= 4) {
    const heavy = ['sequoia', 'andreessen', 'horowitz', 'kleiner', 'benchmark', 'bessemer', 'a16z', 'lightspeed', 'tiger', 'coatue', 'accel', 'felicis', 'initialized'];
    const n = heavy.filter((t) => l.includes(t)).length;
    if (n >= 3) return true;
  }
  return false;
}

/** Second token that is a real megacorp legal/subsidiary name — not a product headline */
const MEGACORP_LEGAL_SECOND = new Set([
  'systems', 'system', 'corporation', 'corp', 'networks', 'network', 'technologies', 'technology',
  'semiconductor', 'dynamics', 'software', 'solutions', 'services', 'capital', 'ventures', 'labs', 'lab',
  'international', 'group', 'holdings', 'research', 'media', 'entertainment', 'defense', 'security',
  'cloud', 'workspace', 'web', 'ads', 'pay', 'health',
]);

/** Single common first name standing alone ("William", "Michelle", "Max") — not a company */
function matchesSingleFirstName(trimmed) {
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;
  return COMMON_GIVEN_NAMES.has(words[0].toLowerCase());
}

/** All-caps acronym chain — "SAST SCA DAST", "KYC AML CFT", "SOC NOC SIEM" — tech jargon, not a company */
function matchesAcronymChain(trimmed) {
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const acronymCount = words.filter((w) => /^[A-Z0-9]{2,6}$/.test(w)).length;
  // Also catch "Reviewer SAST SCA" patterns: one normal word + 2+ all-caps acronyms
  if (acronymCount < 2) return false;
  const allAcronyms = words.every((w) => /^[A-Z0-9]{2,6}$/.test(w));
  if (!allAcronyms && acronymCount < words.length - 1) return false;
  const techAcronyms = new Set([
    'SAST','SCA','DAST','IAST','RASP','WAF','SIEM','SOC','NOC','IAM','PAM','MDM',
    'ZTNA','CSPM','CWPP','CNAPP','XDR','EDR','NDR','SOAR','API','SDK','CLI','UI',
    'UX','CRM','ERP','SCM','PLM','HRM','SLA','SLO','KPI','OKR','ROI','ARR','MRR',
    'KYC','AML','CFT','PEP','GDPR','CCPA','HIPAA','SOX','PCI','DSS','ISO','NIST',
    'AI','ML','NLP','LLM','GPT','RAG','VPC','CDN','DNS','SSL','TLS','SSH','JWT',
    'ETL','ELT','CDC','DWH','OLAP','OLTP','RDS','SQS','SNS','ECR','ECS','EKS',
  ]);
  return words.filter((w) => techAcronyms.has(w)).length >= Math.ceil(words.length / 2);
}

/** Financial megacorp soup — "Goldman Sachs Apollo JPMorgan", "America Bank" */
const FINANCIAL_MEGACORP_TOKENS = new Set([
  'goldman','sachs','jpmorgan','morgan','stanley','citigroup','citi','blackrock',
  'vanguard','fidelity','blackstone','carlyle','apollo','ares','bain','tpg',
  'kkr','warburg','advent','softbank','temasek','gic','cppib','calpers','wellsfargo',
  'wells','bancorp','barclays','hsbc','ubs','creditsuisse','deutsche','bnp','paribas',
  'santander','lloyds','natwest','rbs','macquarie','mufg','mizuho','sumitomo',
]);

function matchesFinancialInstitutionSoup(trimmed) {
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  const hits = words.filter((w) => FINANCIAL_MEGACORP_TOKENS.has(w.toLowerCase())).length;
  if (hits >= 2) return true;
  const l = trimmed.toLowerCase();
  if (/\bgoldman\b/.test(l) || /\bjpmorgan\b/.test(l) || /\bblackrock\b/.test(l)) return true;
  if (l === 'america bank' || l === 'bank of america' || /^america\s+bank$/i.test(trimmed)) return true;
  return false;
}

/** Extended VC/PE fund name soup beyond the primary list */
const EXTENDED_VC_TOKENS = new Set([
  'redalpine','highland','norwest','new enterprise','associates','nea','idc','ventures',
  'octopus','draper','nexus','meritech','crosscut','industry','canaan','gv','greylock',
  'union square','usv','spark','lux','lux capital','threshold','thrive','tiger',
  'coatue','altimeter','tiger global','d1','viking','lone pine','whale rock',
  'qumra','pontifax','vertex','pitango','magic leap','glilot','viola',
  // Additional known VC fund names used in composites
  'redpoint','fpv','hv capital','hv','blue owl','owl','framework','framework ventures',
  'powerhouse','vendep','qumra',
]);

function matchesExtendedVcSoup(trimmed) {
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  const l = trimmed.toLowerCase();
  const hits = [...EXTENDED_VC_TOKENS].filter((t) => l.includes(t)).length;
  return hits >= 2;
}

/** Megacorp + token — acquisition / product headline, not an independent startup */
function matchesMegacorpProductHeadline(trimmed) {
  if (/^Getty Images\b/i.test(trimmed)) return true;
  if (/^Palo Alto Networks\s+/i.test(trimmed)) return true;
  if (/^Dell Technologies\b/i.test(trimmed)) return true;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;

  const mega = /^(Google|Microsoft|Meta|Apple|Amazon|NVIDIA|Salesforce|Oracle|SAP|IBM|Cisco|Samsung|Intel|Adobe|ServiceNow|Workday)$/i;
  if (mega.test(parts[0])) {
    const second = parts[1].replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!MEGACORP_LEGAL_SECOND.has(second)) {
      return true;
    }
    return false;
  }

  if (/^NVIDIA$/i.test(parts[0]) && parts.length >= 2) {
    const second = parts[1].replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!MEGACORP_LEGAL_SECOND.has(second)) return true;
  }
  return false;
}

/** Multi-region geography scraped as a "company" */
function matchesGeographicHeadlineFragment(trimmed) {
  const l = trimmed.toLowerCase();
  if (
    l === 'south america' ||
    l === 'north america' ||
    l === 'central america' ||
    l === 'latin america' ||
    l === 'southeast asia'
  ) {
    return true;
  }
  if (/^southeast asia\s+/i.test(trimmed) && /\bafrica\b/i.test(l)) return true;
  return false;
}

/** "Shopify X Y CEO" — executive / speaker line, not a company */
function matchesExecutiveTitleTail(trimmed) {
  if (!/\s(CEO|CTO|CFO|COO|CMO)\s*$/i.test(trimmed)) return false;
  const w = trimmed.split(/\s+/).filter(Boolean);
  return w.length >= 2;
}

/** "YC Demo Day TechCrunch" — event / media, not a startup */
function matchesYcMediaEventHeadline(trimmed) {
  const l = trimmed.toLowerCase();
  if (!/\b(yc\b|y combinator|ycombinator)\b/.test(l)) return false;
  return /\b(demo day|techcrunch|disrupt)\b/.test(l);
}

function isValidStartupName(name, options = {}) {
  const allowAnnounceSalvage = options.allowAnnounceSalvage !== false;

  if (!name || typeof name !== 'string') {
    return { isValid: false, reason: 'empty_or_null' };
  }

  // Normalize Unicode punctuation that web scrapers commonly produce.
  // Curly apostrophes (U+2018/2019), smart quotes (U+201C/201D), and
  // dashes (U+2013 en-dash, U+2014 em-dash) all bypass ASCII-based regex patterns.
  name = name
    .replace(/[\u2018\u2019\u02BC\u02B9]/g, "'")  // curly/modifier apostrophes → '
    .replace(/[\u201C\u201D]/g, '"')               // curly double-quotes → "
    .replace(/[\u2013\u2014]/g, '-');              // en/em dash → hyphen

  const trimmed = name.trim();
  if (trimmed.length < 2) return { isValid: false, reason: 'too_short' };
  if (trimmed.length > 80) return { isValid: false, reason: 'too_long' };

  if (isKnownGoodStartupName(trimmed)) {
    return { isValid: true };
  }

  if (allowAnnounceSalvage) {
    const stem = stripAnnounceHeadlineTail(trimmed);
    if (stem !== trimmed && stem.length >= 2) {
      const inner = isValidStartupName(stem, { allowAnnounceSalvage: false });
      if (inner.isValid) return { isValid: true };
    }
  }

  for (const key of blocklistLookupKeys(trimmed)) {
    if (NON_COMPANY_EXACT_NAMES.has(key)) {
      return { isValid: false, reason: 'known_non_company_name' };
    }
  }

  if (matchesLikelyPersonNameWithInitials(trimmed)) {
    return { isValid: false, reason: 'likely_person_name_initials' };
  }

  if (matchesLikelyPersonNameTwoWords(trimmed)) {
    return { isValid: false, reason: 'likely_person_name' };
  }

  for (const p of JUNK_PATTERNS) {
    if (p.test(trimmed)) return { isValid: false, reason: 'matches_pattern' };
  }

  // ── Structural checks (from ssot validator + enrichment audit) ───────────
  // YC batch seasons ("W24", "Summer 2023")
  if (BATCH_SEASONS_RE.test(trimmed)) {
    return { isValid: false, reason: 'contains_batch_season' };
  }

  // Location-based prefix — "Boston-based", "Miami-based", "US-based"
  if (LOCATION_BASED_RE.test(trimmed)) {
    return { isValid: false, reason: 'location_based_prefix' };
  }

  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Single geographic word — standalone country / state / city-fragment
  if (words.length === 1 && (GEO_SINGLE_WORDS.has(lower) || COUNTRY_SINGLE_WORDS.has(lower))) {
    return { isValid: false, reason: 'geographic_entity' };
  }

  // Single English adverb (ridiculously, painfully, ironically, …)
  if (words.length === 1 && ADVERB_RE.test(trimmed)) {
    return { isValid: false, reason: 'adverb_not_company' };
  }

  // Hyphenated tech descriptor ("Cloud-native", "Text-to-video", "Go-to-market")
  if (words.length === 1 && HYPHENATED_DESCRIPTOR_RE.test(trimmed)) {
    return { isValid: false, reason: 'hyphenated_descriptor' };
  }

  // Hyphenated adjective suffix — "Google-backed", "Sora-generated", "Dubai-headquartered"
  if (words.length === 1 && HYPHENATED_ADJECTIVE_SUFFIX_RE.test(trimmed)) {
    return { isValid: false, reason: 'hyphenated_adjective_suffix' };
  }

  // Compound adjective/adverb descriptors not caught by prefix regex
  const COMPOUND_DESCRIPTOR_EXACT = new Set([
    'community-powered','record-setting','decision-making','one-time','single-platform',
    'best-seller','best-in-class','state-of-the-art','first-of-its-kind','first-of-a-kind',
    'late-stage','early-stage','mid-stage','seed-stage','growth-stage',
    'debt-free','profit-first','revenue-first','customer-first','privacy-first',
    'go-to-market','end-to-end','peer-to-peer','business-to-business','business-to-consumer',
    'blockchain-based','ai-based','cloud-based','web-based','app-based','tech-based',
    'purpose-built','industry-specific','mission-critical','open-ended',
    'llm-based','gpt-based','gpt-powered','ai-powered','ai-driven',
    'sla-backed',
  ]);
  if (words.length === 1 && COMPOUND_DESCRIPTOR_EXACT.has(lower)) {
    return { isValid: false, reason: 'hyphenated_descriptor' };
  }

  // Single generic dictionary word — only when name is exactly that word
  if (words.length === 1 && GENERIC_SINGLE_WORDS.has(lower)) {
    return { isValid: false, reason: `generic_single_word` };
  }

  // Quoted-phrase fragments — "'Leverage the local'", ""We are building…""
  if (LEADING_QUOTE_RE.test(trimmed)) {
    return { isValid: false, reason: 'quoted_phrase_fragment' };
  }

  // Slash attribution — "Mario Tama/Getty Images", "AP/Reuters"
  if (SLASH_ATTRIBUTION_RE.test(trimmed)) {
    return { isValid: false, reason: 'slash_attribution' };
  }

  // "X alum" resume descriptor — "Microsoft and Uber alum" (not "YC alum Mendel")
  if (matchesAlumDescriptorJunk(trimmed)) {
    return { isValid: false, reason: 'alum_descriptor' };
  }

  // Crypto ticker/slang compound — "TGE Pump", "FDV Crypto", "Ethereum Steak"
  // Exception: "[CoinName] Labs / Foundation / Protocol / Network" can be a real project name
  if (CRYPTO_SLANG_RE.test(trimmed)) {
    const CRYPTO_COMPANY_SUFFIX_OVERRIDE = new Set([
      'labs','lab','foundation','protocol','network','networks','chain','dao',
      'ventures','capital','fund','research','institute','exchange','wallet',
    ]);
    const lastW = words[words.length - 1]?.toLowerCase();
    if (!CRYPTO_COMPANY_SUFFIX_OVERRIDE.has(lastW)) {
      return { isValid: false, reason: 'crypto_slang_compound' };
    }
  }

  // Multi-country compound — "Egypt Saudi Arabia", "Pakistan India", "Dar Pakistan"
  // Fire when 2+ words in the name are country/geo names (and no company-like suffix).
  if (words.length >= 2 && words.length <= 4 && MULTI_COUNTRY_RE.test(trimmed)) {
    const COUNTRY_WORD_EXTRAS = new Set([
      'saudi','arabia','korea','north','south','new','guinea','verde','tome','principe',
      'lucia','kitts','nevis','vincent','grenadines','helena','tobago','herzegovina',
      'dar','islamabad','karachi','lahore','dhaka','kabul','tehran','baghdad',
    ]);
    const countryWordCount = words.filter(w => {
      const wl = w.toLowerCase();
      return COUNTRY_SINGLE_WORDS.has(wl) || GEO_SINGLE_WORDS.has(wl) || COUNTRY_WORD_EXTRAS.has(wl);
    }).length;
    // Also ensure the last word isn't a company-type suffix
    const lastWord = words[words.length - 1].toLowerCase();
    const hasCorporateSuffix = COMPANY_LIKE_SECOND_WORD.has(lastWord);
    if (countryWordCount >= 2 && !hasCorporateSuffix) {
      return { isValid: false, reason: 'multi_country_compound' };
    }
  }

  // Nationality/demonym used as standalone name ("Indonesian", "Cambodian")
  if (words.length === 1 && /^(indonesian|cambodian|vietnamese|malaysian|taiwanese|singaporean|philippine|kenyan|ghanaian|nigerian|senegalese|moroccan|emirati|saudi|latvian|estonian|slovenian|croatian|serbian|albanian|mongolian|kazakhstani|uzbekistani|azerbaijani|armenian|georgian|moldovan|ukrainian|belarusian|turkmenistani|tajik|kyrgyz|cuban|haitian|jamaican|trinidadian|bolivian|peruvian|chilean|colombian|venezuelan|ecuadorian|paraguayan|uruguayan|argentine|argentinian|afghani|bangladeshi|nepalese|srilankan|burmese|cambodian|laotian|mongolian|tibetan|yemeni|libyan|tunisian|algerian|sudanese|ethiopian|somalian|rwandan|congolese|angolan|zambian|zimbabwean|mozambican|malawian|tanzanian|ugandan|ghanaian|ivorian|cameroonian|senegalese|malian|burkinabe|nigerien|chadian|mauritanian|guinean|beninese|togolese|gabonese|congolese)$/i.test(trimmed)) {
    return { isValid: false, reason: 'demonym_not_company' };
  }

  // Article verb chain — only flag 3+ word names to avoid false positives
  if (words.length >= 3 && ARTICLE_VERB_CHAIN_RE.test(trimmed)) {
    return { isValid: false, reason: 'article_headline_verb_chain' };
  }

  // Starts with a number followed by a noun ("5 Ways", "10 Startups")
  if (/^\d+\s+\w+/.test(trimmed)) {
    return { isValid: false, reason: 'starts_with_number_noun' };
  }

  // City-suffix concatenation artifact ("CompanyNameSan Francisco" → reject)
  for (const city of COMMON_CITIES) {
    if (lower.length > city.length + 3 && lower.endsWith(city)) {
      return { isValid: false, reason: `city_suffix` };
    }
  }

  // Excessive camelCase (3+ boundaries → concatenated garbage)
  const camelBoundaries = trimmed.match(/[a-z][A-Z]/g);
  if (camelBoundaries && camelBoundaries.length >= 3) {
    return { isValid: false, reason: 'excessive_camelcase' };
  }

  if (matchesSingleFirstName(trimmed)) {
    return { isValid: false, reason: 'single_first_name' };
  }

  if (matchesAcronymChain(trimmed)) {
    return { isValid: false, reason: 'acronym_chain_jargon' };
  }

  if (matchesFinancialInstitutionSoup(trimmed)) {
    return { isValid: false, reason: 'financial_institution_soup' };
  }

  if (matchesExtendedVcSoup(trimmed)) {
    return { isValid: false, reason: 'extended_vc_soup' };
  }

  if (matchesYcMediaEventHeadline(trimmed)) {
    return { isValid: false, reason: 'yc_media_event_headline' };
  }

  if (matchesVcFundSoup(trimmed)) {
    return { isValid: false, reason: 'vc_fund_name_soup' };
  }

  if (matchesMegacorpProductHeadline(trimmed)) {
    return { isValid: false, reason: 'megacorp_product_headline' };
  }

  if (matchesGeographicHeadlineFragment(trimmed)) {
    return { isValid: false, reason: 'geographic_headline' };
  }

  if (matchesExecutiveTitleTail(trimmed)) {
    return { isValid: false, reason: 'executive_title_tail' };
  }

  // "Zinc Oxide Market", "Autoinjectors Market", "Pedestrian Protection System Market"
  // Any 2+ word phrase ending in "Market" or "Markets" is a research category, not a company
  if (words.length >= 2 && /^Markets?$/i.test(words[words.length - 1])) {
    return { isValid: false, reason: 'market_category_fragment' };
  }

  // "Agentforce ARR", "Vercel MRR" — product + financial metric acronym
  const METRIC_ACRONYMS = new Set(['arr', 'mrr', 'ebitda', 'dau', 'mau', 'ltv', 'cac', 'gmv', 'tpv', 'nrr', 'grr']);
  if (words.length >= 2 && METRIC_ACRONYMS.has(words[words.length - 1].toLowerCase())) {
    return { isValid: false, reason: 'metric_acronym_tail' };
  }

  // "Monday April", "Tuesday Baltimore", "Friday Iranian" — day-of-week prefix
  const DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  if (words.length >= 2 && DAYS.has(lower.split(/\s+/)[0])) {
    return { isValid: false, reason: 'day_of_week_prefix' };
  }

  // "FPV Ventures Redpoint", "Blue Owl Healthcare Opportunities", "Framework Ventures HV Capital"
  // VC fund name + another VC word — these are portfolios/fund composites, not investee companies
  {
    const VC_WORDS = new Set([
      'ventures', 'venture', 'capital', 'partners', 'equity', 'fund', 'management',
      'asset', 'growth', 'opportunities', 'opportunity',
    ]);
    const vcWordCount = words.filter(w => VC_WORDS.has(w.toLowerCase())).length;
    if (vcWordCount >= 2) {
      return { isValid: false, reason: 'vc_composite_name' };
    }
  }

  // "Bonus" catch for contraction-only fragments ("It's", "Let's", "There's")
  if (/^[A-Z][a-z]+'s\s*$/.test(trimmed) && words.length === 1) {
    return { isValid: false, reason: 'contraction_fragment' };
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Allow any Unicode letter (Japanese, Korean, etc.), not just ASCII
  if (!/[\p{L}0-9]/u.test(trimmed)) return { isValid: false, reason: 'no_alphanumeric' };
  if (words.length > 6) return { isValid: false, reason: 'too_many_words' };
  return { isValid: true };
}

module.exports = { isValidStartupName, normalizeForBlocklist, NON_COMPANY_EXACT_NAMES };
