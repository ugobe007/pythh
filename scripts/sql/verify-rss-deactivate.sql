-- Compare bulk-deactivate URL list to public.rss_sources (SQL Editor or psql, one session).
-- After deactivate_dead_rss_feeds_bulk.sql: expect verify_status = inactive_ok (or not_in_db if never seeded).
-- Fast Company old URL may be not_in_db if migration rewrote row to /latest/rss.

CREATE TEMP TABLE _rss_deactivate_expected (url text PRIMARY KEY);

INSERT INTO _rss_deactivate_expected (url) VALUES
  ('https://builtin.com/rss.xml'),
  ('https://www.sbir.gov/rss/awards.rss'),
  ('https://www.grants.gov/rss/GG_NewOppByCategory.xml?category=ST'),
  ('https://www.finsmes.com/feed'),
  ('https://www.finsmes.com/feed/'),
  ('https://www.startupgrind.com/blog/feed/'),
  ('https://www.startupgrind.com/feed/'),
  ('https://kr-asia.com/feed'),
  ('https://www.fastcompany.com/technology/rss.xml'),
  ('https://a16z.com/feed/'),
  ('https://a16z.com/blog/feed/'),
  ('https://www.bvp.com/atlas/rss.xml'),
  ('https://www.accel.com/insights/feed'),
  ('https://www.bvp.com/feed'),
  ('https://betalist.com/feed'),
  ('https://www.indexventures.com/feed/'),
  ('https://www.angellist.com/blog/rss.xml'),
  ('https://review.firstround.com/feed'),
  ('https://www.axios.com/pro-rata/rss'),
  ('https://www.axios.com/pro-rata'),
  ('https://fortune.com/tag/term-sheet/feed/'),
  ('https://vcnewsdaily.com/feed/'),
  ('https://www.techstars.com/blog/feed'),
  ('https://thehustle.co/feed/'),
  ('https://greylock.com/feed/'),
  ('https://www.nea.com/insights/feed'),
  ('https://www.nea.com/feed'),
  ('https://www.nfx.com/post/feed.xml'),
  ('https://sequoiacap.com/stories/'),
  ('https://sequoiacap.com/stories/?_story-category=news'),
  ('https://dealroom.co/blog/feed'),
  ('https://www.bloomberg.com/feed/podcast/bloomberg-technology'),
  ('https://benchmark.com/feed/'),
  ('https://www.gv.com/feed/'),
  ('https://kr-asia.com/rss/feed.xml'),
  ('https://feeds.megaphone.fm/thisweekinstartups'),
  ('https://www.deeplearning.ai/the-batch/'),
  ('https://e27.co/feed/'),
  ('https://www.saascapital.com/blog/feed/'),
  ('https://blog.angel.co/feed/'),
  ('https://www.indiehackers.com/feed'),
  ('https://hax.co/startups/'),
  ('https://sifted.eu/feed/'),
  ('https://www.wired.co.uk/feed/category/business/latest/rss'),
  ('https://www.tomtunguz.com/feed/'),
  ('https://bothsidesofthetable.com/feed'),
  ('https://inside.com/ai/rss'),
  ('https://www.businessinsider.com/sai/rss'),
  ('https://www.thetwentyminutevc.com/feed/'),
  ('https://www.startups.com/library/rss'),
  ('https://www.theinformation.com/feed'),
  ('https://www.cbinsights.com/feed'),
  ('https://500.co/blog/feed/'),
  ('https://www.fintechfutures.com/feed/'),
  ('https://jp.techcrunch.com/feed/'),
  ('https://www.inc.com/rss/index.rss'),
  ('https://topstartups.io/rss/'),
  ('https://www.eu-startups.com/feed/');

-- Detail: one row per expected URL
SELECT
  e.url,
  rs.id,
  rs.name AS rss_source_name,
  rs.active,
  CASE
    WHEN rs.id IS NULL THEN 'not_in_db'
    WHEN rs.active THEN 'still_active'
    ELSE 'inactive_ok'
  END AS verify_status
FROM _rss_deactivate_expected e
LEFT JOIN public.rss_sources rs ON rs.url = e.url
ORDER BY
  CASE
    WHEN rs.id IS NULL THEN 1
    WHEN rs.active THEN 0
    ELSE 2
  END,
  e.url;

-- Summary counts
SELECT
  CASE
    WHEN rs.id IS NULL THEN 'not_in_db'
    WHEN rs.active THEN 'still_active'
    ELSE 'inactive_ok'
  END AS verify_status,
  COUNT(*)::bigint AS n
FROM _rss_deactivate_expected e
LEFT JOIN public.rss_sources rs ON rs.url = e.url
GROUP BY 1
ORDER BY 1;

DROP TABLE _rss_deactivate_expected;
