# Competitor intel: Startups.com — Investor Matching (`/investors/matching/start`)

**Captured:** 2026-07-17  
**URL:** https://www.startups.com/investors/matching/start  
**Related:** https://www.startups.com/investors/matching · https://who-will-fund-me.startups.com/ · https://pro.startups.com/

**Read by:** Research, Growth, Product agents — benchmark CTA focus, value-before-paywall, and retention loops against this flow every cycle when preview→signup or awareness is binding.

---

## One-line summary

Startups.com runs a **single-primary-CTA** investor-matching funnel: short intake form → **"See My Matches"** → (Pro paywall) ranked list + automated outreach. They lead with **speed + volume** ("Raise Capital 10x Faster", "2,132 investors matched"); Pythh should lead with **signal-fit evidence + picky screening** before signup.

---

## Funnel map (observed)

| Step | UI | Notes |
|------|-----|--------|
| 1 | Hero H1: **"Raise Capital 10x Faster"** | Outcome-first, speed claim |
| 2 | H2: "Accelerate your fundraise with investor matching and automated outreach" | Bundles match + outreach (full loop) |
| 3 | Form: raise amount, elevator pitch, industries/tags | No URL-first — text intake |
| 4 | Optional block: pitch deck upload | "Our AI will automatically match investors and generate outreach templates" |
| 5 | **Primary CTA:** `See My Matches` | **One green button** — no competing primaries on page |
| 6 | Secondary: `Upload Document` / `Analyze my Pitch Deck` | Demoted, optional |
| 7 | (Downstream) Pro membership | $49/mo — 10k+ verified investors, AI matches, 3 outreach emails/day, pitch builder |

---

## CTA & value proposition (Scout benchmark)

**What they do well (steal the pattern, not the claim):**

- **One primary action** per screen — `See My Matches` is unambiguous
- **Outcome headline** — "Raise Capital 10x Faster" (Pythh equivalent: signal-fit shortlist, not generic "tracking")
- **Immediate deliverable named in CTA** — "My Matches" = personalized list
- **Social proof with counts** — who-will-fund-me shows "Matched with 2,132 investors" (quantity social proof)

**Where Pythh can beat them:**

| Their wedge | Pythh counter |
|-------------|----------------|
| Huge investor count (10k+, 2k+ matched) | **Picky filter:** "3 fit · 47 screened out — here's why" (evidence, not volume) |
| Form-first (pitch + tags before value) | **URL-first preview** — value before account (`/matches?url=`) |
| Rank by stage/sector/location (self-reported) | **GOD + signal intelligence** — thesis-fit with recency, check size, portfolio overlap |
| Outreach automation as core product | **Pipeline activation** after signup — intros + movement alerts, not spam cannon |
| Generic "AI matching" | **Skeptical explain blocks** — 3 evidence bullets per match |

**Scout review questions vs Startups.com:**

1. Is our primary CTA as singular as `See My Matches`? (Yes after 2026-07-17 preview fix — maintain.)
2. Does our headline state **speed-to-outcome** as clearly as "Raise Capital 10x Faster"?
3. Do we show **credible specificity** (top N signal-fit) without fabricating 2,000-investor hype?
4. Is value delivered **before** signup as fast as their form → matches path?
5. Are we leaving outreach automation on the table as a **post-signup loop** they monetize at $49/mo?

---

## Copy reference (verbatim from live page)

- H1: `Raise Capital 10x Faster`
- H2: `Accelerate your fundraise with investor matching and automated outreach.`
- Section: `Tell us more...`
- Fields: `How much do you need to raise?` · `Explain your startup:` (Elevator Pitch) · `Industries & Tags:`
- Optional: `Let us do the work! ✨` — upload deck → auto match + outreach templates
- **CTA:** `See My Matches`

**Landing page (matching):** "Automate your fundraise with investor matching and outreach" · "Upload your pitch deck and we'll curate a targeted list" · hand-verify investors · Pitch Builder for individualized emails.

**Pro tier hooks:** 10,000+ verified investors · unlimited AI-curated matches · 3 outreach emails/day · member matching · vs accelerator comparison table (no equity, instant start).

---

## Loops they use (retention / monetization)

| Loop | Mechanism | Metric proxy |
|------|-----------|--------------|
| **Match reveal cliffhanger** | Form → ranked list (count-heavy) | Completion of intake |
| **Outreach automation** | Gmail/Outlook connect, tracked sends | Emails sent/day (cap 3 on Pro) |
| **Pitch deck AI** | Upload → analysis + templates | Deck uploads |
| **Expert advisory** | 1:1 sessions, workshops | Pro retention |
| **Member graph** | Co-founder/advisor matching | Contacts/day |

Pythh gaps to close: outreach loop is their monetization anchor; our `preview_cliffhanger` + `signal_delta` + intro queue must compound **return** without requiring $49/mo before first value.

---

## Recommended Pythh experiments (from this benchmark)

| Priority | Experiment | Hypothesis |
|----------|------------|------------|
| P0 | Headline A/B vs "Raise Capital 10x Faster" | Outcome speed + signal-fit ("See investors aligned to your signals in 60s") beats generic matching |
| P0 | Primary CTA copy | `See my top {N} signal-fit investors` ≈ their `See My Matches` clarity |
| P1 | Post-preview social proof strip | Show real `total_matches` network count + `{visible}` shown (not fake 2,132) |
| P1 | Optional deck upload on preview | Parity with their optional AI path — after URL preview, not before |
| P2 | Outreach draft teaser (gated) | "PYTHIA drafted intro to {investor}" — competes with their Pitch Builder |

---

## Agent actions

- **Research:** Re-scan quarterly; update this file if funnel changes; add findings to `findings-registry.json` with id prefix `F-competitor-startups-com-`.
- **Growth:** When running Scout `cta_doctrine` review, cite this doc; register variants in `experiment-registry.json` with `benchmark: startups_com`.
- **Product:** Spec post-signup outreach loop if `match_intro_requested` stays flat while signup rises.

---

## Evidence log

| Date | Source | Note |
|------|--------|------|
| 2026-07-17 | Live browse `/investors/matching/start` | Form + single CTA captured |
| 2026-07-17 | startups.com/investors/matching | Marketing copy, 10k database, outreach |
| 2026-07-17 | pro.startups.com | Pricing, Pro features, comparison table |
