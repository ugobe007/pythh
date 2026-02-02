-- Real-World RSS Pattern Fixes
-- Based on analysis of actual discovered startups (Jan 25, 2026)

-- ============================================
-- ADDITIONAL GENERIC TERMS (from real data)
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  -- Hacker News patterns
  ('Show', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Show HN', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- Common words that aren't companies
  ('How To', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Humans', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- Geographic/nationality adjectives (standalone)
  ('Finnish', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Japanese', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Chinese', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('American', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('British', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('European', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Korean', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Israeli', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Canadian', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('German', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('French', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- Descriptors + Company/Startup
  ('Satellite Company', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Tech Company', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Software Company', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('AI Company', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Crypto Company', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Startup Company', 'GENERIC_TERM', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- INVESTORS (that were misclassified)
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Start Angel', 'INVESTOR', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- PLACES (that were extracted as startups)
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('UK', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('USA', 'PLACE', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- KNOWN GOOD STARTUPS (from discovered list)
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Harvey', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Seismic', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('QuantumLight', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Altek AI', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Astranis', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Agileday', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Amissa', 'STARTUP', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- Summary
-- ============================================

DO $$
DECLARE
  total_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM entity_ontologies;
  
  RAISE NOTICE '✅ Real-world pattern fixes applied';
  RAISE NOTICE '';
  RAISE NOTICE 'Added from RSS feed analysis:';
  RAISE NOTICE '   - Geographic adjectives (Finnish, Japanese, etc.)';
  RAISE NOTICE '   - Hacker News patterns (Show, Show HN)';
  RAISE NOTICE '   - Common non-company words (How To, Humans)';
  RAISE NOTICE '   - Descriptor patterns (Satellite Company, etc.)';
  RAISE NOTICE '   - Known good startups from discoveries';
  RAISE NOTICE '';
  RAISE NOTICE 'Total entities in ontology: %', total_count;
END $$;
