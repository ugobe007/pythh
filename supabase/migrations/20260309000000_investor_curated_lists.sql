-- =============================================================================
-- INVESTOR LOOKUP: Curated lists (VCs build portfolios from PYTHH startups)
-- =============================================================================

-- Lists owned by investor session or user
CREATE TABLE IF NOT EXISTS investor_curated_lists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   TEXT NOT NULL,   -- session id, api key id, or auth user uuid
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_curated_lists_owner
  ON investor_curated_lists(owner_id);

-- Items: startups saved to a list
CREATE TABLE IF NOT EXISTS investor_curated_list_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID NOT NULL REFERENCES investor_curated_lists(id) ON DELETE CASCADE,
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  notes      TEXT,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(list_id, startup_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_curated_list_items_list
  ON investor_curated_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_investor_curated_list_items_startup
  ON investor_curated_list_items(startup_id);

-- RLS: allow service_role full access; anon can read/write by owner_id (enforced in app)
ALTER TABLE investor_curated_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_curated_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_lists_select ON investor_curated_lists;
DROP POLICY IF EXISTS investor_lists_insert ON investor_curated_lists;
DROP POLICY IF EXISTS investor_lists_update ON investor_curated_lists;
DROP POLICY IF EXISTS investor_lists_delete ON investor_curated_lists;
CREATE POLICY investor_lists_select ON investor_curated_lists FOR SELECT USING (true);
CREATE POLICY investor_lists_insert ON investor_curated_lists FOR INSERT WITH CHECK (true);
CREATE POLICY investor_lists_update ON investor_curated_lists FOR UPDATE USING (true);
CREATE POLICY investor_lists_delete ON investor_curated_lists FOR DELETE USING (true);

DROP POLICY IF EXISTS investor_items_select ON investor_curated_list_items;
DROP POLICY IF EXISTS investor_items_insert ON investor_curated_list_items;
DROP POLICY IF EXISTS investor_items_delete ON investor_curated_list_items;
CREATE POLICY investor_items_select ON investor_curated_list_items FOR SELECT USING (true);
CREATE POLICY investor_items_insert ON investor_curated_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY investor_items_delete ON investor_curated_list_items FOR DELETE USING (true);

-- updated_at trigger for lists
CREATE OR REPLACE FUNCTION update_investor_curated_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_investor_curated_list_updated_at ON investor_curated_lists;
CREATE TRIGGER trg_investor_curated_list_updated_at
  BEFORE UPDATE ON investor_curated_lists
  FOR EACH ROW EXECUTE FUNCTION update_investor_curated_list_updated_at();
