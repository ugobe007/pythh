# Forum Collection Testing Guide

## Sanity Test Command

Run this to test if Algolia is now returning hits:

```bash
node scripts/pythia/collect-from-forums.js 10 hn
```

## What to Look For

### ✅ Success Indicators
- **"HN Algolia returned X merged hits"** - This means Algolia API is working!
- **"Extracted Y founder-like comments"** - This means hits exist and passed initial filters
- **"✅ [StartupName]: X snippets saved"** - This means snippets are being saved successfully

### ⚠️ If You See "No HN results found"
- This means Algolia returned 0 hits
- Could be: startup names not on HN, or query issue
- Check debug output for first 5 startups to see what queries are being run

### ⚠️ If You See "No substantive comments found"
- This means Algolia returned hits, but they all failed the founder-likeness gate
- The filtering is too strict for your dataset
- **Solution**: Loosen the filter (see below)

## Adjusting Filter Strictness

### Current (Strict) Version (Recommended)
```javascript
const passes =
  (nameSignal && founderSignal) ||
  (founderSignal && companyRef);
```

**Pros**: Keeps Tier 1 dataset clean (high precision)  
**Cons**: May filter out valid founder speech (lower recall)

### Looser Version (More Recall)
If you see "No substantive comments found" but want more snippets:

```javascript
const passes =
  nameSignal ||
  founderSignal ||
  companyRef;
```

**Pros**: Higher recall (catches more snippets)  
**Cons**: Lower precision (may include some non-founder content)

## Recommended Testing Flow

1. **Run with strict filters first** (current version)
   ```bash
   node scripts/pythia/collect-from-forums.js 10 hn
   ```

2. **Check the results**:
   - If you get snippets saved → Great! Keep strict filters
   - If you see "No substantive comments" but "HN Algolia returned X hits" → Consider loosening

3. **If needed, loosen filters**:
   - Edit `extractSubstantiveComments()` function
   - Change the `passes` logic as shown above
   - Re-run test

4. **Monitor quality**:
   - After loosening, check a few saved snippets manually
   - Ensure they're actually founder speech, not random chatter
   - Adjust as needed

## Debug Output

The script provides debug output for the first 5 startups:

```
🔍 Searching HN for: "StartupName" + domain(example.com)
📊 HN Algolia returned 15 merged hits
🧪 Extract debug: kept=2 tooShort=5 noSignal=8 tooManyUrls=0 tooLong=0
📝 Extracted 2 founder-like comments from 15 hits
```

This shows:
- **kept**: Snippets that passed all filters
- **tooShort**: Hits that were too short (< 140 chars)
- **noSignal**: Hits that didn't pass founder-likeness gate
- **tooManyUrls**: Hits with too many URLs
- **tooLong**: Hits that were too long (> 2200 chars)

## Expected Results

For 10 startups:
- **0-3 startups** might have HN results (typical)
- **5-15 snippets** saved if filters are working
- **Most startups** will show "no HN results" (normal - not all startups are on HN)

---

*Test the script and adjust filters based on results!*
