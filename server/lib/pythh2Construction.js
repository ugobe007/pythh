/**
 * Pythh_2 book construction.
 *
 * Rank by GOD first. Then take the highest remaining name that does not
 * overflow an industry cap, so the vintage is mixed instead of 20 AI clones.
 *
 * New picks start at 1.0×. Do not invent marks. Skip names already in any
 * fund, late/public companies, publisher URLs, and investor-firm labels —
 * those are the filters that dragged Pythh_1's honest MOIC.
 */
'use strict';

const { isCleanStartupNameForFeed, isPublicFeedStartup } = require('./feedNameGuards');
const { classifySuspiciousStartupWebsite } = require('../../lib/suspiciousStartupWebsite');
const { evaluateStartupNameForPipeline } = require('../../lib/startupNameGate');
const { classifyEntityTrack } = require('../../lib/startupNameLogicEngine');
const { ESTABLISHED_BRANDS } = require('../../lib/nameEntityOntology');
const { stripJournalistPrefix } = require('../../lib/portfolioServeGate');
const { estimateEntryValuationUsd } = require('./stageValuationBenchmarks');
const { PYTHH_2 } = require('./portfolioFunds');

const DEFAULTS = {
  target: 30,
  minGod: 85,
  minGodFloor: 80,
  sectorCap: 4,
  maxEntryValuationUsd: 200_000_000,
  maxFundingUsd: 75_000_000,
  checkUsd: 100_000,
};

const INDUSTRIES = [
  {
    key: 'AI / Infrastructure',
    tags: [
      'ai/ml', 'ai', 'artificial intelligence', 'machine learning', 'llm',
      'mlops', 'deep learning', 'gpu', 'inference', 'foundation model',
    ],
  },
  {
    key: 'Developer Tools',
    tags: [
      'developer tools', 'devtools', 'developer', 'devops', 'database',
      'data infrastructure', 'observability', 'infrastructure',
    ],
  },
  {
    key: 'Fintech',
    tags: [
      'fintech', 'finance', 'payments', 'banking', 'crypto', 'defi',
      'blockchain', 'insurtech', 'lending', 'financial', 'wealthtech',
    ],
  },
  {
    key: 'Climate',
    tags: [
      'climate', 'climate tech', 'cleantech', 'clean energy', 'sustainability',
      'carbon', 'renewable', 'energy', 'greentech',
    ],
  },
  {
    key: 'Health / Bio',
    tags: [
      'health', 'healthtech', 'healthcare', 'biotech', 'medtech',
      'digital health', 'life science', 'pharma', 'genomics',
    ],
  },
  {
    key: 'Cyber / Security',
    tags: ['cyber', 'security', 'cybersecurity', 'infosec', 'identity'],
  },
  {
    key: 'B2B SaaS',
    tags: [
      'saas', 'b2b', 'enterprise', 'productivity', 'workflow', 'automation',
      'hr tech', 'sales tech', 'marketing',
    ],
  },
  {
    key: 'Consumer',
    tags: [
      'consumer', 'marketplace', 'gaming', 'e-commerce', 'ecommerce',
      'social', 'media', 'creator',
    ],
  },
  {
    key: 'Robotics / Industrial',
    tags: [
      'robotics', 'industrial', 'hardware', 'manufacturing', 'defense',
      'autonomy', 'aviation', 'mobility',
    ],
  },
];

/** Known late / public / unicorn names that must not enter a seed-stage book. */
const LATE_OR_PUBLIC_NAMES = new Set([
  'stripe', 'stripe (stripe.com)', 'openai', 'anthropic', 'anthropic go',
  'deepmind', 'palantir', 'snowflake', 'databricks', 'coinbase', 'binance',
  'shopify', 'salesforce', 'microsoft', 'google', 'alphabet', 'apple',
  'amazon', 'meta', 'netflix', 'uber', 'airbnb', 'notion', 'figma', 'canva',
  'slack', 'zoom', 'dropbox', 'twilio', 'doordash', 'instacart', 'lyft',
  'revolut', 'klarna', 'nubank', 'chime', 'plaid', 'brex', 'ramp', 'mercury',
  'vercel', 'netlify', 'heroku', 'robinhood', 'sofi', 'carbon health',
  'chronosphere', 'cerebras', 'polymarket', 'customer.io', 'synthesia',
  'deepseek', 'cambricon', 'clearview ai', 'rec room', 'pipe', 'zuora',
  'bloomberg', 'linkedin', 'tiktok', 'pinterest', 'anduril',
  'activecampaign', 'apollo', 'apollo.io', 'vanta', 'betterment',
  'markforged', 'octopus deploy', 'paradigm', 'catalio', 'hypercard',
  'menlo security', 'whatfix', 'applied intuition', 'duo mobile', 'insitro',
  'hipcamp', 'agentsync', 'tauri', 'donut lab', 'tekpon', 'brightinsight',
  'hellosign', 'disney', 'disney+', 'perfect day', 'optinmonster', 'lawsuit',
  'pagerduty', 'sisense', 'tailscale', 'moengage', 'gloo',
  'securityscorecard', 'athelas', 'brick-and-mortar', 'jimmywales',
  'certik', 'devs', 'eclipse', 'huawei', 'lime rock',
  'nvidia', 'tesla', 'bytedance', 'tencent', 'alibaba', 'baidu',
]);

const QUARANTINE_NAMES = new Set([
  'shockwave', 'neon', 'ultra', 'seven', 'tigris', 'minecraftlm', 'playlist',
  'zero billion', 'australian ai', 'mi308 ai', 'captcha',
]);

const LATE_STAGES = new Set([
  '4', '5', '6', 'series c', 'series c+', 'series d', 'series e',
  'ipo', 'public', 'growth', 'late stage', 'late-stage', 'mezzanine',
]);

const INVESTOR_LAST = new Set([
  'capital', 'ventures', 'venture', 'partners', 'partner', 'management',
  'fund', 'funds', 'equity', 'holdings', 'investments', 'investment',
  'advisors', 'advisory', 'associates', 'street', 'lp', 'llc',
]);

const EXTRA_PUBLISHER_HOSTS = new Set([
  'marketwatch.com', 'top1000funds.com', 'tradingcalendar.com',
  'pehub.com', 'pitchbook.com', 'crunchbase.com', 'techcrunch.com',
]);

const HEADLINE_TAGLINE =
  /\b(raises?|raised|secures?|closes|acquired|acquires|ipo|being acquired|growth investment|launches)\b/i;
const INVESTOR_TAGLINE =
  /\b(venture capital|vc firm|credit fund|capital management|asset management|closed its\b.*\bfund)\b/i;
const MATURE_TAGLINE =
  /\b(\$\s?\d{2,3}\s?m(?:illion)?\s+in arr|approached \$\d|publicly traded|nyse|nasdaq)\b/i;
const SCRAPE_TAGLINE =
  /\b(hackers? gained|senior investor|coatue|steve jobs|officially incorporated)\b/i;
const NAME_NOISE = /\b(confirms?|report|acquires?|acquired)\b/i;
const FEATURE_NAME = /^[A-Za-z][A-Za-z0-9]*-to-[A-Za-z]/;
const GENERIC_NAMES = new Set([
  'docs', 'four', 'five', 'three', 'apps', 'app', 'taming', 'whats',
  'software', 'platform', 'company', 'everyone', 'dark', 'underscore',
]);

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hostnameFromWebsite(website) {
  const raw = String(website || '').trim();
  if (!raw) return '';
  try {
    const href = raw.includes('://') ? raw : `https://${raw}`;
    return new URL(href).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function websiteOwnedByName(name, website) {
  const host = hostnameFromWebsite(website);
  if (!host) return false;
  if (host.endsWith('.vc') || host.endsWith('.capital')) return false;
  if (EXTRA_PUBLISHER_HOSTS.has(host)) return false;
  if (classifySuspiciousStartupWebsite(website).suspicious) return false;

  const slug = host.split('.')[0].replace(/[^a-z0-9]/g, '');
  const nameSlug = normalizeName(name).replace(/[^a-z0-9]/g, '');
  if (slug.length < 3 || nameSlug.length < 3) return false;
  if (nameSlug.includes(slug) || slug.includes(nameSlug)) return true;

  const tokens = normalizeName(name)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  return tokens.some((t) => slug.includes(t));
}

function isInvestorFirmName(name) {
  const n = String(name || '').trim();
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && INVESTOR_LAST.has(words[words.length - 1].toLowerCase())) {
    return true;
  }
  const track = classifyEntityTrack(n);
  return track.track === 'investor';
}

function isLateStage(stage) {
  const s = String(stage ?? '').trim().toLowerCase();
  return LATE_STAGES.has(s);
}

function hasUsableTagline(tagline) {
  const raw = String(tagline || '').trim();
  if (raw.length < 12) return false;
  if (/<[a-z]|src=|cdn-cgi/i.test(raw)) return false;
  if (INVESTOR_TAGLINE.test(raw) || MATURE_TAGLINE.test(raw) || SCRAPE_TAGLINE.test(raw)) {
    return false;
  }
  const stripped = stripJournalistPrefix(raw);
  if (!stripped || stripped.length < 12) return false;
  if (/\b(acquired|acquires|raises?|raised|secures?|ipo)\b/i.test(stripped)) return false;
  if (/\b(rsac|innovation sandbox|behold,|since announcing|announced it|news space)\b/i.test(stripped)) return false;
  if (/every morning, somewhere between the first coffee/i.test(stripped)) return false;
  if (/\b(is cutting|layoffs?|job cuts|series\s+[a-f]\s+funding|go public|mentioned as competitor|startup says)\b/i.test(stripped)) return false;
  if (/\b(fy\d{2}|eyes .{0,24} revenue)\b/i.test(stripped)) return false;
  if (/\s-\s+(saas|ai|fintech|startup) company$/i.test(stripped)) return false;
  if (HEADLINE_TAGLINE.test(stripped) && /\$|arr|series\s+[a-z]/i.test(stripped)) return false;
  return true;
}

function hasSectors(startup) {
  return Array.isArray(startup?.sectors) && startup.sectors.some((s) => String(s || '').trim());
}

function tokenMatchesTag(token, tag) {
  if (token === tag) return true;
  if (tag.length <= 3) {
    return new RegExp(`(?:^|[^a-z0-9])${tag}(?:[^a-z0-9]|$)`).test(token);
  }
  return token.includes(tag) || (tag.length >= 5 && token.length >= 4 && tag.includes(token));
}

function assignIndustry(startup) {
  const raw = (Array.isArray(startup?.sectors) ? startup.sectors : [])
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());

  let best = 'Other';
  let bestHits = 0;
  for (const bucket of INDUSTRIES) {
    let hits = 0;
    for (const token of raw) {
      if (bucket.tags.some((tag) => tokenMatchesTag(token, tag))) {
        hits += 1;
      }
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = bucket.key;
    }
  }
  return best;
}

function eligibilityReason(startup, cfg = DEFAULTS) {
  const name = String(startup?.name || '').trim();
  const website = String(startup?.website || '').trim();
  const god = Number(startup?.total_god_score) || 0;
  const valuation = Number(startup?.valuation_usd) || 0;
  const funding = Number(startup?.total_funding_usd) || 0;

  if (!startup?.id) return 'missing_id';
  if (String(startup.status || '').toLowerCase() !== 'approved') return 'not_approved';
  if (String(startup.entity_gate || '').toLowerCase() !== 'qualified') return 'not_qualified';
  if (god < (cfg.minGodFloor || DEFAULTS.minGodFloor)) return 'god_below_floor';
  if (!isPublicFeedStartup({
    name,
    website,
    status: startup.status,
    entity_gate: startup.entity_gate,
  })) return 'feed_gate';
  if (!isCleanStartupNameForFeed(name)) return 'dirty_name';
  if (!evaluateStartupNameForPipeline(name).ok) return 'pipeline_name';
  if (isInvestorFirmName(name)) return 'investor_firm';
  const key = normalizeName(name);
  if (LATE_OR_PUBLIC_NAMES.has(key) || QUARANTINE_NAMES.has(key) || ESTABLISHED_BRANDS.has(key)) {
    return 'late_or_quarantined';
  }
  if (GENERIC_NAMES.has(key) || NAME_NOISE.test(name) || FEATURE_NAME.test(name)) return 'generic_or_headline_name';
  if (/\d{5,}/.test(name)) return 'test_or_id_name';
  if (/fund$/i.test(name.replace(/\s+/g, ''))) return 'investor_firm';
  if (isLateStage(startup.stage)) return 'late_stage';
  if (valuation >= (cfg.maxEntryValuationUsd || DEFAULTS.maxEntryValuationUsd)) return 'mature_valuation';
  if (funding >= (cfg.maxFundingUsd || DEFAULTS.maxFundingUsd)) return 'mature_funding';
  if (!websiteOwnedByName(name, website)) return 'website_mismatch';
  if (!hasSectors(startup)) return 'no_sector';
  if (!hasUsableTagline(startup.tagline)) return 'bad_tagline';
  return null;
}

function isEligible(startup, cfg = DEFAULTS) {
  return eligibilityReason(startup, cfg) == null;
}

function selectPythh2Book(candidates, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const takenIds = new Set(options.takenIds || []);
  const skipped = [];

  const eligible = [];
  for (const row of candidates || []) {
    if (takenIds.has(row.id)) {
      skipped.push({ id: row.id, name: row.name, reason: 'already_in_book' });
      continue;
    }
    const reason = eligibilityReason(row, cfg);
    if (reason) {
      skipped.push({ id: row.id, name: row.name, god: row.total_god_score, reason });
      continue;
    }
    eligible.push({
      ...row,
      god: Number(row.total_god_score) || 0,
      industry: assignIndustry(row),
    });
  }

  eligible.sort((a, b) => b.god - a.god || String(a.name).localeCompare(String(b.name)));

  const fill = (threshold, cap) => {
    const picks = [];
    const counts = {};
    const deferred = [];
    for (const row of eligible) {
      if (row.god < threshold) continue;
      const n = counts[row.industry] || 0;
      if (n >= cap) {
        deferred.push(row);
        continue;
      }
      picks.push(row);
      counts[row.industry] = n + 1;
      if (picks.length >= cfg.target) break;
    }
    return { picks, counts, deferred };
  };

  let threshold = cfg.minGod;
  let cap = cfg.sectorCap;
  let result = fill(threshold, cap);

  while (result.picks.length < cfg.target && threshold > cfg.minGodFloor) {
    threshold -= 1;
    result = fill(threshold, cap);
  }
  while (result.picks.length < cfg.target && cap < cfg.sectorCap + 3) {
    cap += 1;
    result = fill(threshold, cap);
  }

  const byIndustry = Object.entries(result.counts)
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry));

  const gods = result.picks.map((p) => p.god);
  return {
    picks: result.picks,
    skipped,
    threshold,
    sectorCap: cap,
    stats: {
      considered: (candidates || []).length,
      eligible: eligible.length,
      picked: result.picks.length,
      industries: byIndustry.length,
      byIndustry,
      avgGod: gods.length ? Math.round((gods.reduce((s, n) => s + n, 0) / gods.length) * 10) / 10 : 0,
      minGod: gods.length ? Math.min(...gods) : 0,
      maxGod: gods.length ? Math.max(...gods) : 0,
    },
  };
}

function buildPythh2InsertRow(startup, options = {}) {
  const now = options.now || new Date();
  const god = Number(startup.total_god_score) || 0;
  const industry = startup.industry || assignIndustry(startup);
  const valuation = Number(startup.valuation_usd) || 0;
  const entryValuation = (
    valuation > 0 && valuation < DEFAULTS.maxEntryValuationUsd
      ? valuation
      : estimateEntryValuationUsd(startup.stage, god)
  );
  const entryDate = now instanceof Date ? now.toISOString() : String(now);

  return {
    startup_id: startup.id,
    fund_key: PYTHH_2,
    entry_date: entryDate,
    entry_stage: startup.stage || null,
    entry_god_score: god,
    entry_valuation_usd: entryValuation,
    entry_rationale: `Pythh_2 construction: GOD ${god} · ${industry} · early entry`,
    virtual_check_usd: options.checkUsd || DEFAULTS.checkUsd,
    current_valuation_usd: entryValuation,
    moic: 1.0,
    status: 'active',
    added_by: options.addedBy || 'pythh-2-construction',
    entered_late: false,
    entity_quarantined: false,
  };
}

module.exports = {
  DEFAULTS,
  INDUSTRIES,
  LATE_OR_PUBLIC_NAMES,
  assignIndustry,
  websiteOwnedByName,
  eligibilityReason,
  isEligible,
  selectPythh2Book,
  buildPythh2InsertRow,
};
