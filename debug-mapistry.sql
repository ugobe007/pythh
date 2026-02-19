-- Debug query for Mapistry startup
-- Run this in Supabase SQL Editor to see what data exists

SELECT 
  id,
  name,
  website,
  tagline,
  description,
  pitch,
  stage,
  sectors,
  extracted_data,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score
FROM public.startup_uploads
WHERE id = 'ed90628e-8e95-4961-8e67-996089af934a';

-- Also check if startup_signal_scores exists
SELECT *
FROM public.startup_signal_scores
WHERE startup_id = 'ed90628e-8e95-4961-8e67-996089af934a';
