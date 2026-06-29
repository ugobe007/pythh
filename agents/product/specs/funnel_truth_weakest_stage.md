# Spec: Funnel Truth — stop mis-diagnosing the binding leak

**ID:** `funnel_truth_weakest_stage`
**Domain:** growth / analytics
**Priority:** P0 (critical — every agent is being steered at a phantom leak)
**Status:** building
**Engagement loop strengthened:** *all of them* — this is the diagnostic that decides which loop gets built. Wrong diagnosis → wrong loop → wasted week.
**Owner deliverable:** analytics fix (scripts + telemetry), no user-facing UI.

---

## The picky read (what's actually broken)

The orchestrator brief says the binding leak is **Visit → preview (0%)** and is steering Product + Growth to "fix the hero/preview path." That diagnosis is **wrong**, and the math proves it.

**7d live numbers (`getFunnelCounts`, probes excluded):**

| Signal | Value |
|--------|-------|
| `page_view` (human top-of-funnel) | **6** |
| `url_submitted` (raw, ai_logs) | 3,749 |
| `url_submitted` (HUMAN_URL_SOURCES) | ~3,288 |
| `instant_matches_viewed` (UI) | 4 |
| `synthetic_url_submitted` | ~3,745 |

Two defects compound into a lie:

1. **The awareness metric is inverted.** `scripts/conversion-funnel-snapshot.mjs:225` computes
   `url_submitted_per_page_view = rate(humanUrlSubmitted, humanPageViews)` = 3288 / 6 = **54800%**.
   `weakestStage()` (`scripts/orchestrator-brief.mjs:70-89`) sorts stages by `rate` ascending and calls the
   *lowest* the weakest. So awareness, at **54800**, is ranked the **healthiest** stage on the board —
   when 6 human page views in 7 days makes it the **deadest**. A "rate" of 548 URL submits per page view is
   not health; it's a physically impossible ratio that only happens when human top-of-funnel is uninstrumented
   or the `url_submitted` source labels are polluted with non-human traffic.

2. **Preview gets the blame by default.** `instant_matches_viewed = 4` (was 0) divided by anything ≈ 0%, so
   "Visit → preview" scores ~0 and wins "weakest." But you cannot have preview views without page views.
   The preview "leak" is **downstream noise of a dead top-of-funnel**, not an independent leak.

**Skeptical conclusion:** We shipped four preview loops this month — `preview_evidence_strip` (0 views),
`match_explain` (0 views), `preview_delta_teaser` (1), `preview_oracle_gap_teaser` (1). All near-zero exposure.
Not because the loops are bad — because **~6 humans reached them.** Pouring water into a bucket nobody is
carrying. The binding constraint is **awareness**, and the brief is actively hiding it behind an inverted metric.

---

## The motivating fix (one clear next step)

Make the weakest-stage diagnostic tell the truth, so the next build targets the real constraint.

### Change 1 — Awareness must score as BLIND, not healthy
**File:** `scripts/orchestrator-brief.mjs`, `weakestStage()` (lines 70-89).

Replace the awareness stage's rate with a **health score that punishes pollution and a dead top-of-funnel**:

```js
// human page-view floor for a 7d window; below this the human funnel is uncomputable
const PAGE_VIEW_FLOOR_7D = 20;
const humanPageViews = hf.page_view ?? s.page_view ?? 0;
const urlPerPv = rates.url_submitted_per_page_view; // 54800 today

// Awareness is BLIND when there is no human top-of-funnel OR the ratio is impossible (>100%).
const awarenessBlind = humanPageViews < PAGE_VIEW_FLOOR_7D || (urlPerPv != null && urlPerPv > 100);
const awarenessScore = awarenessBlind ? 0 : 100; // 0 = bind here first

{ id: 'awareness', label: 'Awareness / traffic',
  rate: awarenessScore,
  blind: awarenessBlind,
  problem: awarenessBlind
    ? `Human top-of-funnel is dead/uninstrumented: ${humanPageViews} page_views/7d vs ${rates.url_submitted_per_page_view}% url:pv ratio. Fix awareness BEFORE any preview/signup loop — downstream rates are uncomputable.`
    : 'Awareness healthy — optimize conversion downstream.' }
```

Keep the existing preview/signup/use/return/pay stages. The sorter stays ascending; awareness now correctly
sinks to score 0 when blind and is selected as weakest.

### Change 2 — Surface a `funnel_blind_flags` block in the brief
**File:** `scripts/orchestrator-brief.mjs`, `main()` (after `weakestStage`).

Add to the emitted brief so agents see which stages are **uncomputable** vs **genuinely leaking**:

```js
funnel_blind_flags: {
  awareness_blind: awarenessBlind,
  page_view_7d: humanPageViews,
  synthetic_url_share: hf.synthetic_url_submitted && f.url_submitted
    ? Math.round((hf.synthetic_url_submitted / f.url_submitted) * 100) : null, // ~99.9% today
  note: 'A stage with rate=null or denominator below floor is BLIND, not converting at 0%. Do not optimize a blind stage with a UI loop — instrument it first.'
}
```

### Change 3 — Stop counting non-human traffic as "human" url_submitted (robust root-cause fix)
**File:** `server/lib/funnelTelemetry.js`, `countHumanUrlSubmitted` / `logInstantSubmitFunnel`.

3,288 url_submits carry "human" source labels but only 6 page_views fired. Either the labels are spoofed
(API clients pass `x-funnel-source: matches_preview`) or page_view isn't firing on those entry paths.
A source string is not proof of a human. **Require a session-correlated page_view** before counting a
url_submit as human:

- Client (`site/lib/funnelAttribution.ts`): attach the existing anon `session_id` to both the `page_view`
  event payload and the `url_submitted` body.
- Server: add `countHumanUrlSubmittedBySession(supabase, since)` — count distinct `url_submitted` rows whose
  `output->>session_id` also appears in a `page_view` row in the window. Fall back to the current
  source-label count only when `session_id` is absent (legacy rows).
- Expose `human_funnel.url_submitted_session_verified` so we can watch the gap between "claims human source"
  and "has a real page_view" close.

**Ship-now vs robust:** Changes 1 & 2 are the ≤1-day ship that flips the diagnosis correctly today.
Change 3 is the ≤1-week root-cause fix that makes the human denominator trustworthy going forward.

---

## Voice (brief narration after this ships)

> **Awareness is the leak — not preview.** 6 human page views in 7 days; 3,288 "human" URL submits with no
> matching page view (a 548:1 ratio that can't be real). We screened the funnel and the top of it is dark.
> Building another preview loop now optimizes a stage almost no human reaches. **Next step:** instrument
> page_view on every acquisition entry, verify with session-correlated submits, and point Growth's outbound
> at `/find-investors` to manufacture the human traffic the loops are starving for.

40% critique (the diagnosis is lying / loops are starved) · 60% action (3 concrete changes + the re-pointed next step).

---

## Target user / success metric / MVP / dependencies

- **Target user:** internal — the agent fleet (Product, Growth, Research) that reads `orchestrator-brief-*.json`.
- **Success metric:** `weakest_stage.id` flips from `preview` → `awareness` on the next brief; `funnel_blind_flags.awareness_blind = true` surfaces; within 14d, `page_view_7d` rises above the floor (20) once Change 3 + page_view audit land, OR we confirm awareness is genuinely dead and Growth's outbound becomes P0.
- **Guardrail:** never auto-select a **blind** stage as a build target for a UI loop — blind ⇒ instrument first.
- **MVP scope (≤1 week):** Changes 1+2 day one; Change 3 within the week.
- **Dependencies:** `getFunnelCounts.human_funnel` (exists), client `session_id` in `funnelAttribution.ts` (exists for dedup — extend to payload).

---

## Why this is the highest-leverage move this cycle

The decision filter has 4 gates; this clears the one that gates all others: **"Can we measure it in 7 days?"**
Right now we cannot — the brief reports a confident leak that is a denominator artifact. Every loop we ship
against a phantom leak is a wasted week. Fix the truth, and the *next* cycle's loop lands on the stage that
actually binds. Until then, "ship another preview loop" is passivity wearing an active costume.
