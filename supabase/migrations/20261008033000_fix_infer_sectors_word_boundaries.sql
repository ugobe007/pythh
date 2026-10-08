-- infer_sectors_from_text stamped Gaming on almost every news headline.
-- The Gaming clause was an unanchored regex: (gaming|game|...|vr|ar|...).
-- "startup" contains "ar", so "Legal Services Startup Teddy AI" became Gaming.
-- Climate Tech had the same bug: bare "ev" matches inside "revenue" and "developer",
-- and bare "wind" matches inside "window". PropTech's "building" matched the verb.
--
-- Called by auto_approve_startup() on every discovered_startups insert
-- (trigger auto_process_discovery_trigger). The result is startup_uploads.sectors.

CREATE OR REPLACE FUNCTION public.infer_sectors_from_text(p_text text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_sectors text[] := '{}';
  v_text_lower text;
BEGIN
  IF p_text IS NULL THEN RETURN v_sectors; END IF;
  v_text_lower := lower(p_text);

  -- AI/ML
  IF v_text_lower ~ '(artificial intelligence|machine learning|deep learning|neural|llm|gpt|chatbot|nlp|computer vision|ai-powered|ai platform|generative ai)' THEN
    v_sectors := array_append(v_sectors, 'AI/ML');
  END IF;

  -- Fintech
  IF v_text_lower ~ '(fintech|banking|payment|lending|crypto|blockchain|defi|neobank|insurtech|trading|financial services|credit|loan)' THEN
    v_sectors := array_append(v_sectors, 'Fintech');
  END IF;

  -- Healthcare
  IF v_text_lower ~ '(health|medical|biotech|pharma|telemedicine|clinical|patient|hospital|diagnostic|therapeut|drug|healthcare)' THEN
    v_sectors := array_append(v_sectors, 'Healthcare');
  END IF;

  -- SaaS
  IF v_text_lower ~ '(saas|software as a service|b2b software|enterprise software|cloud platform|subscription|crm|erp|workflow)' THEN
    v_sectors := array_append(v_sectors, 'SaaS');
  END IF;

  -- E-commerce
  IF v_text_lower ~ '(ecommerce|e-commerce|marketplace|retail|shopping|online store|dtc|direct.to.consumer|shopify)' THEN
    v_sectors := array_append(v_sectors, 'E-commerce');
  END IF;

  -- Climate Tech. Short tokens are whole words so "revenue" / "developer" / "window" do not match.
  -- sector:Climate Tech
  IF v_text_lower ~ '(\mclimate\M|\mcleantech\M|\mclean tech\M|\mrenewable\M|\msolar\M|\mcarbon\M|\msustainability\M|\mbattery\M|\menergy storage\M|\m(ev|evs|green|wind)\M|\melectric vehicles?\M)' THEN
    v_sectors := array_append(v_sectors, 'Climate Tech');
  END IF;

  -- EdTech
  IF v_text_lower ~ '(edtech|education|learning|school|university|student|course|training|tutoring|e-learning)' THEN
    v_sectors := array_append(v_sectors, 'EdTech');
  END IF;

  -- Cybersecurity
  IF v_text_lower ~ '(security|cybersecurity|infosec|encryption|authentication|identity|privacy|compliance|fraud)' THEN
    v_sectors := array_append(v_sectors, 'Cybersecurity');
  END IF;

  -- Developer Tools
  IF v_text_lower ~ '(developer|devops|api|sdk|infrastructure|devtools|code|programming|github|gitlab|ci/cd)' THEN
    v_sectors := array_append(v_sectors, 'Developer Tools');
  END IF;

  -- PropTech. "building" was the verb in "building an AI agent", not construction.
  -- sector:PropTech
  IF v_text_lower ~ '(\mproptech\M|\mreal estate\M|\mpropert(y|ies)\M|\mhousing\M|\mmortgage\M|\mrental\M|\mconstruction\M)' THEN
    v_sectors := array_append(v_sectors, 'PropTech');
  END IF;

  -- FoodTech
  IF v_text_lower ~ '(food|restaurant|delivery|meal|grocery|agriculture|farming|agtech|foodtech)' THEN
    v_sectors := array_append(v_sectors, 'FoodTech');
  END IF;

  -- Logistics
  IF v_text_lower ~ '(logistics|supply chain|shipping|freight|warehouse|delivery|fleet|transportation)' THEN
    v_sectors := array_append(v_sectors, 'Logistics');
  END IF;

  -- HR Tech
  IF v_text_lower ~ '(hr tech|human resources|recruiting|hiring|talent|workforce|payroll|benefits|employee)' THEN
    v_sectors := array_append(v_sectors, 'HR Tech');
  END IF;

  -- Gaming. Whole words only. "ar" inside "startup" is not AR.
  -- sector:Gaming
  IF v_text_lower ~ '(\mgaming\M|\mgames\M|\mgame\M|\mesports\M|\mmetaverse\M|\m(vr|ar)\M|\mvirtual reality\M|\maugmented reality\M)' THEN
    v_sectors := array_append(v_sectors, 'Gaming');
  END IF;

  -- Media/Entertainment
  IF v_text_lower ~ '(media|entertainment|streaming|video|music|content|creator|social|podcast)' THEN
    v_sectors := array_append(v_sectors, 'Media');
  END IF;

  -- Consumer
  IF v_text_lower ~ '(consumer|lifestyle|wellness|fitness|beauty|fashion|travel|booking)' THEN
    v_sectors := array_append(v_sectors, 'Consumer');
  END IF;

  -- Default if nothing matched
  IF array_length(v_sectors, 1) IS NULL THEN
    v_sectors := ARRAY['Technology'];
  END IF;

  RETURN v_sectors;
END;
$function$;
