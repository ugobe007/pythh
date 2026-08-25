# Hit@5 claim inventory — audit & improvement roadmap

**Last updated:** 2026-08-25 (prospective proof cohort spec)  
**Regenerate audit:** `npm run funding:match-funding-audit` (or `--json`)  
**Proof cohort (URL submits):** `docs/PROOF_COHORT_SPEC.md` · `npm run proof-cohort:report -- --since=2026-08-25`

This doc ties **pair-level match outcomes** (did this specific investor fund this startup?) to **sealed startup-level Hit@5** (did any of our top-5 predict a funder before the round?). Use it to schedule ops waves and product/engineering work.

---

## How to read the two layers

| Layer | Question | Primary data | Typical count (2026-08-23) |
|--------|-----------|--------------|----------------------------|
| **Pair outcomes** | Did matched investor *X* fund startup *Y* after `match.created_at`? | `match_validation_evidence` (verified) | ~42 verified post-prediction funding pairs (30 startups) |
| **Sealed Hit@5** | Did any top-5 investor participate before the round (audited roster)? | `funding_prediction_snapshots` + `funding_evidence_events` | 71 audited (9 hit / 62 miss); target 100 |

Pair counts are **higher in spirit** (many matches per startup) but **verified pairs** are still sparse because search/review is pair-scoped. Hit@5 is **stricter**: one outcome per startup, complete participant list, temporal seal on `created_at` / `predicted_at`.

---

## Current snapshot (180d horizon)

Run `npm run funding:claim-readiness -- --summary` for live numbers.

| Metric | Value | Notes |
|--------|-------|--------|
| Sealed sets (serve-grade, 5 firms) | 1,700 | 47 excluded identity |
| Mature / pending | 707 / 993 | ~150 mature within 30d |
| Funded in horizon | 71 | 0 indeterminate |
| Hit@5 audited | 71 | **29 short of 100** |
| Startup-level hits | 9 | ~12.9% among audited |
| Mature unfunded | ~658 | Need new post-prediction funding evidence |
| Outcomes cohort resolved | ~4.84k / 10.9k qualified+URL | Target 5k searched (~162 remaining) |
| Pair review pending | ~0 rows (Paper/Accel batch verified) | `npm run outcomes:review -- --list` |

**Retrospective reconcile (diagnostic, not claim):** `candidate_generation_miss` ~833 rows — actual funder often never entered pre-event match pool / top-5. Do **not** retune GOD/fit until candidate inventory is fixed.

---

## Scheduled improvement waves

### Wave 1 — Outcomes discovery (weekly, automated)

**Goal:** Turn mature unfunded sealed sets into funded+auditable rows.

| Step | Command | Cadence |
|------|---------|---------|
| Recover URLs | `npm run outcomes:recover-urls -- --apply --limit=150` | With agent |
| Triage queue clocks | `npm run outcomes:triage-queue -- --apply --park-weak --target=5000` | Daily / pre-agent (includes **mature unfunded Hit@5** priority boost) |
| Inference search | `npm run outcomes:agent -- --apply --limit=400 --delay=400` | GitHub Actions ~20m or manual |
| Promote issuer hits | `npm run outcomes:promote-ledger -- --apply` | After search |
| Review high-tier | `npm run outcomes:review -- --list` / `--apply --verify` | Human or agent |

**Success:** `funding_evidence_events` with verified/corroborated + `participant_list_complete`; then corroborate + coverage resolve.

### Wave 2 — Roster unlock (per batch PR)

**Goal:** Convert funded-but-indeterminate → audited miss/hit.

```bash
npm run funding:participants:prediction-linked -- --apply --limit=150
npm run funding:participants:seed-indeterminate -- --apply
node scripts/ingest-audited-funding-events.mjs --apply
node scripts/corroborate-funding-evidence-rounds.mjs --apply
npm run funding:coverage:investors:resolve:apply
npm run funding:repair:organization-links:apply
```

**Rules:** Audited `source_title` must pass `classifyFundingEvidence`; event must be **after** `predicted_at`. Reject junk (reviews, listings, rumors, roundups) in `seed-indeterminate-funding-participants.mjs`.

### Wave 3 — Identity cohort (47 exclusions)

**Goal:** Bring excluded sets into serve-grade sealed cohort.

```bash
node scripts/repair-top-god-identity-cohort.mjs --apply
# then rescore affected startups (manual / batch GOD) before re-freeze snapshots
```

Re-score startups marked `repair_and_rescore` before expecting Hit@5 movement.

### Wave 4 — Candidate pool (engineering)

**Goal:** Reduce `candidate_generation_miss` in reconcile.

- Expand `server/lib/frequentLedgerFunders.js` from `npm run funding:audit:candidate-misses` → `topNeverPreMatched`
- Reserve historical-fit / prior-relationship slots before top-50 cut (`instantSubmit`, match-regenerator)
- Drain `not_in_universe` via canonicalize + `seed-missing-funding-investor-profiles.mjs`

**Do not** retune GOD/fit weights until Wave 4 shows up in claim inventory.

### Wave 5 — Horizon maturity (calendar)

**Goal:** No new code; time unlocks pending funded sets already in audited totals.

- ~150 sets mature within 30d (2026-08-26 horizon batch)
- Pending funded (~21) already counted in 71 audited — maturity does not add new startups by itself

### Wave 6 — Pair-level proof (parallel track)

**Goal:** Grow verified `match_validation_evidence` for matched-investment narrative.

- Target: 5k qualified+URL startups searched (`outcomes:agent` progress)
- Admin: `https://pythh.ai/admin/match-outcomes`
- Pair verified count should track with ledger promote + human review

---

## After each wave — audit checklist

```bash
npm run funding:match-funding-audit
npm run funding:claim-readiness -- --summary
npm run funding:hit5:startup-report -- --horizon=180
npm run funding:reconcile:historical:summary
node --test tests/funding-evidence-ledger.test.mjs
```

Compare:

1. `verified_post_prediction_pairs` (pair layer)
2. `audited_outcomes` / hits / misses (Hit@5)
3. `mature_unfunded` (triage)
4. `candidate_generation_miss` (reconcile)

---

## Known blockers (do not chase)

| Pattern | Why skip |
|---------|----------|
| Aug 2026 bulk snapshots with funding **before** `predicted_at` | Temporal rule — Remepy, Meduloc, SiteVue, Alloy |
| Meridian Feb raise vs Feb 15 `predicted_at` | Announce before prediction clock |
| Public listings / block trades / product reviews | Reject in seed script |
| Classifier-unsafe ingest titles (`nabs`, `bags`) | Fix title or event stays unfunded |

---

## Claim readiness gate

| Requirement | Status |
|-------------|--------|
| ≥100 audited outcomes | 71 / 100 |
| ≥85% hit rate among audited | ~13% (not claim-ready) |
| Immutable prediction clock | Enforced |
| Serve-grade identity | 47 still excluded |

**Product claim stays blocked** until inventory ≥100 audited; hit-rate work follows candidate inventory, not copy tweaks.
