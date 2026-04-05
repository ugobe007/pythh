/**
 * Startup Name Validator (shared lib)
 * Used by both server and client to reject garbage names.
 */

/** Normalize for exact blocklist lookup (lowercase, collapse whitespace) */
function normalizeForBlocklist(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

const TITLE_CASE_TWO_WORDS = /^[A-Z][a-z]{2,14}\s+[A-Z][a-z]{2,20}$/;

/** Title Case "Chris Murphy" / "Jennifer Lopez" — almost always a person in news-derived data, not a startup. */
function matchesLikelyPersonNameTwoWords(trimmed) {
  if (!TITLE_CASE_TWO_WORDS.test(trimmed)) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;
  const a = parts[0].toLowerCase();
  const b = parts[1].toLowerCase();
  if (a.length < 3 || b.length < 3) return false;
  if (COMPANY_LIKE_SECOND_WORD.has(b)) return false;
  return COMMON_GIVEN_NAMES.has(a) && COMMON_SURNAMES.has(b);
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
 */
const ALUM_DESCRIPTOR_RE = /\balum\b/i;

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
]);
// ─────────────────────────────────────────────────────────────────────────────

const JUNK_PATTERNS = [
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
];

function isValidStartupName(name, options = {}) {
  const allowAnnounceSalvage = options.allowAnnounceSalvage !== false;

  if (!name || typeof name !== 'string') {
    return { isValid: false, reason: 'empty_or_null' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) return { isValid: false, reason: 'too_short' };
  if (trimmed.length > 80) return { isValid: false, reason: 'too_long' };

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

  // "X alum" resume descriptor — "Microsoft and Uber alum"
  if (ALUM_DESCRIPTOR_RE.test(trimmed)) {
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
  if (words.length === 1 && /^(indonesian|cambodian|vietnamese|malaysian|taiwanese|singaporean|philippine|kenyan|ghanaian|nigerian|senegalese|moroccan|emirati|saudi|latvian|estonian|slovenian|croatian|serbian|albanian|mongolian|kazakhstani|uzbekistani|azerbaijani|armenian|georgian|moldovan|ukrainian|belarusian|turkmenistani|tajik|kyrgyz)$/i.test(trimmed)) {
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
  // ─────────────────────────────────────────────────────────────────────────

  // Allow any Unicode letter (Japanese, Korean, etc.), not just ASCII
  if (!/[\p{L}0-9]/u.test(trimmed)) return { isValid: false, reason: 'no_alphanumeric' };
  if (words.length > 6) return { isValid: false, reason: 'too_many_words' };
  return { isValid: true };
}

module.exports = { isValidStartupName, normalizeForBlocklist, NON_COMPANY_EXACT_NAMES };
