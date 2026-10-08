# Pythh Market Brief — 2026-10-08

**Author:** Research Sub-Agent → Scout (Orchestrator) · **Window:** 7d · **North star:** 100 signups/day (currently 0.86/day)

---

## TL;DR (the picky version)

Scout named **Use → paid (0%)** correctly. The dashboard line "Pricing/checkout path unproven or uninstrumented" is stale. The path **is** instrumented — `pricing_strip_viewed=5`, `pricing_bridge_clicked=2`, `pricing_viewed=15` — and **nobody starts Stripe** (`checkout_started=0`). The bounce is an **auth-return break**: unauthenticated PlanCTA said "Sign in to start trial" and redirected to `/login?redirect=/pricing`, **dropping `?plan=oracle&source=match_lead_use_to_paid`**. Fixed this run. One loop: **`pricing_auth_return`**. One metric: **`checkout_started / pricing_viewed`**.

## What the human funnel actually says (7d)

| Stage | Count | Read |
|-------|-------|------|
| page_view (human) | 130 | Healthy, not BLIND |
| url_submitted (human) | 126 | ~97% of page_view |
| instant_matches_viewed (UI) | 63 | Real previews |
| founder_signup_started → completed | 6 → 6 | **100% complete** (F-22 healed) |
| signup_per_preview | **9.5%** | Was 0% on 2026-09-14 |
| match_viewed | 25 | Use surface alive |
| pricing_strip_viewed → bridge_clicked | 5 → 2 | Bridge CTR **40%** when strip seen |
| pricing_viewed | 15 | Monetization surface reached |
| checkout_started / completed | **0 / 0** | **Binding paid leak** |
| paid subscribers | 0 | No revenue yet |

Preview→signup is no longer the fire. Paid is.

## Evidence: why humans bounce at Use → paid

1. **Not "uninstrumented."** Match-lead bridge (shipped 2026-10-06) fires strip + bridge events; `/pricing` fires `pricing_viewed` with `source`. Orchestrator copy lagged the data.
2. **Auth gate swallows intent.** `createCheckoutSession` is a protected procedure. Unauthenticated visitors never call it — PlanCTA renders Sign-in instead — so `checkout_started` stays 0 even when they click a primary CTA.
3. **Redirect lost the money context.** Login return was hard-coded to `/pricing`, wiping Oracle plan highlight + `source=match_lead_use_to_paid`. Post-login pricing felt generic; attribution broke.
4. **Tiny paid-eligible cohort, but enough to prove the leak.** 6 founder signups/7d and 15 pricing views with **zero** checkout starts is a conversion failure, not a sample-size excuse.
5. **Competitor pressure:** OpenVC CRM is free/unlimited; Startup Funding / Verabro lead with free tiers and no-card trials; ProRaise/Startups.com Pro sit at ~$49. Pythh's $19/$49 trial CTA must not add a second friction (lost query + silent auth wall) on top of card entry.

## One loop + one metric (Scout order)

| | |
|--|--|
| **Loop** | `pricing_auth_return` |
| **What** | Preserve `pathname+search` through Sign-in; fire `pricing_signin_cta_clicked`; land back on `/pricing?plan=oracle&source=…` ready for trial |
| **Metric (7d)** | `checkout_started / pricing_viewed` → move from **0%** toward **>10%**; intermediate: `pricing_signin_cta_clicked > 0` |
| **Files** | `site/Pricing.tsx`, `scripts/conversion-funnel-snapshot.mjs`, `scripts/orchestrator-brief.mjs` |
| **Do not** | Ship new pricing copy / A/B headlines until `checkout_started > 0` |

## Market signals (RSS + web, corroborating)

- Sifted: *"How to raise your Series A: what investors want to see from you"* — founders shopping process tools now.
- Crunchbase: *"Your Investors Can Make Or Break Your Startup…"* (cap-table / diligence friction) — reinforces thesis-fit shortlist over volume CRM.
- Category: free fundraising CRMs (OpenVC) raise the bar — Oracle must sell **send + follow-up automation**, not a contact list.

## Habit-loop status (honest)

- Preview loops may resume — awareness is fed (130 page_views).
- `share_proof_cards` still the missing organic awareness engine (F-20).
- Investor side still 0 signups — dealflow digest alone won't invent demand.

## One order for the active agent

**Growth (next):** monitor `pricing_signin_cta_clicked` + `checkout_started` for 48–72h after this ship. If authenticated pricing views still yield 0 checkouts, audit Stripe `createCheckoutSession` toasts / `STRIPE_SECRET_KEY` on Fly. Metric to move: **checkout_per_pricing from 0 → >0**. Finding: **F-2026-1008-01**.
