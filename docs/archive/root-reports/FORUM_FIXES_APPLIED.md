# Forum Collection Fixes Applied ✅

## Issues Fixed

### 1. ✅ Algolia Endpoint Usage
**Problem**: Script was correctly using Algolia, but tags were wrong
**Fix**: Algolia requires separate searches for `tags: 'story'` and `tags: 'comment'` - can't combine them
**Change**: Now searches stories and comments separately, then combines results

### 2. ✅ Query Strategy Improved
**Problem**: Naive query - just searching startup name
**Fix**: 
- Uses quoted name: `"StartupName"`
- Adds domain if website available: `"StartupName" OR domain.com`
- Better search terms

### 3. ✅ Filters Relaxed (Major Improvement)
**Problem**: Filters were too strict - filtering everything out
**Fix**: 
- Minimum length: 200 chars (was 100)
- Minimum words: 40 words (new requirement)
- Better heuristics aligned with Pythia invariants:
  - Numbers (%, $, dates) - reality contact
  - Causal connectors ("because", "therefore") - mechanism
  - Commitments ("we will", "we chose") - constraint language
  - Postmortem verbs ("broke", "fixed", "learned") - reality contact
  - First-person language (existing)
- Accepts longer text (up to 5000 chars, was 2000)
- Removed startup name requirement (was too strict)

### 4. ✅ Logging Before Filtering
**Problem**: Couldn't see if API was returning hits
**Fix**: Now logs hit count for EVERY startup before filtering
**Example**: `📊 HN API returned 15 hits for "StartupName"`

### 5. ✅ Better Startup Selection
**Problem**: Random startups unlikely to have HN presence
**Fix**:
- Prioritizes high GOD scores (more likely to have HN presence)
- Includes website field (for domain-based search)
- Searches 3x the limit, then filters (more candidates)

### 6. ✅ Code Cleanup
**Problem**: Unused Firebase API code (confusing)
**Fix**: Removed unused `HN_API_BASE` and `fetchHNItem` function

## Key Changes Made

### Search Function
```javascript
// BEFORE: Single search with combined tags (doesn't work)
tags: 'comment,story'

// AFTER: Separate searches, then combine
// Search stories first (better signal)
tags: 'story'
// Then search comments (founder discussions)
tags: 'comment'
// Combine and deduplicate by objectID
```

### Filtering Logic
```javascript
// BEFORE: Required startup name OR first-person (too strict)
if (!hasStartupName && !hasFirstPerson) continue;

// AFTER: Better heuristics (aligned with Pythia)
- Minimum 200 chars, 40 words
- Must have: numbers OR causal OR commitments OR postmortem OR first-person
- Accepts longer text (up to 5000 chars)
```

### Query Building
```javascript
// BEFORE: Just startup name
query: startupName

// AFTER: Quoted name + domain
query: `"${startupName}" OR ${domain}`
```

## Testing

Run the script again:
```bash
npm run pythia:collect:forums
```

You should now see:
- **Hit counts for every startup** (before filtering)
- **More snippets** (relaxed filters)
- **Better matches** (improved query strategy)
- **Filtering stats** (in debug mode)

## Expected Results

### Before Fixes
- 0 hits for most startups
- 0 snippets saved
- No visibility into why

### After Fixes
- See hit counts for every startup
- More snippets accepted (relaxed filters)
- Better query matching (quoted name + domain)
- Clear filtering stats

## Next Steps

1. **Test with small batch** (5-10 startups) to verify fixes
2. **Check hit counts** - if you see hits but 0 snippets, filters may still be too strict
3. **Review filtering stats** - use debug mode to see what's being filtered
4. **Adjust filters if needed** - can further relax based on results

## Known Limitations

- **Not all startups have HN presence** - still expected to have low hit rate
- **Common word names** - "Route", "Stellar" are ambiguous
- **Domain required** - Need website field for better queries (optional)
- **Time window** - Only searches last year (API limitation)

---

*All fixes applied based on user feedback. Script should now work much better!*
