-- ============================================================================
-- COMMITMENT WIZARD TABLES
-- Founder gap-closing loop: task acknowledgements + provisional commitment docs
-- ============================================================================

-- Commitment tasks: one row per gap/action the founder acknowledges
CREATE TABLE IF NOT EXISTS founder_commitment_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Gap classification
  component text NOT NULL CHECK (component IN ('team','traction','market','product','vision')),
  task_key text NOT NULL,   -- e.g. 'add_technical_cofounder'

  -- Task content (may be overridden from TASK_CATALOG defaults at insert time)
  title text NOT NULL,
  description text,
  impact_points int,        -- estimated GOD score impact (shown in UI)
  proof_type text CHECK (proof_type IN ('text','names_list','count','url')),
  priority int NOT NULL DEFAULT 1,

  -- Lifecycle
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','acknowledged','in_progress','completed','skipped')),
  acknowledged_at timestamptz,
  deadline timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,

  -- Proof submitted by founder
  proof_data jsonb,         -- { names:[], count:N, url:'', notes:'' }

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (startup_id, task_key)
);

-- Commitment documents: versioned readiness/investment memo snapshots
CREATE TABLE IF NOT EXISTS commitment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,

  -- Provisional until enough tasks are proved
  is_provisional boolean NOT NULL DEFAULT true,

  -- Snapshots at generation time
  god_snapshot jsonb,       -- { total, team, traction, market, product, vision }
  tasks_snapshot jsonb,     -- array of { task_key, title, deadline, status, proof_data }

  -- Structured document content (see plan for full schema)
  content jsonb NOT NULL,

  generated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_commitment_tasks_startup ON founder_commitment_tasks(startup_id);
CREATE INDEX IF NOT EXISTS idx_commitment_tasks_status ON founder_commitment_tasks(startup_id, status);
CREATE INDEX IF NOT EXISTS idx_commitment_docs_startup ON commitment_documents(startup_id, generated_at DESC);

-- ── Updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at_commitment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commitment_tasks_updated_at
  BEFORE UPDATE ON founder_commitment_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_commitment();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE founder_commitment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_documents ENABLE ROW LEVEL SECURITY;

-- Founders can only see/modify their own startup's tasks
CREATE POLICY "founder_commitment_tasks_owner"
  ON founder_commitment_tasks
  FOR ALL
  USING (
    user_id = auth.uid()
    OR startup_id IN (
      SELECT id FROM startup_uploads WHERE submitted_by = auth.uid()
    )
  );

-- Service role bypasses RLS (for server-side operations)
CREATE POLICY "commitment_tasks_service_role"
  ON founder_commitment_tasks
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "commitment_documents_owner"
  ON commitment_documents
  FOR ALL
  USING (
    startup_id IN (
      SELECT id FROM startup_uploads WHERE submitted_by = auth.uid()
    )
  );

CREATE POLICY "commitment_documents_service_role"
  ON commitment_documents
  FOR ALL
  TO service_role
  USING (true);
