-- Expand RSS source library — Phase 2
-- Adds ~35 high-quality startup / VC / vertical / patent / SEC feeds.
-- Uses ON CONFLICT (url) DO NOTHING so re-running is safe.

-- ── TIER 1: Additional Core VC & Deal Press ───────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Fortune Term Sheet',        'https://fortune.com/section/term-sheet/feed/',                                     'vc_deals',     9),
  ('Wall Street Journal – VC',  'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',                                   'vc_deals',     8),
  ('Reuters – Tech M&A',        'https://feeds.reuters.com/reuters/technologyNews',                                 'vc_deals',     8),
  ('Bloomberg Technology',      'https://feeds.bloomberg.com/technology/news.rss',                                  'startup_news', 8),
  ('The Information – Feed',    'https://www.theinformation.com/feed',                                              'startup_news', 7)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 1: AI / ML Intelligence ─────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('The Batch – DeepLearning.AI','https://www.deeplearning.ai/the-batch/feed/',                                     'ai_ml',       10),
  ('Import AI – Jack Clark',    'https://importai.substack.com/feed',                                               'ai_ml',        9),
  ('The Gradient',              'https://thegradient.pub/rss/',                                                     'ai_ml',        8),
  ('TLDR AI Newsletter',        'https://tldr.tech/ai/rss',                                                         'ai_ml',        8),
  ('Weights & Biases Blog',     'https://wandb.ai/site/blog/feed',                                                  'ai_ml',        7),
  ('Hugging Face Blog',         'https://huggingface.co/blog/feed.xml',                                             'ai_ml',        7),
  ('Papers With Code',          'https://paperswithcode.com/rss.xml',                                               'ai_ml',        6)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 1: FinTech Intelligence ──────────────────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Fintech Nexus',             'https://fintechnexus.com/feed/',                                                   'fintech',      9),
  ('PYMNTS',                    'https://www.pymnts.com/feed/',                                                     'fintech',      8),
  ('The Fintech Times',         'https://thefintechtimes.com/feed/',                                                'fintech',      8),
  ('FinExtra',                  'https://www.finextra.com/rss/pressreleases.xml',                                   'fintech',      8),
  ('CB Insights – Fintech',     'https://www.cbinsights.com/research/fintech/feed',                                 'fintech',      7)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 1: HealthTech / BioTech Intelligence ─────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('MedCity News',              'https://medcitynews.com/feed/',                                                    'healthtech',   9),
  ('Rock Health',               'https://rockhealth.com/feed/',                                                     'healthtech',   9),
  ('Digital Health Today',      'https://digitalhealthtoday.com/feed/',                                             'healthtech',   8),
  ('STAT News',                 'https://www.statnews.com/feed/',                                                   'healthtech',   8),
  ('Fierce Healthcare',         'https://www.fiercehealthcare.com/feed',                                            'healthtech',   7),
  ('BioPharma Dive',            'https://www.biopharmadive.com/feeds/news/',                                        'biotech',      8)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 2: CleanTech / Climate Intelligence ──────────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Canary Media',              'https://www.canarymedia.com/rss',                                                  'cleantech',    8),
  ('CleanTechnica',             'https://cleantechnica.com/feed/',                                                  'cleantech',    8),
  ('PV Magazine',               'https://www.pv-magazine.com/feed/',                                               'cleantech',    7),
  ('GreenBiz',                  'https://www.greenbiz.com/feeds/rss/all',                                           'cleantech',    7),
  ('Energy Monitor',            'https://www.energymonitor.ai/feed/',                                               'cleantech',    7)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 2: Founder Community & Ecosystem Feeds ───────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Y Combinator Blog',         'https://www.ycombinator.com/blog/rss.xml',                                        'founder_community', 9),
  ('First Round Review',        'https://review.firstround.com/feed.xml',                                          'founder_community', 9),
  ('a16z Blog',                 'https://a16z.com/feed/',                                                           'founder_community', 8),
  ('Sequoia Blog',              'https://www.sequoiacap.com/articles/feed/',                                        'founder_community', 8),
  ('Founder Weekly',            'https://us10.campaign-archive.com/feed?u=4c7300deff60f5e5dc93b36e0&id=07cc4fa5f3','founder_community', 7),
  ('Both Sides of the Table',   'https://bothsidesofthetable.com/feed',                                             'founder_community', 7),
  ('Signal v. Noise',           'https://signalvnoise.com/feed',                                                    'founder_community', 6)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 2: Additional Regional / International ───────────────────────────
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('Tech in Asia',              'https://www.techinasia.com/feed',                                                  'regional', 8),
  ('TechNode (China/Asia)',      'https://technode.com/feed/',                                                      'regional', 7),
  ('UK Tech News',              'https://www.uktech.news/feed',                                                     'regional', 7),
  ('African Business',          'https://africanbusinessmagazine.com/feed/',                                        'regional', 6),
  ('LatAm List',                'https://latamlist.com/feed/',                                                      'regional', 6),
  ('Wamda',                     'https://wamda.com/feed',                                                           'regional', 6)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 3: Patent & IP Signal Feeds ─────────────────────────────────────
-- Patent filings are strong R&D signals — 12–24 months before product launch.
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('USPTO – Recent Patents',    'https://rss.usefulscience.org/usptoPatents',                                       'patent_signal', 6),
  ('Google Patents – AI',       'https://patents.google.com/rss/query?q=machine+learning+startup&assignee=&ddate=&country=US', 'patent_signal', 6),
  ('WIPO – Global Patents',     'https://patentscope.wipo.int/search/rss?query=startup',                            'patent_signal', 5)
ON CONFLICT (url) DO NOTHING;

-- ── TIER 3: SEC EDGAR — M&A, Funding & Distress Signals ─────────────────
-- 8-K filings contain: fundraising, M&A, exec changes, material events.
-- These are confirmed, time-stamped events — highest evidence quality.
INSERT INTO public.rss_sources (name, url, category, priority) VALUES
  ('SEC EDGAR – 8-K Filings',   'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&search_text=&output=atom', 'sec_filing', 9),
  ('SEC EDGAR – S-1 Filings',   'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=S-1&dateb=&owner=include&count=20&search_text=&output=atom', 'sec_filing', 9),
  ('SEC EDGAR – DEF 14A',       'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=DEF+14A&dateb=&owner=include&count=20&search_text=&output=atom', 'sec_filing', 7)
ON CONFLICT (url) DO NOTHING;
