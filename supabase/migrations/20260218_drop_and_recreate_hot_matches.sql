-- ============================================================================
-- STEP 1: DROP OLD FUNCTIONS (to clear cached bytecode)
-- ============================================================================

DROP FUNCTION IF EXISTS get_hot_matches(INT, INT);
DROP FUNCTION IF EXISTS get_sector_heat_map(INT);
DROP FUNCTION IF EXISTS get_platform_velocity();

-- ============================================================================
-- STEP 2: RECREATE WITH FIXED SIGNATURES
-- ============================================================================

-- (The full SQL from get_hot_matches.sql will go here)
-- Copy and paste the ENTIRE get_hot_matches.sql content below this line
