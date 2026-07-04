/**
 * Top VC firm registry — shared by enrich-vcs, investor enrichment, and intel scrapers.
 * Keys are canonical display names used for DB ILIKE matching.
 */

/** @type {Record<string, { website: string; teamPage?: string; portfolioPage?: string; blogUrl?: string; rssUrl?: string }>} */
export const VC_WEBSITES = {
  'Y Combinator': {
    website: 'https://www.ycombinator.com',
    teamPage: 'https://www.ycombinator.com/people',
    portfolioPage: 'https://www.ycombinator.com/companies',
    blogUrl: 'https://blog.ycombinator.com',
    rssUrl: 'https://blog.ycombinator.com/feed/',
  },
  'Sequoia Capital': {
    website: 'https://www.sequoiacap.com',
    teamPage: 'https://www.sequoiacap.com/people/',
    portfolioPage: 'https://www.sequoiacap.com/companies/',
    blogUrl: 'https://www.sequoiacap.com/article/',
    rssUrl: 'https://www.sequoiacap.com/feed/',
  },
  'Andreessen Horowitz': {
    website: 'https://a16z.com',
    teamPage: 'https://a16z.com/team/',
    portfolioPage: 'https://a16z.com/portfolio/',
    blogUrl: 'https://a16z.com/posts/',
    rssUrl: 'https://a16z.com/feed/',
  },
  Accel: {
    website: 'https://www.accel.com',
    teamPage: 'https://www.accel.com/people',
    portfolioPage: 'https://www.accel.com/companies',
    blogUrl: 'https://www.accel.com/noteworthy',
    rssUrl: 'https://www.accel.com/insights/rss',
  },
  Benchmark: {
    website: 'https://www.benchmark.com',
    teamPage: 'https://www.benchmark.com/team/',
    portfolioPage: 'https://www.benchmark.com/portfolio/',
    rssUrl: 'https://benchmark.com/feed',
  },
  'Founders Fund': {
    website: 'https://foundersfund.com',
    teamPage: 'https://foundersfund.com/team/',
    portfolioPage: 'https://foundersfund.com/companies/',
    rssUrl: 'https://foundersfund.com/feed/',
  },
  'Greylock Partners': {
    website: 'https://greylock.com',
    teamPage: 'https://greylock.com/team/',
    portfolioPage: 'https://greylock.com/portfolio/',
    blogUrl: 'https://greylock.com/greymatter/',
    rssUrl: 'https://greylock.com/feed/',
  },
  'Lightspeed Venture Partners': {
    website: 'https://lsvp.com',
    teamPage: 'https://lsvp.com/team/',
    portfolioPage: 'https://lsvp.com/portfolio/',
    rssUrl: 'https://lsvp.com/feed/',
  },
  NEA: {
    website: 'https://www.nea.com',
    teamPage: 'https://www.nea.com/team',
    portfolioPage: 'https://www.nea.com/portfolio',
    rssUrl: 'https://www.nea.com/feed/',
  },
  'Kleiner Perkins': {
    website: 'https://www.kleinerperkins.com',
    teamPage: 'https://www.kleinerperkins.com/team/',
    portfolioPage: 'https://www.kleinerperkins.com/portfolio/',
    rssUrl: 'https://www.kleinerperkins.com/feed/',
  },
  'First Round Capital': {
    website: 'https://firstround.com',
    teamPage: 'https://firstround.com/team/',
    portfolioPage: 'https://firstround.com/companies/',
    blogUrl: 'https://review.firstround.com/',
    rssUrl: 'https://review.firstround.com/feed.xml',
  },
  'Bessemer Venture Partners': {
    website: 'https://www.bvp.com',
    teamPage: 'https://www.bvp.com/team',
    portfolioPage: 'https://www.bvp.com/portfolio',
    blogUrl: 'https://www.bvp.com/atlas',
    rssUrl: 'https://www.bvp.com/feed',
  },
  'General Catalyst': {
    website: 'https://www.generalcatalyst.com',
    teamPage: 'https://www.generalcatalyst.com/team',
    portfolioPage: 'https://www.generalcatalyst.com/portfolio',
    blogUrl: 'https://www.generalcatalyst.com/thinking',
    rssUrl: 'https://www.generalcatalyst.com/feed',
  },
  'Index Ventures': {
    website: 'https://www.indexventures.com',
    teamPage: 'https://www.indexventures.com/team/',
    portfolioPage: 'https://www.indexventures.com/portfolio/',
    blogUrl: 'https://www.indexventures.com/perspectives/',
    rssUrl: 'https://www.indexventures.com/perspectives/feed/',
  },
  'Redpoint Ventures': {
    website: 'https://www.redpoint.com',
    teamPage: 'https://www.redpoint.com/team/',
    portfolioPage: 'https://www.redpoint.com/portfolio/',
    rssUrl: 'https://www.redpoint.com/feed/',
  },
  'Union Square Ventures': {
    website: 'https://www.usv.com',
    teamPage: 'https://www.usv.com/team/',
    portfolioPage: 'https://www.usv.com/companies/',
    blogUrl: 'https://www.usv.com/writing/',
    rssUrl: 'https://www.usv.com/feed.xml',
  },
  'Spark Capital': {
    website: 'https://spark.com',
    teamPage: 'https://spark.com/team',
    portfolioPage: 'https://spark.com/portfolio',
    rssUrl: 'https://spark.com/feed',
  },
  'CRV': {
    website: 'https://www.crv.com',
    teamPage: 'https://www.crv.com/team/',
    portfolioPage: 'https://www.crv.com/portfolio/',
    rssUrl: 'https://www.crv.com/feed/',
  },
  Felicis: {
    website: 'https://www.felicis.com',
    teamPage: 'https://www.felicis.com/team',
    portfolioPage: 'https://www.felicis.com/portfolio',
    rssUrl: 'https://www.felicis.com/news/rss',
  },
  boldstart: {
    website: 'https://www.boldstart.vc',
    teamPage: 'https://www.boldstart.vc/team',
    portfolioPage: 'https://www.boldstart.vc/portfolio',
    rssUrl: 'https://www.boldstart.vc/feed/',
  },
  'Insight Partners': {
    website: 'https://www.insightpartners.com',
    teamPage: 'https://www.insightpartners.com/team/',
    portfolioPage: 'https://www.insightpartners.com/portfolio/',
  },
  'Tiger Global': {
    website: 'https://www.tigerglobal.com',
    portfolioPage: 'https://www.tigerglobal.com/portfolio',
  },
  Coatue: {
    website: 'https://www.coatue.com',
    teamPage: 'https://www.coatue.com/team',
    portfolioPage: 'https://www.coatue.com/portfolio',
  },
  'Thrive Capital': {
    website: 'https://thrivecap.com',
    teamPage: 'https://thrivecap.com/team',
    portfolioPage: 'https://thrivecap.com/portfolio',
  },
  'Lux Capital': {
    website: 'https://www.luxcapital.com',
    teamPage: 'https://www.luxcapital.com/team',
    portfolioPage: 'https://www.luxcapital.com/portfolio',
  },
  'Khosla Ventures': {
    website: 'https://www.khoslaventures.com',
    teamPage: 'https://www.khoslaventures.com/team',
    portfolioPage: 'https://www.khoslaventures.com/portfolio',
  },
  'GV': {
    website: 'https://www.gv.com',
    teamPage: 'https://www.gv.com/team',
    portfolioPage: 'https://www.gv.com/portfolio',
  },
  'IVP': {
    website: 'https://www.ivp.com',
    teamPage: 'https://www.ivp.com/team',
    portfolioPage: 'https://www.ivp.com/portfolio',
  },
  'Battery Ventures': {
    website: 'https://www.battery.com',
    teamPage: 'https://www.battery.com/team',
    portfolioPage: 'https://www.battery.com/portfolio',
  },
  'Norwest Venture Partners': {
    website: 'https://www.nvp.com',
    teamPage: 'https://www.nvp.com/team',
    portfolioPage: 'https://www.nvp.com/portfolio',
  },
  'Menlo Ventures': {
    website: 'https://www.menlovc.com',
    teamPage: 'https://www.menlovc.com/team',
    portfolioPage: 'https://www.menlovc.com/portfolio',
  },
  'GGV Capital': {
    website: 'https://www.ggvc.com',
    teamPage: 'https://www.ggvc.com/team',
    portfolioPage: 'https://www.ggvc.com/portfolio',
  },
  'Initialized Capital': {
    website: 'https://initialized.com',
    teamPage: 'https://initialized.com/team',
    portfolioPage: 'https://initialized.com/portfolio',
  },
  'Craft Ventures': {
    website: 'https://www.craftventures.com',
    teamPage: 'https://www.craftventures.com/team',
    portfolioPage: 'https://www.craftventures.com/portfolio',
  },
  'Ribbit Capital': {
    website: 'https://ribbitcap.com',
    teamPage: 'https://ribbitcap.com/team',
    portfolioPage: 'https://ribbitcap.com/portfolio',
  },
  'Wing Venture Capital': {
    website: 'https://www.wing.vc',
    teamPage: 'https://www.wing.vc/team',
    portfolioPage: 'https://www.wing.vc/portfolio',
  },
  'Emergence Capital': {
    website: 'https://www.emcap.com',
    teamPage: 'https://www.emcap.com/team',
    portfolioPage: 'https://www.emcap.com/portfolio',
  },
  'OpenView': {
    website: 'https://openviewpartners.com',
    teamPage: 'https://openviewpartners.com/team',
    portfolioPage: 'https://openviewpartners.com/portfolio',
  },
  'Sapphire Ventures': {
    website: 'https://sapphireventures.com',
    teamPage: 'https://sapphireventures.com/team',
    portfolioPage: 'https://sapphireventures.com/portfolio',
  },
  'Iconiq Capital': {
    website: 'https://www.iconiqcapital.com',
    teamPage: 'https://www.iconiqcapital.com/team',
    portfolioPage: 'https://www.iconiqcapital.com/portfolio',
  },
  '8VC': {
    website: 'https://8vc.com',
    teamPage: 'https://8vc.com/team',
    portfolioPage: 'https://8vc.com/portfolio',
  },
  '500 Global': {
    website: 'https://500.co',
    teamPage: 'https://500.co/team',
    portfolioPage: 'https://500.co/portfolio',
  },
  Techstars: {
    website: 'https://www.techstars.com',
    teamPage: 'https://www.techstars.com/team',
    portfolioPage: 'https://www.techstars.com/portfolio',
  },
  'SoftBank Vision Fund': {
    website: 'https://visionfund.com',
    portfolioPage: 'https://visionfund.com/portfolio',
  },
  'D1 Capital Partners': {
    website: 'https://www.d1capital.com',
    teamPage: 'https://www.d1capital.com/team',
    portfolioPage: 'https://www.d1capital.com/portfolio',
  },
  'Addition': {
    website: 'https://addition.com',
    teamPage: 'https://addition.com/team',
    portfolioPage: 'https://addition.com/portfolio',
  },
  'Matrix Partners': {
    website: 'https://www.matrixpartners.com',
    teamPage: 'https://www.matrixpartners.com/team',
    portfolioPage: 'https://www.matrixpartners.com/portfolio',
  },
  'True Ventures': {
    website: 'https://trueventures.com',
    teamPage: 'https://trueventures.com/team',
    portfolioPage: 'https://trueventures.com/portfolio',
  },
  'Forerunner Ventures': {
    website: 'https://forerunnerventures.com',
    teamPage: 'https://forerunnerventures.com/team',
    portfolioPage: 'https://forerunnerventures.com/portfolio',
  },
  'Homebrew': {
    website: 'https://homebrew.co',
    teamPage: 'https://homebrew.co/team',
    portfolioPage: 'https://homebrew.co/portfolio',
  },
  'Cowboy Ventures': {
    website: 'https://www.cowboy.vc',
    teamPage: 'https://www.cowboy.vc/team',
    portfolioPage: 'https://www.cowboy.vc/portfolio',
  },
  'Amplify Partners': {
    website: 'https://www.amplifypartners.com',
    teamPage: 'https://www.amplifypartners.com/team',
    portfolioPage: 'https://www.amplifypartners.com/portfolio',
  },
  'Costanoa Ventures': {
    website: 'https://www.costanoavc.com',
    teamPage: 'https://www.costanoavc.com/team',
    portfolioPage: 'https://www.costanoavc.com/portfolio',
  },
  'Uncork Capital': {
    website: 'https://uncorkcapital.com',
    teamPage: 'https://uncorkcapital.com/team',
    portfolioPage: 'https://uncorkcapital.com/portfolio',
  },
  'Precursor Ventures': {
    website: 'https://precursorvc.com',
    teamPage: 'https://precursorvc.com/team',
    portfolioPage: 'https://precursorvc.com/portfolio',
  },
  'Haystack': {
    website: 'https://www.haystack.vc',
    teamPage: 'https://www.haystack.vc/team',
    portfolioPage: 'https://www.haystack.vc/portfolio',
  },
  'Bloomberg Beta': {
    website: 'https://www.bloombergbeta.com',
    teamPage: 'https://www.bloombergbeta.com/team',
    portfolioPage: 'https://www.bloombergbeta.com/portfolio',
  },
  'Floodgate': {
    website: 'https://www.floodgate.com',
    teamPage: 'https://www.floodgate.com/team',
    portfolioPage: 'https://www.floodgate.com/portfolio',
  },
  'Upfront Ventures': {
    website: 'https://upfront.com',
    teamPage: 'https://upfront.com/team',
    portfolioPage: 'https://upfront.com/portfolio',
  },
  'Greycroft': {
    website: 'https://www.greycroft.com',
    teamPage: 'https://www.greycroft.com/team',
    portfolioPage: 'https://www.greycroft.com/portfolio',
  },
  'Maveron': {
    website: 'https://www.maveron.com',
    teamPage: 'https://www.maveron.com/team',
    portfolioPage: 'https://www.maveron.com/portfolio',
  },
  'Venrock': {
    website: 'https://www.venrock.com',
    teamPage: 'https://www.venrock.com/team',
    portfolioPage: 'https://www.venrock.com/portfolio',
  },
  'Mayfield': {
    website: 'https://www.mayfield.com',
    teamPage: 'https://www.mayfield.com/team',
    portfolioPage: 'https://www.mayfield.com/portfolio',
  },
  'Madrona': {
    website: 'https://www.madrona.com',
    teamPage: 'https://www.madrona.com/team',
    portfolioPage: 'https://www.madrona.com/portfolio',
  },
  'Foundry Group': {
    website: 'https://foundrygroup.com',
    teamPage: 'https://foundrygroup.com/team',
    portfolioPage: 'https://foundrygroup.com/portfolio',
  },
  'Bain Capital Ventures': {
    website: 'https://www.baincapitalventures.com',
    teamPage: 'https://www.baincapitalventures.com/team',
    portfolioPage: 'https://www.baincapitalventures.com/portfolio',
  },
  'TCV': {
    website: 'https://www.tcv.com',
    teamPage: 'https://www.tcv.com/team',
    portfolioPage: 'https://www.tcv.com/portfolio',
  },
  'Scale Venture Partners': {
    website: 'https://www.scalevp.com',
    teamPage: 'https://www.scalevp.com/team',
    portfolioPage: 'https://www.scalevp.com/portfolio',
  },
  'Sierra Ventures': {
    website: 'https://www.sierraventures.com',
    teamPage: 'https://www.sierraventures.com/team',
    portfolioPage: 'https://www.sierraventures.com/portfolio',
  },
  'Crosslink Capital': {
    website: 'https://www.crosslinkcapital.com',
    teamPage: 'https://www.crosslinkcapital.com/team',
    portfolioPage: 'https://www.crosslinkcapital.com/portfolio',
  },
  'Shasta Ventures': {
    website: 'https://www.shastaventures.com',
    teamPage: 'https://www.shastaventures.com/team',
    portfolioPage: 'https://www.shastaventures.com/portfolio',
  },
  'Norwest': {
    website: 'https://www.norwest.com',
    teamPage: 'https://www.norwest.com/team',
    portfolioPage: 'https://www.norwest.com/portfolio',
  },
  'Polaris Partners': {
    website: 'https://www.polarispartners.com',
    teamPage: 'https://www.polarispartners.com/team',
    portfolioPage: 'https://www.polarispartners.com/portfolio',
  },
  'RRE Ventures': {
    website: 'https://www.rre.com',
    teamPage: 'https://www.rre.com/team',
    portfolioPage: 'https://www.rre.com/portfolio',
  },
  'Two Sigma Ventures': {
    website: 'https://www.twosigmaventures.com',
    teamPage: 'https://www.twosigmaventures.com/team',
    portfolioPage: 'https://www.twosigmaventures.com/portfolio',
  },
  'Work-Bench': {
    website: 'https://www.work-bench.com',
    teamPage: 'https://www.work-bench.com/team',
    portfolioPage: 'https://www.work-bench.com/portfolio',
  },
  'Primary Venture Partners': {
    website: 'https://www.primary.vc',
    teamPage: 'https://www.primary.vc/team',
    portfolioPage: 'https://www.primary.vc/portfolio',
  },
  'BoxGroup': {
    website: 'https://www.boxgroup.com',
    teamPage: 'https://www.boxgroup.com/team',
    portfolioPage: 'https://www.boxgroup.com/portfolio',
  },
  'Slow Ventures': {
    website: 'https://slow.co',
    teamPage: 'https://slow.co/team',
    portfolioPage: 'https://slow.co/portfolio',
  },
  'Kindred Ventures': {
    website: 'https://kindredventures.com',
    teamPage: 'https://kindredventures.com/team',
    portfolioPage: 'https://kindredventures.com/portfolio',
  },
  'Abstract Ventures': {
    website: 'https://www.abstract.vc',
    teamPage: 'https://www.abstract.vc/team',
    portfolioPage: 'https://www.abstract.vc/portfolio',
  },
  'Wing': {
    website: 'https://www.wing.vc',
    teamPage: 'https://www.wing.vc/team',
    portfolioPage: 'https://www.wing.vc/portfolio',
  },
  'Hummingbird Ventures': {
    website: 'https://www.hummingbird.vc',
    teamPage: 'https://www.hummingbird.vc/team',
    portfolioPage: 'https://www.hummingbird.vc/portfolio',
  },
  'Point Nine': {
    website: 'https://www.pointnine.com',
    teamPage: 'https://www.pointnine.com/team',
    portfolioPage: 'https://www.pointnine.com/portfolio',
  },
  'LocalGlobe': {
    website: 'https://localglobe.vc',
    teamPage: 'https://localglobe.vc/team',
    portfolioPage: 'https://localglobe.vc/portfolio',
  },
  'Balderton Capital': {
    website: 'https://www.balderton.com',
    teamPage: 'https://www.balderton.com/team',
    portfolioPage: 'https://www.balderton.com/portfolio',
  },
  'Atomico': {
    website: 'https://www.atomico.com',
    teamPage: 'https://www.atomico.com/team',
    portfolioPage: 'https://www.atomico.com/portfolio',
  },
  'Northzone': {
    website: 'https://northzone.com',
    teamPage: 'https://northzone.com/team',
    portfolioPage: 'https://northzone.com/portfolio',
  },
  'Creandum': {
    website: 'https://www.creandum.com',
    teamPage: 'https://www.creandum.com/team',
    portfolioPage: 'https://www.creandum.com/portfolio',
  },
  'EQT Ventures': {
    website: 'https://eqtventures.com',
    teamPage: 'https://eqtventures.com/team',
    portfolioPage: 'https://eqtventures.com/portfolio',
  },
  'Cherry Ventures': {
    website: 'https://cherry.vc',
    teamPage: 'https://cherry.vc/team',
    portfolioPage: 'https://cherry.vc/portfolio',
  },
  'HV Capital': {
    website: 'https://www.hvcapital.com',
    teamPage: 'https://www.hvcapital.com/team',
    portfolioPage: 'https://www.hvcapital.com/portfolio',
  },
  'Lakestar': {
    website: 'https://www.lakestar.com',
    teamPage: 'https://www.lakestar.com/team',
    portfolioPage: 'https://www.lakestar.com/portfolio',
  },
  'Accel Partners': {
    website: 'https://www.accel.com',
    teamPage: 'https://www.accel.com/people',
    portfolioPage: 'https://www.accel.com/companies',
    rssUrl: 'https://www.accel.com/insights/rss',
  },
};

/** Ordered priority list — top ~100 firms for daily rotation */
export const TOP_VC_FIRM_NAMES = Object.keys(VC_WEBSITES);

/** DB name / alias → canonical VC_WEBSITES key */
export const VC_NAME_ALIASES = {
  a16z: 'Andreessen Horowitz',
  'andreessen horowitz (a16z)': 'Andreessen Horowitz',
  greylock: 'Greylock Partners',
  nea: 'NEA',
  'new enterprise associates': 'NEA',
  kp: 'Kleiner Perkins',
  'kleiner perkins caufield & byers': 'Kleiner Perkins',
  lsvp: 'Lightspeed Venture Partners',
  lightspeed: 'Lightspeed Venture Partners',
  yc: 'Y Combinator',
  sequoia: 'Sequoia Capital',
  benchmark: 'Benchmark',
  'founders fund': 'Founders Fund',
  accel: 'Accel',
  'first round': 'First Round Capital',
  firstround: 'First Round Capital',
  bvp: 'Bessemer Venture Partners',
  bessemer: 'Bessemer Venture Partners',
  usv: 'Union Square Ventures',
  'union square': 'Union Square Ventures',
  '500 startups': '500 Global',
  '500 global': '500 Global',
  insight: 'Insight Partners',
  tiger: 'Tiger Global',
  'tiger global management': 'Tiger Global',
  softbank: 'SoftBank Vision Fund',
  matrix: 'Matrix Partners',
  ggv: 'GGV Capital',
  khosla: 'Khosla Ventures',
  ribbit: 'Ribbit Capital',
  craft: 'Craft Ventures',
  initialized: 'Initialized Capital',
  bain: 'Bain Capital Ventures',
  'bain capital ventures': 'Bain Capital Ventures',
};

/**
 * @param {string} investorName
 * @returns {string | null}
 */
export function resolveVcWebsiteKey(investorName) {
  const raw = investorName.trim();
  if (VC_WEBSITES[raw]) return raw;
  const lower = raw.toLowerCase();
  if (VC_NAME_ALIASES[lower]) return VC_NAME_ALIASES[lower];
  for (const key of Object.keys(VC_WEBSITES)) {
    if (key.toLowerCase() === lower) return key;
  }
  for (const key of Object.keys(VC_WEBSITES)) {
    const kl = key.toLowerCase();
    if (lower.includes(kl) || kl.includes(lower)) return key;
  }
  return null;
}

/**
 * Daily batch slice — rotates through TOP_VC_FIRM_NAMES so all ~100 get enriched over ~10 days.
 * @param {number} batchSize
 * @param {number} [dayOffset] — defaults to day-of-year
 */
export function dailyVcBatch(batchSize = 10, dayOffset = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000)) {
  const pool = TOP_VC_FIRM_NAMES;
  const start = (dayOffset * batchSize) % pool.length;
  const batch = [];
  for (let i = 0; i < batchSize; i++) {
    batch.push(pool[(start + i) % pool.length]);
  }
  return batch;
}
