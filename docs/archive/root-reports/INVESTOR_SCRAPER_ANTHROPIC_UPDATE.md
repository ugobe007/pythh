# Investor Scraper - Anthropic Claude Integration

## ✅ Updates Complete

The investor scraper has been updated to use **Anthropic Claude** instead of OpenAI.

### Changes Made

1. **API Provider**: Switched from OpenAI GPT-4o to Anthropic Claude Sonnet 4
2. **API Key**: Now uses `ANTHROPIC_API_KEY` environment variable
3. **Fallback**: Pattern-based extraction still works if AI fails
4. **Model**: Using `claude-sonnet-4-20250514` (same as other services)

### Environment Variable

Make sure your `.env` file has:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### How It Works

1. **Primary**: Uses Claude to intelligently extract investors from web pages
2. **Fallback**: If Claude fails, uses regex patterns to find VC firms
3. **Error Handling**: Gracefully falls back to patterns if API key is missing

### Testing

Test the scraper:
```bash
# Test single URL
node test-investor-scraper.js https://strictlyvc.com/

# Run full scraper
node investor-mega-scraper.js

# Or trigger via API
curl -X POST http://localhost:3002/api/investors/scrape
```

### Benefits of Claude

- ✅ Better at understanding context
- ✅ More accurate entity extraction
- ✅ Handles complex web page structures
- ✅ Better at distinguishing investors from other entities

### Pattern Fallback

If Claude is unavailable, the scraper uses these patterns:
- "led by X Capital/Ventures/Partners"
- "X Capital led the round"
- Standalone VC firm names
- Angel investor mentions

This ensures the scraper always works, even without AI.





