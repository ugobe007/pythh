# Investor Scraper Fix

## Problem
The investor scraper was finding 0 new investors from 89 sources. Most sources showed "📭" (no investors found).

## Root Cause
1. **Pattern-based extraction too narrow**: Only looked for funding announcement patterns (e.g., "led by X Capital"), not team page structures
2. **AI prompt not optimized for team pages**: Didn't emphasize extracting individual team members
3. **HTML extraction not preserving structure**: Lost structured data from team member cards

## Fixes Applied

### 1. Enhanced Pattern-Based Extraction
- Added `extractFirmNameFromContext()` to extract firm names from URLs
- Added patterns for individual names on team pages (Pattern 5 & 6)
- Associates individual names with firm names: "John Smith (Firm Name)"
- Falls back to adding firm name if no individuals found

### 2. Improved AI Prompt
- Detects team pages from URL or content
- Emphasizes extracting ALL individual team members
- Provides firm name from URL context
- Formats team members as "Name (Firm Name)"

### 3. Better HTML Extraction
- Detects team pages by URL patterns or content
- Extracts structured data from team member cards (`.team-member`, `.person`, `.partner`)
- Preserves name, title, and bio structure
- Also extracts from list items and person cards

## Expected Results
- Should now find individual partners/team members from VC firm team pages
- Should extract firm names even when not explicitly stated
- Should capture more investors from structured team pages

## Testing
Run the scraper again:
```bash
node investor-mega-scraper.js
```

Or test individual URLs:
```bash
node intelligent-scraper.js "https://www.sequoiacap.com/people/" investors
```
