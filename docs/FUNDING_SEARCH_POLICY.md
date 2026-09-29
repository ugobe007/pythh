# Funding search policy

**Order is the product.** Scrapers find funding, M&A, and other news more reliably than
paid LLM web search, and they do not spend Anthropic/OpenAI tokens. Paid models are a
last resort when the free path found nothing.

Companion: [`funding-evidence-ledger.md`](./funding-evidence-ledger.md),
[`FUNDING_SOURCE_ONTOLOGY.md`](./FUNDING_SOURCE_ONTOLOGY.md),
[`FUNDING_ATTENTION_AGENT.md`](./FUNDING_ATTENTION_AGENT.md),
[`FUNDING_EVENT_RESEARCHERS.md`](./FUNDING_EVENT_RESEARCHERS.md),
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
| https://www.geekwire.com/fundings/ | Google News `site:geekwire.com` | `/fundings/feed/` is CF 403 |
| https://topstartups.io | `https://topstartups.substack.com/feed` | `/rss/` is an HTML catch-all; weekly "Who got funded?" is on Substack |

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
| Observed thesis from trusted announcements | `npm run funding:attention` (dry-run) / `-- --apply` |
| Why / follow-the-lead / angel-sidecar logic | `npm run funding:attention:patterns` |

Skip paid automatically when inference/ontology writes events, pairs, or ledger
rows. Junk names are parked before any paid call (`--skip-junk-names` is default
on cascade).

## When paid search cannot run

Anthropic, OpenAI, and Gemini are not required for the hunt. A credit, quota,
or auth error is not a stop. Continue on the **inference engine** (Google News
RSS + extractors, `--provider=inference`). Missing startup or firm websites are
recovered by the **URL search service** (`lib/urlSearchService.mjs`). The agent uses Node
`fetch`, then local Chrome when Google returns a bot wall. The HTML is parsed in
code (`lib/urlSearchService.mjs`, `lib/inference-extractor.js`). Google Web is `https://google.com/search?udm=14&q=`
(classic 10 blue links). Google News is `https://google.com/search?udm=12&q=`
(raw News tab). DuckDuckGo No-AI and Mojeek follow for homepages. The same lookup
is what `outcomes:recover-urls` and investor URL discovery use.
DuckDuckGo No-AI is a form POST to `https://noai.duckduckgo.com/html/`. When that
page is challenged, Google News RSS source URLs fill in. A result is kept only
when the hostname lines up with the firm or person name (or the firm's initials,
such as `bvp.com`). Gemini stays off unless the run passes `--allow-paid`.

Research, growth, and product agent loops follow the same rule: a credit-balance
result runs inference search and URL recovery instead of failing the job.

## Do not

- Reorder cascade to paid-first to “get more hits.”
- Route search through Serper, SerpApi, Tavily, or Brave. Those are keyed APIs.
- Append `-AI` to queries. That drops startups and articles that are about AI.
- Send raw HTML or screenshots to an LLM to parse each page. Layout parsing stays in code.
- Use `--provider=gemini` unless prepaid credits are restored.
- `--requeue-priority-empty` on a fresh complete-zero batch (7-day hold).
- Treat scraper M&A/listing headlines as equity Hit@5 (`classifyFundingEvidence`).
