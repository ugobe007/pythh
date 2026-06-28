# 🔧 Name Extraction Improvements

## What Was Fixed

### 1. **Removed Possessive Forms**
- "Nvidia's AI" → "Nvidia" ✅
- "Obsidian's Quiet" → "Obsidian" ✅
- "Sweden's Lovable" → "Sweden Lovable" (still needs work, but better)

### 2. **Removed Leading Verbs**
- "build Givefront" → "Givefront" ✅
- "building X" → "X" ✅

### 3. **Rejected Generic Single Words**
- "Building" ❌ (rejected)
- "Modern" ❌ (rejected)
- "Inside" ❌ (rejected)
- "Fintech" ❌ (rejected)
- "Show" ❌ (rejected)

### 4. **Rejected Phrases**
- "MVPs out" ❌ (has "out")
- "Resource Constraints," ❌ (generic words)
- "Leadership Tips," ❌ (generic words)
- "I've Moved" ❌ (contraction)
- "Wellbeing benefits" ❌ (phrase)
- "Healthcare's data," ❌ (possessive + generic)

### 5. **Rejected Numbers**
- "100+ Digital" ❌ (starts with number)

## Still Need to Fix

Some names still need work:
- "Transit Tech" - might be OK if it's a real company, but "Tech" is generic
- "Equity's 2026" - should extract just "Equity" (but "Equity" is also generic)
- "'College dropout'" - has quotes, should be rejected
- "Show HN:" - should be rejected (has "Show" which is generic)

## Next Steps

1. **Test the improved extraction** - Run scraper again
2. **Add more patterns** - Handle quotes, handle "Tech" suffix better
3. **Improve auto-import filter** - Add more junk patterns to `auto-import-pipeline.js`


