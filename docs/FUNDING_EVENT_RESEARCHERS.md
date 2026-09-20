# Funding-event researchers

**Status:** live pipeline (pattern extract, no paid model by default)  
**Command:** `npm run funding:research` · `npm run funding:research -- --apply --limit=80`

This is **not** `research:agent` (product/growth survey) and it is broader than
`funding:attention` (why-aspects only). Four specialists research a trusted
`funding_evidence_events` row and write a structured briefing.

| Researcher | Answers |
|---|---|
| `round_economics` | How much was raised, valuation (pre/post when stated), round type, instrument |
| `why_funded` | Why the check was written (attention aspects + use of proceeds + quotes) |
| `problem_team` | Problem / value prop, founders, technical cofounder, team signals |
| `participation` | Lead, roster, named check amounts (“X invested $5M”) |

## What it writes

| Target | Field | Rule |
|---|---|---|
| `funding_evidence_events.metadata.funding_intelligence` | Full briefing | Idempotent on `funding_intelligence_version` |
| `funding_evidence_events.amount_usd` / `round_type` | Only if currently null | Never overwrite a stored raise |
| `pythh_signal_events` | problem / team / fundraising | Only if `pythh_entities` already exists |

Startup GOD already loads `pythh_signal_events` before `calculateHotScore`
(`lib/signalInformedGod.js`). Filling those rows is **data completeness**, not a
weight retune.

## Source gate

Same as funding-attention: `verified` / `corroborated`, or
`assessFundingSource` trusted. Rejected / junk rows are skipped.

## What it never does

- Overwrite `investment_thesis`, bio, sectors, or check size
- Create `pythh_entities`
- Call Anthropic / OpenAI unless `--provider=cascade` **and** the free briefing is empty
- Change `GOD_SCORE_CONFIG` or match-fit weights
- Rematch or rewrite prediction clocks

## Commands

These scripts are on the **repo root** `package.json` (and proxied from `site/` so Vite’s cwd works). They are **not** on `main` until this PR is merged — check out the branch first.

Mac clone (not `/workspace`):

```bash
cd ~/Desktop/hot-honey
git fetch origin cursor/funding-event-researchers-592e
git checkout cursor/funding-event-researchers-592e
npm run funding:research
```

From `site/` the same `npm run funding:research` now works. Absolute fallback:

```bash
node ~/Desktop/hot-honey/scripts/research-funding-events.mjs --limit=20
```

Apply / targeted:

```bash
npm run funding:research -- --apply --limit=80
npm run funding:research -- --apply --event-ids=<uuid>
npm run test:funding-research
```

The resolution loop runs a dry-or-apply research step on Hit@5 waves
(every 5 waves) after audited ingest.
