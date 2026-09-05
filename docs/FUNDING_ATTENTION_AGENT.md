# Funding-attention agent

**Status:** live pipeline (pattern extract + pattern logic, no paid model)  
**Command:** `npm run funding:attention` · `npm run funding:attention:patterns`

This is **not** `research:agent` (`agents/research/`). That loop is a product/growth survey
(signup friction, 100 signups/day). This agent answers a different question:

> When a trusted announcement says a startup raised, *why did the funding happen,
> what triggered the investor, and which later checks follow a well-known lead
> or a personal angel sidecar?*

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

Extracted from `source_title` + `metadata.funding_evidence_excerpt` (and other excerpt/body fields) + participant evidence phrases:

| Aspect | Example language | Startup signal |
| --- | --- | --- |
| `customer_growth` | customer growth, 2,000 logos, ARR doubled | `revenue_signal` |
| `hiring` | hiring engineers, appointed a CTO | `hiring_signal` |
| `unique_tech` | proprietary platform, unique technology | `product_signal` |
| `board` | joins the board, board seat | `hiring_signal` |
| `partners` | strategic partnership, partnered with | `partnership_signal` |
| `product_rev` | launched a product, GA, product update | `product_signal` |
| `use_of_proceeds` | raises $X to scale/build/expand … | `growth_signal` |
| `revenue_growth` | 3x ARR, revenue growth, YoY ARR | `revenue_signal` |
| `product_market_fit` | product-market fit, inbound demand, waitlist | `product_signal` |
| `customer_access_partnership` | distribution / channel partner that unlocks customers | `partnership_signal` |

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

## Pattern logic (`npm run funding:attention:patterns`)

Runs on stamped verified/corroborated events. Does not call a model.

| Question | Rule |
| --- | --- |
| Why did this funding take place? | Ranked triggers; primary prefers revenue growth, then PMF, then customer-access partnerships |
| What triggered the investor? | Same announcement aspects attached to each resolved participant |
| Do others follow a well-known firm? | Later verified event after Sequoia/a16z/Accel/… already appeared. Same-event syndicates are co-invest, not follow |
| Partner as angel vs firm? | Person on the roster **without** their firm → personal/scout check. Firm present → fund check |
| Founder-angels | Known operator-founders (Altman, Chesky, …) or founder-exit language on an individual profile |

`--apply` writes `investors.signals.observed_thesis.patterns` only.

## Commands

```bash
npm run funding:attention
npm run funding:attention -- --apply --limit=100
npm run funding:attention:patterns
npm run funding:attention:patterns -- --apply --limit=400
npm run test:funding-attention
```

v2 re-extracts v1 stamps so the new trigger classes land. Same event id replaces
its investor contribution (no double-count). `--force` ignores version.
