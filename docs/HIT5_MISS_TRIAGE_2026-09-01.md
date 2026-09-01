# Hit@5 miss triage — 2026-09-01

Ops snapshot after matching pipeline waves **[1] drain → [2] participants → [3] seed VCs + rematch**.

**Commands used**

```bash
npm run funding:hit5:startup-report -- --horizon=180 --with-reconcile
npm run funding:reconcile:historical:summary
npm run funding:claim-readiness -- --summary
```

---

## Claim inventory (180d sealed Hit@5)

| Metric | Value |
|--------|------:|
| Sealed prediction sets | 2,212 |
| Mature / pending | 811 / 1,401 |
| Funded startups in horizon | 71 |
| Confirmed hits / misses | **9 / 62** |
| Indeterminate funded | 0 |
| Hit rate among audited | **~12.7%** |
| Claim ready | **No** |

**Claim blockers:** needs 29 more audited outcomes; observed rate and 95% CI lower bound both far below 85% target.

---

## Retrospective reconcile (diagnostic only)

| Delta reason | Count | Meaning |
|--------------|------:|---------|
| `candidate_generation_miss` | **946** | Actual funder never in pre-event match pool / top-5 |
| `post_event_match_not_prediction` | 350 | Match exists only after the round (not a prediction) |
| `ranked_outside_top_five` | 12 | Funder was matched pre-event but ranked >5 |
| `top_five_hit` | 3 | Directional top-5 hit |

Directional / audited reconcile hit@5 ≈ **4.8% / 5.9%** (legacy scores may have been updated later — not claimable).

**Hard rule:** Past Hit@5 cannot improve by backdating. `created_at` / `predicted_at` is the prediction clock.

---

## Miss patterns (62 confirmed misses)

1. **Pool miss, not rank miss** — Only 12 reconcile rows are `ranked_outside_top_five`. The gap is inventory / candidate generation, not GOD retune.
2. **Brand funders still missed** — Frequent actuals among misses include Y Combinator (5), Andreessen Horowitz (5), Goodwater, RTP Global, ICONIQ, MaC, Eclipse, Accel, Jane Street, NVIDIA. ~17/62 misses involve a well-known brand funder who was not in the sealed top-5.
3. **Long-tail / geo specialists dominate the rest** — ~45/62 misses have actuals outside the usual US mega-fund set (EU bio, Korean co-leads, corp venturing, regional seeds).
4. **Prediction slate is sticky** — Many miss top-5s recycle the same early-stage names (Initialized, Fifty Years, Blue Collective, Founders Factory NY) that do not overlap the eventual syndicate.

### Confirmed hits (for contrast)

Cognition (GC, Founders Fund), Dust (Sequoia), Isomorphic Labs (Thrive), Jump (Insight), Legora (Accel), OpenRouter (Menlo), Replit (YC), Saronic (a16z), Upscale AI (Salesforce Ventures).

---

## What [1]–[3] moved vs what they cannot move

| Wave | Result | Hit@5 effect |
|------|--------|--------------|
| [1] Drain unmatched high-GOD URLs | 4 new matches | Prospective only |
| [2] Participant completeness | 67 events complete, 244 participants written; prediction-linked enrich still blocked on CF/cached bodies | Unlocks auditability, not past top-5 |
| [3] Seed VCs + rematch | 15 created + 3 reactivated; 49 startups rematched / 2,450 matches upserted | Improves **future** candidate pools; rematches after event stay `post_event_match_not_prediction` |

---

## Next ops (forward-looking only)

1. **Wave 4 candidate pool** — expand frequent ledger funders / never-pre-matched inventory; reserve historical-fit slots before top-50 cut (`docs/HIT5_IMPROVEMENT_ROADMAP.md`).
2. Keep draining outcomes + participant completeness so audited N reaches 100.
3. Do **not** retune GOD/fit weights until `candidate_generation_miss` falls in reconcile on *new* sealed sets.
4. Tighten drain junk filters (HTML debris / person sites still slipped into [1]).

See also: `docs/HIT5_IMPROVEMENT_ROADMAP.md`.
