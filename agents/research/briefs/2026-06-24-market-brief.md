# Pythh Market Brief — 2026-06-24

**North star:** 100 signups/day · **Today:** 3/day · **Gap:** 97/day

---

## The one number that changed

**979 URL submissions in 7 days. 21 signups. 10 paid checkouts.**

The funnel didn't move this cycle — it *inflected*. Yesterday: 29 submissions,
zero signups. Today: ~140 submissions/day (a **34× jump**), our **first signups
ever**, and our **first 10 paid checkouts**. The awareness wedge works and there
is a real revenue path. *(F-2026-0624-14, validated internal data.)*

But read the conversion: **21 ÷ 979 = 2.1%.** ~98% of high-intent founders hit
the value moment and leave without an account. The good news hides inside the
funnel math: `preview→started` is only 46.2%, but `started→completed` is 166.7%
— meaning **once a founder starts signup, they finish.** The entire 97/day gap
lives in one step: *getting previewers to start.* At 2.1% we get 3/day; at 15%
the *same traffic* yields 21/day; at 50% it clears 100/day with **zero new
acquisition spend.**

Two structural facts cap the ceiling:

1. **`startup_events` is still 0** — after 979 submissions. The match engine has
   no demand-side corpus to learn from. That's **979 lost founder records in 7d**
   (up from 29) and it limits match quality — hence conversion *and* retention —
   regardless of any front-end fix. **Escalated to P0.** *(F-2026-0622-10.)*
2. **Investor acquisition is still 0.** Every signup op this window is
   founder-side (`lookup_signup_completed=11`, `checkout_completed=10`). The
   marketplace is going one-sided just as founder volume scales — intro requests
   risk dead-ending. *(F-2026-0624-17.)*

---

## What the market is saying (RSS this week)

The headlines all point at the same lever — **trust before the ask**:

1. **AI-tool ROI distrust is now a buying behavior.** TechCrunch: *"Companies are
   scrambling to stop employees from maxing out AI budgets with small tasks"* and
   a site that *"names and shames"* companies on passkeys. Buyers arrive
   reflexively skeptical of AI tools that burn time/money without proof. A gated
   or hype-first preview is exactly what makes that cohort bounce — a plausible
   mechanism for our 98% drop-off. The fix is on-brand: open with **evidence and
   rejection** ("47 screened out, 3 fit — here's why"), never with a gate.
   *(F-2026-0624-15.)*

2. **Mega-round froth distorts founder expectations.** Sifted: *"Records broken
   as eight European startups raised $1bn+ rounds in 2026"*; Crunchbase: *"Menlo
   Ventures Raises $3B"*; the recurring *"Irrational Exuberance… aged well."*
   Seed founders mis-anchor on headlines that aren't their round. A **valuation
   reality-check** in the preview is both data *and* a trust signal.
   *(F-2026-0622-06, corroborated.)*

---

## Recommended for the Product backlog (ranked)

| # | Item | Priority | Why |
|---|------|----------|-----|
| 1 | **Lift preview→signup from 2.1%** — ungate the value reveal, gate save/intro/export, one-tap CTA, per-stage instrumentation | **P0** | The single highest-leverage number to 100/day; traffic abundant, started→completed near-100% |
| 2 | **Persist `startup_events` on every preview** | **P0** | 979 lost records/7d; caps match quality (→ conversion + retention) regardless of UI |
| 3 | **Evidence-and-rejection-first preview** | P1 | ROI-distrust market signal predicts gated/hype previews bounce; cheap copy experiment |
| 4 | **Weekly Signal-Delta Digest** | P1 | No return trigger exists; competitors retain via recurring digests — the one retention lever |
| 5 | **Outbound Weekly Dealflow Digest** | P1 | Opens the investor side using abundant founder supply as bait |

## Product ideas (appeals to / lever / MVP)

- **Preview-cliffhanger v2** — founder / *conversion* / MVP ≤1 wk: ungated shortlist
  + 1 evidence-backed "why"; account gate moves behind save/intro/export.
- **Signal-Delta Digest** — founder+investor / *retention* / MVP ≤1 wk: weekly
  "what changed in your sector" email+badge (needs `startup_events` populated).
- **Outbound Dealflow Digest** — investor / *acquisition* / MVP ≤1 wk: 5 curated
  founders → 20 target investors' theses → cold send + one-tap signup link.
- **Valuation reality-check widget** — founder+investor / *conversion+trust* / MVP ≤1 wk.

---

## Active engagement item (mandate)

**Ship Preview-cliffhanger v2 + add `value_preview` / `account_started` events.**
Loop: `preview_cliffhanger`. Metric: decompose the 2.1% url→signup into
preview-shown → preview-completed → signup-started so the gate-position A/B is
measurable. Without instrumentation the conversion fix is unfalsifiable.

## Next research focus

Once per-stage events exist, locate the *exact* loss inside the 2.1% — render,
quality, or gate. And watch whether the first outbound investor digest produces
**any** investor-side signup operation (currently 0).

*Handoffs to Product Agent: F-2026-0624-14 (P0), F-2026-0622-10 (P0),
F-2026-0624-15 (P1), F-2026-0624-16 (P1), F-2026-0624-17 (P1) — see
`findings-registry.json`.*
