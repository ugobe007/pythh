# Enrichment Gaps & Alternative Data Sources

**Last audit:** Based on `scripts/audit-scoring-gaps.js` run on 10,592 approved startups.

---

## Executive Summary

- **77% of startups** (8,201) lack the minimum viable dataset (MVD) for proper GOD scoring
- **Potential avg lift:** +12.2 pts if all were enriched (current avg 49.4 → 61.5 for MVD-complete)
- **Biggest gaps:** Traction (67%), hard numbers (90%), product signals (67%), web signals (100%)

---

## Coverage by GOD Score Component

| Component | Missing | Max pts | Impact |
|-----------|---------|---------|--------|
| Industries/Sector | 1% (149) | 1–2 pts | Hot sector = +10 GOD |
| Team data | 2% (166) | 3 pts | Team execution = 0 |
| Market text | 16% (1,725) | 0.5 pts | Problem/solution clarity |
| **Traction (any)** | **67% (7,045)** | **3 pts** | Traction score = 0 or pattern-only |
| **Hard numbers** | **90% (9,552)** | — | Revenue/MRR/users/growth |
| **Product signals** | **67% (7,048)** | **2 pts** | launched/demo/solution |
| **Web signals** | **100% (10,592)** | ~1 pt | DA/backlinks/traffic |

---

## Current Enrichment Methods

| Source | What it fills | Cost | Coverage |
|--------|---------------|------|----------|
| **URL scrape + AI extract** | pitch, tagline, sectors, team, traction text | ~$0.01/page | On submit only |
| **RSS / News** | funding, M&A, stage, company_status | Free | ~Tier 1 domains |
| **Inference engine** | heuristics from text | Free | Sparse |
| **Enrichment orchestrator** | Tiered: meta tags → Playwright → LLM | Gated by GOD | ~10% get Tier 2+ |

---

## Minimum Viable Dataset (MVD)

A startup needs at least:

1. **industries/sectors** — sector match (+10 GOD for hot sector)
2. **problem OR solution** — market/product clarity (+0.5–1 pt)
3. **pitch/description** — traction text pattern scoring
4. **team_size OR team[]** — team execution score
5. **ONE traction signal** — launched / has_revenue / has_customers / revenue / users

---

## Proposed Alternative Data Sources

### Tier A: Free / Low-effort (implement first)

| Source | Fields | Method | Effort |
|--------|--------|--------|--------|
| **JSON-LD / meta tags** | sectors, description, team, funding | Parse existing scrape | Low |
| **Funding round regex** | raise_amount, stage, investors | Heuristics from pitch/tagline | Low |
| **"Launched" / "live" patterns** | is_launched, has_demo | Regex on description | Low |
| **Similar startup inference** | sectors, stage | Infer from investor portfolio overlap | Medium |
| **RSS news expansion** | funding, M&A | More sources, better name matching | Medium |

### Tier B: API / Scraping (paid or rate-limited)

| Source | Fields | Cost | Notes |
|--------|--------|------|-------|
| **Crunchbase API** | funding, team, revenue est, stage, sectors | $49/mo+ | Strong for funding + team |
| **Clearbit Enrichment** | employees, revenue, industry | $99/mo | Domain-based lookup |
| **LinkedIn Company API** | employees, industry | Restricted | Requires partnership |
| **PitchBook** | funding, valuations | Enterprise | Best for later stage |
| **AngelList / Wellfound** | stage, raise, team | Scrape or API | Good for early stage |

### Tier C: Web / traffic signals

| Source | Fields | Method | Notes |
|--------|--------|--------|-------|
| **SimilarWeb** | traffic, engagement | API (paid) | Web signal proxy |
| **Semrush / Ahrefs** | backlinks, DA | API (paid) | SEO = traction proxy |
| **BuiltWith** | tech stack | API | Product signal |
| **Product Hunt** | launches, upvotes | Scrape/API | is_launched, social proof |
| **G2 / Capterra** | reviews, rating | Scrape | Traction, customers |
| **GitHub** | stars, contributors | API | Dev tools only |

### Tier D: LLM / structured extraction

| Source | Fields | Cost | Notes |
|--------|--------|------|-------|
| **Deck PDF parse** | All MVD fields | $0.02/deck | deckUpload already exists |
| **News search + extract** | funding, team, traction | $0.02/query | Per-startup Google/Bing |
| **One-shot LLM profile** | Full MVD | $0.05/startup | "Describe this startup from web" |

---

## Recommended Implementation Order

1. **Improve inference from existing text** — Better regex/heuristics for funding, launched, team size from pitch/tagline/description (no new sources).
2. **Expand RSS/news matching** — Add sources, fuzzy name matching, entity resolution.
3. **Product Hunt / G2 check** — Look up by domain; set is_launched, add traction hints.
4. **Crunchbase API** — If budget allows; highest ROI for funding + team.
5. **Deck-based enrichment** — Already in place; ensure deck upload flow drives re-score for founders.
6. **Similar-startup inference** — Use investor co-investment graphs to infer sector/stage for sparse startups.

---

## Quick Wins (code changes)

- **`lib/god-field-mapper.js`** — Add more extraction patterns for funding ("raised $X", "Series A"), launched ("live", "in production"), team ("N person team").
- **`scripts/enrich-from-rss-news.js`** — Relax name matching, add more RSS sources.
- **`server/services/urlScrapingService.ts`** — Ensure JSON-LD, meta description, og:tags are parsed before LLM call.
- **Inference gate** — When `extracted_data` has partial info, copy to top-level GOD fields (revenue, customers) before scoring.
