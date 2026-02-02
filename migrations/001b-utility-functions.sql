-- ====================================================================
-- PART 2: UTILITY FUNCTIONS (Run after Part 1)
-- ====================================================================

-- URL canonicalization
CREATE OR REPLACE FUNCTION canonicalize_url(input_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF input_url IS NULL OR input_url = '' THEN
    RETURN NULL;
  END IF;
  
  cleaned := lower(trim(input_url));
  cleaned := regexp_replace(cleaned, '^https?://', '', 'i');
  cleaned := regexp_replace(cleaned, '^www\.', '', 'i');
  cleaned := regexp_replace(cleaned, '/$', '');
  cleaned := regexp_replace(cleaned, '[?#].*$', '');
  
  RETURN cleaned;
END;
$$;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER match_runs_updated_at
  BEFORE UPDATE ON match_runs
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- Release expired leases
CREATE OR REPLACE FUNCTION release_expired_leases()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_released_count int;
BEGIN
  UPDATE match_runs
  SET
    status = 'queued',
    locked_by = NULL,
    lock_expires_at = NULL,
    updated_at = now()
  WHERE status = 'processing'
    AND lock_expires_at < now();
  
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count;
END;
$$;
