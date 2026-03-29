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
  /^(?:Senator|Representative|Rep\.|Governor|Gov\.|Secretary|Mayor|Vice\s+President)\s+/i;

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
  // Allow any Unicode letter (Japanese, Korean, etc.), not just ASCII — ASCII-only was rejecting カタカナ names.
  if (!/[\p{L}0-9]/u.test(trimmed)) return { isValid: false, reason: 'no_alphanumeric' };
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > 6) return { isValid: false, reason: 'too_many_words' };
  return { isValid: true };
}

module.exports = { isValidStartupName, normalizeForBlocklist, NON_COMPANY_EXACT_NAMES };
