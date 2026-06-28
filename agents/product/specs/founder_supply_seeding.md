# Spec — `founder_supply_seeding`: Funnel event observability + startup_events capture

> Instrumentation-first. Promoted from research finding **F-2026-0622-10** (high, validated):
> `startup_events` returned 0 rows over 7d and `ai_logs.by_operation = {}`. Two P0 items
> (`match_engagement_instrumentation`, `instant_matches_gate`) are marked **shipped** yet emit
> **zero** events. We cannot ship or measure anything downstream until we know whether the funnel
> is empty from **no traffic** or **no logging**.

## Problem

Every user-side metric is zero and we cannot tell why:

| Signal | Value (7d) | Source |
|--------|-----------|--------|
| signups_per_day | 0 (`by_operation={}`) | ai_logs |
| growth_event_count | 1 (one `investor_signup_started`) | growth_experiment_events |
| startup_events sampled | 0 rows | internal DB (F-10) |
| matches viewed / intro / contacted | 0 / 0 / 0 (of 3.73M) | matches table |

Meanwhile pipeline inventory is healthy (23,736 approved startups, 7,604 investors, 3.73M suggested
matches). The bottleneck is **not data supply — it is event capture**. Because the funnel is blind,
the two running growth experiments (`founder_hero_entry`, `investor_signup_schema`) and the shipped
engagement API are **unmeasurable**: any variant decision today would be made on noise.

## Target user

Internal — Product, Growth, and Pipeline agents (the decision-makers). Indirectly unblocks every
founder/investor surface, because nothing downstream can be optimized while metrics are blind.

## Success metric

| Metric | Baseline | Target | Window |
|--------|----------|--------|--------|
| Funnel stages emitting ≥1 event when exercised | unknown (0 observed) | 5/5 stages verified | 48h after deploy |
| traffic-vs-logging question resolved | open (F-10) | answered with evidence | this cycle |
| `startup_events` rows per preview request | 0 | 1 (`preview_requested`) | 7d after wire |
| Funnel heartbeat present in product snapshot | absent | present (per-stage counts) | next snapshot |

## Hypothesis

The funnel is **under-instrumented, not un-trafficked**: synthetic traffic through the live preview
and engage endpoints will produce zero rows, proving a logging gap. A single end-to-end **funnel
heartbeat** + `startup_events` write on every preview request will (a) disambiguate the two failure
modes in 48h and (b) populate the match-engine inventory the investor digest depends on.

## MVP scope (≤1 week)

- [ ] **Synthetic probe (day 1, ops-only, no code):** drive one real request through each live stage —
      `/matches?url=` (preview), `POST /api/matches/engage` (view+intro), investor signup start — and
      query whether each wrote a row. This alone answers traffic-vs-logging.
- [ ] **Funnel heartbeat in metrics snapshot:** extend `scripts/product-metrics-snapshot.mjs` to emit a
      `funnel` block with per-stage 7d counts: `page_view → url_submitted → preview_requested →
      instant_matches_viewed → engage → signup_started → signup_completed`. Zero with known synthetic
      traffic = logging gap; zero with confirmed real visits = acquisition gap.
- [ ] **`startup_events` write on preview:** emit a `preview_requested` event (startup_url, resolved
      startup_id, ts, source variant) on every `/matches?url=` and `/matches/preview/:id` request.
      This is the `founder_supply_seeding` core — it seeds inventory for the investor digest.
- [ ] **Patch the gap the probe finds:** wire whichever stage(s) are silent (most likely engage events
      from the preview surface, per pipeline learning `engagement_blind`).

## Out of scope

- New founder/investor features (thesis_fit_explainer, capital_type_router, sector_heat_badge) — gated
  behind a measurable funnel.
- Acquisition / paid traffic. If the probe proves traffic exists and logging works, *then* acquisition
  becomes the next P0 — but that is a separate decision.
- Changing match ranking or GOD scoring.

## Dependencies

- Read access to `ai_logs`, `growth_experiment_events`, `startup_events`, `matches`.
- `POST /api/matches/engage` already live (per pipeline learning `engagement_blind`).
- Pipeline Agent owns the `startup_events` schema write (handoff).

## Files / surfaces to touch

- `scripts/product-metrics-snapshot.mjs` — add `funnel` heartbeat block.
- Preview route handlers (`/matches?url=`, `/matches/preview/:id`) — emit `preview_requested` to `startup_events`.
- Preview + match UI surfaces (`site/`) — confirm `engage` view/intro fire.
- `server/lib/growthExperiments` — verify event write path is reached.

## Rollout & measurement

1. Day 1: run synthetic probe; record per-stage row presence in the next product report.
2. Deploy heartbeat + `preview_requested` write behind no flag (read-only additive logging).
3. 48h: re-read snapshot `funnel` block. Branch:
   - **Logging gap** (synthetic traffic, zero rows) → fix instrumentation, keep features frozen.
   - **Acquisition gap** (logging verified, zero real traffic) → escalate `instant_match_preview`
     awareness/acquisition to P0 for Growth.
4. 7d: confirm `startup_events` accrues ≥1 row per preview; hand inventory to `investor_dealflow_digest`.

## Open questions

- Is `/api/matches/engage` reachable from the deployed preview surface, or only the authed app?
- Does `growth_experiment_events` require `growth:sync-registry` to have run for events to attribute?
- Are there CDN/edge caches serving `/matches?url=` without hitting the logging handler?
