-- Check what's currently deployed
SELECT pg_get_functiondef('get_hot_matches(integer,integer)'::regprocedure);
