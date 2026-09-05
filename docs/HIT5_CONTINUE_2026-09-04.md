# Hit@5 continue — 2026-09-04

Follows `docs/HIT5_OPENAI_SEARCH_CONTINUE_2026-09-03.md` and the free-path drain (PR #112).

## Context at start of this turn

| Item | Value |
|------|------:|
| PR #112 (search exit + promote reopen fix) | **Merged** |
| Boosted pending | 0 (then triage reopened ~2.7k mature Hit@5 empties) |
| High-priority complete empties past 7d hold | **0** (earliest hold release ~2026-09-10) |
| Sealed Hit@5 @180d | 72 audited (10/62), 1 indeterminate |
| Gemini probe | Healthy again |

## What ran

1. **`hit5:wave:apply`** — roster / org-link / audit chain (no audited N change).
2. **`outcomes:triage-queue --apply --park-weak`** — boosted ~2.7k mature-unfunded Hit@5 empties back to pending.
3. **Gemini search** — 2×50 jobs (`--provider=gemini --apply`); ~9 events total, **0** post-prediction pairs.
4. **SSOT RSS scrape** + evidence apply + participants + correlate `--apply` + promote-ledger — promote upserted 0 new verified pairs; boosted 18 issuer-ledger rows.
5. **Inference search** — 100 jobs; 0 events (Google News RSS mostly empty / some 503s).
6. **`funding:participants:seed-indeterminate --apply --limit=50`** + ingest/corroborate/coverage/repair — wrote many rosters; audited N still 72 until Yardstik unlock.
7. **Yardstik indeterminate unlock** — Series B $30M (post-`predicted_at`):
   - Lead: Harbert Growth Partners
   - Also: Rally Ventures, MissionOG, Crosslink Capital, Grotech Ventures, Great North Ventures
   - Sources: yardstik.com press, Gunderson client note, Ventureburn
   - Marked `participant_list_complete` on both corroborating events
   - Result: **confirmed_miss** (predicted top-5 had no overlap)

## Claim inventory after this turn (180d)

| Metric | Before | After |
|--------|-------:|------:|
| Funded observed | 73 | 73 |
| Audited | 72 | **73** |
| Hits / misses | 10 / 62 | **10 / 63** |
| Indeterminate | 1 | **0** |
| Gap to 100 audited | 28 | **27** |
| Observed Hit@5 rate | ~13.9% | ~13.7% |
| Claim ready | no | no |

Pair layer: **107** verified post-prediction pairs / 45 startups. Review inbox: **0**.

## Queue after this turn

Boosted pending still ~2k+ from triage reopen (Gemini/inference draining). Do **not** pass `--requeue-priority-empty` until **2026-09-10** (7-day complete hold).

## Next ops

1. Keep Gemini/OpenAI waves (`--limit=50`) on boosted pending; park junk names (public cos / agencies leaked: GSA, HCLTech, Baker McKenzie, …).
2. After **2026-09-10**, `--requeue-priority-empty --min-requeue-priority=55000` for the ~2.9k complete empties.
3. More Wave-2 roster unlocks on mature funded-but-incomplete events (same path as Yardstik) — fastest audited-N growth.
4. Candidate-generation miss work remains the structural Hit@5 bottleneck (`reconcile cand-gen miss` ~1.7k); do not retune GOD from legacy 42% folklore.
