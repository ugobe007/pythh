-- Deactivate RSS rows that consistently fail (404/403/bad XML/HTML) in local scrapes.
-- Use when `npx supabase db push` cannot run (remote migration history drift).
-- Run in Supabase Dashboard → SQL Editor against the SAME project as DATABASE_URL / scraper.

UPDATE public.rss_sources
SET active = false,
    updated_at = NOW()
WHERE url IN (
  -- Already covered by fix-rss-feeds / earlier migrations; safe idempotent deactivate
  'https://builtin.com/rss.xml',
  'https://www.sbir.gov/rss/awards.rss',
  'https://www.grants.gov/rss/GG_NewOppByCategory.xml?category=ST',
  'https://www.finsmes.com/feed',
  'https://www.finsmes.com/feed/',
  'https://www.startupgrind.com/blog/feed/',
  'https://www.startupgrind.com/feed/',
  'https://kr-asia.com/feed',

  -- Fast Company — old path (replacement is /latest/rss in migration 20260409180000)
  'https://www.fastcompany.com/technology/rss.xml',

  -- VC / media — 404, 403, or not RSS (Apr 2026 scrape)
  'https://a16z.com/feed/',
  'https://a16z.com/blog/feed/',
  'https://www.bvp.com/atlas/rss.xml',
  'https://www.accel.com/insights/feed',
  'https://www.bvp.com/feed',
  'https://betalist.com/feed',
  'https://www.indexventures.com/feed/',
  'https://www.angellist.com/blog/rss.xml',
  'https://review.firstround.com/feed',
  'https://www.axios.com/pro-rata/rss',
  'https://www.axios.com/pro-rata',
  'https://fortune.com/tag/term-sheet/feed/',
  'https://vcnewsdaily.com/feed/',
  'https://www.techstars.com/blog/feed',
  'https://thehustle.co/feed/',
  'https://greylock.com/feed/',
  'https://www.nea.com/insights/feed',
  'https://www.nea.com/feed',
  'https://www.nfx.com/post/feed.xml',
  'https://sequoiacap.com/stories/',
  'https://sequoiacap.com/stories/?_story-category=news',
  'https://dealroom.co/blog/feed',
  'https://www.bloomberg.com/feed/podcast/bloomberg-technology',
  'https://benchmark.com/feed/',
  'https://www.gv.com/feed/',
  'https://kr-asia.com/rss/feed.xml',
  'https://feeds.megaphone.fm/thisweekinstartups',
  'https://www.deeplearning.ai/the-batch/',
  'https://e27.co/feed/',
  'https://www.saascapital.com/blog/feed/',
  'https://blog.angel.co/feed/',
  'https://www.indiehackers.com/feed',
  'https://hax.co/startups/',
  'https://sifted.eu/feed/',
  'https://www.wired.co.uk/feed/category/business/latest/rss',
  'https://www.tomtunguz.com/feed/',
  'https://bothsidesofthetable.com/feed',
  'https://inside.com/ai/rss',
  'https://www.businessinsider.com/sai/rss',
  'https://www.thetwentyminutevc.com/feed/',
  'https://www.startups.com/library/rss',
  'https://www.theinformation.com/feed',
  'https://www.cbinsights.com/feed',
  'https://500.co/blog/feed/',
  'https://www.fintechfutures.com/feed/',
  'https://jp.techcrunch.com/feed/',
  'https://www.inc.com/rss/index.rss',
  'https://topstartups.io/rss/',
  'https://www.eu-startups.com/feed/'
);

-- Optional: see how many rows matched
-- SELECT COUNT(*) FROM public.rss_sources WHERE active = false AND updated_at > NOW() - INTERVAL '1 minute';
