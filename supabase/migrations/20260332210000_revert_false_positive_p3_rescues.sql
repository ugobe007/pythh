-- ============================================================
-- Revert false-positive P3 rescue entries
-- These companies were incorrectly rescued because a generic
-- English word or descriptive phrase happened to resolve to a
-- registered domain (e.g. "Use Analytics" → use.com).
-- We set them back to rejected so the improved pipeline can
-- handle them correctly on the next pass.
-- ============================================================

-- Safety view: inspect before touching anything
-- SELECT id, name, website, status, enrichment_status, admin_notes
-- FROM startup_uploads
-- WHERE admin_notes ILIKE '%P3 domain resolved%'
--   AND website = ANY(ARRAY[...])
-- ORDER BY name;

DO $$
DECLARE
  false_positive_domains TEXT[] := ARRAY[
    -- Generic English verbs / gerunds that resolved to domains
    'use.com',
    'using.ai',
    'counter.com',
    'operating.com',
    'build.ai',
    'launch.ai',
    'generate.ai',
    'manage.ai',
    'connect.ai',
    'shift.ai',
    'replace.ai',
    'validate.ai',

    -- Geographic descriptors (not companies)
    'south.com',
    'scottish.ai',
    'scottish.com',
    'busan.ai',
    'busan.com',
    'diego.ai',       -- "Diego Startups" fragment
    'midtown.com',
    'angeles.ai',
    'newmaine.com',
    'kenyan.com',
    'kenyan.ai',

    -- Funding-stage labels
    'seriesa.com',
    'seriesb.com',
    'seriesc.com',
    'pre-seed.com',

    -- Descriptor-only names that resolved
    'heavyindustry.com',
    'exteriorcleaning.com',
    'maternalhealth.com',
    'maternalhealth.ai',
    'nanotech.ai',
    'deeptech.ai',
    'skillecosystem.com',
    'skillecosystem.ai',
    'oralpeptide.com',
    'scorecard.com',   -- "Operations Scorecard" fragment
    'journals.ai',     -- "Journals Seattle"

    -- News-headline fragments rescued as company names
    'dogegoes.com',
    'agentsflood.com',

    -- Well-known non-startup entities that should never be rescued
    -- (these appear when a news phrase like "Autodesk Construction" is extracted)
    'autodesk.com',
    'jpmorgan.com',
    'rivian.com',
    'techstars.com',
    'openai.com',
    'yahoofinance.com',
    'govinfosecurity.com',
    'amd.com'
  ];
  reverted_count INT;
BEGIN
  UPDATE startup_uploads
  SET
    status            = 'rejected',
    enrichment_status = NULL,
    website           = NULL,
    admin_notes       = COALESCE(admin_notes, '') ||
                        E'\n[auto-revert] False-positive P3 rescue — domain was generic/descriptor. '
                        'Re-queued for improved pipeline pass.'
  WHERE
    -- Only touch records that were rescued by our P3 logic
    admin_notes ILIKE '%P3 domain resolved%'
    -- And whose resolved website is in the false-positive list
    AND website = ANY(false_positive_domains);

  GET DIAGNOSTICS reverted_count = ROW_COUNT;
  RAISE NOTICE 'Reverted % false-positive P3 rescues', reverted_count;
END $$;
