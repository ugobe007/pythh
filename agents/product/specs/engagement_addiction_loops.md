# Spec — `engagement_addiction_loops`: Curiosity, return visits, picky explain

> Orchestrator mandate: passive product is failure. Pythh must feel **picky, skeptical, and motivating** — users return because the engine shows them something new and true each visit.

## Problem

- Founders hit preview, leave, never create accounts (primary leak).
- Even if they sign up, **nothing pulls them back** — no signal delta, no movement alerts, no streak.
- Match list without **explain + filter** feels like a brochure, not intelligence.

## Voice in UI

Every high-value surface includes:

1. **Filter (picky):** "47 screened out — stage mismatch, check size, inactive 18mo+"
2. **Evidence (skeptical):** 3 bullets with source (portfolio, RSS, deployment)
3. **Next action (motivating):** one CTA — save, intro, export, or return trigger

## Loops (ship in order)

| Priority | Loop | MVP | Metric |
|----------|------|-----|--------|
| P0 | Preview cliffhanger | Full shortlist + explain; gate save/intro | `founder_signup_started` |
| P0 | Match explain block | "Why this investor" on each card | `match_intro_rate` |
| P1 | Signal delta | Email/in-app when GOD or signal moves | `return_visit_7d` |
| P1 | Investor movement | "2 thesis-fit investors active this week" | `investor_weekly_active` |
| P2 | Wizard streak | Act completion nudge | `wizard_act_completed` |

## Success metrics (14d)

| Metric | Target |
|--------|--------|
| `return_visit_7d` | ≥15% of preview viewers |
| `match_intro_rate` | First non-zero baseline |
| Session depth | ≥2 pages per returning user |

## Out of scope

Paid ads, full mobile app, generic drip campaigns without signal payload.

## Agent ownership

- **Product:** explain block schema, signal-delta spec, event wiring
- **Growth:** outbound feeding preview URLs; digest retention
- **Research:** validate skepticism copy — what makes founders trust vs bounce
