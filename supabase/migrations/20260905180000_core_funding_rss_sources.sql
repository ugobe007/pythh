-- Core funding / launch news feeds (docs/FUNDING_SEARCH_POLICY.md).
-- First-party RSS where it works; Google News site: for Dealroom / AngelList.

INSERT INTO public.rss_sources (name, url, category, priority, active) VALUES
  ('Crunchbase News', 'https://news.crunchbase.com/feed/', 'vc_deals', 10, true),
  ('TechCrunch – Startups', 'https://techcrunch.com/category/startups/feed/', 'startup_news', 10, true),
  ('Product Hunt Daily', 'https://www.producthunt.com/feed', 'early_stage', 8, true),
  (
    'Dealroom via Google News',
    'https://news.google.com/rss/search?q=site:dealroom.co+(funding+OR+raises+OR+startup)&hl=en-US&gl=US&ceid=US:en',
    'vc_deals',
    7,
    true
  ),
  (
    'AngelList via Google News',
    'https://news.google.com/rss/search?q=site:angellist.com+OR+site:wellfound.com+(startup+OR+funding)&hl=en-US&gl=US&ceid=US:en',
    'vc_insights',
    6,
    true
  )
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  priority = EXCLUDED.priority,
  active = true;

-- First-party Dealroom / AngelList feeds stay off (CF 403 / HTML catch-all).
UPDATE public.rss_sources
SET active = false
WHERE url IN (
  'https://dealroom.co/blog/feed',
  'https://www.angellist.com/blog/rss.xml',
  'https://blog.angel.co/feed/'
);
