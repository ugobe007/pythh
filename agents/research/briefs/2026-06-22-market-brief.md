# Pythh Market Brief — 2026-06-22

**North star:** 100 founder + investor signups/day · **Current: 0/day (0% of target, gap = 100)**
Phase: *validate* (haven't yet hit the 1 signup/day milestone).

---

## The one thing that matters this week

**The funnel is empty and uninstrumented.** Over the last 7 days `ai_logs` recorded **zero** of
`url_submitted / login_completed / lookup_signup_completed / checkout_completed`, and the internal
`startup_events` sample returned 0 rows. We cannot improve what we cannot measure. Every market signal
below points to the same fix: **give a visitor real value *before* they sign up, and instrument the funnel.**

> Strongest evidence is internal (validated). External signals (hypotheses) below corroborate the *direction*.

---

## What the market is saying

**1. Investors are drowning in "vibe-coded slop." (investor pain — high)**
Sifted (Jun 2026): *"Investors bemoan vibe-coded product slop."* Crunchbase: *"AI is rewriting what investors
should look for."* AI lets a software startup fabricate credibility in an afternoon, so **dealflow volume is now
a vanity metric** and fewer seed startups graduate to Series A — investors are concentrating capital and
desperate for *filtering*. → **Pythh opening on the investor side** (currently 0 acquisition): a quality /
data-completeness score + a curated dealflow digest.

**2. Founders waste ~6 weeks on a spreadsheet + a month cold-emailing the wrong people. (founder pain — high)**
2026 fundraising reports: *"most founders spend more time looking for investors than talking to them… six weeks
building a spreadsheet, another month cold emailing people who were never going to say yes,"* with work split
across disconnected tools. Some route around it entirely (Sifted: fintech founders crowdfunded €8m in <1hr).
→ This is **Pythh's core wedge**: a ranked, reasoned shortlist with a *"why this VC"* explanation in minutes.

**3. Targeting is partner-level, not firm-level. (both — medium)**
*"Partner targeting, not firm targeting"* — every partner has distinct convictions. Firm-level databases
(PitchBook, Harmonic) leave this gap open. → Score thesis-fit at **partner** granularity = differentiation.

**4. Fresh dry powder + bifurcated AI-winner market = timing matters. (both — medium)**
Seedcamp closed a **$320M** new fund; Q1 2026 hit a record **~$297B** (81% to AI). Newly-raised funds need
dealflow; founders must time outreach and broaden sources. → **Deployment-timing alerts** = a recurring
retention loop.

---

## Recommended for Product backlog (ranked)

| # | Opportunity | Appeals to | Signup lever | MVP |
|---|-------------|-----------|--------------|-----|
| **P0** | **Public instant match preview + funnel instrumentation** (`instant_match_preview`) | Founder | Awareness + conversion | ≤1 wk |
| **P1** | **Thesis-fit explainer — "why this VC"** (`thesis_fit_explainer`) | Founder | Conversion | ≤1 wk |
| **P1** | **Data-completeness/quality score + investor dealflow digest** (`dealflow_quality_score`) | Investor | Investor awareness + retention | ~1 wk |
| P2 | Partner-level thesis-fit data | Both | Conversion + retention | >1 wk |
| P2 | Investor deployment-timing alerts | Both | Retention + engagement | ~1 wk |

**Handoff:** F-2026-0622-01/02/03 are `confidence: high` with handoff blocks → Product Agent.

**Next research focus:** once the funnel is instrumented, re-run to measure *which* preview converts;
add a Hacker News / VC-Twitter pull to capture first-person founder/investor pain quotes.

*Sources: research-snapshot 2026-06-22 (internal ai_logs/startup_events); Sifted, TechCrunch, Crunchbase News, VentureBeat RSS (Jun 2026); web — Crunchbase Q1-2026 funding, seedlegals/thevccorner/seedblink/Morgan Stanley 2026 fundraising reports.*
