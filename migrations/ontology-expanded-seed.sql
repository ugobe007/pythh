-- Expanded Ontology Seed Data
-- Adds 200+ more entities to improve parser accuracy

-- ============================================
-- INVESTORS (Tier 1)
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  -- Top-tier VCs
  ('Sequoia Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Andreessen Horowitz', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('a16z', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Y Combinator', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('YC', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Google Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('GV', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Accel', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Kleiner Perkins', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('General Catalyst', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Lightspeed', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Lightspeed Venture Partners', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Greylock', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Greylock Partners', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Benchmark', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Index Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Insight Partners', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Tiger Global', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Coatue', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Founders Fund', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('NEA', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('New Enterprise Associates', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Bessemer', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Bessemer Venture Partners', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Battery Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Khosla Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Menlo Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Spark Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('First Round', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('First Round Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Felicis', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Felicis Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Lowercase Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('SV Angel', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Initialized Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('CRV', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Charles River Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Thrive Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Ribbit Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Lux Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Union Square Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('USV', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Redpoint', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Redpoint Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Social Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('True Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Canaan Partners', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Emergence Capital', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Wing', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Wing VC', 'INVESTOR', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- GENERIC TERMS (Tier 1) - NOT concrete entities
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  -- People categories
  ('Researchers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Scientists', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Engineers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Developers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Founders', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Entrepreneurs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Investors', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('VCs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Venture Capitalists', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Angels', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Angel Investors', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Executives', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('CEOs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Leaders', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Teams', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('People', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Experts', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Professionals', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Officials', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Alumni', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Veterans', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Former Executives', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- Company categories
  ('Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Companies', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Firms', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Businesses', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Unicorns', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('SMEs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('SMBs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Enterprises', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Corporations', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- With adjectives
  ('MIT Researchers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Stanford Researchers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Harvard Scientists', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Cambridge Researchers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Berkeley Engineers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Indian Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Chinese Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('European Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Asian Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Tech Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('AI Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Fintech Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Big VCs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Top VCs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Leading VCs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Major VCs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Top Investors', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Big Investors', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Leading Investors', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- Institutional/Government
  ('Former USDS Leaders', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Ex-NASA Engineers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Pentagon Officials', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('CIA Veterans', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('FBI Agents', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('White House Staff', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Government Officials', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  
  -- Financial terms
  ('IPO', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('IPO Market', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Public Markets', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Series A', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Series B', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Series C', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Seed Round', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Growth Round', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Funding Round', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('VC Funding', 'GENERIC_TERM', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- PLACES (Tier 1)
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  -- Continents
  ('Africa', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Asia', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Europe', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('North America', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('South America', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Australia', 'PLACE', 1.0, 'MANUAL_SEED'),
  
  -- Countries
  ('USA', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('United States', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('UK', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('United Kingdom', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('India', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('China', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Japan', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Germany', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('France', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Canada', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Brazil', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Israel', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Singapore', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('South Korea', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Mexico', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Spain', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Italy', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Netherlands', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Sweden', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Switzerland', 'PLACE', 1.0, 'MANUAL_SEED'),
  
  -- Tech hubs / Cities
  ('Silicon Valley', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Bay Area', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('San Francisco', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('New York', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('London', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Berlin', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Paris', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Tel Aviv', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Bangalore', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Beijing', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Shanghai', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Tokyo', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Seoul', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Austin', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Seattle', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Boston', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Los Angeles', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Miami', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Denver', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Amsterdam', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Stockholm', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Dublin', 'PLACE', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- AMBIGUOUS (Tier 1) - Need context
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source, metadata) VALUES
  ('Washington', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["person", "place", "investor"]}'),
  ('Apple', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "fruit"], "likely": "startup"}'),
  ('Google', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "investor"], "likely": "startup"}'),
  ('Meta', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "investor"], "likely": "startup"}'),
  ('Amazon', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "investor"], "likely": "startup"}'),
  ('Microsoft', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "investor"], "likely": "startup"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- KNOWN STARTUPS (Tier 1) - High confidence
-- ============================================

INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Stripe', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Figma', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Notion', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Canva', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Databricks', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Anthropic', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('OpenAI', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Waymo', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Cruise', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Rivian', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('SpaceX', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Coinbase', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Robinhood', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Plaid', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Ramp', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Brex', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Scale AI', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Instacart', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('DoorDash', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Airbnb', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Uber', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Lyft', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Zoom', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Slack', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Dropbox', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('GitHub', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('GitLab', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Retool', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Airtable', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Asana', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Monday', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Linear', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Vercel', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Supabase', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Netlify', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Webflow', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Shopify', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Square', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Snowflake', 'STARTUP', 1.0, 'MANUAL_SEED'),
  ('Palantir', 'STARTUP', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- ============================================
-- Summary
-- ============================================

DO $$
DECLARE
  investor_count INT;
  generic_count INT;
  place_count INT;
  startup_count INT;
  ambiguous_count INT;
BEGIN
  SELECT COUNT(*) INTO investor_count FROM entity_ontologies WHERE entity_type = 'INVESTOR';
  SELECT COUNT(*) INTO generic_count FROM entity_ontologies WHERE entity_type = 'GENERIC_TERM';
  SELECT COUNT(*) INTO place_count FROM entity_ontologies WHERE entity_type = 'PLACE';
  SELECT COUNT(*) INTO startup_count FROM entity_ontologies WHERE entity_type = 'STARTUP';
  SELECT COUNT(*) INTO ambiguous_count FROM entity_ontologies WHERE entity_type = 'AMBIGUOUS';
  
  RAISE NOTICE '✅ Ontology Seed Complete';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Entity Counts:';
  RAISE NOTICE '   - INVESTOR: %', investor_count;
  RAISE NOTICE '   - GENERIC_TERM: %', generic_count;
  RAISE NOTICE '   - PLACE: %', place_count;
  RAISE NOTICE '   - STARTUP: %', startup_count;
  RAISE NOTICE '   - AMBIGUOUS: %', ambiguous_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Total: % entities in ontology database', investor_count + generic_count + place_count + startup_count + ambiguous_count;
END $$;
