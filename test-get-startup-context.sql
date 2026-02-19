-- Test the get_startup_context function directly
-- This will show any SQL errors that might be causing the 400

SELECT public.get_startup_context('ed90628e-8e95-4961-8e67-996089af934a'::uuid);
