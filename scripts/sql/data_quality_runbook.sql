-- ============================================================================
-- Data quality runbook — Phases A / B / C (SQL layer)
-- ============================================================================
-- Purpose:
--   • Phase A — Baseline counts on canonical tables (no JS dimension parity with
--     report-card-data-coverage.js; use `npm run dq:coverage:json` for that).
--   • Phase B — RSS / event volume by publisher; enrichment tier segmentation.
--   • Phase C — SLA-style ratios (computed in the last SELECT).
--
-- Run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/data_quality_runbook.sql
--   npm run dq:runbook
--
-- Requires: public.startup_uploads, public.startup_events, public.rss_sources,
--           public.investors (adjust if renamed).
-- ============================================================================
-- (statement_timeout is set by scripts/run-data-quality-runbook.js)
-- ============================================================================

-- ── Phase A + B: approved startup profile coverage (single snapshot) ─────────
WITH su AS (
  SELECT *
  FROM public.startup_uploads
  WHERE status = 'approved'
)
SELECT 'phase_a' AS phase,
       metric,
       value
FROM (
  SELECT 'approved_total' AS metric,
         COUNT(*)::bigint AS value
  FROM su
  UNION ALL
  SELECT 'has_nonempty_website',
         COUNT(*) FILTER (WHERE COALESCE(BTRIM(website), '') <> '')
  FROM su
  UNION ALL
  SELECT 'has_narrative',
         COUNT(*) FILTER (
           WHERE COALESCE(BTRIM(description), '') <> ''
              OR COALESCE(BTRIM(pitch), '') <> ''
              OR COALESCE(BTRIM(tagline), '') <> ''
         )
  FROM su
  UNION ALL
  SELECT 'has_nonempty_tagline',
         COUNT(*) FILTER (WHERE COALESCE(BTRIM(tagline), '') <> '')
  FROM su
  UNION ALL
  SELECT 'has_sectors',
         COUNT(*) FILTER (WHERE sectors IS NOT NULL AND array_length(sectors, 1) IS NOT NULL AND array_length(sectors, 1) > 0)
  FROM su
  UNION ALL
  SELECT 'has_stage', COUNT(*) FILTER (WHERE stage IS NOT NULL)
  FROM su
  UNION ALL
  SELECT 'has_extracted_data_json',
         COUNT(*) FILTER (WHERE extracted_data IS NOT NULL)
  FROM su
  UNION ALL
  SELECT 'tier_a',
         COUNT(*) FILTER (WHERE extracted_data ->> 'data_tier' = 'A')
  FROM su
  UNION ALL
  SELECT 'tier_b',
         COUNT(*) FILTER (WHERE extracted_data ->> 'data_tier' = 'B')
  FROM su
  UNION ALL
  SELECT 'needs_enrichment_approx',
         COUNT(*) FILTER (
           WHERE extracted_data IS NULL
              OR extracted_data ->> 'data_tier' IS NULL
              OR extracted_data ->> 'data_tier' = 'C'
              OR extracted_data ->> 'data_tier' NOT IN ('A', 'B')
         )
  FROM su
  UNION ALL
  SELECT 'has_total_god_score',
         COUNT(*) FILTER (WHERE total_god_score IS NOT NULL)
  FROM su
  UNION ALL
  SELECT 'has_any_funding_signal',
         COUNT(*) FILTER (
           WHERE COALESCE(BTRIM(latest_funding_round), '') <> ''
              OR latest_funding_amount IS NOT NULL
              OR COALESCE(BTRIM(lead_investor), '') <> ''
         )
  FROM su
) x
ORDER BY metric;

-- ── Phase B: startup_events volume by publisher (last 7 days) ──────────────
SELECT 'phase_b_events_7d' AS phase,
       source_publisher,
       COUNT(*)::bigint AS event_count,
       MAX(occurred_at) AS last_event_at
FROM public.startup_events
WHERE occurred_at >= (NOW() AT TIME ZONE 'utc') - INTERVAL '7 days'
GROUP BY source_publisher
ORDER BY event_count DESC, source_publisher
LIMIT 200;

-- ── Phase B: same window, 30 days (broader source health) ───────────────────
SELECT 'phase_b_events_30d' AS phase,
       source_publisher,
       COUNT(*)::bigint AS event_count,
       MAX(occurred_at) AS last_event_at
FROM public.startup_events
WHERE occurred_at >= (NOW() AT TIME ZONE 'utc') - INTERVAL '30 days'
GROUP BY source_publisher
ORDER BY event_count DESC, source_publisher
LIMIT 200;

-- ── Phase B: RSS sources registered vs activity (names may not match 1:1) ───
SELECT 'phase_b_rss_sources' AS phase,
       rs.id,
       rs.name AS rss_source_name,
       rs.active,
       rs.last_scraped,
       COALESCE(ev.cnt, 0)::bigint AS matching_events_7d
FROM public.rss_sources rs
LEFT JOIN (
  SELECT source_publisher,
         COUNT(*)::bigint AS cnt
  FROM public.startup_events
  WHERE occurred_at >= (NOW() AT TIME ZONE 'utc') - INTERVAL '7 days'
  GROUP BY source_publisher
) ev ON lower(trim(ev.source_publisher)) = lower(trim(rs.name))
ORDER BY rs.active DESC, matching_events_7d ASC, rs.name
LIMIT 500;

-- ── Phase C: SLA-style ratios (approved startups) ───────────────────────────
WITH su AS (
  SELECT *
  FROM public.startup_uploads
  WHERE status = 'approved'
),
tot AS (
  SELECT COUNT(*)::numeric AS n FROM su
)
SELECT 'phase_c_sla' AS phase,
       ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(BTRIM(website), '') <> '') / NULLIF((SELECT n FROM tot), 0), 1) AS pct_with_website,
       ROUND(
         100.0 * COUNT(*) FILTER (
           WHERE COALESCE(BTRIM(description), '') <> ''
              OR COALESCE(BTRIM(pitch), '') <> ''
              OR COALESCE(BTRIM(tagline), '') <> ''
         ) / NULLIF((SELECT n FROM tot), 0),
         1
       ) AS pct_with_narrative,
       ROUND(100.0 * COUNT(*) FILTER (WHERE extracted_data ->> 'data_tier' IN ('A', 'B')) / NULLIF((SELECT n FROM tot), 0), 1) AS pct_tier_a_or_b,
       (SELECT n FROM tot)::bigint AS denominator_approved
FROM su;

-- ── Phase D: Investors (thin profile quick scan) ─────────────────────────────
-- Separate section so poolers run one statement per round-trip (Phase C was empty otherwise).
SELECT 'phase_investors' AS phase,
       COUNT(*)::bigint AS investor_total,
       COUNT(*) FILTER (
         WHERE COALESCE(LENGTH(BTRIM(COALESCE(bio, ''))), 0) > 50
            OR COALESCE(LENGTH(BTRIM(COALESCE(investment_thesis, ''))), 0) > 20
       )::bigint AS investor_with_substantive_text
FROM public.investors;
