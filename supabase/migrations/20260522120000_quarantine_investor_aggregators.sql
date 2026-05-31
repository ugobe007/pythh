-- Quarantine directories / data sources misclassified as investors (e.g. VC Sheet)

UPDATE investors
SET status = 'inactive',
    entity_gate = 'junk',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%vc sheet%'
   OR LOWER(firm) LIKE '%vc sheet%'
   OR LOWER(name) IN (
     'crunchbase', 'angellist', 'pitchbook', 'vc list',
     'investor database', 'investor directory'
   )
   OR LOWER(firm) IN ('crunchbase', 'angellist', 'pitchbook');

DELETE FROM startup_investor_matches
WHERE investor_id IN (
  SELECT id FROM investors
  WHERE status = 'inactive'
    AND entity_gate = 'junk'
    AND (
      LOWER(name) LIKE '%vc sheet%'
      OR LOWER(firm) LIKE '%vc sheet%'
      OR LOWER(name) IN (
        'crunchbase', 'angellist', 'pitchbook', 'vc list',
        'investor database', 'investor directory'
      )
    )
);
