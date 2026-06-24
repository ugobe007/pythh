# Spec — `preview_to_signup_conversion`: Close the preview→signup leak

> Promoted from research finding **F-2026-0623-11** (high, validated internal funnel data).
> Last cycle (`founder_supply_seeding`) fixed the blindness: the funnel now emits events
> end-to-end (`funnel_blind: false`, heartbeat green, preview path returns 172 matches against
> prod). With the lights on, the data is unambiguous: **founders reach the value moment and then
> leave.** The binding constraint has moved from "no traffic" to "traffic that won't convert,"
> and closing it costs **zero acquisition spend.**

## Problem

Founders arrive, hit the instant-match value moment, and **none create an account.**

| Stage (7d window) | Count | Source |
|-------------------|-------|--------|
| page_view | 9 | ai_logs |
| url_submitted | 32 | ai_logs |
| preview_requested | 39 | ai_logs |
| instant_matches_viewed | 9 | ai_logs |
| match_viewed | 10 | ai_logs |
| **founder_signup_started** | **0** | growth_events |
| **founder_signup_completed** | **0** | growth_events |
| match_intro_requested | 0 | ai_logs |

Two distinct failures hide in that 100% cliff, and the spec must fix both:

1. **Conversion design.** The `matches_preview` variant gates account creation *before* the
   reveal is fully delivered (`steps: [url, instant_matches, signup_gate]`, `signup_path:
   /signup/founder`). Founders get a taste, hit a wall, and bounce. The fix is to **invert the
   gate**: give the full shortlist reveal for free, then gate the *next action they actually
   want* (save, request intro, export) behind signup.
2. **Founder-path attribution gap.** `founder_signup_started` is `0` despite 32 `url_submitted`.
   Growth flagged this: founder signup events are not wired/attributed the way investor events
   are (investor side shows 10 `investor_signup_started`). We cannot tell "nobody clicked signup"
   from "the click isn't logged." Per the operating rule (*instrument before optimizing when a
   stage reads zero*), the gate CTA must emit `founder_signup_started` with the experiment +
   variant + startup_id attributed, so the next cycle can measure the *real* drop-off.

## Target user

**Primary:** inbound founders who already submitted a URL and viewed matches (32/7d, ~4.6/day) —
the warmest, lowest-cost segment we have. **Secondary:** Product + Growth agents, who get the
first measurable founder signup funnel to experiment against.

## Success metric

| Metric | Baseline (7d) | Target | Window |
|--------|---------------|--------|--------|
| `founder_signup_started` emitted on gate CTA click | 0 (unwired) | ≥1 per gate impression-with-click; event present | 48h after deploy |
| preview→`founder_signup_started` rate | 0% | ≥ 25% of `instant_matches_viewed` | 14d |
| `founder_signup_completed` / started | 0 / 0 | ≥ 40% completion once started | 14d |
| accounts created from inbound preview traffic | 0 | first non-zero baseline (≥3) | 14d |

A non-zero signup baseline at zero acquisition cost is the explicit goal — even a quarter of
today's preview traffic converting is the first real founder signup number Pythh has ever had.

## Hypothesis

Moving the account gate from *before* the shortlist reveal to *after* it (gating save/intro/export
instead of the reveal itself), plus wiring `founder_signup_started/completed` on the gate, converts
≥25% of preview viewers to signup-started and produces the first non-zero founder account baseline.

## MVP scope (≤1 week)

**In scope:**
1. **Invert the gate** in the `matches_preview` variant: deliver the full instant-match shortlist
   un-gated (it already renders — preview API returns 10 matches / 172 candidates). Replace the
   pre-reveal `signup_gate` step with **action gates** on Save shortlist / Request intro / Export.
2. **Wire founder signup events** on the gate CTA:
   - emit `founder_signup_started` (with `experiment_id=founder_hero_entry`, `variant_key`,
     `startup_id`, `gated_action`) the moment a gated action is clicked.
   - emit `founder_signup_completed` on account creation, carrying the same attribution.
3. **Per-stage funnel additions** to `product-metrics-snapshot.mjs`: surface
   `founder_signup_started`, `founder_signup_completed`, and the `instant_matches_viewed →
   started` and `started → completed` rates so the next leak is visible.
4. **Heartbeat extension**: add a `founder_signup_started` step to the synthetic probe so the
   event stays verified daily (mirror the existing `investor_signup_started` probe step).

**Out of scope (explicit):** verified-traction badge (separate P2), pricing/checkout wiring
(blocked, separate item), email nudges, new copy A/B beyond the inverted gate. One change, measured.

## Files to touch

- `app/(marketing)` instant-match / preview component rendering the `matches_preview` shortlist —
  remove pre-reveal gate, add post-reveal action gates. *(confirm exact path during build.)*
- Founder signup handler / `/signup/founder` route — emit `founder_signup_started` +
  `founder_signup_completed` with attribution into `growth_experiment_events`.
- `scripts/product-metrics-snapshot.mjs` — add founder-signup stages + rates to the `funnel` block.
- `scripts/funnel-heartbeat` probe — add `founder_signup_started` synthetic step.
- `agents/growth/experiment-registry.json` — update `founder_hero_entry.matches_preview.schema.steps`
  to reflect the inverted gate (Growth Agent owns the variant edit; Product specs the change).

## Dependencies

- `founder_supply_seeding` (shipped) — funnel observability + heartbeat must be live. ✅ (it is).
- `growth_experiment_events` write path for founder events (investor path already works → reuse it).
- Coordinate the variant `steps` edit with the Growth Agent (delegated below).

## Rollout & measurement

1. Ship the inverted gate + event wiring to the `matches_preview` variant only (50% of founders).
2. 48h check: does `founder_signup_started` now emit on gate clicks? (resolves attribution gap).
3. 14d check: compare `matches_preview` (value-first) vs `url_first` on
   `founder_signup_completed`. If value-first wins, reallocate traffic (Growth decision).
4. Hand the next leak (started→completed vs intro_requested) back to research per F-11 next-focus.

## Delegated to Growth

Once this ships, Growth owns: the `matches_preview.steps` registry edit, variant traffic
reallocation, and any post-reveal CTA copy test. Product owns: the gate-inversion decision, the
event schema, and the snapshot/heartbeat instrumentation.
