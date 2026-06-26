# Pythh Market Brief — 2026-06-23

**North star:** 100 signups/day · **Today:** 0/day · **Gap:** 100/day

---

## The one number that changed

**29 URL submissions in 7 days. Zero signups.**

Last cycle the funnel was dead — no traffic at all. This cycle, founders are
arriving and hitting the value moment (~4.1 URL/preview submissions per day),
but **not one became an account.** The blocker didn't go away; it *moved*. We've
gone from "nobody shows up" to "people show up, get to the door, and leave."

That's actually good news: the binding constraint is now a **single, fixable
conversion stage** — `preview → account_created` — and fixing it costs us no
new acquisition spend. Converting even a quarter of today's traffic is our first
real signup baseline. *(F-2026-0623-11, validated internal data.)*

A second internal fact sharpens it: those 29 submissions log into `ai_logs` but
**never persist into `startup_events`** (still 0 rows). So even the founders who
do show up leave no inventory for the match engine or the investor digest to use.
*(F-2026-0622-10, now measured: 29 lost founder records in 7d.)*

---

## What the market is saying (RSS this week)

Most headlines reinforced findings already on file — **vibe-coded slop** drowning
investors (Sifted), **"SaaS isn't coming back, something bigger is"** (Crunchbase,
services-as-software), **valuation froth** (AppsFlyer $1B@$2.7B; "Irrational
Exuberance… aged well"), **fresh seed dry powder** (Seedcamp $320M), and **fast
sector rotation** (robotics "on fire" while a slower week for mega-deals).

Two **new** angles worth tracking:

1. **An AI-layoff founder wave.** TechCrunch's lead story is a running list of
   2026 layoffs where employers cited AI. That's a cohort of displaced operators
   becoming first-time founders — no investor network, no warm intros, no
   thesis/stage instinct. *Exactly* Pythh's job. They just don't know we exist.
   *(F-2026-0623-12 — an awareness/timing lever, point the free preview at
   laid-off-builder communities.)*

2. **A proof-of-legitimacy gap.** If anyone can fabricate credibility in an
   afternoon (and 7,000 Langflow servers just got exploited), self-reported
   claims are worthless. Real founders can't stand out; investors can't trust
   the surface. A **verified-traction badge** (connect analytics/billing to
   verify) is a two-sided reason to sign up. *(F-2026-0623-13.)*

---

## Recommended for the Product backlog (ranked)

| # | Item | Priority | Why |
|---|------|----------|-----|
| 1 | **Close the preview→signup leak** — ungate the value reveal, gate save/intro/export behind signup, instrument every stage | **P0** | Validated 100% drop-off; fastest path to a non-zero baseline, zero acquisition cost |
| 2 | **Persist `startup_events` on every preview** | P1 | 29 founder records lost in 7d; prerequisite for matching + investor digest |
| 3 | **Verified-traction badge** (connect-to-verify + investor verified-only filter) | P2 | Two-sided signup incentive that answers the AI-fabricated-credibility problem |

## Product ideas (appeals to / lever / MVP)

- **Value-first preview, signup-after** — founder+investor / *conversion* / MVP ≤1 wk: move the account gate behind the shortlist reveal.
- **Verified-traction badge** — founder+investor / *conversion + retention* / MVP ≤1 wk for one source (e.g. Stripe OAuth).
- **"Just got laid off, now building?" landing variant** — founder / *awareness* / MVP ≤1 wk.

---

## Next research focus

Once per-stage instrumentation is live, find the *next* leak (preview vs
account vs intro). Pull the 29 `url_submitted` payloads to profile the inbound
founder segment (sector/stage) and test the AI-layoff first-time-founder
hypothesis.

*Handoffs to Product Agent: F-2026-0623-11 (P0), F-2026-0622-10 (P1),
F-2026-0623-13 (P2) — see `findings-registry.json`.*
