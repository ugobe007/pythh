/**
 * VC Wisdom Library
 * 
 * Curated quotes from top VCs — pulled from blog posts, podcasts, interviews.
 * Used to educate founders while they're building their signal intelligence.
 * 
 * Each quote is tagged by:
 * - source: VC firm/person
 * - topic: What it's about (team, market, timing, product, traction, etc.)
 * - context: Where it came from (blog, podcast, interview)
 */

export interface VCQuote {
  id: string;
  quote: string;
  author: string;
  firm: string;
  role?: string;
  topic: VCTopic[];
  source?: string; // Blog post, podcast, etc.
  sourceUrl?: string;
  year?: number;
}

export type VCTopic = 
  | 'team'
  | 'market'
  | 'timing'
  | 'product'
  | 'traction'
  | 'fundraising'
  | 'founder'
  | 'vision'
  | 'competition'
  | 'growth'
  | 'signals';

// ═══════════════════════════════════════════════════════════════
// CURATED VC WISDOM
// ═══════════════════════════════════════════════════════════════

export const vcQuotes: VCQuote[] = [
  // A16Z / ANDREESSEN HOROWITZ
  {
    id: 'a16z-1',
    quote: "The best founders are obsessed with their product. They wake up thinking about it and go to sleep thinking about it.",
    author: "Marc Andreessen",
    firm: "a16z",
    role: "Co-founder",
    topic: ['product', 'founder'],
    source: "a16z Blog",
    year: 2020,
  },
  {
    id: 'a16z-2',
    quote: "In a great market — a market with lots of real potential customers — the market pulls product out of the startup.",
    author: "Marc Andreessen",
    firm: "a16z",
    topic: ['market', 'product'],
    source: "pmarca blog",
    year: 2007,
  },
  {
    id: 'a16z-3',
    quote: "When a great team meets a lousy market, market wins. When a lousy team meets a great market, market wins.",
    author: "Marc Andreessen",
    firm: "a16z",
    topic: ['market', 'team'],
    source: "pmarca blog",
    year: 2007,
  },
  {
    id: 'a16z-4',
    quote: "The number one reason startups fail is they make something nobody wants.",
    author: "Ben Horowitz",
    firm: "a16z",
    role: "Co-founder",
    topic: ['product', 'market'],
    source: "The Hard Thing About Hard Things",
    year: 2014,
  },
  {
    id: 'a16z-5',
    quote: "There's no silver bullet. It's always a lot of lead bullets.",
    author: "Ben Horowitz",
    firm: "a16z",
    topic: ['founder', 'growth'],
    source: "The Hard Thing About Hard Things",
    year: 2014,
  },

  // SEQUOIA
  {
    id: 'sequoia-1',
    quote: "We look for founders who have a deep understanding of the problem they're solving — usually because they've lived it.",
    author: "Doug Leone",
    firm: "Sequoia Capital",
    role: "Global Managing Partner",
    topic: ['founder', 'product'],
    year: 2019,
  },
  {
    id: 'sequoia-2',
    quote: "The best companies are built by missionaries, not mercenaries.",
    author: "John Doerr",
    firm: "Kleiner Perkins",
    topic: ['founder', 'vision'],
    source: "Measure What Matters",
    year: 2018,
  },
  {
    id: 'sequoia-3',
    quote: "Target a market that will be big in 10 years, not one that's big today.",
    author: "Sequoia Capital",
    firm: "Sequoia Capital",
    topic: ['market', 'timing'],
    source: "Writing a Business Plan",
  },

  // Y COMBINATOR
  {
    id: 'yc-1',
    quote: "Make something people want.",
    author: "Paul Graham",
    firm: "Y Combinator",
    role: "Co-founder",
    topic: ['product'],
    source: "How to Start a Startup",
    year: 2005,
  },
  {
    id: 'yc-2',
    quote: "It's better to have 100 users who love you than 1 million who kind of like you.",
    author: "Paul Graham",
    firm: "Y Combinator",
    topic: ['product', 'traction'],
    source: "Startup = Growth",
    year: 2012,
  },
  {
    id: 'yc-3',
    quote: "The best startups generally come from somebody needing to scratch an itch.",
    author: "Michael Seibel",
    firm: "Y Combinator",
    role: "CEO",
    topic: ['founder', 'product'],
    year: 2020,
  },
  {
    id: 'yc-4',
    quote: "Talk to users. Build product. Don't die.",
    author: "Y Combinator",
    firm: "Y Combinator",
    topic: ['product', 'founder', 'traction'],
    source: "YC Motto",
  },
  {
    id: 'yc-5',
    quote: "Startups rarely die mid-keystroke. They usually die because founders give up.",
    author: "Paul Graham",
    firm: "Y Combinator",
    topic: ['founder'],
    source: "How Not to Die",
    year: 2007,
  },

  // BENCHMARK
  {
    id: 'benchmark-1',
    quote: "We're looking for founders who are building companies, not features.",
    author: "Bill Gurley",
    firm: "Benchmark",
    role: "General Partner",
    topic: ['founder', 'vision'],
    year: 2018,
  },
  {
    id: 'benchmark-2',
    quote: "The most dangerous thing is a founder who doesn't know what they don't know.",
    author: "Bill Gurley",
    firm: "Benchmark",
    topic: ['founder'],
    year: 2019,
  },

  // FIRST ROUND
  {
    id: 'firstround-1',
    quote: "The best seed-stage pitch is: 'Here's what we've built, here's who's using it, here's how fast it's growing.'",
    author: "First Round Capital",
    firm: "First Round Capital",
    topic: ['fundraising', 'traction'],
    source: "First Round Review",
  },
  {
    id: 'firstround-2',
    quote: "Timing is everything in startups. The same idea at the wrong time is the wrong idea.",
    author: "Josh Kopelman",
    firm: "First Round Capital",
    role: "Founder",
    topic: ['timing'],
    year: 2016,
  },

  // FOUNDERS FUND
  {
    id: 'ff-1',
    quote: "Competition is for losers. If you want to create and capture lasting value, build a monopoly.",
    author: "Peter Thiel",
    firm: "Founders Fund",
    role: "Co-founder",
    topic: ['competition', 'market'],
    source: "Zero to One",
    year: 2014,
  },
  {
    id: 'ff-2',
    quote: "The most contrarian thing of all is not to oppose the crowd but to think for yourself.",
    author: "Peter Thiel",
    firm: "Founders Fund",
    topic: ['founder', 'vision'],
    source: "Zero to One",
    year: 2014,
  },

  // GENERAL CATALYST
  {
    id: 'gc-1',
    quote: "We back founders who have unique insight into why now is the right time.",
    author: "Hemant Taneja",
    firm: "General Catalyst",
    role: "Managing Partner",
    topic: ['timing', 'founder'],
    year: 2021,
  },

  // LIGHTSPEED
  {
    id: 'lightspeed-1',
    quote: "Great founders don't just see the future — they bend the present toward it.",
    author: "Lightspeed Venture Partners",
    firm: "Lightspeed",
    topic: ['founder', 'vision'],
    year: 2022,
  },

  // INDEX VENTURES
  {
    id: 'index-1',
    quote: "The best companies feel inevitable in hindsight but contrarian at the time of investment.",
    author: "Mike Volpi",
    firm: "Index Ventures",
    role: "Partner",
    topic: ['market', 'timing'],
    year: 2020,
  },

  // SIGNALS-SPECIFIC
  {
    id: 'signals-1',
    quote: "Smart money doesn't chase. It positions.",
    author: "PYTHH",
    firm: "PYTHH",
    topic: ['signals', 'timing'],
    source: "The Founder's Odyssey",
  },
  {
    id: 'signals-2',
    quote: "Investors repeat themselves. Markets repeat themselves. Psychology repeats itself.",
    author: "PYTHH",
    firm: "PYTHH",
    topic: ['signals', 'market'],
    source: "The Founder's Odyssey",
  },
  {
    id: 'signals-3',
    quote: "Capital moves in patterns. The question is whether you see them before or after everyone else.",
    author: "PYTHH",
    firm: "PYTHH",
    topic: ['signals', 'timing'],
    source: "The Founder's Odyssey",
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get a random quote, optionally filtered by topic
 */
export function getRandomQuote(topic?: VCTopic): VCQuote {
  const filtered = topic 
    ? vcQuotes.filter(q => q.topic.includes(topic))
    : vcQuotes;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Get quotes by firm
 */
export function getQuotesByFirm(firm: string): VCQuote[] {
  return vcQuotes.filter(q => q.firm.toLowerCase().includes(firm.toLowerCase()));
}

/**
 * Get quotes by topic
 */
export function getQuotesByTopic(topic: VCTopic): VCQuote[] {
  return vcQuotes.filter(q => q.topic.includes(topic));
}

/**
 * Get a quote relevant to a lens
 */
export function getQuoteForLens(lensId: string): VCQuote {
  const topicMap: Record<string, VCTopic> = {
    'team': 'team',
    'market': 'market',
    'traction': 'traction',
    'product': 'product',
    'vision': 'vision',
    'momentum': 'timing',
    'signal': 'signals',
  };
  
  const topic = topicMap[lensId] || 'founder';
  return getRandomQuote(topic);
}

/**
 * Get multiple unique random quotes
 */
export function getRandomQuotes(count: number, topic?: VCTopic): VCQuote[] {
  const filtered = topic 
    ? vcQuotes.filter(q => q.topic.includes(topic))
    : vcQuotes;
  
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
