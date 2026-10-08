/**
 * Shared parse for every live scraper.
 *
 * Profiles the site (feed host, article host, or the publisher named in a
 * Google News title), runs parseSignal with that source class, and refuses
 * to treat a stock move, a rumor fundraise, or a debt/bond headline as a
 * closed equity round.
 *
 * Fail open: callers should catch. A bad parse must not stop the scrape.
 */

const { parseSignal } = require('./signalParser');
const { SOURCE_RELIABILITY } = require('./signalOntology');
const { extractSectors } = require('./inference-extractor');
const { isRumorFundingHeadline } = require('../server/lib/portfolioFundingVerify');

const MARKET_MOVE_RE = /\b(?:shares?|stocks?)\s+(?:jump(?:s|ed)?|surg(?:e|es|ed)|soar(?:s|ed)?|rose|rises?|fell|falls?|drop(?:s|ped)?|plung(?:e|es|ed)|tumbl(?:e|es|ed)|slid|slides|rally|rallies|rallied|climb(?:s|ed)?)\b|\b(?:stock|share)\s+price\b|\b(?:bond issuance|secondary offering|block trade)\b/i;

const NON_EQUITY_RE = /\b(?:bond issuance|credit facility|debt facility|venture debt|term loan|line of credit)\b/i;

/** Raise language the ontology still treats as a closed round. */
const EXTRA_RUMOR_RE = /\b(?:plans?\s+to\s+raise|planning\s+to\s+raise|aims?\s+to\s+raise|hopes?\s+to\s+raise|expected\s+to\s+raise|considering\s+(?:a\s+)?(?:raise|raising|round)|exploring\s+(?:a\s+)?(?:raise|round)|may\s+raise|might\s+raise|mulling\s+(?:a\s+)?(?:raise|round|funding)|weighs?\s+(?:a\s+)?(?:raise|round|funding))\b/i;

const WIRE_PUBLISHER_RE = /^(?:business\s*wire|pr\s*newswire|prnewswire|globe\s*newswire|globenewswire)$/i;

const NEWS_HOSTS = new Set([
  'techcrunch.com',
  'venturebeat.com',
  'finsmes.com',
  'eu-startups.com',
  'tech.eu',
  'techfundingnews.com',
  'geekwire.com',
  'dealroom.co',
  'wellfound.com',
  'angellist.com',
  'angel.co',
  'inc42.com',
  'techinasia.com',
  'siliconrepublic.com',
  'startupbeat.com',
  'arcticstartup.com',
  'siliconcanals.com',
  'uktech.news',
  'betakit.com',
  'artificialintelligence-news.com',
  'thefintechtimes.com',
  'cleantechnica.com',
  'healthcareitnews.com',
  'fiercehealthcare.com',
  'medcitynews.com',
  'finextra.com',
  'paymentsdive.com',
  'greenbiz.com',
  'nvca.org',
  'bloomberg.com',
  'reuters.com',
  'cnbc.com',
  'wsj.com',
  'ft.com',
  'forbes.com',
  'thenextweb.com',
  'sifted.eu',
  'axios.com',
  'theinformation.com',
  'law.com',
  'techmeme.com',
]);

const BLOG_HOSTS = new Set([
  'saastr.com',
  'gritdaily.com',
  'startupblink.com',
  'medium.com',
]);

function hostnameOf(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function headlinePublisher(title) {
  const m = String(title || '').match(/\s[-–—]\s([A-Z0-9][^|]{1,48})$/);
  return m ? m[1].trim() : null;
}

function profile(source_type, source_class, first_party) {
  return { source_type, source_class, first_party };
}

const AGGREGATOR = profile('news_aggregator', 'aggregator', false);
const PRESS = profile('press_release', 'press_release', true);
const CRUNCHBASE = profile('crunchbase', 'news', true);
const LAUNCH = profile('product_launch', 'product_launch', true);
const BLOG = profile('blog_post', 'blog', false);
const COMPANY_BLOG = profile('company_blog', 'company_blog', true);
const COMMUNITY = profile('anonymous_post', 'community', false);
const NEWS = profile('news_article', 'news', true);
const RSS = profile('rss_scrape', 'rss', false);

function lookupHost(host) {
  if (!host) return null;
  if (host === 'news.google.com' || host.endsWith('.news.google.com')) return AGGREGATOR;
  if (host === 'news.yahoo.com' || host === 'finance.yahoo.com' || host === 'msn.com') return AGGREGATOR;
  if (host === 'businesswire.com' || host.endsWith('.businesswire.com')) return PRESS;
  if (host === 'prnewswire.com' || host.endsWith('.prnewswire.com')) return PRESS;
  if (host === 'globenewswire.com' || host.endsWith('.globenewswire.com')) return PRESS;
  if (host === 'news.crunchbase.com' || host === 'crunchbase.com') return CRUNCHBASE;
  if (host === 'producthunt.com' || host.endsWith('.producthunt.com')) return LAUNCH;
  if (host === 'substack.com' || host.endsWith('.substack.com')) return BLOG;
  if (host === 'hnrss.org' || host === 'news.ycombinator.com' || host === 'reddit.com') return COMMUNITY;
  if (host.startsWith('blog.') || host.startsWith('newsroom.')) return COMPANY_BLOG;
  if (BLOG_HOSTS.has(host)) return BLOG;
  if (NEWS_HOSTS.has(host)) return NEWS;
  return null;
}

function lookupName(feedName) {
  const name = String(feedName || '');
  if (!name) return null;
  if (/google news|^google\b/i.test(name)) return AGGREGATOR;
  if (/business\s*wire|pr\s*newswire|globe\s*newswire/i.test(name)) return PRESS;
  if (/crunchbase/i.test(name)) return CRUNCHBASE;
  if (/product hunt/i.test(name)) return LAUNCH;
  if (/substack/i.test(name)) return BLOG;
  if (/hacker news|\bhnrss\b/i.test(name)) return COMMUNITY;
  return null;
}

/**
 * @param {{ feedUrl?: string, feedName?: string, itemUrl?: string, title?: string, sourceType?: string }} input
 */
function profileSource(input = {}) {
  if (input.sourceType && SOURCE_RELIABILITY[input.sourceType] != null) {
    const source_class = input.sourceType === 'website' || input.sourceType === 'company_blog'
      ? 'first_party'
      : input.sourceType;
    return {
      source_type: input.sourceType,
      source_class,
      first_party: source_class === 'first_party' || input.sourceType === 'press_release',
      reliability: SOURCE_RELIABILITY[input.sourceType],
      host: hostnameOf(input.itemUrl) || hostnameOf(input.feedUrl) || null,
      via: null,
      publisher: input.feedName || null,
    };
  }

  const itemHost = hostnameOf(input.itemUrl);
  const feedHost = hostnameOf(input.feedUrl);
  const itemProfile = lookupHost(itemHost);
  const feedProfile = lookupHost(feedHost);
  const nameProfile = lookupName(input.feedName);

  let chosen = null;
  let via = null;
  if (itemProfile && itemProfile.source_class !== 'aggregator') {
    chosen = itemProfile;
    if ((feedProfile && feedProfile.source_class === 'aggregator') || (nameProfile && nameProfile.source_class === 'aggregator')) {
      via = 'aggregator';
    }
  } else if (feedProfile) {
    chosen = feedProfile;
  } else if (itemProfile) {
    chosen = itemProfile;
  } else if (nameProfile) {
    chosen = nameProfile;
  } else if (itemHost || feedHost) {
    chosen = RSS;
  } else {
    chosen = profile('unknown', 'unknown', false);
  }

  const publisher = headlinePublisher(input.title);
  if (chosen.source_class === 'aggregator' && publisher && WIRE_PUBLISHER_RE.test(publisher)) {
    chosen = PRESS;
    via = 'aggregator';
  }

  return {
    source_type: chosen.source_type,
    source_class: chosen.source_class,
    first_party: chosen.first_party,
    reliability: SOURCE_RELIABILITY[chosen.source_type] ?? SOURCE_RELIABILITY.unknown,
    host: (chosen.source_class === 'aggregator' ? feedHost || itemHost : itemHost || feedHost) || null,
    via,
    publisher: publisher || input.feedName || null,
  };
}

function headlineGuards(text) {
  const raw = String(text || '');
  const guards = [];
  if (MARKET_MOVE_RE.test(raw) && !/\bmarket\s+share\s+(?:jump(?:s|ed)?|surg(?:e|es|ed)|soar(?:s|ed)?|rose|rises?|fell|falls?|drop(?:s|ped)?|plung(?:e|es|ed)|tumbl(?:e|es|ed)|slid|slides|rally|rallies|rallied|climb(?:s|ed)?)\b/i.test(raw)) guards.push('market_move');
  if (isRumorFundingHeadline(raw) || EXTRA_RUMOR_RE.test(raw)) guards.push('rumor_fundraise');
  if (NON_EQUITY_RE.test(raw)) guards.push('non_equity');
  return guards;
}

function applyGuards(signal, guards, source) {
  if (!signal && guards.length === 0) return null;
  const next = signal ? {
    ...signal,
    signal_classes: [...(signal.signal_classes || [])],
    ambiguity_flags: [...(signal.ambiguity_flags || [])],
  } : {
    primary_signal: 'unclassified_signal',
    signal_classes: [],
    confidence: 0.3,
    evidence_quality: 'speculative',
    signal_strength: 0.1,
    ambiguity_flags: [],
    inferred_meanings: [],
  };

  if (source.source_type === 'news_aggregator' && next.confidence != null) {
    next.confidence = Math.round(next.confidence * 0.85 * 100) / 100;
  }

  for (const guard of guards) {
    if (!next.ambiguity_flags.includes(guard)) next.ambiguity_flags.push(guard);
  }

  if (guards.includes('market_move')) {
    next.primary_signal = 'market_move_signal';
    next.signal_classes = [
      'market_move_signal',
      ...next.signal_classes.filter((c) => c !== 'fundraising_signal' && c !== 'market_move_signal'),
    ];
    next.evidence_quality = 'speculative';
    next.confidence = Math.min(next.confidence ?? 0.3, 0.35);
    next.signal_strength = Math.min(next.signal_strength ?? 0.2, 0.2);
  } else if (guards.includes('rumor_fundraise') || guards.includes('non_equity')) {
    next.evidence_quality = 'speculative';
    next.confidence = Math.min(next.confidence ?? 0.4, 0.42);
    if (next.signal_strength != null) {
      next.signal_strength = Math.round(next.signal_strength * 0.5 * 100) / 100;
    }
  }

  return next;
}

function compactBlock(signal, source, guards, sectors, actionable) {
  if (!signal) return null;
  return {
    primary: signal.primary_signal || null,
    classes: signal.signal_classes || [],
    confidence: signal.confidence ?? null,
    evidence: signal.evidence_quality || null,
    strength: signal.signal_strength ?? null,
    ambiguity: signal.ambiguity_flags || guards,
    who_cares: signal.who_cares || null,
    inference: signal.inference || null,
    source_type: source.source_type,
    source_class: source.source_class,
    reliability: source.reliability,
    via: source.via,
    guards,
    actionable_fundraising: actionable,
    sectors,
  };
}

/**
 * @param {{ title?: string, snippet?: string, feedUrl?: string, feedName?: string, itemUrl?: string, sourceType?: string, actor?: string }} input
 */
function awareParse(input = {}) {
  const text = `${input.title || ''} ${input.snippet || ''}`.replace(/\s+/g, ' ').trim().slice(0, 2000);
  const source = profileSource({
    feedUrl: input.feedUrl,
    feedName: input.feedName,
    itemUrl: input.itemUrl,
    title: input.title,
    sourceType: input.sourceType,
  });
  const guards = headlineGuards(input.title || '');
  const matched = text ? extractSectors(text) : [];

  let raw = null;
  if (text.length >= 5) {
    try {
      raw = parseSignal(text, {
        source_type: source.source_type,
        actor_context: input.actor,
      });
    } catch {
      raw = null;
    }
  }

  const signal = applyGuards(raw, guards, source);
  const actionable_fundraising = Boolean(
    signal
    && signal.primary_signal === 'fundraising_signal'
    && !guards.includes('rumor_fundraise')
    && !guards.includes('market_move')
    && !guards.includes('non_equity'),
  );
  const meanings = signal?.inferred_meanings || [];
  const product_live = !guards.includes('market_move') && (
    signal?.primary_signal === 'product_signal' || meanings.includes('product_live')
  );

  return {
    text,
    source,
    sectors: matched.length ? matched : ['Technology'],
    sector_matched: matched.length > 0,
    guards,
    actionable_fundraising,
    product_live,
    signal,
    block: compactBlock(signal, source, guards, matched, actionable_fundraising),
  };
}

module.exports = {
  profileSource,
  headlineGuards,
  awareParse,
  MARKET_MOVE_RE,
  EXTRA_RUMOR_RE,
  NON_EQUITY_RE,
};
