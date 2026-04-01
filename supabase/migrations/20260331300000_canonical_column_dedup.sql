-- ═══════════════════════════════════════════════════════════════════════════════
-- CANONICAL COLUMN DEDUPLICATION
-- Migrated: 2026-03-31
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROBLEM: startup_uploads has accumulated duplicate columns for the same concept,
-- written by different scripts at different times. Downstream pipelines read one
-- canonical column name, but data is split across aliases.
--
-- DESIGN RULE (enforced from this migration forward):
--   No aliases. One canonical column per concept. Scrapers write to that column.
--   JSONB blobs (extracted_data, startup_metrics) are for raw provenance only.
--
-- WHAT THIS MIGRATION DOES:
--   1. Promotes arr       → arr_usd       (where arr_usd IS NULL AND arr > 0)
--   2. Promotes revenue_annual → revenue_usd (where revenue_usd IS NULL AND revenue_annual > 0)
--
--   Columns arr and revenue_annual are NOT dropped here — they remain for read
--   compatibility while existing code is updated. A follow-up migration will
--   DROP them after all writers are updated to target the canonical columns.
--
-- WHAT promote-extracted-fields.js DOES (companion script, run separately):
--   - startup_metrics.best_mentions.last_round_amount.amount_usd → latest_funding_amount
--   - extracted_data.funding_amount (JSONB object) → latest_funding_amount
--   - extracted_data.growth_rate → growth_rate
--   - extracted_data.customer_count → customer_count
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. arr → arr_usd ─────────────────────────────────────────────────────────
-- `arr` is the legacy column; `arr_usd` (explicit currency) is canonical.
-- Promote where arr_usd is still null and arr has a value.

UPDATE public.startup_uploads
SET arr_usd = arr
WHERE arr_usd IS NULL
  AND arr IS NOT NULL
  AND arr > 0
  AND arr <= 2147483647;  -- PG INT4 max — guards against bigint overflow

-- ── 2. revenue_annual → revenue_usd ──────────────────────────────────────────
-- `revenue_annual` predates the USD-suffixed naming convention.
-- `revenue_usd` is the canonical name (consistent with arr_usd, total_funding_usd).

UPDATE public.startup_uploads
SET revenue_usd = revenue_annual
WHERE revenue_usd IS NULL
  AND revenue_annual IS NOT NULL
  AND revenue_annual > 0
  AND revenue_annual <= 2147483647;

-- ── 3. Comment legacy columns as deprecated ───────────────────────────────────
-- These stay in place until all writers are migrated.
-- A future migration will ALTER COLUMN ... DROP and update any views.

COMMENT ON COLUMN public.startup_uploads.arr IS
  'DEPRECATED — use arr_usd. Will be dropped after all writers are migrated.';

COMMENT ON COLUMN public.startup_uploads.revenue_annual IS
  'DEPRECATED — use revenue_usd. Will be dropped after all writers are migrated.';

-- ── 4. Indexes for signal pipeline metric queries ─────────────────────────────
-- Column types vary — apply appropriate predicate per actual Postgres type:
--   arr_usd, revenue_usd  → NUMERIC/BIGINT → numeric > 0 comparison works
--   latest_funding_amount → TEXT           → use IS NOT NULL only (no integer cast)
--   growth_rate           → TEXT           → use IS NOT NULL only

-- Numeric columns — safe to use > 0
CREATE INDEX IF NOT EXISTS idx_startup_uploads_arr_usd
  ON public.startup_uploads (arr_usd)
  WHERE arr_usd IS NOT NULL AND arr_usd > 0;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_revenue_usd
  ON public.startup_uploads (revenue_usd)
  WHERE revenue_usd IS NOT NULL AND revenue_usd > 0;

-- TEXT columns — IS NOT NULL is sufficient; promotion script only writes non-zero values
CREATE INDEX IF NOT EXISTS idx_startup_uploads_latest_funding
  ON public.startup_uploads (latest_funding_amount)
  WHERE latest_funding_amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_growth_rate
  ON public.startup_uploads (growth_rate)
  WHERE growth_rate IS NOT NULL;
