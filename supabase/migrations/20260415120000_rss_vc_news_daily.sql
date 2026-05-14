-- VC News Daily: no stable /feed URL; homepage is scraped as a synthetic feed
-- (see lib/vcNewsDailyHomepage.js + ssot-rss-scraper.js / fetch-rss-articles.js).

INSERT INTO public.rss_sources (name, url, category, priority, active)
VALUES (
  'VC News Daily',
  'https://vcnewsdaily.com/',
  'vc_deals',
  9,
  true
)
ON CONFLICT (url) DO NOTHING;
