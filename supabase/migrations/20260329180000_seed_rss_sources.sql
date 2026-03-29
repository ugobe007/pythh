-- Seed rss_sources with the full discovery source list.
-- Uses ON CONFLICT (url) DO NOTHING so re-running is safe.

CREATE TABLE IF NOT EXISTS public.rss_sources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  url                   text NOT NULL UNIQUE,
  category              text,
  active                boolean NOT NULL DEFAULT true,
  priority              int NOT NULL DEFAULT 5,
  last_scraped          timestamptz,
  total_discoveries     int NOT NULL DEFAULT 0,
  avg_yield_per_scrape  numeric(6,2),
  consecutive_failures  int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── TIER 1: Press Releases ────────────────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('PR Newswire – Tech',       'https://www.prnewswire.com/rss/news-releases-list.rss',                              'press_release', 9),
  ('Business Wire – Tech',     'https://feed.businesswire.com/rss/home/?rss=G1&category=technology',                 'press_release', 9),
  ('GlobeNewswire – Tech',     'https://www.globenewswire.com/RssFeed/subjectcode/17-Technology',                    'press_release', 8)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 1: Core Tech Publications ───────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('TechCrunch – Startups',    'https://techcrunch.com/category/startups/feed/',                                     'startup_news', 10),
  ('TechCrunch – Funding',     'https://techcrunch.com/category/venture/feed/',                                      'vc_deals',     10),
  ('VentureBeat',              'https://venturebeat.com/feed/',                                                      'startup_news',  9),
  ('Hacker News – Show HN',    'https://hnrss.org/show',                                                             'community',     8),
  ('Hacker News – New',        'https://hnrss.org/newest?q=startup+raises+funding+launch',                           'community',     7)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 2: VC & Deal Intelligence ───────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Crunchbase News',          'https://news.crunchbase.com/feed/',                                                  'vc_deals', 8),
  ('Axios Pro Rata',           'https://www.axios.com/pro-rata/rss',                                                 'vc_deals', 7),
  ('SiliconANGLE',             'https://siliconangle.com/feed/',                                                     'startup_news', 7),
  ('The Information',          'https://www.theinformation.com/feed',                                                'startup_news', 7),
  ('StrictlyVC',               'https://strictlyvc.com/feed/',                                                       'vc_deals', 6)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 2: European & Regional ──────────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Sifted',                   'https://sifted.eu/feed',                                                             'regional', 8),
  ('EU-Startups',              'https://www.eu-startups.com/feed/',                                                  'regional', 8),
  ('GeekWire',                 'https://www.geekwire.com/feed/',                                                     'regional', 7),
  ('AlleyWatch',               'https://www.alleywatch.com/feed/',                                                   'regional', 6),
  ('Built In',                 'https://builtin.com/rss.xml',                                                        'regional', 6)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 2: Early-Stage & Community ──────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Product Hunt',             'https://www.producthunt.com/feed',                                                   'early_stage', 8),
  ('BetaList',                 'https://betalist.com/feed',                                                          'early_stage', 7),
  ('Indie Hackers',            'https://www.indiehackers.com/feed.xml',                                              'early_stage', 6)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 3: Government Grants & Contracts ────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('SBIR.gov Awards',          'https://www.sbir.gov/rss/awards.rss',                                                'gov_grants', 5),
  ('Grants.gov – Tech',        'https://www.grants.gov/rss/GG_NewOppByCategory.xml?category=ST',                     'gov_grants', 4)
ON CONFLICT (url) DO NOTHING;
