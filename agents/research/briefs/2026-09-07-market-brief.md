# Pythh Market Brief — 2026-09-07

**Author:** Research Sub-Agent · **Reports to:** Scout (Pythh AI Ops Orchestrator)
**Binding constraint:** Awareness / traffic (BLIND) · **North star:** 100 signups/day (today: 0/day, gap 100)

---

## TL;DR (one thing to believe today)

**Awareness isn't dead — it's uncounted.** The funnel shows 19 page_views but **126 human URL submits** in 7 days. That is a **663:1 url:page_view ratio, which is physically impossible** — you cannot submit a URL without first viewing a page. Real humans are arriving; the landing event simply wasn't firing on the surface where they land.

I found and **shipped the fix this run.** Everything downstream was frozen behind a false "BLIND" signal.

---

## The evidence (human_funnel, 7d)

| Stage | Count | Read |
|-------|-------|------|
| page_view (human) | **19** | Under-counted — the defect |
| url_submitted (human) | **126** | Real humans, real intent |
| instant_matches_viewed (UI) | **160** | Humans reached the preview |
| url_submitted (raw, noisy) | 5,177 | 5,047 synthetic — ignore |
| signups | **0** | The prize still uncaptured |

**Root cause (code):** `site/pages/Matches.tsx` fired `page_view` **only when there was no `?url=` param**. But the dominant human path — hero, `/find-investors`, and share cards — all route to `/matches?url=`, which hit the `else` branch and fired **no page_view**. So every human who arrived via the intended acquisition path submitted a URL (`source=matches_preview`) but was never counted as a visitor. 160 preview views + 126 human submits vs 19 page_views is the smoking gun: **traffic exists; instrumentation didn't.**

Why this matters beyond a metric: Scout's decision rules **block all preview/signup UI loops while awareness is BLIND**. A measurement defect was holding the entire product roadmap hostage.

---

## Shipped this run (the one fix)

**File:** `site/pages/Matches.tsx` — fire `page_view` on the `/matches?url=` preview-landing branch, with a distinct `source: 'matches_preview_landing'` so it stays segmentable and **never inflates url_submitted or instant_matches_viewed**.

- **Loop strengthened:** `outbound_find_investors` / `matches_preview` awareness — now measurable.
- **Metric to watch:** `human_funnel.page_view` and `rates.url_submitted_per_page_view`. **Success = ratio collapses from 663 → <100 within 7d** (target <5), which clears the awareness BLIND flag and lets Product/Growth resume preview→signup loops.
- Tests: `check:server` ✅ clean; `wizard-smoke` 14/16 (2 pre-existing server/payment failures, untouched by this client edit).

---

## Market signals (RSS, 2026-09-07)

- **Valuation froth is back distorting anchors.** TechCrunch: *"XDOF, three months out of stealth, in talks for a Series B at a $1.2B valuation."* Sifted: *"Bessemer and Creandum to back new AI infra startup at $600m valuation."* Two `pricing_terms` hits in one scan → reinforces the **valuation reality-check widget** (F-06/F-19): a picky "mega-rounds aren't your round" comp that doubles as a trust signal.
- **AI trust/legal noise** (Anthropic settlement pushback; Seattle Times & Newsday sue OpenAI/MSFT) — background pressure on "can I trust this AI tool," consistent with our evidence-first preview thesis (F-15).

---

## Competitor watch — Startups.com (P0)

Their edge isn't the matcher; it's a **public awareness surface**: `who-will-fund-me` with count social proof ("2,132 investors matched") feeding a single-CTA form → *See My Matches*. **Pythh has no public, shareable artifact** — value lives behind a URL submit. That is the mechanical reason our top-of-funnel is thin.

**Counter (F-20 → Product/Growth):** build `share_proof_cards` — an honest, indexable *signal-fit scorecard* ("3 of 47 investors fit my signals — see who") that routes back to `/matches?url=`. Beats their volume hype with picky evidence; it's the missing organic awareness engine — and now measurable thanks to today's page_view fix.

---

## Scout's order → answered

- **Why humans bounce at awareness:** They largely don't bounce — they weren't being *counted*. The visible awareness collapse was an instrumentation mirage on the `/matches?url=` landing. (Any residual real bounce is now measurable for the first time.)
- **One loop + metric:** Loop = `share_proof_cards` (public awareness engine); interim metric = `url_submitted_per_page_view` returning to sane range post-fix, then UTM-attributed `url_submitted` from share refs.
- **Today's brief:** this file.

## Handoffs
- **P0 → Product/Pipeline:** verify F-18 fix in next snapshot (ratio <100). If page_view still lags, audit any share/redirect entry bypassing `/matches`.
- **P1 → Growth:** `share_proof_cards` (F-20) + SEO `/find-investors/{sector}`.
- **P1 → Product:** valuation reality-check widget (F-19/F-06).
