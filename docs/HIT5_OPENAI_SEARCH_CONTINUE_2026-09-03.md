# Hit@5 OpenAI search continue — 2026-09-03

Continues the free-path drain (PR #112). Boosted pending was already **0**; search only
loads `pending|error` with `priority > 0`, so the next web-search pass saw `jobs: 0`
without a reopen. Gemini credits remain depleted — this wave uses OpenAI.

## Commands

```bash
# Reopen mature-unfunded empties (priority >= 55k) without DATABASE_URL, then search
npm run outcomes:search-funding -- --provider=openai --requeue-priority-empty --min-requeue-priority=55000 --apply --limit=50 --delay=800
npm run funding:claim-readiness -- --summary
```

`--requeue-priority-empty` is the Supabase-REST substitute for
`outcomes:triage-queue` when `DATABASE_URL` is unset. It does **not** reopen parked
(`priority <= 0`) rows.

## Queue before this wave

| Bucket | Count |
|--------|------:|
| High-priority pending | **0** |
| Complete + zero-result, priority ≥ 55k | **3,099** |
| Parked pending | 9,864 |
| Verified funding pairs | 104 |
| Pending review | 0 |

## OpenAI wave (limit 50)

| Metric | Value |
|--------|------:|
| Requeued (priority ≥ 55k empty) | 3,098 |
| Jobs / completed | 50 / 32 |
| Events written (`openai_web_search`) | 25 |
| Post-prediction pairs | **0** |
| Parse-error jobs | 18 (narrated “no rounds found”) |

Parse errors are now treated as empty `{"events":[]}` so they mark **complete**
instead of `error`. Prompt also asks for empty JSON when nothing is found.

### Real-looking hits (startup named in title)

- **Atorie** — TechCrunch “raises $9.5M” (Night Capital, a16z Speedrun; Jeremy Liew unresolved)
- **Transfyr** — first-party `$25M` seed (GC, Lux, SV Angel, Breakout, Neo, MVP; Lyda Hill / Underscore / Factory unresolved). Stored website is `transfyr.com`; article is `transfyr.ai`.
- **Lupin Dental** — €15M Series A (Fynveur resolved)
- **HERP** — Series C follow-on (JIC unresolved)
- **Eisen** — $18.5M (MissionOG resolved)
- **Curql** — Wagmo strategic investment (classifier-borderline)

Pairs stayed 0 because `upsertPairEvidence` requires a **pre-event**
`startup_investor_matches` row. These are candidate-generation misses, not rank misses.

### Rejected / polluted attachments (now gated)

OpenAI attached the **wrong company’s** article when the query name was generic:

| Queue name | Article actually about |
|------------|------------------------|
| Arintra | Retro $21M (Thrive / Positive Sum) |
| Korea Development | NdotLight / Airbility PR Newswire |

`persistWebSearchEvents` now requires the startup name (or site brand) in
`source_title` + `source_url`, drops events on/before `earliest_match_at`, and
skips junk investor labels (`New and existing angels`, `undisclosed`, …).

### Hunt-queue junk still in priority ≥ 55k

This batch also searched Miss Universe, SPIR-V, GLSL, Brent Kovar, Gavin Potenza,
Korea Development. They are qualified+url with a mature clock — park via
`outcomes:triage-queue --park-weak` when `DATABASE_URL` is available.

## Claim inventory

Sealed Hit@5 audited N is unchanged by this pass (events are search_results, not
yet trusted ledger rounds with complete rosters). Next:

1. Ingest classifier-safe titles (Atorie / Transfyr / Lupin / HERP) via
   `funding:ingest:audited:apply` + participants + corroborate.
2. Keep draining OpenAI on the remaining ~3k requeued mature-unfunded jobs
   (`--limit=50` waves). Do **not** pass `--requeue-priority-empty` again unless
   the high-priority pending queue is empty.
3. Promote-ledger still needs `DATABASE_URL` (7-day complete-status hold from #112).

See `docs/HIT5_IMPROVEMENT_ROADMAP.md`, `docs/HIT5_WAVE2_ROSTER_UNLOCK_2026-09-01.md`.
