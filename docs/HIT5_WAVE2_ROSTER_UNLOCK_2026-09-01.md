# Hit@5 Wave 2 roster unlock — 2026-09-01

Ops pass: convert funded-but-incomplete rosters → auditable Hit@5 outcomes.  
Gemini/news search (**Wave 1 discovery**) deferred pending credits.

**Commands**

```bash
npm run funding:participants:prediction-linked -- --apply --limit=150
npm run funding:participants:seed-indeterminate -- --apply
npm run funding:participants -- --apply --limit=150
npm run funding:ingest:audited:apply
npm run funding:corroborate:apply
npm run funding:coverage:investors:resolve:apply
npm run funding:repair:organization-links:apply
npm run funding:claim-readiness -- --summary
npm run funding:hit5:startup-report -- --horizon=180 --with-reconcile
```

---

## Results

| Step | Outcome |
|------|---------|
| prediction-linked enrich | 150 scanned; **0** proven (CF/fetch failures on linked bodies) |
| seed-indeterminate | **95** events seeded from curated audited seeds |
| participants enrich | 150 scanned; **71** marked complete; **223** participants written |
| ingest audited | **26** events applied |
| corroborate | **12** events updated; 377 corroborated rounds (2,249 already current) |
| coverage resolve | **97** participants resolved → existing profiles (508 still unresolved) |
| org repair | **15** safe membership links; 21 withheld |

---

## Claim inventory (180d) — before → after

| Metric | Before | After |
|--------|-------:|------:|
| Mature / pending | 818 / 1,394 | 818 / 1,394 |
| Funded in horizon | 71 | 71 |
| Hits / misses | 9 / 62 | 9 / 62 |
| Audited outcomes | **71** | **71** |
| Indeterminate funded | 0 | 0 |
| Hit rate | ~12.7% | ~12.7% |

**Why audited N did not move:** the sealed funded cohort already had complete/audited rosters (0 indeterminate). Wave 2 improves identity resolution and backfills participants on known events — it does **not** invent new post-prediction funding for the 759 mature-unfunded hunt queue.

Reconcile after resolve: `candidate_generation_miss` **1134** (up from ~946) — more resolved actual funders now count as pool misses. Expected until Wave 4 force-includes land on **new** seals.

---

## Blockers for next lift

1. **Need funding evidence on mature-unfunded** — Gemini/news search (user buying credits) on the triage-boosted queue from Wave 6 (`boosted_mature_unfunded_hit5` ~3.2k).
2. prediction-linked body fetch still mostly blocked (Cloudflare / empty caches).
3. Remaining unresolved participants (~508) are mostly long-tail / junk names — do not seed without review.

---

## Next

When Gemini credits are ready:

```bash
# Queue is often empty after ontology search marks mature-unfunded complete.
# Re-triage first so complete+zero-result high-priority rows reopen as pending.
npm run outcomes:triage-queue -- --apply --park-weak --target=5000
npm run outcomes:search-funding -- --provider=gemini --apply --limit=100 --delay=400
npm run outcomes:promote-ledger -- --apply --reject-low-pending --limit=150
npm run funding:participants:seed-indeterminate -- --apply
npm run funding:claim-readiness -- --summary
```

### Gemini run (2026-09-01 evening)

**Why `jobs: 0` first:** search only loads `status IN (pending,error) AND priority > 0`. After Wave 6 ontology, mature-unfunded rows were `complete`; remaining pending were all `parked_weak_identity` at priority 0.

**Fix:** re-ran triage → **2,863** eligible. Gemini then ran:

| Metric | Value |
|--------|------:|
| Jobs / completed | 100 / 99 |
| Events written | 7 (Orthogonal) |
| Post-prediction pairs | 1 (Orthogonal · PR Newswire seed) |
| Verified pairs after promote | **92** (was 91) |
| Hit@5 audited (180d) | still **71** |

Orthogonal pair is real funding evidence; sealed Hit@5 still needs that startup in the mature funded+audited sealed set (or more mature-unfunded discoveries). Keep draining Gemini on the reopened queue.

See also: `docs/HIT5_IMPROVEMENT_ROADMAP.md`, `docs/HIT5_WAVE5_WAVE6_2026-09-01.md`.
