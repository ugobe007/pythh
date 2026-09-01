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
npm run outcomes:search-funding -- --provider=gemini --apply --limit=100 --delay=400
# or mature-unfunded / proof-cohort scoped variants
npm run funding:participants:seed-indeterminate -- --apply
npm run funding:claim-readiness -- --summary
```

See also: `docs/HIT5_IMPROVEMENT_ROADMAP.md`, `docs/HIT5_WAVE5_WAVE6_2026-09-01.md`.
