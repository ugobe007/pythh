# Forum Collection Debugging Guide

## Issue: No Data Being Collected

The script ran successfully but found 0 snippets. This could be due to:

1. **No HN Results**: Startup names not mentioned on Hacker News
2. **Too Strict Filtering**: Comments don't match the filter criteria
3. **API Issues**: HN API not returning results

## Debugging Changes Made

### 1. Added Debug Logging
- Shows first 3 startup names being searched
- Logs HN API results for first 3 startups
- Shows extraction results
- Better error categorization

### 2. Relaxed Filtering Logic
**Before**: Required BOTH startup name AND first-person language  
**After**: Requires EITHER startup name OR first-person language

This is more permissive because:
- HN comments often mention startups without first-person language
- Users might discuss startups (not just founders)
- Still filters for relevance (must mention startup or use first-person)

### 3. Better Error Reporting
- Separate counts for "no HN results" vs "no substantive comments"
- Shows sample startup names
- Progress updates every 10 startups

## Testing

Run the script again to see the improved debugging:

```bash
npm run pythia:collect:forums
```

You should now see:
- Sample startup names being searched
- Debug output for first 3 startups
- Breakdown of why snippets were filtered out

## Common Issues

### No HN Results
**Symptom**: "X startups had no HN results"  
**Cause**: Startup names not mentioned on HN  
**Solution**: This is normal - not all startups have HN presence

### No Substantive Comments
**Symptom**: "X startups had HN results but no substantive comments"  
**Cause**: Comments don't meet quality filters  
**Solution**: Filtering is working - comments are too short/spam/low-quality

### API Errors
**Symptom**: Errors in logs  
**Cause**: Network issues or rate limiting  
**Solution**: Check network, wait and retry

## Next Steps

If still no results after debugging:

1. **Test with known startup**: Try searching for a well-known startup (e.g., "Stripe", "OpenAI")
2. **Check HN API directly**: Verify API is working
3. **Review filters**: Consider relaxing further if needed
4. **Try different approach**: Use HN user profiles or story IDs

---

*Last Updated: January 2026*
