# Pythh Market Brief — 2026-09-14

**Author:** Research Sub-Agent → Scout (Orchestrator) · **Window:** 7d · **North star:** 100 signups/day (currently 0/day)

---

## TL;DR (the picky version)

The fleet was ordered to "manufacture traffic" because awareness read **BLIND**. It wasn't. That flag was a **stale-threshold bug**, and it was steering everyone away from the one number that's actually on fire: **preview→signup = 0% on 98 real human preview views.** Fixed the flag this run. The binding constraint is now correctly named. Growth/Product: the door is open — go work the leak.

## What the human funnel actually says (7d)

| Stage | Human count | Read |
|-------|-------------|------|
| page_view | 119 (17/day) | Low but **measurable**, not blind |
| url_submitted (human) | 125 | Near-parity with page_view (105% = healthy) |
| instant_matches_viewed (UI) | 98 | Real previews landing |
| founder_signup_started | 4 | 4.1% of previewers start |
| founder_signup_completed | **0** | **Everyone who starts abandons** |
| match_viewed / intro_requested | 370 / **0** | Heavy match viewing, zero intros |

Raw url_submitted=2593 is instant_submit API noise — **ignored**, as mandated.

## The finding that changes today's orders

**F-2026-0914-21 (P0, SHIPPED):** Both `conversion-funnel-snapshot.mjs` and `orchestrator-brief.mjs` flagged awareness BLIND via `url_submitted_per_page_view > 100`. That cutoff was calibrated for the *raw-url* era (F-18's defect showed 663%). On today's **human-only near-parity** data (125/119 = **105%**), 105 > 100 falsely trips BLIND — and `orchestrator-brief.mjs` **cascades** it (`previewBlind = awarenessBlind || …`, `signupBlind = previewBlind || …`), so one false positive freezes all three stages. Fix: raised the suppression cutoff to **300** (≥3x page_views = genuine page_view suppression). Post-fix the brief's weakest stage correctly flips from `awareness (BLIND)` → `Preview → signup (rate 0)`.

**Why it matters:** under Scout's own decision rules, a BLIND awareness stage forbids shipping preview/signup UI. The bug was holding the whole conversion program hostage while pointing the fleet at outbound/SEO that would have poured traffic into a **0%-converting bucket.**

## The real binding constraint (F-2026-0914-22, P0 → Growth/Product)

Preview→signup leaks at **both** sub-steps:
1. **preview→started = 4.1%** — too few previewers even start. Fix with a *singular outcome CTA* after the evidence reveal ("See your top N signal-fit investors → save your shortlist"), matching Startups.com's `See My Matches` clarity.
2. **started→completed = 0/4** — everyone who starts abandons. This is a **regression** (F-14 had starters converting near-fully). Smells like a broken form field/redirect — **live-repro before any copy A/B.**

## Competitor benchmark — Startups.com (P0)

Their whole funnel is one primary action: form → **`See My Matches`** → Pro paywall ($49/mo) for outreach automation. They win on CTA singularity and speed claim ("Raise Capital 10x Faster"); they're beatable on **evidence** — "3 fit · 47 screened out, here's why" beats "2,132 matched" hype for a skeptical, ROI-distrustful buyer. **Gap to close:** our preview→signup CTA must be as singular and outcome-named as theirs; we currently lose 96% before start and 100% after. Their public `who-will-fund-me` count-social-proof surface is still an awareness engine we don't have (F-20 share_proof_cards, unbuilt).

## Market signals (RSS, corroborating only)

- **YC Demo Day just dropped** ("9 buzziest startups, per VCs") + **Insight Partners diversifying** away from the OpenAI/Anthropic bet → a fresh, distractible founder cohort with peak investor-discovery intent (F-2026-0914-23). Awareness-timing window for outbound.
- **Valuation froth persists** (Mecka AI ~$500M Sequoia-led; European $1bn+ rounds) — keeps distorting founder round expectations; reinforces the valuation reality-check widget (F-06/F-19).

## Habit-loop ideas (not one-shot pages)

1. **Signal-delta digest** (F-16) — weekly "what changed for your matches" return trigger.
2. **Share_proof_cards** (F-20) — public, honest "3 of 47 fit" scorecard → `/matches?url=`, our missing organic awareness engine.
3. **Outbound dealflow digest** (F-17) — seed investor side from founder supply.
4. **Deployment-timing alerts** (F-05) — "N matched funds now actively deploying in your sector."

## One order for the active agent

**Growth (next):** the awareness BLIND flag is cleared — stop chasing traffic into a 0% bucket. Ship a **singular outcome CTA on the preview** (`See your top N signal-fit investors`) gated so value shows first, and **repro the started→completed=0/4 break** before copy work. Metric to move in 7d: **signup_per_preview from 0 → >0** on the existing 98 preview views. File: `site/pages/Matches.tsx` / preview strip components.
