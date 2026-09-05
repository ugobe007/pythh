/**
 * Funding-attention aspect taxonomy.
 *
 * Extracts *why an announcement talks about a raise* from title/body text:
 * customer growth, hiring, unique tech, board, partners, product revisions.
 *
 * Pattern-only (no paid model). Used by the funding-attention agent to write
 * observed thesis onto investor.signals and aspect-specific pythh_signal_events.
 * Does not retune GOD / fit weights.
 */

export const FUNDING_ATTENTION_VERSION = 'funding-attention-v1';

export const FUNDING_ATTENTION_ASPECTS = Object.freeze({
  customer_growth: {
    id: 'customer_growth',
    theme: 'customer growth',
    primary_signal: 'revenue_signal',
    label: 'Customer growth cited in the raise announcement',
  },
  hiring: {
    id: 'hiring',
    theme: 'hiring',
    primary_signal: 'hiring_signal',
    label: 'Hiring or leadership talent cited in the raise announcement',
  },
  unique_tech: {
    id: 'unique_tech',
    theme: 'unique technology',
    primary_signal: 'product_signal',
    label: 'Proprietary or differentiated technology cited in the raise announcement',
  },
  board: {
    id: 'board',
    theme: 'board',
    primary_signal: 'hiring_signal',
    label: 'Board seat or director appointment tied to the raise',
  },
  partners: {
    id: 'partners',
    theme: 'partnerships',
    primary_signal: 'partnership_signal',
    label: 'Strategic partnership cited in the raise announcement',
  },
  product_rev: {
    id: 'product_rev',
    theme: 'product',
    primary_signal: 'product_signal',
    label: 'Product launch or revision cited in the raise announcement',
  },
  use_of_proceeds: {
    id: 'use_of_proceeds',
    theme: 'use of proceeds',
    primary_signal: 'growth_signal',
    label: 'Announcement states what the raise will fund',
  },
});

const FIRM_PARTNER_NOISE =
  /\b(venture|limited|general|managing|operating|insight|andersen|accel|index|greylock|lightspeed|sequoia|a16z|andreessen)\s+partners?\b/i;

const ASPECT_PATTERNS = Object.freeze({
  customer_growth: [
    /\bcustomer growth\b/i,
    /\b(expanding|grew|growing|doubled|tripled|surged) (its |their )?(customer|user|subscriber) (base|count|book)?\b/i,
    /\b(customer|user|subscriber)s? (grew|growth|doubled|tripled|surged|base)\b/i,
    /\b\d[\d,.]*\+?\s*(customers|users|subscribers|logos)\b/i,
    /\b(arr|mrr|nrr|bookings)\b.{0,24}(grew|growth|up |increased|doubled|tripled|\$)/i,
    /\b(revenue|bookings) (grew|growth|doubled|tripled|up )\b/i,
    /\b(million|thousand) (customers|users|subscribers)\b/i,
    /\benterprise (customer|logo) (wins?|growth)\b/i,
  ],
  hiring: [
    /\b(hires?|hiring|hired|headcount|recruiting)\b/i,
    /\b(team (expansion|grew|growth)|adding (engineers?|talent|headcount))\b/i,
    /\b(appointed|taps|names|named) .{0,48}\b(ceo|cto|cfo|coo|cpo|cro|cmo|vp)\b/i,
    /\b(leadership|executive) (hire|hires|hiring|appointment)\b/i,
  ],
  unique_tech: [
    /\b(proprietary|patented)\b/i,
    /\bunique (technology|tech|platform|model|approach)\b/i,
    /\bdifferentiated (tech(?:nology)?|platform|product)\b/i,
    /\bintellectual property\b/i,
    /\b(ai[- ]native|foundation model|novel (architecture|approach))\b/i,
  ],
  board: [
    /\b(joins?|joined|joining) (the )?(board|board of directors)\b/i,
    /\bappointed to (the )?board\b/i,
    /\bboard (seat|member|director|appointment|observer)\b/i,
  ],
  partners: [
    /\bstrategic partners?(hip)?\b/i,
    /\bpartnered with\b/i,
    /\bpartners with\b/i,
    /\b(signed|announced) (a )?(partnership|collaboration|distribution deal)\b/i,
    /\b(collaboration|distribution) (agreement|deal|partnership) with\b/i,
  ],
  product_rev: [
    /\b(launches?|launched|unveils?|unveiled|releases?|released|ships?|shipped)\b.{0,48}\b(product|platform|feature|version|app|entity)\b/i,
    /\b(product|platform|feature|version|app)\b.{0,32}\b(launches?|launched|unveils?|unveiled|releases?|released)\b/i,
    /\blaunches? (a |an |its |their |new )?\b/i,
    /\bgeneral availability\b|\bga launch\b/i,
    /\bproduct (update|refresh|overhaul|revamp|revision)\b/i,
    /\bto expand .{0,40}\b(platform|product|suite)\b/i,
  ],
  use_of_proceeds: [
    /\braises?\b.{0,100}\bto (scale|expand|build|launch|bring|enhance|tackle|transform|give|fund|accelerate)\b/i,
    /\braises?\b.{0,100}\bfor (its |their |an? )?(ai |enterprise )?(platform|product|operating system)\b/i,
    /\b(plans? to|will) use the (funding|capital|round|raise) to\b/i,
    /\buse the funding to\b/i,
  ],
});

const NEGATIVE_PATTERNS = Object.freeze({
  hiring: [
    /\b(not|no longer|aren'?t|isn'?t|stop(?:ped)?|freeze|freezing)\b.{0,16}\b(hiring|hire|recruiting)\b/i,
    /\bhiring freeze\b/i,
    /\blayoffs?\b/i,
  ],
  board: [
    /\bonboard(?:ing|ed)?\b/i,
    /\bkeyboard\b/i,
    /\bmotherboard\b/i,
    /\bdashboard\b/i,
  ],
  partners: [
    FIRM_PARTNER_NOISE,
    /\blimited partners?\b/i,
    /\bgeneral partners?\b/i,
    /\bventure partners?\b/i,
  ],
});

const CITED_REASON_RE = [
  /\b(citing|cited|citing its)\b/i,
  /\bimpressed by\b/i,
  /\battracted by\b/i,
  /\bwe invested because\b/i,
  /\bbacked .{0,32}\bgiven\b/i,
  /\b(the (round|raise) (will|to) (fund|fuel|support|accelerate))\b/i,
];

function clipSnippet(text, match) {
  const start = Math.max(0, match.index - 24);
  const end = Math.min(text.length, match.index + match[0].length + 24);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function isNegated(aspectId, text) {
  const patterns = NEGATIVE_PATTERNS[aspectId] || [];
  return patterns.some((re) => re.test(text));
}

function collectMatches(text, patterns) {
  const snippets = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    const match = re.exec(text);
    if (!match) continue;
    snippets.push(clipSnippet(text, match));
  }
  return snippets;
}

/**
 * @param {string|string[]|{ title?: string, body?: string, source_title?: string }} input
 * @returns {{
 *   aspects: Array<{ id: string, theme: string, primary_signal: string, matches: string[], confidence: number }>,
 *   cited: boolean,
 *   text: string,
 * }}
 */
export function extractFundingAttentionAspects(input) {
  let text = '';
  if (typeof input === 'string') {
    text = input;
  } else if (Array.isArray(input)) {
    text = input.filter(Boolean).join(' ');
  } else if (input && typeof input === 'object') {
    text = [input.source_title, input.title, input.body, input.excerpt, input.snippet]
      .filter(Boolean)
      .join(' ');
  }
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (!text) return { aspects: [], cited: false, text: '' };

  const aspects = [];
  for (const [id, spec] of Object.entries(FUNDING_ATTENTION_ASPECTS)) {
    if (isNegated(id, text)) continue;
    if (id === 'partners' && FIRM_PARTNER_NOISE.test(text) && !/\b(strategic partnership|partnered with|partners with)\b/i.test(text)) {
      continue;
    }
    const matches = collectMatches(text, ASPECT_PATTERNS[id]);
    if (!matches.length) continue;
    const confidence = Math.min(0.55 + matches.length * 0.12, 0.92);
    aspects.push({
      id,
      theme: spec.theme,
      primary_signal: spec.primary_signal,
      label: spec.label,
      matches,
      confidence,
    });
  }

  const cited = CITED_REASON_RE.some((re) => re.test(text));
  return { aspects, cited, text };
}

function excerptLooksOnTopic(excerpt, event = {}) {
  const text = String(excerpt || '').trim();
  if (!text) return false;
  const head = text.slice(0, 400);
  const junkNav = /\b(10 best|best crypto|staking platforms|crypto mining app)\b/i.test(head);
  const fundingVoice = /\b(raised|raises|raising|series [a-z]|funding|the company|announced)\b/i.test(head);
  if (junkNav && !fundingVoice) return false;
  const name = String(event.startup_name_raw || '').trim();
  if (name && text.toLowerCase().includes(name.toLowerCase())) return true;
  return fundingVoice;
}

export function announcementTextFromEvent(event = {}) {
  const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  const excerpts = [
    meta.funding_evidence_excerpt,
    meta.excerpt,
    meta.snippet,
    meta.body,
    meta.article_text,
  ].filter((value) => excerptLooksOnTopic(value, event));
  return [event.source_title, meta.headline, ...excerpts].filter(Boolean).join(' ');
}

export function aspectThemes(aspects) {
  return [...new Set((aspects || []).map((row) => row.theme).filter(Boolean))];
}

export function primarySignalsForAspects(aspects) {
  const seen = new Set();
  const out = [];
  for (const row of aspects || []) {
    if (!row.primary_signal || seen.has(row.primary_signal)) continue;
    seen.add(row.primary_signal);
    out.push(row.primary_signal);
  }
  return out;
}
