# Funding-attention agent

**Status:** live pipeline (pattern extract, no paid model)  
**Command:** `npm run funding:attention` (dry-run) · `npm run funding:attention -- --apply --limit=100`

This is **not** `research:agent` (`agents/research/`). That loop is a product/growth survey
(signup friction, 100 signups/day). This agent answers a different question:

> When a trusted announcement says a startup raised, *what did the press / issuer
> say the money was for — and which resolved investors sat on that same event?*

That is ontology **P3**: observed thesis from verified participations
(`docs/FUNDING_SOURCE_ONTOLOGY.md` §2.4 / §8).

## What it writes

| Target | Field | Rule |
| --- | --- | --- |
| `investors.signals` | `observed_thesis` | Per-event aspects + verified co-investors |
| `investors.signals` | `top_themes` | Union of existing themes + aspect labels |
| `pythh_signal_events` | aspect `primary_signal` | Only if `pythh_entities` already exists for the startup |
| `funding_evidence_events.metadata` | `funding_attention_extracted_at` | Idempotency stamp |

Startup GOD already loads `pythh_signal_events` *before* `calculateHotScore`
(`lib/signalInformedGod.js`). Investor GOD already adds +1 / +3 profile points
when `signals.top_themes` has ≥1 / ≥3 items (`lib/investorGodScore.js`). Filling
those rows is **data completeness**, not a weight retune.

## Aspect taxonomy

Extracted from `source_title` + metadata excerpt/body + participant evidence phrases:

| Aspect | Example language | Startup signal |
| --- | --- | --- |
| `customer_growth` | customer growth, 2,000 logos, ARR doubled | `revenue_signal` |
| `hiring` | hiring engineers, appointed a CTO | `hiring_signal` |
| `unique_tech` | proprietary platform, unique technology | `product_signal` |
| `board` | joins the board, board seat | `hiring_signal` |
| `partners` | strategic partnership, partnered with | `partnership_signal` |
| `product_rev` | launched a product, GA, product update | `product_signal` |

Firm-name “X Partners”, onboard/keyboard/dashboard, and hiring-freeze copy are rejected.

## Source gate

An event is eligible when:

1. `verification_status` is `verified` or `corroborated`, **or**
2. `assessFundingSource` marks the publisher/domain trusted

Rejected / junk rows are skipped. Co-investor notes require **verified or
corroborated** status **and** ≥2 resolved same-event participants. Unverified
co-mentions do not become `CO_INVESTED_WITH` edges.

## What it never does

- Overwrite `investment_thesis`, bio, sectors, or check size (news prose is not a stated thesis)
- Create `pythh_entities`
- Call Anthropic / OpenAI (paid search stays last per `docs/FUNDING_SEARCH_POLICY.md`)
- Change `GOD_SCORE_CONFIG` or match-fit weights
- Invent a new SQL table (Supabase Preview history is fragile)

## Commands

```bash
npm run funding:attention
npm run funding:attention -- --apply --limit=100
npm run funding:attention -- --event-ids=<uuid> --apply
npm run test:funding-attention
```

Re-runs skip stamped events unless `--force`. The same event id replaces its
contribution on an investor (no double-count).
