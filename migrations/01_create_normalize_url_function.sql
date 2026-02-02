-- Migration 01: Create URL normalization function
-- Run this FIRST before creating any tables

CREATE OR REPLACE FUNCTION normalize_url(input_url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input_url, '^https?://', '', 'i'),
      '/$', ''
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_url IS 'Normalizes URLs: trim, lowercase, no protocol, no trailing slash';

-- Verify function works
SELECT normalize_url('https://NucleoResearch.com/') AS test;
-- Expected result: 'nucleoresearch.com'
