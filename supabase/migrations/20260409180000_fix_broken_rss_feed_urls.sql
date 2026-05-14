-- Fix or pause RSS sources that return 404, bot-block (403), invalid XML, or HTML instead of feeds.
-- Verified Apr 2026: Fast Company /technology/rss → 404; use /latest/rss.
-- Built In, SBIR awards RSS, Grants.gov category RSS — dead or return HTML; FinSMEs — Cloudflare challenge; Startup Grind blog — 404.

-- ── Fast Company: /technology/rss.xml → /latest/rss ──────────────────────
-- A second row may already use /latest/rss (e.g. batch seed). Do not UPDATE into
-- a duplicate url — drop the obsolete row instead.
DELETE FROM public.rss_sources
WHERE url = 'https://www.fastcompany.com/technology/rss.xml'
  AND EXISTS (
    SELECT 1 FROM public.rss_sources r2
    WHERE r2.url = 'https://www.fastcompany.com/latest/rss'
  );

UPDATE public.rss_sources
SET
  url = 'https://www.fastcompany.com/latest/rss',
  consecutive_failures = 0
WHERE url = 'https://www.fastcompany.com/technology/rss.xml';

-- ── Pause until re-verified (no stable public RSS or blocked) ───────────────
UPDATE public.rss_sources
SET active = false
WHERE url IN (
  'https://builtin.com/rss.xml',
  'https://www.sbir.gov/rss/awards.rss',
  'https://www.grants.gov/rss/GG_NewOppByCategory.xml?category=ST',
  'https://www.finsmes.com/feed',
  'https://www.finsmes.com/feed/',
  'https://www.startupgrind.com/blog/feed/',
  'https://www.startupgrind.com/feed/'
);
