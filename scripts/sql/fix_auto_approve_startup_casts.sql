-- Fix latent type-cast bugs in auto_approve_startup().
-- discovered_startups.funding_amount (text) -> startup_uploads.latest_funding_amount (bigint)
-- discovered_startups.growth_rate   (text) -> startup_uploads.growth_rate (numeric)
-- Both were assigned without a cast, so the trigger raised
-- "column ... is of type bigint/numeric but expression is of type text"
-- for ANY discovered row that met auto-approval criteria (i.e. had sectors).
-- Safe casts: pure-numeric strings cast; anything else (or null) -> NULL.

CREATE OR REPLACE FUNCTION public.auto_approve_startup(p_discovered_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_discovered RECORD;
  v_new_id uuid;
  v_god_score numeric;
  v_desc_lower text;
  v_name_lower text;
  v_sectors text[];
BEGIN
  SELECT * INTO v_discovered FROM discovered_startups WHERE id = p_discovered_id;

  IF NOT FOUND OR v_discovered.imported_to_startups = true THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM startup_uploads WHERE lower(name) = lower(v_discovered.name)) THEN
    UPDATE discovered_startups SET imported_to_startups = true, imported_at = NOW() WHERE id = p_discovered_id;
    RETURN NULL;
  END IF;

  v_desc_lower := lower(COALESCE(v_discovered.description, '') || ' ' || COALESCE(v_discovered.article_title, ''));
  v_name_lower := lower(COALESCE(v_discovered.name, ''));

  v_sectors := infer_sectors_from_text(v_desc_lower || ' ' || v_name_lower);
  IF v_sectors IS NULL OR array_length(v_sectors, 1) IS NULL THEN
    v_sectors := v_discovered.sectors;
  END IF;

  v_god_score := 50;

  IF length(v_discovered.description) > 300 THEN v_god_score := v_god_score + 10;
  ELSIF length(v_discovered.description) > 150 THEN v_god_score := v_god_score + 5;
  ELSIF length(v_discovered.description) > 80 THEN v_god_score := v_god_score + 2;
  END IF;

  IF v_discovered.funding_amount IS NOT NULL AND v_discovered.funding_amount != '' THEN
    v_god_score := v_god_score + 8;
    IF v_discovered.funding_amount ILIKE '%million%' OR v_discovered.funding_amount ~ '\d+[Mm]' THEN
      v_god_score := v_god_score + 7;
    END IF;
  END IF;
  IF v_discovered.funding_stage IS NOT NULL AND v_discovered.funding_stage != '' THEN
    v_god_score := v_god_score + 3;
  END IF;
  IF v_discovered.lead_investor IS NOT NULL THEN v_god_score := v_god_score + 5; END IF;

  IF v_desc_lower ~ '(revenue|profitable|customers|users|clients|paying|growth|traction)' THEN
    v_god_score := v_god_score + 5;
  END IF;
  IF v_desc_lower ~ '(\d+k|\d+m|\d+ million|\d+ thousand|\d+% growth|10x|100x)' THEN
    v_god_score := v_god_score + 5;
  END IF;
  IF v_discovered.has_revenue = true THEN v_god_score := v_god_score + 5; END IF;
  IF v_discovered.has_customers = true THEN v_god_score := v_god_score + 3; END IF;

  IF v_discovered.has_technical_cofounder = true THEN v_god_score := v_god_score + 5; END IF;
  IF v_desc_lower ~ '(ex-google|ex-meta|ex-apple|ex-amazon|stanford|mit|harvard|y combinator|yc|techstars|500 startups)' THEN
    v_god_score := v_god_score + 8;
  END IF;
  IF v_discovered.founders IS NOT NULL AND array_length(v_discovered.founders, 1) >= 2 THEN
    v_god_score := v_god_score + 3;
  END IF;

  IF v_discovered.is_launched = true THEN v_god_score := v_god_score + 5; END IF;
  IF v_desc_lower ~ '(patent|proprietary|ai|machine learning|blockchain|enterprise|saas|platform)' THEN
    v_god_score := v_god_score + 3;
  END IF;

  IF v_sectors IS NOT NULL AND (
    v_sectors && ARRAY['AI', 'Artificial Intelligence', 'Machine Learning', 'FinTech', 'Climate Tech', 'Healthcare', 'Cybersecurity', 'Defense Tech']
  ) THEN
    v_god_score := v_god_score + 5;
  END IF;

  IF v_name_lower ~ '^(the |a |an |my )' THEN v_god_score := v_god_score - 3; END IF;
  IF length(v_discovered.name) < 3 OR length(v_discovered.name) > 50 THEN v_god_score := v_god_score - 5; END IF;
  IF v_desc_lower ~ '(scam|ponzi|get rich|mlm|pyramid)' THEN v_god_score := v_god_score - 15; END IF;

  v_god_score := GREATEST(40, LEAST(v_god_score, 90));

  INSERT INTO startup_uploads (
    name, description, sectors, stage, latest_funding_round, latest_funding_amount,
    source_type, status, total_god_score,
    team_score, traction_score, market_score, product_score, vision_score,
    created_at, source_url, website,
    has_revenue, is_launched, has_technical_cofounder, lead_investor,
    problem_severity, problem_keywords, team_signals, grit_signals,
    execution_signals, credential_signals, founders, growth_rate, has_customers
  ) VALUES (
    v_discovered.name, v_discovered.description, v_sectors,
    CASE
      WHEN v_discovered.funding_stage ILIKE '%seed%' THEN 1
      WHEN v_discovered.funding_stage ILIKE '%pre-seed%' THEN 0
      WHEN v_discovered.funding_stage ILIKE '%series a%' THEN 2
      WHEN v_discovered.funding_stage ILIKE '%series b%' THEN 3
      WHEN v_discovered.funding_stage ILIKE '%series c%' THEN 4
      ELSE 1
    END,
    v_discovered.funding_stage,
    CASE WHEN v_discovered.funding_amount ~ '^[0-9]+$' THEN v_discovered.funding_amount::bigint ELSE NULL END,
    'url',
    'approved', v_god_score,
    (v_god_score * 0.20)::int,
    (v_god_score * 0.25)::int,
    (v_god_score * 0.20)::int,
    (v_god_score * 0.20)::int,
    (v_god_score * 0.15)::int,
    NOW(), v_discovered.article_url, v_discovered.website,
    v_discovered.has_revenue, v_discovered.is_launched, v_discovered.has_technical_cofounder,
    v_discovered.lead_investor, v_discovered.problem_severity, v_discovered.problem_keywords,
    v_discovered.team_signals, v_discovered.grit_signals, v_discovered.execution_signals,
    v_discovered.credential_signals, v_discovered.founders,
    CASE WHEN v_discovered.growth_rate ~ '^[0-9]+(\.[0-9]+)?$' THEN v_discovered.growth_rate::numeric ELSE NULL END,
    v_discovered.has_customers
  )
  RETURNING id INTO v_new_id;

  UPDATE discovered_startups
  SET imported_to_startups = true, imported_at = NOW(), startup_id = v_new_id, approved_at = NOW()
  WHERE id = p_discovered_id;

  RETURN v_new_id;
END;
$function$;
