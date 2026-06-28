# Test Plan - Expected Results

## Test Sequence to Run

```bash
# Step 1: Baseline health check
npm run pythia:health

# Step 2: Domain RSS collection (50 startups)
npm run pythia:collect:domains 50

# Step 3: Health check after domains
npm run pythia:health

# Step 4: HN forums collection (50 startups)
npm run pythia:collect:forums 50

# Step 5: Final health check
npm run pythia:health
```

## What to Paste Back

### From Step 3 (Health after domains):
```
📊 Tier Distribution:
   Tier 1 (earned): X (X.X%)
   Tier 2 (semi-earned): X (X.X%)
   Tier 3 (PR/marketed): X (X.X%)

🔍 Feature Markers:
   Constraint markers: X (X.X%)
   Mechanism markers: X (X.X%)
   Reality contact markers: X (X.X%)

📡 Top Sources by Yield:
   [source_type]: X snippets (X.X%)
```

### From Step 2 (Domain collector summary):
```
✅ Done: X snippets saved, X skipped
   📊 X startups had RSS feeds

[3-5 representative "📡 Found RSS feed(s)" lines showing clean domains]
```

### From Step 4 (Forums collector summary):
```
✅ Done: X snippets saved, X skipped
   📊 X startups had forum posts
   📊 X startups had no HN results
   📊 X startups had HN results but no substantive comments
   📊 X errors
```

## Expected Outcomes

### Minimum Success (Today)
- Tier 2: > 5%
- Tier 1: > 0 (after HN run)
- Reality contact: > 1-3%
- Constraint: > 3%
- Mechanism: > 3%

### Pass Criteria
1. **Reality contact > 0%** (health bug fix working)
2. **Tier 2 > 0%** (tier classifier working)
3. **Context distribution shows real values** (context_label bug fixed)
4. **"No valid company domain" counts exist** (blacklist working)
5. **Domain examples are clean** (not publisher URLs like pulse2.com, tech.eu)

### If Tier 3 Still = ~100%
Then we need to:
- Strip boilerplate from RSS content
- Prefer `content:encoded` over `contentSnippet`
- Penalize hype-heavy content using adjective/verb ratio

All fixes have been applied. Ready to test!
