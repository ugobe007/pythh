# Inference & Enrichment — Known Issues & Improvement Plan

Core to Pythh: identifying startups, investors, and their signals. This doc captures current gaps and planned fixes.

---

## 1. "[0] data collected" — Why enrichment returns nothing

### Where it happens

- **Console logs**: `[inference] Quick enrichment for "StartupName": 0 fields in 200ms`
- **enrich-sparse-startups**: `News: 0 fields (N articles)` (articles found but no useful data extracted)
- **instantSubmit**: `News enrichment: No data found (N articles)`

### Root causes

| Cause | What happens |
|-------|--------------|
| **No articles found** | `searchStartupNews()` queries Google News RSS; returns 0 if no matching articles |
| **Articles found, but filtered out** | `filterArticlesByName()` drops articles that don't mention the startup name |
| **Articles found, but extraction yields nothing** | `extractDataFromArticles()` uses regex patterns; no match → 0 fields |
| **Timeout** | `rss-parser` had a **4s** HTTP timeout that often fired before Google News responded; `parseWithDeadline` must be ≥ parser timeout. Batch script uses ~25s for `quickEnrich`. |
| **503 / rate limit** | Google News RSS returns HTTP 503 when rate-limited. We retry up to 3 times with 5s backoff, run 1 startup at a time, and pause 3s between startups. |
| **Bad startup names** | Names like "Anthropic Introduced", "Gryphon-backed ACA" don’t match real article text |

### News source: Google News RSS, not full Google Search

We use **Google News RSS** (`https://news.google.com/rss/search?q=...`), not a full web search:

- RSS is curated, delayed, and indexed differently
- Queries are exact-phrase (e.g. `"StartupName" startup funding`)
- Google Search often finds pages RSS doesn’t index

That’s why manual Google Search can find companies we miss.

---

## 2. Verb-centric extraction (lib/verbCentricExtractor.js)

The **verb** anchors the sentence. We extract the SUBJECT or OBJECT the verb acts on — the company — not adjectives or descriptors.

- **Subject-Verb**: "Mattilda raises $50M" → Mattilda (subject does the action)
- **Verb-Object**: "Sequoia backs Halter" → Halter (object receives the action)
- **Descriptor stripping**: "Mexican edtech Mattilda" → Mattilda (strip sector adjective, keep proper noun)

Used by: `headlineExtractor.js`, `extractCompanyNameFromHeadline` (inference-extractor).

---

## 3. News search flow — Where it can fail

### Flow

```
searchStartupNews(name, website)  →  filterArticlesByName(articles, name)  →  extractDataFromArticles(articles, currentData, name)
```

### Failure points

1. **Query construction**  
   - Single-word names (e.g. "Scalar", "Rymo") are treated as ambiguous; we prefer domain-based queries.  
   - If there’s no website, we fall back to `"Name" startup funding` — may return nothing for odd names.

2. **filterArticlesByName**  
   - Keeps only articles where title/content contains the normalized name.  
   - "Anthropic Introduced" → we look for "anthropic introduced" or "anthropic" (short match ≥4 chars).  
   - Headlines often say "Anthropic" or "Anthropic AI"; "Anthropic Introduced" rarely appears → articles dropped.

3. **extractDataFromArticles**  
   - Uses `extractFunding`, `extractSectors`, `extractExecutionSignals`, `extractTeamSignals`, `extractCompanyUrlFromArticles`.  
   - All are regex/pattern-based; many article styles don’t match → 0 fields.

4. **Name→domain inference**  
   - `inferDomainFromName()` tries `slug.com`, `slug.ai`, etc. and does HTTP HEAD checks.  
   - Works for clean names (e.g. "Anthropic" → anthropic.com), not for "Anthropic Introduced" or "Gryphon-backed ACA".

---

## 3. Current news correlation behavior

We **do** use news for lookups:

- **inferenceService.js** → `searchStartupNews()` → Google News RSS  
- **quickEnrich()** → search → filter → extract  
- **quickEnrichWithVC()** → same, with VC name in the query

We do **not** use:

- Full Google Search / Custom Search API  
- Bing / DuckDuckGo  
- SerpAPI or similar search APIs

RSS is free and stable but has narrower coverage than search.

---

## 4. Recommended improvements

### A. Loosen / fix name matching in `filterArticlesByName`

- For garbage names like "Anthropic Introduced", extract a usable token (e.g. "Anthropic") before matching.  
- Allow first significant token (≥4 chars) to match, not only full/short normalized name.

### B. Add more extraction patterns

In `extractDataFromArticles` / `lib/inference-extractor.js`:

- "X secures $XM"  
- "X raises $XM from [Investor]"  
- "investment in X"  
- "X, a [sector] startup"  
- Handle list-style headlines: "Top 10: X, Y, Z raised..."

### C. Normalize bad startup names before search

- "Anthropic Introduced" → search for "Anthropic"  
- "Startup Cloaked" → search for "Cloaked"  
- "Privacy Startup Cloaked" → search for "Cloaked"  
- Strip common prefixes: "Startup X", "Y-backed X", "PE targets X".

### D. Optional: Add real search API

- Google Custom Search JSON API or SerpAPI for cases where RSS returns 0.  
- Use only when RSS fails; keep RSS as default for cost/rate limits.

### E. Improve logging and observability

- Log query used, article count before/after filter, and which extractors matched.  
- Add a `DEBUG_INFERENCE=1` mode for troubleshooting.

---

## 5. Script-specific notes

### enrich-sparse-startups.js

- Processes in chunks (default 200); use `--run-all` to drain the pool.  
- Uses `quickEnrich()` (Google News RSS).  
- "No sparse startups found" with `Raw query returned 1` usually means the single startup has `total_god_score >= 70` or doesn’t pass the phase filter.  
- Use `--include-holding` to retry startups that previously failed.

### instantSubmit (URL submission bar)

- Step 1: Fetch URL HTML → `extractInferenceData()`  
- Step 2: If still sparse → `quickEnrich()`  
- If the URL is junk or blocks scrapers, step 1 yields little and step 2 may still return 0.

### discover-more-startups / simple-rss-scraper

- Use `extractCompanyName` (headlineExtractor) or `extractCompanyNameFromHeadline` (inference-extractor).  
- Many headlines don’t match current patterns → company name is null → item skipped.  
- See `STARTUP_REVIEW_REMEDIATION_PLAN.md` for more patterns and wiring.

---

## 6. Immediate debugging steps

1. **Check what quickEnrich is doing**  
   - In `inferenceService.js`, temporarily log:  
     - Query sent to Google News  
     - Raw article count  
     - Count after `filterArticlesByName`  
     - Fields added by `extractDataFromArticles`

2. **Test with a known-good name**  
   - e.g. "Stripe" or "Anthropic" — should return articles and some fields.

3. **Test with a bad name**  
   - e.g. "Anthropic Introduced" — observe how many articles pass the filter.

4. **Inspect startup names in DB**  
   - Many sparse startups have headline-like or fragment names; these break search and matching.

5. **Enable DEBUG mode**  
   - `DEBUG_INFERENCE=1 node scripts/enrich-sparse-startups.js --limit=5`  
   - Logs: normalized search token, query used, raw vs filtered article counts, and when 0 fields come from N articles.

---

## 7. Related files

| File | Purpose |
|------|---------|
| `server/services/inferenceService.js` | `quickEnrich`, `searchStartupNews`, `extractDataFromArticles` |
| `lib/inference-extractor.js` | `extractFunding`, `extractSectors`, `extractInferenceData` |
| `lib/headlineExtractor.js` | `extractCompanyName` (RSS discovery) |
| `scripts/enrich-sparse-startups.js` | Batch enrichment for sparse startups |
| `server/routes/instantSubmit.js` | Real-time URL submission + enrichment |
| `docs/STARTUP_REVIEW_REMEDIATION_PLAN.md` | Headline extraction and discovery improvements |
