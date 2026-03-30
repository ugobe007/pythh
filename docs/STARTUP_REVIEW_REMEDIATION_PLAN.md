# Startup Review Pipeline — Remediation Plan

## Ontology (word intent)

Word strings are layers of logic. Parsing must understand the **intent** of words:

| Role | Function | Example |
|------|----------|---------|
| **Noun** | Object (entity we want) | Coca Cola, Mattilda, Halter |
| **Adjective** | Descriptor — strip to reach noun | Mexican edtech, YC-backed |
| **Adverb** | Helper — modifies verb | quickly, recently |
| **Verb** | Action — anchor of the sentence | raises, backs, acquires |
| **Other** | Support (prepositions, conjunctions) | to, and, but |

Without correct ontological parsing we are blind to the words.

---

## Five issues identified in the startup discovery/review flow

| # | Issue | Root cause | Where it breaks |
|---|-------|------------|-----------------|
| 1 | **Not properly identified** | Headline extractor has few patterns; many valid headlines don't match | `lib/headlineExtractor.js` |
| 2 | **Not disassociated from headline** | Names like "AI Cow Collar Startup" stored instead of actual company name | Same — extractor returns null or wrong fragment |
| 3 | **No ontological parsing** | `extractSectors` / ontology not used in discovery → discovered_startups | `discover-more-startups.js`, `extract-missing-series-a-b` |
| 4 | **No inference parsing** | `extractInferenceData` not run at discovery; only at import | Discover scripts don't call it |
| 5 | **Skipped or deleted** | Gate rejects valid names; cleanup heuristics too aggressive | `startupInsertGate`, `cleanup-garbage.js`, `startupNameValidator` |

---

## Current Data Flow (Gaps)

```
RSS headline
    → extractCompanyName (headlineExtractor)  ← FEW PATTERNS, MANY RETURN NULL
    → insertDiscovered (gate validates name)  ← IF NULL, SKIPPED
    → discovered_startups (no sectors, no inference)
    → auto-import-pipeline (runs extractInferenceData on description only)
    → startup_uploads
```

**Missing:** Ontology lookup, sector extraction at discovery, broader headline patterns, inference on article content.

---

## Remediation Plan

### 1. Verb-Centric Headline Extractor (lib/verbCentricExtractor.js)

**Implemented.** The verb anchors the sentence. We extract the SUBJECT (who does the action) or OBJECT (who receives it), not descriptors.

| Pattern | Example | Extract |
|---------|---------|---------|
| Subject-Verb | "Mattilda raises $50M" | Mattilda |
| Descriptor + Noun | "Mexican edtech Mattilda raises" | Mattilda (strip "Mexican edtech") |
| Verb-Object | "Sequoia backs Halter at $2B" | Halter |
| "sell X for $Y" | "KKR to sell CoolIT for $4.75b" | CoolIT |
| Advises | "Goodwin Advises Shellworks On $10M" | Shellworks |

Descriptor stripping: "Mexican edtech", "YC-backed", "Bladder cancer innovator" → stripped; proper noun kept.

### 2. Disassociate Name from Headline

- Never store the full headline as the company name
- Strip descriptors: "AI startup", "fintech company", "data center liquid cooling company" → extract only the proper noun
- Add post-extraction validation: if extracted "name" contains "startup", "company", "funding" → try to trim or reject

### 3. Wire Ontological Parsing

- **discover-more-startups.js:** After extracting company name, run `extractSectors(articleTitle + content)` from `lib/inference-extractor.js` and store in `sectors` field
- **extract-missing-series-a-b:** Same — add sector extraction before insert
- **Optional:** Check ontology DB for entity type (STARTUP vs GENERIC_TERM) before insert — reject GENERIC_TERM

### 4. Wire Inference Parsing

- **discover-more-startups.js:** Call `extractInferenceData(articleContent, articleUrl)` and merge:
  - `funding_amount`, `funding_stage` (from inference)
  - `investors_mentioned` (merge with regex-extracted)
  - Store in discovered_startups or pass to insert
- **extract-missing-series-a-b:** Same
- **auto-import-pipeline:** Already runs inference on description — ensure we pass article content when available

### 5. Reduce Skipped/Deleted

- **Review `startupNameValidator`** — ensure known-good patterns (e.g. "X AI", "X Health") aren't rejected
- **Review `cleanup-garbage.js`** — KNOWN_GOOD_STARTUPS is a start; consider allowlist for short names that pass sector validation
- **Add `LOG_STARTUP_REJECTIONS=1`** in staging — log rejected names to `startup_insert_rejections` to tune rules
- **Discovery:** If extractCompanyName returns null, try `extractCompanyNameFromHeadline` (inference-extractor) as fallback — it has slightly different patterns

---

## Implementation Order

1. **Headline extractor** — Add 3–5 new patterns (backs, for $X, etc.)
2. **Discovery + sectors** — Run `extractSectors` in discover-more-startups and extract-missing-series-a-b
3. **Discovery + inference** — Run `extractInferenceData` on article content, merge funding/investors
4. **Fallback extractor** — Try `extractCompanyNameFromHeadline` when `extractCompanyName` returns null
5. **Rejection monitoring** — Enable `LOG_STARTUP_REJECTIONS`, review, tune validator

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/headlineExtractor.js` | New patterns; trim descriptors from extracted names |
| `lib/inference-extractor.js` | Export `extractCompanyNameFromHeadline` (already exported) |
| `scripts/discover-more-startups.js` | Add extractSectors, extractInferenceData, fallback extractor |
| `scripts/extract-missing-series-a-b-from-rss-pattern-based.js` | Same as above |
| `lib/startupNameValidator.js` | Relax if needed after rejection review |
