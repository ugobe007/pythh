-- Pause RSS rows that consistently fail in ssot-rss-scraper (404/403/406, timeouts,
-- HTML instead of RSS, invalid XML). Aligns with scripts/sql/deactivate_dead_rss_feeds_bulk.sql
-- and Apr 2026 scrape logs.
--
-- Axios: merge legacy `pro-rata/rss` into canonical `feeds/feed.rss`, drop duplicate row,
-- deactivate HTML pro-rata URL, then ensure the canonical row exists.

UPDATE public.rss_sources
SET url = 'https://www.axios.com/feeds/feed.rss',
    active = true
WHERE url = 'https://www.axios.com/pro-rata/rss'
  AND NOT EXISTS (
    SELECT 1 FROM public.rss_sources x WHERE x.url = 'https://www.axios.com/feeds/feed.rss'
  );

DELETE FROM public.rss_sources
WHERE url = 'https://www.axios.com/pro-rata/rss'
  AND EXISTS (
    SELECT 1 FROM public.rss_sources x WHERE x.url = 'https://www.axios.com/feeds/feed.rss'
  );

UPDATE public.rss_sources
SET active = false
WHERE url IN (
  'https://builtin.com/rss.xml',
  'https://www.sbir.gov/rss/awards.rss',
  'https://www.grants.gov/rss/GG_NewOppByCategory.xml?category=ST',
  'https://www.finsmes.com/feed',
  'https://www.finsmes.com/feed/',
  'https://www.startupgrind.com/blog/feed/',
  'https://www.startupgrind.com/feed/',
  'https://kr-asia.com/feed',
  'https://www.fastcompany.com/technology/rss.xml',
  'https://a16z.com/feed/',
  'https://a16z.com/blog/feed/',
  'https://www.bvp.com/atlas/rss.xml',
  'https://www.accel.com/insights/feed',
  'https://www.bvp.com/feed',
  'https://betalist.com/feed',
  'https://www.indexventures.com/feed/',
  'https://www.angellist.com/blog/rss.xml',
  'https://review.firstround.com/feed',
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
  'https://www.benchmark.com/feed/',
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
  'https://sifted.eu/feed',
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
  'https://www.eu-startups.com/feed/',
  'https://www.entrepreneur.com/latest.rss'
);

-- Canonical Axios feed (redirects to api.axios.com; works in scraper).
INSERT INTO public.rss_sources (name, url, category, priority, active)
VALUES ('Axios Pro Rata', 'https://www.axios.com/feeds/feed.rss', 'vc_deals', 7, true)
ON CONFLICT (url) DO NOTHING;
