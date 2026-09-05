# Funding search policy

**Order is the product.** Scrapers find funding, M&A, and other news more reliably than
paid LLM web search, and they do not spend Anthropic/OpenAI tokens. Paid models are a
last resort when the free path found nothing.

Companion: [`funding-evidence-ledger.md`](./funding-evidence-ledger.md),
[`FUNDING_SOURCE_ONTOLOGY.md`](./FUNDING_SOURCE_ONTOLOGY.md),
[`PYTHH_SCRAPERS_PARSERS_WORKFLOW.md`](./PYTHH_SCRAPERS_PARSERS_WORKFLOW.md).

## Core scraper sources

These publisher homepages are first-wave RSS (or Google News `site:` when the
first-party feed is dead / Cloudflare-blocked). Canonical list:
`lib/coreFundingRssSources.mjs`. Apply with
`npm run rss:ensure-core -- --apply`.

| Homepage | Fetchable feed | Status |
|----------|----------------|--------|
| https://news.crunchbase.com | `/feed/` | First-party RSS |
| https://techcrunch.com/category/startups/ | `/feed/` | First-party RSS |
| https://www.producthunt.com | `/feed` | First-party Atom |
| https://dealroom.co/news/ | Google News `site:dealroom.co` | CF 403 on first-party |
| https://www.angellist.com | Google News `site:angellist.com` / wellfound | No RSS (HTML catch-all) |

Do **not** store these hosts as a startup `website`. They are news sources.

## Required order

```text
1. Scrapers (SSOT RSS + simple RSS + scheduled discovery)
   → startup_events / discovered_startups / funding_evidence_events
2. Inference engine (Google News RSS + extractors + ledger-seeded URLs)
3. Ontology public sources (SEC Form D, NSF/SBIR, USASpending)
4. Paid AI web search (Anthropic, then OpenAI) — only if steps 1–3 found no events
```

Do **not** start a hunt with Anthropic or OpenAI. That was the cascade mistake:
every queue row paid for a model call before RSS/inference ran.

`--provider=anthropic`, `--provider=openai`, and `--provider=gemini` remain
explicit overrides for a single paid hop. The default search and CI agent stay
free (`inference` / `ontology`). `--provider=cascade` now follows this policy.

## Why this order

| Step | What it finds | Cost |
|------|----------------|------|
| RSS scrapers | Funding, M&A, launches, partnerships from curated feeds | Free (fetch + parsers) |
| Inference | Post-prediction news via Google News RSS, wire-site queries, article body match | Free |
| Ontology | Form D, grants, awards | Free (public APIs) |
| Anthropic / OpenAI web search | Residual gaps after the free path | Tokens — last resort |

The ledger resolver is already inference-first: OpenAI runs only for ambiguous
items (`funding-evidence-ledger.md`). Hunt-queue search must match that rule.

## Commands

| Intent | Command |
|--------|---------|
| Scheduled drain (CI / agent) | `npm run outcomes:agent` → `--provider=ontology` |
| Manual free search | `npm run outcomes:search-funding -- --apply --limit=100` |
| Policy cascade (free, then paid if empty) | `npm run outcomes:search-funding:cascade -- --apply --limit=50 --delay=1200` |
| Force one paid provider | `npm run outcomes:search-funding:openai` or `:anthropic` |

Skip paid automatically when inference/ontology writes events, pairs, or ledger
rows. Junk names are parked before any paid call (`--skip-junk-names` is default
on cascade).

## Do not

- Reorder cascade to paid-first to “get more hits.”
- Use `--provider=gemini` unless prepaid credits are restored.
- `--requeue-priority-empty` on a fresh complete-zero batch (7-day hold).
- Treat scraper M&A/listing headlines as equity Hit@5 (`classifyFundingEvidence`).
