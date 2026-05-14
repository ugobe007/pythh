-- pythh_matches had UNIQUE (entity_id, candidate_id, trajectory_id).
-- PostgreSQL treats NULL != NULL in that constraint, so many rows with
-- trajectory_id NULL duplicated on every compute-matches run.
--
-- 1) Dedupe: keep the newest row per (entity_id, candidate_id, trajectory_id).
-- 2) Drop the three-column UNIQUE constraint.
-- 3) Enforce uniqueness with partial indexes (non-null trajectory vs null trajectory).

DELETE FROM pythh_matches p
USING (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY entity_id, candidate_id, trajectory_id
             ORDER BY matched_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM pythh_matches
  ) ranked
  WHERE ranked.rn > 1
) losers
WHERE p.id = losers.id;

ALTER TABLE pythh_matches
  DROP CONSTRAINT IF EXISTS pythh_matches_entity_id_candidate_id_trajectory_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pythh_matches_entity_candidate_traj_nn
  ON pythh_matches (entity_id, candidate_id, trajectory_id)
  WHERE trajectory_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pythh_matches_entity_candidate_traj_null
  ON pythh_matches (entity_id, candidate_id)
  WHERE trajectory_id IS NULL;
