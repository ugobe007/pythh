# Prospective proof cohort — URL submits (no signup gate)

**Status:** Active from **2026-08-25**  
**Weekly report:** `npm run proof-cohort:report -- --since=2026-08-25`

Pythh’s hypothesis: **we match startups to investors who later invest**, measured **after** the prediction clock (`startup_investor_matches.created_at` / sealed `predicted_at`).

We are **not** signing up founders yet — there is no evidence funnel to compel signup. Proof runs on **every new URL submit** that receives matches.

---

## Cohort definition (inclusion)

| Rule | Value |
|------|--------|
| Entry event | `POST /api/instant/submit` creates or resolves a startup |
| `startup_uploads.source_type` | `url` |
| `startup_uploads.status` | `approved` |
| `startup_uploads.website` | non-empty (junk domains rejected at submit) |
| `startup_uploads.entity_gate` | not `junk` |
| Cohort start | `created_at >= PROOF_COHORT_SINCE` (default **2026-08-25**) |

**Not in cohort:** historical backfill rows, enrichment-only rows, junk URLs, founder signup path (unused today).

---

## Instrumentation contract (every cohort startup)

On match write (instant submit / background match worker):

1. **Matches** — `startup_investor_matches` rows; **never** rewrite `created_at` on upsert.
2. **Seal** — `instrumentMatchOutcomes` → `freezeTopFiveIfAbsent` → `funding_prediction_snapshots` (`cohort_key=served-first-top5`, `predicted_at = min(match.created_at)`).
3. **Outcomes queue** — awaited `enqueueFundingEvidenceSearch` → `funding_evidence_search_queue` with `earliest_match_at` synced from matches.
4. **Search** — continual loop (Gemini preferred when billed; inference fallback).

**Instrumentation OK** = has matches + sealed snapshot + queue row.

**Must not skip:** BG Phase 3 "no enrichment changed" and request-timeout exits previously skipped freeze/enqueue. Those paths now call `instrumentMatchOutcomesSafe`. Fire-and-forget enqueue alone is insufficient on serverless teardown.

**Backfill (repair historical dark cohort):**
```bash
npm run proof-cohort:instrument -- --since=2026-08-25
npm run proof-cohort:instrument:apply -- --since=2026-08-25 --limit=200
npm run proof-cohort:report -- --since=2026-08-25
```

Sets `entity_gate=qualified` when null (URL + website), enqueues, and freezes serve-grade top-5.

---

## What we measure (two layers)

| Layer | Question | Primary metric |
|-------|----------|----------------|
| **A. Sealed Hit@5** | Did any **top-5 firm** fund before the round (audited roster)? | `audited_outcomes` among cohort startups (target **100** for claim) |
| **B. Pair proof** | Did a **specific** matched investor fund after `match.created_at`? | Verified `match_validation_evidence` on cohort startups |

**External headline:** audited Hit@5 on the **prospective URL cohort** + case studies from verified pairs.

**Do not** headline global reconcile (3.8M matches) or full `confirmed_outcomes` (238) without cohort filter.

---

## Success criteria (pre-registered)

| Milestone | Criterion |
|-----------|-----------|
| **Instrumentation** | ≥95% of cohort startups: matches + snapshot + queue within 24h of submit |
| **Pair evidence** | ≥**5** cohort startups with **verified** post-prediction funding pairs (issuer-grade sources) — signup compelling slice |
| **Claim inventory** | ≥**100** **audited** startup outcomes (hits + misses), 180d horizon |
| **Claim rate** | Observed hit rate + 95% CI vs **85%** target (`funding:claim-readiness`) |

---

## GOD / fit scoring — explicit deferral

**Do not retune GOD weights, sector shortlists, or fit formulas until:**

1. Prospective cohort has **solid funding evidence** for at least **five** matched startups (verified pairs + audited path visible in admin), and  
2. `funding:audit:candidate-misses` on **cohort misses** shows ranking/candidate issues **dominate** over `candidate_generation_miss`.

Then run a **GOD review** (weights, missing variables, `feature_snapshot` gaps) as a **separate experiment** with before/after on the same prospective stream — not on 60k historical rows.

---

## Phase 2 — grow verified pairs (gate: 5 startups)

**Goal:** `signup_evidence_met ≥ 5` (`proof-cohort:report`).

**Ops notes (2026-08-28):**
- Boost proof-cohort queue to priority **≥70000** so mature-unfunded drains do not starve it.
- Date-only Gemini events use **end-of-UTC-day** (`T23:59:59.999Z`) so same-day matches still count.
- Issuer-primary auto-verify must set **both** `verified_at` and `verified_by` (DB check).
- Reprocess existing search rows after the date fix: `npm run proof-cohort:reprocess-pairs:apply -- --since=2026-08-25`.

**Miss taxonomy seen in cohort (do not retune GOD for these):**
| Case | Pattern | Action |
|------|---------|--------|
| Runable → Nexus | Match before announce; TechCrunch medium tier | `--verify` via `outcomes:review` |
| Yardstik / Curaa | Actual funders exist in DB but were not matched | `candidate_generation_miss` — rematch for *future* only (no backdating) |
| Atorie / Adaptyv | Submit or first match **after** announce | Not recoverable as prediction |
| SiFly / Automated AI Lab | Website = publisher article URL | `outcomes:recover-urls` then rematch |

Do **not** further GOD/fit retunes until the 5-startup gate is met.

---

## Weekly ops (bounded token budget)

Run on **proof cohort queue** only (priority > 0; URL submits with website):

```bash
npm run proof-cohort:report -- --since=2026-08-25
npm run outcomes:recover-urls -- --apply --limit=50
npm run outcomes:triage-queue -- --apply --park-weak --target=5000
node scripts/search-startup-funding-evidence.mjs --apply --provider=gemini --limit=50 --delay=600
npm run proof-cohort:reprocess-pairs:apply -- --since=2026-08-25
npm run outcomes:promote-ledger -- --apply --reject-low-pending --limit=100
npm run outcomes:review -- --list
# Wave 2: one command at a time (see HIT5_IMPROVEMENT_ROADMAP.md)
npm run funding:match-funding-audit
```

**Deprioritize:** full 10.9k qualified+URL drain, 400-job inference batches, chained Wave 2 in one terminal.

---

## Historical data (secondary)

Use **stratified samples** (50–100 startups) for case studies and `funding:reconcile:historical:summary` — not full 60k backfill.

---

## Related docs & commands

- Hit@5 waves: `docs/HIT5_IMPROVEMENT_ROADMAP.md`
- Claim metrics: `npm run funding:claim-readiness -- --summary`
- Cohort report: `npm run proof-cohort:report`
- Admin pairs: `https://pythh.ai/admin/match-outcomes`
